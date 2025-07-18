// cleanPacks.js
const fs = require('fs');
const path = require('path');

const foldersToDelete = [
  'packs/macros',
  'packs/player_macros',
  'packs/rolltables'
];

const rootDir = path.join(__dirname, '..');

foldersToDelete.forEach(folder => {
  const fullPath = path.join(rootDir, folder);
  if (fs.existsSync(fullPath)) {
    console.log(`Deleting ${folder}...`);
    fs.rmSync(fullPath, { recursive: true, force: true });
  } else {
    console.log(`${folder} not found, skipping...`);
  }
});
