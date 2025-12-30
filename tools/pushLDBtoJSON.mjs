import { extractPack } from '@foundryvtt/foundryvtt-cli';
import { promises as fs } from 'fs';
import path from 'path';

const SYSTEM_ID = process.cwd();
const yaml = false;

const packs = await fs.readdir('./packs');
for (const pack of packs) {
  if (pack === '.gitattributes' || pack === '.DS_Store' || pack.includes('archived')) continue;
  console.log('Unpacking ' + pack);
  const directory = `./packs/${pack}`;
  try {
    for (const file of await fs.readdir(directory)) {
      const filePath = path.join(directory, file);
      if (file.endsWith(yaml ? '.yml' : '.json')) await fs.unlink(filePath);
      else await fs.rm(filePath, { recursive: true });
    }
  } catch (error) {
    if (error.code === 'ENOENT') console.log('No files inside of ' + pack);
    else console.log(error);
  }
  await extractPack(`${SYSTEM_ID}/packs/${pack}`, `${SYSTEM_ID}/packs-source/${pack}`, {
    yaml
  });
}
