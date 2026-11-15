import { applyItemEffectToTargets, isUsable, useItem } from '../app/use-item.mjs';
import { GearType, ItemStatusType, ItemType } from '../helpers/constants.mjs';
import { resetCounters, stepCounter } from '../helpers/counters.mjs';
import { getItemIdentifier } from '../helpers/effectReferences.mjs';
import { getUsesCounter, refillUsesUpdate, setUsesLeftUpdate, usesLeft } from '../helpers/itemUses.mjs';
import { featureEnabled } from '../helpers/features.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import { hasPowerAlbum } from '../helpers/itemUtils.mjs';
import { isLightSource, isLit, lightItem, putOutLight, toggleLight } from '../helpers/lights.mjs';

/**
 * Roll triggers of gear, highlighted on chat cards:
 *  - attack: natural N on the d20 (attacks are not tied to a weapon, so the readied items of the
 *    attacker are checked),
 *  - damage (that item's damage roll): total N, any die showing N, all dice at their maximum,
 *    all dice at 1, or two dice matching.
 */

const esc = text => foundry.utils.escapeHTML?.(String(text ?? '')) ?? String(text ?? '');

function activeResults(roll) {
  return (roll?.dice ?? []).flatMap(die => die.results.filter(r => r.active !== false).map(r => ({ value: r.result, faces: die.faces })));
}

function naturalD20(roll) {
  const d20 = (roll?.dice ?? []).find(die => die.faces === 20);
  return d20?.results.find(r => r.active !== false)?.result ?? null;
}

function matches(trigger, roll, { usageTarget = null, success = null } = {}) {
  const results = activeResults(roll);
  const natural = naturalD20(roll);
  const total = Number(roll.total);
  switch (trigger.condition) {
    case 'natural':
      return natural === trigger.value;
    case 'naturalAtLeast':
      return natural !== null && natural >= trigger.value;
    case 'naturalAtMost':
      return natural !== null && natural <= trigger.value;
    case 'total':
      return total === trigger.value;
    case 'totalAtLeast':
      return total >= trigger.value;
    case 'totalAtMost':
      return total <= trigger.value;
    // Saves, defeat, attacks against a target: the roll's outcome (null when it has none)
    case 'success':
      return success === true;
    case 'failure':
      return success === false;
    // Usage rolls: a natural 13 is always running low; at or under the replenish score runs out
    case 'runningLow':
      return usageTarget !== null && total === 13;
    case 'runOut':
      return usageTarget !== null && total !== 13 && total <= usageTarget;
    case 'die':
      return results.some(r => r.value === trigger.value);
    case 'max':
      return results.length > 0 && results.every(r => r.value === r.faces);
    case 'min':
      return results.length > 0 && results.every(r => r.value === 1);
    case 'matching': {
      const values = results.map(r => r.value);
      return values.length > 1 && new Set(values).size < values.length;
    }
    default:
      return false;
  }
}

/** Items whose triggers watch the actor's own rolls: readied gear, and all traits and burdens. */
function watchingItems(actor) {
  return (actor?.items ?? []).filter(item =>
    item.type === ItemType.GEAR ? !!item.system.readied : [ItemType.TRAIT, ItemType.BURDEN].includes(item.type)
  );
}

/**
 * Triggers of a roll not tied to an item (attack, save, ability check, defeat): the actor's readied
 * gear, traits and burdens. Filters: the kind of attack, the ability ('' = any).
 */
export function actorTriggers(actor, rollKind, roll, { attack = '', ability = '', success = null } = {}) {
  const fired = [];
  if (!featureEnabled('triggers')) return fired;
  for (const item of watchingItems(actor)) {
    for (const trigger of item.system.triggers ?? []) {
      if (trigger.roll !== rollKind) continue;
      if (rollKind === 'attack' && trigger.attack && attack && trigger.attack !== attack) continue;
      if (['save', 'ability'].includes(rollKind) && trigger.ability && ability && trigger.ability !== ability) continue;
      if (matches(trigger, roll, { success })) fired.push({ item, trigger });
    }
  }
  return fired;
}

