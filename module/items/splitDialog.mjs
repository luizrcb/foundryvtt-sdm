// helpers/splitDialog.mjs

import { $fmt, $l10n } from "../helpers/globalUtils.mjs";

/**
 * Prompt the user to choose how to split a stack into two parts.
 * The chosen value is how many units remain on the ORIGINAL item.
 *
 * @param {Item} item                 Embedded item to split (must have quantity > 1).
 * @param {object} [opts]
 * @param {number} [opts.initial]     Initial slider position; defaults to floor(qty/2).
 * @returns {Promise<number|null>}    The chosen firstQty (1..qty-1), or null if cancelled.
 */
export async function promptSplitStackFirstQty(item, opts = {}) {
  if (!item?.parent) {
    ui.notifications.warn($l10n('SDM.ErrorNoParentActor') || 'No parent actor.');
    return null;
  }

  const qty = Number(item.system?.quantity ?? 1) || 1;
  if (qty <= 1) {
    ui.notifications.warn(
      $l10n('SDM.ErrorQuantityTooLow') || 'Quantity must be greater than 1.'
    );
    return null;
  }

  const min = 1;
  const max = qty - 1;
  const initial = Math.min(max, Math.max(min, Number(opts.initial ?? Math.floor(qty / 2))));

  const title = $fmt('SDM.SplitStackTitle', { item: item.name }) || `Split “${item.name}” (${qty})`;

  // Simple form: slider + numeric input + live preview (original/new)
  const content = `
    <form class="sdm-split-stack-form">
      <fieldset>
        <legend>${$fmt('SDM.SplitStackIntoTwo', { quantity: item.system.quantity, item: item.name }) || 'Split into two stacks'}</legend>

        <div class="form-group">
          <label>
            ${$l10n('SDM.OriginalKeeps') || 'Original keeps'}
            <input type="number" name="firstQtyNumber" min="${min}" max="${max}" step="1" value="${initial}" style="width: 6rem; margin-left: 0.5rem;" />
          </label>
        </div>

        <div class="form-group">
          <input type="range" name="firstQty" min="${min}" max="${max}" step="1" value="${initial}" />
        </div>

        <div class="form-group">
          <label>
            ${$l10n('SDM.NewStackGets') || 'New stack gets'}:
            <b id="sdm-split-new-qty">${qty - initial}</b>
          </label>
        </div>

        <p style="margin-top: 0.5rem;">
          ${$l10n('SDM.SplitHint') || 'Drag the slider or type a number. Totals must add up to the original quantity.'}
        </p>
      </fieldset>
    </form>
  `;

  const data = await foundry.applications.api.DialogV2.prompt({
    window: { title, resizable: false },
    content,
    modal: true,
    ok: {
      icon: 'fa-solid fa-scissors',
      label: $l10n('SDM.Split') || 'Split',
      callback: (event, button) => {
        const formObj = new foundry.applications.ux.FormDataExtended(button.form).object;
        // Prefer the range value (always present), clamp for safety
        const v = Number(formObj.firstQty ?? initial);
        return Math.min(max, Math.max(min, isNaN(v) ? initial : v));
      }
    },
    rejectClose: false,
    buttons: [
      {
        action: 'cancel',
        label: $l10n('SDM.BackgroundCancel') || 'Cancel'
      }
    ],
    render: (_ev, dialog) => {
      const root = dialog.element instanceof HTMLElement ? dialog.element : dialog.element?.[0];
      if (!root) return;

      const range = root.querySelector('input[name="firstQty"]');
      const number = root.querySelector('input[name="firstQtyNumber"]');
      const newQtyB = root.querySelector('#sdm-split-new-qty');

      const syncFrom = src => {
        const val = Math.min(max, Math.max(min, Number(src.value) || initial));
        if (src === range && number) number.value = String(val);
        if (src === number && range) range.value = String(val);
        if (newQtyB) newQtyB.textContent = String(qty - val);
      };

      range?.addEventListener('input', () => syncFrom(range));
      number?.addEventListener('input', () => syncFrom(number));

      // initial sync
      syncFrom(range || number);
    }
  });

  // data is either the chosen number or undefined (if canceled)
  return Number.isFinite(data) ? Number(data) : null;
}
