/** Resolve display color without writing an inherited default into the XML. */
export function resolvedSecondaryColor(block) {
    const primary = block.color.replace(/^#/, "");
    const rgb = /^[0-9a-f]{8}$/i.test(primary) ? primary.slice(2) : "808080";
    const base = [0, 2, 4].map(i => parseInt(rgb.slice(i, i + 2), 16) / 255);
    const raw = Object.hasOwn(block,"secondaryColor") ? block.secondaryColor : block.el?.getAttribute("secondaryColor") ?? block.unknownAttrs.secondaryColor;
    if (!raw || !/^[0-9a-f]{8}$/i.test(raw))
        return [base[0], base[1], base[2], 1];
    const weight = parseInt(raw.slice(0, 2), 16) / 255;
    const mixed = base.map((value, i) => value * (1 - weight) + parseInt(raw.slice(2 + i * 2, 4 + i * 2), 16) / 255 * weight);
    return [mixed[0], mixed[1], mixed[2], 1];
}
