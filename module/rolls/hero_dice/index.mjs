import { createChatMessage } from '../../helpers/chatUtils.mjs';
import { ActorType, Die } from '../../helpers/constants.mjs';
import { $fmt, $l10n } from '../../helpers/globalUtils.mjs';
import { requestSettingUpdate } from '../../settingsSocket.mjs';
import { HeroDiceEngine } from './core/HeroDiceEngine.mjs';
import { HeroDiceUI } from './ui/HeroDiceUi.mjs';

async function _promptHeroOptions(actor, bonusHeroDice = 0) {
  const defaultHeroDiceType = game.settings.get('sdm', 'defaultHeroDiceType');
  const heroDiceType = actor?.system?.hero_dice?.dice_type || defaultHeroDiceType;

  const shouldPrompHealingHouseRule = false;

  return foundry.applications.api.DialogV2.prompt({
    window: {
      title: `${actor.name} ${$l10n('SDM.RollUseHeroDice')}`
    },
    content: HeroDiceUI.getHeroDiceSelect(actor, false, shouldPrompHealingHouseRule, bonusHeroDice),
    ok: {
      icon: `die-label dice-${heroDiceType}`,
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

  const maxDice = actor.system.hero_dice.value;
  const bonusHDPool = game.settings.get('sdm', 'bonusHeroDicePool');

  if (maxDice < 1 && bonusHDPool < 1) {
    ui.notifications.error($fmt('SDM.ErrorActorNoHeroDice', { actor: actor.name }));
    return;
  }

  const originalRoll = message.rolls[0];


  const options = await _promptHeroOptions(actor, bonusHDPool);
  if (!options) return;

  const { heroicQty = 0, heroMode = 'increase' } = options;
  const heroicDiceQty = parseInt(heroicQty || 0, 10);

  if (heroicDiceQty > maxDice) return;

  const result = await HeroDiceEngine.process(originalRoll, heroicDiceQty, bonusHDPool, actor, { mode: heroMode });

  if (bonusHDPool > 0) {
    await requestSettingUpdate('bonusHeroDicePool', 0);
  }

  await HeroDiceUI.renderResultToChat(result, actor, flags, bonusHDPool);
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

  if (maxDice < 1) return ui.notifications.error($l10n('SDM.ErrorNoHeroDice'));

  const defaultHeroDiceType = game.settings.get('sdm', 'defaultHeroDiceType');
  const heroDiceType = actor?.system?.hero_dice?.dice_type || defaultHeroDiceType;

  const title = `${$l10n('SDM.RollUseHeroDice')}${onlySpendWithoutRolling ? `, ${$l10n('SDM.WithoutRollingDice')}` : ''}`;

  const heroicDiceOptions = await foundry.applications.api.DialogV2.prompt({
    window: {
      title
    },
    content: HeroDiceUI.getHeroDiceSelect(actor, false, healingHouseRuleEnabled, bonusHeroDice, includeModeToggle),
    ok: {
      icon: `die-label dice-${heroDiceType}`,
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
      healingHouseRule
    });
    rolls.push(roll);
    flags['sdm.isHeroResult'] = true;
  } else {
    const bonusHDPool = game.settings.get('sdm', 'bonusHeroDicePool');
    const { success } = await requestSettingUpdate('bonusHeroDicePool', bonusHDPool + heroicDiceQty);
    if (!success) {
      return;
    }
    flags['sdm.noHeroDice'] = true;
  }

  const diceLabel = heroicDiceQty > 1 ? $l10n('SDM.HeroDice') : $l10n('SDM.HeroDie');

  let flavor = $fmt('SDM.HeroDiceSpend', {
    actor: actor.name,
    quantity: heroicDiceQty,
    diceLabel: diceLabel
  });

  if (onlySpendWithoutRolling) {
    flavor += `, ${$l10n('SDM.WithoutRollingDice')}`;
  }

  await createChatMessage({
    actor,
    flavor,
    rolls,
    flags
  });

  await HeroDiceEngine.updateHeroDice(actor, heroicDiceQty);
}
