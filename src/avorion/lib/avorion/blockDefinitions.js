// ---------------------------------------------------------------------------
// Block & material definition library.
//
// Index -> shape/category mapping verified against the community Blender
// importer (jgersti/blender-avorion-importer), which is known to import
// real Avorion 2.x ships correctly. Shape families follow the game's layout:
// each buildable family has up to 8 shapes:
//   base cube, Edge, Corner 1, Corner 2, Corner 3,
//   Twisted Corner 1, Twisted Corner 2, Flat Corner.
//
// Display names for functional blocks are community-derived and may drift
// between game versions; shapes (which drive rendering) are the verified
// part. Unknown indices render as placeholder boxes, are flagged in
// Diagnostics, and their XML is preserved untouched on export.
// ---------------------------------------------------------------------------
const DEFS = new Map();
function D(typeIndex, displayName, category, geometryKind = "box", extra = {}) {
    DEFS.set(typeIndex, { typeIndex, displayName, category, geometryKind, ...extra });
}
const SHAPE_SUFFIX = [
    ["", "box"], [" Edge", "wedge"], [" Corner 1", "corner"], [" Corner 2", "corner2"],
    [" Corner 3", "corner3"], [" Twisted Corner 1", "twisted1"], [" Twisted Corner 2", "twisted2"],
    [" Flat Corner", "flatcorner"],
];
/** A full 8-shape family: indices in order cube, edge, c1, c2, c3, tc1, tc2, flat. */
function family(name, category, idx, extra = {}) {
    idx.forEach((i, s) => D(i, name + SHAPE_SUFFIX[s][0], category, SHAPE_SUFFIX[s][1], extra));
}
// --- Shape families (verified) ---------------------------------------------
family("Smart Hull", "Structure", [2, 100, 101, 102, 103, 108, 109, 112]);
D(0, "Hull (Base)", "Structure", "box");
D(1, "Blank Hull", "Structure", "box");
family("Armor", "Defense", [8, 104, 105, 106, 107, 110, 111, 113]);
family("Crew Quarters", "Crew", [6, 114, 115, 116, 117, 118, 119, 120]);
family("Hull", "Structure", [122, 123, 124, 125, 126, 128, 129, 127]);
D(121, "Hull (Alt)", "Structure", "box");
family("Glow", "Decorative", [150, 151, 152, 153, 154, 155, 156, 157], { emissive: true });
family("Glass", "Decorative", [170, 171, 172, 173, 174, 175, 176, 177]);
family("Reflector", "Decorative", [180, 181, 182, 183, 184, 195, 196, 201]);
family("Stone", "Asteroid", [4, 185, 186, 187, 188, 197, 198, 202]);
family("Hologram", "Decorative", [190, 191, 192, 193, 194, 199, 200, 203], { emissive: true });
family("Hull Alt A", "Structure", [210, 211, 212, 213, 214, 215, 216, 217]);
family("Hull Alt B", "Structure", [220, 221, 222, 223, 224, 225, 226, 227]);
family("Armor (Camo)", "Defense", [230, 231, 232, 233, 234, 235, 236, 237]);
family("Hull (Vivid)", "Structure", [240, 241, 242, 243, 244, 245, 246, 247]);
family("Hull (Stripes A)", "Structure", [250, 251, 252, 253, 254, 255, 256, 257]);
family("Hull (Stripes B)", "Structure", [260, 261, 262, 263, 264, 265, 266, 267]);
family("Hull (Stripes C)", "Structure", [270, 271, 272, 273, 274, 275, 276, 277]);
family("Hull (Dark A)", "Structure", [280, 281, 282, 283, 284, 285, 286, 287]);
family("Hull (Dark B)", "Structure", [290, 291, 292, 293, 294, 295, 296, 297]);
family("Hull (Dark C)", "Structure", [300, 301, 302, 303, 304, 305, 306, 307]);
family("Scaffold", "Structure", [310, 311, 312, 313, 314, 315, 316, 317]);
family("Rich Stone", "Asteroid", [510, 511, 512, 513, 514, 515, 516, 517]);
family("Super Rich Stone", "Asteroid", [520, 521, 522, 523, 524, 525, 526, 527]);
family("Rift Stone", "Asteroid", [530, 531, 532, 533, 534, 535, 536, 537]);
family("Rich Rift Stone", "Asteroid", [540, 541, 542, 543, 544, 545, 546, 547]);
family("Super Rich Rift Stone", "Asteroid", [550, 551, 552, 553, 554, 555, 556, 557]);
family("Glow Stone", "Asteroid", [560, 561, 562, 563, 564, 565, 566, 567], { emissive: true });
family("Wreckage", "Wreckage", [700, 701, 702, 703, 704, 705, 706, 707]);
// --- Functional blocks (names community-derived) ----------------------------
D(3, "Engine", "Propulsion", "box", { emissive: true });
D(5, "Cargo Bay", "Utility");
D(7, "Thruster", "Propulsion", "box", { emissive: true });
D(9, "Framework", "Structure");
D(10, "Hangar", "Utility");
D(11, "Dock", "Utility");
D(12, "Turret Rotation Lock", "Hardpoints");
D(13, "Directional Thruster", "Propulsion", "box", { emissive: true });
D(14, "Gyro Array", "Propulsion");
D(15, "Inertia Dampener", "Propulsion");
D(16, "Flight Recorder", "Utility");
D(17, "Assembly", "Utility");
D(18, "Torpedo Launcher", "Weapons");
D(19, "Torpedo Storage", "Weapons");
D(20, "Turret Base", "Hardpoints");
D(21, "Turret Base Edge", "Hardpoints", "wedge");
D(22, "Frontal Torpedo Launcher", "Weapons");
D(23, "Turret Rotation Lock Edge", "Hardpoints", "wedge");
D(24, "Armored Turret Base", "Hardpoints");
D(25, "Armored Turret Base Edge", "Hardpoints", "wedge");
D(50, "Shield Generator", "Systems");
D(51, "Energy Container", "Systems");
D(52, "Generator", "Systems", "box", { emissive: true });
D(53, "Integrity Field Generator", "Systems");
D(54, "Computer Core", "Systems");
D(55, "Hyperspace Core", "Systems");
D(56, "Transporter", "Systems");
D(57, "Academy", "Utility");
D(58, "Cloning Pods", "Utility");
D(60, "Solar Panel", "Systems");
D(61, "Light", "Decorative", "box", { emissive: true });
D(62, "Colored Light", "Decorative");
D(63, "Flashing Light (1s / 1s)", "Decorative");
D(64, "Flashing Light (0.5s / 1.5s)", "Decorative");
D(65, "Flashing Light (1s / 3s)", "Decorative");
D(500, "Portal", "Special");
D(600, "Ship Name", "Decorative");
D(601, "Ship Name Edge", "Decorative", "wedge");
D(650, "Emblem", "Decorative");
D(651, "Emblem Edge", "Decorative", "wedge");
export const BLOCK_DEFINITIONS = [...DEFS.values()];
const FALLBACK_CACHE = new Map();
export function getBlockDefinition(typeIndex) {
    const d = DEFS.get(typeIndex);
    if (d)
        return d;
    let f = FALLBACK_CACHE.get(typeIndex);
    if (!f) {
        f = {
            typeIndex, displayName: `Unknown (${typeIndex})`, category: "Unknown",
            geometryKind: "placeholder",
            notes: "Not in the definition table - rendered as a box, preserved in exports.",
        };
        FALLBACK_CACHE.set(typeIndex, f);
    }
    return f;
}
export function isKnownType(typeIndex) {
    return DEFS.has(typeIndex);
}
export const MATERIALS = [
    { index: 0, name: "Iron", color: "#ffb380" },
    { index: 1, name: "Titanium", color: "#ffffff" },
    { index: 2, name: "Naonite", color: "#4dff4d" },
    { index: 3, name: "Trinium", color: "#4d9aff" },
    { index: 4, name: "Xanion", color: "#ffff4d" },
    { index: 5, name: "Ogonite", color: "#ff8133" },
    { index: 6, name: "Avorion", color: "#ff2626" },
];
export function getMaterial(index) {
    return MATERIALS[index] ?? { index, name: `Material ${index}`, color: "#888888" };
}
