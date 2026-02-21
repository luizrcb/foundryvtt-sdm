import { $l10n } from '../../helpers/globalUtils.mjs';
import { templatePath } from '../../helpers/templates.mjs';

const { DialogV2 } = foundry.applications.api;
const { NumberField } = foundry.data.fields;
const { renderTemplate } = foundry.applications.handlebars;

export async function giveExperience() {
  if (!game.user.isGM) return;

  // Get all character actors (only characters)
  const characters = game.actors.filter(e => e.type === 'character');

  // Build actor grid with checkboxes (two columns)
  const actorEntries = characters
    .map(actor => {
      const img = actor.img || 'icons/svg/mystery-man.svg';
      return `
      <div class="grid-span-1">
        <label class="actor-selector" style="display:flex; align-items:center; gap:5px; padding:4px; border:1px solid #ccc; border-radius:4px;">
          <input type="checkbox" name="actor-${actor.id}" value="${actor.id}" class="character-checkbox">
          <img src="${img}" style="width:32px; height:32px; border-radius:4px; object-fit:cover;">
          <span>${actor.name}</span>
        </label>
      </div>
    `;
    })
    .join('');

  const xpInput = new NumberField({
    label: game.i18n.localize('SDM.XPToGive')
  }).toFormGroup({}, { value: 0, name: 'xp', autofocus: true }).outerHTML;

  const content = `
  <style>
    .actor-grid {
      border: 1px solid #999;
      padding: 8px;
      margin: 10px 0;
      max-height: 300px;
      overflow-y: auto;
    }
    .actor-selector {
      cursor: pointer;
      background: rgba(0,0,0,0.05);
      transition: background 0.2s;
    }
    .actor-selector:hover {
      background: rgba(0,0,0,0.1);
    }
  </style>
  <fieldset>
    <legend>${game.i18n.localize('SDM.ExperienceDistribution')}</legend>

    <div class="form-group" style="margin-bottom:10px;">
      <label style="display:flex; align-items:center; gap:5px;">
        <input type="checkbox" id="select-all-actors">
        <strong>${game.i18n.localize('SDM.SelectAllCharacters')}</strong>
      </label>
    </div>

    <div class="actor-grid grid grid-2col" id="actor-grid">
      ${actorEntries}
    </div>

    ${xpInput}
  </fieldset>
  `;

  const data = await DialogV2.prompt({
    window: { title: game.i18n.localize('SDM.ExperienceDistribution') },
    content,
    ok: {
      label: game.i18n.localize('SDM.DistributeXP'),
      icon: 'fa-solid fa-hand-holding-medical',
      callback: (event, button) => {
        const form = button.form;
        const selectedIds = [...form.querySelectorAll('.character-checkbox:checked')].map(
          cb => cb.value
        );
        const xp = parseInt(form.querySelector('[name="xp"]').value) || 0;
        return { targets: selectedIds, xp };
      }
    },
    render: (event, dialog) => {
      const html = dialog.element;
      const selectAll = html.querySelector('#select-all-actors');
      const charCheckboxes = html.querySelectorAll('.character-checkbox');

      charCheckboxes.forEach(cb => cb.checked = true);

      if (!selectAll || !charCheckboxes.length) return;

      const updateSelectAll = () => {
        const total = charCheckboxes.length;
        const checked = [...charCheckboxes].filter(cb => cb.checked).length;
        if (checked === 0) {
          selectAll.checked = false;
          selectAll.indeterminate = false;
        } else if (checked === total) {
          selectAll.checked = true;
          selectAll.indeterminate = false;
        } else {
          selectAll.indeterminate = true;
        }
      };

      selectAll.addEventListener('change', e => {
        const isChecked = e.target.checked;
        charCheckboxes.forEach(cb => (cb.checked = isChecked));
        selectAll.indeterminate = false;
      });

      charCheckboxes.forEach(cb => cb.addEventListener('change', updateSelectAll));
      updateSelectAll();
    },
    rejectClose: false
  });

  if (!data || !data.targets.length || data.xp <= 0) return;

  // Get target actors
  const targets = data.targets.map(id => game.actors.get(id)).filter(Boolean);
  if (!targets.length) return;

  // Prepare updates
  const updates = targets.map(actor => ({
    _id: actor.id,
    'system.player_experience': `${Math.max(parseInt(actor.system.player_experience) + data.xp, 0)}`
  }));

  // Build summary
  const xpChanges = targets.map(actor => {
    const before = Number(actor.system?.player_experience ?? 0);
    const after = Math.max(0, before + data.xp);
    return {
      actorId: actor.id,
      actorName: actor.name,
      actorImg: actor.img || null,
      amount: data.xp,
      before,
      after
    };
  });

  await Actor.updateDocuments(updates);

  // Post chat summary
  if (xpChanges.length) {
    const ctx = {
      messageId: foundry.utils.randomID(),
      timestamp: new Date().toLocaleTimeString(),
      senderName: 'Gamemaster',
      logId: `xp-${Date.now()}-${foundry.utils.randomID(4)}`,
      eventLabel: $l10n('SDM.GMGiveExperience') ?? 'Experience Distribution',
      xpChanges
    };

    let html = await renderTemplate(templatePath('chat/adjustments-summary-card'), ctx);
    if (typeof html !== 'string') {
      if (html instanceof HTMLElement) html = html.outerHTML;
      else if (html instanceof NodeList || html instanceof HTMLCollection) {
        html = Array.from(html)
          .map(n => n.outerHTML ?? String(n))
          .join('');
      } else html = String(html);
    }

    await ChatMessage.create({
      content: html,
      speaker: ChatMessage.getSpeaker({ alias: 'Gamemaster' })
    });
  }

  ui.notifications.info(
    game.i18n.format('SDM.ExperienceDistributionCompleted', { xp: data.xp, number: targets.length })
  );
}
