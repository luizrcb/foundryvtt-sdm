import { ExplosiveDie } from '../models/ExplosiveDie.mjs';
import { RollAnalyzer } from './RollAnalyzer.mjs';
import { HeroDiceAllocator } from './HeroDiceAllocator.mjs';
import { KeepRule } from '../models/KeepRule.mjs';
import { Die } from '../../../helpers/constants.mjs';

/**
 * Core engine for processing heroic dice applications to rolls.
 * Handles the full workflow from roll analysis to final result calculation.
 */
export class HeroDiceEngine {
  /**
   * Processes heroic dice application to a roll
   * @async
   * @param {Roll} originalRoll - The original Foundry Roll to modify
   * @param {number} heroicDiceQty - Number of heroic dice to apply
   * @param {number} heroicBonusQty - Bonus heroic dice (already rolled elsewhere or setting)
   * @param {Actor} actor - Actor applying the heroic dice
   * @param {Object} [options]
   * @param {'increase'|'decrease'} [options.mode='increase'] - How to apply hero dice
   * @param {boolean} [options.displayDice=true]
   * @param {boolean} [options.healingHouseRule=false]
   * @returns {Promise<Object>} Final result object with:
   *   @property {number} total - Final modified roll total
   *   @property {ExplosiveDie[]} explosiveDice - Modified dice
   *   @property {ExplosiveDie[]} keptDice - Dice kept by keep rule
   *   @property {number} targetMultiplier - Multiplier applied to target group
   *   @property {number} nonTargetValue - Value from non-target terms
   *   @property {number} targetGroupTotal - Total of target group after modifications
   *   @property {Object} distribution - Heroic dice allocation details
   *   @property {Object} keepRule - Keep rule used
   */
  static async process(originalRoll, heroicDiceQty, heroicBonusQty = 0, actor, options = {}) {
    const {
      mode = 'increase',
      displayDice = true,
      healingHouseRule = false,
      fixedResult
    } = options;

    // 1) Analisar a rolagem para descobrir o alvo e metadados
    const analyzer = new RollAnalyzer(originalRoll);
    const {
      targetDice,
      targetMultiplier,
      nonTargetValue,
      targetTerms,
      shouldExplode = false
    } = await analyzer.identifyTargetComponents();

    // 2) Preparar ExplosiveDie por resultado individual (mantendo groupId quando houver)
    const explosiveDice = [];
    let chainId = 0;
    targetDice.forEach(dieTerm => {
      const thisChain = chainId++;
      const faces = Number(dieTerm.faces) || 0;
      const groupId = dieTerm.groupId ?? dieTerm._groupId ?? null;

      // Cada "result" ativo vira um segmento que podemos modificar individualmente
      (dieTerm.results || []).forEach((result, index) => {
        const prev = dieTerm.results[index - 1];
        const isTail =
          shouldExplode && index > 0 && (prev?.exploded === true || prev?.result === dieTerm.faces);

        // pseudoTerm: 1 resultado por ExplosiveDie
        const pseudoTerm = {
          dieIndex: explosiveDice.length,
          results: [result],
          groupId: dieTerm.groupId ?? dieTerm._groupId ?? null,
          chainId,
          segmentIndex: index,
          isExplosionSegment: isTail
        };
        const canExplode = shouldExplode && !result.exploded;
        const e = new ExplosiveDie(pseudoTerm, faces, canExplode);
        if (groupId != null) e.groupId = groupId; // <- importante para pools/parentheses (kh/kl por grupo)
        explosiveDice.push(e);
      });
    });

    // 3) Se não há dados alvo, devolve resultado "pass-through" e mantém heroicResults para a UI
    //    (também evita quebrar a alocação quando state = [])
    const defaultHeroDiceType = game.settings.get('sdm', 'defaultHeroDiceType');
    const heroDiceType = actor?.system?.hero_dice?.dice_type || defaultHeroDiceType;

    // Rola os dados heróicos (antes do early return para termos heroicResults para UI)
    const heroicRoll = await this._rollHeroDice({
      quantity: heroicDiceQty + heroicBonusQty,
      faces: Die[heroDiceType],
      fixedResult,
      displayDice,
      healingHouseRule,
      resource: 'hero_dice'
    });

    const heroicResultsArr =
      heroicRoll?.dice?.[0]?.results?.map((hr, index) => ({ result: hr.result, index })) || [];

    // Atualiza recurso do ator
    await this.updateHeroDice(actor, heroicDiceQty);

    if (!explosiveDice.length) {
      const passthroughTotal = Number(originalRoll?.total) || 0;
      return {
        total: passthroughTotal,
        explosiveDice: [],
        keptDice: [],
        targetMultiplier: 1,
        nonTargetValue: 0,
        targetGroupTotal: passthroughTotal,
        diceTotal: passthroughTotal,
        distribution: {
          distribution: new Map(),
          usedHeroIndexes: [],
          heroicResults: heroicResultsArr
        },
        keepRule: new KeepRule(KeepRule.TYPES.KEEP_HIGHEST, 0)
      };
    }

    // 4) Keep rule (ciente de escopo 'die' ou 'group' para pools)
    const keepRule = analyzer.getKeepRule(targetTerms);

    // 5) Distribuição dos dados heróicos (modo increase/decrease)
    const distribution = HeroDiceAllocator.allocate(explosiveDice, heroicResultsArr, keepRule, {
      mode
    });

    // garantir heroicResults para a UI (independente do caminho no allocator)
    if (!distribution.heroicResults) {
      distribution.heroicResults = heroicResultsArr;
    }

    // 6) Aplicar heróicos (explosões reais acontecem dentro de ExplosiveDie.applyHeroic)
    for (const exploDie of explosiveDice) {
      await exploDie.applyHeroic();
    }

    // 7) Calcular e retornar o resultado final (group-aware)
    return this._calculateFinalResult(
      explosiveDice,
      distribution,
      keepRule,
      targetMultiplier,
      nonTargetValue
    );
  }

