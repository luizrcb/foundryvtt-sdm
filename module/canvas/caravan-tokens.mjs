import { ActorType } from '../helpers/constants.mjs';
import { $fmt, $l10n } from '../helpers/globalUtils.mjs';

const MODULE_ID = 'sdm';
const SNAPSHOT_FLAG = 'caravanTokenSnapshot';
const SNAPSHOT_VERSION = 1;
const CHANNEL = 'system.sdm';
const REQUEST_ACTION = 'caravanTokenActionRequest';
const RESULT_ACTION = 'caravanTokenActionResult';
const REQUEST_TIMEOUT = 30000;
const HUD_BUTTON_CLASS = 'sdm-caravan-gather-deploy';

/**
 * Caravan crew gathering/deploying, adapted from the square-spiral placement approach used by
 * Dungeon Crawl Classics and nimble-party (MIT licensed).
 */

/** Caravans with a gather/deploy action currently running. */
const inFlightCaravans = new Set();

/** Caravans whose last rollback failed. They require a world reload before another action. */
const blockedCaravans = new Set();

/** Requests awaiting a response from the active GM. */
const pendingRequests = new Map();

class CaravanTokenError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'CaravanTokenError';
    this.code = code;
    this.details = details;
  }
}

/* -------------------------------------------- */
/*  Setup                                       */
/* -------------------------------------------- */

export function setupCaravanTokenControls() {
  Hooks.on('renderTokenHUD', onRenderTokenHUD);
  game.socket.on(CHANNEL, onSocketMessage);
}

/* -------------------------------------------- */
/*  HUD                                         */
/* -------------------------------------------- */

function onRenderTokenHUD(hud, html) {
  const token = hud?.document ?? hud?.object?.document;
  const actor = token?.baseActor ?? token?.actor;
  if (!token || !actor || actor.type !== ActorType.CARAVAN) return;
  if (!game.user.isGM && !actor.testUserPermission(game.user, 'OWNER')) return;

  const root = html?.querySelectorAll ? html : html?.[0];
  if (!root || root.querySelector(`.${HUD_BUTTON_CLASS}`)) return;

  const container = root.querySelector('.col.right') ?? root;
  const label = $l10n('SDM.CaravanTokenGatherDeploy');

  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('control-icon', HUD_BUTTON_CLASS);
  button.dataset.tooltip = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = '<i class="fa-solid fa-people-group" inert></i>';

  button.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();

    const scene = token.parent ?? hud.object?.scene;
    if (!scene) return;

    const selectedTokenIds = Array.from(canvas.tokens?.controlled ?? [])
      .map(controlled => controlled.document?.id ?? controlled.id)
      .filter(Boolean);

    await requestCaravanTokenAction({
      caravan: actor,
      scene,
      caravanToken: token,
      selectedTokenIds
    });
  });

  container.append(button);
}

/* -------------------------------------------- */
/*  Requests                                    */
/* -------------------------------------------- */

async function requestCaravanTokenAction({ caravan, scene, caravanToken, selectedTokenIds }) {
  if (!caravan || caravan.type !== ActorType.CARAVAN) {
    return notifyOutcome({ success: false, error: 'invalid-caravan' });
  }

  if (!game.user.isGM && !caravan.testUserPermission(game.user, 'OWNER')) {
    return notifyOutcome({ success: false, error: 'unauthorized' });
  }

  const activeGM = game.users.activeGM;
  const canRunLocally = game.user.isGM && (!activeGM || activeGM.id === game.user.id);

  if (canRunLocally) {
    const outcome = await runCaravanTokenAction({
      caravan,
      scene,
      caravanToken,
      selectedTokenIds
    });
    return notifyOutcome(outcome);
  }

  if (!activeGM) {
    ui.notifications.warn($l10n('SDM.ErrorNoActiveGM'));
    return { success: false, error: 'no-active-gm' };
  }

  const requestId = foundry.utils.randomID();
  const payload = {
    caravanActorId: caravan.id,
    sceneId: scene.id,
    tokenId: caravanToken.id,
    selectedTokenIds: Array.isArray(selectedTokenIds) ? selectedTokenIds : []
  };

  const outcome = await new Promise(resolve => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      resolve({ success: false, error: 'timeout' });
    }, REQUEST_TIMEOUT);

    pendingRequests.set(requestId, { resolve, timeout });

    game.socket.emit(CHANNEL, {
      action: REQUEST_ACTION,
      requestId,
      userId: game.user.id,
      payload
    });
  });

  return notifyOutcome(outcome);
}

