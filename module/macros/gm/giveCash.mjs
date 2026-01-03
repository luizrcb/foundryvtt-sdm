import { DEFAULT_CASH_ICON } from '../../helpers/constants.mjs';
import { templatePath } from '../../helpers/templates.mjs';

const { DialogV2 } = foundry.applications.api;
const { NumberField } = foundry.data.fields;
const { renderTemplate } = foundry.applications.handlebars;
const MAX_STACK = 2500;

async function addCashToActor(actor, amount, defaultCurrencyName, defaultCurrencyImage) {
  let remaining = Number(amount) || 0;
  if (remaining <= 0) return 0;

  const items = listCashItems(actor).sort(
    (a, b) => Number(a.system?.quantity ?? 0) - Number(b.system?.quantity ?? 0)
  );

  const updates = [];

  for (const it of items) {
    if (remaining <= 0) break;
    let qty = Math.max(0, Number(it.system?.quantity ?? 0));
    if (qty >= MAX_STACK) continue;
    const space = MAX_STACK - qty;
    const add = Math.min(space, remaining);
    if (add > 0) {
      qty += add;
      updates.push({ _id: it.id, system: { quantity: qty } });
      remaining -= add;
    }
  }

  const creates = [];
  while (remaining > 0) {
    const add = Math.min(MAX_STACK, remaining);
    creates.push({
      name: defaultCurrencyName,
      type: 'gear',
      img: defaultCurrencyImage,
      system: { size: { unit: 'cash' }, quantity: add }
    });
    remaining -= add;
  }

  if (updates.length) await actor.updateEmbeddedDocuments('Item', updates);
  if (creates.length) await actor.createEmbeddedDocuments('Item', creates);

  await cleanupZeroCash(actor);

  return Number(amount) - remaining;
}

async function removeCashFromActor(actor, amount) {
  let remaining = Number(amount) || 0;
  if (remaining <= 0) return 0;

  const items = listCashItems(actor).sort(
    (a, b) => Number(a.system?.quantity ?? 0) - Number(b.system?.quantity ?? 0)
  );

  const total = items.reduce((s, it) => s + Math.max(0, Number(it.system?.quantity ?? 0)), 0);
  if (remaining > total) return false;

  const updates = [];
  const deletions = [];
  const originalCount = items.length;

  for (const it of items) {
    if (remaining <= 0) break;

    const qty = Math.max(0, Number(it.system?.quantity ?? 0));
    if (qty <= 0) continue;

    const take = Math.min(qty, remaining);
    const newQty = qty - take;

    if (newQty > 0) {
      updates.push({ _id: it.id, system: { quantity: newQty } });
    } else {
      deletions.push(it.id);
    }

    remaining -= take;
  }

  if (originalCount - deletions.length === 0) {
    const keepId = deletions[0];
    deletions.shift();
    updates.push({ _id: keepId, system: { quantity: 0 } });
  }

  if (updates.length) await actor.updateEmbeddedDocuments('Item', updates);
  if (deletions.length) await actor.deleteEmbeddedDocuments('Item', deletions);

  await cleanupZeroCash(actor);

  return Number(amount) - remaining;
}

async function resolveActorFromUUID(uuid) {
  try {
    const doc = await fromUuid(uuid);
    if (!doc) return null;
    if (doc.documentName === 'Actor') return doc;
    if (doc.documentName === 'Token') return doc.actor ?? null;
    if (doc.actor) return doc.actor;
    return null;
  } catch {
    return null;
  }
}

const listCashItems = actor =>
  actor.items.filter(i => i.type === 'gear' && i.system.size?.unit === 'cash');

async function cleanupZeroCash(actor) {
  const items = listCashItems(actor);
  if (items.length <= 1) return;
  const zeros = items.filter(i => Number(i.system?.quantity ?? 0) === 0);
  if (!zeros.length) return;
  await actor.deleteEmbeddedDocuments(
    'Item',
    zeros.map(z => z.id)
  );
}

