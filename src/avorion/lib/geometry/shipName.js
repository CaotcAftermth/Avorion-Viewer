// The game fits a 4:1 name region uniformly onto the face. Its glyphs may use
// 70% of the region height; measured bounds keep 15% clear above and below.
export function createShipNameImage(text, resolution) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = resolution;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, resolution, resolution);
    ctx.font = 'bold 100px sans-serif';
    const bounds = ctx.measureText(text);
    const width = Math.max(bounds.width, bounds.actualBoundingBoxLeft + bounds.actualBoundingBoxRight, 1);
    const height = Math.max(bounds.actualBoundingBoxAscent + bounds.actualBoundingBoxDescent, 1);
    const size = Math.min(4 * resolution / width, 0.7 * resolution / height);
    // Array layers are square: compress X by four here, then restore the
    // physical 4:1 aspect in the shader. Flip rows to put face V=0 at the bottom.
    ctx.setTransform(size / 4, 0, 0, -size, resolution / 2, resolution / 2);
    ctx.fillStyle = 'white';
    ctx.fillText(text,
        (bounds.actualBoundingBoxLeft - bounds.actualBoundingBoxRight) / 2,
        (bounds.actualBoundingBoxAscent - bounds.actualBoundingBoxDescent) / 2);
    return ctx.getImageData(0, 0, resolution, resolution);
}
