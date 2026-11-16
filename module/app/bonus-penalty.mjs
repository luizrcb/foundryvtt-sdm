/**
 * Bonus and Penalty (the book: "the referee assigns a bonus [+] or penalty [-] to d20 rolls when
 * circumstances favor or hinder a PC. The size of the modifier is up to the referee"). Its typical
 * modifiers become one-click buttons under the Modifier of d20 roll dialogs (those whose Modifier
 * input has data-bonus-penalty): +1 / -1 (tiny), +3 / -3 (moderate, a skill's worth), +6 / -6 (significant), +1d6 / -1d6 (random, for
 * muddled situations), advantage / disadvantage (the roll mode). A button fills the field (again:
 * clears it); nothing is applied that the dialog doesn't show.
 *
 * Out of range by one zone (or a thrown weapon beyond short), the dialog suggests disadvantage and
 * highlights the penalties: picking -1 / -3 / -6 / -1d6 instead puts the roll mode back to normal.
 */
import { RollMode } from '../helpers/constants.mjs';

const MODIFIERS = [
  { value: '+1', hint: 'SDM.BonusPenalty.TinyHint' },
  { value: '+3', hint: 'SDM.BonusPenalty.ModerateHint' },
  { value: '+6', hint: 'SDM.BonusPenalty.SignificantHint' },
  { value: '+1d6', hint: 'SDM.BonusPenalty.RandomHint' },
  { value: '-1', hint: 'SDM.BonusPenalty.TinyHint', penalty: true },
  { value: '-3', hint: 'SDM.BonusPenalty.ModerateHint', penalty: true },
  { value: '-6', hint: 'SDM.BonusPenalty.SignificantHint', penalty: true },
  { value: '-1d6', hint: 'SDM.BonusPenalty.RandomHint', penalty: true }
];
const MODES = [
  { mode: RollMode.ADVANTAGE, label: 'SDM.BonusPenalty.Advantage', hint: 'SDM.BonusPenalty.AdvantageHint' },
  { mode: RollMode.DISADVANTAGE, label: 'SDM.BonusPenalty.Disadvantage', hint: 'SDM.BonusPenalty.AdvantageHint', penalty: true }
];

const shown = value => value.replace('-', '−');

/** renderDialogV2: the row of buttons, right after the Modifier field. */
export function addBonusPenalty(html) {
  const input = html.querySelector('input[name="modifier"][data-bonus-penalty]');
  if (!input || html.querySelector('.sdm-bonus-penalty')) return;
  const rollMode = html.querySelector('select[name="rollMode"]');
  const hasMode = mode => !!rollMode?.querySelector(`option[value="${mode}"]`);
  const l = key => game.i18n.localize(key);
  const esc = text => foundry.utils.escapeHTML(String(text ?? ''));
  const modifierButton = m =>
    `<button type="button" data-bp-value="${m.value}" class="${m.penalty ? 'penalty' : 'bonus'}" data-tooltip="${esc(l(m.hint))}">${esc(shown(m.value))}</button>`;
  const modeButton = m =>
    `<button type="button" data-bp-mode="${m.mode}" class="${m.penalty ? 'penalty' : 'bonus'}" data-tooltip="${esc(l(m.hint))}">${esc(l(m.label))}</button>`;
  // Two lines: bonuses and advantage, penalties and disadvantage
  const line = penalty =>
    `<div class="sdm-bp-line">${[
      ...MODIFIERS.filter(m => !!m.penalty === penalty).map(modifierButton),
      ...MODES.filter(m => !!m.penalty === penalty && hasMode(m.mode)).map(modeButton)
    ].join('')}</div>`;
  const buttons = line(false) + line(true);
  const row = document.createElement('div');
  row.className = 'form-group mt-10 sdm-bonus-penalty';
  row.innerHTML = `<label data-tooltip="${esc(l('SDM.BonusPenalty.Hint'))}">${esc(l('SDM.BonusPenalty.Label'))}</label>
    <div class="sdm-bp-buttons">${buttons}</div>
    <p class="sdm-bp-range hint" hidden><i class="fa-solid fa-triangle-exclamation"></i> ${esc(l('SDM.BonusPenalty.RangeHint'))}</p>`;
  (input.closest('.form-group') ?? input).after(row);

  const changed = element => element?.dispatchEvent(new Event('change', { bubbles: true }));
  const refresh = () => {
    const value = input.value.trim();
    row.querySelectorAll('[data-bp-value]').forEach(b => b.classList.toggle('active', b.dataset.bpValue === value));
    row.querySelectorAll('[data-bp-mode]').forEach(b => b.classList.toggle('active', rollMode?.value === b.dataset.bpMode));
  };
  row.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    event.preventDefault();
    if (button.dataset.bpValue) {
      const value = button.dataset.bpValue;
      input.value = input.value.trim() === value ? '' : value;
      // Range penalty: a modifier picked instead of the suggested disadvantage
      if (input.value && button.classList.contains('penalty') && row.classList.contains('range-penalty')) {
        if (rollMode?.value === RollMode.DISADVANTAGE) {
          rollMode.value = RollMode.NORMAL;
          changed(rollMode);
        }
      }
      changed(input);
    } else if (button.dataset.bpMode && rollMode) {
      rollMode.value = rollMode.value === button.dataset.bpMode ? RollMode.NORMAL : button.dataset.bpMode;
      changed(rollMode);
    }
    refresh();
  });
  // The roll mode also changes from code (choosing another With item re-suggests it): markRangePenalty refreshes too
  row.sdmRefresh = refresh;
  input.addEventListener('input', refresh);
  rollMode?.addEventListener('change', refresh);
  refresh();
}