function onSocketMessage(message) {
  if (!message || typeof message !== 'object') return;

  if (message.action === REQUEST_ACTION) {
    handleSocketRequest(message);
    return;
  }

  if (message.action !== RESULT_ACTION) return;
  if (message.userId !== game.user.id) return;

  const pending = pendingRequests.get(message.requestId);
  if (!pending) return;

  pendingRequests.delete(message.requestId);
  clearTimeout(pending.timeout);
  pending.resolve(message.payload ?? { success: false, error: 'unexpected' });
}

async function handleSocketRequest(message) {
  const { requestId, userId, payload } = message;
  if (!requestId || !userId) return;

  const activeGM = game.users.activeGM;
  if (!game.user.isGM || (activeGM && activeGM.id !== game.user.id)) return;

  const respond = response => {
    game.socket.emit(CHANNEL, {
      action: RESULT_ACTION,
      requestId,
      userId,
      payload: response
    });
  };

  try {
    const requestUser = game.users.get(userId);
    if (!requestUser) {
      respond({ success: false, error: 'invalid-request' });
      return;
    }

    const { caravanActorId, sceneId, tokenId, selectedTokenIds } = payload ?? {};
    if (!caravanActorId || !sceneId) {
      respond({ success: false, error: 'invalid-request' });
      return;
    }

    const caravan = game.actors.get(caravanActorId);
    if (!caravan || caravan.type !== ActorType.CARAVAN) {
      respond({ success: false, error: 'invalid-caravan' });
      return;
    }

    if (!requestUser.isGM && !caravan.testUserPermission(requestUser, 'OWNER')) {
      respond({ success: false, error: 'unauthorized' });
      return;
    }

    const scene = game.scenes.get(sceneId);
    if (!scene) {
      respond({ success: false, error: 'missing-scene' });
      return;
    }

    const caravanToken = resolveCaravanToken(scene, caravan, tokenId);
    const outcome = await runCaravanTokenAction({
      caravan,
      scene,
      caravanToken,
      selectedTokenIds: Array.isArray(selectedTokenIds) ? selectedTokenIds : []
    });

    respond(outcome);
  } catch (error) {
    respond(toErrorOutcome(error));
  }
}

function resolveCaravanToken(scene, caravan, tokenId) {
  const belongsToCaravan = token => (token.actorId ?? token.actor?.id) === caravan.id;

  if (tokenId) {
    const token = scene.tokens.get(tokenId);
    if (token && belongsToCaravan(token)) return token;
  }

  const matches = scene.tokens.filter(belongsToCaravan);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) throw new CaravanTokenError('ambiguous-token');
  throw new CaravanTokenError('missing-token');
}

/* -------------------------------------------- */
/*  Action                                      */
/* -------------------------------------------- */

async function runCaravanTokenAction({ caravan, scene, caravanToken, selectedTokenIds = [] }) {
  if (!caravan || caravan.type !== ActorType.CARAVAN) {
    return { success: false, error: 'invalid-caravan' };
  }

  if (blockedCaravans.has(caravan.id)) {
    return { success: false, error: 'blocked' };
  }

  if (inFlightCaravans.has(caravan.id)) {
    return { success: false, error: 'busy' };
  }

  if (!scene) return { success: false, error: 'missing-scene' };
  if (!caravanToken) return { success: false, error: 'missing-token' };
  if ((caravanToken.actorId ?? caravanToken.actor?.id) !== caravan.id) {
    return { success: false, error: 'invalid-caravan' };
  }

  inFlightCaravans.add(caravan.id);

  try {
    const result = await performCaravanTokenAction({
      caravan,
      scene,
      caravanToken,
      selectedTokenIds
    });
    return { success: true, result };
  } catch (error) {
    if (error instanceof CaravanTokenError) {
      if (error.details?.rollbackComplete === false) blockedCaravans.add(caravan.id);
      return { success: false, error: error.code, details: error.details };
    }

    console.error('SDM | Caravan crew action failed', error);
    return { success: false, error: 'unexpected', details: { message: error?.message } };
  } finally {
    inFlightCaravans.delete(caravan.id);
  }
}

