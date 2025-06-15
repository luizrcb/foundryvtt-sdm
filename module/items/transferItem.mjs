import { ActorType } from "../helpers/constants.mjs";

const { renderTemplate } = foundry.applications.handlebars;

export async function openItemTransferDialog(item, sourceActor) {
  const transferKey = `transfer-${item.id}-${Date.now()}-${foundry.utils.randomID(4)}`;

  try {
    const updated = await sourceActor.updateEmbeddedDocuments("Item", [{
      _id: item.id,
      flags: {
        sdm: {
          transferring: transferKey,
          transferInitiated: Date.now(),
          originalOwner: sourceActor.id
        }
      }
    }]);

    if (updated.length === 0) {
      ui.notifications.warn("Item is no longer available for transfer");
      return;
    }

    const validActors = game.actors.filter(a =>
      a.type !== ActorType.NPC &&
      a.id !== sourceActor.id &&
      a.testUserPermission(game.user, "OWNER") &&
      !a.items.has(item.id)
    );

    const template = await renderTemplate("systems/sdm/templates/transfer-dialog.hbs", {
      actors: validActors,
      item: item
    });

    const transferOptions = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Transfer Item" },
      content: template,
      ok: {
        icon: 'fas fa-share',
        label: "Transfer",
        callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object,
      },
      rejectClose: true,
    });
    try {

      const targetActorId = transferOptions.targetActor;
      const targetActor = game.actors.get(targetActorId);

      if (!targetActor?.testUserPermission(game.user, "OWNER")) {
        throw new Error("Invalid target actor");
      }

      const freshItem = sourceActor.items.get(item.id);
      if (!freshItem || freshItem?.getFlag("sdm", "transferring") !== transferKey) {
        throw new Error("Item state changed during transfer");
      }

      if (Date.now() - freshItem?.getFlag("sdm", "transferInitiated") > 30000) {
        throw new Error("Transfer session expired");
      }

      if (targetActor.items.has(item.id)) {
        throw new Error("Target already has this item");
      }

      const isCashTransfer = freshItem.system.size?.unit === 'cash';

      if (isCashTransfer) {
        const amountInput = transferOptions.cashAmount;
        const amount = parseInt(amountInput, 10);

        if (isNaN(amount) || amount <= 0) {
          throw new Error("Amount must be a positive number");
        }

        if (amount > freshItem.system.quantity) {
          throw new Error("Cannot transfer more cash than available");
        }

        // Update source quantity
        await sourceActor.updateEmbeddedDocuments("Item", [{
          _id: freshItem.id,
          system: { quantity: freshItem.system.quantity - amount }
        }]);

        try {
          const existingCash = targetActor.items.find(i => i.system.size?.unit === 'cash');

          if (existingCash) {
            await targetActor.updateEmbeddedDocuments("Item", [{
              _id: existingCash.id,
              system: { quantity: existingCash.system.quantity + amount }
            }]);
          } else {
            const currencyName = game.settings.get("sdm", "currencyName");
            const newCashData = freshItem.toObject();
            newCashData.system.quantity = amount;
            newCashData.system.name = currencyName;
            delete newCashData.flags?.sdm?.transferring;
            delete newCashData.flags?.sdm?.transferInitiated;
            await targetActor.createEmbeddedDocuments("Item", [newCashData]);
          }

          ui.notifications.info(`Transferred ${amount} cash to ${targetActor.name}`);
        } catch (err) {
          // Rollback source quantity on failure
          await sourceActor.updateEmbeddedDocuments("Item", [{
            _id: freshItem.id,
            system: { quantity: freshItem.system.quantity }
          }]);
          throw new Error(`Cash transfer failed: ${err.message}`);
        }
      } else {
        let newItem;
        try {
          newItem = await targetActor.createEmbeddedDocuments("Item", [{
            ...freshItem.toObject(),
            flags: {
              sdm: {
                transferSource: sourceActor.id,
                transferId: transferKey
              }
            }
          }]);

          await sourceActor.deleteEmbeddedDocuments("Item", [freshItem.id]);
          ui.notifications.info(`Item transferred to ${targetActor.name}`);
        } catch (err) {
          if (newItem?.length) {
            await targetActor.deleteEmbeddedDocuments("Item", [newItem[0].id]);
          }
          throw err;
        }
      }
    } catch (err) {
      ui.notifications.error(`Transfer failed: ${err.message}`);
    } finally {
      if (sourceActor.items.get(item.id)) {
        await sourceActor.updateEmbeddedDocuments("Item", [{
          _id: item.id,
          flags: {
            sdm: {
              transferring: null,
              transferInitiated: null
            }
          }
        }]);
      }
    }
  } catch (err) {
    if (sourceActor.items.get(item.id)) {
      await sourceActor.updateEmbeddedDocuments("Item", [{
        _id: item.id,
        flags: {
          sdm: {
            transferring: null,
            transferInitiated: null
          }
        }
      }]);
    }
    // ui.notifications.error("Transfer initialization failed");
  }
}