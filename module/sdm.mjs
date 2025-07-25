import { SdmActor } from './documents/actor.mjs';
import { SdmCombatant } from './documents/combatant.mjs';
import { SdmItem } from './documents/item.mjs';
import { SdmActorSheet } from './sheets/actor-sheet.mjs';
// import { SdmCaravanSheet } from './sheets/caravan-sheet.mjs';
import SdmActiveEffectConfig from './app/active-effect-config.mjs';
import * as models from './data/_module.mjs';
import { registerHandlebarsHelpers } from './handlebars-helpers.mjs';
import { SDM } from './helpers/config.mjs';
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import {
  CHARACTER_DEFAULT_INITIATIVE,
  configureUseHeroDiceButton,
  createEscalatorDieDisplay,
  registerSystemSettings
} from './settings.mjs';
import { SdmItemSheet } from './sheets/item-sheet.mjs';
import { setupItemTransferSocket } from './items/transfer.mjs';

const { Actors, Items } = foundry.documents.collections;
const { DocumentSheetConfig } = foundry.applications.apps;
const { ActiveEffectConfig } = foundry.applications.sheets;
const sheets = foundry.appv1.sheets;
/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

// Add key classes to the global scope so they can be more easily used
// by downstream developers
globalThis.sdm = {
  documents: {
    SdmActor,
    SdmItem,
    SdmCombatant
  },
  applications: {
    SdmActorSheet,
    //SdmCaravanSheet,
    SdmItemSheet
  },
  utils: {
    rollItemMacro
  },
  models
};

Hooks.on('renderChatMessageHTML', (message, html, data) => {
  configureUseHeroDiceButton(message, html, data);
});

Hooks.on("preUpdateActor", (actor, update) => {
  if (!actor.testUserPermission(game.user, "OWNER")) return false;
});

Hooks.on('renderSettings', (app, html) => renderSettings(html));

Hooks.on('renderGamePause', (app, html) => {
  html.classList.add('sdme2');
  const container = document.createElement('div');
  container.classList.add('flexcol');
  container.append(...html.children);
  html.append(container);
  const img = html.querySelector('img');
  img.src = 'systems/sdm/assets/sdm-pause.png';
  img.className = '';
});

Hooks.on('getChatMessageContextOptions', (html, options) => {
  options.push(
    {
      name: '',
      icon: '',
      group: 'separator'
    },
    {
      name: game.i18n.localize('SDM.ChatContextDamage'),
      icon: '<i class="fas fa-user-minus"></i>',
      callback: async li => {
        const message = game.messages.get(li.dataset.messageId);
        if (!message.rolls || !message.rolls.length) return;

        const damageAmount = message.rolls[0].total;

        await Promise.all(canvas.tokens.controlled.map(t => {
          return t.actor?.applyDamage(damageAmount,  1);
        }));
      },
      group: 'damage'
    },
    {
      name: game.i18n.localize('SDM.ChatContextHealing'),
      icon: '<i class="fas fa-user-plus"></i>',
      callback: async li => {
        const message = game.messages.get(li.dataset.messageId);
        if (!message.rolls || !message.rolls.length) return;
        const damageAmount = message.rolls[0].total;

        await Promise.all(canvas.tokens.controlled.map(t => {
          return t.actor?.applyDamage(damageAmount,  -1);
        }));
      },
      group: 'damage'
    }
  )

  return options;
});

