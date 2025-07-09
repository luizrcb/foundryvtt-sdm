export function $l10n(key) {
  return game.i18n.localize(key);
}

export function $fmt(key, values) {
  return game.i18n.format(key, values);
}

export function validateActorId(id) {
  if (!id || id.trim() === '') return true;

  return !!game.actors.get(id);
}

export function validateItemId(id) {
  if (!id || id.trim() === '') return true;

  return !!game.items.get(id);
}

export function validateDocumentId(id) {
  if (!id || id.trim() === '') return true;

  return validateActorId(id) || validateItemId(id);
}

export function capitalizeFirstLetter(string) {
  return string[0].toUpperCase() + string.slice(1);
}

export function safeEvaluate(expression) {
  // Sanitize input - only allow numbers, operators, and spaces
  const sanitized = expression.replace(/[^\d+\-*/\s().%]/g, '');

  // Tokenize the expression
  const tokens = sanitized.match(/\d+\.?\d*|[+\-*/()%]/g) || [];

  // Convert to RPN (Reverse Polish Notation)
  const output = [];
  const operators = [];
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2 };

  tokens.forEach(token => {
    if (!isNaN(token)) {
      output.push(parseFloat(token));
    } else if (token === '(') {
      operators.push(token);
    } else if (token === ')') {
      while (operators.length && operators[operators.length - 1] !== '(') {
        output.push(operators.pop());
      }
      operators.pop(); // Remove '('
    } else {
      while (operators.length && precedence[operators[operators.length - 1]] >= precedence[token]) {
        output.push(operators.pop());
      }
      operators.push(token);
    }
  });

  // Push remaining operators
  while (operators.length) {
    output.push(operators.pop());
  }

  // Evaluate RPN
  const stack = [];
  output.forEach(token => {
    if (typeof token === 'number') {
      stack.push(token);
    } else {
      const b = stack.pop();
      const a = stack.pop();
      switch (token) {
        case '+':
          stack.push(a + b);
          break;
        case '-':
          stack.push(a - b);
          break;
        case '*':
          stack.push(a * b);
          break;
        case '/':
          stack.push(a / b);
          break;
        case '%':
          stack.push(a % b);
          break;
      }
    }
  });

  return stack.length === 1 ? stack[0] : NaN;
}

export const getDefaultAbility = (initialValue = '') => {
  const properties = {
    required: false,
    blank: true,
    choices: Object.keys(CONFIG.SDM.abilityAbbreviations).reduce((acc, key) => {
      acc[key] = game.i18n.localize(CONFIG.SDM.abilityAbbreviations[key]);
      return acc;
    }, {})
  };

  return new foundry.data.fields.StringField({
    ...properties,
    ...(initialValue && { initial: initialValue })
  });
};
