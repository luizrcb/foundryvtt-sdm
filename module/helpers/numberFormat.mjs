/**
 * Locale-aware thousands separators for numeric inputs on sheets.
 *
 * Inputs show grouped numbers (1.000 in pt-BR, 1,000 in English) while they
 * are not focused. On focus they switch to the plain number, so editing works
 * as before, and before every form submission all of them are switched back
 * to plain numbers so Foundry parses the real values.
 */

const RAW = 'sdmRawNumber';
const BOUND = 'sdmNumberBound';
const NUMERIC = /^-?\d+(\.\d+)?$/;

let cachedLocale = null;
let display = null;
let editing = null;
let groupSep = ',';
let decimalSep = '.';

function setupLocale() {
  const locale = game.i18n?.lang || 'en';
  if (locale === cachedLocale) return;
  cachedLocale = locale;
  display = new Intl.NumberFormat(locale, { maximumFractionDigits: 20 });
  editing = new Intl.NumberFormat(locale, { maximumFractionDigits: 20, useGrouping: false });
  const parts = display.formatToParts(11111.1);
  groupSep = parts.find(p => p.type === 'group')?.value ?? ',';
  decimalSep = parts.find(p => p.type === 'decimal')?.value ?? '.';
}

/** Parse a number typed in the current locale (accepts grouping). Returns null if not a number. */
function parseLocaleNumber(text) {
  setupLocale();
  let s = String(text ?? '').trim();
  if (s === '') return null;
  s = s
    .split(groupSep)
    .join('')
    .replace(/[\s  ]/g, '');
  if (decimalSep !== '.') s = s.split(decimalSep).join('.');
  return NUMERIC.test(s) ? s : null;
}

function isNumberField(input, doc) {
  if (input.type !== 'text') return false;
  if (input.dataset.dtype === 'Number') return true;
  const name = input.name;
  if (!name || !doc) return false;
  try {
    const field = name.startsWith('system.')
      ? doc.system?.schema?.getField(name.slice(7))
      : doc.schema?.getField(name);
    return field instanceof foundry.data.fields.NumberField;
  } catch {
    return false;
  }
}

function showGrouped(input) {
  const raw = input.dataset[RAW];
  if (raw === undefined || raw === '') return;
  input.value = display.format(Number(raw));
}

function showPlain(input) {
  const raw = input.dataset[RAW];
  if (raw === undefined || raw === '') return;
  input.value = editing.format(Number(raw));
}

/**
 * Format numeric inputs inside `root` and wire focus/change/blur handlers.
 * @param {HTMLElement} root
 * @param {foundry.abstract.Document} doc
 */
export function bindNumberInputs(root, doc) {
  if (!root) return;
  setupLocale();
  for (const input of root.querySelectorAll('input[type="text"][name]')) {
    if (!isNumberField(input, doc)) continue;
    const raw = String(input.value ?? '').trim();
    if (!NUMERIC.test(raw)) continue;

    input.dataset[RAW] = raw;
    if (globalThis.document?.activeElement !== input) showGrouped(input);

    if (input.dataset[BOUND]) continue;
    input.dataset[BOUND] = '1';

    input.addEventListener('focus', () => showPlain(input));
    // Runs on the input before the form's change handler submits
    input.addEventListener('change', () => {
      const parsed = parseLocaleNumber(input.value);
      if (parsed === null) return;
      input.dataset[RAW] = parsed;
      input.value = parsed;
    });
    input.addEventListener('blur', () => {
      const parsed = parseLocaleNumber(input.value);
      if (parsed !== null) input.dataset[RAW] = parsed;
      showGrouped(input);
    });
  }
}

/** Put plain numbers back into every formatted input (before reading the form). */
export function unformatNumberInputs(root) {
  if (!root) return;
  for (const input of root.querySelectorAll('input[type="text"][name]')) {
    const raw = input.dataset[RAW];
    if (raw === undefined || raw === '') continue;
    // Keep what the user is typing in the focused field
    if (globalThis.document?.activeElement === input) {
      const parsed = parseLocaleNumber(input.value);
      if (parsed !== null) input.value = parsed;
      continue;
    }
    input.value = raw;
  }
}

/** Re-apply grouping to every formatted input that is not focused. */
export function reformatNumberInputs(root) {
  if (!root) return;
  setupLocale();
  for (const input of root.querySelectorAll('input[type="text"][name]')) {
    if (input.dataset[RAW] === undefined) continue;
    if (globalThis.document?.activeElement === input) continue;
    showGrouped(input);
  }
}
