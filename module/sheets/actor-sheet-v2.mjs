import { SdmActorSheet } from './actor-sheet.mjs';
import { templatePath } from '../helpers/templates.mjs';

const COMPACT_WIDTH = 720;
const EXPANDED_WIDTH = 1440;

/**
 * Alternative character sheet ("Vastlands" layout).
 * Shares all behavior with SdmActorSheet; only templates and styles differ.
 * Layout adapts to the window width through container queries.
 */
export class SdmActorSheetV2 extends SdmActorSheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['sheet-v2'],
    position: {
      width: COMPACT_WIDTH,
      height: 900
    },
    actions: {
      toggleCompact: SdmActorSheetV2._onToggleCompactV2
    }
  };

  /** @override */
  static PARTS = {
    ...SdmActorSheet.PARTS,
    header: {
      template: templatePath('actor/v2/header')
    },
    biography: {
      template: templatePath('actor/v2/biography'),
      scrollable: ['']
    },
    inventory: {
      template: templatePath('actor/v2/inventory'),
      // Each column scrolls on its own; keep their positions across re-renders
      scrollable: ['.v2-col-items .items-list', '.v2-col-traits .items-list', '.v2-col-burdens .items-list']
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;

    const pct = (value, max) => {
      const v = Number(value) || 0;
      const m = Number(max) || 0;
      if (m <= 0) return 0;
      return Math.max(0, Math.min(100, Math.round((v / m) * 100)));
    };

    const meter = (taken, max) => {
      const used = Math.ceil(Number(taken) || 0);
      const size = Math.max(Number(max) || 0, 0);
      return {
        segments: Array.from({ length: size }, (_, i) => ({ on: i < used })),
        over: used > size,
        label: `${Number(taken) || 0}/${size}`
      };
    };

    context.v2 = {
      itemsMeter: meter(context.itemSlotsTaken, system.item_slots),
      traitsMeter: meter(context.traitSlotsTaken, system.trait_slots),
      lifePct: pct(system.life?.value, context.isEditMode ? system.life?.base : system.life?.max),
      heroDiceSpent: (Number(system.hero_dice?.value) || 0) <= 0,
      hasBurdens: (context.burdens?.length ?? 0) > 0
    };

    return context;
  }

  /**
   * In this sheet the compact button switches between the compact and the expanded width.
   * @this {SdmActorSheetV2}
   */
  static async _onToggleCompactV2(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) return;

    const isWide = (this.position?.width ?? COMPACT_WIDTH) > (COMPACT_WIDTH + EXPANDED_WIDTH) / 2;
    this.setPosition({ width: isWide ? COMPACT_WIDTH : EXPANDED_WIDTH });
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    // The legacy compact class changes window size limits; this sheet adapts by width instead.
    this.element.classList.remove('compact');
  }
}
