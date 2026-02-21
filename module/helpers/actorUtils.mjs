import { SdmItem } from '../documents/item.mjs';
import { ActorType } from './constants.mjs';
import { templatePath } from './templates.mjs';
const { renderTemplate } = foundry.applications.handlebars;

export const BASE_DEFENSE_VALUE = 7;
export const MAX_ATTRIBUTE_VALUE = 19;
export const MAX_MODIFIER = 13;
export const PHYSICAL_KEYS = ['str', 'end', 'agi'];
export const CHARACTER_DEFAULT_WEIGHT_IN_CASH = 2500;

export const ATTACKS = ['melee', 'ranged', 'oldtech', 'fantascience'];

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
  const maxLife = (level + 1) * 4;
  return maxLife;
}

export function isPhysicalAction(key) {
  return PHYSICAL_KEYS.includes(key);
}

export function isAttack(attackName) {
  return ATTACKS.includes(attackName);
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
    { target: 20, life: 666, majorBonus: 19, minorBonus: 9, damage: '3d20+20' } // level 17
  ];

  // Validate input level
  if (level < MIN_LEVEL) {
    return levelData[MIN_LEVEL];
  }

  if (level > MAX_CREATURE_LEVEL) {
    return levelData[MAX_CREATURE_LEVEL];
  }

  // Return data for requested level
  return levelData[level];
}

export function getActorOptions(actorType = ActorType.CHARACTER) {
  const actors = game.actors.filter(actor => actor.type === actorType);
  return actors.map(actor => ({
    id: actor.uuid,
    name: actor.name
  }));
}

const PET_TABLE = [
  { level: 0, defense: 10, life: 4, bonus: 2, morale: 3, damage: '1d4' }, // level 0
  { level: 1, defense: 11, life: 8, bonus: 3, morale: 4, damage: '1d6' },
  { level: 2, defense: 12, life: 12, bonus: 4, morale: 5, damage: '1d8' },
  { level: 3, defense: 12, life: 16, bonus: 5, morale: 6, damage: '1d10' },
  { level: 4, defense: 13, life: 20, bonus: 6, morale: 6, damage: '1d12' },
  { level: 5, defense: 13, life: 24, bonus: 7, morale: 7, damage: '1d8+5' },
  { level: 6, defense: 14, life: 28, bonus: 8, morale: 7, damage: '1d10+6' },
  { level: 7, defense: 14, life: 32, bonus: 9, morale: 8, damage: '1d12+7' },
  { level: 8, defense: 15, life: 36, bonus: 10, morale: 8, damage: '2d8+8' },
  { level: 9, defense: 15, life: 40, bonus: 11, morale: 9, damage: '1d20+11' }
];

