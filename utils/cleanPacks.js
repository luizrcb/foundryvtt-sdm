// cleanPacks.js
const fs = require('fs');
const path = require('path');

const foldersToDelete = [
  'packs/ability_scores',
  'packs/armors',
  'packs/consumables',
  'packs/creatures',
  'packs/equipment',
  'packs/gadgets',
  'packs/handouts',
  'packs/item_piles',
  'packs/macros',
  'packs/npc_generator',
  'packs/player_macros',
  'packs/powers',
  'packs/rolltables',
  'packs/trait_items',
  'packs/traits',
  'packs/wards',
  'packs/weapons'
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
