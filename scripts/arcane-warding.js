import { sendMessage } from './utils.js';

/**
 * Arcane Warding Module for Foundry VTT
 * Automates the Abjurer wizard's Arcane Ward feature
 */
class ArcaneWarding {
    constructor() {
        this.ABJURATION_SCHOOLS = ['abjuration', 'abj'];
        this.ABJURER_SUBCLASS = 'Abjurer';

        this.fullMessaging = false;
        this.langs = {};

        this.initialize();
    }

    async initialize() {
        // Register hooks when the module is ready
        Hooks.once('ready', () => {
            this.registerHooks();
            // get all the actors
            const actors = game.actors.contents;
            actors.forEach(actor => {
                if(actor.type === 'character' && this.isAbjurerWizard(actor) && !this.hasArcaneWardEffect(actor)) {
                    const wardFeature = this.getArcaneWard(actor);
                    if(wardFeature) this.createArcaneWard(wardFeature, actor);
                }
            });
        });

    }

    registerHooks() {
        Hooks.on('renderItemSheet5e', this.onRenderItemSheet5e.bind(this));

        // Monitor spell casting hooks - after spell is cast
        Hooks.on('midi-qol.RollComplete', this.onSpellCast.bind(this));

        // add a hook for when the actor takes a long rest
        Hooks.on('dnd5e.restCompleted', this.onRestCompleted.bind(this));

        // add a hook for when the actor takes damage
        Hooks.on('midi-qol.preTargetDamageApplication', this.handleWardDamage.bind(this));
    }

    onRenderItemSheet5e(sheet, html, data) {
        const $html = $(html);

        const item = data.item;
        if (!item || item.name !== 'Arcane Ward') return;

        // Determine automation state
        const enabled = item.flags?.['arcaneWarding']?.arcaneWard?.fullMessaging;

        const icon = enabled ? 'fa-toggle-on' : 'fa-toggle-off';

        const btn = $(`<div class="arcane-ward-wrap ${enabled ? 'arcane-ward-wrap-enabled' : 'arcane-ward-wrap-disabled'}"><p class="arcane-ward-toggle-title">Toggle Messages</p><span class="arcane-ward-toggle-icon"><i class="fas ${icon}"></i> ${enabled ? 'Enabled' : 'Disabled'}</span><input type="checkbox" class="arcane-ward-toggle" ${enabled ? 'checked' : ''}><label for="arcane-ward-toggle"></label></div>`);

        btn.on('click', async (event) => {
            event.preventDefault();
            await item.update({['flags.arcaneWarding.arcaneWard.fullMessaging']: enabled ? false : true});
            this.fullMessaging = item.flags?.['arcaneWarding']?.arcaneWard?.fullMessaging;
            sheet.render(false);
        });

        const sheetHeader = $html.find('.window-content .sheet-header .right');
        if (sheetHeader) {
            sheetHeader.append(btn);
        }
    }

    /**
     * Create the Arcane Ward effect
     * 
     * @param {Item} wardFeature - The Arcane Ward feature
     * @param {Actor} actor - The actor that cast the spell
     */
    async createArcaneWard(wardFeature, actor) {
        if (!wardFeature) {
            sendMessage(game.i18n.format('ARCANE_WARDING.MISSING_FEATURE'), actor);
            return;
        }

        await wardFeature.update({ "system.uses.spent": 0 });

        // --- Effect Handling ---
        let effect = this.getArcaneWardEffect(wardFeature);
        if (!effect) {
            const effectData = {
                name: game.i18n.format('ARCANE_WARDING.EFFECT_NAME'),
                label: game.i18n.format('ARCANE_WARDING.EFFECT_LABEL'),
                description: wardFeature.system.description.value,
                icon: "icons/magic/defensive/shield-barrier-flaming-pentagon-blue-yellow.webp",
                origin: wardFeature.uuid,
                disabled: false,
                transfer: false,
                flags: {
                    dae: { showIcon: true, specialDuration: ["longRest"] }
                }
            };
            // After creation, the effect will be on the wardFeature, so we can get it.
            const [createdEffect] = await wardFeature.createEmbeddedDocuments("ActiveEffect", [effectData]);
            effect = createdEffect; // Use the returned created effect
        }

        if (!effect) {
            console.error("Arcane Warding | Failed to get or create the effect.");
            return;
        }

        // --- Activity Handling ---
        const activities = foundry.utils.deepClone(wardFeature.system.activities);
        const createWardActivity = activities.find(activity => activity.name === "Create Ward");

        if (!createWardActivity) {
            console.log(`%cArcane Ward | Missing 'Create Ward' activity.`, "color: #ff0000");
            return;
        }

        if (!createWardActivity.effects) {
            createWardActivity.effects = [];
        }

        if (!createWardActivity.effects.includes(effect.uuid)) {
            createWardActivity.effects.push(effect.uuid);
            await wardFeature.update({ "system.activities": activities });
            // check if the activity has the effect
            if(createWardActivity.effects.includes(effect.uuid)) {
            console.log(`%cArcane Ward | Linked effect to 'Create Ward' activity for ${actor.name}.`, "color: #00ff00");
            } else {
                console.log(`%cArcane Ward | Effect not linked to 'Create Ward' activity for ${actor.name}.`, "color: #ff0000");
            }
        } else {
            console.log(`%cArcane Ward | Effect already linked to 'Create Ward' activity for ${actor.name}.`, "color: #ffff00");
        }
    }


