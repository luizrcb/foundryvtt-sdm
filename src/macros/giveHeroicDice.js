const { DialogV2 } = foundry.applications.api;

if (!game.user.isGM) return;

// Get all character actors
const characters = game.actors.filter(e => e.type === "character");

// Create character select options
const characterOptions = [
  '<option value="all">All Characters</option>',
  ...characters.map(c => `<option value="${c.id}">${c.name}</option>`)
].join('');

const content = `
  <form class="hero-dice-adjustment">
    <div class="form-group">
      <label>Select Character</label>
      <select name="character" class="form-control">
        ${characterOptions}
      </select>
    </div>
  </form>
`;

// Show dialog with properly configured buttons
const data = await DialogV2.wait({
  window: {
    title: "Adjust Hero Dice",
    resizable: false
  },
  rejectClose: false,
  modal: true,
  content,
  buttons: [
    {
      action: "increment",
      label: "1 Hero",
      icon: "fas fa-plus",
      type: "button",
      callback: (event, button, dialog) => ({
        character: button.form.querySelector('[name="character"]').value,
        adjustment: 1
      })
    },
    {
      action: "decrement",
      label: "1 Hero",
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
  ui.notifications.error("No valid characters selected!");
  return;
}

// Prepare updates with validation
const updates = targets.map(actor => {
  try {
    const current = Math.max(0, actor.system.hero_dice?.value || 0);
    const maxLevel = Math.max(1, actor.system.level || 1);
    const newValue = Math.clamp(current + data.adjustment, 0, maxLevel);
    console.log(current, maxLevel, newValue);
    return newValue !== current ? {
      _id: actor.id,
      "system.hero_dice.value": newValue
    } : null;
  } catch (e) {
    console.error(`Error processing ${actor.name}:`, e);
    return null;
  }
}).filter(Boolean);

// Apply changes
if (updates.length > 0) {
  await Actor.updateDocuments(updates);
  ui.notifications.info(`Updated hero dice for ${updates.length} character(s)!`);
} else {
  ui.notifications.warn("No changes were needed.");
}
