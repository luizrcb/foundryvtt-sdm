import { ActorType } from './constants.mjs';
import { $l10n } from './globalUtils.mjs';
import { cardTag } from '../rolls/ui/cardParts.mjs';

const QUERY = 'sdm.heroDieNat20';

/** Who gains a hero die on a natural 20: '' (off), 'roller' or 'all' (every player's character). */
export function heroDieOnNat20Mode() {
  const value = game.settings.get('sdm', 'heroDieOnNat20');
  // The option used to be on / off
  if (value === true || value === 'true') return 'roller';
  return value === 'roller' || value === 'all' ? value : '';
}

/** +1 hero die, never above the maximum. Returns true when gained, false when already full. */
async function gainHeroDie(actor) {
  const value = Number(actor.system.hero_dice?.value) || 0;
  const max = Number(actor.system.hero_dice?.max) || 0;
  if (value >= max) return false;
  await actor.update({ 'system.hero_dice.value': value + 1 });
  return true;
}

/** The characters assigned to the players (each player's own character). */
function playerCharacters() {
  const actors = new Set();
  for (const user of game.users) {
    if (!user.isGM && user.character?.type === ActorType.CHARACTER) actors.add(user.character);
  }
  return [...actors];
}

/** Runs on the active Referee: every player's character gains a hero die. */
async function onAllQuery() {
  for (const actor of playerCharacters()) await gainHeroDie(actor);
  return true;
}

export function setupHeroDieOnNat20() {
  CONFIG.queries[QUERY] = onAllQuery;
}

/**
 * Optional rule: a character's natural 20 (ability checks, saves, attacks) gives 1 hero die, never
 * above the maximum: to the roller, or to every player's character (the roller's too). Only the
 * roll's own d20: results changed by hero dice never award.
 * Returns the card tag, or '' when it doesn't apply.
 */
export async function awardNat20HeroDie(actor) {
  const mode = heroDieOnNat20Mode();
  if (!mode || actor?.type !== ActorType.CHARACTER) return '';
  const icon = 'fa-solid fa-dice-d20';

  if (mode === 'all') {
    if (game.user.isGM) await onAllQuery();
    else {
      const gm = game.users.activeGM;
      if (!gm) {
        ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
        return '';
      }
      await gm.query(QUERY, {});
    }
    // The roller's own character, if not a player's assigned one, gains one too
    if (actor.isOwner && !playerCharacters().includes(actor)) await gainHeroDie(actor);
    return cardTag($l10n('SDM.HeroDieNat20.GainedAll'), { tone: 'good', icon });
  }

  if (!actor.isOwner) return '';
  return (await gainHeroDie(actor))
    ? cardTag($l10n('SDM.HeroDieNat20.Gained'), { tone: 'good', icon })
    : cardTag($l10n('SDM.HeroDieNat20.Full'), { tone: 'info', icon });
}