const NPCTables = {
  'generic-synthesized-creature': {
    table: [
      { range: [1, 10], Lvl: 0, Life: 4, Mor: 3, Def: 10, Bon: 2, Dmg: '1d4' },
      { range: [11, 20], Lvl: 1, Life: 8, Mor: 4, Def: 11, Bon: 3, Dmg: '1d6' },
      { range: [21, 30], Lvl: 2, Life: 12, Mor: 5, Def: 12, Bon: 4, Dmg: '1d8' },
      { range: [31, 39], Lvl: 3, Life: 16, Mor: 6, Def: 12, Bon: 5, Dmg: '1d10' },
      { range: [40, 48], Lvl: 4, Life: 22, Mor: 6, Def: 13, Bon: 6, Dmg: '1d12' },
      { range: [49, 56], Lvl: 5, Life: 29, Mor: 7, Def: 13, Bon: 7, Dmg: '1d8+5' },
      { range: [57, 64], Lvl: 6, Life: 38, Mor: 7, Def: 14, Bon: 8, Dmg: '1d10+6' },
      { range: [65, 70], Lvl: 7, Life: 52, Mor: 8, Def: 14, Bon: 9, Dmg: '1d12+7' },
      { range: [71, 76], Lvl: 8, Life: 68, Mor: 8, Def: 15, Bon: 10, Dmg: '2d8+8' },
      { range: [77, 82], Lvl: 9, Life: 90, Mor: 8, Def: 15, Bon: 11, Dmg: '1d20+11' },
      { range: [83, 87], Lvl: 10, Life: 120, Mor: 9, Def: 16, Bon: 12, Dmg: '1d20+1d6+12' },
      { range: [88, 91], Lvl: 11, Life: 155, Mor: 9, Def: 16, Bon: 13, Dmg: '1d20+1d8+13' },
      { range: [92, 94], Lvl: 12, Life: 195, Mor: 9, Def: 17, Bon: 14, Dmg: '1d20+1d10+14' },
      { range: [95, 96], Lvl: 13, Life: 240, Mor: 10, Def: 17, Bon: 15, Dmg: '1d20+1d12+15' },
      { range: [97, 97], Lvl: 14, Life: 300, Mor: 10, Def: 18, Bon: 16, Dmg: '2d20+16' },
      { range: [98, 98], Lvl: 15, Life: 375, Mor: 10, Def: 18, Bon: 17, Dmg: '2d20+1d8+17' },
      { range: [99, 99], Lvl: 16, Life: 500, Mor: 10, Def: 19, Bon: 18, Dmg: '2d20+1d12+18' },
      { range: [100, 100], Lvl: 17, Life: 666, Mor: 11, Def: 20, Bon: 19, Dmg: '3d20' }
    ],
    traits: []
  },
  'humans-of-the-pananthropy': {
    table: [
      { range: [1, 10], Lvl: 0, Life: 4, Mor: 2, Def: 7, Bon: 3, Dmg: '1d4' },
      { range: [11, 20], Lvl: 1, Life: 8, Mor: 3, Def: 8, Bon: 4, Dmg: '1d6+1' },
      { range: [21, 30], Lvl: 2, Life: 12, Mor: 4, Def: 9, Bon: 5, Dmg: '1d8+2' },
      { range: [31, 39], Lvl: 3, Life: 16, Mor: 5, Def: 10, Bon: 6, Dmg: '1d10+3' },
      { range: [40, 48], Lvl: 4, Life: 20, Mor: 6, Def: 11, Bon: 8, Dmg: '1d12+5' },
      { range: [49, 56], Lvl: 5, Life: 24, Mor: 7, Def: 12, Bon: 10, Dmg: '2d8+6' },
      { range: [57, 64], Lvl: 6, Life: 28, Mor: 8, Def: 13, Bon: 12, Dmg: '2d10+9' },
      { range: [65, 70], Lvl: 7, Life: 32, Mor: 9, Def: 14, Bon: 14, Dmg: '2d12+12' },
      { range: [71, 76], Lvl: 8, Life: 36, Mor: 10, Def: 15, Bon: 16, Dmg: '3d10+15' },
      { range: [77, 82], Lvl: 9, Life: 40, Mor: 11, Def: 16, Bon: 18, Dmg: '4d12+20' },
      { range: [83, 87], Lvl: 10, Life: 44, Mor: 12, Def: 17, Bon: 20, Dmg: '5d10+23' },
      { range: [88, 91], Lvl: 11, Life: 48, Mor: 13, Def: 18, Bon: 22, Dmg: '6d12+26' },
      { range: [92, 94], Lvl: 12, Life: 52, Mor: 14, Def: 19, Bon: 24, Dmg: '7d10+29' },
      { range: [95, 96], Lvl: 13, Life: 56, Mor: 15, Def: 20, Bon: 26, Dmg: '8d12+32' },
      { range: [97, 97], Lvl: 14, Life: 60, Mor: 16, Def: 21, Bon: 28, Dmg: '9d10+35' },
      { range: [98, 98], Lvl: 15, Life: 64, Mor: 17, Def: 22, Bon: 30, Dmg: '10d12+38' },
      { range: [99, 99], Lvl: 16, Life: 68, Mor: 18, Def: 23, Bon: 32, Dmg: '11d10+41' },
      { range: [100, 100], Lvl: 17, Life: 72, Mor: 19, Def: 24, Bon: 34, Dmg: '12d12+44' }
    ],
    traits: [
      'SDM.NPCTraitBonded',
      'SDM.NPCTraitTeamwork',
      'SDM.NPCTraitToolmaker',
      'SDM.NPCTraitAdaptable',
      'SDM.NPCTraitTactical',
      'SDM.NPCTraitCommonHumanity'
    ]
  },
  'brick-bastions': {
    table: [
      { range: [1, 10], Lvl: 0, Life: 12, Mor: 6, Def: 7, Bon: 0, Dmg: '1d6' },
      { range: [11, 20], Lvl: 1, Life: 25, Mor: 7, Def: 7, Bon: 1, Dmg: '2d6' },
      { range: [21, 30], Lvl: 2, Life: 40, Mor: 8, Def: 7, Bon: 1, Dmg: '3d6' },
      { range: [31, 39], Lvl: 3, Life: 60, Mor: 9, Def: 7, Bon: 2, Dmg: '4d6' },
      { range: [40, 48], Lvl: 4, Life: 85, Mor: 10, Def: 7, Bon: 2, Dmg: '5d6' },
      { range: [49, 56], Lvl: 5, Life: 120, Mor: 11, Def: 7, Bon: 3, Dmg: '6d6' },
      { range: [57, 64], Lvl: 6, Life: 160, Mor: 11, Def: 7, Bon: 3, Dmg: '7d6' },
      { range: [65, 70], Lvl: 7, Life: 220, Mor: 11, Def: 7, Bon: 4, Dmg: '8d6' },
      { range: [71, 76], Lvl: 8, Life: 300, Mor: 11, Def: 7, Bon: 4, Dmg: '9d6' },
      { range: [77, 82], Lvl: 9, Life: 400, Mor: 11, Def: 7, Bon: 5, Dmg: '10d6' },
      { range: [83, 87], Lvl: 10, Life: 433, Mor: 11, Def: 7, Bon: 5, Dmg: '11d6' },
      { range: [88, 91], Lvl: 11, Life: 466, Mor: 11, Def: 7, Bon: 6, Dmg: '12d6' },
      { range: [92, 94], Lvl: 12, Life: 499, Mor: 11, Def: 7, Bon: 6, Dmg: '13d6' },
      { range: [95, 96], Lvl: 13, Life: 532, Mor: 11, Def: 7, Bon: 7, Dmg: '14d6' },
      { range: [97, 97], Lvl: 14, Life: 565, Mor: 11, Def: 7, Bon: 7, Dmg: '15d6' },
      { range: [98, 98], Lvl: 15, Life: 599, Mor: 11, Def: 7, Bon: 8, Dmg: '16d6' },
      { range: [99, 99], Lvl: 16, Life: 632, Mor: 11, Def: 7, Bon: 8, Dmg: '17d6' },
      { range: [100, 100], Lvl: 17, Life: 666, Mor: 11, Def: 7, Bon: 9, Dmg: '18d6' }
    ],
    traits: [
      'SDM.NPCTraitShieldfriend',
      'SDM.NPCTraitSteadfast',
      'SDM.NPCTraitDenial',
      'SDM.NPCTraitResistomorph',
      'SDM.NPCTraitRockblood',
      'SDM.NPCTraitSlam'
    ]
  },
  'darting-dodgers': {
    table: [
      { range: [1, 10], Lvl: 0, Life: 3, Mor: 2, Def: 13, Bon: 3, Dmg: '1d4x' },
      { range: [11, 20], Lvl: 1, Life: 6, Mor: 3, Def: 14, Bon: 4, Dmg: '1d6x' },
      { range: [21, 30], Lvl: 2, Life: 10, Mor: 4, Def: 15, Bon: 5, Dmg: '2d4x' },
      { range: [31, 39], Lvl: 3, Life: 14, Mor: 4, Def: 16, Bon: 6, Dmg: '2d6x' },
      { range: [40, 48], Lvl: 4, Life: 19, Mor: 5, Def: 18, Bon: 8, Dmg: '2d8x' },
      { range: [49, 56], Lvl: 5, Life: 24, Mor: 6, Def: 20, Bon: 10, Dmg: '3d6x' },
      { range: [57, 64], Lvl: 6, Life: 30, Mor: 7, Def: 22, Bon: 12, Dmg: '3d8x' },
      { range: [65, 70], Lvl: 7, Life: 36, Mor: 7, Def: 24, Bon: 14, Dmg: '4d6x' },
      { range: [71, 76], Lvl: 8, Life: 43, Mor: 8, Def: 26, Bon: 16, Dmg: '5d6x' },
      { range: [77, 82], Lvl: 9, Life: 50, Mor: 9, Def: 28, Bon: 18, Dmg: '6d6x' },
      { range: [83, 87], Lvl: 10, Life: 58, Mor: 10, Def: 30, Bon: 20, Dmg: '7d6x' },
      { range: [88, 91], Lvl: 11, Life: 66, Mor: 11, Def: 32, Bon: 22, Dmg: '8d6x' },
      { range: [92, 94], Lvl: 12, Life: 75, Mor: 11, Def: 34, Bon: 24, Dmg: '9d6x' },
      { range: [95, 96], Lvl: 13, Life: 84, Mor: 11, Def: 36, Bon: 26, Dmg: '10d6x' },
      { range: [97, 97], Lvl: 14, Life: 94, Mor: 11, Def: 38, Bon: 28, Dmg: '11d6x' },
      { range: [98, 98], Lvl: 15, Life: 104, Mor: 11, Def: 40, Bon: 30, Dmg: '12d6x' },
      { range: [99, 99], Lvl: 16, Life: 115, Mor: 11, Def: 42, Bon: 32, Dmg: '13d6x' },
      { range: [100, 100], Lvl: 17, Life: 126, Mor: 11, Def: 44, Bon: 34, Dmg: '14d6x' }
    ],
    traits: [
      'SDM.NPCTraitCharger',
      'SDM.NPCTraitDoubleAttack',
      'SDM.NPCTraitRiposte',
      'SDM.NPCTraitEvasive',
      'SDM.NPCTraitSpringer',
      'SDM.NPCTraitStabber'
    ]
  },
  'crystal-cannons': {
    table: [
      { range: [1, 10], Lvl: 0, Life: 1, Mor: 2, Def: 12, Bon: 5, Dmg: '1d6+5' },
      { range: [11, 20], Lvl: 1, Life: 2, Mor: 3, Def: 13, Bon: 6, Dmg: '1d8+6' },
      { range: [21, 30], Lvl: 2, Life: 4, Mor: 3, Def: 14, Bon: 7, Dmg: '1d10+7' },
      { range: [31, 39], Lvl: 3, Life: 7, Mor: 4, Def: 15, Bon: 8, Dmg: '1d12+8' },
      { range: [40, 48], Lvl: 4, Life: 11, Mor: 4, Def: 16, Bon: 9, Dmg: '2d8+9' },
      { range: [49, 56], Lvl: 5, Life: 16, Mor: 5, Def: 17, Bon: 10, Dmg: '3d6+10' },
      { range: [57, 64], Lvl: 6, Life: 22, Mor: 5, Def: 18, Bon: 11, Dmg: '2d10+11' },
      { range: [65, 70], Lvl: 7, Life: 29, Mor: 6, Def: 19, Bon: 12, Dmg: '2d12+12' },
      { range: [71, 76], Lvl: 8, Life: 37, Mor: 6, Def: 20, Bon: 13, Dmg: '5d6+13' },
      { range: [77, 82], Lvl: 9, Life: 46, Mor: 7, Def: 21, Bon: 14, Dmg: '6d6+14' },
      { range: [83, 87], Lvl: 10, Life: 56, Mor: 7, Def: 22, Bon: 15, Dmg: '7d6+15' },
      { range: [88, 91], Lvl: 11, Life: 67, Mor: 8, Def: 23, Bon: 16, Dmg: '8d6+16' },
      { range: [92, 94], Lvl: 12, Life: 79, Mor: 8, Def: 24, Bon: 17, Dmg: '9d6+17' },
      { range: [95, 96], Lvl: 13, Life: 92, Mor: 9, Def: 25, Bon: 18, Dmg: '10d6+18' },
      { range: [97, 97], Lvl: 14, Life: 106, Mor: 9, Def: 26, Bon: 19, Dmg: '11d6+19' },
      { range: [98, 98], Lvl: 15, Life: 121, Mor: 10, Def: 27, Bon: 20, Dmg: '12d6+20' },
      { range: [99, 99], Lvl: 16, Life: 137, Mor: 10, Def: 28, Bon: 21, Dmg: '13d6+21' },
      { range: [100, 100], Lvl: 17, Life: 154, Mor: 11, Def: 29, Bon: 22, Dmg: '14d6+22' }
    ],
    traits: [
      'SDM.NPCTraitOvercharge',
      'SDM.NPCTraitDesperateShot',
      'SDM.NPCTraitFeedback',
      'SDM.NPCTraitShatter',
      'SDM.NPCTraitPhase',
      'SDM.NPCTraitCircleOfPain'
    ]
  },

  'erratic-expendables': {
    table: [
      { range: [1, 10], Lvl: 0, Life: 1, Mor: 4, Def: 7, Bon: 3, Dmg: '1d4' },
      { range: [11, 20], Lvl: 1, Life: 2, Mor: 5, Def: 8, Bon: 4, Dmg: '1d6' },
      { range: [21, 30], Lvl: 2, Life: 3, Mor: 6, Def: 9, Bon: 5, Dmg: '1d8' },
      { range: [31, 39], Lvl: 3, Life: 4, Mor: 7, Def: 10, Bon: 6, Dmg: '1d10' },
      { range: [40, 48], Lvl: 4, Life: 5, Mor: 8, Def: 11, Bon: 7, Dmg: '1d12' },
      { range: [49, 56], Lvl: 5, Life: 6, Mor: 9, Def: 12, Bon: 8, Dmg: '2d8' },
      { range: [57, 64], Lvl: 6, Life: 7, Mor: 10, Def: 13, Bon: 9, Dmg: '2d10' },
      { range: [65, 70], Lvl: 7, Life: 8, Mor: 11, Def: 14, Bon: 10, Dmg: '2d12' },
      { range: [71, 76], Lvl: 8, Life: 9, Mor: 11, Def: 15, Bon: 11, Dmg: '3d8' },
      { range: [77, 82], Lvl: 9, Life: 10, Mor: 11, Def: 16, Bon: 12, Dmg: '3d10' },
      { range: [83, 87], Lvl: 10, Life: 11, Mor: 11, Def: 17, Bon: 13, Dmg: '3d12' },
      { range: [88, 91], Lvl: 11, Life: 12, Mor: 11, Def: 18, Bon: 14, Dmg: '4d10' },
      { range: [92, 94], Lvl: 12, Life: 13, Mor: 11, Def: 19, Bon: 15, Dmg: '4d12' },
      { range: [95, 96], Lvl: 13, Life: 14, Mor: 11, Def: 20, Bon: 16, Dmg: '5d10' },
      { range: [97, 97], Lvl: 14, Life: 15, Mor: 11, Def: 21, Bon: 17, Dmg: '5d12' },
      { range: [98, 98], Lvl: 15, Life: 16, Mor: 11, Def: 22, Bon: 18, Dmg: '6d10' },
      { range: [99, 99], Lvl: 16, Life: 17, Mor: 11, Def: 23, Bon: 19, Dmg: '6d12' },
      { range: [100, 100], Lvl: 17, Life: 18, Mor: 11, Def: 24, Bon: 20, Dmg: '7d12' }
    ],
    traits: [
      'SDM.NPCTraitDeathCurse',
      'SDM.NPCTraitMartyr',
      'SDM.NPCTraitOnceAgain',
      'SDM.NPCTraitKillbite',
      'SDM.NPCTraitTickingCorpse',
      'SDM.NPCTraitFrenzy'
    ]
  }
};

