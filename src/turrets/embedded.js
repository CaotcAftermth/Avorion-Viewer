import {importTurretXml} from './core.js';
import {blockSockets, isTurretBlock} from './sockets.js';
import {createSocketClearance} from './socket-clearance.js';
import {placeTurret} from './mounts.js';

// Match rendered content, not filenames, XML formatting, or ship block indices.
export function turretContentKey(asset) {
  const blocks = asset.blocks.map(block => ({
    part: asset.parts[block.id], type: block.typeIndex, material: block.materialIndex,
    position: block.position, size: block.size, look: block.look, up: block.up,
    color: block.color, secondaryColor: block.secondaryColor || null,
  }));
  return JSON.stringify({blocks, size: asset.sourceSize, attachment: asset.attachment,
    yaw: asset.yaw, pitch: asset.pitch, muzzles: asset.muzzlePositions || [],
    coaxial: asset.native?.coaxial || null, shotColor: asset.native?.shotColor || null});
}

export function chooseEmbeddedSocket(block, blocks, size, clearance) {
  const parent = blocks.find(candidate => candidate.id === block.parentId);
  const center = parent?.position || Object.fromEntries(['x','y','z'].map(axis =>
    [axis, blocks.reduce((sum, item) => sum + item.position[axis], 0) / blocks.length]));
  const outward = ['x','y','z'].map(axis => block.position[axis] - center[axis]);
  const candidates = blockSockets(block).filter(socket => socket.fitSize >= size)
    .map(socket => ({...socket, fitSize: clearance(socket)}))
    .filter(socket => socket.fitSize >= size);
  candidates.sort((a,b) => {
    const score = socket => socket.normal.reduce((sum, value, i) => sum + value * outward[i], 0);
    return score(b) - score(a) || b.fitSize - a.fitSize;
  });
  return candidates[0];
}

export async function restoreEmbeddedTurrets(model, library) {
  const designs = [...(model.doc?.getElementsByTagName('turretDesign') || [])]
    .filter(node => node.hasAttribute('blockIndex'));
  if (!designs.length) return;
  const warn = message => model.warnings.push({level:'warn', message});
  let assets;
  try { assets = await library.load(); }
  catch (error) { warn(`Turret library unavailable: ${error.message}`); assets = []; }
  const byContent = new Map(assets.map(asset => [turretContentKey(asset), asset]));
  const blocks = model.blocks, byIndex = new Map(blocks.map(block =>
    [block.itemEl?.getAttribute('index'), block]));
  const clearance = createSocketClearance(blocks), scene = {model};
  for (const design of designs) {
    const index = design.getAttribute('blockIndex'), block = byIndex.get(index);
    try {
      if (!block || !isTurretBlock(block)) throw Error('mounting block is missing or is not a turret base');
      // Respect existing mounts, including edits restored from a session.
      if (model.turretMounts?.some(mount => mount.socketId.startsWith(`turret:${block.id}:`))) continue;
      const imported = importTurretXml(new XMLSerializer().serializeToString(design),
        `${model.fileName.replace(/\.xml$/i, '')} turret ${index}`, crypto.randomUUID());
      const key = turretContentKey(imported);
      let asset = byContent.get(key);
      if (!asset) {
        asset = imported;
        try { asset = await library.add(asset); }
        catch (error) { warn(`Turret ${index} restored but could not be saved to the library: ${error.message}`); }
        byContent.set(key, asset);
      }
      const socket = chooseEmbeddedSocket(block, blocks, imported.sourceSize, clearance);
      if (!socket) throw Error('no exposed socket fits the saved turret size');
      placeTurret(scene, asset, socket, imported.sourceSize);
    } catch (error) { warn(`Turret on block ${index} could not be attached: ${error.message}`); }
  }
}
