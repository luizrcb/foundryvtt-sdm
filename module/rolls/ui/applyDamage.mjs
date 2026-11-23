/**
 * Damage card: apply the damage to the selected tokens in one click — full, half (rounded up),
 * double, or as healing. The same as the card's right-click menu.
 */
import { changeLifeOf } from '../../app/use-item.mjs';

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

/**
 * Any other roll in the chat (/r 1d6, /r 3, a module's roll…): the same apply buttons, for whoever
 * rolled and the Referee. The system's own cards (.sdm-card) decide their buttons themselves.
 */
export function addApplyToPlainRolls(message, html) {
  if (!message.rolls?.length || !message.isContentVisible) return;
  if (!(message.isAuthor || game.user.isGM)) return;
  if (html.querySelector('.sdm-card, .sdm-apply-damage')) return;
  const total = Math.round(Number(message.rolls[0]?.total) || 0);
  const buttons = applyDamageHtml(total).replace('class="sdm-apply-damage"', 'class="sdm-apply-damage sdm-apply-plain"');
  if (!buttons) return;
  // Right under the roll (above the hero dice button), as on the system's cards
  const rolls = html.querySelectorAll('.message-content .dice-roll');
  const last = rolls[rolls.length - 1];
  if (last) last.insertAdjacentHTML('afterend', buttons);
  else (html.querySelector('.message-content') ?? html).insertAdjacentHTML('beforeend', buttons);
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

/** An undone line: what it did, struck through, then "· Undone" (the button goes). */
function markUndone(line) {
  line.querySelector('button')?.remove();
  const icon = line.querySelector('i');
  const text = line.textContent.trim();
  line.classList.add('undone');
  line.textContent = '';
  if (icon) line.append(icon, ' ');
  const struck = document.createElement('s');
  struck.textContent = text;
  line.append(struck, ` · ${game.i18n.localize('SDM.Card.UndoneShort')}`);
}

/**
 * Damage applied automatically (setting): its Undo gives the life back, for the one who rolled and
 * the Referee only; once used, the card says so.
 */
export function bindUndoDamage(message, html) {
  const line = html.querySelector('.sdm-auto-damage');
  if (!line) return;
  const button = line.querySelector('[data-action="sdmUndoDamage"]');
  const target = fromUuidSync(line.dataset.targetUuid);
  const amount = Number(line.dataset.amount) || 0;
  // A hero dice correction that gave life back (lower total): its undo takes it again
  const gaveBack = line.dataset.heal === '1';
  if (message.getFlag('sdm', 'damageUndone')) {
    markUndone(line);
    return;
  }
  const allowed = game.user.isGM || message.author?.id === game.user.id;
  if (!allowed || !target) {
    button?.remove();
    return;
  }
  button?.addEventListener('click', async event => {
    event.preventDefault();
    button.disabled = true;
    if (await changeLifeOf(target, amount, { heal: !gaveBack, reason: gaveBack ? 'FixUndone' : 'DamageUndone' })) await message.setFlag('sdm', 'damageUndone', true);
    else button.disabled = false;
  });
}

/**
 * Hero dice rolled for healing (from the sheet): Heal heals the roller (its owner or the Referee
 * click it); once healed, the card says so and the Referee can undo it.
 */
export function bindHeroHeal(message, html) {
  const box = html.querySelector('.sdm-hero-heal');
  if (!box) return;
  const actor = fromUuidSync(box.dataset.actorUuid);
  const amount = Number(box.dataset.amount) || 0;
  const healed = message.getFlag('sdm', 'heroHealed');
  if (healed) {
    const undone = message.getFlag('sdm', 'heroHealUndone');
    const line = document.createElement('div');
    line.className = 'sdm-card-tag good sdm-hero-healed';
    line.innerHTML = `<i class="fa-solid fa-heart"></i> `;
    line.append(game.i18n.format('SDM.Card.Healed', { amount, actor: actor?.name ?? '?' }));
    if (undone) markUndone(line);
    if (!undone && game.user.isGM && actor) {
      const undo = document.createElement('button');
      undo.type = 'button';
      undo.innerHTML = `<i class="fa-solid fa-rotate-left"></i> ${foundry.utils.escapeHTML(game.i18n.localize('SDM.Card.Undo'))}`;
      undo.addEventListener('click', async event => {
        event.preventDefault();
        undo.disabled = true;
        if (await changeLifeOf(actor, amount, { reason: 'HealUndone' })) await message.setFlag('sdm', 'heroHealUndone', true);
        else undo.disabled = false;
      });
      line.append(undo);
    }
    box.replaceWith(line);
    return;
  }
  const button = box.querySelector('[data-action="sdmHeroHeal"]');
  if (!actor || !(game.user.isGM || actor.isOwner)) {
    box.remove();
    return;
  }
  button?.addEventListener('click', async event => {
    event.preventDefault();
    button.disabled = true;
    if (!(await changeLifeOf(actor, amount, { heal: true }))) {
      button.disabled = false;
      return;
    }
    // The message is the roller's: they (or the Referee) mark it healed; another owner just heals
    if (message.isOwner) await message.setFlag('sdm', 'heroHealed', true);
  });
}

/**
 * The system's cards say who can see them: blind (only the Referee sees the result), Referee only
 * (whispered to the Referees), or private (whispered to others). Public cards show nothing.
 */
export function addVisibilityLabel(message, html) {
  if (!html.querySelector('.sdm-card') || html.querySelector('.sdm-visibility')) return;
  const whisper = message.whisper ?? [];
  let kind = '';
  if (message.blind) kind = 'blind';
  else if (whisper.length && whisper.every(id => game.users.get(id)?.isGM)) kind = 'gm';
  else if (whisper.length) kind = 'private';
  if (!kind) return;
  const label = document.createElement('span');
  label.className = `sdm-visibility sdm-visibility-${kind}`;
  label.dataset.tooltip = game.i18n.localize(`SDM.Card.Visibility.${kind}Hint`);
  label.innerHTML = `<i class="fa-solid ${kind === 'blind' ? 'fa-eye-slash' : 'fa-user-secret'}"></i> ${esc(game.i18n.localize(`SDM.Card.Visibility.${kind}`))}`;
  const title = html.querySelector('.sdm-card .sdm-card-title');
  if (title) title.append(label);
}
