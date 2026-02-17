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

SDM.diceThemeOptions = {
  'sdm-aqua': 'SDM.ColorAqua',
  'sdm-black': 'SDM.ColorBlack',
  'sdm-blue': 'SDM.ColorBlue',
  'sdm-brown': 'SDM.ColorBrown',
  'sdm-chomatype': 'SDM.DSNChromatypeSame',
  'sdm-cool': 'SDM.DiceTheme.Cool',
  'sdm-crimson': 'SDM.ColorCrimson',
  'sdm-dark': 'SDM.DiceTheme.Dark',
  'sdm-electricBlue': 'SDM.ColorElectricBlue',
  'sdm-emerald': 'SDM.ColorEmerald',
  'sdm-gold': 'SDM.ColorGold',
  'sdm-green': 'SDM.ColorGreen',
  'sdm-hero': 'SDM.HeroDiceDefaultStyle',
  'sdm-ice': 'SDM.ColorIce',
  'sdm-light': 'SDM.DiceTheme.Light',
  'sdm-lime': 'SDM.ColorLime',
  'sdm-luxury': 'SDM.DiceTheme.Luxury',
  'sdm-mint': 'SDM.ColorMint',
  'sdm-neon': 'SDM.DiceTheme.Neon',
  'sdm-neonPurple': 'SDM.ColorNeonPurple',
  'sdm-neonRose': 'SDM.ColorNeonRose',
  'sdm-neonYellow': 'SDM.ColorNeonYellow',
  'sdm-olive': 'SDM.ColorOlive',
  'sdm-oracle': 'SDM.OracleDiceDefaultStyle',
  'sdm-orange': 'SDM.ColorOrange',
  'sdm-pink': 'SDM.ColorPink',
  'sdm-purple': 'SDM.ColorPurple',
  'sdm-rainbowlands': 'SDM.DiceTheme.Rainbowlands',
  'sdm-red': 'SDM.ColorRed',
  'sdm-romantic': 'SDM.DiceTheme.Romantic',
  'sdm-roseGold': 'SDM.ColorRoseGold',
  'sdm-silver': 'SDM.ColorSilver',
  'sdm-sky': 'SDM.ColorSky',
  'sdm-tangerine': 'SDM.ColorTangerine',
  'sdm-teal': 'SDM.ColorTeal',
  'sdm-ultraviolet': 'SDM.ColorUltraviolet',
  'sdm-violet': 'SDM.ColorViolet',
  'sdm-warm': 'SDM.DiceTheme.Warm',
  'sdm-white': 'SDM.ColorWhite',
  'sdm-yellow': 'SDM.ColorYellow'
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
  'system.pet_slots_bonus',
  'system.augment_slots_bonus',
  'system.affliction_slots_bonus',
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
  'system.melee.roll_mode',
  'system.ranged.bonus',
  'system.ranged.roll_mode',
  'system.oldtech.bonus',
  'system.oldtech.roll_mode',
  'system.fantascience.bonus',
  'system.fantascience.roll_mode',
  'system.power_cost',
  'system.power_cost_bonus',
  'system.abilities.str.bonus',
  'system.abilities.str.roll_bonus',
  'system.abilities.str.save_bonus',
  'system.abilities.str.roll_mode',
  'system.abilities.end.bonus',
  'system.abilities.end.roll_bonus',
  'system.abilities.end.save_bonus',
  'system.abilities.end.roll_mode',
  'system.abilities.agi.bonus',
  'system.abilities.agi.roll_bonus',
  'system.abilities.agi.save_bonus',
  'system.abilities.agi.roll_mode',
  'system.abilities.cha.bonus',
  'system.abilities.cha.roll_bonus',
  'system.abilities.cha.save_bonus',
  'system.abilities.cha.roll_mode',
  'system.abilities.aur.bonus',
  'system.abilities.aur.roll_bonus',
  'system.abilities.aur.save_bonus',
  'system.abilities.aur.roll_mode',
  'system.abilities.tho.bonus',
  'system.abilities.tho.roll_bonus',
  'system.abilities.tho.save_bonus',
  'system.abilities.tho.roll_mode',
  'system.capacity',
  'system.speed'
];

SDM.itemType = {
  gear: 'TYPES.Item.gear',
  trait: 'TYPES.Item.trait',
  burden: 'TYPES.Item.burden'
};

