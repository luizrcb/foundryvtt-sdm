const fields = foundry.data.fields;

const requiredInteger = { required: true, nullable: false, integer: true };

export function hallmarkBaseFields() {
  return {
    level: new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0
    }),

    experience: new fields.StringField({ required: true, initial: '0' }),

    // Level-up upgrades waiting to be chosen (one per level gained)
    pending_upgrades: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    // Highest level that already granted its upgrade (null: not tracked yet, use the current level)
    upgrades_level: new fields.NumberField({ required: false, nullable: true, integer: true, initial: null }),

    // Upgrades chosen as free text (new trait, power or complication)
    upgrade_notes: new fields.ArrayField(new fields.StringField({ required: true, blank: false })),

    // Set by the Referee: the next upgrade has no material cost
    free_upgrade: new fields.BooleanField({ required: true, initial: false }),

  };
}

export default class HallmarkBaseDataModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      ...hallmarkBaseFields()
    };
  }
}
