import { SdmCaravanSheet } from './caravan-sheet.mjs';
import { templatePath } from '../helpers/templates.mjs';

/**
 * Alternative caravan sheet (same look as the new actor and item sheets).
 * Shares all behavior with SdmCaravanSheet, including the compact mode toggle;
 * only the header, notes and biography templates differ, the other tabs are restyled.
 */
export class SdmCaravanSheetV2 extends SdmCaravanSheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['sheet-v2']
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
    }
  };
}
