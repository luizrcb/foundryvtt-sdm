const { DialogV2 } = foundry.applications.api;

if (!game.user.isGM) return;

// Get all character actors
const characters = game.actors.filter(e => e.type === "character");

// Create character select options
const characterOptions = [
  `<option value="all">${game.i18n.localize("SDM.AllCharacters")}</option>`,
  ...characters.map(c => `<option value="${c.id}">${c.name}</option>`)
].join('');

const content = `
  <form class="hero-dice-adjustment">
    <div class="form-group">
      <label>${game.i18n.localize("SDM.SelectCharacter")}</label>
      <select name="character" class="form-control">
        ${characterOptions}
      </select>
    </div>
  </form>
`;

// Show dialog with properly configured buttons
const data = await DialogV2.wait({
  window: {
    title: game.i18n.localize("SDM.ManageHeroDice"),
    resizable: false
  },
  rejectClose: false,
  modal: true,
  content,
  buttons: [
    {
      action: "increment",
      label: `1 ${game.i18n.localize('SDM.HeroDie')}`,
      icon: "fas fa-plus",
      type: "button",
      callback: (event, button, dialog) => ({
        character: button.form.querySelector('[name="character"]').value,
        adjustment: 1
      })
    },
    {
      action: "decrement",
      label: `1 ${game.i18n.localize('SDM.HeroDie')}`,
      icon: "fas fa-minus",
      type: "button",
      callback: (event, button, dialog) => ({
        character: button.form.querySelector('[name="character"]').value,
        adjustment: -1
      })
    }
  ],

});

if (!data?.character) return;

// Process targets with error handling
const targets = data.character === "all"
  ? characters
  : [game.actors.get(data.character)].filter(Boolean);

if (!targets.length) {
  ui.notifications.error(game.i18n.format('SDM.ErrorNoActorSelected', { type: 'character' }));
  return;
}

// Prepare updates with validation
const updates = targets.map(actor => {
  try {
    const current = Math.max(0, actor.system.hero_dice?.value || 0);
    const maxLevel = Math.max(1, actor.system.hero_dice?.max || 1);
    const newValue = Math.clamp(current + data.adjustment, 0, maxLevel);
    return newValue !== current ? {
      _id: actor.id,
      "system.hero_dice.value": newValue,
    } : null;
  } catch (e) {
    console.error(game.i18n.format('SDM.ErrorUpdateDoc', { doc: actor.name }), e);
    return null;
  }
}).filter(Boolean);

// Apply changes
if (updates.length > 0) {
  await Actor.updateDocuments(updates);
  ui.notifications.info(game.i18n.format('SDM.UpdatedHeroDice', { number: updates.length }));
} else {
  ui.notifications.warn(game.i18n.localize('SDM.MessageNoChanges'));
}
