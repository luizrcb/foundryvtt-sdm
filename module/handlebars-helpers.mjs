import { SizeUnit } from './helpers/constants.mjs';
import { $l10n, formatNumber, toPascalCase } from './helpers/globalUtils.mjs';
import { convertToSacks, getWealthFromItems, hasPowerAlbum } from './helpers/itemUtils.mjs';
import { getHallmarkUpgradeSummary } from './app/level-upgrades.mjs';

export function registerHandlebarsHelpers() {
  const $$ = (name, fn) => Handlebars.registerHelper(name, fn);

  $$('$$', function (path) {
    return 'systems/sdm/templates/' + path + '.hbs';
  });

  // Gear holding a list of powers (power album or album feature)
  $$('sdmHasAlbum', function (item) {
    return hasPowerAlbum(item);
  });

  /**
   * Rolls of an inventory row: the item's subtype owns the image (weapon damage, power, power
   * album); features add small icons (weapon feature: damage, album feature: its powers). Gear with
   * no subtype roll uses its first feature roll as the image.
   * Returns { image: 'damage'|'power'|'power_album'|null, icons: [...] } (nothing when it can't roll).
   */
  const rowRolls = (item, actorType, editable) => {
    const none = { image: null, icons: [] };
    const system = item?.system;
    if (!system || !editable || actorType === 'caravan') return none;
    if (system.status === 'broken' || system.resources === 'run_out' || system.size?.unit === 'cash') return none;
    if (!system.readied) return none;
    const has = feature => !!system.features?.has?.(feature);
    const canDamage = (system.type === 'weapon' || has('weapon')) && !!system.weapon?.damage?.base;
    const canAlbum = hasPowerAlbum(item) && (system.powers?.length ?? 0) > 0;

    let image = null;
    if (system.type === 'weapon') image = canDamage ? 'damage' : null;
    else if (system.type === 'power') image = 'power';
    else if (system.type === 'power_album') image = canAlbum ? 'power_album' : null;
    else if (canDamage) image = 'damage';
    else if (canAlbum) image = 'power_album';

    const icons = [];
    if (canDamage && image !== 'damage') icons.push('damage');
    if (canAlbum && image !== 'power_album') icons.push('power_album');
    return { image, icons };
  };
  $$('sdmRowImage', (item, actorType, editable) => rowRolls(item, actorType, editable).image);
  $$('sdmRowIcons', (item, actorType, editable) => rowRolls(item, actorType, editable).icons);

  // Inventory tooltip of a hallmark: "Hallmark: +2 damage per die, Glowing, Lich-bane"
  $$('sdmHallmarkTooltip', function (item) {
    const upgrades = getHallmarkUpgradeSummary(item).map(upgrade => upgrade.label);
    const label = $l10n('SDM.HallmarkItem');
    return upgrades.length ? `${label}: ${upgrades.join(', ')}` : label;
  });

  // Display-only number with the locale's thousands separators (1.500 / 1,500)
  $$('localeNumber', function (value) {
    return formatNumber(value);
  });

  $$('sdmSpeed', function (value) {
    return CONFIG.SDM.formatSpeed(value);
  });

  $$('sdmSpeedChoices', function (value) {
    return CONFIG.SDM.getSpeedChoices(value);
  });

  $$('toLowerCase', function (str) {
    return str.toLowerCase();
  });

  $$('toUpperCase', function (str) {
    return str.toUpperCase();
  });

  $$('toPascalCase', function (str) {
    return toPascalCase(str);
  });

  // some one to an index
  $$('addOne', function (index) {
    return index + 1;
  });

  $$('wasHeroUsed', function (index, options) {
    const context = options.data.root;
    return context.usedHeroIndexes.includes(index) ? '' : 'discarded';
  });

  $$('contains', function (array, value, options) {
    if (!array || !array.length || value === undefined || value === null) return false;
    const response = array.includes(parseInt(value, 10));
    return response;
  });

  $$('isCharacter', function (actorType, options) {
    return ['npc', 'character'].includes(actorType);
  });

  const reduceOp = function (args, reducer) {
    args = Array.from(args);
    args.pop(); // => options
    var first = args.shift();
    return args.reduce(reducer, first);
  };

  $$('eq', function () {
    return reduceOp(arguments, (a, b) => a === b);
  });

  $$('ne', function () {
    return reduceOp(arguments, (a, b) => a !== b);
  });

  $$('lt', function () {
    return reduceOp(arguments, (a, b) => a < b);
  });

  $$('gt', function () {
    return reduceOp(arguments, (a, b) => a > b);
  });

  $$('lte', function () {
    return reduceOp(arguments, (a, b) => a <= b);
  });

  $$('gte', function () {
    return reduceOp(arguments, (a, b) => a >= b);
  });

  $$('and', function () {
    return reduceOp(arguments, (a, b) => a && b);
  });

  $$('or', function () {
    return reduceOp(arguments, (a, b) => a || b);
  });

  $$('checkOriginalDie', function (index, options) {
    const context = options.data.root;
    return index === 0 && context.firstDiceExploded;
  });

  $$('slotsTaken', function (container, options) {
    if (!container.length) return container.length;

    const slotsTaken = container.reduce((acc, item) => {
      return acc + (item.system.slots_taken || 1);
    }, 0);
    return slotsTaken;
  });

  $$('dynamicHTML', function (context, options) {
    // Create a safe string from the compiled HTML
    return new Handlebars.SafeString(Handlebars.compile(context)(this));
  });

  $$('multiply', function (A, B) {
    const numberA = parseInt(A, 10);
    const numberB = parseInt(B, 10);
    return numberA * numberB;
  });

  $$('toInt', function (A) {
    return parseInt(A, 10);
  });

  $$('fragment', function (options) {
    return new Handlebars.SafeString(options.fn(this));
  });

  $$('getItemTitle', function (item) {
    return item.getInventoryTitle();
  });

  $$('toSacks', function (slotsInStones, displayUnit = true) {
    const inSacks = convertToSacks(slotsInStones, SizeUnit.STONES);

    if (!displayUnit) return inSacks;

    return `${inSacks} ${$l10n('SDM.UnitSacksAbbr')}`;
  });

  function alphaLabel(i) {
    let s = '';
    i += 1;
    while (i > 0) {
      const r = (i - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  }

  $$('alphaFromIndex', function (idx, location = 'A') {
    const start = idx * 2;
    if (location === 'A') return alphaLabel(start);
    if (location === 'B') return alphaLabel(start + 1);
    return ''; // fallback se location não for 'A' nem 'B'
  });

  $$('getEstimatedValue', function (items = []) {
    if (!items && !items.length) return 0;
    return getWealthFromItems(items);
  });

  // "N Times" loop for handlebars.
  //  Block is executed N times starting from start.
  //
  // Usage:
  // {{#times_from 1 10}}
  //   <span>{{this}}</span>
  // {{/times_from}}
  $$('times_from', function (start, n, block) {
    let accum = '';
    for (let i = start; i <= n; ++i) {
      accum += block.fn(i);
    }
    return accum;
  });

  $$('multiboxes', function (selected, options) {
    let html = options.fn(this);

    // Fix for single non-array values.
    if (!Array.isArray(selected)) {
      selected = [selected];
    }

    if (typeof selected !== 'undefined') {
      selected.forEach(selected_value => {
        if (selected_value !== false) {
          let escapedValue = RegExp.escape(Handlebars.escapeExpression(selected_value));
          let rgx = new RegExp(' value=\"' + escapedValue + '\"');
          let oldHtml = html;
          html = html.replace(rgx, '$& checked');
          while (oldHtml === html && escapedValue >= 0) {
            escapedValue--;
            rgx = new RegExp(' value=\"' + escapedValue + '\"');
            html = html.replace(rgx, '$& checked');
          }
        }
      });
    }
    return html;
  });

  $$('has', function (set, value) {
    return set.has(value);
  });

  $$('isDefeated', function(statuses = new Set()) {
    return statuses.has('dead');
  })

  $$('numberedFeature', function (feature) {
    return ['area', 'replenish', 'flare', 'pocket', 'resistant'].includes(feature);
  });

  $$('replace', function (originalString = '', removedString = '', addedString = '') {
    return originalString.replace(removedString, addedString);
  });

  $$('featureDisplay', function (featureKey, parentSystem) {
    let str = $l10n(`SDM.ItemFeature.${featureKey}Abbr`);
    const numberedFeatures = ['area', 'range', 'replenish', 'flare', 'pocket', 'resistant'];
    if (numberedFeatures.includes(featureKey)) {
      const value = parentSystem[featureKey]?.value;
      if (featureKey === 'area') {
        const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
        const replacement = $l10n(`SDM.Area${capitalized}Abbr`);
        str = str.replace('#', replacement);
      } else if (featureKey === 'range') {
        const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
        const replacement = $l10n(`SDM.Range${capitalized}`);
        str = str.replace('#', replacement);
      } else {
        str = str.replace('#', value);
      }
    }
    return str;
  });
}
