import SdmActiveEffectConfig from './app/active-effect-config.mjs';
import SdmActiveEffectConfig14 from './app/active-effect-config14.mjs';

import * as models from './data/_module.mjs';
import { SdmActor } from './documents/actor.mjs';
import { SdmCombatant } from './documents/combatant.mjs';
import { SdmItem } from './documents/item.mjs';
import { registerHandlebarsHelpers } from './handlebars-helpers.mjs';
import {
  addCompendiumItemToActor,
  createBackgroundTrait,
  createFullAutoDestructionMode,
  createNPC,
  createNPCByLevel
} from './helpers/actorUtils.mjs';
import { configureChatListeners } from './helpers/chatUtils.mjs';
import { SDM } from './helpers/config.mjs';
import {
  ActorType,
  DEFAULT_AFFLICTION_ICON,
  DEFAULT_AUGMENT_ICON,
  DEFAULT_PET_ICON,
  GearType,
  ItemType,
  SizeUnit,
  TRAIT_ICONS,
  TraitType
} from './helpers/constants.mjs';
import { makePowerItem, UnarmedDamageItem } from './helpers/itemUtils.mjs';
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { setupItemTransferSocket } from './items/transfer.mjs';
import { gm as gmMacros, player as playerMacros } from './macros/_module.mjs';
import {
  configurePlayerChromatype,
  configureUseHeroDiceButton,
  createBonusHeroDiceDisplay,
  createEscalatorDieDisplay,
  DEFAULT_MAX_POWERS,
  registerSystemSettings,
  setupBonusHeroDiceBroadcast,
  setupEscalatorDiePositionBroadcast,
  updateBonusHeroDiceDisplay
} from './settings.mjs';
import { registerSDMGMSettingMenus } from './settings/register-gm-menus.mjs';
import { setupSettingsSocket } from './settingsSocket.mjs';
import { SdmActorSheet } from './sheets/actor-sheet.mjs';
import { SdmCaravanSheet } from './sheets/caravan-sheet.mjs';
import { SdmItemSheet } from './sheets/item-sheet.mjs';

import {
  DEFAULT_ARMOR_ICON,
  DEFAULT_CASH_ICON,
  DEFAULT_CORRUPTION_ICON,
  DEFAULT_GEAR_ICON,
  DEFAULT_POWER_ALBUM_ICON,
  DEFAULT_POWER_ICON,
  DEFAULT_SKILL_ICON,
  DEFAULT_TRAIT_ICON,
  DEFAULT_WARD_ICON,
  DEFAULT_WEAPON_ICON,
  GEAR_ICONS
} from './helpers/constants.mjs';
import { $l10n } from './helpers/globalUtils.mjs';

const { ActiveEffectConfig } = foundry.applications.sheets;
const { Actors, Items } = foundry.documents.collections;
const { DocumentSheetConfig } = foundry.applications.apps;

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
    SdmCaravanSheet,
    SdmItemSheet
  },
  utils: {
    rollItemMacro
  },
  models,
  api: {
    createBackgroundTrait,
    createFullAutoDestructionMode,
    createNPC,
    createNPCByLevel,
    gm: gmMacros,
    makePowerItem,
    player: playerMacros
  }
};

