import { prepareActiveEffectCategories } from '../helpers/effects.mjs';
import { RollHandler } from '../rolls/rollHandler.mjs';
import { convertToCash, GEAR_ITEM_TYPES, ITEMS_NOT_ALLOWED_IN_CHARACTERS } from '../helpers/itemUtils.mjs';
import { openItemTransferDialog } from '../items/transferItem.mjs';
import { ItemType, SizeUnit } from '../helpers/constants.mjs';
import { getHeroicDiceSelect } from '../rolls/heroicDice.mjs';
import { UNENCUMBERED_THRESHOLD_CASH } from '../helpers/actorUtils.mjs';

const { api, sheets } = foundry.applications;
const TextEditor = foundry.applications.ux.TextEditor.implementation;
const DragDrop = foundry.applications.ux.DragDrop.implementation;
const FilePicker = foundry.applications.apps.FilePicker.implementation;

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheetV2}
 */
export class SdmCaravanSheet extends api.HandlebarsApplicationMixin(
  sheets.ActorSheetV2
) {
  constructor(options = {}) {
    super(options);
    this.#dragDrop = this.#createDragDropHandlers();
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['sdm', 'caravan'],
    position: {
      width: 800,
      height: 800,
    },
    window: {
      resizable: true,
    },
    actions: {
      onEditImage: this._onEditImage,
      viewDoc: this._viewDoc,
      createDoc: this._createDoc,
      deleteDoc: this._deleteDoc,
      toggleEffect: this._toggleEffect,
      roll: {
        handler: this._onRoll,
        buttons: [0, 2]
      }
    },
    // Custom property that's merged into `this.options`
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: null }],
    form: {
      submitOnChange: true,
    },
  };

  /** @override */
  static PARTS = {
    header: {
      template: 'systems/sdm/templates/actor/header.hbs',
    },
    tabs: {
      // Foundry-provided generic template
      template: 'templates/generic/tab-navigation.hbs',
    },
    features: {
      template: 'systems/sdm/templates/actor/features.hbs',
    },
    biography: {
      template: 'systems/sdm/templates/actor/biography.hbs',
    },
    gear: {
      template: 'systems/sdm/templates/actor/gears.hbs',
    },
    spells: {
      template: 'systems/sdm/templates/actor/spells.hbs',
    },
    effects: {
      template: 'systems/sdm/templates/actor/effects.hbs',
    },
  };

  _getStatSelectOptions(skill, useDefaultStat = true) {
    const abilitiesOrder = CONFIG.SDM.abilitiesOrder;
    const currentLanguage = game.i18n.lang;
    const { defaultStat = 'str' } = skill;
    let result = '';

    if (!useDefaultStat) {
      result += '<option value=""}></option>';
    }
    for (let orderedAbility of abilitiesOrder['en']) {
      result += `<option value="${orderedAbility}"${(orderedAbility === defaultStat) ? 'selected' : ''}>
      ${game.i18n.localize(CONFIG.SDM.abilities[orderedAbility])}</option>\n`
    }

    return result;
  }

  damageMultiplierOptions() {
    let options = '';
    for (const [key, value] of Object.entries(CONFIG.SDM.damageMultiplier)) {
      options += `<option value="${key}">${value}</option>\n`
    }

    return options;
  }

  // Open the custom roll modal
  async _openCustomRollModal(key, attribute, skill, rolledFrom, item, versatile = false) {
    const actorSkill = skill ? this.actor.system[skill] : {};
    const versatileLabel = game.i18n.localize(CONFIG.SDM.versatile)
    const title = attribute ?? actorSkill.name ?? `${item?.name}${versatile ? ` (${versatileLabel})` : ''}`;
    const isTraitRoll = !!(skill || key);
    const minHeroicDiceZero = true;
    const content = `
      <div class="custom-roll-modal">
        <h2>Roll for ${title}</h2>
        <form class="custom-roll-form">
        ${rolledFrom !== 'Abilities' ? `<div class="form-group">
            <label>${game.i18n.localize(CONFIG.SDM.abilitiesLabel)}</label>
            <select name="selectedAttribute">
              ${skill ? this._getStatSelectOptions(actorSkill) :
          item ? this._getStatSelectOptions({ defaultStat: item?.system?.damage?.statBonus }, false) : this._getStatSelectOptions({}, false)}
            </select>
          </div>
        `: ''}
          <div class="form-group">
            <label for="modifier">${game.i18n.localize(CONFIG.SDM.modifierLabel)}</label>
            <input id="modifier" type="string" name="modifier" value="" />
          </div>
         ${item ? `<div class="form-group">
            <label for="multiplier">Multiplier</label>
            <select name="multiplier" id="multiplier">
              <option value=""></option>
             ${this.damageMultiplierOptions()}
            </select>
          </div>`: ''}
          <div class="form-group">
            <label>${game.i18n.localize(CONFIG.SDM.rollTypeLabel)}</label>
            <div class="roll-type-select">
              <div>
                <label>
                  <input type="radio" name="rollType" value="normal" checked> ${game.i18n.localize(CONFIG.SDM.rollType.normal)}
                </label>
              </div>
              <div>
                <label>
                  <input type="radio" name="rollType" value="advantage"> ${game.i18n.localize(CONFIG.SDM.rollType.advantage)}
                </label>
              </div>
              <div>
                <label>
                  <input type="radio" name="rollType" value="disadvantage"> ${game.i18n.localize(CONFIG.SDM.rollType.disadvantage)}
                </label>
              </div>
            </div>
          </div>
          ${getHeroicDiceSelect(this.actor, minHeroicDiceZero)}
          <div class="form-group">
            <label for="shouldExplode">${game.i18n.localize("SDM.ExplodingDice")}</label>
            <input id="shouldExplode" type="checkbox" name="shouldExplode" ${isTraitRoll ? "checked" : ""} />
          </div>
        </form>
        <br/><br/>
      </div>
    `;

    // Create and render the modal
    const rollOptions = await foundry.applications.api.DialogV2.prompt({
      window: {
        title: `Roll: ${title}`,
      },
      content,
      ok: {
        icon: 'fas fa-dice-d20',
        label: "Roll",
        callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object,
      }
    });
    const {
      selectedAttribute = '',
      modifier = '',
      heroicQty = '0',
      rollType = 'normal',
      shouldExplode = false,
      multiplier = '',
    } = rollOptions;
    if (modifier && !foundry.dice.Roll.validate(modifier)) {
      ui.notifications.error("Invalid roll modifier");
      return
    }
    const heroicDice = parseInt(heroicQty || 0, 10);
    const currentHeroics = this.actor.system.heroics?.value ?? 0;

    if (heroicDice > currentHeroics) {
      ui.notifications.error("Not enough heroic dice for this roll");
      return
    }

    const ability = key ? key : selectedAttribute;
    const skillData = skill ? this.actor.system[skill] : {};
    let label = skill ? skillData.name : (attribute ? attribute : (ability ? game.i18n.localize(CONFIG.SDM.abilities[ability]) : ''));

    if (item) {
      label = item.name;
      // get item damage base or versatile
      return RollHandler.handleItemRoll(this.actor, item, label, {
        modifier,
        multiplier,
        rollType,
        heroicDice,
        skill: '',
        addAbility: ability,
        explode: shouldExplode,
        versatile,
      });
    }

    return RollHandler.performRoll(this.actor, ability, label, {
      modifier,
      rollType,
      skill,
      heroicDice,
      rolledFrom,
      explode: shouldExplode,
    });
  }

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    // Not all parts always render
    options.parts = ['header', 'tabs'];
    // Don't show the other tabs if only limited view
    if (this.document.limited) return;
    // Control which parts show based on document subtype
    switch (this.document.type) {
      case 'character':
        options.parts.push('features', 'gear', 'effects');
        break;
      case 'npc':
        options.parts.push('gear', 'effects');
        break;
    }
    options.parts.push('biography')
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
      skills: this.actor.system.skills,
      // Add isGM to the context
      isGM: game.user.isGM,
      carriedWeight: this.actor.getCarriedGear(),
    };

    if (this.actor.type === 'character') {
      // Reorder abilities based on the current language
      const abilitiesOrder = CONFIG.SDM.abilitiesOrder;
      const currentLanguage = game.i18n.lang;

      // Get the order for the current language, defaulting to English if not found
      const order = abilitiesOrder["en"];

      // Reorder the abilities in the system object
      const reorderedAbilities = {};
      order.forEach(key => {
        if (context.system?.abilities[key]) {
          reorderedAbilities[key] = context.system.abilities[key];
        }
      });

      // Replace the abilities in the system object with the reordered abilities
      context.system.abilities = reorderedAbilities;
    }

    // Offloading context prep to a helper function
    this._prepareItems(context);

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case 'features':
      case 'spells':
      case 'gear':
        context.tab = context.tabs[partId];
        break;
      case 'biography':
        context.tab = context.tabs[partId];
        // Enrich biography info for display
        // Enrichment turns text like `[[/r 1d20]]` into buttons
        context.enrichedBiography = await TextEditor.enrichHTML(
          this.actor.system.biography,
          {
            // Whether to show secret blocks in the finished html
            secrets: this.document.isOwner,
            // Data to fill in for inline rolls
            rollData: this.actor.getRollData(),
            // Relative UUID resolution
            relativeTo: this.actor,
          }
        );
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
    if (!this.tabGroups[tabGroup]) this.tabGroups[tabGroup] = 'features';
    return parts.reduce((tabs, partId) => {
      const tab = {
        cssClass: '',
        group: tabGroup,
        // Matches tab property to
        id: '',
        // FontAwesome Icon, if you so choose
        icon: '',
        // Run through localization
        label: 'SDM.Actor.Tabs.',
      };
      switch (partId) {
        case 'header':
        case 'tabs':
          return tabs;
        case 'features':
          tab.id = 'features';
          tab.label += 'Features';
          break;
        case 'gear':
          tab.id = 'gear';
          tab.label += 'Gear';
          break;
        // case 'spells':
        //   tab.id = 'spells';
        //   tab.label += 'Spells';
        //   break;
        case 'effects':
          tab.id = 'effects';
          tab.label += 'Effects';
          break;
        case 'biography':
          tab.id = 'biography';
          tab.label += 'Biography';
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
    const gear = [];
    const transport = [];

    const isCaravan = this.actor.type === 'caravan';

    // Iterate through items, allocating to containers
    for (let i of this.document.items) {
      // Append to gear.
      if (GEAR_ITEM_TYPES.includes(i.type)) {
        gear.push(i);
      } else if (ITEMS_NOT_ALLOWED_IN_CHARACTERS.includes(i.type) && isCaravan) {
        transport.push(i);
      }
    }

    // Sort then assign
    context.gears = gear.sort((a, b) => (a.sort || 0) - (b.sort || 0));

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
    this.#dragDrop.forEach((d) => d.bind(this.element));
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
        if (item.parent?.id === actorId) this._checkEncumbrance();
      }),
      preUpdate: Hooks.on('preUpdateItem', (item, updateData, options, userId) => {
        if (item.parent?.id === actorId) {
          const shouldAllow = this._onItemUpdate(item, updateData);
          if (!shouldAllow) return false;
        }
      }),
      update: Hooks.on('updateItem', (item, changes, options, userId) => {
        if (item.parent?.id === actorId) this._checkEncumbrance();
      }),
      delete: Hooks.on('deleteItem', (item, options, userId) => {
        if (item.parent?.id === actorId) this._checkEncumbrance();
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
    if (updateData.system?.size?.value !== undefined) {
      newSizeValue = updateData.system.size.value;
    }
    if (updateData.system?.size?.unit !== undefined) {
      newSizeUnit = updateData.system.size.unit;
    }
    if (updateData.system?.quantity !== undefined) {
      newQuantity = updateData.system.quantity;
    }

    const newWeight = convertToCash(newSizeValue * newQuantity, newSizeUnit);
    const currentCarriedWeight = this.actor.getCarriedGear() - originalWeight + newWeight;
    const maxCarryWeight = this.actor.system.carry_weight.max;

    // Only error if EXCEEDING max (not when equal)
    if (currentCarriedWeight > maxCarryWeight) {
      ui.notifications.error("Updating this item would exceed your carry weight limit.");
      return false;
    }
    return true;
  }

  // Helper validation method
  _validateItemWeight(item) {
    const size = item.system.size || {};
    const sizeValue = size.value ?? 1;
    const sizeUnit = size.unit ?? SizeUnit.STONES;
    const quantity = size.quantity ?? 1;
    const newWeight = convertToCash(sizeValue * quantity, sizeUnit);

    const currentCarriedWeight = this.actor.getCarriedGear();
    const maxCarryWeight = this.actor.system.carry_weight.max;
    const newCarryWeight = currentCarriedWeight + newWeight;
    if (newCarryWeight > maxCarryWeight) {
      ui.notifications.error("Adding this item would exceed your carry weight limit.");
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
    const encumbranceThreshold = this.actor.system.carry_weight.unencumbered ?? UNENCUMBERED_THRESHOLD_CASH;
    const encumberedEffect = actor.effects.getName('encumbered');
    const encumberedSlow = actor.effects.getName('slow (encumbered)')

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
   * @this SdmActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onEditImage(event, target) {
    const attr = target.dataset.edit;
    const current = foundry.utils.getProperty(this.document, attr);
    const { img } =
      this.document.constructor.getDefaultArtwork?.(this.document.toObject()) ??
      {};
    const fp = new FilePicker({
      current,
      type: 'image',
      redirectToRoot: img ? [img] : [],
      callback: (path) => {
        this.document.update({ [attr]: path });
      },
      top: this.position.top + 40,
      left: this.position.left + 10,
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
    await doc.delete();
  }

  /**
   * Handle creating a new Owned Item or ActiveEffect for the actor using initial data defined in the HTML dataset
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
        parent: this.actor,
      }),
    };

    // Apply dataset properties
    for (const [dataKey, value] of Object.entries(target.dataset)) {
      if (['action', 'documentClass'].includes(dataKey)) continue;
      foundry.utils.setProperty(docData, dataKey, value);
    }

    // Use data model defaults for new items
    const sizeValue = foundry.utils.getProperty(docData, 'system.size.value') ?? 1;
    const sizeUnit = foundry.utils.getProperty(docData, 'system.size.unit') ?? SizeUnit.STONES;
    const quantity = foundry.utils.getProperty(docData, 'system.quantity') ?? 1;
    const newWeight = convertToCash(sizeValue * quantity, sizeUnit);

    const currentCarriedWeight = this.actor.getCarriedGear();
    const maxCarryWeight = this.actor.system.carry_weight.max;

    const newCarryWeight = currentCarriedWeight + newWeight;

    if (newCarryWeight > maxCarryWeight) {
      ui.notifications.error("Adding this item would exceed your carry weight limit.");
      return;
    }

    await docCls.create(docData, { parent: this.actor });
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
        const weaponLabel = game.i18n.localize(`TYPES.Item.${item.type}`);
        return this._openCustomRollModal(key, label, skill, weaponLabel, item, versatile);
      //if (item) return item.roll(event, versatile);
    }

    const abilitiesLabel = game.i18n.localize(CONFIG.SDM.abilitiesLabel);

    const ChatLabel = dataset.label ? `[${abilitiesLabel}] ${dataset.label}` : '';

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      return RollHandler.performRoll(this.actor, null, ChatLabel, {
        roll: dataset.roll,
      })
    }

    const rolledFrom = dataset.rollType ?? 'ability';
    const rolledFromlabel = game.i18n.localize(CONFIG.SDM.rollSource[rolledFrom]);

    this._openCustomRollModal(key, label, skill, rolledFromlabel);
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
  _onDragOver(event) { }

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
    if (effect.target === this.actor)
      return this._onSortActiveEffect(event, effect);
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
      if (
        siblingId &&
        parentId &&
        (siblingId !== effect.id || parentId !== effect.parent.id)
      )
        siblings.push(this._getEmbeddedDocument(el));
    }

    // Perform the sort
    const sortUpdates = SortingHelpers.performIntegerSort(effect, {
      target,
      siblings,
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
      await this.actor.items
        .get(itemId)
        .updateEmbeddedDocuments('ActiveEffect', updates);
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

    const isCharacterOrNPC = this.actor.type === 'character' || this.actor.type === 'npc';

    if (isCharacterOrNPC && ITEMS_NOT_ALLOWED_IN_CHARACTERS.includes(item.type)) {
      return false;
    }

    if (item.type === 'mount' || item.type === 'motor') {
      return false;
    }

    // Handle item sorting within the same Actor
    if (this.actor.uuid === item.parent?.uuid)
      return this._onSortItem(event, item);

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
      folder.contents.map(async (item) => {
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
    const maxCarryWeight = this.actor.system.carry_weight.max;

    if (currentCarriedWeight + totalNewWeight > maxCarryWeight) {
      ui.notifications.error("Adding this item would exceed your carry weight limit.");
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
      if (siblingId && siblingId !== item.id)
        siblings.push(items.get(el.dataset.itemId));
    }

    // Perform the sort
    const sortUpdates = SortingHelpers.performIntegerSort(item, {
      target,
      siblings,
    });
    const updateData = sortUpdates.map((u) => {
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
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      };
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this),
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
