import { SdmItem } from '../../documents/item.mjs';
import { DEFAULT_BURDEN_ICON } from '../../helpers/constants.mjs';

const { DialogV2 } = foundry.applications.api;

/**
 * Opens a dialog to generate a burden by rolling 2d8 on the given table.
 * The user can add multiple words, reorder them, and assign a penalty to an ability.
 */
export async function openBurdenGeneratorDialog() {
  let actor = canvas?.tokens?.controlled[0]?.actor;

  const rows = 8,
    cols = 8;
  const tableData = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => game.i18n.localize(`SDM.BurdenTable.R${r + 1}C${c + 1}`))
  );

  const content = `
  <h3 class="burden-title">${game.i18n.localize('SDM.BurdenGenerator.Title')}</h3>

  <!-- 8x8 table -->
  <table class="burden-table">
    <thead>
      <tr>
        <th></th>
        ${Array.from({ length: cols }, (_, i) => `<th>${i + 1}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${tableData
        .map(
          (row, rIdx) => `
        <tr>
          <th>${rIdx + 1}</th>
          ${row.map(cell => `<td>${cell}</td>`).join('')}
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <!-- Roll button & feedback -->
  <div class="flex-row">
    <button type="button" id="roll-burden-btn">🎲 ${game.i18n.localize('SDM.BurdenGenerator.RollButton')}</button>
    <span id="last-roll-result"></span>
  </div>

  <!-- Chips container – words are added here -->
  <div class="burden-chips-container" id="burden-chips-container"></div>

  <!-- Ability & penalty selection -->
  <div class="flex-row">
    <div>
      <label>${game.i18n.localize('SDM.BurdenGenerator.AffectedAbility')}</label>
      <select id="ability-select">
        ${Object.entries(CONFIG.SDM?.abilities)
          .map(([key, label]) => `<option value="${key}">${game.i18n.localize(label)}</option>`)
          .join('')}
      </select>
    </div>
    <div>
      <label>${game.i18n.localize('SDM.RollModifier')}</label>
      <select id="penalty-select">
        <option value="3">+3</option>
        <option value="2">+2</option>
        <option value="1">+1</option>
        <option value="0" selected>0</option>
        <option value="-1">-1</option>
        <option value="-2">-2</option>
        <option value="-3">-3</option>
      </select>
    </div>
  </div>
  `;

  const result = await DialogV2.wait({
    window: { title: game.i18n.localize('SDM.BurdenGenerator.WindowTitle') },
    content: content,
    buttons: [
      {
        action: 'create',
        label: game.i18n.localize('SDM.BurdenGenerator.CreateButton'),
        icon: 'fa-solid fa-check',
        callback: (event, button) => {
          const container = button.form.querySelector('#burden-chips-container');
          const words = Array.from(container.querySelectorAll('.burden-chip span:first-child')).map(
            span => span.textContent.trim()
          );
          const burdenName = words.join(' ');
          const ability = button.form.querySelector('#ability-select').value;
          const penalty = button.form.querySelector('#penalty-select').value;
          return { burdenName, ability, penalty, words };
        }
      },
      {
        action: 'cancel',
        label: game.i18n.localize('SDM.ButtonCancel'),
        icon: 'fa-solid fa-times'
      }
    ],
    render: (event, dialog) => {
      const html = dialog.element;
      const chipsContainer = html.querySelector('#burden-chips-container');
      const tableCells = html.querySelectorAll('.burden-table td');

      let draggedChip = null;

      chipsContainer.addEventListener('dragover', e => e.preventDefault());
      chipsContainer.addEventListener('drop', e => {
        e.preventDefault();
        if (!draggedChip) return;
        const targetChip = e.target.closest('.burden-chip');
        if (targetChip && targetChip !== draggedChip) {
          const rect = targetChip.getBoundingClientRect();
          const mouseX = e.clientX;
          const midpoint = rect.left + rect.width / 2;
          if (mouseX < midpoint) {
            targetChip.parentNode.insertBefore(draggedChip, targetChip);
          } else {
            targetChip.parentNode.insertBefore(draggedChip, targetChip.nextSibling);
          }
        } else {
          chipsContainer.appendChild(draggedChip);
        }
        draggedChip = null;
      });

      const addChip = word => {
        if (!word) return;
        const chip = document.createElement('span');
        chip.className = 'burden-chip';
        chip.draggable = true;
        chip.innerHTML = `<span>${word}</span><button type="button" class="remove-chip" title="${game.i18n.localize('SDM.BurdenGenerator.RemoveChip')}">✕</button>`;

        chip.addEventListener('dragstart', e => {
          draggedChip = chip;
          e.dataTransfer.effectAllowed = 'move';
        });
        chip.addEventListener('dragend', () => {
          draggedChip = null;
        });
        chip.addEventListener('dragover', e => e.preventDefault());
        chip.addEventListener('drop', e => e.preventDefault());

        chip.querySelector('.remove-chip').addEventListener('click', ev => {
          ev.stopPropagation();
          chip.remove();
        });

        chipsContainer.appendChild(chip);
        chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
      };

      const rollBtn = html.querySelector('#roll-burden-btn');
      const lastRollSpan = html.querySelector('#last-roll-result');

      rollBtn.addEventListener('click', () => {
        const row = Math.floor(Math.random() * 8) + 1;
        const col = Math.floor(Math.random() * 8) + 1;
        const word = tableData[row - 1][col - 1];
        lastRollSpan.textContent = game.i18n.format('SDM.BurdenGenerator.RollResult', {
          row,
          col,
          word
        });

        const cellIndex = (row - 1) * 8 + (col - 1);
        const targetCell = tableCells[cellIndex];
        if (targetCell) {
          targetCell.classList.add('highlight');
          setTimeout(() => targetCell.classList.remove('highlight'), 500);
        }
        addChip(word);
      });
    }
  });

  if (result?.burdenName) {
    await createBurdenOnActor(actor, result.burdenName, result.ability, result.penalty);
    ui.notifications.info(
      game.i18n.format('SDM.BurdenGenerator.NotificationCreated', { name: result.burdenName })
    );
  }
}

async function createBurdenOnActor(selectedActor, name, ability, penalty) {
  const penaltyValue = parseInt(penalty, 10);
  const abilityLabel = game.i18n.localize(CONFIG.SDM.abilities[ability] || ability);

  const effectData = {
    name: `${penaltyValue} ${abilityLabel}`,
    img: DEFAULT_BURDEN_ICON,
    type: 'base',
    system: {},
    changes: [
      {
        key: `system.abilities.${ability}.bonus`,
        mode: CONST.ACTIVE_EFFECT_MODES.ADD, // 2
        value: String(penaltyValue),
        priority: null
      }
    ],

    description: game.i18n.format('SDM.BurdenGenerator.ItemDescription', {
      penalty: penaltyValue,
      ability: abilityLabel
    })
  };

  const itemData = {
    name: name,
    type: 'burden',
    system: {
      description:  penaltyValue ? game.i18n.format('SDM.BurdenGenerator.ItemDescription', {
        penalty: penaltyValue,
        ability: abilityLabel
      }) : '',
    },
    effects: []
  };

  if (penaltyValue) {
    itemData.effects.push(effectData);
  }

  const itemObject = new Item(itemData).toObject();
  let actor = selectedActor || canvas?.tokens?.controlled[0]?.actor;

  if (actor) {
    await actor.createEmbeddedDocuments('Item', [itemObject]);
  } else {
    await SdmItem.create(itemObject);
  }
}
