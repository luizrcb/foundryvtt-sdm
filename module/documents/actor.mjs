import {
  BASE_DEFENSE_VALUE,
  MAX_ATTRIBUTE_VALUE,
  getMaxLife,
  getLevel,
  CHARACTER_DEFAULT_WEIGHT_IN_CASH
} from '../helpers/actorUtils.mjs';
import { ActorType, GearType, ItemType, SizeUnit, TraitType } from '../helpers/constants.mjs';
import { safeEvaluate } from '../helpers/globalUtils.mjs';
import { BURDEN_ITEM_TYPES, convertToCash, GEAR_ITEM_TYPES } from '../helpers/itemUtils.mjs';

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class SdmActor extends Actor {

  // Override the _onUpdate method to handle level changes
  /** @override */
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);

    const properties = ['player_experience', 'debt', 'wealth', 'revenue', 'expense'];
    const updates = {};

    for (const prop of properties) {
      if (changed.system?.[prop] !== undefined) {
        let value = safeEvaluate(`${changed.system[prop]}`.trim());
        value = parseInt(value, 10) || 0;
        updates[`system.${prop}`] = `${value.toString()}`;
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.update(updates);
    }

    if (changed.system?.experience !== undefined) {
      let resultingExperience = safeEvaluate(changed.system?.experience);
      resultingExperience = parseInt(resultingExperience, 10);
      const newLevel = getLevel(resultingExperience);
      const baseLife = getMaxLife(newLevel);

      const effectiveMaxLife = baseLife + this.system.life.bonus - this.system.life.imbued;
      const lifeAmountToIncrease = effectiveMaxLife - this.system.life.max; // Preserve lost health

      const maxHeroDice = Math.max(newLevel + this.system.hero_dice.bonus, 1);
      const currentHeroDiceSpent = this.system.hero_dice.max - this.system.hero_dice.value;
      const remainingHeroDice = maxHeroDice - currentHeroDiceSpent;

      await this.update({
        'system.experience': `${resultingExperience.toString()}`,
        'system.level': newLevel,
        'system.hero_dice.max': Math.max(maxHeroDice, 1),
        'system.hero_dice.value': Math.min(remainingHeroDice, maxHeroDice),
        'system.life.base': baseLife,
        'system.life.value': this.system.life.value + lifeAmountToIncrease // Cap current health
      });
    }


    if (changed.system?.life?.value !== undefined) {
      if (changed.system?.life?.value > this.system.life.max) {
        await this.update({
          'system.life.value': this.system.life.max,
        });
      }
    }

    if (changed.system?.abilities) {
      const abilities = changed.system.abilities;

      // Iterate over updated abilities
      for (const [abilityKey, abilityData] of Object.entries(abilities)) {
        const systemAbility = this.system.abilities[abilityKey];
        if (abilityData.current !== undefined) {

          if (abilityData.current > (systemAbility.base + systemAbility.bonus)) {
            abilityData.current = (systemAbility.base + systemAbility.bonus);
          }

          if (abilityData.current < 0) {
            abilityData.current = 0;
          }

          await this.update({
            [`system.abilities.${abilityKey}.current`]: abilityData.current,
          });
        }
      }
    }
  }

  // Helper: Create encumbered effect
  async addEncumberedEffect() {
    const effectData = {
      name: 'encumbered',
      label: 'encumbered',
      icon: 'icons/tools/smithing/anvil.webp',
      changes: [],
      flags: {
        sdm: {
          effectType: 'encumbered',
          source: 'encumbrance'
        }
      }
    };
    await this.createEmbeddedDocuments('ActiveEffect', [effectData]);
  }

  async addCumbersomeArmor() {
    const effectData = {
      name: 'cumbersome (armor)',
      label: 'cumbersome (armor)',
      icon: 'icons/equipment/chest/breastplate-banded-steel.webp',
      changes: [],
      flags: {
        sdm: {
          effectType: 'encumbered',
          source: 'armor'
        }
      }
    };
    await this.createEmbeddedDocuments('ActiveEffect', [effectData]);
  }

  async addEncumberedSlow() {
    const effectData = {
      name: 'slow (encumbered)', // Descriptive label
      label: 'slow (encumbered)', // Descriptive label
      icon: 'icons/creatures/invertebrates/snail-movement-green.webp',
      changes: [],
      flags: {
        sdm: {
          effectType: 'slow',
          source: 'encumbrance'
        }
      }
    };
    await this.createEmbeddedDocuments('ActiveEffect', [effectData]);
  }

  // Add fatigue slow
  async addFatigueSlow() {
    const effectData = {
      name: 'slow (fatigue)', // Descriptive label
      label: 'slow (fatigue)', // Descriptive label
      icon: 'icons/creatures/invertebrates/snail-movement-green.webp',
      changes: [],
      flags: {
        sdm: {
          effectType: 'slow',
          source: 'fatigue'
        }
      }
    };
    await this.createEmbeddedDocuments('ActiveEffect', [effectData]);
  }

  async addFatigueHalfLife() {
    // In your effect creation code
    const actorMaxLife = this.system.life.max; // Fetch directly from actor data
    const actorCurrentLife = this.system.life.value;
    const halfMaxLife = Math.floor(actorMaxLife * 0.5);

    const effectData = {
      name: 'half life (fatigue)',
      label: 'half life (fatigue)',
      icon: 'icons/svg/skull.svg',
      changes: [
        {
          key: 'system.life.max',
          value: halfMaxLife.toString(), // Ensure value is a string
          mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE
        }
      ],
      flags: {
        sdm: {
          effectType: 'halfLife',
          source: 'fatigue'
        }
      }
    };

    if (actorCurrentLife > halfMaxLife) {
      effectData.changes.push({
        key: 'system.life.value',
        value: halfMaxLife.toString(), // Ensure value is a string
        mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE
      });
    }

    await this.createEmbeddedDocuments('ActiveEffect', [effectData]);
  }

  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
  }

  _prepareCharacterData() {
    const data = this.system;

    data.armor = this.getArmor();
    data.ward = this.getWard();

    const baseDefense = game.settings.get('sdm', 'baseDefense') || BASE_DEFENSE_VALUE;
    const baseMentalDefense = game.settings.get('sdm', 'baseMentalDefense') || BASE_DEFENSE_VALUE;
    const baseSocialDefense = game.settings.get('sdm', 'baseSocialDefense') || BASE_DEFENSE_VALUE;

    const bonusDefense = data.defense_bonus || 0;
    const mentalDefenseBonus = data.mental_defense_bonus || 0;
    const socialDefenseBonus = data.social_defense_bonus || 0;

    // 1. Calcular valores derivados
    const life = data.life;
    life.max = life.base + life.bonus - life.imbued;

    // 3. Processar atributos
    for (const [key, ability] of Object.entries(data.abilities)) {
      ability.full = ability.base + ability.bonus;
    }

    const agility = data.abilities['agi'];
    const thought = data.abilities['tho'];
    const charisma = data.abilities['cha'];

    const calculatedDefense =
      baseDefense + agility.current + agility.bonus + data.armor + bonusDefense;
    const calculatedMentalDefense =
      baseMentalDefense + thought.current + thought.bonus + data.ward + mentalDefenseBonus;
    const calculatedSocialDefense =
      baseSocialDefense + charisma.current + charisma.bonus + data.prestige + socialDefenseBonus;

    data.defense = Math.min(calculatedDefense, MAX_ATTRIBUTE_VALUE);
    data.mental_defense = Math.min(calculatedMentalDefense, MAX_ATTRIBUTE_VALUE);
    data.social_defense = Math.min(calculatedSocialDefense, MAX_ATTRIBUTE_VALUE);

    const { burdenPenalty, items, traits } = this.checkInventorySlots();

    this.update({
      'system.burden_penalty': burdenPenalty,
      'system.item_slots_taken': items.slotsTaken,
      'system.trait_slots_taken': traits.slotsTaken,
      'prototypeToken.actorLink': true,
      'prototypeToken.disposition': 1 // friendly
    });
  }

  _prepareNpcData() {}

  getTotalWeight() {
    switch (this.type) {
      case ActorType.CHARACTER:
        return this.getCarriedGear() + CHARACTER_DEFAULT_WEIGHT_IN_CASH;
      case ActorType.CARAVAN:
        return this.getCarriedGear() + this.getMountRidersWeight();
      case ActorType.NPC:
        return CHARACTER_DEFAULT_WEIGHT_IN_CASH;
      default:
        return 0;
    }
  }

  getAvailableSkills() {
    const result = {};
    const itemsArray = this.items.contents;

    const skillTraits = itemsArray.filter(item => item.type === ItemType.TRAIT);

    skillTraits.forEach(trait => {
      const mod = trait.system.type === TraitType.SKILL && trait.system.skill.modifier_final;
      const modifierStep = trait.system.skill?.modifier_step || 3;

      result[trait.uuid] = {
        id: trait.uuid,
        name: trait.name,
        mod: mod || modifierStep,
        label: `${trait.name}${mod > 0 ? ` (+${mod})` : ''}`
      };
    });
    return result;
  }

  checkInventorySlots() {
    const isNPC = this.type === ActorType.NPC;

    const items = {
      slotsTaken: 0,
      slots: []
    };

    const traits = {
      slotsTaken: 0,
      slots: []
    };

    const burdens = {
      slotsTaken: 0,
      slots: []
    };

    const itemsArray = this.items.contents.sort((a, b) => {
      // First, sort by 'readied' (true first)
      if (a.system.readied !== b.system.readied) {
        return a.system.readied ? -1 : 1;
      }

      // Then, sort by 'sort' value
      return (a.sort || 0) - (b.sort || 0);
    });

    let itemSlotsLimit = this.system.item_slots;
    let traitSlotsLimit = this.system.trait_slots;

    if (isNPC) {
      itemSlotsLimit = 100;
      traitSlotsLimit = 100;
    }

    const burdenPenalTyBonus = this.system.burden_penalty_bonus || 0;
    let powerSlotsBonus = this.system.power_slots_bonus || 0;
    let smallItemBonus = this.system.small_item_slots_bonus || 0;
    let packedItemBonus = this.system.packed_item_slots_bonus || 0;

    // Iterate through items, allocating to containers
    for (let i of itemsArray) {
      const isGear = i.type === ItemType.GEAR;
      const isPower = i.system.type === GearType.POWER;
      const isSmallITem = i.system.size.unit === SizeUnit.SOAPS;
      const isReadied = !!i.system.readied;

      let itemSlots = i.system.slots_taken || 1;

      if (isPower && powerSlotsBonus > 0) {
        powerSlotsBonus -= 1;
        if (itemSlots >= 1) itemSlots -= 1;
      } else if (isGear && isSmallITem && isReadied && smallItemBonus > 0) {
        smallItemBonus -= 1;
        if (itemSlots >= 1) itemSlots -= 1;
      } else if (isGear && !isReadied && packedItemBonus > 0) {
        packedItemBonus -= 1;
        if (itemSlots >= 1) itemSlots -= 1;
      }

      // Append to inventory.
      if (isGear) {
        if (items.slotsTaken + itemSlots <= itemSlotsLimit) {
          items.slots.push(i);
          items.slotsTaken += itemSlots;
        } else {
          burdens.slots.push(i);
          burdens.slotsTaken += itemSlots;
        }
      } else if (i.type === ItemType.TRAIT) {
        if (traits.slotsTaken + itemSlots <= traitSlotsLimit) {
          traits.slots.push(i);
          traits.slotsTaken += itemSlots;
        } else {
          burdens.slots.push(i);
          burdens.slotsTaken += itemSlots;
        }
      } else if (BURDEN_ITEM_TYPES.includes(i.type)) {
        burdens.slots.push(i);
        burdens.slotsTaken += itemSlots;
      }
    }

    const response = {
      items,
      burdens,
      traits,
      burdenPenalty: burdens.slotsTaken + burdenPenalTyBonus
    };

    return response;
  }

  getCarriedGear() {
    const itemsArray = this.items.contents;
    const filteredItems = itemsArray.filter(item => GEAR_ITEM_TYPES.includes(item.type));

    const carriedWeight = filteredItems.reduce((sum, item) => {
      const { size, quantity = 1 } = item.system;
      const { value: sizeValue = 1, unit: sizeUnit = SizeUnit.CASH } = size;
      const weightInCash = convertToCash(sizeValue * quantity, sizeUnit);
      return sum + weightInCash;
    }, 0);

    return carriedWeight;
  }

  getMountRidersWeight() {
    const itemsArray = this.items.contents;
    const filteredMounts = itemsArray.filter(item => item.type === ItemType.MOUNT);
    let totalWeight = 0;

    for (let mount of filteredMounts) {
      for (let rider of mount.riders) {
        const riderActor = fromUuidSync(rider);
        if (!riderActor) continue;

        totalWeight += riderActor.getTotalWeight();
      }
    }

    return totalWeight;
  }

  getMotorPassengersWeight() {
    const itemsArray = this.items.contents;
    const filteredMotor = itemsArray.filter(item => item.type === ItemType.MOTOR);
    let totalWeight = 0;

    for (let motor of filteredMotor) {
      for (let passenger of motor.passengers) {
        const passengerActor = fromUuidSync(passenger);
        if (!passengerActor) continue;

        totalWeight += passengerActor.getTotalWeight();
      }
    }
    return totalWeight;
  }

  getArmor() {
    // Filter for equipped armor items
    const itemsArray = this.items.contents;
    const equippedArmor = itemsArray.filter(
      item =>
        item.type === ItemType.GEAR && item.system.type === GearType.ARMOR && item.system.readied
    );
    const equippedWard = itemsArray.filter(
      item =>
        item.type === ItemType.GEAR && item.system.type === GearType.WARD && item.system.readied
    );

    const equippedArmorValue = equippedArmor.reduce(
      (sum, item) => sum + (item.system.armor.value || 0),
      0
    );
    const equippedWardArmorBonus = equippedWard.reduce(
      (sum, item) => sum + (item.system.ward.armor || 0),
      0
    );
    // Sum the armor values

    const armorBonus = this.system.armor_bonus || 0;

    return equippedArmorValue + equippedWardArmorBonus + armorBonus;
  }

  getWard() {
    const itemsArray = this.items.contents;
    const equippedWard = itemsArray.filter(
      item =>
        item.type === ItemType.GEAR && item.system.type === GearType.WARD && item.system.readied
    );
    const equippedWardValue = equippedWard.reduce(
      (sum, item) => sum + (item.system.ward.value || 0),
      0
    );

    const wardBonus = this.system.ward_bonus || 0;

    return equippedWardValue + wardBonus;
  }

  getCaracanCapacity() {
    if (this.type !== 'caravan') {
      return;
    }

    const itemsArray = this.items.contents.filter(
      item => item.type === ItemType.MOTOR || item.type === ItemType.MOUNT
    );

    const carryCapacity = itemsArray.reduce((acc, item) => {
      return acc + item.getCarryCapacity();
    }, 0);

    return carryCapacity;
  }

  /**
   * @override
   * Augment the actor source data with additional dynamic data that isn't
   * handled by the actor's DataModel. Data calculated in this step should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    super.prepareDerivedData();
    if (this.type === ActorType.CHARACTER) this._prepareCharacterData();
    if (this.type === ActorType.NPC) this._prepareNpcData();
  }

  /**
   *
   * @override
   * Augment the actor's default getRollData() method by appending the data object
   * generated by the its DataModel's getRollData(), or null. This polymorphic
   * approach is useful when you have actors & items that share a parent Document,
   * but have slightly different data preparation needs.
   */
  getRollData() {
    return { ...super.getRollData(), ...(this.system.getRollData?.() ?? null) };
  }

  async updateHeroDice(usedHeroDice = 0) {
    if (!usedHeroDice) return;

    const current = Math.max(0, this.system.hero_dice?.value || 0);
    const newHeroDiceValue = Math.max(current - usedHeroDice, 0);
    await this.update({
      'system.hero_dice.value': newHeroDiceValue
    });
  }

  async applyDamage(damageValue = 0, multiplier = 1) {
    const { value, max } = this.system.life;

    if (!damageValue || !Number.isNumeric(damageValue)) return;

    const amountToApply = damageValue * multiplier;
    const newValue = Math.clamp(value - amountToApply, 0, max);
     await this.update({
      'system.life.value': newValue,
    });
  }
}
