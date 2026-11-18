/**
 * Saves against a condition ("target saves or is immobilized", "poisons the target (save)") or one of
 * an item's effects (a trigger's Effect action): instead of putting it on, the target saves first and
 * gets it only if the save fails.
 *  - an NPC rolls its save at once (in the Referee's game when the user doesn't own it);
 *  - a character gets a save request card with one button per ability (the suggested one
 *    highlighted: the book's static abilities resist, Endurance the body, Aura the mind); its owner or
 *    the Referee clicks one and the save is rolled.
 * The save card says whether the condition sticks; a failed save puts it on. A save equal to the
 * target succeeds only by losing something valuable: nothing is put on, and the Referee says on the
 * card whether the sacrifice was made (avoided) or not (put on). Hero dice that change the outcome
 * (up or down) put it on, take it off or ask for the sacrifice again (see HeroDiceUi).
 */
import { ActorType } from '../helpers/constants.mjs';
import { applyItemEffectToTargets, applyStatusToTargets } from './use-item.mjs';
import { cardHeader, cardTag, cardWrap } from '../rolls/ui/cardParts.mjs';

const CHANNEL = 'system.sdm';
const ROLL_ACTION = 'sdmSaveAgainstRoll';
const MIND = ['mad', 'fear', 'confused', 'sleep'];
const ABILITIES = ['str', 'end', 'agi', 'cha', 'aur', 'tho'];
// A save's difficulty moves its target (very easy −4, easy −2, hard +2, very hard +4; standard: the
// actor's save target) or sets it: a number ("14") is the exact target
export const SAVE_DIFFICULTY_SHIFT = { veryEasy: -4, easy: -2, hard: 2, veryHard: 4 };
export const SAVE_DIFFICULTIES = ['veryEasy', 'easy', '', 'hard', 'veryHard'];
const isExact = difficulty => /^\d+$/.test(`${difficulty ?? ''}`);

/** The difficulty to pass on: the key, or the exact target as text when "target" is picked. */
export function saveDifficultyValue(key, target) {
  return key === 'target' ? String(Math.max(Number(target) || 13, 1)) : key ?? '';
}

/** The save's target: the base moved by the difficulty, or the exact target. */
export function saveTargetFor(base, difficulty) {
  if (isExact(difficulty)) return Number(difficulty);
  return Number(base) + (SAVE_DIFFICULTY_SHIFT[difficulty] ?? 0);
}

/** "hard", "very easy", "target 14" (blank for standard). */
export function saveDifficultyLabel(difficulty) {
  if (!difficulty) return '';
  if (isExact(difficulty)) return game.i18n.format('SDM.SaveDifficulty.TargetChip', { target: difficulty });
  return game.i18n.localize(`SDM.SaveDifficulty.${difficulty}`).toLowerCase();
}
const difficultyName = key => game.i18n.localize(`SDM.SaveDifficulty.${key || 'standard'}`);

const esc = text => foundry.utils.escapeHTML(String(text ?? ''));
const statusName = id => game.i18n.localize(CONFIG.statusEffects.find(s => s.id === id)?.name ?? id);
// What the save is against: the item's effect (by its name), else the condition
const againstName = info => info?.effect?.name || statusName(info?.status);

/** The ability a character resists a condition with, by default: Aura for the mind, else Endurance. */
export function suggestedSaveAbility(statusId) {
  return statusId && MIND.includes(statusId) ? 'aur' : 'end';
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
 * Ask a target to save against a condition or an item's effect. info: { status, effect: { item, id,
 * name }, rounds, source, ability } (ability: the suggested one for characters; blank: by the
 * condition — an effect by the condition it carries, else Endurance).
 */
