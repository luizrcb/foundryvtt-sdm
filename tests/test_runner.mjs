// tests/test_runner.mjs
// Run:  node tests/test_runner.mjs
// Node 22+ (ESM). Ajuste paths of import se seu repo tiver outra raiz.

// =================== 1) SHIM mínimo do Foundry ===================
globalThis.foundry = {
  dice: { terms: {} },
  applications: { handlebars: { renderTemplate: async () => '' } }
};

class NumericTerm {
  constructor({ number }) {
    this.number = number;
    this.options = {};
    this.evaluated = true;
  }
}
class OperatorTerm {
  constructor({ operator }) {
    this.operator = operator;
    this.options = {};
    this.evaluated = true;
  }
}
class Die {
  constructor({ number = 1, faces = 6, modifiers = [], results = [] }) {
    this.number = number;
    this.faces = faces;
    this.modifiers = modifiers || [];
    this.results = (results || []).map(r => ({
      result: r.result,
      active: r.active !== false,
      exploded: !!r.exploded
    }));
    this.options = {};
    this.evaluated = true;
  }
}
class PoolTerm {
  constructor({ terms = [], modifiers = [], rolls = [], results = [] }) {
    this.terms = terms;
    this.modifiers = modifiers || [];
    this.rolls = rolls;
    this.results = results;
    this.options = {};
    this.evaluated = true;
  }
}
class ParentheticalTerm {
  constructor({ roll, term }) {
    this.roll = roll;
    this.term = term || '';
    this.options = {};
    this.evaluated = true;
  }
}

foundry.dice.terms.NumericTerm = NumericTerm;
foundry.dice.terms.OperatorTerm = OperatorTerm;
foundry.dice.terms.Die = Die;
foundry.dice.terms.PoolTerm = PoolTerm;
foundry.dice.terms.ParentheticalTerm = ParentheticalTerm;

class Roll {
  constructor(formulaOrTerms) {
    this.options = {};
    if (Array.isArray(formulaOrTerms)) {
      this.terms = formulaOrTerms;
      this.formula = '<manual terms>';
    } else {
      this.formula = String(formulaOrTerms || '');
      this.terms = [];
    }
    this.dice = [];
    this._evaluated = false;
    this._total = 0;
  }
  async evaluate() {
    if (this.terms.length === 0 && this.formula) {
      const safe = this.formula.replace(/[^0-9+\-*/(). ]/g, '');
      // eslint-disable-next-line no-new-func
      this._total = Function(`"use strict";return (${safe});`)();
      this._evaluated = true;
      return this;
    }
    this._evaluated = true;
    return this;
  }
  get total() {
    return this._total;
  }
  set total(v) {
    this._total = Number(v);
  }
  static fromTerms(terms) {
    return new Roll(terms);
  }
}
globalThis.Roll = Roll;

// =================== 2) Stubs of game/CONFIG ===================
globalThis.game = {
  settings: { get: () => 'd6' },
  dice3d: { showForRoll: async () => {} }
};
globalThis.CONFIG = { SDM: { getDamageMultiplier: () => ({ '*2': '×2' }) } };

// =============== 3) Imports do seu código (ajuste caminhos) ===============
import { HeroDiceEngine } from '../module/rolls/hero_dice/core/HeroDiceEngine.mjs';
import { HeroDiceAllocator } from '../module/rolls/hero_dice/core/HeroDiceAllocator.mjs';
import { RollAnalyzer } from '../module/rolls/hero_dice/core/RollAnalyzer.mjs';
import { ExplosiveDie } from '../module/rolls/hero_dice/models/ExplosiveDie.mjs';
// KeepRule/HeroDie são importados internamente pelos seus módulos conforme necessário

// =============== 4) Helpers of diagnóstico e explosões ===============
import { Diag } from './diag/logger.mjs';
import { installDiagHooks } from './diag/hooks.mjs';
import { installExplosionsByDie } from './helpers/installExplosionsByDie.mjs';

const fs = await import('node:fs/promises');
const path = await import('node:path');

// =============== 5) Re-hidratar fixtures JSON -> objetos do shim ===============
// Coleta todos os Die (incluindo recursivamente dentro of parênteses)
function collectDiceFromTerms(terms, acc = []) {
  for (const t of terms || []) {
    if (!t) continue;
    if (t instanceof foundry.dice.terms.Die) {
      acc.push(t);
    } else if (t instanceof foundry.dice.terms.ParentheticalTerm && t.roll?.terms) {
      collectDiceFromTerms(t.roll.terms, acc);
    } else if (Array.isArray(t.terms)) {
      collectDiceFromTerms(t.terms, acc);
    }
  }
  return acc;
}

// Reidrata um Roll interno (usado em PoolTerm e ParentheticalTerm)
function rehydrateRollLike(nodeRoll) {
  const rr = new Roll([]);
  rr._evaluated = true;
  rr._total = Number(nodeRoll?.total || 0);
  rr.terms = (nodeRoll?.terms || []).map(rehydrateTermNode);
  rr.dice = collectDiceFromTerms(rr.terms); // << ESSENCIAL para o Analyzer
  return rr;
}

function rehydrateTermNode(node) {
  if (!node || typeof node !== 'object') return node;
  switch (node.class) {
    case 'NumericTerm':
      return new NumericTerm({ number: node.number });

    case 'OperatorTerm':
      return new OperatorTerm({ operator: node.operator });

    case 'Die': {
      const die = new Die({
        number: node.number,
        faces: node.faces,
        modifiers: node.modifiers || [],
        results: node.results || []
      });
      if (node.groupId != null) die.groupId = node.groupId;
      if (node._groupId != null) die._groupId = node._groupId;
      return die;
    }

    case 'PoolTerm': {
      const rolls = (node.rolls || []).map(rehydrateRollLike);
      return new PoolTerm({
        terms: node.terms || [],
        modifiers: node.modifiers || [],
        rolls,
        results: node.results || []
      });
    }

    case 'ParentheticalTerm': {
      const inner = rehydrateRollLike(node.roll || { terms: [], total: 0 });
      return new ParentheticalTerm({ roll: inner, term: node.term });
    }

    default:
      if (Array.isArray(node.terms)) {
        const obj = { terms: node.terms.map(rehydrateTermNode) };
        return obj;
      }
      return node;
  }
}

async function loadFixture(file) {
  const txt = await fs.readFile(file, 'utf8');
  const json = JSON.parse(txt); // array of termos no nível raiz
  const terms = json.map(rehydrateTermNode);

  const roll = new Roll([]); // monta um Roll com termos reidratados
  roll._evaluated = true;
  roll._total = 0; // o Engine recalcula o total final
  roll.terms = terms;
  roll.dice = collectDiceFromTerms(roll.terms); // ajuda em casos simples

  return roll;
}

