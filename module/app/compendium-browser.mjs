import { $l10n } from '../helpers/globalUtils.mjs';

const ApplicationV2 = foundry.applications?.api?.ApplicationV2;
const HandlebarsApplicationMixin = foundry.applications?.api?.HandlebarsApplicationMixin;
const ContextMenu = foundry.applications.ux.ContextMenu.implementation;

export default class CompendiumBrowser extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'compendium-browser-{id}',
    classes: ['compendium-browser', 'dialog-lg'],
    tag: 'form',
    window: {
      title: 'SDM.CompendiumBrowser.Title',
      minimizable: true,
      resizable: true
    },
    actions: {
      clearName: CompendiumBrowser.#onClearName,
      openLink: CompendiumBrowser.#onOpenLink,
      setFilter: CompendiumBrowser.#onSetFilter,
      submitSearch: CompendiumBrowser.#onSubmitSearch,
      toggleGroup: CompendiumBrowser.#onToggleGroup
    },
    form: {
      handler: CompendiumBrowser.#onHandleSubmit,
      closeOnSubmit: false
    },
    position: { width: 825, height: 600 },
    filters: {
      locked: {},
      initial: {
        documentClass: 'Item',
        types: new Set(['gear'])
      }
    },
    selection: { min: null, max: null },
    tab: 'all-gear',
    world: {
      includeWorldItems: false
    }
  };

  static PARTS = {
    tabs: {
      id: 'tabs',
      classes: ['tabs-horizontal'],
      template: 'systems/sdm/templates/compendium/browser-tabs.hbs'
    },
    content: {
      id: 'content',
      classes: ['browser-content-wrapper'],
      template: 'systems/sdm/templates/compendium/browser-content.hbs'
    }
  };

  static TABS = [
    {
      tab: 'all-gear',
      label: 'SDM.CompendiumBrowser.Tabs.AllGear',
      icon: 'fas fa-toolbox',
      documentClass: 'Item',
      types: ['gear']
    },
    {
      tab: 'weapons',
      label: 'SDM.CompendiumBrowser.Tabs.Weapons',
      icon: 'fas fa-sword',
      documentClass: 'Item',
      types: ['gear'],
      initialFilters: { subtype: { weapon: 1 } }
    },
    {
      tab: 'armors',
      label: 'SDM.CompendiumBrowser.Tabs.Armors',
      icon: 'fas fa-shield',
      documentClass: 'Item',
      types: ['gear'],
      initialFilters: { subtype: { armor: 1 } }
    },
    {
      tab: 'wards',
      label: 'SDM.CompendiumBrowser.Tabs.Wards',
      icon: 'fas fa-eye',
      documentClass: 'Item',
      types: ['gear'],
      initialFilters: { subtype: { ward: 1 } }
    },
    {
      tab: 'powers',
      label: 'SDM.CompendiumBrowser.Tabs.Powers',
      icon: 'fas fa-fire',
      documentClass: 'Item',
      types: ['gear'],
      initialFilters: { subtype: { power: 1 } }
    },
    {
      tab: 'traits',
      label: 'SDM.CompendiumBrowser.Tabs.Traits',
      icon: 'fas fa-dna',
      documentClass: 'Item',
      types: ['trait']
    }
  ];

  static FILTER_GROUPS = [
    {
      key: 'common',
      label: 'SDM.CompendiumBrowser.Filters.Common',
      keys: [
        'cost',
        'sizeValue',
        'sizeUnit',
        'startingKit',
        'supplyType',
        'paths',
        'features',
        'categories'
      ]
    },
    {
      key: 'weapon',
      label: 'SDM.CompendiumBrowser.Filters.Weapon',
      keys: ['weaponRange']
    },
    {
      key: 'armor',
      label: 'SDM.CompendiumBrowser.Filters.Armor',
      keys: ['armorValue', 'armorType']
    },
    {
      key: 'ward',
      label: 'SDM.CompendiumBrowser.Filters.Ward',
      keys: ['wardValue', 'wardType']
    },
    {
      key: 'power',
      label: 'SDM.CompendiumBrowser.Filters.Power',
      keys: ['powerLevel', 'powerDangerous']
    }
  ];

  static BATCHING = { MARGIN: 50, SIZE: 50 };
  static SEARCH_DELAY = 2000;

  // ======================== CACHE =========================
  static #cache = new Map();
  static #allItems = [];
  static #cacheReady = false;
  static #loadingNotification = null;

  /**
   * Preload all compendium and world items into memory.
   * Uses getIndex() to detect entries, then fetches full documents individually.
   */
  static async preloadCache(force = false) {
    if (this.#cacheReady && !force) {
      console.debug('CompendiumBrowser: Cache already ready, skipping preload.');
      return;
    }

    // Mostrar notificação de carregamento
    this.#showLoadingNotification();

    const start = performance.now();
    console.debug('CompendiumBrowser: Starting cache preload...');

    try {
      const items = [];
      const documentClass = 'Item';
      const packs = game.packs.filter(p => p.documentName === documentClass && p.visible);
      console.debug(`CompendiumBrowser: Found ${packs.length} visible Item compendia.`);

      // 1) World items
      if (game.items && typeof game.items.forEach === 'function') {
        let worldCount = 0;
        for (const item of game.items) {
          items.push(this.#buildItemData(item, true));
          worldCount++;
        }
        console.debug(`CompendiumBrowser: Loaded ${worldCount} world items.`);
      } else {
        console.warn('CompendiumBrowser: game.items not available or not iterable.');
      }

      // 2) Compendium packs – using getIndex + getDocument to ensure full data
      for (const pack of packs) {
        try {
          const packId = pack.metadata?.id || pack.id || pack.collection;
          console.debug(`CompendiumBrowser: Checking pack "${packId}"...`);

          const index = await pack.getIndex({ fields: ['_id'] });
          const count = index.size;
          console.debug(`CompendiumBrowser: Pack "${packId}" has ${count} entries in index.`);

          if (count === 0) {
            console.debug(`CompendiumBrowser: Pack "${packId}" is empty, skipping.`);
            continue;
          }

          const docs = [];
          for (const entry of index) {
            try {
              const doc = await pack.getDocument(entry._id);
              if (doc) docs.push(doc);
            } catch (err) {
              console.error(
                `CompendiumBrowser: Failed to fetch document ${entry._id} from ${packId}:`,
                err
              );
            }
          }

          const packItems = docs.map(doc => this.#buildItemData(doc, false, packId));
          this.#cache.set(packId, packItems);
          items.push(...packItems);
          console.debug(
            `CompendiumBrowser: Loaded ${packItems.length} items from pack "${packId}".`
          );
        } catch (err) {
          console.error(`CompendiumBrowser: Failed to process pack "${pack.id}":`, err);
        }
      }

      this.#allItems = items;
      this.#cacheReady = true;
      const elapsed = performance.now() - start;
      console.debug(
        `CompendiumBrowser: Cache built in ${elapsed.toFixed(2)}ms with ${items.length} total items.`
      );

      // Remover notificação de carregamento e mostrar sucesso
      this.#clearLoadingNotification();
      ui.notifications.info(
        game.i18n.format('SDM.CompendiumBrowser.Loaded', { count: items.length }),
        { timeout: 3000 }
      );
    } catch (err) {
      console.error('CompendiumBrowser: Fatal error during cache preload:', err);
      this.#cacheReady = true;
      this.#allItems = [];
      this.#clearLoadingNotification();
      ui.notifications.error(game.i18n.localize('SDM.CompendiumBrowser.LoadError'));
    }
  }

  static #showLoadingNotification() {
    if (this.#loadingNotification) return;
    const msg = game.i18n.localize('SDM.CompendiumBrowser.Loading');
    // Usar uma classe customizada para identificar a notificação
    this.#loadingNotification = ui.notifications.info(msg, { classes: ['compendium-loading'] });
  }

  static #clearLoadingNotification() {
    if (this.#loadingNotification) {
      // Remover do DOM
      const el = this.#loadingNotification;
      if (el && el.parentNode) el.parentNode.removeChild(el);
      this.#loadingNotification = null;
    }
    // Fallback: remover qualquer notificação com a classe
    document.querySelectorAll('.notification.info.compendium-loading').forEach(el => el.remove());
  }

  static #buildItemData(doc, isWorld, packId = null) {
    const system = doc.system || {};
    const uuid = isWorld ? `Item.${doc.id}` : `Compendium.${packId}.${doc.id}`;
    const searchableText = this.#buildSearchableText(doc);

    return {
      _id: doc.id,
      name: doc.name,
      type: doc.type,
      system: system,
      img: doc.img || 'icons/svg/item-bag.svg',
      uuid: uuid,
      isWorldItem: isWorld,
      packId: packId,
      searchableText: searchableText,
      _source: doc._source || null
    };
  }

  static #buildSearchableText(doc) {
    const parts = [doc.name || ''];
    const sys = doc.system || {};
    if (sys.description) parts.push(sys.description);
    if (sys.features) {
      if (Array.isArray(sys.features)) parts.push(sys.features.join(' '));
      else if (typeof sys.features === 'object') parts.push(Object.values(sys.features).join(' '));
    }
    if (sys.categories) {
      if (Array.isArray(sys.categories)) parts.push(sys.categories.join(' '));
      else if (typeof sys.categories === 'object')
        parts.push(Object.values(sys.categories).join(' '));
    }
    if (sys.paths) {
      if (Array.isArray(sys.paths)) parts.push(sys.paths.join(' '));
      else if (typeof sys.paths === 'object') parts.push(Object.values(sys.paths).join(' '));
    }
    return parts.join(' ').toLowerCase();
  }
  // ========================================================

  #filters;
  #selected = new Set();

  constructor(...args) {
    super(...args);
    this.#filters = this.options.filters?.initial ?? {};
    this.expandedSections = new Map();
    this.tabGroups = this.tabGroups ?? {};
    this.tabGroups.primary = this.options.tab;

    if (foundry.utils.isEmpty(this.options.filters.locked)) {
      const tab = this.constructor.TABS.find(t => t.tab === this.options.tab);
      if (!tab) this.options.tab = 'all-gear';
      this._applyTabFilters(this.options.tab, { keepFilters: true });
    }

    // Se o cache não estiver pronto, iniciar carregamento
    if (!CompendiumBrowser.#cacheReady) {
      CompendiumBrowser.preloadCache().catch(e => console.warn('Cache preload failed', e));
    }
  }

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);

    new ContextMenu(
      this.element,
      '.item-card[data-uuid]',
      [
        {
          label: 'SDM.Item.View',
          icon: '<i class="fa-solid fa-eye"></i>',
          onClick: target => {
            CompendiumBrowser.#onOpenLink(null, target?.currentTarget);
          }
        },
        {
          label: 'SDM.Item.Share',
          icon: '<i class="fa-solid fa-share-from-square"></i>',
          onClick: async target => {
            const el = target?.currentTarget;
            const uuid = el?.closest('[data-uuid]')?.dataset.uuid;
            if (!uuid) return;
            await this.#onSendToChat(uuid);
          }
        }
      ],
      { jQuery: false }
    );
  }

  get currentFilters() {
    const filters = foundry.utils.mergeObject(this.#filters, this.options.filters.locked, {
      inplace: false
    });
    delete filters.exclusive;
    filters.documentClass ??= 'Item';
    return filters;
  }

  get selected() {
    return this.#selected;
  }

  get displaySelection() {
    return !!this.options.selection.min || !!this.options.selection.max;
  }

  _debouncedSearch = foundry.utils.debounce(
    this.#onSearchName.bind(this),
    this.constructor.SEARCH_DELAY
  );

  _applyTabFilters(tabId, { keepFilters = false } = {}) {
    const tab = this.constructor.TABS.find(t => t.tab === tabId);
    if (!tab) return;
    const { documentClass, types } = tab;
    this.#filters.documentClass = documentClass;
    this.#filters.types = new Set(types);

    if (!keepFilters) {
      delete this.#filters.additional;
    } else {
      if (this.#filters.additional) {
        delete this.#filters.additional.subtype;
        if (Object.keys(this.#filters.additional).length === 0) {
          delete this.#filters.additional;
        }
      }
    }

    if (tab.initialFilters) {
      this.#filters.additional ??= {};
      foundry.utils.mergeObject(this.#filters.additional, tab.initialFilters);
    }
  }

  #onSearchName(event) {
    const input = event.target.closest('search')?.querySelector('input[type="text"]');
    if (!input) return;
    this.#filters.name = input.value;
    this._searchInputToFocus = input;
    this.render(true).then(() => {
      if (this._searchInputToFocus && document.activeElement !== this._searchInputToFocus) {
        this._searchInputToFocus.focus();
        this._searchInputToFocus.setSelectionRange(
          this._searchInputToFocus.value.length,
          this._searchInputToFocus.value.length
        );
      }
      this._searchInputToFocus = null;
    });
  }

  async changeTab(tab, group, options = {}) {
    if (group !== 'primary') return;
    this.tabGroups.primary = tab;
    const resetTabs = ['all-gear', 'traits'];
    const keepFilters = !resetTabs.includes(tab);
    this._applyTabFilters(tab, { keepFilters });
    this.render(true);
  }

  #getCostSubtitle(item) {
    const system = item.system || {};
    if (!system.cost) return '';
    const cost = system.cost * (system.quantity || 1);
    const freq = system.cost_frequency
      ? `/${$l10n(`SDM.Frequency${capitalizeFirstLetter(system.cost_frequency)}`)}`
      : '';
    return `${$l10n('SDM.CashSymbol')}${cost}${freq}`;
  }

  #getWeightSubtitle(item) {
    const system = item.system || {};
    if (!system.size?.value || system.size.unit === 'cash') return '';
    return `${system.size.value} ${$l10n(`SDM.Unit.${system.size.unit}.abbr`)}`;
  }

  #getTypeLabel(item) {
    const type = item.type;
    const subtype = item.system?.type;
    if (subtype) {
      const key = CONFIG.SDM.gearType[subtype];
      const label = $l10n(key);
      if (label !== key) return label;
    }
    return $l10n(`TYPES.Item.${type}`) || type;
  }

  #getFeatures(item) {
    const system = item.system || {};
    const features = system.features || [];
    const result = [];

    if (system.type === 'power' && system.power?.is_dangerous) {
      result.push({
        label: $l10n('SDM.ItemFeature.dangerousAbbr'),
        tooltip: $l10n('SDM.ItemFeature.dangerousDescription'),
        className: 'dangerous'
      });
    }

    // features can be an array or a Set
    const featureIterable = Array.isArray(features) || features instanceof Set ? features : [];
    for (const feat of featureIterable) {
      let label = $l10n(`SDM.ItemFeature.${feat}Abbr`) || feat;
      if (['area', 'replenish', 'flare', 'pocket', 'resistant'].includes(feat)) {
        const value = system[feat]?.value ?? '';
        if (feat === 'area') {
          const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
          const replacement = $l10n(`SDM.Area${capitalized}Abbr`);
          label = label.replace('#', replacement);
        } else {
          label = label.replace('#', value);
        }
      }
      result.push({
        label,
        tooltip: $l10n(`SDM.ItemFeature.${feat}Description`),
        className: ''
      });
    }
    return result;
  }

  #getSubtitle(doc) {
    const system = doc.system || {};
    const type = doc.type;
    let parts = [];

    if (type === 'gear') {
      const subtype = system.type || system.subtype;
      if (subtype) {
        const label = $l10n(`SDM.GearType.${subtype}`) || subtype;
        parts.push(label);
      }
      if (system.cost) parts.push(`(${$l10n('SDM.CashSymbol')}${system.cost})`);
    } else if (type === 'trait') {
      const subtype = system.type || system.subtype;
      if (subtype) {
        const label = $l10n(`SDM.TraitType.${subtype}`) || subtype;
        parts.push(label);
      }
    } else if (type === 'burden') {
      const subtype = system.type || system.subtype;
      if (subtype) {
        const label = $l10n(`SDM.BurdenType.${subtype}`) || subtype;
        parts.push(label);
      }
    }
    return parts.join(' • ');
  }

  #getWeaponDamage(item) {
    const system = item.system || {};
    const weapon = system.weapon || {};
    if (!weapon.damage?.base) return '';
    let dmg = weapon.damage.base;
    if (weapon.damage.versatile) dmg += `/${weapon.damage.versatile}`;
    const range = weapon.range ? ` (${$l10n(CONFIG.SDM.rangeType[weapon.range])})` : '';
    return `⚔️ ${dmg}${range}`;
  }

  #getArmorValue(item) {
    const armor = item.system?.armor || {};
    if (!armor.value) return '';
    return `🛡️ ${armor.value}`;
  }

  #getWardValue(item) {
    const ward = item.system?.ward || {};
    if (!ward.value) return '';
    return `👁️ ${ward.value}`;
  }

  #getValueByPath(obj, path) {
    if (!path) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }

  #getSelectedSubtypes(filters) {
    const subtypeFilter = filters.additional?.subtype;
    if (!subtypeFilter) return [];
    return Object.keys(subtypeFilter).filter(k => subtypeFilter[k]);
  }

  #isFilterRelevant(key, data, selectedSubtypes) {
    const dependencies = {
      weaponRange: ['weapon'],
      armorValue: ['armor'],
      armorType: ['armor'],
      wardValue: ['ward'],
      wardType: ['ward'],
      powerLevel: ['power'],
      powerDangerous: ['power']
    };

    if (dependencies[key]) {
      if (selectedSubtypes.length === 0) return true;
      return dependencies[key].some(st => selectedSubtypes.includes(st));
    }
    return true;
  }

  // ============================================================
  //  FILTERS & MATCH – CORRIGIDO para Sets, Arrays e valores únicos
  // ============================================================
  #matchesFilters(
    doc,
    filters,
    filterDefinitions,
    { skipTextSearch = false, searchableText = null } = {}
  ) {
    if (!skipTextSearch && filters.name) {
      const search = filters.name.toLowerCase();
      let textToSearch = searchableText;
      if (!textToSearch) {
        const fieldsToCheck = [
          doc.name,
          doc.system?.description,
          doc.system?.features,
          doc.system?.categories
        ];
        textToSearch = fieldsToCheck
          .filter(v => v !== undefined && v !== null)
          .map(v => {
            if (Array.isArray(v)) return v.join(' ');
            if (v && typeof v === 'object' && typeof v[Symbol.iterator] === 'function') {
              return Array.from(v).join(' ');
            }
            return String(v);
          })
          .join(' ')
          .toLowerCase();
      }
      if (!textToSearch.includes(search)) return false;
    }

    const additional = filters.additional || {};
    if (foundry.utils.isEmpty(additional)) return true;

    for (const [key, filterValue] of Object.entries(additional)) {
      const def = filterDefinitions.get(key);
      if (!def) continue;

      switch (def.type) {
        case 'set': {
          if (typeof filterValue !== 'object' || filterValue === null || Array.isArray(filterValue))
            continue;
          const selectedKeys = Object.keys(filterValue).filter(k => filterValue[k]);
          if (selectedKeys.length === 0) continue;

          const docValue = this.#getValueByPath(doc, def.config.keyPath);

          // 🔥 CORREÇÃO: verifica Array, Set ou valor único
          const hasAnySelected = value => {
            if (Array.isArray(value)) {
              return value.some(v => selectedKeys.includes(v));
            }
            if (value instanceof Set) {
              return [...value].some(v => selectedKeys.includes(v));
            }
            // valor único (string, number, etc.)
            return selectedKeys.includes(value);
          };

          if (!hasAnySelected(docValue)) return false;
          break;
        }
        case 'boolean': {
          const expected = !!filterValue;
          const docValue = this.#getValueByPath(doc, def.config.keyPath);
          if (!!docValue !== expected) return false;
          break;
        }
        case 'range': {
          if (typeof filterValue !== 'object' || filterValue === null) continue;
          const docValue = this.#getValueByPath(doc, def.config.keyPath);
          if (docValue === undefined || docValue === null) return false;
          const min = filterValue.min;
          const max = filterValue.max;
          if (min !== undefined && docValue < min) return false;
          if (max !== undefined && docValue > max) return false;
          break;
        }
        default:
          continue;
      }
    }
    return true;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.filters = this.currentFilters;

    const dataModels = CONFIG[context.filters.documentClass].dataModels;
    let entries = Object.entries(dataModels);
    if (context.filters.types?.size) {
      entries = entries.filter(([type]) => context.filters.types.has(type));
    }
    context.filterDefinitions =
      entries
        .map(([, model]) => model.compendiumBrowserFilters ?? new Map())
        .reduce(
          (final, second) => CompendiumBrowser.intersectFilters(second, final, context.filters),
          null
        ) ?? new Map();

    const activeTab = this.tabGroups.primary;
    context.tabs = this.constructor.TABS.map(t => ({
      ...t,
      active: t.tab === activeTab
    }));

    context.searchValue = this.#filters.name || '';
    context.filterGroups = this.#prepareFilterGroups(context);

    const resultsData = await this.#prepareResults(context, options);
    context.results = resultsData.results;
    context.displaySelection = resultsData.displaySelection;
    context.emptyMessage = resultsData.emptyMessage;

    const footerData = this.#prepareFooter(context);
    context.summary = footerData.summary;
    context.invalid = footerData.invalid;
    context.invalidTooltip = footerData.invalidTooltip;

    return context;
  }

  #prepareFilterGroups(context) {
    const filterDefinitions = context.filterDefinitions || new Map();
    const lockExclusive = this.options.filters.locked.exclusive === true;
    const additional = [];
    const selectedSubtypes = this.#getSelectedSubtypes(context.filters);

    for (const [key, data] of filterDefinitions.entries()) {
      if (!this.#isFilterRelevant(key, data, selectedSubtypes)) continue;

      let sort = 0;
      switch (data.type) {
        case 'boolean':
          sort = 1;
          break;
        case 'range':
          sort = 2;
          break;
        case 'set':
          sort = 3;
          break;
      }

      const generateLocked = (value, def) => {
        if (lockExclusive && value !== undefined) {
          if (def?.type === 'range') return { min: true, max: true };
          if (def?.type === 'set' && def.config?.choices) {
            return Object.fromEntries(Object.keys(def.config.choices).map(k => [k, true]));
          }
          return true;
        }
        if (foundry.utils.getType(value) === 'Object') {
          return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, generateLocked(v)]));
        }
        return value !== undefined;
      };

      data.expandId = key;

      if (data.type === 'range') {
        const currentValue = context.filters.additional?.[key] || {};
        const rangeValue = {
          min: Number.isInteger(currentValue.min) ? currentValue.min : '',
          max: Number.isInteger(currentValue.max) ? currentValue.max : ''
        };
        additional.push({
          ...data,
          key,
          sort,
          value: rangeValue,
          locked: generateLocked(this.options.filters.locked?.additional?.[key], data)
        });
        continue;
      }

      if (data.type === 'set') {
        let choices =
          foundry.utils.getType(data.config.choices) === 'function'
            ? data.config.choices(context.filters)
            : data.config.choices;
        if (foundry.utils.getType(choices) !== 'Object') continue;

        if (data.config.sort) {
          let entries = Object.entries(choices);
          if (typeof data.config.sort === 'function') {
            entries.sort(data.config.sort);
          } else if (data.config.sort === 'asc' || data.config.sort === true) {
            entries.sort((a, b) => {
              const labelA = $l10n(a[1]);
              const labelB = $l10n(b[1]);
              return labelA.localeCompare(labelB);
            });
          } else if (data.config.sort === 'desc') {
            entries.sort((a, b) => {
              const labelA = $l10n(a[1]);
              const labelB = $l10n(b[1]);
              return labelB.localeCompare(labelA);
            });
          }
          data.config.choices = Object.fromEntries(entries);
          choices = data.config.choices;
        }

        const groups = Object.entries(choices).reduce((groups, [k, v]) => {
          groups[v.group] ??= {};
          groups[v.group][k] = v;
          return groups;
        }, {});

        if (Object.keys(groups).length > 1) {
          Object.entries(groups).forEach(([group, groupChoices]) => {
            additional.push({
              ...data,
              key,
              sort,
              expandId: `${key}-${group}`,
              expanded:
                this.expandedSections.get(`${key}-${group}`) ?? !data.config.collapseGroup?.(group),
              label: game.i18n.format('SDM.CompendiumBrowser.Filters.Grouped', {
                type: $l10n(data.label),
                group
              }),
              config: { ...data.config, choices: groupChoices },
              value: context.filters.additional?.[key],
              locked: generateLocked(this.options.filters.locked?.additional?.[key], data)
            });
          });
        } else {
          additional.push({
            ...data,
            key,
            sort,
            expanded: this.expandedSections.get(data.expandId) ?? !data.collapseGroup?.(null),
            value: context.filters.additional?.[key],
            locked: generateLocked(this.options.filters.locked?.additional?.[key], data)
          });
        }
        continue;
      }

      additional.push({
        ...data,
        key,
        sort,
        value: context.filters.additional?.[key],
        locked: generateLocked(this.options.filters.locked?.additional?.[key], data)
      });
    }

    const groups = [];
    for (const groupDef of this.constructor.FILTER_GROUPS) {
      const groupKey = groupDef.key;
      const filtersInGroup = additional.filter(f => groupDef.keys.includes(f.key));
      if (filtersInGroup.length === 0) continue;
      const defaultExpanded = groupKey === 'common';
      const expanded = this.expandedSections.get(`group-${groupKey}`) ?? defaultExpanded;
      groups.push({
        groupKey,
        groupLabel: groupDef.label,
        expanded,
        count: filtersInGroup.length,
        filters: filtersInGroup
      });
    }
    additional.sort((a, b) => a.sort - b.sort);
    return groups;
  }

  // ======================== CACHED RESULTS =========================
  async #prepareResults(context, options) {
    const filters = context.filters;
    const types = filters.types || new Set();
    const filterDefinitions = context.filterDefinitions;

    if (!CompendiumBrowser.#cacheReady) {
      await CompendiumBrowser.preloadCache();
    }

    let candidates = CompendiumBrowser.#allItems;

    if (types.size) {
      candidates = candidates.filter(item => types.has(item.type));
    }

    candidates = candidates.filter(item =>
      this.#matchesFilters(item, filters, filterDefinitions, {
        skipTextSearch: true
      })
    );

    if (filters.name) {
      const search = filters.name.toLowerCase();
      candidates = candidates.filter(item => item.searchableText.includes(search));
    }

    const hasCostFilter = !!(
      filters.additional?.cost?.min !== undefined || filters.additional?.cost?.max !== undefined
    );
    if (hasCostFilter) {
      candidates.sort((a, b) => (a.system?.cost ?? Infinity) - (b.system?.cost ?? Infinity));
    } else {
      candidates.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
    }

    // Helper para verificar se uma feature existe (funciona com Array e Set)
    const hasFeature = (features, key) => {
      if (!features) return false;
      if (Array.isArray(features)) return features.includes(key);
      if (features instanceof Set) return features.has(key);
      return false;
    };

    const results = candidates.map(item => {
      const system = item.system || {};
      const type = item.type;
      const features = system.features || [];

      const isWeapon =
        type === 'gear' && (system.type === 'weapon' || hasFeature(features, 'weapon'));
      const isArmor = type === 'gear' && (system.type === 'armor' || hasFeature(features, 'armor'));
      const isWard = type === 'gear' && (system.type === 'ward' || hasFeature(features, 'ward'));
      const isPower = type === 'gear' && system.type === 'power';
      const isVersatile = hasFeature(features, 'versatile');

      let weaponDisplay = '';
      if (isWeapon && system.weapon?.damage) {
        const base = system.weapon.damage.base;
        const versatile =
          system.weapon.versatile || isVersatile ? `/${system.weapon.damage.versatile}` : '';
        const rangeKey = system.weapon.range;
        const rangeLabel = rangeKey ? $l10n(CONFIG.SDM.rangeType?.[rangeKey] || rangeKey) : '';
        const range = rangeLabel ? ` (${rangeLabel})` : '';
        weaponDisplay = `${base}${versatile}${range}`;
      }

      let armorValue = '';
      if (isArmor && system.armor?.value !== undefined) armorValue = system.armor.value;
      let wardValue = '';
      if (isWard && system.ward?.value !== undefined) wardValue = system.ward.value;

      let sourceLabel = item.isWorldItem ? $l10n('SDM.WorldItem') : '';
      if (!item.isWorldItem && item.packId) {
        const pack =
          game.packs.get(item.packId) ?? game.packs.find(p => p.collection === item.packId);
        if (pack) sourceLabel = pack.metadata?.label || item.packId;
      }
      if (!item.isWorldItem && item._source?.folder) {
        const pack =
          game.packs.get(item.packId) ?? game.packs.find(p => p.collection === item.packId);
        if (pack?.folders) {
          const folderName = pack.folders.get(item._source.folder)?.name;
          if (folderName) sourceLabel += ` (${folderName})`;
        }
      }

      return {
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        subtitle: this.#getSubtitle(item),
        source: sourceLabel,
        document: item,
        isWorldItem: item.isWorldItem,
        extraInfo: '',
        isWeapon,
        isArmor,
        isWard,
        isPower,
        powerLevel: isPower ? system.power?.level || '' : '',
        weaponDisplay,
        armorValue,
        wardValue,
        costSubtitle: this.#getCostSubtitle(item),
        weightSubtitle: this.#getWeightSubtitle(item),
        typeLabel: this.#getTypeLabel(item),
        features: this.#getFeatures(item),
        tooltip: system.description || ''
      };
    });

    return {
      results,
      displaySelection: this.displaySelection,
      emptyMessage: results.length === 0 ? 'SDM.CompendiumBrowser.NoResults' : null
    };
  }

  #prepareFooter(context) {
    if (!this.displaySelection) {
      return { summary: '', invalid: false, invalidTooltip: '' };
    }
    const count = this.#selected.size;
    const min = this.options.selection.min ?? 0;
    const max = this.options.selection.max ?? Infinity;
    const summary = game.i18n.format('SDM.CompendiumBrowser.SelectionSummary', {
      count,
      min: min || '–',
      max: max === Infinity ? '∞' : max
    });
    const invalid = count < min || count > max;
    const invalidTooltip = invalid ? $l10n('SDM.CompendiumBrowser.SelectionInvalid') : '';
    return { summary, invalid, invalidTooltip };
  }

  static intersectFilters(first, second, currentFilters) {
    const final = new Map();
    for (const [key, firstConfig] of first.entries()) {
      const secondConfig = second?.get(key);
      if (secondConfig?.type && firstConfig.type !== secondConfig.type) continue;
      const finalConfig = foundry.utils.deepClone(firstConfig);
      if (foundry.utils.getType(finalConfig.config?.choices) === 'function') {
        finalConfig.config.choices = finalConfig.config.choices(currentFilters);
      }

      switch (secondConfig?.type) {
        case 'range':
          if ('min' in firstConfig.config || 'min' in secondConfig.config) {
            if (!('min' in firstConfig.config) || !('min' in secondConfig.config)) continue;
            finalConfig.config.min = Math.max(firstConfig.config.min, secondConfig.config.min);
          }
          if ('max' in firstConfig.config || 'max' in secondConfig.config) {
            if (!('max' in firstConfig.config) || !('max' in secondConfig.config)) continue;
            finalConfig.config.max = Math.min(firstConfig.config.max, secondConfig.config.max);
          }
          if (
            'min' in finalConfig.config &&
            'max' in finalConfig.config &&
            finalConfig.config.min > finalConfig.config.max
          )
            continue;
          break;
        case 'set':
          const choices =
            foundry.utils.getType(secondConfig.config.choices) === 'function'
              ? secondConfig.config.choices(currentFilters)
              : secondConfig.config.choices;
          Object.keys(finalConfig.config.choices).forEach(k => {
            if (!(k in choices)) delete finalConfig.config.choices[k];
          });
          if (foundry.utils.isEmpty(finalConfig.config.choices)) continue;
          break;
      }
      final.set(key, finalConfig);
    }
    return final;
  }

  /** @this {CompendiumBrowser} */
  static #onHandleSubmit(event, form, formData) {
    event.preventDefault();
  }

  /** @this {CompendiumBrowser} */
  static #onClearName(event, target) {
    const input = target.closest('search')?.querySelector(':scope > input');
    if (input) {
      input.value = '';
      this.#filters.name = '';
      this.render(true);
    }
  }

  /** @this {CompendiumBrowser} */
  static #onOpenLink(event, target) {
    const uuid = target.closest('[data-uuid]')?.dataset.uuid;
    if (uuid) {
      fromUuid(uuid).then(doc => doc?.sheet?.render(true));
    }
  }

  /** @this {CompendiumBrowser} */
  static #onSetFilter(event, target) {
    const { name, checked, type, value, dataset } = target;
    if (!name.startsWith('additional.')) return;

    if (!this.#filters.additional) {
      this.#filters.additional = {};
    }

    if (dataset.dtype === 'Number') {
      const match = name.match(/additional\.(\w+)\.(min|max)/);
      if (match) {
        const [, rangeKey, rangePart] = match;
        if (!this.#filters.additional[rangeKey]) {
          this.#filters.additional[rangeKey] = {};
        }
        const num = parseInt(value, 10);
        if (value === '' || isNaN(num)) {
          delete this.#filters.additional[rangeKey][rangePart];
          if (Object.keys(this.#filters.additional[rangeKey]).length === 0) {
            delete this.#filters.additional[rangeKey];
          }
        } else {
          this.#filters.additional[rangeKey][rangePart] = num;
        }
        this.render(true);
        return;
      }
    }

    const path = name.split('.');
    const key = path[1];
    const subKey = path[2];

    if (subKey) {
      if (!this.#filters.additional[key]) this.#filters.additional[key] = {};
      this.#filters.additional[key][subKey] = checked;
      this.render(true);
      return;
    }

    if (type === 'checkbox') {
      this.#filters.additional[key] = checked;
      this.render(true);
    }
  }

  /** @this {CompendiumBrowser} */
  static #onSubmitSearch(event, target) {
    const input = this.element.querySelector('search input[type="text"]');
    if (input) {
      this.#filters.name = input.value;
      this.render(true);
    }
  }

  /** @this {CompendiumBrowser} */
  static #onToggleGroup(event, target) {
    const header = target.closest('.group-header');
    if (!header) return;
    const group = header.closest('.filter-group');
    if (!group) return;

    const content = group.querySelector('.group-content');
    const icon = header.querySelector('i');
    const groupKey = group.dataset.group;
    const isExpanded = !content.classList.contains('collapsed');

    if (isExpanded) {
      content.classList.add('collapsed');
      if (icon) icon.className = 'fas fa-chevron-right';
      this.expandedSections.set(`group-${groupKey}`, false);
    } else {
      const container = group.closest('.filter-container') || document;
      const allGroups = container.querySelectorAll('.filter-group');

      allGroups.forEach(otherGroup => {
        if (otherGroup === group) return;

        const otherContent = otherGroup.querySelector('.group-content');
        const otherIcon = otherGroup.querySelector('.group-header i');
        const otherKey = otherGroup.dataset.group;

        if (otherContent && !otherContent.classList.contains('collapsed')) {
          otherContent.classList.add('collapsed');
          if (otherIcon) otherIcon.className = 'fas fa-chevron-right';
          if (otherKey) this.expandedSections.set(`group-${otherKey}`, false);
        }
      });

      content.classList.remove('collapsed');
      if (icon) icon.className = 'fas fa-chevron-down';
      this.expandedSections.set(`group-${groupKey}`, true);
    }
  }

  static injectSidebarButton(html) {
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('open-compendium-browser');
    button.style = 'flex-basis: 100%';
    button.innerHTML = `
      <i class="fa-solid fa-book-open-reader"></i>
      ${$l10n('SDM.CompendiumBrowser.Open')}
    `;
    button.addEventListener('click', () => new CompendiumBrowser().render({ force: true }));

    let headerActions = html.querySelector('.header-actions');
    if (!headerActions) {
      headerActions = document.createElement('div');
      headerActions.className = 'header-actions action-buttons flexrow';
      html.querySelector(':scope > header').insertAdjacentElement('afterbegin', headerActions);
    }
    headerActions.append(button);
  }

  _attachFrameListeners() {
    super._attachFrameListeners();

    this.element.addEventListener('change', event => {
      const target = event.target;
      if (!target.matches('input[name^="additional."]')) return;

      const match = target.name.match(/additional\.(\w+)\.(min|max)/);
      if (match && target.dataset.dtype === 'Number') {
        const [, key, part] = match;
        const value = target.value.trim();
        const num = parseInt(value, 10);

        if (!this.#filters.additional) this.#filters.additional = {};
        if (!this.#filters.additional[key]) this.#filters.additional[key] = {};

        if (value === '' || isNaN(num)) {
          delete this.#filters.additional[key][part];
          if (Object.keys(this.#filters.additional[key]).length === 0) {
            delete this.#filters.additional[key];
          }
        } else {
          this.#filters.additional[key][part] = num;
        }
        this.render(true);
        return;
      }

      if (target.type === 'checkbox') {
        CompendiumBrowser.#onSetFilter.call(this, event, target);
      }
    });

    this.element.addEventListener('input', event => {
      const target = event.target;
      if (target.matches('search input[type="text"]')) {
        this._debouncedSearch(event);
      }
    });

    this.element.addEventListener('keydown', event => {
      const input = event.target.closest('search input[type="text"]');
      if (input && event.key === 'Enter') {
        event.preventDefault();
        this._debouncedSearch.cancel?.();
        CompendiumBrowser.#onSubmitSearch.call(this, event, input);
      }
    });

    this.element.addEventListener('click', event => {
      const tabLink = event.target.closest('.tabs-horizontal a[data-tab]');
      if (!tabLink) return;
      event.preventDefault();
      this.changeTab(tabLink.dataset.tab, 'primary');
    });

    this.element.addEventListener('dragstart', event => {
      const card = event.target.closest('.item-card');
      if (!card) return;
      const uuid = card.dataset.uuid;
      if (!uuid) return;
      const dragData = JSON.stringify({ type: 'Item', uuid });
      event.dataTransfer.setData('text/plain', dragData);
      event.dataTransfer.effectAllowed = 'copy';

      const dragImage = card.cloneNode(true);
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.style.width = '260px';
      dragImage.style.background = 'var(--color-bg-primary)';
      dragImage.style.border = '1px solid var(--color-text-primary)';
      dragImage.style.borderRadius = '6px';
      dragImage.style.padding = '6px';
      document.body.appendChild(dragImage);
      event.dataTransfer.setDragImage(dragImage, 10, 10);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    });
  }

  async #onSendToChat(uuid) {
    const doc = await fromUuid(uuid);
    if (!doc) {
      ui.notifications.warn('Item not found.');
      return;
    }
    if (typeof doc.sendToChat === 'function') {
      await doc.sendToChat({ actor: null });
    } else {
      const content = await renderTemplate('systems/sdm/templates/chat/item-card.hbs', {
        item: doc,
        collapsed: false
      });
      await ChatMessage.create({ content, flavor: doc.name });
    }
  }
}

// Expor globalmente para facilitar testes no console
globalThis.CompendiumBrowser = CompendiumBrowser;