SDM.gearType = {
  affliction: 'TYPES.Item.affliction',
  armor: 'TYPES.Item.armor',
  augment: 'TYPES.Item.augment',
  corruption: 'TYPES.Item.corruption',
  pet: 'TYPES.Item.pet',
  power_album: 'TYPES.Item.power_album',
  power: 'TYPES.Item.power',
  ward: 'TYPES.Item.ward',
  weapon: 'TYPES.Item.weapon'
};

SDM.traitType = {
  affliction: 'TYPES.Item.affliction',
  augment: 'TYPES.Item.augment',
  corruption: 'TYPES.Item.corruption',
  pet: 'TYPES.Item.pet',
  power: 'TYPES.Item.power',
  skill: 'TYPES.Item.skill'
};

SDM.burdenType = {
  '': 'TYPE.Burden',
  affliction: 'TYPES.Item.affliction'
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
  undead: 'SDM.SupplyTypeUndead'
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

SDM.months = {
  1: 'SDM.MonthTrucking.1',
  2: 'SDM.MonthTrucking.2',
  3: 'SDM.MonthTrucking.3',
  4: 'SDM.MonthTrucking.4',
  5: 'SDM.MonthTrucking.5',
  6: 'SDM.MonthTrucking.6',
  7: 'SDM.MonthTrucking.7',
  8: 'SDM.MonthTrucking.8',
  9: 'SDM.MonthTrucking.9',
  10: 'SDM.MonthTrucking.10',
  11: 'SDM.MonthTrucking.11',
  12: 'SDM.MonthTrucking.12'
};

SDM.defeatAbilities = {
  end: 'SDM.DefeatAbilityEndurance',
  aur: 'SDM.DefeatAbilityAura'
};

SDM.baseFeatures = [
  {
    value: 'charges',
    label: 'SDM.ItemFeature.charges',
  },
  {
    value: 'replenish',
    label: 'SDM.ItemFeature.replenish',
  }
];

SDM.wardFeatures = [
  { value: 'album', label: 'SDM.ItemFeature.album' },
  { value: 'antimagic', label: 'SDM.ItemFeature.antimagic' },
  { value: 'armor', label: 'SDM.ItemFeature.armor' },
  { value: 'auto', label: 'SDM.ItemFeature.auto' },
  { value: 'booster', label: 'SDM.ItemFeature.booster' },
  { value: 'corpsefed', label: 'SDM.ItemFeature.corpsefed' },
  { value: 'cramping', label: 'SDM.ItemFeature.cramping' },
  { value: 'deathlike', label: 'SDM.ItemFeature.deathlike' },
  { value: 'emplaced', label: 'SDM.ItemFeature.emplaced' },
  { value: 'heretical', label: 'SDM.ItemFeature.heretical' },
  { value: 'implant', label: 'SDM.ItemFeature.implant' },
  { value: 'jade', label: 'SDM.ItemFeature.jade' },
  { value: 'limited_land', label: 'SDM.ItemFeature.limited_land' },
  { value: 'spell_eater', label: 'SDM.ItemFeature.spell_eater' },
  { value: 'scary', label: 'SDM.ItemFeature.scary' },
  { value: 'stealthy', label: 'SDM.ItemFeature.stealthy' },
  { value: 'undreaming', label: 'SDM.ItemFeature.undreaming' },
  { value: 'vessel', label: 'SDM.ItemFeature.vessel' },
  { value: 'watchful', label: 'SDM.ItemFeature.watchful' },
  { value: 'weapon', label: 'SDM.ItemFeature.weapon' }
];

SDM.armorFeatures = [
  { value: 'bulky', label: 'SDM.ItemFeature.bulky' },
  { value: 'large', label: 'SDM.ItemFeature.large' },
  { value: 'bulletproof', label: 'SDM.ItemFeature.bulletproof' },
  { value: 'burn', label: 'SDM.ItemFeature.burn' },
  { value: 'living', label: 'SDM.ItemFeature.living' },
  { value: 'camolion', label: 'SDM.ItemFeature.camolion' },
  { value: 'lucent', label: 'SDM.ItemFeature.lucent' },
  { value: 'cool', label: 'SDM.ItemFeature.cool' },
  { value: 'mirror', label: 'SDM.ItemFeature.mirror' },
  { value: 'oldtech', label: 'SDM.ItemFeature.oldtech' },
  { value: 'environmental', label: 'SDM.ItemFeature.environmental' },
  { value: 'pocket', label: 'SDM.ItemFeature.pocket' },
  { value: 'powered', label: 'SDM.ItemFeature.powered' },
  { value: 'flare', label: 'SDM.ItemFeature.flare' },
  { value: 'hot', label: 'SDM.ItemFeature.hot' },
  { value: 'sunder', label: 'SDM.ItemFeature.sunder' },
  { value: 'interfacing', label: 'SDM.ItemFeature.interfacing' },
  { value: 'spiked', label: 'SDM.ItemFeature.spiked' },
  { value: 'stylish', label: 'SDM.ItemFeature.stylish' },
  { value: 'intravenous', label: 'SDM.ItemFeature.intravenous' },
  { value: 'weapon', label: 'SDM.ItemFeature.weapon' }
];

SDM.weaponFeatures = [
  { value: 'armor_piercing', label: 'SDM.ItemFeature.armor_piercing' },
  { value: 'atrophy', label: 'SDM.ItemFeature.atrophy' },
  { value: 'attune', label: 'SDM.ItemFeature.attune' },
  { value: 'backfiring', label: 'SDM.ItemFeature.backfiring' },
  { value: 'blinding', label: 'SDM.ItemFeature.blinding' },
  { value: 'burdening', label: 'SDM.ItemFeature.burdening' },
  { value: 'cavalry', label: 'SDM.ItemFeature.cavalry' },
  { value: 'confusing', label: 'SDM.ItemFeature.confusing' },
  { value: 'burst', label: 'SDM.ItemFeature.burst' },
  { value: 'clumsy', label: 'SDM.ItemFeature.clumsy' },
  { value: 'concealed', label: 'SDM.ItemFeature.concealed' },
  { value: 'corrupting', label: 'SDM.ItemFeature.corrupting' },
  { value: 'deathly', label: 'SDM.ItemFeature.deathly' },
  { value: 'entangling', label: 'SDM.ItemFeature.entangling' },
  { value: 'fantascience', label: 'SDM.ItemFeature.fantascience' },
  { value: 'fearsome', label: 'SDM.ItemFeature.fearsome' },
  { value: 'frag', label: 'SDM.ItemFeature.frag' },
  { value: 'glowing', label: 'SDM.ItemFeature.glowing' },
  { value: 'hands_free', label: 'SDM.ItemFeature.hands_free' },
  { value: 'heat', label: 'SDM.ItemFeature.heat' },
  { value: 'intravenous', label: 'SDM.ItemFeature.intravenous' },
  { value: 'mad', label: 'SDM.ItemFeature.mad' },
  { value: 'mercy', label: 'SDM.ItemFeature.mercy' },
  { value: 'necrotic', label: 'SDM.ItemFeature.necrotic' },
  { value: 'oldtech', label: 'SDM.ItemFeature.oldtech' },
  { value: 'petrifying', label: 'SDM.ItemFeature.petrifying' },
  { value: 'psychic', label: 'SDM.ItemFeature.psychic' },
  { value: 'radiant', label: 'SDM.ItemFeature.radiant' },
  { value: 'reach', label: 'SDM.ItemFeature.reach' },
  { value: 'restricted', label: 'SDM.ItemFeature.restricted' },
  { value: 'semi_sentient', label: 'SDM.ItemFeature.semi_sentient' },
  { value: 'silent', label: 'SDM.ItemFeature.silent' },
  { value: 'slow', label: 'SDM.ItemFeature.slow' },
  { value: 'slumber', label: 'SDM.ItemFeature.slumber' },
  { value: 'subdual', label: 'SDM.ItemFeature.subdual' },
  { value: 'throwing', label: 'SDM.ItemFeature.throwing' },
  { value: 'two_handed', label: 'SDM.ItemFeature.two_handed' },
  { value: 'versatile', label: 'SDM.ItemFeature.versatile' },
  { value: 'vital', label: 'SDM.ItemFeature.vital' },
  { value: 'vorpal', label: 'SDM.ItemFeature.vorpal' }
];
