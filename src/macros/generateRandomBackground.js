// ----- 1. Sorteio das 5 linhas -----
const BACKGROUND_TABLE = Array.from({ length: 40 }, (_, i) => ({
  flavor: game.i18n.localize(`SDM.BackgroundRow${String(i + 1).padStart(2, '0')}.Flavor`),
  role1: game.i18n.localize(`SDM.BackgroundRow${String(i + 1).padStart(2, '0')}.Role1`),
  role2: game.i18n.localize(`SDM.BackgroundRow${String(i + 1).padStart(2, '0')}.Role2`),
  task: game.i18n.localize(`SDM.BackgroundRow${String(i + 1).padStart(2, '0')}.Task`),
  spin: game.i18n.localize(`SDM.BackgroundRow${String(i + 1).padStart(2, '0')}.Spin`)
}));

function roll5d40(table) {
  const results = [];
  while (results.length < 5) {
    const r = Math.floor(Math.random() * table.length);
    if (!results.includes(r)) results.push(r);
  }
  return results.map(i => ({ index: i + 1, ...table[i] }));
}

// ----- 2. Criar HTML do Dialog com inputs editáveis e CSS -----
function buildDialogContent(rows) {
  let html = `
    <style>
      .background-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
      .background-table th, .background-table td { border: 1px solid #444; padding: 4px 6px; text-align: left; }
      .background-table th { background-color: #222; color: #fff; }
      .background-table tbody tr:nth-child(odd) { background-color: #2a2a2a; }
      .background-table tbody tr:nth-child(even) { background-color: #1f1f1f; }
      .preview-inputs input { width: 100%; margin-bottom: 4px; padding: 4px; background-color: #333; border: 1px solid #555; color: #fff; }
      .preview-inputs label { font-weight: bold; margin-bottom: 2px; display: block; }
      #reroll-dice { color: red; cursor:pointer; margin-bottom:5px; display:inline-block; }
    </style>
    <div style="display:flex; justify-content:flex-end;">
      <div style="color: red; margin-bottom:5px;">
        <span style="color: black"><b>${game.i18n.localize('SDM.BackgroundReroll')}</b></span>
        <i
          class="fas fa-dice fa-lg"
          id="reroll-dice"
          title="${game.i18n.localize('SDM.BackgroundReroll')}"
          style="cursor: pointer"
        ></i>
      </div>
    </div>
    <table class="background-table">
      <thead>
        <tr>
          <th></th>
          <th>${game.i18n.localize('SDM.BackgroundFlavor')}</th>
          <th>${game.i18n.localize('SDM.BackgroundRole1')}</th>
          <th>${game.i18n.localize('SDM.BackgroundRole2')}</th>
          <th>${game.i18n.localize('SDM.BackgroundTask')}</th>
          <th>${game.i18n.localize('SDM.BackgroundSpin')}</th>
        </tr>
      </thead>
      <tbody>
  `;

  rows.forEach((row, i) => {
    html += `<tr data-row="${i}">
      <td><input type="checkbox" class="row-select"></td>
      <td><input type="checkbox" class="cell-select" data-col="flavor"> ${row.flavor}</td>
      <td><input type="checkbox" class="cell-select" data-col="role1"> ${row.role1}</td>
      <td><input type="checkbox" class="cell-select" data-col="role2"> ${row.role2}</td>
      <td><input type="checkbox" class="cell-select" data-col="task"> ${row.task}</td>
      <td><input type="checkbox" class="cell-select" data-col="spin"> ${row.spin}</td>
    </tr>`;
  });

  html += `</tbody></table>
    <div class="preview-inputs">
      <label><strong>${game.i18n.localize('SDM.BackgroundEditablePreview')}<strong></label>
      <input type="text" id="preview-flavor" placeholder="${game.i18n.localize('SDM.BackgroundFlavor')}">
      <input type="text" id="preview-role" placeholder="${game.i18n.localize('SDM.BackgroundRole')}">
      <input type="text" id="preview-task" placeholder="${game.i18n.localize('SDM.BackgroundTask')}">
      <input type="text" id="preview-spin" placeholder="${game.i18n.localize('SDM.BackgroundSpin')}">
    </div>`;
  return html;
}

// ----- 3. Inicializa linhas sorteadas -----
let selectedRows = roll5d40(BACKGROUND_TABLE);

