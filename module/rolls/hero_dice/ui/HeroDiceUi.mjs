import { createChatMessage } from '../../../helpers/chatUtils.mjs';
import { $fmt, $l10n, capitalizeFirstLetter } from '../../../helpers/globalUtils.mjs';
import { templatePath } from '../../../helpers/templates.mjs';
import {
  renderSaveResult,
  renderNPCMoraleResult,
  renderCorruptionResult,
  renderReactionResult,
  renderDefeatResult,
  renderUsageResult
} from '../../ui/renderResults.mjs';

const { renderTemplate } = foundry.applications.handlebars;

export class HeroDiceUI {
  static getHeroDiceSelect(
    actor,
    includeZero = false,
    healingHouseRuleEnabled = false,
    bonusHeroDice = 0,
    includeModeToggle = true,
    resource = 'hero_dice',
    includeTouristDice = false
  ) {
    const maxHeroDice = actor.system[resource]?.value ?? 0;
    const touristDice =
      resource === 'hero_dice' && actor.system.tourist_dice.enabled
        ? actor.system.tourist_dice.value
        : 0;
    const diceAmount = includeTouristDice ? maxHeroDice + touristDice : maxHeroDice;
    const options = Array.from(
      { length: diceAmount },
      (_, i) => `<option value="${i + 1}">${i + 1}</option>`
    ).join('');

    return `
      <div class="form-group">
        <label for="heroicQty">${$l10n('SDM.ItemQuantity')}</label>
        <select name="heroicQty">
          ${includeZero ? '<option value="0">0</option>' : ''}
          ${options}
        </select>
      </div>
      ${
        bonusHeroDice > 0
          ? `
        <div class="form-group mt-10">
          <label for="bonusQty">${$l10n('SDM.BonusHeroDice')}</label>
          <input type="text" name="bonusQty" value="${bonusHeroDice}" data-dtype="Number" disabled/>
        </div>`
          : ''
      }
      ${
        healingHouseRuleEnabled
          ? `<div class="form-group">
          <label for="healingHouseRule">${$l10n('SDM.SettingsHealingHouseRule')}</label>
          <input id="healingHouseRule" type="checkbox" name="healingHouseRule" />
          <p>${$l10n('SDM.SettingsHealingHouseRuleHint')}</p>
        </div>`
          : ''
      }
      ${
        includeModeToggle
          ? `
        <div class="form-group mt-10">
          <label for="heroMode">${$l10n('SDM.HeroDiceMode') || 'Hero Dice Mode'}</label>
          <select name="heroMode">
            <option value="increase">${$l10n('SDM.HeroDiceModeIncrease') || 'Increase (boost result)'}</option>
            <option value="decrease">${$l10n('SDM.HeroDiceModeDecrease') || 'Decrease (suppress result)'}</option>
          </select>
          <p class="hint">
            ${$l10n('SDM.HeroDiceModeHint') || 'Choose whether hero dice should raise or lower the previous roll. Decrease will floor dice at 1 and never explode.'}
          </p>
        </div>`
          : ''
      }
    `;
  }

  static async renderResultToChat(result, actor, flags, heroicBonusQty = 0, heroMode = 'increase') {
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
    const actorData = actor?.system;
    const damageMultiplier = CONFIG.SDM.getDamageMultiplier(actorData.base_damage_multiplier || 2);
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
      multiplier: targetMultiplier !== 1 ? damageMultiplier[`*${targetMultiplier}`] : '',
      diceTotal: targetGroupTotal,
      keepCount: keepRule.count,
      explosions,
      heroDiceType,
      heroMode: capitalizeFirstLetter(heroMode)
    };

    const heroResultRoll = Roll.fromTerms([new foundry.dice.terms.NumericTerm({ number: total })]);

    heroResultRoll._evaluated = true;
    heroResultRoll._total = total;

    const flavor = $fmt('SDM.RollTitle', {
      prefix: '',
      title:
        $l10n('SDM.FieldHeroDice') +
        `${heroMode === 'decrease' ? `<br>${$l10n('SDM.HeroDiceModeDecrease')}` : ''}` +
        `${heroicBonusQty > 0 ? ` (${$l10n('SDM.FieldBonus')}: ${heroicBonusQty})` : ''}`
    }).replace(' :', ':');

    await createChatMessage({
      actor,
      content: await renderTemplate(templatePath('/chat/hero-dice-result'), templateData),
      flavor,
      rolls: [heroResultRoll],
      flags: {
        sdm: {
          isHeroResult: true
        }
      }
    });

    if (flags && flags?.sdm?.save) {
      const { label, targetNumber, speaker } = flags.sdm.save;
      await renderSaveResult(
        { roll: heroResultRoll, label, targetNumber },
        {
          fromHeroDice: true,
          speaker
        }
      );
    }

    if (flags && flags?.sdm?.corruption) {
      const { speaker } = flags.sdm.corruption;
      await renderCorruptionResult(
        { roll: heroResultRoll },
        {
          fromHeroDice: true,
          speaker
        }
      );
    }

    if (flags && flags?.sdm?.reaction) {
      const { charismaOperator, speaker } = flags.sdm.reaction;
      await renderReactionResult(
        { roll: heroResultRoll, charismaOperator },
        {
          fromHeroDice: true,
          speaker
        }
      );
    }

    if (flags && flags?.sdm?.defeat) {
      const { selectedAbility, speaker } = flags.sdm.defeat;
      await renderDefeatResult(
        { roll: heroResultRoll, selectedAbility },
        {
          fromHeroDice: true,
          speaker
        }
      );
    }

    if (flags && flags?.sdm?.morale) {
      const { targetNumber, speaker } = flags.sdm.morale;
      await renderNPCMoraleResult(
        { roll: heroResultRoll, targetNumber },
        {
          fromHeroDice: true,
          speaker
        }
      );
    }

    if (flags && flags?.sdm?.usage) {
      const { label, target, speaker } = flags.sdm.usage;
      await renderUsageResult(
        { roll: heroResultRoll, label, target },
        {
          fromHeroDice: true,
          speaker
        }
      );
    }
  }
}
