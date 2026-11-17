/**
 * Damage card: apply the damage to the selected tokens in one click — full, half (rounded up),
 * double, or as healing. The same as the card's right-click menu.
 */
const esc = text => foundry.utils.escapeHTML(String(text ?? ''));

export function applyDamageHtml(total) {
  const amount = Number(total) || 0;
  if (amount <= 0) return '';
  const button = (mode, label, tooltip) =>
    `<button type="button" data-action="sdmApplyDamage" data-mode="${mode}" data-amount="${amount}" data-tooltip="${esc(game.i18n.localize(tooltip))}">${esc(label)}</button>`;
  return (
    `<div class="sdm-apply-damage">` +
    button('full', `−${amount}`, 'SDM.ChatContextDamage') +
    button('half', '½', 'SDM.ChatContextHalfDamage') +
    button('double', '×2', 'SDM.ChatContextDoubleDamage') +
    button('heal', `+ ${game.i18n.localize('SDM.Card.Heal')}`, 'SDM.Card.HealHint') +
    `</div>`
  );
}

/** renderChatMessageHTML: the buttons act on the user's selected tokens. */
export function bindApplyDamage(html) {
  html.querySelectorAll('[data-action="sdmApplyDamage"]').forEach(button =>
    button.addEventListener('click', async event => {
      event.preventDefault();
      const tokens = canvas.tokens?.controlled ?? [];
      if (!tokens.length) return ui.notifications.warn(game.i18n.localize('SDM.ChatContextNoTokensSelected'));
      const base = Number(button.dataset.amount) || 0;
      const mode = button.dataset.mode;
      const amount = mode === 'half' ? Math.ceil(base / 2) : mode === 'double' ? base * 2 : base;
      // Healing: a negative multiplier (applyDamage heals with it)
      const multiplier = mode === 'heal' ? -1 : 1;
      await Promise.all(tokens.map(token => token.actor?.applyDamage(amount, multiplier)));
    })
  );
}