async function performCaravanTokenAction({ caravan, scene, caravanToken, selectedTokenIds }) {
  const crewActors = await getCrewActors(caravan);
  const crewActorIds = new Set(crewActors.map(actor => actor.id));
  const sceneCrewTokens = scene.tokens.filter(
    token => token.id !== caravanToken.id && crewActorIds.has(token.actorId)
  );
  // Any crew on the scene (deployed earlier or placed from the sheet buttons): gather them.
  // Selected crew tokens limit the gather to those (handled in gatherCrew).
  if (sceneCrewTokens.length) {
    return gatherCrew({ caravan, scene, caravanToken, selectedTokenIds, sceneCrewTokens });
  }

  // Nobody on the scene: deploy the gathered crew, then anyone who was never gathered
  const snapshot = readSnapshot(caravan);
  let result = null;
  if (snapshot) {
    result = await deployFromSnapshot({ caravan, scene, caravanToken, snapshot });
  }

  const stillMissing = crewActors.filter(
    actor => !scene.tokens.some(token => token.id !== caravanToken.id && token.actorId === actor.id)
  );
  if (stillMissing.length) {
    const rest = await deployFromPrototypes({ caravan, scene, caravanToken, crewActors: stillMissing });
    result = result ? { ...result, deployed: result.deployed + rest.deployed } : rest;
  }

  if (!result) throw new CaravanTokenError('nothing-to-do');
  return result;
}

/* -------------------------------------------- */
/*  Gather                                      */
/* -------------------------------------------- */

async function gatherCrew({ caravan, scene, caravanToken, selectedTokenIds, sceneCrewTokens }) {
  let candidates = sceneCrewTokens;

  const selected = new Set(
    (Array.isArray(selectedTokenIds) ? selectedTokenIds : []).filter(id => typeof id === 'string')
  );
  const hasExplicitSelection = scene.tokens.some(
    token => selected.has(token.id) && token.id !== caravanToken.id
  );

  if (hasExplicitSelection) {
    candidates = candidates.filter(token => selected.has(token.id));
  }

  if (!candidates.length) throw new CaravanTokenError('nothing-to-do');

  const combat = game.combat?.started && game.combat.scene?.id === scene.id ? game.combat : null;
  const isInCombat = token =>
    !!combat &&
    combat.combatants.some(
      combatant =>
        combatant.tokenId === token.id ||
        (!combatant.tokenId && combatant.actorId === token.actorId)
    );

  const skippedCombatTokenIds = candidates.filter(isInCombat).map(token => token.id);
  const gatherable = candidates.filter(token => !isInCombat(token));

  if (!gatherable.length) {
    return {
      action: 'gather',
      gathered: 0,
      deployed: 0,
      skippedCombatTokenIds,
      skippedMemberIds: []
    };
  }

  const snapshot = createSnapshot(scene, gatherable);

  await caravan.setFlag(MODULE_ID, SNAPSHOT_FLAG, snapshot);

  const stored = readSnapshot(caravan);
  if (!snapshotMatches(stored, snapshot)) {
    const cleared = await clearSnapshot(caravan);
    throw new CaravanTokenError('snapshot-save-failed', { rollbackComplete: cleared });
  }

  const currentTokenIds = new Set(scene.tokens.map(token => token.id));
  const missingOriginals = snapshot.members.filter(
    member => !currentTokenIds.has(member.tokenData._id)
  );

  if (missingOriginals.length) {
    const rollbackComplete = await rollbackGather({ caravan, scene, snapshot });
    throw new CaravanTokenError('gather-context-changed', { rollbackComplete });
  }

  try {
    await scene.deleteEmbeddedDocuments(
      'Token',
      gatherable.map(token => token.id)
    );
  } catch (error) {
    console.error('SDM | Failed to delete caravan crew tokens', error);
    const rollbackComplete = await rollbackGather({ caravan, scene, snapshot });
    throw new CaravanTokenError('gather-delete-failed', { rollbackComplete });
  }

  const remainingTokenIds = gatherable
    .map(token => token.id)
    .filter(tokenId => scene.tokens.has(tokenId));

  if (remainingTokenIds.length) {
    const rollbackComplete = await rollbackGather({ caravan, scene, snapshot });
    throw new CaravanTokenError('gather-delete-failed', { rollbackComplete });
  }

  return {
    action: 'gather',
    gathered: gatherable.length,
    deployed: 0,
    skippedCombatTokenIds,
    skippedMemberIds: []
  };
}

