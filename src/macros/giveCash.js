const { DialogV2 } = foundry.applications.api;
const { NumberField } = foundry.data.fields;

if (!game.user.isGM) return;

const defaultCurrencyName = game.settings.get('sdm', 'currencyName') || 'cash';
const defaultCurrencyImage =
  game.settings.get('sdm', 'currencyImage') ||
  'icons/commodities/currency/coins-stitched-pouch-brown.webp';

function findCashItem(actor) {
  const cashItems = actor.items.filter(i => i.type === 'gear' && i.system.size?.unit === 'cash');
  if (!cashItems.length) return null;

  if (cashItems.length === 1) return cashItems[0];

  const defaultCashItem = cashItems.find(
    i => i.name === defaultCurrencyName && i.img === defaultCurrencyImage
  );
  if (defaultCashItem) return defaultCashItem;

  // fallback to size = 1 cash item
  return cashItems.find(i => i.system.size?.value === 1);
}

const characters = game.actors.filter(a => a.type === 'character');
const caravans = game.actors.filter(a => a.type === 'caravan');
const allTransferTarget = [...characters, ...caravans];

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
        ${allTransferTarget.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      ${cashInput}
    </div>
  </fieldset>
  </div>
`;

const data = await DialogV2.wait({
  window: {
    title: game.i18n.localize('SDM.CashManagement'),
    resizable: false
  },
  modal: true,
  content,
  buttons: [
    {
      action: 'add',
      label: game.i18n.localize('SDM.CashManagementAddMoney'),
      icon: 'fas fa-coins',
      callback: (event, button, dialog) => ({
        target: button.form.querySelector('[name="target"]').value,
        amount: parseInt(button.form.querySelector('[name="amount"]').value),
        operation: 'add'
      })
    },
    {
      action: 'remove',
      label: game.i18n.localize('SDM.CashManagementRemoveMoney'),
      icon: 'fas fa-minus-circle',
      callback: (event, button, dialog) => ({
        target: button.form.querySelector('[name="target"]').value,
        amount: parseInt(button.form.querySelector('[name="amount"]').value),
        operation: 'remove'
      })
    }
  ],
  rejectClose: false
});

if (!data?.amount) {
  return;
}

if (data?.amount < 0) {
  ui.notifications.error(game.i18n.localize('SDM.ErrorTransferAmountNotPositive'));
  return;
}

const targets = data.target === 'all' ? characters : [game.actors.get(data.target)].filter(Boolean);

if (!targets.length) {
  ui.notifications.error(game.i18n.format('SDM.ErrorNoActorSelected', { type: 'target' }));
  return;
}

try {
  for (const target of targets) {
    const cashItem = findCashItem(target);

    if (data.operation === 'add') {
      if (cashItem) {
        await target.updateEmbeddedDocuments('Item', [
          {
            _id: cashItem.id,
            system: { quantity: cashItem.system.quantity + data.amount }
          }
        ]);
      } else {
        await target.createEmbeddedDocuments('Item', [
          {
            name: defaultCurrencyName,
            type: 'gear',
            img: defaultCurrencyImage,
            system: {
              size: { unit: 'cash' },
              quantity: data.amount
            }
          }
        ]);
      }
    } else if (data.operation === 'remove') {
      if (!cashItem) {
        ui.notifications.warn(game.i18n.format('SDM.ErrorNoMoney', { target: target.name }));
        continue;
      }

      const newQuantity = cashItem.system.quantity - data.amount;
      if (newQuantity < 0) {
        ui.notifications.warn(game.i18n.format('SDM.ErrorNotEnoughMoney', { target: target.name }));
        continue;
      }

      await target.updateEmbeddedDocuments('Item', [
        {
          _id: cashItem.id,
          system: { quantity: newQuantity }
        }
      ]);
    }
  }

  ui.notifications.info(
    game.i18n.format('SDM.CashManagementCompleted', { number: targets.length })
  );
} catch (e) {
  ui.notifications.error(game.i18n.localize('SDM.ErrorCashManagementFailed'));
  console.error('Error:', e);
}
