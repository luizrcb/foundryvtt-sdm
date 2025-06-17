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
import { getActorFromMessage } from './helpers/chatUtils.mjs';
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { handleHeroicDice } from './rolls/heroicDice.mjs'
// Import DataModel classes
import * as models from './data/_module.mjs';

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
  if (!message) return;

  const isInitiativeRoll = message?.getFlag("core", 'initiativeRoll');
  const isHeroicResult = message?.getFlag("sdm", 'isHeroicResult');
  if (isInitiativeRoll) return;

  if (isHeroicResult) {
    $('button.heroic-dice-btn').remove();
  }

  // Find the most recent roll message in chat
  const lastRollMessage = [...game.messages.contents]
    .reverse()
    .find(m => m.isRoll || m?.getFlag("sdm", "isHeroicResult"));

  if (lastRollMessage?.getFlag("sdm", "isHeroicResult")) {
    $('button.heroic-dice-btn').remove();
    return;
  };

  // if (!lastRollMessage.rolls?.[0]?.dice?.some(d => d.faces === 20)) return;

  // Only proceed if this is the most recent d20 roll message
  if (!lastRollMessage || message.id !== lastRollMessage.id) return;
  // Only show if user has a character with heroics
  const actor = getActorFromMessage(message, game.user);
  if (!actor) return;
  if (!actor.testUserPermission(game.user, "OWNER")) return;

  // Check heroics
  const heroics = actor.system?.heroics?.value;
  if (!heroics || heroics < 1) return;

  // Create button element
  const btn = document.createElement('button');
  btn.classList.add('heroic-dice-btn');
  btn.dataset.messageId = message.id;

  // Create icon element
  const icon = document.createElement('i');
  icon.classList.add('fas', 'fa-dice-d6');
  btn.appendChild(icon);

  // Add localized text
  btn.append(` ${game.i18n.localize("SDM.Rolls.useHeroicDice")}`);

  // Create container div
  const container = document.createElement('div');
  container.appendChild(document.createElement('br'));
  container.appendChild(btn);

  // Find message content and append
  const messageContent = html.querySelector('.message-content');
  if (messageContent) {
    messageContent.appendChild(container);
  }

  // Add event listener
  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    handleHeroicDice(ev, message, actor);
  });
});

// Add safety hook to prevent concurrent transfers
Hooks.on("preUpdateItem", (item, data) => {
  if (data.flags?.sdm?.transferring && item?.getFlag("sdm", "transferring")) {
    throw new Error("Item is already being transferred");
  }
});

