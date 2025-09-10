import { ActorType, DocumentType, SizeUnit } from '../helpers/constants.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import { getSlotsTaken } from '../helpers/itemUtils.mjs';
import { templatePath } from '../helpers/templates.mjs';

const { renderTemplate } = foundry.applications.handlebars;
const CHANNEL = 'system.sdm';

export function setupItemTransferSocket() {
  game.socket.on(CHANNEL, async msg => {
    const { action, userId, payload } = msg ?? {};
    if (!action) return;

    // --- GM processes transfer requests ---
    if (action === 'transferRequest' && game.user.isGM) {
      try {
        if (!payload) throw new Error($l10n('SDM.ErrorBadPayload'));
        const { transferKey, itemId, sourceActorId, targetActorId, sourceActorType, cashAmount } =
          payload;

        const result = await performItemTransfer(
          transferKey,
          itemId,
          sourceActorId,
          sourceActorType,
          targetActorId,
          cashAmount
        );

        // Notify sender (success)
        game.socket.emit(CHANNEL, {
          action: 'transferResult',
          userId,
          payload: { success: true }
        });

        // Notify recipients
        if (result?.targetUserIds?.length > 0) {
          game.socket.emit(CHANNEL, {
            action: 'transferReceived',
            // no userId here; recipients filter by payload.targetUserIds
            payload: {
              targetUserIds: result.targetUserIds,
              itemName: result.itemName,
              sourceName: result.sourceName
            },
            userId
          });
        }
      } catch (error) {
        game.socket.emit(CHANNEL, {
          action: 'transferResult',
          userId,
          payload: { success: false, message: error?.message }
        });
      }
    }

    // --- GM handles transfer target list request ---
    if (action === 'requestTransferTargets' && game.user.isGM) {
      if (!payload) return;
      const { requestId, actorId, itemId } = payload;
      if (!requestId || !actorId || !itemId) {
        game.socket.emit(CHANNEL, {
          action: 'transferTargetsResponse',
          userId,
          payload: { requestId, targets: [] }
        });
        return;
      }

      // If the sender is this GM, we can compute immediately (same logic)
      const sourceActorSelf = game.actors.get(actorId);
      if (!sourceActorSelf) {
        game.socket.emit(CHANNEL, {
          action: 'transferTargetsResponse',
          userId,
          payload: { requestId, targets: [] }
        });
        return;
      }

      const targets = game.actors
        .filter(
          a => a.type !== ActorType.NPC && a.id !== sourceActorSelf.id && !a.items.has(itemId)
        )
        .map(a => ({ uuid: a.uuid, name: a.name }));

      game.socket.emit(CHANNEL, {
        action: 'transferTargetsResponse',
        userId,
        payload: { requestId, targets }
      });
    }

    // --- Sender notifications (result of transfer request) ---
    if (action === 'transferResult' && userId === game.user.id) {
      if (payload?.success) {
        ui.notifications.info($l10n('SDM.TransferComplete'));
      } else {
        ui.notifications.error(payload?.message || $l10n('SDM.TransferFailedGeneric'));
      }
    }

    // --- Recipient notifications (received item) ---
    if (action === 'transferReceived' && payload?.targetUserIds?.includes(game.user.id) && userId !== game.user.id) {
      ui.notifications.info(
        $fmt('SDM.TransferReceived', {
          item: payload.itemName,
          source: payload.sourceName
        })
      );
    }
  });
}

