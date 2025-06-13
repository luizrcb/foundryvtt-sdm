import { PullMode, SizeUnit, SpeedType } from "./constants.mjs";

export const SDM = {};

/**
 * The set of Ability Scores used within the system.
 * @type {Object}
 */
SDM.abilities = {
  str: 'SDM.Ability.Str.long',
  dex: 'SDM.Ability.Dex.long',
  con: 'SDM.Ability.Con.long',
  int: 'SDM.Ability.Int.long',
  wis: 'SDM.Ability.Wis.long',
  cha: 'SDM.Ability.Cha.long',
};

SDM.abilityAbbreviations = {
  str: 'SDM.Ability.Str.abbr',
  dex: 'SDM.Ability.Dex.abbr',
  con: 'SDM.Ability.Con.abbr',
  int: 'SDM.Ability.Int.abbr',
  wis: 'SDM.Ability.Wis.abbr',
  cha: 'SDM.Ability.Cha.abbr',
};

SDM.stats = {
  str: 'SDM.Stat.Str.long',
  end: 'SDM.Stat.End.long',
  agi: 'SDM.Stat.Agi.long',
  cha: 'SDM.Stat.Cha.long',
  aur: 'SDM.Stat.Aur.long',
  tho: 'SDM.Stat.Tho.long',
}

SDM.statAbbreviations = {
  str: 'SDM.Stat.Str.abbr',
  end: 'SDM.Stat.End.abbr',
  agi: 'SDM.Stat.Agi.abbr',
  cha: 'SDM.Stat.Cha.abbr',
  aur: 'SDM.Stat.Aur.abbr',
  tho: 'SDM.Stat.Tho.abbr',
};

SDM.fatigue = 'SDM.Actor.Character.FIELDS.fatigue.label';
SDM.versatile = 'SDM.Item.Features.versatile.label';

SDM.statsOrder = {
  "en": ["str", "end","agi", "cha", "aur", "tho"],
  "x": ["cha", "tho", "str", "agi", "aur", "end"],
};

SDM.pullModes = Object.values(PullMode).reduce((acc, pullMode) => {
  acc[pullMode] = `SDM.Item.Mount.PullMode.${pullMode}`;
  return acc;
}, {});

SDM.speedType = Object.values(SpeedType).reduce((acc, speedType) => {
  acc[speedType] = `SDM.SpeedType.${speedType}`;
  return acc;
}, {});

SDM.sizeUnits = Object.values(SizeUnit).reduce((acc, unit) => {
  acc[unit] = `SDM.Item.Size.Unit.${unit}`;
  return acc;
}, {});


const statsLabel = 'SDM.Actor.Character.FIELDS.stats.label';

SDM.statsLabel = statsLabel;
SDM.modifierLabel = 'SDM.Rolls.modifier.label';
SDM.rollTypeLabel = 'SDM.Rolls.rollType.label';


SDM.rollType = {
  'normal': 'SDM.Rolls.normal.label',
  'advantage': 'SDM.Rolls.advantage.label',
  'disadvantage': 'SDM.Rolls.disadvantage.label',
};

SDM.rollSource = {
  'stat': statsLabel,
  'skill': 'SDM.Actor.Character.FIELDS.skills.label',
  'gear': 'TYPES.Item.gear',
  'weapon': 'TYPES.Item.weapon'
};

SDM.damageMultiplier = {
  '*2': 'x2',
  '*4': 'x4',
  '*8': 'x8',
  '*16': 'x16',
  '*32': 'x32',
};

SDM.speedValues = { very_slow: -2, slow: -1, standard: 0, fast: 1, very_fast: 2 };
SDM.reverseSpeedValues = {
  '-2': 'very_slow',
  '-1': 'slow',
  '0': 'standard',
  '1': 'fast',
  '2': 'very_fast',
};