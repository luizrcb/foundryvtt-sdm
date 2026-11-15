import { $fmt, $l10n, foundryVersionIsAtLeast } from '../helpers/globalUtils.mjs';
import { ActorType, GearType } from '../helpers/constants.mjs';

/**
 * Pet items (gear or trait) link an actor (NPC or character) in system.pet.
 *
 * A pet item in a compendium can come linked to a compendium actor (Pet Bird → its creature).
 * Compendium documents can't be played, so when such an item lands on an actor, the active Referee
 * imports its own copy of the creature into the "Pets" folder, owned by the actor's owners, and links
 * the item to it. Each item gets its own pet. Deleting the item deletes that copy (and its tokens),
 * unless another item still uses it. Pets linked by hand (world actors) are never deleted.
 */

const FLAG = 'petOfItem';

const isPetItem = item => ['gear', 'trait'].includes(item?.type) && item.system?.type === GearType.PET;
const isCompendiumUuid = uuid => typeof uuid === 'string' && uuid.startsWith('Compendium.');
const isActiveGM = () => game.users.activeGM?.id === game.user.id;

async function getPetFolder() {
  const name = $l10n('SDM.Pet.Folder');
  return (
    game.folders.find(folder => folder.type === 'Actor' && folder.name === name) ??
    Folder.create({ name, type: 'Actor' })
  );
}

/** Import the compendium creature of a pet item on an actor and link the item to the copy. Referee only. */
export async function importPetForItem(item) {
  if (!game.user.isGM || !isPetItem(item) || !item.parent || item.pack) return;
  const uuid = item.system.pet;
  if (!isCompendiumUuid(uuid)) return;
  const source = await fromUuid(uuid);
  if (source?.documentName !== 'Actor') {
    ui.notifications.warn($fmt('SDM.Pet.SourceMissing', { item: item.name }));
    return;
  }
  const owner = item.parent;
  const data = source.toObject();
  delete data._id;
  data.folder = (await getPetFolder())?.id ?? null;
  // The owners of the actor that carries the item own the pet
  const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  data.ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
  for (const [userId, level] of Object.entries(owner.ownership ?? {})) {
    if (userId !== 'default' && level >= OWNER) data.ownership[userId] = OWNER;
  }
  foundry.utils.setProperty(data, `flags.sdm.${FLAG}`, item.uuid);
  foundry.utils.setProperty(data, 'prototypeToken.actorLink', true);
  // A character's pet is on its side
  if (owner.type === ActorType.CHARACTER && data.type === ActorType.NPC) {
    foundry.utils.setProperty(data, 'prototypeToken.disposition', CONST.TOKEN_DISPOSITIONS.FRIENDLY);
  }
  const pet = await Actor.create(data);
  if (!pet) return;
  await item.update({ 'system.pet': pet.uuid });
  ui.notifications.info($fmt('SDM.Pet.Imported', { name: pet.name, actor: owner.name }));
}

/** Another item in the world (on an actor or in the sidebar) that links this pet, if any. */
function otherPetItem(petUuid, itemUuid) {
  const links = item => isPetItem(item) && item.system.pet === petUuid && item.uuid !== itemUuid;
  return game.items.find(links) ?? game.actors.contents.flatMap(actor => actor.items.contents).find(links) ?? null;
}

async function onPetItemDeleted(item) {
  if (!isActiveGM() || !isPetItem(item)) return;
  const petUuid = item.system.pet;
  if (!petUuid || isCompendiumUuid(petUuid)) return;
  const pet = fromUuidSync(petUuid);
  // Only the copy imported for this item
  if (pet?.documentName !== 'Actor' || pet.pack || pet.getFlag('sdm', FLAG) !== item.uuid) return;
  // Moved to another actor (copied, then deleted here): the pet now belongs to that item
  const other = otherPetItem(petUuid, item.uuid);
  if (other) {
    await pet.setFlag('sdm', FLAG, other.uuid);
    return;
  }
  for (const scene of game.scenes) {
    const ids = scene.tokens.filter(token => token.actorId === pet.id).map(token => token.id);
    if (ids.length) await scene.deleteEmbeddedDocuments('Token', ids);
  }
  await pet.delete();
  ui.notifications.info($fmt('SDM.Pet.Removed', { name: pet.name, item: item.name }));
}

/** An item that comes linked to a compendium creature joins an actor (or is linked to one there). */
async function onPetItemChanged(item) {
  if (!isActiveGM() || !isPetItem(item) || !item.parent) return;
  if (!game.settings.get('sdm', 'importCompendiumPets')) return;
  if (isCompendiumUuid(item.system.pet)) await importPetForItem(item);
}

/** The Referee may have been away: bring in the pets still pointing at the compendium. */
async function importWaitingPets() {
  if (!isActiveGM() || !game.settings.get('sdm', 'importCompendiumPets')) return;
  for (const actor of game.actors) {
    for (const item of actor.items) {
      if (isPetItem(item) && isCompendiumUuid(item.system.pet)) await importPetForItem(item);
    }
  }
}

/* -------------------------------------------- */
/*  Caravan crew                                */
/* -------------------------------------------- */

/** A deleted actor leaves every caravan's crew. */
async function onActorDeleted(actor) {
  if (!isActiveGM() || !game.settings.get('sdm', 'removeDeletedFromCrew')) return;
  for (const caravan of game.actors) {
    if (caravan.type !== ActorType.CARAVAN) continue;
    const keys = Object.entries(caravan.system.crew ?? {})
      .filter(([, member]) => member?.id === actor.uuid)
      .map(([key]) => key);
    if (!keys.length) continue;
    // Same deletion as the crew tab's remove button
    const remove = () => (foundryVersionIsAtLeast('14') ? globalThis._del : new foundry.data.operators.ForcedDeletion());
    const update = Object.fromEntries(keys.map(key => [`system.crew.${key}`, remove()]));
    await caravan.update(update);
  }
}

export function setupPetLinks() {
  Hooks.on('createItem', onPetItemChanged);
  Hooks.on('updateItem', (item, changes) => {
    if (foundry.utils.hasProperty(changes, 'system.pet')) onPetItemChanged(item);
  });
  Hooks.on('deleteItem', onPetItemDeleted);
  Hooks.on('deleteActor', onActorDeleted);
  Hooks.once('ready', importWaitingPets);
}