async function performItemTransfer(
  transferKey,
  itemId,
  sourceActorId,
  sourceActorType,
  targetActorId,
  cashAmount
) {
  let sourceActor;

  // Resolve source actor
  if (sourceActorType === ActorType.NPC) {
    sourceActor = fromUuidSync(sourceActorId);
  } else {
    sourceActor = game.actors.get(sourceActorId);
  }
  if (!sourceActor) throw new Error($l10n('SDM.ErrorSourceActorNotFound'));

  // Resolve target actor
  const targetActor = await fromUuid(targetActorId);
  if (!targetActor) throw new Error($l10n('SDM.ErrorTargetActorNotFound'));

  // Fetch fresh item from source
  const freshItem = sourceActor.items.get(itemId);
  if (!freshItem) throw new Error($l10n('SDM.ErrorTransferItemNotAvailable'));

  // Validate transfer session
  if (freshItem.getFlag('sdm', 'transferring') !== transferKey) {
    throw new Error($l10n('SDM.ErrorTransferInvalidItemState'));
  }
  if (Date.now() - freshItem.getFlag('sdm', 'transferInitiated') > 120000) {
    throw new Error($l10n('SDM.ErrorTransferSessionExperied'));
  }
  if (targetActor.items.has(itemId)) {
    throw new Error($l10n('SDM.ErrorTransferTargetHasItem'));
  }

  const isCashTransfer = freshItem.system.size?.unit === SizeUnit.CASH;
  let itemName,
    sourceName,
    targetUserIds = [];

  try {
    // Collect target user IDs to notify
    targetUserIds = game.users
      .filter(u => u.active && !u.isGM && targetActor.testUserPermission(u, 'OWNER'))
      .map(u => u.id);

    if (isCashTransfer) {
      // Cash transfer path
      const amount = parseInt(cashAmount, 10);
      if (isNaN(amount) || amount <= 0) {
        throw new Error($l10n('SDM.ErrorTransferAmountNotPositive'));
      }
      if (amount > freshItem.system.quantity) {
        throw new Error($l10n('SDM.ErrorTransferExcessCashAmount'));
      }

      const currencyName = game.settings.get('sdm', 'currencyName');
      itemName = `${amount} ${currencyName}`;
      sourceName = sourceActor.name;

      // Decrement source quantity
      const originalQty = freshItem.system.quantity;
      await sourceActor.updateEmbeddedDocuments(DocumentType.ITEM, [
        { _id: freshItem.id, system: { quantity: originalQty - amount } }
      ]);

      try {
        const existingCash = targetActor.items.find(i => i.system.size?.unit === SizeUnit.CASH);
        if (existingCash) {
          await targetActor.updateEmbeddedDocuments(DocumentType.ITEM, [
            { _id: existingCash.id, system: { quantity: existingCash.system.quantity + amount } }
          ]);
        } else {
          const newCashData = freshItem.toObject();
          newCashData.system.quantity = amount;
          // Set item display name at root level
          newCashData.name = currencyName;
          // Remove transient flags
          if (newCashData.flags?.sdm) {
            delete newCashData.flags.sdm.transferring;
            delete newCashData.flags.sdm.transferInitiated;
          }
          await targetActor.createEmbeddedDocuments(DocumentType.ITEM, [newCashData]);
        }
      } catch (err) {
        // Rollback on target update failure
        await sourceActor.updateEmbeddedDocuments(DocumentType.ITEM, [
          { _id: freshItem.id, system: { quantity: freshItem.system.quantity } }
        ]);
        throw err;
      }
    } else {
      // Physical item transfer path
      itemName = freshItem.name;
      sourceName = sourceActor.name;

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
      } catch (err) {
        if (newItem) {
          await targetActor.deleteEmbeddedDocuments(DocumentType.ITEM, [newItem.id]);
        }
        throw err;
      }
    }

    return { itemName, sourceName, targetUserIds };
  } finally {
    // Clear transfer flags on source if the item still exists
    if (sourceActor.items.get(itemId)) {
      await sourceActor.updateEmbeddedDocuments(DocumentType.ITEM, [
        {
          _id: itemId,
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

export async function openItemTransferDialog(item, sourceActor) {
  const isNPCSource = sourceActor.type === ActorType.NPC;
  const transferKey = `transfer-${item.id}-${Date.now()}-${foundry.utils.randomID(4)}`;

  try {
    // Mark item as "transferring"
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

    let validActors = [];
    let playerActors;

    // Build NPC candidates
    const npcCandidates = getEligibleNPCsForTransfer(item.id).map(entry => {
      const name =
        entry.fromScene && entry.token?.name
          ? '(token) ' + entry.token.name // displayed label only; i18n not needed here
          : entry.actor.name;

      return {
        uuid: entry.token?.actor?.uuid ?? entry.actor.uuid,
        name,
        isNPC: true,
        fromScene: entry.fromScene
      };
    });

    // Collect player actors (GM locally, Player via socket)
    if (game.user.isGM) {
      playerActors = game.actors
        .filter(a => a.type !== ActorType.NPC && a.id !== sourceActor.id && !a.items.has(item.id))
        .map(a => ({ uuid: a.uuid, name: a.name }));
    } else {
      if (!game.users.activeGM) {
        ui.notifications.warn($l10n('SDM.ErrorTransferNoActiveGM'));
        return;
      }
      playerActors = await new Promise(resolve => {
        const requestId = foundry.utils.randomID();

        const handler = msg => {
          const { action, userId, payload } = msg ?? {};
          if (
            action === 'transferTargetsResponse' &&
            userId === game.user.id &&
            payload?.requestId === requestId
          ) {
            game.socket.off(CHANNEL, handler);
            resolve(payload.targets ?? []);
          }
        };

        game.socket.on(CHANNEL, handler);
        game.socket.emit(CHANNEL, {
          action: 'requestTransferTargets',
          userId: game.user.id,
          payload: { requestId, actorId: sourceActor.id, itemId: item.id }
        });
      });
    }

    validActors = [...playerActors, ...npcCandidates];

    // Render dialog
    const template = await renderTemplate(templatePath('transfer-dialog'), {
      actors: validActors,
      item
    });

    const transferOptions = await foundry.applications.api.DialogV2.prompt({
      window: { title: $fmt('SDM.Transfer', { type: $l10n('TYPE.Item') }) },
      content: template,
      ok: {
        icon: 'fa-solid fa-share',
        label: $fmt('SDM.Transfer', { type: '' }),
        callback: (event, button) =>
          new foundry.applications.ux.FormDataExtended(button.form).object
      },
      rejectClose: false
    });

    if (!transferOptions) {
      // User canceled: clear flags
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
      return;
    }

    const targetActorId = transferOptions.targetActor;
    if (!targetActorId) return;

    const targetActor = await fromUuid(targetActorId);
    const slotsTaken = getSlotsTaken(item.system);
    const validWeight = targetActor.sheet._checkActorWeightLimit(slotsTaken, item.type);
    if (!validWeight) {
      throw new Error($fmt('SDM.ErrorWeightLimit', { target: targetActor.name }));
    }

    if (item.system.is_hallmark && !targetActor.canAddHallmarkItem()) {
      throw new Error($fmt('SDM.ErrorHallmarkLimit', { target: targetActor.name }));
    }

    // Re-validate transfer state on source
    const freshItem = sourceActor.items.get(item.id);
    if (!freshItem || freshItem?.getFlag('sdm', 'transferring') !== transferKey) {
      throw new Error($l10n('SDM.ErrorTransferInvalidItemState'));
    }

    const sourceActorId = isNPCSource ? sourceActor.uuid : sourceActor.id;

    if (game.user.isGM) {
      // GM executes directly
      await performItemTransfer(
        transferKey,
        item.id,
        sourceActorId,
        sourceActor.type,
        targetActorId,
        transferOptions.cashAmount
      );
      ui.notifications.info($l10n('SDM.TransferComplete'));
    } else {
      // Player sends socket request
      game.socket.emit(CHANNEL, {
        action: 'transferRequest',
        userId: game.user.id,
        payload: {
          transferKey,
          itemId: item.id,
          sourceActorId,
          sourceActorType: sourceActor.type,
          targetActorId,
          cashAmount: transferOptions.cashAmount
        }
      });
      // ui.notifications.info($l10n('SDM.TransferRequestSent'));
    }
  } catch (err) {
    ui.notifications.error($fmt('SDM.TransferFailed', { error: err?.message || '' }));
    // Cleanup flags on error if item still exists
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

function getEligibleNPCsForTransfer(itemId) {
  const isGM = game.user.isGM;
  const results = [];

  // Step 1: Process placed NPC tokens
  for (const token of canvas.tokens.placeables) {
    const actor = token.actor;
    if (!actor || actor.type !== ActorType.NPC) continue;
    if (actor.items.has(itemId)) continue;

    const disposition = token.document.disposition;
    const hasPermission = actor.testUserPermission(game.user, 'OWNER');

    if (isGM || hasPermission || disposition >= CONST.TOKEN_DISPOSITIONS.FRIENDLY) {
      results.push({
        actor,
        fromScene: true,
        disposition,
        token,
        isDirectoryActor: false
      });
    }
  }

  // Step 2: Directory NPC actors
  for (const actor of game.actors.filter(a => a.type === ActorType.NPC)) {
    if (actor.items.has(itemId)) continue;

    const isAlreadyInScene = canvas.tokens.placeables.some(
      t => t.actor?.id === actor.id && t.document.actorLink
    );

    const prototypeDisposition =
      actor.prototypeToken?.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL;
    const hasPermission = actor.testUserPermission(game.user, 'OWNER');

    const includeDirectoryActor =
      isGM ||
      (!isAlreadyInScene && hasPermission) ||
      prototypeDisposition >= CONST.TOKEN_DISPOSITIONS.FRIENDLY;

    if (includeDirectoryActor) {
      results.push({
        actor,
        fromScene: false,
        disposition: prototypeDisposition,
        token: null,
        isDirectoryActor: true
      });
    }
  }

  return results;
}