// cria o objeto final padronizado
function makeNPC(name, img = '', biography = '', data, initiative = '') {
  return {
    name,
    img,
    type: 'npc',
    system: {
      biography,
      initiative,
      bonus: data.Bon,
      damage: data.Dmg,
      defense: data.Def,
      level: data.Lvl,
      life: {
        value: data.Life,
        max: data.Life
      },
      morale: data.Mor
    }
  };
}

async function createRandomTrait(targetActor, traitsTable) {
  if (!traitsTable.length) {
    return;
  }

  const traitRoll = Math.floor(Math.random() * 6);
  const traitResult = traitsTable[traitRoll];
  const localizedTrait = game.i18n.localize(traitResult);
  await targetActor.createEmbeddedDocuments('Item', [
    new Item({
      name: localizedTrait,
      type: 'trait'
    }).toObject()
  ]);
}

// rola um d100 (00 = 100) e seleciona a linha correspondente
export async function createNPC(name = 'NPC', tableName, initiative = '') {
  const table = NPCTables[tableName].table;
  if (!table) throw new Error(`Tabela não encontrada: ${tableName}`);

  let roll = Math.floor(Math.random() * 100) + 1; // 1 a 100
  const entry = table.find(e => roll >= e.range[0] && roll <= e.range[1]);
  if (!entry) throw new Error(`Nenhuma entrada encontrada para rolagem ${roll} em ${tableName}`);
  const biography = '';
  const img = '';
  const npcData = makeNPC(name, img, biography, entry, initiative);
  npcData.system['createdFromTable'] = tableName;

  const targetActor = await Actor.create(npcData);
  const traitsTable = NPCTables[tableName].traits;

  await createRandomTrait(targetActor, traitsTable);
  return npcData;
}

