export function validateActorId(id) {
  if (!id || id.trim() === "") return true;

  return !!game.actors.get(id);
}

export function validateItemId(id) {
  if (!id || id.trim() === "") return true;

  return !!game.items.get(id);
}

export function validateDocumentId(id) {
  if (!id || id.trim() === "") return true;

  return validateActorId(id) || validateItemId(id);
}

export function capitalizeFirstLetter(string) {
  return string[0].toUpperCase() + string.slice(1);
}
