import { slugifyName } from './effectReferences.mjs';
import { featureEnabled } from './features.mjs';
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

/** The key of a counter named `label` (underscores: it goes into effect formulas), unique among `existing`. */
export function counterKeyFor(label, existing = {}, ignore = null) {
  const base = (slugifyName(label) || 'counter').replace(/-/g, '_');
  let key = base;
  for (let n = 2; existing[key] && key !== ignore; n++) key = `${base}_${n}`;
  return key;
}

/**
 * Renaming a counter renames its key, so its reference follows the name
 * (@item.counters.kills.value → @item.counters.foes.value). Runs before the update: moves the counter
 * to its new key and remembers the renames for onCountersRenamed.
 */
/** A counter has run out at this value: down to 0 (it counts down from its reset value) or up to its maximum. */
function counterRanOut(counter, value) {
  if ((Number(counter.reset_value) || 0) > 0) return value <= 0;
  return counter.max !== null && counter.max !== undefined && value >= counter.max;
}

/** A counter with a cooldown: used (or run out) starts it; back at its reset value stops it. */
function startCooldowns(current, changed) {
  for (const [key, change] of Object.entries(changed)) {
    const counter = current[key];
    if (!counter || !(Number(counter.cooldown) > 0) || change?.value === undefined || 'cooldown_left' in (change ?? {})) continue;
    const value = Number(change.value) || 0;
    const before = Number(counter.value) || 0;
    if (value === (Number(counter.reset_value) || 0)) change.cooldown_left = 0;
    else if (counter.cooldown_from === 'empty' ? counterRanOut(counter, value) && !counterRanOut(counter, before) : value !== before) {
      change.cooldown_left = Number(counter.cooldown);
    }
  }
}

function onPreUpdateCounters(doc, changes, options) {
  const changed = foundry.utils.getProperty(changes, 'system.counters');
  const current = doc.system?.counters;
  if (!changed || !current || typeof changed !== 'object') return;
  startCooldowns(current, changed);
  const renames = {};
  const taken = { ...current };
  for (const [oldKey, change] of Object.entries(changed)) {
    if (!current[oldKey] || typeof change?.label !== 'string') continue;
    const label = change.label.trim();
    if (!label || label === current[oldKey].label) continue;
    const newKey = counterKeyFor(label, taken, oldKey);
    if (newKey === oldKey) continue;
    changed[newKey] = { ...current[oldKey], ...change, label };
    changed[oldKey] = new foundry.data.operators.ForcedDeletion();
    taken[newKey] = changed[newKey];
    delete taken[oldKey];
    renames[oldKey] = newKey;
  }
  if (Object.keys(renames).length) {
    options.sdmCounterRenames = renames;
    // The item's uses counter follows its new key
    const usesKey = foundry.utils.getProperty(changes, 'system.uses.counter') ?? doc.system?.uses?.counter;
    if (usesKey && renames[usesKey]) foundry.utils.setProperty(changes, 'system.uses.counter', renames[usesKey]);
  }
}

/**
 * After a rename, effects are left as they are: warn when some still use the old reference
 * (the item's own effects, or the actor's and its items'), so they can be updated by hand.
 */
function onCountersRenamed(doc, changes, options, userId) {
  const renames = options?.sdmCounterRenames;
  if (!renames || userId !== game.user.id) return;
  const scope = doc.documentName === 'Actor' ? 'actor' : 'item';
  const owners = scope === 'actor' ? [doc, ...doc.items] : [doc];
  for (const [oldKey, newKey] of Object.entries(renames)) {
    const pattern = new RegExp(`@${scope}\\.counters\\.${oldKey}(?![A-Za-z0-9_])`);
    const uses = owners.some(owner =>
      (owner.effects ?? []).some(effect => (effect.system?.changes ?? []).some(change => pattern.test(`${change.value ?? ''}`)))
    );
    if (uses) {
      ui.notifications.warn(
        $fmt('SDM.Counter.RenamedInEffects', { old: `@${scope}.counters.${oldKey}`, new: `@${scope}.counters.${newKey}` })
      );
    }
  }
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
  const key = counterKeyFor(label, item.system.counters ?? {});
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
  if (game.users.activeGM?.id !== game.user.id || !featureEnabled('counters')) return;
  const actors = new Set(combat.combatants.map(combatant => combatant.actor).filter(Boolean));
  for (const actor of actors) {
    // Cooldowns are timed in combat: the fight is over, they're done
    await tickCooldowns(actor, '', { finish: true });
    if (Object.keys(actor.system?.counters ?? {}).length) await resetCounters(actor, { combatOnly: true });
    for (const item of actor.items) {
      if (Object.keys(item.system?.counters ?? {}).length) await resetCounters(item, { combatOnly: true });
    }
  }
}

