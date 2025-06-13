if (!game.user.isGM) return;

// Get current escalator value
const currentValue = game.settings.get("sdm", "escalatorDie");

// Create dialog content
const content = `
  <div class="escalator-control">
    <div style="text-align: center; margin-bottom: 10px;">
      <h3>Escalator Die: ${currentValue}</h3>
      <p>${game.i18n.localize("SDM.EscalatorDieHint")}</p>
    </div>
  </div>
`;

// Create dialog buttons
const buttons = [
  {
    action: 'increment',
    icon: '<i class="fas fa-plus"></i>',
    label: game.i18n.localize("SDM.Increment"),
  },
  {
    action: 'reset',
    icon: '<i class="fas fa-undo"></i>',
    label: game.i18n.localize("SDM.Reset"),
  }
];

// Show the dialog
new foundry.applications.api.DialogV2({
  window: { title: game.i18n.localize("SDM.EscalatorDieControl") },
  content,
  buttons,
  submit: async (result) => {
    if (result === 'increment') {
      const newValue = currentValue + 1;
      await game.settings.set("sdm", "escalatorDie", newValue);
      ui.notifications.info(`Escalator Die increased to ${newValue}`);
    } else if (result === 'reset') {
      await game.settings.set("sdm", "escalatorDie", 0);
      ui.notifications.info("Escalator Die reset to 0");
    }
  }
}).render({ force: true });