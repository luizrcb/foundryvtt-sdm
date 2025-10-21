import { ArmorType, PullMode, WardType } from './constants.mjs';
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
  str: 'fa-solid fa-hand-fist',
  end: 'fa-solid fa-heartbeat',
  agi: 'fa-solid fa-person-running',
  cha: 'fa-solid fa-clover',
  aur: 'fa-solid fa-splotch',
  tho: 'fa-solid fa-cloud'
};

SDM.defenseIcons = {
  physical: 'fa-solid fa-shield-halved',
  mental: 'fa-solid fa-brain',
  social: 'fa-solid fa-crown'
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

SDM.frequency = {
  day: 'SDM.FrequencyDay',
  week: 'SDM.FrequencyWeek'
};

SDM.itemStatus = {
  notched: 'SDM.ItemStatusNotched',
  broken: 'SDM.ItemStatusBroken'
};

SDM.itemResources = {
  running_low: 'SDM.ItemResourcesRunningLow',
  run_out: 'SDM.ItemResourcesRunOut'
};

SDM.accentColorOptions = {
  aqua: 'SDM.ColorAqua',
  black: 'SDM.ColorBlack',
  blue: 'SDM.ColorBlue',
  brown: 'SDM.ColorBrown',
  crimson: 'SDM.ColorCrimson',
  electricBlue: 'SDM.ColorElectricBlue',
  emerald: 'SDM.ColorEmerald',
  gold: 'SDM.ColorGold',
  green: 'SDM.ColorGreen',
  ice: 'SDM.ColorIce',
  lime: 'SDM.ColorLime',
  mint: 'SDM.ColorMint',
  neonPurple: 'SDM.ColorNeonPurple',
  neonRose: 'SDM.ColorNeonRose',
  neonYellow: 'SDM.ColorNeonYellow',
  olive: 'SDM.ColorOlive',
  orange: 'SDM.ColorOrange',
  pink: 'SDM.ColorPink',
  purple: 'SDM.ColorPurple',
  red: 'SDM.ColorRed',
  roseGold: 'SDM.ColorRoseGold',
  silver: 'SDM.ColorSilver',
  sky: 'SDM.ColorSky',
  tangerine: 'SDM.ColorTangerine',
  teal: 'SDM.ColorTeal',
  ultraviolet: 'SDM.ColorUltraviolet',
  violet: 'SDM.ColorViolet',
  white: 'SDM.ColorWhite',
  yellow: 'SDM.ColorYellow'
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

SDM.getDamageMultiplier = function generateDamageMultiplier(base = 2, ranks = 5) {
  const sequence = [];
  const multiplierObject = {};

  // Gerar sequência de multiplicadores
  for (let i = 0; i < ranks; i++) {
    const value = base * Math.pow(2, i); // base * 2^i
    sequence.push(value);
    multiplierObject[`*${value}`] = `x${value}`;
  }

  return multiplierObject;
};

SDM.speedOptions = {
  'SDM.SpeedVeryVerySlow': -3,
  'SDM.SpeedVerySlow': -2,
  'SDM.SpeedSlow': -1,
  'SDM.SpeedStandard': 0,
  'SDM.SpeedFast': 1,
  'SDM.SpeedVeryFast': 2
};

SDM.reverseSpeedValues = {
  '-3': 'SDM.SpeedVeryVerySlow',
  '-2': 'SDM.SpeedVerySlow',
  '-1': 'SDM.SpeedSlow',
  0: 'SDM.SpeedStandard',
  1: 'SDM.SpeedFast',
  2: 'SDM.SpeedVeryFast'
};

function getSpeedFromValue(speedValue = 0) {
  const constrained = Math.clamp(speedValue, -3, 2);
  return SDM.reverseSpeedValues[`${constrained}`];
}

SDM.characterPropertiesToActiveEffects = [
  'system.initiative_bonus',
  'system.armor_bonus',
  'system.readied_armor_take_no_slots',
  'system.defense_bonus',
  'system.mental_defense_bonus',
  'system.social_defense_bonus',
  'system.ward_bonus',
  'system.prestige',
  'system.trait_slots_bonus',
  'system.item_slots_bonus',
  'system.small_item_slots_bonus',
  'system.weapon_item_slots_bonus',
  'system.base_damage_multiplier',
  'system.damage_bonus',
  'system.packed_item_slots_bonus',
  'system.readied_item_slots_bonus',
  'system.burden_slots_bonus',
  'system.burden_penalty_bonus',
  'system.power_slots_bonus',
  'system.hero_dice.bonus',
  'system.hero_dice.dice_type',
  'system.tourist_dice.enabled',
  'system.tourist_dice.max',
  'system.tourist_dice.bonus',
  'system.tourist_dice.dice_type',
  'system.blood_dice.enabled',
  'system.blood_dice.bonus',
  'system.blood_dice.dice_type',
  'system.reaction_bonus',
  'system.all_save_bonus',
  'system.borrowed_life.enabled',
  'system.borrowed_life.max_limit',
  'system.temporary_life.max',
  'system.temporary_life.enabled',
  'system.life.bonus',
  'system.attack_bonus',
  'system.melee.bonus',
  'system.ranged.bonus',
  'system.oldtech.bonus',
  'system.fantascience.bonus',
  'system.power_cost',
  'system.power_cost_bonus',
  'system.abilities.str.bonus',
  'system.abilities.str.roll_bonus',
  'system.abilities.str.save_bonus',
  'system.abilities.end.bonus',
  'system.abilities.end.roll_bonus',
  'system.abilities.end.save_bonus',
  'system.abilities.agi.bonus',
  'system.abilities.agi.roll_bonus',
  'system.abilities.agi.save_bonus',
  'system.abilities.cha.bonus',
  'system.abilities.cha.roll_bonus',
  'system.abilities.cha.save_bonus',
  'system.abilities.aur.bonus',
  'system.abilities.aur.roll_bonus',
  'system.abilities.aur.save_bonus',
  'system.abilities.tho.bonus',
  'system.abilities.tho.roll_bonus',
  'system.abilities.tho.save_bonus',
  'system.capacity',
  'system.speed'
];

SDM.itemType = {
  gear: 'TYPES.Item.gear',
  trait: 'TYPES.Item.trait',
  burden: 'TYPES.Item.burden'
};

SDM.gearType = {
  armor: 'TYPES.Item.armor',
  power: 'TYPES.Item.power',
  power_album: 'TYPES.Item.power_album',
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
  close: 'SDM.RangeClose',
  short: 'SDM.RangeShort',
  medium: 'SDM.RangeMedium',
  long: 'SDM.RangeLong'
};

SDM.SupplyType = {
  animal: 'SDM.SupplyTypeAnimal',
  human: 'SDM.SupplyTypeHuman',
  machine: 'SDM.SupplyTypeMachine',
  undead: 'SDM.SupplyTypeUndead',
};

SDM.skillMod = {
  1: 'SDM.SkillSkilled',
  2: 'SDM.SkillExpert',
  3: 'SDM.SkillMaster'
};

SDM.extraSkillMod = {
  4: 'SDM.SkillPhylake',
  5: 'SDM.SkillBuilder'
};

SDM.armorType = Object.values(ArmorType).reduce((acc, armorType) => {
  acc[armorType] = `SDM.ArmorType${capitalizeFirstLetter(armorType)}`;
  return acc;
}, {});

SDM.wardType = Object.values(WardType).reduce((acc, wardType) => {
  acc[wardType] = `SDM.WardType${capitalizeFirstLetter(wardType)}`;
  return acc;
}, {});
