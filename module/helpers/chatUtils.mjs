/**
 * Resolves an Actor associated with a chat message using multiple fallback strategies.
 *
 * @param {ChatMessage} message - Foundry VTT ChatMessage object to analyze
 * @param {User} [user] - Optional User object for final fallback
 * @returns {Actor|null} Associated Actor instance or null if unresolved
 *
 */
export function getActorFromMessage(message, user) {
  // 1. Direct actor reference
  if (message.actor) return message.actor;

  const speaker = message.speaker || {};

  // 2. Speaker's actor reference
  if (speaker.actor) {
    return game.actors.get(speaker.actor) || null;
  }

  // 3. Token-based actor reference (with canvas safety check)
  if (speaker.token && canvas?.ready) {
    // Use v13's tokenDocument for better compatibility
    const token = canvas.tokens.get(speaker.token)?.document;
    return token?.actor || null;
  }

  // 4. Actor name matching (case-insensitive)
  if (speaker.alias) {
    const cleanName = speaker.alias.trim().toLowerCase();
    return game.actors.find(a => a.name.trim().toLowerCase() === cleanName) || null;
  }

  // 5. User's assigned character
  if (user?.character) {
    return user.character;
  }

  console.warn("getActorFromMessage: Could not determine actor for message", message);
  return null;
}

/**
 * Creates a chat message with configurable roll visibility and metadata.
 *
 * @param {Object} options - Configuration options
 * @param {Actor} [options.actor] - Actor associated with the message
 * @param {string} [options.user=game.user.id] - User ID sending the message
 * @param {Object} [options.speaker] - Speaker data (auto-generated from actor)
 * @param {string} [options.rollMode=game.settings.get('core','rollMode')] - Roll visibility mode
 * @param {string} [options.flavor] - Flavor text for message header
 * @param {string} [options.content] - HTML content of the message
 * @param {Roll[]} [options.rolls] - Dice roll objects to embed
 * @param {Object} [options.flags] - Custom flags for module data
 * @returns {Promise<ChatMessage|null>} Created chat message entity or null on failure
 *
 */
export async function createChatMessage({
  actor,
  user = game.user.id,
  speaker,
  rollMode = game.settings.get('core', 'rollMode'),
  flavor,
  content,
  rolls,
  flags
}) {
  try {
    const finalSpeaker = speaker || ChatMessage.getSpeaker({ actor });

    const chatData = {
      user,
      speaker: finalSpeaker,
      flavor,
      content,
      rolls: rolls?.filter(r => r instanceof Roll),
      flags,
    };

    // Handle roll visibility modes
    switch (rollMode) {
      case 'selfroll':
        chatData.whisper = [game.user.id];
        break;
      case 'blindroll':
        chatData.blind = true;
        break;
      case 'gmroll':
      case 'blindroll':
        chatData.whisper = ChatMessage.getWhisperRecipients('GM');
        break;
    }

    return ChatMessage.create(chatData);
  } catch (e) {
    console.error("createChatMessage: Failed to create message", e);
    return null;
  }
}
