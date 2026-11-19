import { powerCardData } from '../helpers/singleUsePowers.mjs';
import { attackFollowupHtml, attackItemFlag, powerWithoutRoll, usePowerOnArea } from './attackFollowup.mjs';
import { attackFeatureHtml } from './attackFeatures.mjs';
import { reachFirstNote } from '../helpers/zones.mjs';
import { areaApplyButtonsHtml, areaAttackButton, areaBlock, areaPowerButton, areaShares, areaState, requestAreaSaves, setTargets } from '../helpers/areas.mjs';
import { hasLastFoeDamage } from '../helpers/auras.mjs';
import { actorTriggers, attackTriggers, damageTriggers, itemRollTriggers, renderTriggers, runTriggerActions } from './triggers.mjs';
import { createChatMessage } from '../helpers/chatUtils.mjs';
import { ActorType, AttackTarget, RollMode, RollType } from '../helpers/constants.mjs';
import { $l10n, capitalizeFirstLetter, toPascalCase } from '../helpers/globalUtils.mjs';
import { cardHeader, cardTag, cardWrap, marginText, resultStrip, rollBox } from './ui/cardParts.mjs';
import { applyDamageHtml } from './ui/applyDamage.mjs';
import { changeLifeOf } from '../app/use-item.mjs';

export default class SDMRoll {
  constructor({
    actor,
    type,
    from,
    mode = RollMode.NORMAL,
    formula = '1d20',
    ability = '',
    skill = null,
    modifier = '',
    multiplier = '',
    explodingDice = true,
    versatile = false,
    targetActor,
    targetFromCard = false,
    // Damage for an area: the tokens it hit (actor uuids), each gets the damage
    areaTargets = [],
    // An area resolved by a save: the targets who passed it, and what a passed save does
    areaSaved = [],
    areaPass = '',
    // An area placed before the roll: { placed, item, kind } (helpers/areas.mjs)
    areaPlaced = null,
    attackTarget = AttackTarget.PHYSICAL,
    sendPowerToChat = false,
    powerDescription = '',
    item = null,
    isCtrl = false,
    overcharged = false,
    extraFlags = {},
    attack = '',
    triggerItem = null,
    powerName = '',
    attackItem = null
  }) {
    this.actor = actor;
    // Attacks: the weapon / power the attack is made with ({ id, name, kind }), from the attack dialog
    this.attackItem = attackItem;
    // Which attack (melee, ranged, fantascience, oldtech): attack triggers can be limited to one
    this.attack = attack || '';
    // Album powers: the album holds the triggers (filtered by the power's name)
    this.triggerItem = triggerItem;
    this.powerName = powerName || '';
    this.type = type;
    this.from = from;
    this.mode = mode;
    this.formula = formula;
    this.ability = ability;
    this.skill = skill;
    this.modifier = foundry.dice.Roll.validate(modifier) ? modifier : '';
    this.multiplier = multiplier;
    this.explodingDice = explodingDice;
    this.versatile = versatile;
    this.targetActor = targetActor;
    this.targetFromCard = targetFromCard;
    this.areaTargets = (areaTargets ?? []).map(uuid => fromUuidSync(uuid)).filter(a => a instanceof Actor);
    this.areaPlaced = areaPlaced;
    this.areaSaved = Array.isArray(areaSaved) ? areaSaved : `${areaSaved ?? ''}`.split(',').filter(Boolean);
    this.areaPass = areaPass || '';
    this.attackTarget = attackTarget;
    this.sendPowerToChat = sendPowerToChat;
    this.powerDescription = powerDescription;
    this.item = item;
    this.isCtrl = isCtrl;
    this.overcharged = overcharged;
    this.roll;
    this.extraFlags = extraFlags;
  }

  /**
   * The formula this roll rolls (dice, exploding, multiplier, modifiers, escalator die, damage bonus).
   * The roll dialog's preview uses it too, so what it shows is what gets rolled.
   */
  buildFormula() {
    const expression = this.#buildDiceComponent();
    const explodingExpression = this.#applyExplodingDice(expression);
    const multipliedExpression = this.#applyMultiplier(explodingExpression);
    const { fixedModifiers, diceModifiers } = this.#calculateModifiers(this.type);

    const formulaComponents = [multipliedExpression, diceModifiers, fixedModifiers];

    const escalatorDie = game.settings.get('sdm', 'escalatorDie') ?? 0;
    if (escalatorDie > 0) formulaComponents.push(escalatorDie);
    const isDamageRoll = [RollType.DAMAGE, RollType.POWER, RollType.POWER_ALBUM].includes(this.type);
    const damageBonus = this.actor.system?.damage_bonus || 0;
    if (isDamageRoll && damageBonus > 0) formulaComponents.push(damageBonus);

    const formula = sanitizeExpression(formulaComponents.join('+'));
    return { formula, fixedModifiers, diceModifiers, escalatorDie };
  }