/** Triggers of an attack, for that kind of attack (melee, ranged, fantascience, oldtech). */
export function attackTriggers(actor, roll, attack = '', success = null) {
  return actorTriggers(actor, 'attack', roll, { attack, success });
}

/** Does this trigger (held by `holder`) watch the rolls of `item`? ("From": this item, any item, one item) */
function watchesItem(trigger, holder, item) {
  const from = trigger.from || '';
  if (from === 'any') return true;
  if (from === 'item') return !!trigger.from_item && trigger.from_item === getItemIdentifier(item);
  return holder.id === item.id;
}

/**
 * Triggers of one item's roll: damage, power (an album's power: `power` is its name) or usage
 * (`usageTarget` is the replenish score). The item's own triggers, and those of the actor's readied
 * gear, traits and burdens that watch this item (or any item).
 */
export function itemRollTriggers(item, rollKind, roll, { power = '', ...options } = {}) {
  if (!featureEnabled('triggers') || !item) return [];
  const name = `${power ?? ''}`.trim().toLowerCase();
  const holders = [item, ...watchingItems(item.actor).filter(other => other.id !== item.id)];
  const fired = [];
  for (const holder of holders) {
    for (const trigger of holder.system?.triggers ?? []) {
      if (trigger.roll !== rollKind || !watchesItem(trigger, holder, item)) continue;
      if (rollKind === 'power' && trigger.power && name && trigger.power.trim().toLowerCase() !== name) continue;
      if (matches(trigger, roll, options)) fired.push({ item: holder, trigger });
    }
  }
  return fired;
}

/** Triggers of an item's damage roll. */
export function damageTriggers(item, roll) {
  return itemRollTriggers(item, 'damage', roll);
}

/**
 * What fired triggers do besides their text (each optional): draw a roll table, put one of the
 * item's effects on the targets (temporary, like Use), wear the item, step one of its counters.
 */
let chainDepth = 0;
const MAX_CHAIN = 3;

export async function runTriggerActions(fired, { actor } = {}) {
  // Actions can roll again (a power, a usage roll…): stop long chains and loops
  if (chainDepth >= MAX_CHAIN) return;
  chainDepth++;
  try {
    await runActions(fired, { actor });
  } finally {
    chainDepth--;
  }
}

async function runActions(fired, { actor } = {}) {
  for (const { item, trigger, delta = 0 } of fired) {
    // Counter / charge triggers can scale their add and spend amounts by the size of the change
    const times = trigger.by_change && delta ? Math.abs(delta) : 1;
    try {
      if (trigger.table) {
        const table = await fromUuid(trigger.table);
        if (table?.documentName === 'RollTable') await table.draw();
      }
      if (trigger.effect) {
        await applyItemEffectToTargets(item, trigger.effect, actor ?? item.actor, {
          self: trigger.effect_target === 'self'
        });
      }
      if (trigger.wear) await wearItem(item, trigger.wear);
      const roller = actor ?? item.actor;
      // The counter of this item, or of its owner
      const counterDoc = trigger.counter_scope === 'actor' ? item.actor ?? roller : item;
      if (trigger.counter && counterDoc?.system?.counters?.[trigger.counter]) {
        const mode = trigger.counter_mode || 'add';
        if (mode === 'reset') await resetCounters(counterDoc, { key: trigger.counter });
        else if (mode === 'set') await setCounter(counterDoc, trigger.counter, Number(trigger.counter_step) || 0);
        else await stepCounter(counterDoc, trigger.counter, (Number(trigger.counter_step) || 1) * times);
      }
      if (trigger.light && featureEnabled('lights')) await lightAction(item, roller, trigger);
      if (trigger.charges_mode) await chargesAction(item, roller, trigger, times);
      if (trigger.use) await useAction(item, roller, trigger);
      if (trigger.cast) await castAction(item, roller, trigger);
    } catch (error) {
      console.error('SDM | Trigger action failed', error);
    }
  }
}

/** An item picked in a trigger: '@self' (the item holding the trigger) or an identifier on the actor. */
export function resolveTriggerItem(holder, actor, value, accept = () => true) {
  if (!value) return null;
  if (value === '@self') return accept(holder) ? holder : null;
  const candidates = (actor?.items ?? []).filter(item => getItemIdentifier(item) === value && accept(item));
  // Readied ones first (several items can share a name)
  return candidates.find(item => item.system?.readied) ?? candidates[0] ?? null;
}

