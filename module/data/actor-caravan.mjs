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

    return schema;
  }

  prepareDerivedData() {
    // this.size.total = this.size.mouths + this.size.mounts + this.size.vehicles + this.size.magicals;
    // let maxPower = 0;
    // let mouths = 0;
    // for (let hero of this.heroes) {
    //   const actor = fromUuidSync(hero.heroId);
    //   if (!actor) {
    //     continue;
    //   }
    //   hero.name = actor.name;
    //   hero.level = actor.system.level;
    //   maxPower += hero.level;
    //   mouths += 1;
    // }
    // for (let helper of this.helpers) {
    //   const npc = fromUuidSync(helper.helperId);
    //   if (!npc) {
    //     continue;
    //   }
    //   helper.name = npc.name;
    //   helper.level = npc.system.level;
    //   helper.bonus = npc.system.bonus.major;
    //   helper.skills = npc.system.skills;
    //   helper.isWarrior = npc.system.isWarrior;
    //   if (helper.isWarrior) {
    //     maxPower += Math.max(helper.level, 1);
    //   }
    //   mouths += 1;
    // }
    // if (this.power.value === 0 && this.power.max === 0) {
    //   this.power.value = maxPower;
    // } else {
    //   const spentPoints = this.power.max - this.power.value;
    //   this.power.value = maxPower - spentPoints;
    // }
    // this.power.max = maxPower;
    // this.size.mouths = mouths;
    // let mounts = 0;
    // let vehicles = 0;
    // for (let caravanItem of this.parent.items.contents) {
    //   if (caravanItem.type === ItemType.MOUNT) {
    //     mounts += 1;
    //   }
    //   if (caravanItem.type === ItemType.VEHICLE) {
    //     vehicles += 1;
    //   }
    // }
    // this.size.mounts = mounts;
    // this.size.vehicles = vehicles;
    // this.size.total = this.size.mouths + this.size.mounts + this.size.vehicles;
  }
}
