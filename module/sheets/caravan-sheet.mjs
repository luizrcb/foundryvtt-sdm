import { ActorType, GearType, ItemType, SizeUnit } from '../helpers/constants.mjs';
import { prepareActiveEffectCategories } from '../helpers/effects.mjs';
import {
  $fmt,
  $l10n,
  constructHTMLButton,
  foundryVersionIsAtLeast,
  getSeasonAndWeek
} from '../helpers/globalUtils.mjs';
import TokenPlacement from '../canvas/token-placement.mjs';
import {
  convertToCash,
  getSlotsTaken,
  ITEMS_ALLOWED_IN_CONTAINERS,
  ITEMS_NOT_ALLOWED_IN_CARAVANS,
  SUBTYPES_NOT_ALLOWED_IN_CARAVANS
} from '../helpers/itemUtils.mjs';
import { templatePath } from '../helpers/templates.mjs';
import { openItemTransferDialog } from '../items/transfer.mjs';

const { api, sheets } = foundry.applications;
const { DialogV2 } = foundry.applications.api;
const DragDrop = foundry.applications.ux.DragDrop.implementation;
const FilePicker = foundry.applications.apps.FilePicker.implementation;
const TextEditor = foundry.applications.ux.TextEditor.implementation;
const { performIntegerSort } = foundry.utils;