function createSnapshot(scene, tokens) {
  return {
    version: SNAPSHOT_VERSION,
    sceneId: scene.id,
    members: tokens.map(token => ({
      actorId: token.actorId,
      tokenData: sanitizeTokenData(token.toObject())
    }))
  };
}

async function rollbackGather({ caravan, scene, snapshot }) {
  const rollbackComplete = await restoreSnapshotTokens({ caravan, scene, snapshot });

  if (!rollbackComplete) {
    blockedCaravans.add(caravan.id);
    return false;
  }

  const cleared = await clearSnapshot(caravan);
  if (!cleared) {
    blockedCaravans.add(caravan.id);
    return false;
  }

  return true;
}

async function restoreSnapshotTokens({ caravan, scene, snapshot }) {
  const existingTokenIds = new Set(scene.tokens.map(token => token.id));
  const missingMembers = snapshot.members.filter(
    member => !existingTokenIds.has(member.tokenData._id)
  );

  if (!missingMembers.length) return true;

  const restoreData = missingMembers.map(member => {
    const tokenData = sanitizeTokenData(member.tokenData);
    const levelInfo = resolveLevelData(scene, tokenData, scene);
    if (levelInfo.level) tokenData.level = levelInfo.level;
    else delete tokenData.level;
    tokenData.elevation = levelInfo.elevation;
    return tokenData;
  });

  try {
    await scene.createEmbeddedDocuments('Token', restoreData, { keepId: true });
    return true;
  } catch (error) {
    console.error('SDM | Failed to restore caravan crew tokens', error);
    blockedCaravans.add(caravan.id);
    return false;
  }
}

/* -------------------------------------------- */
/*  Deploy                                      */
/* -------------------------------------------- */