export function getNPCDataByLevel(tableName, level = 0) {
  const npcTable = tableName || 'generic-synthesized-creature';
  const table = NPCTables[npcTable].table;
  const entry = [...table].reverse().find(e => e.Lvl <= level);
  return entry;
}

// retorna NPC pelo nível (ou nível mais próximo abaixo)
export async function createNPCByLevel({
  name,
  lvl,
  tableName,
  initiative = '',
  image = '',
  biography = '',
  ownership = null,
  linked = false
}) {
  const entry = getNPCDataByLevel(tableName, lvl);
  if (!entry) throw new Error(`Nenhuma entrada encontrada para lvl ${lvl} em ${tableName}`);

  const actorBiography = biography;
  const img = image;
  const npcData = makeNPC(name, img, actorBiography, entry, initiative);
  npcData.system['createdFromTable'] = tableName;
  const isGM = userId => game.users.get(userId)?.isGM ?? false;

  const targetActor = await Actor.create(npcData);
  let updateData = {
    'prototypeToken.actorLink': linked
  };
  let shouldBeFriendly = false;

  if (ownership) {
    await targetActor.update({ ownership: ownership });

    if (ownership.default === 3) {
      shouldBeFriendly = true;
    } else {
      for (let [userId, level] of Object.entries(ownership)) {
        if (userId === 'default') continue;
        if (level === 3 && !isGM(userId)) {
          shouldBeFriendly = true;
          break;
        }
      }
    }
  }

  if (shouldBeFriendly) {
    updateData['prototypeToken.disposition'] = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
  }

  await targetActor.update(updateData);

  const traitsTable = NPCTables[tableName].traits;

  await createRandomTrait(targetActor, traitsTable);
  return npcData;
}

