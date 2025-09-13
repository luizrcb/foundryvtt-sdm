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
   * INCREASE:
   * - Fase 0 (NOVA): tenta formar o maior nº de explosões via combinações (exato > menor desperdício), menor need primeiro.
   * - Depois, greedy por herói:
   *     KH: deltaHits > alvo não-capado > menor déficit > soma (com nudge/EV)
   *     KL: léxico (max min, depois soma)
   * - Respeita escopo do keep (die/group) na pontuação; hits sempre contam por **dado**.
   * - Explosões reais ocorrem em ExplosiveDie.applyHeroic(); aqui só cap em faces.
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
    const isKH = keepRule?.type === KeepRule.TYPES.KEEP_HIGHEST;
    const keepCount = Math.max(1, Number(keepRule?.count || 1));

    const applyIncCap = (current, hv, faces) => {
      const c = Number(current) || 0;
      const h = Number(hv) || 0;
      const f = Math.max(0, Number(faces) || 0);
      const roomUp = Math.max(0, f - c);
      const used = Math.min(roomUp, h);
      return c + used;
    };

    const groupKeyOf = s =>
      scope === 'group' ? (s.groupId ?? s.die?.dieIndex ?? 0) : (s.die?.dieIndex ?? 0);

    const keptGroupKeys = () => {
      const by = new Map();
      for (const s of state) {
        const k = groupKeyOf(s);
        by.set(k, (by.get(k) ?? 0) + Number(s.total || 0));
      }
      let arr = Array.from(by.entries());
      if (!arr.length) return new Set([0]);
      arr.sort((a, b) => (isKH ? b[1] - a[1] : a[1] - b[1]));
      return new Set(arr.slice(0, Math.max(1, keepCount)).map(([k]) => k));
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
        const key =
          scope === 'group' ? (e.groupId ?? e.die?.dieIndex ?? 0) : (e.die?.dieIndex ?? 0);
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
      if (isKH) {
        if (a.sum !== b.sum) return a.sum > b.sum;
        return false;
      }
      if (a.min !== b.min) return a.min > b.min;
      if (a.sum !== b.sum) return a.sum > b.sum;
      return false;
    };

    // =========================
    // PHASE 0 — combo-aware (push to faces)
    // Single-hero tweak: if any kept target has need === hero, prefer kept.
    // =========================
    const keptNowPhase0 = keptGroupKeys();

    const needList = state
      .map((s, idx) => ({
        idx,
        need: Math.max(0, Number(s.faces || 0) - Number(s.total || 0)),
        canExplode: s.canExplode,
        kept: keptNowPhase0.has(groupKeyOf(s))
      }))
      .filter(x => x.need > 0 && x.canExplode);

    if (heroes.length === 1 && needList.length) {
      const hv = Number(heroes[0].result) || 0;

      const keptCoverable = needList
        .filter(x => x.kept && hv >= x.need)
        .sort((a, b) => hv - a.need - (hv - b.need)); // min waste first

      const unkeptCoverable = needList
        .filter(x => !x.kept && hv >= x.need)
        .sort((a, b) => hv - a.need - (hv - b.need));

      // NEW: exact-need on kept wins
      const keptExact = keptCoverable.filter(x => x.need === hv);

      if (keptExact.length) {
        const sel = keptExact[0];
        const s = state[sel.idx];
        s.total = Math.min(s.faces, s.total + hv);
        s._alloc.push(heroes[0]);
        heroes = [];
      } else if (unkeptCoverable.length) {
        const sel = unkeptCoverable[0];
        const s = state[sel.idx];
        s.total = Math.min(s.faces, s.total + hv);
        s._alloc.push(heroes[0]);
        heroes = [];
      } else if (keptCoverable.length) {
        const sel = keptCoverable[0];
        const s = state[sel.idx];
        s.total = Math.min(s.faces, s.total + hv);
        s._alloc.push(heroes[0]);
        heroes = [];
      }
    } else if (needList.length && heroes.length > 0) {
      // multi-hero original behavior
      needList.sort((a, b) => (a.kept === b.kept ? a.need - b.need : a.kept ? -1 : 1));

      const findBestComboIdxs = (pool, need) => {
        const combo = HeroDiceAllocator._findOptimizedCombination(pool, need);
        return combo && combo.length ? combo : null;
      };

      const restrictPhase0ToKept =
        scope === 'group' && keepRule?.type === KeepRule.TYPES.KEEP_LOWEST;

      for (const item of needList) {
        if (!heroes.length) break;

        // KL + group: never push non-kept groups to faces in Phase 0
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

        const sum = picked.reduce((acc, h) => acc + (Number(h.result) || 0), 0);
        s.total = Math.min(s.faces, s.total + sum);
        s._alloc.push(...picked);
      }
    }

    // =========================
    // GREEDY per hero (remaining) with improvement-only + kept-group tie-break
    // =========================
    heroes.sort((a, b) => b.result - a.result);

    const isKL = keepRule?.type === KeepRule.TYPES.KEEP_LOWEST;

    for (let h = 0; h < heroes.length; h++) {
      const hero = heroes[h];

      const baseEntries = state.map(s => ({
        die: s.die,
        groupId: s.groupId,
        total: Number(s.total || 0),
        nudge: 0,
        faces: Number(s.faces || s.die?.faces || 0)
      }));
      const baseScore = scorePreview(baseEntries);
      const keptNow = keptGroupKeys();

      let bestIdx = -1;
      let bestScore = null;
      let hadImprovement = false;

      for (let i = 0; i < state.length; i++) {
        const s = state[i];

        const candidateTotal = applyIncCap(s.total, hero.result, s.faces);

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

        // Gate: for KL+group, prefer moves that improve the kept score; else, any die improvement
        const improvesDie = candidateTotal > Number(s.total || 0);
        const improvesKeptScore = sc.sum > baseScore.sum || sc.min > baseScore.min;
        const gateImprove = isKL && scope === 'group' ? improvesKeptScore : improvesDie;

        if (!gateImprove && hadImprovement) continue;
        if (gateImprove && !hadImprovement) {
          hadImprovement = true;
          bestScore = null;
          bestIdx = -1;
        }

        let take = false;

        if (bestScore === null || betterThan(sc, bestScore)) {
          take = true;
        } else if (bestScore && scope === 'group' && sc.sum === bestScore.sum) {
          // tie-break: prefer current kept group
          const candKept = keptNow.has(groupKeyOf(s));
          const bestKept = keptNow.has(groupKeyOf(state[bestIdx]));
          if (candKept && !bestKept) take = true;
        }

        if (take) {
          bestScore = sc;
          bestIdx = i;
        }
      }

      if (bestIdx === -1) continue;

      const target = state[bestIdx];
      target.total = applyIncCap(target.total, hero.result, target.faces);
      target._alloc.push(hero);
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
        explosionCount: 0,
        usedHeroIndexes: [],
        keepRule,
        heroicResults: heroesAll
      };
    }

    // ---------- Estado sombra ----------
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
      _alloc: [],
      _appliedSum: 0 // quanto foi efetivamente aplicado (para tail, descartar excedente)
    }));

    // Pool de heróicos de trabalho (mantemos heroesAll para UI)
    let heroes = [...heroesAll];

    const scope = keepRule?.scope || 'die';
    const keepType = keepRule?.type;
    const keepCount = Math.max(1, Number(keepRule?.count || 1));
    const isKH = keepRule?.type === KeepRule.TYPES.KEEP_HIGHEST;
    const isGroupKH = scope === 'group' && isKH;
    const isDieKH = scope === 'die' && isKH;

    // ---------- Helpers ----------
    const keyOf = s =>
      scope === 'group' ? (s.groupId ?? s.die?.dieIndex ?? 0) : (s.die?.dieIndex ?? 0);

    const keptScore = entriesRaw => {
      const by = new Map();
      for (const e of entriesRaw) {
        if (!e || typeof e.total !== 'number') continue;
        const key = keyOf(e);
        by.set(key, (by.get(key) ?? 0) + Number(e.total || 0));
      }
      let arr = Array.from(by.values());
      if (!arr.length) arr = [0];
      arr.sort((a, b) => (keepType === KeepRule.TYPES.KEEP_HIGHEST ? b - a : a - b));
      const kept = arr.slice(0, Math.min(keepCount, arr.length));
      return kept.reduce((s, x) => s + x, 0);
    };

    const currentKeptKeySet = () => {
      // Conjunto dos keys (grupos) atualmente "mantidos" segundo keep rule
      const by = new Map();
      for (const s of state) {
        const k = keyOf(s);
        by.set(k, (by.get(k) ?? 0) + Number(s.total || 0));
      }
      let arr = Array.from(by.entries()); // [key,sum]
      if (!arr.length) return new Set();
      arr.sort((a, b) => (keepType === KeepRule.TYPES.KEEP_HIGHEST ? b[1] - a[1] : a[1] - b[1]));
      return new Set(arr.slice(0, Math.min(keepCount, arr.length)).map(([k]) => k));
    };

    const applyDecFloor = (current, hv, floorVal) => {
      const c = Number(current) || 0;
      const h = Number(hv) || 0;
      const f = Number(floorVal) || 0;
      const roomDown = Math.max(0, c - f);
      const used = Math.min(roomDown, h);
      return c - used; // excedente é perda
    };

    // ---------- FASE A: remover tails (explosões) com COMBINAÇÃO ÓTIMA ----------
    const segments = state
      .filter(s => s.isExplosionSegment)
      .sort((a, b) => {
        if ((a.chainId ?? 0) !== (b.chainId ?? 0)) return (a.chainId ?? 0) - (b.chainId ?? 0);
        return (b.segmentIndex ?? 0) - (a.segmentIndex ?? 0); // mais profundo primeiro
      });

    for (const seg of segments) {
      if (!heroes.length) break;
      const need = Number(seg.total || 0);
      if (need <= 0) continue;

      // subset com soma >= need, minimizando (#dados, depois soma total)
      const idxs = HeroDiceAllocator._findCoverMinCountMinSum(heroes, need);
      if (idxs && idxs.length) {
        // remove do pool (de trás pra frente para não deslocar índices)
        const picked = [];
        idxs.sort((a, b) => b - a);
        for (const i of idxs) {
          const h = heroes.splice(i, 1)[0];
          if (h) picked.push(h);
        }

        // aplica só o necessário; excedente descartado
        const sum = picked.reduce((acc, h) => acc + (Number(h.result) || 0), 0);
        const used = Math.min(sum, need);
        seg._appliedSum += used;
        seg.total = applyDecFloor(seg.total, used, 0); // tail pode ir a 0
        seg._alloc.push(...picked);
        if (seg.total === 0) seg.die.removed = true;
      }
    }

    // ---------- FASE B: greedy para MINIMIZAR o score mantido ----------
    // Em KH (group OU die): gastar MAIORES primeiro (nivelar o topo mantido / reduzir o máximo).
    // Nos demais casos: MENORES primeiro (minimiza desperdício; bom p/ não-tail).
    heroes.sort((a, b) => (isGroupKH || isDieKH ? b.result - a.result : a.result - b.result));

    const scoreNow = () =>
      keptScore(
        state.map(s => ({
          die: s.die,
          groupId: s.groupId,
          total: Number(s.total || 0)
        }))
      );

    for (let hi = 0; hi < heroes.length; hi++) {
      const hero = heroes[hi];
      const before = scoreNow();

      // Em KH+group, priorizamos agir apenas nos grupos atualmente mantidos
      let restrictedIdx = null;
      if (isGroupKH) {
        const keptSet = currentKeptKeySet();
        let bestDeltaR = +Infinity;
        let bestIdxR = -1;

        for (let i = 0; i < state.length; i++) {
          const s = state[i];
          if (!keptSet.has(keyOf(s))) continue;

          const preview = state.map((x, j) => {
            const f = x.isExplosionSegment ? 0 : 1;
            return {
              die: x.die,
              groupId: x.groupId,
              total:
                j === i ? applyDecFloor(Number(x.total || 0), hero.result, f) : Number(x.total || 0)
            };
          });

          const after = keptScore(preview);
          const delta = after - before; // negativo é melhor

          if (delta < bestDeltaR) {
            bestDeltaR = delta;
            bestIdxR = i;
          } else if (delta === bestDeltaR && bestIdxR !== -1) {
            // tie-breaker: reduzir o grupo atualmente MAIOR (para KH)
            const by = new Map();
            for (const s2 of state) {
              const k = keyOf(s2);
              by.set(k, (by.get(k) ?? 0) + Number(s2.total || 0));
            }
            const keyCand = keyOf(state[i]);
            const keyBest = keyOf(state[bestIdxR]);
            const sumCand = by.get(keyCand) ?? -Infinity;
            const sumBest = by.get(keyBest) ?? -Infinity;

            if (sumCand > sumBest) bestIdxR = i;
            else if (sumCand === sumBest) {
              // segundo tie-breaker: maior roomDown
              const roomCand = Math.max(
                0,
                Number(state[i].total || 0) - (state[i].isExplosionSegment ? 0 : 1)
              );
              const roomBest = Math.max(
                0,
                Number(state[bestIdxR].total || 0) - (state[bestIdxR].isExplosionSegment ? 0 : 1)
              );
              if (roomCand > roomBest) bestIdxR = i;
            }
          }
        }

        if (bestIdxR !== -1) restrictedIdx = bestIdxR;
      }

      let bestIdx = restrictedIdx ?? 0;
      let bestDelta = +Infinity;

      // se não achamos nada útil dentro dos grupos mantidos, abrimos para todo mundo
      const from = restrictedIdx != null ? [restrictedIdx] : [...Array(state.length).keys()];

      for (const i of from) {
        const preview = state.map((x, j) => {
          const f = x.isExplosionSegment ? 0 : 1;
          return {
            die: x.die,
            groupId: x.groupId,
            total:
              j === i ? applyDecFloor(Number(x.total || 0), hero.result, f) : Number(x.total || 0)
          };
        });

        const after = keptScore(preview);
        const delta = after - before;

        if (delta < bestDelta) {
          bestDelta = delta;
          bestIdx = i;
        } else if (delta === bestDelta) {
          // tie-breaker global: p/ KH reduzir o grupo maior; senão, maior roomDown
          if (isGroupKH) {
            const by = new Map();
            for (const s2 of state) {
              const k = keyOf(s2);
              by.set(k, (by.get(k) ?? 0) + Number(s2.total || 0));
            }
            const keyCand = keyOf(state[i]);
            const keyBest = keyOf(state[bestIdx]);
            const sumCand = by.get(keyCand) ?? -Infinity;
            const sumBest = by.get(keyBest) ?? -Infinity;

            if (sumCand > sumBest) bestIdx = i;
            else if (sumCand === sumBest) {
              const roomCand = Math.max(
                0,
                Number(state[i].total || 0) - (state[i].isExplosionSegment ? 0 : 1)
              );
              const roomBest = Math.max(
                0,
                Number(state[bestIdx].total || 0) - (state[bestIdx].isExplosionSegment ? 0 : 1)
              );
              if (roomCand > roomBest) bestIdx = i;
            }
          } else {
            const roomCand = Math.max(
              0,
              Number(state[i].total || 0) - (state[i].isExplosionSegment ? 0 : 1)
            );
            const roomBest = Math.max(
              0,
              Number(state[bestIdx].total || 0) - (state[bestIdx].isExplosionSegment ? 0 : 1)
            );
            if (roomCand > roomBest) bestIdx = i;
          }
        }
      }

      // --------- COMMIT FASE B (com contabilização do aplicado) ---------
      const s = state[bestIdx];
      const floorVal = s.isExplosionSegment ? 0 : 1;

      // ⬅ mudança: contabiliza aplicado na Fase B
      const beforeSeg = Number(s.total || 0);
      const afterSeg = applyDecFloor(beforeSeg, hero.result, floorVal);
      const applied = beforeSeg - afterSeg; // quanto de fato foi usado aqui

      s.total = afterSeg;
      s._appliedSum = (s._appliedSum || 0) + applied; // IMPORTANTE p/ tail
      s._alloc.push(hero);

      if (s.isExplosionSegment && s.total === 0) s.die.removed = true;
    }

    // ---------- Commit real ----------
    const distribution = new Map();
    for (const s of state) {
      if (!s._alloc.length) continue;
      distribution.set(s.die, s._alloc.slice());

      // Na cauda: usar somente o que foi realmente aplicado (s._appliedSum) para evitar “reaproveitar sobra”
      const rawSum = s._alloc.reduce((acc, h) => acc + (Number(h.result) || 0), 0);
      const sum = s.isExplosionSegment ? Math.min(rawSum, s._appliedSum || 0) : rawSum;

      const floorVal = s.isExplosionSegment ? 0 : 1;
      const roomDown = Math.max(0, (Number(s.die?.modifiedValue) || 0) - floorVal);
      const used = Math.min(roomDown, sum);

      s.die.modifiedValue = Math.max(floorVal, (Number(s.die?.modifiedValue) || 0) - used);
      if (s.isExplosionSegment && s.die.modifiedValue === 0) s.die.removed = true;

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

    // retorna índices dentro de heroicPool
    if (!bestCombo) return null;
    return bestCombo.map(hero => heroicPool.indexOf(hero));
  }
}
