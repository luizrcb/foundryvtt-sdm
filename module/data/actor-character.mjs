import { MAX_CARRY_WEIGHT_CASH, UNENCUMBERED_THRESHOLD_CASH } from '../helpers/actorUtils.mjs';
import { DieScale } from '../helpers/constants.mjs';
import { getDefaultAbility } from '../helpers/globalUtils.mjs';

import SdmActorBase from './base-actor.mjs';
// import CharacterPetModel from './character-pet.mjs';

export default class SdmCharacter extends SdmActorBase {
  static LOCALIZATION_PREFIXES = [...super.LOCALIZATION_PREFIXES, 'SDM.Actor.Character'];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.initiative = new fields.StringField({
      required: false,
      blank: true,
      initial: '',
      validate: v => !v || foundry.dice.Roll.validate(v),
      validationError: game.i18n.localize('SDM.ErrorValidationRollFormula')
    });

    schema.initiative_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.armor_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.defense = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.defense_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.mental_defense = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.mental_defense_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.social_defense = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.social_defense_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.ward_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.prestige = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.trait_slots_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.item_slots_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    // allows having extra SOAP sized readied items
    schema.small_item_slots_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.packed_item_slots_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.burden_slots_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.power_slots_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.reaction_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    // bonus to all saving throw rolls
    schema.all_save_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.save_target = new fields.NumberField({
      ...requiredInteger,
      initial: 13
    });

    //TODO: remove total carry weight and encumbered active effects, to use slots system and burden penalties
    // in CASH
    schema.carry_weight = new fields.SchemaField({
      unencumbered: new fields.NumberField({
        ...requiredInteger,
        initial: UNENCUMBERED_THRESHOLD_CASH
      }),
      max: new fields.NumberField({ ...requiredInteger, initial: MAX_CARRY_WEIGHT_CASH })
    });

    schema.item_slots_taken = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0
    });

    schema.trait_slots_taken = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0
    });

    schema.burden_penalty = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0
    });

    schema.burden_penalty_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0
    });

    // character experience
    schema.experience = new fields.StringField({ required: true, initial: '0' });
    schema.player_experience = new fields.StringField({ required: true, initial: '0' });

    schema.life = new fields.SchemaField({
      value: new fields.NumberField({
        ...requiredInteger,
        initial: 4,
        min: 0
      }),
      base: new fields.NumberField({ ...requiredInteger, initial: 4, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 4, min: 0 }),
      min: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 0 }),
      bonus: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      imbued: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    schema.level = new fields.NumberField({ ...requiredInteger, min: 0, initial: 0, max: 9 });
    schema.friends = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.foes = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.likes = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.species = new fields.StringField({ required: false, blank: true, initial: '' });
    schema.looks = new fields.StringField({ required: false, blank: true, initial: '' });

    schema.debt = new fields.StringField({ require: true, initial: '0' });
    schema.wealth = new fields.StringField({ require: true, initial: '0' });
    schema.revenue = new fields.StringField({ require: true, initial: '0' });
    schema.expense = new fields.StringField({ require: true, initial: '0' });

    schema.hero_dice = new fields.SchemaField({
      value: new fields.NumberField({
        ...requiredInteger,
        initial: 1,
        min: 0
      }),
      max: new fields.NumberField({
        ...requiredInteger,
        initial: 1,
        min: 1
      }),
      min: new fields.NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0,
        max: 0
      }),
      dice_type: new fields.StringField({
        required: false,
        blank: true,
        choices: DieScale.reduce((acc, die) => {
          acc[die] = die;
          return acc;
        }, {})
      }),
      bonus: new fields.NumberField({
        ...requiredInteger,
        initial: 0
      })
    });

    schema.attack_bonus = new fields.NumberField({
      ...requiredInteger,
      initial: 0
    });

    schema.melee = new fields.SchemaField({
      bonus: new fields.NumberField({
        ...requiredInteger,
        initial: 0
      }),
      favorite_skill: new fields.DocumentUUIDField({ required: false, blank: true, initial: '' }),
      default_ability: getDefaultAbility('str')
    });

    schema.ranged = new fields.SchemaField({
      bonus: new fields.NumberField({
        ...requiredInteger,
        initial: 0
      }),
      favorite_skill: new fields.DocumentUUIDField({ required: false, blank: true, initial: '' }),
      default_ability: getDefaultAbility('agi')
    });

    schema.power_cost = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 2
    });

    schema.oldtech = new fields.SchemaField({
      bonus: new fields.NumberField({
        ...requiredInteger,
        initial: 0
      }),
      favorite_skill: new fields.DocumentUUIDField({ required: false, blank: true, initial: '' }),
      default_ability: getDefaultAbility('tho')
    });

    schema.fantascience = new fields.SchemaField({
      bonus: new fields.NumberField({
        ...requiredInteger,
        initial: 0
      }),
      favorite_skill: new fields.DocumentUUIDField({ required: false, blank: true, initial: '' }),
      default_ability: getDefaultAbility('cha')
    });

    // Iterate over abilities names and create a new SchemaField for each.
    schema.abilities = new fields.SchemaField(
      Object.keys(CONFIG.SDM.abilities).reduce((obj, ability) => {
        obj[ability] = new fields.SchemaField({
          base: new fields.NumberField({
            ...requiredInteger,
            initial: 0,
            min: 0
          }),
          full: new fields.NumberField({
            ...requiredInteger,
            initial: 0,
            min: 0
          }),
          current: new fields.NumberField({
            ...requiredInteger,
            initial: 0,
            min: 0
          }),
          bonus: new fields.NumberField({
            ...requiredInteger,
            initial: 0
          }),
          save_bonus: new fields.NumberField({
            ...requiredInteger,
            initial: 0
          })
        });
        return obj;
      }, {})
    );

    schema.pets = new fields.ArrayField(new fields.DocumentUUIDField());

    return schema;
  }

  prepareDerivedData() {
    for (const key in this.abilities) {
      // Handle abilities label localization.
      this.abilities[key].label = game.i18n.localize(CONFIG.SDM.abilities[key]) ?? key;
    }

    const baseItemSlots = game.settings.get('sdm', 'baseItemSlots') || 7;
    const baseTraitSlots = game.settings.get('sdm', 'baseTraitSlots') || 7;
    const baseBurdenSlots = game.settings.get('sdm', 'baseBurdenSlots') || 20;

    this.item_slots = baseItemSlots + this.abilities['str'].current + this.item_slots_bonus;
    this.trait_slots = baseTraitSlots + this.abilities['tho'].current + this.trait_slots_bonus;
    this.burden_slots = baseBurdenSlots + this.burden_slots_bonus;
  }

  getRollData() {
    const data = {};

    if (this.abilities) {
      for (let [k, v] of Object.entries(this.abilities)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    data.life = this.life;
    data.lvl = this.level;
    data.hero_dice = this.hero_dice;
    data.initiative_bonus = this.initiative_bonus;
    data.burden_penalty = this.burden_penalty;
    data.burden_penalty_bonus = this.burden_penalty_bonus;
    data.item_slots = this.item_slots;
    data.item_slots_taken = this.item_slots_taken;
    data.trait_slots = this.trait_slots;
    data.trait_slots_taken = this.trait_slots_taken;
    data.burden_slots = this.burden_slots;
    return data;
  }
}
