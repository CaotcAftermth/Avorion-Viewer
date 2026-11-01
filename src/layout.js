// A binary split tree owns area geometry; editor state remains on its leaves.
export const EDITORS = { viewport: '3D Viewport', outliner: 'Outliner', properties: 'Properties', info: 'Info', preferences: 'Preferences', color: 'Color Editor', assets: 'Asset Library' };
export const uid = () => globalThis.crypto.randomUUID();
export const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
export const area = (editor = 'viewport') => ({ id: uid(), type: 'area', editor, toolbar: true, sidebar: false, sidebarWidth: 220, headerBottom: false, view: { yaw: Math.PI/4, pitch: Math.atan(1/Math.sqrt(2)), zoom: 1, panX: 0, panY: 0, grid: true, showThinBlocks: true, wire: false, tool: 'select', target: [0,0,1], roll: 0, projection: 'perspective' } });
export const split = (axis, ratio, first, second) => ({ id: uid(), type: 'split', axis, ratio, first, second });
export function defaults() {
  return { version: 1, active: 'layout', workspaces: [
    { id: 'layout', name: 'Layout', root: split('x', 0.77, split('y', 0.82, area(), area('info')), split('y', 0.36, area('outliner'), area('properties'))) },
    { id: 'inspection', name: 'Inspection', root: split('x', 0.74, area(), split('y', 0.4, area('outliner'), area('properties'))) },
    { id: 'compare', name: 'Compare', root: split('x', 0.5, area(), area()) }
  ] };
}
export function leaves(node) { return node.type === 'area' ? [node] : [...leaves(node.first), ...leaves(node.second)]; }
export function find(node, id) { return node.id === id ? node : node.type === 'split' ? find(node.first, id) || find(node.second, id) : null; }
export function parentOf(node, id) {
  if (node.type !== 'split') return null;
  return node.first.id === id || node.second.id === id ? node : parentOf(node.first, id) || parentOf(node.second, id);
}
export function replace(node, id, replacement) {
  if (node.id === id) return replacement;
  if (node.type === 'split') { node.first = replace(node.first, id, replacement); node.second = replace(node.second, id, replacement); }
  return node;
}
export function cloneTree(node) {
  const copy = structuredClone(node);
  const visit = n => { n.id = uid(); if (n.type === 'split') { visit(n.first); visit(n.second); } };
  visit(copy); return copy;
}
export function splitArea(root, id, axis, ratio = 0.5) {
  const node = find(root, id);
  if (!node || node.type !== 'area' || !['x', 'y'].includes(axis)) return root;
  return replace(root, id, split(axis, clamp(ratio, 0.05, 0.95), node, cloneTree(node)));
}
export function joinArea(root, keepId, removeId) {
  const parent = parentOf(root, keepId);
  if (!parent || ![parent.first.id, parent.second.id].includes(removeId)) return root;
  const keep = find(root, keepId), remove = find(root, removeId);
  if (keep.type !== 'area' || remove.type !== 'area') return root;
  return replace(root, parent.id, keep);
}
export function swapAreas(root, idA, idB) {
  const a = find(root, idA), b = find(root, idB);
  if (!a || !b || a.type !== 'area' || b.type !== 'area' || a === b) return;
  const dataA = structuredClone(a), dataB = structuredClone(b);
  Object.assign(a, dataB, { id: idA }); Object.assign(b, dataA, { id: idB });
}
export function minimum(node) {
  if (node.type === 'area') return node.editor==='color'?{width:300,height:300}:node.editor==='preferences'?{width:300,height:250}:{ width: 180, height: 88 };
  const a = minimum(node.first), b = minimum(node.second);
  return { width: node.axis === 'x' ? a.width + b.width + 5 : Math.max(a.width, b.width), height: node.axis === 'y' ? a.height + b.height + 5 : Math.max(a.height, b.height) };
}
export function ratioBounds(node, available) {
  const dimension = node.axis === 'x' ? 'width' : 'height';
  const low = minimum(node.first)[dimension] / available;
  const high = 1 - minimum(node.second)[dimension] / available;
  return low <= high ? [low, high] : [0.5, 0.5];
}
export function validateState(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.workspaces) || state.workspaces.length < 1 || state.workspaces.length > 20) return false;
  const ids = new Set(); let count = 0;
  const validId = id => { if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id) || ids.has(id)) return false; ids.add(id); return true; };
  const validNode = (n, depth = 0) => {
    if (!n || depth > 64 || ++count > 300 || !validId(n.id)) return false;
    if (n.type === 'split') return ['x', 'y'].includes(n.axis) && Number.isFinite(n.ratio) && n.ratio > 0 && n.ratio < 1 && validNode(n.first, depth + 1) && validNode(n.second, depth + 1);
    return n.type === 'area' && Object.hasOwn(EDITORS, n.editor) && ['toolbar', 'sidebar', 'headerBottom'].every(k => typeof n[k] === 'boolean') && Number.isFinite(n.sidebarWidth) && n.sidebarWidth >= 140 && n.sidebarWidth <= 600 && n.view && ['yaw', 'pitch', 'zoom', 'panX', 'panY'].every(k => Number.isFinite(n.view[k])) && n.view.zoom >= 0.000001 && n.view.zoom <= 5 && Math.abs(n.view.pitch) <= Math.PI / 2 && ['grid', 'wire'].every(k => typeof n.view[k] === 'boolean') && ['select', 'orbit', 'pan'].includes(n.view.tool)
      && (n.view.target === undefined || (Array.isArray(n.view.target) && n.view.target.length === 3 && n.view.target.every(Number.isFinite)))
      && (n.view.roll === undefined || Number.isFinite(n.view.roll))
      && (n.view.projection === undefined || ['orthographic', 'perspective'].includes(n.view.projection))
      && (n.search === undefined || (typeof n.search === 'string' && n.search.length <= 1000))
      && (n.propertyTab === undefined || ['object', 'scene', 'world', 'shaders', 'workspace', 'turrets'].includes(n.propertyTab))
      && (n.collectionClosed === undefined || typeof n.collectionClosed === 'boolean')
      && (n.panels === undefined || (n.panels && typeof n.panels === 'object' && Object.values(n.panels).every(v => typeof v === 'boolean')));
  };
  return state.workspaces.every(w => w && validId(w.id) && typeof w.name === 'string' && w.name.trim().length > 0 && w.name.length <= 32 && validNode(w.root)) && state.workspaces.some(w => w.id === state.active);
}
