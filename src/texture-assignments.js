import { openBlockEditor } from './block-workspace.js';
import { BLOCK_DEFINITIONS, MATERIALS } from './block-model.js';
import { BLOCK_FAMILIES } from './avorion/lib/avorion/blockDefinitions.js';
import { getShadingSpec, resolveTextureNames, TEXTURE_SLOTS } from './avorion/lib/textures/shadingMap.js';
import { downloadSave } from './project-files.js';

const blockByIndex = new Map(BLOCK_DEFINITIONS.map(def => [def.typeIndex, def]));
const blockLabel = id => `${blockByIndex.get(id)?.displayName ?? 'Unknown block'} (${id})`;
const catalogFamilies = [
  [1, ...BLOCK_FAMILIES.find(family => family.indices[0] === 2).indices],
  [121, ...BLOCK_FAMILIES.find(family => family.indices[0] === 122).indices],
  ...BLOCK_FAMILIES.filter(({indices:[base]}) => base !== 2 && base !== 122).map(family => family.indices),
  [12, 23], [18, 22], [20, 21], [24, 25], [61, 62, 63, 64, 65], [600, 601], [650, 651],
];
const variantIndices = new Set(catalogFamilies.flatMap(([, ...variants]) => variants));
const variantsByBase = new Map(catalogFamilies.map(([base, ...variants]) => [base, variants]));
const primaryBlocks = [...BLOCK_DEFINITIONS]
  .filter(def => !variantIndices.has(def.typeIndex))
  .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.typeIndex - b.typeIndex);
const shadingFields = [
  ['minReflectivity', 'Min reflectivity', 0, 1],
  ['maxReflectivity', 'Max reflectivity', 0, 1],
  ['specularity', 'Specularity', 0],
  ['glossyness', 'Glossiness', 1],
  ['glow', 'Material glow', 0],
];
const keyFor = ({typeIndex, materialIndex}) => `${typeIndex}:${materialIndex}`;
let lastDraft;
const localFiles = new Map();

export function openTextureAssignments() {
  return openBlockEditor({
    title: 'Texture Assignments',
    label: 'Texture Assignments',
    subtitle: 'Developer',
    mode: 'texture-assignments',
    message: 'Edits affect this preview. Export JSON to keep the settings.',
    configure: (frame, files, shared) => frame.textureAssignments.configure(
      files, shared, lastDraft, [...localFiles.values()], file => localFiles.set(file.name.toLowerCase(), file)
    ),
    onClose: editor => { lastDraft = editor.snapshot(); },
    action: {
      label: 'Export JSON',
      title: 'Download texture assignments and shader values',
      close: false,
      run: editor => downloadSave(editor.snapshot(), 'texture-assignments', '.json'),
    },
  });
}

export function createTextureDraft(block, saved) {
  return {
    typeIndex: saved?.typeIndex ?? block.typeIndex,
    materialIndex: saved?.materialIndex ?? block.materialIndex,
    stock: false,
    assignments: new Map(structuredClone(saved?.assignments ?? []).map(assignment => [keyFor(assignment), assignment])),
  };
}

export function activeTextureAssignment(draft) {
  return draft.stock ? undefined : draft.assignments.get(keyFor(draft));
}

export function snapshotTextureDraft(draft) {
  return structuredClone({
    version: 1, typeIndex: draft.typeIndex, materialIndex: draft.materialIndex,
    assignments: [...draft.assignments.values()],
  });
}

function panel(label) {
  const section = document.createElement('details');
  section.className = 'panel';
  section.open = true;
  const summary = document.createElement('summary');
  summary.textContent = label;
  section.append(summary);
  return section;
}

function field(label, control) {
  const row = document.createElement('label');
  row.className = 'field-row';
  const text = document.createElement('span');
  text.textContent = label;
  control.setAttribute('aria-label', label);
  row.append(text, control);
  return row;
}

function select(options, value, change) {
  const input = document.createElement('select');
  for (const [id, label] of options) input.add(new Option(label, id));
  input.value = value;
  input.onchange = () => change(input.value);
  return input;
}

