import { ActorType, DocumentType, SizeUnit } from '../helpers/constants.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';
import { getSlotsTaken } from '../helpers/itemUtils.mjs';
import { templatePath } from '../helpers/templates.mjs';

const { renderTemplate } = foundry.applications.handlebars;
const CHANNEL = 'system.sdm';

/* ---------------------------------------- */
/* Cash helpers (max stack logic: 2500)     */
/* ---------------------------------------- */
const MAX_CASH_STACK = 2500;

function listCashItems(actor) {
  return actor.items.filter(i => i.type === 'gear' && i.system.size?.unit === SizeUnit.CASH);
}

async function cleanupZeroCash(actor) {
  const items = listCashItems(actor);
  if (items.length <= 1) return; // the single remaining cash item may be 0
  const zeros = items.filter(i => Number(i.system?.quantity ?? 0) === 0);
  if (!zeros.length) return;
  await actor.deleteEmbeddedDocuments(
    DocumentType.ITEM,
    zeros.map(z => z.id)
  );
}

/**
 * Add `amount` of cash to `actor` using lowest-first & 2500-cap logic.
 * - Fills lowest stacks first up to MAX_CASH_STACK
 * - Creates new cash items for overflow
 * - Cleans up extra zero stacks
 */
async function addCashWithMaxStack(actor, amount, defaultCurrencyName, defaultCurrencyImage) {
  let remaining = Number(amount) || 0;
  if (remaining <= 0) return;

  const items = listCashItems(actor).sort(
    (a, b) => Number(a.system?.quantity ?? 0) - Number(b.system?.quantity ?? 0)
  );

  const updates = [];
  for (const it of items) {
    if (remaining <= 0) break;
    let qty = Math.max(0, Number(it.system?.quantity ?? 0));
    if (qty >= MAX_CASH_STACK) continue;
    const space = MAX_CASH_STACK - qty;
    const add = Math.min(space, remaining);
    if (add > 0) {
      qty += add;
      updates.push({ _id: it.id, system: { quantity: qty } });
      remaining -= add;
    }
  }

  const creates = [];
  while (remaining > 0) {
    const add = Math.min(MAX_CASH_STACK, remaining);
    creates.push({
      name: defaultCurrencyName || 'cash',
      type: 'gear',
      img: defaultCurrencyImage || 'icons/commodities/currency/coins-stitched-pouch-brown.webp',
      system: { size: { unit: SizeUnit.CASH }, quantity: add }
    });
    remaining -= add;
  }

  if (updates.length) await actor.updateEmbeddedDocuments(DocumentType.ITEM, updates);
  if (creates.length) await actor.createEmbeddedDocuments(DocumentType.ITEM, creates);

  await cleanupZeroCash(actor);
}