export async function giveCash(
  targetParam,
  amountParam,
  operationParam,
  displayTransferNotification = true
) {
  if (!game.user.isGM) return;

  const defaultCurrencyName = game.settings.get('sdm', 'currencyName') || 'cash';
  const defaultCurrencyImage =
    game.settings.get('sdm', 'currencyImage') ||
    DEFAULT_CASH_ICON;

  const characters = game.actors.filter(a => a.type === 'character');
  const caravans = game.actors.filter(a => a.type === 'caravan');
  const allTransferTarget = [...characters, ...caravans];

  let data = null;
  const opOk = operationParam === 'add' || operationParam === 'remove';
  const amtOk = Number.isFinite(Number(amountParam)) && Number(amountParam) >= 0;

  let tgtOk = false;
  if (targetParam === 'all') {
    tgtOk = true;
  } else if (typeof targetParam === 'string') {
    const maybeActor = await resolveActorFromUUID(targetParam);
    tgtOk = !!maybeActor;
  }

  if (opOk && amtOk && tgtOk) {
    data = {
      target: targetParam,
      amount: Number.parseInt(String(amountParam), 10),
      operation: operationParam
    };
  }

  if (!data) {
    const cashInput = new NumberField({
      label: game.i18n.localize('SDM.Amount'),
      min: 0
    }).toFormGroup({}, { value: 0, name: 'amount', min: 0 }).outerHTML;

    const content = `
    <fieldset>
      <legend>${game.i18n.localize('SDM.CashManagement')}</legend>
      <div class="form-group">
        <label>${game.i18n.localize('SDM.Target')}</label>
        <select name="target" class="form-control">
          <option value="all">${game.i18n.localize('SDM.AllCharacters')}</option>
          ${allTransferTarget.map(c => `<option value="${c.uuid}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        ${cashInput}
      </div>
    </fieldset>
    `;

    data = await DialogV2.wait({
      window: { title: game.i18n.localize('SDM.CashManagement'), resizable: false },
      modal: true,
      content,
      buttons: [
        {
          action: 'add',
          label: game.i18n.localize('SDM.CashManagementAddMoney'),
          icon: 'fa-solid fa-coins',
          callback: (event, button) => ({
            target: button.form.querySelector('[name="target"]').value,
            amount: parseInt(button.form.querySelector('[name="amount"]').value),
            operation: 'add'
          })
        },
        {
          action: 'remove',
          label: game.i18n.localize('SDM.CashManagementRemoveMoney'),
          icon: 'fa-solid fa-minus-circle',
          callback: (event, button) => ({
            target: button.form.querySelector('[name="target"]').value,
            amount: parseInt(button.form.querySelector('[name="amount"]').value),
            operation: 'remove'
          })
        }
      ],
      rejectClose: false
    });
  }

  if (!data?.amount && data?.amount !== 0) return;

  if (data.amount < 0 || !Number.isFinite(Number(data.amount))) {
    ui.notifications.error(game.i18n.localize('SDM.ErrorTransferAmountNotPositive'));
    return;
  }

  let targets = [];
  if (data.target === 'all') {
    targets = characters;
  } else {
    const actor = await resolveActorFromUUID(data.target);
    if (actor) targets = [actor];
  }

  if (!targets.length) {
    ui.notifications.error(game.i18n.format('SDM.ErrorNoActorSelected', { type: 'target' }));
    return;
  }

  try {
    let successCount = 0;
    const cashChanges = [];

    for (const target of targets) {
      const sumCash = actor =>
        actor.items
          .filter(i => i.type === 'gear' && i.system?.size?.unit === 'cash')
          .reduce((s, it) => s + Math.max(0, Number(it.system?.quantity ?? 0)), 0);

      const before = sumCash(target);
      if (data.operation === 'add') {
        const added = await addCashToActor(
          target,
          data.amount,
          defaultCurrencyName,
          defaultCurrencyImage
        );
        if (added > 0) {
          successCount += 1;
        } else {
          continue;
        }
      } else if (data.operation === 'remove') {
        const removed = await removeCashFromActor(target, data.amount);
        if (removed === false) {
          ui.notifications.warn(
            game.i18n.format('SDM.ErrorNotEnoughMoney', { target: target.name })
          );
          cashChanges.push({
            actorId: target.id,
            actorName: target.name,
            actorImg: target.img || null,
            amount: 0,
            before,
            after: before,
            currency: defaultCurrencyName,
            note: game.i18n.format('SDM.ErrorNotEnoughMoney', { target: target.name })
          });
          continue;
        } else if (removed > 0) {
          successCount += 1;
        } else {
          continue;
        }
      }

      const refreshed = game.actors.get(target.id) ?? target;
      const after = sumCash(refreshed);
      const delta = after - before;
      if (delta === 0) continue;

      cashChanges.push({
        actorId: target.id,
        actorName: target.name,
        actorImg: target.img || null,
        amount: delta,
        before,
        after,
        currency: defaultCurrencyName,
        note: undefined
      });
    }

    if (displayTransferNotification && successCount > 0) {
      if (cashChanges.length) {
        const ctx = {
          messageId: foundry.utils.randomID(),
          timestamp: new Date().toLocaleTimeString(),
          senderName: 'Gamemaster',
          logId: `cash-${Date.now()}-${foundry.utils.randomID(4)}`,
          eventLabel: game.i18n.localize('SDM.GMGiveCash') ?? 'Cash Management',
          cashChanges
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
          speaker: ChatMessage.getSpeaker({ alias: 'Gamemaster' }),
        });
      }

      ui.notifications.info(
        game.i18n.format('SDM.CashManagementCompleted', { number: successCount })
      );
    }
  } catch (e) {
    ui.notifications.error(game.i18n.localize('SDM.ErrorCashManagementFailed'));
    console.error('Error:', e);
  }
}
