const $$ = path => `systems/sdm/templates/${path}.hbs`;

export const templatePath = $$;

const templatesToLoad = [
  $$('actor/burdens'),
  $$('actor/caravan/header'),
  $$('actor/character/header'),
  $$('actor/item'),
  $$('actor/items'),
  $$('actor/npc/header'),
  $$('actor/trait'),
  $$('actor/traits'),
  $$('actor/v2/header'),
  $$('actor/v2/inventory'),
  $$('actor/v2/biography'),
  $$('actor/v2/notes'),
  $$('actor/v2/npc-header'),
  $$('actor/v2/caravan-header'),
  $$('actor/v2/items'),
  $$('actor/v2/traits'),
  $$('actor/v2/burdens'),
  $$('item/burden/header'),
  $$('item/gear/header'),
  $$('item/mount/header'),
  $$('item/power_album'),
  $$('item/power'),
  $$('item/trait/header'),
  $$('item/vehicle/header'),
  $$('item/v2/header'),
  $$('item/v2/gear'),
  $$('item/v2/trait'),
  $$('item/v2/burden'),
  $$('item/v2/transport'),
  $$('item/v2/power'),
  $$('item/v2/hallmark'),
  $$('item/v2/cure-steps'),
  $$('item/v2/installed-mods'),
  $$('item/v2/pet-link'),
  $$('item/v2/description'),
  $$('item/v2/gm-notes'),
  $$('item/gm-notes'),
  $$('compendium/browser-filters'),
  $$('compendium/browser-results'),
  $$('compendium/browser-filter-set'),
  $$('compendium/browser-entry'),
  $$('compendium/browser-footer'),
];

export const preloadHandlebarsTemplates = async function () {
  return foundry.applications.handlebars.loadTemplates(templatesToLoad);
};
