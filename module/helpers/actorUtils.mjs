import { ActorType } from './constants.mjs';

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
      { range: [1, 20], Lvl: 0, Life: 4, Mor: 2, Def: 7, Bon: 3, Dmg: '1d4' },
      { range: [21, 39], Lvl: 1, Life: 8, Mor: 3, Def: 8, Bon: 4, Dmg: '1d6+1' },
      { range: [40, 59], Lvl: 2, Life: 12, Mor: 4, Def: 9, Bon: 5, Dmg: '1d8+2' },
      { range: [60, 74], Lvl: 3, Life: 16, Mor: 5, Def: 10, Bon: 6, Dmg: '1d10+3' },
      { range: [75, 84], Lvl: 4, Life: 20, Mor: 6, Def: 11, Bon: 8, Dmg: '1d12+5' },
      { range: [85, 92], Lvl: 5, Life: 24, Mor: 7, Def: 12, Bon: 10, Dmg: '2d8+6' },
      { range: [93, 97], Lvl: 6, Life: 28, Mor: 8, Def: 13, Bon: 12, Dmg: '2d10+9' },
      { range: [98, 98], Lvl: 7, Life: 32, Mor: 9, Def: 14, Bon: 14, Dmg: '2d12+12' },
      { range: [99, 99], Lvl: 8, Life: 36, Mor: 10, Def: 15, Bon: 16, Dmg: '3d10+15' },
      { range: [100, 100], Lvl: 9, Life: 40, Mor: 11, Def: 16, Bon: 18, Dmg: '4d12+20' }
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
      { range: [1, 25], Lvl: 0, Life: 12, Mor: 6, Def: 7, Bon: 0, Dmg: '1d6' },
      { range: [26, 45], Lvl: 1, Life: 25, Mor: 7, Def: 7, Bon: 1, Dmg: '2d6' },
      { range: [46, 59], Lvl: 2, Life: 40, Mor: 8, Def: 7, Bon: 1, Dmg: '3d6' },
      { range: [60, 74], Lvl: 3, Life: 60, Mor: 9, Def: 7, Bon: 2, Dmg: '4d6' },
      { range: [75, 84], Lvl: 4, Life: 85, Mor: 10, Def: 7, Bon: 2, Dmg: '5d6' },
      { range: [85, 92], Lvl: 5, Life: 120, Mor: 11, Def: 7, Bon: 3, Dmg: '6d6' },
      { range: [93, 97], Lvl: 6, Life: 160, Mor: 11, Def: 7, Bon: 3, Dmg: '7d6' },
      { range: [98, 98], Lvl: 7, Life: 220, Mor: 11, Def: 7, Bon: 4, Dmg: '8d6' },
      { range: [99, 99], Lvl: 8, Life: 300, Mor: 11, Def: 7, Bon: 4, Dmg: '9d6' },
      { range: [100, 100], Lvl: 9, Life: 400, Mor: 11, Def: 7, Bon: 5, Dmg: '10d6' }
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
      { range: [1, 20], Lvl: 0, Life: 3, Mor: 2, Def: 13, Bon: 3, Dmg: '1d4x' },
      { range: [21, 39], Lvl: 1, Life: 6, Mor: 3, Def: 14, Bon: 4, Dmg: '1d6x' },
      { range: [40, 59], Lvl: 2, Life: 10, Mor: 4, Def: 15, Bon: 5, Dmg: '2d4x' },
      { range: [60, 74], Lvl: 3, Life: 14, Mor: 4, Def: 16, Bon: 6, Dmg: '2d6x' },
      { range: [75, 84], Lvl: 4, Life: 19, Mor: 5, Def: 18, Bon: 8, Dmg: '2d8x' },
      { range: [85, 92], Lvl: 5, Life: 24, Mor: 6, Def: 20, Bon: 10, Dmg: '3d6x' },
      { range: [93, 97], Lvl: 6, Life: 30, Mor: 7, Def: 22, Bon: 12, Dmg: '3d8x' },
      { range: [98, 98], Lvl: 7, Life: 36, Mor: 7, Def: 24, Bon: 14, Dmg: '4d6x' },
      { range: [99, 99], Lvl: 8, Life: 43, Mor: 8, Def: 26, Bon: 16, Dmg: '5d6x' },
      { range: [100, 100], Lvl: 9, Life: 50, Mor: 9, Def: 28, Bon: 18, Dmg: '6d6x' }
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
      { range: [1, 20], Lvl: 0, Life: 1, Mor: 2, Def: 12, Bon: 5, Dmg: '1d6+5' },
      { range: [21, 39], Lvl: 1, Life: 2, Mor: 3, Def: 13, Bon: 6, Dmg: '1d8+6' },
      { range: [40, 59], Lvl: 2, Life: 4, Mor: 3, Def: 14, Bon: 7, Dmg: '1d10+7' },
      { range: [60, 74], Lvl: 3, Life: 7, Mor: 4, Def: 15, Bon: 8, Dmg: '1d12+8' },
      { range: [75, 84], Lvl: 4, Life: 11, Mor: 4, Def: 16, Bon: 9, Dmg: '2d8+9' },
      { range: [85, 92], Lvl: 5, Life: 16, Mor: 5, Def: 17, Bon: 10, Dmg: '3d6+10' },
      { range: [93, 97], Lvl: 6, Life: 22, Mor: 5, Def: 18, Bon: 11, Dmg: '2d10+11' },
      { range: [98, 98], Lvl: 7, Life: 29, Mor: 6, Def: 19, Bon: 12, Dmg: '2d12+12' },
      { range: [99, 99], Lvl: 8, Life: 37, Mor: 6, Def: 20, Bon: 13, Dmg: '5d6+13' },
      { range: [100, 100], Lvl: 9, Life: 46, Mor: 7, Def: 21, Bon: 14, Dmg: '6d6+14' }
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
      { range: [1, 20], Lvl: 0, Life: 1, Mor: 4, Def: 7, Bon: 3, Dmg: '1d4' },
      { range: [21, 39], Lvl: 1, Life: 2, Mor: 5, Def: 8, Bon: 4, Dmg: '1d6' },
      { range: [40, 59], Lvl: 2, Life: 3, Mor: 6, Def: 9, Bon: 5, Dmg: '1d8' },
      { range: [60, 74], Lvl: 3, Life: 4, Mor: 7, Def: 10, Bon: 6, Dmg: '1d10' },
      { range: [75, 84], Lvl: 4, Life: 5, Mor: 8, Def: 11, Bon: 7, Dmg: '1d12' },
      { range: [85, 92], Lvl: 5, Life: 6, Mor: 9, Def: 12, Bon: 8, Dmg: '2d8' },
      { range: [93, 97], Lvl: 6, Life: 7, Mor: 10, Def: 13, Bon: 9, Dmg: '2d10' },
      { range: [98, 98], Lvl: 7, Life: 8, Mor: 11, Def: 14, Bon: 10, Dmg: '2d12' },
      { range: [99, 99], Lvl: 8, Life: 9, Mor: 11, Def: 15, Bon: 11, Dmg: '3d8' },
      { range: [100, 100], Lvl: 9, Life: 10, Mor: 11, Def: 16, Bon: 12, Dmg: '3d10' }
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
    biography,
    type: 'npc',
    system: {
      initiative,
      bonus: data.Bon,
      damage: data.Dmg,
      defense: data.Def,
      level: data.Lvl,
      life: {
        value: data.Life,
        max: data.Life
      },
      morale: data.Mor,
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

  const targetActor = await Actor.create(npcData);
  const traitsTable = NPCTables[tableName].traits;

  await createRandomTrait(targetActor, traitsTable);
  return npcData;
}

