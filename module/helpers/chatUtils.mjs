import { detectNat1OrNat20 } from '../rolls/sdmRoll.mjs';
import { $l10n } from './globalUtils.mjs';
const { DialogV2 } = foundry.applications.api;

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
    const luckySevenRule = game.settings.get('sdm', 'luckySevenRule') || false;
    const rollArray = rolls?.filter(r => r instanceof Roll) ?? [];

    // Detect nat1 or nat20 across all provided rolls
    if (checkCritical) {
      for (const roll of rollArray) {
        const { isNat1, isNat20, is13, is7 } = detectNat1OrNat20(roll);

        if (!content) content = await roll.render();

        if (isNat20) {
          content = content.replace('dice-total', 'dice-total critical');
          content += `<div class='flex-group-center mt-10'><span class='critical'>${$l10n('SDM.CriticalSuccess').toUpperCase()}</span></div>`;
        } else if (isNat1) {
          content = content.replace('dice-total', 'dice-total fumble');
          content += `<div class='flex-group-center mt-10'><span class='fumble'>${$l10n('SDM.CriticalFailure').toUpperCase()}</span></div>`;
        } else if (is13) {
          content = content.replace(
            '<li class="roll die d20">13</li>',
            '<li class="roll die d20 is13">13</li>'
          );
          content = content.replace('dice-total', 'dice-total force');
          content += `<div class='flex-group-center mt-10'><span  class='force'>${$l10n('SDM.DepletedResources').toUpperCase()}</span></div>`;
        } else if (luckySevenRule && is7) {
          content = content.replace(
            '<li class="roll die d20">7</li>',
            '<li class="roll die d20 is7">7</li>'
          );
          content = content.replace('dice-total', 'dice-total lucky');
          content += `<div class='flex-group-center mt-10'><span  class='lucky'>${$l10n('SDM.LuckySeven').toUpperCase()}</span></div>`;
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

export function configureChatListeners(html) {
  html.addEventListener('click', event => {
    if (event.target.closest('.collapsible')) _onChatCardToggleContent(event);
  });
}

/**
 * Handle toggling the visibility of chat card content when the name is clicked
 * @param {Event} event   The originating click event
 * @private
 */
function _onChatCardToggleContent(event) {
  const header = event.target.closest('.collapsible');
  if (!event.target.closest('.collapsible-content.card-content')) {
    event.preventDefault();
    header.classList.toggle('collapsed');
  }
}

const wtfStudioLinks = `<div class="intro-message">
      <div class="system-title">Synthetic Dream Machine</div>
        <div class="system-author">
          by Luka Rejec
        </div>
        <div class="outcome">
            <div class="outcome-title">
              <span data-tooltip="WizardThiefFighter Studio">WTF Studio</span>
            </div>
            <div class="flex">
              <div>
                <div class="outcome-description">
                  <a href="https://patreon.com/wizardthieffighter">Patreon</a>
                </div>
                <div class="outcome-description">
                  <a href="https://www.drivethrurpg.com/en/publisher/14157/wtf-studio">DriveThruRPG</a>
                </div>
              </div>
              <div>
                <div class="outcome-description">
                  <a href="https://wizardthieffighter.com">Shopify</a>
                </div>
                <div class="outcome-description">
                  <a href=" https://wizardthieffighter.itch.io/">Itch.io</a>
                </div>
              </div>
            </div>
        </div>
        <div class="outcome">
            <div class="outcome-title">
              <span>Buy the Books</span>
            </div>
            <div class="outcome-description">
                <a href="https://www.backerkit.com/c/projects/exalted-funeral/our-golden-age-an-ultra-violet-grasslands-rpg-sequel">Our Golden Age (pre-order)</a>
            </div>
            <div class="outcome-description">
                <a href="https://www.exaltedfuneral.com/products/vastlands-guidebook-bootleg-beta-early-release-free-pdf">Vastlands Guidebook</a>
            </div>
            <div class="outcome-description">
                <a href="https://www.drivethrurpg.com/en/product/447868/uvg-2e-ultraviolet-grasslands-and-the-black-city">UVG 2E (digital)</a>
            </div>
            <div class="outcome-description">
                <a href="https://www.exaltedfuneral.com/products/uvg-2e">UVG 2E (physical)</a>
            </div>
        </div>
    </div>`;

export async function WTFStudioDialog() {
  await DialogV2.prompt({
    position: {
      width: 310,
      height: 550
    },
    content: wtfStudioLinks,
    modal: true,
    rejectClose: false
  });
}

export function sendInitialMessage() {
  if (!game.user.isGM) return;

  const initialMessageSent = game.settings.get('sdm', 'initialMessageSent');
  if (initialMessageSent) return;
  setTimeout(() => {
    createChatMessage({
      speaker: ChatMessage.getSpeaker({ alias: 'Gamemaster' }),
      content: wtfStudioLinks
    });
  }, 1000);

  game.settings.set('sdm', 'initialMessageSent', true);
}
