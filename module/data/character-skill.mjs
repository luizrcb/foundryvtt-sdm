// Define the schema for a single skill object

export const getDefaultStat = (initialValue = '') => {
  const properties = { required: true, blank: false,
    choices: Object.keys(CONFIG.SDM.statAbbreviations).reduce((acc, key) => {
      acc[key] = game.i18n.localize(CONFIG.SDM.statAbbreviations[key]);
      return acc;
    }, {}),
  };

  return new foundry.data.fields.StringField({
    ...properties,
    ...(initialValue && { initial: initialValue }),
    });
};

export default class SkillDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      name: new foundry.data.fields.StringField({ required: true, blank: false }),
      expertise: new foundry.data.fields.BooleanField({
        required: true,
        initial: false,
      }),
      defaultStat: getDefaultStat(),
      sources: new foundry.data.fields.NumberField({
        required: true, integer: true, nullable: false, min: 0, max: 4, initial: 0
      }),
    };
  }
}