  async evaluate() {
    if (this.sendPowerToChat && this.item) {
      const sent = await this.item.sendToChat({
        actor: this.actor,
        flavor: this.#buildFlavorText(),
        collapsed: true,
        displayWeight: false,
        blindGMRoll: this.isCtrl,
        overcharged: this.overcharged
      });
      // A power with no roll still fires its "always" power triggers (Eyes of Akaula: sees invisible)
      const source = this.triggerItem ?? this.item;
      const fired = itemRollTriggers(source, 'power', { total: 0, dice: [] }, { power: this.powerName }).filter(
        entry => entry.trigger.condition === 'always'
      );
      if (fired.length) {
        await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: renderTriggers(fired) });
        await runTriggerActions(fired, { actor: this.actor });
      }
      return sent;
    }

    const { formula: sanitizedFormula, fixedModifiers, diceModifiers, escalatorDie } = this.buildFormula();
    const luckySevenRule = game.settings.get('sdm', 'luckySevenRule') || false;
    const isAttack = this.type === RollType.ATTACK;
    const isAbility = this.type === RollType.ABILITY;
    const isDamage = this.type === RollType.DAMAGE;
    const isPower = this.type === RollType.POWER;
    const isPowerAlbum = this.type === RollType.POWER_ALBUM;
    const isDamageRoll = isDamage || isPower || isPowerAlbum;
    let checkCritical = isAttack || isAbility;

    const flavor = this.#buildFlavorText(fixedModifiers, diceModifiers, escalatorDie);

    const flags = {};

    if (isDamageRoll) {
      flags['sdm.isDamageRoll'] = true;
    } else {
      flags['sdm.isTraitRoll'] = true;
    }

    // A cast power's card carries the power, to catch it by dragging the card into an album
    const castPower = (isPower || isPowerAlbum) && this.item ? powerCardData(this.item) : null;
    if (castPower) flags.sdm = { ...(flags.sdm ?? {}), power: castPower };

    const attackMapping = {
      [AttackTarget.PHYSICAL]: {
        icon: '<i class="fa-solid fa-shield-halved"></i>',
        property: 'defense'
      },
      [AttackTarget.MENTAL]: {
        icon: '<i class="fa-solid fa-brain"></i>',
        property: 'mental_defense'
      },
      [AttackTarget.SOCIAL]: {
        icon: '<i class="fa-solid fa-crown"></i>',
        property: 'social_defense'
      }
    };

    this.roll = new Roll(sanitizedFormula, this.actor.system);
    await this.roll.evaluate();

    let content = '';
    let attackSuccess = null; // known when attacking a target
    const nat = detectNat1OrNat20(this.roll);
    const { isNat1, isNat20, is13, is7 } = nat;
    // Card pieces (see ui/cardParts.mjs): result strip, note tags, extras, actions
    let resultHtml = '';
    const tags = [];
    let rollTone = '';

    if (this.type === RollType.ATTACK && this.targetActor && this.targetActor !== this.actor) {
      checkCritical = false;
      // Remember the foe attacked (hit or miss), for damage each round to the last foe (Irresistible)
      if (this.actor?.isOwner && hasLastFoeDamage(this.actor) && this.actor.getFlag('sdm', 'lastAttacked') !== this.targetActor.uuid) {
        await this.actor.setFlag('sdm', 'lastAttacked', this.targetActor.uuid);
      }
      const isNPCTarget = this.targetActor.type === ActorType.NPC;
      const target = isNPCTarget ? AttackTarget.PHYSICAL : this.attackTarget;

      const { icon, property } = attackMapping[target];

      const targetDefense = this.targetActor?.system[property] || 0;
      const targetResistances = this.targetActor?.resistances || [];

      const attackResult = this.roll.total;
      const isSuccess = !isNat1 && (isNat20 || attackResult > targetDefense);
      attackSuccess = isSuccess;
      const forceOrFail = attackResult === targetDefense;

      let outcome = $l10n(isSuccess ? 'SDM.Card.Hit' : 'SDM.Card.Miss');
      let tone = isSuccess ? 'good' : 'bad';
      if (isNat1) {
        outcome = $l10n('SDM.CriticalFailure');
        tone = 'bad';
        rollTone = 'fumble';
      }
      if (isNat20) {
        outcome = $l10n('SDM.CriticalSuccess');
        tone = 'crit';
        rollTone = 'critical';
      }
      if (forceOrFail) {
        outcome = $l10n('SDM.ForceOrFail');
        tone = 'mid';
        rollTone = 'force';
      }
      const token = this.targetActor.getActiveTokens?.()[0]?.document;
      resultHtml = resultStrip({
        tone,
        img: token?.texture?.src || this.targetActor.img,
        name: this.targetActor.name,
        sub: `${icon} ${foundry.utils.escapeHTML($l10n('SDM.FieldDefense'))} ${targetDefense}`,
        outcome: outcome.toUpperCase(),
        margin: forceOrFail || isNat1 || isNat20 ? '' : marginText(attackResult - targetDefense)
      });
      if (targetResistances.length > 0) {
        tags.push(cardTag(`${$l10n('SDM.Resistances')}: ${targetResistances.join(', ')}`, { tone: 'info' }));
      }
      if (is13) tags.push(cardTag($l10n('SDM.DepletedResources'), { icon: 'fa-solid fa-triangle-exclamation' }));
      else if (is7 && luckySevenRule) tags.push(cardTag($l10n('SDM.LuckySeven'), { tone: 'good', icon: 'fa-solid fa-clover' }));
    } else if (checkCritical) {
      // No target (or an ability check): the natural 20 / 1 / 13 / 7 on the card itself
      checkCritical = false;
      if (isNat20) {
        rollTone = 'critical';
        resultHtml = resultStrip({ tone: 'crit', name: this.#cardTitle(), outcome: $l10n('SDM.CriticalSuccess').toUpperCase() });
      } else if (isNat1) {
        rollTone = 'fumble';
        resultHtml = resultStrip({ tone: 'bad', name: this.#cardTitle(), outcome: $l10n('SDM.CriticalFailure').toUpperCase() });
      } else if (is13) {
        rollTone = 'force';
        tags.push(cardTag($l10n('SDM.DepletedResources'), { icon: 'fa-solid fa-triangle-exclamation' }));
      } else if (luckySevenRule && is7) {
        tags.push(cardTag($l10n('SDM.LuckySeven'), { tone: 'good', icon: 'fa-solid fa-clover' }));
      }
    }

    let extras = '';
    if (this.powerDescription || isPower || isPowerAlbum) {
      const powerCard = await this.item.getItemChatCard({
        collapsed: true,
        displayWeight: false,
        actor: this.actor,
        overcharged: this.overcharged
      });
      extras += powerCard;
    }

    // Roll triggers: natural results on attacks (readied gear), damage results of the item
    const firedTriggers = isAttack
      ? attackTriggers(this.actor, this.roll, this.attack, attackSuccess, { withItem: this.attackItem?.id ?? '' })
      : isAbility
        ? actorTriggers(this.actor, 'ability', this.roll, { ability: this.ability })
        : isDamage && this.item
          ? damageTriggers(this.item, this.roll)
          : isPower && this.item?.id
            ? itemRollTriggers(this.item, 'power', this.roll)
            : isPowerAlbum && this.triggerItem
              ? itemRollTriggers(this.triggerItem, 'power', this.roll, { power: this.powerName })
              : [];
    // Whom the triggers act on: the target the attack card carried, else the user's targeted tokens
    const triggerTargets =
      this.targetFromCard && this.targetActor && this.targetActor !== this.actor ? [this.targetActor] : [...(game.user?.targets ?? [])];
    extras += renderTriggers(firedTriggers, { targets: triggerTargets });

    // Attack made with a weapon or power: a button to roll its damage / the power next (kept in the
    // flags, so a hero dice result for this attack gets it too)
    const attackItem = isAttack ? attackItemFlag(this.actor, this.attackItem) : null;
    // Consecutive natural 20s: the damage button suggests the critical multiplier
    if (attackItem) attackItem.multiplier = criticalMultiplier(this.actor, countConsecutiveTwenties(this.roll));
    // Close combat against an adversary with reach that hasn't acted yet this round: it strikes first
    if (isAttack && this.targetActor) {
      const usedItem = this.attackItem?.id ? this.actor?.items?.get(this.attackItem.id) : null;
      const reachNote = reachFirstNote(this.actor, this.targetActor, {
        attack: this.attack,
        attackerHasReach: usedItem ? !!usedItem.system?.features?.has?.('reach') : null
      });
      if (reachNote) tags.push(cardTag(reachNote, { tone: 'info', icon: 'fa-solid fa-arrows-left-right-to-line' }));
    }
    // Actions: the damage / power button first (the main one), then the item's feature buttons
    let actions = '';
    // The target it hit goes with the damage button (applied to it with "Apply damage automatically")
    if (attackItem && attackSuccess && this.targetActor) attackItem.target = this.targetActor.uuid;
    // Damage with a target: applied to it at once (optional), with an Undo for the roller and the Referee
    // An area's damage (or its power's roll: damage or healing): every token it hit, each less its
    // reduction (Bystander: its level)
    const areaRoll = (isDamage || ((isPower || isPowerAlbum) && this.roll.dice.length)) && this.areaTargets.length && this.roll.total > 0;
    const shares = areaRoll ? areaShares(this.areaTargets, this.roll.total, { saved: this.areaSaved, pass: this.areaPass }) : [];
    const autoApply = isDamage && game.settings.get('sdm', 'autoApplyDamage');
    const autoTarget =
      !shares.length && autoApply && this.targetActor && this.targetActor !== this.actor && this.roll.total > 0
        ? this.targetActor
        : null;
    const autoShares = autoTarget ? [{ target: autoTarget, reduction: 0, amount: this.roll.total }] : autoApply ? shares.filter(s => s.amount > 0) : [];
    for (const share of autoShares) {
      const reduced = share.reduction ? ` (−${share.reduction})` : '';
      tags.push(
        `<div class="sdm-card-tag info sdm-auto-damage" data-target-uuid="${foundry.utils.escapeHTML(share.target.uuid)}" data-amount="${share.amount}" data-reduction="${share.reduction}">` +
          `<i class="fa-solid fa-heart-crack"></i> ${foundry.utils.escapeHTML(game.i18n.format('SDM.Card.DamageApplied', { amount: share.amount, target: share.target.name }) + reduced)}` +
          ` <button type="button" data-action="sdmUndoDamage"><i class="fa-solid fa-rotate-left"></i> ${foundry.utils.escapeHTML($l10n('SDM.Card.Undo'))}</button></div>`
      );
    }
    // Not applied automatically: a button per token hit (a power's: damage or heal)
    if (!autoApply && shares.length) tags.push(areaApplyButtonsHtml(shares, { heal: !isDamage, total: this.roll.total }));
    // The area was placed before the roll (an item with an area): the card shows each one inside
    let areaPlacedBlock = null;
    if (this.areaPlaced && (isAttack || isPower || isPowerAlbum)) {
      const { placed, item: areaItem, kind } = this.areaPlaced;
      areaPlacedBlock = areaBlock(
        areaState({
          mode: isAttack ? 'attack' : 'power',
          actor: this.actor,
          item: areaItem,
          kind,
          placed,
          total: isAttack ? this.roll.total : this.roll.dice.length ? this.roll.total : 0,
          isNat1,
          isNat20,
          attackTarget: this.attackTarget,
          multiplier: attackItem?.multiplier ?? ''
        })
      );
      extras += areaPlacedBlock.html;
      flags.sdm = { ...(flags.sdm ?? {}), areaCard: areaPlacedBlock.card, ...(areaPlacedBlock.attackItem ? { attackItem: areaPlacedBlock.attackItem } : {}) };
      setTargets(areaPlacedBlock.hits);
    }
    if (attackItem && !areaPlacedBlock) {
      actions += attackFollowupHtml(attackItem);
      flags.sdm = { ...(flags.sdm ?? {}), attackItem };
    }
    // An item with an area: place it, and the attack is compared with every defense inside (helpers/areas.mjs)
    if (isAttack && this.attackItem?.id && this.actor && !areaPlacedBlock) {
      const areaItem = this.actor.items?.get(this.attackItem.id);
      if (areaItem) {
        actions += areaAttackButton({
          actor: this.actor,
          item: areaItem,
          total: this.roll.total,
          isNat1,
          isNat20,
          attackTarget: this.attackTarget,
          kind: this.attackItem.kind,
          multiplier: attackItem?.multiplier ?? ''
        });
      }
    }
    // The item's features: backfiring, vorpal, blinding, burdening; spiked armor against unarmed
    if (isAttack && this.attackItem?.id) {
      const usedItem = this.actor?.items?.get(this.attackItem.id);
      actions += attackFeatureHtml({
        actor: this.actor,
        item: usedItem,
        targetActor: this.targetActor,
        success: attackSuccess,
        isNat1,
        isNat20,
        total: this.roll.total,
        attackTarget: this.attackTarget
      });
    }
    // A power with an area: place it; everyone inside can take the power's roll (not when the power
    // follows an area attack: the area is placed already)
    if ((isPower || isPowerAlbum) && !areaPlacedBlock && !this.areaTargets.length) {
      const castItem = isPowerAlbum ? this.triggerItem : this.item?.id ? this.item : null;
      actions += areaPowerButton({ actor: this.actor, item: castItem, kind: isPowerAlbum ? 'album' : 'power', total: this.roll.dice.length ? this.roll.total : 0 });
    }
    // Damage: apply it to the selected tokens (also in the card's right-click menu)
    if (isDamage || ((isPower || isPowerAlbum) && this.roll.dice.length)) actions += applyDamageHtml(this.roll.total);

    content = cardWrap(
      cardHeader(this.#cardHeaderData(fixedModifiers, diceModifiers)) +
        (await rollBox(this.roll, { tone: rollTone })) +
        resultHtml +
        tags.join('') +
        extras +
        (actions ? `<div class="sdm-card-actions">${actions}</div>` : '') +
        `<div class="sdm-card-foot"></div>`,
      { kind: this.type }
    );

    // Hero dice can change this roll: what its triggers need to be checked again on the result
    if ((isAttack || isAbility) && this.actor) {
      const defense = isAttack && this.targetActor
        ? Number(this.targetActor.system?.[this.targetActor.type === ActorType.NPC || this.attackTarget === AttackTarget.PHYSICAL ? 'defense' : `${this.attackTarget}_defense`]) || 0
        : null;
      flags.sdm = {
        ...(flags.sdm ?? {}),
        triggerCheck: {
          kind: isAttack ? 'attack' : 'ability',
          actor: this.actor.uuid,
          attack: this.attack,
          ability: this.ability ?? '',
          withItem: this.attackItem?.id ?? '',
          defense,
          targetUuid: isAttack && this.targetActor ? this.targetActor.uuid : ''
        }
      };
    }

    const chatDataMessage = {
      actor: this.actor,
      rolls: [this.roll],
      // The card has its own title and chips (the old bracket line stays only in the roll's data)
      flavor: '',
      content,
      flags,
      checkCritical
    };

    if (this.isCtrl) {
      chatDataMessage.rollMode = CONST.DICE_ROLL_MODES.BLIND;
    }

    chatDataMessage.flags = { ...chatDataMessage.flags, ...this.extraFlags };
    const rollMessage = await createChatMessage(chatDataMessage);
    // What follows the roll (damage applied, a trigger's condition or save) comes after its card: wait
    // for its 3D dice (Dice So Nice) to land
    if ((autoShares.length || firedTriggers.length) && rollMessage?.id) await game.dice3d?.waitFor3DAnimationByMessageID?.(rollMessage.id);
    for (const share of autoShares) await changeLifeOf(share.target, share.amount);
    // An area resolved by a save: everyone inside saves
    if (areaPlacedBlock?.card.save && rollMessage) await requestAreaSaves(rollMessage);
    // An area attack with a power that rolls nothing: the power happens now, on those hit (or inside)
    if (isAttack && areaPlacedBlock?.attackItem && powerWithoutRoll(areaPlacedBlock.attackItem)) await usePowerOnArea(areaPlacedBlock.attackItem);
    // The roll's target (the one an attack hit, carried by its damage button) gets the triggers' conditions
    if (firedTriggers.length) {
      // Only the target the attack card carried; otherwise the user's targeted tokens, as always
      const rollTargets = this.areaTargets.length
        ? this.areaTargets
        : this.targetFromCard && this.targetActor && this.targetActor !== this.actor ? [this.targetActor] : null;
      await runTriggerActions(firedTriggers, { actor: this.actor, targets: rollTargets });
    }

    if (isDamage && this.item && this.item?.system?.features?.has('draining')) {
      const drainingAmount = this.item?.system?.draining?.value ?? 0;
      if (drainingAmount) {
        await this.actor.applyDamage(drainingAmount, -1, true, true);
      }
    }

    if (
      isDamage &&
      this.item &&
      this.item?.system?.features?.has('replenish') &&
      this.item.system.replenish?.on_attack !== false &&
      this.item.system.resources !== 'run_out'
    ) {
      await this.item.spendUsage();
    }

    // Casting a power from an item with replenish uses it too (running low: last use, no roll)
    const castFrom = isPowerAlbum ? this.triggerItem : isPower && this.item?.id ? this.item : null;
    if (castFrom?.actor && castFrom.system?.features?.has?.('replenish')) {
      await castFrom.spendUsage();
    }
  }

  #buildDiceComponent() {
    const keepModifier =
      this.mode === RollMode.ADVANTAGE ? 'kh' : this.mode === RollMode.DISADVANTAGE ? 'kl' : '';

    let diceExpression = keepModifier
      ? `{${this.formula}, ${this.formula}}${keepModifier}`
      : this.formula;
    return diceExpression;
  }

  #applyExplodingDice(rollExpression = '') {
    if (!this.explodingDice) {
      return rollExpression;
    }

    return rollExpression.replace(/\b(\d*d\d+)\b/g, '$1x');
  }

  #applyMultiplier(expression) {
    return this.multiplier ? `(${expression})${this.multiplier}` : expression;
  }

  #calculateModifiers(type) {
    if (type === 'save') {
      const abilityData =
        this.actor.type === ActorType.NPC
          ? { current: this.actor.system.bonus || 0 }
          : this.actor.system.abilities?.[this.ability] || { current: 0 };
      const finalAbility = abilityData.current || 0;
      const ward = this.actor.system?.ward || 0;
      const burdenPenalty = this.actor.system?.burden_penalty || 0;
      const saveBonus = abilityData?.save_bonus || 0;
      const allSaveBonus = this.actor.system?.all_save_bonus || 0;
      let total = finalAbility + ward + saveBonus + allSaveBonus - burdenPenalty;

      const useHardLimitRule = game.settings.get('sdm', 'useHardLimitRule');
      if (useHardLimitRule) {
        const defaultHardLimitValue = game.settings.get('sdm', 'defaultHardLimitValue') || 20;
        total = Math.min(total, defaultHardLimitValue);
      }

      // Adiciona o modifier extra (que pode conter dados)
      const modifierComponents = this.#parseModifierString(this.modifier);
      const { fixedModifiers: fixedExtra, diceModifiers: diceExtra } =
        this.#separateFixedAndDice(modifierComponents);

      const fixed = (fixedExtra || 0) + total;
      return { fixedModifiers: fixed, diceModifiers: diceExtra || '' };
    }

    const actorData = this.actor?.system;
    let abilityMod = 0;

    if (type === 'custom') {
      abilityMod = 0;
      this.ability = '';
    } else if (this.actor?.type === ActorType.CHARACTER) {
      abilityMod = actorData?.abilities[this.ability]?.current ?? 0;
      const rollBonus = actorData?.abilities[this.ability]?.roll_bonus ?? 0;
      abilityMod += rollBonus;
    } else if (
      this.actor.type === ActorType.NPC &&
      ![RollType.DAMAGE, RollType.POWER, RollType.POWER_ALBUM].includes(type)
    ) {
      abilityMod = actorData?.bonus ?? 0;
    }

    const burdenPenalty = actorData?.burden_penalty || 0;
    const skillMod = this.skill?.mod || 0;
    const allBonuses = -burdenPenalty + abilityMod + skillMod;
    const modifierComponents = this.#parseModifierString(this.modifier);
    const fixedAndDice = this.#separateFixedAndDice([...modifierComponents, `${allBonuses}`]);

    const fixed = fixedAndDice.fixedModifiers;

    const useHardLimitRule = game.settings.get('sdm', 'useHardLimitRule');
    const defaultHardLimitValue = game.settings.get('sdm', 'defaultHardLimitValue') || 13;

    const finalFixed =
      useHardLimitRule && ![RollType.DAMAGE, RollType.POWER, RollType.POWER_ALBUM].includes(type)
        ? Math.min(fixed, defaultHardLimitValue)
        : fixed;
    fixedAndDice.fixedModifiers = finalFixed;

    return fixedAndDice;
  }

  /** The card's title: "Ranged attack · Bola", "Damage · Spear", a power's name, an ability check. */
  #cardTitle() {
    if (this.type === RollType.ATTACK) {
      // With a weapon / power: its name (the icon and a chip say the kind); else "Melee attack"
      if (this.attackItem?.name) return this.attackItem.name;
      const kind = this.#attackKind();
      return kind ? capitalizeFirstLetter(game.i18n.format('SDM.Card.AttackTitle', { attack: kind })) : $l10n('SDM.Attack');
    }
    if (this.type === RollType.DAMAGE) return game.i18n.format('SDM.Card.DamageTitle', { item: this.from });
    return `${this.from ?? ''}`;
  }

  /** "corpo a corpo", "à distância"… (empty for a plain attack). */
  #attackKind() {
    if (!this.attack || this.attack === 'attack') return '';
    return $l10n(`SDM.Attack${capitalizeFirstLetter(this.attack)}`).toLowerCase();
  }

  /** Icon, color, badge and chips of the card's title (what the old bracket flavor listed). */
  #cardHeaderData(fixedModifiers, diceModifiers) {
    const abilityColor = key => CONFIG.SDM.abilityColors?.[CONFIG.SDM.abilitiesKeys?.indexOf(key)] ?? '';
    const icons = { melee: 'fa-solid fa-sword', ranged: 'fa-solid fa-gun', fantascience: 'fa-solid fa-hat-wizard', oldtech: 'fa-solid fa-gamepad' };
    const isPowerRoll = this.type === RollType.POWER || this.type === RollType.POWER_ALBUM;
    let icon = 'fa-solid fa-dice-d20';
    let color = abilityColor(this.ability);
    if (this.type === RollType.ATTACK) icon = icons[this.attack] ?? 'fa-solid fa-swords';
    if (this.type === RollType.DAMAGE) {
      icon = 'fa-solid fa-burst';
      color = 'rust';
    }
    if (isPowerRoll) {
      icon = 'fa-solid fa-wand-magic-sparkles';
      color = 'heart';
    }
    const chips = [];
    if (this.type === RollType.ATTACK && this.attackItem?.name && this.#attackKind()) chips.push(this.#attackKind());
    if (this.ability && this.type !== RollType.ABILITY && CONFIG.SDM.abilityAbbreviations?.[this.ability]) {
      chips.push({ text: $l10n(CONFIG.SDM.abilityAbbreviations[this.ability]), color: abilityColor(this.ability) });
    }
    if (this.skill?.name) chips.push(`${this.skill.name}${this.skill.mod ? ` ${this.skill.mod > 0 ? '+' : ''}${this.skill.mod}` : ''}`);
    if ([RollType.ATTACK, RollType.POWER, RollType.POWER_ALBUM].includes(this.type) && this.attackTarget && this.attackTarget !== AttackTarget.PHYSICAL) {
      chips.push($l10n('SDM.Attack' + capitalizeFirstLetter(this.attackTarget)).toLowerCase());
    }
    if (fixedModifiers) chips.push({ text: `${fixedModifiers > 0 ? '+' : ''}${fixedModifiers}`, tooltip: $l10n('SDM.RollModifiers') });
    if (diceModifiers) chips.push(`${diceModifiers}`);
    if (this.mode && this.mode !== RollMode.NORMAL) chips.push($l10n(CONFIG.SDM.rollMode[this.mode] ?? this.mode).toLowerCase());
    if (this.versatile) chips.push($l10n('SDM.TwoHanded').toLowerCase());
    if (this.type === RollType.DAMAGE && this.explodingDice) chips.push($l10n('SDM.ExplodingDice').toLowerCase());
    // A power: its range, target and duration as written
    if (isPowerRoll) {
      const power =
        this.type === RollType.POWER
          ? this.item?.system?.power
          : (this.item?.system?.powers ?? []).find(p => `${p.name ?? ''}`.trim() === `${this.powerName ?? this.from ?? ''}`.trim());
      for (const field of ['range', 'target', 'duration']) if (power?.[field]) chips.push(`${power[field]}`);
      if (this.overcharged) chips.push({ text: $l10n('SDM.PowerOvercharge').toLowerCase(), color: 'heart' });
    }
    const damageMultiplier = CONFIG.SDM.getDamageMultiplier(this.actor?.system?.base_damage_multiplier || 2);
    const badge = this.multiplier ? `${damageMultiplier[this.multiplier] ?? `${this.multiplier}`}`.replace('*', '×').replace(/^x/, '×') : '';
    return { icon, color, title: this.#cardTitle(), badge, chips };
  }

  #buildFlavorText(fixedModifiers, diceModifiers) {
    if (this.type === 'save') {
      let text = this.from;
      const ward = this.actor.system?.ward;
      if (ward) {
        text += ` (${$l10n('TYPES.Item.ward').toLowerCase()} +${ward})`;
      }
      return text;
    }

    const actorData = this.actor?.system;
    const damageMultiplier = CONFIG.SDM.getDamageMultiplier(actorData.base_damage_multiplier || 2);
    const rollMode =
      this.mode === RollMode.NORMAL ? '' : $l10n(`SDM.Roll${capitalizeFirstLetter(this.mode)}Abbr`);
    const versatileLabel = $l10n('SDM.FeatureVersatile');
    const type = this.type === 'power_album' ? 'power' : this.type;
    const parts = [`[${$l10n(`SDM.${toPascalCase(type)}`)}]`, this.from];
    if (
      [RollType.ATTACK, RollType.POWER, RollType.POWER_ALBUM].includes(this.type) &&
      this.attackTarget !== AttackTarget.PHYSICAL
    ) {
      parts.push(`(${$l10n('SDM.Attack' + capitalizeFirstLetter(this.attackTarget))})`);
    }
    if (this.type !== RollType.ABILITY && this.ability)
      parts.push(`(${$l10n(CONFIG.SDM.abilityAbbreviations[this.ability])})`);
    if (this.skill) parts.push(`(${this.skill.name})`);
    if (this.versatile) parts.push(`(${versatileLabel})`);
    if (diceModifiers) parts.push(`(${diceModifiers})`);
    if (fixedModifiers) parts.push(`(${fixedModifiers >= 0 ? '+' : ''}${fixedModifiers})`);
    if (rollMode) parts.push(`(${rollMode})`);
    if (this.multiplier) parts.push(`(${damageMultiplier[this.multiplier] ?? `${this.multiplier}`.replace('*', 'x')})`);
    if (this.type === RollType.DAMAGE && this.explodingDice) parts.push(`(d*)`);

    const flavor = parts.join(' ');
    return flavor;
  }

  #parseModifierString(modifier = '') {
    return modifier.split(/(?=[+-])/g).filter(c => c !== '');
  }

  #separateFixedAndDice(components) {
    return components.reduce(
      (acc, component) => {
        if (component.includes('d')) {
          acc.diceModifiers += component;
        } else {
          const value = parseInt(component, 10) || 0;
          acc.fixedModifiers += value;
        }
        return acc;
      },
      { fixedModifiers: 0, diceModifiers: '' }
    );
  }
}

