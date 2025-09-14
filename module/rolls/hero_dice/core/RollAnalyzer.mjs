import { KeepRule } from '../models/KeepRule.mjs';

export class RollAnalyzer {
  constructor(roll) {
    this.roll = roll;
  }

  // ========== Duck-typing helpers ==========
  isDie(term) {
    if (!term) return false;
    if (term instanceof foundry.dice.terms.Die) return true;
    return typeof term.faces === 'number' && Array.isArray(term.results);
  }

  isPool(term) {
    if (!term) return false;
    if (term instanceof foundry.dice.terms.PoolTerm) return true;
    return Array.isArray(term.rolls) && Array.isArray(term.results);
  }

  isParen(term) {
    if (!term) return false;
    if (term instanceof foundry.dice.terms.ParentheticalTerm) return true;
    return (
      (!!term.roll && (Array.isArray(term.roll.terms) || Array.isArray(term.roll.dice))) ||
      (!!term.term && Array.isArray(term.term.terms))
    );
  }

  isOp(term, op) {
    if (!term) return false;
    if (term instanceof foundry.dice.terms.OperatorTerm) return term.operator === op;
    return term?.operator === op;
  }

  isNumeric(term) {
    if (!term) return false;
    if (term instanceof foundry.dice.terms.NumericTerm) return true;
    return typeof term?.number === 'number';
  }

  // ========== Tree helpers (dedup seguro) ==========
  // CORRIGIDO: evita duplicar nós quando existem .terms, .term.terms e .roll.terms
  listTerms(node) {
    const out = [];
    if (!node) return out;

    const seen = new Set();
    const push = t => {
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    };

    if (Array.isArray(node.terms)) node.terms.forEach(push);
    if (node.term && Array.isArray(node.term.terms)) node.term.terms.forEach(push);
    if (node.roll && Array.isArray(node.roll.terms)) node.roll.terms.forEach(push);

    return out;
  }

  // Busca dados diretos dentro de um Roll (termos e/ou dice)
  // CORRIGIDO: busca profunda em Pool/Paren recursivamente
  listDiceFromRoll(roll) {
    const dice = [];
    if (!roll) return dice;

    const pushUnique = this.makePusher();

    const visit = term => {
      if (!term) return;

      if (this.isDie(term)) {
        this.markExplodingFromDie(term);
        pushUnique(dice, term);
        return;
      }

      if (this.isPool(term)) {
        const rolls = Array.isArray(term.rolls) ? term.rolls : [];
        for (const r of rolls) {
          const innerDice = this.listDiceFromRoll(r); // recursivo profundo
          for (const d of innerDice) pushUnique(dice, d);
        }
        return;
      }

      if (this.isParen(term)) {
        for (const inner of this.listTerms(term)) visit(inner);
        return;
      }

      if (Array.isArray(term.terms)) {
        for (const inner of term.terms) visit(inner);
      }
    };

    if (Array.isArray(roll.dice)) {
      for (const d of roll.dice) {
        this.markExplodingFromDie(d);
        pushUnique(dice, d);
      }
    }

    if (Array.isArray(roll.terms)) {
      for (const t of roll.terms) visit(t);
    }

    return dice;
  }

  // Marca se há explosão em algum dado
  markExplodingFromDie(die) {
    const mods = Array.isArray(die?.modifiers) ? die.modifiers : [];
    if (mods.some(m => m === 'x')) this._shouldExplode = true;
  }

  // Evita duplicar referências iguais/semelhantes
  makePusher() {
    const seenWeak = new WeakSet();
    const seenKey = new Set();
    const keyOf = d =>
      `${d.faces}|${Array.isArray(d.results) ? d.results.length : 0}|${d._groupId ?? d.groupId ?? ''}`;
    return (arr, d) => {
      if (!d) return;
      try {
        if (seenWeak.has(d)) return;
        seenWeak.add(d);
        arr.push(d);
      } catch {
        const k = keyOf(d);
        if (seenKey.has(k)) return;
        seenKey.add(k);
        arr.push(d);
      }
    };
  }

  // ========== Extração de dados-alvo (com tagging de grupo em pools) ==========
  e; // ========== Extração de dados-alvo (duck-typed; com tagging de grupo em pools) ==========
  extractDice(term) {
    const dice = [];
    const pushUnique = this.makePusher();

    const visit = node => {
      if (!node) return;

      // 1) Dado simples
      if (this.isDie(node)) {
        this.markExplodingFromDie(node);
        pushUnique(dice, node);
        return;
      }

      // 2) Pool (duck-typed): preserva tagging de grupo e kept
      if (this.isPool(node)) {
        const rolls = Array.isArray(node.rolls) ? node.rolls : [];
        const res = Array.isArray(node.results) ? node.results : [];
        for (let groupIdx = 0; groupIdx < rolls.length; groupIdx++) {
          const kept = !!(res[groupIdx] && res[groupIdx].active && !res[groupIdx].discarded);
          const innerDice = this.listDiceFromRoll(rolls[groupIdx]); // profundo
          for (const d of innerDice) {
            d.groupId = groupIdx;
            d._groupId = `pool:${groupIdx}`;
            d._groupKept = kept;
            this.markExplodingFromDie(d);
            pushUnique(dice, d);
          }
        }
        return;
      }

      // 3) Parêntese (duck-typed): caminha para dentro
      if (this.isParen(node)) {
        for (const inner of this.listTerms(node)) visit(inner);
        return;
      }

      // 4) Qualquer composto com .terms
      if (Array.isArray(node.terms)) {
        for (const inner of node.terms) visit(inner);
      }
    };

    visit(term);
    return dice;
  }

