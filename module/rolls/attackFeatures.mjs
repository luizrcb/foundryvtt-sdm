/**
 * What an attack's item features do, now that the attack dialog knows the item ("With"):
 *  - in the dialog: clumsy suggests disadvantage; armor piercing suggests advantage against a heavily
 *    armored target (readied heavy / golem armor);
 *  - on the card: backfiring (natural 1) and vorpal (natural 20) notes; blinding (a hit: blind the
 *    target for a round; a critical may blind for good), burdening (a hit: give the target a burden)
 *    and spiked armor (an unarmed attack on it: the attacker takes 1d3) as buttons for the Referee or
 *    the owner of whoever they affect;
 *  - attack bonuses from the effects of other readied weapons / powers don't count (they are
 *    for attacks made with that item).
 */
import { ItemType, RollMode } from '../helpers/constants.mjs';
import { UnarmedDamageItem } from '../helpers/itemUtils.mjs';

const esc = text => foundry.utils.escapeHTML(String(text ?? ''));
const has = (item, feature) => !!item?.system?.features?.has?.(feature);
const isUnarmed = item =>
  item?._stats?.compendiumSource === UnarmedDamageItem || item?.getFlag?.('sdm', 'fromCompendium') === UnarmedDamageItem;

/** Gear an attack can be made with: weapons (or the weapon feature), powers and power albums. */
export function isAttackGear(item) {
  if (item?.type !== ItemType.GEAR) return false;
  const type = item.system?.type;
  return type === 'weapon' || type === 'power' || type === 'power_album' || has(item, 'weapon') || has(item, 'album');
}

/**
 * Heavily armored: wearing readied heavy or golem armor (characters and NPCs alike). A high defense
 * alone doesn't count: it may be agility, not armor.
 */
export function heavilyArmored(actor) {
  if (!actor) return false;
  return actor.items.some(
    item => item.system?.readied && item.system?.type === 'armor' && ['heavy', 'golem'].includes(item.system?.armor?.type)
  );
}

/**
 * Roll mode the chosen item's features suggest against the current target, with a note for each:
 * { mode, notes }. Clumsy: disadvantage. Armor piercing vs a heavily armored target: advantage.
 */
export function featureRollAdvice(actor, entry, targetActor = null) {
  const item = entry ? actor?.items?.get(entry.itemId ?? entry.id) : null;
  const notes = [];
  let advantage = false;
  let disadvantage = false;
  if (has(item, 'clumsy')) {
    disadvantage = true;
    notes.push(game.i18n.localize('SDM.AttackFeature.Clumsy'));
  }
  if (has(item, 'armor_piercing') && heavilyArmored(targetActor)) {
    advantage = true;
    notes.push(game.i18n.localize('SDM.AttackFeature.ArmorPiercing'));
  }
  const mode = advantage && !disadvantage ? RollMode.ADVANTAGE : disadvantage && !advantage ? RollMode.DISADVANTAGE : null;
  return { mode, notes };
}

/**
 * Attack bonus that comes from the effects of readied weapons / powers other than the chosen one
 * (added to `system.<attack>.bonus` or `system.attack_bonus`): an attack made with another item
 * leaves it out. 0 when nothing is chosen.
 */
export function otherWeaponsBonus(actor, attack, chosenItemId) {
  if (!actor || !chosenItemId) return 0;
  const keys = [`system.${attack}.bonus`, 'system.attack_bonus'];
  let total = 0;
  for (const effect of actor.allApplicableEffects?.() ?? []) {
    if (effect.disabled || effect.isSuppressed) continue;
    const item = effect.parent;
    if (!(item instanceof Item) || item.id === chosenItemId || !isAttackGear(item)) continue;
    for (const change of effect.system?.changes ?? effect.changes ?? []) {
      const isAdd = change.type === 'add' || change.mode === CONST.ACTIVE_EFFECT_MODES?.ADD;
      const value = Number(change.value);
      if (keys.includes(change.key) && isAdd && Number.isFinite(value)) total += value;
    }
  }
  return total;
}

