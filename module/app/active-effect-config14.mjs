import { templatePath } from '../helpers/templates.mjs';

const { ActiveEffectConfig } = foundry.applications.sheets;

export default class SdmActiveEffectConfig14 extends ActiveEffectConfig {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: ['sheet', 'active-effect-sheet'],
    position: { width: 585 },
    form: { closeOnSubmit: false, submitOnClose: true, submitOnChange: true }
  };

  static PARTS = {
    ...super.PARTS,
    changes: {
      template: templatePath('app/active-effect/changesv14'),
      templates: [templatePath('app/active-effect/change')],
      scrollable: ['ol[data-changes]']
    }
  };

  // async _prepareContext(options) {
  //   const context = await super._prepareContext(options);

  //   const characterProperties = CONFIG.SDM.characterPropertiesToActiveEffects.map(item => ({
  //     value: item,
  //     label: game.i18n.localize(`SDM.EffectsLabel.${item}`)
  //   }));

  //   context.selectableKeys = [...characterProperties];
  //   return context;
  // }

  /** @inheritDoc */
  async _preparePartContext(partId, context) {
    return await super._preparePartContext(partId, context);
  }

  /**
   * Prepare render context for a single change object.
   * @param {EffectChangeData} change A copy of the change from the Effect's source array.
   * @param {number} index            The change object's index in the array
   * @param {Record<string, DataField>} fields DataFields for the core change types
   * @returns {Promise<string>}
   * @protected
   */
  async _prepareChangeContext(change, index, fields) {
    if (typeof change.value !== 'string') change.value = JSON.stringify(change.value);
    const defaultPriority = ActiveEffect.CHANGE_TYPES[change.type]?.defaultPriority;
    Object.assign(
      change,
      ['key', 'type', 'value', 'priority'].reduce((paths, fieldName) => {
        paths[`${fieldName}Path`] = `system.changes.${index}.${fieldName}`;
        return paths;
      }, {})
    );

    const characterProperties = CONFIG.SDM.characterPropertiesToActiveEffects.map(item => ({
      value: item,
      label: _loc(`SDM.EffectsLabel.${item}`)
    }));

    const changeTypes = Object.entries(ActiveEffect.CHANGE_TYPES)
      .map(([type, { label }]) => ({ type, label: _loc(label) }))
      .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
      .reduce((types, { type, label }) => {
        types[type] = label;
        return types;
      }, {});

    const selectableKeys = [...characterProperties];

    return (
      ActiveEffect.CHANGE_TYPES[change.type].render?.(change, index, defaultPriority) ??
      renderTemplate(templatePath('app/active-effect/change'), {
        change,
        index,
        defaultPriority,
        fields,
        selectableKeys,
        changeTypes
      })
    );
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);

    delete parts.footer;

    return parts;
  }
}
