/**
 * The Referee's next-roll modifier (a ruling made on the spot: "bonus on your next action", "a penalty
 * to break loose"): from the Token HUD, a modifier for the token's own next d20 roll (attack or
 * ability check) or for the next attack against it — advantage / disadvantage or ±1, ±3, ±6, ±1d6.
 * It is a status on the actor (its icon shows on the token, the effects panel and the combat
 * tracker), preselected in that roll's dialog (Shift rolls too) and removed once the roll is made.
 */
import { RollMode } from '../helpers/constants.mjs';
import { deleteEffectsOf } from './use-item.mjs';
import { deleteEffects } from '../helpers/deleteEffects.mjs';

export const NEXT_ROLL_STATUSES = { self: 'nextRoll', against: 'nextRollAgainst' };
const VALUES = ['+1', '+3', '+6', '+1d6', '-1', '-3', '-6', '-1d6'];

const esc = text => foundry.utils.escapeHTML(String(text ?? ''));
const shown = value => `${value}`.replace('-', '−');

/** "Advantage" / "+3" */
function valueLabel({ mode, modifier }) {
  if (mode === RollMode.ADVANTAGE) return game.i18n.localize('SDM.BonusPenalty.Advantage');
  if (mode === RollMode.DISADVANTAGE) return game.i18n.localize('SDM.BonusPenalty.Disadvantage');
  return shown(modifier);
}

/** The next-roll effects of an actor (who: self | against). */
function nextRollEffects(actor, who) {
  return (actor?.effects ?? []).filter(effect => effect.getFlag('sdm', 'nextRoll')?.who === who);
}

/**
 * For a roll: the mode and modifier the Referee set (the roller's own, and the target's "against" for
 * an attack), the notes for the dialog, and what to remove once rolled.
 */
export function nextRollAdvice(actor, { target = null, isAttack = false, isAbility = false } = {}) {
  const advice = { mode: null, modifier: '', notes: [], used: [] };
  if (!(isAttack || isAbility) || !actor) return advice;
  const found = [...nextRollEffects(actor, 'self').map(effect => [actor, effect])];
  if (isAttack && target && target !== actor) found.push(...nextRollEffects(target, 'against').map(effect => [target, effect]));
  let advantage = false;
  let disadvantage = false;
  const modifiers = [];
  for (const [owner, effect] of found) {
    const data = effect.getFlag('sdm', 'nextRoll') ?? {};
    if (data.mode === RollMode.ADVANTAGE) advantage = true;
    else if (data.mode === RollMode.DISADVANTAGE) disadvantage = true;
    else if (data.modifier) modifiers.push(data.modifier);
    advice.notes.push(effect.name);
    advice.used.push([owner, effect.id]);
  }
  advice.mode = advantage && !disadvantage ? RollMode.ADVANTAGE : disadvantage && !advantage ? RollMode.DISADVANTAGE : null;
  advice.modifier = modifiers.join('');
  return advice;
}

/** After the roll: the modifiers it used are gone. */
export async function consumeNextRoll(advice) {
  const byActor = new Map();
  for (const [actor, id] of advice?.used ?? []) {
    if (!byActor.has(actor)) byActor.set(actor, []);
    byActor.get(actor).push(id);
  }
  for (const [actor, ids] of byActor) await deleteEffectsOf(actor, ids);
}

/** Put a next-roll modifier on the actor (replacing the one it had for the same kind of roll). */
async function setNextRoll(actor, who, { mode = '', modifier = '' }) {
  const old = nextRollEffects(actor, who).map(effect => effect.id);
  if (old.length) await deleteEffects(actor, old);
  if (!mode && !modifier) return;
  const bonus = mode === RollMode.ADVANTAGE || (!mode && !`${modifier}`.startsWith('-'));
  const status = CONFIG.statusEffects.find(s => s.id === NEXT_ROLL_STATUSES[who]);
  await actor.createEmbeddedDocuments('ActiveEffect', [
    {
      name: game.i18n.format(who === 'self' ? 'SDM.NextRoll.SelfName' : 'SDM.NextRoll.AgainstName', { value: valueLabel({ mode, modifier }) }),
      img: bonus ? 'icons/svg/upgrade.svg' : 'icons/svg/downgrade.svg',
      statuses: [NEXT_ROLL_STATUSES[who]],
      description: status?.description ?? '',
      flags: { sdm: { nextRoll: { who, mode, modifier } } }
    }
  ]);
}

