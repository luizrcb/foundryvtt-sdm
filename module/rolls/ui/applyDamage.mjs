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
  // One line per target the damage went to (an area: one per token hit), each with its own Undo
  const undoneTargets = message.getFlag('sdm', 'damageUndoneTargets') ?? [];
  for (const line of html.querySelectorAll('.sdm-auto-damage')) {
    const button = line.querySelector('[data-action="sdmUndoDamage"]');
    const target = fromUuidSync(line.dataset.targetUuid);
    const amount = Number(line.dataset.amount) || 0;
    // A hero dice correction that gave life back (lower total): its undo takes it again
    const gaveBack = line.dataset.heal === '1';
    if (message.getFlag('sdm', 'damageUndone') || undoneTargets.includes(line.dataset.targetUuid)) {
      markUndone(line);
      continue;
    }
    const allowed = game.user.isGM || message.author?.id === game.user.id;
    if (!allowed || !target) {
      button?.remove();
      continue;
    }
    button?.addEventListener('click', async event => {
      event.preventDefault();
      button.disabled = true;
      if (await changeLifeOf(target, amount, { heal: !gaveBack, reason: gaveBack ? 'FixUndone' : 'DamageUndone' })) {
        const done = message.getFlag('sdm', 'damageUndoneTargets') ?? [];
        await message.setFlag('sdm', 'damageUndoneTargets', [...done, target.uuid]);
      } else button.disabled = false;
    });
  }
}

/** Area damage with "Apply damage automatically" off: a button per token hit applies its share. */
export function bindAreaApply(message, html) {
  html.querySelectorAll('[data-action="sdmAreaApplyDamage"]').forEach(button =>
    button.addEventListener('click', async event => {
      event.preventDefault();
      const target = fromUuidSync(button.dataset.targetUuid);
      const amount = Number(button.dataset.amount) || 0;
      if (!target || amount <= 0) return;
      button.disabled = true;
      if (!(await changeLifeOf(target, amount))) button.disabled = false;
    })
  );
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
