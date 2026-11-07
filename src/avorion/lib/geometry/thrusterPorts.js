// Directional thrusters emit along local X, which orientation maps to look.
export const DIRECTIONAL_THRUSTER_SIDES = Object.freeze([0, 1]);
// Native-unit intervals. The largest face's longest edge selects a shared size.
export const THRUSTER_TIERS = Object.freeze([
    { min: 0, size: .1, spacing: .3, plumeLength: .5, three: 1.2, five: 2 },
    { min: 2.8, size: .2, spacing: .6, plumeLength: 1, three: 2.8, five: 4 },
    { min: 5.2, size: .4, spacing: 1.2, plumeLength: 2, three: 5.2, five: 8 },
    { min: 10, size: .8, spacing: 2.4, plumeLength: 4, three: 10, five: 16 },
    { min: 19.6, size: 1.6, spacing: 4.8, plumeLength: 8, three: 19.6, five: 32 },
].map(Object.freeze));
export function thrusterTier(width, height = width, depth = 0) {
    const longest = Math.max(width, height, depth);
    return THRUSTER_TIERS.findLast(tier => longest >= tier.min) ?? THRUSTER_TIERS[0];
}
export function thrusterCount(length, tier) {
    return length >= tier.five ? 5 : length >= tier.three ? 3 : 1;
}
export function thrusterPitch(width, height) {
    const tier = thrusterTier(width, height);
    return tier.size + tier.spacing;
}
export function thrusterPorts(width, height, tier = thrusterTier(width, height)) {
    const nx = (thrusterCount(width, tier) - 1) / 2;
    const ny = (thrusterCount(height, tier) - 1) / 2;
    const ports = [];
    for (let y = -ny; y <= ny; y++)
        for (let x = -nx; x <= nx; x++)
            ports.push({ x: x * (tier.size + tier.spacing), y: y * (tier.size + tier.spacing), radius: tier.size / 2, plumeLength: tier.plumeLength });
    return ports;
}
// Generate thresholds from the same table used by the CPU emitters.
export const THRUSTER_PORTS_GLSL = `
vec2 thrusterCounts(vec2 size, float portSize) {
  vec2 count = vec2(1.0);
  ${THRUSTER_TIERS.map(tier => `if (abs(portSize - ${tier.size.toFixed(1)}) < 0.001) count += 2.0 * step(vec2(${tier.three.toFixed(1)}), size) + 2.0 * step(vec2(${tier.five.toFixed(1)}), size);`).join('\n  ')}
  return count;
}
vec2 thrusterPortPoint(vec2 uv, vec2 size, float portSize) {
  float pitch = portSize * 4.0;
  vec2 point = (uv - 0.5) * size;
  vec2 limit = (thrusterCounts(size, portSize) - 1.0) * 0.5;
  return point - clamp(floor(point / pitch + 0.5), -limit, limit) * pitch;
}`;
