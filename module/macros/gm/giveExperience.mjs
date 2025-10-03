import { $l10n } from "../../helpers/globalUtils.mjs";
import { templatePath } from "../../helpers/templates.mjs";

const { DialogV2 } = foundry.applications.api;
const { NumberField } = foundry.data.fields;
const { renderTemplate } = foundry.applications.handlebars;

export async function giveExperience() {
  if (!game.user.isGM) return;

  // Get all character actors
  const characters = game.actors.filter(e => e.type === 'character');

  // Create form elements
  const xpInput = new NumberField({
    label: game.i18n.localize('SDM.XPToGive')
  }).toFormGroup({}, { value: 0, name: 'xp', autofocus: true }).outerHTML;

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
      icon: 'fa-solid fa-hand-holding-medical',
      callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
    },
    rejectClose: false
  });

  if (!data) return;

  // Determine targets
  const targets = data.character === 'all' ? characters : [game.actors.get(data.character)];

  // Prepare updates
  const updates = targets.map(actor => ({
    _id: actor.id,
    'system.player_experience': `${Math.max(parseInt(actor.system.player_experience) + data.xp, 0)}`
  }));

  // Antes de aplicar mudanças:
  const xpChanges = targets
    .map(actor => {
      const before = Number(actor.system?.player_experience ?? 0);
      const added = Number(data.xp ?? 0) || 0;
      const after = Math.max(0, before + added);
      // se você quiser permitir diminuição (negativos) ajustaria aqui
      return {
        actorId: actor.id,
        actorName: actor.name,
        actorImg: actor.prototypeToken?.texture?.src || actor.img || null,
        amount: added, // positivo = ganho
        before,
        after,
        note: data.note ?? undefined
      };
    })
    .filter(Boolean);

  // Aplica updates (o seu código atual)
  await Actor.updateDocuments(updates);

  // Depois, post:
  if (xpChanges.length) {
    const ctx = {
      messageId: foundry.utils.randomID(),
      timestamp: new Date().toLocaleTimeString(),
      senderName: 'Gamemaster',
      logId: `xp-${Date.now()}-${foundry.utils.randomID(4)}`,
      eventLabel: $l10n('SDM.GMGiveExperience') ?? 'Experience Distribution',
      xpChanges
    };

    try {
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
        speaker: ChatMessage.getSpeaker({ alias: 'Gamemaster' }),
        type: CONST.CHAT_MESSAGE_TYPES.OOC
      });
    } catch (err) {
      console.error('Erro ao postar resumo de XP:', err);
    }
  }

  ui.notifications.info(
    game.i18n.format('SDM.ExperienceDistributionCompleted', { xp: data.xp, number: targets.length })
  );
}
