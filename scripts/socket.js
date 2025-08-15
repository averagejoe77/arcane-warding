export const SOCKET_NAME = 'module.arcane-warding';

export function registerSocket() {
	console.log('%c Arcane Warding | Registering socket', 'color: #00ff00');
    game.socket.on(SOCKET_NAME, (data) => {
        console.log('%c Arcane Warding | Socket event received', 'color: #00ff00', data);
        if (data.type === 'createDialog' && data.user === game.user.id) {
            handleSocketDialog(data.payload);
        }
    });
}

async function handleSocketDialog(data) {
    console.log('%c Arcane Warding | Handling createDialog socket event', 'color: #00ff00', data);
    const actor = data.actorId ? game.actors.get(data.actorId) : null;
    const attacker = data.attackerId ? game.actors.get(data.attackerId) : null;
    const target = data.targetId ? game.actors.get(data.targetId) : null;
    const spell = data.spellName ? { name: data.spellName } : null;

    const result = await game.arcaneWarding.createDialog(spell, data.type, actor, attacker, target, true);
    
    game.socket.emit(SOCKET_NAME, {
        type: 'dialogResult',
        payload: {
            result: result,
            originalRequest: data
        }
    });
}

// export function registerSocketLib() {
//     socket = socketlib.registerModule('arcane-warding');
//     socket.register('createDialog', handleSocketDialog);
// }