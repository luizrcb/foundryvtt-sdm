import { featureEnabled } from '../helpers/features.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import { resolveFormula } from '../helpers/formulas.mjs';

/**
 * Damage boosts paid with a resource (Piezo Mace: spend 1d6 life for x2 damage; Noetic Blade:
 * 1 aura for x3; Magnificent Fireball: 1 life per shot, mandatory). The damage roll dialog offers
 * the boost; when used, the cost is rolled and paid by the actor and the damage is multiplied
 * (and/or gets extra damage).
 */

export function getBoost(item) {
  if (!featureEnabled('boost')) return null;
  const boost = item?.system?.boost;
  return boost?.enabled ? boost : null;
}

export const resourceLabel = resource =>
  resource === 'life'
    ? $l10n('SDM.Boost.Life')
    : resource === 'hero_die'
      ? $l10n('SDM.Boost.HeroDie')
      : $l10n(CONFIG.SDM.abilities[resource] ?? resource);

/** A boost with cost 0 is free: a situational bonus the player ticks (x2 vs vampires). */
export function isFreeBoost(boost) {
  return `${boost?.cost ?? ''}`.trim() === '0';
}

/** "Spend 1d6 life: x2 damage", "Spend 1 life: damage 1d12", "x2 (vs vampires)" */
export function describeBoost(boost, { item = null, actor = null } = {}) {
  // Counter references show as their current values ("pay 3 life", "damage 3d6")
  const shown = formula => (item || actor ? resolveFormula(formula, { item, actor }) : `${formula ?? ''}`.trim());
  const result = [];
  if (boost.damage) result.push($fmt('SDM.Boost.DamageBecomes', { formula: shown(boost.damage) }));
  if (boost.multiplier > 1) result.push(`x${boost.multiplier}`);
  if (boost.extra) result.push(`+${shown(boost.extra)}`);
  const what = result.length ? result.join(' ') : $l10n('SDM.Boost.NoResult');
  const note = boost.note ? ` (${boost.note})` : '';
  if (isFreeBoost(boost)) return `${what}${note}`;
  return (
    $fmt('SDM.Boost.Label', {
      cost: shown(boost.cost) || '1',
      resource: resourceLabel(boost.resource),
      result: what
    }) + note
  );
}

/** Roll flavor: what was paid ("3 life spent"), or the note of a free boost; the dice show in the roll's own flavor. */
export function describeBoostPaid(boost, amount) {
  if (isFreeBoost(boost)) return boost.note || $l10n('SDM.Boost.Used');
  return $fmt('SDM.Boost.Spent', { amount, resource: resourceLabel(boost.resource) });
}

/** Roll and pay the cost. Returns the amount paid (0 for a free boost), or null when the actor cannot pay it. */
export async function payBoost(actor, boost, item = null) {
  if (isFreeBoost(boost)) return 0;
  return payCost(actor, { resource: boost.resource, cost: boost.cost || '1', item });
}

/**
 * Roll a cost ("1d4") and take it from the actor: life (always paid), an ability's current score or
 * hero dice (refused when there is not enough). Posts what was paid; the amount, or null if unpaid.
 */
export async function payCost(actor, { resource = 'life', cost = '1', item = null } = {}) {
  // The cost can read counters and other values (@item.counters.kills.value)
  const formula = resolveFormula(`${cost}`.trim() || '1', { item, actor });
  const roll = await new Roll(formula, actor.getRollData()).evaluate();
  const amount = Math.max(Number(roll.total) || 0, 0);
  const notEnough = () => {
    ui.notifications.warn($fmt('SDM.Cost.NotEnough', { resource: resourceLabel(resource) }));
    return null;
  };
  if (resource === 'life') {
    await actor.applyDamage(amount, 1, false, true);
  } else if (resource === 'hero_die') {
    const dice = Number(actor.system.hero_dice?.value) || 0;
    if (dice < amount) return notEnough();
    await actor.update({ 'system.hero_dice.value': dice - amount });
  } else {
    const ability = actor.system.abilities?.[resource];
    if (!ability) return null;
    const current = Number(ability.current) || 0;
    if (current < amount) return notEnough();
    await actor.update({ [`system.abilities.${resource}.current`]: current - amount });
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><i class="fa-solid fa-bolt"></i> ${$fmt('SDM.Boost.Paid', {
      actor: actor.name,
      amount,
      resource: resourceLabel(resource)
    })}</p>`
  });
  return amount;
}

/** The dialog multiplier ("*4") combined with the boost's (x2 → "*8"). */
export function combineMultiplier(multiplier, boost) {
  if (!(boost?.multiplier > 1)) return multiplier;
  const current = parseInt(`${multiplier || ''}`.replace('*', ''), 10) || 1;
  return `*${current * boost.multiplier}`;
}
