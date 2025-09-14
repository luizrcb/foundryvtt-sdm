import { KeepRule } from '../models/KeepRule.mjs';

export class HeroDiceAllocator {
  /**
   * Entrada única para alocação de dados heróicos.
   * @param {ExplosiveDie[]} explosiveDice
   * @param {{result:number,index:number}[]} heroicResults
   * @param {KeepRule} keepRule
   * @param {{mode:'increase'|'decrease'}} opts
   */
  static allocate(explosiveDice, heroicResults, keepRule, { mode = 'increase' } = {}) {
    if (mode === 'decrease') {
      return this._allocateDecrease(explosiveDice, heroicResults, keepRule);
    }
    return this._allocateIncreaseGreedy(explosiveDice, heroicResults, keepRule);
  }

  // =========================
  // INCREASE (unificado + robusto)
  // =========================

  /**
   * INCREASE (ajustado):
   * - Phase 0 (combo): tenta formar explosões via combinações (menor waste), com gate “melhora kept”
   *   e “somente kept” quando KL+group.
   * - Greedy por herói:
   *     • regra normal — em KL+group só considera dados do grupo mantido e aceita se o kept melhorar;
   *     • NOVO fallback “fronteira” — em KL+group, se não houver jogada que melhore o kept agora,
   *       permite um passo que aumente algum grupo na fronteira mínima (empate no menor somatório),
   *       para destravar a melhoria no próximo heróico.
   * - Safety final para KL+group: se ao fim não melhorou, não gasta nada.
   */
  static _allocateIncreaseGreedy(explosiveDice, heroicResults, keepRule) {
    // ---------- sanitize ----------
    const cleanDice = Array.isArray(explosiveDice) ? explosiveDice.filter(Boolean) : [];
    const heroesAll = Array.isArray(heroicResults)
      ? heroicResults.filter(h => h && typeof h.result === 'number' && h.result > 0)
      : [];

    if (cleanDice.length === 0 || heroesAll.length === 0) {
      return {
        distribution: new Map(),
        explosionCount: 0,
        usedHeroIndexes: [],
        keepRule,
        heroicResults: heroesAll
      };
    }

    // ---------- shadow state ----------
    const state = cleanDice.map(die => ({
      die,
      faces: Number(die?.faces) || 0,
      total:
        typeof die?.getTotal === 'function'
          ? Number(die.getTotal()) || 0
          : Number(die?.modifiedValue) || 0,
      groupId: die?.groupId ?? null,
      canExplode: !!die?.canExplode,
      _alloc: []
    }));

    // working copy
    let heroes = [...heroesAll];

    // ---------- helpers ----------
    const scope = keepRule?.scope || 'die';
    const keepCount = Math.max(1, Number(keepRule?.count || 1));
    const isKH = keepRule?.type === KeepRule.TYPES.KEEP_HIGHEST;
    const isKL = keepRule?.type === KeepRule.TYPES.KEEP_LOWEST;
    const isGroupScoped = scope === 'group';
    const isKLGroup = isKL && isGroupScoped;

    const applyIncCap = (current, hv, faces) => {
      const c = Number(current) || 0;
      const h = Number(hv) || 0;
      const f = Math.max(0, Number(faces) || 0);
      const roomUp = Math.max(0, f - c);
      const used = Math.min(roomUp, h);
      return c + used;
    };

    const groupKeyOf = s =>
      isGroupScoped ? (s.groupId ?? s.die?.dieIndex ?? 0) : (s.die?.dieIndex ?? 0);

    const keptGroupKeys = (entries = state) => {
      const by = new Map();
      for (const s of entries) {
        const k = groupKeyOf(s);
        by.set(k, (by.get(k) ?? 0) + Number(s.total || 0));
      }
      let arr = Array.from(by.entries());
      if (!arr.length) return new Set([0]);
      arr.sort((a, b) => (isKH ? b[1] - a[1] : a[1] - b[1]));
      return new Set(arr.slice(0, Math.max(1, keepCount)).map(([k]) => k));
    };

    const computeGroupSums = (entries = state) => {
      const by = new Map();
      for (const s of entries) {
        const k = groupKeyOf(s);
        by.set(k, (by.get(k) ?? 0) + Number(s.total || 0));
      }
      return by;
    };

    // grupos cuja soma == menor soma atual (fronteira mínima)
    const frontierGroupsKL = () => {
      const sums = computeGroupSums(state);
      if (!sums.size) return new Set([0]);
      let min = +Infinity;
      for (const v of sums.values()) if (v < min) min = v;
      const set = new Set();
      for (const [k, v] of sums.entries()) if (v === min) set.add(k);
      return set;
    };

    const facesHitsCount = entries => {
      let count = 0;
      for (const e of entries) {
        if (!e || typeof e.total !== 'number') continue;
        if (!e?.die?.canExplode) continue;
        const faces = Number(e.faces ?? e.die?.faces ?? 0);
        const total = Number(e.total ?? 0);
        if (faces > 0 && total >= faces) count++;
      }
      return count;
    };

    const scorePreview = entriesRaw => {
      const entries = [];
      for (let i = 0; i < (entriesRaw?.length || 0); i++) {
        const e = entriesRaw[i];
        if (!e || typeof e.total !== 'number') continue;
        entries.push(e);
      }

      const by = new Map();
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const key = isGroupScoped ? (e.groupId ?? e.die?.dieIndex ?? 0) : (e.die?.dieIndex ?? 0);
        const contrib = Number(e.total || 0) + Number(e.nudge || 0);
        by.set(key, (by.get(key) ?? 0) + contrib);
      }

      let arr = Array.from(by.values());
      if (!arr.length) arr = [0];

      arr.sort((a, b) => (isKH ? b - a : a - b));
      const kept = arr.slice(0, Math.min(keepCount, arr.length));

      const sum = kept.reduce((s, x) => s + x, 0);
      const min = kept.length ? kept.reduce((m, x) => Math.min(m, x), +Infinity) : 0;

      return {
        sum,
        min,
        hits: facesHitsCount(entries)
      };
    };