function missingItem(holder, value) {
  ui.notifications.warn($fmt('SDM.Trigger.MissingItem', { item: holder.name, target: value === '@self' ? holder.name : value }));
}

export function isCastable(item) {
  return !!item && (item.system?.type === GearType.POWER || hasPowerAlbum(item));
}

/** Light, put out or toggle an item's light (the light rules apply: readied, charges, usage roll). */
async function lightAction(holder, actor, trigger) {
  const target = resolveTriggerItem(holder, actor, trigger.light_item || '@self', isLightSource);
  if (!target) return missingItem(holder, trigger.light_item || '@self');
  if (trigger.light === 'put_out') return putOutLight(target.actor, { itemId: target.id });
  if (trigger.light === 'light') return isLit(target) ? null : lightItem(target);
  return toggleLight(target);
}

/** Items whose charges a trigger can change: charges, or uses kept in a counter. */
export function hasCharges(item) {
  return !!item?.system?.features?.has?.('charges') || !!getUsesCounter(item);
}

/**
 * Spend, add or set charges (or the uses of the item's uses counter), never below 0 or above the
 * maximum. Like spending elsewhere: one left of several is running low, none is run out, and getting
 * charges back clears the mark (items with replenish keep the marks of their usage rolls).
 */
async function chargesAction(holder, actor, trigger, times = 1) {
  const target = resolveTriggerItem(holder, actor, trigger.charges_item || '@self', hasCharges);
  if (!target) return missingItem(holder, trigger.charges_item || '@self');
  // "Set" uses the number as it is; spend / add follow the size of the change when asked
  const base = Math.max(Number(trigger.charges_amount) || 0, 0);
  const amount = trigger.charges_mode === 'set' ? base : base * times;
  const next = current => (trigger.charges_mode === 'set' ? amount : trigger.charges_mode === 'add' ? current + amount : current - amount);

  // Uses kept in a counter: the counter follows, and its marks are set when it changes
  if (getUsesCounter(target)) {
    const left = usesLeft(target);
    const update = setUsesLeftUpdate(target, next(left === Infinity ? 0 : left));
    if (update && Object.keys(update).length) await target.update(update);
    return;
  }

  const system = target.system;
  const max = Number(system.charges?.max) || 0;
  let value = Math.max(next(Number(system.charges?.value) || 0), 0);
  if (max > 0) value = Math.min(value, max);
  const update = {};
  if (value !== system.charges?.value) update['system.charges.value'] = value;
  if (!system.features?.has?.('replenish')) {
    const resources = value === 0 ? 'run_out' : value === 1 && max > 1 ? 'running_low' : '';
    if (resources !== (system.resources ?? '')) update['system.resources'] = resources;
  }
  if (Object.keys(update).length) await target.update(update);
}

/** Use a consumable (its Use action: asks what to apply when it has several options). */
async function useAction(holder, actor, trigger) {
  const target = resolveTriggerItem(holder, actor, trigger.use, isUsable);
  if (!target) return missingItem(holder, trigger.use);
  return useItem(target);
}

/**
 * Use a power: a power item, or one power of an album (by name; blank: its selected power).
 * Normal: the cast dialog opens (cost and danger warning). Free: cast at once, no cost.
 */
async function castAction(holder, actor, trigger) {
  // A broken or run-out item can't be cast from (as on the sheet)
  const target = resolveTriggerItem(
    holder,
    actor,
    trigger.cast,
    item => isCastable(item) && item.system.status !== ItemStatusType.BROKEN && item.system.resources !== 'run_out'
  );
  if (!target) return missingItem(holder, trigger.cast);
  const sheet = target.actor?.sheet;
  if (!sheet || !target.actor.isOwner) return;
  const isAlbum = target.system.type !== GearType.POWER;
  if (isAlbum && !(target.system.powers?.length > 0)) return missingItem(holder, trigger.cast);
  const dataset = {
    type: isAlbum ? 'power_album' : 'power',
    powerName: trigger.cast_power ?? '',
    freeCast: trigger.cast_free ? 'true' : ''
  };
  const row = { dataset: { documentClass: 'Item', itemId: target.id } };
  const fakeTarget = { dataset, closest: () => row };
  const noop = () => {};
  const event = { preventDefault: noop, stopPropagation: noop, detail: 1, shiftKey: false, ctrlKey: false, currentTarget: fakeTarget, target: fakeTarget };
  return sheet.constructor._onRoll.call(sheet, event, fakeTarget);
}