Hooks.on('getSceneControlButtons', function (controls) {
  if (game.user.isGM) {
    controls.tokens.tools['sdm-hero-dice'] = {
      icon: 'fa fa-dice-d6',
      name: 'sdm-hero-dice',
      title: 'SDM.GMGiveHeroDice',
      button: true,
      onChange: async (event, active) => {
        if (active) await game.sdm.api.gm.giveHeroDice();
      }
    };
    controls.tokens.tools['sdm-give-cash'] = {
      icon: 'fa fa-euro-sign',
      name: 'sdm-give-cash',
      title: 'SDM.GMGiveCash',
      button: true,
      onChange: async (event, active) => {
        if (active) await game.sdm.api.gm.giveCash();
      }
    };
    controls.tokens.tools['sdm-give-xp'] = {
      icon: 'fa-solid fa-angles-up',
      name: 'sdm-give-xp',
      title: 'SDM.GMGiveExperience',
      button: true,
      onChange: async (event, active) => {
        if (active) await game.sdm.api.gm.giveExperience();
      }
    };
    // controls.tokens.tools['sdm-group-initiative'] = {
    //   icon: 'fa-solid fa-people-group',
    //   name: 'sdm-group-initiative',
    //   title: 'SDM.GMGroupInitiative',
    //   button: true,
    //   onChange: async (event, active) => {
    //     if (active) await game.sdm.api.gm.groupInitiative();
    //   }
    // };
    // controls.tokens.tools['sdm-generate-npc'] = {
    //   icon: 'fa-solid fa-spaghetti-monster-flying',
    //   name: 'sdm-generate-npc',
    //   title: 'SDM.GMGenerateRandomNPC',
    //   button: true,
    //   onChange: async (event, active) => {
    //     if (active) await game.sdm.api.gm.randomNPCGenerator();
    //   }
    // };
  }
  controls.tokens.tools['sdm-dice-oracles'] = {
    icon: 'fa-solid fa-dice',
    name: 'sdm-dice-oracles',
    title: 'SDM.DiceOracles',
    button: true,
    onChange: async (event, active) => {
      if (active) await game.sdm.api.player.diceOracles();
    }
  };
  // controls.tokens.tools['sdm-burden-generator'] = {
  //   icon: 'fa-solid fa-face-dizzy',
  //   name: 'sdm-burden-generator',
  //   title: 'SDM.BurdenGenerator.Title',
  //   button: true,
  //   onChange: async (event, active) => {
  //     if (active) await game.sdm.api.gm.openBurdenGeneratorDialog();
  //   }
  // };
});

Hooks.on('renderActorDirectory', (app, html) => {
  if (!game.user.isGM) return;

  html.querySelector('.directory-header .create-entry').insertAdjacentHTML(
    'beforebegin',
    `<button type="button" class="random-pc create-entry"><i class="fa-solid fa-person" inert></i><span>${$l10n('SDM.CreateRandomCharacter')}</span></button>
     <button type="button" class="random-npc create-entry"><i class="fa-solid fa-spaghetti-monster-flying" inert></i><span>${$l10n('SDM.CreateRandomNPC')}</span></button>`
  );

  html.querySelector('.random-npc').addEventListener('click', ev => {
    game.sdm.api.gm.randomNPCGenerator();
  });

  html.querySelector('.random-pc').addEventListener('click', ev => {
    game.sdm.api.gm.characterGeneratorDialog();
  });
});

Hooks.on('renderItemDirectory', (app, html) => {
  if (!game.user.isGM) return;

  html
    .querySelector('.directory-header .create-entry')
    .insertAdjacentHTML(
      'beforebegin',
      `<button type="button" class="burden-generator" style="flex-basis: 100%"><i class="fa-solid fa-face-dizzy" inert></i><span>${$l10n('SDM.BurdenGenerator.Title')}</span></button>`
    );

  html.querySelector('.burden-generator').addEventListener('click', ev => {
    game.sdm.api.gm.openBurdenGeneratorDialog();
  });
});

Hooks.on('renderCombatTracker', (app, html) => {
  if (!game.user.isGM) return;

  const selector = html.querySelector(
    '#combat > header > div > div.control-buttons.left.flexrow > button.inline-control.combat-control.icon.fa-solid.fa-users'
  );

  selector.insertAdjacentHTML(
    'beforebegin',
    `<button data-tooltip="SDM.GMGroupInitiative" class="group-initiative inline-control combat-control icon fa-solid fa-people-group"></button>`
  );

  html.querySelector('.group-initiative').addEventListener('click', ev => {
    game.sdm.api.gm.groupInitiative();
  });
});

Hooks.on('updateCombat', async (combat, update) => {
  if (!game.user.isGM) return;

  const reroll = game.settings.get('sdm', 'rerollInitiativeEveryRound');
  if (!reroll) return;

  if (update && update.round && update.round > 1) {
    await game.sdm.api.gm.groupInitiative({ reroll: true });
  }
});

