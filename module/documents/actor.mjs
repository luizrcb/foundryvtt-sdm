import {
  BASE_DEFENSE_VALUE,
  MAX_ATTRIBUTE_VALUE,
  getMaxLife,
  getLevel,
  CHARACTER_DEFAULT_WEIGHT_IN_CASH,
} from '../helpers/actorUtils.mjs';
import { ActorType, ItemType, SizeUnit } from '../helpers/constants.mjs';
import { convertToCash, GEAR_ITEM_TYPES } from '../helpers/itemUtils.mjs';

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class SdmActor extends Actor {

  // Override the _onUpdate method to handle level changes
  /** @override */
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);

    if (changed.system?.player_experience !== undefined) {
      let resultingExperience = eval(`${changed.system?.player_experience}`.trim());
      resultingExperience = parseInt(resultingExperience, 10);
       await this.update({
        "system.player_experience": `${resultingExperience}`,
      });
    }

    if (changed.system?.experience !== undefined) {
      //TODO: add a better library to safely evaluate expressions

      // TODO: let's add the additional life to max and current values, but taking bonuses into account
      let resultingExperience = eval(`${changed.system?.experience}`.trim());
      resultingExperience = parseInt(resultingExperience, 10);
      const newLevel = getLevel(resultingExperience);
      const maxLife = getMaxLife(newLevel);
      const currentLostLife = this.system.life.max - this.system.life.value; // Preserve lost health
      const remainingLife = maxLife - currentLostLife;
      await this.update({
        "system.experience": `${resultingExperience}`,
        "system.level": newLevel,
        "system.heroics.max": Math.max(newLevel, 1),
        "system.life.max": maxLife,
        "system.life.value": remainingLife < 1 ? 1 : remainingLife, // Cap current health
      });
    }

    if (changed.system?.abilities) {
      const abilities = changed.system.abilities;

      // Iterate over updated abilities
      for (const [abilityKey, abilityData] of Object.entries(abilities)) {
        const currentEnhanced = abilityData.enhanced ?? this.system.abilities[abilityKey]?.enhanced ?? false;
        const max = currentEnhanced ? 7 : 5;

        // Clamp "full" to the current max
        if (abilityData.full !== undefined) {
          abilityData.full = Math.min(abilityData.full, max);
          if (this.system.abilities[abilityKey].current === 0) {
            abilityData.current = abilityData.full;
          }
        }

        if (abilityData.current !== undefined && abilityData.current !== null) {
          const currentMax = Math.min(this.system.abilities[abilityKey].full, max);
          const currentMin = Math.max(abilityData.current, 0);
          abilityData.current = Math.min(currentMin, currentMax);
        }

        await this.update({
          [`system.abilities.${abilityKey}`]: {
            ...this.system.abilities[abilityKey],
            ...abilityData
          },
        });
      }
    }

    // if (changed.system?.fatigue?.halfSpeed) {
    //   const halfSpeed = changed?.system.fatigue.halfSpeed;
    //   if (halfSpeed === true) {
    //     await this.addFatigueSlow();
    //   } else {
    //     const fatigueSlowEffec = actor.effects.getName('slow (fatigue)');
    //     await fatigueSlowEffec.delete();
    //   }
    // }

    // if (changed.system?.fatigue?.halfLife) {
    //   const halfLife = changed?.system.fatigue.halfLife;
    //   if (halfLife === true) {
    //     await this.addFatigueHalfLife();
    //   } else {
    //     const fatigueHalfLifeEffect = actor.effects.getName('half life (fatigue)');
    //     await fatigueHalfLifeEffect.delete();
    //   }
    // }
  }

  // Helper: Create encumbered effect
  async addEncumberedEffect() {
    const effectData = {
      name: "encumbered",
      label: "encumbered",
      icon: "icons/tools/smithing/anvil.webp",
      changes: [],
      flags: {
        sdm: {
          effectType: "encumbered",
          source: "encumbrance"
        }
      }
    };
    await this.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }

  async addCumbersomeArmor() {
    const effectData = {
      name: "cumbersome (armor)",
      label: "cumbersome (armor)",
      icon: "icons/equipment/chest/breastplate-banded-steel.webp",
      changes: [],
      flags: {
        sdm: {
          effectType: "encumbered",
          source: "armor"
        }
      }
    };
    await this.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }

  async addEncumberedSlow() {
    const effectData = {
      name: "slow (encumbered)", // Descriptive label
      label: "slow (encumbered)", // Descriptive label
      icon: "icons/creatures/invertebrates/snail-movement-green.webp",
      changes: [],
      flags: {
        sdm: {
          effectType: "slow",
          source: "encumbrance"
        }
      }
    };
    await this.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }

  // Add fatigue slow
  async addFatigueSlow() {
    const effectData = {
      name: "slow (fatigue)", // Descriptive label
      label: "slow (fatigue)", // Descriptive label
      icon: "icons/creatures/invertebrates/snail-movement-green.webp",
      changes: [],
      flags: {
        sdm: {
          effectType: "slow",
          source: "fatigue"
        }
      }
    };
    await this.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }

  async addFatigueHalfLife() {
    // In your effect creation code
    const actorMaxLife = this.system.life.max; // Fetch directly from actor data
    const actorCurrentLife = this.system.life.value;
    const halfMaxLife = Math.floor(actorMaxLife * 0.5);

    const effectData = {
      name: "half life (fatigue)",
      label: "half life (fatigue)",
      icon: "icons/svg/skull.svg",
      changes: [{
        key: "system.life.max",
        value: halfMaxLife.toString(), // Ensure value is a string
        mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE
      },
      ],
      flags: {
        sdm: {
          effectType: "halfLife",
          source: "fatigue"
        }
      }
    };

    if (actorCurrentLife > halfMaxLife) {
      effectData.changes.push({
        key: "system.life.value",
        value: halfMaxLife.toString(), // Ensure value is a string
        mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE
      })
    }

    await this.createEmbeddedDocuments("ActiveEffect", [effectData]);
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
    // if (this.type === ActorType.NPC) this._prepareNpcData();
    // if (this.type === ActorType.CARAVAN) this._prepareCharavanData();
  }

  _prepareCharacterData() {
    const data = this.system;

    data.armor = this.getArmor();
    const baseDefense = game.settings.get("sdm", "baseDefense");
    const bonusDefense = data.defense_bonus || 0;
    const BASE_DEFENSE = baseDefense || BASE_DEFENSE_VALUE;
    const agility = data.abilities['agi'];
    const calculatedDefense = BASE_DEFENSE + agility.current + agility.bonus + data.armor + bonusDefense;
    data.defense = Math.min(calculatedDefense, MAX_ATTRIBUTE_VALUE);

    this.update({
      "prototypeToken.actorLink": true,
      "prototypeToken.disposition": 1, // friendly

    });
  }


  getTotalWeight() {
    switch (this.type) {
      case ActorType.CHARACTER:
        return this.getCarriedGear() + CHARACTER_DEFAULT_WEIGHT_IN_CASH;
      case ActorType.CARAVAN:
        return (this.getCarriedGear() + this.getMountRidersWeight());
      case ActorType.NPC:
        return CHARACTER_DEFAULT_WEIGHT_IN_CASH;
      default:
        return 0;
    }
  }

  getCarriedGear() {
    const itemsArray = this.items.contents;
    const filteredItems = itemsArray.filter((item) => GEAR_ITEM_TYPES.includes(item.type));

    const carriedWeight = filteredItems.reduce(
      (sum, item) => {
        const { size, quantity = 1 } = item.system;
        const { value: sizeValue = 1, unit: sizeUnit = SizeUnit.CASH } = size;
        const weightInCash = convertToCash(sizeValue * quantity, sizeUnit);
        return sum + weightInCash;
      }, 0);

    return carriedWeight;
  }

  getMountRidersWeight() {
    const itemsArray = this.items.contents;
    const filteredMounts = itemsArray.filter((item) => item.type === ItemType.MOUNT);
    let totalWeight = 0;

    for (let mount of filteredMounts) {
      for (let rider of mount.riders) {
        const riderActor = fromUuidSync(rider);
        if (!riderActor) continue;

        totalWeight += riderActor.getTotalWeight()
      }
    }

    return totalWeight;
  }


  getMotorPassengersWeight() {
    const itemsArray = this.items.contents;
    const filteredMotor = itemsArray.filter((item) => item.type === ItemType.MOTOR);
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
    const equippedArmor = itemsArray.filter(item => item.type === ItemType.ARMOR && item.system.readied);

    // Sum the armor values
    return equippedArmor.reduce((sum, item) => sum + (item.system.armor || 0), 0);
  }

  getCaracanCapacity() {
    if (this.type !== 'caravan') {
      return;
    }

    const itemsArray = this.items.contents.filter(item => item.type === ItemType.MOTOR || item.type === ItemType.MOUNT);

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

  async updateHeroicDice(usedHeroicDice = 0) {
    if (!usedHeroicDice) return;

    const current = Math.max(0, this.system.heroics?.value || 0);
    const newHeroicsValue = Math.max(current - usedHeroicDice, 0);
    await this.update({
      'system.heroics.value': newHeroicsValue,
    });
  }
}
