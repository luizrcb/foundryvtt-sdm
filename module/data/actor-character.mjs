import { MAX_CARRY_WEIGHT_CASH, UNENCUMBERED_THRESHOLD_CASH } from '../helpers/actorUtils.mjs';
import { getDefaultAbility } from '../helpers/globalUtils.mjs';

import SdmActorBase from './base-actor.mjs';
import CharacterPetModel from './character-pet.mjs';

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

    schema.initiative_bonus = new fields.NumberField({
      ...requiredInteger, initial: 0,
    });

    schema.defense = new fields.NumberField({
      ...requiredInteger, initial: 0,
    });

    schema.defense_bonus = new fields.NumberField({
      ...requiredInteger, initial: 0,
    });

    schema.trait_slots_bonus = new fields.NumberField({
      ...requiredInteger, initial: 0,
    });

    schema.item_slots_bonus = new fields.NumberField({
      ...requiredInteger, initial: 0,
    });

    // allows having extra SOAP sized readied items
    schema.small_item_slots_bonus = new fields.NumberField({
      ...requiredInteger, initial: 0,
    });

    schema.packed_item_slots_bonus = new fields.NumberField({
      ...requiredInteger, initial: 0,
    });

    schema.burden_slots_bonus = new fields.NumberField({
      ...requiredInteger, initial: 0,
    });

    schema.physical_save_bonus = new fields.NumberField({
      ...requiredInteger, initial: 0,
    });

    schema.mental_save_bonus = new fields.NumberField({
      ...requiredInteger, initial: 0,
    });

    schema.reaction_bonus = new fields.NumberField({
      ...requiredInteger, initial: 0,
    });

    schema.save_target = new fields.NumberField({
      ...requiredInteger, initial: 13,
    });

    //TODO: remove total carry weight and encumbered active effects, to use slots system and burden penalties
    // in CASH
    schema.carry_weight = new fields.SchemaField({
      unencumbered: new fields.NumberField({ ...requiredInteger, initial: UNENCUMBERED_THRESHOLD_CASH }),
      max: new fields.NumberField({ ...requiredInteger, initial: MAX_CARRY_WEIGHT_CASH }),
    });

    schema.burden_penalty = new fields.NumberField({
      ...requiredInteger, initial: 0, max:0,
    });

    // character experience
    schema.experience = new fields.StringField({ required: true, initial: '0' });
    schema.player_experience = new fields.StringField({ required: true, initial: '0' });

    schema.life = new fields.SchemaField({
      value: new fields.NumberField({
        ...requiredInteger,
        initial: 4,
        min: 0,
      }),

      //TODO how to handle life and life bonuses?
      max: new fields.NumberField({ ...requiredInteger, initial: 5, min: 5 }),
      min: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 0 }),
      bonus: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      imbued: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });

    schema.level = new fields.NumberField({ ...requiredInteger, min: 0, initial: 0, max: 9 });
    schema.friends = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.enemies = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.likes = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.species = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.looks = new fields.StringField({ required: false, blank: true, initial: '' });

    schema.debt = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.wealth = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.revenue = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.expense = new fields.StringField({ required: false, blank: true, initial: '' });


    schema.heroics = new fields.SchemaField({
      value: new fields.NumberField({
        ...requiredInteger,
        initial: 1,
        min: 0,
      }),
      max: new fields.NumberField({
        ...requiredInteger,
        initial: 1,
        min: 1,
      }),
      min: new fields.NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0,
        max: 0,
      }),
    });

    schema.melee = new fields.SchemaField({
      name: new foundry.data.fields.StringField({
        required: true,
        blank: false,
        initial: game.i18n.localize('SDM.attacks.melee'),
      }),
      bonus: new fields.NumberField({
        ...requiredInteger, initial: 0,
      }),
      defaultStat: getDefaultAbility('str'),
    });

    schema.ranged = new fields.SchemaField({
      name: new foundry.data.fields.StringField({
        required: true,
        blank: false,
        initial: game.i18n.localize('SDM.attacks.ranged'),
      }),
      bonus: new fields.NumberField({
        ...requiredInteger, initial: 0,
      }),
      defaultStat: getDefaultAbility('agi'),
    });

    schema.oldtech = new fields.SchemaField({
      name: new foundry.data.fields.StringField({
        required: true,
        blank: false,
        initial: game.i18n.localize('SDM.attacks.oldtech'),
      }),
      bonus: new fields.NumberField({
        ...requiredInteger, initial: 0,
      }),
      defaultStat: getDefaultAbility('tho'),
      magic_cost: new fields.NumberField({
        ...requiredInteger, min: 1, max: 3, initial: 2,
      }),
    });

    schema.fantascience = new fields.SchemaField({
      name: new foundry.data.fields.StringField({
        required: true,
        blank: false,
        initial: game.i18n.localize('SDM.attacks.fantascience'),
      }),
      bonus: new fields.NumberField({
        ...requiredInteger, initial: 0,
      }),
      defaultStat: getDefaultAbility('cha'),
      magic_cost: new fields.NumberField({
        ...requiredInteger, min: 1, max: 3, initial: 2,
      }),
    });

    // Iterate over abilities names and create a new SchemaField for each.
    schema.abilities = new fields.SchemaField(
      Object.keys(CONFIG.SDM.abilities).reduce((obj, ability) => {
        obj[ability] = new fields.SchemaField({
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
            ...requiredInteger,
            initial: 0,
            min: 0,
          }),
          bonus: new fields.NumberField({
            ...requiredInteger, initial: 0,
          }),
        });
        return obj;
      }, {})
    );

    // schema.fatigue = new fields.SchemaField({
    //   grumpy: new fields.BooleanField({ required: true, initial: false }),
    //   disadvantage: new fields.BooleanField({ required: true, initial: false }),
    //   halfSpeed: new fields.BooleanField({ required: true, initial: false }),
    //   halfLife: new fields.BooleanField({ required: true, initial: false }),
    //   coma: new fields.BooleanField({ required: true, initial: false }),
    //   death: new fields.BooleanField({ required: true, initial: false }),
    // });

    schema.pet = new fields.EmbeddedDataField(CharacterPetModel, {
      required: false, nullable: true, initial: null,
    })

    return schema;
  }

  prepareDerivedData() {
    for (const key in this.abilities) {
      this.abilities[key].final_current = this.abilities[key].current + this.abilities[key].bonus;
      this.abilities[key].final_full = this.abilities[key].full + this.abilities[key].bonus;

      // Handle abilities label localization.
      this.abilities[key].label =
        game.i18n.localize(CONFIG.SDM.abilities[key]) ?? key;
    }

    // this.life.max = Math.max(1, this.life.base_max - this.life.imbued + this.life.bonus);
    // this.life.value = Math.max(0, this.life.base_value - this.life.imbued + this.life.bonus);
  }

  getRollData() {
    const data = {};

    if (this.abilities) {
      for (let [k, v] of Object.entries(this.abilities)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    data.life = this.life
    data.lvl = this.level;;
    data.bonus = this.bonus;
    data.armor = this.armor;
    data.heroics = this.heroics;
    data.initiative_bonus = this.initiative_bonus;
    return data;
  }
}