async function wearItem(item, wear) {
  const system = item.system;
  // Repair one step (broken → notched → whole) or fully
  if (wear === 'repair') {
    if (system.status === ItemStatusType.BROKEN) return item.update({ 'system.status': ItemStatusType.NOTCHED });
    if (system.status === ItemStatusType.NOTCHED) return item.update({ 'system.status': '' });
    return;
  }
  if (wear === 'repair_full') {
    if (system.status !== '') return item.update({ 'system.status': '' });
    return;
  }
  // Recharge: like the menu's Recharge (charges back to max unless replenish; clears running low / run out)
  if (wear === 'recharge') {
    const refill = system.features?.has?.('charges') && !system.features?.has?.('replenish');
    const update = {};
    if (system.resources !== '') update['system.resources'] = '';
    if (refill && system.charges?.value !== system.charges?.max) update['system.charges.value'] = system.charges.max;
    Object.assign(update, refillUsesUpdate(item));
    if (Object.keys(update).length) return item.update(update);
    return;
  }
  if (wear === 'notch' && system.status === '') return item.update({ 'system.status': ItemStatusType.NOTCHED });
  if (wear === 'break' && system.status !== ItemStatusType.BROKEN) {
    return item.update({ 'system.status': ItemStatusType.BROKEN, 'system.readied': false });
  }
  if (wear === 'running_low' && system.resources === '') return item.update({ 'system.resources': 'running_low' });
  if (wear === 'run_out' && system.resources !== 'run_out') return item.update({ 'system.resources': 'run_out' });
}

export function describeCondition(trigger, item = null) {
  const text = $fmt(`SDM.Trigger.Condition.${trigger.condition}`, { value: trigger.value });
  // Counter triggers name the counter: "Kills: total 5+"; charge triggers say "Charges"
  if (trigger.roll === 'counter') {
    const owner = trigger.watch_scope === 'actor' ? item?.actor : item;
    const label = owner?.system?.counters?.[trigger.watch]?.label ?? trigger.watch;
    return `${label}: ${text}`;
  }
  if (trigger.roll === 'charges') return `${$l10n('SDM.Trigger.Charges')}: ${text}`;
  return text;
}

export function renderTriggers(fired) {
  if (!fired.length) return '';
  const rows = fired
    .map(
      ({ item, trigger }) =>
        `<li><i class="fa-solid fa-bolt"></i> <b>${esc(item.name)}</b> (${esc(describeCondition(trigger, item))}): ${esc(trigger.text)}</li>`
    )
    .join('');
  return `<div class="sdm-roll-triggers"><b>${$l10n('SDM.Trigger.Fired')}</b><ul>${rows}</ul></div>`;
}

/** Set a counter to a value (between 0 and its maximum). */
async function setCounter(item, key, value) {
  const counter = item?.system?.counters?.[key];
  if (!counter) return;
  let next = Math.max(Math.trunc(Number(value) || 0), 0);
  if (Number.isFinite(counter.max) && counter.max !== null) next = Math.min(next, counter.max);
  if (next !== counter.value) await item.update({ [`system.counters.${key}.value`]: next });
}

/* ---------- Counter and charge triggers ---------- */

/** A threshold condition on a value (with its maximum): =, ≥, ≤, full, empty. */
function thresholdMatches(condition, target, value, max) {
  const hasMax = Number.isFinite(max) && max !== null && max > 0;
  switch (condition) {
    case 'total':
      return value === target;
    case 'totalAtLeast':
      return value >= target;
    case 'totalAtMost':
      return value <= target;
    case 'counterMax':
    case 'full':
      return hasMax && value >= max;
    case 'empty':
      return value <= 0;
    default:
      return false;
  }
}

