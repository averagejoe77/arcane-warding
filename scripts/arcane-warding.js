import { sendMessage, isAbjurerWizard, getArcaneWard, getArcaneWardEffect, hasArcaneWardEffect, getProjectedWardEffect, buildWardEffectData, buildProjectedWardEffectData, getArcaneWardHP, isAbjurationSpell, generateWittyMessage, generateWittyMessagePW, shouldSkip, getActorsWithProjectedWard, useFullMessaging, checkForUpdates } from './utils.js';
import { registerSocket, SOCKET_NAME } from './socket.js';
import { registerAnalytics } from './analytics.js';

/**
 * Arcane Warding Module for Foundry VTT
 * Automates the Abjurer wizard's Arcane Ward feature
 */
class ArcaneWarding {
    constructor() {
        this.ABJURATION_SCHOOLS = ['abjuration', 'abj'];
        this.ABJURER_SUBCLASS = ['Abjurer', 'School of Abjuration'];
        this.langs = {};
        this.initialize();
    }

    async initialize() {
        // Register hooks when the module is ready
        Hooks.once('ready', () => {
            this.registerHooks();
            if(game.user.isGM) {
                checkForUpdates();
            }
        });

    }

    registerHooks() {
        // add the toggle messages button to the item sheet for v13
        Hooks.on('renderItemSheet5e', this.onRenderItemSheet5e.bind(this));
        // add the toggle messages button to the item sheet for v12
        Hooks.on('renderItemSheet5es', this.onRenderItemSheet5e.bind(this));

        // Monitor spell casting hooks - after spell is cast
        Hooks.on('midi-qol.RollComplete', this.onSpellCast.bind(this));

        // add a hook for when the actor takes a long rest
        Hooks.on('dnd5e.restCompleted', this.onRestCompleted.bind(this));

        // add a hook for when the actor takes damage
        Hooks.on('midi-qol.preTargetDamageApplication', this.handleWardDamage.bind(this));

        // add a hook for the for Projected Ward triggering
        Hooks.on('midi-qol.AttackRollComplete', this.triggerProjectedWard.bind(this));
    }

    /**
     * Trigger the Projected Ward
     * 
     * @param {Object} workflow - The workflow object passed in by the midi-qol.AttackRollComplete hook
     */
    async triggerProjectedWard(workflow) {

        const hitDisplayData = workflow.hitDisplayData;

        const key = Object.keys(hitDisplayData)[0];

        const isHit = hitDisplayData[key].hitClass === 'success';

        const attacker = workflow.actor;
        const item = workflow.item;

        const targetActor = hitDisplayData[key].target.actor;

        if(isHit && !hasArcaneWardEffect(targetActor) && !getProjectedWardEffect(targetActor)) {

            // get the actors that have the projected ward feature
            const actors = getActorsWithProjectedWard();
            for(const actor of actors) {
                // check if the actor should skip triggering the projected ward
                if(shouldSkip(actor, targetActor, attacker)) {
                    continue;
                }

                const result = await this.createDialog(item, "PROJECTED_WARD", actor, attacker, targetActor, false, 3);

                // if this wizard declines, give the next one in range the chance to protect the target
                if(result !== 'yes') continue;

                // the marker remembers which wizard projected the ward, so handleWardDamage drains the right one
                const success = await this.applyProjectedWard(actor, targetActor);
                if(success) {
                    if(useFullMessaging(actor)) {
                        sendMessage(game.i18n.format('ARCANE_WARDING.PROJECTED_WARD_APPLIED', { actor: actor.name, target: targetActor.name }), actor);
                    }
                    // only one ward can protect the target
                    break;
                }
            }
        } else {

            const sendMsg = workflow._diceRoll === 1 ? true : Math.random() < 0.5 ? true : false;
            
            if(sendMsg) {
                const msg = generateWittyMessage(targetActor, attacker, "firstPerson");
                sendMessage(msg, targetActor, "emote", true);
            }
        }
        return true;
    }

