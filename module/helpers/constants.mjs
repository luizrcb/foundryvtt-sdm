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

export const RollType = Object.freeze({
  NORMAL: 'normal',
  ADVANTAGE: 'advantage',
  DISADVANTAGE: 'disadvantage'
});

export const ActorType = Object.freeze({
  CHARACTER: 'character',
  NPC: 'npc',
  CARAVAN: 'caravan',
});

export const AttackType = Object.freeze({
  MELEE: 'melee',
  RANGED: 'ranged',
  FANTASCIENCE: 'fantascience',
  OLDTECH: 'oldtech',
})

export const ItemType = Object.freeze({
  GEAR: 'gear',
  TRAIT: 'trait',
  BURDEN: 'burden',
  MOUNT: 'mount',
  MOTOR: 'motor',
});

export const GearType = Object.freeze({
  GEAR: 'gear',
  WEAPON: 'weapon',
  ARMOR: 'armor',
  SPELL: 'spell',
});

export const TraitType = Object.freeze({
  TRAIT: 'trait',
  SKILL: 'skill',
  SPELL: 'spell',
});

export const ArmorType = Object.freeze({
  SHIELD: 'shield',
  LIGHT: 'light',
  MEDIUM: 'medium',
  HEAVY: 'heavy',
});

export const PullMode = Object.freeze({
  CARTING: 'carting',
  DRAGGING: 'dragging',
  FLYING: 'flying',
});

export const SpeedType = Object.freeze({
  VERY_SLOW: 'very_slow',
  SLOW: 'slow',
  STANDARD: 'standard',
  FAST: 'fast',
  VERY_FAST: 'very_fast',
});

export const Die = Object.freeze({
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
});

export const DieScale = Object.keys(Die);

export const SkillMod = Object.freeze({
  '': 0,
  SKILLED: 3,
  EXPERT: 6,
  MASTER: 9,
});
