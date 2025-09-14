function getUniqueRandomDecimals(count = 5) {
  const nums = new Set();
  while (nums.size < count) {
    const digit = Math.floor(Math.random() * 9) + 1; // 1..9
    nums.add(digit / 10); // 0.1..0.9
  }
  return Array.from(nums);
}

/** Random pick from a non-empty array */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Ensure a token has a combatant (preserves original API usage) */
async function ensureCombatant(token) {
  if (!token.combatant) {
    await token.toggleCombatant();
  }
}

export async function groupInitiative() {
  if (!game.user.isGM) return;

  const tieBreakers = getUniqueRandomDecimals();
  let tokens = [];
  const combats = game.combats.filter(combat => combat.active);

  if (combats && combats.length) {
    const combat = combats[0];
    const combatTokens = combat.combatants.map(combatant => combatant.token);

    tokens = [...combatTokens];
  }

  const canvasTokens = canvas.tokens.controlled.map(token => token.document);

  if (!tokens.length) {
    tokens = [...canvasTokens];
  }

  if (!tokens || !tokens.length) {
    return ui.notifications.warn('SDM.GroupInitiativeErrorNoTokens', {
      localize: true,
      permanent: true
    });
  }

  const groups = {
    players: [],
    friendly: [],
    neutral: [],
    hostile: [],
    secret: []
  };

  const groupPlayersToFriendlyTokens = game.settings.get('sdm', 'groupPlayersToFriendlyTokens');

  const { FRIENDLY, NEUTRAL, HOSTILE, SECRET } = CONST.TOKEN_DISPOSITIONS;
  // const ROLL_PUBLIC = CONST.DICE_ROLL_MODES.PUBLIC;

  // Separate tokens into groups (preserving the original logic)
  for (const token of tokens) {
    if (token?.hasPlayerOwner === true) {
      if (groupPlayersToFriendlyTokens) {
        groups.friendly.push(token);
      } else {
        groups.players.push(token);
      }
    } else {
      const disp = token?.disposition;

      switch (disp) {
        case FRIENDLY:
          groups.friendly.push(token);
          break;
        case SECRET:
          groups.secret.push(token);
          break;
        case HOSTILE:
          groups.hostile.push(token);
          break;
        case NEUTRAL:
          groups.neutral.push(token);
          break;
        // no default: unhandled dispositions are ignored (same behavior)
      }
    }
  }

  // Process a token group (same flow; only factored helpers)
  const processGroup = async (group, index) => {
    if (group.length === 0) return;

    const roller = pickRandom(group);

    await ensureCombatant(roller);

    await game.combat.rollInitiative([roller.combatant.id]);

    let initVal = roller.combatant.initiative;
    initVal += tieBreakers[index];

    await roller.combatant.update({ initiative: initVal });

    for (const token of group) {
      if (token === roller) continue;

      await ensureCombatant(token);
      await token.combatant.update({ initiative: initVal });
    }
  };

  for (const [index, group] of Object.values(groups).entries()) {
    if (group.length) {
      await processGroup(group, index);
    }
  }
  const activeCombatHasStarted = game.combats.find(combat => combat.active && combat.started);
  if (activeCombatHasStarted) {
    await activeCombatHasStarted.update({ round: activeCombatHasStarted.round, turn: 0 });
  }
}
