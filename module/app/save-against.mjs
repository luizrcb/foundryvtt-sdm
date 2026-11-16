/**
 * Saves against a condition ("target saves or is immobilized", "poisons the target (save)"): instead of
 * putting the condition on, the target saves first and gets it only if the save fails.
 *  - an NPC rolls its save at once (in the Referee's game when the user doesn't own it);
 *  - a character gets a save request card with one button per ability (the suggested one
 *    highlighted: the book's static abilities resist, Endurance the body, Aura the mind); its owner or
 *    the Referee clicks one and the save is rolled.
 * The save card says whether the condition sticks; a failed save puts it on. Hero dice that change
 * the outcome put it on or take it off (see HeroDiceUi).
 */
import { ActorType } from '../helpers/constants.mjs';
import { applyStatusToTargets } from './use-item.mjs';

const CHANNEL = 'system.sdm';
const ROLL_ACTION = 'sdmSaveAgainstRoll';
const MIND = ['mad', 'fear', 'confused', 'sleep'];
const ABILITIES = ['str', 'end', 'agi', 'cha', 'aur', 'tho'];

const esc = text => foundry.utils.escapeHTML(String(text ?? ''));
const statusName = id => game.i18n.localize(CONFIG.statusEffects.find(s => s.id === id)?.name ?? id);

/** The ability a character resists a condition with, by default: Aura for the mind, else Endurance. */
export function suggestedSaveAbility(statusId) {
  return MIND.includes(statusId) ? 'aur' : 'end';
}

export function setupSaveAgainst() {
  game.socket.on(CHANNEL, message => {
    if (message?.action !== ROLL_ACTION || game.users.activeGM?.id !== game.user.id) return;
    const { actorUuid, ability, info } = message.payload ?? {};
    const actor = fromUuidSync(actorUuid);
    if (actor) rollSave(actor, ability, info);
  });
}

/** Roll the actor's save against the condition (no dialog: the button is the roll). */
function rollSave(actor, ability, info) {
  return actor.performHudAction('save', ability, { saveAgainst: JSON.stringify(info) }, true);
}

/**
 * Ask a target to save against a condition. info: { status, rounds, source, ability } (ability: the
 * suggested one for characters; blank: by the condition).
 */
export async function saveAgainst(target, info) {
  if (!target || !info?.status) return;
  const data = { status: info.status, rounds: Number(info.rounds) || 0, source: info.source ?? '' };
  if (target.type !== ActorType.CHARACTER) {
    if (target.isOwner) return rollSave(target, ActorType.NPC, data);
    if (!game.users.activeGM) return ui.notifications.warn(game.i18n.localize('SDM.ErrorNoActiveGM'));
    return game.socket.emit(CHANNEL, { action: ROLL_ACTION, payload: { actorUuid: target.uuid, ability: ActorType.NPC, info: data } });
  }
  const suggested = info.ability || suggestedSaveAbility(info.status);
  const buttons = ABILITIES.map(
    key =>
      `<button type="button" data-action="sdmSaveAgainst" data-ability="${key}"${key === suggested ? ' class="suggested"' : ''}>${esc(
        game.i18n.localize(CONFIG.SDM.abilities[key])
      )}</button>`
  ).join('');
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: target }),
    content: `<div class="sdm-save-request" data-actor="${esc(target.uuid)}" data-info="${esc(JSON.stringify(data))}">
      <p><i class="fa-solid fa-shield-halved"></i> ${esc(
        game.i18n.format(data.source ? 'SDM.SaveAgainst.Request' : 'SDM.SaveAgainst.RequestNoSource', {
          actor: target.name,
          condition: statusName(data.status),
          source: data.source
        })
      )}</p>
      <div class="sdm-save-request-buttons">${buttons}</div>
    </div>`
  });
}

/** renderChatMessageHTML: the save request's ability buttons, for the character's owner and the Referee. */
export function bindSaveAgainst(html) {
  const box = html.querySelector('.sdm-save-request');
  if (!box) return;
  const actor = fromUuidSync(box.dataset.actor);
  const buttons = box.querySelectorAll('[data-action="sdmSaveAgainst"]');
  if (!actor?.isOwner) {
    buttons.forEach(button => (button.disabled = true));
    return;
  }
  let info;
  try {
    info = JSON.parse(box.dataset.info);
  } catch {
    return;
  }
  buttons.forEach(button =>
    button.addEventListener('click', async event => {
      event.preventDefault();
      buttons.forEach(b => (b.disabled = true));
      await rollSave(actor, button.dataset.ability, info);
    })
  );
}

/** The line on the save card: whether the condition sticks. */
export function saveAgainstHtml(info, success) {
  if (!info?.status) return '';
  const key = success ? 'SDM.SaveAgainst.Resisted' : 'SDM.SaveAgainst.Failed';
  return `<p class="sdm-save-against ${success ? 'resisted' : 'failed'}"><i class="fa-solid fa-${success ? 'shield-halved' : 'triangle-exclamation'}"></i> ${esc(
    game.i18n.format(key, { condition: statusName(info.status) })
  )}</p>`;
}

/** After the save: a failure puts the condition on (the roller owns the actor). */
export async function resolveSaveAgainst(actor, info, success) {
  if (!info?.status || success) return;
  await applyStatusToTargets(info.status, null, { targets: [actor], rounds: Number(info.rounds) || 0 });
}

/** Hero dice changed a save's outcome: the condition follows (on when it now fails, off when it now passes). */
export async function recheckSaveAgainst(check, before, after) {
  const info = check?.saveAgainst;
  if (!info?.status || before === after || before === null || after === null) return;
  const actor = fromUuidSync(check.actor);
  if (!actor) return;
  await applyStatusToTargets(info.status, null, { targets: [actor], remove: after, rounds: Number(info.rounds) || 0 });
}
