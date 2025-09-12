import { KeepRule } from '../models/KeepRule.mjs';

export class RollAnalyzer {
  constructor(roll) {
    this.roll = roll;
  }

  // --- duck-typing helpers ---
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

  listTerms(node) {
    const out = [];
    if (!node) return out;
    if (Array.isArray(node.terms)) out.push(...node.terms);
    if (node.term && Array.isArray(node.term.terms)) out.push(...node.term.terms);
    if (node.roll && Array.isArray(node.roll.terms)) out.push(...node.roll.terms);
    return out;
  }

  listDiceFromRoll(roll) {
    const dice = [];
    if (!roll) return dice;
    if (Array.isArray(roll.dice) && roll.dice.length) dice.push(...roll.dice);
    if (Array.isArray(roll.terms)) {
      for (const t of roll.terms) {
        if (this.isDie(t)) dice.push(t);
        else if (t?.terms) {
          for (const inner of t.terms) if (this.isDie(inner)) dice.push(inner);
        }
      }
    }
    return dice;
  }

  markExplodingFromDie(die) {
    const mods = Array.isArray(die?.modifiers) ? die.modifiers : [];
    if (mods.some(m => m === 'x')) this._shouldExplode = true;
  }

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

  // --- main dice extraction (dedup + group tagging) ---
  extractDice(term) {
    const dice = [];
    const pushUnique = this.makePusher();

    // 1) Single Die
    if (term instanceof foundry.dice.terms.Die) {
      this.markExplodingFromDie(term);
      pushUnique(dice, term);
      return dice;
    }

    // 2) PoolTerm (root or nested)
    if (term instanceof foundry.dice.terms.PoolTerm) {
      const rolls = Array.isArray(term.rolls) ? term.rolls : [];
      const res = Array.isArray(term.results) ? term.results : [];
      for (let groupIdx = 0; groupIdx < rolls.length; groupIdx++) {
        const kept = !!(res[groupIdx] && res[groupIdx].active && !res[groupIdx].discarded);
        const ds = this.listDiceFromRoll(rolls[groupIdx]);
        for (const die of ds) {
          die.groupId = groupIdx;
          die._groupId = `pool:${groupIdx}`;
          die._groupKept = kept;
          this.markExplodingFromDie(die);
          pushUnique(dice, die);
        }
      }
      return dice;
    }

    // 3) ParentheticalTerm: walk inside
    if (term instanceof foundry.dice.terms.ParentheticalTerm) {
      const innerTerms = term.roll?.terms ?? term.term?.terms ?? [];
      for (const inner of innerTerms) {
        const innerDice = this.extractDice(inner);
        for (const d of innerDice) pushUnique(dice, d);
      }
      return dice;
    }

    // 4) Any composite node
    if (term?.terms?.length) {
      for (const inner of term.terms) {
        const innerDice = this.extractDice(inner);
        for (const d of innerDice) pushUnique(dice, d);
      }
    }

    return dice;
  }

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

  // --- API ---
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

      targetTerms = this.roll.terms.filter((_, idx) => excludeIdxs.has(idx));
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

  getKeepRule(targetTerms) {
    let keepRule = new KeepRule(KeepRule.TYPES.KEEP_HIGHEST, 0);
    let totalActiveDice = 0;
    let foundKeepMod = false;

    const processTerm = term => {
      if (!term) return;

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
        this.listTerms(term).forEach(processTerm);
      } else if (Array.isArray(term.terms)) {
        term.terms.forEach(processTerm);
      }
    };

    const termsToProcess = targetTerms || this.roll.terms;
    termsToProcess.forEach(processTerm);

    if (totalActiveDice === 0) totalActiveDice = 1;
    if (!foundKeepMod) {
      keepRule = new KeepRule(KeepRule.TYPES.KEEP_HIGHEST, totalActiveDice);
      keepRule.scope = 'die';
    }
    return keepRule;
  }
}
