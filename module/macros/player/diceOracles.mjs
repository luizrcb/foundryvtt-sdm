import { $l10n } from '../../helpers/globalUtils.mjs';
import { sanitizeExpression } from '../../rolls/sdmRoll.mjs';

const { DialogV2 } = foundry.applications.api;

export async function diceOracles() {
  const oracleDiceStyle = game.settings.get('sdm', 'oracle_dice_style');

  const ORACLE_CONFIGS = {
    'quick-d6': {
      label: 'SDM.OracleLabel.quick-d6',
      formula: `1d6[${oracleDiceStyle}]`,
      showGrade: true,
      table: {
        1: {
          outcome: 'SDM.Oracle.quick-d6.1.outcome',
          description: 'SDM.Oracle.quick-d6.1.description',
          grade: 'SDM.Oracle.quick-d6.1.grade'
        },
        2: {
          outcome: 'SDM.Oracle.quick-d6.2.outcome',
          description: 'SDM.Oracle.quick-d6.2.description',
          grade: 'SDM.Oracle.quick-d6.2.grade'
        },
        3: {
          outcome: 'SDM.Oracle.quick-d6.3.outcome',
          description: 'SDM.Oracle.quick-d6.3.description',
          grade: 'SDM.Oracle.quick-d6.3.grade'
        },
        4: {
          outcome: 'SDM.Oracle.quick-d6.4.outcome',
          description: 'SDM.Oracle.quick-d6.4.description',
          grade: 'SDM.Oracle.quick-d6.4.grade'
        },
        5: {
          outcome: 'SDM.Oracle.quick-d6.5.outcome',
          description: 'SDM.Oracle.quick-d6.5.description',
          grade: 'SDM.Oracle.quick-d6.5.grade'
        },
        6: {
          outcome: 'SDM.Oracle.quick-d6.6.outcome',
          description: 'SDM.Oracle.quick-d6.6.description',
          grade: 'SDM.Oracle.quick-d6.6.grade'
        }
      }
    },
    'bell-2d6': {
      label: 'SDM.OracleLabel.bell-2d6',
      formula: `2d6[${oracleDiceStyle}]`,
      showGrade: true,
      table: {
        2: {
          outcome: 'SDM.Oracle.bell-2d6.2.outcome',
          description: 'SDM.Oracle.bell-2d6.2.description',
          grade: 'SDM.Oracle.bell-2d6.2.grade'
        },
        3: {
          outcome: 'SDM.Oracle.bell-2d6.3.outcome',
          description: 'SDM.Oracle.bell-2d6.3.description',
          grade: 'SDM.Oracle.bell-2d6.3.grade'
        },
        4: {
          outcome: 'SDM.Oracle.bell-2d6.4.outcome',
          description: 'SDM.Oracle.bell-2d6.4.description',
          grade: 'SDM.Oracle.bell-2d6.4.grade'
        },
        5: {
          outcome: 'SDM.Oracle.bell-2d6.5.outcome',
          description: 'SDM.Oracle.bell-2d6.5.description',
          grade: 'SDM.Oracle.bell-2d6.5.grade'
        },
        6: {
          outcome: 'SDM.Oracle.bell-2d6.6.outcome',
          description: 'SDM.Oracle.bell-2d6.6.description',
          grade: 'SDM.Oracle.bell-2d6.6.grade'
        },
        7: {
          outcome: 'SDM.Oracle.bell-2d6.7.outcome',
          description: 'SDM.Oracle.bell-2d6.7.description',
          grade: 'SDM.Oracle.bell-2d6.7.grade'
        },
        8: {
          outcome: 'SDM.Oracle.bell-2d6.8.outcome',
          description: 'SDM.Oracle.bell-2d6.8.description',
          grade: 'SDM.Oracle.bell-2d6.8.grade'
        },
        9: {
          outcome: 'SDM.Oracle.bell-2d6.9.outcome',
          description: 'SDM.Oracle.bell-2d6.9.description',
          grade: 'SDM.Oracle.bell-2d6.9.grade'
        },
        10: {
          outcome: 'SDM.Oracle.bell-2d6.10.outcome',
          description: 'SDM.Oracle.bell-2d6.10.description',
          grade: 'SDM.Oracle.bell-2d6.10.grade'
        },
        11: {
          outcome: 'SDM.Oracle.bell-2d6.11.outcome',
          description: 'SDM.Oracle.bell-2d6.11.description',
          grade: 'SDM.Oracle.bell-2d6.11.grade'
        },
        12: {
          outcome: 'SDM.Oracle.bell-2d6.12.outcome',
          description: 'SDM.Oracle.bell-2d6.12.description',
          grade: 'SDM.Oracle.bell-2d6.12.grade'
        }
      }
    },
    'd10-oracle': {
      label: 'SDM.OracleLabel.d10-oracle',
      formula: `1d10[${oracleDiceStyle}]`,
      showGrade: true,
      table: {
        1: {
          outcome: 'SDM.Oracle.d10-oracle.1.outcome',
          description: 'SDM.Oracle.d10-oracle.1.description',
          grade: 'SDM.Oracle.d10-oracle.1.grade'
        },
        2: {
          outcome: 'SDM.Oracle.d10-oracle.2.outcome',
          description: 'SDM.Oracle.d10-oracle.2.description',
          grade: 'SDM.Oracle.d10-oracle.2.grade'
        },
        3: {
          outcome: 'SDM.Oracle.d10-oracle.3.outcome',
          description: 'SDM.Oracle.d10-oracle.3.description',
          grade: 'SDM.Oracle.d10-oracle.3.grade'
        },
        4: {
          outcome: 'SDM.Oracle.d10-oracle.4.outcome',
          description: 'SDM.Oracle.d10-oracle.4.description',
          grade: 'SDM.Oracle.d10-oracle.4.grade'
        },
        5: {
          outcome: 'SDM.Oracle.d10-oracle.5.outcome',
          description: 'SDM.Oracle.d10-oracle.5.description',
          grade: 'SDM.Oracle.d10-oracle.5.grade'
        },
        6: {
          outcome: 'SDM.Oracle.d10-oracle.6.outcome',
          description: 'SDM.Oracle.d10-oracle.6.description',
          grade: 'SDM.Oracle.d10-oracle.6.grade'
        },
        7: {
          outcome: 'SDM.Oracle.d10-oracle.7.outcome',
          description: 'SDM.Oracle.d10-oracle.7.description',
          grade: 'SDM.Oracle.d10-oracle.7.grade'
        },
        8: {
          outcome: 'SDM.Oracle.d10-oracle.8.outcome',
          description: 'SDM.Oracle.d10-oracle.8.description',
          grade: 'SDM.Oracle.d10-oracle.8.grade'
        },
        9: {
          outcome: 'SDM.Oracle.d10-oracle.9.outcome',
          description: 'SDM.Oracle.d10-oracle.9.description',
          grade: 'SDM.Oracle.d10-oracle.9.grade'
        },
        10: {
          outcome: 'SDM.Oracle.d10-oracle.10.outcome',
          description: 'SDM.Oracle.d10-oracle.10.description',
          grade: 'SDM.Oracle.d10-oracle.10.grade'
        }
      }
    },
    'bell-2d10': {
      label: 'SDM.OracleLabel.bell-2d10',
      formula: `2d10[${oracleDiceStyle}]`,
      showGrade: false,
      table: {
        2: {
          outcome: 'SDM.Oracle.bell-2d10.2.outcome',
          description: 'SDM.Oracle.bell-2d10.2.description'
        },
        3: {
          outcome: 'SDM.Oracle.bell-2d10.3.outcome',
          description: 'SDM.Oracle.bell-2d10.3.description'
        },
        4: {
          outcome: 'SDM.Oracle.bell-2d10.4.outcome',
          description: 'SDM.Oracle.bell-2d10.4.description'
        },
        5: {
          outcome: 'SDM.Oracle.bell-2d10.5.outcome',
          description: 'SDM.Oracle.bell-2d10.5.description'
        },
        6: {
          outcome: 'SDM.Oracle.bell-2d10.6.outcome',
          description: 'SDM.Oracle.bell-2d10.6.description'
        },
        7: {
          outcome: 'SDM.Oracle.bell-2d10.7.outcome',
          description: 'SDM.Oracle.bell-2d10.7.description'
        },
        8: {
          outcome: 'SDM.Oracle.bell-2d10.8.outcome',
          description: 'SDM.Oracle.bell-2d10.8.description'
        },
        9: {
          outcome: 'SDM.Oracle.bell-2d10.9.outcome',
          description: 'SDM.Oracle.bell-2d10.9.description'
        },
        10: {
          outcome: 'SDM.Oracle.bell-2d10.10.outcome',
          description: 'SDM.Oracle.bell-2d10.10.description'
        },
        11: {
          outcome: 'SDM.Oracle.bell-2d10.11.outcome',
          description: 'SDM.Oracle.bell-2d10.11.description'
        },
        12: {
          outcome: 'SDM.Oracle.bell-2d10.12.outcome',
          description: 'SDM.Oracle.bell-2d10.12.description'
        },
        13: {
          outcome: 'SDM.Oracle.bell-2d10.13.outcome',
          description: 'SDM.Oracle.bell-2d10.13.description'
        },
        14: {
          outcome: 'SDM.Oracle.bell-2d10.14.outcome',
          description: 'SDM.Oracle.bell-2d10.14.description'
        },
        15: {
          outcome: 'SDM.Oracle.bell-2d10.15.outcome',
          description: 'SDM.Oracle.bell-2d10.15.description'
        },
        16: {
          outcome: 'SDM.Oracle.bell-2d10.16.outcome',
          description: 'SDM.Oracle.bell-2d10.16.description'
        },
        17: {
          outcome: 'SDM.Oracle.bell-2d10.17.outcome',
          description: 'SDM.Oracle.bell-2d10.17.description'
        },
        18: {
          outcome: 'SDM.Oracle.bell-2d10.18.outcome',
          description: 'SDM.Oracle.bell-2d10.18.description'
        },
        19: {
          outcome: 'SDM.Oracle.bell-2d10.19.outcome',
          description: 'SDM.Oracle.bell-2d10.19.description'
        },
        20: {
          outcome: 'SDM.Oracle.bell-2d10.20.outcome',
          description: 'SDM.Oracle.bell-2d10.20.description'
        }
      }
    },
    'skilled-d20': {
      label: 'SDM.OracleLabel.skilled-d20',
      formula: `1d20[${oracleDiceStyle}]`,
      showGrade: false,
      table: {
        1: {
          outcome: 'SDM.Oracle.skilled-d20.1.outcome',
          description: 'SDM.Oracle.skilled-d20.1.description'
        },
        2: {
          outcome: 'SDM.Oracle.skilled-d20.2.outcome',
          description: 'SDM.Oracle.skilled-d20.2.description'
        },
        3: {
          outcome: 'SDM.Oracle.skilled-d20.3.outcome',
          description: 'SDM.Oracle.skilled-d20.3.description'
        },
        4: {
          outcome: 'SDM.Oracle.skilled-d20.4.outcome',
          description: 'SDM.Oracle.skilled-d20.4.description'
        },
        5: {
          outcome: 'SDM.Oracle.skilled-d20.5.outcome',
          description: 'SDM.Oracle.skilled-d20.5.description'
        },
        6: {
          outcome: 'SDM.Oracle.skilled-d20.6.outcome',
          description: 'SDM.Oracle.skilled-d20.6.description'
        },
        7: {
          outcome: 'SDM.Oracle.skilled-d20.7.outcome',
          description: 'SDM.Oracle.skilled-d20.7.description'
        },
        8: {
          outcome: 'SDM.Oracle.skilled-d20.8.outcome',
          description: 'SDM.Oracle.skilled-d20.8.description'
        },
        9: {
          outcome: 'SDM.Oracle.skilled-d20.9.outcome',
          description: 'SDM.Oracle.skilled-d20.9.description'
        },
        10: {
          outcome: 'SDM.Oracle.skilled-d20.10.outcome',
          description: 'SDM.Oracle.skilled-d20.10.description'
        },
        11: {
          outcome: 'SDM.Oracle.skilled-d20.11.outcome',
          description: 'SDM.Oracle.skilled-d20.11.description'
        },
        12: {
          outcome: 'SDM.Oracle.skilled-d20.12.outcome',
          description: 'SDM.Oracle.skilled-d20.12.description'
        },
        13: {
          outcome: 'SDM.Oracle.skilled-d20.13.outcome',
          description: 'SDM.Oracle.skilled-d20.13.description'
        },
        14: {
          outcome: 'SDM.Oracle.skilled-d20.14.outcome',
          description: 'SDM.Oracle.skilled-d20.14.description'
        },
        15: {
          outcome: 'SDM.Oracle.skilled-d20.15.outcome',
          description: 'SDM.Oracle.skilled-d20.15.description'
        },
        16: {
          outcome: 'SDM.Oracle.skilled-d20.16.outcome',
          description: 'SDM.Oracle.skilled-d20.16.description'
        },
        17: {
          outcome: 'SDM.Oracle.skilled-d20.17.outcome',
          description: 'SDM.Oracle.skilled-d20.17.description'
        },
        18: {
          outcome: 'SDM.Oracle.skilled-d20.18.outcome',
          description: 'SDM.Oracle.skilled-d20.18.description'
        },
        19: {
          outcome: 'SDM.Oracle.skilled-d20.19.outcome',
          description: 'SDM.Oracle.skilled-d20.19.description'
        },
        20: {
          outcome: 'SDM.Oracle.skilled-d20.20.outcome',
          description: 'SDM.Oracle.skilled-d20.20.description'
        }
      }
    }
  };

  const ROLL_MODES = {
    disadvantage: { label: 'SDM.RollDisadvantage' },
    normal: { label: 'SDM.RollNormal' },
    advantage: { label: 'SDM.RollAdvantage' }
  };

  const defaultOracle = game.settings.get('sdm', 'oracleDice') || 'quick-d6';

  const content = `
<fieldset>
  <legend>${$l10n('SDM.DiceOracles')}</legend>

  <div class="form-group">
    <label>${$l10n('SDM.OracleType')}</label>
    <select name="oracleType" class="form-control">
      ${Object.entries(ORACLE_CONFIGS)
        .map(
          ([key, config]) =>
            `<option value="${key}" ${key === defaultOracle ? 'selected' : ''}>${$l10n(config.label)}</option>`
        )
        .join('')}
    </select>
  </div>

  <div class="form-group">
    <label>${$l10n('SDM.RollModifier')}</label>
    <input type="number" name="modifier" class="form-control" value="0" autofocus>
  </div>

  <div class="form-group">
    <label>${$l10n('SDM.RollMode')}</label>
    <select name="rollMode" class="form-control">
      ${Object.entries(ROLL_MODES)
        .map(
          ([key, mode]) =>
            `<option value="${key}" ${key === 'normal' ? 'selected' : ''}>${$l10n(mode.label)}</option>`
        )
        .join('')}
    </select>
  </div>

  <div class="form-group">
    <label>${$l10n('SDM.Question')}</label>
    <textarea name="question" class="form-control" rows="2"></textarea>
  </div>
</fieldset>
`;

  const data = await DialogV2.wait({
    window: {
      title: $l10n('SDM.DiceOracles')
    },
    position: {
      width: 500,
      height: 380
    },
    content,
    buttons: [
      {
        action: 'roll',
        label: $l10n('SDM.ConsultOracle'),
        icon: 'fa-solid fa-dice',
        callback: (event, button) =>
          new foundry.applications.ux.FormDataExtended(button.form).object
      }
    ],
    rejectClose: false,
    render: (event, dialog) => {
      const html = dialog.element;

      const modifierInput = html.querySelector('input[name="modifier"]');
      if (modifierInput) {
        modifierInput.focus();
        modifierInput.select();
      }

      const inputs = html.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();

            const rollButton = html.querySelector('button[data-action="roll"]');
            if (rollButton) {
              rollButton.click();
            }
          }
        });
      });
    }
  });

  if (!data) return;

  await rollOracle(data, ORACLE_CONFIGS);
}