function blockTypePicker(value, change) {
  const picker = panel('Block type');
  picker.className = 'texture-block-picker';
  picker.firstChild.textContent = blockLabel(value);
  picker.firstChild.setAttribute('aria-label', `Block type: ${blockLabel(value)}`);
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search block types';
  search.setAttribute('aria-label', 'Search block types');
  const list = document.createElement('div');
  list.className = 'texture-block-list';
  const matching = (id, tokens) => tokens.every(token => blockLabel(id).toLowerCase().includes(token));
  function filter() {
    const tokens = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    list.replaceChildren();
    const choice = id => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = blockLabel(id);
      if (id === value) button.setAttribute('aria-current', 'true');
      button.onclick = () => change(id);
      return button;
    };
    for (const {typeIndex:base} of primaryBlocks) {
      const baseMatches = matching(base, tokens);
      const variants = (variantsByBase.get(base) ?? []).filter(id => baseMatches || matching(id, tokens));
      if (!baseMatches && !variants.length) continue;
      const row = document.createElement('div');
      row.className = 'texture-block-row';
      row.append(choice(base));
      list.append(row);
      if (!variants.length) continue;
      const children = document.createElement('div');
      children.className = 'texture-block-variants';
      children.append(...variants.map(choice));
      const arrow = document.createElement('button');
      arrow.type = 'button';
      arrow.className = 'texture-block-arrow';
      arrow.setAttribute('aria-label', `Variants for ${blockLabel(base)}`);
      const expand = open => {
        arrow.textContent = open ? '▾' : '▸';
        arrow.setAttribute('aria-expanded', String(open));
        children.hidden = !open;
      };
      expand(tokens.length > 0 || variants.includes(value));
      arrow.onclick = () => expand(children.hidden);
      row.append(arrow);
      list.append(children);
    }
    if (!list.childElementCount) list.textContent = 'No matching block types';
  }
  search.oninput = filter;
  search.onkeydown = event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const matches = [...list.querySelectorAll('button:not(.texture-block-arrow)')]
      .filter(button => !button.closest('[hidden]') && search.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
        .every(token => button.textContent.toLowerCase().includes(token)));
    (matches.find(button => button.getAttribute('aria-current')) ?? matches[0])?.click();
  };
  picker.onkeydown = event => {
    if (event.key !== 'Escape' || !picker.open) return;
    event.stopPropagation();
    picker.open = false;
    picker.firstChild.focus();
  };
  picker.ontoggle = () => { if (picker.open) search.focus(); };
  picker.open = false;
  filter();
  picker.append(search, list);
  return picker;
}

function numberField(value, inherited, min, max, disabled, change) {
  const input = document.createElement('input');
  input.type = 'number';
  input.step = 'any';
  input.min = min;
  if (max !== undefined) input.max = max;
  input.placeholder = Number(inherited.toFixed(4));
  input.value = value ?? '';
  input.disabled = disabled;
  input.onchange = () => {
    if (!input.reportValidity()) return;
    change(input.value === '' ? undefined : input.valueAsNumber);
  };
  return input;
}

function openTexturePreview(blob, filename) {
  const dialog = document.createElement('dialog');
  dialog.className = 'texture-quick-preview';
  dialog.setAttribute('aria-label', `Texture preview: ${filename}`);
  const header = document.createElement('header');
  const title = document.createElement('span');
  title.textContent = filename;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'setting-button';
  close.textContent = 'Close';
  close.autofocus = true;
  close.onclick = () => dialog.close();
  header.append(title, close);
  const image = document.createElement('img');
  image.alt = filename;
  const url = URL.createObjectURL(blob);
  image.src = url;
  dialog.append(header, image);
  dialog.addEventListener('close', () => {
    URL.revokeObjectURL(url);
    dialog.remove();
  }, {once:true});
  document.body.append(dialog);
  dialog.showModal();
}