export async function createBackgroundTrait(
  targetActor = null,
  { title = '', task = '', spin = '' }
) {
  const description = `
<p><strong>${game.i18n.localize('SDM.BackgroundTask')}:</strong> ${task}</p>
<p><strong>${game.i18n.localize('SDM.BackgroundSpin')}:</strong> ${spin}</p>`;

  const itemObject = new Item({
    name: title,
    type: 'trait',
    system: {
      description
    }
  }).toObject();

  if (!targetActor) {
    await SdmItem.create(itemObject);
    return;
  }

  await targetActor.createEmbeddedDocuments('Item', [itemObject]);
}

export async function createFullAutoDestructionMode(
  name = 'Unnamed Auto Destruction',
  armorBonus = 5,
  img = ''
) {
  let entry;

  const stats = [
    {
      armor: 5,
      level: '1d4+1',
      lifeMultiplier: 5,
      morale: 9,
      defenseFormula: '1d4+13',
      plusBonus: 2,
      damage: '1d6',
      mood: 'Filled with dread and foreboding'
    },
    {
      armor: 6,
      level: '1d4+2',
      lifeMultiplier: 6,
      morale: 9,
      defenseFormula: '1d6+13',
      plusBonus: 2,
      damage: '1d8',
      mood: 'Vengeful. Convinced it is dead.'
    },
    {
      armor: 7,
      level: '1d6+2',
      lifeMultiplier: 7,
      morale: 10,
      defenseFormula: '1d6+14',
      plusBonus: 2,
      damage: '1d10',
      mood: 'Chasing those it once saved.'
    },
    {
      armor: 8,
      level: '1d6+3',
      lifeMultiplier: 9,
      morale: 10,
      defenseFormula: '1d6+15',
      plusBonus: 3,
      damage: '2d6',
      mood: "Doesn't even care. YOLO."
    },
    {
      armor: 9,
      level: '1d6+4',
      lifeMultiplier: 12,
      morale: 11,
      defenseFormula: '1d8+15',
      plusBonus: 4,
      damage: '2d8',
      mood: "Traveled time. Seen ma's future."
    },
    {
      armor: 10,
      level: '1d8+4',
      lifeMultiplier: 15,
      morale: 11,
      defenseFormula: '1d10+15',
      plusBonus: 5,
      damage: '2d10',
      mood: 'Eyes full of stars and hope.'
    }
  ];

  if (!armorBonus || armorBonus <= 5) {
    entry = stats[0];
  } else {
    entry = [...stats].reverse().find(e => e.armor <= armorBonus);
  }

  if (!entry) return;

  let levelRoll = new Roll(entry.level);
  levelRoll = await levelRoll.evaluate();
  const level = levelRoll.total;
  const life = level * entry.lifeMultiplier;
  const morale = entry.morale;
  let defenseRoll = new Roll(entry.defenseFormula);
  defenseRoll = await defenseRoll.evaluate();
  const defense = defenseRoll.total;
  const bonus = level + entry.plusBonus;
  const damage = entry.damage;
  const biography = `<p><strong>Mood:</strong> ${entry.mood}</p>`;
  const initiative = '';

  const npcData = makeNPC(
    name,
    img,
    biography,
    {
      Bon: bonus,
      Dmg: damage,
      Def: defense,
      Lvl: levelRoll.total,
      Life: life,
      Mor: morale
    },
    initiative
  );

  await Actor.create(npcData);
}

