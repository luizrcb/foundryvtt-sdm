// cleanPacks.js
const fs = require('fs');
const path = require('path');

const foldersToDelete = [
  'packs/ability_scores',
  'packs/armors',
  'packs/burdens',
  'packs/consumables',
  'packs/corruption',
  'packs/creatures',
  'packs/equipment',
  'packs/gadgets',
  'packs/handouts',
  'packs/macros',
  'packs/motive_table',
  'packs/names_tables',
  'packs/npc_generator',
  'packs/player_macros',
  'packs/powers',
  'packs/rolltables',
  'packs/strange_items_table',
  'packs/strange_items',
  'packs/trait_items',
  'packs/traits_tables',
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