    const betterThan = (a, b) => {
      if (!b) return true;
      if (isKH) {
        if (a.sum !== b.sum) return a.sum > b.sum;
        return false;
      }
      // KL
      if (a.min !== b.min) return a.min > b.min;
      if (a.sum !== b.sum) return a.sum > b.sum;
      return false;
    };

    const snapshotEntries = customTotals => {
      if (Array.isArray(customTotals)) return customTotals;
      return state.map(s => ({
        die: s.die,
        groupId: s.groupId,
        total: Number(s.total || 0),
        nudge: 0,
        faces: Number(s.faces || s.die?.faces || 0)
      }));
    };

    const baseScore = scorePreview(snapshotEntries());
    const baseKeptSet = keptGroupKeys(state);

    // =========================
    // PHASE 0 — combo-aware (push to faces)
    // =========================
    const needList = state
      .map((s, idx) => ({
        idx,
        need: Math.max(0, Number(s.faces || 0) - Number(s.total || 0)),
        canExplode: s.canExplode,
        kept: baseKeptSet.has(groupKeyOf(s))
      }))
      .filter(x => x.need > 0 && x.canExplode);

    if (heroes.length === 1 && needList.length) {
      const hv = Number(heroes[0].result) || 0;

      const poolList = isKLGroup ? needList.filter(x => x.kept) : needList;

      const coverable = poolList
        .filter(x => hv >= x.need)
        .sort((a, b) => hv - a.need - (hv - b.need)); // menor waste primeiro

      const exact = coverable.filter(x => x.need === hv);

      const tryApplyPhase0Single = sel => {
        const s = state[sel.idx];
        const afterTotal = Math.min(s.faces, s.total + hv);

        const preview = snapshotEntries().map((e, j) =>
          j === sel.idx
            ? {
                ...e,
                total: afterTotal,
                nudge: afterTotal >= s.faces && s.canExplode ? (s.faces + 1) / 2 : 0
              }
            : e
        );

        const sc = scorePreview(preview);
        if (isKLGroup && !betterThan(sc, baseScore)) return false; // só gasta se melhorar kept

        s.total = afterTotal;
        s._alloc.push(heroes[0]);
        heroes = [];
        return true;
      };

      let applied = false;
      if (exact.length && !applied) applied = tryApplyPhase0Single(exact[0]);
      if (coverable.length && !applied) applied = tryApplyPhase0Single(coverable[0]);
    } else if (needList.length && heroes.length > 0) {
      // multi-hero combos
      const restrictPhase0ToKept = isKLGroup;

      needList.sort((a, b) => (a.kept === b.kept ? a.need - b.need : a.kept ? -1 : 1));

      const findBestComboIdxs = (pool, need) => {
        const combo = HeroDiceAllocator._findOptimizedCombination(pool, need);
        return combo && combo.length ? combo : null;
      };

      for (const item of needList) {
        if (!heroes.length) break;
        if (restrictPhase0ToKept && !item.kept) continue;

        const s = state[item.idx];
        if (s.total >= s.faces) continue;

        const comboIdxs = findBestComboIdxs(heroes, item.need);
        if (!comboIdxs || !comboIdxs.length) continue;

        const picked = [];
        const sortedIdxs = [...comboIdxs].sort((a, b) => b - a);
        for (const ci of sortedIdxs) {
          const h = heroes.splice(ci, 1)[0];
          if (h) picked.push(h);
        }
        if (!picked.length) continue;

        const sumPicked = picked.reduce((acc, h) => acc + (Number(h.result) || 0), 0);
        const afterTotal = Math.min(s.faces, s.total + sumPicked);

        const preview = snapshotEntries().map((e, j) =>
          j === item.idx
            ? {
                ...e,
                total: afterTotal,
                nudge: afterTotal >= s.faces && s.canExplode ? (s.faces + 1) / 2 : 0
              }
            : e
        );
        const sc = scorePreview(preview);
        if (isKLGroup && !betterThan(sc, baseScore)) {
          for (const h of picked) heroes.push(h); // desfaz pick
          continue;
        }

        s.total = afterTotal;
        s._alloc.push(...picked);
      }
    }

