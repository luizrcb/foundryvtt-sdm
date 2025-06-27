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
    const words = str.match(/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+/gi);
    if (!words) {
      return '';
    }
    return words
      .map(function (word) {
        return word.charAt(0).toUpperCase() + word.substr(1).toLowerCase();
      })
      .join(' ');
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
  })

  $$('eq', function (valueA, valueB, options) {
    return valueA === valueB;
  });

  $$('notEq', function (valueA, valueB, options) {
    return valueA !== valueB;
  });

  $$('checkOriginalDie', function (index, options) {
    const context = options.data.root;
    return index === 0 && context.firstDiceExploded;
  });

  $$('getReadiedStyle', function (readied, options) {
    const booleanReadied = !!readied;
    const style = `font-weight: ${booleanReadied == true ? 900 : ''}; color: ${booleanReadied == true ? 'black' : 'grey'};`;
    return style;
  });

  $$('slotsTaken', function (container, options) {
    if (!container.length) return container.length;

    const slotsTaken = container.reduce((acc, item) => {
      return acc + (item.system.slots_taken || 1);
    }, 0);
    return slotsTaken;
  });

  $$("dynamicHTML", function (context, options) {
    // Create a safe string from the compiled HTML
    return new Handlebars.SafeString(
      Handlebars.compile(context)(this)
    );
  });

  $$("ternary", function (statement, statementIsTrue, statementIsFalse) {
    return statement ? statementIsTrue : statementIsFalse;
  });
}
