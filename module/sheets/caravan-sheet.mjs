import { UNENCUMBERED_THRESHOLD_CASH } from '../helpers/actorUtils.mjs';
import { ActorType, ItemType, SizeUnit } from '../helpers/constants.mjs';
import { prepareActiveEffectCategories } from '../helpers/effects.mjs';
import { $l10n, $fmt } from '../helpers/globalUtils.mjs';
import {
  convertToCash,
  ITEMS_NOT_ALLOWED_IN_CHARACTERS,
  onItemCreateActiveEffects,
  onItemUpdate
} from '../helpers/itemUtils.mjs';
import { templatePath } from '../helpers/templates.mjs';
import { openItemTransferDialog } from '../items/transfer.mjs';

const { api, sheets } = foundry.applications;
const { DialogV2 } = foundry.applications.api;
const DragDrop = foundry.applications.ux.DragDrop.implementation;
const FilePicker = foundry.applications.apps.FilePicker.implementation;
const TextEditor = foundry.applications.ux.TextEditor.implementation;

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheetV2}
 */
export class SdmCaravanSheet extends api.HandlebarsApplicationMixin(sheets.ActorSheetV2) {
  constructor(options = {}) {
    super(options);
    this.#dragDrop = this.#createDragDropHandlers();
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['sdm', 'actor', 'caravan'],
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
      onEditImage: this._onEditImage,
      roll: this._onRoll,
      toggleEffect: this._toggleEffect,
      transferItem: this._onTransferItem,
      viewDoc: this._viewDoc,
      sendToChat: { handler: this._sendToChat, buttons: [0, 2] },
      addTransport: this._addTransport,
      deleteTransport: this._deleteTransport,
      addRoute: this._addRoute,
      deleteRoute: this._deleteRoute
    },
    // Custom property that's merged into `this.options`
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: null }],
    form: {
      submitOnChange: true
    }
  };

  /** @override */
  static PARTS = {
    header: {
      template: templatePath('actor/caravan/header')
    },
    tabs: {
      // Foundry-provided generic template
      template: 'templates/generic/tab-navigation.hbs'
    },
    inventory: {
      template: templatePath('actor/caravan/inventory'),
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
    effects: {
      template: templatePath('actor/effects'),
      scrollable: ['']
    },
    transport: {
      template: templatePath('actor/caravan/transport'),
      scrollable: ['']
    },
    crew: {
      template: templatePath('actor/caravan/crew'),
      scrollable: ['']
    },
    routes: {
      template: templatePath('actor/caravan/routes'),
      scrollable: ['']
    }
  };

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    // Not all parts always render
    options.parts = ['header', 'tabs'];
    // Don't show the other tabs if only limited view
    if (!this.document.limited) {
      options.parts.push('inventory', 'transport', 'routes', 'notes', 'effects');
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

    // Offloading context prep to a helper function
    this._prepareItems(context);

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case 'inventory':
      case 'crew':
      case 'transport':
      case 'routes':
        context.tab = context.tabs[partId];
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
          tab.label += 'CaravanInventory';
          tab.icon = 'fa fa-toolbox';
          break;
        case 'crew':
          tab.id = 'crew';
          tab.label += 'Crew';
          tab.icon = 'fa fa-people-group';
          break;
        case 'transport':
          tab.id = 'transport';
          tab.label += 'Transport';
          tab.icon = 'fa fa-truck-monster';
          break;
        case 'routes':
          tab.id = 'routes';
          tab.label += 'Routes';
          tab.icon = 'fa fa-route';
          break;
        case 'effects':
          tab.id = 'effects';
          tab.label += 'Effects';
          tab.icon = 'fa fa-bolt';
          break;
        case 'notes':
          tab.id = 'notes';
          tab.label += 'CaravanNotes';
          tab.icon = 'fa fa-map-location';
          break;
        case 'biography':
          tab.id = 'biography';
          tab.label += 'Biography';
          tab.icon = 'fa fa-book';
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

    // we need to get the caravan capacity in sacks
    // for each sack create a inventory container
    const filteredItems = this.document.items.filter(
      item => !ITEMS_NOT_ALLOWED_IN_CHARACTERS.includes(item.type)
    );
    const transportItems = this.document.items.filter(item =>
      ITEMS_NOT_ALLOWED_IN_CHARACTERS.includes(item.type)
    );

    // Iterate through items, allocating to containers
    function chunkBySlots(items, maxSlots = 10) {
      // First sort the items (using your comparator)
      const sortedItems = [...items].sort((a, b) => (a.sort || 0) - (b.sort || 0));
      const chunks = [];
      let currentChunk = [];
      let currentSlots = 0;

      for (const item of sortedItems) {
        const slots = item.system.slots_taken || 1;
        if (currentSlots + slots > maxSlots) {
          chunks.push(currentChunk);
          currentChunk = [item];
          currentSlots = slots;
        } else {
          currentChunk.push(item);
          currentSlots += slots;
        }
      }

      // Push the final chunk (even if empty)
      chunks.push(currentChunk);
      if (!chunks[0].length) delete chunks[0];
      return chunks;
    }

    // Usage
    const chunkedLists = chunkBySlots(filteredItems);
    // Sort then assign
    context.cargo = chunkedLists;
    context.transport = transportItems;
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

  // Add this method to handle item updates
  _onItemUpdate(item, updateData) {
    // Calculate potential new weight
    const originalWeight = convertToCash(
      item.system.size.value * item.system.quantity,
      item.system.size.unit
    );

    let newSizeValue = item.system.size.value;
    let newSizeUnit = item.system.size.unit;
    let newQuantity = item.system.quantity;

    // Update values from pending changes
    if (updateData?.system?.size?.value !== undefined) {
      newSizeValue = updateData.system.size.value;
    }
    if (updateData?.system?.size?.unit !== undefined) {
      newSizeUnit = updateData.system.size.unit;
    }
    if (updateData?.system?.quantity !== undefined) {
      newQuantity = updateData.system.quantity;
    }

    const newWeight = convertToCash(newSizeValue * newQuantity, newSizeUnit);
    const currentCarriedWeight = this.actor.getCarriedGear() - originalWeight + newWeight;
    const totalCapacityInSacks = this.actor.system.capacity + this.actor.system.capacity_bonus;
    const maxCarryWeight = convertToCash(totalCapacityInSacks, SizeUnit.SACKS);

    // Only error if EXCEEDING max (not when equal)
    if (currentCarriedWeight > maxCarryWeight) {
      ui.notifications.error('Updating this item would exceed your carry weight limit.');
      return false;
    }
    return true;
  }

  _checkActorWeightLimit(additionalSlots = 0, itemType) {
    if (this.actor.type === ActorType.NPC) {
      return true;
    }

    if (this.actor.type === ActorType.CARAVAN) {
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

  _checkCarriedWeight(item, updateData) {
    if (this.actor.type === ActorType.NPC) {
      return true;
    }

    if (this.actor.type === ActorType.CARAVAN) {
      return true;
    }

    let itemSlots = getSlotsTaken(item?.system);

    if (updateData && !updateData.system) return true;

    let updateDataSlots = updateData ? getSlotsTaken(updateData?.system) : null;

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

    if (this.actor.type === ActorType.CARAVAN) {
      return true;
    }

    const itemSlots = item.system.slots_taken || 1;
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

  // _getCarriedGear() {
  //   const itemsArray = this.actor.items.contents;
  //   const carriedWeight = itemsArray.reduce(
  //     (sum, item) => {
  //       const { size, quantity = 1 } = item.system;
  //       const { value: sizeValue = 1, unit: sizeUnit = SizeUnit.CASH } = size;
  //       const weightInSacks = convertToCash(sizeValue * quantity, sizeUnit);
  //       return sum + weightInSacks;
  //     }, 0);

  //   return carriedWeight;
  // }

  async _checkEncumbrance() {
    const actor = this.actor;

    // Calculate current encumbrance (SDM-specific calculation)

    const carriedWeight = this.actor.getCarriedGear();
    const encumbranceThreshold =
      this.actor.system.carry_weight.unencumbered ?? UNENCUMBERED_THRESHOLD_CASH;
    const encumberedEffect = actor.effects.getName('encumbered');
    const encumberedSlow = actor.effects.getName('slow (encumbered)');

    // Update encumbrance effect
    if (carriedWeight > encumbranceThreshold && !encumberedEffect) {
      await actor.addEncumberedEffect();
      await actor.addEncumberedSlow();
    } else if (carriedWeight <= encumbranceThreshold && encumberedEffect) {
      await encumberedEffect.delete();
      await encumberedSlow.delete();
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
   * @this SdmCaravanSheet
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
   * @this SdmCaravanSheet
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
   * @this SdmCaravanSheet
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
   * Handle creating a new Owned Item or ActiveEffect for the actor using initial data defined in the HTML dataset
   *
   * @this SdmCaravanSheet
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
   * Handles creating a new Owned Item and already open it for Editing
   *
   * @this SdmCaravanSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _createAndViewDoc(event, target) {
    const newDoc = await SdmCaravanSheet._createDoc.call(this, event, target);
    newDoc.sheet.render(true);
  }

  /**
   * Determines effect parent to pass to helper
   *
   * @this SdmCaravanSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _toggleEffect(event, target) {
    const effect = this._getEmbeddedDocument(target);
    await effect.update({ disabled: !effect.disabled });
  }

  /**
   * Handle clickable rolls.
   *
   * @this SdmCaravanSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onRoll(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if (event.detail > 1) return; // Ignore repeated clicks

    // Get common data attributes
    const dataset = target.dataset;
    const key = dataset.key;
    const label = dataset.label || key;
    const skill = dataset.skill;
    const versatile = !!dataset.versatile;
    const rollType = dataset.rollType;
    const clickedButton = event.button;

    if (clickedButton === 2) {
      if (rollType !== 'item') return;
      const item = this._getEmbeddedDocument(target);
      return openItemTransferDialog(item, this.actor);
    }

    // Handle item rolls.
    switch (dataset.rollType) {
      case 'item':
        const item = this._getEmbeddedDocument(target);
        if (!item || item?.type !== ItemType.WEAPON) return;
        const weaponLabel = $l10n(`TYPES.Item.${item.type}`);
        return this._openCustomRollModal(key, label, skill, weaponLabel, item, versatile);
      //if (item) return item.roll(event, versatile);
    }

    const abilitiesLabel = $l10n(CONFIG.SDM.abilitiesLabel);

    const ChatLabel = dataset.label ? `[${abilitiesLabel}] ${dataset.label}` : '';

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      // return RollHandler.performRoll(this.actor, null, ChatLabel, {
      //   roll: dataset.roll
      // });
    }

    const rolledFrom = dataset.rollType ?? 'ability';
    const rolledFromlabel = $l10n(CONFIG.SDM.rollSource[rolledFrom]);

    this._openCustomRollModal(key, label, skill, rolledFromlabel);
  }

  static async _onTransferItem(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if (event.detail > 1) return; // Ignore repeated clicks
    const item = this._getEmbeddedDocument(target);
    return openItemTransferDialog(item, this.actor);
  }

  static async _sendToChat(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    const { detail, button } = event;

    if (button === 0) {
      if (detail <= 1 || detail > 2) return;
      return SdmCaravanSheet._viewDoc.call(this, event, target);
    }

    if (detail > 1) return;

    const item = this._getEmbeddedDocument(target);
    return await item.sendToChat({ actor: this.actor, collapsed: false });
  }

  static async _addTransport(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const newKey = foundry.utils.randomID();
    const transportLength = Object.keys(this.actor.system.transport).length;

    await this.actor.update({
      'system.transport': {
        [`${newKey}`]: {
          name: `New transport (${transportLength})`,
          level: 0,
          capacity: 1,
          cargo: '',
          speed: 0,
          cost: '',
          supply: ''
        }
      }
    });
  }

  static async _deleteTransport(event, target) {
    const dataset = target.dataset;
    const key = dataset.key;

    const transport = this.actor.system.transport[key];

    const proceed = await DialogV2.confirm({
      content: `<b>${$fmt('SDM.DeleteDocConfirmation', { doc: transport.name })}</b>`,
      modal: true,
      rejectClose: false,
      yes: { label: $l10n('SDM.ButtonYes') },
      no: { label: $l10n('SDM.ButtonNo') }
    });
    if (!proceed) return;

    await this.actor.update({
      [`system.transport.-=${key}`]: null
    });
  }

  static async _addRoute(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const newKey = foundry.utils.randomID();
    const routesLength = Object.keys(this.actor.system.routes).length;

    await this.actor.update({
      'system.routes': {
        [`${newKey}`]: {
          name: `New route (${routesLength})`,
          agent: '',
          quirk: '',
          locationA: '',
          eta: '',
          locationB: '',
          investment: '',
          risk: ''
        }
      }
    });
  }

  static async _deleteRoute(event, target) {
    const dataset = target.dataset;
    const key = dataset.key;

    const route = this.actor.system.routes[key];

    const proceed = await DialogV2.confirm({
      content: `<b>${$fmt('SDM.DeleteDocConfirmation', { doc: route.name })}</b>`,
      modal: true,
      rejectClose: false,
      yes: { label: $l10n('SDM.ButtonYes') },
      no: { label: $l10n('SDM.ButtonNo') }
    });
    if (!proceed) return;

    await this.actor.update({
      [`system.routes.-=${key}`]: null
    });
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
   * @returns {Promise<ActiveEffect|boolean>}  The created ActiveEffect object or false if it couldn't be created.
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
   * Handle a drop event for an existing embedded Active Effect to sort that Active Effect relative to its siblings
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
    const sortUpdates = SortingHelpers.performIntegerSort(effect, {
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
   * @returns {Promise<object|boolean>}  A data object which describes the result of the drop, or false if the drop was
   *                                     not permitted.
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
   * @returns {Promise<Item[]|boolean>}  The created or updated Item instances, or false if the drop was not permitted.
   * @protected
   */
  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false;
    const item = await Item.implementation.fromDropData(data);

    if ([ItemType.BURDEN, ItemType.TRAIT].includes(item.type)) {
      alert('burden or trait dropped');
      return false;
    }

    // Handle item sorting within the same Actor
    if (this.actor.uuid === item.parent?.uuid) return this._onSortItem(event, item);

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
   * This method is factored out to allow downstream classes the opportunity to override item creation behavior.
   * @param {object[]|object} itemData      The item data requested for creation
   * @param {DragEvent} event               The concluding DragEvent which provided the drop data
   * @returns {Promise<Item[]>}
   * @private
   */
  async _onDropItemCreate(itemData, event) {
    itemData = itemData instanceof Array ? itemData : [itemData];

    itemData = itemData.map(item => {
      item.system.readied = false;
      return item;
    });

    // Calculate total weight of new items using data model defaults
    let totalNewWeight = itemData.reduce((sum, item) => {
      const system = item.system || {};
      const size = system.size || {};
      const sizeValue = size.value !== undefined ? size.value : 1;
      const sizeUnit = size.unit || SizeUnit.STONES; // Default to STONES
      const quantity = system.quantity !== undefined ? system.quantity : 1;
      return sum + convertToCash(sizeValue * quantity, sizeUnit);
    }, 0);

    const currentCarriedWeight = this.actor.getCarriedGear();
    const totalCapacityInSacks = this.actor.system.capacity + this.actor.system.capacity_bonus;
    const maxCarryWeight = convertToCash(totalCapacityInSacks, SizeUnit.SACKS);

    if (currentCarriedWeight + totalNewWeight > maxCarryWeight) {
      ui.notifications.error('Adding this item would exceed your carry weight limit.');
      return [];
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
    const sortUpdates = SortingHelpers.performIntegerSort(item, {
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
   * @param {object} submitData                   Processed and validated form data to be used for a document update
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
