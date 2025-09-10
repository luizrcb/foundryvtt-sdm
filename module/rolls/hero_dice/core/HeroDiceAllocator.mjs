import { KeepRule } from '../models/KeepRule.mjs';

/**
 * Allocates heroic dice to explosive dice based on different strategies.
 * Handles both keep-highest (kh) and keep-lowest (kl) allocation rules.
 */
export class HeroDiceAllocator {
  /**
   * Allocates heroic dice to explosive dice based on keep rule
   * @param {ExplosiveDie[]} explosiveDice - Dice to allocate to
   * @param {Object[]} heroicResults - Heroic dice results
   * @param {KeepRule} keepRule - Keep rule to apply
   * @returns {Object} Allocation result with distribution details
   */
  static allocate(explosiveDice, heroicResults, keepRule, { mode = 'increase' } = {}) {
    if (mode === 'decrease') {
      return this._allocateDecrease(explosiveDice, heroicResults, keepRule);
    }
    return keepRule.type === KeepRule.TYPES.KEEP_HIGHEST
      ? this._allocateKeepHigh(explosiveDice, heroicResults, keepRule)
      : this._allocateKeepLow(explosiveDice, heroicResults, keepRule);
  }

  /**
   * Allocates for keep-highest strategy
   * @private
   * @param {ExplosiveDie[]} explosiveDice - Dice to allocate to
   * @param {Object[]} heroicResults - Heroic dice results
   * @param {KeepRule} keepRule - Keep rule to apply
   * @returns {Object} Allocation result
   */
  static _allocateKeepHigh(explosiveDice, heroicResults, keepRule) {
    if (keepRule.isKeepAll(explosiveDice.reduce((sum, die) => sum + die.activeResults.length, 0))) {
      return this._maximizeTotal(explosiveDice, heroicResults);
    }

    const sortedDice = [...explosiveDice].sort((a, b) => b.getBaseValue() - a.getBaseValue());

    //const candidateDice = sortedDice.slice(0, keepRule.count);
    const candidateDice = [...sortedDice];
    const sortedHero = [...heroicResults].sort((a, b) => b.result - a.result);
    const distribution = new Map();

    for (const die of candidateDice) {
      const base = die.getBaseValue();
      const needed = die.faces - base;

      if (base >= die.faces) continue; // already maxed out

      let allocated = false;

      // Phase 1: Exact match
      for (let i = 0; i < sortedHero.length; i++) {
        if (sortedHero[i].result === needed) {
          this._allocateToDie(die, sortedHero, i, distribution);
          allocated = true;
          break;
        }
      }

      // Phase 2: Best fit
      if (!allocated) {
        let bestFitIndex = -1;
        let minExcess = Infinity;

        for (let i = 0; i < sortedHero.length; i++) {
          if (sortedHero[i].result >= needed) {
            const excess = sortedHero[i].result - needed;
            if (excess < minExcess) {
              minExcess = excess;
              bestFitIndex = i;
            }
          }
        }

        if (bestFitIndex !== -1) {
          this._allocateToDie(die, sortedHero, bestFitIndex, distribution);
          allocated = true;
        }
      }

      // Phase 3: Optmized Combination
      if (!allocated && sortedHero.length > 0) {
        const combination = this._findOptimizedCombination(sortedHero, needed);
        if (combination) {
          combination
            .reverse()
            .forEach(index => this._allocateToDie(die, sortedHero, index, distribution));
          allocated = true;
        }
      }

      if (!allocated && sortedHero.length > 0) {
        const bestHeroIndex = sortedHero.findIndex(h => h.result > 0);
        if (bestHeroIndex !== -1) {
          this._allocateToDie(die, sortedHero, bestHeroIndex, distribution);
          allocated = true;
          sortedHero.sort((a, b) => b.result - a.result); // keep sorted
        }
      }

      if (allocated) {
        sortedHero.sort((a, b) => b.result - a.result);
      }
    }

    const diceWithValues = explosiveDice.map(die => ({
      die,
      value: die.modifiedValue
    }));

    let keptDice;
    if (keepRule.isKeepAll(diceWithValues.length)) {
      keptDice = diceWithValues;
    } else {
      keptDice = [...diceWithValues]
        .sort((a, b) => b.value - a.value) // keep highest
        .slice(0, keepRule.count);
    }

    const keptDiceSet = new Set(keptDice.map(entry => entry.die));

    for (const die of distribution.keys()) {
      if (!keptDiceSet.has(die)) {
        distribution.delete(die);
      }
    }

    return this._buildDistributionResult(distribution, explosiveDice, keepRule, heroicResults);
  }