// =============== 6) Stub determinístico of hero dice ===============
function stubHeroDice(results) {
  const orig = HeroDiceEngine._rollHeroDice;
  HeroDiceEngine._rollHeroDice = async ({ quantity, faces }) => {
    return { dice: [{ results: results.map((v, i) => ({ result: v, active: true, index: i })) }] };
  };
  return () => {
    HeroDiceEngine._rollHeroDice = orig;
  };
}

// =============== 7) Runner of um caso =========================
function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function runCase(tc) {
  const outDir = path.resolve('tests/out');
  await fs.mkdir(outDir, { recursive: true });

  const diag = new Diag(tc.name);

  // hooks of diag
  installDiagHooks({ RollAnalyzer, HeroDiceAllocator, ExplosiveDie }, diag);

  // carregar fixture
  const fixturePath = path.resolve(tc.fixture);
  const roll = await loadFixture(fixturePath);

  // resumo rápido da fixture
  const rootTypes = roll.terms.map(t => t?.constructor?.name);
  const poolSumm = roll.terms
    .filter(t => t instanceof foundry.dice.terms.PoolTerm)
    .map((p, i) => ({
      idx: i,
      modifiers: p.modifiers,
      rolls: p.rolls?.length ?? 0,
      dicePerRoll: (p.rolls || []).map(r => r.dice?.length ?? 0)
    }));
  diag.push('fixture.summary', {
    rootTypes,
    rootDice: roll.dice?.length ?? 0,
    pools: poolSumm
  });

  // actor stub
  const actor = {
    system: { hero_dice: { value: 999, dice_type: 'd6' } },
    async update() {}
  };

  // explosões determinísticas causadas por heróicos: por dieIndex
  const undoExpl = installExplosionsByDie(ExplosiveDie, tc.explosionsByDie || {});

  // stub of hero dice
  const undoHero = stubHeroDice(tc.hero.results || []);

  // executa
  const qty = (tc.hero.results || []).length;
  const mode = tc.hero.mode || 'increase';

  diag.push('engine.process.begin', { qty, mode });
  const res = await HeroDiceEngine.process(roll, qty, 0, actor, { mode });
  diag.push('engine.process.end', {
    total: res.total,
    targetMultiplier: res.targetMultiplier,
    nonTargetValue: res.nonTargetValue,
    explosionCount: res.distribution?.explosionCount,
    usedHero: res.distribution?.usedHeroIndexes?.length,
    keepRule: { type: res.keepRule?.type, count: res.keepRule?.count, scope: res.keepRule?.scope }
  });

  // limpa patches
  undoHero();
  undoExpl();

  // checagens básicas
  let pass = true;
  const got = {
    total: res.total,
    expCount: res.distribution?.explosionCount,
    used: res.distribution?.usedHeroIndexes?.length ?? 0
  };
  const exp = { total: tc.expected?.total, expCount: tc.expected?.explosionCount };
  if (tc.expected?.total != null && got.total !== tc.expected.total) pass = false;
  if (tc.expected?.explosionCount != null && got.expCount !== tc.expected.explosionCount)
    pass = false;

  // resumo no console
  if (pass) {
    console.log(`✓ ${tc.name}`, got);
  } else {
    console.error(`✗ ${tc.name}\n  got   :`, got, '\n  expect:', exp);

    // salva bundle of diagnóstico
    const diagFile = path.join(outDir, `${slug(tc.name)}.diag.json`);
    await diag.dumpToFile(diagFile, {
      fixture: tc.fixture,
      got,
      expected: exp,
      mode: tc.hero.mode,
      explosionsByDie: tc.explosionsByDie
    });
  }

  return pass;
}

