/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */

export const preloadHandlebarsTemplates = async function () {
  return foundry.applications.handlebars.loadTemplates([
    'systems/sdm/templates/actor/gears.hbs',
    'systems/sdm/templates/actor/traits.hbs',
    'systems/sdm/templates/actor/burdens.hbs',
    "systems/sdm/templates/actor/character/header.hbs",
    "systems/sdm/templates/actor/npc/header.hbs"
  ]);
};
