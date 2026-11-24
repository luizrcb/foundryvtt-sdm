import { createChatMessage } from '../../helpers/chatUtils.mjs';
import { ActorType, Die } from '../../helpers/constants.mjs';
import { $fmt, $l10n, toPascalCase } from '../../helpers/globalUtils.mjs';
import { requestSettingUpdate } from '../../settingsSocket.mjs';
import { HeroDiceEngine } from './core/HeroDiceEngine.mjs';
import { HeroDiceUI } from './ui/HeroDiceUi.mjs';
import { cardHeader, cardWrap, rollBox } from '../ui/cardParts.mjs';
import { applyDamageHtml } from '../ui/applyDamage.mjs';
import { applyInitiativeHeroDice, canSpendOnInitiative, initiativeData } from '../../helpers/initiativeHeroDice.mjs';

export async function _promptHeroOptions(actor, bonusHeroDice = 0) {
  const defaultHeroDiceType = game.settings.get('sdm', 'defaultHeroDiceType');
  const heroDiceType = actor?.system?.hero_dice?.dice_type || defaultHeroDiceType;

  const shouldPrompHealingHouseRule = false;

  return foundry.applications.api.DialogV2.prompt({
    window: {
      title: `${actor.name} ${$l10n('SDM.RollUseHeroDice')}`
    },
    content: HeroDiceUI.getHeroDiceSelect(actor, false, shouldPrompHealingHouseRule, bonusHeroDice, true, 'hero_dice', true),
    ok: {
      icon: `fa-solid fa-dice-${heroDiceType}`,
      label: $l10n('SDM.ButtonRoll'),
      callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
    }
  });
}

export async function handleHeroDice(event, message, flags) {
  const actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;

  if (message.blind) return;

  if (!actor || actor.type !== ActorType.CHARACTER) {
    ui.notifications.error(
      $fmt('SDM.ErrorNoActorSelected', { type: $l10n('TYPES.Actor.character') })
    );
    return;
  }
  const touristDice = actor.system.tourist_dice?.enabled ? actor.system.tourist_dice.value : 0;
  const maxDice = actor.system.hero_dice.value + touristDice;
  const bonusHDPool = game.settings.get('sdm', 'bonusHeroDicePool');

  if (maxDice < 1 && bonusHDPool < 1) {
    ui.notifications.error($fmt('SDM.ErrorActorNoHeroDice', { actor: actor.name }));
    return;
  }

  // An initiative card: only until the round's first turn ends
  const initiative = initiativeData(message);
  if (initiative && !canSpendOnInitiative(message)) {
    ui.notifications.warn($l10n('SDM.InitiativeHero.Closed'));
    event?.currentTarget?.remove?.();
    return;
  }

  // A hero dice result: spent again on the dice as they are now, with the original roll's flags
  const heroRoll = message.getFlag?.('sdm', 'heroRoll');
  const originalRoll = heroRoll ? Roll.fromData(heroRoll) : message.rolls[0];
  if (heroRoll) flags = message.getFlag('sdm', 'heroFlags') ?? {};

  const options = await _promptHeroOptions(actor, bonusHDPool);
  if (!options) return;

  const { heroicQty = 0, heroMode = 'increase' } = options;
  const heroicDiceQty = parseInt(heroicQty || 0, 10);

  if (heroicDiceQty > maxDice) return;

  const result = await HeroDiceEngine.process(originalRoll, heroicDiceQty, bonusHDPool, actor, {
    mode: heroMode
  });

  if (bonusHDPool > 0) {
    await requestSettingUpdate('bonusHeroDicePool', 0);
  }

  // The result remembers the message it changed (a save's sacrifice buttons go once it is changed)
  const withSource = foundry.utils.mergeObject(foundry.utils.deepClone(flags ?? {}), { sdm: { sourceMessage: message.id } });
  await HeroDiceUI.renderResultToChat(result, actor, withSource, bonusHDPool, heroMode, originalRoll);
  // An initiative roll: the new total for everyone it set
  if (initiative) await applyInitiativeHeroDice(initiative, result.total);
}

/**
 * Handles heroic dice usage for healing purposes
 * @async
 * @param {Event} event - The triggering event
 * @param {Actor} actor - Actor using healing heroic dice
 */
