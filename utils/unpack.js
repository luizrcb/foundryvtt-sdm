const { execSync } = require('child_process');

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
  { name: 'npc_generator', output: `packs-source/${foundryVersion}/npc_generator` },
  { name: 'player_macros', output: `packs-source/${foundryVersion}/player_macros` },
  { name: 'powers', output: `packs-source/${foundryVersion}/powers` },
  { name: 'rolltables', output: `packs-source/${foundryVersion}/rolltables` },
  { name: 'trait_items', output: `packs-source/${foundryVersion}/trait_items` },
  { name: 'traits', output: `packs-source/${foundryVersion}/traits` },
  { name: 'wards', output: `packs-source/${foundryVersion}/wards` },
  { name: 'weapons', output: `packs-source/${foundryVersion}/weapons` }
];

try {
  packs.forEach(pack => {
    console.log(`Unpacking ${pack.name}...`);
    execSync(`fvtt package unpack -n "${pack.name}" --outputDirectory "${pack.output}"`, {
      stdio: 'inherit'
    });
  });
} catch (error) {
  console.error('Unpacking failed:', error);
  process.exit(1);
}