  /**
   * Maximizes total value when keeping all dice
   * @private
   * @param {ExplosiveDie[]} explosiveDice - Dice to allocate to
   * @param {Object[]} heroicResults - Heroic dice results
   * @returns {Object} Allocation result
   */
  static _maximizeTotal(explosiveDice, heroicResults) {
    const sortedDice = [...explosiveDice].sort((a, b) => a.getBaseValue() - b.getBaseValue());
    const sortedHero = [...heroicResults].sort((a, b) => b.result - a.result);
    const distribution = new Map();

    for (const heroDie of sortedHero) {
      let bestDie = null;
      let bestImprovement = 0;

      for (const die of sortedDice) {
        if (die.modifiedValue >= die.faces) continue;

        const potential = Math.min(die.faces, die.modifiedValue + heroDie.result);
        const improvement = potential - die.modifiedValue;

        if (improvement > bestImprovement) {
          bestDie = die;
          bestImprovement = improvement;
        }
      }

      if (bestDie) {
        bestDie.modifiedValue = Math.min(bestDie.faces, bestDie.modifiedValue + heroDie.result);

        if (!distribution.has(bestDie)) {
          distribution.set(bestDie, []);
        }
        distribution.get(bestDie).push(heroDie);
        bestDie.heroicAllocated.push(heroDie);
      }
    }

    return this._buildDistributionResult(distribution, explosiveDice, null, heroicResults);
  }

