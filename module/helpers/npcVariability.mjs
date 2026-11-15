import { ActorType } from './constants.mjs';
import { getNPCDataByLevel } from './actorUtils.mjs';

/**
 * Optional NPC variability. An NPC can keep an individual profile (flags.sdm.npcProfile): a life
 * multiplier, offsets to defense, bonus and morale, a damage die step, and an archetype. Its stats are
 * the table row at its level with the profile applied, when it is generated and on every level up, so
 * a brute stays a brute. NPCs without a profile, and the Custom table, work exactly as before.
 *
 * - The NPC generator rolls a profile (World setting "NPC variability" sets the default; "none" hides it).
 * - Unlinked tokens of NPCs without a profile roll their own when placed (World setting "Unlinked token
 *   variability"); Shift while dropping skips it. An NPC with a profile is an individual: its tokens copy it.
 */

export const FLAG = 'npcProfile';
export const VARIABILITY_LEVELS = ['none', 'low', 'high'];

/** Archetypes: life as a fraction (+0.25 = +25%), the rest as offsets; dmg in die steps. */
export const ARCHETYPES = {
  brute: { life: 0.25, def: -1, dmg: 1 },
  agile: { life: -0.15, def: 2 },
  elite: { life: 0.2, def: 1, bon: 1, mor: 1 },
  weak: { life: -0.25, def: -1, bon: -1, mor: -1 },
  coward: { mor: -3 },
  fearless: { mor: 3 }
};

const DIE_LADDER = [4, 6, 8, 10, 12, 20];

const randomInt = (min, max) => min + Math.floor(CONFIG.Dice.randomUniform() * (max - min + 1));
const round2 = value => Math.round(value * 100) / 100;

export function getNpcProfile(actor) {
  return actor?.getFlag?.('sdm', FLAG) ?? null;
}

/**
 * Roll a profile. variability: none / low / high; archetype: '' (none), 'random', or a key of ARCHETYPES.
 * Returns null when there is nothing to vary.
 */
export function rollNpcProfile({ variability = 'none', archetype = '' } = {}) {
  const key = archetype === 'random' ? Object.keys(ARCHETYPES)[randomInt(0, Object.keys(ARCHETYPES).length - 1)] : archetype;
  const type = ARCHETYPES[key] ?? null;
  if (variability === 'none' && !type) return null;
  const spread = variability === 'high' ? 2 : variability === 'low' ? 1 : 0;
  const lifeSpread = variability === 'high' ? 0.25 : variability === 'low' ? 0.1 : 0;
  const lifeRoll = lifeSpread ? (CONFIG.Dice.randomUniform() * 2 - 1) * lifeSpread : 0;
  return {
    variability,
    archetype: type ? key : '',
    life: round2(Math.max(0.1, (1 + lifeRoll) * (1 + (type?.life ?? 0)))),
    def: randomInt(-spread, spread) + (type?.def ?? 0),
    bon: randomInt(-spread, spread) + (type?.bon ?? 0),
    mor: randomInt(-spread, spread) + (type?.mor ?? 0),
    dmg: (variability === 'high' ? randomInt(-1, 1) : 0) + (type?.dmg ?? 0)
  };
}

/** Move the first die of a formula up or down the ladder d4 → d6 → d8 → d10 → d12 → d20. */
export function stepDamage(formula, steps = 0) {
  if (!steps || !formula) return formula;
  return `${formula}`.replace(/(\d*)d(\d+)/, (match, count, faces) => {
    const index = DIE_LADDER.indexOf(Number(faces));
    if (index < 0) return match;
    const next = DIE_LADDER[Math.min(DIE_LADDER.length - 1, Math.max(0, index + steps))];
    return `${count}d${next}`;
  });
}

const clampMorale = value => Math.min(12, Math.max(2, value));

/** A table row (Life, Mor, Def, Bon, Dmg…) with the profile applied. */
export function applyNpcProfile(entry, profile) {
  if (!entry || !profile) return entry;
  return {
    ...entry,
    Life: Math.max(1, Math.round((entry.Life ?? 1) * (profile.life ?? 1))),
    Def: Math.max(1, (entry.Def ?? 0) + (profile.def ?? 0)),
    Bon: (entry.Bon ?? 0) + (profile.bon ?? 0),
    Mor: clampMorale((entry.Mor ?? 0) + (profile.mor ?? 0)),
    Dmg: stepDamage(entry.Dmg, profile.dmg ?? 0)
  };
}

/** "Brute · life 112% · defense −1 · damage +1 step" */
export function describeNpcProfile(profile) {
  if (!profile) return '';
  const t = key => game.i18n.localize(key);
  const signed = value => (value > 0 ? `+${value}` : `${value}`).replace('-', '−');
  const parts = [];
  if (profile.archetype) parts.push(t(`SDM.NpcProfile.Archetype.${profile.archetype}`));
  if ((profile.life ?? 1) !== 1) parts.push(`${t('SDM.NpcProfile.Life')} ${Math.round(profile.life * 100)}%`);
  if (profile.def) parts.push(`${t('SDM.NpcProfile.Defense')} ${signed(profile.def)}`);
  if (profile.bon) parts.push(`${t('SDM.NpcProfile.Bonus')} ${signed(profile.bon)}`);
  if (profile.mor) parts.push(`${t('SDM.NpcProfile.Morale')} ${signed(profile.mor)}`);
  if (profile.dmg) parts.push(`${t('SDM.NpcProfile.Damage')} ${signed(profile.dmg)}`);
  return parts.join(' · ') || t('SDM.NpcProfile.Average');
}

/* -------------------------------------------- */
/*  Unlinked tokens                             */
/* -------------------------------------------- */

/** Stats of an NPC with a profile: from its table at its level, or (Custom) from its own stats. */
function variedStats(actor, profile) {
  const s = actor.system;
  const entry = getNPCDataByLevel(s.createdFromTable || '', s.level ?? 0);
  const base = entry ?? {
    Life: Number(s.life?.max) || 1,
    Def: Number(s.defense) || 0,
    Bon: Number(s.bonus) || 0,
    Mor: Number(s.morale) || 0,
    Dmg: s.damage
  };
  const varied = applyNpcProfile(base, profile);
  return {
    life: { value: varied.Life, max: varied.Life },
    defense: varied.Def,
    bonus: varied.Bon,
    morale: varied.Mor,
    damage: varied.Dmg
  };
}

function onPreCreateToken(token, data, options, userId) {
  if (userId !== game.user.id || options?.keepId || options?.sdmNoVariation) return;
  const variability = game.settings.get('sdm', 'npcTokenVariability');
  const archetype = game.settings.get('sdm', 'npcTokenArchetype') ? 'random' : '';
  if (variability === 'none' && !archetype) return;
  if (token.actorLink || data.actorLink) return;
  const actor = token.baseActor ?? game.actors.get(data.actorId);
  if (actor?.type !== ActorType.NPC) return;
  // An individual (it has a profile), a copied token, or the creature of an animated item: as it is
  if (getNpcProfile(actor) || foundry.utils.getProperty(data, `delta.flags.sdm.${FLAG}`)) return;
  if (actor.getFlag('sdm', 'animatedItem')) return;
  // Shift while dropping: the NPC exactly as it is
  if (game.keyboard?.isModifierActive?.('Shift')) return;
  const profile = rollNpcProfile({ variability, archetype });
  if (!profile) return;
  token.updateSource({ delta: { system: variedStats(actor, profile), flags: { sdm: { [FLAG]: profile } } } });
}

export function setupNpcVariability() {
  Hooks.on('preCreateToken', onPreCreateToken);
}
