const tokens = canvas.tokens.controlled;
const group1 = []; // Players + Warrior NPCs
const group2 = []; // Non-combat NPCs
const excluded = []; // Helpers/Porters

// Separate tokens into groups
for (const token of tokens) {
  const actor = token.actor;
  if (actor.type === "character") {
    group1.push(token);
  }
  else if (actor.type === "npc") {
    const isWarrior = actor.system?.isWarrior || false;
    const isHelper = actor.system?.isHelper || false;
    const isPorter = actor.system?.isPorter || false;

    if (isWarrior) {
      group1.push(token);
    }
    else if (!isHelper && !isPorter) {
      group2.push(token);
    }
    else {
      excluded.push(token);
    }
  }
}

// Notify about excluded tokens
if (excluded.length > 0) {
  const names = excluded.map(t => t.name).join(", ");
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

// Process both groups
await processGroup(group1);
await processGroup(group2);
