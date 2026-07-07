import { extractPack } from '@foundryvtt/foundryvtt-cli';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..'); // project root

const foundryVersion = 'v14';

const packs = [
  { name: 'ability_scores', output: `packs-source/${foundryVersion}/ability_scores` },
  { name: 'armors', output: `packs-source/${foundryVersion}/armors` },
  { name: 'burdens', output: `packs-source/${foundryVersion}/burdens` },
  { name: 'consumables', output: `packs-source/${foundryVersion}/consumables` },
  { name: 'corruption', output: `packs-source/${foundryVersion}/corruption` },
  { name: 'creatures', output: `packs-source/${foundryVersion}/creatures` },
  { name: 'gadgets', output: `packs-source/${foundryVersion}/gadgets` },
  { name: 'handouts', output: `packs-source/${foundryVersion}/handouts` },
  { name: 'macros', output: `packs-source/${foundryVersion}/macros` },
  { name: 'motive_table', output: `packs-source/${foundryVersion}/motive_table` },
  { name: 'names_tables', output: `packs-source/${foundryVersion}/names_tables` },
  { name: 'npc_generator', output: `packs-source/${foundryVersion}/npc_generator` },
  { name: 'player_macros', output: `packs-source/${foundryVersion}/player_macros` },
  { name: 'powers', output: `packs-source/${foundryVersion}/powers` },
  { name: 'rolltables', output: `packs-source/${foundryVersion}/rolltables` },
  { name: 'strange_items_table', output: `packs-source/${foundryVersion}/strange_items_table` },
  { name: 'strange_items', output: `packs-source/${foundryVersion}/strange_items` },
  { name: 'trait_items', output: `packs-source/${foundryVersion}/trait_items` },
  { name: 'traits_tables', output: `packs-source/${foundryVersion}/traits_tables` },
  { name: 'traits', output: `packs-source/${foundryVersion}/traits` },
  { name: 'wards', output: `packs-source/${foundryVersion}/wards` },
  { name: 'weapons', output: `packs-source/${foundryVersion}/weapons` }
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