    // =========================
    // GREEDY per hero (remaining) com gates p/ KL+group
    // =========================
    heroes.sort((a, b) => b.result - a.result);

    for (let h = 0; h < heroes.length; h++) {
      const hero = heroes[h];

      const baseEntries = snapshotEntries();
      const baseSc = scorePreview(baseEntries);
      const keptNow = keptGroupKeys(state);

      let bestIdx = -1;
      let bestScore = null;
      let foundImprovingMove = false;

      for (let i = 0; i < state.length; i++) {
        const s = state[i];

        // Em KL+group: só considerar dados do grupo mantido atual
        if (isKLGroup && !keptNow.has(groupKeyOf(s))) continue;

        const candidateTotal = applyIncCap(s.total, hero.result, s.faces);
        if (candidateTotal <= Number(s.total || 0)) continue; // não melhorou o próprio dado

        const hitsFaces = Number(candidateTotal) >= Number(s.faces || 0);
        const nudge = hitsFaces && s.canExplode ? (Number(s.faces || 0) + 1) / 2 : 0;

        const preview = state.map((x, j) => ({
          die: x.die,
          groupId: x.groupId,
          total: j === i ? Number(candidateTotal) : Number(x.total || 0),
          nudge: j === i ? Number(nudge) : 0,
          faces: Number(x.faces || x.die?.faces || 0)
        }));

        const sc = scorePreview(preview);

        // Gate KL+group: só aceitar se melhora kept (min/sum)
        if (isKLGroup && !betterThan(sc, baseSc)) continue;

        foundImprovingMove = true;

        if (bestScore === null || betterThan(sc, bestScore)) {
          bestScore = sc;
          bestIdx = i;
        }
      }

      if (bestIdx === -1 && isKLGroup && !foundImprovingMove) {
        // ======== NOVO FALLBACK: passo de fronteira em KL+group ========
        // Se nada melhora o kept agora, permita um passo em qualquer grupo da fronteira mínima.
        const frontier = frontierGroupsKL();
        let bestFrontierIdx = -1;
        let bestFrontierGain = -1;

        for (let i = 0; i < state.length; i++) {
          const s = state[i];
          if (!frontier.has(groupKeyOf(s))) continue;

          const candidateTotal = applyIncCap(s.total, hero.result, s.faces);
          const gain = candidateTotal - Number(s.total || 0);
          if (gain <= 0) continue;

          // leve preferência por atingir faces (p/ detonar explosão depois)
          const hitsFaces = Number(candidateTotal) >= Number(s.faces || 0);
          const preference = gain + (hitsFaces && s.canExplode ? 0.01 : 0); // desempate suave

          if (preference > bestFrontierGain) {
            bestFrontierGain = preference;
            bestFrontierIdx = i;
          }
        }

        if (bestFrontierIdx !== -1) {
          const target = state[bestFrontierIdx];
          target.total = applyIncCap(target.total, hero.result, target.faces);
          target._alloc.push(hero);
          continue; // vai para o próximo heróico
        }

        // se nem fallback serve, simplesmente não usa este heróico
        continue;
      }

      if (bestIdx === -1) continue;

      const target = state[bestIdx];
      target.total = applyIncCap(target.total, hero.result, target.faces);
      target._alloc.push(hero);
    }