function texturePreview(container, name, library, thumbnail = false) {
  const note = document.createElement('span');
  note.className = 'muted';
  const blob = library.blobs.get(name);
  note.textContent = !name ? 'No texture assigned' : name === 'shipname' ? 'Generated from ship name'
    : !library.has(name) ? 'Missing from loaded textures' : library.sourceOf.get(name)?.file ?? name;
  container.replaceChildren(...(thumbnail ? [] : [note]));
  if (!blob || !library.has(name)) return;
  const image = document.createElement('img');
  image.alt = thumbnail ? '' : name;
  const url = URL.createObjectURL(blob);
  const release = () => URL.revokeObjectURL(url);
  image.onload = release;
  image.onerror = () => { release(); (image.closest('.texture-preview-trigger') ?? image).remove(); };
  image.src = url;
  if (thumbnail) {
    container.prepend(image);
    return;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'texture-preview-trigger';
  button.setAttribute('aria-label', `Open texture preview: ${note.textContent}`);
  button.title = 'Open texture preview';
  button.append(image);
  button.onclick = () => openTexturePreview(blob, note.textContent);
  container.prepend(button);
}

export function mountTextureAssignments(host, context) {
  const {draft, library, stockShading, stockTileScale, stockWindowEmission, changeSample, updatePreview, loadImages} = context;
  host.classList.add('texture-assignment-properties');
  const scroll = host.querySelector('.texture-assignment-pane')?.scrollTop ?? 0;
  const blocks = document.createElement('div');
  blocks.className = 'texture-comparison-controls';
  const shading = panel('Material shading');
  const textures = panel('Texture maps');
  const assignment = activeTextureAssignment(draft);
  const defaults = resolveTextureNames(draft.typeIndex, draft.materialIndex);
  const inherited = stockShading(draft.materialIndex);
  const key = keyFor(draft);

  function edit(group, name, value, rebuild) {
    const next = draft.assignments.get(key) ?? {typeIndex:draft.typeIndex, materialIndex:draft.materialIndex, textures:{}, shading:{}};
    const target = group ? (next[group] ??= {}) : next;
    if (value === undefined) delete target[name];
    else target[name] = value;
    if (next.scaling && !Object.keys(next.scaling).length) delete next.scaling;
    if (Object.keys(next.textures).length || Object.keys(next.shading).length || next.scaling || next.tileScale !== undefined || next.windowEmission !== undefined)
      draft.assignments.set(key, next);
    else draft.assignments.delete(key);
    reset.disabled = !draft.assignments.has(key);
    updatePreview(rebuild);
  }

  function refresh() {
    mountTextureAssignments(host, context);
  }

  const type = blockTypePicker(draft.typeIndex,
    value => changeSample(Number(value), draft.materialIndex));
  const material = select(MATERIALS.map(value => [value.index, value.name]), draft.materialIndex,
    value => changeSample(draft.typeIndex, Number(value)));
  const stock = select([['edited', 'Edited'], ['stock', 'Stock (preview)']], draft.stock ? 'stock' : 'edited', value => {
    draft.stock = value === 'stock';
    updatePreview(true);
    refresh();
    host.querySelector('[aria-label="Stock / Edited"]').focus();
  });
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'setting-button';
  reset.textContent = 'Reset this block and material';
  reset.disabled = !draft.assignments.has(key);
  reset.onclick = () => { draft.assignments.delete(key); updatePreview(true); refresh(); };
  const sample = document.createElement('div');
  sample.className = 'texture-sample-controls';
  const typeField = document.createElement('div');
  typeField.className = 'field-row texture-block-field';
  const typeLabel = document.createElement('span');
  typeLabel.textContent = 'Block type';
  typeField.append(typeLabel, type);
  sample.append(typeField, field('Material', material));
  const comparison = document.createElement('div');
  comparison.className = 'texture-sample-controls texture-preview-controls';
  comparison.append(field('Stock / Edited', stock), reset);
  const mask = document.createElement('input');
  mask.type = 'checkbox';
  mask.checked = !!context.colorMask;
  mask.onchange = () => {
    context.colorMask = mask.checked;
    legend.hidden = !mask.checked;
    updatePreview(false);
  };
  const maskRow = document.createElement('div');
  maskRow.className = 'texture-color-mask';
  const label = document.createElement('label');
  label.className = 'check-row';
  label.append(mask, 'Color Mask');
  const legend = document.createElement('span');
  legend.className = 'texture-color-mask-legend';
  legend.hidden = !mask.checked;
  for (const [name, channel] of [['Primary', 'primary'], ['Secondary', 'secondary']]) {
    const item = document.createElement('span');
    item.dataset.channel = channel;
    item.textContent = name;
    legend.append(item);
  }
  maskRow.append(label, legend);
  blocks.append(sample, comparison, maskRow);

  const note = document.createElement('p');
  note.className = 'panel-note';
  note.textContent = 'Empty fields inherit the viewer’s current shader settings.';
  shading.append(note);
  for (const [name, label, min, max] of shadingFields) {
    shading.append(field(label, numberField(assignment?.shading[name], inherited[name], min, max, draft.stock,
      value => edit('shading', name, value, false))));
  }
  shading.append(field('Texture tiles per unit', numberField(assignment?.tileScale, stockTileScale(), .0001, undefined,
    draft.stock, value => edit(null, 'tileScale', value, false))));
  if (getShadingSpec(draft.typeIndex).surface === 'housing')
    shading.append(field('Window emission', numberField(assignment?.windowEmission, stockWindowEmission(), 0, 3,
      draft.stock, value => edit(null, 'windowEmission', value, false))));

  const upload = document.createElement('input');
  upload.type = 'file';
  upload.accept = 'image/*,.bmp';
  upload.multiple = true;
  const status = document.createElement('p');
  status.className = 'panel-note';
  status.setAttribute('role', 'status');
  upload.onchange = async () => {
    const files = [...upload.files];
    if (!files.length) return;
    upload.disabled = true;
    status.textContent = 'Loading texture images…';
    try {
      const count = await loadImages(files);
      if (!host.isConnected) return;
      refresh();
      const result = `${count} of ${files.length} texture images loaded for this workspace.`;
      host.querySelector('[data-texture-import-status]').textContent = count === files.length
        ? result : result + ' Use a unique filename and a supported image format.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      upload.value = '';
      upload.disabled = false;
    }
  };
  status.dataset.textureImportStatus = '';
  const importRow = document.createElement('div');
  importRow.className = 'texture-import-row';
  const importButton = document.createElement('button');
  importButton.type = 'button';
  importButton.className = 'setting-button';
  importButton.textContent = 'Import images…';
  importButton.onclick = () => upload.click();
  upload.hidden = true;
  upload.setAttribute('aria-label', 'Add texture images');
  importRow.append(status, importButton, upload);
  textures.append(importRow);
  const selectedSlot = context.slot ?? 'normal';
  const details = document.createElement('div');
  details.className = 'texture-map-details';
  const names = [...library.images.keys()].sort();
  for (const [slot, label] of TEXTURE_SLOTS) {
    const selected = selectedSlot === slot;
    const preview = document.createElement('div');
    preview.className = 'texture-map-preview';
    const thumbnail = document.createElement('div');
    thumbnail.className = 'texture-map-thumbnail';
    const showTexture = name => {
      texturePreview(thumbnail, name, library, true);
      if (selected) texturePreview(preview, name, library);
    };
    const chosen = assignment?.textures[slot];
    const options = chosen && !names.includes(chosen) ? [chosen, ...names] : names;
    const control = select([
      ['', `Default${defaults[slot] ? ' · ' + defaults[slot] : ''}`],
      ['none:', 'None'],
      ...options.map(name => [`file:${name}`, name]),
    ], chosen === null ? 'none:' : chosen ? `file:${chosen}` : '', value => {
      const override = value === 'none:' ? null : value ? value.slice(5) : undefined;
      edit('textures', slot, override, true);
      showTexture(override === undefined ? defaults[slot] : override);
    });
    control.disabled = draft.stock;
    showTexture(chosen === undefined ? defaults[slot] : chosen);
    const card = document.createElement('div');
    card.className = 'texture-map-card';
    card.classList.toggle('selected', selected);
    card.dataset.textureSlot = slot;
    const disclosure = document.createElement('button');
    disclosure.type = 'button';
    disclosure.setAttribute('aria-label', `Inspect ${label}`);
    disclosure.setAttribute('aria-pressed', String(selected));
    disclosure.append(selected ? '▾' : '▸', thumbnail, label);
    disclosure.onclick = () => {
      context.slot = slot;
      refresh();
      host.querySelector(`[data-texture-slot="${slot}"] button`).focus();
    };
    control.setAttribute('aria-label', label);
    card.append(disclosure, control);
    textures.append(card);
    if (!selected) continue;
    const scaling = select([['', 'Game default'], ['fit', 'Fit block face'], ['fixed', 'Fixed-size tiling']],
      assignment?.scaling?.[slot] ?? '', value => edit('scaling', slot, value || undefined, false));
    scaling.disabled = draft.stock;
    details.append(preview, field(`${label} scaling`, scaling));
  }
  textures.append(details);
  const tabs = document.createElement('nav');
  tabs.className = 'texture-assignment-tabs';
  tabs.setAttribute('aria-label', 'Texture assignment panels');
  const pane = document.createElement('div');
  pane.className = 'texture-assignment-pane';
  pane.tabIndex = 0;
  for (const [id, title, content] of [['maps', 'Texture Maps', textures], ['shading', 'Material Shading', shading]]) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.textContent = title;
    const selected = (context.panel ?? 'maps') === id;
    tab.setAttribute('aria-pressed', String(selected));
    tab.classList.toggle('active', selected);
    tab.onclick = () => {
      context.panel = id;
      pane.scrollTop = 0;
      refresh();
      host.querySelector('.texture-assignment-tabs [aria-pressed="true"]').focus();
    };
    tabs.append(tab);
    if (selected) {
      content.firstChild.hidden = true;
      pane.append(content);
    }
  }
  host.replaceChildren(blocks, tabs, pane);
  pane.scrollTop = scroll;
}
