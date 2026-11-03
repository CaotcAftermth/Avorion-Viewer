import { getBlockDefinition, getMaterial } from "./blockDefinitions.js";
const KNOWN_ATTRS = new Set([
    "index", "material", "look", "up", "color",
    "lx", "ly", "lz", "ux", "uy", "uz",
    "lowerX", "lowerY", "lowerZ", "upperX", "upperY", "upperZ",
]);
/** Read a bound attribute in either the current (lx) or legacy (lowerX) spelling. */
function bound(el, cur, legacy) {
    return el.hasAttribute(cur) ? num(el, cur) : num(el, legacy);
}
/** True when the block belongs to a <turretDesign> (turret-local coordinates, not ship space). */
function insideTurret(el) {
    for (let p = el.parentElement; p; p = p.parentElement) {
        if (p.tagName === "turretDesign")
            return true;
    }
    return false;
}
function num(el, name, fallback = 0) {
    const v = el.getAttribute(name);
    if (v == null)
        return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}
export function parseAvorionXml(xmlText, fileName, fileSize) {
    const warnings = [];
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    const parseErr = doc.querySelector("parsererror");
    if (parseErr) {
        throw new Error("This file is not valid XML. " + (parseErr.textContent?.slice(0, 160) ?? ""));
    }
    const allBlockEls = Array.from(doc.getElementsByTagName("block")).filter((b) => b.hasAttribute("lx") || b.hasAttribute("ux") || b.hasAttribute("lowerX"));
    // Turret designs embed their own <plan>s in turret-local space; rendering
    // them at ship origin produces garbage, so they are skipped (kept in XML).
    const blockEls = allBlockEls.filter((b) => !insideTurret(b));
    const turretBlocks = allBlockEls.length - blockEls.length;
    if (blockEls.length === 0) {
        throw new Error("No Avorion blocks found. Expected <block> elements with lx/ly/lz/ux/uy/uz bounds - is this a ship or station plan XML?");
    }
    const blocks = [];
    // <item index="N"> is the game's block index; parent="N" refers to it.
    // Indices are not guaranteed sequential, so map them to our ids.
    const idByItemIndex = new Map();
    blockEls.forEach((el, i) => {
        const idx = el.parentElement?.tagName === "item" ? el.parentElement.getAttribute("index") : null;
        if (idx != null)
            idByItemIndex.set(idx, `b${i}`);
    });
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    const materialCounts = {};
    const typeCounts = {};
    const unknown = new Set();
    let degenerateBounds = 0;
    let invalidOrientation = 0, invalidNumbers = 0;
    blockEls.forEach((el, i) => {
        if (['index','material','look','up','lx','ly','lz','ux','uy','uz','lowerX','lowerY','lowerZ','upperX','upperY','upperZ'].some(a=>el.hasAttribute(a)&&(!el.getAttribute(a).trim()||!Number.isFinite(Number(el.getAttribute(a)))))) invalidNumbers++;
        const lx = bound(el, "lx", "lowerX"), ly = bound(el, "ly", "lowerY"), lz = bound(el, "lz", "lowerZ");
        const ux = bound(el, "ux", "upperX"), uy = bound(el, "uy", "upperY"), uz = bound(el, "uz", "upperZ");
        const size = { x: ux - lx, y: uy - ly, z: uz - lz };
        if (size.x <= 0 || size.y <= 0 || size.z <= 0)
            degenerateBounds++;
        const typeIndex = num(el, "index", -1);
        const def = getBlockDefinition(typeIndex);
        if (def.category === "Unknown")
            unknown.add(typeIndex);
        const materialIndex = num(el, "material", 0);
        const mat = getMaterial(materialIndex);
        const itemEl = el.parentElement?.tagName === "item" ? el.parentElement : undefined;
        const parentAttr = itemEl?.getAttribute("parent") ?? undefined;
        const unknownAttrs = {};
        for (const a of Array.from(el.attributes)) {
            if (!KNOWN_ATTRS.has(a.name))
                unknownAttrs[a.name] = a.value;
        }
        const block = {
            id: `b${i}`,
            originalIndex: i,
            typeIndex,
            type: def.displayName,
            position: { x: (lx + ux) / 2, y: (ly + uy) / 2, z: (lz + uz) / 2 },
            size,
            look: num(el, "look", 1), // game default = identity (look +X, up +Y)
            up: num(el, "up", 3),
            materialIndex,
            material: mat.name,
            color: (el.getAttribute("color") ?? "ff808080").toLowerCase(),
            ...(el.hasAttribute('secondaryColor')?{secondaryColor:el.getAttribute('secondaryColor').toLowerCase()}:{}),
            parentId: parentAttr != null && parentAttr !== "-1" ? idByItemIndex.get(parentAttr) : undefined,
            el,
            itemEl,
            unknownAttrs,
        };
        blocks.push(block);
        if (![block.look,block.up].every(v=>Number.isInteger(v)&&v>=0&&v<=5)||Math.floor(block.look/2)===Math.floor(block.up/2)) invalidOrientation++;
        min.x = Math.min(min.x, lx);
        min.y = Math.min(min.y, ly);
        min.z = Math.min(min.z, lz);
        max.x = Math.max(max.x, ux);
        max.y = Math.max(max.y, uy);
        max.z = Math.max(max.z, uz);
        materialCounts[mat.name] = (materialCounts[mat.name] ?? 0) + 1;
        typeCounts[def.displayName] = (typeCounts[def.displayName] ?? 0) + 1;
    });
    if (unknown.size > 0) {
        warnings.push({
            level: "warn",
            message: `${unknown.size} unrecognized block type indices (${[...unknown].slice(0, 12).join(", ")}${unknown.size > 12 ? "..." : ""}). Rendered as fallback boxes; XML preserved on export.`,
        });
    }
    if (turretBlocks > 0) {
        warnings.push({ level: "info", message: `${turretBlocks} embedded turret-design blocks kept separate from the hull. Preserved on export.` });
    }
    if (degenerateBounds > 0) {
        warnings.push({ level: "warn", message: `${degenerateBounds} blocks have zero or negative extents.` });
    }
    if (invalidOrientation) warnings.push({level:'warn',message:`${invalidOrientation} invalid look/up pairs use identity orientation for display; XML preserved.`});
    if (invalidNumbers) warnings.push({level:'warn',message:`${invalidNumbers} blocks contain invalid numeric attributes; display uses fallback values. XML preserved.`});
    if (blocks.length > 30000) {
        warnings.push({ level: "info", message: "Large model: GPU geometry and texture memory usage may be substantial." });
    }
    warnings.push({ level: "info", message: `Parsed ${blocks.length} blocks from ${fileName}.` });
    return {
        fileName,
        fileSize,
        loadedAt: Date.now(),
        sourceXml: xmlText,
        doc,
        blocks,
        warnings,
        bounds: { min, max, size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z } },
        materialCounts,
        typeCounts,
        unknownTypeIndices: [...unknown],
    };
}
