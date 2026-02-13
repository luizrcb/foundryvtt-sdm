import PowerDataModel from '../data/power-data.mjs';
import { SdmItem } from '../documents/item.mjs';
import { createNPCByLevel, getActorOptions } from '../helpers/actorUtils.mjs';
import { GearType, ItemType } from '../helpers/constants.mjs';
import { prepareActiveEffectCategories } from '../helpers/effects.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import { templatePath } from '../helpers/templates.mjs';

const { api, sheets } = foundry.applications;
const { DialogV2 } = foundry.applications.api;
const DragDrop = foundry.applications.ux.DragDrop.implementation;
const FilePicker = foundry.applications.apps.FilePicker.implementation;
const TextEditor = foundry.applications.ux.TextEditor.implementation;
const { performIntegerSort } = foundry.utils;
/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheetV2}
 */
export class SdmItemSheet extends api.HandlebarsApplicationMixin(sheets.ItemSheetV2) {
  constructor(options = {}) {
    super(options);

    const classes = [...this.options.classes];
    const window = { ...this.options.window };
    const controls = [...this.options.window.controls];

    // if (game.user.isGM) {
    //   controls.push({
    //     action: 'spawnNPC',
    //     icon: 'fa-solid fa-robot',
    //     label: 'Spawn NPC',
    //     ownership: 'OWNER'
    //   });
    // }

    window.controls = controls;

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
    classes: ['sdm', 'item'],
    window: {
      resizable: true
    },
    actions: {
      onEditImage: this._onEditImage,
      onEditPowerImage: this._onEditPowerImage,
      viewDoc: this._viewEffect,
      addPower: this._onCreatePower,
      deletePower: this._onDeletePower,
      extractPower: this._onExtractPower,
      nextPower: this._onNextPower,
      prevPower: this._onPrevPower,
      createDoc: this._createEffect,
      deleteDoc: this._deleteEffect,
      toggleEffect: this._toggleEffect,
      toggleReadied: this._toggleReadied,
      toggleItemStatus: { handler: this._toggleItemStatus, buttons: [0, 2] },
      toggleIsHallmark: this._toggleIsHallmark,
      radioToggle: this._radioToggle,
      spawnNPC: this._onSpawnNPC
    },
    form: {
      submitOnChange: true
    },
    // Custom property that's merged into `this.options`
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: null }]
  };

  /* -------------------------------------------- */

  /** @override */
  static PARTS = {
    header: {
      template: templatePath('item/header')
    },
    tabs: {
      // Foundry-provided generic template
      template: 'templates/generic/tab-navigation.hbs'
    },
    description: {
      template: templatePath('item/description'),
      scrollable: ['']
    },
    attributesFeature: {
      template: templatePath('item/attribute-parts/feature')
    },
    powerAlbum: {
      template: templatePath('item/attribute-parts/power_album'),
      scrollable: ['']
    },
    effects: {
      template: templatePath('item/effects'),
      scrollable: ['']
    }
  };

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    // Not all parts always render
    options.parts = ['header', 'tabs'];
    // Don't show the other tabs if only limited view
    if (this.document.limited) return;
    // Control which parts show based on document subtype
    switch (this.document.type) {
      case 'gear':
        if (this.document.system.type === GearType.POWER_ALBUM) {
          options.parts.push('powerAlbum');
        }
        break;
    }

    options.parts.push('description', 'effects');
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const extendedSkillRanks = game.settings.get('sdm', 'extendedSkillRanks') || false;
    const defaultModifierStep = game.settings.get('sdm', 'skillModifierStep') || 3;
    const allSKillMods = {
      ...CONFIG.SDM.skillMod,
      ...(extendedSkillRanks ? CONFIG.SDM.extraSkillMod : {})
    };

    const language = game.i18n.lang;

    const context = {
      // Validates both permissions and compendium status
      editable: this.isEditable,
      owner: this.document.isOwner,
      limited: this.document.limited,
      // Add the item document.
      item: this.item,
      // Adding system and flags for easier access
      system: this.item.system,
      flags: this.item.flags,
      // Adding a pointer to CONFIG.SDM
      config: CONFIG.SDM,
      // You can factor out context construction to helper functions
      tabs: this._getTabs(options.parts),
      // Necessary for formInput and formFields helpers
      fields: this.document.schema.fields,
      systemFields: this.document.system.schema.fields,
      pullModes: CONFIG.SDM.pullModes,
      possibleRiders: getActorOptions('character'),
      sizeUnits: CONFIG.SDM.sizeUnits,
      skillMod: allSKillMods,
      skillModifierStep: defaultModifierStep,
      abilities: CONFIG.SDM.getOrderedAbilities(language),
      isGM: game.user.isGM
    };

    if (this.item.type === ItemType.GEAR && this.item.system.type === GearType.POWER_ALBUM) {
      // Calculate navigation states
      context.powers = context.system?.powers;
      context.enrichedPowers = await this._getPowersDescriptions(context.powers);
      context.currentPowerIndex = context.system.powers_current_index || 0;
      context.powerCount = context.powers.length;
      context.hasPrevious = context.currentPowerIndex > 0;
      context.hasNext = context.currentPowerIndex < context.powers.length - 1;
    }

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case 'attributesFeature':
      case 'attributesMount':
      case 'powerAlbum':
        // Necessary for preserving active tab on re-render
        context.tab = context.tabs[partId];
        break;
      case 'description':
        context.tab = context.tabs[partId];
        // Enrich description info for display
        // Enrichment turns text like `[[/r 1d20]]` into buttons
        context.enrichedDescription = await TextEditor.enrichHTML(this.item.system.description, {
          // Whether to show secret blocks in the finished html
          secrets: this.document.isOwner,
          // Data to fill in for inline rolls
          rollData: this.item.getRollData(),
          // Relative UUID resolution
          relativeTo: this.item
        });
        break;
      case 'effects':
        context.tab = context.tabs[partId];
        // Prepare active effects for easier access
        context.effects = prepareActiveEffectCategories(this.item.effects);
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

    const defaultTab = parts.includes('powerAlbum')
      ? 'album'
      : parts.includes('attributes')
        ? 'attributes'
        : 'description';
    // Default tab for first time it's rendered this session
    if (!this.tabGroups[tabGroup]) this.tabGroups[tabGroup] = defaultTab;
    return parts.reduce((tabs, partId) => {
      const tab = {
        cssClass: '',
        group: tabGroup,
        // Matches tab property to
        id: '',
        // FontAwesome Icon, if you so choose
        icon: '',
        // Run through localization
        label: 'SDM.ItemTab'
      };
      switch (partId) {
        case 'header':
        case 'tabs':
          return tabs;
        case 'description':
          tab.id = 'description';
          tab.label += 'Description';
          tab.icon = 'fa fa-scroll';
          break;
        case 'attributesFeature':
          tab.id = 'attributes';
          tab.label += 'Attributes';
          break;
        case 'powerAlbum':
          tab.id = 'album';
          tab.label += 'Album';
          tab.icon = 'fa fa-book';
          break;
        case 'effects':
          tab.id = 'effects';
          tab.label += 'Effects';
          tab.icon = 'fa fa-bolt';
          break;
      }
      if (this.tabGroups[tabGroup] === tab.id) tab.cssClass = 'active';
      tabs[partId] = tab;
      return tabs;
    }, {});
  }

  /**
   * Actions performed after any render of the Application.
   * Post-render steps are not awaited by the render process.
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   */
  _onRender(context, options) {
    this.#dragDrop.forEach(d => d.bind(this.element));
    // You may want to add other special handling here
    // Foundry comes with a large number of utility classes, e.g. SearchFilter
    // That you may want to  implement yourself.
    const selectElement = this.element.querySelector('#gearType');
    selectElement?.addEventListener('change', event => {
      const tabs = this.element.querySelectorAll('[data-tab]');
      if (event.target.value !== 'power_album') {
        this.tabGroups['primary'] = 'description';
        for (let t of tabs) {
          if (t.dataset.group && t.dataset.group !== 'primary') continue;
          t.classList.toggle('active', t.dataset.tab === 'description');
        }
      } else {
        this.tabGroups['primary'] = 'album';
        for (let t of tabs) {
          if (t.dataset.group && t.dataset.group !== 'primary') continue;
          t.classList.toggle('active', t.dataset.tab === 'album');
        }
      }
    });
  }

  // async _onSubmitForm(formConfig, event) {
  //   // eslint-disable-next-line no-undef
  //   let formData = new foundry.applications.ux.FormDataExtended(this.element);
  //   const expandedFormData = foundry.utils.expandObject(formData.object);
  //   const { mergeObject, setProperty } = foundry.utils;
  //   expandedFormData.system = mergeObject(expandedFormData.system, this.item.system);
  //   await this.item.update(expandedFormData);
  //   //await super._onSubmitForm(formConfig, event);
  // }

  async _getPowersDescriptions(powers) {
    if (!powers) return {};

    const descriptions = await Promise.all(
      powers?.map(async ({ description }, index) => {
        const enriched = await TextEditor.enrichHTML(description, {
          relativeTo: this.document
          // secrets: this.document.isOwner
        });
        return [index, enriched];
      })
    );
    return Object.fromEntries(descriptions);
  }

  /**************
   *
   *   ACTIONS
   *
   **************/

  /**
   * Handle changing a Document's image.
   *
   * @this SdmItemSheet
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
   * Handle changing a Document's image.
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onEditPowerImage(event, target) {
    const powerIndex = parseInt(target.dataset.index, 10);
    const current = foundry.utils.getProperty(this.item, target.dataset.edit);

    let changedPowers = foundry.utils.duplicate(this.item.system.powers);

    const { img } =
      this.item.constructor.getDefaultArtwork?.(new PowerDataModel().toObject()) ?? {};

    const fp = new FilePicker({
      current,
      type: 'image',
      redirectToRoot: img ? [img] : [],
      callback: async path => {
        changedPowers = changedPowers.map((power, index) => {
          if (index === powerIndex) {
            return { ...power, img: path };
          }

          return power;
        });

        await this.item.update({
          'system.powers': changedPowers
        });
        return this.render();
      },
      top: this.position.top + 40,
      left: this.position.left + 10
    });
    return fp.browse();
  }

  /**
   * Renders an embedded document's sheet
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _viewEffect(event, target) {
    const effect = this._getEffect(target);
    effect.sheet.render(true);
  }

  /**
   * Handles item deletion
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _deleteEffect(event, target) {
    const effect = this._getEffect(target);
    await effect.delete();
  }

  /**
   * Handle creating a new Owned Item or ActiveEffect for the actor using initial data
   * defined in the HTML dataset
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _createEffect(event, target) {
    // Retrieve the configured document class for ActiveEffect
    const aeCls = getDocumentClass('ActiveEffect');
    // Prepare the document creation data by initializing it a default name.
    // As of v12, you can define custom Active Effect subtypes just like Item subtypes if you want
    const effectData = {
      name: aeCls.defaultName({
        // defaultName handles an undefined type gracefully
        type: target.dataset.type,
        parent: this.item
      })
    };
    // Loop through the dataset and add it to our effectData
    for (const [dataKey, value] of Object.entries(target.dataset)) {
      // These data attributes are reserved for the action handling
      if (['action', 'documentClass'].includes(dataKey)) continue;
      // Nested properties require dot notation in the HTML, e.g. anything with `system`
      // An example exists in spells.hbs, with `data-system.spell-level`
      // which turns into the dataKey 'system.spellLevel'
      foundry.utils.setProperty(effectData, dataKey, value);
    }

    // Finally, create the embedded document!
    await aeCls.create(effectData, { parent: this.item });
  }

  static async _onPrevPower(event, target) {
    const currentIndex = this.item.system.powers_current_index || 0;
    if (currentIndex > 0) {
      await this.item.update({
        'system.powers_current_index': currentIndex - 1
      });
      this.render();
    }
  }

  static async _onNextPower(event, target) {
    const currentIndex = this.item.system.powers_current_index || 0;
    const powers = this.item.system.powers || [];
    if (currentIndex < powers.length - 1) {
      await this.item.update({
        'system.powers_current_index': currentIndex + 1
      });
      this.render();
    }
  }

  static newPower(data) {
    const basePower = new PowerDataModel().toObject();
    basePower.name = $fmt('SDM.DOCUMENT.New', { type: $l10n('SDM.Power') });
    if (!data) return basePower;

    const {
      img,
      name,
      level,
      range,
      target,
      duration,
      overcharge,
      overcharge_roll_formula,
      roll_formula,
      default_ability,
      description
    } = data;

    return {
      ...basePower,
      img,
      name,
      description,
      level,
      range,
      target,
      duration,
      overcharge,
      overcharge_roll_formula,
      roll_formula,
      default_ability
    };
  }

  static async _onCreatePower(event, target, data) {
    const powerAlbum = this.item.system.powers;

    if (powerAlbum.length >= this.item.system.max_powers) {
      ui.notifications.warn($fmt('SDM.ErrorMaxPowers', { item: this.item.name }));
      return;
    }

    let newPower = SdmItemSheet.newPower(data);
    const updatedContainer = foundry.utils.duplicate(this.item.system.powers);
    updatedContainer.push(newPower);

    await this.item.update({
      'system.powers': updatedContainer,
      'system.powers_current_index': updatedContainer.length - 1
    });
    this.render();
  }

  static async _onDeletePower(event, target) {
    const powerAlbum = this.item.system.powers;

    const powerIndex = parseInt(target.dataset.index, 10);
    if (powerIndex < 0 || !powerAlbum.length || powerIndex >= powerAlbum.length) {
      return;
    }

    let powerName = powerAlbum[powerIndex].name;

    const proceed = await DialogV2.confirm({
      content: `<b>${$fmt('SDM.DeleteDocConfirmation', { doc: powerName })}</b>`,
      modal: true,
      rejectClose: false,
      yes: { label: $l10n('SDM.ButtonYes') },
      no: { label: $l10n('SDM.ButtonNo') }
    });
    if (!proceed) return;

    let newCurrentIndex;

    if (powerIndex === 0) {
      newCurrentIndex = 0;
    } else if (powerIndex <= powerAlbum.length - 1) {
      newCurrentIndex = powerIndex - 1;
    }

    let updatedContainer = foundry.utils.duplicate(this.item.system.powers);
    updatedContainer.splice(powerIndex, 1);

    await this.item.update({
      'system.powers': updatedContainer,
      'system.powers_current_index': newCurrentIndex
    });
    this.render();
  }

  static async _onExtractPower(event, target) {
    if (!game.user.isGM) return;

    const powerAlbum = this.item.system.powers;

    const powerIndex = parseInt(target.dataset.index, 10);
    if (powerIndex < 0 || !powerAlbum.length || powerIndex >= powerAlbum.length) {
      return;
    }
    const powerToExtract = powerAlbum[powerIndex];
    const { name, img, description, ...data } = powerToExtract;

    const newPowerData = {
      type: ItemType.GEAR,
      name,
      img,
      system: {
        type: GearType.POWER,
        description,
        power: {
          ...data
        }
      }
    };

    await SdmItem.create(newPowerData);
    ui.notifications.info(
      $fmt('SDM.PowerExtractionComplete', { power: name, power_album: this.item.name })
    );
  }

  /**
   * Determines effect parent to pass to helper
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _toggleEffect(event, target) {
    const effect = this._getEffect(target);
    await effect.update({ disabled: !effect.disabled });
  }

  /**
   * Determines effect parent to pass to helper
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
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

  static async _toggleReadied() {
    await this.item.toggleReadied();
  }

  static async _toggleIsHallmark() {
    await this.item.toggleIsHallmark();
  }

  static async _toggleItemStatus(event) {
    await this.item.toggleItemStatus(event);
  }

  static async _onSpawnNPC(event, target) {
    // let's allow to spawn from table or directly from all attributes
    const item = this.item;
    const itemLevel = Math.max(item.system.hallmark.level, item.system.attributes.level);

    const npcData = await createNPCByLevel({
      name: item.name,
      lvl: itemLevel,
      tableName: 'generic-synthesized-creature',
      image: item.img,
      ownership: item.ownership,
      linked: true,
      biography: `<p>NPC Spawned from: @UUID[${item.uuid}]{${item.name}}</p>`
    });

    // const virtualActor = new SdmActor({
    //   type: 'npc',
    //   name: item.name,
    //   img: item.img,
    //   system: { ...attributes }
    // }).toObject();
  }

  /** Helper Functions */

  /**
   * Fetches the row with the data for the rendered embedded document
   *
   * @param {HTMLElement} target  The element with the action
   * @returns {HTMLLIElement} The document's row
   */
  _getEffect(target) {
    const li = target.closest('.effect');
    return this.item.effects.get(li?.dataset?.effectId);
  }

  /**
   *
   * DragDrop
   *
   */

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
    const li = event.currentTarget;
    if ('link' in event.target.dataset) return;

    let dragData = null;

    // Active Effect
    if (li.dataset.effectId) {
      const effect = this.item.effects.get(li.dataset.effectId);
      dragData = effect.toDragData();
    }

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
    const item = this.item;
    const allowed = Hooks.call('dropItemSheetData', item, this, data);
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

  /* -------------------------------------------- */

  /**
   * Handle the dropping of ActiveEffect data onto an Actor Sheet
   * @param {DragEvent} event                  The concluding DragEvent which contains drop data
   * @param {object} data                      The data transfer extracted from the event
   * @returns {Promise<ActiveEffect|boolean>}  The created ActiveEffect object
   *                                           or false if it couldn't be created.
   * @protected
   */
  async _onDropActiveEffect(event, data) {
    const aeCls = getDocumentClass('ActiveEffect');
    const effect = await aeCls.fromDropData(data);
    if (!this.item.isOwner || !effect) return false;

    if (this.item.uuid === effect.parent?.uuid) return this._onEffectSort(event, effect);
    return aeCls.create(effect, { parent: this.item });
  }

  /**
   * Sorts an Active Effect based on its surrounding attributes
   *
   * @param {DragEvent} event
   * @param {ActiveEffect} effect
   */
  _onEffectSort(event, effect) {
    const effects = this.item.effects;
    const dropTarget = event.target.closest('[data-effect-id]');
    if (!dropTarget) return;
    const target = effects.get(dropTarget.dataset.effectId);

    // Don't sort on yourself
    if (effect.id === target.id) return;

    // Identify sibling items based on adjacent HTML elements
    const siblings = [];
    for (let el of dropTarget.parentElement.children) {
      const siblingId = el.dataset.effectId;
      if (siblingId && siblingId !== effect.id) siblings.push(effects.get(el.dataset.effectId));
    }

    // Perform the sort
    const sortUpdates = performIntegerSort(effect, {
      target,
      siblings
    });
    const updateData = sortUpdates.map(u => {
      const update = u.update;
      update._id = u.target._id;
      return update;
    });

    // Perform the update
    return this.item.updateEmbeddedDocuments('ActiveEffect', updateData);
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping of an Actor data onto another Actor sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<object|boolean>}  A data object which describes the result of the drop,
   *                                     or false if the drop was not permitted.
   * @protected
   */
  async _onDropActor(event, data) {
    if (!this.item.isOwner) return false;
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
    if (!this.item.isOwner) return false;
    const droppedItem = await Item.implementation.fromDropData(data);

    if (
      this.item.system.type !== GearType.POWER_ALBUM ||
      droppedItem.system.type !== GearType.POWER
    ) {
      return false;
    }

    const {
      level,
      range,
      target,
      duration,
      overcharge,
      overcharge_roll_formula,
      roll_formula,
      default_ability
    } = droppedItem.system.power;
    const { description } = droppedItem.system;
    const { img, name } = droppedItem;

    await SdmItemSheet._onCreatePower.call(this, null, null, {
      level,
      range,
      target,
      duration,
      overcharge,
      overcharge_roll_formula,
      roll_formula,
      default_ability,
      img,
      name,
      description
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping of a Folder on an Actor Sheet.
   * The core sheet currently supports dropping a Folder of Items to create all items as owned items.
   * @param {DragEvent} event     The concluding DragEvent which contains drop data
   * @param {object} data         The data transfer extracted from the event
   * @returns {Promise<Item[]>}
   * @protected
   */
  async _onDropFolder(event, data) {
    if (!this.item.isOwner) return [];
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
}
