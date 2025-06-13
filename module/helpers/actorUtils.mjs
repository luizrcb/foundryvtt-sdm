export const BASE_DEFENSE_VALUE = 10;
export const MAX_ATTRIBUTE_VALUE = 19;
export const MAX_MODIFIER = 13;
export const PHYSICAL_KEYS = ['str', 'end', 'agi'];
export const CHARACTER_DEFAULT_WEIGHT_IN_CASH = 2500;

export const DEFAULT_SKILLS = ['close_combat', 'ranged_combat', 'magic_combat'];

const MIN_LEVEL = 0;
const MAX_CREATURE_LEVEL = 17;

export const UNENCUMBERED_THRESHOLD_CASH = 2500;
export const MAX_CARRY_WEIGHT_CASH = 5000;

export function getLevel(xp = 0) {
  const experience = parseInt(xp, 10);
  const thresholds = [300, 750, 1500, 3000, 6000, 12500, 25000, 50000, 99999];
  const level = thresholds.findIndex(threshold => experience < threshold);
  return level === -1 ? 9 : level;
}

export function getMaxLife(level = MIN_LEVEL) {
  const progressions = [5, 8, 14, 20, 26, 32, 38, 40, 42, 44];
  const maxLevel = progressions.length - 1; // 9

  if (level >= MIN_LEVEL && level <= maxLevel) {
    return progressions[level];
  } else if (level > maxLevel) {
    return progressions[maxLevel]; // Return the max value
  } else {
    return 0; // Handle levels below 0
  }
}

export function getBonus(level = MIN_LEVEL) {
  const thresholds = [1, 5, 9]; // Thresholds where bonus increases
  const index = thresholds.findIndex(threshold => level < threshold);
  return index === -1 ? 4 : index + 1;
}

export function isPhysicalAction(key) {
  return PHYSICAL_KEYS.includes(key);
}

export function isDefaultSkill(skillName) {
  return DEFAULT_SKILLS.includes(skillName);
}

export function getCreatureStatsByLevel(level = MIN_LEVEL) {
  // Data mapping for levels 0-17
  const levelData = [
    { target: 10, life: 4, majorBonus: 2, minorBonus: 0, damage: '1d4' }, // level 0
    { target: 11, life: 8, majorBonus: 3, minorBonus: 1, damage: '1d6' },
    { target: 12, life: 12, majorBonus: 4, minorBonus: 2, damage: '1d8' },
    { target: 12, life: 16, majorBonus: 5, minorBonus: 2, damage: '1d10' },
    { target: 13, life: 22, majorBonus: 6, minorBonus: 3, damage: '1d12' },
    { target: 13, life: 29, majorBonus: 7, minorBonus: 3, damage: '1d8+5' },
    { target: 14, life: 38, majorBonus: 8, minorBonus: 4, damage: '1d10+6' },
    { target: 14, life: 52, majorBonus: 9, minorBonus: 4, damage: '1d12+7' },
    { target: 15, life: 68, majorBonus: 10, minorBonus: 5, damage: '2d8+8' },
    { target: 15, life: 90, majorBonus: 11, minorBonus: 5, damage: '1d20+11' },
    { target: 16, life: 120, majorBonus: 12, minorBonus: 6, damage: '1d20+1d6+12' },
    { target: 16, life: 155, majorBonus: 13, minorBonus: 6, damage: '1d20+1d8+13' },
    { target: 17, life: 195, majorBonus: 14, minorBonus: 7, damage: '1d20+1d10+14' },
    { target: 17, life: 240, majorBonus: 15, minorBonus: 7, damage: '1d20+1d12+15' },
    { target: 18, life: 300, majorBonus: 16, minorBonus: 8, damage: '2d20+16' },
    { target: 18, life: 375, majorBonus: 17, minorBonus: 8, damage: '2d20+1d8+17' },
    { target: 19, life: 500, majorBonus: 18, minorBonus: 9, damage: '2d20+1d12+18' },
    { target: 20, life: 666, majorBonus: 19, minorBonus: 9, damage: '3d20+20' }, // level 17
  ];

  // Validate input level
  if (level < MIN_LEVEL) {
    return levelData[MIN_LEVEL]
  }

  if (level > MAX_CREATURE_LEVEL) {
    return levelData[MAX_CREATURE_LEVEL]
  }

  // Return data for requested level
  return levelData[level];
}

export function getActorOptions(actorType = 'character') {
  const actors =  game.actors.filter((actor) => actor.type === actorType);
  return actors.map((actor) => ({
    id: actor.id,
    name: actor.name,
  }));
}

export function  getCharacterMaxSkills(characterLevel = 0) {
  const progressions = [3, 4, 4, 5, 5, 6, 6, 7, 8, 9, 10];
  const maxLevel = progressions.length - 1; // 9

  if (level >= MIN_LEVEL && level <= maxLevel) {
    return progressions[level];
  }
}
