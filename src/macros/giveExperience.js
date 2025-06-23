const { DialogV2 } = foundry.applications.api;
const { NumberField } = foundry.data.fields;

if (!game.user.isGM) return;

// Get all character actors
const characters = game.actors.filter(e => e.type === "character");

// Create form elements
const xpInput = new NumberField({
  label: game.i18n.localize('SDM.XPToGive'),
}).toFormGroup({}, { value: 0, name: "xp", autofocus: true }).outerHTML;

const characterOptions = [
  `<option value="all">${game.i18n.localize('SDM.AllCharacters')}</option>`,
  ...characters.map(c => `<option value="${c.id}">${c.name}</option>`)
].join('');

const characterSelect = `
  <div class="form-group">
    <label>${game.i18n.localize('SDM.SelectCharacter')}</label>
    <select name="character" class="form-control">
      ${characterOptions}
    </select>
  </div>
`;

const content = `
  <fieldset>
    <legend>${game.i18n.localize('SDM.ExperienceDistribution')}</legend>
    ${characterSelect}
    ${xpInput}
  </fieldset>
`;

// Show dialog
const data = await DialogV2.prompt({
  window: { title: game.i18n.localize('SDM.ExperienceDistribution') },
  content,
  ok: {
    label: game.i18n.localize('SDM.DistributeXP'),
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
  "system.player_experience": `${Math.max(parseInt(actor.system.player_experience) + data.xp, 0)}`
}));

// Apply updates
await Actor.updateDocuments(updates);
ui.notifications.info(game.i18n.format('SDM.ExperienceDistributionCompleted', { xp: data.xp, number: targets.length }));
