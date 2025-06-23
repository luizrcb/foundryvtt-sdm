const { ActiveEffectConfig } = foundry.applications.sheets;

export default class SdmActiveEffectConfig extends ActiveEffectConfig {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: ['sheet', 'active-effect-sheet'],
    position: { width: 585 },
    form: { closeOnSubmit: false, submitOnClose: true, submitOnChange: true },
  };

  static PARTS = {
    ...super.PARTS,
    changes: {
      template: 'systems/sdm/templates/app/active-effect/changes.hbs',
      scrollable: ['ol[data-changes]'],
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const characterProperties = CONFIG.SDM.characterPropertiesToActiveEffects.map(item => ({
      "value": item,
      "label": game.i18n.localize(`SDM.EffectsLabel.${item}`),
    }));

    context.selectableKeys = [
      ...characterProperties,
    ];
    return context;
  }

  async _preparePartContext(partId, context) {
    return await super._preparePartContext(partId, context);
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);

    delete parts.footer;

    return parts;
  }
}
