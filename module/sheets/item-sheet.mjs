import { bindCollapsibleSections } from '../helpers/collapsibleSections.mjs';
import PowerDataModel from '../data/power-data.mjs';
import { SdmItem } from '../documents/item.mjs';
import { createNPCByLevel, getActorOptions, getXpToNextLevel } from '../helpers/actorUtils.mjs';
import { openProgressLog } from '../app/progress-log.mjs';
import { getItemIdentifier, getItemReference } from '../helpers/effectReferences.mjs';
import { getCounters, promptNewCounter, removeCounter, resetCounters, stepCounter } from '../helpers/counters.mjs';
import { getHallmarkUpgradeSummary, openHallmarkUpgradeDialog } from '../app/level-upgrades.mjs';
import { makeNpcFriendly } from '../items/petItem.mjs';
import { hasPowerAlbum } from '../helpers/itemUtils.mjs';
import { isLightSource, LIGHT_PRESET_CHOICES, POWER_LIGHT_PRESET_CHOICES } from '../helpers/lights.mjs';
import { isAnimatable as isAnimatableItem } from '../helpers/animatedItems.mjs';
import { giveTemporaryLife, isUsable } from '../app/use-item.mjs';
import { isSentientRide, refillRideStats, rideTable } from '../helpers/rideStats.mjs';
import { getUsesCounter, USES_MODES } from '../helpers/itemUses.mjs';
import { hasCharges as triggerHasCharges, isCastable } from '../rolls/triggers.mjs';
import {
  animateItem,
  deanimateItem,
  fillAttributesFromTable,
  getAnimationLevel,
  getAnimationTable,
  getAnimationTableChoices,
  getLinkedNpc,
  getDamageSource,
  isAnimatable,
  getAnimationBlock,
  isAnimationBlocked,
  isRideItem,
  isWeaponItem,
  linkNpcToItem,
  requestAnimation,
  canAnimateWithoutApproval
} from '../helpers/animatedItems.mjs';
import { ActorType, DEFAULT_PET_ICON, GearType, ItemStatusType, ItemType } from '../helpers/constants.mjs';
import { prepareActiveEffectCategories } from '../helpers/effects.mjs';
import { $fmt, $l10n, constructHTMLButton } from '../helpers/globalUtils.mjs';
import { templatePath } from '../helpers/templates.mjs';
import { bindNumberInputs, unformatNumberInputs, reformatNumberInputs } from '../helpers/numberFormat.mjs';

/** Colonist: members of the hexad. */
const HEXAD_MAX = 5;

/** The save difficulties an area's save can have (labels as on the save request). */
const AREA_SAVE_DIFFICULTIES = () => ({
  '': 'SDM.SaveDifficulty.standard',
  veryEasy: 'SDM.SaveDifficulty.veryEasy',
  easy: 'SDM.SaveDifficulty.easy',
  hard: 'SDM.SaveDifficulty.hard',
  veryHard: 'SDM.SaveDifficulty.veryHard',
  target: 'SDM.SaveDifficulty.target'
});

const { api, sheets } = foundry.applications;
const { DialogV2 } = foundry.applications.api;
const DragDrop = foundry.applications.ux.DragDrop.implementation;
const FilePicker = foundry.applications.apps.FilePicker.implementation;
const TextEditor = foundry.applications.ux.TextEditor.implementation;
const { performIntegerSort } = foundry.utils;
/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheetV2}
 */
/** A power of an album as power item data (extracting it, or dragging it out of the album). */
function powerToItemData(power) {
  const { name, img, description, ...data } = foundry.utils.duplicate(power);
  return {
    type: ItemType.GEAR,
    name,
    img,
    system: { type: GearType.POWER, description, power: { ...data } }
  };
}


const O = 'SDM.Trigger.Option.';
const D20_CONDITIONS = ['always', 'natural', 'naturalAtLeast', 'naturalAtMost', 'total', 'totalAtLeast', 'totalAtMost', 'success', 'failure'];
const TRIGGER_CONDITIONS_BY_ROLL = {
  attack: D20_CONDITIONS,
  save: D20_CONDITIONS,
  ability: D20_CONDITIONS,
  defeat: D20_CONDITIONS,
  damage: ['always', 'total', 'totalAtLeast', 'totalAtMost', 'die', 'max', 'min', 'matching'],
  power: ['always', 'total', 'totalAtLeast', 'totalAtMost', 'die', 'max', 'min', 'matching'],
  usage: ['total', 'totalAtLeast', 'totalAtMost', 'runningLow', 'runOut'],
  use: ['always'],
  counter: ['total', 'totalAtLeast', 'totalAtMost', 'increases', 'decreases', 'changes', 'full', 'empty'],
  charges: ['total', 'totalAtLeast', 'totalAtMost', 'increases', 'decreases', 'changes', 'full', 'empty']
};

/** The condition choices of one trigger: those of its roll (plus its current one, if it is not among them). */
function triggerConditionChoices(trigger) {
  const roll = trigger.roll;
  const tracked = roll === 'counter' || roll === 'charges';
  const label = condition => {
    if (condition === 'counterMax') return `${O}full`;
    if (!condition.startsWith('total')) return `${O}${condition}`;
    if (tracked) return `${O}${condition.replace('total', 'value')}`;
    if (roll === 'usage') return `${O}${condition.replace('total', 'result')}`;
    return `${O}${condition}`;
  };
  const list = [...(TRIGGER_CONDITIONS_BY_ROLL[roll] ?? D20_CONDITIONS)];
  if (trigger.condition && !list.includes(trigger.condition)) list.push(trigger.condition);
  return Object.fromEntries(list.map(condition => [condition, label(condition)]));
}

