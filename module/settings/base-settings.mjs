import { $l10n } from '../helpers/globalUtils.mjs';

// base-settings.mjs
const ApplicationV2 = foundry.applications?.api?.ApplicationV2 ?? class {};
const HandlebarsApplicationMixin =
  foundry.applications?.api?.HandlebarsApplicationMixin ?? (cls => cls);
const { FilePathField } = foundry.data.fields || {};
const FilePicker = foundry.applications.apps.FilePicker.implementation;

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
    this.options.actions.cancel = this._onCancel.bind(this);
    this.options.actions.resetDefaults = this._onResetDefaults.bind(this);
    this.options.actions.previewAudio = this._onPreviewAudio.bind(this);
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
      {
        type: 'button',
        action: 'resetDefaults',
        icon: 'fa-solid fa-rotate-left',
        label: 'SETTINGS.Reset'
      },
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

      const safeVal = foundry.utils.escapeHTML(value ?? '');

      // For image pickers: show image preview
      if (pickerType === 'image') {
        const previewImg = `<img data-preview-for="${name}" src="${safeVal}" alt="" width="32" height="32"
            style="width:32px;height:32px;object-fit:contain;margin-right:8px;${value ? '' : 'display:none'}">`;

        return {
          key: name,
          label,
          hint,
          inputHTML: `
          <div class="flexrow setting-filepicker">
            ${previewImg}
            <input type="text" name="${name}" value="${safeVal}" class="file-path-input">
            <a class="button" data-action="pickFile" data-target="${name}" data-picker="${pickerType}">
              <i class="fas fa-file-import"></i>
            </a>
          </div>`
        };
      }

      // For audio pickers: show audio preview with controls
      if (pickerType === 'audio') {
        const audioPlayer = value
          ? `
          <div class="audio-preview" data-preview-for="${name}" style="margin-right:8px;">
            <audio controls style="height:32px; max-width:200px;">
              <source src="${safeVal}" type="audio/mpeg">
              ${game.i18n.localize('SDM.Settings.AudioNotSupported')}
            </audio>
          </div>
        `
          : `<div class="audio-preview" data-preview-for="${name}" style="display:none; margin-right:8px;"></div>`;

        return {
          key: name,
          label,
          hint,
          inputHTML: `
          <div class="flexrow setting-filepicker">
            ${audioPlayer}
            <input type="text" name="${name}" value="${safeVal}" class="file-path-input">
            <a class="button" data-action="pickFile" data-target="${name}" data-picker="${pickerType}">
              <i class="fas fa-file-import"></i>
            </a>
          </div>`
        };
      }

      // For video pickers (optional, if you want video preview)
      if (pickerType === 'video') {
        const videoPlayer = value
          ? `
          <div class="video-preview" data-preview-for="${name}" style="margin-right:8px;">
            <video width="64" height="36" style="object-fit:contain;">
              <source src="${safeVal}" type="video/mp4">
              ${game.i18n.localize('SDM.Settings.VideoNotSupported')}
            </video>
          </div>
        `
          : `<div class="video-preview" data-preview-for="${name}" style="display:none; margin-right:8px;"></div>`;

        return {
          key: name,
          label,
          hint,
          inputHTML: `
          <div class="flexrow setting-filepicker">
            ${videoPlayer}
            <input type="text" name="${name}" value="${safeVal}" class="file-path-input">
            <a class="button" data-action="pickFile" data-target="${name}" data-picker="${pickerType}">
              <i class="fas fa-file-import"></i>
            </a>
          </div>`
        };
      }
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
    const input = form?.querySelector(`input[name="${target}"]`);

    const fp = new FilePicker({
      type: pickerType,
      current: input?.value ?? '',
      callback: path => {
        if (input) input.value = path;

        // Update preview based on picker type
        const previewContainer = form?.querySelector(`[data-preview-for="${CSS.escape(target)}"]`);
        if (!previewContainer) return;

        if (pickerType === 'image') {
          // Image preview
          const preview = previewContainer;
          preview.src = path || '';
          preview.style.display = path ? '' : 'none';
        } else if (pickerType === 'audio') {
          // Audio preview
          if (path) {
            previewContainer.style.display = '';

            // Check if audio element already exists
            let audio = previewContainer.querySelector('audio');
            if (!audio) {
              // Create new audio player
              audio = document.createElement('audio');
              audio.controls = true;
              audio.style.height = '32px';
              audio.style.maxWidth = '200px';

              const source = document.createElement('source');
              audio.appendChild(source);
              previewContainer.appendChild(audio);

              // Add play button if not present
              if (!previewContainer.querySelector('.audio-preview-btn')) {
                const playBtn = document.createElement('a');
                playBtn.className = 'button audio-preview-btn';
                playBtn.dataset.action = 'previewAudio';
                playBtn.dataset.target = target;
                playBtn.title = game.i18n.localize('SDM.Settings.PlayPreview');
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
                previewContainer.appendChild(playBtn);
              }
            }

            // Update source
            const source = audio.querySelector('source');
            source.src = path;
            source.type = this._getAudioMimeType(path);
            audio.load();
          } else {
            previewContainer.style.display = 'none';
          }
        } else if (pickerType === 'video') {
          // Video preview
          if (path) {
            previewContainer.style.display = '';

            let video = previewContainer.querySelector('video');
            if (!video) {
              video = document.createElement('video');
              video.width = 64;
              video.height = 36;
              video.style.objectFit = 'contain';

              const source = document.createElement('source');
              video.appendChild(source);
              previewContainer.appendChild(video);
            }

            const source = video.querySelector('source');
            source.src = path;
            source.type = this._getVideoMimeType(path);
            video.load();
          } else {
            previewContainer.style.display = 'none';
          }
        }
      }
    });
    fp.render(true);
  }

  // Helper method to determine audio MIME type from file extension
  _getAudioMimeType(path) {
    const ext = path.split('.').pop().toLowerCase();
    switch (ext) {
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'ogg':
        return 'audio/ogg';
      case 'flac':
        return 'audio/flac';
      case 'm4a':
        return 'audio/mp4';
      case 'aac':
        return 'audio/aac';
      default:
        return 'audio/mpeg';
    }
  }

  // Helper method to determine video MIME type from file extension
  _getVideoMimeType(path) {
    const ext = path.split('.').pop().toLowerCase();
    switch (ext) {
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'ogg':
        return 'video/ogg';
      case 'mov':
        return 'video/quicktime';
      default:
        return 'video/mp4';
    }
  }

  // Action to play audio preview
  _onPreviewAudio(event, button) {
    event?.preventDefault();

    const target = button.dataset.target;
    const form = button.closest('form');
    const input = form?.querySelector(`input[name="${target}"]`);
    const path = input?.value;

    if (!path) return;

    // Find audio element
    const previewContainer = form?.querySelector(`[data-preview-for="${CSS.escape(target)}"]`);
    const audio = previewContainer?.querySelector('audio');

    if (audio) {
      if (audio.paused) {
        audio.play().catch(e => {
          console.error('Error playing audio:', e);
          ui.notifications.error(game.i18n.localize('SDM.Settings.AudioPlayError'));
        });
      } else {
        audio.pause();
        audio.currentTime = 0;
      }
    } else {
      // Create and play audio if it doesn't exist
      const audioElement = new Audio(path);
      audioElement.play().catch(e => {
        console.error('Error playing audio:', e);
        ui.notifications.error(game.i18n.localize('SDM.Settings.AudioPlayError'));
      });
    }
  }

  _onCancel(event, button) {
    event?.preventDefault();
    event?.stopPropagation();
    this.close();
  }

  async _onResetDefaults(event, button) {
    event?.preventDefault();
    event?.stopPropagation();

    const ok = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: $l10n('SDM.Settings.ResetDefaults.Title')
      },
      content: `<p>${$l10n('SDM.Settings.ResetDefaults.Confirm')}</p>`,
      modal: true,
      rejectClose: false
    }); // resolves true/false/null

    if (!ok) return;

    const cls = this.constructor;
    const ns = cls.NAMESPACE ?? 'sdm';
    const keys = Array.isArray(cls.ALL_KEYS) ? cls.ALL_KEYS : [];

    const samePrim = (a, b) => a === b || (Number.isNaN(a) && Number.isNaN(b));

    let needsClientReload = false;
    let needsWorldReload = false;

    for (const key of keys) {
      const def = game.settings.settings.get(`${ns}.${key}`);
      if (!def) continue;

      // The default registered at game.settings.register(... default: X ...)
      // For FilePathField you should also have set that `default` property.
      let defVal = def.default;

      // If you stored objects as JSON textareas, ensure defVal is structured as you expect.
      const before = game.settings.get(ns, key);

      // Compare & skip if already at default
      let changed = false;
      if (def.type === Object) {
        const a = before && typeof before === 'object' ? before : {};
        const b = defVal && typeof defVal === 'object' ? defVal : {};
        const diff = foundry.utils.diffObject(a, b);
        changed = Object.keys(diff).length > 0;
      } else {
        changed = !samePrim(before, defVal);
      }
      if (!changed) continue;

      await game.settings.set(ns, key, defVal);

      if (def.requiresReload) {
        if (def.scope === 'world') needsWorldReload = true;
        else needsClientReload = true;
      }
    }

    // Re-render the form so inputs reflect defaults
    this.render(true);

    if (needsClientReload || needsWorldReload) {
      return SettingsConfig.reloadConfirm({ world: needsWorldReload });
    }
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
