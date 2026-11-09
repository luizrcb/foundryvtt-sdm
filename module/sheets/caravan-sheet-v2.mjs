import { SdmCaravanSheet } from './caravan-sheet.mjs';
import { templatePath } from '../helpers/templates.mjs';

const COMPACT_WIDTH = 760;
const EXPANDED_WIDTH = 1400;
/** Below this window width the sheet uses its narrow layout (icon tabs, fewer columns). */
const NARROW_BREAKPOINT = 1100;

/**
 * Alternative caravan sheet (same look as the new actor and item sheets).
 * Shares all behavior with SdmCaravanSheet. The narrow/wide layout follows the
 * window width (like the character sheet V2) instead of the saved compact flag;
 * the compact button switches between the two widths.
 */
export class SdmCaravanSheetV2 extends SdmCaravanSheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['sheet-v2'],
    position: {
      width: COMPACT_WIDTH,
      height: 900
    },
    actions: {
      toggleCompact: SdmCaravanSheetV2._onToggleCompactV2
    }
  };

  /** @override */
  static PARTS = {
    ...SdmCaravanSheet.PARTS,
    header: {
      template: templatePath('actor/v2/caravan-header')
    },
    notes: {
      template: templatePath('actor/v2/notes'),
      scrollable: ['']
    },
    biography: {
      template: templatePath('actor/v2/biography'),
      scrollable: ['']
    },
    crew: {
      template: templatePath('actor/v2/caravan-crew'),
      scrollable: ['']
    },
    routes: {
      template: templatePath('actor/v2/caravan-routes'),
      scrollable: ['']
    }
  };

  /** Narrow layout state of the last render. */
  #narrow = null;

  get isNarrow() {
    return (this.position?.width ?? COMPACT_WIDTH) < NARROW_BREAKPOINT;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.isCompactMode = this.isNarrow;
    return context;
  }

  /**
   * Tabs always carry their label; CSS hides it in the narrow layout and the
   * tooltip shows it instead.
   * @override
   */
  _getTabs(parts) {
    const tabs = super._getTabs(parts);
    const narrow = this.isNarrow;
    for (const tab of Object.values(tabs)) {
      if (!tab.label && tab.tooltip) tab.label = tab.tooltip;
      tab.tooltip = narrow ? tab.label : null;
    }
    return tabs;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    // The legacy compact class changes window size limits; this sheet adapts by width instead.
    this.element.classList.remove('compact');
    this.#narrow = this.isNarrow;
    this.element.classList.toggle('is-narrow', this.#narrow);
  }

  /** Re-render when a resize crosses the narrow/wide breakpoint. @override */
  _onPosition(position) {
    super._onPosition?.(position);
    if (!this.rendered || this.#narrow === null) return;
    if (this.isNarrow !== this.#narrow) {
      this.#narrow = this.isNarrow;
      this.element.classList.toggle('is-narrow', this.#narrow);
      this.render();
    }
  }

  /**
   * The compact button switches between the compact and the expanded width.
   * @this {SdmCaravanSheetV2}
   */
  static async _onToggleCompactV2(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return;
    this.setPosition({ width: this.isNarrow ? EXPANDED_WIDTH : COMPACT_WIDTH });
  }
}