Hooks.on('renderChatMessageHTML', (message, html, data) => {
  configureUseHeroDiceButton(message, html, data);
  configureChatListeners(html);
});

Hooks.on('renderDialogV2', (dialog, html) => {
  const powerSelect = html.querySelector('#powerIndex');
  const abilitySelect = html.querySelector('#selectedAbility');
  const overChargeButton = html.querySelector('button.overcharge');
  const powerOptions = dialog.options?.powerOptions;

  powerSelect?.addEventListener('change', event => {
    const selectedIndex = parseInt(event.target.value, 10);
    const selectedPower = powerOptions.find(p => p.index === selectedIndex);
    const defaultAbility = selectedPower?.default_ability || '';
    const canOvercharge = selectedPower?.canOvercharge;

    if (abilitySelect) {
      abilitySelect.value = defaultAbility;
    }

    if (overChargeButton) {
      overChargeButton.style.display = !canOvercharge ? 'none' : '';
    }
  });
});

Hooks.on('preUpdateActor', (actor, update) => {
  if (!actor.testUserPermission(game.user, 'OWNER')) return false;
});

Hooks.on('createActor', async (actor, _options, _id) => {
  if (!actor.isOwner) return;
  await addCompendiumItemToActor(actor, UnarmedDamageItem);
  let disposition = CONST.TOKEN_DISPOSITIONS.NEUTRAL;

  const tokenData = {
    name: actor.name,
    displayName: CONST.TOKEN_DISPLAY_MODES.OWNER,
    displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER,
    disposition: disposition,
    lockRotation: true
  };

  if ([ActorType.CHARACTER, ActorType.CARAVAN].includes(actor.type)) {
    tokenData.disposition = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
    tokenData.sight = {};
    tokenData.sight.enabled = true;
    tokenData.actorLink = true;
  }

  const updateData = { prototypeToken: tokenData };

  if (actor.type === ActorType.CHARACTER) {
    updateData['system.experience'] = '300';
  }

  await actor.update(updateData);
});

Hooks.on('createItem', async (item, _options, _id) => {
  if (!item.isOwner) return;
  if (item.getFlag?.('sdm', 'fromCompendium') === UnarmedDamageItem) return;

  const updateData = { 'system.readied': false };

  await item.update(updateData);
});

Hooks.on('updateItem', async item => {
  const defaultCurrencyImage = game.settings.get('sdm', 'currencyImage') || DEFAULT_CASH_ICON;
  const defaultCurrencyName = game.settings.get('sdm', 'currencyName') || 'cash';

  if (!item.isOwner) return;

  const isBurdenOrAffliction =
    item.parent && (item.type === ItemType.BURDEN || item.system.type === GearType.AFFLICTION);

  const cureSteps = item.system?.cure_steps;
  const isCureComplete = cureSteps?.required > 0 && cureSteps.required === cureSteps.completed;

  if (isBurdenOrAffliction && isCureComplete) {
    await item.deleteDialog();
    return;
  }

  const updateData = {};
  if (
    item.type === ItemType.GEAR &&
    (GEAR_ICONS.includes(item.img) || item.img === defaultCurrencyImage)
  ) {
    switch (item.system.type) {
      case GearType.AFFLICTION:
        updateData['img'] = DEFAULT_AFFLICTION_ICON;
        break;
      case GearType.AUGMENT:
        updateData['img'] = DEFAULT_AUGMENT_ICON;
        break;
      case GearType.ARMOR:
        updateData['img'] = DEFAULT_ARMOR_ICON;
        break;
      case GearType.CORRUPTION:
        updateData['img'] = DEFAULT_CORRUPTION_ICON;
        break;
      case GearType.PET:
        updateData['img'] = DEFAULT_PET_ICON;
        break;
      case GearType.POWER:
        updateData['img'] = DEFAULT_POWER_ICON;
        break;
      case GearType.POWER_ALBUM:
        updateData['img'] = DEFAULT_POWER_ALBUM_ICON;
        break;
      case GearType.WARD:
        updateData['img'] = DEFAULT_WARD_ICON;
        break;
      case GearType.WEAPON:
        updateData['img'] = DEFAULT_WEAPON_ICON;
        break;
      default:
        updateData['img'] = DEFAULT_GEAR_ICON;
        break;
    }

    if (item.system.size.unit === SizeUnit.CASH) {
      updateData['img'] = defaultCurrencyImage;
      updateData['name'] = defaultCurrencyName;
    }
  }

  if (item.type === ItemType.TRAIT && TRAIT_ICONS.includes(item.img)) {

    switch (item.system.type) {
      case TraitType.AFFLICTION:
        updateData['img'] = DEFAULT_AFFLICTION_ICON;
        break;
      case TraitType.AUGMENT:
        updateData['img'] = DEFAULT_AUGMENT_ICON;
        break;
      case TraitType.CORRUPTION:
        updateData['img'] = DEFAULT_CORRUPTION_ICON;
        break;
      case TraitType.POWER:
        updateData['img'] = DEFAULT_POWER_ICON;
        break;
      case TraitType.PET:
        updateData['img'] = DEFAULT_PET_ICON;
        break;
      case TraitType.SKILL:
        updateData['img'] = DEFAULT_SKILL_ICON;
        break;
      default:
        updateData['img'] = DEFAULT_TRAIT_ICON;
        break;
    }
  }

  await item.update(updateData);
});

