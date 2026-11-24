import { addCatchHandle, addSingleUseMark } from './helpers/singleUsePowers.mjs';
import SdmEffectsPanel from './app/effects-panel.mjs';
import SdmActiveEffectConfig14 from './app/active-effect-config14.mjs';
import {
  GroupCheckDialog,
  registerGroupCheckSettings,
  setupGroupCheckSocket
} from './app/group-check/index.mjs';

import { SDMActiveEffectData } from './app/active-effect-data.mjs';

import * as models from './data/_module.mjs';
import { SdmActor } from './documents/actor.mjs';
import { SdmCombatant } from './documents/combatant.mjs';
import { SdmItem } from './documents/item.mjs';
import registerTextEditorEnrichers from './enrichers.mjs';
import { registerHandlebarsHelpers } from './handlebars-helpers.mjs';
import {
  addCompendiumItemToActor,
  createBackgroundTrait,
  createFullAutoDestructionMode,
  createNPC,
  createNPCByLevel
} from './helpers/actorUtils.mjs';
import {
  configureChatListeners,
  getActorFromMessage,
  LinksDialog,
  luberLinks,
  sendInitialMessage,
  wtfStudioLinks
} from './helpers/chatUtils.mjs';
import { SDM } from './helpers/config.mjs';
import {
  ActorType,
  BURDEN_ICONS,
  DEFAULT_AFFLICTION_ICON,
  DEFAULT_AUGMENT_ICON,
  DEFAULT_BURDEN_ICON,
  DEFAULT_CONTAINER_ICON,
  DEFAULT_PET_ICON,
  GearType,
  ItemType,
  SizeUnit,
  TRAIT_ICONS,
  TraitType
} from './helpers/constants.mjs';
import {
  getRowRolls,
  makePowerItem,
  registerActiveEffectLimit,
  UnarmedDamageItem
} from './helpers/itemUtils.mjs';
import { setupCaravanTokenControls } from './canvas/caravan-tokens.mjs';
import { setupInvestXp } from './app/invest-xp.mjs';
import { getCounters, promptNewCounter, removeCounter, resetCounters, setupCounters, stepCounter } from './helpers/counters.mjs';
import { blockedReason, describeUse, isUsable, setupUseItem, useItem } from './app/use-item.mjs';
import { itemActions, itemMarkers } from './helpers/itemActions.mjs';
import { setupAnimatedItems } from './helpers/animatedItems.mjs';
import { getLightItems, getLitEffect, isLightSource, isLit, lightItem, putOutLight, setupLights, toggleLight } from './helpers/lights.mjs';
import { restActor, setupRest } from './app/rest.mjs';
import { setupHeroDieOnNat20 } from './helpers/heroDieOnNat20.mjs';
import { setupTokenLifeBar } from './canvas/token-life-bar.mjs';
import { newSession, setupOnceAbilities } from './helpers/onceAbilities.mjs';
import { setupSummons } from './helpers/summons.mjs';
import { setupInitiativeHeroDice } from './helpers/initiativeHeroDice.mjs';
import { setupForms } from './helpers/forms.mjs';
import { bindTriggerApply, setupTriggers } from './rolls/triggers.mjs';
import { setupNextRoll } from './app/next-roll.mjs';
import { setupRideStats } from './helpers/rideStats.mjs';
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { setupPetDropSocket } from './items/petItem.mjs';
import { setupPetLinks } from './items/petLinks.mjs';
import { setupItemPiles } from './integrations/itemPiles.mjs';
import { setupNpcVariability } from './helpers/npcVariability.mjs';
import { configureConditions, localizeConditions, setupConditions } from './helpers/conditions.mjs';
import { setupZones } from './helpers/zones.mjs';
import { setupAuras } from './helpers/auras.mjs';
import { bindAreaButtons, drawArea, setupAreas } from './helpers/areas.mjs';
import HazardBehaviorData from './data/hazard-behavior.mjs';
import { bindAttackFollowup } from './rolls/attackFollowup.mjs';
import { bindAttackFeatures } from './rolls/attackFeatures.mjs';
import { bindSacrifice, bindSaveAgainst, rerenderChangedSave, setupSaveAgainst } from './app/save-against.mjs';
import { addApplyToPlainRolls, addVisibilityLabel, applyToTokens, bindApplyDamage, bindAreaApply, bindHeroHeal, bindUndoDamage, damageTokens } from './rolls/ui/applyDamage.mjs';
import { rememberCurrency } from './helpers/currency.mjs';
import { setupItemTransferSocket } from './items/transfer.mjs';
import { gm as gmMacros, player as playerMacros } from './macros/_module.mjs';
import {
  addChromatypePreview,
  configurePlayerChromatype,
  fixDiceStyleTypo,
  configureUseHeroDiceButton,
  createBonusHeroDiceDisplay,
  createEscalatorDieDisplay,
  registerSystemSettings,
  setupBonusHeroDiceBroadcast,
  setupEscalatorDiePositionBroadcast,
  setupInitialSettings,
  sortChromatypeChoices,
  updateBonusHeroDiceDisplay
} from './settings.mjs';
import { registerSDMGMSettingMenus } from './settings/register-gm-menus.mjs';
import { setupSettingsSocket } from './settingsSocket.mjs';
import { SdmActorSheet } from './sheets/actor-sheet.mjs';
import { SdmActorSheetV2, SdmNpcSheetV2 } from './sheets/actor-sheet-v2.mjs';
import { SdmItemSheetV2 } from './sheets/item-sheet-v2.mjs';
import { SdmCaravanSheetV2 } from './sheets/caravan-sheet-v2.mjs';
import { SdmCaravanSheet } from './sheets/caravan-sheet.mjs';
import { SdmItemSheet } from './sheets/item-sheet.mjs';