async function deployFromSnapshot({ caravan, scene, caravanToken, snapshot }) {
  if (!isValidSnapshot(snapshot)) throw new CaravanTokenError('invalid-snapshot');

  const sourceScene = game.scenes.get(snapshot.sceneId);
  if (!sourceScene) throw new CaravanTokenError('missing-source-scene');

  if (!snapshot.members.length) {
    const cleared = await clearSnapshot(caravan);
    if (!cleared) throw new CaravanTokenError('snapshot-clear-failed', { rollbackComplete: false });
    return {
      action: 'deploy',
      gathered: 0,
      deployed: 0,
      skippedCombatTokenIds: [],
      skippedMemberIds: []
    };
  }

  const sourceTokenIds = new Set(sourceScene.tokens.map(token => token.id));
  const originalsStillExist = snapshot.members.some(member =>
    sourceTokenIds.has(member.tokenData._id)
  );

  if (originalsStillExist) {
    throw new CaravanTokenError('original-token-exists');
  }

  const deployedActorIds = new Set(
    scene.tokens
      .filter(token => token.id !== caravanToken.id)
      .map(token => token.actorId)
      .filter(Boolean)
  );

  const skippedMemberIds = [];
  const membersToDeploy = [];

  for (const member of snapshot.members) {
    const actor = game.actors.get(member.actorId);
    if (!actor) {
      skippedMemberIds.push(member.actorId);
      continue;
    }

    if (deployedActorIds.has(member.actorId)) {
      skippedMemberIds.push(member.actorId);
      continue;
    }

    membersToDeploy.push(member);
  }

  // Characters always come first
  membersToDeploy.sort((a, b) =>
    byCharactersFirst(game.actors.get(a.actorId), game.actors.get(b.actorId))
  );

  const tokenData = buildDeploymentData({
    members: membersToDeploy.map(member => member.tokenData),
    scene,
    sourceScene,
    caravanToken
  });

  let created = [];
  if (tokenData.length) {
    try {
      created = await scene.createEmbeddedDocuments('Token', tokenData, { keepId: true });
    } catch (error) {
      console.error('SDM | Failed to deploy caravan crew tokens', error);
      await cleanupCreatedTokens(
        scene,
        tokenData.map(data => data._id)
      );
      throw new CaravanTokenError('deploy-create-failed');
    }

    if (created.length !== tokenData.length) {
      await cleanupCreatedTokens(
        scene,
        tokenData.map(data => data._id)
      );
      throw new CaravanTokenError('deploy-create-failed');
    }
  }

  const cleared = await clearSnapshot(caravan);
  if (!cleared) {
    blockedCaravans.add(caravan.id);
    throw new CaravanTokenError('snapshot-clear-failed', { rollbackComplete: false });
  }

  return {
    action: 'deploy',
    gathered: 0,
    deployed: created.length,
    skippedCombatTokenIds: [],
    skippedMemberIds
  };
}

async function deployFromPrototypes({ caravan, scene, caravanToken, crewActors }) {
  const existingActorIds = new Set(
    scene.tokens
      .filter(token => token.id !== caravanToken.id)
      .map(token => token.actorId)
      .filter(Boolean)
  );

  const skippedMemberIds = [];
  const actorsToDeploy = [];

  for (const actor of crewActors) {
    if (existingActorIds.has(actor.id)) {
      skippedMemberIds.push(actor.id);
      continue;
    }
    actorsToDeploy.push(actor);
  }

  if (!actorsToDeploy.length) {
    if (skippedMemberIds.length) {
      return {
        action: 'deploy',
        gathered: 0,
        deployed: 0,
        skippedCombatTokenIds: [],
        skippedMemberIds
      };
    }
    throw new CaravanTokenError('nothing-to-do');
  }

  const sourceTokenData = [];
  for (const actor of actorsToDeploy) {
    const tokenDocument = await actor.getTokenDocument({}, { parent: scene });
    sourceTokenData.push(sanitizeTokenData(tokenDocument.toObject()));
  }

  const tokenData = buildDeploymentData({
    members: sourceTokenData,
    scene,
    sourceScene: scene,
    caravanToken
  });

  let created = [];
  try {
    created = await scene.createEmbeddedDocuments('Token', tokenData, { keepId: true });
  } catch (error) {
    console.error('SDM | Failed to deploy caravan crew prototypes', error);
    await cleanupCreatedTokens(
      scene,
      tokenData.map(data => data._id)
    );
    throw new CaravanTokenError('deploy-create-failed');
  }

  if (created.length !== tokenData.length) {
    await cleanupCreatedTokens(
      scene,
      tokenData.map(data => data._id)
    );
    throw new CaravanTokenError('deploy-create-failed');
  }

  return {
    action: 'deploy',
    gathered: 0,
    deployed: created.length,
    skippedCombatTokenIds: [],
    skippedMemberIds
  };
}