async function rollOracle({ oracleType, modifier, rollMode, question }, oracle_configs) {
  const config = oracle_configs[oracleType];
  if (!config) {
    return;
  }

  await game.settings.set('sdm', 'oracleDice', oracleType);

  const modValue = parseInt(modifier) || 0;

  let formula = config.formula;
  if (rollMode === 'advantage' || rollMode === 'disadvantage') {
    const keepOp = rollMode === 'advantage' ? 'kh' : 'kl';
    formula = `{${config.formula}, ${config.formula}}${keepOp}`;
  }

  if (modValue !== 0) {
    const sign = modValue > 0 ? '+' : '';
    formula += `${sign}${modValue}`;
  }

  let roll;
  try {
    const sanitizedFormula = sanitizeExpression(formula);
    roll = new Roll(sanitizedFormula);
    await roll.evaluate();
  } catch (error) {
    console.error('Oracle roll error:', error);
    ui.notifications.error('Failed to roll oracle dice');
    return;
  }

  const rollTotal = roll.total;

  const tableKeys = Object.keys(config.table).map(Number);
  const minKey = Math.min(...tableKeys);
  const maxKey = Math.max(...tableKeys);

  const clampedResult = Math.max(minKey, Math.min(maxKey, rollTotal));

  const outcomeEntry = config.table[clampedResult];

  if (!outcomeEntry) {
    console.error('No outcome found for result:', clampedResult, 'in table:', config.table);
    ui.notifications.error('Could not find oracle result');
    return;
  }

  const speaker = ChatMessage.getSpeaker({ alias: game.user.name });

  const outcome = $l10n(outcomeEntry.outcome);
  const description = $l10n(outcomeEntry.description);
  const grade = outcomeEntry.grade ? $l10n(outcomeEntry.grade) : null;

  const content = `
<div class="uvg-oracle-result">
  <div class="oracle-header">
    <h5><i class="fas fa-dice"></i> ${$l10n(config.label)}</h5>
    ${question ? `<p class="oracle-question"><strong>${$l10n('SDM.Question')}:</strong> ${question}</p>` : ''}
  </div>

  <div class="oracle-roll">
    <p><strong>${$l10n('SDM.PowerRollFormulaAbbr')}:</strong> ${formula.replace(/\[[^\]]*\]/g, '')} = ${roll.total}</p>
    ${clampedResult !== roll.total ? `<p><strong>${$l10n('SDM.Result')}:</strong> ${clampedResult} (${$l10n('SDM.ClampedFrom')} ${roll.total})</p>` : ''}
  </div>

  <div class="oracle-outcome">
    <h6>${outcome}</h6>
    <p>${description}</p>
    ${config.showGrade && outcomeEntry.grade ? `<p><strong>${$l10n('SDM.Grade')}:</strong> ${grade}</p>` : ''}
  </div>
</div>
`;

  const chatMode = game.settings.get('core', 'rollMode');
  let chatData = {
    content,
    speaker,
    rolls: [roll],
    flavor: $l10n('SDM.OracleResult'),
    flags: { 'sdm.isHeroResult': true }
  };

  chatData = ChatMessage.applyRollMode(chatData, chatMode);
  await ChatMessage.create(chatData);
}