    // ---------- SAFETY FINAL (KL+group): só gasta se resultado final melhorar ----------
    if (isKLGroup) {
      const finalSc = scorePreview(snapshotEntries());
      if (!betterThan(finalSc, baseScore)) {
        return {
          distribution: new Map(),
          explosionCount: cleanDice.filter(
            d => (Number(d.modifiedValue) || 0) === (Number(d.faces) || -1)
          ).length,
          usedHeroIndexes: [],
          keepRule,
          heroicResults: heroesAll
        };
      }
    }

    // ---------- commit ----------
    const distribution = new Map();
    for (let i = 0; i < state.length; i++) {
      const s = state[i];
      if (!s._alloc.length) continue;

      distribution.set(s.die, s._alloc.slice());

      const sum = s._alloc.reduce((acc, h) => acc + (Number(h.result) || 0), 0);
      const roomUp = Math.max(0, (Number(s.die?.faces) || 0) - (Number(s.die?.modifiedValue) || 0));
      const used = Math.min(roomUp, sum);
      s.die.modifiedValue = Math.min(
        Number(s.die?.faces) || 0,
        (Number(s.die?.modifiedValue) || 0) + used
      );

      s.die.heroicAllocated.push(...s._alloc);
    }

    const usedHeroIndexes = [];
    for (const [, allocs] of distribution.entries()) {
      for (const a of allocs) usedHeroIndexes.push(a.index);
    }

