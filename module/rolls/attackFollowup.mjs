/**
 * Attacks made with a chosen weapon or power (attack dialog, "With"): the chat card gets a button to
 * roll that item's damage (or the power) next. The attack's card carries the item in its flags
 * (`flags.sdm.attackItem`), so a hero dice result for that attack gets the same button.
 */

/** Which roll the button makes: a weapon's damage, a power, an album's power, an NPC's own damage. */
const ROLL_KIND = { weapon: 'damage', power: 'power', album: 'power_album', npc: 'rollNPCDamage' };

/**
 * The flag stored on the attack's card. An NPC attacking without a chosen item uses its own damage
 * (the Damage value of its sheet).
 */
export function attackItemFlag(actor, attackItem) {
  if (!actor) return null;
  if (attackItem?.id) return { id: attackItem.id, name: attackItem.name, kind: attackItem.kind, actor: actor.uuid };
  if (actor.type === 'npc') return { id: '', name: `${actor.system?.damage || '1d4'}`, kind: 'npc', actor: actor.uuid };
  return null;
}

/** The button's HTML, or '' when the item is no longer on the actor. */
export function attackFollowupHtml(flag) {
  if (!flag?.kind) return '';
  const actor = fromUuidSync(flag.actor);
  if (!actor) return '';
  if (flag.kind !== 'npc' && !actor.items?.get(flag.id)) return '';
  const kind = ROLL_KIND[flag.kind] ?? 'damage';
  const isDamage = kind === 'damage' || kind === 'rollNPCDamage';
  let label = game.i18n.format(isDamage ? 'SDM.AttackFollowupDamage' : 'SDM.AttackFollowupPower', { item: flag.name });
  // A critical (consecutive natural 20s): the multiplier the damage dialog starts with
  if (flag.multiplier) label += ` ${flag.multiplier.replace('*', '×')}`;
  const icon = isDamage ? 'fa-solid fa-burst' : 'fa-solid fa-wand-magic-sparkles';
  const esc = foundry.utils.escapeHTML;
  return (
    `<div class="sdm-attack-followup"><button type="button" data-action="sdmAttackFollowup" data-kind="${kind}"` +
    ` data-item-id="${esc(flag.id)}" data-actor-uuid="${esc(flag.actor)}" data-multiplier="${esc(flag.multiplier ?? '')}"><i class="${icon}"></i><span>${esc(label)}</span></button></div>`
  );
}

/** renderChatMessageHTML: the button opens the item's damage / power dialog (owners only). */
export function bindAttackFollowup(html) {
  html.querySelectorAll('[data-action="sdmAttackFollowup"]').forEach(button =>
    button.addEventListener('click', async event => {
      event.preventDefault();
      const actor = fromUuidSync(button.dataset.actorUuid);
      if (!actor?.isOwner) return;
      if (button.dataset.kind === 'rollNPCDamage') {
        return actor.performHudAction('rollNPCDamage', '', { multiplier: button.dataset.multiplier }, !!event.shiftKey, !!event.ctrlKey);
      }
      const item = actor.items.get(button.dataset.itemId);
      if (!item) return ui.notifications.warn(game.i18n.localize('SDM.AttackFollowupGone'));
      await actor.performHudAction(
        button.dataset.kind,
        item.id,
        { label: item.name, multiplier: button.dataset.multiplier },
        !!event.shiftKey,
        !!event.ctrlKey
      );
    })
  );
}
