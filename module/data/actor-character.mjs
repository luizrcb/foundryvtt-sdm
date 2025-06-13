import { MAX_CARRY_WEIGHT_CASH, UNENCUMBERED_THRESHOLD_CASH } from '../helpers/actorUtils.mjs';
import SdmActorBase from './base-actor.mjs';
import AbilityDataModel from './character-ability.mjs';
import CharacterPetModel from './character-pet.mjs';
import SkillDataModel, { getDefaultStat } from './character-skill.mjs';

export default class SdmCharacter extends SdmActorBase {
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    'SDM.Actor.Character',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.initiative = new fields.StringField({
      required: false, blank: true, initial: '',
      validate: v => !v || foundry.dice.Roll.validate(v),
      validationError: "must be a valid Roll formula",
    });

    // in CASH
    schema.carryWeight = new fields.SchemaField({
      unencumbered: new fields.NumberField({ ...requiredInteger, initial: UNENCUMBERED_THRESHOLD_CASH }),
      max: new fields.NumberField({ ...requiredInteger, initial: MAX_CARRY_WEIGHT_CASH }),
    });

    schema.experience = new fields.StringField({ required: true, initial: '0' });

    schema.life = new fields.SchemaField({
      value: new fields.NumberField({
        ...requiredInteger,
        initial: 5,
        min: 0,
      }),
      max: new fields.NumberField({ ...requiredInteger, initial: 5, min: 5 }),
      bonus: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      reserved: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });

    schema.level = new fields.NumberField({ ...requiredInteger, min: 0, initial: 0, max: 9 });
    schema.friends = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.enemies = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.title = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.species = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.looks = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.debt = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.likes = new fields.StringField({ required: false, blank: true, initial: '' });

    schema.heroics = new fields.SchemaField({
      value: new fields.NumberField({
        ...requiredInteger,
        initial: 1,
        min: 0,
      })
    });

    schema.skills = new fields.ArrayField(
      new fields.EmbeddedDataField(SkillDataModel), {
        initial: [{
          name: 'Swordfighting',
          expertise: true,
          defaultStat: 'str',
          sources: 4,
        },
        {
          name: 'Shooting',
          expertise: false,
          defaultStat: 'agi',
          sources: 4,
        },
        {
          name: 'Technomagic',
          expertise: false,
          defaultStat: 'tho',
          sources: 4,
        }
        ]
    }
    );

    schema.close_combat = new fields.SchemaField({
      name: new foundry.data.fields.StringField({
        required: true,
        blank: false,
        initial: game.i18n.localize('SDM.defaultSkill.close_combat'),
      }),
      expertise: new foundry.data.fields.BooleanField({
        required: true,
        initial: false,
      }),
      defaultStat: getDefaultStat('str'),
    });

    schema.ranged_combat = new fields.SchemaField({
      name: new foundry.data.fields.StringField({
        required: true,
        blank: false,
        initial: game.i18n.localize('SDM.defaultSkill.ranged_combat'),
      }),
      expertise: new foundry.data.fields.BooleanField({
        required: true,
        initial: false,
      }),
      defaultStat: getDefaultStat('agi'),
    })

    schema.magic_combat = new fields.SchemaField({
      name: new foundry.data.fields.StringField({
        required: true,
        blank: false,
        initial: game.i18n.localize('SDM.defaultSkill.magic_combat'),
      }),
      expertise: new foundry.data.fields.BooleanField({
        required: true,
        initial: false,
      }),
      defaultStat: getDefaultStat('tho'),
      magic_cost: new fields.NumberField({
        ...requiredInteger, min: 1, max: 3, initial: 2,
      })
    });

    schema.abilities = new fields.ArrayField(
      new fields.EmbeddedDataField(AbilityDataModel), {
        initial: [{
          name: 'Some ability 1',
          sources: 4,
        },
        {
          name: 'Some ability 2',
          sources: 3,
        },
        {
          name: 'Some ability 3',
          sources: 0,
        }
        ]
    }
    );

    // Iterate over stats names and create a new SchemaField for each.
    schema.stats = new fields.SchemaField(
      Object.keys(CONFIG.SDM.stats).reduce((obj, stat) => {
        obj[stat] = new fields.SchemaField({
          enhanced: new fields.BooleanField({
            required: true,
            initial: false,
          }),
          full: new fields.NumberField({
            ...requiredInteger,
            initial: 0,
            min: 0,
          }),
          current: new fields.NumberField({
            required: true,
            nullable: true,
            integer: true,
            initial: null,
            min: 0,
          }),
        });
        return obj;
      }, {})
    );

    schema.fatigue = new fields.SchemaField({
      grumpy: new fields.BooleanField({ required: true, initial: false }),
      disadvantage: new fields.BooleanField({ required: true, initial: false }),
      halfSpeed: new fields.BooleanField({ required: true, initial: false }),
      halfLife: new fields.BooleanField({ required: true, initial: false }),
      coma: new fields.BooleanField({ required: true, initial: false }),
      death: new fields.BooleanField({ required: true, initial: false }),
    });

    schema.pet = new fields.EmbeddedDataField(CharacterPetModel, {
      required: false, nullable: true, initial: null,
    })

    return schema;
  }

  prepareDerivedData() {
    // Loop through ability scores, and add their modifiers to our sheet output.
    // for (const key in this.abilities) {
    //   // Calculate the modifier using d20 rules.
    //   this.abilities[key].mod = Math.floor(
    //     (this.abilities[key].value - 10) / 2
    //   );
    //   // Handle ability label localization.
    //   this.abilities[key].label =
    //     game.i18n.localize(CONFIG.SDM.abilities[key]) ?? key;
    // }

    for (const key in this.stats) {
      if (this.stats[key].current !== null) {
        this.stats[key].final = this.stats[key].current;
      } else {
        this.stats[key].final = this.stats[key].full;
      }

      // Handle stats label localization.
      this.stats[key].label =
        game.i18n.localize(CONFIG.SDM.stats[key]) ?? key;
    }

    this.life.final_max = Math.max(1, this.life.max - this.life.reserved + this.life.bonus);
    this.life.final_remaining = Math.max(0, this.life.value - this.life.reserved + this.life.bonus);

  }

  getRollData() {
    const data = {};

    // Copy the stats scores to the top level, so that rolls can use
    // formulas like `@str.final + 1`.
    // if (this.abilities) {
    //   for (let [k, v] of Object.entries(this.abilities)) {
    //     data[k] = foundry.utils.deepClone(v);
    //   }
    // }

    if (this.stats) {
      for (let [k, v] of Object.entries(this.stats)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    data.life = this.life
    data.skills = this.skills;
    data.lvl = this.level;
    data.bonus = this.bonus;
    data.armor = this.armor;


    return data;
  }
}
