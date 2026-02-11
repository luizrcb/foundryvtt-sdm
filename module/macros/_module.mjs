import { characterGeneratorDialog } from './gm/characterGenerator.mjs';
import { escalatorDie } from './gm/escalatorDie.mjs';
import { giveCash } from './gm/giveCash.mjs';
import { giveExperience } from './gm/giveExperience.mjs';
import { giveHeroDice } from './gm/giveHeroDice.mjs';
import { groupInitiative } from './gm/groupInitiative.mjs';
import { randomNPCGenerator } from './gm/randomNPCGenerator.mjs';
import { abilityGeneration } from './player/abilityGeneration.mjs';
import { diceOracles } from './player/diceOracles.mjs';
import { generateRandomBackground } from './player/generateRandomBackground.mjs';

const gm = {
  characterGeneratorDialog,
  escalatorDie,
  giveCash,
  giveExperience,
  giveHeroDice,
  groupInitiative,
  randomNPCGenerator,
};

const player = {
  abilityGeneration,
  diceOracles,
  generateRandomBackground,
};

export { gm, player };

