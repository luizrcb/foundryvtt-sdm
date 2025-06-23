/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */

const $$ = (path) => `systems/sdm/templates/${path}.hbs`;

const templatesToLoad = [
  $$('actor/gears'),
  $$('actor/traits'),
  $$('actor/burdens'),
  $$('actor/character/header'),
  $$('actor/npc/header'),
];

export const preloadHandlebarsTemplates = async function () {
  return foundry.applications.handlebars.loadTemplates(templatesToLoad);
};