import CompendiumBrowser from './app/compendium-browser.mjs';
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
import { addBonusPenalty, markRangePenalty } from './app/bonus-penalty.mjs';

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
    player: playerMacros,
    // Rest one week: game.sdm.api.rest(actorOrUuid, { choice: 'life' | 'ability' | 'burden', ability, burdenId })
    rest: restActor,
    // Referee: a new session (counters that reset each session go back)
    newSession,
    // Items: Use (consumables) and the rolls an inventory row offers ({ image, icons })
    items: {
      use: useItem,
      isUsable,
      useBlockedReason: blockedReason,
      rolls: getRowRolls,
      // Item actions besides rolls and Use (usage roll, charges, recharge, animate…) and row markers
      actions: itemActions,
      markers: itemMarkers,
      // What Use does (HTML, the Use icon's tooltip)
      describeUse
    },
    // Token light from items (light category / glowing) and powers
    lights: {
      items: getLightItems,
      isLightSource,
      isLit,
      litEffect: getLitEffect,
      light: lightItem,
      putOut: putOutLight,
      toggle: toggleLight
    },
    // Counters on items and actors (system.counters)
    counters: {
      get: getCounters,
      step: stepCounter,
      reset: resetCounters,
      add: promptNewCounter,
      remove: removeCounter
    }
  },
  apps: {
    CompendiumBrowser
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
    controls.tokens.tools['sdm-group-check'] = {
      icon: 'fa-solid fa-people-carry-box',
      name: 'sdm-group-check',
      title: 'SDM.GroupCheck',
      button: true,
      onChange: async (event, active) => {
        if (active) {
          if (!GroupCheckDialog._instance) {
            new GroupCheckDialog().render(true);
          } else {
            GroupCheckDialog._instance.render(true);
          }
        }
      }
    };
  }
  // Draw an area on the map (no item, roll or card): helpers/areas.mjs
  controls.tokens.tools['sdm-area'] = {
    icon: 'fa-solid fa-draw-polygon',
    name: 'sdm-area',
    title: 'SDM.AreaDraw',
    button: true,
    onChange: async (event, active) => {
      if (active) await drawArea();
    }
  };
  controls.tokens.tools['sdm-dice-oracles'] = {
    icon: 'fa-solid fa-dice',
    name: 'sdm-dice-oracles',
    title: 'SDM.DiceOracles',
    button: true,
    onChange: async (event, active) => {
      if (active) await game.sdm.api.player.diceOracles();
    }
  };
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

