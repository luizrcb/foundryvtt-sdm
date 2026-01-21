import { compilePack } from '@foundryvtt/foundryvtt-cli';
import { promises as fs } from 'fs';

const SYSTEM_ID = process.cwd();
const yaml = false;
const folders = true;

const foundryVersion = 'v14';

const packs = await fs.readdir(`./packs-source/${foundryVersion}`);
for (const pack of packs) {
  if (pack === '.gitattributes' || pack.includes('archived')) continue;

  console.log('Packing ' + pack);
  await compilePack(`${SYSTEM_ID}/packs-source/${foundryVersion}/${pack}`, `${SYSTEM_ID}/packs/${pack}`, {
    yaml,
    recursive: folders
  });
}
