import SdmActorBase from './base-actor.mjs';
import { ItemType } from '../helpers/constants.mjs';

export default class SdmCarvan extends SdmActorBase {
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    'SDM.Actor.Caravan',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.company_name = new fields.StringField({
      required: false, blank: true, initial: '',
    });
    schema.financer = new fields.StringField({
      required: false, blank: true, initial: '',
    });
    schema.debt = new fields.StringField({
      required: false, blank: true, initial: '',
    });
    schema.due = new fields.StringField({
      required: false, blank: true, initial: '',
    });
    schema.patron = new fields.StringField({
      required: false, blank: true, initial: '',
    });

    // weekly costs
    schema.wages = new fields.StringField({
      required: false, blank: true, initial: '',
    });
    schema.supplies = new fields.StringField({
      required: false, blank: true, initial: '',
    });
    schema.fuel = new fields.StringField({
      required: false, blank: true, initial: '',
    });

    schema.size = new fields.SchemaField({
      mouths: new fields.NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0,
      }),
      mounts: new fields.NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0,
      }),
      motors: new fields.NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0,
      }),
    })

    schema.time = new fields.SchemaField({
      dayTally: new fields.StringField(),
      weeks: new fields.StringField(),
      season: new fields.StringField(),
      year: new fields.StringField(),
      yearsElapsed: new fields.StringField(),
    });

    schema.speed = new fields.SchemaField({
      talliesPerWeek: new fields.StringField(),
      slowTags: new fields.ArrayField(new fields.StringField()),
      fastTags: new fields.ArrayField(new fields.StringField()),
    });

    schema.initiative = new fields.StringField({
      required: true, initial: '',
      validate: v => foundry.dice.Roll.validate(v),
      validationError: "must be a valid Roll formula",
    });

    schema.assets = new fields.ArrayField(
      new fields.SchemaField({
        description: new fields.StringField(),
        capital: new fields.StringField(),
        risk: new fields.StringField(),
      }),
    );

    schema.helpers = new fields.ArrayField(
      new fields.SchemaField({
        helperId: new fields.DocumentUUIDField(),
      }), {
      required: false, initial: [
        { helperId: "Actor.SCN24FqoDITtm4wV"}
      ]}
    );
    schema.heroes = new fields.ArrayField(
      new fields.SchemaField({
        heroId: new fields.DocumentUUIDField(),
        role: new fields.StringField({ required: false, blank: true, initial: '' })
      }), {
      required: false, initial: [
        { heroId: 'Actor.mYItQa7vlzHsfetx', role: '' }
      ]}
    );

    schema.power = new fields.SchemaField({
      value: new fields.NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0,
      }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });


    return schema;
  }

  prepareDerivedData() {
    this.size.total = this.size.mouths + this.size.mounts + this.size.motors + this.size.magicals;

    let maxPower = 0;
    let mouths = 0;

    for (let hero of this.heroes) {
      const actor = fromUuidSync(hero.heroId);
      // console.log(actor.getPassengerWeight())
      if (!actor) {
        continue;
      }

      hero.name = actor.name;
      hero.level = actor.system.level;
      maxPower += hero.level;
      mouths += 1;
    }

    for (let helper of this.helpers) {
      const npc = fromUuidSync(helper.helperId)
      if (!npc) {
        continue;
      }

      helper.name = npc.name;
      helper.level = npc.system.level;
      helper.bonus = npc.system.bonus.major;
      helper.skills = npc.system.skills;
      helper.isWarrior = npc.system.isWarrior;

      if (helper.isWarrior) {
        maxPower += Math.max(helper.level, 1);
      }
      mouths +=1;
    }

    if (this.power.value === 0 && this.power.max === 0) {
      this.power.value = maxPower;
    } else {
      const spentPoints = this.power.max - this.power.value;
      this.power.value = maxPower - spentPoints;
    }

    this.power.max = maxPower;
    this.size.mouths = mouths;

    let mounts = 0;
    let motors = 0;

    for (let caravanItem of this.parent.items.contents) {
      if (caravanItem.type === ItemType.MOUNT) {
        mounts += 1;
      }
      if (caravanItem.type === ItemType.MOTOR) {
        motors += 1;
      }
    }


    this.size.mounts = mounts;
    this.size.motors = motors;
    this.size.total = this.size.mouths + this.size.mounts + this.size.motors;
  }
}