    /**
     * Absorb damage to a target protected by a Projected Ward, draining the ward of the wizard who projected it
     *
     * @param {Actor} target - The actor protected by the Projected Ward
     * @param {ActiveEffect} marker - The Projected Ward marker effect on the target
     * @param {Object} workflow - The Midi-QOL workflow doing the damage
     * @param {Object} ditem - The Midi-QOL damage item for the target
     */
    async handleProjectedWardDamage(target, marker, workflow, ditem) {
        const attacker = workflow.actor;
        const actor = fromUuidSync(marker.flags['arcane-warding'].protector);

        // the marker only protects against a single hit
        await this.deleteEffectSafe(marker);

        const wardFeature = actor ? getArcaneWard(actor) : null;
        if (!wardFeature) return true;

        const currentWardHP = getArcaneWardHP(actor);
        const totalDamage = ditem.totalDamage;
        const damageToAbsorb = Math.min(currentWardHP, totalDamage);
        const remainingDamage = totalDamage - damageToAbsorb;
        ditem.totalDamage = remainingDamage;
        ditem.hpDamage = remainingDamage;
        ditem.damageDetail.forEach(dd => { dd.value = remainingDamage;});

        const newWardHP = currentWardHP - damageToAbsorb;
        const newSpent = wardFeature.system.uses.max - newWardHP;
        await this.updateItemSafe(wardFeature, { "system.uses.spent": newSpent });

        // update the actor's reaction as used as tracked by midiqol
        game.modules.get("midi-qol").api.setReactionUsed(actor, true);

        let message = game.i18n.format('ARCANE_WARDING.PROJECTED_WARD_ABSORBED_BASE', { actor: actor.name, target: target.name, attacker: attacker.name });

        if(newWardHP === 0) {
            message += game.i18n.format('ARCANE_WARDING.PROJECTED_WARD_ABSORBED_0HP', { actor: actor.name, target: target.name });
        } else {
            message += game.i18n.format('ARCANE_WARDING.PROJECTED_WARD_ABSORBED_SUCCESS', { actor: actor.name, target: target.name });
        }

        if(useFullMessaging(actor)) {
            sendMessage(message, actor);
        }

        if(remainingDamage === 0) {
            // generate a random message for the target to say to the actor (or the attacker)
            let scope = Math.random() < 0.5 ? "attacker" : "actor";

            let wittyPWMessage = generateWittyMessagePW(actor, target, attacker, scope);

            if(useFullMessaging(actor)) {
                sendMessage(wittyPWMessage, target, "emote", true);
            }
        }

        return true;
    }

    /**
     * Render the item sheet for the Arcane Ward
     * 
     * @param {Object} sheet - The sheet object
     * @param {string} html - The html of the sheet
     * @param {Object} data - The data of the sheet
     */
    async onRenderItemSheet5e(sheet, html, data) {
        const $html = $(html);

        const item = data.item;
        if (!item || item.name !== 'Arcane Ward') return;

        // Ensure the flag is present, carrying over the value from the old "arcaneWarding" flag scope
        if (item.getFlag('arcane-warding', 'fullMessaging') === undefined) {
            await item.update({ 'flags.arcane-warding.fullMessaging': item.flags?.arcaneWarding?.fullMessaging ?? false }, { render: false });
        }

        // Determine automation state
        const enabled = item.getFlag('arcane-warding', 'fullMessaging') ?? false;

        const icon = enabled ? 'fa-toggle-on' : 'fa-toggle-off';

        const btn = $(`
            <div class="arcane-ward-wrap ${enabled ? 'arcane-ward-wrap-enabled' : 'arcane-ward-wrap-disabled'}">
                <p class="arcane-ward-toggle-title">Toggle Messages</p>
                <span class="arcane-ward-toggle-icon"><i class="fas ${icon}"></i> ${enabled ? 'Enabled' : 'Disabled'}</span>
                <input type="checkbox" class="arcane-ward-toggle" ${enabled ? 'checked' : ''}>
                <label for="arcane-ward-toggle"></label>
            </div>
        `);

        btn.on('click', async (event) => {
            event.preventDefault();
            
            const currentEnabled = item.getFlag('arcane-warding', 'fullMessaging') ?? false;
            const newEnabled = !currentEnabled;

            await item.update({ 'flags.arcane-warding.fullMessaging': newEnabled }, { render: false });

            // Update UI elements directly
            const $wrap = $(event.currentTarget);
            $wrap.toggleClass('arcane-ward-wrap-enabled', newEnabled).toggleClass('arcane-ward-wrap-disabled', !newEnabled);
            
            const $span = $wrap.find('.arcane-ward-toggle-icon');
            const iconClass = newEnabled ? 'fa-toggle-on' : 'fa-toggle-off';
            const text = newEnabled ? 'Enabled' : 'Disabled';
            $span.html(`<i class="fas ${iconClass}"></i> ${text}`);
            
            const $checkbox = $wrap.find('input.arcane-ward-toggle');
            $checkbox.prop('checked', newEnabled);
        });

        const sheetHeader = $html.find('.window-content .sheet-header .right');
        if (sheetHeader.length > 0 && !$html.find('.arcane-ward-wrap').length) {
            sheetHeader.append(btn);
        }
    }