  /**
   * Allocates for keep-lowest strategy
   * @private
   * @param {ExplosiveDie[]} explosiveDice - Dice to allocate to
   * @param {Object[]} heroicResults - Heroic dice results
   * @param {KeepRule} keepRule - Keep rule to apply
   * @returns {Object} Allocation result
   */
  static _allocateKeepLow(explosiveDice, heroicResults, keepRule) {
    // Ordenar dados originais por valor base (crescente)
    const sortedDice = [...explosiveDice].sort((a, b) => a.getBaseValue() - b.getBaseValue());

    // Ordenar dados heróicos por valor (decrescente)
    const sortedHero = [...heroicResults].sort((a, b) => b.result - a.result);

    // Inicializar melhor alocação
    let bestAllocation = Array(heroicResults.length).fill(-1);
    let bestMinValue = -Infinity;

    // Função recursiva com poda de otimização
    const search = (heroIndex, allocation, currentValues) => {
      if (heroIndex === sortedHero.length) {
        // Calcular menor valor no conjunto mantido
        const keptValues = [...currentValues].sort((a, b) => a - b).slice(0, keepRule.count);
        const currentMin = Math.min(...keptValues);

        // Atualizar melhor solução encontrada
        if (currentMin > bestMinValue) {
          bestMinValue = currentMin;
          bestAllocation = [...allocation];
        }
        return;
      }

      // Poda: Verificar se é possível superar a melhor solução
      const possibleImprovement = sortedHero
        .slice(heroIndex)
        .reduce((sum, hero) => sum + hero.result, 0);

      const maxPossibleValues = currentValues.map((val, idx) =>
        Math.min(sortedDice[idx].faces, val + possibleImprovement)
      );

      const maxPossibleKept = [...maxPossibleValues].sort((a, b) => a - b).slice(0, keepRule.count);

      const maxPossibleMin = Math.min(...maxPossibleKept);

      if (maxPossibleMin <= bestMinValue) {
        return;
      }

      // Tentar alocar para cada dado original
      for (let dieIdx = 0; dieIdx < sortedDice.length; dieIdx++) {
        const die = sortedDice[dieIdx];
        const newValues = [...currentValues];

        // Aplicar dado heróico (respeitando limite máximo)
        newValues[dieIdx] = Math.min(die.faces, newValues[dieIdx] + sortedHero[heroIndex].result);

        const newAllocation = [...allocation];
        newAllocation[heroIndex] = dieIdx;

        search(heroIndex + 1, newAllocation, newValues);
      }
    };

    // Valores iniciais dos dados
    const initialValues = sortedDice.map(die => die.getBaseValue());
    search(0, Array(heroicResults.length).fill(-1), initialValues);

    // Aplicar melhor alocação encontrada
    const distribution = new Map();
    bestAllocation.forEach((dieIdx, heroIndex) => {
      if (dieIdx === -1) return;

      const die = sortedDice[dieIdx];
      const hero = sortedHero[heroIndex];

      die.modifiedValue = Math.min(die.faces, die.modifiedValue + hero.result);
      die.heroicAllocated.push(hero);

      if (!distribution.has(die)) {
        distribution.set(die, []);
      }
      distribution.get(die).push(hero);
    });

    // Coletar índices de dados heróicos usados
    const usedHeroIndexes = [];
    for (const [die, allocations] of distribution.entries()) {
      for (const alloc of allocations) {
        usedHeroIndexes.push(alloc.index);
      }
    }

    return {
      distribution,
      explosionCount: explosiveDice.filter(d => d.modifiedValue === d.faces).length,
      usedHeroIndexes,
      heroicResults: sortedHero,
      keepRule
    };
  }

  /**
   * Greedy minimal allocator for "decrease" mode:
   * - Subtracts hero dice from targets (clamped to >= 1)
   * - Chooses the target that yields the greatest DECREASE in the post-keep total
   * - Works for both kh and kl by re-evaluating the kept set after each placement
   */
  static _allocateDecrease(explosiveDice, heroicResults, keepRule) {
    // Work on a shadow view of current totals (do not mutate real dice until end)
    const state = explosiveDice.map(die => ({
      die,
      faces: die.faces,
      total: die.getTotal(), // current effective total for keep preview
      _alloc: [] // store per-hero placements (by {result,index})
    }));

    // sort heroes by size desc so large decreases are applied first
    const heroes = [...heroicResults].filter(h => h.result > 0).sort((a, b) => b.result - a.result);

    const keptSum = totals => {
      const arr = totals
        .slice()
        .sort((a, b) => (keepRule.type === KeepRule.TYPES.KEEP_HIGHEST ? b - a : a - b));
      return arr.slice(0, keepRule.count).reduce((s, x) => s + x, 0);
    };

    const currentScore = () => keptSum(state.map(s => s.total));

    const applyDecreasePreview = (current, hv) => {
      const roomDown = Math.max(0, current - 1); // how much we can reduce without going under 1
      const used = Math.min(roomDown, hv);
      return current - used; // discard overflow automatically
    };

    // Greedy placement: pick the target die that *most decreases* the kept sum
    for (const hero of heroes) {
      const before = currentScore();
      let bestIdx = 0;
      let bestDelta = +Infinity; // we want the most negative delta

      for (let i = 0; i < state.length; i++) {
        const preview = state.map(s => s.total);
        preview[i] = applyDecreasePreview(preview[i], hero.result);
        const after = keptSum(preview);
        const delta = after - before; // negative is good (reduces kept sum)

        if (delta < bestDelta) {
          bestDelta = delta;
          bestIdx = i;
        }
      }

      // commit placement into state
      state[bestIdx].total = applyDecreasePreview(state[bestIdx].total, hero.result);
      state[bestIdx]._alloc.push(hero);
    }

    // Now mutate the real dice: subtract (with clamp) the sum placed on each die.
    const distribution = new Map();
    for (const s of state) {
      if (!s._alloc.length) continue;

      // We faithfully track which hero dice were used on which die.
      distribution.set(s.die, s._alloc.slice());

      // Apply once to the actual die: subtract and clamp at 1.
      const sum = s._alloc.reduce((acc, h) => acc + h.result, 0);
      const roomDown = Math.max(0, s.die.modifiedValue - 1);
      const used = Math.min(roomDown, sum);
      s.die.modifiedValue = Math.max(1, s.die.modifiedValue - used);
      s.die.heroicAllocated.push(...s._alloc);
    }

    // Bookkeeping mirrors your build result
    const usedHeroIndexes = [];
    for (const [, allocs] of distribution.entries()) {
      for (const a of allocs) usedHeroIndexes.push(a.index);
    }

    return {
      distribution,
      // When decreasing, no new explosions will happen (engine disables explosions).
      explosionCount: explosiveDice.filter(d => d.modifiedValue === d.faces).length,
      usedHeroIndexes,
      keepRule,
      heroicResults
    };
  }

