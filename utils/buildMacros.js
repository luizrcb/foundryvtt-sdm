// build-macros.js
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const macroDir = './src/macros';
const outputPath = './packs/macros.db';

const ICON_MAPPING = {
  escalator: 'icons/svg/d20-highlight.svg',
  cash: 'icons/svg/coins.svg',
  experience: 'icons/svg/upgrade.svg',
  hero: 'icons/svg/d6-grey.svg',
  default: 'icons/svg/mystery-man.svg'
};

function getIconForMacro(macroName) {
  const keyword = Object.keys(ICON_MAPPING).find(key => macroName.toLowerCase().includes(key));
  return ICON_MAPPING[keyword] || ICON_MAPPING.default;
}

// Read all macro files
const macroFiles = fs.readdirSync(macroDir).filter(file => file.endsWith('.js'));

const dbEntries = macroFiles.map(file => {
  const macroName = path.basename(file, '.js');
  const macroCode = fs.readFileSync(path.join(macroDir, file), 'utf8');

  return {
    _id: uuidv4(),
    name: macroName.replace(/([A-Z])/g, ' $1').trim(),
    type: 'script',
    command: macroCode,
    img: getIconForMacro(macroName),
    flags: {
      sdm: {
        source: 'compendium',
        version: '1.0.0'
      }
    }
  };
});

// Write to compendium database
fs.writeFileSync(outputPath, JSON.stringify(dbEntries, null, 2));
console.log(`Generated ${dbEntries.length} macros in ${outputPath}`);
