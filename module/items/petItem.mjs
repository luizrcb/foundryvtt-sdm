import { $l10n } from '../helpers/globalUtils.mjs';
import { GearType } from '../helpers/constants.mjs';

const CHANNEL = 'system.sdm'; // reuse the same channel

export function setupPetDropSocket() {
  game.socket.on(CHANNEL, async msg => {
    const { action, userId, payload } = msg ?? {};
    if (action !== 'createPetToken') return;

    // Only the GM processes token creation
    if (!game.user.isGM) return;

    try {
      const { itemUuid, x, y } = payload;
      if (!itemUuid || x === undefined || y === undefined) {
        throw new Error($l10n('SDM.ErrorBadPayload'));
      }

      // Fetch the item
      const item = await fromUuid(itemUuid);
      if (!item) throw new Error($l10n('SDM.ErrorItemNotFound'));

      // Validate it's a pet item
      if (item.type !== 'gear' || item.system?.type !== GearType.PET) {
        throw new Error('Dropped item is not a pet.');
      }
      if (!item.system.pet) throw new Error('Pet item has no linked pet actor UUID.');

      // Fetch the pet actor
      const petActor = await fromUuid(item.system.pet);
      if (!petActor) throw new Error('Linked pet actor not found.');

      // Get the current scene and create the token
      const scene = game.scenes.current;
      if (!scene) throw new Error('No active scene.');

      const { x: tokenX, y: tokenY } = canvas.grid.getTopLeftPoint({ x, y });

      const tokenDoc = await petActor.getTokenDocument({ x: tokenX, y: tokenY });
      await scene.createEmbeddedDocuments('Token', [tokenDoc.toObject()]);

      // Optionally notify the requesting user of success
      game.socket.emit(CHANNEL, {
        action: 'petTokenCreated',
        userId, // send back to the original user
        payload: { success: true }
      });
    } catch (error) {
      console.error('Pet token creation failed:', error);
      game.socket.emit(CHANNEL, {
        action: 'petTokenCreated',
        userId,
        payload: { success: false, message: error.message }
      });
    }
  });
}
