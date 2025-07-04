/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */

const $$ = (path) => `systems/sdm/templates/${path}.hbs`;

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
];

export const preloadHandlebarsTemplates = async function () {
  return foundry.applications.handlebars.loadTemplates(templatesToLoad);
};
