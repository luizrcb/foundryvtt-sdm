export const DocumentType = Object.freeze({
  ITEM: 'Item',
  ACTOR: 'Actor'
});

export const RangeOption = Object.freeze({
  CLOSE: 'close',
  SHORT: 'short',
  MEDIUM: 'medium',
  LONG: 'long'
});

export const SizeUnit = Object.freeze({
  SACKS: 'sacks',
  STONES: 'stones',
  SOAPS: 'soaps',
  CASH: 'cash'
});

export const RollMode = Object.freeze({
  NORMAL: 'normal',
  ADVANTAGE: 'advantage',
  DISADVANTAGE: 'disadvantage'
});

export const RollType = Object.freeze({
  ABILITY: 'ability',
  ATTACK: 'attack',
  DAMAGE: 'damage',
  POWER: 'power',
  POWER_ALBUM: 'power_album',
  SAVE: 'save'
});

export const ActorType = Object.freeze({
  CHARACTER: 'character',
  NPC: 'npc',
  CARAVAN: 'caravan'
});

export const AttackType = Object.freeze({
  MELEE: 'melee',
  RANGED: 'ranged',
  FANTASCIENCE: 'fantascience',
  OLDTECH: 'oldtech'
});

export const AttackTarget = Object.freeze({
  PHYSICAL: 'physical',
  MENTAL: 'mental',
  SOCIAL: 'social'
});

export const ItemType = Object.freeze({
  GEAR: 'gear',
  TRAIT: 'trait',
  BURDEN: 'burden'
});

export const GearType = Object.freeze({
  AFFLICTION: 'affliction',
  ARMOR: 'armor',
  AUGMENT: 'augment',
  CONTAINER: 'container',
  CORRUPTION: 'corruption',
  PET: 'pet',
  POWER_ALBUM: 'power_album',
  POWER: 'power',
  WARD: 'ward',
  WEAPON: 'weapon'
});

export const FrequencyType = Object.freeze({
  DAY: 'day',
  WEEK: 'week'
});

export const ItemStatusType = Object.freeze({
  NOTCHED: 'notched',
  BROKEN: 'broken'
});

export const TraitType = Object.freeze({
  AFFLICTION: 'affliction',
  AUGMENT: 'augment',
  CORRUPTION: 'corruption',
  SKILL: 'skill',
  PET: 'pet',
  POWER: 'power'
});

export const ArmorType = Object.freeze({
  SMALL: 'small',
  LIGHT: 'light',
  MEDIUM: 'medium',
  HEAVY: 'heavy',
  GOLEM: 'golem'
});

export const WardType = Object.freeze({
  TRINKET: 'trinket',
  WEARABLE: 'wearable',
  PORTABLE: 'portable',
  BULKY: 'bulky'
});

export const PullMode = Object.freeze({
  CARTING: 'carting',
  DRAGGING: 'dragging',
  FLYING: 'flying'
});

export const SpeedType = Object.freeze({
  VERY_VERY_SLOW: 'very_very_slow',
  VERY_SLOW: 'very_slow',
  SLOW: 'slow',
  STANDARD: 'standard',
  FAST: 'fast',
  VERY_FAST: 'very_fast'
});

export const SpeedValues = new Map();
SpeedValues.set('VeryVerySlow', -3);
SpeedValues.set('VerySlow', -2);
SpeedValues.set('Slow', -1);
SpeedValues.set('Standard', 0);
SpeedValues.set('Fast', 1);
SpeedValues.set('VeryFast', 2);

export const DiceType = Object.freeze({
  d4: 'd4',
  d6: 'd6',
  d8: 'd8',
  d10: 'd10',
  d12: 'd12',
  d20: 'd20'
});

export const Die = Object.freeze({
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20
});

export const DieScale = Object.values(DiceType);

export const SkillMod = Object.freeze({
  '': 0,
  SKILLED: 1,
  EXPERT: 2,
  MASTER: 3,
  PHYLAKE: 4,
  BUILDER: 5
});

export const DEFAULT_CHARACTER_ICON = 'icons/svg/mystery-man.svg';
export const DEFAULT_NPC_ICON = 'icons/svg/mystery-man-black.svg';
export const DEFAULT_CARAVAN_ICON = 'icons/svg/target.svg';

export const DEFAULT_ARMOR_ICON = 'icons/svg/shield.svg';
export const DEFAULT_BURDEN_ICON = 'icons/svg/stoned.svg';
export const DEFAULT_CASH_ICON = 'icons/commodities/currency/coins-stitched-pouch-brown.webp';
export const DEFAULT_CORRUPTION_ICON = 'icons/svg/biohazard.svg';
export const DEFAULT_GEAR_ICON = 'icons/svg/item-bag.svg';
export const DEFAULT_POWER_ALBUM_ICON = 'icons/svg/book.svg';
export const DEFAULT_POWER_ICON = 'icons/svg/fire.svg';
export const DEFAULT_SKILL_ICON = 'icons/svg/jump.svg';
export const DEFAULT_TRAIT_ICON = 'icons/svg/walk.svg';
export const DEFAULT_WARD_ICON = 'icons/svg/eye.svg';
export const DEFAULT_WEAPON_ICON = 'icons/svg/sword.svg';
export const DEFAULT_PET_ICON = 'icons/svg/pawprint.svg';
export const DEFAULT_AFFLICTION_ICON = 'icons/svg/stoned.svg';
export const DEFAULT_AUGMENT_ICON = 'icons/svg/upgrade.svg';
export const DEFAULT_CONTAINER_ICON = 'icons/svg/chest.svg';

export const GEAR_ICONS = [
  DEFAULT_GEAR_ICON,
  DEFAULT_ARMOR_ICON,
  DEFAULT_CORRUPTION_ICON,
  DEFAULT_POWER_ALBUM_ICON,
  DEFAULT_POWER_ICON,
  DEFAULT_WARD_ICON,
  DEFAULT_WEAPON_ICON,
  DEFAULT_AFFLICTION_ICON,
  DEFAULT_AUGMENT_ICON,
  DEFAULT_PET_ICON,
  DEFAULT_CONTAINER_ICON
];

export const TRAIT_ICONS = [
  DEFAULT_TRAIT_ICON,
  DEFAULT_SKILL_ICON,
  DEFAULT_POWER_ICON,
  DEFAULT_CORRUPTION_ICON,
  DEFAULT_AFFLICTION_ICON,
  DEFAULT_AUGMENT_ICON,
  DEFAULT_PET_ICON
];

export const BURDEN_ICONS = [DEFAULT_BURDEN_ICON, DEFAULT_AFFLICTION_ICON, DEFAULT_POWER_ICON];