/** The Referee's dialog: whose roll (two toggles), the value (a click sets it), what is set now. */
async function openNextRollDialog(actor) {
  const l = key => game.i18n.localize(key);
  const valueButton = value =>
    `<button type="button" data-value="${value}" class="${value.startsWith('-') ? 'penalty' : 'bonus'}">${esc(shown(value))}</button>`;
  const modeButton = (mode, key, penalty) =>
    `<button type="button" data-mode="${mode}" class="${penalty ? 'penalty' : 'bonus'}">${esc(l(key))}</button>`;
  // What is set now: each with a remove button
  const current = ['self', 'against']
    .flatMap(who => nextRollEffects(actor, who))
    .map(effect => `<li><span>${esc(effect.name)}</span><a data-remove="${effect.id}" data-tooltip="${esc(l('SDM.NextRoll.Remove'))}"><i class="fa-solid fa-xmark"></i></a></li>`)
    .join('');
  const content = `<div class="sdm-next-roll">
    <p class="hint">${esc(game.i18n.format('SDM.NextRoll.Prompt', { name: actor.name }))}</p>
    <div class="sdm-next-roll-who">
      <button type="button" data-who="self" class="active"><i class="fa-solid fa-user"></i> ${esc(l('SDM.NextRoll.Self'))}</button>
      <button type="button" data-who="against"><i class="fa-solid fa-crosshairs"></i> ${esc(l('SDM.NextRoll.Against'))}</button>
    </div>
    <div class="sdm-next-roll-values">
      <span class="sdm-next-roll-label bonus">${esc(l('SDM.NextRoll.Bonus'))}</span>
      <div class="sdm-next-roll-line">${VALUES.slice(0, 4).map(valueButton).join('')}${modeButton(RollMode.ADVANTAGE, 'SDM.BonusPenalty.Advantage')}</div>
      <span class="sdm-next-roll-label penalty">${esc(l('SDM.NextRoll.Penalty'))}</span>
      <div class="sdm-next-roll-line">${VALUES.slice(4).map(valueButton).join('')}${modeButton(RollMode.DISADVANTAGE, 'SDM.BonusPenalty.Disadvantage', true)}</div>
    </div>
    ${current ? `<ul class="sdm-next-roll-current">${current}</ul>` : ''}
  </div>`;
  await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('SDM.NextRoll.Title'), icon: 'fa-solid fa-dice-d20' },
    position: { width: 400 },
    content,
    classes: ['sdm-next-roll-dialog'],
    rejectClose: false,
    buttons: [{ action: 'close', label: 'Close', default: true }],
    render: (event, dialog) => {
      const root = dialog.element ?? event?.target?.element;
      let who = 'self';
      root?.querySelectorAll('[data-who]').forEach(button =>
        button.addEventListener('click', ev => {
          ev.preventDefault();
          who = button.dataset.who;
          root.querySelectorAll('[data-who]').forEach(b => b.classList.toggle('active', b === button));
        })
      );
      root?.querySelectorAll('.sdm-next-roll [data-value], .sdm-next-roll [data-mode]').forEach(button =>
        button.addEventListener('click', async ev => {
          ev.preventDefault();
          await setNextRoll(actor, who, { mode: button.dataset.mode ?? '', modifier: button.dataset.value ?? '' });
          dialog.close();
        })
      );
      root?.querySelectorAll('[data-remove]').forEach(link =>
        link.addEventListener('click', async ev => {
          ev.preventDefault();
          await deleteEffects(actor, [link.dataset.remove]);
          link.closest('li')?.remove();
        })
      );
    }
  });
}

/** Token HUD (the Referee): the next-roll button. */
function onRenderTokenHUDNextRoll(hud, html) {
  if (!game.user.isGM) return;
  const actor = hud?.object?.actor;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!actor || !root || root.querySelector('.sdm-next-roll-toggle')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('control-icon', 'sdm-next-roll-toggle');
  if (nextRollEffects(actor, 'self').length || nextRollEffects(actor, 'against').length) button.classList.add('active');
  const label = game.i18n.localize('SDM.NextRoll.Title');
  button.dataset.tooltip = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = '<i class="fa-solid fa-dice-d20" inert></i>';
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openNextRollDialog(actor);
  });
  (root.querySelector('.col.right') ?? root).append(button);
}

export function setupNextRoll() {
  Hooks.on('renderTokenHUD', onRenderTokenHUDNextRoll);
}
