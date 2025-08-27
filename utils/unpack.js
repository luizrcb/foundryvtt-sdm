const { execSync } = require('child_process');

const packs = [
  { name: 'rolltables', output: 'packs-source/rolltables' },
  { name: 'macros', output: 'packs-source/macros' },
  { name: 'player_macros', output: 'packs-source/player_macros' }
];

try {
  packs.forEach(pack => {
    console.log(`Unpacking ${pack.name}...`);
    execSync(
      `fvtt package unpack -n "${pack.name}" --outputDirectory "${pack.output}"`,
      { stdio: 'inherit' }
    );
  });
} catch (error) {
  console.error('Unpacking failed:', error);
  process.exit(1);
}