function percentToHpColor(percent) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const hue = Math.round((p / 100) * 120);
  return `hsl(${hue} 70% 45%)`;
}

export async function postLifeChange(actor, damageValue = 0, multiplier = 1, opts = {}) {
  if (!actor) return;

  // Normalize numeric inputs
  const dv = Number(damageValue) || 0;
  const mul = Number(multiplier) || 0;
  // Signed net amount: positive = damage, negative = healing
  const netSigned = dv * mul;
  const amountAbs = Math.round(Math.abs(netSigned));

  const isHealing = netSigned < 0;

  // Life / temp values from the actor
  const life = actor.system?.life ?? {};
  const beforeLife = Number(life.value ?? 0);
  const lifeMax = Number(life.max ?? 0);

  const temp = actor.system?.temporary_life ?? {};
  const tempEnabled = !!temp.enabled;
  const beforeTemp = tempEnabled ? Number(temp.value ?? 0) : 0;
  const tempMax = tempEnabled ? Number(temp.max ?? 0) : 0;

  // Helper clamp
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  // Simulate after-values depending on damage vs healing
  let afterLife = beforeLife;
  let afterTemp = beforeTemp;

  if (netSigned > 0) {
    // DAMAGE: consume temporary first, overflow to life
    let remaining = netSigned;

    if (tempEnabled && afterTemp > 0) {
      const takenFromTemp = Math.min(afterTemp, remaining);
      afterTemp = clamp(afterTemp - takenFromTemp, 0, tempMax);
      remaining -= takenFromTemp;
    }

    if (remaining > 0) {
      afterLife = clamp(afterLife - remaining, 0, lifeMax);
    }
  } else if (netSigned < 0) {
    // HEALING: heal life first, overflow to temporary (if enabled)
    let remaining = Math.abs(netSigned);

    if (afterLife < lifeMax) {
      const healToLife = Math.min(remaining, lifeMax - afterLife);
      afterLife = clamp(afterLife + healToLife, 0, lifeMax);
      remaining -= healToLife;
    }

    if (remaining > 0 && tempEnabled) {
      const healToTemp = Math.min(remaining, tempMax - afterTemp);
      afterTemp = clamp(afterTemp + healToTemp, 0, tempMax);
      remaining -= healToTemp;
    }
  }

  // Compute display percentages
  const percentAfter = lifeMax > 0 ? Math.round((afterLife / lifeMax) * 100) : 0;
  const tempPercentAfter = tempEnabled && tempMax > 0 ? Math.round((afterTemp / tempMax) * 100) : 0;

  // Color for life bar (keep original)
  const hpColor = percentToHpColor(percentAfter);

  const ctx = {
    messageId: foundry.utils.randomID(),
    timestamp: new Date().toLocaleTimeString(),
    senderName: opts.senderName ?? 'Gamemaster',
    eventLabel:
      opts.eventLabel ??
      (isHealing
        ? (game.i18n.localize('SDM.Healing') ?? 'Heal')
        : (game.i18n.localize('SDM.Damage') ?? 'Damage')),
    actorId: actor.id,
    actorName: actor.name,
    actorImg: actor.prototypeToken?.texture?.src || actor.img || '',
    amountFormatted: String(amountAbs),
    amount: amountAbs,
    isHealing,
    before: beforeLife,
    after: afterLife,
    max: lifeMax,
    percentAfter,
    hpColor,
    note: opts.note ?? '',
    // Temporary life fields (only used in template when tempEnabled is true)
    tempEnabled,
    beforeTemp,
    afterTemp,
    tempMax,
    tempPercentAfter
  };

  // Render template
  let html = await renderTemplate(templatePath('chat/life-change-card'), ctx);
  if (typeof html !== 'string') {
    if (html instanceof HTMLElement) html = html.outerHTML;
    else if (html instanceof NodeList || html instanceof HTMLCollection)
      html = Array.from(html)
        .map(n => n.outerHTML ?? String(n))
        .join('');
    else html = String(html);
  }

  // Post-process fill bars to set width and color
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  const fill = wrapper.querySelector('.life-hp-fill');
  if (fill) {
    fill.style.setProperty('--hp-color', ctx.hpColor);
    fill.style.width = `${ctx.percentAfter}%`;
  }

  // Temporary life fill (only present when template included it)
  const tempFill = wrapper.querySelector('.life-temp-fill');
  if (tempFill) {
    tempFill.style.width = `${ctx.tempPercentAfter}%`;
  }

  await ChatMessage.create({
    content: wrapper.innerHTML,
    speaker: ChatMessage.getSpeaker({ alias: ctx.senderName })
  });

  return ctx;
}