/**
 * Does a change of a counter or of charges fire this trigger? Changes / increases / decreases fire on
 * every change; thresholds fire once, when they become true.
 */
function changeMatches(trigger, before, now, max) {
  if (before === now) return false;
  switch (trigger.condition) {
    case 'changes':
      return true;
    case 'increases':
      return now > before;
    case 'decreases':
      return now < before;
    default:
      return (
        !thresholdMatches(trigger.condition, trigger.value, before, max) &&
        thresholdMatches(trigger.condition, trigger.value, now, max)
      );
  }
}

/** Before an update: remember the counter values (and charges) that are about to change. */
function rememberBefore(doc, changes, options, key) {
  const changed = foundry.utils.getProperty(changes, 'system.counters');
  if (changed && typeof changed === 'object') {
    const before = {};
    for (const counterKey of Object.keys(changed)) {
      const counter = doc.system?.counters?.[counterKey];
      if (counter) before[counterKey] = Number(counter.value) || 0;
    }
    if (Object.keys(before).length) options[key] = before;
  }
}

function onPreUpdateItemCounters(item, changes, options) {
  rememberBefore(item, changes, options, 'sdmCountersBefore');
  if (foundry.utils.getProperty(changes, 'system.charges.value') !== undefined) {
    options.sdmChargesBefore = Number(item.system?.charges?.value) || 0;
  }
}

function onPreUpdateActorCounters(actor, changes, options) {
  rememberBefore(actor, changes, options, 'sdmActorCountersBefore');
}

async function fireChangeTriggers(fired, actor) {
  if (!fired.length) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: renderTriggers(fired)
  });
  await runTriggerActions(fired, { actor });
}

/** After an item update: its own counter triggers and its charge triggers. */
async function onUpdateItemCounters(item, changes, options, userId) {
  if (userId !== game.user.id || !featureEnabled('triggers') || chainDepth >= MAX_CHAIN) return;
  const counters = featureEnabled('counters') ? options?.sdmCountersBefore : null;
  const charges = options?.sdmChargesBefore;
  if (!counters && charges === undefined) return;
  const fired = [];
  for (const trigger of item.system.triggers ?? []) {
    if (trigger.roll === 'counter' && counters && trigger.watch_scope !== 'actor' && trigger.watch in counters) {
      const now = item.system.counters?.[trigger.watch];
      if (!now) continue;
      const before = counters[trigger.watch];
      const value = Number(now.value) || 0;
      if (changeMatches(trigger, before, value, now.max)) fired.push({ item, trigger, delta: value - before });
    } else if (trigger.roll === 'charges' && charges !== undefined) {
      const value = Number(item.system.charges?.value) || 0;
      const max = Number(item.system.charges?.max) || 0;
      if (changeMatches(trigger, charges, value, max)) fired.push({ item, trigger, delta: value - charges });
    }
  }
  await fireChangeTriggers(fired, item.actor);
}

/** After an actor update: triggers of its readied gear, traits and burdens watching its counters. */
async function onUpdateActorCounters(actor, changes, options, userId) {
  const before = options?.sdmActorCountersBefore;
  if (!before || userId !== game.user.id) return;
  if (!featureEnabled('triggers') || !featureEnabled('counters') || chainDepth >= MAX_CHAIN) return;
  const fired = [];
  for (const item of watchingItems(actor)) {
    for (const trigger of item.system?.triggers ?? []) {
      if (trigger.roll !== 'counter' || trigger.watch_scope !== 'actor' || !(trigger.watch in before)) continue;
      const now = actor.system.counters?.[trigger.watch];
      if (!now) continue;
      const value = Number(now.value) || 0;
      if (changeMatches(trigger, before[trigger.watch], value, now.max)) {
        fired.push({ item, trigger, delta: value - before[trigger.watch] });
      }
    }
  }
  await fireChangeTriggers(fired, actor);
}

export function setupTriggers() {
  Hooks.on('preUpdateItem', onPreUpdateItemCounters);
  Hooks.on('updateItem', onUpdateItemCounters);
  Hooks.on('preUpdateActor', onPreUpdateActorCounters);
  Hooks.on('updateActor', onUpdateActorCounters);
}
