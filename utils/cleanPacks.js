// cleanPacks.js
const fs = require('fs');
const path = require('path');

const foldersToDelete = [
  'packs/macros',
  'packs/player_macros',
  'packs/rolltables',
  'packs/equipment',
  'packs/traits',
  'packs/creatures',
  'packs/ability_scores',
  'packs/consumables',
  'packs/gadgets',
  'packs/powers',
  'packs/armors',
  'packs/wards',
  'packs/weapons',
  'packs/handouts',
  'packs/npc_generator'
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