Hooks.on('updateCombat', async (combat, update) => {
  if (!('round' in update || 'turn' in update)) return;

  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor) continue;

    const expiredEffects = actor.effects.filter(
      effect => effect.isTemporary && !effect.duration.remaining
    );

    for (const expired of expiredEffects) {
      await expired.update({ disabled: true });
    }
  }
});

Hooks.on('createItem', async (item, _options, _id) => {
  if (!item.isOwner) return;

  if (item.type !== ItemType.GEAR) return;

  const defaultMaxPowers = game.settings.get('sdm', 'defaultMaxPowers') || DEFAULT_MAX_POWERS;

  await item.update({ 'system.max_powers': defaultMaxPowers });
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
  const canApply = li => {
    const message = game.messages.get(li.dataset.messageId);
    return (
      (!message.blind || game.user.isGM) &&
      message.rolls &&
      message.rolls.length &&
      canvas.tokens.controlled.length
    );
  };

  const noTokenSelected = li => {
    const message = game.messages.get(li.dataset.messageId);
    return (
      (!message.blind || game.user.isGM) &&
      message.rolls &&
      message.rolls.length &&
      !canvas.tokens.controlled.length
    );
  };

  options.push(
    {
      name: '',
      condition: canApply,
      group: 'separator'
    },
    {
      name: game.i18n.localize('SDM.ChatContextNoTokensSelected'),
      condition: noTokenSelected,
      icon: '<i class="fa-solid fa-user-slash"></i>',
      group: 'damage'
    },
    {
      name: game.i18n.localize('SDM.ChatContextHalfDamage') || 'Apply Half Damage',
      icon: '<i class="fa-solid fa-user-minus"></i>',
      condition: canApply,
      callback: async li => {
        const message = game.messages.get(li.dataset.messageId);
        if (!message?.rolls?.length) return;
        const orig = message.rolls[0].total;
        // Using Math.ceil so small values don't reduce to 0. Use Math.floor if you prefer.
        const damageAmount = Math.ceil(orig / 2);

        await Promise.all(canvas.tokens.controlled.map(t => t.actor?.applyDamage(damageAmount, 1)));
      },
      group: 'damage'
    },
    {
      name: game.i18n.localize('SDM.ChatContextDamage'),
      icon: '<i class="fa-solid fa-user-minus"></i>',
      condition: canApply,
      callback: async li => {
        const message = game.messages.get(li.dataset.messageId);
        if (!message.rolls || !message.rolls.length) return;

        const damageAmount = message.rolls[0].total;

        await Promise.all(
          canvas.tokens.controlled.map(t => {
            return t.actor?.applyDamage(damageAmount, 1);
          })
        );
      },
      group: 'damage'
    },

    {
      name: game.i18n.localize('SDM.ChatContextDoubleDamage') || 'Apply Double Damage',
      icon: '<i class="fa-solid fa-user-minus"></i>',
      condition: canApply,
      callback: async li => {
        const message = game.messages.get(li.dataset.messageId);
        if (!message?.rolls?.length) return;
        const orig = message.rolls[0].total;
        const damageAmount = orig * 2;

        await Promise.all(canvas.tokens.controlled.map(t => t.actor?.applyDamage(damageAmount, 1)));
      },
      group: 'damage'
    },

    {
      name: game.i18n.localize('SDM.ChatContextHealing'),
      icon: '<i class="fa-solid fa-user-plus"></i>',
      condition: canApply,
      callback: async li => {
        const message = game.messages.get(li.dataset.messageId);
        if (!message.rolls || !message.rolls.length) return;
        const damageAmount = message.rolls[0].total;

        await Promise.all(
          canvas.tokens.controlled.map(t => {
            return t.actor?.applyDamage(damageAmount, -1);
          })
        );
      },
      group: 'healing'
    }
  );

  return options;
});

