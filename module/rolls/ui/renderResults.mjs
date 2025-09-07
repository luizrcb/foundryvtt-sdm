import { createChatMessage } from '../../helpers/chatUtils.mjs';
import { RollType } from '../../helpers/constants.mjs';
import { $fmt, $l10n } from '../../helpers/globalUtils.mjs';
import { templatePath } from '../../helpers/templates.mjs';

const { renderTemplate } = foundry.applications.handlebars;

export async function renderNPCMoraleResult(
  { roll, targetNumber },
  { fromHeroDice = false, speaker, isCtrl = false }
) {
  const equalOutcome = $l10n('SDM.MoraleEqualOutcome');
  const overOutcome = $l10n('SDM.MoraleOverOutcome');
  const underOutcome = $l10n('SDM.MoraleUnderOutcome');

  // Determine outcome and message
  let outcome, message;
  if (roll.total === targetNumber) {
    outcome = equalOutcome;
    message = $l10n('SDM.MoraleEqualOutcomeMessage');
  } else if (roll.total > targetNumber) {
    outcome = overOutcome;
    message = $l10n('SDM.MoraleOverOutcomeMessage');
  } else {
    outcome = underOutcome;
    message = $l10n('SDM.MoraleUnderOutcomeMessage');
  }

  const templateData = {
    outcome,
    message,
    formula: roll.formula,
    total: roll.total,
    targetLabel: $l10n('SDM.Target'),
    targetNumber,
    rollTooltip: await roll.getTooltip()
  };

  const flags = {};

  if (fromHeroDice === true) {
    flags['sdm.isHeroResult'] = true;
  } else {
    flags['sdm.morale'] = {
      targetNumber,
      speaker
    };
  }

  const chatMessageData = {
    content: await renderTemplate(templatePath('chat/morale-roll-result'), templateData),
    flavor: $fmt('SDM.RollType', { type: $l10n('SDM.Morale') }),
    rolls: [roll],
    speaker,
    flags
  };

  if (isCtrl) {
    chatMessageData.rollMode = CONST.DICE_ROLL_MODES.BLIND;
  }

  await createChatMessage(chatMessageData);
}

export async function renderReactionResult(
  { roll, charismaOperator },
  { fromHeroDice = false, speaker, isCtrl = false }
) {
  const rollTotal = roll.total;

  // Configuration object for reaction outcomes
  const reactionConfig = [
    {
      min: -Infinity,
      max: 1,
      outcomeKey: 'SDM.ReactionOutcome1',
      messageKey: 'SDM.ReactionMessage1'
    },
    { min: 2, max: 2, outcomeKey: 'SDM.ReactionOutcome2', messageKey: 'SDM.ReactionMessage2' },
    {
      min: 3,
      max: 5,
      outcomeKey: 'SDM.ReactionOutcome3to5',
      messageKey: 'SDM.ReactionMessage3to5'
    },
    {
      min: 6,
      max: 8,
      outcomeKey: 'SDM.ReactionOutcome6to8',
      messageKey: 'SDM.ReactionMessage6to8'
    },
    {
      min: 9,
      max: 11,
      outcomeKey: 'SDM.ReactionOutcome9to11',
      messageKey: 'SDM.ReactionMessage9to11'
    },
    {
      min: 12,
      max: 12,
      outcomeKey: 'SDM.ReactionOutcome12',
      messageKey: 'SDM.ReactionMessage12'
    },
    {
      min: 13,
      max: Infinity,
      outcomeKey: 'SDM.ReactionOutcome13plus',
      messageKey: 'SDM.ReactionMessage13plus'
    }
  ];

  // Find matching configuration
  const matchedConfig =
    reactionConfig.find(config => rollTotal >= config.min && rollTotal <= config.max) ||
    reactionConfig[reactionConfig.length - 1]; // Fallback to last config

  // Get localized strings
  const outcome = $l10n(matchedConfig.outcomeKey);
  const message = $l10n(matchedConfig.messageKey);

  const templateData = {
    outcome,
    message,
    formula: roll.formula,
    total: roll.total,
    rollTooltip: await roll.getTooltip()
  };

  const flavor = `[${$l10n('SDM.Reaction')}] ${
    charismaOperator > 0 ? $l10n('SDM.ReactionCheck') : $fmt('SDM.ReactionProvokeConflict')
  }`;

  const flags = {};

  if (fromHeroDice === true) {
    flags['sdm.isHeroResult'] = true;
  } else {
    flags['sdm.reaction'] = {
      charismaOperator,
      speaker
    };
  }

  const chatMessageData = {
    content: await renderTemplate(templatePath('chat/reaction-roll-result'), templateData),
    flavor,
    rolls: [roll],
    flags,
    speaker
  };

  if (isCtrl) {
    chatMessageData.rollMode = CONST.DICE_ROLL_MODES.BLIND;
  }

  await createChatMessage(chatMessageData);
}

export async function renderSaveResult(
  { roll, label, targetNumber },
  { fromHeroDice = false, speaker, isCtrl = false }
) {
  const sacrificeOutcome = $l10n('SDM.SavingThrowSacrifice');
  const saveOutcome = $l10n('SDM.SavingThrowSave');
  const doomOutcome = $l10n('SDM.SavingThrowDoom');

  // Determine outcome and message
  let outcome, message;
  if (roll._total === targetNumber) {
    outcome = sacrificeOutcome;
    message = $l10n('SDM.SavingThrowSacrificeMessage');
  } else if (roll._total > targetNumber) {
    outcome = saveOutcome;
    message = $l10n('SDM.SavingThrowSaveMessage');
  } else {
    outcome = doomOutcome;
    message = $l10n('SDM.SavingThrowDoomMessage');
  }

  let borderColor = '#aa0200';

  if (outcome === saveOutcome) {
    borderColor = '#18520B';
  } else if (outcome === sacrificeOutcome) {
    borderColor = '#d4af37';
  }

  const templateData = {
    outcome,
    message,
    formula: roll.formula,
    total: roll._total,
    borderColor,
    targetLabel: $l10n('SDM.Target'),
    targetNumber,
    rollTooltip: await roll.getTooltip()
  };

  const flags = {};

  if (fromHeroDice === true) {
    flags['sdm.isHeroResult'] = true;
  } else {
    flags['sdm.' + RollType.SAVE] = {
      label,
      targetNumber,
      speaker
    };
  }

  const chatMessageData = {
    content: await renderTemplate(templatePath('chat/saving-throw-result'), templateData),
    flavor: label,
    rolls: [roll],
    checkCritical: true,
    flags,
    speaker
  };

  if (isCtrl) {
    chatMessageData.rollMode = CONST.DICE_ROLL_MODES.BLIND;
  }

  await createChatMessage(chatMessageData);
}