function buildDeploymentData({ members, scene, sourceScene, caravanToken }) {
  const startRing = Math.max(
    1,
    Math.ceil((Math.max(caravanToken.width ?? 1, caravanToken.height ?? 1) + 1) / 2)
  );
  const offsets = getSpiralOffsets(members.length, startRing);
  const TokenDocumentClass = getDocumentClass('Token');

  return members.map((memberData, index) => {
    const tokenData = sanitizeTokenData(memberData);
    tokenData._id = foundry.utils.randomID();
    delete tokenData._movementHistory;
    delete tokenData._regions;

    const levelInfo = resolveLevelData(scene, tokenData, sourceScene);
    if (levelInfo.level) tokenData.level = levelInfo.level;
    else delete tokenData.level;
    tokenData.elevation = levelInfo.elevation;

    const tokenDocument = new TokenDocumentClass(tokenData, { parent: scene });
    const placement = getPlacementPosition({
      tokenDocument,
      offset: offsets[index] ?? [0, 0],
      caravanToken,
      scene
    });

    tokenData.x = placement.x;
    tokenData.y = placement.y;
    tokenData.elevation = placement.elevation;

    return tokenData;
  });
}

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

async function getCrewActors(caravan) {
  const crew = caravan.system?.crew ?? {};
  const actorIds = [
    ...new Set(
      Object.values(crew)
        .map(member => member?.id)
        .filter(Boolean)
    )
  ];

  const actors = [];
  for (const actorId of actorIds) {
    const actor = await fromUuid(actorId);
    if (!actor || actor.documentName !== 'Actor') continue;
    if (actor.id === caravan.id || actor.type === ActorType.CARAVAN) continue;
    actors.push(actor);
  }

  return actors.sort(byCharactersFirst);
}

/** Sort comparator: characters before any other actor type (stable otherwise). */
function byCharactersFirst(a, b) {
  return Number(a?.type !== ActorType.CHARACTER) - Number(b?.type !== ActorType.CHARACTER);
}

function readSnapshot(caravan) {
  return caravan.getFlag(MODULE_ID, SNAPSHOT_FLAG) ?? null;
}

async function clearSnapshot(caravan) {
  try {
    await caravan.unsetFlag(MODULE_ID, SNAPSHOT_FLAG);
  } catch (error) {
    console.error('SDM | Failed to clear caravan crew snapshot', error);
    return false;
  }

  return !readSnapshot(caravan);
}

function isValidSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  if (snapshot.version !== SNAPSHOT_VERSION) return false;
  if (typeof snapshot.sceneId !== 'string') return false;
  if (!Array.isArray(snapshot.members)) return false;

  return snapshot.members.every(
    member =>
      member &&
      typeof member === 'object' &&
      typeof member.actorId === 'string' &&
      member.tokenData &&
      typeof member.tokenData === 'object' &&
      typeof member.tokenData._id === 'string' &&
      member.tokenData._id.length > 0
  );
}

function snapshotMatches(stored, expected) {
  if (!isValidSnapshot(stored) || !isValidSnapshot(expected)) return false;
  if (stored.sceneId !== expected.sceneId) return false;
  if (stored.members.length !== expected.members.length) return false;

  const storedMembers = new Map(stored.members.map(member => [member.tokenData._id, member]));

  return expected.members.every(member => {
    const storedMember = storedMembers.get(member.tokenData._id);
    if (!storedMember) return false;
    if (storedMember.actorId !== member.actorId) return false;

    return foundry.utils.equals(
      sanitizeTokenData(storedMember.tokenData),
      sanitizeTokenData(member.tokenData)
    );
  });
}

function sanitizeTokenData(tokenData) {
  const data = foundry.utils.deepClone(tokenData ?? {});
  delete data._movementHistory;
  delete data._regions;
  return data;
}

function resolveLevelData(scene, tokenData, sourceScene) {
  const source = sourceScene ?? scene;
  const sourceLevel =
    source?.levels?.get?.(tokenData.level) ??
    source?.initialLevel ??
    source?.levels?.contents?.[0] ??
    null;
  const targetLevel =
    scene?.levels?.get?.(tokenData.level) ??
    scene?.initialLevel ??
    scene?.levels?.contents?.[0] ??
    null;
  const levelId = targetLevel?.id ?? null;
  const sourceBase = sourceLevel?.elevation?.base ?? 0;
  const targetBase = targetLevel?.elevation?.base ?? 0;
  const elevation = (tokenData.elevation ?? 0) - sourceBase + targetBase;

  return { level: levelId, elevation };
}

