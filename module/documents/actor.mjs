import {
  BASE_DEFENSE_VALUE,
  MAX_ATTRIBUTE_VALUE,
  getMaxLife,
  getLevel,
  CHARACTER_DEFAULT_WEIGHT_IN_CASH
} from '../helpers/actorUtils.mjs';
import { ActorType, GearType, ItemType, SizeUnit, TraitType } from '../helpers/constants.mjs';
import { safeEvaluate } from '../helpers/globalUtils.mjs';
import {
  BURDEN_ITEM_TYPES,
  convertToCash,
  GEAR_ITEM_TYPES,
  getSlotsTaken
} from '../helpers/itemUtils.mjs';

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class SdmActor extends Actor {
  // Override the _onUpdate method to handle level changes
  /** @override */
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);
    const shouldPlayLevelUpSound = game.settings.get('sdm', 'shouldPlayLevelUpSoundFx');
    const levelUpSoundFx = game.settings.get('sdm', 'levelUpSoundFx');
    const properties = ['player_experience', 'debt', 'wealth', 'revenue', 'expense', 'experience'];
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

      if (shouldPlayLevelUpSound && newLevel > this.system.level) {
        foundry.audio.AudioHelper.play(
          {
            src: levelUpSoundFx,
            volume: 1,
            autoplay: true,
            loop: false
          },
          true
        );
      }

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
          'system.life.value': this.system.life.max
        });
      }
    }

    if (changed.system?.abilities) {
      const abilities = changed.system.abilities;

      // Iterate over updated abilities
      for (const [abilityKey, abilityData] of Object.entries(abilities)) {
        const systemAbility = this.system.abilities[abilityKey];
        if (abilityData.current !== undefined) {
          if (abilityData.current > systemAbility.base + systemAbility.bonus) {
            abilityData.current = systemAbility.base + systemAbility.bonus;
          }

          if (abilityData.current < 0) {
            abilityData.current = 0;
          }

          await this.update({
            [`system.abilities.${abilityKey}.current`]: abilityData.current
          });
        }

        if (abilityData.base !== undefined) {
          const updateData = {
            [`system.abilities.${abilityKey}.base`]: abilityData.base
          };

          if (abilityData.base + systemAbility.bonus < systemAbility.current) {
            abilityData.current = abilityData.base + systemAbility.bonus;
            updateData[`system.abilities.${abilityKey}.current`] = abilityData.current;
          }

          await this.update(updateData);
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

    const calculatedDefense = baseDefense + agility.current + data.armor + bonusDefense;
    const calculatedMentalDefense =
      baseMentalDefense + thought.current + data.ward + mentalDefenseBonus;
    const calculatedSocialDefense =
      baseSocialDefense + charisma.current + data.prestige + socialDefenseBonus;

    data.defense = Math.min(calculatedDefense, MAX_ATTRIBUTE_VALUE);
    data.mental_defense = Math.min(calculatedMentalDefense, MAX_ATTRIBUTE_VALUE);
    data.social_defense = Math.min(calculatedSocialDefense, MAX_ATTRIBUTE_VALUE);

    const estimatedWealth = this.getEstimatedWealth();

    const totalCash = this.getTotalCash();

    const { burdenPenalty, items, traits } = this.checkInventorySlots();

    this.update({
      'system.burden_penalty': burdenPenalty || 0,
      'system.item_slots_taken': items.slotsTaken,
      'system.trait_slots_taken': traits.slotsTaken,
      'system.packed_item_slots_taken': items.packedTaken,
      'system.inventory_value': estimatedWealth,
      'system.total_cash': totalCash,
      'system.wealth': totalCash + estimatedWealth
    });
  }

  _prepareCaravanData() {
    const estimatedWealth = this.getEstimatedWealth();
    const totalCash = this.getTotalCash();

    const currentCarriedWeight = this.getCarriedGear();
    const totalCapacityInSacks = this.system.capacity + this.system.capacity_bonus;

    const maxCarryWeight = convertToCash(totalCapacityInSacks, SizeUnit.SACKS);
    const overloaded = currentCarriedWeight > maxCarryWeight;

    this.update({
      'system.inventory_value': estimatedWealth,
      'system.total_cash': totalCash,
      'system.wealth': totalCash + estimatedWealth,
      'system.overloaded': overloaded
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

  canAddHallmarkItem() {
    if (this.type !== ActorType.CHARACTER) {
      return true;
    }

    const itemsArray = this.items.contents;
    const hallmarkItems = itemsArray.filter(item => item.system.is_hallmark);

    return hallmarkItems.length < this.system.level;
  }

  getAvailableSkills() {
    const result = {};
    const itemsArray = this.items.contents;

    const skillTraits = itemsArray.filter(item => item.type === ItemType.TRAIT);
    const defaultModifierStep = game.settings.get('sdm', 'skillModifierStep');
    skillTraits.forEach(trait => {
      const mod = trait.system.type === TraitType.SKILL && trait.system.skill.modifier_final;
      const modifierStep = defaultModifierStep || trait.system.skill?.modifier_step || 3;

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
      packedTaken: 0,
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
    let weaponItemBonus = this.system.weapon_item_slots_bonus || 0;
    let packedItemBonus = this.system.packed_item_slots_bonus || 0;

    // Iterate through items, allocating to containers
    for (let i of itemsArray) {
      const isGear = i.type === ItemType.GEAR;
      const isPower = i.system.type === GearType.POWER;
      const isWeapon = i.system.type === GearType.WEAPON;
      const isSmallITem = i.system.size.unit === SizeUnit.SOAPS;
      const isReadied = !!i.system.readied;

      let itemSlots = getSlotsTaken(i.system);

      if (isPower && powerSlotsBonus > 0) {
        powerSlotsBonus -= 1;
        // if (itemSlots >= 1) itemSlots -= 1;
        itemSlots = 0;
      } else if (isGear && isWeapon && weaponItemBonus > 0) {
        weaponItemBonus -= 1;
        itemSlots = 0;
      } else if (isGear && isSmallITem && isReadied && smallItemBonus > 0) {
        smallItemBonus -= 1;
        // if (itemSlots >= 1) itemSlots -= 1;
        itemSlots = 0;
      } else if (isGear && !isReadied && packedItemBonus > 0 && packedItemBonus >= itemSlots) {
        packedItemBonus -= itemSlots || 1;
        items.packedTaken += itemSlots || 1;
        itemSlots = 0;
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

  getVehiclePassengersWeight() {
    const itemsArray = this.items.contents;
    const filteredVehicle = itemsArray.filter(item => item.type === ItemType.VEHICLE);
    let totalWeight = 0;

    for (let vehicle of filteredVehicle) {
      for (let passenger of vehicle.passengers) {
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

  getCaravanCapacity() {
    if (this.type !== ActorType.CARAVAN) {
      return;
    }

    const totalCapacityInSacks = this.system.capacity + this.system.capacity_bonus;
    const maxCarryWeight = convertToCash(totalCapacityInSacks, SizeUnit.SACKS);

    return carryCapacity;
  }

  getEstimatedWealth() {
    const itemsArray = this.items.contents.filter(
      item => [ItemType.GEAR].includes(item.type) && item.system.size.unit !== SizeUnit.CASH
    );

    const estimatedWealth = itemsArray.reduce((acc, item) => {
      return acc + (item?.system?.cost || 0) * (item?.system.quantity || 1);
    }, 0);

    return estimatedWealth;
  }

  getTotalCash() {
    const itemsArray = this.items.contents.filter(item => item.system.size.unit === SizeUnit.CASH);

    const totalCash = itemsArray.reduce((acc, item) => {
      return acc + (item.system.size.value || 1) * item.system.quantity;
    }, 0);

    return totalCash;
  }

  _getItemListContextOptions() {
    return [
      {
        name: 'SDM.Item.View',
        icon: '<i class="fa-solid fa-fw fa-eye"></i>',
        callback: async target => {
          const document = this.sheet._getEmbeddedDocument(target);
          await document.sheet.render({ force: true });
        }
      },
      {
        name: 'SDM.Item.Repair',
        icon: '<i class="fa-solid fa-hammer"></i>',
        condition: target => {
          const item = this.sheet._getEmbeddedDocument(target);
          if (item.system.size.unit === 'cash' || item.type === 'burden') return false;
          if (item.type === 'trait' && item.system.type !== 'power') return false;
          return this.isOwner && item.system.status !== '';
        },
        callback: async target => {
          const item = this.sheet._getEmbeddedDocument(target);
          await item.toggleItemStatus('repair');
        }
      },
      {
        name: 'SDM.Item.Notched',
        icon: '<i class="fa-solid fa-circle-dot"></i>',
        condition: target => {
          const item = this.sheet._getEmbeddedDocument(target);
          if (item.system.size.unit === 'cash' || item.type === 'burden') return false;
          if (item.type === 'trait' && item.system.type !== 'power') return false;
          return this.isOwner && item.system.status === '';
        },
        callback: async target => {
          const item = this.sheet._getEmbeddedDocument(target);
          await item.toggleItemStatus();
        }
      },
      {
        name: 'SDM.Item.Broken',
        icon: '<i class="fa-solid fa-ban"></i>',
        condition: target => {
          const item = this.sheet._getEmbeddedDocument(target);
          if (item.system.size.unit === 'cash' || item.type === 'burden') return false;
          if (item.type === 'trait' && item.system.type !== 'power') return false;
          return this.isOwner && item.system.status === 'notched';
        },
        callback: async target => {
          const item = this.sheet._getEmbeddedDocument(target);
          await item.toggleItemStatus();
        }
      },
      {
        name: 'SDM.Item.Share',
        icon: '<i class="fa-solid fa-fw fa-share-from-square"></i>',
        callback: async target => {
          const item = this.sheet._getEmbeddedDocument(target);
          await item.sendToChat({ actor: this, collapsed: false });
        }
      },
      {
        name: 'SDM.Item.Delete',
        icon: '<i class="fa-solid fa-fw fa-trash"></i>',
        condition: () => this.isOwner,
        callback: async target => {
          const document = this.sheet._getEmbeddedDocument(target);
          //await this._deleteDoc.call(this, null, target);
          if (document.hasGrantedItems) await document.advancementDeletionPrompt();
          else await document.deleteDialog();
        }
      }
    ];
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
    if (this.type === ActorType.CARAVAN) this._prepareCaravanData();
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
      'system.life.value': newValue
    });
  }
}
