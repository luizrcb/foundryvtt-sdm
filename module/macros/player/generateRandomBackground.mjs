export async function generateRandomBackground() {
  let actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;

  if (!actor) {
    ui.notifications.error(game.i18n.localize('SDM.BackgroundInvalidCharacter'));
    return;
  }

  // ----- 1. Sorteio das 10 linhas -----
  const BACKGROUND_TABLE = Array.from({ length: 40 }, (_, i) => ({
    flavor: game.i18n.localize(`SDM.BackgroundRow${String(i + 1).padStart(2, '0')}.Flavor`),
    role1: game.i18n.localize(`SDM.BackgroundRow${String(i + 1).padStart(2, '0')}.Role1`),
    role2: game.i18n.localize(`SDM.BackgroundRow${String(i + 1).padStart(2, '0')}.Role2`),
    task: game.i18n.localize(`SDM.BackgroundRow${String(i + 1).padStart(2, '0')}.Task`),
    spin: game.i18n.localize(`SDM.BackgroundRow${String(i + 1).padStart(2, '0')}.Spin`)
  }));

  function roll10d40(table) {
    const results = [];
    while (results.length < 10) {
      const r = Math.floor(Math.random() * table.length);
      if (!results.includes(r)) results.push(r);
    }
    return results.map(i => ({ index: i + 1, ...table[i] }));
  }

  // Ordem dos dois primeiros campos do preview.
  let previewOrder = ['flavor', 'role'];

  // ----- 2. HTML do Dialog -----
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
      #swap-order { cursor: pointer; margin-left: 8px; }
      .preview-toolbar { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
      .muted { opacity: 0.85; font-size: 0.9em; }
    </style>
    <div style="display:flex; justify-content:flex-end;">
      <div style="color: red; margin-bottom:5px;">
        <span style="color: black"><b>${game.i18n.localize('SDM.BackgroundReroll')}</b></span>
        <i class="fas fa-dice fa-lg" id="reroll-dice" title="${game.i18n.localize('SDM.BackgroundReroll')}" style="cursor: pointer"></i>
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
      <div class="preview-toolbar">
        <label style="margin:0;"><strong>${game.i18n.localize('SDM.BackgroundEditablePreview')}</strong></label>
        <i style="cursor:pointer; margin-left: 5px;" id="swap-order" class="fas fa-exchange-alt" title="${game.i18n.localize('SDM.BackgroundSwapOrder')}"> ${game.i18n.localize('SDM.BackgroundSwapOrder')}</i>
        <span class="muted" id="order-hint"></span>
      </div>
      <div id="preview-fields"></div>
    </div>`;
    return html;
  }

  // Renderiza os inputs do preview conforme a ordem atual.
  function renderPreviewInputs(html) {
    const container = html.querySelector('#preview-fields');
    if (!container) return;

    const current = {
      flavor: html.querySelector('#preview-flavor')?.value ?? '',
      role: html.querySelector('#preview-role')?.value ?? '',
      task: html.querySelector('#preview-task')?.value ?? '',
      spin: html.querySelector('#preview-spin')?.value ?? ''
    };

    const flavorPh = game.i18n.localize('SDM.BackgroundFlavor');
    const rolePh = game.i18n.localize('SDM.BackgroundRole');
    const taskPh = game.i18n.localize('SDM.BackgroundTask');
    const spinPh = game.i18n.localize('SDM.BackgroundSpin');

    const firstField = previewOrder[0];
    const secondField = previewOrder[1];

    container.innerHTML = `
    <input type="text" id="preview-${firstField}"  placeholder="${firstField === 'flavor' ? flavorPh : rolePh}">
    <input type="text" id="preview-${secondField}" placeholder="${secondField === 'flavor' ? flavorPh : rolePh}">
    <input type="text" id="preview-task" placeholder="${taskPh}">
    <input type="text" id="preview-spin"  placeholder="${spinPh}">
  `;

    container.querySelector('#preview-flavor')?.setAttribute('value', current.flavor);
    const pFlavor = container.querySelector('#preview-flavor');
    if (pFlavor) pFlavor.value = current.flavor;
    container.querySelector('#preview-role')?.setAttribute('value', current.role);
    const pRole = container.querySelector('#preview-role');
    if (pRole) pRole.value = current.role;
    const pTask = container.querySelector('#preview-task');
    if (pTask) pTask.value = current.task;
    const pSpin = container.querySelector('#preview-spin');
    if (pSpin) pSpin.value = current.spin;

    const orderHint = html.querySelector('#order-hint');
    if (orderHint) {
      const names = { flavor: flavorPh, role: rolePh };
      orderHint.textContent = `${names[previewOrder[0]]} → ${names[previewOrder[1]]}`;
    }
  }

  // ----- 3. Inicialização -----
  let selectedRows = roll10d40(BACKGROUND_TABLE);

  // ----- 4. DialogV2 -----
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

          // Linhas selecionadas
          html.querySelectorAll('tbody tr').forEach(tr => {
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

          // Células selecionadas
          html.querySelectorAll('.cell-select:checked').forEach(cb => {
            const tr = cb.closest('tr');
            if (!tr) return;
            const rowIndex = parseInt(tr.dataset.row);
            if (isNaN(rowIndex)) return;
            selected[cb.dataset.col] = selectedRows[rowIndex][cb.dataset.col];
          });

          // Pega os DOIS primeiros campos em ordem visual e combina
          const firstId = `#preview-${previewOrder[0]}`;
          const secondId = `#preview-${previewOrder[1]}`;
          const roleAuto =
            selected.role1 && selected.role2
              ? `${selected.role1} ${selected.role2}`
              : (selected.role1 ?? selected.role2 ?? '');

          const firstVal =
            html.querySelector(firstId)?.value ||
            (previewOrder[0] === 'flavor' ? selected.flavor : roleAuto);

          const secondVal =
            html.querySelector(secondId)?.value ||
            (previewOrder[1] === 'flavor' ? selected.flavor : roleAuto);

          const combined = [firstVal, secondVal]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          const task = html.querySelector('#preview-task')?.value || selected.task;
          const spin = html.querySelector('#preview-spin')?.value || selected.spin;

          actor = game.user?.character || canvas?.tokens?.controlled[0]?.actor;
          if (!actor) {
            ui.notifications.error(game.i18n.localize('SDM.BackgroundInvalidCharacter'));
            return;
          }
          if (!combined) return;

          await game.sdm.api.createBackgroundTrait(actor, {
            title: combined,
            task,
            spin
          });

          ui.notifications.info(
            game.i18n.format('SDM.BackgroundTraitCreated', {
              flavor: combined,
              role: '',
              name: actor.name
            })
          );
        }
      },
      { action: 'cancel', label: game.i18n.localize('SDM.BackgroundCancel') }
    ],
    render: (event, dialog) => {
      const html = dialog.element;

      function updatePreview() {
        const selected = { flavor: null, role1: null, role2: null, task: null, spin: null };

        // Use apenas tbody tr
        html.querySelectorAll('tbody tr').forEach(tr => {
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

        const pFlavor = html.querySelector('#preview-flavor');
        const pRole = html.querySelector('#preview-role');
        if (pFlavor) pFlavor.value = selected.flavor ?? '';
        if (pRole)
          pRole.value =
            selected.role1 && selected.role2
              ? `${selected.role1} ${selected.role2}`
              : (selected.role1 ?? selected.role2 ?? '');

        const pTask = html.querySelector('#preview-task');
        const pSpin = html.querySelector('#preview-spin');
        if (pTask) pTask.value = selected.task ?? '';
        if (pSpin) pSpin.value = selected.spin ?? '';
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

      // Liga o botão de troca **uma única vez**
      const swap = html.querySelector('#swap-order');
      if (swap && !swap.dataset.bound) {
        swap.addEventListener('click', () => {
          previewOrder.reverse();
          renderPreviewInputs(html);
          updatePreview();
        });
        swap.dataset.bound = '1';
      }

      // Reroll
      const reroll = html.querySelector('#reroll-dice');
      reroll?.addEventListener('click', async () => {
        if (!window.confirm(game.i18n.localize('SDM.BackgroundRerollConfirmation'))) return;
        selectedRows = roll10d40(BACKGROUND_TABLE);

        const tbody = html.querySelector('tbody');
        if (tbody) {
          tbody.innerHTML = buildDialogContent(selectedRows).match(/<tbody>([\s\S]*)<\/tbody>/)[1];
        }

        // Reanexa apenas os listeners da TABELA (swap-order continua 1x)
        attachListeners();

        // Mantém a ordem atual do preview
        renderPreviewInputs(html);
        updatePreview();
      });

      // Primeira renderização
      renderPreviewInputs(html);
      attachListeners();
      updatePreview();
    }
  });
}
