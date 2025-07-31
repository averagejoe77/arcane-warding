function sendMessage(message, actor, mode = "publicroll", useBubble = false) {
	const speaker = ChatMessage.getSpeaker({ actor: actor });
	const chatData = {
		user: game.user.id,
		content: message,
		speaker: speaker,
		type: CONST.CHAT_MESSAGE_TYPES.OTHER,
		sound: CONFIG.defaultChatSound
	};
	ChatMessage.applyRollMode(chatData, mode);
	if(useBubble) {
		ChatMessage.create(chatData).then(msg => {
			game.messages.sayBubble(msg);
		});
	} else {
		ChatMessage.create(chatData);
	}
}


export { sendMessage };