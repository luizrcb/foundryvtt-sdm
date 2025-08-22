import { GearType, ItemType, PullMode, SizeUnit, TraitType } from '../helpers/constants.mjs';
import { $l10n, capitalizeFirstLetter } from '../helpers/globalUtils.mjs';
import { convertToCash, getSlotsTaken } from '../helpers/itemUtils.mjs';

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class SdmItem extends Item {
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);

    if (changed.system?.max_powers !== undefined) {
      if (changed.system?.max_powers < this.system.powers.length) {
        await this.update({
          'system.max_powers': this.system.powers.length
        });
      }
    }
  }

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
        const { vehicleId = '', mode = '' } = this.system.pulledLoad;
        const vehicle = fromUuidSync(vehicleId);

        if (!vehicleId || !vehicle) {
          carryWeight = Math.max(mountCapacity - this.system.riders.length, 0);
          break;
        }

        break;
      case 'vehicle':
        const vehicleCapacity = this.system.capacity; //in sacks

        if (this.system.selfPulled) {
          carryWeight = vehicleCapacity;
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

        if (mountsCapacity >= vehicleCapacity) {
          carryWeight = vehicleCapacity;
        }

        break;
      default:
        break;
    }

    return convertToCash(carryWeight, SizeUnit.SACKS);
  }

  getCostTitle() {
    if (this.system.cost) {
      const costFrequency = this.system.cost_frequency;
      const costValue = (this.system.cost || 0) * (this.system.quantity || 1);
      const frequencyLabel = costFrequency
        ? `/${$l10n(`SDM.Frequency${capitalizeFirstLetter(costFrequency)}`)}`
        : '';

      return ` (${$l10n('SDM.CashSymbol')}${costValue}${frequencyLabel})`;
    }
    return '';
  }

  getSlotsTaken() {
    return getSlotsTaken(this.system);
  }

  getArmorTitle() {
    const armorData = this.system?.armor;
    const armorValueLabel = `${$l10n('SDM.ArmorValue')}: ${armorData?.value}`;
    const armorTypeLabel = `${$l10n('SDM.ArmorType')}: ${
      $l10n(CONFIG.SDM.armorType[armorData?.type]) ?? ''
    }`;
    const title = `${this.name}${this.getCostTitle()}<br/>${armorValueLabel} ${armorTypeLabel}`;
    return title;
  }

  getWardTitle() {
    const wardData = this.system?.ward;
    const wardValueLabel = `${$l10n('SDM.WardValue')}: ${wardData?.value}`;
    const armorValueLabel = `${$l10n('SDM.ArmorValue')}: ${wardData?.armor}`;
    const wardTypeLabel = `${$l10n('SDM.WardType')}: ${
      $l10n(CONFIG.SDM.wardType[wardData?.type]) ?? ''
    }`;
    const title = `${this.name}${this.getCostTitle()}<br/>${wardValueLabel}${
      wardData?.armor ? ` ${armorValueLabel}` : ''
    } ${wardTypeLabel}`;
    return title;
  }

  getDefaultAbilityLabel(power) {
    const defaultAbility = power ? power.default_ability : this.system.default_ability;
    return `(+${$l10n(CONFIG.SDM.abilityAbbreviations[defaultAbility])})`;
  }

  getDefaultTitle() {
    let title = '';

    switch (this.type) {
      case 'gear':
        if (this.system?.size?.unit === SizeUnit.CASH) {
          title = `${capitalizeFirstLetter($l10n('SDM.UnitCash'))}: ${$l10n(
            'SDM.CashSymbol'
          )}${this.system.quantity * (this.system.size.value || 1)}`;
        } else {
          title = `${$l10n('TYPES.Item.gear')}: ${this.name}${this.getCostTitle()}`;
        }
        break;
      case 'trait':
        title = `${$l10n('TYPES.Item.trait')}: ${this.name}${this.getCostTitle()}`;
        break;
      case 'burden':
        title = `${$l10n('TYPES.Item.burden')}: ${this.name}${this.getCostTitle()}`;
        break;
    }

    return title;
  }

  getPowerShortTitle(powerData, actorPowerCost = 2, overcharge = false) {
    const powerName = powerData.name || this.name;
    const powerLevel = powerData?.level || 1;

    let powerCost = Math.ceil(actorPowerCost * powerLevel);
    if (overcharge) powerCost *= 2;
    let title = `${powerName} (${$l10n('SDM.Cost').toLowerCase()}: ${powerCost})`;
    return title;
  }

  getPowerTitle(powerData, actorPowerCost = 2) {
    const powerLevel = powerData?.level || 1;
    const powerCost = Math.ceil(actorPowerCost * powerLevel);
    const powerName = powerData.name || this.name;

    let title = `<b>${powerName}</b>${!powerData?.name ? this.getCostTitle() : ''} (${$l10n('SDM.Cost').toLowerCase()}: ${powerCost})<br/>`;

    const powerLabel = `${$l10n('SDM.PowerLevelAbbr')}: ${powerLevel}`;
    const rangeLabel = `${$l10n('SDM.PowerRangeAbbr')}: ${powerData?.range}`;
    const targetLabel = `${$l10n('SDM.PowerTargetAbbr')}: ${powerData?.target}`;
    const durationLabel = `${$l10n('SDM.PowerDurationAbbr')}: ${powerData?.duration}`;
    const overchargeLabel = `${$l10n('SDM.PowerOverchargeAbbr')}: ${powerData?.overcharge}`;
    let rollLabel = `${$l10n('SDM.PowerRollFormulaAbbr')}: ${powerData?.roll_formula}`;

    if (powerData?.default_ability) {
      rollLabel += ` ${this.getDefaultAbilityLabel(powerData)}`;
    }

    title += `${powerLabel}, ${rangeLabel}, ${targetLabel}, ${durationLabel}${powerData?.roll_formula ? `, ${rollLabel}` : ''}`;
    title += powerData?.overcharge ? `<br/>${overchargeLabel}` : '';

    return title;
  }

  getPowerAlbumTitle(actorPowerCost = 2) {
    let title = `${$l10n('SDM.PowerAlbum')}: <b>${this.name}</b>${this.getCostTitle()}<br/><br/>`;

    if (!this.system.powers.length) {
      title += `<i class="fa-solid fa-spider"></i> ${$l10n('SDM.NoPowers')} <i class="fa-solid fa-spider"></i>`;
      return title;
    }

    this.system.powers.forEach((power, index) => {
      title += `${index + 1}) ${this.getPowerTitle(power, actorPowerCost)}<br/><br>`;
    });

    return title;
  }

  getSkillTitle() {
    const skillMod = this.system?.skill?.modifier_final;
    const skillRank = this.system?.skill?.rank;

    if (skillMod === 0) return this.name;
    const allMods = { ...CONFIG.SDM.skillMod, ...CONFIG.SDM.extraSkillMod };
    const skillModLabel = $l10n(allMods[skillRank]);
    const title = `${$l10n('SDM.SkillMod')}: +${skillMod} ${skillModLabel}`;

    return title;
  }

  getWeaponTitle() {
    const data = this.system;
    const weaponData = data?.weapon;

    let title = `${this.name}${this.getCostTitle()}<br/>${$l10n('SDM.Damage')}: ${weaponData?.damage.base}`;

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
      [TraitType.POWER]: (system, actorSystem) =>
        this.getPowerTitle(system.power, actorSystem.power_cost),
      [GearType.POWER_ALBUM]: (system, actorSystem) =>
        this.getPowerAlbumTitle(actorSystem.power_cost),
      [TraitType.SKILL]: () => this.getSkillTitle(),
      [GearType.WEAPON]: () => this.getWeaponTitle(),
      [GearType.WARD]: () => this.getWardTitle(),
      [ItemType.MOUNT]: () => this.getDefaultTitle(),
      [ItemType.VEHICLE]: () => this.getDefaultTitle(),
      '': () => this.getDefaultTitle()
    };

    const titleFunction = getInventoryItemTitle[data.type];
    title = titleFunction(this.system, this.actor.system);

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