    /**
     * Heal the Arcane Ward
     * 
     * @param {Item} wardFeature - The Arcane Ward feature
     * @param {Spell} spell - The spell that was cast
     */
    async healArcaneWard(wardFeature, spell) {

        const currentSpent = wardFeature.system.uses.spent;

        if (currentSpent === 0) {
            if(this.fullMessaging) {
                sendMessage(game.i18n.format('ARCANE_WARDING.WARD_AT_MAX', { actor: wardFeature.actor.name }), wardFeature.actor);
            }
            return {
                success: false
            }
        }

        const healAmount = spell.system.level * 2;
        
        const newSpent = Math.max(0, currentSpent - healAmount);
        
        await wardFeature.update({ "system.uses.spent": newSpent });
        
        return {
            success: true,
            requested: healAmount,
            actual: healAmount,
            item: wardFeature
        }
    }

    /**
     * Handle the damage to the Arcane Ward and the actor
     * 
     * @param {Token} token - The token that took damage
     * @param {Object} data - The data consists of the workflow and the item doing the damage
     */
    async handleWardDamage(token, {workflow, ditem}) {

        // If the "damage" is actually healing, or the attack missed, don't absorb it with the ward.
        if (ditem.damageDetail.some(detail => detail.type === 'healing') || !ditem.isHit) {
            return true;
        }

        const actor = token.actor;
        const wardFeature = this.getArcaneWard(actor);
        const attacker = workflow.token;
        if (!this.isAbjurerWizard(actor) || !this.hasArcaneWardEffect(actor)) return true;

        let currentWardHP = this.getArcaneWardHP(actor);

        if (currentWardHP === 0) return true;

        const totalDamage = ditem.totalDamage;
        if (totalDamage === 0) return true;

        const damageToAbsorb = Math.min(currentWardHP, totalDamage);
        const remainingDamage = totalDamage - damageToAbsorb;

        ditem.totalDamage = remainingDamage;
        ditem.hpDamage = remainingDamage;
        ditem.damageDetail.forEach(dd => { dd.value = remainingDamage;});
        
        const newWardHP = currentWardHP - damageToAbsorb;
        const newSpent = wardFeature.system.uses.max - newWardHP;

        await wardFeature.update({ "system.uses.spent": newSpent });

        let message = game.i18n.format('ARCANE_WARDING.ABSORBED_MESSAGE_BASE', { actor: actor.name, amount: Math.ceil(damageToAbsorb) });

        if (newWardHP === 0) {
            message += game.i18n.format('ARCANE_WARDING.ABSORBED_MESSAGE_0HP', { actor: actor.name });
            if(remainingDamage > 0) {
                message += game.i18n.format('ARCANE_WARDING.ABSORBED_MESSAGE_REMAINING_DMG', { actor: actor.name, remaining: Math.ceil(remainingDamage) }); 
            } else {
                message += game.i18n.format('ARCANE_WARDING.ABSORBED_MESSAGE_NO_DMG', { actor: actor.name });
            }
        } else {
            message += game.i18n.format('ARCANE_WARDING.ABSORBED_MESSAGE_SUCCESS', { actor: actor.name });
        }

        if(this.fullMessaging) {
            sendMessage(message, actor);
        }

        if (remainingDamage === 0) {

            // determine the scope of the message
            const scope = Math.random() < 0.5 ? "firstPerson" : "thirdPerson";

            // generate the witty message based on the scope
            let wittyMessage = this.generateWittyMessage(actor, attacker, scope);

            // defaults for type of message and if we should use a bubble
            let useBubble = false;
            let type = "publicroll";

            // if the message is first person, we should use a bubble
            if(scope === "firstPerson") {
                useBubble = true;
                type = "emote";
            }

            if(this.fullMessaging) {
                sendMessage(wittyMessage, actor, type, useBubble);
            }
        }
        
        return true;
    }

