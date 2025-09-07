export async function groupInitiative() {
  const tokens = canvas.tokens.controlled;

  const excluded = [];
  const groups = {
    group1: [], // Players + Warrior + Helpers + Friendly NPC Tokens
    group2: [], // Neutral NPCs
    group3: [], // Hostile NPCs
    group4: [] // secret NPCs
  };

  // Separate tokens into groups
  for (const token of tokens) {
    const actor = token.actor;
    if (actor.type === 'character') {
      groups.group1.push(token);
    } else if (actor.type === 'npc') {
      const isFriendlyToken = token.document.disposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY;
      const isNeutralToken = token.document.disposition === CONST.TOKEN_DISPOSITIONS.NEUTRAL;
      const isHostileToken = token.document.disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE;
      const isSecretToken = token.document.disposition === CONST.TOKEN_DISPOSITIONS.SECRET;
      const isWarrior = actor.system?.type === 'warrior' || false;
      const isHelper = actor.system?.type === 'helper' || false;
      const isPorter = actor.system?.type === 'porter' || false;

      if (isWarrior || isHelper || isFriendlyToken) {
        groups.group1.push(token);
      } else if (isSecretToken) {
        groups.group4.push(token);
      } else if (isHostileToken) {
        groups.group3.push(token);
      } else if (isNeutralToken && !isPorter) {
        groups.group2.push(token);
      } else {
        excluded.push(token);
      }
    }
  }

  // Notify about excluded tokens
  if (excluded.length > 0) {
    const names = excluded.map(t => t.name).join(', ');
    ui.notifications.info(game.i18n.format('SDM.CombatantsExcluded', { names }));
  }

  // Process a token group
  async function processGroup(group) {
    if (group.length === 0) return;

    // Select random roller
    const roller = group[Math.floor(Math.random() * group.length)];

    // Ensure roller is in combat
    if (!roller.combatant) {
      await roller.document.toggleCombatant();
    }

    // Roll initiative for roller
    await game.combat.rollAll({ messageOptions: { rollMode: CONST.DICE_ROLL_MODES.PUBLIC } });

    const initVal = roller.combatant.initiative;

    // Apply initiative to group
    for (const token of group) {
      if (token === roller) continue;

      if (!token.combatant) {
        await token.document.toggleCombatant();
      }

      await token.combatant.update({ initiative: initVal });
    }
  }

  for (let group of Object.values(groups)) {
    if (group.length) {
      await processGroup(group);
    }
  }
}
