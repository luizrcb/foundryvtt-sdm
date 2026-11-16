import { applyItemEffectToTargets, applyStatusToTargets, isUsable, useItem } from '../app/use-item.mjs';
import { GearType, ItemStatusType, ItemType } from '../helpers/constants.mjs';
import { resetCounters, stepCounter } from '../helpers/counters.mjs';
import { getItemIdentifier } from '../helpers/effectReferences.mjs';
import { getUsesCounter, refillUsesUpdate, setUsesLeftUpdate, usesLeft } from '../helpers/itemUses.mjs';
import { featureEnabled } from '../helpers/features.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import { hasPowerAlbum, UnarmedDamageItem } from '../helpers/itemUtils.mjs';
import { payCost, resourceLabel } from './boost.mjs';
import { numberValue, resolveFormula, rollAmount } from '../helpers/formulas.mjs';
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

/** A trigger's number: a number, or a formula reading counters and other values (no dice). */
function triggerTarget(trigger, item) {
  return numberValue(trigger.value, { item, actor: item?.actor });
}

function matches(trigger, roll, { usageTarget = null, success = null } = {}, item = null) {
  const target = triggerTarget(trigger, item);
  // A value that is blank or not a number never matches
  const needsValue = ['natural', 'naturalAtLeast', 'naturalAtMost', 'total', 'totalAtLeast', 'totalAtMost', 'die'];
  if (target === null && needsValue.includes(trigger.condition)) return false;
  const results = activeResults(roll);
  const natural = naturalD20(roll);
  const total = Number(roll.total);
  switch (trigger.condition) {
    case 'natural':
      return natural === target;
    case 'naturalAtLeast':
      return natural !== null && natural >= target;
    case 'naturalAtMost':
      return natural !== null && natural <= target;
    case 'total':
      return total === target;
    case 'totalAtLeast':
      return total >= target;
    case 'totalAtMost':
      return total <= target;
    // Saves, defeat, attacks against a target: the roll's outcome (null when it has none)
    case 'always':
      return true;
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
      return results.some(r => r.value === target);
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
export function actorTriggers(actor, rollKind, roll, { attack = '', ability = '', success = null, withItem = '' } = {}) {
  const fired = [];
  if (!featureEnabled('triggers')) return fired;
  const chosen = rollKind === 'attack' && withItem ? actor.items.get(withItem) ?? null : null;
  for (const item of watchingItems(actor)) {
    for (const trigger of item.system.triggers ?? []) {
      if (trigger.roll !== rollKind) continue;
      // Attacks: whose attack fires it ("From" — the item it is made with, chosen in the attack dialog)
      if (rollKind === 'attack' && !attackFromMatches(item, trigger, chosen)) continue;
      if (rollKind === 'attack' && trigger.attack && attack && trigger.attack !== attack) continue;
      if (['save', 'ability'].includes(rollKind) && trigger.ability && ability && trigger.ability !== ability) continue;
      if (matches(trigger, roll, { success }, item)) fired.push({ item, trigger });
    }
  }
  return fired;
}

const isUnarmedItem = item =>
  item?._stats?.compendiumSource === UnarmedDamageItem || item?.getFlag?.('sdm', 'fromCompendium') === UnarmedDamageItem;

/**
 * Does an attack made with `chosen` (null: none chosen, "—") fire this trigger held by `holder`?
 * From "this item" (the default): on a weapon / power, only an attack made with it (or with none
 * chosen); on other gear, traits and burdens, any attack. "Any item": any attack. "The item…": an
 * attack made with that item (by identifier). "Unarmed": an attack made with Unarmed Damage.
 */
function attackFromMatches(holder, trigger, chosen) {
  switch (trigger.from || '') {
    case 'any':
      return true;
    case 'item':
      return !!chosen && !!trigger.from_item && getItemIdentifier(chosen) === trigger.from_item;
    case 'unarmed':
      return !!chosen && isUnarmedItem(chosen);
    default:
      return isAttackGear(holder) ? !chosen || chosen.id === holder.id : true;
  }
}

/** Gear an attack can be made with: weapons (or the weapon feature), powers and power albums. */
function isAttackGear(item) {
  if (item.type !== ItemType.GEAR) return false;
  const type = item.system?.type;
  return type === 'weapon' || type === 'power' || type === 'power_album' || !!item.system?.features?.has?.('weapon');
}

/**
 * Triggers of an attack, for that kind of attack (melee, ranged, fantascience, oldtech). Made with a
 * chosen item (`withItem`), the other weapons and powers are left out; other gear, traits and burdens
 * still watch it.
 */
export function attackTriggers(actor, roll, attack = '', success = null, { withItem = '' } = {}) {
  return actorTriggers(actor, 'attack', roll, { attack, success, withItem });
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
      if (matches(trigger, roll, options, holder)) fired.push({ item: holder, trigger });
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
      // A cost is paid first (once, whatever the change); unpaid or declined, the actions are skipped
      if (!(await payTriggerCost(item, trigger, actor ?? item.actor))) continue;
      if (trigger.table) {
        const table = await fromUuid(trigger.table);
        if (table?.documentName === 'RollTable') await table.draw();
      }
      if (trigger.effect) {
        await applyItemEffectToTargets(item, trigger.effect, actor ?? item.actor, {
          self: trigger.effect_target === 'self'
        });
      }
      if (trigger.status) {
        await applyStatusToTargets(trigger.status, actor ?? item.actor, {
          self: trigger.status_target === 'self',
          remove: trigger.status_mode === 'remove'
        });
      }
      if (trigger.wear) await wearItem(item, trigger.wear);
      const roller = actor ?? item.actor;
      // The counter of this item, or of its owner
      const counterDoc = trigger.counter_scope === 'actor' ? item.actor ?? roller : item;
      if (trigger.counter && counterDoc?.system?.counters?.[trigger.counter]) {
        const mode = trigger.counter_mode || 'add';
        if (mode === 'reset') await resetCounters(counterDoc, { key: trigger.counter });
        // The step is a number or a formula (dice and references allowed)
        const amount = ctx => rollAmount(trigger.counter_step, { item, actor: roller, ...ctx }).then(r => r.total);
        if (mode === 'set') await setCounter(counterDoc, trigger.counter, await amount({ fallback: 0 }));
        else await stepCounter(counterDoc, trigger.counter, (await amount({ fallback: 1 })) * times);
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

/** Pay a trigger's cost (asking first if set); false when it is declined or cannot be paid. */
async function payTriggerCost(item, trigger, actor) {
  if (!trigger.cost_resource || !actor) return true;
  const cost = `${trigger.cost ?? ''}`.trim() || '1';
  // Shown with counter references as their current values ("pay 3 life"); rolled only when paid
  const shownCost = resolveFormula(cost, { item, actor }) || cost;
  const resource = resourceLabel(trigger.cost_resource);
  const skip = key =>
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><i class="fa-solid fa-ban"></i> ${esc($fmt(key, { item: item.name, cost: shownCost, resource }))}</p>`
    });
  if (trigger.cost_ask) {
    const question = $fmt('SDM.Trigger.CostQuestion', { item: item.name, cost: shownCost, resource });
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: item.name },
      content: `<p>${esc(question)}</p>${trigger.text ? `<p><i>${esc(trigger.text)}</i></p>` : ''}`,
      rejectClose: false
    });
    if (!confirmed) {
      await skip('SDM.Trigger.CostDeclined');
      return false;
    }
  }
  const paid = await payCost(actor, { resource: trigger.cost_resource, cost, item });
  if (paid === null) {
    await skip('SDM.Trigger.CostUnpaid');
    return false;
  }
  return true;
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
  const { total } = await rollAmount(trigger.charges_amount, { item: holder, actor, fallback: 0 });
  const base = Math.max(total, 0);
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
  const condition = trigger.condition === 'counterMax' ? 'full' : trigger.condition;
  // Counters and charges have a value, usage rolls a result
  const tracked = trigger.roll === 'counter' || trigger.roll === 'charges';
  const prefix = condition.startsWith('total') ? (tracked ? 'value' : trigger.roll === 'usage' ? 'result' : '') : '';
  const key = prefix ? condition.replace('total', prefix) : condition;
  const text = $fmt(`SDM.Trigger.Condition.${key}`, { value: triggerTarget(trigger, item) ?? trigger.value });
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
  if (target === null && condition.startsWith('total')) return false;
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
 * every change; "=" when the value lands on the number; "≥" / "≤" on every change while true (or only
 * when they become true, with "once"); full / empty when they are reached.
 */
function changeMatches(trigger, before, now, max, item = null) {
  if (before === now) return false;
  const target = triggerTarget(trigger, item);
  const condition = trigger.condition === 'counterMax' ? 'full' : trigger.condition;
  const crossed = () =>
    !thresholdMatches(condition, target, before, max) && thresholdMatches(condition, target, now, max);
  switch (condition) {
    case 'changes':
      return true;
    case 'increases':
      return now > before;
    case 'decreases':
      return now < before;
    case 'totalAtLeast':
    case 'totalAtMost':
      return trigger.once ? crossed() : thresholdMatches(condition, target, now, max);
    default:
      return crossed();
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
      if (changeMatches(trigger, before, value, now.max, item)) fired.push({ item, trigger, delta: value - before });
    } else if (trigger.roll === 'charges' && charges !== undefined) {
      const value = Number(item.system.charges?.value) || 0;
      const max = Number(item.system.charges?.max) || 0;
      if (changeMatches(trigger, charges, value, max, item)) fired.push({ item, trigger, delta: value - charges });
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
      if (changeMatches(trigger, before[trigger.watch], value, now.max, item)) {
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

/**
 * Hero dice change a roll after its triggers fired: check them again on the improved result and fire
 * those that match now but didn't before. `check` is the card's flags.sdm.triggerCheck ({ kind:
 * attack | ability | save, actor, attack, ability, withItem, defense, target }); `heroResult` the hero
 * dice engine's result (kept dice after the hero dice, total). A die bumped to 20 counts as natural.
 * Returns { fired, actor } (nothing to fire: fired = []).
 */
export function recheckTriggersAfterHeroDice(check, originalRoll, heroResult) {
  const actor = check?.actor ? fromUuidSync(check.actor) : null;
  if (!actor || !originalRoll || !heroResult) return { fired: [], actor };
  const heroRoll = {
    total: Number(heroResult.total),
    dice: (heroResult.keptDice ?? []).map(die => ({
      faces: die.faces,
      results: [die.modifiedValue, ...(die.newExplosions ?? [])].map(result => ({ result, active: true }))
    }))
  };
  const successOf = roll => {
    const total = Number(roll.total);
    if (check.kind === 'save') return Number.isFinite(check.target) ? total >= check.target : null;
    if (check.kind === 'attack' && Number.isFinite(check.defense)) {
      const natural = naturalD20(roll);
      return natural !== 1 && (natural === 20 || total > check.defense);
    }
    return null;
  };
  const firedFor = roll => {
    const success = successOf(roll);
    if (check.kind === 'attack') return attackTriggers(actor, roll, check.attack ?? '', success, { withItem: check.withItem ?? '' });
    if (check.kind === 'ability') return actorTriggers(actor, 'ability', roll, { ability: check.ability ?? '' });
    if (check.kind === 'save') return actorTriggers(actor, 'save', roll, { ability: check.ability ?? '', success });
    return [];
  };
  const before = firedFor(originalRoll);
  const fired = firedFor(heroRoll).filter(entry => !before.some(old => old.item === entry.item && old.trigger === entry.trigger));
  return { fired, actor };
}
