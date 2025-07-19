import { GearType, PullMode, SizeUnit, TraitType } from '../helpers/constants.mjs';
import { convertToCash, getSlotsTaken } from '../helpers/itemUtils.mjs';
import { $l10n, capitalizeFirstLetter } from '../helpers/globalUtils.mjs';

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class SdmItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  getCarryCapacity() {
    let carryWeight = 0;

    switch (this.type) {
      case 'mount':
        let mountCapacity = this.system.capacity; //in sacks
        const { motorId = '', mode = '' } = this.system.pulledLoad;
        const motor = fromUuidSync(motorId);

        if (!motorId || !motor) {
          carryWeight = Math.max(mountCapacity - this.system.riders.length, 0);
          break;
        }

        break;
      case 'motor':
        const motorCapacity = this.system.capacity; //in sacks

        if (this.system.selfPulled) {
          carryWeight = motorCapacity;
          break;
        }

        let mountsCapacity = 0;
        const pulledBy = this.system.pulledBy;

        for (let pullMount of pulledBy) {
          const mountActor = fromUuidSync(pullMount);
          if (!mountActor) continue;
          const { mode = '' } = mountActor.system.pulledLoad;
          let pullModeMultiplier = 1;

          if (mode === PullMode.DRAGGING) {
            pullModeMultiplier = 2;
          } else if (mode === PullMode.CARTING) {
            pullModeMultiplier = 3;
          }
          mountsCapacity += mountActor.system.capacity * pullModeMultiplier;
        }

        if (mountsCapacity >= motorCapacity) {
          carryWeight = motorCapacity;
        }

        break;
      default:
        break;
    }

    return convertToCash(carryWeight, SizeUnit.SACKS);
  }

  getItemSlots() {
    return getSlotsTaken(this.system);
  }

  getArmorTitle() {
    const armorData = this.system?.armor;
    const armorValueLabel = `${$l10n('SDM.ArmorValue')}: ${armorData?.value}`;
    const armorTypeLabel = `${$l10n('SDM.ArmorType')}: ${$l10n(CONFIG.SDM.armorType[armorData?.type]) ?? ''}`;
    const title = `${this.name}\r${armorValueLabel} ${armorTypeLabel}`;
    return title;
  }

  getWardTitle() {
    const wardData = this.system?.ward;
    const wardValueLabel = `${$l10n('SDM.WardValue')}: ${wardData?.value}`;
    const armorValueLabel = `${$l10n('SDM.ArmorValue')}: ${wardData?.armor}`;
    const wardTypeLabel = `${$l10n('SDM.WardType')}: ${$l10n(CONFIG.SDM.wardType[wardData?.type]) ?? ''}`;
    const title = `${this.name}\r${wardValueLabel}${wardData?.armor ? ` ${armorValueLabel}` : ''} ${wardTypeLabel}`;
    return title;
  }

  getDefaultAbilityLabel() {
    return `(+${$l10n(CONFIG.SDM.abilityAbbreviations[this.system.default_ability])})`;
  }

  getDefaultTitle() {
    let title = '';

    switch (this.type) {
      case 'gear':
        if (this.system?.size?.unit === SizeUnit.CASH) {
          title = `${capitalizeFirstLetter($l10n('SDM.UnitCash'))}: € ${this.system.quantity}`;
        } else {
          title = `${$l10n('TYPES.Item.gear')}: ${this.name}`;
        }
        break;
      case 'trait':
        title = `${$l10n('TYPES.Item.trait')}: ${this.name}`;
        break;
      case 'burden':
        title = `${$l10n('TYPES.Item.burden')}: ${this.name}`;
        break;
    }

    return title;
  }

  getPowerTitle() {
    const data = this?.system;
    const powerData = data?.power;
    const actorPowerCost = this.actor?.system?.power_cost || 2;
    const powerLevel = powerData?.level || 1;
    const powerCost = Math.ceil(actorPowerCost * powerLevel);

    let title = `${this.name} (${$l10n('SDM.Cost')}: ${powerCost})\r`;

    const powerLabel = `${$l10n('SDM.PowerLevelAbbr')}: ${powerLevel}`;
    const rangeLabel = `${$l10n('SDM.PowerRangeAbbr')}: ${powerData?.range}`;
    const targetLabel = `${$l10n('SDM.PowerTargetAbbr')}: ${powerData?.target}`;
    const durationLabel = `${$l10n('SDM.PowerDurationAbbr')}: ${powerData?.duration}`;
    const overchargeLabel = `${$l10n('SDM.PowerOverchargeAbbr')}: ${powerData?.overcharge}`;
    let rollLabel = `${$l10n('SDM.PowerRollFormulaAbbr')}: ${powerData?.roll_formula}`;

    if (data?.default_ability) {
      rollLabel += ` ${this.getDefaultAbilityLabel()}`;
    }

    title += `${powerLabel}, ${rangeLabel}, ${targetLabel}, ${durationLabel}${powerData?.roll_formula ? `, ${rollLabel}` : ''}`;
    title += powerData?.overcharge ? `\r\r${overchargeLabel}` : '';

    return title;
  }

  getSkillTitle() {
    const skillMod = this.system?.skill?.modifier_final;
    const skillRank = this.system?.skill?.rank;

    if (skillMod === 0) return this.name;

    const skillModLabel = $l10n(CONFIG.SDM.skillMod[skillRank]);
    const title = `${$l10n('SDM.SkillMod')}: +${skillMod} ${skillModLabel}`;

    return title;
  }

  getWeaponTitle() {
    const data = this.system;
    const weaponData = data?.weapon;

    let title = `${this.name}\r${$l10n('SDM.Damage')}: ${weaponData?.damage.base}`;

    if (weaponData?.versatile) {
      title += `/${weaponData?.damage.versatile}`;
    }

    if (data?.default_ability) {
      title += ` ${this.getDefaultAbilityLabel()}`;
    }

    const rangeLabel = $l10n(CONFIG.SDM.rangeType[weaponData?.range]) ?? '';

    title += ` ${$l10n('SDM.WeaponRange')}: ${rangeLabel}`;

    return title;
  }

  getInventoryTitle() {
    let title = '';
    const data = this.system;

    const getInventoryItemTitle = {
      [GearType.ARMOR]: () => this.getArmorTitle(),
      [TraitType.POWER]: () => this.getPowerTitle(),
      // [GearType.POWER_CONTAINER]: () => this.getDefaultTitle(),
      [TraitType.SKILL]: () => this.getSkillTitle(),
      [GearType.WEAPON]: () => this.getWeaponTitle(),
      [GearType.WARD]: () => this.getWardTitle(),
      '': () => this.getDefaultTitle()
    };

    const titleFunction = getInventoryItemTitle[data.type];
    title = titleFunction();

    return title;
  }

  getInventoryName() {}

  /**
   * Prepare a data object which defines the data schema used by dice roll commands against this Item
   * @override
   */
  getRollData() {
    // Starts off by populating the roll data with a shallow copy of `this.system`
    const rollData = { ...this.system };

    // Quit early if there's no parent actor
    if (!this.actor) return rollData;

    // If present, add the actor's roll data
    rollData.actor = this.actor.getRollData();

    return rollData;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll(event, damageMode = '') {
    const item = this;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const itemTypeLabel = game.i18n.localize(`TYPES.Item.${item.type}`);
    let label = `[${itemTypeLabel}] ${item.name}`;

    // Retrieve roll data.
    const rollData = this.getRollData();
    const { formula = '', damage, actor, versatile } = rollData;
    let finalRoll;

    if (formula) {
      finalRoll = formula;
    } else {
      finalRoll = damage?.base || '';
      if (versatile && damageMode === 'versatile' && damage.versatile) {
        finalRoll = damage.versatile;
        label += ` (${game.i18n.localize('SDM.FeatureVersatile')})`;
      }
    }

    // Invoke the roll and submit it to chat.
    const roll = new Roll(finalRoll, actor);
    await roll.evaluate();
    // If you need to store the value first, uncomment the next line.

    await roll.toMessage({
      speaker: speaker,
      rollMode: rollMode,
      flavor: label
    });
  }
}