export async function postConsumeSupplies(actor, supplies = [], opts = {}) {
  if (!actor) return null;
  const messageId = foundry.utils.randomID();
  const senderName = opts.senderName ?? 'Gamemaster';
  const actorId = actor.id;
  const actorName = actor.name;
  const actorImg = actor.img || '';
  const actorNote = opts.actorNote ?? '';
  const totalCount = supplies.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const ctx = {
    messageId,
    actorId,
    actorName,
    actorImg,
    actorNote,
    supplies,
    totalCount
  };
  let html = await renderTemplate(templatePath('chat/consume-supplies-card'), ctx);
  if (typeof html !== 'string') {
    if (html instanceof HTMLElement) html = html.outerHTML;
    else if (html instanceof NodeList || html instanceof HTMLCollection)
      html = Array.from(html)
        .map(n => n.outerHTML ?? String(n))
        .join('');
    else html = String(html);
  }
  await ChatMessage.create({
    content: html,
    speaker: ChatMessage.getSpeaker({ alias: senderName })
  });
  return ctx;
}

export async function addCompendiumItemToActor(actor, itemRef) {
  try {
    if (!actor || actor.type !== ActorType.CHARACTER) return;

    const doc = await fromUuid(itemRef);
    if (!doc) return;

    const itemData = typeof doc.toObject === 'function' ? doc.toObject() : doc;

    itemData.system = itemData.system || {};
    itemData.system.readied = true;
    itemData.flags = itemData.flags || {};
    itemData.flags.sdm = itemData.flags.sdm || {};
    itemData.flags.sdm.fromCompendium = itemRef;

    const existingByFlag = actor.items.find(i => {
      try {
        return i.getFlag?.('sdm', 'fromCompendium') === itemRef;
      } catch {
        return false;
      }
    });
    if (existingByFlag) {
      await existingByFlag.update({
        'system.readied': true
      });
      return;
    }

    const existingByName = actor.items.find(i => i.name === itemData.name);
    if (existingByName) {
      await existingByName.update({
        'system.readied': true,
        'flags.sdm.fromCompendium': itemRef
      });
      return;
    }

    await actor.createEmbeddedDocuments('Item', [itemData]);
  } catch (err) {
    console.error('Erro ao adicionar item do compêndio via fromUuid:', err);
  }
}