/** Card notes and buttons for the features of the item an attack was made with. */
export function attackFeatureHtml({ actor, item, targetActor = null, success = null, isNat1 = false, isNat20 = false }) {
  if (!actor || !item) return '';
  const parts = [];
  const note = (icon, text) => `<div class="sdm-attack-feature"><i class="${icon}"></i> ${esc(text)}</div>`;
  const button = (action, icon, text, data) =>
    `<button type="button" data-action="${action}" ${Object.entries(data)
      .map(([key, value]) => `data-${key}="${esc(value)}"`)
      .join(' ')}><i class="${icon}"></i><span>${esc(text)}</span></button>`;

  if (isNat1 && has(item, 'backfiring')) parts.push(note('fa-solid fa-burst', game.i18n.format('SDM.AttackFeature.Backfiring', { item: item.name })));
  if (isNat20 && has(item, 'vorpal')) parts.push(note('fa-solid fa-skull-crossbones', game.i18n.format('SDM.AttackFeature.Vorpal', { item: item.name })));

  if (targetActor && success) {
    if (has(item, 'blinding')) {
      parts.push(
        button('sdmFeatureBlind', 'fa-solid fa-eye-slash', game.i18n.format('SDM.AttackFeature.BlindButton', { target: targetActor.name }), {
          target: targetActor.uuid
        })
      );
      if (isNat20) parts.push(note('fa-solid fa-eye-slash', game.i18n.localize('SDM.AttackFeature.BlindForGood')));
    }
    if (has(item, 'burdening')) {
      parts.push(
        button('sdmFeatureBurden', 'fa-solid fa-weight-hanging', game.i18n.format('SDM.AttackFeature.BurdenButton', { target: targetActor.name }), {
          target: targetActor.uuid,
          item: item.name
        })
      );
    }
  }

  // Unarmed on spiked armor: the attacker gets hurt (hit or not: the attacker touched it)
  if (targetActor && isUnarmed(item)) {
    const spiked = targetActor.items.find(other => other.system?.readied && has(other, 'spiked'));
    if (spiked) {
      parts.push(
        button('sdmFeatureSpiked', 'fa-solid fa-hand-back-fist', game.i18n.format('SDM.AttackFeature.SpikedButton', { item: spiked.name }), {
          actor: actor.uuid
        })
      );
    }
  }
  return parts.length ? `<div class="sdm-attack-features">${parts.join('')}</div>` : '';
}

/** renderChatMessageHTML: the feature buttons (the Referee, or the owner of whoever they affect). */
export function bindAttackFeatures(html) {
  const on = (action, handler) =>
    html.querySelectorAll(`[data-action="${action}"]`).forEach(button =>
      button.addEventListener('click', async event => {
        event.preventDefault();
        await handler(button.dataset, button);
      })
    );

  on('sdmFeatureBlind', async ({ target }) => {
    const actor = await fromUuid(target);
    if (!actor?.isOwner) return ui.notifications.warn(game.i18n.localize('SDM.AttackFeature.NotAllowed'));
    if (actor.statuses?.has('blind')) return;
    await actor.toggleStatusEffect('blind', { active: true });
    // One round, unless the condition automation already set it
    const effect = actor.effects.find(e => e.statuses?.has('blind') && !e.duration?.rounds);
    await effect?.update({ 'duration.rounds': 1 });
  });

  on('sdmFeatureBurden', async ({ target, item }) => {
    const actor = await fromUuid(target);
    if (!actor?.isOwner) return ui.notifications.warn(game.i18n.localize('SDM.AttackFeature.NotAllowed'));
    await actor.createEmbeddedDocuments('Item', [
      {
        name: game.i18n.format('SDM.AttackFeature.BurdenName', { item }),
        type: ItemType.BURDEN,
        img: 'icons/svg/downgrade.svg',
        system: { description: `<p>${esc(game.i18n.localize('SDM.ItemFeature.burdeningDescription'))}</p>` }
      }
    ]);
    ui.notifications.info(game.i18n.format('SDM.AttackFeature.BurdenGiven', { target: actor.name }));
  });

  on('sdmFeatureSpiked', async ({ actor: uuid }, button) => {
    const actor = await fromUuid(uuid);
    if (!actor?.isOwner) return ui.notifications.warn(game.i18n.localize('SDM.AttackFeature.NotAllowed'));
    const roll = await new Roll('1d3').evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: game.i18n.localize('SDM.AttackFeature.SpikedFlavor')
    });
    await actor.applyDamage(roll.total, 1);
    button.disabled = true;
  });
}
