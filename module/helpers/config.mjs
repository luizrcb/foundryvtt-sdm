import { PullMode, SizeUnit, SpeedType } from "./constants.mjs";

export const SDM = {};

/**
 * The set of Ability Scores used within the system.
 * @type {Object}
 */

SDM.abilities = {
  str: 'SDM.Ability.Str.long',
  end: 'SDM.Ability.End.long',
  agi: 'SDM.Ability.Agi.long',
  cha: 'SDM.Ability.Cha.long',
  aur: 'SDM.Ability.Aur.long',
  tho: 'SDM.Ability.Tho.long',
}

SDM.abilityAbbreviations = {
  str: 'SDM.Ability.Str.abbr',
  end: 'SDM.Ability.End.abbr',
  agi: 'SDM.Ability.Agi.abbr',
  cha: 'SDM.Ability.Cha.abbr',
  aur: 'SDM.Ability.Aur.abbr',
  tho: 'SDM.Ability.Tho.abbr',
};

SDM.fatigue = 'SDM.Actor.Character.FIELDS.fatigue.label';
SDM.versatile = 'SDM.Item.Features.versatile.label';

SDM.abilitiesOrder = {
  "en": ["str", "end", "agi", "cha", "aur", "tho"],
  "pt-br": ["cha", "tho", "str", "agi", "aur", "end"],
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


const abilitiesLabel = 'SDM.Actor.Character.FIELDS.abilities.label';

SDM.abilitiesLabel = abilitiesLabel;
SDM.modifierLabel = 'SDM.Rolls.modifier.label';
SDM.rollTypeLabel = 'SDM.Rolls.rollType.label';


SDM.rollType = {
  'normal': 'SDM.Rolls.normal.label',
  'advantage': 'SDM.Rolls.advantage.label',
  'disadvantage': 'SDM.Rolls.disadvantage.label',
};

SDM.rollSource = {
  'ability': abilitiesLabel,
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