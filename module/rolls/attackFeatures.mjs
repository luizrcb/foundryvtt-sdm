/**
 * What an attack's item features do, now that the attack dialog knows the item ("With"):
 *  - in the dialog: clumsy suggests disadvantage; armor piercing suggests advantage against a heavily
 *    armored target (readied heavy / golem armor);
 *  - on the card: backfiring (natural 1) and vorpal (natural 20) notes; on a hit, condition buttons:
 *    blinding and confusing (a round; a blinding critical may blind for good), slumber (asleep),
 *    entangling (grabbed) and petrifying (if the save fails), mad, fearsome (a creature tests its
 *    morale, a character is frightened), heat (catches fire if its save fails); burdening (a hit: give the target a burden)
 *    and spiked armor (an unarmed attack on it: the attacker takes 1d3) as buttons for the Referee or
 *    the owner of whoever they affect;
 *  - attack bonuses from the effects of other readied weapons / powers don't count (they are
 *    for attacks made with that item).
 */
import { ActorType, ItemType, RollMode } from '../helpers/constants.mjs';
import { UnarmedDamageItem } from '../helpers/itemUtils.mjs';
import { applyStatusToTargets } from '../app/use-item.mjs';

/**
 * Features that put a condition on whoever is hit: [feature, condition, rounds (0: until removed),
 * button text]. Entangling and petrifying allow a save: the button says so.
 */
const CONDITION_FEATURES = [
  ['blinding', 'blind', 1, 'SDM.AttackFeature.BlindButton', 'fa-solid fa-eye-slash'],
  ['confusing', 'confused', 1, 'SDM.AttackFeature.ConfuseButton', 'fa-solid fa-question'],
  ['slumber', 'sleep', 0, 'SDM.AttackFeature.SleepButton', 'fa-solid fa-bed'],
  ['entangling', 'restrain', 0, 'SDM.AttackFeature.EntangleButton', 'fa-solid fa-link'],
  ['petrifying', 'petrified', 0, 'SDM.AttackFeature.PetrifyButton', 'fa-solid fa-mountain'],
  ['mad', 'mad', 0, 'SDM.AttackFeature.MadButton', 'fa-solid fa-brain'],
  ['heat', 'burning', 0, 'SDM.AttackFeature.IgniteButton', 'fa-solid fa-fire']
];

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
    for (const [feature, status, rounds, label, icon] of CONDITION_FEATURES) {
      if (!has(item, feature)) continue;
      parts.push(
        button('sdmFeatureCondition', icon, game.i18n.format(label, { target: targetActor.name }), {
          target: targetActor.uuid,
          status,
          rounds
        })
      );
      if (feature === 'blinding' && isNat20) parts.push(note(icon, game.i18n.localize('SDM.AttackFeature.BlindForGood')));
    }
    // Fearsome: a creature tests its morale; a character (no morale) is frightened
    if (has(item, 'fearsome')) {
      const npc = targetActor.type === ActorType.NPC;
      parts.push(
        npc
          ? button('sdmFeatureMorale', 'fa-solid fa-face-flushed', game.i18n.format('SDM.AttackFeature.MoraleButton', { target: targetActor.name }), {
              target: targetActor.uuid
            })
          : button('sdmFeatureCondition', 'fa-solid fa-face-flushed', game.i18n.format('SDM.AttackFeature.FrightenButton', { target: targetActor.name }), {
              target: targetActor.uuid,
              status: 'fear',
              rounds: 0
            })
      );
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

  // Anyone who sees the card may press it: a target they don't own goes through the Referee
  on('sdmFeatureCondition', async ({ target, status, rounds }, button) => {
    const actor = await fromUuid(target);
    if (!actor) return;
    const speaker = game.messages.get(button.closest('[data-message-id]')?.dataset.messageId)?.speaker;
    await applyStatusToTargets(status, ChatMessage.getSpeakerActor?.(speaker) ?? null, { targets: [actor], rounds: Number(rounds) || 0 });
  });

  on('sdmFeatureMorale', async ({ target }) => {
    const actor = await fromUuid(target);
    if (!actor?.isOwner) return ui.notifications.warn(game.i18n.localize('SDM.AttackFeature.NotAllowed'));
    await actor.performHudAction('rollNPCMorale');
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