  /**
   * Rolls heroic dice
   * @private
   * @async
   * @param {object} args
   * @param {number} args.quantity
   * @param {number} [args.faces=Die.d6]
   * @param {Roll} [args.fixedResult]
   * @param {boolean} [args.displayDice=true]
   * @param {boolean} [args.healingHouseRule=false]
   * @returns {Promise<Roll>} The resulting Roll object
   */
  static async _rollHeroDice({
    quantity,
    faces = Die.d6,
    fixedResult,
    displayDice = true,
    healingHouseRule = false,
    resource = 'hero_dice'
  }) {
    const resourceSetting = game.settings.get('sdm', `${resource}_style`);

    const diceFormula = `${quantity}d${faces}[${resourceSetting}]`;
    let roll = new Roll(diceFormula);

    if (healingHouseRule) {
      roll = new Roll(`{${diceFormula}, ${diceFormula}}kh`);
    }

    await roll.evaluate();

    if (displayDice && game.dice3d) await game.dice3d.showForRoll(roll);

    if (fixedResult) return Promise.resolve(fixedResult);
    return roll;
  }

  /**
   * Updates actor's heroic dice resource
   * @private
   * @async
   * @param {Actor} actor - Actor to update
   * @param {number} qty - Quantity of dice to deduct
   */
  static async updateHeroDice(actor, qty, shouldUseTouristDice = true) {
    await actor.updateHeroDice(qty, shouldUseTouristDice);
  }

  /**
   * Calculates final result after heroic dice application
   * - ciente de KH/KL por dado ('die') e por grupo ('group')
   * @private
   * @param {ExplosiveDie[]} explosiveDice - Modified dice
   * @param {Object} distribution - Heroic dice allocation details
   * @param {KeepRule} keepRule - Keep rule used
   * @param {number} targetMultiplier - Multiplier for target group
   * @param {number} nonTargetValue - Value from non-target terms
   * @returns {Object} Final result object
   */
  /**
   * Calcula o resultado final após aplicar os dados heróicos.
   * Respeita o escopo do KeepRule:
   *  - scope: 'die'  -> mantém por dado (comportamento antigo)
   *  - scope: 'group'-> agrega por groupId (usado em pools {…}kh/kl)
   *
   * @private
   * @param {ExplosiveDie[]} explosiveDice - Dados modificados
   * @param {Object} distribution - Detalhes de alocação dos dados heróicos
   * @param {KeepRule} keepRule - Regra de keep (kh/kl) + scope
   * @param {number} targetMultiplier - Multiplicador do grupo alvo
   * @param {number} nonTargetValue - Valor dos termos não-alvo
   * @returns {Object} Resultado final
   */
  static _calculateFinalResult(
    explosiveDice,
    distribution,
    keepRule,
    targetMultiplier,
    nonTargetValue
  ) {
    // 1) Totais por dado (após alocação, antes de explosões adicionais já aplicadas via ExplosiveDie.applyHeroic)
    const diceWithTotals = explosiveDice.map(die => ({
      die,
      total: typeof die.getTotal === 'function' ? die.getTotal() : Number(die.modifiedValue || 0),
      groupId: die.groupId ?? null
    }));

    const isKH = keepRule?.type === KeepRule.TYPES.KEEP_HIGHEST;
    const keepCount = Math.max(1, Number(keepRule?.count || 1));
    const scope = keepRule?.scope || 'die';

    let keptDiceEntries;

    if (scope === 'group') {
      // 2) Agrupa por groupId
      const byGroup = new Map(); // groupId -> { sum, entries[] }
      for (const entry of diceWithTotals) {
        const gid = entry.groupId;
        if (!byGroup.has(gid)) byGroup.set(gid, { sum: 0, entries: [] });
        const bucket = byGroup.get(gid);
        bucket.sum += Number(entry.total || 0);
        bucket.entries.push(entry);
      }

      // 3) Ordena grupos por soma (KH: desc, KL: asc) e pega os 'keepCount' grupos
      const groupsArr = Array.from(byGroup.entries()); // [groupId, {sum, entries}]
      groupsArr.sort((a, b) => (isKH ? b[1].sum - a[1].sum : a[1].sum - b[1].sum));
      const keptGroups = groupsArr.slice(0, Math.min(keepCount, groupsArr.length));

      // 4) Mantém todos os dados dos grupos escolhidos
      keptDiceEntries = keptGroups.flatMap(([, bucket]) => bucket.entries);
    } else {
      // Escopo por dado (comportamento anterior)
      const sorted = [...diceWithTotals].sort((a, b) =>
        isKH ? b.total - a.total : a.total - b.total
      );
      keptDiceEntries = sorted.slice(0, Math.min(keepCount, sorted.length));
    }

    // 5) Soma dos dados mantidos
    const diceTotal = keptDiceEntries.reduce((sum, e) => sum + (Number(e.total) || 0), 0);

    // 6) Aplica multiplicador do grupo alvo e soma não-alvo
    const targetGroupTotal = diceTotal * (Number(targetMultiplier) || 1);
    const total = targetGroupTotal + (Number(nonTargetValue) || 0);

    // 7) Retorna no formato esperado pela UI
    return {
      total,
      explosiveDice,
      keptDice: keptDiceEntries.map(e => e.die),
      targetMultiplier,
      nonTargetValue,
      targetGroupTotal,
      diceTotal,
      distribution,
      keepRule
    };
  }
}
