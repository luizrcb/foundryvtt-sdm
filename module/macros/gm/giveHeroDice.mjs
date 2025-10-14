import { $l10n, toPascalCase } from "../../helpers/globalUtils.mjs";
import { templatePath } from "../../helpers/templates.mjs";

const { renderTemplate } = foundry.applications.handlebars;
const { DialogV2 } = foundry.applications.api;

/**
 * Give / remove / set hero or blood dice for one actor or for all characters.
 */
export async function giveHeroDice() {
  if (!game.user.isGM) return;

  // Get all character actors
  const characters = game.actors.filter(a => a.type === 'character');

  // Character select options
  const characterOptions = [
    `<option value="all">${game.i18n.localize('SDM.AllCharacters')}</option>`,
    ...characters.map(c => `<option value="${c.id}">${c.name}</option>`)
  ].join('');

  // Resource selector (extendable)
  const resourceOptions = [
    { key: 'hero_dice', label: game.i18n.localize('SDM.HeroDicePl')},
    { key: 'blood_dice', label: game.i18n.localize('SDM.BloodDicePl') },
    { key: 'tourist_dice', label: game.i18n.localize('SDM.TouristDicePl') }
  ];

  const resourceOptionsHtml = resourceOptions
    .map(r => `<option value="${r.key}">${r.label}</option>`)
    .join('');

  const content = `
    <form class="hero-dice-adjustment">
      <div class="form-group">
        <label>${game.i18n.localize('SDM.SelectCharacter')}</label>
        <select name="character" class="form-control">
          ${characterOptions}
        </select>
      </div>

      <div class="form-group">
        <label>${game.i18n.localize('SDM.SelectResource') || 'Resource'}</label>
        <select name="resource" class="form-control">
          ${resourceOptionsHtml}
        </select>
      </div>
    </form>
  `;

  // Helper: returns an object from the dialog button callback
  const makeCallback = (cbData) => (event, button, dialog) => {
    const form = button.form;
    const character = form.querySelector('[name="character"]').value;
    const resource = form.querySelector('[name="resource"]').value;
    return Object.assign({ character, resource }, cbData);
  };

  // Show dialog
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
    ]
  });

  if (!data?.character) return;

  // Determine targets: all characters or single actor
  const targets = data.character === 'all'
    ? characters
    : [game.actors.get(data.character)].filter(Boolean);

  if (!targets.length) {
    ui.notifications.error(game.i18n.format('SDM.ErrorNoActorSelected', { type: 'character' }));
    return;
  }

  // Utility: safe accessor and clamping
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

  // Prepare updates
  const updates = [];
  const summaryTargets = []; // pass to summary poster

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
        // increment/decrement
        newValue = clamp(current + Number(data.adjustment || 0), 0, maxLevel);
        actualAdjustment = newValue - current;
      } else {
        // fallback: no-op
        newValue = current;
        actualAdjustment = 0;
      }

      if (actualAdjustment !== 0) {
        // create patch for the correct path
        const path = `system.${resource}.value`;
        updates.push({
          _id: actor.id,
          [path]: newValue
        });

        // record for summary (we'll build a friendly list)
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

  // Apply updates and post summary
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


/**
 * Post a summary card of changes to chat.
 * Accepts summaryTargets: [{ actor, resource, before, after, adjustment }]
 */
export async function postDiceSummary(summaryTargets = [], dialogData = {}, opts = {}) {
  const senderName = opts.senderName ?? game.user?.name ?? 'Gamemaster';
  const eventLabel = opts.eventLabel ?? $l10n('SDM.GMGiveHeroDice') ?? (game.i18n.localize('SDM.GMGiveHeroDice') || 'GM changed dice');

  // build heroDiceChanges-like structure but support multiple resources
  const changes = summaryTargets
    .map(item => {
      try {
        const actor = item.actor;
        const actorId = actor.id;
        const actorName = actor.name;
        const current = Number(item.before ?? 0);
        const after = Number(item.after ?? current);
        const resource = item.resource ?? 'hero_dice';
        const adjustment = Number(item.adjustment ?? (after - current));

        let actorImg = actor.img ?? null;
        if (!actorImg && actor.token?.texture?.src) actorImg = actor.token.texture.src;
        // fallback to prototype token if available
        if (!actorImg && actor.prototypeToken?.texture?.src) actorImg = actor.prototypeToken.texture.src;
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