    /**
     * Heal the Arcane Ward
     * 
     * @param {Item} wardFeature - The Arcane Ward feature
     * @param {Spell} spell - The spell that was cast
     */
    async healArcaneWard(wardFeature, spell, spellLevel) {

        const currentSpent = wardFeature.system.uses.spent;

        if (currentSpent === 0) {
            if(useFullMessaging(wardFeature.actor)) {
                sendMessage(game.i18n.format('ARCANE_WARDING.WARD_AT_MAX', { actor: wardFeature.actor.name }), wardFeature.actor);
            }
            return {
                success: false
            }
        }

        const healAmount = spellLevel * 2;

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

        // A target protected by another wizard's Projected Ward
        const projectedWard = getProjectedWardEffect(actor);
        if (projectedWard) return this.handleProjectedWardDamage(actor, projectedWard, workflow, ditem);

        const wardFeature = getArcaneWard(actor);
        const attacker = workflow.token;
        if (!wardFeature || !isAbjurerWizard(actor, this.ABJURER_SUBCLASS) || !hasArcaneWardEffect(actor)) return true;

        let currentWardHP = getArcaneWardHP(actor);

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

        await this.updateItemSafe(wardFeature, { "system.uses.spent": newSpent });

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

        if(useFullMessaging(actor)) {
            sendMessage(message, actor);
        }

        if (remainingDamage === 0) {

            // determine the scope of the message
            const scope = Math.random() < 0.5 ? "firstPerson" : "thirdPerson";

            // generate the witty message based on the scope
            let wittyMessage = generateWittyMessage(actor, attacker, scope);

            // defaults for type of message and if we should use a bubble
            let useBubble = false;
            let type = "publicroll";

            // if the message is first person, we should use a bubble
            if(scope === "firstPerson") {
                useBubble = true;
                type = "emote";
            }

            if(useFullMessaging(actor)) {
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
        if(data.type !== 'long') return;

        // the module owns removal of its effects on a long rest (wards no longer carry a DAE longRest duration)
        const ward = getArcaneWardEffect(actor);
        const ids = [ward, getProjectedWardEffect(actor)].filter(e => e).map(e => e.id);
        if(!ids.length) return;

        try {
            await actor.deleteEmbeddedDocuments('ActiveEffect', ids.filter(id => actor.effects.has(id)));
        } catch (error) {
            // wards created by older versions still carry the DAE longRest duration and may already be gone
            console.warn("Arcane Warding | Ward effect was already removed during the long rest.", error);
        }

        if(ward && useFullMessaging(actor)) {
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
        if (!isAbjurerWizard(actor, this.ABJURER_SUBCLASS)) return;

        const spell = workflow.item;
        let spellLevel = spell.system.level;
        if(workflow?.castData?.castLevel !== workflow?.castData?.baseLevel) {
            // the spell was upcast so we need to update the spell level
            spellLevel = workflow.castData.castLevel;
        }

        const isAbjSpell = isAbjurationSpell(spell, this.ABJURATION_SCHOOLS);

        if (!isAbjSpell) return;

        await this.processAbjurationSpell(actor, spell, spellLevel);
    }

    /**
     * Process an Abjuration spell cast
     * 
     * @param {Actor} actor - The actor that cast the spell
     * @param {Spell} spell - The spell that was cast
     */
    async processAbjurationSpell(actor, spell, spellLevel) {
        const wardFeature = getArcaneWard(actor);
        if (!wardFeature) {
            sendMessage(game.i18n.format('ARCANE_WARDING.MISSING_FEATURE'), actor);
            return;
        }

        // If no ward exists, ask if they want to create one
        if (!hasArcaneWardEffect(actor)) {
            const result = await this.createDialog(spell, "ARCANE_WARD", actor);
            if(result === 'yes') {
                await wardFeature.update({ "system.uses.spent": 0 });
                await actor.createEmbeddedDocuments("ActiveEffect", [buildWardEffectData(wardFeature)]);
                if(useFullMessaging(actor)) {
                    sendMessage(game.i18n.format('ARCANE_WARDING.EFFECT_CREATED', { actor: actor.name }), actor);
                }
            }
        } else {
            // If the ward exists, heal it
            if (spellLevel === 0) {
                return; // Abjuration cantrips do not charge the ward.
            }

            const result = await this.healArcaneWard(wardFeature, spell, spellLevel);

            if(result.success) {
                if(useFullMessaging(actor)) {
                    sendMessage(game.i18n.format('ARCANE_WARDING.WARD_HEALED', { actor: actor.name }), actor);
                }
            }
        }
    }

    /**
     * Create a dialog to ask the user if they want to use their Arcane Ward
     * 
     * @param {Spell} spell - The spell that was cast or the item that was used to attack
     * @param {string} type - The type of dialog to create: "ARCANE_WARD" or "PROJECTED_WARD"
     * @param {Actor} actor - The actor that is casting the spell or the actor that has the arcane ward
     * @param {Actor} attacker - The actor that is attacking the target or the actor that is using the item or spell
     * @param {Actor} target - The actor that is being attacked or the actor that is being protected by the arcane ward
     * @param {boolean} fromSocket - Whether the dialog is being created from a socket
     */
    async createDialog(spell = null, type = "ARCANE_WARD", actor = null, attacker = null, target = null, fromSocket = false, timeout = null) {
        let owner = actor ? game.users.find(u => u.character?.id === actor.id && u.active && !u.isGM) : game.user;

        // If an actor is provided but no active player owner is found, route to an active GM instead
        if (actor && !owner) {
            owner = game.users.find(u => u.isGM && u.active);
        }

        if (owner && owner.id !== game.user.id && !fromSocket) {
            return new Promise((resolve) => {
                const requestId = foundry.utils.randomID();
                game.socket.emit(SOCKET_NAME, {
                    type: 'createDialog',
                    user: owner.id,
                    payload: {
                        spellName: spell ? spell.name : null,
                        type: type,
                        actorId: actor ? actor.id : null,
                        attackerId: attacker ? attacker.id : null,
                        targetId: target ? target.id : null,
                        requestId: requestId,
                        timeout: timeout
                    }
                });

                const listener = (data) => {
                    if (data.type === 'dialogResult' && data.payload.originalRequest.requestId === requestId) {
                        game.socket.off(SOCKET_NAME, listener);
                        resolve(data.payload.result);
                    }
                };
                game.socket.on(SOCKET_NAME, listener);
            });
        }

        const data = {}
        if (spell) {
            data.spell = spell.name;
        }
        if (actor) {
            data.actor = actor.name;
        }
        if (attacker) {
            data.attacker = attacker.name;
        }
        if (target) {
            data.target = target.name;
        }

        const classes = ['arcane-warding-dialog'];
        if(type === 'PROJECTED_WARD') {
            classes.push('projected-ward-dialog');
        }

        const title = game.i18n.format(`ARCANE_WARDING.DIALOG.${type}.TITLE`, data);
        const content = game.i18n.format(`ARCANE_WARDING.DIALOG.${type}.CONTENT`, data);
        const yesLabel = game.i18n.format('ARCANE_WARDING.LABEL_YES');
        const noLabel = game.i18n.format('ARCANE_WARDING.LABEL_NO');

        if (game.release.generation >= 13) {
            return this._createDialog(title, content, yesLabel, noLabel, classes, timeout);
        } else {
            return this._createDialogLegacy(title, content, yesLabel, noLabel, timeout);
        }
    }

    /**
     * Create a dialog for v13
     * 
     * @param {string} title - The title of the dialog
     * @param {string} content - The content of the dialog
     * @param {string} yesLabel - The label for the yes button
     * @param {string} noLabel - The label for the no button
     * @param {string[]} classes - The classes for the dialog
     * @param {number} timeout - The timeout for the dialog
     * @returns {Promise<string>} The result of the dialog
     */
    _createDialog(title, content, yesLabel, noLabel, classes, timeout) {
        return new Promise((resolve) => {
            let timerId;
            let resolved = false;

            const complete = (result) => {
                if (resolved) return;
                resolved = true;
                if (timerId) clearTimeout(timerId);
                resolve(result);
            };

            const dialog = new foundry.applications.api.DialogV2({
                classes: classes,
                window: {title: title},
                content: content,
                buttons: [
                    { action: 'yes', label: yesLabel, callback: () => {
                        complete('yes');
                        dialog.close();
                    }},
                    { action: 'no', label: noLabel, callback: () => {
                        complete('no');
                        dialog.close();
                    }}
                ],
                default: 'no',
                close: () => {
                    complete('no');
                }
            });

            dialog.render(true);

            if (timeout) {
                timerId = setTimeout(() => {
                    complete('no');
                    dialog.close();
                }, timeout * 1000);
            }
        });
    }

    /**
     * Create a dialog for v12
     * 
     * @param {string} title - The title of the dialog
     * @param {string} content - The content of the dialog
     * @param {string} yesLabel - The label for the yes button
     * @param {string} noLabel - The label for the no button
     * @param {number} timeout - The timeout for the dialog
     * @returns {Promise<string>} The result of the dialog
     */
    _createDialogLegacy(title, content, yesLabel, noLabel, timeout) {
        return new Promise((resolve) => {
            let timerId;
            let resolved = false;

            const finalResolve = (result) => {
                if (resolved) return;
                resolved = true;
                if (timerId) clearTimeout(timerId);
                resolve(result);

            };

            const dialog = new Dialog({
                title: title,
                content: content,
                buttons: {
                    yes: {
                        icon: '<i class="fas fa-check"></i>',
                        label: yesLabel,
                        callback: () => finalResolve("yes")
                    },
                    no: {
                        icon: '<i class="fas fa-times"></i>',
                        label: noLabel,
                        callback: () => finalResolve("no")
                    }
                },
                default: 'no',
                close: () => finalResolve('no')
            });
            dialog.render(true);

            if (timeout) {
                timerId = setTimeout(() => dialog.close(), timeout * 1000);
            }
        });
    }

    /**
     * Apply the Projected Ward marker effect to the target
     *
     * @param {Actor} actor - The wizard projecting their Arcane Ward
     * @param {Actor} target - The target to protect
     */
    async applyProjectedWard(actor, target) {
        const wardFeature = getArcaneWard(actor);
        if(wardFeature) {
            const effectData = buildProjectedWardEffectData(wardFeature, actor);
            if (target.isOwner || game.user.isGM) {
                const newEffect = await target.createEmbeddedDocuments("ActiveEffect", [effectData]);
                if(newEffect) return true;
            } else {
                return new Promise((resolve) => {
                    const requestId = foundry.utils.randomID();
                    game.socket.emit(SOCKET_NAME, {
                        type: 'applyEffect',
                        payload: {
                            targetUuid: target.uuid,
                            effectData: effectData,
                            requestId: requestId
                        }
                    });

                    let resolved = false;
                    const listener = (data) => {
                        if (data.type === 'applyEffectResult' && data.payload.requestId === requestId) {
                            if (!resolved) {
                                resolved = true;
                                game.socket.off(SOCKET_NAME, listener);
                                resolve(data.payload.success);
                            }
                        }
                    };
                    game.socket.on(SOCKET_NAME, listener);

                    // Fallback timeout in case no GM is connected to apply the effect
                    setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            game.socket.off(SOCKET_NAME, listener);
                            console.warn("Arcane Warding | Timed out waiting for GM to apply Arcane Ward effect.");
                            resolve(false);
                        }
                    }, 5000);
                });
            }
        }
        return false;
    }

