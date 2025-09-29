import { SdmItem } from '../documents/item.mjs';

import { MAX_MODIFIER, UNENCUMBERED_THRESHOLD_CASH } from '../helpers/actorUtils.mjs';
import {
  ActorType,
  AttackTarget,
  GearType,
  ItemType,
  RollMode,
  RollType
} from '../helpers/constants.mjs';
import { prepareActiveEffectCategories } from '../helpers/effects.mjs';
import { $fmt, $l10n, capitalizeFirstLetter, toPascalCase } from '../helpers/globalUtils.mjs';
import {
  getSlotsTaken,
  ITEMS_NOT_ALLOWED_IN_CARAVANS,
  ITEMS_NOT_ALLOWED_IN_CHARACTERS,
  onItemCreateActiveEffects,
  onItemUpdate
} from '../helpers/itemUtils.mjs';
import { templatePath } from '../helpers/templates.mjs';
import { openItemTransferDialog } from '../items/transfer.mjs';
import { healingHeroDice } from '../rolls/hero_dice/index.mjs';
import SDMRoll, { sanitizeExpression } from '../rolls/sdmRoll.mjs';
import {
  renderNPCMoraleResult,
  renderReactionResult,
  renderSaveResult
} from '../rolls/ui/renderResults.mjs';
import { DEFAULT_SAVE_VALUE, SAVING_THROW_BASE_FORMULA } from '../settings.mjs';

const { api, sheets } = foundry.applications;
const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;
const DragDrop = foundry.applications.ux.DragDrop.implementation;
const FilePicker = foundry.applications.apps.FilePicker.implementation;
const TextEditor = foundry.applications.ux.TextEditor.implementation;
const { performIntegerSort } = foundry.utils;

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheetV2}
 */