export async function saveAgainst(target, info) {
  if (!target || !(info?.status || info?.effect)) return;
  const data = { status: info.status ?? '', rounds: Number(info.rounds) || 0, source: info.source ?? '', difficulty: info.difficulty ?? '' };
  if (info.duration) data.duration = info.duration;
  if (info.effect) data.effect = info.effect;
  if (target.type !== ActorType.CHARACTER) {
    if (target.isOwner) return rollSave(target, ActorType.NPC, data);
    if (!game.users.activeGM) return ui.notifications.warn(game.i18n.localize('SDM.ErrorNoActiveGM'));
    return game.socket.emit(CHANNEL, { action: ROLL_ACTION, payload: { actorUuid: target.uuid, ability: ActorType.NPC, info: data } });
  }
  const suggested = info.ability || suggestedSaveAbility(info.status);
  const buttons = ABILITIES.map(
    key =>
      `<button type="button" data-action="sdmSaveAgainst" data-ability="${key}"${key === suggested ? ' class="suggested"' : ''}>${esc(
        game.i18n.localize(CONFIG.SDM.abilityAbbreviations?.[key] ?? CONFIG.SDM.abilities[key])
      )}${key === suggested ? ' ★' : ''}</button>`
  ).join('');
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: target }),
    content: cardWrap(
      cardHeader({ icon: 'fa-solid fa-shield-halved', title: game.i18n.localize('SDM.SaveAgainst.Title') }) +
        `<div class="sdm-save-request" data-actor="${esc(target.uuid)}" data-info="${esc(JSON.stringify(data))}">
      <p>${esc(
        game.i18n.format(data.source ? 'SDM.SaveAgainst.Request' : 'SDM.SaveAgainst.RequestNoSource', {
          actor: target.name,
          condition: againstName(data),
          source: data.source
        })
      )}</p>
      <div class="sdm-save-difficulty"><select data-action="sdmSaveDifficulty">${[...SAVE_DIFFICULTIES, 'target']
        .map(key => `<option value="${key}">${esc(key === 'target' ? game.i18n.localize('SDM.SaveDifficulty.target') : difficultyName(key))}</option>`)
        .join('')}</select><input type="number" min="1" step="1" class="sdm-save-target" /><span class="sdm-save-difficulty-shown"></span></div>
      <div class="sdm-save-request-buttons">${buttons}</div>
    </div>` +
        `<div class="sdm-card-foot"><span>${esc(game.i18n.localize('SDM.SaveAgainst.Who'))}</span></div>`,
      { kind: 'save-request' }
    )
  });
}

/** createChatMessage: a hero dice result re-renders the card it changed (its sacrifice buttons go). */
export function rerenderChangedSave(message) {
  const source = game.messages.get(message.getFlag('sdm', 'heroOf') ?? '');
  if (source?.content?.includes('sdm-save-sacrifice')) ui.chat?.updateMessage?.(source);
}