Hooks.on('renderCompendiumDirectory', (app, html) => CompendiumBrowser.injectSidebarButton(html));

Hooks.on('updateCombat', async (combat, update) => {
  if (!game.user.isGM) return;

  const reroll = game.settings.get('sdm', 'rerollInitiativeEveryRound');
  if (!reroll) return;

  if (update && update.round && update.round > 1) {
    await game.sdm.api.gm.groupInitiative({ reroll: true });
  }
});

Hooks.on('createChatMessage', message => rerenderChangedSave(message));

Hooks.on('renderChatMessageHTML', (message, html, data) => {
  configureUseHeroDiceButton(message, html, data);
  addSingleUseMark(message, html);
  addCatchHandle(message, html);
  configureChatListeners(html);
  // Attack card (and its hero dice result): roll the damage of the weapon / the power it was made with
  bindAttackFollowup(html);
  bindAttackFeatures(html);
  // Areas: place the attack's area; target its hits; remove it
  bindAreaButtons(message, html);
  // Save request (a character saves against a condition): its owner or the Referee picks the ability
  bindSaveAgainst(message, html);
  bindSacrifice(message, html);
  // A trigger that fired with no target: apply its condition / effect to the tokens targeted now
  bindTriggerApply(message, html);
  // Damage card: apply to the selected tokens (plain chat rolls get the same buttons)
  addApplyToPlainRolls(message, html);
  addVisibilityLabel(message, html);
  bindApplyDamage(html);
  // An area's damage, not applied automatically: a button per token hit
  bindAreaApply(message, html);
  bindUndoDamage(message, html);
  bindHeroHeal(message, html);
  const dangerousElement = html.querySelector('[data-action="rollDangerous"]');
  if (dangerousElement) {
    dangerousElement.addEventListener('click', async event => {
      const actor = getActorFromMessage(message);

      if (!actor || !actor.isOwner) return;

      const sheet = actor.sheet.constructor;

      await sheet['_onRollDanger'].call(actor.sheet, event, dangerousElement);
    });
  }
});

// Accent color lists in the order of the user's language (needs the translations)
Hooks.once('i18nInit', sortChromatypeChoices);
Hooks.once('i18nInit', localizeConditions);
// Client settings: accent colour swatch and 3D dice preview
Hooks.on('renderSDMClientSettingsConfig', addChromatypePreview);
Hooks.on('renderSettingsConfig', addChromatypePreview);

