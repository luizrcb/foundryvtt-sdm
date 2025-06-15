/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
const { loadTemplates } = foundry.applications.handlebars;

export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([
      'systems/sdm/templates/actor/gear.hbs',
      'systems/sdm/templates/actor/traits.hbs',
  ]);
};
