// Import document classes.
import { SdmActor } from './documents/actor.mjs';
import { SdmItem } from './documents/item.mjs';
import { SdmCombatant } from './documents/combatant.mjs';
// Import sheet classes.
import { SdmActorSheet } from './sheets/actor-sheet.mjs';
import { SdmCaravanSheet } from './sheets/caravan-sheet.mjs';
import { SdmItemSheet } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { SDM } from './helpers/config.mjs';
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
// Import DataModel classes
import * as models from './data/_module.mjs';
import { registerHandlebarsHelpers } from './handlebars-helpers.mjs';
import { CHARACTER_DEFAULT_INITIATIVE, configureUseHeroDiceButton, createEscalatorDieDisplay, registerSystemSettings, updateEscalatorDisplay } from './settings.mjs';
import SdmActiveEffectConfig from './app/active-effect-config.mjs';

const { Actors, Items } = foundry.documents.collections;

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

// Add key classes to the global scope so they can be more easily used
// by downstream developers
globalThis.sdm = {
  documents: {
    SdmActor,
    SdmItem,
    SdmCombatant,
  },
  applications: {
    SdmActorSheet,
    SdmCaravanSheet,
    SdmItemSheet,
  },
  utils: {
    rollItemMacro,
  },
  models,
};

Hooks.on("renderChatMessageHTML", (message, html, data) => {
  configureUseHeroDiceButton(message, html, data);
});

// Add safety hook to prevent concurrent transfers
Hooks.on("preUpdateItem", (item, data) => {
  if (data.flags?.sdm?.transferring && item?.getFlag("sdm", "transferring")) {
    throw new Error(game.i18n.format('SDM.ErrorTransferAlreadyInProgress', { name: item.name }));
  }
});

Hooks.once('init', function () {
  // Add custom constants for configuration.
  CONFIG.SDM = SDM;

  // Define custom Document and DataModel classes
  CONFIG.Actor.documentClass = SdmActor;

  // Note that you don't need to declare a DataModel
  // for the base actor/item classes - they are included
  // with the Character/NPC as part of super.defineSchema()
  CONFIG.Actor.dataModels = {
    character: models.SdmCharacter,
    npc: models.SdmNPC,
    caravan: models.SdmCaravan,
  };
  CONFIG.Item.documentClass = SdmItem;
  CONFIG.Item.dataModels = {
    gear: models.SdmGear,
    trait: models.SdmTrait,
    burden: models.SdmBurden,
    mount: models.SdmMount,
    motor: models.SdmMotor,
  };

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Register sheet application classes
  Actors.unregisterSheet('core', foundry.appv1.sheets.ActorSheet);
  Actors.registerSheet('sdm', SdmActorSheet, {
    types: ["character", "npc"],
    makeDefault: true,
    label: 'SDM.SheetLabels.Actor',
  });
  Items.unregisterSheet('core', foundry.appv1.sheets.ItemSheet);
  Items.registerSheet('sdm', SdmItemSheet, {
    makeDefault: true,
    label: 'SDM.SheetLabels.Item',
  });

  DocumentSheetConfig.unregisterSheet(ActiveEffect, 'core', ActiveEffectConfig);
  DocumentSheetConfig.registerSheet(ActiveEffect, 'sdm', SdmActiveEffectConfig, {
    makeDefault: true,
  });

  registerSystemSettings();

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  const characterInitiativeFormula = game.settings.get("sdm", "initiativeFormula") ||
    CHARACTER_DEFAULT_INITIATIVE;
  CONFIG.Combat.initiative = {
    formula: game.settings.get("sdm", "initiativeFormula"),
    decimals: 2,
  };

  CONFIG.Combatant.documentClass = SdmCombatant;

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

  Hooks.once("setup", () => {
    // Define the compendium name (matches your module.json "name" field)
    const MACRO_COMPENDIUM = "macros";

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
    return ui.notifications.warn(
      'You can only create macro buttons for owned Items'
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.sdm.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'sdm.itemMacro': true },
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
    uuid: itemUuid,
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then((item) => {
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