// =============== 8) SUITE: casos iniciais =====================
const cases = [
  // 1d20x + 0  (17)
  {
    name: 'increase of ability 1d20x + 0 (17 +2 -> 19)',
    fixture: './tests/fixtures/1d20x-plus-0.json',
    hero: { mode: 'increase', results: [2] },
    explosionsByDie: {},
    expected: { total: 19 }
  },
  {
    name: 'increase of ability 1d20x + 0 (17 +4 -> explode 3 => 23)',
    fixture: './tests/fixtures/1d20x-plus-0.json',
    hero: { mode: 'increase', results: [4] },
    explosionsByDie: { 0: [3] },
    expected: { total: 23 }
  },
  {
    name: 'decrease of ability 1d20x + 0 (17 -4 -> 13)',
    fixture: './tests/fixtures/1d20x-plus-0.json',
    hero: { mode: 'decrease', results: [4] },
    expected: { total: 13 }
  },

  // 1d20 + 2  (14)
  {
    name: 'increase of ability 1d20 + 2 (+4 => 20)',
    fixture: './tests/fixtures/1d20-plus-2.json',
    hero: { mode: 'increase', results: [4] },
    expected: { total: 20 }
  },
  {
    name: 'increase of ability 1d20 + 2 (+6 => 22)',
    fixture: './tests/fixtures/1d20-plus-2.json',
    hero: { mode: 'increase', results: [6] },
    expected: { total: 22 }
  },
  {
    name: 'decrease of ability 1d20 + 2 (-4 => 12)',
    fixture: './tests/fixtures/1d20-plus-2.json',
    hero: { mode: 'decrease', results: [4] },
    expected: { total: 12 }
  },

  // 1d20x + 1  (20,4)
  {
    name: 'increase of 1d20x + 1 (+6 em 4 => 31)',
    fixture: './tests/fixtures/1d20x-plus-1.json',
    hero: { mode: 'increase', results: [6] },
    expected: { total: 31 }
  },
  {
    name: 'increase of 1d20x + 1 (+6,+6,+6 => explode 11 => 52)',
    fixture: './tests/fixtures/1d20x-plus-1.json',
    hero: { mode: 'increase', results: [6, 6, 6] },
    explosionsByDie: { 1: [11] },
    expected: { total: 52 }
  },
  {
    name: 'decrease of 1d20x + 1 (-4 tail => 21)',
    fixture: './tests/fixtures/1d20x-plus-1.json',
    hero: { mode: 'decrease', results: [4] },
    expected: { total: 21 }
  },
  {
    name: 'decrease of 1d20x + 1 (-6,-3 => 18)',
    fixture: './tests/fixtures/1d20x-plus-1.json',
    hero: { mode: 'decrease', results: [6, 3] },
    expected: { total: 18 }
  },

  // {1d20x,1d20x}kh + 3   (14 vs 15, mantém 15)
  {
    name: 'increase of {1d20x,1d20x}kh + 3 (+6 explode7 no mantido => 36)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kh-plus-3.json',
    hero: { mode: 'increase', results: [6, 3] },
    explosionsByDie: { 1: [13] },
    expected: { total: 36 }
  },
  {
    name: 'increase of {1d20x,1d20x}kh + 3 (+6,+6 explode 9 e 7 nos dois dados)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kh-plus-3.json',
    hero: { mode: 'increase', results: [6, 6] },
    explosionsByDie: { 0: [9], 1: [7] },
    expected: { total: 32 }
  },
  {
    name: 'decrease of {1d20x,1d20x}kh + 3 (-3)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kh-plus-3.json',
    hero: { mode: 'decrease', results: [3] },
    expected: { total: 17 }
  },
  {
    name: 'decrease of {1d20x,1d20x}kh + 3 (-5,-3)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kh-plus-3.json',
    hero: { mode: 'decrease', results: [5, 3] },
    expected: { total: 14 }
  },

  // 2d8 + 0  (6,4)
  {
    name: 'increase of 2d8 + 0 (+2 => 12)',
    fixture: './tests/fixtures/2d8-plus-0.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 12 }
  },
  {
    name: 'increase of 2d8 + 0 (+3,+5 => 16)',
    fixture: './tests/fixtures/2d8-plus-0.json',
    hero: { mode: 'increase', results: [3, 5] },
    expected: { total: 16 }
  },
  {
    name: 'decrease of 2d8 + 0 ( -3,-5 => 2 )',
    fixture: './tests/fixtures/2d8-plus-0.json',
    hero: { mode: 'decrease', results: [3, 5] },
    expected: { total: 2 }
  },
  {
    name: 'decrease of 2d8 + 0 ( -6,-6 => 2 )',
    fixture: './tests/fixtures/2d8-plus-0.json',
    hero: { mode: 'decrease', results: [6, 6] },
    expected: { total: 2 }
  },
  {
    name: 'decrease of 2d8 + 0 ( -5 => 5 )',
    fixture: './tests/fixtures/2d8-plus-0.json',
    hero: { mode: 'decrease', results: [5] },
    expected: { total: 5 }
  },
  {
    name: 'decrease of 2d8 + 0 ( -2 => 8 )',
    fixture: './tests/fixtures/2d8-plus-0.json',
    hero: { mode: 'decrease', results: [2] },
    expected: { total: 8 }
  },

  // (2d8) * 2 + 1  (6,5)
  {
    name: 'increase of (2d8) * 2 + 1 (+2 => 27)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 27 }
  },
  {
    name: 'increase of (2d8) * 2 + 1 (+4 => 29)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'increase', results: [4] },
    expected: { total: 29 }
  },
  {
    name: 'increase of (2d8) * 2 + 1 (+1,+3 => 31)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'increase', results: [1, 3] },
    expected: { total: 31 }
  },
  {
    name: 'increase of (2d8) * 2 + 1 (+4,+5 => 33)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'increase', results: [4, 5] },
    expected: { total: 33 }
  },
  {
    name: 'decrease of (2d8) * 2 + 1 (-3 => 17)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'decrease', results: [3] },
    expected: { total: 17 }
  },
  {
    name: 'decrease of (2d8) * 2 + 1 (-6 => 13)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'decrease', results: [6] },
    expected: { total: 13 }
  },
  {
    name: 'decrease of (2d8) * 2 + 1 (-3,-4 => 9)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'decrease', results: [3, 4] },
    expected: { total: 9 }
  },
  {
    name: 'decrease of (2d8) * 2 + 1 (-3,-6 => 7)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'decrease', results: [3, 6] },
    expected: { total: 7 }
  },
  {
    name: 'decrease of (2d8) * 2 + 1 (-6,-6 => 5)',
    fixture: './tests/fixtures/parens-2d8-times2-plus1.json',
    hero: { mode: 'decrease', results: [6, 6] },
    expected: { total: 5 }
  },

  // {2d6,2d6}kh + 1  (mantém 7)
  {
    name: 'increase of {2d6,2d6}kh + 1 (+2,+1 => 11)',
    fixture: './tests/fixtures/pool-2d6-2d6-kh-plus-1.json',
    hero: { mode: 'increase', results: [2, 1] },
    expected: { total: 11 }
  },
  {
    name: 'decrease of {2d6,2d6}kh + 1 (-2,-1 => 6) // corrigido',
    fixture: './tests/fixtures/pool-2d6-2d6-kh-plus-1.json',
    hero: { mode: 'decrease', results: [2, 1] },
    expected: { total: 6 }
  },

  // ({2d8x,2d8x}kh) * 2 + 1d3 + 1
  {
    name: 'increase KH parens: +1 no mantido => 41',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 41 }
  },
  {
    name: 'increase KH parens: +2 no mantido => 43',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 43 }
  },
  {
    name: 'increase KH parens: +1,+1 no mantido => 43',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [1, 1] },
    expected: { total: 43 }
  },
  {
    name: 'increase KH parens: +2,+1 no mantido => 45',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [2, 1] },
    explosionsByDie: { 0: [4] },
    expected: { total: 53 }
  },

  // B) INCREASE — forçando 1 explosão no mantido (fixando o valor da explosão)
  // Ex.: +3 no "5" do mantido => bate 8 e explode. Se a explosão sair 4, grupo vira 25, total 25*2+3 = 53
  {
    name: 'increase KH parens: +3 no mantido força 1 explosão (tail=4) => 53',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [3] },
    explosionsByDie: {
      /* TODO: ajuste o dieIndex do segmento alvo do “5” do grupo mantido */ 0: [4]
    },
    expected: { total: 53 }
  },
  {
    name: 'increase KH parens: +3,+1 no mantido força explosão (tail=4) => 55',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [3, 1] },
    explosionsByDie: { /* TODO: ajuste o dieIndex do mesmo “5” do mantido */ 0: [4] },
    expected: { total: 55 }
  },

  // C) INCREASE — “flipando” o mantido (alavancar o grupo descartado pra superar 18)
  // Ex.: +4 no "4" do descartado com explosão 6 => vira 19 (8+5+6), pool passa a manter 19; total 19*2+3=41
  {
    name: 'increase KH parens: flip no descartado (+4 força explosão=6) => 41',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [4] },
    explosionsByDie: { /* TODO: dieIndex do “4” do grupo descartado */ 3: [6] },
    expected: { total: 41 }
  },
  // Se der cap com sobra, a sobra deve ser descartada:
  {
    name: 'increase KH parens: flip no descartado (+9 com cap; explode=2) => 41 (sobra descartada)',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [9] },
    explosionsByDie: { /* TODO: dieIndex do “4” do grupo descartado */ 3: [2] },
    expected: { total: 39 }
  },

  // D) DECREASE — remover tail do mantido primeiro (tail pode ir a 0; base tem piso 1)
  {
    name: 'decrease KH parens: -5 remove tail do mantido => 29',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [5] },
    expected: { total: 29 }
  },
  {
    name: 'decrease KH parens: -2,-3 combinação ótima pra zerar tail => 29',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [2, 3] },
    expected: { total: 29 }
  },
  {
    name: 'decrease KH parens: -6,-3 (zera tail com perda1; -3 no 8) => 23',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [6, 3] },
    expected: { total: 23 }
  },
  // -6,-5 zera tail (perda1) e -5 no 8 => grupo mantido cai pra 8 e o pool flipará pro 9 descartado ⇒ total 21
  {
    name: 'decrease KH parens: -6,-5 (flip pro grupo 9) => 21',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [6, 5] },
    expected: { total: 21 }
  },
  // -8 total: melhor é como -5 tail + -3 no 8 => 29 (assegura que sobra no tail não “vaza” pro 8)
  {
    name: 'decrease KH parens: -8 (ótimo = 29; sem “vazar” sobra do tail)',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [8] },
    expected: { total: 29 }
  },

  // E) DECREASE — tentar flipar com pouco “gás” (não flipará)
  {
    name: 'decrease KH parens: -4 no mantido => 31 (sem flip)',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [4] },
    expected: { total: 31 }
  },
  {
    name: 'decrease KH parens: -3,-1 (tail a 1; -1 no 8→7) => 31 (sem flip)',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [3, 1] },
    expected: { total: 31 }
  },

  // {2d4,1d6} + 0  (base: 3,2,4 => 9)
  {
    name: 'increase {2d4,1d6} + 0 (+2 no melhor alvo ⇒ 12)',
    fixture: './tests/fixtures/pool-2d4-1d6-plus-0.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 12 }
  },
  {
    name: 'increase {2d4,1d6} + 0 (+3 com cap/overflow ⇒ 12)',
    fixture: './tests/fixtures/pool-2d4-1d6-plus-0.json',
    hero: { mode: 'increase', results: [3] },
    expected: { total: 12 }
  },
  {
    name: 'increase {2d4,1d6} + 0 (+2,+1 distribuídos ⇒ 13)',
    fixture: './tests/fixtures/pool-2d4-1d6-plus-0.json',
    hero: { mode: 'increase', results: [2, 1] },
    expected: { total: 13 }
  },
  {
    name: 'increase {2d4,1d6} + 0 (+2,+2 para d6 e d4=2 ⇒ 14)',
    fixture: './tests/fixtures/pool-2d4-1d6-plus-0.json',
    hero: { mode: 'increase', results: [2, 2] },
    expected: { total: 14 }
  },

  // DECREASE (piso 1 por dado)
  {
    name: 'decrease {2d4,1d6} + 0 (-2 no melhor alvo ⇒ 8)',
    fixture: './tests/fixtures/pool-2d4-1d6-plus-0.json',
    hero: { mode: 'decrease', results: [2] },
    expected: { total: 8 }
  },
  {
    name: 'decrease {2d4,1d6} + 0 (-2,-1 combinados ⇒ 7)',
    fixture: './tests/fixtures/pool-2d4-1d6-plus-0.json',
    hero: { mode: 'decrease', results: [2, 1] },
    expected: { total: 7 }
  },
  {
    name: 'decrease {2d4,1d6} + 0 (-6,-6  => 4)',
    fixture: './tests/fixtures/pool-2d4-1d6-plus-0.json',
    hero: { mode: 'decrease', results: [6, 6] },
    expected: { total: 4 }
  },

  {
    name: 'increase {2d4x,1d6x} + 0 (+1 ⇒ 13)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 13 }
  },
  {
    name: 'increase {2d4x,1d6x} + 0 (+2 ⇒ 14)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 14 }
  },

  // =============== INCREASE — criar explosão “natural” =================
  // +1 no d6: 5→6 cria explosão (default tail=1 no helper) → +2 no total ⇒ 14
  {
    name: 'increase {2d4x,1d6x} + 0 (+1 no d6 bate 6 e explode ⇒ 14)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [1] },
    // sem explosionsByDie: helper usa tail=1 por default
    expected: { total: 14 }
  },
  // +2 no d4=2: 2→4 explode (default tail=1) → efeito +3 ⇒ 15
  {
    name: 'increase {2d4x,1d6x} + 0 (+2 no d4=2 bate 4 e explode ⇒ 15)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 15 }
  },

  // =============== INCREASE — forçando valor da cauda da explosão ===============
  // +3 na cauda 1 do 2d4x: 1→4 explode; se tail=2 então 7→(2+4+4+2)=12; total=12+5=17
  {
    name: 'increase {2d4x,1d6x} + 0 (+3 na cauda do 2d4x; tail=2) ⇒ 17',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [3] },
    explosionsByDie: { 2: [2] },
    expected: { total: 17 }
  },
  // mesmo +3 na cauda com tail default=1 (sem map): 7→(2+4+4+1)=11? cuidado:
  // 2+4+1=7; 1→4 (+3) ⇒ 2+4+4=10; explode +1 ⇒ 11; total=11+5=16
  {
    name: 'increase {2d4x,1d6x} + 0 (+3 na cauda do 2d4x; tail default=1) ⇒ 16',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [3] },
    expected: { total: 16 }
  },

  // =============== INCREASE — múltiplos heróicos, duas explosões =================
  // +2 no d4=2 (explode +1) e +1 no d6 (explode +1) ⇒ +5 total ⇒ 17
  {
    name: 'increase {2d4x,1d6x} + 0 (+2 no d4=2 e +1 no d6; duas explosões) ⇒ 17',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [2, 1] },
    expected: { total: 17 }
  },

  // =============== INCREASE — heróico grande, evitar desperdício =================
  // +5 deveria preferir a cauda 1 do 2d4x (1→4 explode +1) ⇒ efeito +4 ⇒ 16
  {
    name: 'increase {2d4x,1d6x} + 0 (+5 deve preferir cauda do 2d4x ⇒ 16)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'increase', results: [5] },
    expected: { total: 16 }
  },

  // ========================= DECREASE =========================
  // remove primeiro a cauda (piso 0 na cauda), depois maiores valores até piso 1
  {
    name: 'decrease {2d4x,1d6x} + 0 (-1 remove cauda ⇒ 11)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'decrease', results: [1] },
    expected: { total: 11 }
  },
  {
    name: 'decrease {2d4x,1d6x} + 0 (-2 ⇒ 10)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'decrease', results: [2] },
    expected: { total: 10 }
  },
  {
    name: 'decrease {2d4x,1d6x} + 0 (-3 ⇒ 9)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'decrease', results: [3] },
    expected: { total: 9 }
  },
  {
    name: 'decrease {2d4x,1d6x} + 0 (-10 leva tudo ao piso ⇒ 3)',
    fixture: './tests/fixtures/pool-2d4x-1d6x-plus-0.json',
    hero: { mode: 'decrease', results: [10] },
    expected: { total: 3 }
  },

  {
    name: 'increase de ({2d4,1d6}) * 2 + 0 (+1 não melhora: teto em 4,4,6 ⇒ 28)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 28 }
  },
  {
    name: 'increase de ({2d4,1d6}) * 2 + 0 (+3 não melhora: mantém 28)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'increase', results: [3] },
    expected: { total: 28 }
  },
  {
    name: 'increase de ({2d4,1d6}) * 2 + 0 (+1,+1 sem efeito ⇒ 28)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'increase', results: [1, 1] },
    expected: { total: 28 }
  },

  // ================= DECREASE (multiplica o impacto por 2) =================
  {
    name: 'decrease de ({2d4,1d6}) * 2 + 0 (-1 ⇒ (14-1)*2 = 26)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [1] },
    expected: { total: 26 }
  },
  {
    name: 'decrease de ({2d4,1d6}) * 2 + 0 (-2 ⇒ 24)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [2] },
    expected: { total: 24 }
  },
  {
    name: 'decrease de ({2d4,1d6}) * 2 + 0 (-3 ⇒ 22)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [3] },
    expected: { total: 22 }
  },
  {
    name: 'decrease de ({2d4,1d6}) * 2 + 0 (-5 ⇒ 18)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [5] },
    expected: { total: 18 }
  },
  {
    name: 'decrease de ({2d4,1d6}) * 2 + 0 (-6 ⇒ 16)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [6] },
    expected: { total: 16 }
  },
  {
    name: 'decrease de ({2d4,1d6}) * 2 + 0 (-7 ⇒ 14)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [7] },
    expected: { total: 14 }
  },

  // ======= DECREASE com múltiplos heróicos (combinação ótima, piso=1 por dado) =======
  {
    name: 'decrease de ({2d4,1d6}) * 2 + 0 (-2,-3 ⇒ redução 5 ⇒ 18)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [2, 3] },
    expected: { total: 18 }
  },
  {
    name: 'decrease de ({2d4,1d6}) * 2 + 0 (-11 ⇒ floora 4,4,6 para 1,1,1 ⇒ (3)*2 = 6)',
    fixture: './tests/fixtures/parens-pool-2d4-1d6-times2-plus-0.json',
    hero: { mode: 'decrease', results: [11] },
    expected: { total: 6 }
  },

  // --- Baseline / sanity ---
  {
    name: 'increase of {1d20x,1d20x}kl + 1 (+0 => 10)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'increase', results: [] },
    expected: { total: 11 }
  },

  // --- INCREASE: raise the kept (lowest) die only helps ---
  {
    name: 'increase of {1d20x,1d20x}kl + 1 ()',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 13 }
  },
  {
    name: 'increase of {1d20x,1d20x}kl + 1 (+8 on kept 5 => ties 13 -> 14)',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'increase', results: [6] },
    expected: { total: 19 }
  },
  // {
  //   name: 'increase of {1d20x,1d20x}kl + 1 (+9 on kept 5 -> 14, lowest=13 => 14)',
  //   fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
  //   hero: { mode: 'increase', results: [9] },
  //   expected: { total: 14 }
  // },

  // // --- INCREASE: explosion on the kept can flip keep back to the other (no gain on KL) ---
  // {
  //   name: 'increase of {1d20x,1d20x}kl + 1 (+15 on kept 5 -> cap 20, tail=4 => still lowest=13 => 14)',
  //   fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
  //   hero: { mode: 'increase', results: [15] },
  //   explosionsByDie: { 0: [4] }, // dieIndex 0 = the kept “5”
  //   expected: { total: 14 } // (min(24,13)=13) + 1
  // },

  // // --- INCREASE: allocator should NOT waste on the higher die (even if it would explode) ---
  // {
  //   name: 'increase of {1d20x,1d20x}kl + 1 (+7 prefers kept 5 -> 12 => 13; not the 13 even if it could explode)',
  //   fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
  //   hero: { mode: 'increase', results: [7] },
  //   // explosionsByDie for dieIndex 1 would be ignored if allocator doesn’t push it to faces
  //   expected: { total: 13 }
  // },

  // // --- INCREASE: multiple hero dice go to the lowest to lift the minimum ---
  // {
  //   name: 'increase of {1d20x,1d20x}kl + 1 (+3,+3 -> 5→11 => 12)',
  //   fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
  //   hero: { mode: 'increase', results: [3, 3] },
  //   expected: { total: 12 }
  // },

  // // --- DECREASE: reduce the kept (lowest) die to drop total (floor=1 on base, 0 on tails) ---
  // {
  //   name: 'decrease of {1d20x,1d20x}kl + 1 (-2 on kept 5 -> 3 => 4)',
  //   fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
  //   hero: { mode: 'decrease', results: [2] },
  //   expected: { total: 4 }
  // },
  // {
  //   name: 'decrease of {1d20x,1d20x}kl + 1 (-5 floors kept 5->1 => 2)',
  //   fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
  //   hero: { mode: 'decrease', results: [5] },
  //   expected: { total: 2 }
  // },
  // {
  //   name: 'decrease of {1d20x,1d20x}kl + 1 (-1,-3 => 5→1 => 2)',
  //   fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
  //   hero: { mode: 'decrease', results: [1, 3] },
  //   expected: { total: 2 }
  // },

  // --- DECREASE: allocator should NOT spend on the higher 13 (it doesn’t lower the min) ---
  {
    name: 'decrease of {1d20x,1d20x}kl + 1 (-9 must hit 5 first -> 1; not 13->4) => 2',
    fixture: './tests/fixtures/pool-1d20x-1d20x-kl-plus-1.json',
    hero: { mode: 'decrease', results: [9] },
    expected: { total: 2 }
  },

  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+0 => 9)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [] },
    expected: { total: 9 }
  },

  // --- INCREASE: raise the kept (4). Single-hero plateaus once min reaches the other die (5) ---
  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+1 on kept 4 -> 5 => 11)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 11 }
  },
  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+2 on kept 4 -> 6, min stays 5 => 11)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 11 }
  },
  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+10 capped at 6, min=5 => 11)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [10] },
    expected: { total: 11 }
  },

  // --- INCREASE: multiple heroes — allocator should lift both dice to raise the minimum ---
  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+2,+1 -> 4→6 and 5→6 => min=6 ⇒ 13)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [2, 1] },
    expected: { total: 13 }
  },
  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+3,+3 -> 4→7(capped 6), 5→8(capped 6) => min=6 ⇒ 13)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [3, 3] },
    expected: { total: 13 }
  },
  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+1,+1,+1,+1,+1 -> both to 6 => min=6 ⇒ 13)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [1, 1, 1, 1, 1] },
    expected: { total: 13 }
  },

  // --- INCREASE: allocator should avoid spending on the higher 5 when it doesn’t raise min ---
  {
    name: 'increase of ({1d6,1d6}kl) * 2 + 1 (+1 should target 4, not 5 => 11)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 11 }
  },

  // --- DECREASE: floor=1 on base dice (no tails here), aim at the kept to lower min ---
  {
    name: 'decrease of ({1d6,1d6}kl) * 2 + 1 (-1 on kept 4 -> 3 ⇒ 7)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'decrease', results: [1] },
    expected: { total: 7 }
  },
  {
    name: 'decrease of ({1d6,1d6}kl) * 2 + 1 (-3 floors kept 4->1 ⇒ 3)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'decrease', results: [3] },
    expected: { total: 3 }
  },
  {
    name: 'decrease of ({1d6,1d6}kl) * 2 + 1 (-1,-1 -> 4→2 ⇒ 5)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'decrease', results: [1, 1] },
    expected: { total: 5 }
  },
  {
    name: 'decrease of ({1d6,1d6}kl) * 2 + 1 (-1,-3 -> 4→1; 5→4 ⇒ 3)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'decrease', results: [1, 3] },
    expected: { total: 3 }
  },
  {
    name: 'decrease of ({1d6,1d6}kl) * 2 + 1 (-2,-2 -> 4→2→1 (cap) ⇒ 3)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'decrease', results: [2, 2] },
    expected: { total: 3 }
  },
  {
    name: 'decrease of ({1d6,1d6}kl) * 2 + 1 (-6 wastes over floor -> 4→1 ⇒ 3)',
    fixture: './tests/fixtures/parens-pool-1d6-1d6-kl-times2-plus-1.json',
    hero: { mode: 'decrease', results: [6] },
    expected: { total: 3 }
  },

  {
    name: 'increase: baseline (no hero) => 57',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'increase', results: [] },
    expected: { total: 57 }
  },

  // INCREASE — simples (+1 vira +2 no total por causa do *2)
  {
    name: 'increase: +1 (no explosion) => 59',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 59 }
  },

  // INCREASE — escolher o melhor alvo para explodir (sem map => default tail=1)
  // Melhor é d8-tail 6→8 (+2) e explode 1 => inner +3 ⇒ total +6
  {
    name: 'increase: +2 (hits d8 to 8, default explode=1) => 63',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 63 }
  },

  // INCREASE — forçar explosão no d6-tail (2→6) com cauda 4
  // inner +4 (cap) +4 (explosion) = +8 ⇒ total +16
  // {
  //   name: 'increase: +4 forces d6-tail explode=4 => 73',
  //   fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
  //   hero: { mode: 'increase', results: [4] },
  //   explosionsByDie: { /* replace */ D6_TAIL_IDX: [4] },
  //   expected: { total: 73 }
  // },

  // INCREASE — alternativa: explodir o d8-tail (6→8) com cauda 6
  // inner +2 (cap) +6 (explosion) = +8 ⇒ total +16
  // {
  //   name: 'increase: +2 forces d8-tail explode=6 => 73',
  //   fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
  //   hero: { mode: 'increase', results: [2] },
  //   explosionsByDie: { /* replace */ D8_TAIL_IDX: [6] },
  //   expected: { total: 73 }
  // },

  // INCREASE — heróico grande, sem map (sobra descartada no cap)
  // Melhor alvo: d6-tail 2→6 (+4) e explode default=1 ⇒ inner +5 ⇒ total +10
  {
    name: 'increase: +10 (caps and wastes overflow; default explode=1) => 67',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'increase', results: [10] },
    expected: { total: 67 }
  },

  // INCREASE — dois heróicos: um para explodir d8, outro melhora o restante
  // +2 no d8-tail (explode=1) ⇒ inner +3; +1 no d6-tail 2→3 ⇒ +1; total inner +4 ⇒ +8
  {
    name: 'increase: +2,+1 (d8 explodes default=1; +1 no d6-tail) => 65',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'increase', results: [2, 1] },
    expected: { total: 65 }
  },

  // DECREASE — atua primeiro na cauda do d6 (floor 0), depois bases (floor 1)
  {
    // -1: 2→1 (inner -1) ⇒ total -2
    name: 'decrease: -1 (d6-tail 2→1) => 55',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'decrease', results: [1] },
    expected: { total: 55 }
  },
  {
    // -2: 2→0 (inner -2) ⇒ total -4
    name: 'decrease: -2 (d6-tail 2→0) => 53',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'decrease', results: [2] },
    expected: { total: 53 }
  },
  // {
  //   // -3: 2→0 e -1 em alguma base 6/8 (floor 1) ⇒ inner -3 ⇒ total -6
  //   name: 'decrease: -3 (zero tail then -1 base) => 51',
  //   fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
  //   hero: { mode: 'decrease', results: [3] },
  //   expected: { total: 51 }
  // },

  // DECREASE — composto: -2 (zera tail) e -2 nas bases (floors respeitados)
  {
    name: 'decrease: -2,-2 (tail→0; -2 distribuído em bases) => 49',
    fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
    hero: { mode: 'decrease', results: [2, 2] },
    expected: { total: 49 }
  },

  // DECREASE — forte: -7 ⇒ inner 28-7=21 ⇒ total 43
  // {
  //   name: 'decrease: -7 (optimal spread; floors apply) => 43',
  //   fixture: './tests/fixtures/parens-sum-1d6x-plus-1d8x-times2-plus-1.json',
  //   hero: { mode: 'decrease', results: [7] },
  //   expected: { total: 43 }
  // },

  {
    name: 'baseline: no hero => 27',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [] },
    expected: { total: 27 }
  },

  // INCREASE — pequenos incrementos (devem mirar o grupo mantido)
  {
    name: 'increase: +1 on kept => 29',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [1] },
    expected: { total: 29 }
  },
  // +2 no d6-tail (4→6) explode default=1 => +3 no inner => +6 no total
  {
    name: 'increase: +2 hits d6-tail to faces (default explode=1) => 33',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [2] },
    expected: { total: 33 }
  },
  // Força cauda=6 na explosão do d6-tail (inner +8 => total +16)
  // {
  //   name: 'increase: +2 forces d6-tail explode=6 => 43',
  //   fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
  //   hero: { mode: 'increase', results: [2] },
  //   explosionsByDie: { /* replace */ D6_TAIL_IDX: [6] },
  //   expected: { total: 43 }
  // },

  // INCREASE — mirar o d8=2 do grupo mantido
  // cap 2→8 (+6) com explode default=1 => inner +7 => total +14
  {
    name: 'increase: +6 caps d8 to 8 (default explode=1) => 41',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [6] },
    expected: { total: 41 }
  },
  // Se cauda da explosão do d8 for 6, inner +12 (flip para 22) => total 47
  // {
  //   name: 'increase: +6 on d8 with explode=6 flips kept to 22 => 47',
  //   fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
  //   hero: { mode: 'increase', results: [6] },
  //   explosionsByDie: { /* replace */ D8_BASE_IDX: [6] },
  //   expected: { total: 47 }
  // },

  // INCREASE — dois heróicos: explode d8 (default=1) e depois fecha d6-tail
  // +6 no d8 => inner +7 (12→19); +2 no d6-tail => inner +3 (19→22) => total 47 (flip)
  {
    name: 'increase: +6,+2 (d8 default explode=1; then d6-tail) => 47',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'increase', results: [6, 2] },
    expected: { total: 47 }
  },

  // INCREASE — overflow deve ser descartado (um heróico só aplica em um alvo)
  // +10 no d8: cap usa 6, explode=1 (+7 net) => 12→19 => total 41
  // {
  //   name: 'increase: +10 single die (cap+waste; default explode=1) => 41',
  //   fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
  //   hero: { mode: 'increase', results: [10] },
  //   expected: { total: 41 }
  // },

  // DECREASE — agir 1º na cauda (floor 0), depois nas bases (floor 1)
  {
    name: 'decrease: -1 (tail 4→3) => 25',
    fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
    hero: { mode: 'decrease', results: [1] },
    expected: { total: 25 }
  },
  // {
  //   name: 'decrease: -5 (tail 4→0; d8 2→1) => 17',
  //   fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
  //   hero: { mode: 'decrease', results: [5] },
  //   expected: { total: 17 }
  // },
  // {
  //   name: 'decrease: -10 (tail 0; d8 1; d6 6→1) => 7',
  //   fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
  //   hero: { mode: 'decrease', results: [10] },
  //   expected: { total: 7 }
  // },
  // {
  //   name: 'decrease: -2,-2 (tail 4→2; depois -2 em bases) => 19',
  //   fixture: './tests/fixtures/parens-pool-sum-1d6x-plus-1d8x-kl-times2-plus-3.json',
  //   hero: { mode: 'decrease', results: [2, 2] },
  //   expected: { total: 19 }
  // },

  // {
  //   name: 'baseline: kept group stays 7',
  //   fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
  //   hero: { mode: 'increase', results: [] },
  //   expected: { total: 7 }
  // },

  // // INCREASE — should target the kept group (2,2,3)
  // {
  //   name: 'increase: +1 => 8',
  //   fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
  //   hero: { mode: 'increase', results: [1] },
  //   expected: { total: 8 }
  // },
  // {
  //   name: 'increase: +3 prefers d6 (cap 3→6) => 10',
  //   fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
  //   hero: { mode: 'increase', results: [3] },
  //   expected: { total: 10 }
  // },
  // {
  //   name: 'increase: +5 single die (cap then waste) => 10',
  //   fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
  //   hero: { mode: 'increase', results: [5] },
  //   expected: { total: 10 }
  // },

  // // INCREASE — flip the kept group (raise 7 above 11 so 11 becomes the new kept)
  // {
  //   name: 'increase: +2,+2 (cap both d4: 2→4,2→4) => 11 (flip)',
  //   fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
  //   hero: { mode: 'increase', results: [2, 2] },
  //   expected: { total: 11 }
  // },
  // {
  //   name: 'increase: +3,+2 (d6 to 6; one d4 to 4) => 11 (flip)',
  //   fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
  //   hero: { mode: 'increase', results: [3, 2] },
  //   expected: { total: 11 }
  // },
  // {
  //   name: 'increase: +3,+2,+2 (cap all kept dice to 4,4,6) => 11 (flip)',
  //   fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
  //   hero: { mode: 'increase', results: [3, 2, 2] },
  //   expected: { total: 11 }
  // },
  // {
  //   name: 'increase: +10 single die (best is d6 to 6; waste rest) => 10',
  //   fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
  //   hero: { mode: 'increase', results: [10] },
  //   expected: { total: 10 }
  // },

  // // DECREASE — floor=1 per die, no tails here
  // {
  //   name: 'decrease: -1 => 6',
  //   fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
  //   hero: { mode: 'decrease', results: [1] },
  //   expected: { total: 6 }
  // },
  // {
  //   name: 'decrease: -2,-2 => 3 (floor all kept dice to 1)',
  //   fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
  //   hero: { mode: 'decrease', results: [2, 2] },
  //   expected: { total: 3 }
  // },
  // {
  //   name: 'decrease: -4 => 3 (same end-state, extra waste)',
  //   fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
  //   hero: { mode: 'decrease', results: [4] },
  //   expected: { total: 3 }
  // },
  // {
  //   name: 'decrease: -10 => 3 (fully floored, heavy waste)',
  //   fixture: './tests/fixtures/pool-nested-2d4-1d6-kl-plus-0.json',
  //   hero: { mode: 'decrease', results: [10] },
  //   expected: { total: 3 }
  // },

  // {
  //   name: 'baseline: kept=8, discarded=10 => 19',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
  //   hero: { mode: 'increase', results: [] },
  //   expected: { total: 19 }
  // },

  // // INCREASE on the kept group (raise KL towards 10)
  // {
  //   name: 'increase: +1 on kept (5→6 hits face, +tail=1 default) => 23',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
  //   hero: { mode: 'increase', results: [1] },
  //   // d6(5→6) creates 1 explosion with default tail 1 → kept 8→10 ⇒ 10*2+3
  //   expected: { total: 23 }
  // },
  // {
  //   name: 'increase: +2 on kept d4=2 (2→4 face, tail=1 default) still capped by KL => 23',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
  //   hero: { mode: 'increase', results: [2] },
  //   // kept rises to 11 but KL with other=10 ⇒ 10*2+3
  //   expected: { total: 23 }
  // },
  // {
  //   name: 'increase: big single (+10 on kept) wastes after cap, KL=10 => 23',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
  //   hero: { mode: 'increase', results: [10] },
  //   expected: { total: 23 }
  // },

  // // INCREASE with explicit explosion control (you will set the dieIndex)
  // {
  //   name: 'increase: push kept d4=2 to face (tail=3) → kept>10, KL clamps to 10 => 23',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
  //   hero: { mode: 'increase', results: [2] },
  //   explosionsByDie: { /* TODO: dieIndex of kept d4=2 */ X: [3] },
  //   expected: { total: 23 }
  // },

  // // INCREASE spread across both groups to truly raise the KL (flip beyond 10)
  // {
  //   name: 'increase: [2,2,2] → kept: 8→13, other: 10→12 ⇒ KL=12 => 27',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
  //   hero: { mode: 'increase', results: [2, 2, 2] },
  //   // Typical path: d6(5→6,+1 tail)=+2 → kept=10; d4(2→4,+1 tail)=+3 → kept=13;
  //   // then invest in other (e.g., d6 1→3) → other=12 ⇒ min(13,12)=12 ⇒ 12*2+3
  //   expected: { total: 27 }
  // },

  // // DECREASE — always try to lower the currently kept (min) group first
  // {
  //   name: 'decrease: -1 on kept ⇒ 7*2+3 => 17',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
  //   hero: { mode: 'decrease', results: [1] },
  //   expected: { total: 17 }
  // },
  // {
  //   name: 'decrease: -3 best on kept d6 (5→2) ⇒ 5*2+3 => 13',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
  //   hero: { mode: 'decrease', results: [3] },
  //   expected: { total: 13 }
  // },
  // {
  //   name: 'decrease: single big (-4 on kept d6 5→1, waste rest) ⇒ 4*2+3 => 11',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
  //   hero: { mode: 'decrease', results: [4] },
  //   expected: { total: 11 }
  // },
  // {
  //   name: 'decrease: two heroes [-3,-3] floor kept to 4 ⇒ 4*2+3 => 11',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
  //   hero: { mode: 'decrease', results: [3, 3] },
  //   expected: { total: 11 }
  // },
  // {
  //   name: 'decrease: fully floor kept ([-4,-3,-3] or similar) ⇒ 3*2+3 => 9',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kl-times2-plus-3.json',
  //   hero: { mode: 'decrease', results: [4, 3, 3] },
  //   expected: { total: 9 }
  // },

  // {
  //   name: 'baseline: kept=15, discarded=8 => 30',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
  //   hero: { mode: 'increase', results: [] },
  //   expected: { total: 30 }
  // },

  // // INCREASE — prefer buff the kept group; tiny bump that triggers a tail explosion
  // // Kept group has a d4 tail = 3; +1 → 4 (face) triggers 1 tail by default => +2 no grupo ⇒ total 34
  // {
  //   name: 'increase: +1 hits kept d4 tail (3→4 + 1 tail) => 34',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
  //   hero: { mode: 'increase', results: [1] },
  //   // opcional para tornar determinístico (ajuste X para o dieIndex do segmento tail=3 do mantido)
  //   explosionsByDie: { 6: [1] },
  //   expected: { total: 34 }
  // },

  // // INCREASE — melhor alvo é o d6=3: +3 → 6 bate face e explode com tail=1 (padrão) => +4 no grupo ⇒ 38
  // {
  //   name: 'increase: +3 on kept d6 (3→6 + 1 tail) => 38',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
  //   hero: { mode: 'increase', results: [3] },
  //   expected: { total: 38 }
  // },

  // // INCREASE — controlando a cauda da explosão para validar integração com installExplosionsByDie
  // // Força a cauda do d6 a ser 6: +3 (3→6) + 6 (tail) = +9 no grupo ⇒ 24 * 2 = 48
  // {
  //   name: 'increase: +3 on kept d6 (force tail=6) => 48',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
  //   hero: { mode: 'increase', results: [3] },
  //   explosionsByDie: { 7: [6] },
  //   expected: { total: 48 }
  // },

  // // INCREASE — valor maior com possível desperdício continua correto (cap + tail)
  // // +4 aplicado ao d6 (3→6 usa 3; 1 sobra é descartada) + tail=1 => +4 no grupo ⇒ 38
  // {
  //   name: 'increase: +4 (cap waste allowed) => 38',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
  //   hero: { mode: 'increase', results: [4] },
  //   expected: { total: 38 }
  // },

  // // DECREASE — mira o grupo mantido para reduzir o KH
  // // Melhor alvo é o tail d4=3 (piso 0): -1 ⇒ grupo 14 ⇒ total 28
  // {
  //   name: 'decrease: -1 on kept (best = tail 3→2) => 28',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
  //   hero: { mode: 'decrease', results: [1] },
  //   expected: { total: 28 }
  // },

  // // -3 no tail 3→0 (piso 0) reduz 3 pontos no grupo ⇒ 12 * 2 = 24
  // {
  //   name: 'decrease: -3 on kept tail (3→0) => 24',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
  //   hero: { mode: 'decrease', results: [3] },
  //   expected: { total: 24 }
  // },

  // // Dois heróicos: melhor combinação derruba dois segmentos relevantes do mantido
  // // Ex.: -2 no d6 (3→1) e -2 no d4(4→2) ⇒ -4 no grupo ⇒ 11 * 2 = 22
  // {
  //   name: 'decrease: [-2,-2] best combo on kept => 22',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
  //   hero: { mode: 'decrease', results: [2, 2] },
  //   expected: { total: 22 }
  // },

  // // Flip proposital do KH: esvazia o mantido abaixo de 8 para forçar o outro grupo (8) a ser mantido
  // // Sequência exemplo: -4 no d4(4→0), -4 em outro 4→0, -3 no tail 3→0, -2 no d6 3→1
  // // Queda total = 4+4+3+2 = 13 ⇒ grupo 15→2 ⇒ KH passa a 8 ⇒ 8 * 2 = 16
  // {
  //   name: 'decrease: big multi-hero to flip to other group (target 8) => 16',
  //   fixture: './tests/fixtures/parens-pool-nested-2d4x-1d6x-kh-times2-plus-0.json',
  //   hero: { mode: 'decrease', results: [4, 4, 3, 2] },
  //   expected: { total: 16 }
  // }
];

// =============== 9) Runner ALL ======================
(async () => {
  let okAll = true;
  for (const c of cases) {
    const ok = await runCase(c);
    okAll = okAll && ok;
  }
  process.exit(okAll ? 0 : 1);
})();