    /**
     * Handle the long rest
     * 
     * @param {Actor} actor - The actor that took a long rest
     * @param {Object} data - The data object from the long rest
     */
    async onRestCompleted(actor, data) {
        // get the arcane ward effect
        const hasArcaneWardEffect = this.hasArcaneWardEffect(actor);
        if(hasArcaneWardEffect && data.type === 'long' && this.fullMessaging) {
            sendMessage(game.i18n.format('ARCANE_WARDING.LONG_REST', { actor: actor.name }), actor);
        }
    }

    /**
     * Handle spell casting
     * 
     * @param {Object} workflow - The workflow object from Midi-QOL
     */
    async onSpellCast(workflow) {
        if (workflow.item?.type !== 'spell' || workflow.actor.type !== 'character') return;

        const actor = workflow.actor;
        if (!this.isAbjurerWizard(actor)) return;

        const spell = workflow.item;
        const isAbjurationSpell = this.isAbjurationSpell(spell);

        if (!isAbjurationSpell) return;

        await this.processAbjurationSpell(actor, spell);
    }

    /**
     * Process an Abjuration spell cast
     * 
     * @param {Actor} actor - The actor that cast the spell
     * @param {Spell} spell - The spell that was cast
     */
    async processAbjurationSpell(actor, spell) {
        const wardFeature = this.getArcaneWard(actor);
        const hasWardEffect = actor.effects.find(ef => ef.name === game.i18n.format('ARCANE_WARDING.EFFECT_NAME'));
        
        // If no ward exists, ask if they want to create one
        if (!hasWardEffect) {
            const result = await this.createDialog(spell);
            if(result === 'yes') {
                // Find the "Create Ward" activity and apply its effects
                const createWardActivity = wardFeature.system.activities.find(a => a.name === "Create Ward");
                if (createWardActivity) {
                    const effect = this.getArcaneWardEffect(wardFeature);
                    if (effect) {
                        await actor.createEmbeddedDocuments("ActiveEffect", [effect.toObject()]);
                        if(this.fullMessaging) {
                            sendMessage(game.i18n.format('ARCANE_WARDING.EFFECT_CREATED', { actor: actor.name }), actor);
                        }
                    }
                }
            }
        } else {
            // If the ward exists, heal it
            const spellLevel = spell.system.level;
            if (spellLevel === 0) {
                return; // Abjuration cantrips do not charge the ward.
            }

            const result = await this.healArcaneWard(wardFeature, spell);

            if(result.success) {
                if(this.fullMessaging) {
                    sendMessage(game.i18n.format('ARCANE_WARDING.WARD_HEALED', { actor: actor.name }), actor);
                }
            }
        }
    }

    /**
     * Create a dialog to ask the user if they want to create an Arcane Ward.
     * v12 and v13 have different dialogs, so we need to handle both.
     * 
     * @param {Spell} spell - The spell that was cast
     * @returns {Promise<string>} - The result of the dialog
    */
    async createDialog(spell) {
        const title = game.i18n.format('ARCANE_WARDING.DIALOG_TITLE');
        const content = game.i18n.format('ARCANE_WARDING.DIALOG_CONTENT', { spell: spell.name });
        const yesLabel = game.i18n.format('ARCANE_WARDING.LABEL_YES');
        const noLabel = game.i18n.format('ARCANE_WARDING.LABEL_NO');

        if (game.release.generation >= 13) {
            const proceed = await foundry.applications.api.DialogV2.confirm({
                window: {title: title},
                content: content,
                yes: { label: yesLabel },
                no: { label: noLabel },
                rejectClose: false,
            });
            return proceed ? "yes" : "no";
        } else {
            return new Promise((resolve) => {
                new Dialog({
                    title: title,
                    content: content,
                    buttons: {
                        yes: {
                            icon: '<i class="fas fa-check"></i>',
                            label: yesLabel,
                            callback: () => resolve("yes")
                        },
                        no: {
                            icon: '<i class="fas fa-times"></i>',
                            label: noLabel,
                            callback: () => resolve("no")
                        }
                    },
                    default: noLabel,
                    close: () => resolve(noLabel)
                }).render(true);
            });
        }
    }

    // utilitiy functions
    
