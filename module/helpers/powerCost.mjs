import { ActorType } from './constants.mjs';
import { $fmt, $l10n } from './globalUtils.mjs';

/**
 * Power cost: casting a power costs (caster's power cost × power level) life, doubled when
 * overcharged, minus the caster's power cost bonus (at least 1; level 0 powers are free).
 * The caster pays when using the power, with life and/or ability points by choice
 * (1 ability point = 1 life). Life can drop to 0, which calls for a defeat roll.
 */

export function getPowerCost(actorSystem = {}, powerData = {}, overcharge = false) {
  const level = Number(powerData?.level) || 0;
  const perLevel = Number(actorSystem?.power_cost ?? 2);
  const bonus = Number(actorSystem?.power_cost_bonus) || 0;
  let cost = Math.ceil(perLevel * level);
  if (overcharge) cost *= 2;
  return Math.max(cost - bonus, level === 0 ? 0 : 1);
}

/** Does this actor pay power costs (characters, automation on)? */
export function paysPowerCost(actor) {
  return actor?.type === ActorType.CHARACTER && game.settings.get('sdm', 'automatePowerCost');
}

/** Life the caster can spend (temporary life is spent first). */
function availableLife(actor) {
  const life = Number(actor.system.life?.value) || 0;
  const temp = actor.system.temporary_life;
  return life + (temp?.enabled ? Number(temp.value) || 0 : 0);
}

/**
 * Pay the cost: the points given per ability ({ str: 1, aur: 2 }, any abilities), and life for the
 * rest. Life can drop to 0. Returns { life, abilities, defeated }, or null when it can't be paid
 * (nothing is spent then): an ability without those points, more ability points than the cost, or
 * not enough life for the rest.
 */
export async function payPowerCost(actor, cost, { fromAbilities = {} } = {}) {
  cost = Math.max(Number(cost) || 0, 0);
  if (!cost) return { life: 0, abilities: {}, defeated: false };

  const abilityLabel = key => $l10n(CONFIG.SDM.abilities[key] ?? key);
  const spend = {};
  for (const [key, raw] of Object.entries(fromAbilities ?? {})) {
    const points = Math.max(Math.trunc(Number(raw) || 0), 0);
    if (!points) continue;
    const current = Number(actor.system.abilities?.[key]?.current) || 0;
    if (!actor.system.abilities?.[key] || current < points) {
      ui.notifications.warn($fmt('SDM.PowerCostPay.NotEnoughAbility', { ability: abilityLabel(key), current }));
      return null;
    }
    spend[key] = points;
  }
  const abilityTotal = Object.values(spend).reduce((sum, n) => sum + n, 0);
  if (abilityTotal > cost) {
    ui.notifications.warn($fmt('SDM.PowerCostPay.TooMuch', { cost, points: abilityTotal }));
    return null;
  }
  const lifePart = cost - abilityTotal;
  const lifeLeft = availableLife(actor);
  if (lifePart > lifeLeft) {
    ui.notifications.warn($fmt('SDM.PowerCostPay.NotEnoughLife', { cost, life: lifeLeft, missing: lifePart - lifeLeft }));
    return null;
  }

  if (abilityTotal) {
    const update = {};
    for (const [key, points] of Object.entries(spend)) {
      update[`system.abilities.${key}.current`] = (Number(actor.system.abilities[key].current) || 0) - points;
    }
    await actor.update(update);
  }
  if (lifePart > 0) await actor.applyDamage(lifePart, 1, false, true);

  const parts = [];
  if (lifePart > 0) parts.push(`${lifePart} ${$l10n('SDM.Boost.Life')}`);
  for (const [key, points] of Object.entries(spend)) parts.push(`${points} ${abilityLabel(key)}`);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><i class="fa-solid fa-wand-magic-sparkles"></i> ${$fmt('SDM.PowerCostPay.Paid', {
      actor: actor.name,
      paid: parts.join(' + ')
    })}</p>`
  });

  const defeated = lifePart > 0 && (Number(actor.system.life?.value) || 0) <= 0;
  return { life: lifePart, abilities: spend, defeated };
}
