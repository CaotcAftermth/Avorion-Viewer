// ---------------------------------------------------------------------------
// Block type index -> texture set ("shading type").
//
// Derived from Avorion's data/shaders/blocks/*.frag sampler usage, the
// BlockShading enum in Documentation/Enums.html and the file names in
// data/textures/blocks/. The game binds per shading type:
//
//   platingTexture  greyscale albedo, multiplied by the block color
//   normalTexture   tangent-space normal map (browser-decoded RGB)
//   maskTexture     alpha = where the secondary color is painted
//   overlayTexture  RGBA decal mixed over the tinted plating (windows, stripes)
//   glowTexture     RGBA emissive, mixed in after lighting (x2 brightness)
// Material overlay/glow remain separate from functional overlay2/overlayGlow.
//
// `{m}` is replaced with the material index 0..6 (iron .. avorion).
// Names are extension-less; the loader tries .png/.bmp/.jpg so custom
// textures only need to keep the base name.
// ---------------------------------------------------------------------------
const P = "plates{m}";
// Material accents and lights are independent of functional artwork/pod glow.
const PLATING = { materialOverlay: `${P}_overlay`, materialGlow: `${P}_glow` };
const HULL = { ...PLATING, kind: "Hull", albedo: P, normal: `${P}_n`, tint: true };
const HULL_A = { ...HULL, kind: "Hull A", mask: `${P}_a_mask` };
const HULL_B = { ...HULL, kind: "Hull B", mask: `${P}_b_mask` };
const ARMOR = { ...PLATING, kind: "Armor", albedo: `${P}_armor`, normal: `${P}_n`, mask: `${P}_armor_mask`, tint: true };
const ARMOR_A = { ...ARMOR, kind: "Armor (camo)", albedo: `${P}_armor_a`, mask: `${P}_armor_a_mask` };
const HOUSING = { ...PLATING, kind: "Crew quarters", albedo: P, normal: `${P}_n`, overlay: `${P}_windows`, surface:'housing', tint: true };
const CARGO = { ...PLATING, kind: "Cargo", albedo: `${P}_cargo`, normal: `${P}_cargo_n`, mask: `${P}_cargo_mask`, tint: true };
const STRIPES = { ...HULL, kind: "Hull (stripes)", overlay: "stripes", overlayIsSecondary: true };
const STONE = { kind: "Stone", albedo: "rock", normal: "rock_n", tint: true, reflect: 0.2 };
const RIFT = { kind: "Rift stone", albedo: "melted-rock", normal: "melted-rock_n", tint: true, reflect: 0.2 };
const GLASS = { kind: "Glass", albedo: P, normal: `${P}_n`, surface: "glass", tint: true, translucent: true };
const GLOW = { kind: "Glow", tint: true, emissiveFlat: true };
const HOLO = { kind: "Hologram", tint: true, surface: "hologram", emissiveFlat: true, translucent: true, reflect: 0 };
const REFLECTOR = { ...HULL, kind: "Reflector", surface: "reflector", mask: undefined, materialOverlay: undefined, materialGlow: undefined, reflect: 1 };
const SCAFFOLD = { kind: "Scaffold", albedo: "scaffold", surface: "scaffold", tint: true, cutout: true };
const FRAMEWORK = { kind: "Framework", albedo: P, mask: "framework", surface: "framework", tint: true, cutout: true };
const WRECK = { ...PLATING, kind: "Wreckage", albedo: P, normal: `${P}_n`, overlay: "wreckage", tint: true, reflect: 0.3 };
// Functional markings have their own face-local UVs and optional normal map.
// Engines/thrusters are separate surface effects, not generic overlay decals.
function functional(kind, name, extra = {}) {
    return { ...PLATING, kind, albedo: P, normal: `${P}_n`, overlay: name, normalOverlay: `${name}_n`, surface: "decal", tint: true, ...extra };
}
const BY_TYPE = new Map();
const fam = (spec, ...idx) => idx.forEach((i) => BY_TYPE.set(i, spec));
const range8 = (start) => Array.from({ length: 8 }, (_, i) => start + i);
// Hull families
fam(HULL, 0, 1, 2, 100, 101, 102, 103, 108, 109, 112, 121, 122, 123, 124, 125, 126, 127, 128, 129);
fam(HULL_A, ...range8(210)); // Hull alternate A
fam(HULL_B, ...range8(220)); // Hull alternate B
fam({ ...HULL, kind: "Hull (vivid colors)", surface: "vivid" }, ...range8(240)); // Vivid Colors: same plating, brighter paint
["stripes-a", "stripes-b", "stripes-c", "dark-a", "dark-b", "dark-c"].forEach((surface, i) => fam({ ...STRIPES, surface }, ...range8(250 + i * 10)));
fam(ARMOR, 8, 104, 105, 106, 107, 110, 111, 113);
fam(ARMOR_A, ...range8(230));
fam(HOUSING, 6, 114, 115, 116, 117, 118, 119, 120);
fam(GLOW, ...range8(150));
fam(GLASS, ...range8(170));
fam(REFLECTOR, 180, 181, 182, 183, 184, 195, 196, 201);
fam(STONE, 4, 185, 186, 187, 188, 197, 198, 202);
fam(HOLO, 190, 191, 192, 193, 194, 199, 200, 203);
fam(SCAFFOLD, ...range8(310));
fam({ ...STONE, surface: "rich-stone", reflect: 0 }, ...range8(510));
fam({ ...STONE, surface: "super-rich-stone", reflect: 0 }, ...range8(520), ...range8(560));
fam(RIFT, ...range8(530));
fam({ ...RIFT, surface: "rich-rift", reflect: 0 }, ...range8(540));
fam({ ...RIFT, surface: "super-rich-rift", reflect: 0 }, ...range8(550));
fam(WRECK, ...range8(700));
// Functional blocks
fam({ ...PLATING, kind: "Engine", albedo: P, normal: `${P}_n`, surface: "engine", tint: true }, 3);
fam(CARGO, 5);
fam({ kind: "Thruster", overlay: "thruster", normalOverlay: "thruster_n", albedo: P, normal: `${P}_n`, surface: "thruster", tint: true }, 7);
fam({ kind: "Directional thruster", overlay: "thruster", normalOverlay: "thruster_n", albedo: P, normal: `${P}_n`, surface: "directional-thruster", tint: true }, 13);
fam(FRAMEWORK, 9);
fam({ ...PLATING, kind: "Hangar", materialOverlay: undefined, albedo: P, normal: `${P}_n`, tint: true, surface: "hangar" }, 10);
fam(functional("Dock", "dock", { surface: "dock" }), 11);
fam(functional("Rotation lock", "lock"), 12, 23);
fam(functional("Gyro", "gyro"), 14);
fam(functional("Inertia dampener", "inertiadampener"), 15);
fam(functional("Flight recorder", "blackbox"), 16);
fam(functional("Assembly", "academy"), 17);
fam(functional("Torpedo storage", "torpedostorage"), 19);
fam(functional("Turret base", "turretbase"), 20, 21);
fam(functional("Armored turret base", "turretbase", { albedo: `${P}_armor`, mask: `${P}_armor_mask` }), 24, 25);
fam(functional("Torpedo launcher", "torpedotube"), 18);
fam(functional("Frontal torpedo launcher", "torpedotube", { surface: "front-torpedo" }), 22);
fam(functional("Shield generator", "shieldgenerator", { surface: "generator-world" }), 50);
fam(functional("Energy container", "battery", { surface: "generator-world" }), 51);
fam(functional("Generator", "generator", { surface: "generator" }), 52);
fam(functional("Integrity field", "integritygenerator", { surface: "generator-world" }), 53);
fam(functional("Computer core", "computercore", { surface: "generator-world" }), 54);
fam(functional("Hyperspace core", "generator", { surface: "generator" }), 55);
fam(functional("Transporter", "ventilation"), 56);
fam(functional("Academy", "academy"), 57);
fam({ ...PLATING, kind: "Cloning pods", albedo: P, normal: `${P}_n`, overlay: `${P}_pods`, glow: `${P}_pods_glow`, tint: true, surface: "pods", overlayIsSecondary: true }, 58);
fam({ kind: "Solar panel", albedo: P, normal: `${P}_n`, materialOverlay: `${P}_overlay`, tint: true, surface: "solar" }, 60);
// Light blocks are plated fixtures with separate sprites, not solid glow cubes.
fam(HULL, 61, 62, 63, 64, 65);
fam({ ...HULL, surface: "ship-name", overlay: "shipname", mask: undefined }, 600, 601);
fam({ ...HULL, surface: "emblem", overlay: "default-emblem", mask: undefined }, 650, 651);
const DEFAULT = HULL;
export function getShadingSpec(typeIndex) {
    return BY_TYPE.get(typeIndex) ?? DEFAULT;
}
/** Resolve `{m}` placeholders for a material index. */
export function textureName(pattern, material) {
    return pattern?.replace("{m}", String(Math.max(0, Math.min(6, material | 0))));
}
/** Every distinct base texture name any block could ask for (for scanning). */
export function allTextureNames() {
    const out = new Set();
    const specs = new Set(BY_TYPE.values());
    for (const s of specs) {
        for (const n of [s.albedo, s.normal, s.mask, s.overlay, s.glow, s.normalOverlay, s.materialOverlay, s.materialGlow]) {
            if (!n || n === "shipname")
                continue; // ship-name images are generated from text
            if (n.includes("{m}"))
                for (let m = 0; m < 7; m++)
                    out.add(textureName(n, m));
            else
                out.add(n);
        }
    }
    return [...out].sort();
}
