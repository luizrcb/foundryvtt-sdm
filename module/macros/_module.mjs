import { abilityGeneration } from './player/abilityGeneration.mjs';
import { diceOracles } from './player/diceOracles.mjs'
import { escalatorDie } from './gm/escalatorDie.mjs';
import { generateRandomBackground } from './player/generateRandomBackground.mjs';
import { characterGeneratorDialog } from './player/characterGenerator.mjs';
import { giveCash } from './gm/giveCash.mjs';
import { giveExperience } from './gm/giveExperience.mjs';
import { giveHeroDice } from './gm/giveHeroDice.mjs';
import { groupInitiative } from './gm/groupInitiative.mjs';
import { randomNPCGenerator } from './gm/randomNPCGenerator.mjs';

const gm = {
  escalatorDie,
  giveCash,
  giveExperience,
  giveHeroDice,
  groupInitiative,
  randomNPCGenerator,
};

const player = {
  diceOracles,
  abilityGeneration,
  generateRandomBackground,
  characterGeneratorDialog
};

export { gm, player };

