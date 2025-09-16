// base-settings.mjs
const ApplicationV2 = foundry.applications?.api?.ApplicationV2 ?? class {};
const HandlebarsApplicationMixin =
  foundry.applications?.api?.HandlebarsApplicationMixin ?? (cls => cls);
const { FilePathField } = foundry.data.fields || {};

export default class BaseSettingsConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static get NAMESPACE() {
    return 'sdm';
  }

  static DEFAULT_OPTIONS = {
    tag: 'form',
    window: { contentClasses: ['standard-form'], resizable: true },
    position: { width: 960 },
    form: { closeOnSubmit: true, submitOnChange: false },
    actions: {}
  };

  constructor(options = {}) {
    super(options);
    // Garanta que handler e actions existam e apontem para métodos da INSTÂNCIA
    this.options.form ??= {};
    this.options.form.handler = this._onCommitChanges.bind(this);

    this.options.actions ??= {};
    this.options.actions.pickFile = this._onPickFile.bind(this);
    this.options.actions.cancel = this._onCancel.bind(this); // << aqui
  }

  static PARTS = {
    config: { template: 'systems/sdm/templates/settings/base-config.hbs' },
    footer: { template: 'templates/generic/form-footer.hbs' }
  };

  static get ALL_KEYS() {
    return this.KEYS;
  }

  async _preparePartContext(partId, context, options) {
    context ??= {};
    context.buttons ??= [
      { type: 'submit', icon: 'fa-solid fa-save', label: 'Save Changes' },
      { type: 'cancel', action: 'cancel', icon: 'fa-solid fa-xmark', label: 'Cancel' }
    ];
    return context;
  }

  createSettingField(name) {
    const ns = this.constructor.NAMESPACE ?? 'sdm';
    const def = game.settings.settings.get(`${ns}.${name}`);
    if (!def) throw new Error(`Setting \`${ns}.${name}\` not registered.`);

    const value = game.settings.get(ns, name);
    const label = def.name ? game.i18n.localize(def.name) : name;
    const hint = def.hint ? game.i18n.localize(def.hint) : '';

    if (def.choices && typeof def.choices === 'object') {
      const opts = Object.entries(def.choices)
        .map(([val, lab]) => {
          const text = typeof lab === 'string' ? game.i18n.localize(lab) : String(lab);
          const sel = String(value) === String(val) ? ' selected' : '';
          return `<option value="${foundry.utils.escapeHTML(val)}"${sel}>${foundry.utils.escapeHTML(text)}</option>`;
        })
        .join('');
      return { key: name, label, hint, inputHTML: `<select name="${name}">${opts}</select>` };
    }

    if (FilePathField && def.type instanceof FilePathField) {
      const cat = (def.type.options?.categories?.[0] ?? 'IMAGE').toLowerCase();
      const pickerType = cat.includes('audio')
        ? 'audio'
        : cat.includes('video')
          ? 'video'
          : 'image';
      return {
        key: name,
        label,
        hint,
        inputHTML: `
          <div class="flexrow">
            <input type="text" name="${name}" value="${foundry.utils.escapeHTML(value ?? '')}">
            <a class="button" data-action="pickFile" data-target="${name}" data-picker="${pickerType}">
              <i class="fas fa-file-import"></i>
            </a>
          </div>`
      };
    }

    if (def.type === Boolean) {
      const checked = value ? ' checked' : '';
      return {
        key: name,
        label,
        hint,
        inputHTML: `<input type="checkbox" name="${name}"${checked}>`
      };
    }
    if (def.type === Number) {
      return {
        key: name,
        label,
        hint,
        inputHTML: `<input type="number" name="${name}" value="${value ?? 0}">`
      };
    }
    if (def.type === String) {
      return {
        key: name,
        label,
        hint,
        inputHTML: `<input type="text" name="${name}" value="${foundry.utils.escapeHTML(value ?? '')}">`
      };
    }

    const json = foundry.utils.escapeHTML(JSON.stringify(value ?? {}, null, 2));
    return {
      key: name,
      label,
      hint,
      inputHTML: `<textarea name="${name}" rows="3">${json}</textarea>`
    };
  }

  // ACTION (instância)
  _onPickFile(event, button) {
    const pickerType = button.dataset.picker || 'image';
    const target = button.dataset.target;
    const form = button.closest('form');
    const input = form?.elements?.namedItem?.(target);

    const fp = new FilePicker({
      type: pickerType,
      current: input?.value ?? '',
      callback: path => {
        if (input) input.value = path;
      }
    });
    fp.render(true);
  }

  _onCancel(event, button) {
    event?.preventDefault();
    event?.stopPropagation();
    this.close();
  }

  // HANDLER (instância)
  // BaseSettingsConfig.js (ou onde estiver seu handler)
  async _onCommitChanges(event, form, formData) {
    const cls = this.constructor;
    const ns = cls.NAMESPACE ?? 'sdm';

    if (event?.submitter?.dataset?.action === 'cancel') return;

    // Pega os valores do formulário (achatado -> objeto)
    const data = foundry.utils.expandObject(formData.object ?? {});

    // Checkboxes não marcados -> false (precisa da lista de chaves do grupo)
    const allKeys = Array.isArray(cls.ALL_KEYS) ? cls.ALL_KEYS : [];
    for (const key of allKeys) {
      const def = game.settings.settings.get(`${ns}.${key}`);
      if (def?.type === Boolean && !(key in data)) data[key] = false;
    }

    const samePrim = (a, b) => a === b || (Number.isNaN(a) && Number.isNaN(b));

    let needsClientReload = false;
    let needsWorldReload = false;

    for (const [key, raw] of Object.entries(data)) {
      const def = game.settings.settings.get(`${ns}.${key}`);
      if (!def) continue;

      // Coerções por tipo
      let next = raw;
      if (def.type === Number) next = Number(next);
      else if (def.type === Boolean) next = !!next;
      else if (def.type === Object) {
        // Se você renderiza Object como textarea JSON, parse aqui
        if (typeof next === 'string') {
          try {
            next = JSON.parse(next);
          } catch {
            /* mantém string se inválido */
          }
        }
      }
      // Strings (inclui FilePathField) ficam como estão

      const before = game.settings.get(ns, key);

      // Verifica mudança
      let changed = false;
      if (def.type === Object) {
        const a = before && typeof before === 'object' ? before : {};
        const b = next && typeof next === 'object' ? next : {};
        const diff = foundry.utils.diffObject(a, b);
        changed = Object.keys(diff).length > 0;
      } else {
        changed = !samePrim(before, next);
      }
      if (!changed) continue;

      // Persiste
      await game.settings.set(ns, key, next);

      // Coleta flags de reload
      if (def.requiresReload) {
        if (def.scope === 'world') needsWorldReload = true;
        else needsClientReload = true;
      }
    }

    if (needsClientReload || needsWorldReload) {
      return SettingsConfig.reloadConfirm({ world: needsWorldReload });
    }
  }
}