/** Counters cooling down on a round (or their owner's turn): one less; at 0 they're back to their reset value. */
async function tickCooldowns(actor, unit, { finish = false } = {}) {
  if (!actor) return;
  for (const doc of [actor, ...actor.items]) {
    const update = {};
    for (const [key, counter] of Object.entries(doc.system?.counters ?? {})) {
      const left = Number(counter.cooldown_left) || 0;
      if (!left || (!finish && counter.cooldown_unit !== unit)) continue;
      const next = finish ? 0 : left - 1;
      update[`system.counters.${key}.cooldown_left`] = next;
      if (!next) update[`system.counters.${key}.value`] = counter.reset_value ?? 0;
    }
    if (Object.keys(update).length) await doc.update(update);
  }
}

/** Reset the counters of an actor and its items that reset each round / turn. */
async function resetActorCounters(actor, each) {
  if (!actor) return;
  const has = doc => Object.values(doc.system?.counters ?? {}).some(counter => counter.reset_each === each);
  if (has(actor)) await resetCounters(actor, { each });
  for (const item of actor.items) if (has(item)) await resetCounters(item, { each });
}

/** Its owner rested: the counters that reset on rest (the actor's and its items'). */
export async function resetCountersOnRest(actor) {
  if (!featureEnabled('counters')) return;
  await resetActorCounters(actor, 'rest');
}

/** A new game day (the world date changed): the active Referee resets the "each day" counters. */
async function onWorldTimeChanged(worldTime, delta) {
  if (game.users.activeGM?.id !== game.user.id || !featureEnabled('counters') || !delta) return;
  const calendar = game.time?.calendar;
  const dayOf = time => {
    const c = calendar?.timeToComponents?.(time);
    if (c) return `${c.year}-${c.day}`;
    return Math.floor(time / 86400);
  };
  if (dayOf(worldTime) === dayOf(worldTime - delta)) return;
  for (const actor of game.actors) await resetActorCounters(actor, 'day');
}

/** New round: everyone's "each round" counters; new turn: the acting combatant's "each turn" counters. */
async function onCombatAdvanced(combat, changed) {
  if (game.users.activeGM?.id !== game.user.id || !featureEnabled('counters')) return;
  if (!('round' in changed) && !('turn' in changed)) return;
  if ('round' in changed) {
    const actors = new Set(combat.combatants.map(combatant => combatant.actor).filter(Boolean));
    for (const actor of actors) {
      await resetActorCounters(actor, 'round');
      await tickCooldowns(actor, 'round');
    }
  }
  await resetActorCounters(combat.combatant?.actor, 'turn');
  await tickCooldowns(combat.combatant?.actor, 'turn');
}

export function setupCounters() {
  Hooks.on('deleteCombat', onCombatEnded);
  Hooks.on('updateCombat', onCombatAdvanced);
  Hooks.on('updateWorldTime', onWorldTimeChanged);
  Hooks.on('preUpdateItem', onPreUpdateCounters);
  Hooks.on('preUpdateActor', onPreUpdateCounters);
  Hooks.on('updateItem', onCountersRenamed);
  Hooks.on('updateActor', onCountersRenamed);
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
  // Header chips: click +1 (right-click −1 is handled by the sheets' _onRender)
  stepActorCounter: {
    handler: async function (event, target) {
      event.preventDefault();
      event.stopPropagation();
      await stepCounter(this.actor, target.dataset.key, event.button === 2 ? -1 : 1);
    },
    buttons: [0]
  }
};