export async function healingHeroDice(event, actor, onlySpendWithoutRolling = false) {
  const healingHouseRuleEnabled = !!game.settings.get('sdm', 'healingHouseRule');
  const maxDice = actor.system.hero_dice.value;
  const bonusHeroDice = 0;
  const includeModeToggle = false;

  if (maxDice < 1)
    return ui.notifications.error(
      $fmt('SDM.ErrorNoHeroDice', { type: $l10n('SDM.FieldHeroDice') })
    );

  const defaultHeroDiceType = game.settings.get('sdm', 'defaultHeroDiceType');
  const heroDiceType = actor?.system?.hero_dice?.dice_type || defaultHeroDiceType;

  const title = `${$l10n('SDM.RollUseHeroDice')}${onlySpendWithoutRolling ? `, ${$l10n('SDM.WithoutRollingDice')}` : ''}`;

  const heroicDiceOptions = await foundry.applications.api.DialogV2.prompt({
    window: {
      title
    },
    content: HeroDiceUI.getHeroDiceSelect(
      actor,
      false,
      healingHouseRuleEnabled,
      bonusHeroDice,
      includeModeToggle,
      'hero_dice',
      false
    ),
    ok: {
      icon: `fa-solid fa-dice-${heroDiceType}`,
      label: $l10n('SDM.ButtonRoll'),
      callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
    }
  });

  if (heroicDiceOptions === null) {
    return;
  }

  const { heroicQty = '0', healingHouseRule = false } = heroicDiceOptions;
  const heroicDiceQty = parseInt(heroicQty || 0, 10);
  const currentHeroDice = actor.system.hero_dice.value;
  let rolls = [];
  const flags = {};

  if (heroicDiceQty > currentHeroDice) return;

  if (!onlySpendWithoutRolling) {
    const roll = await HeroDiceEngine._rollHeroDice({
      quantity: heroicDiceQty,
      faces: Die[heroDiceType],
      displayDice: false,
      healingHouseRule,
      resource: 'hero_dice'
    });
    roll._formula = roll._formula.replace(/\[[^\]]*\]/g, '');
    rolls.push(roll);
    flags['sdm.isHeroResult'] = true;
  } else {
    const bonusHDPool = game.settings.get('sdm', 'bonusHeroDicePool');
    const { success } = await requestSettingUpdate(
      'bonusHeroDicePool',
      bonusHDPool + heroicDiceQty
    );
    if (!success) {
      return;
    }
    flags['sdm.noHeroDice'] = true;
  }

  const diceLabel = heroicDiceQty > 1 ? $l10n('SDM.HeroDicePl') : $l10n('SDM.HeroDice');

  let flavor = $fmt('SDM.HeroDiceSpend', {
    actor: actor.name,
    quantity: heroicDiceQty,
    diceLabel: diceLabel
  });

  if (onlySpendWithoutRolling) {
    flavor += `, ${$l10n('SDM.WithoutRollingDice')}`;
  }

  // Rolled for healing: the card heals the roller in one click (the Referee can undo it), and the
  // buttons apply the result to the selected tokens by hand
  let content;
  if (rolls.length) {
    const roll = rolls[0];
    const amount = Number(roll.total) || 0;
    const chips = [
      game.i18n.format(heroicDiceQty === 1 ? 'SDM.Card.HeroDieSpent' : 'SDM.Card.HeroDiceSpent', { count: heroicDiceQty })
    ];
    if (healingHouseRule) chips.push($l10n('SDM.SettingsHealingHouseRule'));
    const healButton =
      amount > 0
        ? `<div class="sdm-card-actions sdm-hero-heal" data-actor-uuid="${foundry.utils.escapeHTML(actor.uuid)}" data-amount="${amount}">` +
          `<button type="button" class="sdm-primary" data-action="sdmHeroHeal"><i class="fa-solid fa-heart"></i> ${foundry.utils.escapeHTML(
            $fmt('SDM.Card.HealSelf', { actor: actor.name, amount })
          )}</button></div>`
        : '';
    content = cardWrap(
      cardHeader({ icon: 'fa-solid fa-heart', color: 'lime', title: $l10n('SDM.Card.HeroHealTitle'), chips }) +
        (await rollBox(roll)) +
        healButton +
        applyDamageHtml(amount),
      { kind: 'hero' }
    );
    flags['sdm.heroHeal'] = true;
  }

  await createChatMessage({
    actor,
    flavor: content ? '' : flavor,
    content,
    rolls,
    flags
  });

  await HeroDiceEngine.updateHeroDice(actor, heroicDiceQty, false);
}

