export const SOCKET_NAME = 'module.arcane-warding';

/**
 * Show a bubble for the actor
 * 
 * @param {string} actorId - The id of the actor
 * @param {string} messageId - The id of the message
 */
export function showBubble(actorId, messageId) {
    const actor = game.actors.get(actorId);
    const message = game.messages.get(messageId);
    if (actor && message) {
        const token = game.scenes.find(s => s.tokens.find(t => t.actorId === actor.id))?.tokens.find(t => t.actorId === actor.id);
        if (token) {
            const tokenObject = canvas.tokens.get(token.id);
            if (tokenObject) {
                canvas.hud.bubbles.say(tokenObject, message.content);
            }
        }
    }
}

/**
 * Handle a send message request
 * 
 * @param {Object} data - The data for the send message request
 */
export function handleSendMessageRequest(data) {
    if (game.user.isGM) {
        ChatMessage.create(data.chatData).then(msg => {
            if (data.useBubble) {
                showBubble(data.actorId, msg.id); // GM shows bubble locally
                game.socket.emit(SOCKET_NAME, {
                    type: 'sayBubble',
                    payload: {
                        messageId: msg.id,
                        actorId: data.actorId
                    }
                });
            }
        });
    }
}

/**
 * Register the socket
 */
export function registerSocket() {
    game.socket.on(SOCKET_NAME, (data) => {
        console.log('Arcane Warding | Socket event received', data);
        if (data.type === 'createDialog' && data.user === game.user.id) {
            handleSocketDialog(data.payload);
        }
        if (data.type === 'sendMessage') {
            handleSendMessageRequest(data.payload);
        }
        if (data.type === 'sayBubble') {
            showBubble(data.payload.actorId, data.payload.messageId);
        }
    });
}

/**
 * Handle a socket dialog request
 * 
 * @param {Object} data - The data for the socket dialog request
 */
async function handleSocketDialog(data) {
    console.log('Arcane Warding | Handling createDialog socket event', data);
    const actor = data.actorId ? game.actors.get(data.actorId) : null;
    const attacker = data.attackerId ? game.actors.get(data.attackerId) : null;
    const target = data.targetId ? game.actors.get(data.targetId) : null;
    const spell = data.spellName ? { name: data.spellName } : null;
    const timeout = data.timeout || null;

    const result = await game.arcaneWarding.createDialog(spell, data.type, actor, attacker, target, true, timeout);
    
    game.socket.emit(SOCKET_NAME, {
        type: 'dialogResult',
        payload: {
            result: result,
            originalRequest: data
        }
    });
}