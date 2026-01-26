const { execSync } = require('child_process');

const foundryVersion = 'v14'

const packs = [
  { name: 'ability_scores', source: `packs-source/${foundryVersion}/ability_scores` },
  { name: 'armors', source: `packs-source/${foundryVersion}/armors` },
  { name: 'burdens', source: `packs-source/${foundryVersion}/burdens`},
  { name: 'consumables', source: `packs-source/${foundryVersion}/consumables` },
  { name: 'corruption', source: `packs-source/${foundryVersion}corruption` },
  { name: 'creatures', source: `packs-source/${foundryVersion}/creatures` },
  { name: 'gadgets', source: `packs-source/${foundryVersion}/gadgets` },
  { name: 'handouts', source: `packs-source/${foundryVersion}/handouts` },
  { name: 'macros', source: `packs-source/${foundryVersion}/macros` },
  { name: 'npc_generator', source: `packs-source/${foundryVersion}/npc_generator` },
  { name: 'player_macros', source: `packs-source/${foundryVersion}/player_macros` },
  { name: 'powers', source: `packs-source/${foundryVersion}/powers` },
  { name: 'rolltables', source: `packs-source/${foundryVersion}/rolltables` },
  { name: 'trait_items', source: `packs-source/${foundryVersion}/trait_items` },
  { name: 'traits', source: `packs-source/${foundryVersion}/traits` },
  { name: 'wards', source: `packs-source/${foundryVersion}/wards` },
  { name: 'weapons', source: `packs-source/${foundryVersion}/weapons` }
];

try {
  packs.forEach(pack => {
    console.log(`Packing ${pack.name}...`);
    execSync(
      `fvtt package pack -n "${pack.name}" --inputDirectory "${pack.source}" --outputDirectory "packs"`,
      { stdio: 'inherit' }
    );
  });
} catch (error) {
  console.error('Packing failed:', error);
  process.exit(1);
}
