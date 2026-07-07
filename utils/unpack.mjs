import { extractPack } from '@foundryvtt/foundryvtt-cli';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..'); // project root

const packs = [
  { name: 'ability_scores', output: 'packs-source/ability_scores' },
  { name: 'armors', output: 'packs-source/armors' },
  { name: 'burdens', output: 'packs-source/burdens' },
  { name: 'consumables', output: 'packs-source/consumables' },
  { name: 'corruption', output: 'packs-source/corruption' },
  { name: 'creatures', output: 'packs-source/creatures' },
  { name: 'gadgets', output: 'packs-source/gadgets' },
  { name: 'handouts', output: 'packs-source/handouts' },
  { name: 'macros', output: 'packs-source/macros' },
  { name: 'motive_table', output: 'packs-source/motive_table' },
  { name: 'names_tables', output: 'packs-source/names_tables' },
  { name: 'npc_generator', output: 'packs-source/npc_generator' },
  { name: 'player_macros', output: 'packs-source/player_macros' },
  { name: 'powers', output: 'packs-source/powers' },
  { name: 'rolltables', output: 'packs-source/rolltables' },
  { name: 'strange_items_table', output: 'packs-source/strange_items_table' },
  { name: 'strange_items', output: 'packs-source/strange_items' },
  { name: 'trait_items', output: 'packs-source/trait_items' },
  { name: 'traits_tables', output: 'packs-source/traits_tables' },
  { name: 'traits', output: 'packs-source/traits' },
  { name: 'wards', output: 'packs-source/wards' },
  { name: 'weapons', output: 'packs-source/weapons' }
];

const yaml = false;

async function run() {
  for (const pack of packs) {
    // Define both paths inside the loop
    const inputDb = path.join(PROJECT_ROOT, 'packs', pack.name);
    const outputDir = path.join(PROJECT_ROOT, pack.output);

    // Optional: check if .db exists before unpacking
    if (!existsSync(inputDb)) {
      console.log(`⚠️  ${inputDb} not found – skipping ${pack.name}`);
      continue;
    }

    console.log(`Unpacking ${pack.name}...`);
    try {
      await extractPack(inputDb, outputDir, { yaml });
    } catch (err) {
      console.error(`Failed on ${pack.name}:`, err.message);
      // Optionally exit or continue
    }
  }
}

run().catch(err => {
  console.error('Unpacking failed:', err);
  process.exit(1);
});
