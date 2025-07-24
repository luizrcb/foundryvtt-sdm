const $$ = path => `systems/sdm/templates/${path}.hbs`;

export const templatePath = $$;

const templatesToLoad = [
  $$('actor/items'),
  $$('actor/item'),
  $$('actor/traits'),
  $$('actor/trait'),
  $$('actor/burdens'),
  $$('actor/character/header'),
  $$('actor/npc/header'),
  $$('actor/caravan/header'),
  $$('item/gear/header'),
  $$('item/trait/header'),
  $$('item/burden/header'),
  $$('item/power')
];

export const preloadHandlebarsTemplates = async function () {
  return foundry.applications.handlebars.loadTemplates(templatesToLoad);
};
