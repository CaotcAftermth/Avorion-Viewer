import {importTurretXml} from './core.js';
import {blockSockets, isTurretBlock} from './sockets.js';
import {createSocketClearance} from './socket-clearance.js';
import {placeTurret} from './mounts.js';

// Match rendered content, not filenames, XML formatting, or ship block indices.
// Ships store each turret already scaled to its mount size, so the same design
// saved at size 10 and at size 0.5 differs by a scale factor plus float32
// rounding noise. Positions are therefore normalised by the largest block and
// compared with a tolerance; an exact rounded key flips on that noise.
const MATCH_TOLERANCE = 1e-4;
function turretSignature(asset) {
  const unit = asset.blocks.reduce((max, {size}) => Math.max(max, size.x, size.y, size.z), 0) || 1;
  const xyz = ({x, y, z}) => [x / unit, y / unit, z / unit];
  const blocks = asset.blocks.map(block => ({
    label: JSON.stringify([asset.parts?.[block.id] || 'base', block.typeIndex, block.materialIndex, block.look, block.up,
      block.color, block.secondaryColor || null]),
    values: [...xyz(block.position), ...xyz(block.size)],
  }));
  const coarse = values => values.map(value => Math.round(value * 1e3)).join(',');
  blocks.sort((a, b) => a.label < b.label ? -1 : a.label > b.label ? 1 :
    (coarse(a.values) < coarse(b.values) ? -1 : coarse(a.values) > coarse(b.values) ? 1 : 0));
  const frame = value => value ? [...value.position.map(v => v / unit), ...(value.rotation || value.axis || [])] : [];
  return {
    labels: JSON.stringify([blocks.map(block => block.label), asset.native?.coaxial || null, asset.native?.shotColor || null,
      (asset.muzzlePositions || []).length]),
    values: [...blocks.flatMap(block => block.values), ...frame(asset.attachment), ...frame(asset.yaw), ...frame(asset.pitch),
      ...(asset.muzzlePositions || []).flat().map(v => v / unit)],
  };
}
function sameSignature(x, y) {
  return x.labels === y.labels && x.values.length === y.values.length &&
    x.values.every((value, i) => Math.abs(value - y.values[i]) <= MATCH_TOLERANCE);
}
export function sameTurretContent(a, b) { return sameSignature(turretSignature(a), turretSignature(b)); }
// `signatureOf` lets a caller reuse signatures across many lookups.
export function findMatchingTurret(assets, asset, signatureOf = turretSignature) {
  const target = signatureOf(asset);
  return assets.find(candidate => candidate !== asset && sameSignature(signatureOf(candidate), target));
}
// Coarse key kept for callers that need a string; use sameTurretContent to compare.
export function turretContentKey(asset) {
  return turretSignature(asset).labels;
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
  const report={restored:0,reused:0,added:0,entries:[]};model.turretRestoration=report;
  const warn = message => model.warnings.push({level:'warn', message});
  let assets;
  try { assets = await library.load(); }
  catch (error) { warn(`Turret library unavailable: ${error.message}`); assets = []; }
  const known = [...assets], signatures = new Map();
  const signatureOf = asset => { let value = signatures.get(asset); if (!value) signatures.set(asset, value = turretSignature(asset)); return value; };
  const blocks = model.blocks, byIndex = new Map(blocks.map(block =>
    [block.itemEl?.getAttribute('index'), block]));
  const clearance = createSocketClearance(blocks), scene = {model};
  for (const design of designs) {
    const index = design.getAttribute('blockIndex'), block = byIndex.get(index);
    const result={index,blockId:block?.id,state:'unresolved',inferred:true};report.entries.push(result);
    try {
      // Respect existing mounts, including edits restored from a session.
      if (block && model.turretMounts?.some(mount => mount.socketId.startsWith(`turret:${block.id}:`))){result.state='existing';continue;}
      const imported = importTurretXml(new XMLSerializer().serializeToString(design),
        `${model.fileName.replace(/\.xml$/i, '')} turret ${index}`, crypto.randomUUID());
      let asset = findMatchingTurret(known, imported, signatureOf);if(asset)report.reused++;
      if (!asset) {
        asset = imported;
        try { asset = await library.add(asset);report.added++; }
        catch (error) { warn(`Turret ${index} restored but could not be saved to the library: ${error.message}`); }
        known.push(asset);
      }
      result.assetId=asset.id;result.asset=asset;result.size=imported.sourceSize;
      if (!block || !isTurretBlock(block)) throw Error('mounting block is missing or is not a turret base');
      const socket = chooseEmbeddedSocket(block, blocks, imported.sourceSize, clearance);
      if (!socket) throw Error('no exposed socket fits the saved turret size');
      // Share the library ID while retaining the geometry and scale authored for this mount.
      placeTurret(scene, {...imported,id:asset.id}, socket, imported.sourceSize);result.state='restored';result.socketId=socket.id;report.restored++;
    } catch (error) { result.reason=error.message;warn(`Turret on block ${index} could not be attached: ${error.message}`); }
  }
  return report;
}
