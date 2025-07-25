import { ActorType, DocumentType, SizeUnit } from '../helpers/constants.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import { getSlotsTaken } from '../helpers/itemUtils.mjs';
import { templatePath } from '../helpers/templates.mjs';

const { renderTemplate } = foundry.applications.handlebars;

export async function openItemTransferDialog(item, sourceActor) {
  const transferKey = `transfer-${item.id}-${Date.now()}-${foundry.utils.randomID(4)}`;

  try {
    const updated = await sourceActor.updateEmbeddedDocuments(DocumentType.ITEM, [
      {
        _id: item.id,
        flags: {
          sdm: {
            transferring: transferKey,
            transferInitiated: Date.now(),
            originalOwner: sourceActor.id
          }
        }
      }
    ]);

    if (updated.length === 0) {
      ui.notifications.warn($l10n('SDM.ErrorTransferItemNotAvailable'));
      return;
    }

    const validActors = game.actors.filter(
      a =>
        a.type !== ActorType.NPC &&
        a.id !== sourceActor.id &&
        a.testUserPermission(game.user, 'OWNER') &&
        !a.items.has(item.id)
    );

    const template = await renderTemplate(templatePath('transfer-dialog'), {
      actors: validActors,
      item: item
    });

    const transferOptions = await foundry.applications.api.DialogV2.prompt({
      window: { title: $fmt('SDM.Transfer', { type: $l10n('TYPE.Item') }) },
      content: template,
      ok: {
        icon: 'fas fa-share',
        label: $fmt('SDM.Transfer', { type: '' }),
        callback: (event, button) =>
          new foundry.applications.ux.FormDataExtended(button.form).object
      },
      rejectClose: true
    });
    try {
      const targetActorId = transferOptions.targetActor;

      if (!targetActorId) {
        return;
      }

      const targetActor = game.actors.get(targetActorId);
      const freshItem = sourceActor.items.get(item.id);

      const slotsTaken = getSlotsTaken(item.system);
      const validWeight = targetActor.sheet._checkActorWeightLimit(slotsTaken, item.type);

      if (!validWeight) {
        throw new Error($fmt('SDM.ErrorWeightLimit', { target: targetActor.name }));
      }

      if (!freshItem || freshItem?.getFlag('sdm', 'transferring') !== transferKey) {
        throw new Error($l10n('SDM.ErrorTransferInvalidItemState'));
      }

      if (Date.now() - freshItem?.getFlag('sdm', 'transferInitiated') > 30000) {
        throw new Error($l10n('SDM.ErrorTransferSessionExperied'));
      }

      if (targetActor.items.has(item.id)) {
        throw new Error($l10n('SDM.ErrorTransferTargetHasItem'));
      }

      const isCashTransfer = freshItem.system.size?.unit === SizeUnit.CASH;

      if (isCashTransfer) {
        const amountInput = transferOptions.cashAmount;
        const amount = parseInt(amountInput, 10);

        if (isNaN(amount) || amount <= 0) {
          throw new Error($l10n('SDM.ErrorTransferAmountNotPositive'));
        }

        if (amount > freshItem.system.quantity) {
          throw new Error($l10n('SDM.ErrorTransferExcessCashAmount'));
        }

        // Update source quantity
        await sourceActor.updateEmbeddedDocuments(DocumentType.ITEM, [
          {
            _id: freshItem.id,
            system: { quantity: freshItem.system.quantity - amount }
          }
        ]);

        try {
          const existingCash = targetActor.items.find(i => i.system.size?.unit === SizeUnit.CASH);

          if (existingCash) {
            await targetActor.updateEmbeddedDocuments(DocumentType.ITEM, [
              {
                _id: existingCash.id,
                system: { quantity: existingCash.system.quantity + amount }
              }
            ]);
          } else {
            const currencyName = game.settings.get('sdm', 'currencyName');
            const newCashData = freshItem.toObject();
            newCashData.system.quantity = amount;
            newCashData.system.name = currencyName;
            delete newCashData.flags?.sdm?.transferring;
            delete newCashData.flags?.sdm?.transferInitiated;
            await targetActor.createEmbeddedDocuments(DocumentType.ITEM, [newCashData]);
          }

          ui.notifications.info(
            $fmt('SDM.TransferCashComplete', { amount, target: targetActor.name })
          );
        } catch (err) {
          // Rollback source quantity on failure
          await sourceActor.updateEmbeddedDocuments(DocumentType.ITEM, [
            {
              _id: freshItem.id,
              system: { quantity: freshItem.system.quantity }
            }
          ]);
          throw err;
        }
      } else {
        let newItem;
        const newItemData = freshItem.toObject();
        newItemData.system.readied = false;
        newItemData.flags = {
          sdm: {
            transferSource: sourceActor.id,
            transferId: transferKey
          }
        };
        try {
          [newItem] = await targetActor.createEmbeddedDocuments(DocumentType.ITEM, [newItemData]);
          await sourceActor.deleteEmbeddedDocuments(DocumentType.ITEM, [freshItem.id]);
          ui.notifications.info(
            $fmt('SDM.TransferItemComplete', {
              item: newItem.name,
              target: targetActor.name
            })
          );
        } catch (err) {
          if (newItem) {
            await targetActor.deleteEmbeddedDocuments(DocumentType.ITEM, [newItem.id]);
          }
          throw err;
        }
      }
    } catch (err) {
      ui.notifications.error($fmt('SDM.TransferFailed', { error: err.message }));
    } finally {
      if (sourceActor.items.get(item.id)) {
        await sourceActor.updateEmbeddedDocuments(DocumentType.ITEM, [
          {
            _id: item.id,
            flags: {
              sdm: {
                transferring: null,
                transferInitiated: null
              }
            }
          }
        ]);
      }
    }
  } catch (err) {
    if (sourceActor.items.get(item.id)) {
      await sourceActor.updateEmbeddedDocuments(DocumentType.ITEM, [
        {
          _id: item.id,
          flags: {
            sdm: {
              transferring: null,
              transferInitiated: null
            }
          }
        }
      ]);
    }
  }
}
