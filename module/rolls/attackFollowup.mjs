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

/**
 * What the button will roll, read from the item as it is now: a weapon's damage (and its two-handed
 * damage), a power's or an album power's roll; an NPC's damage is already the button's name.
 */
function followupFormula(flag, actor) {
  if (flag.kind === 'npc') return '';
  const item = actor.items?.get(flag.id);
  if (!item) return '';
  if (flag.kind === 'weapon') {
    const damage = item.system?.weapon?.damage ?? {};
    const bonus = Number(damage.bonus) || 0;
    const withBonus = formula => (formula && bonus ? `${formula}${bonus > 0 ? '+' : ''}${bonus}` : formula);
    const versatile = item.system?.weapon?.versatile || item.system?.features?.has?.('versatile');
    return [withBonus(damage.base), versatile ? withBonus(damage.versatile) : ''].filter(Boolean).join(' / ');
  }
  if (flag.kind === 'power') return `${item.system?.power?.roll_formula ?? ''}`;
  if (flag.kind === 'album') {
    const powers = item.system?.powers ?? [];
    return `${(powers[item.system?.powers_current_index] ?? powers[0])?.roll_formula ?? ''}`;
  }
  return '';
}

/** The button's HTML, or '' when the item is no longer on the actor. */
export function attackFollowupHtml(flag) {
  if (!flag?.kind) return '';
  const actor = fromUuidSync(flag.actor);
  if (!actor) return '';
  if (flag.kind !== 'npc' && !actor.items?.get(flag.id)) return '';
  const kind = ROLL_KIND[flag.kind] ?? 'damage';
  const isDamage = kind === 'damage' || kind === 'rollNPCDamage';
  const label = game.i18n.format(isDamage ? 'SDM.AttackFollowupDamage' : 'SDM.AttackFollowupPower', { item: flag.name });
  // What it rolls, and on a critical (consecutive natural 20s) the multiplier the dialog starts with
  const multiplier = flag.multiplier ? flag.multiplier.replace('*', '×') : '';
  const formula = [followupFormula(flag, actor), multiplier].filter(Boolean).join(' ');
  const icon = isDamage ? 'fa-solid fa-burst' : 'fa-solid fa-wand-magic-sparkles';
  const esc = foundry.utils.escapeHTML;
  return (
    `<div class="sdm-attack-followup"><button type="button" class="sdm-primary" data-action="sdmAttackFollowup" data-kind="${kind}"` +
    ` data-item-id="${esc(flag.id)}" data-actor-uuid="${esc(flag.actor)}" data-multiplier="${esc(flag.multiplier ?? '')}" data-target-uuid="${esc(flag.target ?? '')}" data-area-targets="${esc((flag.areaTargets ?? []).join(','))}"><i class="${icon}"></i><span>${esc(label)}</span>` +
    `${formula ? `<span class="sdm-followup-formula">${esc(formula)}</span>` : ''}</button></div>`
  );
}

/** renderChatMessageHTML: the button opens the item's damage / power dialog (owners only). */
export function bindAttackFollowup(html) {
  html.querySelectorAll('[data-action="sdmAttackFollowup"]').forEach(button =>
    button.addEventListener('click', async event => {
      event.preventDefault();
      const actor = fromUuidSync(button.dataset.actorUuid);
      if (!actor?.isOwner) return;
      // An area's damage: the tokens targeted now (the card targeted its hits; Shift+T adds or removes),
      // else the hits it stored
      if (button.dataset.areaTargets) {
        const targeted = [...new Set([...(game.user.targets ?? [])].map(t => t.actor?.uuid).filter(Boolean))];
        if (targeted.length) button.dataset.areaTargets = targeted.join(',');
      }
      if (button.dataset.kind === 'rollNPCDamage') {
        return actor.performHudAction(
          'rollNPCDamage',
          '',
          { multiplier: button.dataset.multiplier, targetUuid: button.dataset.targetUuid, areaTargets: button.dataset.areaTargets ?? '' },
          !!event.shiftKey,
          !!event.ctrlKey
        );
      }
      const item = actor.items.get(button.dataset.itemId);
      if (!item) return ui.notifications.warn(game.i18n.localize('SDM.AttackFollowupGone'));
      await actor.performHudAction(
        button.dataset.kind,
        item.id,
        { label: item.name, multiplier: button.dataset.multiplier, targetUuid: button.dataset.targetUuid, areaTargets: button.dataset.areaTargets ?? '' },
        !!event.shiftKey,
        !!event.ctrlKey
      );
    })
  );
}
