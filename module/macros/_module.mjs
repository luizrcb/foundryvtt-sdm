import { abilityGeneration } from './player/abilityGeneration.mjs';
import { escalatorDie } from './gm/escalatorDie.mjs';
import { generateRandomBackground } from './player/generateRandomBackground.mjs';
import { giveCash } from './gm/giveCash.mjs';
import { giveExperience } from './gm/giveExperience.mjs';
import { giveHeroDice } from './gm/giveHeroDice.mjs';
// import { groupInitiative } from './gm/groupInitiative.mjs';
import { randomNPCGenerator } from './gm/randomNPCGenerator.mjs';

const gm = {
  escalatorDie,
  giveCash,
  giveExperience,
  giveHeroDice,
  //groupInitiative,
  randomNPCGenerator
};

const player = {
  abilityGeneration,
  generateRandomBackground
};

export { gm, player };

