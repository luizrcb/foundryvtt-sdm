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
 * Who a card's apply buttons (and its right-click menu) act on: the user's targeted tokens, else the
 * selected ones.
 */
export function damageTokens() {
  const targeted = [...(game.user.targets ?? [])];
  return targeted.length ? targeted : canvas.tokens?.controlled ?? [];
}

/**
 * Damage (or, multiplier −1, heal) the targeted tokens, else the selected ones. Only tokens the user
 * owns (the Referee: all): the others are left for the Referee, and a warning says how many.
 */
export async function applyToTokens(amount, multiplier = 1) {
  const tokens = damageTokens();
  if (!tokens.length) return ui.notifications.warn(game.i18n.localize('SDM.ChatContextNoTokensSelected'));
  const owned = tokens.filter(token => token.actor?.isOwner);
  const skipped = tokens.length - owned.length;
  if (skipped) ui.notifications.warn(game.i18n.format('SDM.ApplyNotOwned', { count: skipped }));
  await Promise.all(owned.map(token => token.actor.applyDamage(amount, multiplier)));
}

/**
 * Any other roll in the chat (/r 1d6, /r 3, a module's roll…): the same apply buttons, for whoever
 * rolled and the Referee. The system's own cards (.sdm-card) decide their buttons themselves.
 */
export function addApplyToPlainRolls(message, html) {
  if (!message.rolls?.length || !message.isContentVisible) return;
  // Not an initiative roll (nor a hero dice result on one)
  if (message.getFlag('sdm', 'hazardRoll') || message.getFlag('core', 'initiativeRoll') || message.getFlag('sdm', 'initiative') || message.getFlag('sdm', 'heroFlags')?.sdm?.initiative) return;
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

/** renderChatMessageHTML: the buttons act on the targeted tokens, else the selected ones. */
export function bindApplyDamage(html) {
  html.querySelectorAll('[data-action="sdmApplyDamage"]').forEach(button =>
    button.addEventListener('click', async event => {
      event.preventDefault();
      const base = Number(button.dataset.amount) || 0;
      const mode = button.dataset.mode;
      const amount = mode === 'half' ? Math.ceil(base / 2) : mode === 'double' ? base * 2 : base;
      // Healing: a negative multiplier (applyDamage heals with it)
      await applyToTokens(amount, mode === 'heal' ? -1 : 1);
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

/**
 * Area damage with "Apply damage automatically" off: a button per token hit applies its share (or
 * heals it), Apply to all / Heal all everyone not done yet. What was applied stays on the card
 * (flags.sdm.areaApplied) as a line with an Undo. The roller uses them on the tokens they own, the
 * Referee on all ("Apply damage automatically" applies to anyone, through the Referee).
 */
export function bindAreaApply(message, html) {
  const box = html.querySelector('.sdm-area-apply');
  if (!box) return;
  const applied = message.getFlag('sdm', 'areaApplied') ?? [];
  const allowed = game.user.isGM || message.isAuthor;
  const shares = [...box.querySelectorAll('.sdm-area-share')];
  const pending = [];
  for (const share of shares) {
    const done = applied.find(entry => entry.uuid === share.dataset.targetUuid);
    if (!done) {
      // The roller applies to the tokens they own; the Referee to all
      const owned = !!fromUuidSync(share.dataset.targetUuid)?.isOwner;
      if (!allowed || !owned) share.querySelectorAll('button').forEach(button => button.remove());
      else pending.push(share);
      continue;
    }
    // Applied: what it did, and its Undo
    const target = fromUuidSync(done.uuid);
    const text = done.heal
      ? game.i18n.format('SDM.AreaHealApplied', { amount: done.amount, target: target?.name ?? '' })
      : game.i18n.format('SDM.Card.DamageApplied', { amount: done.amount, target: target?.name ?? '' });
    share.innerHTML =
      `<span class="sdm-card-tag info"><i class="fa-solid fa-${done.heal ? 'heart' : 'heart-crack'}"></i> ${esc(text)}` +
      (allowed ? ` <button type="button" data-action="sdmAreaUndo"><i class="fa-solid fa-rotate-left"></i> ${esc(game.i18n.localize('SDM.Card.Undo'))}</button>` : '') +
      `</span>`;
    share.querySelector('[data-action="sdmAreaUndo"]')?.addEventListener('click', async event => {
      event.preventDefault();
      event.currentTarget.disabled = true;
      if (target && !(await changeLifeOf(target, done.amount, { heal: !done.heal, reason: done.heal ? '' : 'DamageUndone' }))) return;
      const now = message.getFlag('sdm', 'areaApplied') ?? [];
      await message.setFlag('sdm', 'areaApplied', now.filter(entry => entry.uuid !== done.uuid));
    });
  }
  // Apply some: each share's damage (or heal), then the card keeps what was done
  const apply = async list => {
    const done = [];
    for (const { uuid, amount, heal } of list) {
      const target = fromUuidSync(uuid);
      if (!target || amount <= 0) continue;
      if (await changeLifeOf(target, amount, { heal })) done.push({ uuid, amount, heal });
    }
    if (done.length) await message.setFlag('sdm', 'areaApplied', [...(message.getFlag('sdm', 'areaApplied') ?? []), ...done]);
  };
  const shareOf = (share, heal) => {
    const button = share.querySelector(`[data-action="sdmAreaApplyDamage"]${heal ? '[data-heal="1"]' : ':not([data-heal])'}`);
    return button ? { uuid: share.dataset.targetUuid, amount: Number(button.dataset.amount) || 0, heal } : null;
  };
  box.querySelectorAll('[data-action="sdmAreaApplyDamage"]').forEach(button =>
    button.addEventListener('click', async event => {
      event.preventDefault();
      box.querySelectorAll('button').forEach(b => (b.disabled = true));
      await apply([{ uuid: button.dataset.targetUuid, amount: Number(button.dataset.amount) || 0, heal: button.dataset.heal === '1' }]);
    })
  );
  const all = box.querySelector('.sdm-area-all');
  if (!allowed || !pending.length) all?.remove();
  all?.querySelectorAll('[data-action="sdmAreaApplyAll"]').forEach(button =>
    button.addEventListener('click', async event => {
      event.preventDefault();
      box.querySelectorAll('button').forEach(b => (b.disabled = true));
      const heal = button.dataset.heal === '1';
      await apply(pending.map(share => shareOf(share, heal)).filter(Boolean));
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
