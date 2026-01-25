import { SizeUnit } from './helpers/constants.mjs';
import { $l10n, toPascalCase } from './helpers/globalUtils.mjs';
import { convertToSacks, getWealthFromItems } from './helpers/itemUtils.mjs';

export function registerHandlebarsHelpers() {
  const $$ = (name, fn) => Handlebars.registerHelper(name, fn);

  $$('$$', function (path) {
    return 'systems/sdm/templates/' + path + '.hbs';
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

  $$('toSacks', function (slotsInStones, displayUnit=true) {
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
}