// ----- 4. Criar DialogV2 -----
await foundry.applications.api.DialogV2.wait({
  window: { title: game.i18n.localize('SDM.BackgroundGenerator') },
  content: buildDialogContent(selectedRows),
  buttons: [
    {
      action: 'confirm',
      label: game.i18n.localize('SDM.BackgroundConfirm'),
      callback: async (event, button, dialog) => {
        const html = dialog.element;
        const selected = { flavor: null, role1: null, role2: null, task: null, spin: null };

        // Seleção das linhas
        html.querySelectorAll('tr').forEach(tr => {
          const rowIndex = parseInt(tr.dataset.row);
          const rowCheckbox = tr.querySelector('.row-select');
          if (rowCheckbox?.checked && !isNaN(rowIndex)) {
            const rowData = selectedRows[rowIndex];
            selected.flavor ??= rowData.flavor;
            selected.role1 ??= rowData.role1;
            selected.role2 ??= rowData.role2;
            selected.task ??= rowData.task;
            selected.spin ??= rowData.spin;
          }
        });

        // Seleção das células
        html.querySelectorAll('.cell-select:checked').forEach(cb => {
          const tr = cb.closest('tr');
          if (!tr) return;
          const rowIndex = parseInt(tr.dataset.row);
          if (isNaN(rowIndex)) return;
          selected[cb.dataset.col] = selectedRows[rowIndex][cb.dataset.col];
        });

        // Pega valores do preview ou usa os selecionados
        const flavor = html.querySelector('#preview-flavor').value || selected.flavor;
        const role =
          html.querySelector('#preview-role').value || `${selected.role1} ${selected.role2}`;
        const task = html.querySelector('#preview-task').value || selected.task;
        const spin = html.querySelector('#preview-spin').value || selected.spin;

        const actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;

        if (!actor) {
          ui.notifications.error(game.i18n.localize('SDM.BackgroundInvalidCharacter'));
        }

        if (!flavor || !role || !task || !spin) {
          return;
        }


        await game.sdm.api.createBackgroundTrait(actor, { flavor, role, task, spin });

        ui.notifications.info(game.i18n.format("SDM.BackgroundTraitCreated", {
          flavor,
          role,
          name: actor.name,
        }));
      }
    },
    { action: 'cancel', label: game.i18n.localize('SDM.BackgroundCancel') }
  ],
  render: (event, dialog) => {
    const html = dialog.element;

    function updatePreview() {
      const selected = { flavor: null, role1: null, role2: null, task: null, spin: null };
      html.querySelectorAll('tr').forEach(tr => {
        const rowIndex = parseInt(tr.dataset.row);
        const rowCheckbox = tr.querySelector('.row-select');
        if (rowCheckbox?.checked && !isNaN(rowIndex)) {
          const rowData = selectedRows[rowIndex];
          selected.flavor ??= rowData.flavor;
          selected.role1 ??= rowData.role1;
          selected.role2 ??= rowData.role2;
          selected.task ??= rowData.task;
          selected.spin ??= rowData.spin;
        }
      });
      html.querySelectorAll('.cell-select:checked').forEach(cb => {
        const tr = cb.closest('tr');
        if (!tr) return;
        const rowIndex = parseInt(tr.dataset.row);
        if (isNaN(rowIndex)) return;
        selected[cb.dataset.col] = selectedRows[rowIndex][cb.dataset.col];
      });

      html.querySelector('#preview-flavor').value = selected.flavor ?? '';
      html.querySelector('#preview-role').value =
        selected.role1 && selected.role2 ? `${selected.role1} ${selected.role2}` : '';
      html.querySelector('#preview-task').value = selected.task ?? '';
      html.querySelector('#preview-spin').value = selected.spin ?? '';
    }

    function attachListeners() {
      // Linhas
      html.querySelectorAll('.row-select').forEach(cb => {
        cb.addEventListener('change', () => {
          const row = cb.closest('tr');
          if (!row) return;
          if (cb.checked) {
            html.querySelectorAll('.row-select').forEach(other => {
              if (other !== cb) other.checked = false;
            });
            html.querySelectorAll('.cell-select').forEach(c => (c.checked = false));
            row.querySelectorAll('.cell-select').forEach(c => (c.checked = true));
          } else {
            row.querySelectorAll('.cell-select').forEach(c => (c.checked = false));
          }
          updatePreview();
        });
      });

      // Células
      html.querySelectorAll('.cell-select').forEach(cb => {
        cb.addEventListener('change', () => {
          const tr = cb.closest('tr');
          if (!tr) return;
          const rowCheckbox = tr.querySelector('.row-select');
          if (cb.checked) {
            html.querySelectorAll(`.cell-select[data-col="${cb.dataset.col}"]`).forEach(c => {
              if (c !== cb) c.checked = false;
            });
            if (rowCheckbox) rowCheckbox.checked = false;
          }
          updatePreview();
        });
      });
    }

    // Reroll
    const reroll = html.querySelector('#reroll-dice');
    reroll?.addEventListener('click', async () => {
      if (!window.confirm(game.i18n.localize('SDM.BackgroundRerollConfirmation'))) return;
      selectedRows = roll5d40(BACKGROUND_TABLE);
      const tbody = html.querySelector('tbody');
      if (tbody) {
        tbody.innerHTML = buildDialogContent(selectedRows).match(/<tbody>([\s\S]*)<\/tbody>/)[1];
      }
      attachListeners();
      updatePreview();
    });

    attachListeners();
    updatePreview();
  }
});
