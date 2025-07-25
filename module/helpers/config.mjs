import { ArmorType, PullMode, SpeedType, WardType } from './constants.mjs';
import { capitalizeFirstLetter } from './globalUtils.mjs';

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
  tho: 'SDM.AbilityTho'
};

SDM.abilityColors = ['rust', 'pumpkin', 'amber', 'sky', 'azure', 'royal'];

SDM.attackColors = {
  melee: 'lime',
  ranged: 'pine',
  fantascience: 'heart',
  oldtech: 'plum'
};

SDM.abilitySaveIcons = {
  str: 'fas fa-fist-raised',
  end: 'fas fa-heartbeat',
  agi: 'fas fa-running',
  cha: 'fas fa-clover',
  aur: 'fas fa-sparkles',
  tho: 'fas fa-brain'
};

SDM.defenseIcons = {
  physical: 'fas fa-shield-alt',
  mental: 'fas fa-brain-circuit',
  social: 'fas fa-crown'
};

SDM.abilityAbbreviations = {
  str: 'SDM.AbilityStrAbbr',
  end: 'SDM.AbilityEndAbbr',
  agi: 'SDM.AbilityAgiAbbr',
  cha: 'SDM.AbilityChaAbbr',
  aur: 'SDM.AbilityAurAbbr',
  tho: 'SDM.AbilityThoAbbr'
};

SDM.sizeUnits = {
  sacks: 'SDM.UnitSacks',
  stones: 'SDM.UnitStones',
  soaps: 'SDM.UnitSoaps',
  cash: 'SDM.UnitCash'
};

SDM.fatigue = 'SDM.Actor.Character.FIELDS.fatigue.label';
SDM.versatile = 'SDM.FeatureVersatile';

SDM.abilitiesOrder = {
  en: ['str', 'end', 'agi', 'cha', 'aur', 'tho'],
  //'pt-BR': ['str', 'end', 'agi', 'cha', 'aur', 'tho']
  'pt-BR': ['cha', 'tho', 'str', 'agi', 'aur', 'end']
};

function getOrderedAbilities(language = 'en') {
  let lang = Object.keys(SDM.abilitiesOrder).includes(language) ? language : 'en';
  const reorderedAbilities = {};
  SDM.abilitiesOrder[lang].forEach(abilityKey => {
    reorderedAbilities[abilityKey] = SDM.abilities[abilityKey];
  });
  return reorderedAbilities;
}

SDM.getOrderedAbilities = getOrderedAbilities;

SDM.pullModes = Object.values(PullMode).reduce((acc, pullMode) => {
  acc[pullMode] = `SDM.PullMode${capitalizeFirstLetter(pullMode)}`;
  return acc;
}, {});

SDM.speedType = Object.values(SpeedType).reduce((acc, speedType) => {
  acc[speedType] = `SDM.Speed${capitalizeFirstLetter(speedType)}`;
  return acc;
}, {});

const abilitiesLabel = 'SDM.Ability';

SDM.abilitiesLabel = abilitiesLabel;
SDM.modifierLabel = 'SDM.RollModifier';
SDM.rollTypeLabel = 'SDM.RollMode';

SDM.rollMode = {
  disadvantage: 'SDM.RollDisadvantage',
  normal: 'SDM.RollNormal',
  advantage: 'SDM.RollAdvantage'
};

SDM.attackTarget = {
  physical: 'SDM.AttackPhysical',
  mental: 'SDM.AttackMental',
  social: 'SDM.AttackSocial'
};

SDM.rollSource = {
  ability: abilitiesLabel,
  skill: 'SDM.Actor.Character.FIELDS.skills.label',
  gear: 'TYPES.Item.gear',
  weapon: 'TYPES.Item.weapon',
  attack: 'Attack'
};

SDM.damageMultiplier = {
  '*2': 'x2',
  '*4': 'x4',
  '*8': 'x8',
  '*16': 'x16',
  '*32': 'x32'
};

SDM.speedValues = {
  very_very_slow: -3,
  very_slow: -2,
  slow: -1,
  standard: 0,
  fast: 1,
  very_fast: 2
};

SDM.reverseSpeedValues = {
  '-3': 'very_very_slow',
  '-2': 'very_slow',
  '-1': 'slow',
  0: 'standard',
  1: 'fast',
  2: 'very_fast'
};

SDM.characterPropertiesToActiveEffects = [
  'system.initiative_bonus',
  'system.armor_bonus',
  'system.defense_bonus',
  'system.mental_defense_bonus',
  'system.social_defense_bonus',
  'system.ward_bonus',
  'system.prestige',
  'system.trait_slots_bonus',
  'system.item_slots_bonus',
  'system.small_item_slots_bonus',
  'system.packed_item_slots_bonus',
  'system.burden_slots_bonus',
  'system.power_slots_bonus',
  'system.hero_dice.bonus',
  'system.hero_dice.dice_type',
  'system.reaction_bonus',
  'system.all_save_bonus',
  'system.life.bonus',
  'system.attack_bonus',
  'system.melee.bonus',
  'system.ranged.bonus',
  'system.oldtech.bonus',
  'system.fantascience.bonus',
  'system.power_cost',
  'system.abilities.str.bonus',
  'system.abilities.str.save_bonus',
  'system.abilities.end.bonus',
  'system.abilities.end.save_bonus',
  'system.abilities.agi.bonus',
  'system.abilities.agi.save_bonus',
  'system.abilities.cha.bonus',
  'system.abilities.cha.save_bonus',
  'system.abilities.aur.bonus',
  'system.abilities.aur.save_bonus',
  'system.abilities.tho.bonus',
  'system.abilities.tho.save_bonus'
];

SDM.itemType = {
  gear: 'TYPES.Item.gear',
  trait: 'TYPES.Item.trait',
  burden: 'TYPES.Item.burden'
};

SDM.gearType = {
  armor: 'TYPES.Item.armor',
  power: 'TYPES.Item.power',
  // power_container: 'TYPES.Item.power_container',
  ward: 'TYPES.Item.ward',
  weapon: 'TYPES.Item.weapon'
};

SDM.traitType = {
  power: 'TYPES.Item.power',
  skill: 'TYPES.Item.skill'
};

SDM.burdenType = {
  '': 'TYPE.Burden',
  ...SDM.gearType,
  ...SDM.traitType
};

SDM.rangeType = {
  melee: 'SDM.RangeMelee',
  short: 'SDM.RangeShort',
  long: 'SDM.RangeLong',
  extreme: 'SDM.RangeExtreme'
};

SDM.skillMod = {
  1: 'SDM.SkillSkilled',
  2: 'SDM.SkillExpert',
  3: 'SDM.SkillMaster'
};

SDM.armorType = Object.values(ArmorType).reduce((acc, armorType) => {
  acc[armorType] = `SDM.ArmorType${capitalizeFirstLetter(armorType)}`;
  return acc;
}, {});

SDM.wardType = Object.values(WardType).reduce((acc, wardType) => {
  acc[wardType] = `SDM.WardType${capitalizeFirstLetter(wardType)}`;
  return acc;
}, {});