    return {
      distribution,
      explosionCount: cleanDice.filter(
        d => (Number(d.modifiedValue) || 0) === (Number(d.faces) || -1)
      ).length,
      usedHeroIndexes,
      keepRule,
      heroicResults: heroesAll
    };
  }

  static _findCoverMinCountMinSum(heroicPool, need) {
    const n = heroicPool.length;
    if (need <= 0 || n === 0) return [];
    const pool = heroicPool
      .map((h, i) => ({ v: Number(h.result) || 0, i }))
      .sort((a, b) => b.v - a.v);
    let best = null; // {count, sum, idxs[]}
    const dfs = (idx, sum, count, idxs) => {
      if (best) {
        if (count > best.count) return;
        if (count === best.count && sum >= best.sum) return;
      }
      if (sum >= need) {
        const cand = { count, sum, idxs: [...idxs] };
        if (
          !best ||
          cand.count < best.count ||
          (cand.count === best.count && cand.sum < best.sum)
        ) {
          best = cand;
        }
        return;
      }
      if (idx >= n) return;
      const pick = pool[idx];
      dfs(idx + 1, sum + pick.v, count + 1, [...idxs, pick.i]); // pega
      dfs(idx + 1, sum, count, idxs); // não pega
    };
    dfs(0, 0, 0, []);
    return best ? best.idxs : null;
  }

  // =========================
  // DECREASE
  // =========================

  /**
   * DECREASE:
   * - gasta heróicos menores primeiro;
   * - Fase A: zera/remover segmentos de explosão (piso 0);
   * - Fase B: greedy para minimizar score mantido (escopo-aware); piso 1 no corpo, 0 na cauda.
   */
  static _allocateDecrease(explosiveDice, heroicResults, keepRule) {
    const cleanDice = Array.isArray(explosiveDice) ? explosiveDice.filter(Boolean) : [];
    const heroesAll = Array.isArray(heroicResults)
      ? heroicResults.filter(h => h && typeof h.result === 'number' && h.result > 0)
      : [];

    if (cleanDice.length === 0 || heroesAll.length === 0) {
      return {
        distribution: new Map(),
        explosionCount: undefined,
        usedHeroIndexes: [],
        keepRule,
        heroicResults: heroesAll
      };
    }

    // ---------- shadow state ----------
    const state = cleanDice.map(die => ({
      die,
      faces: Number(die?.faces) || 0,
      total:
        typeof die?.getTotal === 'function'
          ? Number(die.getTotal()) || 0
          : Number(die?.modifiedValue) || 0,
      groupId: die?.groupId ?? null,
      chainId: die?.chainId,
      segmentIndex: die?.segmentIndex,
      isExplosionSegment: !!die?.isExplosionSegment,
      _alloc: []
    }));

    // usamos os objetos originais (sem clonar), mas sempre backtrack no DFS
    const heroes = heroesAll.map((h, i) => ({
      ...h,
      result: Number(h.result) || 0,
      index: h.index ?? h.idx ?? i,
      idx: h.idx ?? h.index ?? i
    }));

    // ---------- helpers ----------
    const scope = keepRule?.scope || 'die';
    const keepType = keepRule?.type;
    const keepCount = Math.max(1, Number(keepRule?.count || 1));
    const isKH = keepType === KeepRule.TYPES.KEEP_HIGHEST;
    const isKL = keepType === KeepRule.TYPES.KEEP_LOWEST;
    const isGroupScoped = scope === 'group';

    const keyOf = s =>
      isGroupScoped ? (s.groupId ?? s.die?.dieIndex ?? 0) : (s.die?.dieIndex ?? 0);
    const floorOf = s => (s.isExplosionSegment ? 0 : 1);

    const keptScore = snapshot => {
      const by = new Map();
      for (const e of snapshot) {
        if (!e || typeof e.total !== 'number') continue;
        const k = isGroupScoped ? (e.groupId ?? e.die?.dieIndex ?? 0) : (e.die?.dieIndex ?? 0);
        by.set(k, (by.get(k) ?? 0) + Number(e.total || 0));
      }
      let arr = Array.from(by.values());
      if (!arr.length) arr = [0];
      arr.sort((a, b) => (isKH ? b - a : a - b));
      const kept = arr.slice(0, Math.min(keepCount, arr.length));
      return kept.reduce((s, x) => s + x, 0);
    };

    const snapshot = () =>
      state.map(s => ({ die: s.die, groupId: s.groupId, total: Number(s.total || 0) }));

    const scoreNow = () => keptScore(snapshot());

    const chainHasTail = () => {
      const m = new Map();
      for (const s of state) {
        if (s.isExplosionSegment && Number(s.total || 0) > 0) m.set(s.chainId, true);
        else if (!m.has(s.chainId)) m.set(s.chainId, false);
      }
      return m;
    };

    const canApplyHere = (s, chainTailMap) => {
      if (!s) return false;
      if (!s.isExplosionSegment && chainTailMap.get(s.chainId)) return false;
      return Number(s.total || 0) > floorOf(s);
    };

    const applyWholeHero = (s, heroValue) => {
      const cur = Number(s.total || 0);
      const f = floorOf(s);
      const room = Math.max(0, cur - f);
      const used = Math.min(room, Number(heroValue) || 0);
      if (used <= 0) return 0;
      s.total = cur - used;
      return used;
    };

    // ---------- busca exata (DFS) ----------
    let bestScore = scoreNow();
    let bestReduction = 0;
    let bestUsedCount = Infinity;
    let bestAllocPerDie = null;

    const dfs = hIdx => {
      if (hIdx >= heroes.length) {
        const sc = scoreNow();
        const reduction = initialScore - sc;
        const usedCount = countUsedHeroes();
        if (
          sc < bestScore ||
          (sc === bestScore &&
            (reduction > bestReduction ||
              (reduction === bestReduction && usedCount < bestUsedCount)))
        ) {
          bestScore = sc;
          bestReduction = reduction;
          bestUsedCount = usedCount;
          bestAllocPerDie = state.map(s => ({
            die: s.die,
            total: s.total,
            alloc: s._alloc.slice()
          }));
        }
        return;
      }

      const hero = heroes[hIdx];
      if (!hero || hero.result <= 0) {
        dfs(hIdx + 1);
        return;
      }

      const tails = chainHasTail();

      const candidates = [];
      for (let i = 0; i < state.length; i++) {
        const s = state[i];
        if (!canApplyHere(s, tails)) continue;
        const cur = Number(s.total || 0);
        const f = floorOf(s);
        const room = Math.max(0, cur - f);
        if (room <= 0) continue;
        candidates.push(i);
      }

      if (candidates.length === 0) {
        dfs(hIdx + 1);
        return;
      }

      const before = scoreNow();
      candidates.sort((i, j) => {
        const a = state[i],
          b = state[j];
        const usedA = Math.min(Math.max(0, Number(a.total || 0) - floorOf(a)), hero.result);
        const snapA = snapshot();
        snapA[i] = { die: a.die, groupId: a.groupId, total: Number(a.total || 0) - usedA };
        const afterA = keptScore(snapA);
        const deltaA = afterA - before;

        const usedB = Math.min(Math.max(0, Number(b.total || 0) - floorOf(b)), hero.result);
        const snapB = snapshot();
        snapB[j] = { die: b.die, groupId: b.groupId, total: Number(b.total || 0) - usedB };
        const afterB = keptScore(snapB);
        const deltaB = afterB - before;

        if (deltaA !== deltaB) return deltaA - deltaB; // mais redução primeiro
        const roomA = Math.max(0, Number(a.total || 0) - floorOf(a));
        const roomB = Math.max(0, Number(b.total || 0) - floorOf(b));
        return roomB - roomA;
      });

      for (const i of candidates) {
        const s = state[i];

        const beforeTotal = s.total;
        const used = applyWholeHero(s, hero.result);
        if (used > 0) s._alloc.push(hero);

        dfs(hIdx + 1);

        if (used > 0) s._alloc.pop();
        s.total = beforeTotal;
      }
    };

    const initialScore = scoreNow();

    const countUsedHeroes = () => {
      const used = new Set();
      for (const s of state) for (const a of s._alloc) used.add(a.index);
      return used.size;
    };

    dfs(0);

    // ---------- commit ----------
    const distribution = new Map();

    if (bestAllocPerDie) {
      for (let k = 0; k < state.length; k++) {
        const s = state[k];
        const best = bestAllocPerDie[k];
        if (!best) continue;

        s.total = Number(best.total || 0);
        s._alloc = Array.isArray(best.alloc) ? best.alloc.slice() : [];
      }
    }

    for (const s of state) {
      if (!s._alloc.length) continue;
      distribution.set(s.die, s._alloc.slice());
      s.die.modifiedValue = Math.max(floorOf(s), Number(s.total || 0));
      if (s.isExplosionSegment && s.die.modifiedValue === 0) s.die.removed = true;
      s.die.heroicAllocated.push(...s._alloc);
    }

    const usedSet = new Set();
    for (const [, allocs] of distribution.entries()) for (const a of allocs) usedSet.add(a.index);

    return {
      distribution,
      explosionCount: undefined, // não reportamos em decrease
      usedHeroIndexes: Array.from(usedSet),
      keepRule,
      heroicResults: heroesAll
    };
  }

  // =========================
  // utils (mantidos por compatibilidade)
  // =========================

  static _buildDistributionResult(distribution, explosiveDice, keepRule, heroicResults) {
    const usedHeroIndexes = [];
    for (const [, allocations] of distribution.entries()) {
      for (const alloc of allocations) {
        usedHeroIndexes.push(alloc.index);
      }
    }
    return {
      distribution,
      explosionCount: explosiveDice.filter(d => d.modifiedValue === d.faces).length,
      usedHeroIndexes,
      keepRule,
      heroicResults
    };
  }

  static _allocateToDie(die, heroicPool, index, distribution) {
    const allocated = heroicPool.splice(index, 1)[0];
    if (!allocated) return;
    die.heroicAllocated.push(allocated);
    die.modifiedValue += allocated.result;
    distribution.set(die, die.heroicAllocated);
  }

  static _findOptimizedCombination(heroicPool, needed) {
    let bestCombo = null;
    let minWaste = Infinity;

    const stack = [{ index: 0, combo: [], sum: 0 }];

    while (stack.length > 0) {
      const { index, combo, sum } = stack.pop();

      if (sum >= needed) {
        const waste = sum - needed;
        if (waste < minWaste || (waste === minWaste && combo.length < bestCombo?.length)) {
          bestCombo = combo;
          minWaste = waste;
        }
        continue;
      }

      for (let i = index; i < heroicPool.length; i++) {
        const hero = heroicPool[i];
        const newSum = sum + hero.result;
        if (newSum - needed < minWaste) {
          stack.push({
            index: i + 1,
            combo: [...combo, hero],
            sum: newSum
          });
        }
      }
    }

    if (!bestCombo) return null;
    return bestCombo.map(hero => heroicPool.indexOf(hero));
  }
}