  /**
   * Allocates a heroic die to a specific explosive die
   * @private
   * @param {ExplosiveDie} die - Target explosive die
   * @param {Object[]} heroicPool - Heroic dice pool
   * @param {number} index - Index in heroic pool
   * @param {Map} distribution - Current distribution map
   */
  static _allocateToDie(die, heroicPool, index, distribution) {
    const allocated = heroicPool.splice(index, 1)[0];
    die.heroicAllocated.push(allocated);
    die.modifiedValue += allocated.result;
    distribution.set(die, die.heroicAllocated);
  }

  /**
   * Finds optimal combination of heroic dice to reach needed value
   * @private
   * @param {Object[]} heroicPool - Heroic dice pool
   * @param {number} needed - Value needed to reach
   * @returns {number[]|null} Array of indices or null
   */
  static _findOptimizedCombination(heroicPool, needed) {
    // Encontrar a melhor combinação de dados heróicos que atinja ou exceda o valor necessário
    let bestCombo = null;
    let minWaste = Infinity;

    // Usar abordagem iterativa com stack para evitar recursão profunda
    const stack = [{ index: 0, combo: [], sum: 0 }];

    while (stack.length > 0) {
      const { index, combo, sum } = stack.pop();

      // Verificar se encontramos uma combinação válida
      if (sum >= needed) {
        const waste = sum - needed;
        if (waste < minWaste || (waste === minWaste && combo.length < bestCombo?.length)) {
          bestCombo = combo;
          minWaste = waste;
        }
        continue;
      }

      // Adicionar próximas combinações possíveis
      for (let i = index; i < heroicPool.length; i++) {
        const hero = heroicPool[i];
        const newSum = sum + hero.result;

        // Poda: só continuar se ainda não atingiu o desperdício mínimo
        if (newSum - needed < minWaste) {
          stack.push({
            index: i + 1,
            combo: [...combo, hero],
            sum: newSum
          });
        }
      }
    }

    // Retornar índices da melhor combinação encontrada
    return bestCombo?.map(hero => heroicPool.indexOf(hero));
  }

  /**
   * Builds final distribution result object
   * @private
   * @param {Map} distribution - Allocation distribution
   * @param {ExplosiveDie[]} explosiveDice - All explosive dice
   * @param {KeepRule} keepRule - Applied keep rule
   * @param {Object[]} heroicResults - Heroic dice results
   * @returns {Object} Formatted result
   */
  static _buildDistributionResult(distribution, explosiveDice, keepRule, heroicResults) {
    const usedHeroIndexes = [];
    for (const [die, allocations] of distribution.entries()) {
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
}