Hooks.on('renderDialogV2', (dialog, html) => {
  // Roll dialog: live preview of what each button rolls
  const rollPreview = dialog.options?.rollPreview;
  let previewBox = html.querySelector('.sdm-roll-preview');
  // The form the dialog's buttons read (what gets rolled). Not the header's buttons (close…), which have no form
  const previewForm =
    html.querySelector('.form-footer button')?.form ??
    html.querySelector('form.dialog-form') ??
    previewBox?.closest('form') ??
    html.querySelector('form');
  if (typeof rollPreview === 'function' && !previewBox && previewForm) {
    // Dialogs without a place for it: right under their heading, or at the top
    previewBox = document.createElement('div');
    previewBox.className = 'sdm-roll-preview';
    previewBox.setAttribute('aria-live', 'polite');
    const content = html.querySelector('.dialog-content') ?? previewForm;
    const heading = content.querySelector('h1, h2, h3, h4');
    if (heading) heading.after(previewBox);
    else content.prepend(previewBox);
  }
  // d20 roll dialogs: the book's typical bonuses and penalties as buttons under the Modifier
  addBonusPenalty(html);
  // Attack dialog: choosing the item re-suggests the roll mode (before the preview reads the form)
  const attackItemSelect = html.querySelector('#attackItem');
  const rollModeSelect = html.querySelector('#rollMode');
  if (attackItemSelect && rollModeSelect && typeof dialog.options?.attackItemRollMode === 'function') {
    attackItemSelect.addEventListener('change', () => {
      const mode = dialog.options.attackItemRollMode(attackItemSelect.value);
      if (mode) rollModeSelect.value = mode;
      // The chosen item's image, before the selector
      const img = html.querySelector('.sdm-attack-item-img');
      const src = dialog.options.attackItemImage?.(attackItemSelect.value) || '';
      if (img) {
        img.src = src;
        img.hidden = !src;
      }
    });
  }
  if (typeof rollPreview === 'function' && previewBox && previewForm) {
    const updatePreview = () => {
      try {
        const values = new foundry.applications.ux.FormDataExtended(previewForm).object;
        previewBox.innerHTML = rollPreview(values);
        markRangePenalty(html);
      } catch (error) {
        console.warn('SDM | Roll preview failed', error);
      }
    };
    previewForm.addEventListener('change', updatePreview);
    previewForm.addEventListener('input', foundry.utils.debounce(updatePreview, 150));
    updatePreview();
  }

  const powerSelect = html.querySelector('#powerIndex');
  const abilitySelect = html.querySelector('#selectedAbility');
  const overChargeButton = html.querySelector('button.overcharge');
  const powerOptions = dialog.options?.powerOptions;

  const costValue = html.querySelector('.sdm-power-cost-value');
  const payCost = html.querySelector('input[name="payPowerCost"]');
  // Attack dialog: the cost box shows only for a power chosen in With, with that power's cost
  const attackPowerCosts = dialog.options?.attackPowerCosts;
  const withSelect = html.querySelector('#attackItem');
  if (attackPowerCosts && withSelect) {
    withSelect.addEventListener('change', () => {
      const box = html.querySelector('.sdm-power-cost');
      const casts = withSelect.value in attackPowerCosts;
      if (box) box.hidden = !casts;
      if (casts && costValue) costValue.textContent = attackPowerCosts[withSelect.value];
    });
  }
  const costAbilityRow = html.querySelector('.sdm-power-cost-ability');
  payCost?.addEventListener('change', () => {
    costAbilityRow?.classList.toggle('disabled', !payCost.checked);
    costAbilityRow?.querySelectorAll('input, select').forEach(el => (el.disabled = !payCost.checked));
  });

  powerSelect?.addEventListener('change', event => {
    const selectedIndex = parseInt(event.target.value, 10);
    const selectedPower = powerOptions.find(p => p.index === selectedIndex);
    if (costValue && selectedPower) costValue.textContent = selectedPower.cost ?? 0;
    const danger = html.querySelector('.sdm-power-danger');
    if (danger && selectedPower) {
      danger.innerHTML = selectedPower.dangerHtml ?? '';
      danger.hidden = !selectedPower.dangerHtml;
    }
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
  if (actor.type !== ActorType.CHARACTER) return;

  await addCompendiumItemToActor(actor, UnarmedDamageItem);

  // A new character starts at level 1: that level gives no upgrade to choose
  await actor.update(
    {
      'system.experience': '300',
      'system.upgrades_level': 1,
      'system.pending_upgrades': 0
    },
    { sdmInvestXp: true }
  );
});

registerActiveEffectLimit();

Hooks.on('updateItem', async (item, changes) => {
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

  // A default icon follows the item's type, only when the type (or the cash size) changes: other
  // updates (readied, quantity, a new item settling on a sheet) keep the image as it is
  const typeChanged =
    foundry.utils.hasProperty(changes ?? {}, 'system.type') ||
    foundry.utils.hasProperty(changes ?? {}, 'system.size.unit');
  if (!typeChanged) return;

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
      case GearType.CONTAINER:
        updateData['img'] = DEFAULT_CONTAINER_ICON;
        break;
      default:
        updateData['img'] = DEFAULT_GEAR_ICON;
        break;
    }

    if (item.system.size.unit === SizeUnit.CASH) {
      updateData['img'] = defaultCurrencyImage;
      if (item.name === $l10n('TYPE.Gear')) {
        updateData['name'] = defaultCurrencyName;
      }
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

  if (item.type === ItemType.BURDEN && BURDEN_ICONS.includes(item.img)) {
    switch (item.system.type) {
      case TraitType.AFFLICTION:
        updateData['img'] = DEFAULT_AFFLICTION_ICON;
        break;
      case TraitType.POWER:
        updateData['img'] = DEFAULT_POWER_ICON;
        break;
      default:
        updateData['img'] = DEFAULT_BURDEN_ICON;
        break;
    }
  }

  if (Object.keys(updateData).length) await item.update(updateData);
});

// Effect expiry is handled by the core ActiveEffectRegistry (V14). Combat-based durations
// without an expiry event only expire when world time advances on older V14 builds, so new
// effects with a rounds/turns duration default to expiring at the start of the owner's turn.
Hooks.on('preCreateActiveEffect', (effect, data) => {
  const { value, units, expiry } = effect._source.duration ?? {};
  if (expiry || !Number.isFinite(value) || value <= 0) return;
  if (!['rounds', 'turns'].includes(units)) return;
  effect.updateSource({ 'duration.expiry': 'turnStart' });
});

Hooks.on('renderSettings', (app, html) => renderSettings(html));

Hooks.on('renderGamePause', (app, html) => {
  html.classList.add('sdm');
  const img = html.querySelector('img');
  if (img) {
    const div = document.createElement('div');
    div.className = 'sdm-pause';
    img.replaceWith(div);
  }
  const figcaption = html.querySelector('figcaption');
  if (figcaption) {
    figcaption.style.fontFamily = 'var(--sdm-font-dice)';
    figcaption.style.color = 'var(--sdm-c-accent)';
    figcaption.style.textShadow = '2px 2px black';
  }
});

Hooks.on('getChatMessageContextOptions', (html, options) => {
  const canApply = li => {
    const message = game.messages.get(li.dataset.messageId);
    return (
      (!message.blind || game.user.isGM) &&
      message.rolls &&
      message.rolls.length &&
      damageTokens().length
    );
  };

  const noTokenSelected = li => {
    const message = game.messages.get(li.dataset.messageId);
    return (
      (!message.blind || game.user.isGM) &&
      message.rolls &&
      message.rolls.length &&
      !damageTokens().length
    );
  };

  options.push(
    {
      label: '',
      visible: canApply,
      group: 'separator'
    },
    {
      label: game.i18n.localize('SDM.ChatContextNoTokensSelected'),
      visible: noTokenSelected,
      icon: '<i class="fa-solid fa-user-slash"></i>',
      group: 'damage'
    },
    {
      label: game.i18n.localize('SDM.ChatContextHalfDamage') || 'Apply Half Damage',
      icon: '<i class="fa-solid fa-user-minus"></i>',
      visible: canApply,
      onClick: async (event, li) => {
        const message = game.messages.get(li.dataset.messageId);
        if (!message?.rolls?.length) return;
        const orig = message.rolls[0].total;
        // Using Math.ceil so small values don't reduce to 0. Use Math.floor if you prefer.
        const damageAmount = Math.ceil(orig / 2);
        // The targeted tokens, else the selected ones
        await applyToTokens(damageAmount, 1);
      },
      group: 'damage'
    },
    {
      label: game.i18n.localize('SDM.ChatContextDamage'),
      icon: '<i class="fa-solid fa-user-minus"></i>',
      visible: canApply,
      onClick: async (event, li) => {
        const message = game.messages.get(li.dataset.messageId);
        if (!message.rolls || !message.rolls.length) return;

        const damageAmount = message.rolls[0].total;
        await applyToTokens(damageAmount, 1);
      },
      group: 'damage'
    },

    {
      label: game.i18n.localize('SDM.ChatContextDoubleDamage') || 'Apply Double Damage',
      icon: '<i class="fa-solid fa-user-minus"></i>',
      visible: canApply,
      onClick: async (event, li) => {
        const message = game.messages.get(li.dataset.messageId);
        if (!message?.rolls?.length) return;
        const orig = message.rolls[0].total;
        const damageAmount = orig * 2;
        await applyToTokens(damageAmount, 1);
      },
      group: 'damage'
    },

    {
      label: game.i18n.localize('SDM.ChatContextHealing'),
      icon: '<i class="fa-solid fa-user-plus"></i>',
      visible: canApply,
      onClick: async (event, li) => {
        const message = game.messages.get(li.dataset.messageId);
        if (!message.rolls || !message.rolls.length) return;
        const damageAmount = message.rolls[0].total;
        await applyToTokens(damageAmount, -1);
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
  // WTF conditions replace Foundry's status list
  configureConditions();

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
    burden: models.SdmBurden,
    mount: models.SdmMount,
    vehicle: models.SdmVehicle
  };
  // Region behaviors: Hazard (traps, burning ground, lingering areas' damage and conditions)
  CONFIG.RegionBehavior.dataModels.hazard = HazardBehaviorData;
  CONFIG.RegionBehavior.typeIcons.hazard = 'fa-solid fa-skull-crossbones';

  _configureFonts();

  // Register sheet application classes
  Actors.registerSheet('sdm', SdmActorSheet, {
    types: ['npc', 'character'],
    makeDefault: false,
    label: 'SDM.SheetLabels.Actor'
  });
  Actors.registerSheet('sdm', SdmActorSheetV2, {
    types: ['character'],
    makeDefault: true,
    label: 'SDM.SheetLabels.ActorV2'
  });
  Actors.registerSheet('sdm', SdmNpcSheetV2, {
    types: ['npc'],
    makeDefault: true,
    label: 'SDM.SheetLabels.NpcV2'
  });
  Actors.registerSheet('sdm', SdmCaravanSheetV2, {
    types: ['caravan'],
    makeDefault: true,
    label: 'SDM.SheetLabels.CaravanV2'
  });
  Actors.registerSheet('sdm', SdmCaravanSheet, {
    types: ['caravan'],
    makeDefault: false,
    label: 'SDM.SheetLabels.Actor'
  });
  Items.registerSheet('sdm', SdmItemSheet, {
    makeDefault: false,
    label: 'SDM.SheetLabels.Item'
  });
  Items.registerSheet('sdm', SdmItemSheetV2, {
    makeDefault: true,
    label: 'SDM.SheetLabels.ItemV2'
  });
  CONFIG.ActiveEffect.dataModels.base = SDMActiveEffectData;
  DocumentSheetConfig.registerSheet(ActiveEffect, 'sdm', SdmActiveEffectConfig14, {
    makeDefault: true
  });

  registerSystemSettings();
  registerSDMGMSettingMenus();
  registerGroupCheckSettings();

  // What the core ActiveEffectRegistry does with expired effects ("update" marks them expired)
  CONFIG.ActiveEffect.expiryAction = game.settings.get('sdm', 'effectExpiryAction');

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
  setupPetDropSocket();
  setupPetLinks();
  setupItemPiles();
  setupNpcVariability();
  setupConditions();
  setupZones();
  setupAuras();
  setupAreas();
  setupNextRoll();
  setupRideStats();
  setupSettingsSocket();
  setupGroupCheckSocket();
  setupCaravanTokenControls();
  setupInvestXp();
  setupCounters();
  setupUseItem();
  setupSaveAgainst();
  setupAnimatedItems();
  setupLights();
  setupRest();
  setupHeroDieOnNat20();
  setupTokenLifeBar();
  setupOnceAbilities();
  setupSummons();
  setupInitiativeHeroDice();
  setupForms();
  setupTriggers();
  setupEscalatorDiePositionBroadcast();
  //Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

registerHandlebarsHelpers();
registerTextEditorEnrichers();

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  CompendiumBrowser.preloadCache();
  // client custom color system settings
  configurePlayerChromatype();
  // The currency's name and image, to update the money in inventories when they change
  rememberCurrency();
  // "Same as the chromatype" dice styles saved with an old typo
  fixDiceStyleTypo();

  Hooks.on('hotbarDrop', (bar, data, slot) => createDocMacro(data, slot));
  // Create container element

  setupInitialSettings();
  createEscalatorDieDisplay();
  createBonusHeroDiceDisplay();
  setupBonusHeroDiceBroadcast();
  updateBonusHeroDiceDisplay();
  sendInitialMessage();
  SdmEffectsPanel.initialize();

  Hooks.on('dropCanvasData', async (canvas, data) => {
    const { uuid, type, x, y } = data;
    if (type !== 'Item') return;

    const item = await fromUuid(uuid);
    if (!item) return;

    // Check if it's a pet item (you can reuse the same condition)
    if (item.system?.type !== GearType.PET) return;
    if (!item.system.pet) return;

    // If the user is GM, create the token directly (bypass socket)
    if (game.user.isGM) {
      const { x: canvasX, y: canvasY } = canvas.grid.getTopLeftPoint(data);
      const petActor = await fromUuid(item.system.pet);
      if (!petActor) {
        ui.notifications.error('Linked pet actor not found.');
        return;
      }
      const tokenDoc = await petActor.getTokenDocument({ x: canvasX, y: canvasY });
      await canvas.scene.createEmbeddedDocuments('Token', [tokenDoc.toObject()], { sdmNoVariation: true });
      return;
    }

    const canPlayerDropPetOnCanvas = game.settings.get('sdm', 'canPlayerDropPetOnCanvas');

    if (!canPlayerDropPetOnCanvas) return;

    // Otherwise, request GM to create the token
    game.socket.emit('system.sdm', {
      action: 'createPetToken',
      userId: game.user.id,
      payload: { itemUuid: uuid, x, y }
    });

    // Optionally show a temporary notification
    // ui.notifications.info('Requesting GM to place your pet...');
  });

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
      <a class="info-link author-links" data-tooltip="Luka Rejec">${$l10n('SDM.Author')}</a>
    </li>
    <li>
      <a class="info-link dev-links" data-tooltip="Luber (Luiz Bertoni)">System Dev</a>
    </li>
    <li>
      <a class="info-link" href="https://github.com/luizrcb/foundryvtt-sdm/issues" target="_blank" data-tooltip="SDM.ReportBugs">${game.i18n.localize('SDM.Issues')}</a>
    </li>
    <li>
      <a class="info-link" href="https://github.com/luizrcb/foundryvtt-sdm/wiki" target="_blank" data-tooltip="SDM.SystemDocumentation">${game.i18n.localize('SDM.Wiki')}</a>
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
  section.classList.add('sdm', 'sidebar-info');
  section.innerHTML = `
    <div class="flex flex-around">
      <span>${$l10n('SDM.SupportThisSystem')}</span>
    </div>
    <div class="flex flex-around">
      <a class="mb-8 mt-4" href='https://ko-fi.com/R6R01IW3KM/tip' target='_blank'>
      <img class="kofi" data-tooltip="SDM.SupportThisSystem" height='30' style='border:0px;height:30px;cursor:pointer;' src='' border='0' alt='Support me on ko-fi.com' /></a>
      </a>
    </div>
    <h4 class="divider">${$l10n('WORLD.FIELDS.system.label')}</h4>
    <div class="system-badge">
      <div class="sdm-icon" data-tooltip="${sdm.title}" alt="${sdm.title}" style="cursor:pointer;"></div>
      <span class="system-mote" data-tooltip="${sdm.title}">roleplaying when time fades</span>
      <a class="system-version system-info" data-tooltip="SDM.ReleaseNotes" href="https://github.com/luizrcb/foundryvtt-sdm/releases/tag/v${sdm.version}" target="_blank">${sdm.version}</a>
    </div>
  `;
  section.append(_generateLinks());
  const authorLinks = section.querySelector('.author-links');
  if (authorLinks) {
    authorLinks.addEventListener('click', event => {
      event.preventDefault();
      LinksDialog(wtfStudioLinks);
    });
  }

  const devLinks = section.querySelector('.dev-links');
  if (devLinks) {
    devLinks.addEventListener('click', event => {
      event.preventDefault();
      LinksDialog(luberLinks);
    });
  }

  if (pip) section.querySelector('.system-info').insertAdjacentElement('beforeend', pip);
  const icon = section.querySelector('.sdm-icon');
  icon.addEventListener('click', event => {
    event.preventDefault();
    LinksDialog(wtfStudioLinks);
  });

  const mote = section.querySelector('.system-mote');
  mote.addEventListener('click', () => LinksDialog(wtfStudioLinks));

  html.querySelector('.info').insertAdjacentElement('afterend', section);
}
