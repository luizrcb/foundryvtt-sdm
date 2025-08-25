import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";

const SYSTEM_ID = process.cwd();
const yaml = false;
const folders = true;

const packs = await fs.readdir("./packs/_source");
for (const pack of packs) {
  if (pack === ".gitattributes") continue;
  console.log("Packing " + pack);
  await compilePack(
    `${SYSTEM_ID}/packs/_source/${pack}`,
    `${SYSTEM_ID}/packs/${pack}`,
    { yaml, recursive: folders },
  );
}
