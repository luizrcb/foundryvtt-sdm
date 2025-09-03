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
  $$('item/burden/header'),
  $$('item/gear/header'),
  $$('item/power_album'),
  $$('item/power'),
  $$('item/trait/header'),
];

export const preloadHandlebarsTemplates = async function () {
  return foundry.applications.handlebars.loadTemplates(templatesToLoad);
};