export class SdmActorSheet extends api.HandlebarsApplicationMixin(sheets.ActorSheetV2) {
  constructor(options = {}) {
    super(options);

    // Create a new classes array with the npc class if needed
    const classes = [...this.options.classes];
    const window = { ...this.options.window };
    const controls = [...this.options.window.controls];

    if (this.actor?.type === ActorType.NPC) {
      classes.push(ActorType.NPC);
    }

    if (this.actor?.type === ActorType.CHARACTER) {
      controls.push({
        action: 'toggleMode',
        icon: 'fa-solid fa-gear',
        label: 'Edit Mode / Play Mode',
        ownership: 'OWNER'
      });
      window.controls = controls;
    }

    // Update options with the new classes array
    this.options = {
      ...this.options,
      classes,
      window
    };

    this.#dragDrop = this.#createDragDropHandlers();
  }
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['sdm', 'actor'],
    position: {
      width: 800,
      height: 800
    },
    window: {
      resizable: true
    },
    actions: {
      createDoc: this._createAndViewDoc,
      deleteDoc: this._deleteDoc,
      heroicHealing: { handler: this._onHeroHealing, buttons: [0, 2] },
      onEditImage: this._onEditImage,
      reactionRoll: this._onReactionRoll,
      roll: this._onRoll,
      rollNPCDamage: this._onRollNPCDamage,
      rollNPCMorale: this._onRollNPCMorale,
      rollSavingThrow: this._onRollSavingThrow,
      toggleEffect: this._toggleEffect,
      toggleMode: this._onToggleMode,
      toggleReadied: this._toggleReadied,
      transferItem: this._onTransferItem,
      updateAttack: this._onUpdateAttack,
      viewDoc: this._viewDoc,
      openDoc: { handler: this._openDoc, buttons: [0] },
      toggleItemStatus: { handler: this._toggleItemStatus, buttons: [0, 2] }
    },
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: null }],
    form: {
      submitOnChange: true
    }
  };

  /** @override */
  static PARTS = {
    header: {
      template: templatePath('actor/header')
    },
    tabs: {
      // Foundry-provided generic template
      template: 'templates/generic/tab-navigation.hbs'
    },
    inventory: {
      template: templatePath('actor/inventory'),
      scrollable: ['']
    },
    biography: {
      template: templatePath('actor/biography'),
      scrollable: ['']
    },
    notes: {
      template: templatePath('actor/notes'),
      scrollable: ['']
    },
    pet: {
      template: templatePath('actor/pet'),
      scrollable: ['']
    },
    effects: {
      template: templatePath('actor/effects'),
      scrollable: ['']
    }
  };

  async _openCustomRollModal(
    {
      type,
      from,
      ability = '',
      formula = '',
      canOvercharge = false,
      attack = '',
      versatile = false,
      versatileFormula = '',
      bonusDamage = '',
      powerOptions = [],
      powerIndex = 0,
      item = null
    },
    isShift = false,
    isCtrl = false
  ) {
    let rollTitlePrefix = '';
    const isDamage = type === RollType.DAMAGE;
    const isAttack = type === RollType.ATTACK;
    const isAbility = type === RollType.ABILITY;
    const isPower = type === RollType.POWER;
    const isCharacter = this.actor.type === ActorType.CHARACTER;
    const isPowerAlbum = type === RollType.POWER_ALBUM;

    let targetActor;

    const firstTarget = Array.from(game.user.targets)[0];
    if (firstTarget) {
      targetActor = firstTarget.actor;
    }

    if (isDamage) rollTitlePrefix = $l10n('SDM.Damage');
    if (isAttack) rollTitlePrefix = $l10n('SDM.Attack');
    if (isAbility) rollTitlePrefix = $l10n('SDM.Ability');
    if (isPowerAlbum) rollTitlePrefix = $l10n('SDM.PowerAlbum');
    if (rollTitlePrefix !== '') rollTitlePrefix += ' ';

    let title = from;

    const actorAttack = isAttack && isCharacter ? this.actor.system[attack] : null;
    const actorAttackBonus = isAttack && isCharacter ? actorAttack.bonus || 0 : 0;
    const allAttackBonus = isAttack && isCharacter ? this.actor.system?.attack_bonus || 0 : 0;
    const dmgOrAttackBonus = bonusDamage || actorAttackBonus + allAttackBonus;
    const availableSkills = this.actor.getAvailableSkills();
    const isCharacterActor = this.actor.type === ActorType.CHARACTER;
    const language = game.i18n.lang;
    let selectedSkill = isAttack ? actorAttack?.favorite_skill : '';
    let shouldExplode = !isDamage && !isPower && !isPowerAlbum;
    let selectedAbility = isAttack ? actorAttack?.default_ability : ability;

    const actorData = this.actor?.system;
    const damageMultiplier = CONFIG.SDM.getDamageMultiplier(actorData.base_damage_multiplier || 2);

    const template = await renderTemplate(templatePath('custom-roll-dialog'), {
      rollTitlePrefix,
      title,
      abilities: CONFIG.SDM.getOrderedAbilities(language),
      ability: isAttack ? actorAttack?.default_ability : ability,
      attack,
      availableSkills,
      selectedSkill,
      multiplierOptions: damageMultiplier,
      rollModes: CONFIG.SDM.rollMode,
      type,
      isCharacterActor,
      attackTargetChoices: CONFIG.SDM.attackTarget,
      powerOptions,
      powerIndex,
      blindGMRoll: isCtrl
    });

    const damageIcon =
      isPower || isPowerAlbum
        ? 'fa-solid fa-wand-magic-sparkles'
        : isDamage
          ? 'one-handed'
          : 'fa-solid fa-dice-d20';
    const buttonLabel =
      isDamage && versatile
        ? $l10n('SDM.OneHanded')
        : isPower || isPowerAlbum
          ? $l10n('SDM.Cast')
          : $l10n('SDM.ButtonRoll');

    const buttons = [
      {
        action: 'one-handed',
        icon: damageIcon,
        label: buttonLabel,
        callback: (event, button) => ({
          versatile: false,
          overcharge: false,
          ...new foundry.applications.ux.FormDataExtended(button.form).object
        })
      }
    ];

    if (versatile) {
      buttons.push({
        action: 'two-handed',
        icon: 'two-handed',
        label: $l10n('SDM.TwoHanded'),
        callback: (event, button) => ({
          versatile,
          overcharge: false,
          ...new foundry.applications.ux.FormDataExtended(button.form).object
        })
      });
    }

    buttons.push({
      action: 'overcharge',
      class: 'overcharge',
      // hidden: !overchargeFormula,
      style: { display: !canOvercharge ? 'none' : '' },
      icon: 'fa-solid fa-hand-sparkles',
      label: $l10n('SDM.PowerOvercharge'),
      callback: (event, button) => ({
        versatile: false,
        overcharge: true,
        ...new foundry.applications.ux.FormDataExtended(button.form).object
      })
    });

    const titleType = capitalizeFirstLetter(toPascalCase(type)).replace(' ', '');

    let rollOptions = {};

    if (!isShift) {
      // Create and render the modal
      rollOptions = await foundry.applications.api.DialogV2.wait({
        window: {
          title: $fmt('SDM.RollType', { type: $l10n(`SDM.${titleType}`) })
        },
        powerOptions,
        content: template,
        position: {
          width: 400
        },
        buttons
      });
    }

    if (rollOptions === null) {
      return;
    }

    const {
      selectedAbility: selectedAbilityModal,
      modifier = '',
      heroicQty = '0',
      rollMode = RollMode.NORMAL,
      shouldExplode: shouldExplodeModal,
      multiplier = '',
      selectedSkill: modalSelectedSkill,
      attackTarget = AttackTarget.PHYSICAL,
      powerIndex: powerIndexModal
    } = rollOptions;

    if (powerIndexModal !== undefined) {
      powerIndex = parseInt(powerIndexModal, 10);
      selectedAbility = powerOptions[powerIndex].default_ability;
    }

    if (modalSelectedSkill !== undefined) {
      selectedSkill = modalSelectedSkill;
    }

    if (shouldExplodeModal !== undefined) {
      shouldExplode = shouldExplodeModal;
    }

    if (selectedAbilityModal !== undefined) {
      selectedAbility = selectedAbilityModal;
    }

    const heroicDice = parseInt(heroicQty || 0, 10);
    const currentHeroDice = this.actor.system.hero_dice?.value ?? 0;

    if (heroicDice > currentHeroDice) {
      ui.notifications.error('Not enough hero dice for this roll');
      return;
    }

    if (isPowerAlbum) {
      title = powerOptions[powerIndex].name;
      selectedAbility = powerOptions[powerIndex].default_ability;
      formula = powerOptions[powerIndex].formula;
    }

    const modPart = foundry.dice.Roll.validate(modifier) ? `+${modifier}` : '';

    const rollData = {
      type,
      actor: this.actor,
      from: title,
      ability: selectedAbility,
      mode: rollMode,
      modifier: dmgOrAttackBonus ? `${modPart}+${dmgOrAttackBonus}` : modPart,
      multiplier,
      explodingDice: shouldExplode,
      versatile: !!rollOptions.versatile,
      skill: availableSkills[selectedSkill],
      targetActor,
      attackTarget
    };

    if (formula) {
      rollData.formula = formula;
    }

    if (versatileFormula && rollOptions.versatile) {
      rollData.formula = versatileFormula;
    }

    if (isPower || isPowerAlbum) {
      rollData.powerDescription = powerOptions[powerIndex].description;
    }

    if (rollOptions.overcharge) {
      rollData.from =
        powerOptions[powerIndex].overcharge + ` (${$l10n('SDM.PowerOvercharge').toLowerCase()})`;
      rollData.formula = powerOptions[powerIndex].overchargeFormula;
      rollData.powerDescription = `${powerOptions[powerIndex].description}<strong>${$l10n('SDM.PowerOvercharge')}</strong><br>${powerOptions[powerIndex].overchargeDescription}`;
    }

    if ((isPower || isPowerAlbum) && !rollData.formula) {
      rollData.sendPowerToChat = true;
    }

    if (item) {
      rollData.item = item;

      if (isPowerAlbum) {
        const powerItem = item.system.powers[powerIndex];
        const newPowerItem = new SdmItem({
          name: powerItem.name,
          type: 'gear',
          img: powerItem.img,
          system: {
            type: 'power',
            ...powerItem,
            power: {
              ...powerItem
            }
          }
        });
        rollData.item = newPowerItem;
      }
    }

    rollData.isCtrl = isCtrl;
    const sdmRoll = new SDMRoll(rollData);
    await sdmRoll.evaluate();
  }

  async _openUpdateAttackModal(attack) {
    const availableSkills = this.actor.getAvailableSkills();
    const capitalizedAttack = capitalizeFirstLetter(attack);
    const skills = Object.values(availableSkills);
    const lang = game.i18n.lang;
    const attackSystemData = this.actor.system[attack];
    const { default_ability: selectedAbility, favorite_skill: selectedSkill } = attackSystemData;

    const template = await renderTemplate(templatePath('actor/character/update-attack'), {
      skills,
      abilities: CONFIG.SDM.getOrderedAbilities(lang),
      attack: $l10n(`SDM.Attack${capitalizedAttack}`),
      selectedAbility,
      selectedSkill
    });

    const updateAttackOptions = await foundry.applications.api.DialogV2.prompt({
      window: {
        title: game.i18n.format('DOCUMENT.Update', {
          type: $l10n(`SDM.Attack${capitalizedAttack}`)
        })
      },
      content: template,
      ok: {
        icon: 'fa-solid fa-floppy-disk',
        label: game.i18n.format('SDM.ButtonSave'),
        callback: (event, button) =>
          new foundry.applications.ux.FormDataExtended(button.form).object
      }
    });

    if (!updateAttackOptions) return;

    const { default_ability = '', favorite_skill = '' } = updateAttackOptions;

    await this.actor.update({
      [`system.${attack}`]: {
        ...this.actor.system[attack],
        default_ability,
        favorite_skill
      }
    });
  }

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    // Not all parts always render
    options.parts = ['header', 'tabs'];
    // Don't show the other tabs if only limited view
    if (!this.document.limited) {
      // Control which parts show based on document subtype
      switch (this.document.type) {
        case 'character':
          options.parts.push('inventory', 'effects');
          break;
        case 'npc':
          options.parts.push('inventory', 'effects');
          break;
      }
      options.parts.push('notes');
    }

    options.parts.push('biography');
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    // Output initialization
    const context = {
      // Validates both permissions and compendium status
      editable: this.isEditable,
      owner: this.document.isOwner,
      limited: this.document.limited,
      // Add the actor document.
      actor: this.actor,
      // Add the actor's data to context.data for easier access, as well as flags.
      system: this.actor.system,
      flags: this.actor.flags,
      // Adding a pointer to CONFIG.SDM
      config: CONFIG.SDM,
      tabs: this._getTabs(options.parts),
      // Necessary for formInput and formFields helpers
      fields: this.document.schema.fields,
      systemFields: this.document.system.schema.fields,
      // Add isGM to the context
      isGM: game.user.isGM
    };

    if (this.actor.type === 'character') {
      const heroDiceType =
        this.actor.system.hero_dice?.dice_type || game.settings.get('sdm', 'defaultHeroDiceType');

      context.heroDiceType = heroDiceType;
      context.isEditMode = this.actor.getFlag('sdm', 'editMode') ?? false;
    }

    // Offloading context prep to a helper function
    this._prepareItems(context);

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case 'inventory':
        context.tab = context.tabs[partId];
        break;
      case 'pet':
        context.tab = context.tabs[partId];
        break;
      case 'notes':
        context.tab = context.tabs[partId];
        // Enrich notes info for display
        // Enrichment turns text like `[[/r 1d20]]` into buttons
        context.enrichedNotes = await TextEditor.enrichHTML(this.actor.system.notes, {
          // Whether to show secret blocks in the finished html
          secrets: this.document.isOwner,
          // Data to fill in for inline rolls
          rollData: this.actor.getRollData(),
          // Relative UUID resolution
          relativeTo: this.actor
        });
        break;
      case 'biography':
        context.tab = context.tabs[partId];
        // Enrich biography info for display
        // Enrichment turns text like `[[/r 1d20]]` into buttons
        context.enrichedBiography = await TextEditor.enrichHTML(this.actor.system.biography, {
          // Whether to show secret blocks in the finished html
          secrets: this.document.isOwner,
          // Data to fill in for inline rolls
          rollData: this.actor.getRollData(),
          // Relative UUID resolution
          relativeTo: this.actor
        });
        break;
      case 'effects':
        context.tab = context.tabs[partId];
        // Prepare active effects
        context.effects = prepareActiveEffectCategories(
          // A generator that returns all effects stored on the actor
          // as well as any items
          this.actor.allApplicableEffects()
        );
        break;
    }

    return context;
  }

  /**
   * Generates the data for the generic tab navigation template
   * @param {string[]} parts An array of named template parts to render
   * @returns {Record<string, Partial<ApplicationTab>>}
   * @protected
   */
  _getTabs(parts) {
    // If you have sub-tabs this is necessary to change
    const tabGroup = 'primary';
    // Default tab for first time it's rendered this session
    if (!this.tabGroups[tabGroup]) this.tabGroups[tabGroup] = 'inventory';
    return parts.reduce((tabs, partId) => {
      const tab = {
        cssClass: '',
        group: tabGroup,
        // Matches tab property to
        id: '',
        // FontAwesome Icon, if you so choose
        icon: '',
        // Run through localization
        label: 'SDM.Tab'
      };
      switch (partId) {
        case 'header':
        case 'tabs':
          return tabs;
        case 'inventory':
          tab.id = 'inventory';
          tab.label += 'Inventory';
          tab.icon = 'fa fa-toolbox';
          break;
        case 'pet':
          tab.id = 'pet';
          tab.label += 'Pet';
          tab.icon = 'fa fa-otter';
          break;
        case 'effects':
          tab.id = 'effects';
          tab.label += 'Effects';
          tab.icon = 'fa fa-bolt';
          break;
        case 'notes':
          tab.id = 'notes';
          tab.label += 'Notes';
          tab.icon = 'fa fa-book';
          break;
        case 'biography':
          tab.id = 'biography';
          tab.label += 'Biography';
          tab.icon = 'fa fa-user';
          break;
      }
      if (this.tabGroups[tabGroup] === tab.id) tab.cssClass = 'active';
      tabs[partId] = tab;
      return tabs;
    }, {});
  }

  /**
   * Organize and classify Items for Actor sheets.
   *
   * @param {object} context The context object to mutate
   */
  _prepareItems(context) {
    // Initialize containers.
    // You can just use `this.document.itemTypes` instead
    // if you don't need to subdivide a given type like
    // this sheet does with spells

    const transport = [];
    const isCaravan = this.actor.type === ActorType.CARAVAN;
    const isCharacter = this.actor.type === ActorType.CHARACTER;
    const isNPC = this.actor.type === ActorType.NPC;

    // Iterate through items, allocating to containers
    for (let i of this.document.items) {
      if (ITEMS_NOT_ALLOWED_IN_CHARACTERS.includes(i.type) && isCaravan) {
        transport.push(i);
      }
    }

    const inventory = this.actor.checkInventorySlots();
    const { items, traits, burdens, burdenPenalty } = inventory;

    // Sort then assign
    context.items = items.slots.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.itemSlotsTaken = items.slotsTaken;
    context.packedSlotsTaken = items.packedTaken;

    context.traits = traits.slots.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.traitSlotsTaken = traits.slotsTaken;

    context.burdens = burdens.slots.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.burdenSlotsTaken = burdenPenalty;

    if (isCaravan) {
      context.transport = transport;
    }
  }

  /**
   * Actions performed after any render of the Application.
   * Post-render steps are not awaited by the render process.
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   * @override
   */
  _onRender(context, options) {
    this.#dragDrop.forEach(d => d.bind(this.element));
    this.#disableOverrides();
    // You may want to add other special handling here
    // Foundry comes with a large number of utility classes, e.g. SearchFilter
    // That you may want to implement yourself.

    // Add item change listeners
    this._setupItemListeners();
  }

  /**
   * Actions performed after a first render of the Application.
   * @param {ApplicationRenderContext} context      Prepared context data.
   * @param {RenderOptions} options                 Provided render options.
   * @protected
   */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    this._createContextMenu(
      this._getItemListContextOptions,
      //'[data-document-class][data-item-id], [data-document-class][data-effect-id]',
      '[data-document-class][data-item-id]',
      {
        hookName: 'getItemListContextOptions',
        parentClassHooks: false,
        fixed: true
      }
    );
  }

  _getItemListContextOptions() {
    return this.actor._getItemListContextOptions();
  }

  /**
   * Set up listeners for item changes specific to this actor
   */
  // Update the item listeners to handle updates
  // Updated listener setup with proper hook handling
  _setupItemListeners() {
    const actorId = this.actor.id;

    this._teardownItemListeners();

    this._itemListeners = {
      preCreate: Hooks.on('preCreateItem', (item, options, userId) => {
        if (item.parent?.id === actorId && !this._validateItemWeight(item)) return false;
      }),
      create: Hooks.on('createItem', (item, options, userId) => {
        if (item.parent?.id === actorId) {
          const shouldAllow = this._checkCarriedWeight(item);
          if (!shouldAllow) return false;
          return onItemCreateActiveEffects(item);
        }
      }),
      preUpdate: Hooks.on('preUpdateItem', (item, changedData) => {
        if (item.parent?.id === actorId) {
          const shouldAllow = this._checkCarriedWeight(item, changedData);
          if (!shouldAllow) return false;
        }
      }),
      update: Hooks.on('updateItem', (item, changes, options, userId) => {
        if (item.parent?.id === actorId) {
          // const shouldAllow = this._checkCarriedWeight(item, updateData);
          // if (!shouldAllow) return false;
          return onItemUpdate(item, changes);
        }
      }),
      delete: Hooks.on('deleteItem', (item, options, userId) => {
        if (item.parent?.id === actorId) return;
      })
    };
  }

  _checkActorWeightLimit(additionalSlots = 0, itemType) {
    if (this.actor.type === ActorType.NPC) {
      return true;
    }
    const itemSlotsTaken = this.actor.system.item_slots_taken;
    const actorItemSlots = this.actor.system.item_slots;
    const traitSlotsTaken = this.actor.system.trait_slots_taken;
    const actorTraitSlots = this.actor.system.trait_slots;

    if (itemType === ItemType.GEAR) {
      if (itemSlotsTaken + additionalSlots <= actorItemSlots) return true;
    } else if (itemType === ItemType.TRAIT) {
      if (traitSlotsTaken + additionalSlots <= actorTraitSlots) return true;
    }

    const actorBurdenPenalty = this.actor.system.burden_penalty || 0;
    const newBurdenPenalTy = additionalSlots + actorBurdenPenalty;
    const maxBurdenSlots = this.actor.system.burden_slots;

    return newBurdenPenalTy <= maxBurdenSlots;
  }

  async unpackStartingKitItem(target) {
    const item = this._getEmbeddedDocument(target);
    await SdmActorSheet._createAndViewDoc.call(this, null, {
      dataset: {
        documentClass: 'Item',
        type: 'gear'
      }
    });

    if (item.system?.starting_kit && item.system?.packed_remaining_items === 1) {
      await item.delete();
      return;
    }

    await item.update({ 'system.packed_remaining_items': item.system.packed_remaining_items - 1 });
  }

  _checkCarriedWeight(item, updateData) {
    if (this.actor.type === ActorType.NPC) {
      return true;
    }

    let itemSlots = getSlotsTaken(item?.system);

    if (updateData && !updateData.system) return true;

    let updateDataSlots = updateData ? getSlotsTaken(updateData?.system) : null;

    if (updateData?.system?.is_hallmark && !this.actor?.canAddHallmarkItem()) {
      ui.notifications.error($fmt('SDM.ErrorHallmarkLimit', { target: this.actor.name }));
      return false;
    }

    if (updateData && updateDataSlots <= itemSlots) {
      return true;
    }

    const slotsTaken = updateData ? updateDataSlots - itemSlots : itemSlots;
    const validWeight = this._checkActorWeightLimit(slotsTaken, item.type);

    if (!validWeight) {
      ui.notifications.error($fmt('SDM.ErrorWeightLimit', { target: this.actor.name }));
      return false;
    }
    return true;
  }

  // Helper validation method
  _validateItemWeight(item) {
    if (this.actor.type === ActorType.NPC) {
      return true;
    }

    if (
      this.actor.type === ActorType.CHARACTER &&
      item.system.is_hallmark &&
      !this.actor.canAddHallmarkItem()
    ) {
      ui.notifications.error($fmt('SDM.ErrorHallmarkLimit', { target: this.actor.name }));
      return false;
    }

    const itemSlots = getSlotsTaken(item.system);
    const validWeight = this._checkActorWeightLimit(itemSlots, item.type);

    if (!validWeight) {
      ui.notifications.error($fmt('SDM.ErrorWeightLimit', { target: this.actor.name }));
      return false;
    }

    return true;
  }

  /**
   * Remove item change listeners when sheet closes
   */
  _teardownItemListeners() {
    if (!this._itemListeners) return;
    Hooks.off('preCreateItem', this._itemListeners.preCreate);
    Hooks.off('preUpdateItem', this._itemListeners.preUpdate);
    Hooks.off('createItem', this._itemListeners.create);
    Hooks.off('updateItem', this._itemListeners.update);
    Hooks.off('deleteItem', this._itemListeners.delete);
    this._itemListeners = null;
  }

  /** @override */
  async close(options) {
    this._teardownItemListeners();
    return super.close(options);
  }

  async _checkEncumbrance() {
    const actor = this.actor;
    const cumbersomeArmor =
      this.actor.items.contents.filter(
        item => item.type === ItemType.ARMOR && item.system.cumbersome && item.system.readied
      ).length > 0;
    // Calculate current encumbrance (SDM-specific calculation)

    const carriedWeight = this.actor.getCarriedGear();
    const encumbranceThreshold =
      this.actor.system.carry_weight?.unencumbered ?? UNENCUMBERED_THRESHOLD_CASH;
    const encumberedEffect = actor.effects.getName('encumbered');
    const encumberedSlow = actor.effects.getName('slow (encumbered)');
    const cumbersomeArmorEffect = actor.effects.getName('cumbersome (armor)');

    // Update encumbrance effect
    if (carriedWeight > encumbranceThreshold && !encumberedEffect) {
      await actor.addEncumberedEffect();
      await actor.addEncumberedSlow();
    } else if (carriedWeight <= encumbranceThreshold && encumberedEffect) {
      await encumberedEffect.delete();
      await encumberedSlow.delete();
    }

    if (cumbersomeArmor && !cumbersomeArmorEffect) {
      await actor.addCumbersomeArmor();
    } else if (cumbersomeArmorEffect && !cumbersomeArmor) {
      await cumbersomeArmorEffect.delete();
    }
  }

  /**************
   *
   *   ACTIONS
   *
   **************/

  /**
   * Handle changing a Document's image.
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onEditImage(event, target) {
    const attr = target.dataset.edit;
    const current = foundry.utils.getProperty(this.document, attr);
    const { img } = this.document.constructor.getDefaultArtwork?.(this.document.toObject()) ?? {};
    const fp = new FilePicker({
      current,
      type: 'image',
      redirectToRoot: img ? [img] : [],
      callback: path => {
        this.document.update({ [attr]: path });
      },
      top: this.position.top + 40,
      left: this.position.left + 10
    });
    return fp.browse();
  }

  /**
   * Renders an embedded document's sheet
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _viewDoc(event, target) {
    const doc = this._getEmbeddedDocument(target);
    doc.sheet.render(true);
  }

  /**
   * Handles item deletion
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _deleteDoc(event, target) {
    const doc = this._getEmbeddedDocument(target);
    const proceed = await DialogV2.confirm({
      content: `<b>${$fmt('SDM.DeleteDocConfirmation', { doc: doc.name })}</b>`,
      modal: true,
      rejectClose: false,
      yes: { label: $l10n('SDM.ButtonYes') },
      no: { label: $l10n('SDM.ButtonNo') }
    });
    if (proceed) await doc.delete();
  }

  /**
   * Handles creating a new Owned Item and already open it for Editing
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _createAndViewDoc(event, target) {
    const newDoc = await SdmActorSheet._createDoc.call(this, event, target);
    newDoc.sheet.render(true);
  }

  /**
   * Handle creating a new Owned Item or ActiveEffect for the actor using initial data defined
   * in the HTML dataset
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _createDoc(event, target) {
    const docCls = getDocumentClass(target.dataset.documentClass);
    const docData = {
      name: docCls.defaultName({
        type: target.dataset.type,
        parent: this.actor
      })
    };

    // Apply dataset properties
    for (const [dataKey, value] of Object.entries(target.dataset)) {
      if (['action', 'documentClass'].includes(dataKey)) continue;
      foundry.utils.setProperty(docData, dataKey, value);
    }

    return await docCls.create(docData, { parent: this.actor });
  }

  /**
   * Determines effect parent to pass to helper
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _toggleEffect(event, target) {
    const effect = this._getEmbeddedDocument(target);
    await effect.update({ disabled: !effect.disabled });
  }

  /**
   * Determines effect parent to pass to helper
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _toggleReadied(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    const item = this._getEmbeddedDocument(target);

    await item.toggleReadied();
  }

  static async _onTransferItem(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if (event.detail > 1) return; // Ignore repeated clicks
    const item = this._getEmbeddedDocument(target);
    return openItemTransferDialog(item, this.actor);
  }

  static async _onToggleMode(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return; // Ignore repeated clicks
    const currentMode = this.actor.getFlag('sdm', 'editMode') ?? false;
    const newMode = !currentMode;

    await this.actor.setFlag('sdm', 'editMode', newMode);
    return this.render();
  }

  /**
   * Handle clickable rolls.
   *
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onRoll(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if (event.detail > 1) return; // Ignore repeated clicks

    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;

    // Get common data attributes
    const dataset = target.dataset;
    let ability = dataset.ability;
    let label = dataset.label;
    const attack = dataset.attack;
    const type = dataset.type;
    let formula = dataset.roll || '';
    let versatile = false;
    let versatileFormula = '';
    let overchargeFormula = '';
    let bonusDamage = '';
    let powerOptions;
    let powerIndex;
    let canOvercharge = false;
    let rollItem = null;

    //Handle item rolls.
    switch (type) {
      case 'damage':
        const item = this._getEmbeddedDocument(target);
        rollItem = item;
        const weaponDamage = item.system.weapon.damage;
        ability = item.system.default_ability;
        formula = weaponDamage.base;
        bonusDamage = weaponDamage.bonus;
        versatile = item.system?.weapon?.versatile || false;

        if (versatile) {
          versatileFormula = weaponDamage.versatile;
        }

        break;
      case 'power':
        const powerItem = this._getEmbeddedDocument(target);
        rollItem = powerItem;
        const powerData = powerItem.system.power;
        label = powerItem.getPowerShortTitle(powerData, this.actor.system.power_cost);
        ability = powerData.default_ability;
        formula = powerData.roll_formula;
        overchargeFormula = powerData.overcharge_roll_formula;

        powerOptions = [
          {
            index: 0,
            name: powerItem.getPowerShortTitle(powerData, this.actor.system.power_cost),
            overcharge: powerItem.getPowerShortTitle(powerData, this.actor.system.power_cost, true),
            formula: powerData.roll_formula,
            overchargeFormula: powerData.overcharge_roll_formula,
            canOvercharge: !!powerData.overcharge,
            default_ability: powerData.default_ability,
            description: powerItem.system.description,
            overchargeDescription: powerData.overcharge
          }
        ];
        powerIndex = 0;
        canOvercharge = !!powerData.overcharge;
        break;

      case 'power_album':
        const powerAlbum = this._getEmbeddedDocument(target);
        const { powers, powers_current_index } = powerAlbum.system;
        rollItem = powerAlbum;
        powerIndex = powers_current_index;
        const selectedPower = powers[powerIndex];

        powerOptions = powers.map((power, index) => {
          return {
            index,
            name: powerAlbum.getPowerShortTitle(power, this.actor.system.power_cost),
            overcharge: powerAlbum.getPowerShortTitle(power, this.actor.system.power_cost, true),
            formula: power.roll_formula,
            overchargeFormula: power.overcharge_roll_formula,
            canOvercharge: !!power.overcharge,
            default_ability: power.default_ability,
            description: power.description,
            overchargeDescription: power.overcharge
          };
        });
        ability = selectedPower.default_ability;
        formula = selectedPower.roll_formula;
        overchargeFormula = selectedPower.overcharge_roll_formula;
        canOvercharge = !!selectedPower.overcharge;

        break;
    }

    const rollAttributes = {
      type,
      from: label,
      formula,
      ability,
      attack,
      versatile,
      versatileFormula,
      overchargeFormula,
      canOvercharge,
      bonusDamage,
      powerOptions,
      powerIndex,
      item: rollItem
    };

    this._openCustomRollModal(rollAttributes, isShift, isCtrl);
  }

  static async _onRollNPCDamage(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return;
    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;

    const damage = this.actor.system.damage || '1d4';

    const rollAttributes = {
      type: RollType.DAMAGE,
      from: this.actor.name,
      formula: damage
    };

    this._openCustomRollModal(rollAttributes, isShift, isCtrl);
  }

  static async _onRollNPCMorale(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return;
    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;

    let data = { modifier: '' };

    if (!isShift) {
      data = await DialogV2.wait({
        window: {
          title: $fmt('SDM.RollType', { type: $l10n('SDM.Morale') }),
          resizable: true
        },
        content: await renderTemplate(templatePath('actor/npc/morale-roll-dialog'), {
          rollModes: CONFIG.SDM.rollMode,
          blindGMRoll: isCtrl
        }),
        buttons: [
          {
            label: $l10n('SDM.ButtonRoll'),
            icon: 'fa-solid fa-person-running',
            callback: (event, button) => ({
              ...new foundry.applications.ux.FormDataExtended(button.form).object
            })
          }
        ],
        rejectClose: false
      });
    }

    if (!data) {
      return;
    }

    const { modifier = '', rollMode = 'normal' } = data;
    const modPart = foundry.dice.Roll.validate(modifier) ? `+${modifier}` : '';
    const basMoraleFormula = game.settings.get('sdm', 'baseMoraleFormula') || '2d6';

    const keepModifier =
      rollMode === RollMode.ADVANTAGE ? 'kh' : rollMode === RollMode.DISADVANTAGE ? 'kl' : '';

    const diceExpression = keepModifier
      ? `{${basMoraleFormula}, ${basMoraleFormula}}${keepModifier}`
      : basMoraleFormula;

    const formula = `${diceExpression} ${modPart}`;
    const sanitizedFormula = sanitizeExpression(formula);
    const targetNumber = this.actor.system.morale || 2;

    // Create and evaluate the roll
    let roll = new Roll(sanitizedFormula);
    roll = await roll.evaluate();

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });

    await renderNPCMoraleResult({ roll, targetNumber }, { fromHeroDice: false, speaker, isCtrl });
  }

  static async _onReactionRoll(event, target) {
    event.preventDefault();
    event.stopPropagation();

    if (event.detail > 1) return;

    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;
    let data = { modifier: '', charismaOperator: 1, customBaseFormula: '' };

    if (!isShift) {
      data = await DialogV2.wait({
        window: {
          title: $fmt('SDM.RollType', { type: $l10n('SDM.Reaction') })
        },
        position: {
          width: 500,
          height: 300
        },
        content: await renderTemplate(templatePath('reaction-roll-dialog'), {
          rollModes: CONFIG.SDM.rollMode,
          blindGMRoll: isCtrl
        }),
        buttons: [
          {
            action: 'diplomacy',
            label: $l10n('SDM.ReactionCheck'),
            icon: 'fa-solid fa-face-smile',
            callback: (event, button) => ({
              charismaOperator: 1,
              ...new foundry.applications.ux.FormDataExtended(button.form).object
            })
          },
          {
            action: 'conflict',
            label: $l10n('SDM.ReactionProvokeConflict'),
            icon: 'fa-solid fa-face-angry',
            callback: (event, button) => ({
              charismaOperator: -1,
              ...new foundry.applications.ux.FormDataExtended(button.form).object
            })
          }
        ],
        rejectClose: false
      });
    }

    if (!data) {
      return;
    }

    const {
      modifier = '',
      charismaOperator = 1,
      rollMode = 'normal',
      customBaseFormula = ''
    } = data;

    const baseFormula = game.settings.get('sdm', 'baseReactionFormula') || '2d6';

    const finalBaseFormula = foundry.dice.Roll.validate(customBaseFormula)
      ? customBaseFormula
      : baseFormula;

    const reactionBonus = this.actor.system.reaction_bonus || 0;
    const burdenPenalty = this.actor.system.burden_penalty || 0;
    const chaMod = this.actor.system.abilities['cha'].current;
    const burdenPart = burdenPenalty > 0 ? -1 * burdenPenalty : 0;
    const chaPart = charismaOperator > 0 ? chaMod : -1 * chaMod;
    const totalBonuses = chaPart + reactionBonus + burdenPart;
    const bonusPart =
      totalBonuses === 0 ? '' : totalBonuses > 0 ? `+${totalBonuses}` : totalBonuses;
    const modPart = foundry.dice.Roll.validate(modifier) ? ` +${modifier}` : '';

    const keepModifier =
      rollMode === RollMode.ADVANTAGE ? 'kh' : rollMode === RollMode.DISADVANTAGE ? 'kl' : '';

    const diceExpression = keepModifier
      ? `{${finalBaseFormula}, ${finalBaseFormula}}${keepModifier}`
      : finalBaseFormula;

    const formula = `${diceExpression}${bonusPart}${modPart}`;
    const sanitizedFormula = sanitizeExpression(formula);

    let roll = new Roll(sanitizedFormula);
    roll = await roll.evaluate();

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });

    await renderReactionResult(
      { roll, charismaOperator },
      { fromHeroDice: false, speaker, isCtrl }
    );
  }

  static async _onRollSavingThrow(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if (event.detail > 1) return; // Ignore repeated clicks

    // Get common data attributes
    const dataset = target.dataset;
    const { ability } = dataset;
    const abilityData =
      ability !== ActorType.NPC
        ? this.actor.system.abilities[ability]
        : { current: this.actor.system.bonus };
    const finalAbility = abilityData?.current;
    const ward = this.actor?.system?.ward || 0;
    const burdenPenalty = this.actor.system?.burden_penalty || 0;
    const saveBonus = abilityData?.save_bonus || 0;
    const allSaveBonus = this.actor.system?.all_save_bonus || 0;
    const savingThrowSum = finalAbility + ward + saveBonus + allSaveBonus - burdenPenalty;

    const useHardLimitRule = game.settings.get('sdm', 'useHardLimitRule');
    const defaultHardLimitValue = game.settings.get('sdm', 'defaultHardLimitValue') || MAX_MODIFIER;
    const finalSavingThrowBonus = useHardLimitRule
      ? Math.min(savingThrowSum, defaultHardLimitValue)
      : savingThrowSum;

    const reverseShift = game.settings.get('sdm', 'reverseShiftKey');
    const isShift = reverseShift !== !!event.shiftKey;
    const isCtrl = !!event.ctrlKey;

    let label = $fmt('SDM.SavingThrowRoll', {
      ability: $l10n(CONFIG.SDM.abilities[ability]) || $l10n('TYPES.Actor.npc')
    });

    if (ward > 0) {
      label += ` (${$l10n('TYPES.Item.ward').toLowerCase()} +${ward})`;
    }

    const actorData = this.actor?.system;
    const damageMultiplier = CONFIG.SDM.getDamageMultiplier(actorData.base_damage_multiplier || 2);

    const template = await renderTemplate(templatePath('custom-roll-dialog'), {
      rollTitlePrefix: '',
      title: label,
      abilities: [],
      ability,
      attack: '',
      availableSkills: [],
      selectedSkill: '',
      multiplierOptions: damageMultiplier,
      rollModes: CONFIG.SDM.rollMode,
      type: RollType.SAVE,
      isCharacterActor: true,
      attackTargetChoices: CONFIG.SDM.attackTarget,
      blindGMRoll: isCtrl
    });

    const buttons = [
      {
        action: 'save',
        icon: 'fa-solid fa-dice-d20',
        label: $l10n('SDM.ButtonRoll'),
        callback: (event, button) => ({
          versatile: false,
          ...new foundry.applications.ux.FormDataExtended(button.form).object
        })
      }
    ];

    let rollOptions = {};

    if (!isShift) {
      // Create and render the modal
      rollOptions = await foundry.applications.api.DialogV2.wait({
        window: {
          title: $fmt('SDM.RollType', { type: $l10n('SDM.FieldSaveTarget') })
        },
        content: template,
        position: {
          width: 400
        },
        rejectClose: false,
        buttons
      });

      if (rollOptions === null) {
        return;
      }
    }

    const modifier = rollOptions?.modifier;
    const rollMode = rollOptions?.rollMode;

    const modPart = foundry.dice.Roll.validate(modifier) ? `+${modifier}` : '';
    const baseRollFormula =
      game.settings.get('sdm', 'savingThrowBaseRollFormula') || SAVING_THROW_BASE_FORMULA;

    const keepModifier =
      rollMode === RollMode.ADVANTAGE ? 'kh' : rollMode === RollMode.DISADVANTAGE ? 'kl' : '';

    const diceExpression = keepModifier
      ? `{${baseRollFormula}, ${baseRollFormula}}${keepModifier}`
      : baseRollFormula;

    const bonusPart =
      finalSavingThrowBonus === 0
        ? ''
        : finalSavingThrowBonus > 0
          ? `+${finalSavingThrowBonus}`
          : finalSavingThrowBonus;

    let formula = `${diceExpression}${bonusPart}${modPart}`;

    const targetNumber = this.actor.system?.save_target || DEFAULT_SAVE_VALUE;
    formula = sanitizeExpression(formula);
    // Create and evaluate the roll
    let roll = new Roll(formula);
    roll = await roll.evaluate();

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });

    await renderSaveResult({ roll, label, targetNumber }, { fromHeroDice: false, speaker, isCtrl });
  }

  static async _onUpdateAttack(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if (event.detail > 1) return; // Ignore repeated clicks

    // Get common data attributes
    const dataset = target.dataset;
    const { attack } = dataset;

    this._openUpdateAttackModal(attack);
  }

  static async _onHeroHealing(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    const { detail, button } = event;
    if (event.detail > 1) return;

    let onlySpendWithoutRolling = button === 2;

    // Get common data attributes
    await healingHeroDice(event, this.actor, onlySpendWithoutRolling);
  }

  static async _openDoc(event, target) {
    const { detail, button } = event;

    if (button === 0) {
      if (detail <= 1 || detail > 2) return;
      return SdmActorSheet._viewDoc.call(this, event, target);
    }
  }

  static async _toggleItemStatus(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events

    const item = this._getEmbeddedDocument(target);
    await item.toggleItemStatus(event);
  }

  /** Helper Functions */

  /**
   * Fetches the embedded document representing the containing HTML element
   *
   * @param {HTMLElement} target    The element subject to search
   * @returns {Item | ActiveEffect} The embedded Item or ActiveEffect
   */
  _getEmbeddedDocument(target) {
    const docRow = target.closest('li[data-document-class]');
    if (docRow.dataset.documentClass === 'Item') {
      return this.actor.items.get(docRow.dataset.itemId);
    } else if (docRow.dataset.documentClass === 'ActiveEffect') {
      const parent =
        docRow.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(docRow?.dataset.parentId);
      return parent.effects.get(docRow?.dataset.effectId);
    } else return console.warn('Could not find document class');
  }

  /***************
   *
   * Drag and Drop
   *
   ***************/

  /**
   * Define whether a user is able to begin a dragstart workflow for a given drag selector
   * @param {string} selector       The candidate HTML selector for dragging
   * @returns {boolean}             Can the current user drag this selector?
   * @protected
   */
  _canDragStart(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Define whether a user is able to conclude a drag-and-drop workflow for a given drop selector
   * @param {string} selector       The candidate HTML selector for the drop target
   * @returns {boolean}             Can the current user drop on this selector?
   * @protected
   */
  _canDragDrop(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragStart(event) {
    const docRow = event.currentTarget.closest('li');
    if ('link' in event.target.dataset) return;

    // Chained operation
    let dragData = this._getEmbeddedDocument(docRow)?.toDragData();

    if (!dragData) return;

    // Set data transfer
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  /**
   * Callback actions which occur when a dragged element is over a drop target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragOver(event) {}

  /**
   * Callback actions which occur when a dragged element is dropped on a target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    const actor = this.actor;
    const allowed = Hooks.call('dropActorSheetData', actor, this, data);
    if (allowed === false) return;

    // Handle different data types
    switch (data.type) {
      case 'ActiveEffect':
        return this._onDropActiveEffect(event, data);
      case 'Actor':
        return this._onDropActor(event, data);
      case 'Item':
        return this._onDropItem(event, data);
      case 'Folder':
        return this._onDropFolder(event, data);
    }
  }

  /**
   * Handle the dropping of ActiveEffect data onto an Actor Sheet
   * @param {DragEvent} event                  The concluding DragEvent which contains drop data
   * @param {object} data                      The data transfer extracted from the event
   * @returns {Promise<ActiveEffect|boolean>}  The created ActiveEffect object or false if
   *                                           it couldn't be created.
   * @protected
   */
  async _onDropActiveEffect(event, data) {
    const aeCls = getDocumentClass('ActiveEffect');
    const effect = await aeCls.fromDropData(data);
    if (!this.actor.isOwner || !effect) return false;
    if (effect.target === this.actor) return this._onSortActiveEffect(event, effect);
    return aeCls.create(effect, { parent: this.actor });
  }

  /**
   * Handle a drop event for an existing embedded Active Effect to sort that Active Effect
   * relative to its siblings
   *
   * @param {DragEvent} event
   * @param {ActiveEffect} effect
   */
  async _onSortActiveEffect(event, effect) {
    /** @type {HTMLElement} */
    const dropTarget = event.target.closest('[data-effect-id]');
    if (!dropTarget) return;
    const target = this._getEmbeddedDocument(dropTarget);

    // Don't sort on yourself
    if (effect.uuid === target.uuid) return;

    // Identify sibling items based on adjacent HTML elements
    const siblings = [];
    for (const el of dropTarget.parentElement.children) {
      const siblingId = el.dataset.effectId;
      const parentId = el.dataset.parentId;
      if (siblingId && parentId && (siblingId !== effect.id || parentId !== effect.parent.id))
        siblings.push(this._getEmbeddedDocument(el));
    }

    // Perform the sort
    const sortUpdates = performIntegerSort(effect, {
      target,
      siblings
    });

    // Split the updates up by parent document
    const directUpdates = [];

    const grandchildUpdateData = sortUpdates.reduce((items, u) => {
      const parentId = u.target.parent.id;
      const update = { _id: u.target.id, ...u.update };
      if (parentId === this.actor.id) {
        directUpdates.push(update);
        return items;
      }
      if (items[parentId]) items[parentId].push(update);
      else items[parentId] = [update];
      return items;
    }, {});

    // Effects-on-items updates
    for (const [itemId, updates] of Object.entries(grandchildUpdateData)) {
      await this.actor.items.get(itemId).updateEmbeddedDocuments('ActiveEffect', updates);
    }

    // Update on the main actor
    return this.actor.updateEmbeddedDocuments('ActiveEffect', directUpdates);
  }

  /**
   * Handle dropping of an Actor data onto another Actor sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<object|boolean>}  A data object which describes the result of the drop,
   *                                     or false if the drop was not permitted.
   * @protected
   */
  async _onDropActor(event, data) {
    if (!this.actor.isOwner) return false;
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping of an item reference or item data onto an Actor Sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<Item[]|boolean>}  The created or updated Item instances,
   *                                     or false if the drop was not permitted.
   * @protected
   */
  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false;

    const item = await Item.implementation.fromDropData(data);
    const isCharacterOrNPC = [ActorType.CHARACTER, ActorType.NPC].includes(this.actor.type);
    const isCaravan = this.actor.type === ActorType.CARAVAN;

    if (isCharacterOrNPC && ITEMS_NOT_ALLOWED_IN_CHARACTERS.includes(item.type)) {
      return false;
    }

    if (isCaravan && ITEMS_NOT_ALLOWED_IN_CARAVANS.includes(item.type)) {
      return false;
    }

    // Handle item sorting within the same Actor
    if (this.actor.uuid === item.parent?.uuid) return this._onSortItem(event, item);

    if (item.system?.type === GearType.POWER) {
      const itemPower = await DialogV2.confirm({
        window: { title: $l10n('SDM.CreatePowerItem') },
        content: `<h3>${$l10n('SDM.CreatePowerItem')}</h3>`,
        modal: true,
        rejectClose: false,
        yes: { label: $l10n('TYPE.Item'), icon: 'fa fa-book' },
        no: { label: $l10n('TYPE.Trait'), icon: 'fa fa-brain' }
      });

      if (itemPower === null) return;

      let clonedItem = foundry.utils.duplicate(item);

      if (!itemPower) {
        clonedItem.type = ItemType.TRAIT;
        return this._onDropItemCreate(clonedItem, event);
      }

      clonedItem.type = ItemType.GEAR;
      return this._onDropItemCreate(clonedItem, event);
    }


    // Create the owned item
    return this._onDropItemCreate(item, event);
  }

  /**
   * Handle dropping of a Folder on an Actor Sheet.
   * The core sheet currently supports dropping a Folder of Items to create all items as owned items.
   * @param {DragEvent} event     The concluding DragEvent which contains drop data
   * @param {object} data         The data transfer extracted from the event
   * @returns {Promise<Item[]>}
   * @protected
   */
  async _onDropFolder(event, data) {
    if (!this.actor.isOwner) return [];
    const folder = await Folder.implementation.fromDropData(data);
    if (folder.type !== 'Item') return [];
    const droppedItemData = await Promise.all(
      folder.contents.map(async item => {
        if (!(document instanceof Item)) item = await fromUuid(item.uuid);
        return item;
      })
    );
    return this._onDropItemCreate(droppedItemData, event);
  }

  /**
   * Handle the final creation of dropped Item data on the Actor.
   * This method is factored out to allow downstream classes the opportunity to override
   * item creation behavior.
   * @param {object[]|object} itemData      The item data requested for creation
   * @param {DragEvent} event               The concluding DragEvent which provided the drop data
   * @returns {Promise<Item[]>}
   * @privateW
   */
  async _onDropItemCreate(itemData, event) {
    itemData = itemData instanceof Array ? itemData : [itemData];

    // Calculate total weight of new items using data model defaults
    let totalSlots = itemData.reduce((sum, item) => {
      const system = item.system || {};
      const slots = getSlotsTaken(system);
      return sum + slots;
    }, 0);
    const itemType = itemData[0].type;

    if (itemData[0].system.is_hallmark && !this.actor.canAddHallmarkItem()) {
      ui.notifications.error($fmt('SDM.ErrorHallmarkLimit', { target: this.actor.name }));
      return [];
    }

    const validWeight = this._checkActorWeightLimit(totalSlots, itemType);

    if (!validWeight) {
      ui.notifications.error($fmt('SDM.ErrorWeightLimit', { target: this.actor.name }));
      return [];
    }

    if (itemData[0].parent?.isOwner) {
      const item = fromUuidSync(itemData[0].uuid);
      await item.delete();
    }

    return this.actor.createEmbeddedDocuments('Item', itemData);
  }

  /**
   * Handle a drop event for an existing embedded Item to sort that Item relative to its siblings
   * @param {Event} event
   * @param {Item} item
   * @private
   */
  _onSortItem(event, item) {
    // Get the drag source and drop target
    const items = this.actor.items;
    const dropTarget = event.target.closest('[data-item-id]');
    if (!dropTarget) return;
    const target = items.get(dropTarget.dataset.itemId);

    // Don't sort on yourself
    if (item.id === target.id) return;

    // Identify sibling items based on adjacent HTML elements
    const siblings = [];
    for (let el of dropTarget.parentElement.children) {
      const siblingId = el.dataset.itemId;
      if (siblingId && siblingId !== item.id) siblings.push(items.get(el.dataset.itemId));
    }

    // Perform the sort
    const sortUpdates = performIntegerSort(item, {
      target,
      siblings
    });
    const updateData = sortUpdates.map(u => {
      const update = u.update;
      update._id = u.target._id;
      return update;
    });

    // Perform the update
    return this.actor.updateEmbeddedDocuments('Item', updateData);
  }

  /** The following pieces set up drag handling and are unlikely to need modification  */

  /**
   * Returns an array of DragDrop instances
   * @type {DragDrop[]}
   */
  get dragDrop() {
    return this.#dragDrop;
  }

  // This is marked as private because there's no real need
  // for subclasses or external hooks to mess with it directly
  #dragDrop;

  /**
   * Create drag-and-drop workflow handlers for this Application
   * @returns {DragDrop[]}     An array of DragDrop handlers
   * @private
   */
  #createDragDropHandlers() {
    return this.options.dragDrop.map(d => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this)
      };
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this)
      };
      return new DragDrop(d);
    });
  }

  /********************
   *
   * Actor Override Handling
   *
   ********************/

  /**
   * Submit a document update based on the processed form data.
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {object} submitData                   Processed and validated form data to be used
   *                                              for a document update
   * @returns {Promise<void>}
   * @protected
   * @override
   */
  async _processSubmitData(event, form, submitData) {
    const overrides = foundry.utils.flattenObject(this.actor.overrides);
    for (let k of Object.keys(overrides)) delete submitData[k];
    await this.document.update(submitData);
  }

  /**
   * Disables inputs subject to active effects
   */
  #disableOverrides() {
    const flatOverrides = foundry.utils.flattenObject(this.actor.overrides);
    for (const override of Object.keys(flatOverrides)) {
      const input = this.element.querySelector(`[name="${override}"]`);
      if (input) {
        input.disabled = true;
      }
    }
  }
}
