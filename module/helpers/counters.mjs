import { slugifyName } from './effectReferences.mjs';
import { $fmt, $l10n } from './globalUtils.mjs';

/**
 * Counters of items and actors: anything they keep count of (kills in a battle, skulls on a garland, hits…).
 * Each counter has a name, a value (0 up to an optional maximum) and a reset value; it can reset
 * by hand or, when marked, at the end of every combat. Effects use them as
 * @item.counters.<key>.value / @actor.counters.<key>.value (e.g. `@item.skill.rank * @item.counters.kills.value`).
 * The functions take any document with system.counters (an item or an actor).
 */

const { DialogV2 } = foundry.applications.api;

export function getCounters(item) {
  return Object.entries(item?.system?.counters ?? {}).map(([key, counter]) => ({ key, ...counter }));
}

/** Ask for a name and add a counter (its key is the slug of the name). */
export async function promptNewCounter(item) {
  const label = await DialogV2.prompt({
    window: { title: $l10n('SDM.Counter.New'), icon: 'fa-solid fa-hashtag' },
    content: `<div class="form-group"><label>${$l10n('SDM.Counter.Name')}</label>
      <div class="form-fields"><input type="text" name="label" autofocus /></div></div>`,
    ok: { label: $l10n('SDM.Counter.Create'), callback: (event, button) => button.form.elements.label.value.trim() },
    rejectClose: false
  });
  if (!label) return;
  const existing = item.system.counters ?? {};
  // Underscores: the key goes into effect formulas (@item.counters.<key>.value)
  const base = (slugifyName(label) || 'counter').replace(/-/g, '_');
  let key = base;
  for (let n = 2; existing[key]; n++) key = `${base}_${n}`;
  await item.update({ [`system.counters.${key}`]: { label, value: 0, max: null, reset_value: 0, reset_on_combat_end: false } });
}

/** +step / -step, between 0 and the maximum (when there is one). */
export async function stepCounter(item, key, step) {
  const counter = item?.system?.counters?.[key];
  if (!counter) return;
  let value = Math.max((Number(counter.value) || 0) + step, 0);
  if (Number.isFinite(counter.max) && counter.max !== null) value = Math.min(value, counter.max);
  if (value !== counter.value) await item.update({ [`system.counters.${key}.value`]: value });
}

/** Back to their reset value: one counter, or all of them (only those reset by combat with `combatOnly`). */
export async function resetCounters(item, { key = null, combatOnly = false, each = null } = {}) {
  const update = {};
  for (const [counterKey, counter] of Object.entries(item?.system?.counters ?? {})) {
    if (key && counterKey !== key) continue;
    if (combatOnly && !counter.reset_on_combat_end) continue;
    if (each && counter.reset_each !== each) continue;
    if (counter.value !== counter.reset_value) update[`system.counters.${counterKey}.value`] = counter.reset_value ?? 0;
  }
  if (Object.keys(update).length) await item.update(update);
  return Object.keys(update).length;
}

export async function removeCounter(item, key) {
  const counter = item?.system?.counters?.[key];
  if (!counter) return;
  const proceed = await DialogV2.confirm({
    window: { title: $l10n('SDM.Counter.Remove') },
    content: `<p>${$fmt('SDM.DeleteDocConfirmation', { doc: foundry.utils.escapeHTML?.(counter.label) ?? counter.label })}</p>`,
    rejectClose: false
  });
  if (!proceed) return;
  await item.update({ [`system.counters.${key}`]: new foundry.data.operators.ForcedDeletion() });
}

/** At the end of a combat, the active Referee resets the counters marked for it on everyone who fought. */
async function onCombatEnded(combat) {
  if (game.users.activeGM?.id !== game.user.id) return;
  const actors = new Set(combat.combatants.map(combatant => combatant.actor).filter(Boolean));
  for (const actor of actors) {
    if (Object.keys(actor.system?.counters ?? {}).length) await resetCounters(actor, { combatOnly: true });
    for (const item of actor.items) {
      if (Object.keys(item.system?.counters ?? {}).length) await resetCounters(item, { combatOnly: true });
    }
  }
}

/** Reset the counters of an actor and its items that reset each round / turn. */
async function resetActorCounters(actor, each) {
  if (!actor) return;
  const has = doc => Object.values(doc.system?.counters ?? {}).some(counter => counter.reset_each === each);
  if (has(actor)) await resetCounters(actor, { each });
  for (const item of actor.items) if (has(item)) await resetCounters(item, { each });
}

/** New round: everyone's "each round" counters; new turn: the acting combatant's "each turn" counters. */
async function onCombatAdvanced(combat, changed) {
  if (game.users.activeGM?.id !== game.user.id) return;
  if (!('round' in changed) && !('turn' in changed)) return;
  if ('round' in changed) {
    const actors = new Set(combat.combatants.map(combatant => combatant.actor).filter(Boolean));
    for (const actor of actors) await resetActorCounters(actor, 'round');
  }
  await resetActorCounters(combat.combatant?.actor, 'turn');
}

export function setupCounters() {
  Hooks.on('deleteCombat', onCombatEnded);
  Hooks.on('updateCombat', onCombatAdvanced);
}

/** Sheet actions for an actor's own counters (Effects tab and header chips). */
export const ACTOR_COUNTER_ACTIONS = {
  addCounter: async function () {
    await promptNewCounter(this.actor);
  },
  stepCounter: async function (event, target) {
    await stepCounter(this.actor, target.dataset.key, parseInt(target.dataset.step, 10) || 0);
  },
  resetCounter: async function (event, target) {
    await resetCounters(this.actor, { key: target.dataset.key });
  },
  removeCounter: async function (event, target) {
    await removeCounter(this.actor, target.dataset.key);
  },
  // Header chips: click +1, right-click −1
  stepActorCounter: {
    handler: async function (event, target) {
      event.preventDefault();
      event.stopPropagation();
      await stepCounter(this.actor, target.dataset.key, event.button === 2 ? -1 : 1);
    },
    buttons: [0, 2]
  }
};
