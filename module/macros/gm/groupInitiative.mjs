import { ActorType } from '../../helpers/constants.mjs';

function safeDecimalAdd(base, decimal1, decimal2 = 0) {
  return (Math.round(base * 100) + Math.round(decimal1 * 100) + Math.round(decimal2 * 100)) / 100;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function ensureCombatant(token) {
  if (!token.combatant) {
    await token.toggleCombatant();
  }
}

export async function groupInitiative({ reroll = false } = {}) {
  if (!game.user.isGM) return;

  const activeCombat = game.combats.active;
  let tokens = [];

  if (activeCombat) {
    const combatTokens = activeCombat.combatants
      .filter(c => c?.actor?.type !== ActorType.CARAVAN)
      .map(c => c.token);

    if (!reroll) {
      const allRolled = activeCombat.combatants.contents.every(c => c.initiative != null);
      if (combatTokens.length > 0 && allRolled) return;
    }

    tokens = combatTokens;
  }

  if (tokens.length === 0) {
    tokens = canvas.tokens.controlled
      .filter(t => t?.actor?.type !== ActorType.CARAVAN)
      .map(t => t.document);
  }

  if (tokens.length === 0) {
    return ui.notifications.warn('SDM.GroupInitiativeErrorNoTokens', {
      localize: true,
      permanent: true
    });
  }

  const useTiebreaking = game.settings.get('sdm', 'initiativeTieBreak');
  const groupPlayersToFriendly = game.settings.get('sdm', 'groupPlayersToFriendlyTokens');
  const { FRIENDLY, NEUTRAL, HOSTILE, SECRET } = CONST.TOKEN_DISPOSITIONS;

  const groups = {
    players: [],
    friendly: [],
    neutral: [],
    hostile: [],
    secret: []
  };

  for (const token of tokens) {
    if (token.hasPlayerOwner) {
      if (groupPlayersToFriendly) {
        groups.friendly.push(token);
      } else {
        groups.players.push(token);
      }
    } else {
      switch (token.disposition) {
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
      }
    }
  }

  const usedTenths = new Set();
  if (!reroll) {
    for (const group of Object.values(groups)) {
      for (const token of group) {
        const init = token.combatant?.initiative;
        if (init != null) {
          const tenths = Math.floor((init * 10) % 10);
          if (tenths > 0) usedTenths.add(tenths);
        }
      }
    }
  }

  function getUniqueTenths() {
    const available = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => !usedTenths.has(d));
    if (available.length === 0) {
      console.warn('All tenths digits are already used; using 0 as tie‑breaker.');
      return 0;
    }
    const shuffled = available.sort(() => Math.random() - 0.5);
    const chosen = shuffled[0];
    usedTenths.add(chosen);
    return chosen / 10;
  }

  for (const group of Object.values(groups)) {
    if (group.length === 0) continue;

    const existing = [];
    const missing = [];
    for (const token of group) {
      const hasInit = token.combatant?.initiative != null;
      if (hasInit && !reroll) {
        existing.push(token);
      } else {
        missing.push(token);
      }
    }
    if (missing.length === 0) continue;

    let base, groupTieBreaker;
    const existingHundredths = new Set();

    if (existing.length > 0 && !reroll) {
      const firstInit = existing[0].combatant.initiative;
      base = Math.floor(firstInit);
      groupTieBreaker = Math.floor((firstInit * 10) % 10) / 10;

      for (const token of existing) {
        const hundredths = Math.floor((token.combatant.initiative * 100) % 10) / 100;
        existingHundredths.add(hundredths);
      }
    } else {
      const roller = pickRandom(group);
      await ensureCombatant(roller);
      const combat = game.combats.active;
      if (!combat) {
        console.error('No active combat after ensuring combatant.');
        return;
      }
      await combat.rollInitiative([roller.combatant.id]);
      const rolled = roller.combatant.initiative;
      base = Math.floor(rolled);

      groupTieBreaker = getUniqueTenths();
    }

    const allowedDigits = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => !existingHundredths.has(d / 100));
    const shuffledAllowed = allowedDigits.sort(() => Math.random() - 0.5);
    const hundredthsList = [];
    for (let i = 0; i < missing.length; i++) {
      if (shuffledAllowed.length === 0) {
        hundredthsList.push([1, 2, 3, 4, 5, 6, 7, 8, 9][i % 9] / 100);
      } else {
        hundredthsList.push(shuffledAllowed[i % shuffledAllowed.length] / 100);
      }
    }

    for (let i = 0; i < missing.length; i++) {
      const token = missing[i];
      const hundredths = hundredthsList[i];
      let finalInitiative = base;
      if (useTiebreaking) {
        finalInitiative = safeDecimalAdd(base, groupTieBreaker, hundredths);
      }
      await ensureCombatant(token);
      await token.combatant.update({ initiative: finalInitiative });
    }
  }

  const finalCombat = game.combats.active;
  if (finalCombat?.started) {
    await finalCombat.update({ round: finalCombat.round, turn: 0 });
  }
}
