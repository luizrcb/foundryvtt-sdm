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
import { TEST_CASES } from './test_cases.mjs';

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

// =============== 9) Runner ALL ======================
(async () => {
  let okAll = true;
  for (const c of TEST_CASES) {
    const ok = await runCase(c);
    okAll = okAll && ok;
  }
  process.exit(okAll ? 0 : 1);
})();