Hooks.once('init', function () {
  // Add custom constants for configuration.
  CONFIG.SDM = SDM;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: '1d6 + @abilities.agi.final_current + @initiative_bonus',
    decimals: 2,
  };

  CONFIG.Combatant.documentClass = SdmCombatant;

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

  game.settings.register("sdm", "currencyName", {
    name: "Currency name",
    hint: "The primary currency used in the game world",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: String, // Data type: String, Number, Boolean, etc
    default: "cash",
    onChange: value => {
      // Optional: Code to run when setting changes
    }
  });

  game.settings.register("sdm", "escalatorDie", {
    name: "Escalator Die",
    hint: "Every roll will be increased by this amount",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 0,
    onChange: value => {
      // This will now be called automatically
      updateEscalatorDisplay();
    }
  });

  game.settings.register("sdm", "baseDefense", {
    name: "Base Defense",
    hint: "Base defense value for characters",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 10,
  });

  game.settings.register("sdm", "baseTraitSlots", {
    name: "Base Trait Slots",
    hint: "Base number of trait slots for a character",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7,
  });

  game.settings.register("sdm", "baseItemSlots", {
    name: "Base Item Slots",
    hint: "Base number of item slots for a character",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 7,
  });

  game.settings.register("sdm", "baseBurdenSlots", {
    name: "Base Burden Slots",
    hint: "Base number of burden slots for a character",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 20,
  });

  game.settings.register("sdm", "npcBaseMorale", {
    name: "NPC Base Morale",
    hint: "Base number for NPCs morale value",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Number, // Data type: String, Number, Boolean, etc
    default: 3,
  });

  game.settings.register("sdm", "healingHouseRule", {
    name: "Healing House Rule",
    hint: "Allows for rolling healing heroic dice with advantage (roll twice and keep the highest result)",
    scope: "world", // "world" = GM only, "client" = per user
    restricted: true,
    config: true, // Show in configuration view
    type: Boolean, // Data type: String, Number, Boolean, etc
    default: true,
  });

  //Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here is a useful example:
Handlebars.registerHelper('toLowerCase', function (str) {
  return str.toLowerCase();
});

// some one to an index
Handlebars.registerHelper('addOne', function (index) {
  return index + 1;
});

Handlebars.registerHelper('wasHeroicUsed', function (index, options) {
  const context = options.data.root;
  return context.usedHeroicIndexes.includes(index) ? '' : 'discarded';
});

Handlebars.registerHelper('contains', function (array, value, options) {
  if (!array || !array.length || value === undefined || value === null) return false;
  const response = array.includes(parseInt(value, 10));
  return response;
});

Handlebars.registerHelper('isCharacter', function (actorType, options) {
  return ['npc', 'character'].includes(actorType);
})

Handlebars.registerHelper('eq', function (valueA, valueB, options) {
  return valueA === valueB;
});

Handlebars.registerHelper('nEq', function (valueA, valueB, options) {
  return valueA !== valueB;
});

Handlebars.registerHelper('checkOriginalDie', function (index, options) {
  const context = options.data.root;
  return index === 0 && context.firstDiceExploded;
});

Handlebars.registerHelper('getReadiedStyle', function (readied, options) {
  const booleanReadied = !!readied;
  const style = `font-weight: ${booleanReadied == true ? 900 : ''}; color: ${booleanReadied == true ? 'black' : 'grey'};`;
  return style;
});


/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

function updateEscalatorDisplay() {
  const value = game.settings.get("sdm", "escalatorDie");
  const container = document.getElementById("escalator-die");
  const display = document.getElementById("escalator-value");

  if (!container || !display) return;

  display.textContent = value;
  container.style.display = value > 0 ? "block" : "none";

  // Optional: Change icon color when active
  const img = container.querySelector("img");
  img.style.filter = value > 0
    ? "drop-shadow(0 0 4px #FF0000)"
    : "drop-shadow(0 0 4px rgba(0,0,0,0.5))";
}

Hooks.once('ready', function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createDocMacro(data, slot));
  // Create container element
  const escalatorContainer = document.createElement("div");
  escalatorContainer.id = "escalator-die";
  escalatorContainer.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  `;

  // Create header element
  const headerText = document.createElement("div");
  headerText.textContent = game.i18n.localize("SDM.EscalatorDie");
  headerText.style.cssText = `
    color: white;
    font-weight: bold;
    text-shadow: 1px 1px 2px black;
    font-size: 0.9em;
    white-space: nowrap;
    background: rgba(0,0,0,0.7);
    padding: 2px 8px;
    border-radius: 3px;
    text-align: center;
  `;

  // Create image container
  const imageContainer = document.createElement("div");
  imageContainer.style.cssText = `
    position: relative;
    width: 50px;
    height: 50px;
    margin: 0 auto;
  `;

  // Create d20 image element
  const diceImage = document.createElement("img");
  diceImage.src = "icons/svg/d20-grey.svg";
  diceImage.style.cssText = `
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 0 4px rgba(0,0,0,0.5));
    position: absolute;
    left: 0;
    top: 0;
  `;

  // Create value display element
  const valueDisplay = document.createElement("div");
  valueDisplay.id = "escalator-value";
  valueDisplay.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-weight: bold;
    font-size: 1.4em;
    text-shadow: 1px 1px 2px black;
    pointer-events: none;
  `;

  // Assemble elements
  imageContainer.append(diceImage, valueDisplay);
  escalatorContainer.append(headerText, imageContainer);
  document.body.appendChild(escalatorContainer);
  updateEscalatorDisplay();

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
