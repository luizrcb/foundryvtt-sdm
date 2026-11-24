import { SdmActor } from '../documents/actor.mjs';
import { $l10n } from '../helpers/globalUtils.mjs';
import { templatePath } from '../helpers/templates.mjs';
import { featureEnabled } from '../helpers/features.mjs';
import { triggerEditorContext } from '../sheets/item-sheet.mjs';

const { ActiveEffectConfig } = foundry.applications.sheets;
const { renderTemplate } = foundry.applications.handlebars;

export default class SdmActiveEffectConfig14 extends ActiveEffectConfig {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: ['sheet', 'active-effect-sheet'],
    position: { width: 650 },
    form: { closeOnSubmit: false, submitOnClose: true, submitOnChange: true },
    actions: {
      addTrigger: SdmActiveEffectConfig14.#onAddTrigger,
      removeTrigger: SdmActiveEffectConfig14.#onRemoveTrigger
    }
  };

  // Item mods get a Triggers tab (before the footer)
  static PARTS = (() => {
    const { footer, ...parts } = foundry.utils.mergeObject(
      super.PARTS,
      {
        details: {
          template: templatePath('app/active-effect/details'),
          scrollable: ['']
        },
        changes: {
          template: templatePath('app/active-effect/changesv14'),
          scrollable: ['ol[data-changes]']
        }
      },
      { inplace: false }
    );
    return { ...parts, triggers: { template: templatePath('app/active-effect/triggers'), scrollable: [''] }, footer };
  })();

  static TABS = foundry.utils.mergeObject(
    super.TABS,
    { sheet: { tabs: [...super.TABS.sheet.tabs, { id: 'triggers', icon: 'fa-solid fa-bolt', label: 'SDM.Trigger.Title' }] } },
    { inplace: false }
  );

  /** A mod on an item (with roll triggers on): its triggers can be edited here. */
  get showsTriggers() {
    return this.document.parent?.documentName === 'Item' && !!this.document.system?.isItemMod && featureEnabled('triggers');
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (!this.showsTriggers) delete parts.triggers;
    return parts;
  }

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (group === 'sheet' && !this.showsTriggers) delete tabs.triggers;
    return tabs;
  }

  /** Mod triggers: the whole list is saved (never one element by path). */
  static async #onAddTrigger() {
    const triggers = foundry.utils.duplicate(this.document.system.triggers ?? []);
    triggers.push({ roll: 'attack', attack: '', ability: '', power: '', condition: 'success', value: '13', text: '' });
    await this.document.update({ 'system.triggers': triggers });
  }

  static async #onRemoveTrigger(event, target) {
    const triggers = foundry.utils.duplicate(this.document.system.triggers ?? []);
    triggers.splice(parseInt(target.dataset.index, 10), 1);
    await this.document.update({ 'system.triggers': triggers });
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId === 'triggers') {
      const item = this.document.parent;
      const triggers = this.document.system.triggers ?? [];
      Object.assign(context, triggerEditorContext(item, triggers), {
        tab: context.tabs?.triggers,
        system: this.document.system,
        item,
        editable: this.isEditable,
        isGM: game.user.isGM
      });
    }
    if (partId === 'details') {
      context.fields.isItemMod = this.document.system.schema.fields.isItemMod;
      context.fields.modType = this.document.system.schema.fields.modType;
      context.fields.modCost = this.document.system.schema.fields.modCost;
      context.fields.modCostPerCapacity = this.document.system.schema.fields.modCostPerCapacity;
      context.fields.isHallmarkUpgrade = this.document.system.schema.fields.isHallmarkUpgrade;
      // Aura: on effects that reach an actor (actor effects and item effects transferred to the bearer)
      context.fields.aura = this.document.system.schema.fields.aura?.fields;
      context.fields.roundDamage = this.document.system.schema.fields.roundDamage?.fields;
      const parent = this.document.parent;
      context.canAura = !!context.fields.aura && !this.document.getFlag('sdm', 'fromAura') && (parent?.documentName === 'Actor' || this.document.transfer);
      context.itemModTypes = Object.entries(CONFIG.SDM.itemModType).map(([k, value]) => ({
        value: k,
        label: $l10n(value)
      }));
    }
    return context;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    return context;
  }

  async _renderChange(context) {
    const { change, index } = context;

    if (typeof change.value !== 'string') change.value = JSON.stringify(change.value);
    Object.assign(
      change,
      ['key', 'type', 'value', 'phase', 'priority'].reduce((paths, fieldName) => {
        paths[`${fieldName}Path`] = `system.changes.${index}.${fieldName}`;
        return paths;
      }, {})
    );

    const characterProperties = CONFIG.SDM.characterPropertiesToActiveEffects.map(item => ({
      value: item,
      label: _loc(`SDM.ActorEffectsLabel.${item}`)
    }));

    const itemProperties = CONFIG.SDM.itemPropertiesToActiveEffects.map(item => ({
      value: item,
      label: _loc(`SDM.ItemEffectsLabel.${item}`)
    }));

    const isTransfer = this.document.transfer === true;
    const isActorEffect = !!(this.document?.parent && this.document?.parent instanceof SdmActor);

    const selectableKeys = isTransfer || isActorEffect ? characterProperties : itemProperties;
    context.selectableKeys = selectableKeys;

    return (
      CONFIG.ActiveEffect.changeTypes[change.type]?.render?.(context) ??
      renderTemplate(templatePath('app/active-effect/change'), context)
    );
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);

    delete parts.footer;

    return parts;
  }
}
