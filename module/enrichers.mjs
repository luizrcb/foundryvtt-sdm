import { createChatMessage } from './helpers/chatUtils.mjs';
import { ActorType } from './helpers/constants.mjs';
import { $fmt, $l10n } from './helpers/globalUtils.mjs';
import { giveCash } from './macros/gm/giveCash.mjs';
import { giveExperience } from './macros/gm/giveExperience.mjs';
import { giveHeroDice } from './macros/gm/giveHeroDice.mjs';

export default function registerTextEditorEnrichers() {
  CONFIG.TextEditor.enrichers.push({
    // [[save DC STAT]]
    pattern: /\[\[(?<command>save)\s(?<dc>\d+)\s(?<stat>\w{3})\]\](?:\s*\{(?<innerText>[^}]*)\})?/g,
    enricher: async (match, options) => {
      let { command, dc, stat, innerText } = match.groups;

      if (!parseInt(dc)) return;
      if (CONFIG.SDM.abilitiesKeys.includes(stat.toLowerCase())) {
        stat = stat.toLowerCase();
      } else {
        return;
      }

      const link = document.createElement('a');
      link.className = 'content-link';
      link.classList.add('save-roll-request');
      link.dataset.command = command;
      link.dataset.dc = dc;
      link.dataset.stat = stat;
      let linkHtml;
      const defaultText = `${$l10n('SDM.FieldSaveTarget')} ${dc} ${game.i18n.localize(CONFIG.SDM.abilities[stat])}`;
      if (innerText && innerText.trim()) {
        linkHtml = `<i class="fa-solid fa-dice-d20"></i>${innerText.trim()}`;
      } else {
        linkHtml = `<i class="fa-solid fa-dice-d20"></i>${defaultText}`;
      }
      link.dataset.tooltip = defaultText;
      switch (command) {
        case 'save':
          link.innerHTML = linkHtml;
          break;
      }
      return link;
    }
  });

  $('body').on('click', 'a.save-roll-request', event => {
    const data = event.target?.dataset ?? {};

    if (!data.command) return;

    const actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;
    if (!actor) {
      ui.notifications.warn($l10n('SDM.NoValidActor'));
      return;
    }

    if (actor.type === ActorType.CARAVAN) return;

    let stat = data.stat;

    if (actor.type === ActorType.NPC) stat = 'npc';
    return actor.performHudAction('save', stat, { rollTarget: data.dc }, true);
  });

  CONFIG.TextEditor.enrichers.push({
    // [[corruption roll]]
    pattern: /\[\[(?<command>corruption\sroll)\]\](?:\s*\{(?<innerText>[^}]*)\})?/g,
    enricher: async (match, options) => {
      let { command, innerText } = match.groups;

      const link = document.createElement('a');
      link.className = 'content-link';
      link.classList.add('corruption-roll');
      link.dataset.command = command;

      let linkHtml;
      const defaultText = `${$fmt('SDM.RollType', { type: $l10n('SDM.Corruption') })}`;
      if (innerText && innerText.trim()) {
        linkHtml = `<i class="fa-solid fa-biohazard violet"></i>${innerText.trim()}`;
      } else {
        linkHtml = `<i class="fa-solid fa-biohazard violet"></i>${defaultText}`;
      }
      link.dataset.tooltip = defaultText;
      switch (command) {
        case 'corruption roll':
          link.innerHTML = linkHtml;
          break;
      }
      return link;
    }
  });

  $('body').on('click', 'a.corruption-roll', event => {
    const data = event.target?.dataset ?? {};

    if (!data.command) return;

    const actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;
    if (!actor) {
      ui.notifications.warn($l10n('SDM.NoValidActor'));
      return;
    }

    if (actor.type === ActorType.CARAVAN) return;

    return actor.performHudAction('corruption', 'corruption', {}, true);
  });

  CONFIG.TextEditor.enrichers.push({
    // [[defeat roll]]
    pattern: /\[\[(?<command>defeat\sroll)\]\](?:\s*\{(?<innerText>[^}]*)\})?/g,
    enricher: async (match, options) => {
      let { command, innerText } = match.groups;

      const link = document.createElement('a');
      link.className = 'content-link';
      link.classList.add('defeat-roll');
      link.dataset.command = command;

      let linkHtml;
      const defaultText = `${$fmt('SDM.RollType', { type: $l10n('SDM.Defeat') })}`;
      if (innerText && innerText.trim()) {
        linkHtml = `<i class="fa-solid fa-skull dark"></i>${innerText.trim()}`;
      } else {
        linkHtml = `<i class="fa-solid fa-skull dark"></i>${defaultText}`;
      }
      link.dataset.tooltip = defaultText;
      switch (command) {
        case 'defeat roll':
          link.innerHTML = linkHtml;
          break;
      }
      return link;
    }
  });

  $('body').on('click', 'a.defeat-roll', event => {
    const data = event.target?.dataset ?? {};

    if (!data.command) return;

    const actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;
    if (!actor) {
      ui.notifications.warn($l10n('SDM.NoValidActor'));
      return;
    }

    if (actor.type === ActorType.CARAVAN) return;

    return actor.performHudAction('defeat', 'defeat', {}, true);
  });

  CONFIG.TextEditor.enrichers.push({
    // [[give 1 hero_dice]]
    // [[take 1 hero_dice]]
    pattern:
      /\[\[\s*(?<action>give|take)\s+(?<amount>\d+)\s+(?<resourceName>\w+_dice)\s*\]\]\s*(?:\{(?<innerText>[^}]*)\})?/g,
    enricher: async (match, options) => {
      let { action, amount, resourceName, innerText } = match.groups;

      let delta = parseInt(amount, 10);
      if (!delta) return;

      if (action === 'take') delta *= -1;

      if (CONFIG.SDM.resourcesKeys.includes(resourceName.toLowerCase())) {
        resourceName = resourceName.toLowerCase();
      } else {
        return;
      }

      const link = document.createElement('a');
      link.className = 'content-link';
      link.classList.add('resource-dice-management');
      link.dataset.action = action;
      link.dataset.delta = delta;
      link.dataset.resourceName = resourceName;

      let linkHtml;
      const defaultText = `${delta > 0 ? '+' : ''}${delta} ${$l10n(CONFIG.SDM.resources[resourceName])}`;
      if (innerText && innerText.trim()) {
        linkHtml = `<i class="fa-solid fa-dice-d6 ${resourceName === 'blood_dice' ? 'blood' : resourceName === 'tourist_dice' ? 'pine' : 'dark'}"></i>${innerText.trim()}`;
      } else {
        let diceColor = 'dark';
        if (resourceName === 'blood_dice') diceColor = 'blood';
        if (resourceName === 'tourist_dice') diceColor = 'pine';
        linkHtml = `<i class="fa-solid fa-dice-d6 ${diceColor}"></i>${defaultText}`;
      }
      link.dataset.tooltip = defaultText;
      link.innerHTML = linkHtml;
      return link;
    }
  });

  $('body').on('click', 'a.resource-dice-management', event => {
    const data = event.target?.dataset ?? {};

    if (!data.action) return;
    if (!data.delta) return;
    if (!data.resourceName) return;

    const actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;
    if (!actor) {
      ui.notifications.warn($l10n('SDM.NoValidActor'));
      return;
    }

    if (actor.type === ActorType.CARAVAN) return;

    return giveHeroDice({
      resourceName: data.resourceName,
      actor,
      delta: parseInt(data.delta, 10)
    });
  });

  CONFIG.TextEditor.enrichers.push({
    pattern:
      /\[\[table\s+(?<tableId>[^\s]+)\s*(?<ability>\w{3})?\s*(?<modifier>[+-]\d+)?\s*\]\]\s*(?:\{(?<innerText>[^}]*)\})?/g,
    enricher: async (match, options) => {
      let { tableId, ability, modifier, innerText } = match.groups;

      if (ability && !CONFIG.SDM.abilitiesKeys.includes(ability.toLowerCase())) {
        return;
      }
      ability = ability?.toLowerCase();

      let modValue = 0;
      if (modifier) {
        modValue = parseInt(modifier, 10);
        if (isNaN(modValue)) return;
      }

      const link = document.createElement('a');
      link.className = 'content-link';
      link.classList.add('table-roll-request');
      link.dataset.tableId = tableId;
      if (ability) link.dataset.ability = ability;
      if (modValue !== 0) link.dataset.modifier = modValue;

      let linkHtml;
      const abilityName = ability ? game.i18n.localize(CONFIG.SDM.abilities[ability]) : '';
      const modText = modValue !== 0 ? (modValue > 0 ? `+${modValue}` : `${modValue}`) : '';
      const parts = ['🎲', $l10n('DOCUMENT.RollTables')];
      if (abilityName) parts.push(abilityName);
      if (modText) parts.push(modText);
      const defaultText = parts.join(' ');
      if (innerText && innerText.trim()) {
        linkHtml = `<i class="fa-solid fa-table-list"></i>${innerText.trim()}`;
      } else {
        linkHtml = `<i class="fa-solid fa-table-list"></i>${defaultText}`;
      }
      link.dataset.tooltip = defaultText;
      link.innerHTML = linkHtml;
      return link;
    }
  });

  $('body').on('click', 'a.table-roll-request', async event => {
    const data = event.target?.dataset ?? {};
    const { tableId, ability, modifier } = data;
    if (!tableId) return;

    const actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;
    if (!actor) {
      ui.notifications.warn($l10n('SDM.NoValidActor'));
      return;
    }

    if (actor.type === ActorType.CARAVAN) return;

    let table;
    try {
      table = await fromUuid(tableId);
      if (!table || !(table instanceof RollTable)) {
        throw new Error(`Table not found: ${tableId}`);
      }
    } catch (err) {
      ui.notifications.error(`Invalid table UUID: ${tableId}`);
      console.error(err);
      return;
    }

    const baseFormula = table.formula;
    if (!baseFormula) {
      ui.notifications.warn(`Table "${table.name}" has no roll formula.`);
      return;
    }

    let abilityValue = 0;
    if (ability) {
      abilityValue = actor.system?.abilities?.[ability]?.current ?? 0;
    }

    const modValue = parseInt(modifier, 10) || 0;
    const totalBonus = abilityValue + modValue;

    let finalFormula = baseFormula;
    if (totalBonus !== 0) {
      const sign = totalBonus > 0 ? '+' : '';
      finalFormula = `${baseFormula} ${sign}${totalBonus}`;
    }

    const roll = new Roll(finalFormula);
    await roll.evaluate({ async: true });

    try {
      const drawResult = await table.draw({ roll, displayChat: true });
      if (!drawResult) {
        ui.notifications.warn(`No result found for roll ${roll.total} on table "${table.name}".`);
      }
    } catch (err) {
      ui.notifications.error(`Failed to draw from table: ${err.message}`);
      console.error(err);
    }
  });

  // Cash enricher: [[give 50 cash]] or [[take 20 cash]]{optional label}
  CONFIG.TextEditor.enrichers.push({
    pattern:
      /\[\[\s*(?<action>give|take)\s+(?<amount>\d+)\s+cash\s*\]\]\s*(?:\{(?<innerText>[^}]*)\})?/g,
    enricher: async (match, options) => {
      let { action, amount, innerText } = match.groups;

      const parsedAmount = parseInt(amount, 10);
      if (isNaN(parsedAmount) || parsedAmount <= 0) return;

      const link = document.createElement('a');
      link.className = 'content-link';
      link.classList.add('cash-management');
      link.dataset.action = action;
      link.dataset.amount = parsedAmount;

      let linkHtml;
      const actionText = action === 'give' ? $l10n('SDM.Give') : $l10n('SDM.Take');
      const defaultText = `${actionText} ${$l10n('SDM.CashSymbol')}${parsedAmount}`;
      if (innerText && innerText.trim()) {
        linkHtml = `<i class="fa-solid fa-coins ${action === 'give' ? 'pine' : 'blood'}"></i>${innerText.trim()}`;
      } else {
        linkHtml = `<i class="fa-solid fa-coins ${action === 'give' ? 'pine' : 'blood'}"></i>${defaultText}`;
      }
      link.dataset.tooltip = defaultText;
      link.innerHTML = linkHtml;
      return link;
    }
  });

  $('body').on('click', 'a.cash-management', async event => {
    const data = event.target?.dataset ?? {};
    const { action, amount } = data;
    if (!action || !amount) return;

    const actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;
    if (!actor) {
      ui.notifications.warn($l10n('SDM.NoValidActor'));
      return;
    }

    const numericAmount = parseInt(amount, 10);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      ui.notifications.error($l10n('SDM.ErrorInvalidCashAmount'));
      return;
    }

    await giveCash({
      actor: actor,
      amount: numericAmount,
      operation: action === 'give' ? 'add' : 'remove',
      displayChatSummary: true
    });
  });

  // ------------------------------------------------------------------
  // XP enricher: [[give 100 xp]] or [[give 50 experience]]{optional label}
  // ------------------------------------------------------------------
  CONFIG.TextEditor.enrichers.push({
    pattern:
      /\[\[\s*give\s+(?<amount>\d+)\s+(?<type>xp|experience)\s*\]\]\s*(?:\{(?<innerText>[^}]*)\})?/gi,
    enricher: async (match, options) => {
      let { amount, innerText } = match.groups;

      const parsedAmount = parseInt(amount, 10);
      if (isNaN(parsedAmount) || parsedAmount <= 0) return;

      const link = document.createElement('a');
      link.className = 'content-link';
      link.classList.add('xp-management');
      link.dataset.amount = parsedAmount;

      let linkHtml;
      const defaultText = `${$l10n('SDM.Give')} ${parsedAmount} ${$l10n('SDM.NpcXp')}`;
      if (innerText && innerText.trim()) {
        linkHtml = `<i class="fa-solid fa-star amber"></i>${innerText.trim()}`;
      } else {
        linkHtml = `<i class="fa-solid fa-star amber"></i>${defaultText}`;
      }
      link.dataset.tooltip = defaultText;
      link.innerHTML = linkHtml;
      return link;
    }
  });

  $('body').on('click', 'a.xp-management', async event => {
    const data = event.target?.dataset ?? {};
    const { amount } = data;
    if (!amount) return;

    const actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;
    if (!actor) {
      ui.notifications.warn($l10n('SDM.NoValidActor'));
      return;
    }

    if (actor.type === ActorType.CARAVAN) return;

    const numericAmount = parseInt(amount, 10);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      ui.notifications.error($l10n('SDM.ErrorInvalidXPAmount'));
      return;
    }

    await giveExperience({
      actor: actor,
      amount: numericAmount,
      displayChatSummary: true
    });
  });

  // Damage/Healing enricher: [[damage 2d6+4]] or [[healing 1d8]]{optional label}
  CONFIG.TextEditor.enrichers.push({
    pattern:
      /\[\[\s*(?<type>damage|healing)\s+(?<expression>[^\]]+?)\s*\]\]\s*(?:\{(?<innerText>[^}]*)\})?/gi,
    enricher: async (match, options) => {
      let { type, expression, innerText } = match.groups;
      expression = expression.trim();

      if (!foundry.dice.Roll.validate(expression)) return;

      const link = document.createElement('a');
      link.className = 'content-link';
      link.classList.add('damage-healing-roll');
      link.dataset.type = type;
      link.dataset.expression = expression;

      let linkHtml;
      const defaultText = `${type === 'damage' ? 'Damage' : 'Healing'} ${expression}`;
      if (innerText && innerText.trim()) {
        linkHtml = `<i class="fa-solid ${type === 'damage' ? 'fa-explosion rust' : 'fa-heart lime'}"></i>${innerText.trim()}`;
      } else {
        linkHtml = `<i class="fa-solid ${type === 'damage' ? 'fa-explosion rust' : 'fa-heart lime'}"></i>${defaultText}`;
      }
      link.dataset.tooltip = defaultText;
      link.innerHTML = linkHtml;
      return link;
    }
  });

  $('body').on('click', 'a.damage-healing-roll', async event => {
    const data = event.target?.dataset ?? {};
    const { type, expression } = data;
    if (!type || !expression) return;

    const actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;
    if (!actor) {
      ui.notifications.warn($l10n('SDM.NoValidActor'));
      return;
    }

    if (actor.type === ActorType.CARAVAN) return;

    if (!foundry.dice.Roll.validate(expression)) return;

    const roll = new Roll(expression);
    await roll.evaluate();
    const total = roll.total;

    await createChatMessage({
      actor,
      flavor: `${type === 'damage' ? 'Damage' : 'Healing'}: ${expression}`,
      rolls: [roll]
    });

    const multiplier = type === 'damage' ? 1 : -1;
    await actor.applyDamage(total, multiplier);
  });

  // Award enricher: [[award 100xp 50cash]] or [[award 75cash]] or [[award 70xp]]{optional label}
  CONFIG.TextEditor.enrichers.push({
    pattern: /\[\[\s*award\s+(?<items>[^\]]+?)\s*\]\]\s*(?:\{(?<innerText>[^}]*)\})?/gi,
    enricher: async (match, options) => {
      let { items, innerText } = match.groups;
      if (!items) return;

      // Parse XP and cash amounts
      const xpMatch = items.match(/(\d+)\s*xp/i);
      const cashMatch = items.match(/(\d+)\s*cash/i);
      const xpAmount = xpMatch ? parseInt(xpMatch[1], 10) : null;
      const cashAmount = cashMatch ? parseInt(cashMatch[1], 10) : null;

      if (xpAmount === null && cashAmount === null) return;

      const link = document.createElement('a');
      link.className = 'content-link';
      link.classList.add('award-request');
      if (xpAmount) link.dataset.xp = xpAmount;
      if (cashAmount) link.dataset.cash = cashAmount;

      let linkHtml;
      const parts = [];
      if (xpAmount) parts.push(`${xpAmount} ${$l10n('SDM.NpcXp')}`);
      if (cashAmount) parts.push(`${$l10n('SDM.CashSymbol')}${cashAmount}`);
      const defaultText = `Award ${parts.join(' + ')}`;
      if (innerText && innerText.trim()) {
        linkHtml = `<i class="fa-solid fa-gift royal"></i>${innerText.trim()}`;
      } else {
        linkHtml = `<i class="fa-solid fa-gift royal"></i>${defaultText}`;
      }
      link.dataset.tooltip = defaultText;
      link.innerHTML = linkHtml;
      return link;
    }
  });

  $('body').on('click', 'a.award-request', async event => {
    const data = event.target?.dataset ?? {};
    const xpAmount = data.xp ? parseInt(data.xp, 10) : null;
    const cashAmount = data.cash ? parseInt(data.cash, 10) : null;

    const actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;
    if (!actor) {
      ui.notifications.warn($l10n('SDM.NoValidActor'));
      return;
    }

    if (actor.type === ActorType.CARAVAN) return;

    if (xpAmount !== null && xpAmount > 0) {
      await giveExperience({
        actor: actor,
        amount: xpAmount,
        displayChatSummary: true
      });
    }

    if (cashAmount !== null && cashAmount > 0) {
      await giveCash({
        actor: actor,
        amount: cashAmount,
        operation: 'add',
        displayChatSummary: true
      });
    }
  });
}
