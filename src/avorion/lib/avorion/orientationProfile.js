export const ORIENTATION_PROFILE_VERSION = 2;
/** Game-verified default: 0:-X 1:+X 2:-Y 3:+Y 4:-Z 5:+Z. */
export const DEFAULT_AXIS_MAP = [
    [-1, 0, 0], [1, 0, 0],
    [0, -1, 0], [0, 1, 0],
    [0, 0, -1], [0, 0, 1],
];
export function defaultOrientationProfile() {
    return {
        version: ORIENTATION_PROFILE_VERSION,
        axisMap: DEFAULT_AXIS_MAP.map((axis) => [...axis]),
        typeOverrides: {},
    };
}