/* ---------------------------------------- */

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
    if (
      action === 'transferReceived' &&
      payload?.targetUserIds?.includes(game.user.id) &&
      userId !== game.user.id
    ) {
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
  cashAmount,
  quantity = 1,
  totalCharged = 0,
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
      // --- CASH PATH with max-stack add to target ---
      const amount = parseInt(cashAmount, 10);
      if (isNaN(amount) || amount <= 0) {
        throw new Error($l10n('SDM.ErrorTransferAmountNotPositive'));
      }
      if (amount > freshItem.system.quantity) {
        throw new Error($l10n('SDM.ErrorTransferExcessCashAmount'));
      }

      const currencyName = game.settings.get('sdm', 'currencyName') || 'cash';
      const currencyImage =
        game.settings.get('sdm', 'currencyImage') ||
        'icons/commodities/currency/coins-stitched-pouch-brown.webp';

      itemName = `${amount} ${currencyName}`;
      sourceName = sourceActor.name;

      // Decrement source quantity first
      const originalQty = freshItem.system.quantity;
      await sourceActor.updateEmbeddedDocuments(DocumentType.ITEM, [
        { _id: freshItem.id, system: { quantity: originalQty - amount } }
      ]);

      try {
        // Add to target using lowest-first + 2500 cap, creating overflow stacks as needed
        await addCashWithMaxStack(targetActor, amount, currencyName, currencyImage);
      } catch (err) {
        // Rollback on failure: restore source cash to original amount
        await sourceActor.updateEmbeddedDocuments(DocumentType.ITEM, [
          { _id: freshItem.id, system: { quantity: freshItem.system.quantity } }
        ]);
        throw err;
      }
    } else {
      // --- PHYSICAL ITEM PATH ---
      itemName = freshItem.name;
      sourceName = sourceActor.name;

      const hasStacks = Number.isFinite(Number(freshItem.system?.quantity));
      const availableQty = hasStacks ? Number(freshItem.system.quantity) : 1;

      // requested quantity
      const reqQtyRaw = Number(quantity) || 1;
      const reqQty = hasStacks ? Math.max(1, Math.min(reqQtyRaw, availableQty)) : 1;

      // Only split into multiple 1-qty documents when the unit is "sacks"
      const unit = freshItem.system?.size?.unit;
      const isSacksUnit = unit === SizeUnit.SACKS || unit === 'sacks';

      let createdDocs = [];

      try {
        if (hasStacks && isSacksUnit) {
          // Create N separate docs each with quantity=1
          const docsToCreate = Array.from({ length: reqQty }, () => {
            const d = freshItem.toObject();
            d.system.readied = false;
            d.system.quantity = 1;
            d.flags = {
              sdm: {
                transferSource: sourceActor.id,
                transferId: transferKey
              }
            };
            return d;
          });
          createdDocs = await targetActor.createEmbeddedDocuments(DocumentType.ITEM, docsToCreate);
        } else {
          // Create a single doc on the target
          const newItemData = freshItem.toObject();
          newItemData.system.readied = false;
          newItemData.flags = {
            sdm: {
              transferSource: sourceActor.id,
              transferId: transferKey
            }
          };
          if (hasStacks) {
            // For non-sacks stackables, carry the requested quantity in one item
            newItemData.system.quantity = reqQty;
          }
          const [single] = await targetActor.createEmbeddedDocuments(DocumentType.ITEM, [
            newItemData
          ]);
          createdDocs = [single];
        }

        // Adjust source inventory
        if (sourceActorType === ActorType.NPC) {
          // NPC: never delete the original item
          if (hasStacks) {
            const newQty = Math.max(0, availableQty - reqQty);
            await sourceActor.updateEmbeddedDocuments(DocumentType.ITEM, [
              { _id: freshItem.id, system: { quantity: newQty } }
            ]);
          } else {
            // non-stackable from NPC -> leave as-is (copy behavior)
          }
        } else {
          // Non-NPC (e.g. PC)
          if (hasStacks) {
            const newQty = availableQty - reqQty;
            if (newQty > 0) {
              await sourceActor.updateEmbeddedDocuments(DocumentType.ITEM, [
                { _id: freshItem.id, system: { quantity: newQty } }
              ]);
            } else {
              await sourceActor.deleteEmbeddedDocuments(DocumentType.ITEM, [freshItem.id]);
            }
          } else {
            // non-stackable from PC -> move the single item
            await sourceActor.deleteEmbeddedDocuments(DocumentType.ITEM, [freshItem.id]);
          }
        }
      } catch (err) {
        // Rollback: delete any created docs on the target
        if (createdDocs?.length) {
          await targetActor.deleteEmbeddedDocuments(
            DocumentType.ITEM,
            createdDocs.map(d => d.id)
          );
        }
        throw err;
      }
    }
    let items = [];
    if (!isCashTransfer && freshItem) {
      items.push(freshItem);
    }

    const ctx = {
      senderName: 'Gamemaster',
      transferId: transferKey,
      sourceId: sourceActor.id,
      targetId: targetActor.id,
      sourceName,
      sourceImg: sourceActor.img,
      targetImg: targetActor.img,
      targetName: targetActor.name,
      items,
      itemName: itemName,
      quantity,
      isCash: isCashTransfer,
      amount: isCashTransfer ? parseInt(cashAmount, 10) : undefined,
      currencyName: game.settings.get('sdm', 'currencyName') || 'cash',
      currencyImg: game.settings.get('sdm', 'currencyImage'),
      totalValue: totalCharged,
    };

    const content = await renderTemplate(templatePath('chat/transfer-summary-card'), ctx);
    await ChatMessage.create({
      content: `${content}`,
      speaker: { alias: 'Gamemaster' }
    });
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

    // Build candidates
    const npcCandidates = getEligibleNPCsForTransfer(item.id).map(entry => ({
      uuid: entry.token?.actor?.uuid ?? entry.actor.uuid,
      name: entry.fromScene && entry.token?.name ? '(token) ' + entry.token.name : entry.actor.name,
      isNPC: true,
      fromScene: entry.fromScene
    }));

    let playerActors;
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

    const validActors = [...playerActors, ...npcCandidates];

    // Render dialog (unchanged UI fields you already added)
    const template = await renderTemplate(templatePath('transfer-dialog'), {
      actors: validActors,
      item,
      isGM: game.user.isGM,
      isCash: item.system?.size?.unit === SizeUnit.CASH,
      unitCost: Number(item.system?.cost ?? 0),
      maxQuantity: Number.isFinite(Number(item.system?.quantity)) ? Number(item.system.quantity) : 1
    });

    const unitCost = Number(item.system?.cost ?? 0);

    const position = {
      width: 700,
      height: 300
    };

    const dialogData = {
      window: { title: $fmt('SDM.Transfer', { type: $l10n('TYPE.Item') }) },
      content: template,
      ok: {
        icon: 'fa-solid fa-share',
        label: $fmt('SDM.Transfer', { type: '' }),
        callback: (event, button) =>
          new foundry.applications.ux.FormDataExtended(button.form).object
      },
      rejectClose: false,
      render: (_event, dialog) => {
        const root = dialog.element instanceof HTMLElement ? dialog.element : dialog.element?.[0];
        if (!root) return;

        const form = root.querySelector('form');
        if (!form) return;

        const qty = form.querySelector('input[name="quantity"]');
        const enabled = form.querySelector('input[name="chargeEnabled"]');
        const amount = form.querySelector('input[name="chargeAmount"]');
        const totalEl = form.querySelector('#sdm-total-charge');

        const unit = unitCost;

        const recalc = () => {
          const q = Math.max(1, parseInt(qty?.value ?? '1', 10) || 1);
          const per = Math.max(0, parseInt(amount?.value ?? String(unit), 10) || 0);
          const total = enabled?.checked ? q * per : 0;
          if (totalEl) totalEl.textContent = String(total);
        };

        const syncEnabled = () => {
          if (!amount || !enabled) return;
          amount.disabled = !enabled.checked;
          recalc();
        };

        enabled?.addEventListener('change', syncEnabled);
        qty?.addEventListener('input', recalc);
        amount?.addEventListener('input', recalc);

        // initial state
        syncEnabled();
      }
    };

    const isCash = item.system?.size?.unit === SizeUnit.CASH;
    if (game.user.isGM && !isCash) dialogData.position = position;

    const transferOptions = await foundry.applications.api.DialogV2.prompt(dialogData);

    if (!transferOptions) {
      await sourceActor.updateEmbeddedDocuments(DocumentType.ITEM, [
        { _id: item.id, flags: { sdm: { transferring: null, transferInitiated: null } } }
      ]);
      return;
    }

    const targetActorId = transferOptions.targetActor;
    if (!targetActorId) return;

    const targetActor = await fromUuid(targetActorId);

    // Normalize qty (non-cash only)
    const stackQty = Number.isFinite(Number(item.system?.quantity))
      ? Number(item.system.quantity)
      : 1;
    const reqQtyRaw = Number(transferOptions.quantity ?? 1);
    const reqQty = isCash
      ? 1
      : Math.max(1, Math.min(Number.isFinite(reqQtyRaw) ? reqQtyRaw : 1, stackQty));

    // Weight / hallmark (multiply slots by reqQty)
    const slotsTaken = getSlotsTaken(item.system);
    const validWeight = targetActor.sheet._checkActorWeightLimit(slotsTaken * reqQty, item.type);
    if (!validWeight) throw new Error($fmt('SDM.ErrorWeightLimit', { target: targetActor.name }));
    if (item.system.is_hallmark && !targetActor.canAddHallmarkItem()) {
      throw new Error($fmt('SDM.ErrorHallmarkLimit', { target: targetActor.name }));
    }

    // Re-validate session
    const freshItem = sourceActor.items.get(item.id);
    if (!freshItem || freshItem?.getFlag('sdm', 'transferring') !== transferKey) {
      throw new Error($l10n('SDM.ErrorTransferInvalidItemState'));
    }

    const sourceActorUuid = sourceActor.uuid; // always have UUID
    const sourceActorIdVal = isNPCSource ? sourceActor.uuid : sourceActor.id;

    if (game.user.isGM) {
      // Optional charge (GM + non-cash + checkbox)
      let charged = false;
      let totalCharge = 0;
      if (!isCash && transferOptions.chargeEnabled) {
        const unitCostLocal = Number(item.system?.cost ?? 0);
        const chargeField = Number(transferOptions.chargeAmount);
        const perUnit =
          Number.isFinite(chargeField) && chargeField >= 0 ? chargeField : unitCostLocal;
        totalCharge = Math.max(0, Math.floor(perUnit * reqQty));

        if (totalCharge > 0) {
          // Pre-validate funds
          const targetCash = targetActor.items.find(i => i.system.size?.unit === SizeUnit.CASH);
          const targetBalance = Number(targetCash?.system?.quantity ?? 0);
          if (!Number.isFinite(targetBalance) || targetBalance < totalCharge) {
            throw new Error($fmt('SDM.ErrorNotEnoughMoney', { target: targetActor.name }));
          }

          // 1) Debit target, 2) Credit source (silent)
          const displayTransferNotification = false;
          await sdm.api.gm.giveCash(
            targetActor.uuid,
            totalCharge,
            'remove',
            displayTransferNotification
          );
          await sdm.api.gm.giveCash(
            sourceActorUuid,
            totalCharge,
            'add',
            displayTransferNotification
          );
          charged = true;
        }
      }

      try {
        // Perform transfer (pass quantity to create N copies when applicable)
        await performItemTransfer(
          transferKey,
          item.id,
          sourceActorIdVal,
          sourceActor.type,
          targetActorId,
          transferOptions.cashAmount,
          reqQty,
          totalCharge,
        );
        ui.notifications.info($l10n('SDM.TransferComplete'));
      } catch (err) {
        // Rollback charge if we charged
        if (charged && totalCharge > 0) {
          try {
            await sdm.api.gm.giveCash(sourceActorUuid, totalCharge, 'remove');
            await sdm.api.gm.giveCash(targetActor.uuid, totalCharge, 'add');
          } catch (rollbackErr) {
            console.error('Rollback failed after transfer error:', rollbackErr);
          }
        }
        throw err;
      }
    } else {
      // Player path unchanged
      game.socket.emit(CHANNEL, {
        action: 'transferRequest',
        userId: game.user.id,
        payload: {
          transferKey,
          itemId: item.id,
          sourceActorId: sourceActor.id,
          sourceActorType: sourceActor.type,
          targetActorId,
          cashAmount: transferOptions.cashAmount
        }
      });
    }
  } catch (err) {
    ui.notifications.error($fmt('SDM.TransferFailed', { error: err?.message || '' }));
    if (sourceActor.items.get(item.id)) {
      await sourceActor.updateEmbeddedDocuments(DocumentType.ITEM, [
        { _id: item.id, flags: { sdm: { transferring: null, transferInitiated: null } } }
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
