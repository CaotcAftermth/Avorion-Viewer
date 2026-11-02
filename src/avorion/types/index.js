// ---------------------------------------------------------------------------
// Core shared types. Keep this file dependency-free (no three.js imports)
// so that workers and pure logic modules can consume it.
// ---------------------------------------------------------------------------
export const DEFAULT_GAME_SHADER = {
    tileScale: 0.1,
    lightAzimuth: 35,
    lightElevation: 40,
    lightIntensity: 1.0,
    lightColor: "#fff4e0",
    ambientIntensity: 0.45,
    ambientFillIntensity: 0.25,
    ambientFillColor: "#ffffff",
    skyTop: "#2b3f5c",
    skyHorizon: "#0e151f",
    skyBottom: "#05070a",
    minReflectivity: 0.05,
    maxReflectivity: 0.35,
    glossyness: 24,
    specularity: 0.35,
    normalStrength: 1.0,
    triplanarSharpness: 8,
    secondaryFactor: 0.6,
    glowStrength: 1.0,
    hologramGlow: 1.5,
    fogStrength: 0.0,
    thrustPreview: 0.35,
    plumeLength: 0,
    barrierStrength: 1,
    bloomStrength: 0.3,
    shadowStrength: 0.65,
    shipName: "",
};