/**
 * After the roll preview updates: the Roll buttons warn (icon and a line above them) when the target
 * can't be reached as it is — two or more zones beyond the item's range, or a melee attack beyond
 * close. They still work: the Referee may allow it.
 */
function markUnreachable(html) {
  const unreachable = !!html.querySelector('.sdm-range-row.unreachable');
  const footer = html.querySelector('.form-footer');
  if (!footer) return;
  footer.querySelectorAll('button').forEach(button => {
    button.classList.toggle('sdm-unreachable', unreachable);
    let icon = button.querySelector('.sdm-unreachable-icon');
    if (unreachable && !icon) {
      icon = document.createElement('i');
      icon.className = 'fa-solid fa-triangle-exclamation sdm-unreachable-icon';
      button.prepend(icon);
    } else if (!unreachable) icon?.remove();
    // Keep a tooltip the button had of its own
    if (unreachable) {
      if (!('sdmTooltip' in button.dataset)) button.dataset.sdmTooltip = button.dataset.tooltip ?? '';
      button.dataset.tooltip = game.i18n.localize('SDM.Zones.UnreachableHint');
    } else if ('sdmTooltip' in button.dataset) {
      if (button.dataset.sdmTooltip) button.dataset.tooltip = button.dataset.sdmTooltip;
      else delete button.dataset.tooltip;
      delete button.dataset.sdmTooltip;
    }
  });
  let note = html.querySelector('.sdm-unreachable-note');
  if (unreachable && !note) {
    note = document.createElement('p');
    note.className = 'sdm-unreachable-note';
    note.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${foundry.utils.escapeHTML(game.i18n.localize('SDM.Zones.UnreachableNote'))}`;
    footer.before(note);
  } else if (!unreachable) note?.remove();
}

/** After the roll preview updates: highlight the penalties when the range suggests one. */
export function markRangePenalty(html) {
  markUnreachable(html);
  const row = html.querySelector('.sdm-bonus-penalty');
  if (!row) return;
  const penalty = !!html.querySelector('.sdm-range-row.penalty');
  row.classList.toggle('range-penalty', penalty);
  const hint = row.querySelector('.sdm-bp-range');
  if (hint) hint.hidden = !penalty;
  row.sdmRefresh?.();
}
