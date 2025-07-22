import { detectNat1OrNat20 } from '../rolls/sdmRoll.mjs';
import { $l10n } from './globalUtils.mjs';

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

  console.warn('getActorFromMessage: Could not determine actor for message', message);
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
  flags,
  checkCritical = false
}) {
  try {
    const finalSpeaker = speaker || ChatMessage.getSpeaker({ actor });

    const rollArray = rolls?.filter(r => r instanceof Roll) ?? [];

    // Detect nat1 or nat20 across all provided rolls
    if (checkCritical) {
      for (const roll of rollArray) {
        const { isNat1, isNat20, is13 } = detectNat1OrNat20(roll);

        if (!content) content = await roll.render();

        if (isNat20) {
          content = content.replace('dice-total', 'dice-total critical');
          content += `<div class='flex-group-center mt-10'><span class='critical'>${$l10n('SDM.CriticalSuccess').toUpperCase()}</span></div>`;
        } else if (isNat1) {
          content = content.replace('dice-total', 'dice-total fumble');
          content += `<div class='flex-group-center mt-10'><span class='fumble'>${$l10n('SDM.CriticalFailure').toUpperCase()}</span></div>`;
        } else if (is13) {
          content = content.replace('<li class="roll die d20">13</li>', '<li class="roll die d20 is13">13</li>')
          content = content.replace('dice-total', 'dice-total force');
          content += `<div class='flex-group-center mt-10'><span  class='force'>${$l10n('SDM.DepletedResources').toUpperCase()}</span></div>`;
        }
      }
    }

    let chatData = {
      user,
      speaker: finalSpeaker,
      flavor,
      content,
      rolls: rollArray,
      flags
    };

    chatData = ChatMessage.applyRollMode(chatData, rollMode);

    return ChatMessage.create(chatData);
  } catch (e) {
    console.error('createChatMessage: Failed to create message', e);
    return null;
  }
}