/** renderChatMessageHTML: the save request's ability buttons, for the character's owner and the Referee. */
export function bindSaveAgainst(message, html) {
  const box = html.querySelector('.sdm-save-request');
  if (!box) return;
  const actor = fromUuidSync(box.dataset.actor);
  const buttons = box.querySelectorAll('[data-action="sdmSaveAgainst"]');
  let info;
  try {
    info = JSON.parse(box.dataset.info);
  } catch {
    return;
  }
  // The difficulty: the Referee can change it on the card (easy / standard / hard); players see it
  const difficulty = message?.getFlag('sdm', 'saveDifficulty') ?? info.difficulty ?? '';
  info.difficulty = difficulty;
  const row = box.querySelector('.sdm-save-difficulty');
  const select = row?.querySelector('select');
  const number = row?.querySelector('.sdm-save-target');
  if (row && game.user.isGM) {
    // The Referee: a step, or "Target…" with the exact number
    select.value = isExact(difficulty) ? 'target' : difficulty;
    number.value = isExact(difficulty) ? difficulty : actor?.system?.save_target || 13;
    number.hidden = select.value !== 'target';
    row.querySelector('.sdm-save-difficulty-shown')?.remove();
    const save = () => message?.setFlag('sdm', 'saveDifficulty', saveDifficultyValue(select.value, number.value));
    select.addEventListener('change', save);
    number.addEventListener('change', save);
  } else if (row) {
    // Players: only the current difficulty, and only when it isn't standard
    if (!difficulty) row.remove();
    else {
      select.remove();
      number.remove();
      row.querySelector('.sdm-save-difficulty-shown').textContent = saveDifficultyLabel(difficulty);
    }
  }
  if (!actor?.isOwner) {
    buttons.forEach(button => (button.disabled = true));
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

/** The save's outcome against a condition: true (saved), false (failed) or 'equal' (sacrifice). */
export function saveOutcome(total, target) {
  const value = Number(total);
  if (!Number.isFinite(value) || !Number.isFinite(Number(target))) return null;
  return value > target ? true : value === Number(target) ? 'equal' : false;
}

/** The line on the save card: whether the condition sticks (or, equal, the Referee's sacrifice buttons). */
export function saveAgainstHtml(info, success, actor = null) {
  if (!(info?.status || info?.effect)) return '';
  if (success === 'equal') {
    const button = (choice, icon, key) =>
      `<button type="button" data-action="sdmSacrifice" data-choice="${choice}"><i class="fa-solid ${icon}"></i> ${esc(game.i18n.localize(key))}</button>`;
    return (
      `<div class="sdm-save-sacrifice" data-actor="${esc(actor?.uuid ?? '')}" data-info="${esc(JSON.stringify(info))}">` +
      cardTag(game.i18n.format('SDM.SaveAgainst.Sacrifice', { condition: againstName(info) }), { icon: 'fa-solid fa-scale-balanced' }) +
      `<div class="sdm-sacrifice-buttons">${button('made', 'fa-shield-halved', 'SDM.SaveAgainst.SacrificeMade')}${button('not', 'fa-triangle-exclamation', 'SDM.SaveAgainst.SacrificeNot')}</div>` +
      `</div>`
    );
  }
  const key = success ? 'SDM.SaveAgainst.Resisted' : 'SDM.SaveAgainst.Failed';
  return cardTag(game.i18n.format(key, { condition: againstName(info) }), {
    tone: success ? 'good' : 'bad',
    icon: `fa-solid fa-${success ? 'shield-halved' : 'triangle-exclamation'}`
  });
}

/** After the save: a failure puts the condition on (the roller owns the actor); equal waits for the Referee. */
export async function resolveSaveAgainst(actor, info, success) {
  if (success !== false) return;
  await putOn(actor, info, false);
}

/** Put the condition / effect on the actor, or take it off (the save card says so: no chat line). */
async function putOn(actor, info, remove) {
  if (info?.effect?.item) {
    const item = await fromUuid(info.effect.item);
    if (item) await applyItemEffectToTargets(item, info.effect.id, null, { targets: [actor], remove, silent: true });
    return;
  }
  if (info?.status) {
    await applyStatusToTargets(info.status, null, { targets: [actor], remove, rounds: Number(info.rounds) || 0, duration: info.duration ?? null, silent: true });
  }
}

/**
 * Hero dice changed a save's outcome (true, false or 'equal'): the condition / effect follows — on
 * when it now fails, off when it now passes or is equal (the new card asks the Referee about the
 * sacrifice). Taking off what isn't there and putting on what is already there do nothing.
 */
export async function recheckSaveAgainst(check, before, after) {
  const info = check?.saveAgainst;
  if (!(info?.status || info?.effect) || before === after || before === null || after === null) return;
  const actor = fromUuidSync(check.actor);
  if (!actor) return;
  await putOn(actor, info, after !== false);
}

/**
 * renderChatMessageHTML: a save equal to its target — the Referee says whether the sacrifice was made
 * (the condition is avoided) or not (it is put on); the card then shows the result to everyone.
 */
export function bindSacrifice(message, html) {
  const box = html.querySelector('.sdm-save-sacrifice');
  if (!box) return;
  let info;
  try {
    info = JSON.parse(box.dataset.info);
  } catch {
    return;
  }
  // Hero dice changed this result: no longer equal to the target, so no buttons (the new card decides)
  if (game.messages.some(other => other.getFlag('sdm', 'heroOf') === message.id)) {
    box.querySelector('.sdm-sacrifice-buttons')?.remove();
    return;
  }
  const choice = message.getFlag('sdm', 'sacrifice');
  if (choice) {
    const made = choice === 'made';
    const tag = document.createElement('div');
    tag.innerHTML = cardTag(
      game.i18n.format(made ? 'SDM.SaveAgainst.SacrificeAvoided' : 'SDM.SaveAgainst.Failed', { condition: againstName(info) }),
      { tone: made ? 'good' : 'bad', icon: `fa-solid fa-${made ? 'shield-halved' : 'triangle-exclamation'}` }
    );
    box.replaceWith(tag.firstElementChild);
    return;
  }
  const buttons = box.querySelector('.sdm-sacrifice-buttons');
  if (!game.user.isGM) {
    buttons?.remove();
    return;
  }
  box.querySelectorAll('[data-action="sdmSacrifice"]').forEach(button =>
    button.addEventListener('click', async event => {
      event.preventDefault();
      box.querySelectorAll('button').forEach(b => (b.disabled = true));
      const actor = fromUuidSync(box.dataset.actor);
      if (button.dataset.choice === 'not' && actor) await putOn(actor, info, false);
      await message.setFlag('sdm', 'sacrifice', button.dataset.choice);
    })
  );
}
