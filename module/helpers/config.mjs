import { PullMode, SizeUnit, SpeedType } from "./constants.mjs";

export const SDM = {};

/**
 * The set of Ability Scores used within the system.
 * @type {Object}
 */

SDM.abilities = {
  str: 'SDM.AbilityStr',
  end: 'SDM.AbilityEnd',
  agi: 'SDM.AbilityAgi',
  cha: 'SDM.AbilityCha',
  aur: 'SDM.AbilityAur',
  tho: 'SDM.AbilityTho',
}

SDM.abilitySaveIcons = {
  str: 'fas fa-fist-raised',
  end: 'fas fa-heartbeat', //'fas fa-shield-alt',
  agi: 'fas fa-running',
  cha: 'fas fa-clover', //'fas fa-crown',
  aur: 'fas fa-sparkles',
  tho: 'fas fa-brain',//'fas fa-brain',
};

SDM.defenseIcons = {
  physical: 'fas fa-shield-alt',
  mental: 'fa-brain-circuit',
  social: 'fas fa-crown',
};

SDM.abilityAbbreviations = {
  str: 'SDM.AbilityStrAbbr',
  end: 'SDM.AbilityEndAbbr',
  agi: 'SDM.AbilityAgiAbbr',
  cha: 'SDM.AbilityChaAbbr',
  aur: 'SDM.AbilityAurAbbr',
  tho: 'SDM.AbilityThoAbbr',
};

SDM.sizeUnits = {
  "sacks": "SDM.UnitSacks",
  "stones": "SDM.UnitStones",
  "soaps": "SDM.UnitSoaps",
  "cash": "SDM.UnitCash",
};

SDM.fatigue = 'SDM.Actor.Character.FIELDS.fatigue.label';
SDM.versatile = 'SDM.Item.Features.versatile.label';

SDM.abilitiesOrder = {
  "en": ["str", "end", "agi", "cha", "aur", "tho"],
  "pt-BR": ["cha", "tho", "str", "agi", "aur", "end"],
};

SDM.pullModes = Object.values(PullMode).reduce((acc, pullMode) => {
  acc[pullMode] = `SDM.Item.Mount.PullMode.${pullMode}`;
  return acc;
}, {});

SDM.speedType = Object.values(SpeedType).reduce((acc, speedType) => {
  acc[speedType] = `SDM.SpeedType.${speedType}`;
  return acc;
}, {});

const abilitiesLabel = 'SDM.FieldAbility';

SDM.abilitiesLabel = abilitiesLabel;
SDM.modifierLabel = 'SDM.RollModifier';
SDM.rollTypeLabel = 'SDM.RollType';


SDM.rollType = {
  'normal': 'SDM.RollNormal',
  'advantage': 'SDM.RollAdvantage',
  'disadvantage': 'SDM.RollDisadvantage',
};

SDM.rollSource = {
  'ability': abilitiesLabel,
  'skill': 'SDM.Actor.Character.FIELDS.skills.label',
  'gear': 'TYPES.Item.gear',
  'weapon': 'TYPES.Item.weapon',
  'attack': 'Attack',
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

SDM.characterPropertiesToActiveEffects = [
  "system.initiative_bonus",
  "system.defense_bonus",
  "system.mental_defense_bonus",
  "system.social_defense_bonus",
  "system.ward",
  "system.prestige",
  "system.trait_slots_bonus",
  "system.item_slots_bonus",
  "system.small_item_slots_bonus",
  "system.packed_item_slots_bonus",
  "system.burden_slots_bonus",
  "system.hero_dice.bonus",
  "system.hero_dice.dice_type",
  "system.reaction_bonus",
  "system.save_target",
  "system.life.bonus",
  "system.melee.bonus",
  "system.ranged.bonus",
  "system.oldtech.bonus",
  "system.oldtech.magic_cost",
  "system.fantascience.bonus",
  "system.fantascience.magic_cost",
  "system.abilities.str.bonus",
  "system.abilities.str.save_bonus",
  "system.abilities.end.bonus",
  "system.abilities.end.save_bonus",
  "system.abilities.agi.bonus",
  "system.abilities.agi.save_bonus",
  "system.abilities.cha.bonus",
  "system.abilities.cha.save_bonus",
  "system.abilities.aur.bonus",
  "system.abilities.aur.save_bonus",
  "system.abilities.tho.bonus",
  "system.abilities.tho.save_bonus",
];