const FLAG_SCOPE = 'sdm';
const FLAG_SACK = 'sackIndex';
const SLOTS_PER_SACK = 10;

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
      openDoc: { handler: this._openDoc, buttons: [0] },
      addTransport: this._addTransport,
      deleteTransport: this._deleteTransport,
      deleteCrew: this._deleteCrew,
      addRoute: this._addRoute,
      deleteRoute: this._deleteRoute,
      consumeSupplies: this._consumeSupplies,
      radioToggle: this._radioToggle,
      viewCrewMember: this._viewCrewMember,
      openPetSheet: this._onOpenPetSheet,
      toggleCompact: this._onToggleCompact,
      placeCrewMembers: this._onPlaceCrewMembers,
    },
    // Custom property that's merged into `this.options`
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: '[data-drop], [data-item-id]' }],
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
      options.parts.push('inventory', 'crew', 'transport', 'routes', 'notes', 'effects');
    }
    options.parts.push('biography');
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);

    const buttons = [
      constructHTMLButton({
        label: '',
        classes: ['header-control', 'icon', 'fa-solid', 'fa-location-pin'],
        dataset: { action: 'placeCrewMembers', tooltip: 'SDM.PlaceCrewMembers' }
      }),
      constructHTMLButton({
        label: '',
        classes: ['header-control', 'icon', 'fa-solid', 'fa-compress'],
        dataset: { action: 'toggleCompact', tooltip: 'SDM.CompactMode' }
      })
    ];

    this.window.controls.after(...buttons);

    return frame;
  }

  /** @override */
  async _prepareContext(options) {
    let caravanWeek;
    let caravanMonth;
    let caravanDate;
    let caravanDateShort;
    let seasonsStarsIntegration = false;

    if (game.seasonsStars) {
      const currentDate = game.seasonsStars.api.getCurrentDate();
      const { day, month, year, weekday } = currentDate;
      const { week, season } = getSeasonAndWeek(day, month);
      caravanWeek = week;
      caravanMonth = month;

      caravanDateShort = $fmt('SDM.FormattedDate', {
        weekday: $l10n(`SDM.WeekDayShort.${weekday}`),
        month: $l10n(`SDM.MonthShort.${month}`),
        day,
        year,
        season: $l10n(`SDM.Season.${season}`)
      });

      caravanDate = $fmt('SDM.FormattedDate', {
        weekday: $l10n(`SDM.WeekDay.${weekday}`),
        month: $l10n(`SDM.Month.${month}`),
        day,
        year,
        season: $l10n(`SDM.Season.${season}`)
      });

      const calendar = game.seasonsStars.api.getActiveCalendar();

      seasonsStarsIntegration =
        game.settings.get('sdm', 'seasonsStarsIntegration') && calendar.id.includes('rainbowlands');
    }

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
      isGM: game.user.isGM,
      seasonsStarsIntegration,
      caravanWeek,
      caravanMonth,
      caravanDate,
      caravanDateShort
    };

    const crew = context.system?.crew;
    const players = [];
    const npcs = [];
    if (crew) {
      for (const [key, member] of Object.entries(crew)) {
        const memberId = member.id;
        const crewMember = await fromUuid(memberId);
        member.name = crewMember.name;
        member.img = crewMember.img;
        member.system = crewMember.system;
        member.key = key;
        member.totalCash = crewMember.getTotalCash();

        if (crewMember.type === ActorType.CHARACTER) {
          players.push(member);
        } else {
          npcs.push(member);
        }
      }
    }
    context.crew_players = players;
    context.crew_npcs = npcs;
    context.isCompactMode = this.actor.getFlag('sdm', 'compactMode') ?? false;

    // Offloading context prep to a helper function
    await this._prepareItems(context);

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
          tab.icon = 'fa fa-screwdriver-wrench';
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

      if (this.actor.getFlag('sdm', 'compactMode')) {
        tab.tooltip = tab.label;
        tab.label = '';
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
  async _prepareItems(context) {
    // Initialize containers.
    // You can just use `this.document.itemTypes` instead
    // if you don't need to subdivide a given type like
    // this sheet does with spells

    const capacity = Number(this.actor.system.capacity ?? 0);
    const inventory = this.actor.system.inventory ?? {};

    const updates = {};
    for (let i = 0; i < capacity; i += 1) {
      const key = String(i);
      if (!(key in inventory)) {
        updates[`system.inventory.${key}`] = { name: '' };
      }
    }

    if (Object.keys(updates).length) {
      await this.actor.update(updates);
    }

    const inventoryNames = this.actor.system.inventory || {};

    const sacks = Array.from({ length: capacity }, (_, i) => ({
      index: i,
      name: inventoryNames[i].name || `${game.i18n.localize('SDM.UnitSack')} ${i + 1}`,
      items: [],
      usedSlots: 0,
      maxSlots: SLOTS_PER_SACK
    }));

    const overflow = {
      index: capacity,
      name: `${game.i18n.localize('SDM.UnitSack')} ${capacity + 1}`,
      items: [],
      usedSlots: 0,
      maxSlots: Infinity
    };

    const items = [...this.document.items]
      .filter(it => !ITEMS_NOT_ALLOWED_IN_CARAVANS.includes(it.type))
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

    const firstFitIndex = need => sacks.findIndex(s => s.usedSlots + need <= s.maxSlots);

    for (const item of items) {
      let need = Number(item.system?.slots_taken ?? 1) || 1;

      if (item.system?.size?.unit === SizeUnit.CASH) {
        if (item.system.quantity === 0) need = 0;
        const weightRules = game.settings.get('sdm', 'currencyWeight');
        if (weightRules === 'weightless') need = 0;
        if (weightRules === 'single_stone') need = 1;
      }

      if (item.system?.container) {
        need = 0;
      }

      const flaggedIdx = Number(item.getFlag(FLAG_SCOPE, FLAG_SACK));
      const hasValidFlag = Number.isFinite(flaggedIdx) && flaggedIdx >= 0 && flaggedIdx < capacity;

      if (hasValidFlag && sacks[flaggedIdx].usedSlots + need <= sacks[flaggedIdx].maxSlots) {
        sacks[flaggedIdx].items.push(item);
        sacks[flaggedIdx].usedSlots += need;
        continue;
      }

      const fit = firstFitIndex(need);
      if (fit !== -1) {
        sacks[fit].items.push(item);
        sacks[fit].usedSlots += need;
      } else {
        overflow.items.push(item);
        overflow.usedSlots += need;
      }
    }

    sacks.forEach(s => s.items.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)));

    context.cargo = sacks;
    if (overflow.items.length) context.overflow = overflow;
    context.canRenameSacks = this.actor.isOwner;

    context.totalUsedSlots = sacks.reduce((a, s) => a + s.usedSlots, 0) + overflow.usedSlots;
    context.totalMaxSlots = sacks.reduce((a, s) => a + s.maxSlots, 0);
  }

  _getDropSackIndex(event) {
    const el = event.target?.closest?.('.sack-drop');
    if (!el) return null;
    const idx = Number(el.dataset.sackIndex);
    return Number.isFinite(idx) ? idx : null;
  }

  _reapplyStripes() {
    const root = this.element.querySelector('.items-list.collapsible-items.list-border');
    if (!root) return;

    const items = Array.from(root.querySelectorAll('li.item'));
    let visibleIndex = 0;

    items.forEach(li => {
      li.classList.remove('stripe-even', 'stripe-odd');
      if (li.offsetParent !== null) {
        li.classList.add(visibleIndex % 2 === 0 ? 'stripe-odd' : 'stripe-even');
        visibleIndex++;
      }
    });
  }

  _handleContainers() {
    const actor = this.actor;
    const root = this.element;

    const rows = Array.from(root.querySelectorAll('li.item'));

    for (const li of rows) {
      const item = actor.items.get(li.dataset.itemId);
      if (!item) continue;

      const parentId = item.system.container?.trim();
      if (!parentId) continue;

      const parentRow = root.querySelector(`li.item[data-item-id="${parentId}"]`);
      if (!parentRow) continue;

      parentRow.insertAdjacentElement('afterend', li);
      li.classList.add('item-child');
    }

    for (const li of rows) {
      const item = actor.items.get(li.dataset.itemId);
      if (!item) continue;

      const parentId = item.system.container?.trim();
      if (!parentId) continue;

      const parent = fromUuidSync(parentId);
      const collapsed = parent?.getFlag('sdm', 'isCollapsed');

      li.style.display = collapsed ? 'none' : '';
    }

    for (const li of rows) {
      const item = actor.items.get(li.dataset.itemId);
      if (!item || item.system.type !== 'container') continue;

      const collapsed = item.getFlag('sdm', 'isCollapsed');
      const nameDiv = li.querySelector('.item-name');

      if (!nameDiv.querySelector('.container-indicator')) {
        const icon = document.createElement('i');
        icon.classList.add(
          'fas',
          collapsed ? 'fa-angle-right' : 'fa-angle-down',
          'container-indicator'
        );
        icon.style.marginLeft = '5px;';
        icon.style.padding = '8px';

        li.addEventListener('click', async ev => {
          ev.preventDefault();
          if (ev.detail > 1) return;

          await item.setFlag('sdm', 'isCollapsed', !collapsed);
          this.render();
        });

        const nameRow = nameDiv.querySelector('.flexrow');
        nameRow.append(icon);
      }
    }

    this._reapplyStripes();
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
    // Listen for date changes during advancement

    this.#dragDrop.forEach(d => d.bind(this.element));
    this.#disableOverrides();
    // You may want to add other special handling here
    // Foundry comes with a large number of utility classes, e.g. SearchFilter
    // That you may want to implement yourself.

    const isCompact = this.actor.getFlag('sdm', 'compactMode');
    if (isCompact !== undefined) {
      this.element.classList.toggle('compact', isCompact);
    }

    // Add item change listeners
    this._handleContainers();
  }

  /**
   * Actions performed after a first render of the Application.
   * @param {ApplicationRenderContext} context      Prepared context data.
   * @param {RenderOptions} options                 Provided render options.
   * @protected
   */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    this._setupCalendarChangeListener();

    this._createContextMenu(
      this._getItemListContextOptions,
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
  // _setupItemListeners() {
  //   const actorId = this.actor.id;

  //   this._teardownItemListeners();

  //   this._itemListeners = {
  //     preCreate: Hooks.on('preCreateItem', (item, options, userId) => {
  //       if (item.parent?.id === actorId && !this._validateItemWeight(item)) return false;
  //     }),
  //     create: Hooks.on('createItem', async (item, options, userId) => {
  //       if (item.parent?.id === actorId) {
  //         const shouldAllow = this._checkCarriedWeight(item);
  //         if (!shouldAllow) return false;

  //         // Run your existing effects hook
  //         await onItemCreateActiveEffects(item);
  //       }
  //     }),
  //     preUpdate: Hooks.on('preUpdateItem', (item, changedData) => {
  //       if (item.parent?.id === actorId) {
  //         const shouldAllow = this._checkCarriedWeight(item, changedData);
  //         if (!shouldAllow) return false;
  //       }
  //     }),
  //     update: Hooks.on('updateItem', (item, changes, options, userId) => {
  //       if (item.parent?.id === actorId) {
  //         return onItemUpdate(item, changes);
  //       }
  //     }),
  //     delete: Hooks.on('deleteItem', (item, options, userId) => {
  //       if (item.parent?.id === actorId) return;
  //     })
  //   };
  // }

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

    if (currentCarriedWeight > maxCarryWeight) {
      ui.notifications.warning('Updating this item would exceed your carry weight limit.');
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

    if (updateData && !updateData?.system) return true;

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
  // _teardownItemListeners() {
  //   if (!this._itemListeners) return;
  //   Hooks.off('preCreateItem', this._itemListeners.preCreate);
  //   Hooks.off('preUpdateItem', this._itemListeners.preUpdate);
  //   Hooks.off('createItem', this._itemListeners.create);
  //   Hooks.off('updateItem', this._itemListeners.update);
  //   Hooks.off('deleteItem', this._itemListeners.delete);
  //   this._itemListeners = null;
  // }

  _setupCalendarChangeListener() {
    this._calendarListener = {
      onDateChange: Hooks.on('seasons-stars:dateChanged', data => {
        this.document.sheet.render(true);
      })
    };
  }

  _teardownCalendarListener() {
    if (!this._calendarListener) return;
    Hooks.off('seasons-stars:dateChanged', this._calendarListener.onDateChange);
    this._calendarListener = null;
  }

  /** @override */
  async close(options) {
    //this._teardownItemListeners();
    this._teardownCalendarListener();
    return super.close(options);
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

  static _radioToggle(event) {
    let target = event.target;
    if (!(target instanceof Element)) return;

    // If click landed on/inside a <label>, resolve the control
    if (target.tagName === 'LABEL' || target.closest('label')) {
      const label = target.tagName === 'LABEL' ? target : target.closest('label');
      const forId = label.getAttribute('for');
      const control =
        label.control ||
        (forId ? document.getElementById(forId) : null) ||
        label.querySelector('input,select,textarea,button,[tabindex]');
      if (control) target = control;
    }

    const isInput = target instanceof HTMLInputElement;
    const isChecked = isInput ? target.checked : false;

    // Use the element you attached the listener to as the search root
    const root = event.currentTarget instanceof HTMLElement ? event.currentTarget : document;

    if (isChecked || event.type === 'contextmenu') {
      // find the next lowest-value radio with the same name and click it
      if (!isInput) return;
      const name = target.name;
      const cur = parseInt(target.value, 10);
      if (!name || Number.isNaN(cur)) {
        target.click();
        return;
      }

      const prevVal = String(cur - 1);
      const selector = `input[type="radio"][name="${name}"][value="${prevVal}"]`;
      const next = root.querySelector(selector) || document.querySelector(selector); // fallback

      if (next instanceof HTMLInputElement) next.click();
    } else {
      if (target instanceof HTMLElement) target.click();
    }
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

    // Determine sort to place at bottom
    const collection = docCls.documentName === 'Item' ? this.actor.items : this.actor.effects;
    const maxSort = collection.reduce((max, doc) => Math.max(max, doc.sort || 0), 0);
    docData.sort = maxSort + 100; // or any increment

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

    //const abilitiesLabel = $l10n(CONFIG.SDM.abilitiesLabel);

    // const ChatLabel = dataset.label ? `[${abilitiesLabel}] ${dataset.label}` : '';

    // // Handle rolls that supply the formula directly.
    // if (dataset.roll) {
    //   // return RollHandler.performRoll(this.actor, null, ChatLabel, {
    //   //   roll: dataset.roll
    //   // });
    // }

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

  static async _openDoc(event, target) {
    const { detail, button } = event;

    if (button === 0) {
      if (detail <= 1 || detail > 2) return;
      return SdmCaravanSheet._viewDoc.call(this, event, target);
    }
  }

  static async _addTransport(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const newKey = foundry.utils.randomID();
    const transportLength = Object.keys(this.actor.system.transport).length;

    await this.actor.update({
      'system.transport': {
        [`${newKey}`]: {
          name: `${$fmt('SDM.DOCUMENT.New', { type: $l10n('SDM.Transport') })} (${transportLength})`,
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

    let deleteOperation;

    if (foundryVersionIsAtLeast('14')) {
      deleteOperation = {
        [`system.transport.${key}`]: _del
      };
    } else {
      deleteOperation = {
        [`system.transport.-=${key}`]: null
      };
    }

    await this.actor.update(deleteOperation);
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

    let deleteOperation;

    if (foundryVersionIsAtLeast('14')) {
      deleteOperation = {
        [`system.routes.${key}`]: _del
      };
    } else {
      deleteOperation = {
        [`system.routes.-=${key}`]: null
      };
    }

    await this.actor.update(deleteOperation);
  }

  static async _deleteCrew(event, target) {
    const dataset = target.dataset;
    const key = dataset.key;
    const forceProceed = !!dataset?.proceed;

    const crew = this.actor.system.crew[key];
    if (!forceProceed) {
      const proceed = await DialogV2.confirm({
        content: `<b>${$fmt('SDM.DeleteDocConfirmation', { doc: crew.name })}</b>`,
        modal: true,
        rejectClose: false,
        yes: { label: $l10n('SDM.ButtonYes') },
        no: { label: $l10n('SDM.ButtonNo') }
      });
      if (!proceed) return;
    }

    let deleteOperation;

    if (foundryVersionIsAtLeast('14')) {
      deleteOperation = {
        [`system.crew.${key}`]: _del
      };
    } else {
      deleteOperation = {
        [`system.crew.-=${key}`]: null
      };
    }

    await this.actor.update(deleteOperation);
  }

  static async _viewCrewMember(event, target) {
    const dataset = target.dataset;
    const key = dataset.key;

    const { detail } = event;
    if (detail <= 1 || detail > 2) return;

    const crewId = this.actor.system.crew[key].id;

    const crewMember = await fromUuid(crewId);
    if (!crewMember) {
      target.dataset.proceed = true;
      return SdmCaravanSheet._deleteCrew.call(this, event, target);
    }
    await crewMember.sheet.render(true);
  }

  static async _onOpenPetSheet(event, target) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events

    if (event.detail > 1) return;

    const item = this._getEmbeddedDocument(target);

    if (item.system.type !== GearType.PET) return;

    if (!item.system.pet) return;

    const petDocument = await fromUuid(item.system.pet);
    if (!petDocument) return;

    petDocument.sheet.render(true);
  }

  static async _onToggleCompact(event, target) {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return; // Ignore repeated clicks

    if (!this.actor.isOwner) return;

    const currentMode = this.actor.getFlag('sdm', 'compactMode') ?? false;
    const newMode = !currentMode;

    await this.actor.setFlag('sdm', 'compactMode', newMode);
    this.element.classList.toggle('compact', newMode);
    return this.render();
  }

  static async _consumeSupplies() {
    return this.actor.consumeSupplies();
  }

  static async _onPlaceCrewMembers() {
    if ( !game.user.isGM || !canvas.scene ) return;
    const crew = this.actor.system.crew;
    const members = [];

     if (crew) {
      for (const [key, member] of Object.entries(crew)) {
        const memberId = member.id;
        const crewMember = await fromUuid(memberId);
        members.push(crewMember);
      }
    }

    if ( !members.length ) return;
    const minimized = !this.minimized;
    await this.minimize();
    const tokensData = [];

    try {
      const placements = await TokenPlacement.place({
        tokens: members.map(actor => actor.prototypeToken)
      });
      for ( const placement of placements ) {
        const actor = placement.prototypeToken.actor;
        const appendNumber = !placement.prototypeToken.actorLink && placement.prototypeToken.appendNumber;
        delete placement.prototypeToken;
        const tokenDocument = await actor.getTokenDocument(placement);
        if ( appendNumber ) TokenPlacement.adjustAppendedNumber(tokenDocument, placement);
        tokensData.push(tokenDocument.toObject());
      }
    } catch(err) {
      console.log(err)
    } finally {
      if ( minimized ) this.maximize();
    }

    await canvas.scene.createEmbeddedDocuments("Token", tokensData);
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
    const section = event.target.closest('.tab.inventory.scrollable.active');
    if (!section) return;

    const sacks = Array.from(section.querySelectorAll('.sack-drop'));
    sacks.forEach(s => s.classList.add('drop-area'));

    const docRow = event.currentTarget.closest('li');
    if ('link' in event.target.dataset) return;

    // Chained operation
    let dragData = this._getEmbeddedDocument(docRow)?.toDragData();

    if (!dragData) return;

    // Set data transfer
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  _onDragEnd(event) {
    const section = event.target.closest('.tab.inventory.scrollable.active');
    if (!section) return;

    const sacks = Array.from(section.querySelectorAll('.sack-drop'));
    sacks.forEach(s => s.classList.remove('drop-area'));
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
   * @returns {Promise<object|boolean>}  A data object which describes the result of the drop, or false if the drop was
   *                                     not permitted.
   * @protected
   */
  async _onDropActor(event, data) {
    if (!this.actor.isOwner) return false;
    if (event.currentTarget.id !== 'crew-tab') return false;

    const droppedActor = await fromUuid(data.uuid);
    if (droppedActor.type == ActorType.CARAVAN) return false;

    // Get current crew data
    const currentCrew = this.actor.system.crew || {};

    // Find all keys with the same actor ID
    const duplicateKeys = [];
    for (const [key, crewMember] of Object.entries(currentCrew)) {
      if (crewMember.id === droppedActor.uuid) {
        duplicateKeys.push(key);
      }
    }

    // Prepare update object
    const updateData = {};

    if (duplicateKeys.length > 0) {
      // UPDATE EXISTING ENTRY - use the first duplicate found
      const existingKey = duplicateKeys[0];
      const existingCrew = currentCrew[existingKey];

      // Update the existing entry
      updateData[`system.crew.${existingKey}`] = {
        ...existingCrew, // Keep existing data
        id: droppedActor.uuid
      };
    } else {
      // CREATE NEW ENTRY (same as before, but refined)
      const newKey = foundry.utils.randomID();

      // Create the new crew member entry
      updateData[`system.crew.${newKey}`] = {
        id: droppedActor.uuid
      };
    }

    // Apply all changes in a single update
    await this.actor.update(updateData);
  }

  /* -------------------------------------------- */

  _getDropSackIndexFromEvent(event) {
    const el = event?.target?.closest?.('.sack-drop');
    if (!el) return null;
    const idx = Number(el.dataset.sackIndex);
    return Number.isFinite(idx) ? idx : null;
  }

  _buildUsageMap(actor, capacity, excludeIds = []) {
    const usage = new Map();

    for (let i = 0; i < Math.max(capacity, 1); i++) {
      usage.set(i, { used: 0, max: SLOTS_PER_SACK });
    }

    let maxIdx = capacity - 1;
    for (const it of actor.items) {
      const idx = Number(it.getFlag(FLAG_SCOPE, FLAG_SACK));
      if (Number.isFinite(idx)) maxIdx = Math.max(maxIdx, idx);
    }
    for (let i = capacity; i <= maxIdx; i++) {
      if (!usage.has(i)) usage.set(i, { used: 0, max: SLOTS_PER_SACK });
    }

    for (const it of actor.items) {
      if (ITEMS_NOT_ALLOWED_IN_CARAVANS.includes(it.type)) continue;
      if (excludeIds.includes(it.id)) continue; // ← changed

      let s = Number(it.system?.slots_taken ?? 1) || 1;
      if (it.system?.container) {
        s = 0;
      }
      const idx = Number(it.getFlag(FLAG_SCOPE, FLAG_SACK));
      if (Number.isFinite(idx)) {
        if (!usage.has(idx)) usage.set(idx, { used: 0, max: SLOTS_PER_SACK });
        usage.get(idx).used += s;
      } else {
        const base = usage.get(0) ?? { used: 0, max: SLOTS_PER_SACK };
        base.used += s;
        usage.set(0, base);
      }
    }

    return usage;
  }

  _findOrCreateOverflowIndex(usage, capacity, need) {
    for (const [idx, info] of usage.entries()) {
      if (idx >= capacity && info.used + need <= info.max) return idx;
    }
    const nextIdx = Math.max(...usage.keys(), capacity - 1) + 1;
    usage.set(nextIdx, { used: 0, max: SLOTS_PER_SACK });
    return nextIdx;
  }

  /**
   * Handle dropping of an item reference or item data onto an Actor Sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<Item[]|boolean>}  The created or updated Item instances, or false if the drop was not permitted.
   * @protected
   */
  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false;

    let item = await Item.implementation.fromDropData(data);

    if (ITEMS_NOT_ALLOWED_IN_CARAVANS.includes(item.type)) return false;
    if (SUBTYPES_NOT_ALLOWED_IN_CARAVANS.includes(item.system.type)) return false;

    const capacity = Number(this.actor.system.capacity ?? 0);
    const targetIdx = this._getDropSackIndexFromEvent(event);
    const aimedIdx = Number.isFinite(targetIdx) ? targetIdx : 0;

    const sameActor = item?.parent?.uuid === this.actor.uuid;

    // --- Calculate total slots needed (container + children) ---
    const baseNeed = Number(item?.system?.slots_taken ?? 1) || 1;
    let totalNeed = baseNeed;
    let childrenIds = [];

    if (item.system.type === GearType.CONTAINER) {
      const children = sameActor
        ? this.actor.items.filter(i => i.system.container === item.uuid)
        : item.parent?.items.filter(i => i.system.container === item.uuid) || [];
      totalNeed = children.reduce(
        (sum, child) => sum + (Number(child.system.slots_taken) || 1),
        baseNeed
      );
      childrenIds = children.map(c => c.id);
    }

    // --- Build usage map, excluding the moved item(s) ---
    const usage = this._buildUsageMap(this.actor, capacity);
    if (!usage.has(aimedIdx)) usage.set(aimedIdx, { used: 0, max: SLOTS_PER_SACK });

    let finalIdx = aimedIdx;
    const aimedInfo = usage.get(aimedIdx);
    if (aimedInfo.used + totalNeed > aimedInfo.max) {
      finalIdx = this._findOrCreateOverflowIndex(usage, capacity, totalNeed);
    }

    // --- Same actor: internal reorganization ---
    if (sameActor) {
      const oldIdx = Number(item.getFlag(FLAG_SCOPE, FLAG_SACK)) || 0;
      const dropTargetEl = event.target.closest('li[data-item-id]');
      let targetItem = null;
      if (dropTargetEl) {
        targetItem = this.actor.items.get(dropTargetEl.dataset.itemId);
      }

      if (targetItem) {
        const targetSackIdx = targetItem.getFlag(FLAG_SCOPE, FLAG_SACK) ?? 0;
        if (oldIdx !== targetSackIdx) {
          // Move the dropped item (and its children if container) to the target sack first
          await this._moveItemToSack(item, targetSackIdx, oldIdx);
          // After moving, re-fetch the dropped item (its ID remains the same)
          const freshItem = this.actor.items.get(item.id);
          if (!freshItem) return false;
          item = freshItem;
        }
        await this._handleCaravanItemDrop(event, item, targetItem, targetSackIdx);
        return this._reapplyStripes();
      } else {
        // Drop on empty space
        if (oldIdx === finalIdx) {
          // Same sack: remove from container and move to bottom of sack
          if (item.system.type === GearType.CONTAINER) {
            // Containers dropped on empty space in same sack: do nothing? actor sheet returns.
            return false;
          }
          // Find max sort in this sack (excluding this item)
          const itemsInSack = this.actor.items.filter(
            i => (i.getFlag(FLAG_SCOPE, FLAG_SACK) ?? 0) === oldIdx && i.id !== item.id
          );
          const maxSort = itemsInSack.reduce((max, i) => Math.max(max, i.sort || 0), 0);
          await item.update({
            'system.container': '',
            sort: maxSort + 100
          });
          return this._reapplyStripes();
        } else {
          // Different sack: move the whole block
          await this._moveItemToSack(item, finalIdx, oldIdx);
          return this._reapplyStripes();
        }
      }
    }

    // --- Cross‑actor drop ---
    // (capacity already checked, finalIdx is valid)
    if (item.system.type === GearType.CONTAINER) {
      // Transfer container with all its contents
      const isCopy = false; // moving, not copying
      await this._transferContainerWithContents(item, item.parent, this.actor, finalIdx, isCopy);
      return this._reapplyStripes();
    } else {
      // Normal item
      const createData = item.toObject();
      foundry.utils.setProperty(createData, `flags.${FLAG_SCOPE}.${FLAG_SACK}`, finalIdx);
      createData.system.container = ''; // always root when moving to another actor

      if (item.parent?.isOwner) {
        const itemToDelete = fromUuidSync(item.uuid);
        await itemToDelete.delete();
      }

      this.actor.createEmbeddedDocuments('Item', [createData]);
      return this._reapplyStripes();
    }
  }

  async _rebuildAllSacks() {
    // Group items by sack index
    const itemsBySack = new Map();
    for (const item of this.actor.items) {
      const sackIdx = item.getFlag(FLAG_SCOPE, FLAG_SACK) ?? 0;
      if (!itemsBySack.has(sackIdx)) itemsBySack.set(sackIdx, []);
      itemsBySack.get(sackIdx).push(item);
    }

    const updates = [];

    for (const [sackIdx, items] of itemsBySack.entries()) {
      // Separate containers and loose items, build container map
      const containers = [];
      const looseItems = [];
      const containerMap = new Map();

      for (const item of items) {
        if (item.system.type === GearType.CONTAINER) {
          containers.push(item);
          containerMap.set(item.uuid, []);
        } else if (!item.system.container) {
          looseItems.push(item);
        }
      }

      // Collect children
      for (const item of items) {
        const containerId = item.system.container;
        if (containerId && containerMap.has(containerId)) {
          containerMap.get(containerId).push(item);
        }
      }

      // Sort containers and loose items by current sort (preserve user order)
      containers.sort((a, b) => a.sort - b.sort);
      looseItems.sort((a, b) => a.sort - b.sort);

      const finalOrder = [];

      finalOrder.push(...looseItems);

      for (const container of containers) {
        finalOrder.push(container);
        const children = containerMap.get(container.uuid).sort((a, b) => a.sort - b.sort);
        finalOrder.push(...children);
      }

      // Generate updates for this sack (spaced by 100 for future insertions)
      finalOrder.forEach((item, index) => {
        updates.push({
          _id: item.id,
          sort: (index + 1) * 100
        });
      });
    }

    if (updates.length) {
      await this.actor.updateEmbeddedDocuments('Item', updates);
    }
  }

  async _handleCaravanItemDrop(event, droppedItem, targetItem, sackIdx) {
    const isDroppedContainer = droppedItem.system.type === GearType.CONTAINER;
    const isTargetContainer = targetItem.system.type === GearType.CONTAINER;

    // Helper to get a container and its direct children, sorted
    const getBlock = container => {
      const children = this.actor.items
        .filter(i => i.system.container === container.uuid)
        .sort((a, b) => a.sort - b.sort);
      return [container, ...children];
    };

    // --- CASE 1: Dropped item is a container (restored) ---
    if (isDroppedContainer) {
      if (isTargetContainer) {
        // Swap the two container blocks (container + all children)
        const droppedBlock = getBlock(droppedItem);
        const targetBlock = getBlock(targetItem);
        const droppedSort = droppedBlock[0].sort;
        const targetSort = targetBlock[0].sort;

        const updates = [];
        for (let i = 0; i < droppedBlock.length; i++) {
          updates.push({ _id: droppedBlock[i].id, sort: targetSort + i });
        }
        for (let i = 0; i < targetBlock.length; i++) {
          updates.push({ _id: targetBlock[i].id, sort: droppedSort + i });
        }
        await this.actor.updateEmbeddedDocuments('Item', updates);
        await this._rebuildAllSacks();
        return;
      } else {
        // Dropped container onto a non‑container (loose) item
        // Cannot drop a container into another container's interior
        if (targetItem.system.container) return false;

        // Swap the container and the target item (standard sort)
        await this._onSortItem(event, droppedItem);

        // Renumber children to follow the container sequentially
        const container = this.actor.items.get(droppedItem.id);
        const children = this.actor.items
          .filter(i => i.system.container === container.uuid)
          .sort((a, b) => a.sort - b.sort);

        if (children.length) {
          const updates = [];
          let base = container.sort;
          for (let i = 0; i < children.length; i++) {
            updates.push({
              _id: children[i].id,
              sort: base + i + 1
            });
          }
          await this.actor.updateEmbeddedDocuments('Item', updates);
        }
        return;
      }
    }

    // --- CASE 2: Dropped item is NOT a container ---
    // Check if allowed inside a container (if target is a container)
    if (isTargetContainer && !ITEMS_ALLOWED_IN_CONTAINERS.includes(droppedItem.system.type)) {
      return false;
    }

    // Determine the new container UUID and the sack index that container resides in
    let newContainer = '';
    let newSackIdx = sackIdx; // default to the drop sack

    if (isTargetContainer) {
      newContainer = targetItem.uuid;
      newSackIdx = targetItem.getFlag(FLAG_SCOPE, FLAG_SACK) ?? sackIdx;

      // If the item is already inside this container, do nothing
      if (droppedItem.system.container === newContainer) {
        return false;
      }
    } else if (targetItem.system.container) {
      newContainer = targetItem.system.container;
      // Find the container item to get its sack
      const containerItem = await fromUuid(newContainer);
      if (containerItem) {
        newSackIdx = containerItem.getFlag(FLAG_SCOPE, FLAG_SACK) ?? sackIdx;
      }
    } else {
      newContainer = '';
      // Dropping onto a loose item in same sack – sack index remains sackIdx
    }

    // Update container reference and sack flag if either changed
    const containerChanged = droppedItem.system.container !== newContainer;
    const sackChanged = droppedItem.getFlag(FLAG_SCOPE, FLAG_SACK) !== newSackIdx;
    if (containerChanged || sackChanged) {
      const updates = {
        'system.container': newContainer,
        [`flags.${FLAG_SCOPE}.${FLAG_SACK}`]: newSackIdx
      };
      const response = await droppedItem.update(updates);
      if (!response) return false;
    }

    // Handle sorting / placement
    if (isTargetContainer) {
      // Place the item at the end of the container's children
      const children = this.actor.items
        .filter(i => i.system.container === newContainer)
        .sort((a, b) => a.sort - b.sort);

      let newSort;
      if (children.length) {
        // If there are children, place after the last one
        newSort = children[children.length - 1].sort + 1;
      } else {
        // No children, place immediately after the container
        newSort = targetItem.sort + 1;
      }
      await droppedItem.update({ sort: newSort });
      await this._rebuildAllSacks();
    } else {
      // Drop onto a non‑container item: swap sorts
      await this._onSortItem(event, droppedItem);
    }
  }

  _getMaxSortInSack(sackIdx, excludeIds = []) {
    let maxSort = 0;
    for (const it of this.actor.items) {
      if (excludeIds.includes(it.id)) continue;
      if ((it.getFlag(FLAG_SCOPE, FLAG_SACK) ?? 0) === sackIdx) {
        maxSort = Math.max(maxSort, it.sort || 0);
      }
    }
    return maxSort;
  }

  async _moveItemToSack(item, newSackIdx, oldSackIdx) {
    const isContainer = item.system.type === GearType.CONTAINER;
    const children = isContainer
      ? this.actor.items
          .filter(i => i.system.container === item.uuid)
          .sort((a, b) => a.sort - b.sort)
      : [];

    const allMovingIds = [item.id, ...children.map(c => c.id)];
    const maxSort = this._getMaxSortInSack(newSackIdx, allMovingIds);
    let baseSort = maxSort + 100;

    const updates = [];

    // Update the container or single item
    const updateObj = {
      _id: item.id,
      [`flags.${FLAG_SCOPE}.${FLAG_SACK}`]: newSackIdx,
      sort: baseSort
    };
    if (!isContainer) {
      updateObj['system.container'] = ''; // remove from old container when moving sacks
    }
    updates.push(updateObj);

    // Update children (only if container) – they stay inside the container
    for (let i = 0; i < children.length; i++) {
      updates.push({
        _id: children[i].id,
        [`flags.${FLAG_SCOPE}.${FLAG_SACK}`]: newSackIdx,
        sort: baseSort + i + 1
      });
    }

    await this.actor.updateEmbeddedDocuments('Item', updates);
  }

  async _transferContainerWithContents(
    containerItem,
    sourceActor,
    targetActor,
    targetSackIdx,
    isCopy = false
  ) {
    // Duplicate the container
    const containerData = foundry.utils.duplicate(containerItem.toObject());
    delete containerData._id;
    delete containerData.sort;
    delete containerData.folder;
    foundry.utils.setProperty(containerData, `flags.${FLAG_SCOPE}.${FLAG_SACK}`, targetSackIdx);
    containerData.system.container = ''; // root in the new actor

    const [createdContainer] = await targetActor.createEmbeddedDocuments('Item', [containerData]);
    const newContainerUuid = createdContainer.uuid;

    // Find children in the source actor
    const children = sourceActor.items.filter(i => i.system.container === containerItem.uuid);

    if (children.length) {
      const childrenData = children.map(child => {
        const data = foundry.utils.duplicate(child.toObject());
        delete data._id;
        delete data.sort;
        delete data.folder;
        data.system.container = newContainerUuid;
        foundry.utils.setProperty(data, `flags.${FLAG_SCOPE}.${FLAG_SACK}`, targetSackIdx);
        return data;
      });
      await targetActor.createEmbeddedDocuments('Item', childrenData);
    }

    // Delete originals if this is a move (not a copy)
    if (!isCopy) {
      const idsToDelete = [containerItem.id, ...children.map(c => c.id)];
      await sourceActor.deleteEmbeddedDocuments('Item', idsToDelete);
    }

    return createdContainer;
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
      // ui.notifications.error('Adding this item will exceed your carry weight limit.');
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
        dragend: this._onDragEnd.bind(this),
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
