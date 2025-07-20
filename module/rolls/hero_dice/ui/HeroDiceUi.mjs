import { createChatMessage } from '../../../helpers/chatUtils.mjs';
import { templatePath } from '../../../helpers/templates.mjs';
import { $fmt, $l10n } from '../../../helpers/globalUtils.mjs';

const { renderTemplate } = foundry.applications.handlebars;

export class HeroDiceUI {
  static getHeroDiceSelect(actor, includeZero = false, healingHouseRuleEnabled = false) {
    const maxHeroDice = actor.system.hero_dice?.value ?? 0;
    const options = Array.from(
      { length: maxHeroDice },
      (_, i) => `<option value="${i + 1}">${i + 1}</option>`
    ).join('');

    return `
      <div class="form-group">
        <label>${$l10n('SDM.ItemQuantity')}</label>
        <select name="heroicQty">
          ${includeZero ? '<option value="0">0</option>' : ''}
          ${options}
        </select>
      </div>
      ${
        healingHouseRuleEnabled
          ? `<div class="form-group">
               <label for="healingHouseRule">${$l10n('SDM.SettingsHealingHouseRule')}</label>
               <input id="healingHouseRule" type="checkbox" name="healingHouseRule" />
               <p>${$l10n('SDM.SettingsHealingHouseRuleHint')}</p>
             </div>`
          : ''
      }`;
  }

  static async renderResultToChat(result, actor) {
    const {
      keptDice,
      explosiveDice,
      distribution,
      nonTargetValue,
      total,
      targetMultiplier,
      targetGroupTotal,
      keepRule
    } = result;

    const remainingDice = explosiveDice.map(die => ({
      ...die,
      original: die.originalResults[0].result,
      isKept: keptDice.includes(die),
      dieFaces: die.faces
    }));

    const explosions = explosiveDice
      .filter(die => die.newExplosions.length)
      .map(die => ({
        dieFaces: die.faces,
        isKept: keptDice.includes(die),
        chain: die.newExplosions,
        index: die.dieIndex
      }));

    const defaultHeroDiceType = game.settings.get('sdm', 'defaultHeroDiceType');
    const heroDiceType = actor?.system?.hero_dice?.dice_type || defaultHeroDiceType;
    const heroicIndexes = remainingDice
      .filter(remaining => remaining.isKept)
      .flatMap(remaining => (remaining.heroicAllocated || []).map(heroic => heroic.index));

    const sortedHeroDice = [...distribution.heroicResults].sort((a, b) => {
      const aUsed = heroicIndexes.includes(a.index);
      const bUsed = heroicIndexes.includes(b.index);

      // Both in used or both not used = preserve original order
      if (aUsed === bUsed) return 1;

      // Only a is used = a comes first
      if (aUsed) return -1;

      // Only b is used = b comes first
      return 1;
    });

    const templateData = {
      dice: remainingDice,
      heroicTotal: sortedHeroDice,
      heroicUsed: heroicIndexes,
      total,
      modifiers: nonTargetValue,
      multiplier: targetMultiplier !== 1 ? CONFIG.SDM.damageMultiplier[`*${targetMultiplier}`] : '',
      diceTotal: targetGroupTotal,
      keepCount: keepRule.count,
      explosions,
      heroDiceType
    };

    const heroResultRoll = Roll.fromTerms([
      new NumericTerm({number: total})
    ]);

    heroResultRoll._evaluated = true;
    heroResultRoll._total = total;

    return createChatMessage({
      actor,
      content: await renderTemplate(templatePath('/chat/hero-dice-result'), templateData),
      flavor: $fmt('SDM.RollTitle', {
        prefix: '',
        title: $l10n('SDM.FieldHeroDice')
      }),
      rolls: [heroResultRoll],
      flags: { 'sdm.isHeroResult': true }
    });
  }
}
