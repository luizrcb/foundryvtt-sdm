import { generateNameFromTable } from './characterGenerator.mjs';

const { DialogV2 } = foundry.applications.api;

export async function randomNPCGenerator() {
  if (!game.user.isGM) return;

  // Table options
  const tableOptions = [
    'generic-synthesized-creature',
    'humans-of-the-pananthropy',
    'brick-bastions',
    'darting-dodgers',
    'crystal-cannons',
    'erratic-expendables'
  ];

  // Table descriptions
  const tableDescriptions = {
    'generic-synthesized-creature': game.i18n.localize('SDM.TableDesc.GenericSynthesizedCreature'),
    'humans-of-the-pananthropy': game.i18n.localize('SDM.TableDesc.HumansOfThePananthropy'),
    'brick-bastions': game.i18n.localize('SDM.TableDesc.BrickBastions'),
    'darting-dodgers': game.i18n.localize('SDM.TableDesc.DartingDodgers'),
    'crystal-cannons': game.i18n.localize('SDM.TableDesc.CrystalCannons'),
    'erratic-expendables': game.i18n.localize('SDM.TableDesc.ErraticExpendables')
  };

  // Build dialog content
  const content = `
<fieldset>
  <legend>${game.i18n.localize('SDM.CreateRandomNPC')}</legend>
  <div id="npc-table-description" style="margin-top:5px;font-style:italic;">
    ${tableDescriptions['generic-synthesized-creature']}
  </div>
  <div class="form-group">
    <label>${game.i18n.localize('SDM.CreatureTable')}</label>
    <select name="table" class="form-control" id="npc-table-select">
      ${tableOptions
        .map(
          t =>
            `<option value="${t}" ${
              t === 'generic-synthesized-creature' ? 'selected' : ''
            }>${game.i18n.localize(`SDM.${t}`)}</option>`
        )
        .join('')}
    </select>
  </div>
  <div class="form-group">
    <label>${game.i18n.format('SDM.OptionalField', { field: game.i18n.localize('SDM.FieldName') })}</label>
    <input type="text" name="name" class="form-control">
  </div>
  <div class="form-group">
    <label>${game.i18n.format('SDM.OptionalField', { field: game.i18n.localize('SDM.FieldLevel') })}</label>
    <input type="number" name="level" class="form-control" min="0" value="0">
  </div>
  <div class="form-group">
    <label>${game.i18n.format('SDM.OptionalField', { field: game.i18n.localize('SDM.CustomInitiative') })}</label>
    <input type="text" name="initiative" class="form-control" placeholder="e.g. 2d6+@bonus">
  </div>
  <label style="font-weight: bold;">${game.i18n.format('SDM.OptionalField', { field: game.i18n.localize('SDM.FieldBiography') })}</label>
  <div class="form-group">
    <prose-mirror name="biography"></prose-mirror>
  </div>
</fieldset>
`;

  // Create dialog instance
  const data = await DialogV2.wait({
    window: { title: game.i18n.localize('SDM.CreateRandomNPC'), resizable: true },
    content,
    buttons: [
      {
        action: 'ok',
        label: game.i18n.localize('SDM.CreateNPC'),
        icon: 'fa-solid fa-spaghetti-monster-flying',
        callback: (event, button) =>
          new foundry.applications.ux.FormDataExtended(button.form).object
      }
    ],
    rejectClose: false,
    render: (event, dialog) => {
      const html = dialog.element;
      const select = html.querySelector('#npc-table-select');
      const description = html.querySelector('#npc-table-description');

      if (select && description) {
        select.addEventListener('change', ev => {
          const val = ev.target.value;
          description.innerHTML = tableDescriptions[val] ?? '';
        });
      }
    }
  });

  // Render the dialog
  if (!data) return;
  let npcName = data?.name;

  // Prepare NPC data
  if (!npcName) {
    if (data.table === 'humans-of-the-pananthropy') {
      npcName = await generateNameFromTable();
    }
  }

  const npcData = {
    name: npcName || game.i18n.localize('SDM.UnnamedNPC'),
    table: data.table,
    initiative: '',
    biography: ''
  };

  // Validate initiative as a Roll formula
  if (data.initiative) {
    npcData.initiative = data.initiative;
  }

  if (data.biography) {
    npcData.biography = data.biography;
  }

  // Call system API
  let npc;
  if (data.level !== null) {
    npc = await game.sdm.api.createNPCByLevel({
      name: npcData?.name,
      lvl: Math.abs(parseInt(data.level, 10)),
      tableName: npcData.table,
      initiative: npcData.initiative,
      biography: npcData.biography,
    });
  } else {
    npc = await game.sdm.api.createNPC(npcData?.name, npcData.table, npcData.initiative, npcData.biography);
  }

  ui.notifications.info(
    game.i18n.format('SDM.NPCCreated', {
      name: npc?.name,
      level: npc?.system?.level
    })
  );
}
