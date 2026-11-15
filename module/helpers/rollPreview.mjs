/**
 * Roll dialogs: the "Rolls" line(s) at the top, showing what each button rolls with the dialog's
 * current values. The dialog passes `rollPreview: values => rollPreviewRows([...])` in its options;
 * the renderDialogV2 hook (sdm.mjs) adds the box and refreshes it on every change.
 */
const esc = text => foundry.utils.escapeHTML(String(text ?? ''));

/** One row per { label, formula } (rows without a formula are skipped); `data` resolves @ references. */
export function rollPreviewRows(rows, data = {}) {
  return rows
    .filter(row => row?.formula)
    .map(({ label, formula }) => {
      let shown = formula;
      try {
        shown = new Roll(formula, data).formula;
      } catch {
        /* keep the raw formula */
      }
      return `<div class="sdm-roll-preview-row"><span>${esc(label)}</span> <code>${esc(shown)}</code></div>`;
    })
    .join('');
}
