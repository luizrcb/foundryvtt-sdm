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

export function toPascalCase(str) {
  const words = str.match(/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]+/gi);
  if (!words) {
    return '';
  }
  return words
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.substr(1).toLowerCase();
    })
    .join(' ');
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


export const foundryVersionIsAtLeast = (v) => {
  const current = game.version ?? `${game.release?.generation}.${game.release?.build ?? 0}`;
  // true if current >= v
  return !foundry.utils.isNewerVersion(v, current);
};

const months = [
  { name: "Newfirst", days: 31 },
  { name: "Lastmonth", days: 30 },
  { name: "Firstmonth", days: 30 },
  { name: "Greenmonth", days: 31 },
  { name: "Redmonth", days: 30 },
  { name: "Orangemonth", days: 30 },
  { name: "Yellowmonth", days: 31 },
  { name: "Oldsecond", days: 30 },
  { name: "Unity", days: 30 },
  { name: "Violetmonth", days: 31 },
  { name: "Snowbringer", days: 30 },
  { name: "Deadwinter", days: 30 }
];

const seasons = [
  { name: "Winter", startMonth: 12, endMonth: 2 },
  { name: "Spring", startMonth: 3, endMonth: 5 },
  { name: "Summer", startMonth: 6, endMonth: 8 },
  { name: "Autumn", startMonth: 9, endMonth: 11 }
];

export const getSeasonAndWeek = (day, monthNumber) => {
  // Encontrar estação
  const season = seasons.find(s => {
    if (s.startMonth <= s.endMonth) {
      return monthNumber >= s.startMonth && monthNumber <= s.endMonth;
    } else {
      // estação que atravessa o ano (Winter)
      return monthNumber >= s.startMonth || monthNumber <= s.endMonth;
    }
  });

  if (!season) {
    throw new Error("Estação não encontrada");
  }

  // Calcular dias passados desde o início da estação
  let daysPassed = 0;

  let currentMonth = season.startMonth;

  while (currentMonth !== monthNumber) {
    const monthIndex = currentMonth - 1;
    daysPassed += months[monthIndex].days;

    currentMonth++;
    if (currentMonth > 12) currentMonth = 1;
  }

  daysPassed += (day - 1);

  // Calcular semana da estação
  let weekOfSeason = Math.floor(daysPassed / 7) + 1;
  if (weekOfSeason > 13) weekOfSeason = 13;

  return {
    season: season.name,
    week: weekOfSeason
  };
}
