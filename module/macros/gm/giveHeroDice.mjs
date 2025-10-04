import { $l10n } from "../../helpers/globalUtils.mjs";
import { templatePath } from "../../helpers/templates.mjs";

const { renderTemplate } = foundry.applications.handlebars;
const { DialogV2 } = foundry.applications.api;

export async function giveHeroDice() {
  if (!game.user.isGM) return;

  // Get all character actors
  const characters = game.actors.filter(e => e.type === 'character');

  // Create character select options
  const characterOptions = [
    `<option value="all">${game.i18n.localize('SDM.AllCharacters')}</option>`,
    ...characters.map(c => `<option value="${c.id}">${c.name}</option>`)
  ].join('');

  const content = `
  <form class="hero-dice-adjustment">
    <div class="form-group">
      <label>${game.i18n.localize('SDM.SelectCharacter')}</label>
      <select name="character" class="form-control">
        ${characterOptions}
      </select>
    </div>
  </form>
`;

  // Show dialog with properly configured buttons
  const data = await DialogV2.wait({
    window: {
      title: game.i18n.localize('SDM.ManageHeroDice'),
      resizable: false
    },
    rejectClose: false,
    modal: true,
    content,
    buttons: [
      {
        action: 'increment',
        label: `1 ${game.i18n.localize('SDM.HeroDie')}`,
        icon: 'fa-solid fa-plus',
        type: 'button',
        callback: (event, button, dialog) => ({
          character: button.form.querySelector('[name="character"]').value,
          adjustment: 1
        })
      },
      {
        action: 'decrement',
        label: `1 ${game.i18n.localize('SDM.HeroDie')}`,
        icon: 'fa-solid fa-minus',
        type: 'button',
        callback: (event, button, dialog) => ({
          character: button.form.querySelector('[name="character"]').value,
          adjustment: -1
        })
      }
    ]
  });

  if (!data?.character) return;

  // Process targets with error handling
  const targets =
    data.character === 'all' ? characters : [game.actors.get(data.character)].filter(Boolean);

  if (!targets.length) {
    ui.notifications.error(game.i18n.format('SDM.ErrorNoActorSelected', { type: 'character' }));
    return;
  }

  // Prepare updates with validation
  const updates = targets
    .map(actor => {
      try {
        const current = Math.max(0, actor.system.hero_dice?.value || 0);
        const maxLevel = Math.max(1, actor.system.hero_dice?.max || 1);
        const newValue = Math.clamp(current + data.adjustment, 0, maxLevel);
        return newValue !== current
          ? {
              _id: actor.id,
              'system.hero_dice.value': newValue
            }
          : null;
      } catch (e) {
        console.error(game.i18n.format('SDM.ErrorUpdateDoc', { doc: actor.name }), e);
        return null;
      }
    })
    .filter(Boolean);

  // Apply changes
  if (updates.length > 0) {
    await postHeroDiceSummary(targets, data);
    await Actor.updateDocuments(updates);


    ui.notifications.info(game.i18n.format('SDM.UpdatedHeroDice', { number: updates.length }));
  } else {
    ui.notifications.warn(game.i18n.localize('SDM.MessageNoChanges'));
  }
}


async function postHeroDiceSummary(targets = [], data = {}, opts = {}) {
  // opts: { senderName, eventLabel, template } - opcional
  const senderName = opts.senderName ?? 'Gamemaster';
  const eventLabel = opts.eventLabel ?? $l10n('SDM.GMGiveHeroDice');

  // Constrói o array heroDiceChanges a partir dos targets e do ajuste solicitado
  const heroDiceChanges = targets
    .map(actor => {
      try {
        const actorId = actor.id;
        const actorName = actor.name;
        // pega valor atual e máximo com fallback seguro
        const current = Math.max(0, Number(actor.system?.hero_dice?.value ?? 0));
        const maxLevel = Math.max(1, Number(actor.system?.hero_dice?.max ?? 1));
        // calcula novo valor com clamp (sem depender de Math.clamp)
        const requested = Number(data.adjustment) || 0;
        const tentative = current + requested;
        const newValue = Math.min(Math.max(tentative, 0), maxLevel);
        const actualAdjustment = newValue - current; // pode ser 0 se já estiver no limite

        if (actualAdjustment === 0) return null; // não mudou → omitimos do resumo

        // tenta obter uma imagem representativa: prefer token img se existir, senão actor.img
        // Se o actor for um token, ele pode ter token.img; se for actor directory use actor.img
        let actorImg = actor.img || null;
        // alternativa: se actor.token (TokenDocument) estiver disponível:
        if (!actorImg && actor.token?.texture?.src) actorImg = actor.token.texture.src;

        return {
          actorId,
          actorName,
          actorImg,
          adjustment: actualAdjustment, // +1 ou -1 (inteiro)
          before: current,
          after: newValue,
          note: data.note ?? data.reason ?? undefined
        };
      } catch (err) {
        console.error('Erro ao montar heroDiceChanges para', actor, err);
        return null;
      }
    })
    .filter(Boolean);

  // se não houver mudanças reais, não postar nada
  if (!heroDiceChanges.length) {
    console.debug('Nenhuma mudança de Hero Dice efetiva — nada a postar.');
    return null;
  }

  // monta o contexto completo esperado pelo template
  const ctx = {
    messageId: foundry.utils.randomID(),
    timestamp: new Date().toLocaleTimeString(),
    senderName,
    logId: `hero-dice-${Date.now()}-${foundry.utils.randomID(4)}`,
    eventLabel,
    heroDiceChanges
  };

  // renderiza template e cria ChatMessage (verificando tipo do retorno)
  try {
    let html = await renderTemplate(templatePath('chat/adjustments-summary-card'), ctx);

    // Debug rápido — confirme que é string
    if (typeof html !== 'string') {
      console.warn('renderTemplate retornou não-string — convertendo para string segura.', html);
      if (html instanceof HTMLElement) {
        html = html.outerHTML;
      } else if (html instanceof NodeList || html instanceof HTMLCollection) {
        html = Array.from(html)
          .map(n => n.outerHTML ?? String(n))
          .join('');
      } else {
        html = String(html);
      }
    }

    // Cria a mensagem no chat (ajuste whisper/speaker conforme sua necessidade)
    await ChatMessage.create({
      content: html,
      speaker: ChatMessage.getSpeaker({ alias: senderName }),
    });

    return ctx; // retorno útil para testes / logs
  } catch (err) {
    console.error('Erro ao postar resumo de Hero Dice:', err);
    throw err;
  }
}
