import { $l10n } from '../helpers/globalUtils.mjs';
import { templatePath } from '../helpers/templates.mjs';

const { ActiveEffectConfig } = foundry.applications.sheets;
const { renderTemplate } = foundry.applications.handlebars;

export default class SdmActiveEffectConfig14 extends ActiveEffectConfig {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: ['sheet', 'active-effect-sheet'],
    position: { width: 650 },
    form: { closeOnSubmit: false, submitOnClose: true, submitOnChange: true }
  };

  static PARTS = foundry.utils.mergeObject(
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

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId === 'details') {
      context.fields.isItemMod = this.document.system.schema.fields.isItemMod;
      context.fields.modType = this.document.system.schema.fields.modType;
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

    const selectableKeys = isTransfer ? characterProperties : itemProperties;
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