export class SdmItemSheet extends api.HandlebarsApplicationMixin(sheets.ItemSheetV2) {
  constructor(options = {}) {
    super(options);

    const classes = [...this.options.classes];
    const window = { ...this.options.window };
    const controls = [...this.options.window.controls];

    // if (game.user.isGM) {
    //   controls.push({
    //     action: 'spawnNPC',
    //     icon: 'fa-solid fa-robot',
    //     label: 'Spawn NPC',
    //     ownership: 'OWNER'
    //   });
    // }

    window.controls = controls;

    // Update options with the new classes array
    this.options = {
      ...this.options,
      classes,
      window
    };

    this.#dragDrop = this.#createDragDropHandlers();
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['sdm', 'item'],
    window: {
      resizable: true
    },
    actions: {
      refillRideStats: this._onRefillRideStats,
      onEditImage: this._onEditImage,
      onEditPowerImage: this._onEditPowerImage,
      viewDoc: this._viewEffect,
      addPower: this._onCreatePower,
      deletePower: this._onDeletePower,
      extractPower: this._onExtractPower,
      nextPower: this._onNextPower,
      prevPower: this._onPrevPower,
      selectPower: this._onSelectPower,
      addCounter: this._onAddCounter,
      addTrigger: this._onAddTrigger,
      removeTrigger: this._onRemoveTrigger,
      stepCounter: this._onStepCounter,
      resetCounter: this._onResetCounter,
      removeCounter: this._onRemoveCounter,
      castPower: this._onCastPower,
      duplicatePower: this._onDuplicatePower,
      showOvercharge: this._onShowOvercharge,
      createDoc: this._createEffect,
      deleteDoc: this._deleteEffect,
      toggleEffect: this._toggleEffect,
      toggleReadied: this._toggleReadied,
      toggleItemStatus: { handler: this._toggleItemStatus, buttons: [0, 2] },
      toggleIsHallmark: this._toggleIsHallmark,
      setItemStatus: this._setItemStatus,
      setItemResources: this._setItemResources,
      radioToggle: this._radioToggle,
      spawnNPC: this._onSpawnNPC,
      animateItem: this._onAnimateItem,
      chooseHallmarkUpgrade: this._onChooseHallmarkUpgrade,
      showProgressLog: this._onShowProgressLog,
      copyItemReference: this._onCopyItemReference,
      requestAnimation: this._onRequestAnimation,
      deanimateItem: this._onDeanimateItem,
      fillAnimationFromTable: this._onFillAnimationFromTable,
      sendToChat: this._onSendToChat,
      toggleFeaturesEdit: this._onToggleFeaturesEdit,
      removeHexadMember: this._onRemoveHexadMember,
      openHexadMember: this._onOpenHexadMember,
      nightWithHexad: this._onNightWithHexad,
      openPetActor: this._onOpenPetActor,
      unlinkActor: this._onUnlinkActor
    },
    form: {
      submitOnChange: true
    },
    // Custom property that's merged into `this.options`
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: null }]
  };

  /* -------------------------------------------- */

  /** @override */
  static PARTS = {
    header: {
      template: templatePath('item/header')
    },
    tabs: {
      // Foundry-provided generic template
      template: 'templates/generic/tab-navigation.hbs'
    },
    description: {
      template: templatePath('item/description'),
      scrollable: ['']
    },
    attributesFeature: {
      template: templatePath('item/attribute-parts/feature')
    },
    powerAlbum: {
      template: templatePath('item/attribute-parts/power_album'),
      scrollable: ['']
    },
    effects: {
      template: templatePath('item/effects'),
      scrollable: ['']
    },
    features: {
      template: templatePath('item/features'),
      scrollable: ['']
    },
    categories: {
      template: templatePath('item/categories')
    },
    animation: {
      template: templatePath('item/animation'),
      scrollable: ['']
    },
    gmNotes: {
      template: templatePath('item/gm-notes'),
      scrollable: ['']
    }
  };

  /** @override */
  _configureRenderOptions(options) {
    const displayItemCategoriesTab = game.settings.get('sdm', 'displayItemCategoriesTab');
    super._configureRenderOptions(options);
    // Not all parts always render
    options.parts = ['header', 'tabs'];
    // Don't show the other tabs if only limited view
    if (this.document.limited) return;
    // Control which parts show based on document subtype
    switch (this.document.type) {
      case 'gear':
        // Power albums and gear with the album feature hold a list of powers
        if (hasPowerAlbum(this.document)) {
          options.parts.push('powerAlbum');
        }

        options.parts.push('description');

        if (
          ![GearType.CORRUPTION, GearType.AFFLICTION, GearType.PET].includes(
            this.document.system.type
          )
        ) {
          options.parts.push('features');
        }

        options.parts.push('effects');
        if (displayItemCategoriesTab && game.user.isGM) {
          options.parts.push('categories');
        }
        break;
      case 'mount':
      case 'vehicle':
        options.parts.push('description', 'features', 'effects');
        break;
      default:
        options.parts.push('description', 'effects');
        if (displayItemCategoriesTab && game.user.isGM) {
          options.parts.push('categories');
        }

        break;
    }

    // Items with the "animated" feature get the Animation tab
    if (isAnimatable(this.document) && !isRideItem(this.document)) options.parts.push('animation');

    // GM-only notes tab, for every item type
    if (game.user.isGM) options.parts.push('gmNotes');
  }

  /* -------------------------------------------- */

  /** @override */
  /**
   * Item pickers of the triggers: this item and the owner's items (by identifier), for "From" and the
   * use-a-power / use-a-consumable / light actions. Values not found (item on no actor, or removed)
   * stay listed by their identifier so nothing is lost on save.
   */
  _triggerItemChoices() {
    const item = this.item;
    const actorItems = (item.actor?.items ?? []).filter(other => other.id !== item.id);
    const self = $l10n('SDM.Trigger.ThisItem');
    const pick = (accept, { none = true, withSelf = true } = {}) => {
      const choices = {};
      if (none) choices[''] = '—';
      if (withSelf && accept(item)) choices['@self'] = self;
      for (const other of actorItems) {
        if (!accept(other)) continue;
        const id = getItemIdentifier(other);
        if (id && !(id in choices)) choices[id] = other.name;
      }
      return choices;
    };
    const keep = (choices, values) => {
      for (const value of values) if (value && !(value in choices)) choices[value] = value === '@self' ? self : value;
      return choices;
    };
    const triggers = item.system.triggers ?? [];
    return {
      triggerSourceItems: keep(pick(other => other.type === ItemType.GEAR, { withSelf: false }), triggers.map(t => t.from_item)),
      triggerCastItems: keep(pick(isCastable), triggers.map(t => t.cast)),
      triggerUseItems: keep(pick(isUsable), triggers.map(t => t.use)),
      triggerLightItems: keep(pick(isLightSource, { none: false }), triggers.map(t => t.light_item)),
      triggerChargeItems: keep(pick(triggerHasCharges, { none: false }), triggers.map(t => t.charges_item)),
      triggerAnimateItems: keep(pick(isAnimatableItem, { none: false }), triggers.map(t => t.animate_item))
    };
  }

  async _prepareContext(options) {
    const extendedSkillRanks = game.settings.get('sdm', 'extendedSkillRanks') || false;
    const defaultModifierStep = game.settings.get('sdm', 'skillModifierStep') || 3;
    const allSKillMods = {
      ...CONFIG.SDM.skillMod,
      ...(extendedSkillRanks ? CONFIG.SDM.extraSkillMod : {})
    };

    const language = game.i18n.lang;

    const context = {
      // Validates both permissions and compendium status
      editable: this.isEditable,
      owner: this.document.isOwner,
      limited: this.document.limited,
      // Add the item document.
      item: this.item,
      // Adding system and flags for easier access
      system: this.item.system,
      flags: this.item.flags,
      // Adding a pointer to CONFIG.SDM
      config: CONFIG.SDM,
      // You can factor out context construction to helper functions
      tabs: this._getTabs(options.parts),
      // Necessary for formInput and formFields helpers
      fields: this.document.schema.fields,
      systemFields: this.document.system.schema.fields,
      pullModes: CONFIG.SDM.pullModes,
      possibleRiders: getActorOptions('character'),
      sizeUnits: CONFIG.SDM.sizeUnits,
      areaValues: CONFIG.SDM.areaValues,
      areaShapes: CONFIG.SDM.areaShapes,
      areaAffects: CONFIG.SDM.areaAffects,
      splashDamage: CONFIG.SDM.splashDamage,
      areaResolve: CONFIG.SDM.areaResolve,
      areaSavePass: CONFIG.SDM.areaSavePass,
      areaRoundDamage: CONFIG.SDM.areaRoundDamage,
      areaLights: CONFIG.SDM.areaLights,
      // Save difficulties (standard, easier, harder, a target) and abilities, for areas resolved by a save
      areaSaveDifficulties: AREA_SAVE_DIFFICULTIES(),
      areaSaveAbilities: { '': 'SDM.AreaSaveAbilityAny', ...CONFIG.SDM.abilities },
      splashShapes: CONFIG.SDM.splashShapes,
      // Powers: an area of small, medium or large (no single target entry)
      powerAreaValues: Object.fromEntries(Object.entries(CONFIG.SDM.areaValues).filter(([key]) => key !== 'single')),
      rangeValues: CONFIG.SDM.rangeType,
      skillMod: allSKillMods,
      skillModifierStep: defaultModifierStep,
      abilities: CONFIG.SDM.getOrderedAbilities(language),
      isGM: game.user.isGM,
      hallmarkXpToNextLevel: getXpToNextLevel(this.item.system.hallmark?.experience ?? 0),
      // Mods gained as hallmark upgrades (outside the mod slots)
      // How other effects read this item's values once an actor has it: @items.<type>:<identifier>.<path>
      itemReference: getItemReference(this.item),
      hallmarkUpgrades: getHallmarkUpgradeSummary(this.item),
      counters: getCounters(this.item),
      counterScope: '@item',
      // Gear can keep its uses in one of its counters (instead of charges)
      usesCounterChoices: Object.fromEntries([
        ['', '—'],
        ...Object.entries(this.item.system.counters ?? {}).map(([key, counter]) => [key, counter.label]),
        ...(this.item.system.uses?.counter && !this.item.system.counters?.[this.item.system.uses.counter]
          ? [[this.item.system.uses.counter, this.item.system.uses.counter]]
          : [])
      ]),
      usesModes: USES_MODES,
      lightPresets: LIGHT_PRESET_CHOICES,
      powerLightPresets: POWER_LIGHT_PRESET_CHOICES,
      lightAnimations: {
        '': 'SDM.Light.NoAnimation',
        ...Object.fromEntries(Object.entries(CONFIG.Canvas.lightAnimations ?? {}).map(([key, cfg]) => [key, cfg.label]))
      },
      triggerRolls: {
        attack: 'SDM.Trigger.Roll.attack',
        damage: 'SDM.Trigger.Roll.damage',
        power: 'SDM.Trigger.Roll.power',
        usage: 'SDM.Trigger.Roll.usage',
        use: 'SDM.Trigger.Roll.use',
        save: 'SDM.Trigger.Roll.save',
        ability: 'SDM.Trigger.Roll.ability',
        defeat: 'SDM.Trigger.Roll.defeat',
        counter: 'SDM.Trigger.Roll.counter',
        charges: 'SDM.Trigger.Roll.charges'
      },
      triggerCounterModes: {
        add: 'SDM.Trigger.CounterMode.add',
        set: 'SDM.Trigger.CounterMode.set',
        reset: 'SDM.Trigger.CounterMode.reset'
      },
      triggerAbilities: { '': 'SDM.Trigger.AbilityAny', ...CONFIG.SDM.abilities },
      triggerEffectTargets: { targets: 'SDM.Trigger.EffectTargets', self: 'SDM.Trigger.EffectSelf' },
      triggerAttacks: {
        '': 'SDM.Trigger.AttackAny',
        melee: 'SDM.AttackMelee',
        ranged: 'SDM.AttackRanged',
        fantascience: 'SDM.AttackFantascience',
        oldtech: 'SDM.AttackOldtech'
      },
      // Each trigger lists only the conditions that fit its roll
      triggerConditionChoices: (this.item.system.triggers ?? []).map(trigger => triggerConditionChoices(trigger)),
      triggerWear: {
        '': 'SDM.Trigger.WearNone',
        notch: 'SDM.Trigger.Wear.notch',
        break: 'SDM.Trigger.Wear.break',
        running_low: 'SDM.Trigger.Wear.running_low',
        run_out: 'SDM.Trigger.Wear.run_out',
        repair: 'SDM.Trigger.Wear.repair',
        repair_full: 'SDM.Trigger.Wear.repair_full',
        recharge: 'SDM.Trigger.Wear.recharge'
      },
      triggerEffects: Object.fromEntries([['', ''], ...this.item.effects.map(effect => [effect.id, effect.name])]),
      // Conditions a trigger can put on its targets / self: the Token HUD's list
      triggerStatusModes: { apply: 'SDM.Trigger.StatusApply', remove: 'SDM.Trigger.StatusRemove' },
      // A condition with a save: the ability suggested to characters ('' = by the condition)
      triggerSaveDifficulties: {
        veryEasy: 'SDM.SaveDifficulty.veryEasyStep',
        easy: 'SDM.SaveDifficulty.easyStep',
        '': 'SDM.SaveDifficulty.standard',
        hard: 'SDM.SaveDifficulty.hardStep',
        veryHard: 'SDM.SaveDifficulty.veryHardStep',
        target: 'SDM.SaveDifficulty.target'
      },
      triggerSaveAbilities: {
        '': 'SDM.Trigger.StatusSaveAbilityAuto',
        ...Object.fromEntries(['str', 'end', 'agi', 'cha', 'aur', 'tho'].map(key => [key, CONFIG.SDM.abilities[key]]))
      },
      // A consumable's overdose: how long doses are counted, and the first save's difficulty
      useOverduePeriods: { '': 'SDM.Use.OverdosePeriod.ever', days: 'SDM.Use.OverdosePeriod.days', weeks: 'SDM.Use.OverdosePeriod.weeks' },
      useOverdoseDifficulties: {
        veryEasy: 'SDM.SaveDifficulty.veryEasyStep',
        easy: 'SDM.SaveDifficulty.easyStep',
        '': 'SDM.SaveDifficulty.standard',
        hard: 'SDM.SaveDifficulty.hardStep',
        veryHard: 'SDM.SaveDifficulty.veryHardStep'
      },
      triggerStatuses: Object.fromEntries([
        ['', ''],
        ...CONFIG.statusEffects
          .map(status => [status.id, game.i18n.localize(status.name ?? status.label ?? status.id)])
          .sort((a, b) => a[1].localeCompare(b[1], game.i18n.lang))
      ]),
      // A consumable's Use: the conditions it cures (same list, no blank)
      useCureChoices: Object.fromEntries(
        CONFIG.statusEffects
          .map(status => [status.id, game.i18n.localize(status.name ?? status.label ?? status.id)])
          .sort((a, b) => a[1].localeCompare(b[1], game.i18n.lang))
      ),
      triggerCounters: Object.fromEntries([
        ['', ''],
        ...Object.entries(this.item.system.counters ?? {}).map(([key, counter]) => [key, counter.label])
      ]),
      // The owner's counters (character, NPC); keys used by the triggers stay listed when missing
      triggerActorCounters: Object.fromEntries([
        ['', ''],
        ...Object.entries(this.item.actor?.system?.counters ?? {}).map(([key, counter]) => [key, counter.label]),
        ...(this.item.system.triggers ?? [])
          .flatMap(t => [t.watch_scope === 'actor' ? t.watch : '', t.counter_scope === 'actor' ? t.counter : ''])
          .filter(key => key && !this.item.actor?.system?.counters?.[key])
          .map(key => [key, key])
      ]),
      triggerScopes: { '': 'SDM.Trigger.Scope.item', actor: 'SDM.Trigger.Scope.actor' },
      triggerFrom: { '': 'SDM.Trigger.From.self', any: 'SDM.Trigger.From.any', item: 'SDM.Trigger.From.item' },
      // Attack triggers: the item the attack is made with (attack dialog's "With"), or unarmed
      triggerAttackFrom: {
        '': 'SDM.Trigger.From.self',
        any: 'SDM.Trigger.From.any',
        item: 'SDM.Trigger.From.item',
        unarmed: 'SDM.Trigger.From.unarmed'
      },
      // Consumables (Use)
      // Nothing picked shows empty (any ability / until removed), not a default choice
      useAbilityGroups: { '': '', physical: 'SDM.Use.Group.physical', mental: 'SDM.Use.Group.mental' },
      useDurationUnits: {
        '': '',
        rounds: 'SDM.Use.DurationUnit.rounds',
        minutes: 'SDM.Use.DurationUnit.minutes',
        hours: 'SDM.Use.DurationUnit.hours',
        days: 'SDM.Use.DurationUnit.days',
        weeks: 'SDM.Use.DurationUnit.weeks'
      },
      triggerCostResources: {
        '': 'SDM.Trigger.WearNone',
        life: 'SDM.CostResource.Life',
        ...CONFIG.SDM.abilities,
        hero_die: 'SDM.CostResource.HeroDie'
      },
      triggerChargeModes: {
        '': 'SDM.Trigger.WearNone',
        spend: 'SDM.Trigger.ChargesMode.spend',
        add: 'SDM.Trigger.ChargesMode.add',
        set: 'SDM.Trigger.ChargesMode.set'
      },
      triggerLightModes: {
        '': 'SDM.Trigger.WearNone',
        light: 'SDM.Trigger.LightMode.light',
        put_out: 'SDM.Trigger.LightMode.put_out',
        toggle: 'SDM.Trigger.LightMode.toggle',
        flare: 'SDM.Trigger.LightMode.flare'
      },
      triggerLifeModes: {
        '': 'SDM.Trigger.WearNone',
        heal: 'SDM.Trigger.LifeMode.heal',
        damage: 'SDM.Trigger.LifeMode.damage'
      },
      triggerAbilityDamage: {
        '': 'SDM.Trigger.WearNone',
        choose: 'SDM.Trigger.AbilityDamageChooseOption',
        ...Object.fromEntries(['str', 'end', 'agi', 'cha', 'aur', 'tho'].map(key => [key, CONFIG.SDM.abilities[key]]))
      },
      triggerPurgeModes: { '': 'SDM.Trigger.WearNone', targets: 'SDM.Trigger.EffectTargets', self: 'SDM.Trigger.EffectSelf' },
      triggerAnimateModes: {
        '': 'SDM.Trigger.WearNone',
        animate: 'SDM.Trigger.AnimateMode.animate',
        deanimate: 'SDM.Trigger.AnimateMode.deanimate'
      },
      ...this._triggerItemChoices(),
      boostResources: {
        life: 'SDM.CostResource.Life',
        ...CONFIG.SDM.abilities,
        hero_die: 'SDM.CostResource.HeroDie'
      }
    };

    if (this.item.type === ItemType.GEAR && this.item.system.type === GearType.WARD) {
      context.itemFeatures = [...CONFIG.SDM.baseFeatures, ...CONFIG.SDM.wardFeatures];
    } else if (this.item.type === ItemType.GEAR && this.item.system.type === GearType.ARMOR) {
      context.itemFeatures = [...CONFIG.SDM.baseFeatures, ...CONFIG.SDM.armorFeatures];
    } else if (this.item.type === ItemType.GEAR && this.item.system.type === GearType.WEAPON) {
      context.itemFeatures = [...CONFIG.SDM.baseFeatures, ...CONFIG.SDM.weaponFeatures];
    } else if ([ItemType.MOUNT, ItemType.VEHICLE].includes(this.item.type)) {
      context.itemFeatures = [...CONFIG.SDM.transportFeatures];
      // The ride's stats: the book's ride table, or (sentient) an NPC table to pick
      context.rideStats = {
        sentient: isSentientRide(this.item),
        table: rideTable(this.item),
        tables: getAnimationTableChoices(),
        // Deploy / Recall: the Referee does it, owners ask
        deployed: !!this.item.system.animation?.active,
        blocked: isAnimationBlocked(this.item),
        canManage: game.user.isGM && !this.item.pack,
        canRequest: !game.user.isGM && this.item.isOwner && !this.item.pack
      };
    } else {
      context.itemFeatures = [...CONFIG.SDM.baseFeatures];
    }

    const isPet = this.item.system.type === GearType.PET;

    // Colonist: the hexad (up to five creatures) and the night that gives them temporary life
    if (getItemIdentifier(this.item) === 'colonist' && this.item.actor) {
      const members = (this.item.getFlag('sdm', 'hexad') ?? []).map(uuid => ({ uuid, actor: fromUuidSync(uuid) }));
      context.hexad = {
        members: members.map(m => ({ uuid: m.uuid, name: m.actor?.name ?? game.i18n.localize('SDM.Item.PetNotFound'), img: m.actor?.img, missing: !m.actor })),
        count: members.length,
        max: HEXAD_MAX,
        level: Number(this.item.actor.system?.level) || 0
      };
    }

    if (isPet && this.item.system.pet) {
      context.petActor = await fromUuid(this.item.system.pet).catch(() => null);
      // Linked to a pet that no longer exists: show it, so it can be unlinked or relinked
      context.petMissing = !context.petActor;
      context.defaultPetIcon = DEFAULT_PET_ICON;
    }

    if (hasPowerAlbum(this.item)) {
      // Calculate navigation states
      context.powers = context.system?.powers;
      context.enrichedPowers = await this._getPowersDescriptions(context.powers);
      context.currentPowerIndex = context.system.powers_current_index || 0;
      context.powerCount = context.powers.length;
      context.hasPrevious = context.currentPowerIndex > 0;
      context.hasNext = context.currentPowerIndex < context.powers.length - 1;
      context.albumFull = context.powers.length >= (this.item.system.max_powers ?? 0);
      // Powers can be used from the album list when the item is ready on an actor
      const system = this.item.system;
      context.canCastPowers =
        !!this.item.actor &&
        this.item.isOwner &&
        !!system.readied &&
        system.status !== 'broken' &&
        system.resources !== 'run_out';
    }

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case 'attributesFeature':
      case 'attributesMount':
      case 'powerAlbum':
      case 'features':
        context.tab = context.tabs[partId];
        // Locked until the pencil is clicked (avoids ticking features by mistake)
        context.featuresEditing = !!this._featuresEditing;
        break;
      case 'categories':
        // Necessary for preserving active tab on re-render
        context.tab = context.tabs[partId];
        break;
      case 'description':
        context.tab = context.tabs[partId];
        // Enrich description info for display
        // Enrichment turns text like `[[/r 1d20]]` into buttons
        context.enrichedDescription = await TextEditor.enrichHTML(this.item.system.description, {
          // Whether to show secret blocks in the finished html
          secrets: this.document.isOwner,
          // Data to fill in for inline rolls
          rollData: this.item.getRollData(),
          // Relative UUID resolution
          relativeTo: this.item
        });
        break;
      case 'gmNotes':
        context.tab = context.tabs[partId];
        context.enrichedGmNotes = await TextEditor.enrichHTML(this.item.system.gm_notes ?? '', {
          secrets: true,
          rollData: this.item.getRollData(),
          relativeTo: this.item
        });
        break;
      case 'animation': {
        context.tab = context.tabs[partId];
        // The world creature, or the compendium NPC it will be imported from on first animation
        const compendiumUuid = this.item.system.animation?.actor?.startsWith?.('Compendium.') ? this.item.system.animation.actor : null;
        const compendiumNpc = compendiumUuid ? fromUuidSync(compendiumUuid) : null;
        const npc =
          getLinkedNpc(this.item) ?? (compendiumNpc ? { uuid: compendiumUuid, name: compendiumNpc.name ?? compendiumUuid } : null);
        context.animation = {
          level: getAnimationLevel(this.item),
          isHallmark: !!this.item.system.is_hallmark,
          table: getAnimationTable(this.item),
          tables: getAnimationTableChoices(),
          modes: { energy: 'SDM.Animation.ModeEnergy', walks: 'SDM.Animation.ModeWalks' },
          npc,
          active: !!this.item.system.animation?.active,
          blocked: isAnimationBlocked(this.item),
          blockHint: getAnimationBlock(this.item),
          hasCharges: this.item.system.features?.has?.('charges') ?? false,
          hasReplenish: this.item.system.features?.has?.('replenish') ?? false,
          hasUsesCounter: !!getUsesCounter(this.item),
          // Shown next to the cost: the uses counter when the item keeps its uses there, else charges
          charges: getUsesCounter(this.item)
            ? { value: getUsesCounter(this.item).counter.value, max: getUsesCounter(this.item).counter.max ?? '—' }
            : this.item.system.charges,
          sizeUnits: CONFIG.SDM.sizeUnits,
          isWeapon: isWeaponItem(this.item),
          damageSources: {
            auto: game.i18n.format('SDM.Animation.DamageAutoResolved', {
              source: game.i18n.localize(
                getDamageSource(this.item) === 'weapon' ? 'SDM.Animation.DamageWeapon' : 'SDM.Animation.DamageCreature'
              )
            }),
            weapon: 'SDM.Animation.DamageWeapon',
            creature: 'SDM.Animation.DamageCreature'
          },
          // Animating and deanimating are the Referee's; the item's owner configures the tab (for now)
          canManage: game.user.isGM,
          canEdit: this.item.isOwner && !this.item.pack,
          // Players who own the item ask the Referee to animate it
          canRequest:
            !game.user.isGM && this.item.isOwner && !this.item.system.animation?.active && !!this.item.parent,
          // Players allowed to create and delete tokens animate it themselves
          animatesSelf: canAnimateWithoutApproval()
        };
        break;
      }
      case 'effects':
        context.tab = context.tabs[partId];
        // Prepare active effects for easier access
        context.effects = prepareActiveEffectCategories(this.item.effects);
        break;
    }
    return context;
  }

  /**
   * Generates the data for the generic tab navigation template
   * @param {string[]} parts An array of named template parts to render
   * @returns {Record<string, Partial<ApplicationTab>>}
   * @protected
   */
  _getTabs(parts) {
    // If you have sub-tabs this is necessary to change
    const tabGroup = 'primary';

    // Only a power album opens on its album; other gear with the album feature keeps its usual tab
    const defaultTab = this.document.system?.type === GearType.POWER_ALBUM && parts.includes('powerAlbum')
      ? 'album'
      : parts.includes('attributes')
        ? 'attributes'
        : 'description';
    // Default tab for first time it's rendered this session
    if (!this.tabGroups[tabGroup]) this.tabGroups[tabGroup] = defaultTab;
    return parts.reduce((tabs, partId) => {
      const tab = {
        cssClass: '',
        group: tabGroup,
        // Matches tab property to
        id: '',
        // FontAwesome Icon, if you so choose
        icon: '',
        // Run through localization
        label: 'SDM.ItemTab'
      };
      switch (partId) {
        case 'header':
        case 'tabs':
          return tabs;
        case 'description':
          tab.id = 'description';
          tab.label += 'Description';
          tab.icon = 'fa fa-scroll';
          break;
        case 'attributesFeature':
          tab.id = 'attributes';
          tab.label += 'Attributes';
          break;
        case 'powerAlbum':
          tab.id = 'album';
          tab.label += 'Album';
          tab.icon = 'fa fa-book';
          break;
        case 'effects':
          tab.id = 'effects';
          tab.label += 'Effects';
          tab.icon = 'fa fa-bolt';
          break;
        case 'features':
          tab.id = 'features';
          tab.label += 'Features';
          tab.icon = 'fa fa-gears';
          break;
        case 'categories':
          tab.id = 'categories';
          tab.label += 'Categories';
          tab.icon = 'fa fa-tag';
          break;
        case 'gmNotes':
          tab.id = 'gmNotes';
          tab.label += 'GMNotes';
          tab.icon = 'fa fa-user-secret';
          break;
        case 'animation':
          tab.id = 'animation';
          tab.label += 'Animation';
          tab.icon = 'fa fa-ghost';
          break;
      }
      if (this.tabGroups[tabGroup] === tab.id) tab.cssClass = 'active';
      tabs[partId] = tab;
      return tabs;
    }, {});
  }

  /**
   * Actions performed after any render of the Application.
   * Post-render steps are not awaited by the render process.
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   */

  /**
   * Numeric inputs show thousands separators; switch them back to plain
   * numbers while the form is read and submitted.
   * @override
   */
  async _onSubmitForm(formConfig, event) {
    unformatNumberInputs(this.element);
    try {
      return await super._onSubmitForm(formConfig, event);
    } finally {
      reformatNumberInputs(this.element);
    }
  }

  _onRender(context, options) {
    bindNumberInputs(this.element, this.document);
    this.#dragDrop.forEach(d => d.bind(this.element));
    this.#bindAlbum();
    bindCollapsibleSections(this);
    // Roll triggers: an actions panel opened or closed by hand stays that way across re-renders
    this._triggerActionsOpen ??= new Map();
    this.element.querySelectorAll('details.sdm-trigger-actions[data-index]').forEach(details => {
      const index = details.dataset.index;
      if (this._triggerActionsOpen.has(index)) details.open = this._triggerActionsOpen.get(index);
      details.addEventListener('toggle', () => this._triggerActionsOpen.set(index, details.open));
    });
    // Roll triggers: drop a roll table on the table field
    this.element.querySelectorAll('input.sdm-trigger-table').forEach(input => {
      input.addEventListener('dragover', event => event.preventDefault());
      input.addEventListener('drop', async event => {
        event.preventDefault();
        event.stopPropagation();
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        if (data?.type !== 'RollTable' || !data.uuid) return;
        input.value = data.uuid;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    // You may want to add other special handling here
    // Foundry comes with a large number of utility classes, e.g. SearchFilter
    // That you may want to  implement yourself.
    const selectElement = this.element.querySelector('#gearType');
    selectElement?.addEventListener('change', event => {
      const tabs = this.element.querySelectorAll('[data-tab]');
      if (event.target.value !== 'power_album') {
        this.tabGroups['primary'] = 'description';
        for (let t of tabs) {
          if (t.dataset.group && t.dataset.group !== 'primary') continue;
          t.classList.toggle('active', t.dataset.tab === 'description');
        }
      } else {
        this.tabGroups['primary'] = 'album';
        for (let t of tabs) {
          if (t.dataset.group && t.dataset.group !== 'primary') continue;
          t.classList.toggle('active', t.dataset.tab === 'album');
        }
      }
    });

    this.#disableOverrides();
  }

  /** @inheritdoc */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);

    const buttons = [];

    buttons.push(
      constructHTMLButton({
        label: '',
        classes: ['header-control', 'icon', 'fa-solid', 'fa-share-from-square'],
        dataset: { action: 'sendToChat', tooltip: 'SDM.Item.Share' }
      })
    );

    this.window.controls.after(...buttons);

    return frame;
  }

  // async _onSubmitForm(formConfig, event) {
  //   // eslint-disable-next-line no-undef
  //   let formData = new foundry.applications.ux.FormDataExtended(this.element);
  //   const expandedFormData = foundry.utils.expandObject(formData.object);
  //   const { mergeObject, setProperty } = foundry.utils;
  //   expandedFormData.system = mergeObject(expandedFormData.system, this.item.system);
  //   await this.item.update(expandedFormData);
  //   //await super._onSubmitForm(formConfig, event);
  // }

  async _getPowersDescriptions(powers) {
    if (!powers) return {};

    const descriptions = await Promise.all(
      powers?.map(async ({ description }, index) => {
        const enriched = await TextEditor.enrichHTML(description, {
          relativeTo: this.document
          // secrets: this.document.isOwner
        });
        return [index, enriched];
      })
    );
    return Object.fromEntries(descriptions);
  }

  /**************
   *
   *   ACTIONS
   *
   **************/

  /**
   * Handle changing a Document's image.
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onEditImage(event, target) {
    const attr = target.dataset.edit;
    const current = foundry.utils.getProperty(this.document, attr);
    const { img } = this.document.constructor.getDefaultArtwork?.(this.document.toObject()) ?? {};
    const fp = new FilePicker({
      current,
      type: 'image',
      redirectToRoot: img ? [img] : [],
      callback: path => {
        this.document.update({ [attr]: path });
      },
      top: this.position.top + 40,
      left: this.position.left + 10
    });
    return fp.browse();
  }

  /**
   * Handle changing a Document's image.
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onEditPowerImage(event, target) {
    const powerIndex = parseInt(target.dataset.index, 10);
    const current = foundry.utils.getProperty(this.item, target.dataset.edit);

    let changedPowers = foundry.utils.duplicate(this.item.system.powers);

    const { img } =
      this.item.constructor.getDefaultArtwork?.(new PowerDataModel().toObject()) ?? {};

    const fp = new FilePicker({
      current,
      type: 'image',
      redirectToRoot: img ? [img] : [],
      callback: async path => {
        changedPowers = changedPowers.map((power, index) => {
          if (index === powerIndex) {
            return { ...power, img: path };
          }

          return power;
        });

        await this.item.update({
          'system.powers': changedPowers
        });
        return this.render();
      },
      top: this.position.top + 40,
      left: this.position.left + 10
    });
    return fp.browse();
  }

  /**
   * Renders an embedded document's sheet
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _viewEffect(event, target) {
    const effect = this._getEffect(target);
    effect.sheet.render(true);
  }

  /**
   * Handles item deletion
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _deleteEffect(event, target) {
    const effect = this._getEffect(target);
    await effect.delete();
  }

  /**
   * Handle creating a new Owned Item or ActiveEffect for the actor using initial data
   * defined in the HTML dataset
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _createEffect(event, target) {
    // Retrieve the configured document class for ActiveEffect
    const aeCls = getDocumentClass('ActiveEffect');
    // Prepare the document creation data by initializing it a default name.
    // As of v12, you can define custom Active Effect subtypes just like Item subtypes if you want
    const effectData = {
      name: aeCls.defaultName({
        // defaultName handles an undefined type gracefully
        type: target.dataset.type,
        parent: this.item
      })
    };
    // Loop through the dataset and add it to our effectData
    for (const [dataKey, value] of Object.entries(target.dataset)) {
      // These data attributes are reserved for the action handling
      if (['action', 'documentClass'].includes(dataKey)) continue;
      // Nested properties require dot notation in the HTML, e.g. anything with `system`
      // An example exists in spells.hbs, with `data-system.spell-level`
      // which turns into the dataKey 'system.spellLevel'
      foundry.utils.setProperty(effectData, dataKey, value);
    }

    // Finally, create the embedded document!
    await aeCls.create(effectData, { parent: this.item });
  }

  static async _onPrevPower(event, target) {
    const currentIndex = this.item.system.powers_current_index || 0;
    if (currentIndex > 0) {
      await this.item.update({
        'system.powers_current_index': currentIndex - 1
      });
      this.render();
    }
  }

  /** Roll triggers: the whole list is saved (never one element by path). */
  static async _onAddTrigger() {
    const triggers = foundry.utils.duplicate(this.item.system.triggers ?? []);
    // Traits and burdens mostly react to saves; gear to attacks
    const roll = this.item.type === ItemType.GEAR ? 'attack' : 'save';
    triggers.push({ roll, attack: '', ability: '', power: '', condition: 'natural', value: 13, text: '' });
    await this.item.update({ 'system.triggers': triggers });
  }

  static async _onRemoveTrigger(event, target) {
    const triggers = foundry.utils.duplicate(this.item.system.triggers ?? []);
    triggers.splice(parseInt(target.dataset.index, 10), 1);
    await this.item.update({ 'system.triggers': triggers });
  }

  static async _onAddCounter() {
    await promptNewCounter(this.item);
  }

  static async _onStepCounter(event, target) {
    await stepCounter(this.item, target.dataset.key, parseInt(target.dataset.step, 10) || 0);
  }

  static async _onResetCounter(event, target) {
    await resetCounters(this.item, { key: target.dataset.key });
  }

  static async _onRemoveCounter(event, target) {
    await removeCounter(this.item, target.dataset.key);
  }

  /** Album list: use that power (the actor's roll, with that power preselected). */
  static async _onCastPower(event, target) {
    event.stopPropagation();
    const actor = this.item.actor;
    const index = parseInt(target.dataset.index, 10);
    if (!actor?.sheet || !Number.isInteger(index)) return;
    if (index !== (this.item.system.powers_current_index || 0)) {
      await this.item.update({ 'system.powers_current_index': index });
    }
    // The actor sheet's roll reads the item from its inventory row
    const row = document.createElement('li');
    row.dataset.documentClass = 'Item';
    row.dataset.itemId = this.item.id;
    const button = document.createElement('div');
    button.dataset.type = 'power_album';
    button.dataset.label = this.item.name;
    row.append(button);
    const roll = actor.sheet.constructor._onRoll ?? actor.sheet.options?.actions?.roll;
    if (typeof roll === 'function') await roll.call(actor.sheet, event, button);
  }

  /** Copy a power right after it (album limit permitting). */
  static async _onDuplicatePower(event, target) {
    const powers = foundry.utils.duplicate(this.item.system.powers ?? []);
    const index = parseInt(target.dataset.index, 10);
    if (!powers[index]) return;
    if (powers.length >= this.item.system.max_powers) {
      ui.notifications.warn($fmt('SDM.ErrorMaxPowers', { item: this.item.name }));
      return;
    }
    powers.splice(index + 1, 0, foundry.utils.duplicate(powers[index]));
    await this.item.update({ 'system.powers': powers, 'system.powers_current_index': index + 1 });
  }

  /** An empty overcharge is collapsed: show it and start editing. */
  static _onShowOvercharge(event, target) {
    const block = target.closest('.sdm-album-power')?.querySelector('.sdm-album-overcharge');
    if (!block) return;
    block.hidden = false;
    target.hidden = true;
    block.querySelector('prose-mirror button.toggle, prose-mirror .toggle')?.click();
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    // Right-click on a power of the album list
    this._createContextMenu(this._getAlbumContextOptions, '.sdm-album-entry', {
      hookName: 'getAlbumPowerContextOptions',
      parentClassHooks: false,
      fixed: true
    });
  }

  /** Album list menu: duplicate and delete (owner), extract (Referee). */
  _getAlbumContextOptions() {
    const run = (handler, target) => handler.call(this, new Event('click'), target);
    return [
      {
        label: 'SDM.DuplicatePower',
        icon: '<i class="fa-solid fa-clone"></i>',
        visible: () => this.isEditable,
        onClick: (event, target) => run(SdmItemSheet._onDuplicatePower, target)
      },
      {
        label: 'SDM.ExtractPower',
        icon: '<i class="fa-solid fa-file-import"></i>',
        visible: () => game.user.isGM,
        onClick: (event, target) => run(SdmItemSheet._onExtractPower, target)
      },
      {
        label: 'SDM.DeletePower',
        icon: '<i class="fa-solid fa-trash"></i>',
        visible: () => this.isEditable,
        onClick: (event, target) => run(SdmItemSheet._onDeletePower, target)
      }
    ];
  }

  /** Album tab: drop zone highlight and keyboard navigation (↑/↓ or W/S). */
  #bindAlbum() {
    const album = this.element.querySelector('.sdm-album');
    if (!album) return;
    album.addEventListener('dragover', () => album.classList.add('is-dragover'));
    album.addEventListener('dragleave', event => {
      if (!album.contains(event.relatedTarget)) album.classList.remove('is-dragover');
    });
    const list = album.querySelector('.sdm-album-list');
    list?.addEventListener('keydown', async event => {
      const key = event.key.toLowerCase();
      const step = ['arrowup', 'w'].includes(key) ? -1 : ['arrowdown', 's'].includes(key) ? 1 : 0;
      if (!step) return;
      // Not for Foundry's own keys (W/S would also move the canvas)
      event.preventDefault();
      event.stopPropagation();
      const powers = this.item.system.powers ?? [];
      const next = (this.item.system.powers_current_index || 0) + step;
      if (next < 0 || next >= powers.length) return;
      this._focusAlbumList = true;
      await this.item.update({ 'system.powers_current_index': next });
    });
    // Keep the focus on the list after the re-render, to keep moving with the keys
    if (this._focusAlbumList) {
      this._focusAlbumList = false;
      list?.focus();
    }
  }

  /** Move a power to another place in the album, keeping the shown power. */
  async _movePower(from, to) {
    const powers = foundry.utils.duplicate(this.item.system.powers ?? []);
    if (from === to || !powers[from] || to < 0 || to >= powers.length) return;
    const [moved] = powers.splice(from, 1);
    powers.splice(to, 0, moved);
    const current = this.item.system.powers_current_index || 0;
    const shown = current === from ? to : current;
    await this.item.update({ 'system.powers': powers, 'system.powers_current_index': shown });
  }

  /** Album list: show that power. */
  static async _onSelectPower(event, target) {
    const index = parseInt(target.dataset.index, 10);
    if (!Number.isInteger(index) || index === (this.item.system.powers_current_index || 0)) return;
    await this.item.update({ 'system.powers_current_index': index });
    this.render();
  }

  static async _onNextPower(event, target) {
    const currentIndex = this.item.system.powers_current_index || 0;
    const powers = this.item.system.powers || [];
    if (currentIndex < powers.length - 1) {
      await this.item.update({
        'system.powers_current_index': currentIndex + 1
      });
      this.render();
    }
  }

  static newPower(data) {
    const basePower = new PowerDataModel().toObject();
    basePower.name = $fmt('SDM.DOCUMENT.New', { type: $l10n('SDM.Power') });
    if (!data) return basePower;

    const {
      img,
      name,
      level,
      range,
      target,
      duration,
      overcharge,
      overcharge_roll_formula,
      roll_formula,
      default_ability,
      description,
      is_dangerous,
      single_use
    } = data;

    return {
      ...basePower,
      img,
      name,
      description,
      level,
      range,
      target,
      duration,
      overcharge,
      overcharge_roll_formula,
      roll_formula,
      is_dangerous,
      single_use: !!single_use,
      default_ability
    };
  }

  static async _onCreatePower(event, target, data) {
    const powerAlbum = this.item.system.powers;

    if (powerAlbum.length >= this.item.system.max_powers) {
      ui.notifications.warn($fmt('SDM.ErrorMaxPowers', { item: this.item.name }));
      return;
    }

    let newPower = SdmItemSheet.newPower(data);
    const updatedContainer = foundry.utils.duplicate(this.item.system.powers);
    updatedContainer.push(newPower);

    await this.item.update({
      'system.powers': updatedContainer,
      'system.powers_current_index': updatedContainer.length - 1
    });
    this.render();
  }

  static async _onDeletePower(event, target) {
    const powerAlbum = this.item.system.powers;

    const powerIndex = parseInt(target.dataset.index, 10);
    if (powerIndex < 0 || !powerAlbum.length || powerIndex >= powerAlbum.length) {
      return;
    }

    let powerName = powerAlbum[powerIndex].name;

    const proceed = await DialogV2.confirm({
      content: `<b>${$fmt('SDM.DeleteDocConfirmation', { doc: powerName })}</b>`,
      modal: true,
      rejectClose: false,
      yes: { label: $l10n('SDM.ButtonYes') },
      no: { label: $l10n('SDM.ButtonNo') }
    });
    if (!proceed) return;

    let newCurrentIndex;

    if (powerIndex === 0) {
      newCurrentIndex = 0;
    } else if (powerIndex <= powerAlbum.length - 1) {
      newCurrentIndex = powerIndex - 1;
    }

    let updatedContainer = foundry.utils.duplicate(this.item.system.powers);
    updatedContainer.splice(powerIndex, 1);

    await this.item.update({
      'system.powers': updatedContainer,
      'system.powers_current_index': newCurrentIndex
    });
    this.render();
  }

  static async _onExtractPower(event, target) {
    if (!game.user.isGM) return;

    const powerAlbum = this.item.system.powers;

    const powerIndex = parseInt(target.dataset.index, 10);
    if (powerIndex < 0 || !powerAlbum.length || powerIndex >= powerAlbum.length) {
      return;
    }
    const newPowerData = powerToItemData(powerAlbum[powerIndex]);
    const { name } = newPowerData;

    await SdmItem.create(newPowerData);
    ui.notifications.info(
      $fmt('SDM.PowerExtractionComplete', { power: name, power_album: this.item.name })
    );
  }

  /**
   * Determines effect parent to pass to helper
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _toggleEffect(event, target) {
    const effect = this._getEffect(target);
    await effect.update({ disabled: !effect.disabled });
  }

  /**
   * Determines effect parent to pass to helper
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static _radioToggle(event) {
    let target = event.target;
    if (!(target instanceof Element)) return;

    // If click landed on/inside a <label>, resolve the control
    if (target.tagName === 'LABEL' || target.closest('label')) {
      const label = target.tagName === 'LABEL' ? target : target.closest('label');
      const forId = label.getAttribute('for');
      const control =
        label.control ||
        (forId ? document.getElementById(forId) : null) ||
        label.querySelector('input,select,textarea,button,[tabindex]');
      if (control) target = control;
    }

    const isInput = target instanceof HTMLInputElement;
    const isChecked = isInput ? target.checked : false;

    // Use the element you attached the listener to as the search root
    const root = event.currentTarget instanceof HTMLElement ? event.currentTarget : document;

    if (isChecked || event.type === 'contextmenu') {
      // find the next lowest-value radio with the same name and click it
      if (!isInput) return;
      const name = target.name;
      const cur = parseInt(target.value, 10);
      if (!name || Number.isNaN(cur)) {
        target.click();
        return;
      }

      const prevVal = String(cur - 1);
      const selector = `input[type="radio"][name="${name}"][value="${prevVal}"]`;
      const next = root.querySelector(selector) || document.querySelector(selector); // fallback

      if (next instanceof HTMLInputElement) next.click();
    } else {
      if (target instanceof HTMLElement) target.click();
    }
  }

  static async _toggleReadied() {
    await this.item.toggleReadied();
  }

  /** Set the integrity directly (''/notched/broken). Broken items are unequipped. */
  static async _setItemStatus(event, target) {
    const value = target.dataset.value ?? '';
    const update = { 'system.status': value };
    if (value === ItemStatusType.BROKEN) update['system.readied'] = false;
    await this.item.update(update);
  }

  /** Set the resources directly (''/running_low/run_out). */
  static async _setItemResources(event, target) {
    await this.item.toggleItemResources(target.dataset.value ?? '');
  }

  static async _toggleIsHallmark() {
    await this.item.toggleIsHallmark();
  }

  static async _toggleItemStatus(event) {
    await this.item.toggleItemStatus(event);
  }

  /** Colonist: take a creature out of the hexad. */
  static async _onRemoveHexadMember(event, target) {
    const uuid = target.closest('[data-uuid]')?.dataset.uuid;
    const hexad = this.item.getFlag('sdm', 'hexad') ?? [];
    await this.item.setFlag('sdm', 'hexad', hexad.filter(u => u !== uuid));
  }

  static async _onOpenHexadMember(event, target) {
    const actor = await fromUuid(target.closest('[data-uuid]')?.dataset.uuid ?? '');
    actor?.sheet?.render(true);
  }

  /** Colonist: a night in the colonist's vicinity gives each hexad member temporary life equal to the colonist's level. */
  static async _onNightWithHexad() {
    const owner = this.item.actor;
    const level = Number(owner?.system?.level) || 0;
    if (!owner || level <= 0) return;
    const members = (this.item.getFlag('sdm', 'hexad') ?? []).map(uuid => fromUuidSync(uuid)).filter(Boolean);
    if (!members.length) return;
    for (const actor of members) await giveTemporaryLife(actor, level, { name: this.item.name, img: this.item.img });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: owner }),
      content: `<p>${foundry.utils.escapeHTML($fmt('SDM.Hexad.NightDone', { name: owner.name, amount: level, members: members.map(a => a.name).join(', ') }))}</p>`
    });
  }

  /** Leaving the Features tab locks it again. */
  changeTab(tab, group, options) {
    super.changeTab(tab, group, options);
    if (tab !== 'features' && this._featuresEditing) {
      this._featuresEditing = false;
      this.render({ parts: ['features'] });
    }
  }

  /** Features tab: lock / unlock the checkboxes. */
  static _onToggleFeaturesEdit() {
    this._featuresEditing = !this._featuresEditing;
    this.render({ parts: ['features'] });
  }

  static async _onSendToChat(event, target) {
    const actor = this.item.parent ? this.item.parent : null;
    await this.item.sendToChat({ actor, collapsed: false });
  }

  static async _onRequestAnimation() {
    requestAnimation(this.item);
  }

  /** Copy "@items.<identifier>" for use in active effect values. */
  static async _onCopyItemReference(event) {
    event.preventDefault();
    const reference = getItemReference(this.item)?.reference;
    if (!reference) return;
    await game.clipboard.copyPlainText(reference);
    ui.notifications.info($fmt('SDM.Effect.ItemReferenceCopied', { reference }));
  }

  /** The owner's progress history, only this hallmark's entries. */
  static async _onShowProgressLog(event) {
    event.preventDefault();
    if (!this.item.parent) return;
    await openProgressLog(this.item.parent, { subject: `hallmark:${this.item.id}` });
  }

  static async _onChooseHallmarkUpgrade() {
    await openHallmarkUpgradeDialog(this.item);
  }

  static async _onAnimateItem() {
    await animateItem(this.item, { app: this });
  }

  static async _onDeanimateItem() {
    await deanimateItem(this.item);
  }

  static async _onFillAnimationFromTable() {
    if (!this.item.isOwner) return;
    await fillAttributesFromTable(this.item);
  }

  static async _onSpawnNPC(event, target) {
    // let's allow to spawn from table or directly from all attributes
    const item = this.item;
    const itemLevel = Math.max(item.system.hallmark.level, item.system.attributes.level);

    const npcData = await createNPCByLevel({
      name: item.name,
      lvl: itemLevel,
      tableName: 'generic-synthesized-creature',
      image: item.img,
      ownership: item.ownership,
      linked: true,
      biography: `<p>NPC Spawned from: @UUID[${item.uuid}]{${item.name}}</p>`
    });

    // const virtualActor = new SdmActor({
    //   type: 'npc',
    //   name: item.name,
    //   img: item.img,
    //   system: { ...attributes }
    // }).toObject();
  }

  /** Helper Functions */

  /**
   * Fetches the row with the data for the rendered embedded document
   *
   * @param {HTMLElement} target  The element with the action
   * @returns {HTMLLIElement} The document's row
   */
  _getEffect(target) {
    const li = target.closest('.effect');
    return this.item.effects.get(li?.dataset?.effectId);
  }

  /**
   *
   * DragDrop
   *
   */

  /**
   * Define whether a user is able to begin a dragstart workflow for a given drag selector
   * @param {string} selector       The candidate HTML selector for dragging
   * @returns {boolean}             Can the current user drag this selector?
   * @protected
   */
  _canDragStart(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Define whether a user is able to conclude a drag-and-drop workflow for a given drop selector
   * @param {string} selector       The candidate HTML selector for the drop target
   * @returns {boolean}             Can the current user drop on this selector?
   * @protected
   */
  _canDragDrop(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragStart(event) {
    const li = event.currentTarget;
    if ('link' in event.target.dataset) return;

    let dragData = null;

    // A power of the album: dragged out (it becomes a power item) or to another place in the list
    if (li.dataset.powerIndex !== undefined) {
      const index = parseInt(li.dataset.powerIndex, 10);
      const power = this.item.system.powers?.[index];
      if (power) {
        dragData = {
          type: 'Item',
          data: powerToItemData(power),
          sdmAlbum: { uuid: this.item.uuid, index }
        };
      }
    }

    // Active Effect
    if (li.dataset.effectId) {
      const effect = this.item.effects.get(li.dataset.effectId);
      dragData = effect.toDragData();
    }

    if (!dragData) return;

    // Set data transfer
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  /**
   * Callback actions which occur when a dragged element is over a drop target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragOver(event) {}

  /**
   * Callback actions which occur when a dragged element is dropped on a target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    const item = this.item;
    this.element?.querySelector('.sdm-album')?.classList.remove('is-dragover');

    // A power of this album dropped on its own list: reorder (anywhere else on the sheet: nothing)
    if (data?.sdmAlbum?.uuid === item.uuid) {
      const entry = event.target.closest?.('[data-power-index]');
      if (entry) await this._movePower(data.sdmAlbum.index, parseInt(entry.dataset.powerIndex, 10));
      return;
    }
    const allowed = Hooks.call('dropItemSheetData', item, this, data);
    if (allowed === false) return;

    // Handle different data types
    switch (data.type) {
      case 'ActiveEffect':
        return this._onDropActiveEffect(event, data);
      case 'Actor':
        return this._onDropActor(event, data);
      case 'Item':
        return this._onDropItem(event, data);
      case 'Folder':
        return this._onDropFolder(event, data);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle the dropping of ActiveEffect data onto an Actor Sheet
   * @param {DragEvent} event                  The concluding DragEvent which contains drop data
   * @param {object} data                      The data transfer extracted from the event
   * @returns {Promise<ActiveEffect|boolean>}  The created ActiveEffect object
   *                                           or false if it couldn't be created.
   * @protected
   */
  async _onDropActiveEffect(event, data) {
    const aeCls = getDocumentClass('ActiveEffect');
    const effect = await aeCls.fromDropData(data);
    if (!this.item.isOwner || !effect) return false;

    if (this.item.uuid === effect.parent?.uuid) return this._onEffectSort(event, effect);
    return aeCls.create(effect, { parent: this.item });
  }

  /**
   * Sorts an Active Effect based on its surrounding attributes
   *
   * @param {DragEvent} event
   * @param {ActiveEffect} effect
   */
  _onEffectSort(event, effect) {
    const effects = this.item.effects;
    const dropTarget = event.target.closest('[data-effect-id]');
    if (!dropTarget) return;
    const target = effects.get(dropTarget.dataset.effectId);

    // Don't sort on yourself
    if (effect.id === target.id) return;

    // Identify sibling items based on adjacent HTML elements
    const siblings = [];
    for (let el of dropTarget.parentElement.children) {
      const siblingId = el.dataset.effectId;
      if (siblingId && siblingId !== effect.id) siblings.push(effects.get(el.dataset.effectId));
    }

    // Perform the sort
    const sortUpdates = performIntegerSort(effect, {
      target,
      siblings
    });
    const updateData = sortUpdates.map(u => {
      const update = u.update;
      update._id = u.target._id;
      return update;
    });

    // Perform the update
    return this.item.updateEmbeddedDocuments('ActiveEffect', updateData);
  }

  /**
   * Opens the Actor sheet of the Actor linked to this Pet item.
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @protected
   */
  static async _onOpenPetActor(event, target) {
    const petUuid = this.item.system.pet;
    if (!petUuid) return;

    const actor = await fromUuid(petUuid);
    if (!actor) {
      ui.notifications.warn($l10n('SDM.WarningPetActorMissing'));
      return;
    }
    actor.sheet.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping of an Actor data onto another Actor sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<object|boolean>}  A data object which describes the result of the drop,
   *                                     or false if the drop was not permitted.
   * @protected
   */
  async _onDropActor(event, data) {
    if (!this.item.isOwner) return false;
    // Colonist: a creature dropped on the trait joins the hexad (up to five, not the colonist)
    if (getItemIdentifier(this.item) === 'colonist' && this.item.actor) {
      const actor = await fromUuid(data.uuid);
      if (actor?.documentName !== 'Actor' || actor === this.item.actor) return false;
      const hexad = this.item.getFlag('sdm', 'hexad') ?? [];
      if (hexad.includes(actor.uuid)) return false;
      if (hexad.length >= HEXAD_MAX) {
        ui.notifications.warn($fmt('SDM.Hexad.Full', { max: HEXAD_MAX }));
        return false;
      }
      return this.item.setFlag('sdm', 'hexad', [...hexad, actor.uuid]);
    }
    // Animated items: the Referee drops the NPC the item turns into
    if (isAnimatable(this.item)) {
      const actor = await fromUuid(data.uuid);
      if (actor?.type === ActorType.NPC) return linkNpcToItem(this.item, actor);
    }
    if (this.item.system.type !== GearType.PET) return false;

    if (this.item.system.pet) {
      ui.notifications.warn($fmt('SDM.WarningPetAlreadyLinked', { pet: this.item.name }));
      return false;
    }

    const droppedActor = await fromUuid(data.uuid);
    if (droppedActor?.documentName !== 'Actor') return false;

    // A compendium pet item (delivered ready to use) points at a compendium actor: nothing is
    // imported now, each copy imports its own pet when it joins an actor. It keeps its own name and
    // description; the actor's image replaces only the default pet icon.
    if (this.item.pack) {
      if (!droppedActor.pack) {
        ui.notifications.warn($l10n('SDM.Pet.CompendiumNeedsCompendiumActor'));
        return false;
      }
      await this.item.update({
        'system.pet': droppedActor.uuid,
        ...(this.item.img === DEFAULT_PET_ICON && { img: droppedActor.img })
      });
      return;
    }

    if (!this.item?.parent || this.item?.parent?.id === droppedActor.id) return false;
    // A compendium actor dropped on an item of an actor: linked now, imported by the Referee
    // (petLinks.mjs) into the "Pets" folder right after

    const { name: petName, img: petImg, system: petData } = droppedActor;
    const { biography: petBiography } = petData;
    const originalDescription = this.item.system.description ?? '';

    const description = `${originalDescription}${petBiography ?? ''}`;

    await this.item.update({
      name: petName,
      img: petImg,
      'system.pet': droppedActor.uuid,
      'system.description': description,
      'flags.sdm.originalDescription': originalDescription
    });
    // A character's pet is on its side
    if (this.item.parent?.type === ActorType.CHARACTER && !droppedActor.pack) await makeNpcFriendly(droppedActor);
  }

  /**
   * Unlinks the Actor currently linked to a Pet item, restoring the item
   * to a plain, unnamed Gear with the default pet artwork and reverting
   * the description to its pre-drop state.
   *
   * @this SdmItemSheet
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @protected
   */
  static async _onUnlinkActor(event, target) {
    const petUuid = this.item.system.pet;
    if (!petUuid) return;

    const proceed = await DialogV2.confirm({
      content: `<b>${$fmt('SDM.UnlinkPetConfirmation', { pet: this.item.name })}</b>`,
      modal: true,
      rejectClose: false,
      yes: { label: $l10n('SDM.ButtonYes') },
      no: { label: $l10n('SDM.ButtonNo') }
    });
    if (!proceed) return;

    const originalDescription = this.item.getFlag('sdm', 'originalDescription');
    const originalItem = this.item.type;
    await this.item.update({
      name: $l10n(`TYPES.Item.${originalItem}`),
      img: DEFAULT_PET_ICON,
      'system.pet': '',
      // Only touch the description if we actually stashed an original
      ...(originalDescription !== undefined && {
        'system.description': originalDescription
      }),
      'flags.sdm.originalDescription': new foundry.data.operators.ForcedDeletion()
    });

    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping of an item reference or item data onto an Actor Sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<Item[]|boolean>}  The created or updated Item instances,
   *                                     or false if the drop was not permitted.
   * @protected
   */
  async _onDropItem(event, data) {
    if (!this.item.isOwner) return false;
    // Dragged power data without a document (a caught power, a power dragged out of an album)
    const droppedItem =
      !data?.uuid && data?.data ? new Item.implementation(data.data) : await Item.implementation.fromDropData(data);

    // A power dropped on gear with an album (power album or album feature) joins its powers
    if (!hasPowerAlbum(this.item) || droppedItem?.system?.type !== GearType.POWER) {
      return false;
    }

    const {
      level,
      range,
      target,
      duration,
      overcharge,
      overcharge_roll_formula,
      roll_formula,
      is_dangerous,
      single_use,
      default_ability
    } = droppedItem.system.power;
    const { description } = droppedItem.system;
    const { img, name } = droppedItem;

    await SdmItemSheet._onCreatePower.call(this, null, null, {
      level,
      range,
      target,
      duration,
      overcharge,
      overcharge_roll_formula,
      roll_formula,
      default_ability,
      img,
      name,
      is_dangerous,
      // A power caught from the chat is single use
      single_use: !!single_use || !!data.sdmCaught,
      description
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping of a Folder on an Actor Sheet.
   * The core sheet currently supports dropping a Folder of Items to create all items as owned items.
   * @param {DragEvent} event     The concluding DragEvent which contains drop data
   * @param {object} data         The data transfer extracted from the event
   * @returns {Promise<Item[]>}
   * @protected
   */
  async _onDropFolder(event, data) {
    if (!this.item.isOwner) return [];
  }

  /** The following pieces set up drag handling and are unlikely to need modification  */

  /**
   * Returns an array of DragDrop instances
   * @type {DragDrop[]}
   */
  get dragDrop() {
    return this.#dragDrop;
  }

  // This is marked as private because there's no real need
  // for subclasses or external hooks to mess with it directly
  #dragDrop;

  /**
   * Create drag-and-drop workflow handlers for this Application
   * @returns {DragDrop[]}     An array of DragDrop handlers
   * @private
   */
  #createDragDropHandlers() {
    return this.options.dragDrop.map(d => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this)
      };
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this)
      };
      return new DragDrop(d);
    });
  }

  /**
   * Submit a document update based on the processed form data.
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {object} submitData                   Processed and validated form data to be used
   *                                              for a document update
   * @returns {Promise<void>}
   * @protected
   * @override
   */
  /** Ride stats card: fill the stats from the ride's table at its level now. */
  static async _onRefillRideStats(event) {
    event.preventDefault();
    await refillRideStats(this.item);
  }

  async _processSubmitData(event, form, submitData) {
    const overrides = foundry.utils.flattenObject(this.item.overrides);
    for (let k of Object.keys(overrides)) delete submitData[k];
    await this.document.update(submitData);
  }

  /**
   * Disables inputs subject to active effects
   */
  #disableOverrides() {
    const flatOverrides = foundry.utils.flattenObject(this.item.overrides);
    for (const override of Object.keys(flatOverrides)) {
      const input = this.element.querySelector(`[name="${override}"]`);
      if (input) {
        input.disabled = true;
      }
    }
  }
}