    /**
     * Check if an actor is an Abjurer wizard
     * 
     * @param {Actor} actor - The actor to check
     * @returns {boolean} - True if the actor is an Abjurer wizard, false otherwise
     */
    isAbjurerWizard(actor) {
        if (!actor || !actor.classes) return false;
        
        const subclass = actor.items.find(item =>  {
            return item.type === "subclass" && item.name.includes(this.ABJURER_SUBCLASS) ? true : false;
        });

        return subclass;
    }

    /**
     * Get current Arcane Ward data
     * 
     * @param {Actor} actor - The actor to check
     * @returns {Item} - The Arcane Ward item
     */
    getArcaneWard(actor) {
        if(this.hasArcaneWard(actor)) {
            return actor.items.find(item => item.type === 'feat' && item.name.includes('Arcane Ward'));
        }
        return null;
    }

    /**
     * Check if the actor has the Arcane Ward feature
     * 
     * @param {Actor} actor - The actor to check
     * @returns {boolean} - True if the actor has an Arcane Ward, false otherwise
     */
    hasArcaneWard(actor) {
        return actor.items.find(item => item.type === 'feat' && item.name.includes('Arcane Ward')) ? true : false;
    }

    /**
     * Get the Arcane Ward effect
     * 
     * @param {Item or Actor} item - The item or actor to check
     * @returns {ActiveEffect} - The Arcane Ward effect
     */
    getArcaneWardEffect(item) {
        if(this.hasArcaneWardEffect(item)) {
            return item.effects.find(effect => effect.name === "Arcane Ward");
        }
        return null;
    }

    /**
     * Check if the actor has the Arcane Ward effect
     * 
     * @param {Actor or Item} item - The actor or item to check
     * @returns {boolean} - True if the actor has an Arcane Ward effect, false otherwise
     */
    hasArcaneWardEffect(item) {
        return item.effects.find(effect => effect.name === "Arcane Ward") ? true : false;
    }

    /**
     * Get the current HP of the Arcane Ward
     * 
     * @param {Actor} actor - The actor to check
     * @returns {number} - The current HP of the Arcane Ward
     */
    getArcaneWardHP(actor) {
        const ward = this.getArcaneWard(actor);
        return ward.system.uses.value;
    }

    /**
     * Get the maximum HP of the Arcane Ward
     * 
     * @param {Actor} actor - The actor to check
     * @returns {number} - The maximum HP of the Arcane Ward
     */
    getArcaneWardHPMax(actor) {
        const ward = this.getArcaneWard(actor);
        return ward.system.uses.max;
    }

    /**
     * Check if a spell is Abjuration spell
     * 
     * @param {Spell} spell - The spell to check
     * @returns {boolean} - True if the spell is Abjuration, false otherwise
     */
    isAbjurationSpell(spell) {
        if (!spell.system.school) return false;
        return this.ABJURATION_SCHOOLS.some(school => 
            spell.system.school.toLowerCase().includes(school)
        );
    }

    /**
     * Generate a witty message for the actor
     * 
     * @param {Actor} actor - The actor to check
     * @param {Actor} target - The target of the actor
     * @param {string} scope - The scope of the message, "firstPerson" or "thirdPerson"
     * @returns {string} - The witty message
     */
    generateWittyMessage(actor, target, scope = "firstPerson") {

        const wittyMessages = this.getFormattedMessages(actor, target);

        const message = wittyMessages[scope][Math.floor(Math.random() * wittyMessages[scope].length)];

        let result = '';

        if(scope === "firstPerson") {
            result = `<p>${message}.</p>`;
        } else {
            result = `<p><strong>${actor.name}</strong> ${message}.</p>`;
        }

        return result;
    }

    getFormattedMessages(actor, target) {

        const wittyMessagesFirstPerson = game.i18n.translations.ARCANE_WARDING.WITTY_MESSAGES.FIRST_PERSON;
        const wittyMessagesThirdPerson = game.i18n.translations.ARCANE_WARDING.WITTY_MESSAGES.THIRD_PERSON;

        let formattedMessages = {
            firstPerson: [],
            thirdPerson: []
        };

        Object.keys(wittyMessagesFirstPerson).forEach(key => {
            formattedMessages['firstPerson'].push(game.i18n.format(wittyMessagesFirstPerson[key], {target: target.name, actor: actor.name}));
        });

        Object.keys(wittyMessagesThirdPerson).forEach(key => {
            formattedMessages['thirdPerson'].push(game.i18n.format(wittyMessagesThirdPerson[key], { target: target.name, actor: actor.name }));
        });

        return formattedMessages;
    }

}

// Initialize the module
new ArcaneWarding(); 