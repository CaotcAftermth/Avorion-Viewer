/** Calibrated from in-game size/count measurements. Native CPU util0 generation
 * is not shipped in the game archive. Keep the CPU emitters and GLSL mask equal. */
export function thrusterPitch(width, height) {
    return Math.max(0.0001, 0.4 * 2 ** Math.floor(Math.log2(Math.max(width, height) / 1.2)));
}
export const THRUSTER_PITCH_GLSL = `
float thrusterPitch(vec2 size) {
  return max(0.0001, 0.4 * exp2(floor(log2(max(size.x, size.y) / 1.2))));
}`;
export function thrusterPorts(width, height) {
    const pitch = thrusterPitch(width, height);
    const nx = Math.max(0, Math.floor(width / (2 * pitch) - 0.25 + 1e-9));
    const ny = Math.max(0, Math.floor(height / (2 * pitch) - 0.25 + 1e-9));
    const ports = [];
    for (let y = -ny; y <= ny; y++)
        for (let x = -nx; x <= nx; x++) {
            ports.push({ x: x * pitch, y: y * pitch, radius: pitch * 0.28 });
        }
    return ports;
}
