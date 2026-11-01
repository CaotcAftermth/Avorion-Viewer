# Directional slice redesign (drop-in)

Copy `src/` and `tests/` over the matching folders in `Avorion Viewer 4 (Blender Based)`, and `docs/weapon-coverage.md` over `docs/`.
This folder started as a copy of `weapon-coverage-improvements/`; only the files below differ from it.

New: `src/turrets/coverage-polar.js`, `tests/weapon-coverage-polar.test.mjs`.
Changed: `src/turrets/coverage-engine.js` (fixed-weapon boresights), `coverage-sampling.js` (`sliceStyle`), `coverage.worker.js`,
`coverage-state.js` (bearing re-pin), `coverage-stats.js` (polar export), `coverage-surface.js` (`polarSurface`), `coverage-render.js`,
`coverage-ui.js`, `tests/weapon-coverage.check.mjs` (polar + legacy timing), `docs/weapon-coverage.md`.

Run after copying: `npm test`, then `node tests/weapon-coverage.check.mjs` (prints `sliceMs` and `legacySliceMs`).
