export const DocumentType = Object.freeze({
  ITEM: 'Item',
  ACTOR: 'Actor'
});

export const RangeOption = Object.freeze({
  MELEE: 'melee',
  SHORT: 'short',
  LONG: 'long',
  EXTREME: 'extreme'
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

export const ItemType = Object.freeze({
  GEAR: 'gear',
  TRAIT: 'trait',
  BURDEN: 'burden',
  MOUNT: 'mount',
  MOTOR: 'motor'
});

export const GearType = Object.freeze({
  WEAPON: 'weapon',
  ARMOR: 'armor',
  POWER: 'power',
  POWER_CONTAINER: 'power_container',
  WARD: 'ward'
});

export const TraitType = Object.freeze({
  SKILL: 'skill',
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
  VERY_SLOW: 'very_slow',
  SLOW: 'slow',
  STANDARD: 'standard',
  FAST: 'fast',
  VERY_FAST: 'very_fast'
});

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
  MASTER: 3
});