function getPlacementPosition({ tokenDocument, offset, caravanToken, scene }) {
  const grid = scene.grid;
  const sizeX = grid.sizeX ?? grid.size;
  const sizeY = grid.sizeY ?? grid.size;
  const origin = caravanToken.getCenterPoint();
  const widthPx = tokenDocument.width * sizeX;
  const heightPx = tokenDocument.height * sizeY;

  const x = origin.x + offset[0] * sizeX - widthPx / 2;
  const y = origin.y + offset[1] * sizeY - heightPx / 2;

  return tokenDocument.getSnappedPosition({
    x,
    y,
    width: tokenDocument.width,
    height: tokenDocument.height,
    shape: tokenDocument.shape
  });
}

function getSpiralOffsets(count, startRing) {
  const offsets = [];

  for (let ring = startRing; offsets.length < count; ring++) {
    for (let x = -ring; x <= ring; x++) offsets.push([x, -ring]);
    for (let y = -ring + 1; y <= ring; y++) offsets.push([ring, y]);
    for (let x = ring - 1; x >= -ring; x--) offsets.push([x, ring]);
    for (let y = ring - 1; y >= -ring + 1; y--) offsets.push([-ring, y]);
  }

  return offsets.slice(0, count);
}

async function cleanupCreatedTokens(scene, tokenIds) {
  const existingIds = tokenIds.filter(tokenId => scene.tokens.has(tokenId));
  if (!existingIds.length) return;

  try {
    await scene.deleteEmbeddedDocuments('Token', existingIds);
  } catch (error) {
    console.error('SDM | Failed to clean up caravan crew tokens', error);
  }
}

function toErrorOutcome(error) {
  if (error instanceof CaravanTokenError) {
    return { success: false, error: error.code, details: error.details };
  }

  console.error('SDM | Caravan crew request failed', error);
  return { success: false, error: 'unexpected', details: { message: error?.message } };
}

/* -------------------------------------------- */
/*  Notifications                               */
/* -------------------------------------------- */

function notifyOutcome(outcome) {
  if (!outcome?.success) {
    const code = outcome?.error;

    if (code === 'no-active-gm') return outcome;

    if (outcome?.details?.rollbackComplete === false) {
      ui.notifications.error($l10n('SDM.CaravanTokenErrorRollbackFailed'));
      return outcome;
    }

    const key = `SDM.CaravanTokenError${toPascalCase(code)}`;
    const message = game.i18n.has(key) ? $l10n(key) : $l10n('SDM.CaravanTokenErrorUnexpected');
    ui.notifications.error(message);
    return outcome;
  }

  const result = outcome.result ?? {};
  const skippedMembers = result.skippedMemberIds?.length ?? 0;
  const skippedCombat = result.skippedCombatTokenIds?.length ?? 0;

  if (result.action === 'gather') {
    if (result.gathered > 0) {
      ui.notifications.info($fmt('SDM.CaravanTokenGathered', { count: result.gathered }));
    } else {
      ui.notifications.warn($l10n('SDM.CaravanTokenNothingToGather'));
    }

    if (skippedCombat > 0) {
      ui.notifications.warn($fmt('SDM.CaravanTokenSkippedCombat', { count: skippedCombat }));
    }

    return outcome;
  }

  if (result.deployed > 0) {
    ui.notifications.info($fmt('SDM.CaravanTokenDeployed', { count: result.deployed }));
    if (skippedMembers > 0) {
      ui.notifications.info($fmt('SDM.CaravanTokenSkippedMembers', { count: skippedMembers }));
    }
  } else if (skippedMembers > 0) {
    ui.notifications.info($l10n('SDM.CaravanTokenAlreadyDeployed'));
  } else {
    ui.notifications.warn($l10n('SDM.CaravanTokenNothingToDeploy'));
  }

  return outcome;
}

function toPascalCase(value) {
  return String(value ?? '')
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
