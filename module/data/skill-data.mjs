import { SkillMod } from "../helpers/constants.mjs";

export default class SkillDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    return {
      modifier: new fields.NumberField({
        required: false, initial: 0, min: 0,
        choices: Object.entries(SkillMod).reduce((acc, [key, value]) => {
          acc[value] = key;
          return acc;
        }, {}),
      }),
      modifier_bonus: new fields.NumberField({
        ...requiredInteger, initial: 0,
      }),
      modifier_final: new fields.NumberField({
        ...requiredInteger, initial: 0,
      }),
    };
  }
}