export function sanitizeExpression(rollExpression) {
  const cleaned = rollExpression
    .replace(/\+-+/g, '-')
    .replace(/(?<!^)-+/g, '-')
    .replace(/\++/g, '+')
    .replace(/(^[+ ]+)|([+ ]+$)/g, '')
    .replace(/\s+/g, '');

  foundry.dice.Roll.validate(cleaned);
  return cleaned;
}

export function collectAllDice(term) {
  if (term instanceof foundry.dice.terms.Die) return [term];
  if (term instanceof foundry.dice.terms.PoolTerm) {
    return term.rolls.flatMap(collectAllDice);
  }
  if (term instanceof foundry.dice.terms.ParentheticalTerm) {
    return collectAllDice(term.term);
  }
  if (Array.isArray(term.terms)) {
    return term.terms.flatMap(collectAllDice);
  }
  return [];
}

/**
 * Consecutive natural 20s of the kept d20 (an exploding d20 rolling 20, 20, …): 0 when the kept die
 * didn't start with a 20.
 */
export function countConsecutiveTwenties(roll) {
  let best = 0;
  const count = die => {
    if (!(die instanceof foundry.dice.terms.Die) || die.faces !== 20) return;
    let n = 0;
    for (const result of die.results) {
      if (result.result !== 20) break;
      n++;
    }
    best = Math.max(best, n);
  };
  for (const term of roll?.terms ?? []) {
    if (term instanceof foundry.dice.terms.PoolTerm) {
      term.results.forEach((res, index) => {
        if (res.active && term.rolls[index]) collectAllDice(term.rolls[index]).forEach(count);
      });
    } else collectAllDice(term).forEach(count);
  }
  return best;
}

