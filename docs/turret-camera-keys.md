# Turret Studio: camera keys

Added November 1, 2026. Lets you build a custom showcase camera path by framing the viewport and saving keys at timeline times. Playback, seeking and every showcase export format (PNG, PNG sequence, GIF, WebM) follow the same path, because the keyed camera is evaluated from simulation time just like the built-in presets.

## Use

Open a turret's Turret Properties editor, expand **Showcase and timeline**, then **Camera keys**.

1. Frame the shot in the viewport.
2. Seek to a time (Seek time, Step forward/backward, or a key marker).
3. Press **Add key at current time**. The first key switches Camera preset to **camera keys**.
4. Repeat. Press **Play / Resume** to preview.

While paused in camera-keys mode, dragging or wheeling in the viewport frees the view so you can frame the next shot. It does not switch to Manual and does not change any key. Seek, Jump, Play or **Follow keys** return the view to the keyed path. Dragging during playback pauses it.

Each key row has: time (seconds), anchor, ease (to the next key), **Jump**, **Update from view** (keeps the key's time and anchor) and **Delete**. The strip above the list shows key markers (click to jump) and the playhead.

- **Anchors.** `world` stays fixed. `turret` moves with the first muzzle's position and turns with the barrel's heading (yaw about vertical; barrel elevation is not followed). `target` moves with the demo target. Changing a key's anchor re-expresses it at that key's time, so the shot does not jump there.
- **Ease.** `smooth` (smoothstep), `linear`, or `hold` (cut to the next key).
- **Fill from preset sequence** bakes the current six-phase preset into world-anchored keys plus sequence events, as an editable starting point. It replaces existing keys after confirmation.
- **Sequence events** set fire, track and target-marker on/off at times. Unset values fall back to the normal Studio settings. Events change the simulation, so editing them rebuilds state at the current time.

Sequence length in camera-keys mode is the time of the last key or event (minimum 1 s); looping and stop-at-end use it. In Export showcase, **Use full sequence length** sets start 0 and duration to that length (capped at the existing 60 s export limit).

## Interpolation

Between keys: centripetal Catmull–Rom through the look-at targets (passes exactly through each key, no overshoot loops), shortest-arc yaw and roll, linear pitch (clamped short of straight up/down), log-space distance (constant-feel dollies), linear field of view and pan. Before the first key the camera holds the first key; after the last it holds the last. At a key's time the camera reproduces that key exactly.

## Data

Stored in the asset's simulation settings (`asset.simulation.showcase`), separate from native XML:

```js
showcase.camera = 'keyed'
showcase.keysVersion = 1
showcase.keys = [{id, time, anchor, ease, target:[x,y,z], yaw, pitch, roll, distance, fov, panX, panY}]
showcase.events = [{id, time, fire?, track?, target?}]
```

`target` and angles are in viewport (view-space) coordinates relative to the anchor frame; `distance` is viewport distance (`10 / zoom`); `fov` is degrees derived from focal length. Times are absolute seconds (0–300), so changing other settings never moves keys. Keys sharing a time are nudged apart by one 1/120 s simulation step. Export metadata (`showcase-metadata.json`) includes keys and events.

## Files

- `src/turrets/camera-keys.js` (new): key validation, capture, anchors, interpolation, events, sequence length.
- `src/turrets/camera-keys-ui.js` (new): Camera keys panel and preset baking.
- `src/turrets/showcase.js`: `evaluateCamera` dispatches to keyed camera; `sequenceFlags` shared by presets and keys.
- `src/turrets/studio.js`: keyed sequence flags and length; free view in keyed mode (`freeView`, `followKeys`).
- `src/turrets/showcase-ui.js`: camera keys option, panel mount, Use full sequence length.
- `tests/turret-camera-keys.test.mjs` (new): 10 tests.

## Limitations

- Turret anchor follows heading only, not elevation; it uses the first muzzle (estimated fallback when the design has no authored muzzles).
- Camera keys are not yet translated (the existing Showcase panel is English-only too).
- No drag-to-retime on the strip; edit the time field instead.
