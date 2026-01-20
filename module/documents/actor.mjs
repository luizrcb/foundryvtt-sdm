import {
  BASE_DEFENSE_VALUE,
  CHARACTER_DEFAULT_WEIGHT_IN_CASH,
  getLevel,
  getMaxLife,
  MAX_ATTRIBUTE_VALUE,
  postConsumeSupplies,
  postLifeChange
} from '../helpers/actorUtils.mjs';
import {
  ActorType, DEFAULT_CARAVAN_ICON, DEFAULT_CHARACTER_ICON,
  DEFAULT_NPC_ICON, GearType, ItemType, SizeUnit, TraitType
} from '../helpers/constants.mjs';
import { $l10n, capitalizeFirstLetter, safeEvaluate } from '../helpers/globalUtils.mjs';
import {
  BURDEN_ITEM_TYPES,
  checkIfItemIsAlsoAnArmor,
  convertToCash,
  GEAR_ITEM_TYPES,
  getSlotsTaken
} from '../helpers/itemUtils.mjs';
import { mergeSimilarItems, splitStackIntoTwo } from '../helpers/stackUtils.mjs';
import { templatePath } from '../helpers/templates.mjs';
import { promptSplitStackFirstQty } from '../items/splitDialog.mjs';
import { postDiceSummary } from '../macros/gm/giveHeroDice.mjs';

