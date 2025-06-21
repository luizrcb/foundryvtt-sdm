export function registerHandlebarsHelpers() {
  // If you need to add Handlebars helpers, here is a useful example:
  Handlebars.registerHelper('toLowerCase', function (str) {
    return str.toLowerCase();
  });

  Handlebars.registerHelper('toUpperCase', function (str) {
    return str.toUpperCase();
  });

  Handlebars.registerHelper('toPascalCase', function (str) {
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

  Handlebars.registerHelper('saveIcon', function (abilityKey) {
    return SDM.abilitySaveIcons[abilityKey];
  });

  // some one to an index
  Handlebars.registerHelper('addOne', function (index) {
    return index + 1;
  });

  Handlebars.registerHelper('wasHeroUsed', function (index, options) {
    const context = options.data.root;
    return context.usedHeroIndexes.includes(index) ? '' : 'discarded';
  });

  Handlebars.registerHelper('contains', function (array, value, options) {
    if (!array || !array.length || value === undefined || value === null) return false;
    const response = array.includes(parseInt(value, 10));
    return response;
  });

  Handlebars.registerHelper('isCharacter', function (actorType, options) {
    return ['npc', 'character'].includes(actorType);
  })

  Handlebars.registerHelper('eq', function (valueA, valueB, options) {
    return valueA === valueB;
  });

  Handlebars.registerHelper('notEq', function (valueA, valueB, options) {
    return valueA !== valueB;
  });

  Handlebars.registerHelper('checkOriginalDie', function (index, options) {
    const context = options.data.root;
    return index === 0 && context.firstDiceExploded;
  });

  Handlebars.registerHelper('getReadiedStyle', function (readied, options) {
    const booleanReadied = !!readied;
    const style = `font-weight: ${booleanReadied == true ? 900 : ''}; color: ${booleanReadied == true ? 'black' : 'grey'};`;
    return style;
  });

  Handlebars.registerHelper('slotsTaken', function (container, options) {
    if (!container.length) return container.length;

    const slotsTaken = container.reduce((acc, item) => {
      return acc + (item.system.slots_taken || 1);
    }, 0);
    return slotsTaken;
  });

  Handlebars.registerHelper("dynamicHTML", function (context, options) {
    // Create a safe string from the compiled HTML
    return new Handlebars.SafeString(
      Handlebars.compile(context)(this)
    );
  });

}
