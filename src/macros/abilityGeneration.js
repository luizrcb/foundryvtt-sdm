const abilitiesOrder = {
  "en": ["Str", "End", "Agi", "Cha", "Aur", "Tho"],
  "pt-br": ["Cha", "Tho", "Str", "Agi", "Aur", "End"],
};

const currentLanguage = game.i18n.lang;

const results = {};
const rolls = []

// Wrap the logic in an async function
const rollAttributes = async () => {
  for (const stat of abilitiesOrder[currentLanguage]) {
    let roll = new Roll("1d100");
    roll = await roll.evaluate();
    rolls.push(roll);

    let value;
    if (roll.total <= 30) value = 0;
    else if (roll.total <= 55) value = 1;
    else if (roll.total <= 75) value = 2;
    else if (roll.total <= 90) value = 3;
    else if (roll.total <= 99) value = 4;
    else value = 5;  // Natural 100

    results[stat] = {
      value: value,
      total: roll.total
    };
  }

  // Create chat message after all rolls complete
  const content = `
    <h3>${game.i18n.localize("SDM.AbilityScoreGeneration")}</h3>
    <ul>
        ${abilitiesOrder[currentLanguage].map(stat =>
    `<li><b>${game.i18n.localize(`SDM.Ability.${stat}.long`)}</b>: ${results[stat].value} (Roll: ${results[stat].total})</li>`
  ).join("")}
    </ul>
    `;

  const rollMode = game.settings.get('core', 'rollMode');

  const chatData = {
    content,
    rollMode,
    rolls,
    flags: { "sdm.isAbilityScoreRoll": true },
  };


  if (rollMode === 'selfroll') {
    chatData.whisper = [game.user.id];
  }

  if (rollMode === 'blindroll') {
    chatData.blind = true;
  }

  if (rollMode === 'gmroll' || rollMode === 'blindroll') {
    chatData.whisper = ChatMessage.getWhisperRecipients('GM');
  }

  ChatMessage.create(chatData);
};

// Execute the function
rollAttributes();
