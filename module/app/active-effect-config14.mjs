import { SdmActor } from '../documents/actor.mjs';
import { $l10n } from '../helpers/globalUtils.mjs';
import { templatePath } from '../helpers/templates.mjs';
import { featureEnabled } from '../helpers/features.mjs';
import { bindTriggerDrops, triggerEditorContext } from '../sheets/item-sheet.mjs';
import { visionModeChoices, visionSenseChoices } from '../helpers/vision.mjs';

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
    return {
      ...parts,
      triggers: { template: templatePath('app/active-effect/triggers'), scrollable: [''] },
      form: { template: templatePath('app/active-effect/form'), scrollable: [''] },
      vision: { template: templatePath('app/active-effect/vision'), scrollable: [''] },
      footer
    };
  })();

  static TABS = foundry.utils.mergeObject(
    super.TABS,
    {
      sheet: {
        tabs: [
          ...super.TABS.sheet.tabs,
          { id: 'triggers', icon: 'fa-solid fa-bolt', label: 'SDM.Trigger.Title' },
          { id: 'form', icon: 'fa-solid fa-paw', label: 'SDM.Form.Title' },
          { id: 'vision', icon: 'fa-solid fa-eye', label: 'SDM.Vision.Title' }
        ]
      }
    },
    { inplace: false }
  );

  /** A mod on an item (with roll triggers on): its triggers can be edited here. */
  get showsTriggers() {
    return this.document.parent?.documentName === 'Item' && !!this.document.system?.isItemMod && featureEnabled('triggers');
  }

  /** Vision: on any effect that can reach an actor (not item mods, not aura copies). */
  get showsVision() {
    const parent = this.document.parent;
    return !this.document.system?.isItemMod && !this.document.getFlag('sdm', 'fromAura') && !!this.document.system?.schema?.fields?.vision && ['Actor', 'Item'].includes(parent?.documentName);
  }

  /** A form: on any effect that can reach an actor (not item mods, not aura copies). */
  get showsForm() {
    const parent = this.document.parent;
    return !this.document.system?.isItemMod && !this.document.getFlag('sdm', 'fromAura') && !!this.document.system?.schema?.fields?.form && ['Actor', 'Item'].includes(parent?.documentName);
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    if (!this.showsTriggers) delete parts.triggers;
    if (!this.showsForm) delete parts.form;
    if (!this.showsVision) delete parts.vision;
    return parts;
  }

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (group === 'sheet' && !this.showsTriggers) delete tabs.triggers;
    if (group === 'sheet' && !this.showsForm) delete tabs.form;
    if (group === 'sheet' && !this.showsVision) delete tabs.vision;
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
    if (partId === 'vision') {
      const vision = this.document.system.vision ?? {};
      Object.assign(context, {
        tab: context.tabs?.vision,
        vision,
        visionModes: visionModeChoices(),
        visionSenses: visionSenseChoices().map(sense => ({ ...sense, checked: !!vision.senses?.[sense.id] }))
      });
    }
    if (partId === 'form') {
      const form = this.document.system.form ?? {};
      const named = uuid => ({ uuid, name: fromUuidSync(uuid)?.name ?? uuid });
      Object.assign(context, {
        tab: context.tabs?.form,
        form,
        formGrants: (form.grants ?? []).map(named),
        formCreature: form.creature ? named(form.creature) : null,
        formKeeps: { everything: 'SDM.Form.Keeps.everything', mind: 'SDM.Form.Keeps.mind', nothing: 'SDM.Form.Keeps.nothing' },
        formPowers: { usable: 'SDM.Form.Powers.usable', off: 'SDM.Form.Powers.off' },
        formUses: { fresh: 'SDM.Form.Uses.fresh', remembered: 'SDM.Form.Uses.remembered' },
        formSpeeds: CONFIG.SDM.reverseSpeedValues,
        formAbilities: Object.entries(CONFIG.SDM.abilities).map(([key, label]) => ({ key, label, value: form.abilities?.[key] ?? null })),
        editable: this.isEditable
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
      context.fields.turnHeal = this.document.system.schema.fields.turnHeal?.fields;
      context.fields.activeWhile = this.document.system.schema.fields.activeWhile;
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

  async _onRender(context, options) {
    await super._onRender(context, options);
    // Mod triggers: drops on the Table and Summon fields
    bindTriggerDrops(this.element);
    this.#bindFormDrops();
  }

  /** Form tab: items dropped on Grants join it, an NPC dropped on Creature becomes it; × removes them. */
  #bindFormDrops() {
    const root = this.element;
    const drop = (selector, accepts, apply) =>
      root.querySelectorAll(selector).forEach(zone => {
        zone.addEventListener('dragover', event => event.preventDefault());
        zone.addEventListener('drop', async event => {
          event.preventDefault();
          event.stopPropagation();
          const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
          if (!accepts(data) || !data.uuid) return;
          await apply(data.uuid);
        });
      });
    drop('.sdm-form-grants', data => data?.type === 'Item', async uuid => {
      const grants = [...(this.document.system.form?.grants ?? [])];
      if (!grants.includes(uuid)) grants.push(uuid);
      await this.document.update({ 'system.form.grants': grants });
    });
    drop('.sdm-form-creature', data => data?.type === 'Actor', uuid => this.document.update({ 'system.form.creature': uuid }));
    root.querySelectorAll('[data-form-remove-grant]').forEach(button =>
      button.addEventListener('click', async event => {
        event.preventDefault();
        const grants = (this.document.system.form?.grants ?? []).filter(uuid => uuid !== button.dataset.formRemoveGrant);
        await this.document.update({ 'system.form.grants': grants });
      })
    );
    root.querySelector('[data-form-remove-creature]')?.addEventListener('click', async event => {
      event.preventDefault();
      await this.document.update({ 'system.form.creature': '' });
    });
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
