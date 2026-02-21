import { ActorType } from '../../helpers/constants.mjs';
import { $l10n, toPascalCase } from '../../helpers/globalUtils.mjs';
import { templatePath } from '../../helpers/templates.mjs';

const { renderTemplate } = foundry.applications.handlebars;
const { DialogV2 } = foundry.applications.api;

export async function giveHeroDice() {
  if (!game.user.isGM) return;

  const characters = game.actors.filter(a => a.type === ActorType.CHARACTER);

  // Build actor grid (same as experience)
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

  // Resource radio buttons with icons and colors
  const resourceOptions = [
    {
      key: 'hero_dice',
      label: game.i18n.localize('SDM.HeroDicePl'),
      icon: 'fa-solid fa-dice-d6',
    },
    {
      key: 'blood_dice',
      label: game.i18n.localize('SDM.BloodDicePl'),
      icon: 'fa-solid fa-dice-d6',
      colorClass: 'blood'
    },
    {
      key: 'tourist_dice',
      label: game.i18n.localize('SDM.TouristDicePl'),
      icon: 'fa-solid fa-dice-d6',
      colorClass: 'pine'
    }
  ];

  const resourceRadios = resourceOptions
    .map(
      r => `
    <label style="display:inline-flex; align-items:center; gap:5px; margin-right:15px; cursor:pointer;">
      <input type="radio" name="resource" value="${r.key}" ${r.key === 'hero_dice' ? 'checked' : ''}>
      <i class="${r.icon} ${r.colorClass}" style="font-size:1.2em;"></i>
      ${r.label}
    </label>
  `
    )
    .join('');

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
    /* Color classes for dice icons (adjust as needed) */
    .blood-dice { color: #aa0000; } /* blood red */
    .tourist-dice { color: #228B22; } /* pine green */
    .resource-group {
      margin: 10px 0;
      padding: 8px;
      background: rgba(0,0,0,0.05);
      border-radius: 4px;
    }
  </style>
  <form class="hero-dice-adjustment">
    <fieldset>
      <legend>${game.i18n.localize('SDM.ManageHeroDice') || 'Manage Dice'}</legend>

      <div class="form-group" style="margin-bottom:10px;">
        <label style="display:flex; align-items:center; gap:5px;">
          <input type="checkbox" id="select-all-actors" checked>
          <strong>${game.i18n.localize('SDM.SelectAllCharacters')}</strong>
        </label>
      </div>

      <div class="actor-grid grid grid-2col" id="actor-grid">
        ${actorEntries}
      </div>

      <div class="resource-group">
        <label style="display:block; margin-bottom:5px;"><strong>${game.i18n.localize('SDM.SelectResource') || 'Resource'}</strong></label>
        <div>
          ${resourceRadios}
        </div>
      </div>
    </fieldset>
  </form>
  `;

  // Helper to collect form data in button callbacks
  const makeCallback = cbData => (event, button, dialog) => {
    const form = button.form;
    const selectedIds = [...form.querySelectorAll('.character-checkbox:checked')].map(
      cb => cb.value
    );
    const resource = form.querySelector('[name="resource"]:checked')?.value || 'hero_dice';
    return Object.assign({ targets: selectedIds, resource }, cbData);
  };

  const data = await DialogV2.wait({
    window: {
      title: game.i18n.localize('SDM.ManageHeroDice') || 'Manage Dice',
      resizable: false
    },
    rejectClose: false,
    modal: true,
    content,
    buttons: [
      {
        action: 'setZero',
        label: game.i18n.localize('SDM.SetToZero') || 'Set to 0',
        icon: 'fa-solid fa-ban',
        type: 'button',
        callback: makeCallback({ operation: 'setZero' })
      },
      {
        action: 'increment',
        label: `1 ${game.i18n.localize('SDM.Die') || 'Die'}`,
        icon: 'fa-solid fa-plus',
        type: 'button',
        callback: makeCallback({ operation: 'increment', adjustment: 1 })
      },
      {
        action: 'decrement',
        label: `1 ${game.i18n.localize('SDM.Die') || 'Die'}`,
        icon: 'fa-solid fa-minus',
        type: 'button',
        callback: makeCallback({ operation: 'decrement', adjustment: -1 })
      },
      {
        action: 'setMax',
        label: game.i18n.localize('SDM.SetToMax') || 'Set to Max',
        icon: 'fa-solid fa-arrow-up-wide-short',
        type: 'button',
        callback: makeCallback({ operation: 'setMax' })
      }
    ],
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
    }
  });

  if (!data || !data.targets?.length) {
    return;
  }

  const targets = data.targets.map(id => game.actors.get(id)).filter(Boolean);
  if (!targets.length) return;

  // Utility functions (same as before)
  const getResourceValue = (actor, resource) => {
    try {
      const resObj = actor.system?.[resource] ?? {};
      const value = Number(resObj?.value ?? 0);
      const max = Number(resObj?.max ?? 1);
      return {
        current: Number.isFinite(value) ? Math.max(0, value) : 0,
        maxLevel: Number.isFinite(max) ? Math.max(1, max) : 1
      };
    } catch (e) {
      console.error('getResourceValue error for', actor, resource, e);
      return { current: 0, maxLevel: 1 };
    }
  };

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  const updates = [];
  const summaryTargets = [];

  for (const actor of targets) {
    try {
      const resource = data.resource || 'hero_dice';
      const { current, maxLevel } = getResourceValue(actor, resource);

      let newValue = current;
      let actualAdjustment = 0;

      if (data.operation === 'setZero') {
        newValue = 0;
        actualAdjustment = newValue - current;
      } else if (data.operation === 'setMax') {
        newValue = maxLevel;
        actualAdjustment = newValue - current;
      } else if (typeof data.adjustment === 'number') {
        newValue = clamp(current + Number(data.adjustment || 0), 0, maxLevel);
        actualAdjustment = newValue - current;
      } else {
        newValue = current;
        actualAdjustment = 0;
      }

      if (actualAdjustment !== 0) {
        updates.push({
          _id: actor.id,
          [`system.${resource}.value`]: newValue
        });

        summaryTargets.push({
          actor,
          resource,
          before: current,
          after: newValue,
          adjustment: actualAdjustment
        });
      }
    } catch (e) {
      console.error(game.i18n.format('SDM.ErrorUpdateDoc', { doc: actor.name }), e);
    }
  }

  if (updates.length > 0) {
    try {
      await postDiceSummary(summaryTargets, data);
      await Actor.updateDocuments(updates);
      ui.notifications.info(game.i18n.format('SDM.UpdatedHeroDice', { number: updates.length }));
    } catch (err) {
      console.error('Erro ao aplicar updates:', err);
      ui.notifications.error(game.i18n.localize('SDM.ErrorGeneric') || 'Failed to update actors.');
    }
  } else {
    ui.notifications.warn(game.i18n.localize('SDM.MessageNoChanges'));
  }
}

// postDiceSummary remains unchanged (already provided)
export async function postDiceSummary(summaryTargets = [], dialogData = {}, opts = {}) {
  const senderName = opts.senderName ?? game.user?.name ?? 'Gamemaster';
  const eventLabel =
    opts.eventLabel ??
    $l10n('SDM.GMGiveHeroDice') ??
    (game.i18n.localize('SDM.GMGiveHeroDice') || 'GM changed dice');

  const changes = summaryTargets
    .map(item => {
      try {
        const actor = item.actor;
        const actorId = actor.id;
        const actorName = actor.name;
        const current = Number(item.before ?? 0);
        const after = Number(item.after ?? current);
        const resource = item.resource ?? 'hero_dice';
        const adjustment = Number(item.adjustment ?? after - current);

        let actorImg = actor.img ?? null;
        if (!actorImg && actor.token?.texture?.src) actorImg = actor.token.texture.src;
        if (!actorImg && actor.prototypeToken?.texture?.src)
          actorImg = actor.prototypeToken.texture.src;
        const resourceName = toPascalCase(resource).replace(' ', '');
        return {
          actorId,
          actorName,
          actorImg,
          resource,
          resourceLabel: game.i18n.localize(`SDM.${resourceName}Pl`) ?? resource,
          adjustment,
          before: current,
          after,
          note: dialogData.note ?? dialogData.reason ?? undefined
        };
      } catch (err) {
        console.error('Erro ao montar change item', item, err);
        return null;
      }
    })
    .filter(Boolean);

  if (!changes.length) {
    console.debug('No effective resource changes — skipping chat post.');
    return null;
  }

  const ctx = {
    messageId: foundry.utils.randomID(),
    timestamp: new Date().toLocaleTimeString(),
    senderName,
    logId: `dice-changes-${Date.now()}-${foundry.utils.randomID(4)}`,
    eventLabel,
    changes
  };

  try {
    const html = await renderTemplate(templatePath('chat/adjustments-summary-card'), ctx);
    await ChatMessage.create({
      content: html,
      speaker: ChatMessage.getSpeaker({ alias: senderName })
    });
    return ctx;
  } catch (err) {
    console.error('Erro ao postar resumo de recursos:', err);
    throw err;
  }
}