export async function directResourceDiceRoll(event, actor, resource) {
  if (!resource) return;

  const maxDice = actor.system[resource].value;
  const resourceName = toPascalCase(resource).replace(' ', '');

  if (maxDice < 1)
    return ui.notifications.error(
      $fmt('SDM.ErrorNoHeroDice', { type: $l10n(`SDM.Field${resourceName}`) })
    );
  const diceType = actor?.system[resource]?.dice_type;

  const title = $fmt('SDM.RollUse', { type: $l10n(`SDM.Field${resourceName}`) });

  const diceOptions = await foundry.applications.api.DialogV2.prompt({
    window: {
      title
    },
    content: HeroDiceUI.getHeroDiceSelect(actor, false, false, 0, false, resource, false),
    ok: {
      icon: `die-label dice-${diceType}`,
      label: $l10n('SDM.ButtonRoll'),
      callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
    }
  });

  if (diceOptions === null) {
    return;
  }

  const { heroicQty = '0' } = diceOptions;
  const diceQty = parseInt(heroicQty || 0, 10);
  const currentDice = actor.system[resource].value;
  let rolls = [];
  const flags = {};

  if (diceQty > currentDice) return;

  const roll = await HeroDiceEngine._rollHeroDice({
    quantity: diceQty,
    faces: Die[diceType],
    displayDice: false,
    healingHouseRule: false,
    resource
  });
  roll._formula = roll._formula.replace(/\[[^\]]*\]/g, '');
  rolls.push(roll);
  flags['sdm.isHeroResult'] = true;

  const diceLabel = diceQty > 1 ? $l10n(`SDM.${resourceName}Pl`) : $l10n(`SDM.${resourceName}`);

  let flavor = $fmt('SDM.HeroDiceSpend', {
    actor: actor.name,
    quantity: diceQty,
    diceLabel: diceLabel
  });

  await createChatMessage({
    actor,
    flavor,
    rolls,
    flags
  });

  await actor.updateResourceDice(resource, -diceQty);
}

/**
 * Handles blood dice usage
 * @async
 * @param {Event} event - The triggering event
 * @param {Actor} actor - Actor using blood dice
 */
export async function bloodDiceRoll(event, actor) {
  const maxDice = actor.system.blood_dice.value;

  if (maxDice < 1)
    return ui.notifications.error(
      $fmt('SDM.ErrorNoHeroDice', { type: $l10n('SDM.FieldBloodDice') })
    );
  const bloodDiceType = actor?.system?.blood_dice?.dice_type;

  const title = $l10n('SDM.RollUseBloodDice');

  const bloodDiceOptions = await foundry.applications.api.DialogV2.prompt({
    window: {
      title
    },
    content: HeroDiceUI.getHeroDiceSelect(actor, false, false, 0, false, 'blood_dice', false),
    ok: {
      icon: `die-label dice-${bloodDiceType}`,
      label: $l10n('SDM.ButtonRoll'),
      callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
    }
  });

  if (bloodDiceOptions === null) {
    return;
  }

  const { heroicQty = '0' } = bloodDiceOptions;
  const bloodDiceQty = parseInt(heroicQty || 0, 10);
  const currentBloodDice = actor.system.blood_dice.value;
  let rolls = [];
  const flags = {};

  if (bloodDiceQty > currentBloodDice) return;

  const roll = await HeroDiceEngine._rollHeroDice({
    quantity: bloodDiceQty,
    faces: Die[bloodDiceType],
    displayDice: false,
    healingHouseRule: false,
    resource: 'blood_dice'
  });
  rolls.push(roll);
  flags['sdm.isHeroResult'] = true;

  const diceLabel = bloodDiceQty > 1 ? $l10n('SDM.BloodDicePl') : $l10n('SDM.BloodDice');

  let flavor = $fmt('SDM.HeroDiceSpend', {
    actor: actor.name,
    quantity: bloodDiceQty,
    diceLabel: diceLabel
  });

  await createChatMessage({
    actor,
    flavor,
    rolls,
    flags
  });

  await actor.updateBloodDice(bloodDiceQty);
}
