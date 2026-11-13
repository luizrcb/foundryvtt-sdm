import { featureEnabled } from '../helpers/features.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';

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

const resourceLabel = resource =>
  resource === 'life'
    ? $l10n('SDM.Boost.Life')
    : resource === 'hero_die'
      ? $l10n('SDM.Boost.HeroDie')
      : $l10n(CONFIG.SDM.abilities[resource] ?? resource);

/** "Spend 1d6 life: x2 damage" */
export function describeBoost(boost) {
  const result = [];
  if (boost.multiplier > 1) result.push(`x${boost.multiplier}`);
  if (boost.extra) result.push(`+${boost.extra}`);
  return $fmt('SDM.Boost.Label', {
    cost: boost.cost || '1',
    resource: resourceLabel(boost.resource),
    result: result.length ? result.join(' ') : $l10n('SDM.Boost.NoResult')
  });
}

/** Roll flavor: only what was paid ("3 life spent"); the extra dice and multiplier show in the roll's own flavor. */
export function describeBoostPaid(boost, amount) {
  return $fmt('SDM.Boost.Spent', { amount, resource: resourceLabel(boost.resource) });
}

/** Roll and pay the cost. Returns the amount paid, or null when the actor cannot pay it. */
export async function payBoost(actor, boost) {
  const roll = await new Roll(boost.cost || '1', actor.getRollData()).evaluate();
  const amount = Math.max(Number(roll.total) || 0, 0);
  if (boost.resource === 'life') {
    await actor.applyDamage(amount, 1, false, true);
  } else if (boost.resource === 'hero_die') {
    const dice = Number(actor.system.hero_dice?.value) || 0;
    if (dice < amount) {
      ui.notifications.warn($l10n('SDM.Boost.NotEnough'));
      return null;
    }
    await actor.update({ 'system.hero_dice.value': dice - amount });
  } else {
    const ability = actor.system.abilities?.[boost.resource];
    if (!ability) return null;
    const current = Number(ability.current) || 0;
    if (current < amount) {
      ui.notifications.warn($l10n('SDM.Boost.NotEnough'));
      return null;
    }
    await actor.update({ [`system.abilities.${boost.resource}.current`]: current - amount });
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><i class="fa-solid fa-bolt"></i> ${$fmt('SDM.Boost.Paid', {
      actor: actor.name,
      amount,
      resource: resourceLabel(boost.resource)
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
