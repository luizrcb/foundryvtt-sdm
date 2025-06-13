const { DialogV2 } = foundry.applications.api;
const { NumberField } = foundry.data.fields;

if (!game.user.isGM) return;

// Get all character actors
const characters = game.actors.filter(e => e.type === "character");

// Create form elements
const xpInput = new NumberField({
  label: "XP to Give"
}).toFormGroup({}, { value: 0, name: "xp", autofocus: true }).outerHTML;

const characterOptions = [
  '<option value="all">All Characters</option>',
  ...characters.map(c => `<option value="${c.id}">${c.name}</option>`)
].join('');

const characterSelect = `
  <div class="form-group">
    <label>Select Character</label>
    <select name="character" class="form-control">
      ${characterOptions}
    </select>
  </div>
`;

const content = `
  <fieldset>
    <legend>Experience Distribution</legend>
    ${characterSelect}
    ${xpInput}
  </fieldset>
`;

// Show dialog
const data = await DialogV2.prompt({
  window: { title: "XP Distribution" },
  content,
  ok: {
    label: "Distribute XP",
    icon: "fas fa-hand-holding-medical",
    callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
  },
  rejectClose: false
});

if (!data) return;

// Determine targets
const targets = data.character === "all" 
  ? characters 
  : [game.actors.get(data.character)];

// Prepare updates
const updates = targets.map(actor => ({
  _id: actor.id,
  "system.experience": `${Math.max(parseInt(actor.system.experience) + data.xp, 0)}`
}));

// Apply updates
await Actor.updateDocuments(updates);
ui.notifications.info(`Distributed ${data.xp} XP to ${targets.length} character(s)!`);