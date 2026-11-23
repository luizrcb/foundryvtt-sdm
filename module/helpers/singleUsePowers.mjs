import { $fmt, $l10n } from './globalUtils.mjs';

/**
 * Single-use powers (e.g. caught from someone else's casting) are removed after they are used,
 * once the user confirms: an album's power leaves the album, a power item is deleted.
 * Caught powers: the chat card of a cast power can be dragged into an album (it arrives single use).
 */

const { DialogV2 } = foundry.applications.api;
const esc = text => foundry.utils.escapeHTML?.(String(text ?? '')) ?? String(text ?? '');

async function confirmRemoval(power, from) {
  return DialogV2.confirm({
    window: { title: $l10n('SDM.SingleUse.Title'), icon: 'fa-solid fa-hourglass-end' },
    content: `<p>${$fmt('SDM.SingleUse.Confirm', { power: esc(power), from: esc(from) })}</p>`,
    rejectClose: false
  });
}

/** After a power is cast from an album (powerIndex) or from a power item. */
export async function consumeSingleUsePower(item, powerIndex = null) {
  if (!item?.isOwner) return;
  if (powerIndex !== null && powerIndex !== undefined) {
    const powers = foundry.utils.duplicate(item._source?.system?.powers ?? []);
    const power = powers[powerIndex];
    if (!power?.single_use) return;
    if (!(await confirmRemoval(power.name, item.name))) return;
    powers.splice(powerIndex, 1);
    const current = Math.min(item.system.powers_current_index || 0, Math.max(powers.length - 1, 0));
    await item.update({ 'system.powers': powers, 'system.powers_current_index': current });
    return;
  }
  if (!item.system?.power?.single_use || !item.id || !item.parent) return;
  if (!(await confirmRemoval(item.name, item.parent.name))) return;
  await item.delete();
}

/** The power item data a chat card carries, to catch it by dragging the card into an album. */
export function powerCardData(item) {
  if (item?.system?.type !== 'power') return null;
  const data = item.toObject();
  for (const key of ['_id', 'folder', 'ownership', 'sort', '_stats']) delete data[key];
  data.effects = [];
  return data;
}

/** Cards of a single-use power (cast, or an attack made with it) show a mark on the title line. */
export function addSingleUseMark(message, html) {
  const single = message.getFlag?.('sdm', 'singleUse') || message.getFlag?.('sdm', 'power')?.system?.power?.single_use;
  if (!single || html.querySelector('.sdm-single-use-mark')) return;
  const mark = document.createElement('span');
  mark.className = 'sdm-single-use-mark';
  mark.dataset.tooltip = $l10n('SDM.SingleUse.Label');
  mark.innerHTML = '<i class="fa-solid fa-hourglass-end"></i>';
  const target = html.querySelector('.sdm-card .sdm-card-title') ?? html.querySelector('.message-header .flavor-text');
  if (target) target.append(mark);
}

/** Chat cards of cast powers get a handle: drag it into an album to catch the power. */
export function addCatchHandle(message, html) {
  const power = message.getFlag?.('sdm', 'power');
  if (!power || html.querySelector('.sdm-catch-power')) return;
  const handle = document.createElement('a');
  handle.className = 'sdm-catch-power';
  handle.draggable = true;
  handle.dataset.tooltip = $l10n('SDM.SingleUse.CatchHint');
  handle.innerHTML = `<i class="fa-solid fa-hand-sparkles"></i> ${$l10n('SDM.SingleUse.Catch')}`;
  handle.addEventListener('dragstart', event => {
    const data = foundry.utils.duplicate(power);
    foundry.utils.setProperty(data, 'system.power.single_use', true);
    event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'Item', data, sdmCaught: true }));
  });
  // New cards: at the end of the title line (the footer has no room beside the hero dice)
  const cardTitle = html.querySelector('.sdm-card .sdm-card-title');
  if (cardTitle) {
    cardTitle.append(handle);
    return;
  }
  // On the flavor line ("[Power] … (cost: N)") so it never squeezes the card or the roll;
  // without a flavor, on a line of its own above the content
  const flavor = html.querySelector('.message-header .flavor-text');
  if (flavor) {
    flavor.classList.add('sdm-has-catch');
    flavor.append(handle);
    return;
  }
  const row = document.createElement('div');
  row.className = 'sdm-catch-row';
  row.append(handle);
  const content = html.querySelector('.message-content') ?? html;
  content.prepend(row);
}
