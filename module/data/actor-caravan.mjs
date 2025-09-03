import SdmActorBase from './base-actor.mjs';
import { ItemType } from '../helpers/constants.mjs';
import { transportBaseFields } from './transport-base-data.mjs';

export default class SdmCarvan extends SdmActorBase {
  static LOCALIZATION_PREFIXES = [...super.LOCALIZATION_PREFIXES, 'SDM.Actor.Caravan'];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.motto = new fields.StringField({
      required: false,
      blank: true,
      initial: ''
    });

    schema.financier = new fields.StringField({
      required: false,
      blank: true,
      initial: ''
    });

    // shared cash
    schema.wealth = new fields.StringField({ require: true, initial: '0' });
    schema.total_cash = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.inventory_value = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.debt = new fields.StringField({
      required: false,
      blank: true,
      initial: ''
    });

    // weekly costs
    schema.cost = new fields.StringField({
      required: false,
      blank: true,
      initial: ''
    });

    schema.supply = new fields.StringField({
      required: false,
      blank: true,
      initial: ''
    });

    // caravan total capacity
    schema.capacity = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.current_location = new fields.StringField({
      required: false,
      blank: true,
      initial: ''
    });

    schema.eta = new fields.StringField({
      required: false,
      blank: true,
      initial: ''
    });

    schema.current_destination = new fields.StringField({
      required: false,
      blank: true,
      initial: ''
    });

    schema.date = new fields.StringField({
      required: false,
      blank: true,
      initial: ''
    });

    schema.speed = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      choices: CONFIG.SDM.reverseSpeedValues
    });

    schema.initiative = new fields.StringField({
      required: true,
      initial: '',
      validate: v => foundry.dice.Roll.validate(v),
      validationError: game.i18n.localize('SDM.ErrorValidationRollFormula')
    });

    schema.transport = new fields.TypedObjectField(
      new fields.SchemaField(
        {
          ...transportBaseFields()
        },
        { nullable: true }
      ),
      {
        initial: {}
      }
    );

    schema.crew = new fields.TypedObjectField(
      new fields.SchemaField(
        {
          character: new fields.StringField({ required: true }),
          skill: new fields.StringField({
            required: false,
            nullable: true,
            blank: true,
            initial: ''
          }),
          cost: new fields.StringField({
            required: false,
            nullable: true,
            blank: true,
            initial: ''
          }),
          supply: new fields.StringField({
            required: false,
            nullable: true,
            blank: true,
            initial: ''
          })
        },
        { nullable: true }
      ),
      {
        initial: {}
      }
    );

    schema.routes = new fields.TypedObjectField(
      new fields.SchemaField(
        {
          name: new fields.StringField({ required: true }),
          agent: new fields.StringField(),
          quirk: new fields.StringField(),
          locationA: new fields.StringField(),
          eta: new fields.StringField(),
          locationB: new fields.StringField(),
          investment: new fields.StringField(),
          risk: new fields.StringField()
        },
        { nullable: true }
      ),
      {
        initial: {}
      }
    );

    schema.capacity_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.speed_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.initiative_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.encumbered =  new fields.BooleanField({ initial: false });

    return schema;
  }

  prepareDerivedData() {
  }
}