Hooks.once('init', function () {
  // Add custom constants for configuration.
  globalThis.sdm = game.sdm = Object.assign(game.system, globalThis.sdm);
  CONFIG.SDM = SDM;

  // v14
  CONFIG.ActiveEffect.phases = {
    initial: { label: 'Init' },
    final: { label: 'Final' }
  };

  // Define custom Document and DataModel classes
  CONFIG.Actor.documentClass = SdmActor;

  // Note that you don't need to declare a DataModel
  // for the base actor/item classes - they are included
  // with the Character/NPC as part of super.defineSchema()
  CONFIG.Actor.dataModels = {
    npc: models.SdmNPC,
    character: models.SdmCharacter,
    caravan: models.SdmCaravan
  };
  CONFIG.Item.documentClass = SdmItem;
  CONFIG.Item.dataModels = {
    gear: models.SdmGear,
    trait: models.SdmTrait,
    burden: models.SdmBurden
  };

  _configureFonts();

  // Register sheet application classes
  Actors.registerSheet('sdm', SdmActorSheet, {
    types: ['npc', 'character'],
    makeDefault: true,
    label: 'SDM.SheetLabels.Actor'
  });
  Actors.registerSheet('sdm', SdmCaravanSheet, {
    types: ['caravan'],
    makeDefault: true,
    label: 'SDM.SheetLabels.Actor'
  });
  Items.registerSheet('sdm', SdmItemSheet, {
    makeDefault: true,
    label: 'SDM.SheetLabels.Item'
  });

  DocumentSheetConfig.unregisterSheet(ActiveEffect, 'core', ActiveEffectConfig);

  let activeEffectConfigClass;

  if (game.release.generation === 13) {
    activeEffectConfigClass = SdmActiveEffectConfig;
  } else {
    activeEffectConfigClass = SdmActiveEffectConfig14;
  }

  DocumentSheetConfig.registerSheet(ActiveEffect, 'sdm', activeEffectConfigClass, {
    makeDefault: true
  });

  registerSystemSettings();
  registerSDMGMSettingMenus();

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: game.settings.get('sdm', 'initiativeFormula'),
    decimals: 2
  };

  CONFIG.Combatant.documentClass = SdmCombatant;

  setupItemTransferSocket();
  setupSettingsSocket();

  setupEscalatorDiePositionBroadcast();

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

  // client custom color system settings
  configurePlayerChromatype();

  Hooks.on('hotbarDrop', (bar, data, slot) => createDocMacro(data, slot));
  // Create container element

  const combatConfig = game.settings.get('core', 'combatTrackerConfig');
  combatConfig.resource = 'life.value';
  combatConfig.skipDefeated = true;
  combatConfig.turnMarker.enabled = true;
  combatConfig.turnMarker.disposition = true;
  combatConfig.turnMarker.animation = 'spin';
  game.settings.set('core', 'combatTrackerConfig', combatConfig);

  createEscalatorDieDisplay();
  createBonusHeroDiceDisplay();
  setupBonusHeroDiceBroadcast();
  updateBonusHeroDiceDisplay();

  // Hooks.on('dropCanvasData', async (canvas, data) => {
  //   console.log(canvas, data);

  //   const { uuid, x, y } = data;
  //   const snappedPoint = canvas.grid.getSnappedPoint(
  //     { x, y },
  //     { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_VERTEX }
  //   );
  //   const item = await fromUuid(uuid);
  //   if (!item) return;

  //   console.log(item);
  //   const attributes = item.system.attributes;
  //   console.log(attributes);

  //   const virtualActor = new SdmActor({
  //     type: 'npc',
  //     name: item.name,
  //     img: item.img,
  //     system: { ...attributes }
  //   }).toObject();
  //   const actor = await SdmActor.create(virtualActor);
  //   const tokenDoc = await actor.getTokenDocument({ x: snappedPoint.x, y: snappedPoint.y });
  //   await game.scenes.active.createEmbeddedDocuments('Token', [tokenDoc.toObject()]);
  // });

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
    },
    'Bitcount Single': {
      editor: true,
      fonts: [{ urls: ['systems/sdm/fonts/bitcount_single/BitcountSingle.ttf'] }]
    },
    'Bonheur Royale': {
      editor: true,
      fonts: [{ urls: ['systems/sdm/fonts/bonheur_royale/BonheurRoyale-Regular.ttf'] }]
    },
    'Medieval Sharp': {
      editor: true,
      fonts: [{ urls: ['systems/sdm/fonts/medieval_sharp/MedievalSharp-Regular.ttf'] }]
    },
    'Our Golden Age': {
      editor: true,
      fonts: [{ urls: ['systems/sdm/fonts/our_golden_age/OurGoldenAge-Regular.otf'] }]
    },
    'Roboto Condensed': {
      editor: true,
      fonts: [
        {
          urls: ['systems/sdm/fonts/roboto_condensed/RobotoCondensed-VariableFont_wght.ttf'],
          weight: 'bold'
        },
        {
          urls: ['systems/sdm/fonts/roboto_condensed/RobotoCondensed-VariableFont_wght.ttf'],
          style: 'italic'
        }
      ]
    },
    'Source Sans Pro': {
      editor: true,
      fonts: [
        { urls: ['systems/sdm/fonts/source_sans_pro/SourceSansPro-Regular.ttf'] },
        { urls: ['systems/sdm/fonts/source_sans_pro/SourceSansPro-Bold.ttf'], weight: 'bold' },
        { urls: ['systems/sdm/fonts/source_sans_pro/SourceSansPro-Italic.ttf'], style: 'italic' },
        {
          urls: ['systems/sdm/fonts/source_sans_pro/SourceSansPro-Light.ttf'],
          weight: 300,
          style: 'normal'
        }
      ]
    }
  });
}

/**
 * Generate sidebar links.
 * @returns {HTMLUListElement}
 * @private
 */
function _generateLinks() {
  const links = document.createElement('ul');
  links.classList.add('unlist', 'links');
  links.innerHTML = `
    <li>
      <a href="https://github.com/luizrcb/foundryvtt-sdm/releases/latest" target="_blank">
        ${game.i18n.localize('SDM.Notes')}
      </a>
    </li>
    <li>
      <a href="https://github.com/luizrcb/foundryvtt-sdm/issues" target="_blank">${game.i18n.localize('SDM.Issues')}</a>
    </li>
    <li>
      <a href="https://github.com/luizrcb/foundryvtt-sdm/wiki" target="_blank">${game.i18n.localize('SDM.Wiki')}</a>
    </li>
  `;
  return links;
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
      <div class="sdm-icon" data-tooltip="${sdm.title}" alt="${sdm.title}"></div>
      <span class="system-info">${sdm.version}</span>
    </div>
  `;
  section.append(_generateLinks());
  if (pip) section.querySelector('.system-info').insertAdjacentElement('beforeend', pip);
  html.querySelector('.info').insertAdjacentElement('afterend', section);
}
