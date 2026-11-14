import { featureEnabled } from './features.mjs';

/**
 * Item uses kept in one of the item's counters (instead of charges): "uses left" counts down to 0,
 * "uses spent" counts up to the counter's maximum. They follow the resources rules like charges:
 * one use left of several is running low, none left is run out, and getting uses back (counter
 * reset, +1, Recharge) clears the mark. Replenish items keep the usage roll.
 */
export const USES_MODES = { left: 'SDM.Uses.Mode.left', spent: 'SDM.Uses.Mode.spent' };

/** The counter holding the item's uses, or null. */
export function getUsesCounter(item) {
  const key = item?.system?.uses?.counter;
  if (!key || !featureEnabled('counters')) return null;
  const counter = item.system.counters?.[key];
  if (!counter) return null;
  return { key, counter, mode: item.system.uses?.mode === 'spent' ? 'spent' : 'left' };
}

const hasMax = counter => counter.max !== null && counter.max !== undefined && Number.isFinite(Number(counter.max));

/** Uses left for a counter value (Infinity: a "spent" counter without maximum never runs out). */
function leftFor(uses, value) {
  if (uses.mode === 'left') return Math.max(Number(value) || 0, 0);
  if (!hasMax(uses.counter)) return Infinity;
  return Math.max(Number(uses.counter.max) - (Number(value) || 0), 0);
}

/** How many uses the counter holds in all (null: no limit known). */
function totalFor(uses) {
  if (!hasMax(uses.counter)) return null;
  return Number(uses.counter.max);
}

export function usesLeft(item) {
  const uses = getUsesCounter(item);
  return uses ? leftFor(uses, uses.counter.value) : null;
}

/** Resources mark for a counter value: none left → run out, one left of several → running low. */
export function usesResources(uses, value) {
  const left = leftFor(uses, value);
  if (left <= 0) return 'run_out';
  const total = totalFor(uses);
  if (left === 1 && (total === null || total > 1)) return 'running_low';
  return '';
}

/** The update that spends `count` uses (null when there aren't enough). */
export function spendUsesUpdate(item, count = 1) {
  const uses = getUsesCounter(item);
  if (!uses) return null;
  const value = Number(uses.counter.value) || 0;
  if (leftFor(uses, value) < count) return null;
  const next = uses.mode === 'left' ? value - count : value + count;
  return { [`system.counters.${uses.key}.value`]: next };
}

/** Recharge: all uses back (uses left: the maximum, else the reset value; uses spent: the reset value). */
export function refillUsesUpdate(item) {
  const uses = getUsesCounter(item);
  if (!uses) return {};
  const counter = uses.counter;
  const next = uses.mode === 'left' && hasMax(counter) ? Number(counter.max) : Number(counter.reset_value) || 0;
  return next === counter.value ? {} : { [`system.counters.${uses.key}.value`]: next };
}

/** Recharge would give uses back. */
export function canRefillUses(item) {
  return Object.keys(refillUsesUpdate(item)).length > 0;
}

/**
 * Before an item update: when its uses counter changes, set running low / run out (or clear them)
 * from the new value. Replenish items keep the marks of their usage rolls.
 */
export function applyUsesResources(item, changes) {
  const uses = getUsesCounter(item);
  if (!uses || item.system.features?.has?.('replenish')) return;
  const value = foundry.utils.getProperty(changes, `system.counters.${uses.key}.value`);
  if (value === undefined) return;
  if (foundry.utils.getProperty(changes, 'system.resources') !== undefined) return;
  const resources = usesResources(uses, value);
  if (resources !== (item.system.resources ?? '')) foundry.utils.setProperty(changes, 'system.resources', resources);
}
