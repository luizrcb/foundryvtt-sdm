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

export const getDefaultAbility = (initialValue = '') => {
  const properties = {
    required: false, blank: true,
    choices: Object.keys(CONFIG.SDM.abilityAbbreviations).reduce((acc, key) => {
      acc[key] = game.i18n.localize(CONFIG.SDM.abilityAbbreviations[key]);
      return acc;
    }, {}),
  };

  return new foundry.data.fields.StringField({
    ...properties,
    ...(initialValue && { initial: initialValue }),
  });
};
