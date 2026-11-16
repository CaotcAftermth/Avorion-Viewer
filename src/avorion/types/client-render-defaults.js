// Avorion 2.5.13 client.ini. Material rows follow native material index order.
export const materialShadingDefaults = [
  { minReflectivity: .05, maxReflectivity: .15, specularity: .75, glossyness: 150, glow: 1 }, // Iron
  { minReflectivity: .15, maxReflectivity: .4, specularity: 1, glossyness: 500, glow: .85 }, // Titanium
  { minReflectivity: .2, maxReflectivity: .4, specularity: 1, glossyness: 500, glow: .7 }, // Naonite
  { minReflectivity: .3, maxReflectivity: .7, specularity: 3, glossyness: 1500, glow: .83 }, // Trinium
  { minReflectivity: .15, maxReflectivity: .4, specularity: 1, glossyness: 750, glow: .75 }, // Xanion
  { minReflectivity: .05, maxReflectivity: .15, specularity: .3, glossyness: 250, glow: 1 }, // Ogonite
  { minReflectivity: .25, maxReflectivity: .5, specularity: 2, glossyness: 1000, glow: .95 }, // Avorion
];
export const lightingDefaults = { lightMinValue: .85, lightMaxValue: 1.25, lightAmbient: .13 };
export const bloomDefaults = {
  enabled: false,
  downSampleFactor: .5,
  threshold: .65,
  amplification: 1.5,
  levelAmplifications: [.8, 1.3, 1.7, 2.5],
};
