const $$ = path => `systems/sdm/templates/${path}.hbs`;

export const templatePath = $$;

const templatesToLoad = [
  $$('custom-roll-dialog'),
  $$('actor/items'),
  $$('actor/item'),
  $$('actor/traits'),
  $$('actor/trait'),
  $$('actor/burdens'),
  $$('actor/character/header'),
  $$('actor/npc/header'),
  $$('item/gear/header'),
  $$('item/trait/header'),
  $$('item/power'),
  $$('actor/npc/morale-roll-dialog')
];

export const preloadHandlebarsTemplates = async function () {
  return foundry.applications.handlebars.loadTemplates(templatesToLoad);
};