    /**
     * Update an item safely, routing through GM if the user lacks ownership
     * 
     * @param {Item} item - The item to update
     * @param {Object} updates - The updates to apply
     */
    async updateItemSafe(item, updates) {
        if (item.isOwner || game.user.isGM || (item.actor && item.actor.isOwner)) {
            await item.update(updates);
            return true;
        } else {
            return new Promise((resolve) => {
                const requestId = foundry.utils.randomID();
                game.socket.emit(SOCKET_NAME, {
                    type: 'updateItem',
                    payload: {
                        itemUuid: item.uuid,
                        updates: updates,
                        requestId: requestId
                    }
                });

                let resolved = false;
                const listener = (data) => {
                    if (data.type === 'updateItemResult' && data.payload.requestId === requestId) {
                        if (!resolved) {
                            resolved = true;
                            game.socket.off(SOCKET_NAME, listener);
                            resolve(data.payload.success);
                        }
                    }
                };
                game.socket.on(SOCKET_NAME, listener);

                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        game.socket.off(SOCKET_NAME, listener);
                        console.warn("Arcane Warding | Timed out waiting for GM to update item.");
                        resolve(false);
                    }
                }, 5000);
            });
        }
    }

    /**
     * Delete an effect safely, routing through GM if the user lacks ownership
     * 
     * @param {ActiveEffect} effect - The effect to delete
     */
    async deleteEffectSafe(effect) {
        if (effect.isOwner || game.user.isGM || (effect.parent && effect.parent.isOwner)) {
            await effect.delete();
            return true;
        } else {
            return new Promise((resolve) => {
                const requestId = foundry.utils.randomID();
                game.socket.emit(SOCKET_NAME, {
                    type: 'deleteEffect',
                    payload: {
                        effectUuid: effect.uuid,
                        requestId: requestId
                    }
                });

                let resolved = false;
                const listener = (data) => {
                    if (data.type === 'deleteEffectResult' && data.payload.requestId === requestId) {
                        if (!resolved) {
                            resolved = true;
                            game.socket.off(SOCKET_NAME, listener);
                            resolve(data.payload.success);
                        }
                    }
                };
                game.socket.on(SOCKET_NAME, listener);

                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        game.socket.off(SOCKET_NAME, listener);
                        console.warn("Arcane Warding | Timed out waiting for GM to delete effect.");
                        resolve(false);
                    }
                }, 5000);
            });
        }
    }
}

// Initialize the module
Hooks.once('init', () => {
    game.settings.register('arcane-warding', 'lastNotifiedVersion', {
        scope: 'world',
        config: false,
        type: String,
        default: ''
    });

    game.settings.register('arcane-warding', 'usageTelemetry', {
        name: 'ARCANE_WARDING.SETTINGS.TELEMETRY.NAME',
        hint: 'ARCANE_WARDING.SETTINGS.TELEMETRY.HINT',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    });

    // Stable anonymous id for this world, used only by usage telemetry.
    game.settings.register('arcane-warding', 'instanceId', {
        scope: 'world',
        config: false,
        type: String,
        default: ''
    });

    game.arcaneWarding = new ArcaneWarding();
    registerSocket();
    registerAnalytics();
});