Hooks.once('init', function () {
  // Add custom constants for configuration.
  globalThis.sdm = game.sdm = Object.assign(game.system, globalThis.sdm);
  CONFIG.SDM = SDM;

  // Define custom Document and DataModel classes
  CONFIG.Actor.documentClass = SdmActor;

  // Note that you don't need to declare a DataModel
  // for the base actor/item classes - they are included
  // with the Character/NPC as part of super.defineSchema()
  CONFIG.Actor.dataModels = {
    character: models.SdmCharacter,
    npc: models.SdmNPC
    // caravan: models.SdmCaravan
  };
  CONFIG.Item.documentClass = SdmItem;
  CONFIG.Item.dataModels = {
    gear: models.SdmGear,
    trait: models.SdmTrait,
    burden: models.SdmBurden
    // mount: models.SdmMount,
    // motor: models.SdmMotor
  };

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

  _configureFonts();

  // Register sheet application classes
  Actors.unregisterSheet('core', sheets.ActorSheet);
  Actors.registerSheet('sdm', SdmActorSheet, {
    types: ['character', 'npc'],
    makeDefault: true,
    label: 'SDM.SheetLabels.Actor'
  });
  Items.unregisterSheet('core', sheets.ItemSheet);
  Items.registerSheet('sdm', SdmItemSheet, {
    makeDefault: true,
    label: 'SDM.SheetLabels.Item'
  });

  DocumentSheetConfig.unregisterSheet(ActiveEffect, 'core', ActiveEffectConfig);
  DocumentSheetConfig.registerSheet(ActiveEffect, 'sdm', SdmActiveEffectConfig, {
    makeDefault: true
  });

  registerSystemSettings();

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  const characterInitiativeFormula =
    game.settings.get('sdm', 'initiativeFormula') || CHARACTER_DEFAULT_INITIATIVE;
  CONFIG.Combat.initiative = {
    formula: game.settings.get('sdm', 'initiativeFormula'),
    decimals: 2
  };

  CONFIG.Combatant.documentClass = SdmCombatant;

  setupItemTransferSocket();

  //Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

registerHandlebarsHelpers();

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createDocMacro(data, slot));
  // Create container element

  createEscalatorDieDisplay();

  Hooks.once('setup', () => {
    // Define the compendium name (matches your module.json "name" field)
    const MACRO_COMPENDIUM = 'macros';

    // Get the compendium pack
    const pack = game.packs.get(`sdm.${MACRO_COMPENDIUM}`);
    // Update permissions to allow only GMs to observe
    if (pack) {
      pack.configure({
        permissions: {
          OBSERVER: CONST.USER_ROLES.GAMEMASTER // Only GMs can see the compendium
        }
      });
    }
  });
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createDocMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== 'Item') return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn('You can only create macro buttons for owned Items');
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.sdm.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(m => m.name === item.name && m.command === command);
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'sdm.itemMacro': true }
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: 'Item',
    uuid: itemUuid
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then(item => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }

    // Trigger the item roll
    item.roll();
  });
}
function _configureFonts() {
  Object.assign(CONFIG.fontDefinitions, {
    'Baron Neue': {
      editor: true,
      fonts: [
        { urls: ['systems/sdm/fonts/baron_neue/Baron Neue.otf'] },
        { urls: ['systems/sdm/fonts/baron_neue/Baron Neue Bold.otf'], weight: 'bold' },
        { urls: ['systems/sdm/fonts/baron_neue/Baron Neue Italic.otf'], style: 'italic' },
        {
          urls: ['systems/sdm/fonts/baron_neue/Baron Neue Bold Italic.otf'],
          weight: 'bold',
          style: 'italic'
        }
      ]
    }
  });
}

/**
 * Render a custom entry for game details in the settings sidebar.
 * @param {HTMLElement} html  The settings sidebar HTML.
 */
function renderSettings(html) {
  const pip = html.querySelector('.info .system .notification-pip');
  html.querySelector('.info .system').remove();

  const section = document.createElement('section');
  section.classList.add('sdme2', 'sidebar-info');
  section.innerHTML = `
    <h4 class="divider">${game.i18n.localize('WORLD.FIELDS.system.label')}</h4>
    <div class="system-badge">
      <img src="systems/sdm/assets/sdm-compatible.png" data-tooltip="${sdm.title}" alt="${sdm.title}">
      <span class="system-info">${sdm.version}</span>
    </div>
  `;
  if (pip) section.querySelector('.system-info').insertAdjacentElement('beforeend', pip);
  html.querySelector('.info').insertAdjacentElement('afterend', section);
}
