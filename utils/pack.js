const { execSync } = require('child_process');

const packs = [
  { name: 'rolltables', source: 'packs/_source/rolltables' },
  { name: 'macros', source: 'packs/_source/macros' },
  { name: 'player_macros', source: 'packs/_source/player_macros' }
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
