const abilitiesOrder = {
  "en": ["Str", "End", "Agi", "Cha", "Aur", "Tho"],
  "pt-br": ["Cha", "Tho", "Str", "Agi", "Aur", "End"],
};

const currentLanguage = game.i18n.lang;

const results = {};

// Wrap the logic in an async function
const rollAttributes = async () => {
  for (const stat of abilitiesOrder[currentLanguage]) {
    const roll = new Roll("1d100");
    await roll.evaluate();

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

  ChatMessage.create({ content });
};

// Execute the function
rollAttributes();
