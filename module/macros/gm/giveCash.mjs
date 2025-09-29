const { DialogV2 } = foundry.applications.api;
const { NumberField } = foundry.data.fields;

/**
 * Optionally call as:
 *   giveCash('all', 50, 'add')
 *   giveCash('Actor.abcd1234', 10, 'remove')
 *   giveCash('Scene.XYZ.Token.QRS', 5, 'add')
 *
 * @param {string} [targetParam]    'all' or an Actor/Token UUID
 * @param {number} [amountParam]    non-negative integer
 * @param {'add'|'remove'} [operationParam]
 * @param {boolean} [displayTransferNotification=true]
 */
export async function giveCash(
  targetParam,
  amountParam,
  operationParam,
  displayTransferNotification = true
) {
  if (!game.user.isGM) return;

  const MAX_STACK = 2500;
  const defaultCurrencyName = game.settings.get('sdm', 'currencyName') || 'cash';
  const defaultCurrencyImage =
    game.settings.get('sdm', 'currencyImage') ||
    'icons/commodities/currency/coins-stitched-pouch-brown.webp';

  // ---------------- helpers ----------------
  const listCashItems = actor =>
    actor.items.filter(i => i.type === 'gear' && i.system.size?.unit === 'cash');

  async function cleanupZeroCash(actor) {
    const items = listCashItems(actor);
    if (items.length <= 1) return; // one cash item may be 0
    const zeros = items.filter(i => Number(i.system?.quantity ?? 0) === 0);
    if (!zeros.length) return;

    // When multiple cash items exist, remove all zero-qty stacks
    await actor.deleteEmbeddedDocuments(
      'Item',
      zeros.map(z => z.id)
    );
  }

  // Add to the LOWEST quantity stacks first; create capped stacks as needed
  async function addCashToActor(actor, amount) {
    let remaining = Number(amount) || 0;
    if (remaining <= 0) return true;

    const items = listCashItems(actor).sort(
      (a, b) => Number(a.system?.quantity ?? 0) - Number(b.system?.quantity ?? 0)
    );

    const updates = [];

    // Fill existing stacks starting from the lowest qty
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

    // Create new stacks for anything left, each up to MAX_STACK
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
    return true;
  }

  // Remove from the LOWEST quantity stacks first
  async function removeCashFromActor(actor, amount) {
    let remaining = Number(amount) || 0;
    if (remaining <= 0) return true;

    const items = listCashItems(actor).sort(
      (a, b) => Number(a.system?.quantity ?? 0) - Number(b.system?.quantity ?? 0)
    );

    // Quick insufficient-funds check (no partial updates)
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
        // Will delete if there are other cash items left after all operations
        deletions.push(it.id);
      }

      remaining -= take;
    }

    // Ensure we don't delete the last remaining cash item; if our deletions
    // would remove all cash items, keep one at 0
    if (originalCount - deletions.length === 0) {
      // Keep one zero stack instead of deleting it
      const keepId = deletions[0];
      deletions.shift();
      updates.push({ _id: keepId, system: { quantity: 0 } });
    }

    if (updates.length) await actor.updateEmbeddedDocuments('Item', updates);
    if (deletions.length) await actor.deleteEmbeddedDocuments('Item', deletions);

    await cleanupZeroCash(actor);
    return true;
  }

  // Resolve UUID -> Actor (Actor or Token->Actor)
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

  const characters = game.actors.filter(a => a.type === 'character');
  const caravans = game.actors.filter(a => a.type === 'caravan');
  const allTransferTarget = [...characters, ...caravans];

  // ---------- fast-path ----------
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

  // ---------- dialog path ----------
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

  // Build targets: 'all' => characters, else specific UUID
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

  // Execute per target
  try {
    let successCount = 0;
    for (const target of targets) {
      if (data.operation === 'add') {
        await addCashToActor(target, data.amount);
        successCount += 1;
      } else if (data.operation === 'remove') {
        const ok = await removeCashFromActor(target, data.amount);
        if (!ok) {
          ui.notifications.warn(
            game.i18n.format('SDM.ErrorNotEnoughMoney', { target: target.name })
          );
          continue;
        }
        successCount += 1;
      }
    }

    if (displayTransferNotification && successCount > 0) {
      ui.notifications.info(
        game.i18n.format('SDM.CashManagementCompleted', { number: successCount })
      );
    }
  } catch (e) {
    ui.notifications.error(game.i18n.localize('SDM.ErrorCashManagementFailed'));
    console.error('Error:', e);
  }
}