/** The damage multiplier for consecutive natural 20s: the base (×2) for one, doubled for each more. */
export function criticalMultiplier(actor, twenties) {
  if (!twenties) return '';
  const base = Number(actor?.system?.base_damage_multiplier) || 2;
  const options = Object.keys(CONFIG.SDM.getDamageMultiplier(base));
  return options[Math.min(twenties, options.length) - 1] ?? '';
}

export function detectNat1OrNat20(roll) {
  let results = [];

  for (const term of roll.terms) {
    if (term instanceof foundry.dice.terms.PoolTerm) {
      term.results.forEach((res, index) => {
        if (!res.active) return;

        const subRoll = term.rolls[index];
        if (!subRoll) return;

        const dice = collectAllDice(subRoll);
        for (const die of dice) {
          if (!(die instanceof foundry.dice.terms.Die)) continue;

          const first = die.results.find(r => r.active);
          if (first) results.push(first.result);
        }
      });
    } else {
      const dice = collectAllDice(term);
      for (const die of dice) {
        if (!(die instanceof foundry.dice.terms.Die)) continue;

        const first = die.results.find(r => r.active);
        if (first) results.push(first.result);
      }
    }
  }

  results = results.sort((a, b) => b - a);

  if (results[0] === 13) {
    return { isNat1: false, is13: true, is7: false, isNat20: false };
  }

  if (results[0] === 7) {
    return { isNat1: false, is13: false, is7: true, isNat20: false };
  }

  for (const r of results.sort((a, b) => b - a)) {
    if (r === 1) return { isNat1: true, is13: false, is7: false, isNat20: false };
    if (r === 20) return { isNat1: false, is13: false, is7: false, isNat20: true };
  }

  return { isNat1: false, is13: false, is7: false, isNat20: false };
}
