/**
 * Pieces of the chat cards (attack, damage, power, save, hero dice, defeat…), one look for all:
 *  - a title with an icon and chips (ability, skill, roll mode, boosts…) instead of a bracket line;
 *  - a roll box: the total large, the formula and the dice faces next to it (dropped dice faded,
 *    a die's maximum marked); click shows Foundry's roll tooltip as before;
 *  - a result strip: who or what the roll is against, and the outcome (HIT / MISS / SAVED…) on the
 *    right with its margin, its left edge colored by tone (good, bad, crit, mid);
 *  - tags for notes (last ammo, cost paid, what a trigger did), and a footer (hero dice).
 * Returns HTML strings; the card is wrapped in `.sdm-card` so the styles don't leak.
 */

const esc = text => foundry.utils.escapeHTML(String(text ?? ''));

/** The card's outer box: `.sdm-card` (with a tone class for the whole card when given). */
export function cardWrap(inner, { kind = '' } = {}) {
  return `<div class="sdm-card${kind ? ` sdm-card-${kind}` : ''}">${inner}</div>`;
}

/**
 * Title line with an icon, and chips under it. chips: [{ text, color?, tooltip? }] or strings;
 * color is an ability color class (rust, amber…) or a tone.
 */
export function cardHeader({ icon = '', color = '', title = '', badge = '', chips = [] } = {}) {
  const chipHtml = (chips ?? [])
    .filter(Boolean)
    .map(chip => (typeof chip === 'string' ? { text: chip } : chip))
    .filter(chip => chip.text !== '' && chip.text !== null && chip.text !== undefined)
    .map(
      chip =>
        `<span class="sdm-chip${chip.color ? ` sdm-chip-${esc(chip.color)}` : ''}"${chip.tooltip ? ` data-tooltip="${esc(chip.tooltip)}"` : ''}>${esc(chip.text)}</span>`
    )
    .join('');
  return (
    `<div class="sdm-card-title">${icon ? `<i class="${esc(icon)} ${esc(color)}"></i>` : ''}<span>${esc(title)}</span>` +
    `${badge ? `<span class="sdm-card-badge">${esc(badge)}</span>` : ''}</div>` +
    (chipHtml ? `<div class="sdm-card-chips">${chipHtml}</div>` : '')
  );
}

/** Dice faces of a roll: every die result, dropped ones faded, a maximum marked. */
function diceFaces(roll) {
  const faces = [];
  for (const die of roll?.dice ?? []) {
    for (const result of die.results ?? []) {
      if (result.rerolled) continue;
      const classes = ['sdm-die'];
      if (result.discarded || result.active === false) classes.push('dropped');
      if (result.result === die.faces && die.faces > 1) classes.push('max');
      if (die.faces === 20 && result.result === 1) classes.push('min');
      faces.push(`<span class="${classes.join(' ')}" data-faces="${die.faces}">${esc(result.result)}</span>`);
      if (faces.length >= 12) break;
    }
  }
  return faces.join('');
}

/**
 * The roll: total, formula, dice. `tone` colors the total (crit, fumble, force…). The roll's own
 * tooltip is kept (hidden) so clicking the box expands it, like Foundry's cards.
 */
export async function rollBox(roll, { tone = '', formula = null, note = '' } = {}) {
  const tooltip = roll ? await roll.getTooltip() : '';
  return (
    `<div class="sdm-roll-box dice-roll" data-action="expandRoll">` +
    `<div class="sdm-roll-total ${esc(tone)}">${esc(roll?.total ?? '')}</div>` +
    `<div class="sdm-roll-detail"><div class="sdm-roll-formula">${esc(formula ?? roll?.formula ?? '')}</div>` +
    `<div class="sdm-roll-dice">${diceFaces(roll)}${note ? `<span class="sdm-roll-note">${esc(note)}</span>` : ''}</div></div>` +
    `<div class="dice-tooltip sdm-roll-tooltip">${tooltip}</div>` +
    `</div>`
  );
}

/**
 * The outcome strip. tone: good | bad | crit | mid. who: { name, img } (a target) or a title line;
 * sub: a second line (defense, save target, what it's against); outcome: the big word; margin: small.
 */
export function resultStrip({ tone = 'good', img = '', name = '', sub = '', outcome = '', margin = '', outcomeHtml = '' } = {}) {
  return (
    `<div class="sdm-result-strip ${esc(tone)}">` +
    (img ? `<img class="sdm-result-img" src="${esc(img)}" alt="" />` : '') +
    `<div class="sdm-result-who"><b>${esc(name)}</b>${sub ? `<span>${sub}</span>` : ''}</div>` +
    `<div class="sdm-result-word${String(outcome).length > 12 ? ' long' : ''}">${outcomeHtml || esc(outcome)}${margin ? `<small>${esc(margin)}</small>` : ''}</div>` +
    `</div>`
  );
}

/** A note tag: tone warn (amber), info (blue), good, bad. */
export function cardTag(text, { tone = 'warn', icon = '' } = {}) {
  return `<div class="sdm-card-tag ${esc(tone)}">${icon ? `<i class="${esc(icon)}"></i> ` : ''}${esc(text)}</div>`;
}

/** Margin text: "by 8". */
export function marginText(amount) {
  const n = Math.abs(Number(amount) || 0);
  return game.i18n.format('SDM.Card.By', { amount: n });
}