  // Soma tudo que não é alvo na raiz, respeitando sinais
  _sumNonTargetAtRoot(terms, { excludeIdxs = new Set() } = {}) {
    let acc = 0;
    let sign = 1;
    for (let i = 0; i < terms.length; i++) {
      if (excludeIdxs.has(i)) continue;
      const t = terms[i];

      if (this.isOp(t, '+')) {
        sign = 1;
        continue;
      }
      if (this.isOp(t, '-')) {
        sign = -1;
        continue;
      }

      if (this.isParen(t)) {
        acc += sign * Number(t.roll?.total || 0);
        continue;
      }
      if (this.isPool(t)) {
        acc += sign * Number(t.total || 0);
        continue;
      }
      if (this.isDie(t)) {
        const sum = (t.results || []).reduce(
          (s, r) => (r?.active !== false ? s + Number(r.result || 0) : s),
          0
        );
        acc += sign * sum;
        continue;
      }
      if (this.isNumeric(t)) {
        acc += sign * Number(t.number || 0);
        continue;
      }
    }
    return acc;
  }

  // ========== API principal ==========
  // CORRIGIDO: targetTerms contém apenas o termo-alvo; multiplicador é excluído do keep
  async identifyTargetComponents() {
    this._shouldExplode = false;

    let firstTargetIndex = -1;
    for (let i = 0; i < this.roll.terms.length; i++) {
      const t = this.roll.terms[i];
      if (this.isDie(t) || this.isPool(t) || this.isParen(t)) {
        firstTargetIndex = i;
        break;
      }
    }

    let targetDice = [];
    let targetMultiplier = 1;
    let nonTargetValue = 0;
    let targetTerms = [];
    const excludeIdxs = new Set();

    if (firstTargetIndex === -1) {
      nonTargetValue = this._sumNonTargetAtRoot(this.roll.terms, { excludeIdxs });
    } else {
      const targetTerm = this.roll.terms[firstTargetIndex];
      excludeIdxs.add(firstTargetIndex);

      targetDice = this.extractDice(targetTerm);

      // multiplicador à direita, se houver
      const opIdx = firstTargetIndex + 1;
      if (opIdx < this.roll.terms.length - 1) {
        const op = this.roll.terms[opIdx];
        const num = this.roll.terms[opIdx + 1];
        if (this.isOp(op, '*') && this.isNumeric(num)) {
          targetMultiplier = Number(num.number) || 1;
          excludeIdxs.add(opIdx);
          excludeIdxs.add(opIdx + 1);
        }
      }

      // SOMENTE o termo-alvo segue para detecção de keep
      targetTerms = [targetTerm];

      nonTargetValue = this._sumNonTargetAtRoot(this.roll.terms, { excludeIdxs });
    }

    return {
      targetDice,
      targetMultiplier,
      nonTargetValue,
      targetTerms,
      shouldExplode: !!this._shouldExplode
    };
  }

  // CORRIGIDO: dedup de nós visitados; contagem de dados ativa correta; escopo certo
  getKeepRule(targetTerms) {
    let keepRule = new KeepRule(KeepRule.TYPES.KEEP_HIGHEST, 0);
    let totalActiveDice = 0;
    let foundKeepMod = false;

    const seen = new WeakSet();
    const processOnce = term => {
      if (!term || (typeof term === 'object' && term !== null && seen.has(term))) return;
      if (typeof term === 'object' && term !== null) seen.add(term);

      if (this.isDie(term)) {
        totalActiveDice += (term.results || []).filter(r => r.active).length;

        const mods = Array.isArray(term.modifiers) ? term.modifiers : [];
        if (!foundKeepMod) {
          const km = mods.find(m => m === 'kh' || m === 'kl');
          if (km) {
            foundKeepMod = true;
            const match = km.match(/(kh|kl)(\d*)/);
            keepRule = new KeepRule(match[1], match[2] ? parseInt(match[2]) : 1);
            keepRule.scope = 'die';
          }
        }
      } else if (this.isPool(term)) {
        const rolls = Array.isArray(term.rolls) ? term.rolls : [];
        for (const r of rolls) {
          // usa busca profunda para contar todos os dados efetivamente rolados
          const ds = this.listDiceFromRoll(r);
          for (const d of ds) totalActiveDice += (d.results || []).filter(x => x.active).length;
        }

        const mods = Array.isArray(term.modifiers) ? term.modifiers : [];
        if (!foundKeepMod) {
          const km = mods.find(m => m === 'kh' || m === 'kl');
          if (km) {
            foundKeepMod = true;
            const match = km.match(/(kh|kl)(\d*)/);
            keepRule = new KeepRule(match[1], match[2] ? parseInt(match[2]) : 1);
            keepRule.scope = 'group';
          }
        }
      } else if (this.isParen(term)) {
        this.listTerms(term).forEach(processOnce);
      } else if (Array.isArray(term.terms)) {
        term.terms.forEach(processOnce);
      }
    };

    const termsToProcess = targetTerms && targetTerms.length ? targetTerms : this.roll.terms;
    termsToProcess.forEach(processOnce);

    if (totalActiveDice === 0) totalActiveDice = 1;
    if (!foundKeepMod) {
      keepRule = new KeepRule(KeepRule.TYPES.KEEP_HIGHEST, totalActiveDice);
      keepRule.scope = 'die';
    }
    return keepRule;
  }
}