// retorna NPC pelo nível (ou nível mais próximo abaixo)
export async function createNPCByLevel(name, lvl, tableName, initiative) {
  const table = NPCTables[tableName].table;
  if (!table) throw new Error(`Tabela não encontrada: ${tableName}`);

  // pega a maior entrada <= lvl
  const entry = [...table].reverse().find(e => e.Lvl <= lvl);

  if (!entry) throw new Error(`Nenhuma entrada encontrada para lvl ${lvl} em ${tableName}`);
  const biography = '';
  const img = '';
  const npcData = makeNPC(name, img, biography, entry, initiative);

  const targetActor = await Actor.create(npcData);
  const traitsTable = NPCTables[tableName].traits;

  await createRandomTrait(targetActor, traitsTable);
  return npcData;
}

export async function createBackgroundTrait(
  targetActor,
  { flavor = '', role = '', task = '', spin = '' }
) {
  const traitName = `${flavor} ${role}`;
  const description = `
<p><strong>${game.i18n.localize('SDM.BackgroundTask')}:</strong> ${task}</p>
<p><strong>${game.i18n.localize('SDM.BackgroundSpin')}:</strong> ${spin}</p>`;

  await targetActor.createEmbeddedDocuments('Item', [
    new Item({
      name: traitName,
      type: 'trait',
      system: {
        description
      }
    }).toObject()
  ]);
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
    initiative,
  );

  await Actor.create(npcData);
}
