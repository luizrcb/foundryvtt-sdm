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
import { numberValue } from '../helpers/formulas.mjs';
import { applyStatusToTargets, changeLifeOf } from '../app/use-item.mjs';
import { clearSplashPreview, showSplashPreview, splashTokens, tieButtons, weaponSplash } from '../helpers/areas.mjs';
import { saveAgainst, saveDifficultyValue } from '../app/save-against.mjs';

/**
 * Features that put a condition on whoever is hit: [feature, condition, rounds (0: until removed),
 * button text, icon, save]. Entangling, petrifying and heat allow a save: the button rolls it (an
 * NPC) or asks for it (a character), and the condition goes on only if it fails.
 */
const CONDITION_FEATURES = [
  ['blinding', 'blind', 1, 'SDM.AttackFeature.BlindButton', 'fa-solid fa-eye-slash', false],
  ['confusing', 'confused', 1, 'SDM.AttackFeature.ConfuseButton', 'fa-solid fa-question', false],
  ['slumber', 'sleep', 0, 'SDM.AttackFeature.SleepButton', 'fa-solid fa-bed', false],
  ['entangling', 'restrain', 0, 'SDM.AttackFeature.EntangleButton', 'fa-solid fa-link', true],
  ['petrifying', 'petrified', 0, 'SDM.AttackFeature.PetrifyButton', 'fa-solid fa-mountain', true],
  ['mad', 'mad', 0, 'SDM.AttackFeature.MadButton', 'fa-solid fa-brain', false],
  ['heat', 'burning', 0, 'SDM.AttackFeature.IgniteButton', 'fa-solid fa-fire', true]
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


/** Card notes and buttons for the features of the item an attack was made with. */
export function attackFeatureHtml({ actor, item, targetActor = null, success = null, isNat1 = false, isNat20 = false, total = null, attackTarget = 'physical' }) {
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
    for (const [feature, status, rounds, label, icon, save] of CONDITION_FEATURES) {
      if (!has(item, feature)) continue;
      parts.push(
        button('sdmFeatureCondition', icon, game.i18n.format(label, { target: targetActor.name }), {
          target: targetActor.uuid,
          status,
          rounds,
          save: save ? '1' : '',
          difficulty: save ? saveDifficultyValue(item.system?.feature_save, item.system?.feature_save_target) : '',
          source: item.name
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

  // Splash: every attack (hit or miss) also hits the creatures next to the target whose defense it
  // beats, with the splash damage (Mouth of the Void: 1d6)
  const splash = weaponSplash(item);
  if (targetActor && splash && total !== null) {
    const what = splash.damage === 'formula' ? splash.formula : game.i18n.localize(`SDM.SplashDamage.${splash.damage}`);
    const where = game.i18n.localize(`SDM.SplashShape.${splash.shape}`);
    parts.push(
      button('sdmFeatureSplash', 'fa-solid fa-burst', game.i18n.format('SDM.AttackFeature.SplashButton', { formula: what, target: targetActor.name, where }), {
        target: targetActor.uuid,
        item: item.name,
        'item-id': item.id,
        actor: actor.uuid,
        total,
        nat1: isNat1 ? '1' : '',
        nat20: isNat20 ? '1' : '',
        'attack-target': attackTarget ?? 'physical'
      })
    );
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

const SPLASH_DEFENSE = { physical: 'defense', mental: 'mental_defense', social: 'social_defense' };

/** The weapon's damage as a formula: its base damage and its bonus. */
function weaponDamageFormula(weapon) {
  const damage = weapon?.system?.weapon?.damage ?? {};
  const bonus = Number(damage.bonus) || 0;
  const base = `${damage.base ?? ''}`.trim();
  if (!base) return '';
  return bonus ? `${base}${bonus > 0 ? '+' : ''}${bonus}` : base;
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
  on('sdmFeatureCondition', async ({ target, status, rounds, save, difficulty, source }, button) => {
    const actor = await fromUuid(target);
    if (!actor) return;
    // A save allowed: the target saves first (an NPC rolls now, a character gets a save request)
    if (save) return saveAgainst(actor, { status, rounds: Number(rounds) || 0, source, difficulty: difficulty ?? '' });
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

  // Splash: roll once, then every creature adjacent to the target's token takes it (through the Referee when not owned)
  on('sdmFeatureSplash', async ({ target, item, itemId, actor: attackerUuid, total, nat1, nat20, attackTarget }, button) => {
    const targetActor = await fromUuid(target);
    const token = targetActor?.getActiveTokens?.(false, true)?.find(t => t.parent === canvas.scene);
    if (!token) return ui.notifications.warn(game.i18n.localize('SDM.AttackFeature.SplashNoToken'));
    const attacker = await fromUuid(attackerUuid);
    if (!attacker?.isOwner && !game.user.isGM) return ui.notifications.warn(game.i18n.localize('SDM.AttackFeature.NotAllowed'));
    const weapon = attacker?.items?.get(itemId);
    const splash = weaponSplash(weapon);
    if (!splash) return;
    const attackerToken = attacker?.getActiveTokens?.(false, true)?.find(t => t.parent === canvas.scene) ?? null;
    // The attack against each one's defense: a natural 1 misses all, a natural 20 hits all, a tie asks for a sacrifice
    const attackTotal = Number(total) || 0;
    const reached = await splashTokens({ splash, attackerToken, targetToken: token, name: weapon.name });
    if (!reached) return;
    const results = reached.map(other => {
      const field = SPLASH_DEFENSE[attackTarget] ?? 'defense';
      const defense = Number(other.actor.system?.[field]) || 0;
      const hit = !nat1 && (!!nat20 || attackTotal > defense);
      // A tie: sacrifice something to hit it, or miss (the Referee decides)
      const tie = !nat1 && !nat20 && attackTotal === defense;
      return { token: other, defense, hit, tie };
    });
    const hits = results.filter(r => r.hit);
    const ties = results.filter(r => r.tie);
    // What will happen, before anything is rolled: the squares on the map, and who it hits or misses
    if (results.length) {
      showSplashPreview(reached.squares);
      let go = false;
      try {
        const rows = results
          .map(r => `<li><b>${esc(r.token.name)}</b> (${esc(game.i18n.localize('SDM.FieldDefense'))} ${r.defense}): ${esc(game.i18n.localize(r.hit ? 'SDM.AttackFeature.SplashPreviewHit' : r.tie ? 'SDM.AttackFeature.SplashPreviewTie' : 'SDM.AttackFeature.SplashPreviewMiss'))}</li>`)
          .join('');
        go = await foundry.applications.api.DialogV2.confirm({
          window: { title: game.i18n.format('SDM.AttackFeature.SplashPreviewTitle', { item }) },
          content: `<p>${esc(game.i18n.format('SDM.AttackFeature.SplashPreviewText', { total: attackTotal }))}</p><ul class="sdm-splash-preview">${rows}</ul>`,
          yes: { label: game.i18n.localize('SDM.AttackFeature.SplashPreviewGo'), icon: 'fa-solid fa-burst' },
          rejectClose: false
        });
      } finally {
        clearSplashPreview();
      }
      if (!go) return;
    }
    // The splash damage: its formula, or the weapon's damage (all of it, or half rounded up)
    const formula = splash.damage === 'formula' ? splash.formula : weaponDamageFormula(weapon);
    const rolled = hits.length || ties.length ? await new Roll(formula || '0', attacker?.getRollData?.() ?? {}).evaluate() : null;
    const roll = rolled;
    const amount = rolled ? (splash.damage === 'half' ? Math.ceil(rolled.total / 2) : rolled.total) : 0;
    const lines = results
      .map(r =>
        game.i18n.format(r.hit ? 'SDM.AttackFeature.SplashHit' : r.tie ? 'SDM.AttackFeature.SplashTie' : 'SDM.AttackFeature.SplashMiss', {
          name: r.token.name,
          defense: r.defense
        })
      )
      .join(', ');
    const flavor = game.i18n.format('SDM.AttackFeature.SplashFlavor', { item, target: targetActor.name, total: attackTotal, names: lines || '—' });
    const speaker = ChatMessage.getSpeaker({ actor: attacker ?? undefined });
    const tieRows = roll ? ties.map(r => tieButtons({ kind: 'splash', actorUuid: r.token.actor.uuid, name: r.token.name, amount, reason: item })).join('') : '';
    const halfNote = roll && splash.damage === 'half' ? `<p>${esc(game.i18n.format('SDM.AttackFeature.SplashHalf', { amount }))}</p>` : '';
    if (roll) {
      const message = await ChatMessage.create({
        speaker,
        rolls: [roll],
        content: `<p>${esc(flavor)}</p>${await roll.render()}${halfNote}${tieRows}`
      });
      // The damage lands once the dice have finished rolling
      await game.dice3d?.waitFor3DAnimationByMessageID?.(message.id);
    } else await ChatMessage.create({ speaker, content: `<p>${esc(flavor)}</p>` });
    for (const r of hits) await changeLifeOf(r.token.actor, amount, { reason: item });
    button.disabled = true;
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