const { renderTemplate } = foundry.applications.handlebars;
const { DialogV2 } = foundry.applications.api;

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class SdmActor extends Actor {
  static getDefaultArtwork(actorData) {
    let icon = DEFAULT_CHARACTER_ICON;

    if (actorData.type === ActorType.NPC) {
      icon = DEFAULT_NPC_ICON;
    }

    if (actorData.type === ActorType.CARAVAN) {
      icon = DEFAULT_CARAVAN_ICON;
    }

    return { img: icon, texture: { src: icon } };
  }

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

    if (changed.name !== undefined) {
      await this.update({ 'prototypeToken.name': changed.name });
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
      const maxBloodDice = Math.max(newLevel + this.system.blood_dice.bonus, 1);
      const currentHeroDiceSpent = this.system.hero_dice.max - this.system.hero_dice.value;
      const remainingHeroDice = maxHeroDice - currentHeroDiceSpent;

      await this.update({
        'system.experience': `${resultingExperience.toString()}`,
        'system.level': newLevel,
        'system.hero_dice.max': Math.max(maxHeroDice, 1),
        'system.hero_dice.value': Math.min(remainingHeroDice, maxHeroDice),
        'system.blood_dice.max': Math.max(maxBloodDice, 1),
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

    if (changed.system?.borrowed_life?.value !== undefined) {
      if (changed.system?.borrowed_life?.value > this.system.borrowed_life.max) {
        await this.update({
          'system.borrowed_life.value': this.system.borrowed_life.max
        });
      }
    }

    if (changed.system?.temporary_life?.value !== undefined) {
      if (changed.system?.temporary_life?.value > this.system.temporary_life.max) {
        await this.update({
          'system.temporary_life.value': this.system.borrowed_life.max
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

    const borrowed = data.borrowed_life;
    if (borrowed.max_limit > 0) {
      borrowed.max = borrowed.max_limit;
    } else {
      borrowed.max = life.base + life.bonus;
    }

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

    if (!this.id) {
      return;
    }

    this.update({
      'system.burden_penalty': burdenPenalty || 0,
      'system.item_slots_taken': items.slotsTaken,
      'system.trait_slots_taken': traits.slotsTaken,
      'system.packed_item_slots_taken': items.packedTaken,
      'system.inventory_value': estimatedWealth,
      'system.total_cash': totalCash,
      'system.wealth': totalCash + estimatedWealth,
      _id: this.id
    });
  }

  _prepareCaravanData() {
    const estimatedWealth = this.getEstimatedWealth();
    const totalCash = this.getTotalCash();

    const currentCarriedWeight = this.getCarriedGear();
    const totalCapacityInSacks = this.system.capacity + this.system.capacity_bonus;

    const maxCarryWeight = convertToCash(totalCapacityInSacks, SizeUnit.SACKS);
    const overloaded = currentCarriedWeight > maxCarryWeight;

    if (!this.id) {
      return;
    }

    let updateData = {
      'system.inventory_value': estimatedWealth,
      'system.total_cash': totalCash,
      'system.wealth': totalCash + estimatedWealth,
      'system.overloaded': overloaded,
      _id: this.id
    };

    this.update(updateData);
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

    const skillTraits = itemsArray.filter(
      item =>
        item.type === ItemType.TRAIT &&
        (!item.system?.learning ||
          item.system?.learning?.required_successes === 0 ||
          item.system?.skill?.rank > 0 ||
          item.system?.learning?.required_successes === item.system?.learning?.sources)
    );
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

  getAllEffects() {
    let effects = Array.from(this.effects);

    const items = Array.from(this.items.filter(it => ['gear', 'trait'].includes(it.type)));
    items.forEach(item => {
      const _eff = Array.from(item.effects);
      if (_eff.length > 0) {
        const mergedEffects = [...new Set([...effects, ..._eff])];
        effects = mergedEffects;
      }
    });

    return effects;
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
    let readiedItemBonus = this.system.readied_item_slots_bonus || 0;
    const readiedArmorTakeNoSlots = !!this.system.readied_armor_take_no_slots;

    // Iterate through items, allocating to containers
    for (let i of itemsArray) {
      const isGear = i.type === ItemType.GEAR;
      const isPower = i.system.type === GearType.POWER;
      const isWeapon = i.system.type === GearType.WEAPON;
      const isWard = i.system.type === GearType.WARD;
      const isArmor = i.system.type === GearType.ARMOR;
      const isSmallITem = i.system.size.unit === SizeUnit.SOAPS;
      const isReadied = !!i.system.readied;

      let itemSlots = getSlotsTaken(i.system);

      if (isArmor && isReadied && readiedArmorTakeNoSlots) {
        itemSlots = 0;
      } else if (
        (isWeapon || isWard) &&
        isReadied &&
        readiedArmorTakeNoSlots &&
        !!checkIfItemIsAlsoAnArmor(i)
      ) {
        itemSlots = 0;
      } else if (isPower && powerSlotsBonus > 0) {
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
      } else if (isReadied && readiedItemBonus > 0 && itemSlots === 1) {
        readiedItemBonus -= 1;
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

  async consumeSupplies() {
    if (this.type !== ActorType.CARAVAN) {
      return;
    }

    const itemsArray = this.items.contents;

    const supplyItems = itemsArray.filter(
      item => item.type === ItemType.GEAR && item.system.type === '' && item.system.is_supply
    );

    const animalSupplies = supplyItems.filter(item => item.system.supply_type === 'animal');
    const humanSupplies = supplyItems.filter(item => item.system.supply_type === 'human');
    const machineSupplies = supplyItems.filter(item => item.system.supply_type === 'machine');
    const undeadSupplies = supplyItems.filter(item => item.system.supply_type === 'undead');

    const totalAnimalSupplies = animalSupplies.reduce((acc, item) => {
      return acc + item.system.quantity;
    }, 0);

    const totalHumanSupplies = humanSupplies.reduce((acc, item) => {
      return acc + item.system.quantity;
    }, 0);

    const totalMachineSupplies = machineSupplies.reduce((acc, item) => {
      return acc + item.system.quantity;
    }, 0);

    const totalUndeadSupplies = undeadSupplies.reduce((acc, item) => {
      return acc + item.system.quantity;
    }, 0);

    const templateData = {
      totalAnimalSupplies,
      totalHumanSupplies,
      totalMachineSupplies,
      totalUndeadSupplies,
      weeklySupply: this.system.supply
    };

    const data = await DialogV2.wait({
      window: { title: game.i18n.localize('SDM.ConsumeSupply') },
      position: {
        width: 820,
        height: 370
      },
      content: await renderTemplate(
        templatePath('/actor/caravan/consume-supply-dialog'),
        templateData
      ),
      buttons: [
        {
          action: 'ok',
          label: game.i18n.localize('SDM.ConsumeSupply'),
          icon: 'fa-solid fa-sack-xmark',
          callback: (event, button) =>
            new foundry.applications.ux.FormDataExtended(button.form).object
        },
        { action: 'cancel', label: game.i18n.localize('SDM.BackgroundCancel') }
      ],
      rejectClose: false
    });

    if (!data) return;
    // Parse requested amounts (clamp to >= 0, integers)
    const animalToConsume = Math.max(0, parseInt(data.consumeAnimal, 10) || 0);
    const humanToConsume = Math.max(0, parseInt(data.consumeHuman, 10) || 0);
    const machineToConsume = Math.max(0, parseInt(data.consumeMachine, 10) || 0);
    const undeadToConsume = Math.max(0, parseInt(data.consumeUndead, 10) || 0);

    if (animalToConsume === 0 && humanToConsume === 0 && machineToConsume === 0 && undeadToConsume)
      return;

    // Sort by cost asc (undefined -> 0)
    const byCostAsc = (a, b) => Number(a.system?.cost ?? 0) - Number(b.system?.cost ?? 0);

    const animalSorted = animalSupplies.slice().sort(byCostAsc);
    const humanSorted = humanSupplies.slice().sort(byCostAsc);
    const machineSorted = machineSupplies.slice().sort(byCostAsc);
    const undeadSorted = undeadSupplies.slice().sort(byCostAsc);

    const updates = [];
    const deletions = [];

    // Aggregate tracker: key = `${name}|||${img}`
    const consumedMap = new Map();

    // Effects buffer to batch-create on actor
    const effectsToCreate = [];

    /**
     * Clone an ActiveEffect from an item and adapt it for the actor.
     * - clears _id
     * - sets origin to the actor
     * - disables transfer (we're placing it directly on actor)
     * - ensures a readable name
     */
    function makeActorEffectData(effectDoc, itemName) {
      const data = effectDoc.toObject();
      delete data._id;
      data.origin = this.uuid; // actor origin
      data.transfer = false; // ensure it's actor-owned, not transferred
      data.disabled = false; // apply enabled
      if (!data.name) data.name = itemName;
      return data;
    }

    /**
     * Consume `amount` units across `items` (sorted by cost asc).
     * Also clones item Active Effects to the actor: one copy per unit consumed.
     */
    function consumeFromItems(items, amount) {
      let remaining = amount;
      if (remaining <= 0 || !items.length) return 0;

      for (const it of items) {
        if (remaining <= 0) break;

        const qty = Math.max(0, Number(it.system?.quantity ?? 0));
        if (qty <= 0) continue;

        const take = Math.min(qty, remaining);
        if (take <= 0) continue;

        const newQty = qty - take;

        // Queue update/delete
        if (newQty > 0) {
          updates.push({ _id: it.id, system: { quantity: newQty } });
        } else {
          deletions.push(it.id);
        }

        // Aggregate consumed summary
        const key = `${it.name}|||${it.img ?? ''}`;
        const prev = consumedMap.get(key);
        consumedMap.set(key, {
          name: it.name,
          img: it.img ?? '',
          quantity: (prev?.quantity || 0) + take
        });

        // Copy the item's active effects to the actor (one per unit consumed)
        const itemEffects = it.effects?.contents ?? [];
        if (itemEffects.length) {
          for (let n = 0; n < take; n++) {
            for (const ef of itemEffects) {
              effectsToCreate.push(makeActorEffectData.call(this, ef, it.name));
            }
          }
        }

        remaining -= take;
      }

      return amount - remaining; // actually consumed
    }

    // Consume per category (cost-ascending)
    consumeFromItems.call(this, animalSorted, animalToConsume);
    consumeFromItems.call(this, humanSorted, humanToConsume);
    consumeFromItems.call(this, machineSorted, machineToConsume);
    consumeFromItems.call(this, undeadSorted, undeadToConsume);

    // Apply item updates/deletions in batches
    if (updates.length) await this.updateEmbeddedDocuments('Item', updates);
    if (deletions.length) await this.deleteEmbeddedDocuments('Item', deletions);

    // Create all copied Active Effects on the actor in one batch
    if (effectsToCreate.length) {
      await this.createEmbeddedDocuments('ActiveEffect', effectsToCreate);
    }

    // Build a final array you can log/use for chat, etc.
    const consumedSummary = Array.from(consumedMap.values());

    if (!consumedSummary.length) return;

    await postConsumeSupplies(this, consumedSummary);
  }

  /**
   * Consume 1 unit from an item on this actor.
   * - Decrements system.quantity by 1 (if stackable); if it reaches 0 (or item is non-stackable), deletes the item.
   * - Copies all Active Effects from the item to the actor (enabled, non-transfer, origin set).
   *
   * @param {Item} item - The item document belonging to this actor.
   */
  async consumeSupply(item) {
    if (!item || item.parent !== this) return;

    // 1) Prepare actor-owned effects cloned from the item
    const effectsToCreate = [];
    const itemEffects = item.effects?.contents ?? [];
    for (const ef of itemEffects) {
      const data = ef.toObject();
      delete data._id;
      // Prefer item as origin (so you can trace where it came from)
      data.origin = item.uuid ?? this.uuid;
      data.transfer = false; // place directly on actor
      data.disabled = false; // apply enabled
      // Optional provenance:
      // data.flags = foundry.utils.mergeObject({ sdm: { sourceItemId: item.id } }, data.flags || {}, { inplace: false });
      effectsToCreate.push(data);
    }

    // 2) Apply effects first (so even if the item is deleted, the effects still land)
    if (effectsToCreate.length) {
      await this.createEmbeddedDocuments('ActiveEffect', effectsToCreate);
    }

    // 3) Decrement quantity or delete the item
    const hasStacks = Number.isFinite(Number(item.system?.quantity));
    const currentQty = hasStacks ? Number(item.system.quantity) : 1;
    const newQty = hasStacks ? Math.max(0, currentQty - 1) : 0;

    if (hasStacks && newQty > 0) {
      await this.updateEmbeddedDocuments('Item', [{ _id: item.id, system: { quantity: newQty } }]);
    } else {
      await this.deleteEmbeddedDocuments('Item', [item.id]);
    }
  }

  _getItemListContextOptions() {
    return [
      {
        name: 'SDM.Item.View',
        icon: '<i class="fa-solid fa-eye"></i>',
        callback: async target => {
          const document = this.sheet._getEmbeddedDocument(target);
          await document.sheet.render({ force: true });
        }
      },
      {
        name: 'SDM.Item.SplitItems',
        icon: '<i class="fa-solid fa-arrows-split-up-and-left"></i>',
        condition: target => {
          const item = this.sheet._getEmbeddedDocument(target);
          return item.type === ItemType.GEAR && item.parent && item.system.quantity > 1;
        },
        callback: async target => {
          const item = this.sheet._getEmbeddedDocument(target);
          const firstQty = await promptSplitStackFirstQty(item);
          if (firstQty == null) return; // user canceled
          await splitStackIntoTwo(item, firstQty);
        }
      },
      {
        name: 'SDM.Item.MergeItems',
        icon: '<i class="fa-solid fa-code-merge"></i>',
        condition: target => {
          const item = this.sheet._getEmbeddedDocument(target);
          return item.type === ItemType.GEAR && item.parent && this.canMergeItem(item);
        },
        callback: async target => {
          const item = this.sheet._getEmbeddedDocument(target);
          await mergeSimilarItems(item);
        }
      },
      {
        name: 'SDM.Item.ConsumeSupply',
        icon: '<i class="fa-solid fa-sack-xmark"></i>',
        condition: target => {
          const item = this.sheet._getEmbeddedDocument(target);
          return (
            item.type === ItemType.GEAR &&
            !item.system.type &&
            item.system.is_supply &&
            item.parent &&
            item.parent?.type === ActorType.CARAVAN
          );
        },
        callback: async target => {
          const item = this.sheet._getEmbeddedDocument(target);
          await this.consumeSupply(item);
        }
      },
      {
        name: 'SDM.Item.Unpack',
        icon: '<i class="fa-solid fa-box-archive"></i>',
        condition: target => {
          const item = this.sheet._getEmbeddedDocument(target);
          return (
            item.type === ItemType.GEAR &&
            !item.system.type &&
            item.system.starting_kit &&
            item.system.packed_remaining_items > 0 &&
            item.system.status !== 'broken'
          );
        },
        callback: async target => {
          await this.sheet.unpackStartingKitItem(target);
        }
      },
       {
        name: 'SDM.Item.AddOneCharge',
        icon: '<i class="fa-solid fa-circle-plus"></i>',
        condition: target => {
          const item = this.sheet._getEmbeddedDocument(target);
          if (item.system.charges.max === 0) return false;
          return this.isOwner && (item.system.charges.value < item.system.charges.max);
        },
        callback: async target => {
          const item = this.sheet._getEmbeddedDocument(target);
          await item.updateCurrentCharges(1);
        }
      },
       {
        name: 'SDM.Item.RemoveOneCharge',
        icon: '<i class="fa-solid fa-circle-minus"></i>',
        condition: target => {
          const item = this.sheet._getEmbeddedDocument(target);
          if (item.system.charges.max === 0) return false;
          return this.isOwner && (item.system.charges.value > 0);
        },
        callback: async target => {
          const item = this.sheet._getEmbeddedDocument(target);
          await item.updateCurrentCharges(-1);
        }
      },
      {
        name: 'SDM.Item.Recharge',
        icon: '<i class="fa-solid fa-battery-full"></i>',
        condition: target => {
          const item = this.sheet._getEmbeddedDocument(target);
          if (item.system.size.unit === SizeUnit.CASH || item.type !== ItemType.GEAR) return false;
          return this.isOwner && item.system.resources !== '';
        },
        callback: async target => {
          const item = this.sheet._getEmbeddedDocument(target);
          await item.toggleItemResources('');
        }
      },
      {
        name: 'SDM.Item.RunningLow',
        icon: '<i class="fa-solid fa-battery-quarter"></i>',
        condition: target => {
          const item = this.sheet._getEmbeddedDocument(target);
          if (item.system.size.unit === SizeUnit.CASH || item.type !== ItemType.GEAR) return false;
          return this.isOwner && item.system.resources === '';
        },
        callback: async target => {
          const item = this.sheet._getEmbeddedDocument(target);
          await item.toggleItemResources('running_low');
        }
      },
      {
        name: 'SDM.Item.RunOut',
        icon: '<i class="fa-solid fa-battery-empty"></i>',
        condition: target => {
          const item = this.sheet._getEmbeddedDocument(target);
          if (item.system.size.unit === SizeUnit.CASH || item.type !== ItemType.GEAR) return false;
          return this.isOwner && item.system.resources === 'running_low';
        },
        callback: async target => {
          const item = this.sheet._getEmbeddedDocument(target);
          await item.toggleItemResources('run_out');
        }
      },
      {
        name: 'SDM.Item.Repair',
        icon: '<i class="fa-solid fa-hammer"></i>',
        condition: target => {
          const item = this.sheet._getEmbeddedDocument(target);
          if (item.system.size.unit === SizeUnit.CASH || item.type === ItemType.BURDEN)
            return false;
          if (item.type === ItemType.TRAIT && item.system.type !== GearType.POWER) return false;
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
          if (item.system.size.unit === SizeUnit.CASH || item.type === ItemType.BURDEN)
            return false;
          if (item.type === ItemType.TRAIT && item.system.type !== GearType.POWER) return false;
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

  isMergeBlocked(item) {
    return (
      this?.type === ActorType.CARAVAN &&
      !!item?.system?.is_supply &&
      item?.system?.size?.unit === SizeUnit.SACKS
    );
  }

  canMergeItem(item, opts = {}) {
    return this.getMergeableSiblings(item, opts).length > 0;
  }

  getMergeableSiblings(item, opts = {}) {
    if (!item) throw new Error('getMergeableSiblings: missing item.');
    if (item.parent && item.parent !== this) return [];

    const caseSensitive = opts.caseSensitive ?? true;
    const ignoreRule = opts.ignoreCaravanSacksRule ?? false;

    // Block merging entirely for caravan sack supplies, unless explicitly overridden
    if (!ignoreRule && this.isMergeBlocked(item)) return [];

    const keyName = caseSensitive ? v => v : v => (v ?? '').toLowerCase();
    const nameKey = keyName(item.name);
    const typeKey = item.type;
    const sysTypeKey = item.system?.type ?? '';

    function isStackable(i) {
      return Number.isFinite(Number(i?.system?.quantity));
    }

    // Only stackable items
    const siblings = this.items.contents.filter(i => {
      if (i.id === item.id) return false;

      if (!isStackable(i) || !isStackable(item)) return false;

      // Apply the same block rule to each candidate
      if (!ignoreRule && this.isMergeBlocked(this, i)) return false;

      const sameName = keyName(i.name) === nameKey;
      const sameType = i.type === typeKey;
      const sameSysType = (i.system?.type ?? '') === sysTypeKey;

      return sameName && sameType && sameSysType;
    });

    return siblings;
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

  async updateHeroDice(usedHeroDice = 0, shouldUseTouristDice = true) {
    // normalize input
    usedHeroDice = Number(usedHeroDice || 0);
    if (usedHeroDice <= 0) return;

    // current values (safe defaults)
    const currentHero = Math.max(0, Number(this.system?.hero_dice?.value ?? 0));
    const touristEnabled = Boolean(this.system?.tourist_dice?.enabled);
    const currentTourist =
      touristEnabled && shouldUseTouristDice
        ? Math.max(0, Number(this.system?.tourist_dice?.value ?? 0))
        : 0;

    // calculate deductions
    const deductFromTourist = Math.min(currentTourist, usedHeroDice);
    const remainingAfterTourist = usedHeroDice - deductFromTourist;
    const deductFromHero = Math.min(currentHero, remainingAfterTourist);

    // prepare update payload
    const updates = {};
    if (deductFromTourist > 0)
      updates['system.tourist_dice.value'] = currentTourist - deductFromTourist;
    if (deductFromHero > 0) updates['system.hero_dice.value'] = currentHero - deductFromHero;

    // nothing to update (e.g. actor has no dice) -> exit
    if (Object.keys(updates).length === 0) return;

    await this.update(updates);
  }

  async updateResourceDice(resource, diceQuantity = 0) {
    if (!resource || !diceQuantity) return;

    if (!(resource in this.system)) return;

    const current = Math.max(0, this.system[resource]?.value || 0);
    const newDiceValue = Math.max(current - diceQuantity, 0);
    await this.update({
      [`system.${resource}.value`]: newDiceValue
    });
  }

  async updateBloodDice(usedBloodDice = 0) {
    return this.updateResourceDice('blood_dice', usedBloodDice);
  }

  async addOneBloodDie() {
    const current = Math.max(0, this.system.blood_dice?.value || 0);
    const newBloodDiceValue = Math.min(current + 1, this.system.blood_dice.max);
    const adjustment = newBloodDiceValue > current ? 1 : 0;
    const resource = 'blood_dice';

    const chatCardData = {
      actor: this,
      adjustment,
      after: newBloodDiceValue,
      befor: current,
      resource
    };

    const dialogData = [
      {
        adjustment,
        character: this.id,
        operation: 'increment',
        resource
      }
    ];

    if (adjustment > 0) {
      await postDiceSummary([chatCardData], dialogData, { eventLabel: $l10n('SDM.Damage') });
    }

    await this.update({
      'system.blood_dice.value': newBloodDiceValue
    });
  }

  async applyDamage(damageValue = 0, multiplier = 1) {
    const life = this.system.life;
    const tempLife = this.system.temporary_life;
    const bloodClad = !!this.system.blood_dice?.enabled;

    if (!damageValue || !Number.isNumeric(damageValue)) return;

    // Net amount: positive = damage, negative = healing
    const netAmount = damageValue * multiplier;

    // Call the hook/logging you already had
    await postLifeChange(this, damageValue, multiplier);

    // Helper clamps (in case your environment doesn't have Math.clamp)
    const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

    // --- DAMAGE PATH (netAmount > 0) ---
    if (netAmount > 0) {
      let remainingDamage = netAmount;
      let newTempValue = tempLife?.value ?? 0;
      let newLifeValue = life.value;

      // If temporary life is enabled and > 0, consume it first
      if (tempLife?.enabled && newTempValue > 0) {
        const takenFromTemp = Math.min(newTempValue, remainingDamage);
        newTempValue = clamp(newTempValue - takenFromTemp, 0, tempLife.max ?? newTempValue);
        remainingDamage -= takenFromTemp;
      }

      // Any remaining damage reduces real life
      if (remainingDamage > 0) {
        newLifeValue = clamp(newLifeValue - remainingDamage, 0, life.max);
      }

      // If multiplier === 1 and some damage was applied (same condition as before), keep adding blood die
      if (multiplier === 1 && netAmount && bloodClad) {
        await this.addOneBloodDie();
      }

      // Build update object (include temp only if the system has it)
      const updateData = { 'system.life.value': newLifeValue };
      if (typeof tempLife !== 'undefined' && 'enabled' in tempLife) {
        updateData['system.temporary_life.value'] = newTempValue;
      }

      await this.update(updateData);
      return;
    }

    // --- HEALING PATH (netAmount < 0) ---
    if (netAmount < 0) {
      let remainingHeal = Math.abs(netAmount);
      let newLifeValue = life.value;
      let newTempValue = tempLife?.value ?? 0;

      // First heal real life up to its max
      if (newLifeValue < life.max) {
        const healToLife = Math.min(remainingHeal, life.max - newLifeValue);
        newLifeValue = clamp(newLifeValue + healToLife, 0, life.max);
        remainingHeal -= healToLife;
      }

      // Any overflow can go to temporary life (if enabled)
      if (remainingHeal > 0 && tempLife?.enabled) {
        const tempMax = tempLife.max ?? newTempValue;
        const healToTemp = Math.min(remainingHeal, tempMax - newTempValue);
        newTempValue = clamp(newTempValue + healToTemp, 0, tempMax);
        remainingHeal -= healToTemp;
      }

      // Update the document (include temp only if the system has it)
      const updateData = { 'system.life.value': newLifeValue };
      if (typeof tempLife !== 'undefined' && 'enabled' in tempLife) {
        updateData['system.temporary_life.value'] = newTempValue;
      }

      await this.update(updateData);
      return;
    }

    // If netAmount === 0 we already returned earlier due to the initial guard,
    // but keep this for clarity.
  }

  async performHudAction(action, identifier = '', args = {}, isShift = false, isCtrl = false) {
    // Resolve composite strings like "ability|str"
    let actionType = action || '';
    let actionKey = identifier || '';
    if (typeof actionType === 'string' && actionType.includes('|')) {
      const parts = actionType.split('|').map(s => s.trim());
      actionType = parts[0] || '';
      actionKey = parts[1] || '';
    }

    actionType = actionType || '';
    actionKey = actionKey || '';
    // Prepare a fake event object compatible with sheet handlers
    const fakeEvent = {
      preventDefault: () => {},
      stopPropagation: () => {},
      shiftKey: !!isShift,
      ctrlKey: !!isCtrl,
      // dataset and target will be provided by the constructed fakeTarget below when needed
      currentTarget: {},
      target: {}
    };

    // Helper to create a fake target element with dataset and closest()
    const makeFakeTarget = (dataset = {}, closestReturn = null) => {
      return {
        dataset,
        closest: selector => {
          // If caller provided a closestReturn object, return it; otherwise try default selector mapping
          if (closestReturn) return closestReturn;
          // default behavior for item elements: find li[data-document-class]
          if (selector && selector.includes('[data-document-class')) {
            return { dataset: dataset };
          }
          return null;
        }
      };
    };

    try {
      // Mapping from actionType to sheet handler name and how to build dataset/closestReturn
      const mapping = {
        ability: {
          handler: '_onRoll',
          dataset: {
            action: 'ability',
            ability: actionKey,
            type: 'ability',
            label: $l10n(CONFIG.SDM.abilities[actionKey])
          }
        },
        save: { handler: '_onRollSavingThrow', dataset: { action: 'save', ability: actionKey } },
        attack: {
          handler: '_onRoll',
          dataset: {
            action: 'roll',
            type: 'attack',
            attack: actionKey,
            label: $l10n(
              `SDM.Attack${actionKey !== 'attack' ? capitalizeFirstLetter(actionKey) : ''}`
            )
          }
        },
        reaction: {
          handler: '_onReactionRoll',
          dataset: { action: 'reaction', reaction: actionKey }
        },
        roll: { handler: '_onRoll', dataset: { action: 'roll', roll: actionKey } },
        rollNPCDamage: {
          handler: '_onRollNPCDamage',
          dataset: { action: 'rollNPCDamage', damage: actionKey, label: $l10n('SDM.Damage') }
        },
        rollNPCMorale: {
          handler: '_onRollNPCMorale',
          dataset: { action: 'rollNPCMorale', label: $l10n('SDM.Morale') }
        },
        heroichealing: {
          handler: '_onHeroHealing',
          dataset: { action: 'heroicHealing', index: actionKey }
        },
        bloodDiceRoll: {
          handler: '_onBloodDiceRoll',
          dataset: { action: 'bloodDiceRoll', index: actionKey }
        },
        touristDiceRoll: {
          handler: '_onTouristDiceRoll',
          dataset: { action: 'touristDiceRoll', index: actionKey }
        },
        item: {
          handler: '_onRoll',
          dataset: { action: 'roll', type: actionType, label: args.label, tooltip: args.tooltip },
          closestReturn: { dataset: { documentClass: 'Item', itemId: actionKey } }
        },
        transferCash: {
          handler: '_onTransferItem',
          dataset: { action: 'roll', type: actionType },
          closestReturn: { dataset: { documentClass: 'Item', itemId: actionKey } }
        }
      };

      // Normalize mapping key (allow synonyms)
      const normalizedKey = actionType.replace(/\s+/g, '');
      const finalKey = ['power', 'power_album', 'damage'].includes(normalizedKey)
        ? 'item'
        : normalizedKey;
      const mapEntry = mapping[finalKey] || null;

      // If no mapping found, try to handle composite defaults (like 'ability|str' already parsed)
      if (!mapEntry) {
        // fallback: if it looks like item id (hex) handle as item
        if (/^[0-9a-f]{8,}$/i.test(actionKey)) {
          return await this.performHudAction('item', actionKey, isShift, isCtrl);
        }
        // fallback to ability
        return await this.performHudAction('ability', actionKey, isShift, isCtrl);
      }

      // If sheet class is found, instantiate a lightweight sheet and call the handler

      const sheet = this.sheet.constructor;
      const fakeTarget = makeFakeTarget(mapEntry.dataset, mapEntry.closestReturn);
      fakeEvent.currentTarget = fakeTarget;
      fakeEvent.target = fakeTarget;
      fakeEvent.button = args?.button ?? 1;

      // Call the handler if present
      if (typeof sheet[mapEntry.handler] === 'function') {
        return await sheet[mapEntry.handler].call(this.sheet, fakeEvent, fakeTarget);
      }
    } catch (err) {
      console.error('performHudAction: error while mapping or executing action', err);
      ui.notifications?.error?.('Action failed (see console)');
      return null;
    }
  }
}
