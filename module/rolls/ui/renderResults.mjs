import { createChatMessage } from '../../helpers/chatUtils.mjs';
import { RollType } from '../../helpers/constants.mjs';
import { $fmt, $l10n, toPascalCase } from '../../helpers/globalUtils.mjs';
import { templatePath } from '../../helpers/templates.mjs';
import { cardHeader, rollBox } from './cardParts.mjs';
import { detectNat1OrNat20 } from '../sdmRoll.mjs';
import { awardNat20HeroDie } from '../../helpers/heroDieOnNat20.mjs';

const { renderTemplate } = foundry.applications.handlebars;

/**
 * The card for table and target rolls (save, usage, danger, morale, reaction, defeat, corruption,
 * group chase, relife): title, the roll box, and a strip with the outcome (its message under it,
 * the target number when there is one), then any extra HTML (triggers, a save's condition line).
 * Tone: from the old border color (save / usage / danger), else neutral.
 */
async function renderCard(data, roll, title, { extra = '', icon = 'fa-solid fa-dice-d20', tone = null, chips = [] } = {}) {
  const toneFor = { '#aa0200': 'bad', '#18520B': 'good', '#d4af37': 'mid' };
  return renderTemplate(templatePath('chat/roll-result-card'), {
    ...data,
    header: cardHeader({ icon, title, chips }),
    outcome: String(data.outcome ?? '').toUpperCase(),
    outcomeLong: String(data.outcome ?? '').length > 12,
    tone: tone ?? toneFor[data.borderColor] ?? 'neutral',
    rollBox: await rollBox(roll),
    extra: extra || ''
  });
}

export async function renderNPCMoraleResult(
  { roll, targetNumber },
  { fromHeroDice = false, speaker, isCtrl = false }
) {
  const equalOutcome = $l10n('SDM.MoraleEqualOutcome');
  const overOutcome = $l10n('SDM.MoraleOverOutcome');
  const underOutcome = $l10n('SDM.MoraleUnderOutcome');

  // Determine outcome and message
  let outcome, message;
  // The NPC's side: keeps fighting (green), a last push (amber), breaks (red)
  let tone = 'good';
  if (roll.total === targetNumber) {
    outcome = equalOutcome;
    tone = 'mid';
    message = $l10n('SDM.MoraleEqualOutcomeMessage');
  } else if (roll.total > targetNumber) {
    outcome = overOutcome;
    tone = 'bad';
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
    content: await renderCard(templateData, roll, $fmt('SDM.RollType', { type: $l10n('SDM.Morale') }), { icon: 'fa-solid fa-flag', tone }),
    flavor: '',
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
    content: await renderCard(templateData, roll, flavor),
    flavor: '',
    rolls: [roll],
    flags,
    speaker
  };

  if (isCtrl) {
    chatMessageData.rollMode = CONST.DICE_ROLL_MODES.BLIND;
  }

  await createChatMessage(chatMessageData);
}

