import { templatePath } from '../helpers/templates.mjs';

const { ActiveEffectConfig } = foundry.applications.sheets;
const { renderTemplate } = foundry.applications.handlebars;

export default class SdmActiveEffectConfig14 extends ActiveEffectConfig {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: ['sheet', 'active-effect-sheet'],
    position: { width: 600 },
    form: { closeOnSubmit: false, submitOnClose: true, submitOnChange: true }
  };

  static PARTS = {
    ...super.PARTS,
    changes: {
      template: templatePath('app/active-effect/changesv14'),
      scrollable: ['ol[data-changes]']
    }
  };

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
      label: _loc(`SDM.EffectsLabel.${item}`)
    }));

    const selectableKeys = [...characterProperties];
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
