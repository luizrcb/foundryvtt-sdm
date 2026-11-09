import { SdmItemSheet } from './item-sheet.mjs';
import { templatePath } from '../helpers/templates.mjs';
import { GearType, ItemType } from '../helpers/constants.mjs';

const FEATURE_VALUE_FIELDS = ['area', 'range', 'flare', 'pocket', 'replenish', 'resistant'];

/**
 * Alternative item sheet (same look as the new actor sheets).
 * Shares all behavior with SdmItemSheet; only the header and description templates differ.
 */
export class SdmItemSheetV2 extends SdmItemSheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['sheet-v2'],
    position: {
      width: 640,
      height: 760
    }
  };

  /** @override */
  static PARTS = {
    ...SdmItemSheet.PARTS,
    header: {
      template: templatePath('item/v2/header'),
      scrollable: ['']
    },
    description: {
      template: templatePath('item/v2/description'),
      scrollable: ['']
    },
    gmNotes: {
      template: templatePath('item/v2/gm-notes'),
      scrollable: ['']
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const system = item.system;
    const features = system.features ?? new Set();
    const has = key => (typeof features.has === 'function' ? features.has(key) : false);
    const type = system.type ?? '';
    const isGear = item.type === ItemType.GEAR;
    const isCash = system.size?.unit === 'cash';
    const nonEquipment = [
      GearType.CORRUPTION,
      GearType.AFFLICTION,
      GearType.PET,
      GearType.AUGMENT,
      GearType.CONTAINER
    ].includes(type);

    const showCharges =
      isGear &&
      !isCash &&
      ![GearType.CORRUPTION, GearType.AFFLICTION].includes(type) &&
      has('charges');

    context.v2 = {
      showReadied: isGear && !nonEquipment && !isCash,
      showHallmarkToggle:
        (isGear && !nonEquipment && !isCash) || (item.type === ItemType.TRAIT && type === 'power'),
      isWeapon: isGear && (type === GearType.WEAPON || has('weapon')),
      isArmor: isGear && (type === GearType.ARMOR || has('armor')),
      isWard: isGear && (type === GearType.WARD || has('ward')),
      // Installed mods are hidden only for a weapon that also has the weapon feature (classic behavior)
      showMods: isGear && !(type === GearType.WEAPON && has('weapon')),
      hasFeatureFields: isGear && (showCharges || FEATURE_VALUE_FIELDS.some(has))
    };

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const grid = this.element.querySelector('.v2-item-cards');
    if (!grid) return;
    this._fillCardRows(grid);
    // Column count changes with the window width
    this._cardsObserver?.disconnect();
    this._cardsObserver = new ResizeObserver(() => this._fillCardRows(grid));
    this._cardsObserver.observe(grid);
  }

  _onClose(options) {
    this._cardsObserver?.disconnect();
    this._cardsObserver = null;
    return super._onClose(options);
  }

  /**
   * Avoid holes in the card grid: the last card of an incomplete row
   * stretches over the empty columns. Cards in the same row share its height.
   */
  _fillCardRows(grid) {
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
    const cards = [...grid.children].filter(el => el.classList.contains('v2-item-card'));
    let col = 0;
    cards.forEach((card, index) => {
      if (card.classList.contains('is-wide')) {
        col = 0;
        return;
      }
      card.style.gridColumn = '';
      col += 1;
      const next = cards[index + 1];
      const rowEnds = !next || next.classList.contains('is-wide') || col === columns;
      if (rowEnds) {
        if (col < columns) card.style.gridColumn = `span ${columns - col + 1}`;
        col = 0;
      }
    });
  }
}