export async function renderDefeatResult(
  { roll, selectedAbility },
  { fromHeroDice = false, speaker, isCtrl = false, extraHtml = '' }
) {
  const rollTotal = roll.total;

  const defeatConfig = [
    {
      min: -Infinity,
      max: 1,
      outcome: 'SDM.DefeatOutcome1',
      message: 'SDM.DefeatMessage1'
    },
    {
      min: 2,
      max: 6,
      outcome: 'SDM.DefeatOutcome2to6',
      message: 'SDM.DefeatMessage2to6'
    },
    {
      min: 7,
      max: 7,
      outcome: 'SDM.DefeatOutcome7',
      message: 'SDM.DefeatMessage7'
    },
    {
      min: 8,
      max: 8,
      outcome: 'SDM.DefeatOutcome8',
      message: 'SDM.DefeatMessage8'
    },
    {
      min: 9,
      max: 9,
      outcome: 'SDM.DefeatOutcome9',
      message: 'SDM.DefeatMessage9'
    },
    {
      min: 10,
      max: 10,
      outcome: 'SDM.DefeatOutcome10',
      message: 'SDM.DefeatMessage10'
    },
    {
      min: 11,
      max: 11,
      outcome: 'SDM.DefeatOutcome11',
      message: 'SDM.DefeatMessage11'
    },
    {
      min: 12,
      max: Infinity,
      outcome: 'SDM.DefeatOutcome12plus',
      message: 'SDM.DefeatMessage12plus'
    }
  ];

  const matchedConfig =
    defeatConfig.find(config => rollTotal >= config.min && rollTotal <= config.max) ||
    defeatConfig[defeatConfig.length - 1];

  const outcome = $l10n(matchedConfig.outcome);
  const message = $l10n(matchedConfig.message);

  const templateData = {
    outcome,
    message,
    formula: roll.formula,
    total: roll.total,
    rollTooltip: await roll.getTooltip()
  };

  let damageType = '';

  if (selectedAbility === 'end') {
    damageType = ` (${$l10n('SDM.AttackPhysical')})`;
  }

  if (selectedAbility === 'aur') {
    damageType = ` (${$l10n('SDM.AttackMental')})`;
  }

  const defeatLabel = $l10n('SDM.Defeat');

  let flavor = `[${defeatLabel}]${damageType}`;

  const flags = {};

  if (fromHeroDice === true) {
    flags['sdm.isHeroResult'] = true;
  } else {
    flags['sdm.defeat'] = {
      speaker,
      selectedAbility
    };
  }

  const chatMessageData = {
    content: await renderCard(templateData, roll, flavor, { extra: extraHtml, icon: 'fa-solid fa-skull' }),
    flavor: '',
    rolls: [roll],
    flags,
    speaker
  };

  if (isCtrl) {
    chatMessageData.rollMode = CONST.DICE_ROLL_MODES.BLIND;
  }

  await createChatMessage(chatMessageData);
}

