const { DialogV2 } = foundry.applications.api;
const { NumberField } = foundry.data.fields;

if (!game.user.isGM) return;

function findCashItem(actor) {
  return actor.items.find(i => i.type === 'gear' && i.system.size?.unit === 'cash');
}

const characters = game.actors.filter(a => a.type === "character");
const cashInput = new NumberField({
  label: "Quantity",
  min: 1
}).toFormGroup({}, { value: 1, name: "amount" }).outerHTML;

const content = `
  <div class="cash-transfer-dialog">
    <div class="form-group">
      <label>Select Target:</label>
      <select name="target" class="form-control">
        <option value="all">All Characters</option>
        ${characters.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      ${cashInput}
    </div>
  </div>
`;

const data = await DialogV2.wait({
  window: {
    title: "Cash Management",
    resizable: false
  },
  modal: true,
  content,
  buttons: [
    {
      action: "add",
      label: "Add Money",
      icon: "fas fa-coins",
      callback: (event, button, dialog) => ({
        target: button.form.querySelector('[name="target"]').value,
        amount: parseInt(button.form.querySelector('[name="amount"]').value),
        operation: "add"
      })
    },
    {
      action: "remove",
      label: "Remove Money",
      icon: "fas fa-minus-circle",
      callback: (event, button, dialog) => ({
        target: button.form.querySelector('[name="target"]').value,
        amount: parseInt(button.form.querySelector('[name="amount"]').value),
        operation: "remove"
      })
    }
  ],
  rejectClose: false,
});

if (!data?.target) return;

const targets = data.target === "all"
  ? characters
  : [game.actors.get(data.target)].filter(Boolean);

if (!targets.length) {
  ui.notifications.error("No valid target selected!");
  return;
}

try {
  for (const target of targets) {
    const cashItem = findCashItem(target);

    if (data.operation === "add") {
      if (cashItem) {
        await target.updateEmbeddedDocuments("Item", [{
          _id: cashItem.id,
          system: { quantity: cashItem.system.quantity + data.amount }
        }]);
      } else {
        const currencyName = game.settings.get("sdm", "currencyName");
        await target.createEmbeddedDocuments("Item", [{
          name: currencyName,
          type: "gear",
          system: {
            size: { unit: "cash" },
            quantity: data.amount
          }
        }]);
      }
    }
    else if (data.operation === "remove") {
      if (!cashItem) {
        ui.notifications.warn(`${target.name} doesn't have any money!`);
        continue;
      }

      const newQuantity = cashItem.system.quantity - data.amount;
      if (newQuantity < 0) {
        ui.notifications.warn(`${target.name} doesn't have enough money!`);
        continue;
      }

      await target.updateEmbeddedDocuments("Item", [{
        _id: cashItem.id,
        system: { quantity: newQuantity }
      }]);
    }
  }

  ui.notifications.info(`Cash transfer successful for ${targets.length} character(s)!`);

} catch (e) {
  ui.notifications.error("An error has happened during cash transfer!");
  console.error("Error:", e);
}
