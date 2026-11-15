import { resolveFormulaReferences } from './effectReferences.mjs';

/**
 * Amounts typed on items (trigger values, steps, charges and costs; boost cost, extra and damage;
 * consumable life, abilities, temporary life and harm) are numbers or formulas, and can read values
 * with the effect references: @item.counters.<key>.value, @actor.counters.<key>.value, @actor.level,
 * @items.<type>:<identifier>.<path>. In a dice expression put the reference in parentheses:
 * (@item.counters.hits.value)d6.
 */

const NUMBER = /^-?\d+(\.\d+)?$/;

function context(item, actor) {
  return { item: item ?? null, actor: actor ?? item?.actor ?? null };
}

/** The formula with its references replaced by their numbers (dice kept), for a later roll. */
export function resolveFormula(formula, { item = null, actor = null } = {}) {
  return resolveFormulaReferences(`${formula ?? ''}`.trim(), context(item, actor));
}

/** Roll an amount (dice allowed). Blank: the fallback (no roll). */
export async function rollAmount(formula, { item = null, actor = null, fallback = 0 } = {}) {
  const raw = `${formula ?? ''}`.trim();
  if (!raw) return { total: fallback, roll: null };
  if (NUMBER.test(raw)) return { total: Math.trunc(Number(raw)), roll: null };
  const owner = actor ?? item?.actor ?? null;
  const roll = await new Roll(resolveFormula(raw, { item, actor }), owner?.getRollData?.() ?? {}).evaluate();
  return { total: Math.trunc(Number(roll.total) || 0), roll };
}

/** A number now, without dice (trigger thresholds); null when blank or not a number. */
export function numberValue(formula, { item = null, actor = null } = {}) {
  const raw = `${formula ?? ''}`.trim();
  if (!raw) return null;
  if (NUMBER.test(raw)) return Math.trunc(Number(raw));
  try {
    const owner = actor ?? item?.actor ?? null;
    const roll = new Roll(resolveFormula(raw, { item, actor }), owner?.getRollData?.() ?? {}).evaluateSync({ strict: true });
    const total = Number(roll.total);
    return Number.isFinite(total) ? Math.trunc(total) : null;
  } catch {
    return null;
  }
}
