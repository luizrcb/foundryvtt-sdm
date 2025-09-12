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
    hero: { mode: 'increase', results: [1,1] },
    expected: { total: 43 }
  },
  {
    name: 'increase KH parens: +2,+1 no mantido => 45',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [2,1] },
    explosionsByDie: { 0: [4] },
    expected: { total: 53 }
  },

  // B) INCREASE — forçando 1 explosão no mantido (fixando o valor da explosão)
  // Ex.: +3 no "5" do mantido => bate 8 e explode. Se a explosão sair 4, grupo vira 25, total 25*2+3 = 53
  {
    name: 'increase KH parens: +3 no mantido força 1 explosão (tail=4) => 53',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [3] },
    explosionsByDie: { /* TODO: ajuste o dieIndex do segmento alvo do “5” do grupo mantido */ 0: [4] },
    expected: { total: 53 }
  },
  {
    name: 'increase KH parens: +3,+1 no mantido força explosão (tail=4) => 55',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'increase', results: [3,1] },
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
    hero: { mode: 'decrease', results: [2,3] },
    expected: { total: 29 }
  },
  {
    name: 'decrease KH parens: -6,-3 (zera tail com perda1; -3 no 8) => 23',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [6,3] },
    expected: { total: 23 }
  },
  // -6,-5 zera tail (perda1) e -5 no 8 => grupo mantido cai pra 8 e o pool flipará pro 9 descartado ⇒ total 21
  {
    name: 'decrease KH parens: -6,-5 (flip pro grupo 9) => 21',
    fixture: './tests/fixtures/parens-pool-2d8x-2d8x-kh-times2-plus-1d3-plus-1.json',
    hero: { mode: 'decrease', results: [6,5] },
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
  }
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
