import { ActorType } from './constants.mjs';
import { $l10n } from './globalUtils.mjs';
import { cardTag } from '../rolls/ui/cardParts.mjs';

/**
 * Optional rule: a character's natural 20 (ability checks, saves, attacks) gives 1 hero die, never
 * above its maximum. Only the roll's own d20: results changed by hero dice never award.
 * Returns the card tag ("+1 hero die" / "Hero dice full"), or '' when it doesn't apply.
 */
export async function awardNat20HeroDie(actor) {
  if (!game.settings.get('sdm', 'heroDieOnNat20')) return '';
  if (actor?.type !== ActorType.CHARACTER || !actor.isOwner) return '';
  const value = Number(actor.system.hero_dice?.value) || 0;
  const max = Number(actor.system.hero_dice?.max) || 0;
  if (value >= max) return cardTag($l10n('SDM.HeroDieNat20.Full'), { tone: 'info', icon: 'fa-solid fa-dice-d20' });
  await actor.update({ 'system.hero_dice.value': value + 1 });
  return cardTag($l10n('SDM.HeroDieNat20.Gained'), { tone: 'good', icon: 'fa-solid fa-dice-d20' });
}