export async function renderCorruptionResult(
  { roll },
  { fromHeroDice = false, speaker, isCtrl = false }
) {
  const rollTotal = roll.total;

  const corruptionConfig = [
    {
      min: -Infinity,
      max: 2,
      outcome: 'SDM.CorruptionOutcome2less',
      message: 'SDM.CorruptionMessage2less'
    },
    {
      min: 3,
      max: 6,
      outcome: 'SDM.CorruptionOutcome3to6',
      message: 'SDM.CorruptionMessage3to6'
    },
    {
      min: 7,
      max: 10,
      outcome: 'SDM.CorruptionOutcome7to10',
      message: 'SDM.CorruptionMessage7to10'
    },
    {
      min: 11,
      max: 12,
      outcome: 'SDM.CorruptionOutcome11to12',
      message: 'SDM.CorruptionMessage11to12'
    },
    {
      min: 13,
      max: Infinity,
      outcome: 'SDM.CorruptionOutcome13plus',
      message: 'SDM.CorruptionMessage13plus'
    }
  ];

  const matchedConfig =
    corruptionConfig.find(config => rollTotal >= config.min && rollTotal <= config.max) ||
    corruptionConfig[corruptionConfig.length - 1];

  const outcome = $l10n(matchedConfig.outcome);
  const message = $l10n(matchedConfig.message);

  const templateData = {
    outcome,
    message,
    formula: roll.formula,
    total: roll.total,
    rollTooltip: await roll.getTooltip()
  };

  const corruptionLabel = $l10n('SDM.CorruptionExposureSeverity');

  let flavor = `[${corruptionLabel}]`;

  const flags = {};

  if (fromHeroDice === true) {
    flags['sdm.isHeroResult'] = true;
  } else {
    flags['sdm.corruption'] = {
      speaker
    };
  }

  const chatMessageData = {
    content: await renderCard(templateData, roll, flavor),
    flavor: '',
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
  { fromHeroDice = false, speaker, isCtrl = false, extraHtml = '', triggerCheck = null, cardTitle = '', chips = [] }
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

  // Optional: a natural 20 on the save gives a hero die (never on a result re-done by hero dice)
  if (fromHeroDice !== true && detectNat1OrNat20(roll).isNat20) {
    const actor = ChatMessage.getSpeakerActor(speaker);
    extraHtml = `${await awardNat20HeroDie(actor)}${extraHtml}`;
  }

  if (fromHeroDice === true) {
    flags['sdm.isHeroResult'] = true;
  } else {
    flags['sdm.' + RollType.SAVE] = {
      label,
      cardTitle,
      chips,
      targetNumber,
      speaker
    };
    // Hero dice can change this save: its triggers are checked again on the result
    if (triggerCheck) flags['sdm.triggerCheck'] = triggerCheck;
  }

  const chatMessageData = {
    content: await renderCard(templateData, roll, cardTitle || label, { extra: extraHtml, icon: 'fa-solid fa-shield-halved', chips }),
    flavor: '',
    rolls: [roll],
    checkCritical: true,
    flags,
    speaker
  };

  if (isCtrl) {
    chatMessageData.rollMode = CONST.DICE_ROLL_MODES.BLIND;
  }

  return createChatMessage(chatMessageData);
}

export async function renderUsageResult(
  { roll, label, target },
  { fromHeroDice = false, speaker, extraHtml = '' }
) {
  // Determine outcome and message
  let outcome, message;
  // A natural 13 always means one use left, even when the replenish score is 13 or higher
  const runningLow = roll._total === 13;
  const failed = !runningLow && roll._total <= target;
  if (failed) {
    outcome = $l10n('SDM.ItemStatusRunOut');
    message = $l10n('SDM.AllResourcesDepleted');
  } else if (runningLow) {
    outcome = $l10n('SDM.ItemStatusRunningLow');
    message = $l10n('SDM.DepletedResources');
  } else {
    outcome = $l10n('SDM.ItemStatusHaveEnough');
    message = $l10n('SDM.ResourcesKeepUsing');
  }

  let borderColor = '#aa0200';

  if (runningLow) {
    borderColor = '#d4af37';
  } else if (!failed) {
    borderColor = '#18520B';
  }

  const templateData = {
    outcome,
    message,
    formula: roll.formula,
    total: roll._total,
    borderColor,
    targetLabel: $l10n('SDM.Target'),
    targetNumber: target,
    rollTooltip: await roll.getTooltip()
  };

  const flags = {};

  if (fromHeroDice === true) {
    flags['sdm.isHeroResult'] = true;
  } else {
    flags['sdm.' + 'usage'] = {
      label,
      target,
      speaker
    };
  }

  const chatMessageData = {
    content: await renderCard(templateData, roll, label, { extra: extraHtml, icon: 'fa-solid fa-shield-halved' }),
    flavor: '',
    rolls: [roll],
    checkCritical: false,
    flags,
    speaker
  };

  await createChatMessage(chatMessageData);
}

export async function renderDangerResult(
  { roll, label, targetNumber },
  { fromHeroDice = false, speaker, isCtrl = false }
) {
  let outcome, message;
  const firstDie = roll.dice[0];
  const isCriticalFailure = firstDie && firstDie.total === 1;

  if (isCriticalFailure || roll._total <= targetNumber) {
    outcome = $l10n('SDM.DangerRollFailureOutcome');
    message = $l10n('SDM.DangerRollFailureMessage');
  } else {
    outcome = $l10n('SDM.DangerRollSucceessOutcome');
    message = $l10n('SDM.DangerRollSucceessMessage');
  }

  let borderColor = '#aa0200';
  if (roll._total > targetNumber) {
    borderColor = '#18520B';
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
    flags['sdm.' + 'danger'] = {
      label,
      targetNumber,
      speaker
    };
  }

  const chatMessageData = {
    content: await renderCard(templateData, roll, label, { icon: 'fa-solid fa-triangle-exclamation' }),
    flavor: '',
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

export async function renderGroupChaseResult(
  { roll, label },
  { fromHeroDice = false, speaker, isCtrl = false }
) {
  const total = roll.total;

  let outcomeKey, messageKey;
  if (total >= 1 && total <= 3) {
    outcomeKey = 'SDM.GroupChaseOutcomeFailureCritical';
    messageKey = 'SDM.GroupChaseMessageFailureCritical';
  } else if (total >= 4 && total <= 7) {
    outcomeKey = 'SDM.GroupChaseOutcomeFailure';
    messageKey = 'SDM.GroupChaseMessageFailure';
  } else if (total >= 8 && total <= 11) {
    outcomeKey = 'SDM.GroupChaseOutcomeLosing';
    messageKey = 'SDM.GroupChaseMessageLosing';
  } else if (total >= 12 && total <= 14) {
    outcomeKey = 'SDM.GroupChaseOutcomeGaining';
    messageKey = 'SDM.GroupChaseMessageGaining';
  } else if (total >= 15 && total <= 19) {
    outcomeKey = 'SDM.GroupChaseOutcomeCaught';
    messageKey = 'SDM.GroupChaseMessageCaught';
  } else if (total >= 20 && total <= 24) {
    outcomeKey = 'SDM.GroupChaseOutcomeCaughtWinning';
    messageKey = 'SDM.GroupChaseMessageCaughtWinning';
  } else if (total >= 25) {
    outcomeKey = 'SDM.GroupChaseOutcomeSurprise';
    messageKey = 'SDM.GroupChaseMessageSurprise';
  } else {
    outcomeKey = 'SDM.GroupChaseOutcomeDefault';
    messageKey = 'SDM.GroupChaseMessageDefault';
  }

  const outcome = $l10n(outcomeKey);
  const message = $l10n(messageKey);

  const templateData = {
    outcome,
    message,
    formula: roll.formula,
    total: roll.total,
    rollTooltip: await roll.getTooltip()
  };

  const flags = {};
  if (fromHeroDice === true) {
    flags['sdm.isHeroResult'] = true;
  } else {
    flags['sdm.groupChase'] = { speaker, label };
  }

  const chatMessageData = {
    content: await renderCard(templateData, roll, label, { icon: 'fa-solid fa-person-running' }),
    flavor: '',
    rolls: [roll],
    flags,
    speaker
  };

  if (isCtrl) {
    chatMessageData.rollMode = CONST.DICE_ROLL_MODES.BLIND;
  }

  await createChatMessage(chatMessageData);
}

export async function renderRelifeResult(
  { roll, label, cost, ability },
  { fromHeroDice = false, speaker, isCtrl = false }
) {
  const total = roll.total;

  let outcomeKey, messageKey;
  if (total >= 1 && total <= 5) {
    outcomeKey = `SDM.RelifeOutcome${ability}1to5`;
    messageKey = `SDM.RelifeMessage${ability}1to5`;
  } else if (total >= 6 && total <= 10) {
    outcomeKey = `SDM.RelifeOutcome${ability}6to10`;
    messageKey = `SDM.RelifeMessage${ability}6to10`;
  } else if (total >= 11 && total <= 15) {
    outcomeKey = `SDM.RelifeOutcome${ability}11to15`;
    messageKey = `SDM.RelifeMessage${ability}11to15`;
  } else if (total >= 16 && total <= 19) {
    outcomeKey = `SDM.RelifeOutcome${ability}16to19`;
    messageKey = `SDM.RelifeMessage${ability}16to19`;
  } else if (total >= 20) {
    outcomeKey = `SDM.RelifeOutcome${ability}20plus`;
    messageKey = `SDM.RelifeMessage${ability}20plus`;
  } else {
    outcomeKey = 'SDM.RelifeOutcomeDefault';
    messageKey = 'SDM.RelifeMessageDefault';
  }

  const outcome = $l10n(outcomeKey);
  const message = $l10n(messageKey);

  const templateData = {
    outcome,
    message,
    cost,
    formula: roll.formula,
    total: roll.total,
    rollTooltip: await roll.getTooltip()
  };

  const flags = {};
  if (fromHeroDice === true) {
    flags['sdm.isHeroResult'] = true;
  } else {
    flags['sdm.relife'] = {
      label,
      cost,
      ability,
      speaker
    };
  }

  const chatMessageData = {
    content: await renderCard(templateData, roll, label, { icon: 'fa-solid fa-heart-pulse' }),
    flavor: '',
    rolls: [roll],
    flags,
    speaker
  };

  if (isCtrl) {
    chatMessageData.rollMode = CONST.DICE_ROLL_MODES.BLIND;
  }

  await createChatMessage(chatMessageData);
}
