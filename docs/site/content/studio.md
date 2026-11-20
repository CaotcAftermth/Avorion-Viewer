# Use Turret Studio

## Open the turret asset workspace

Double-click a turret's preview tile in **Asset Library > Turrets**. The separate workspace contains a viewport, structure tools, and turret Properties.

Changes in this workspace do not replace the main ship scene. Choose **Save asset** to keep the edited library asset. Cancel leaves the saved asset unchanged.

The asset Properties categories are:

| Category | Purpose |
|---|---|
| **Structure** | Select structural groups, control visibility, and change selected block colors |
| **Pose & Mechanics** | Set the preview pose and show axes or muzzle guides |
| **Turret Studio** | Choose a weapon demonstration and its playback settings |
| **Showcase & Timeline** | Set presentation cameras, sequences, keys, and events |
| **Showcase Export** | Export a still or animation |
| **Calibration & Development** | Compare reference media and adjust effect appearance |

Use the Properties search field to find controls across these categories.

## Examine the turret structure

In Structure, select **Base**, **Body**, or **Barrel** groups. Component Visibility can hide groups or isolate the selected structural group.

**Block Appearance** changes selected block colors in the asset draft. The Base/Body/Barrel groups describe turret structure. They are different from the separate ship Components library.

This interface does not provide a complete turret construction or rig-authoring system. Selection and appearance changes do not establish new rotation pivots or authored muzzle data.

## Set a preview pose

In Pose & Mechanics, adjust **Body rotation** and **Barrel elevation**. Use **Neutral pose** to reset the preview.

Enable **Show rotation axes** or **Show muzzle positions** to examine the guides:

- Violet identifies body rotation.
- Yellow identifies barrel elevation.
- Cyan identifies muzzle positions.

Rotation guides use dashed lines and rings. They are not the world coordinate axes. If no muzzle information is defined, some demonstrations use an estimated fallback. Read the status message.

## Make a tracking or firing demonstration

1. Open **Turret Studio**.
2. Choose a **Weapon family**.
3. Choose **Tracking only**, **Firing only**, or **Tracking and firing**.
4. Choose **Normal tracking** or **Coaxial** behavior.
5. Choose a target motion.
6. Select **Play / Resume**.
7. Use **Pause** to examine a moment, or **Restart** to return to the beginning.

The app supplies 19 source-based weapon-family presets. The selected family changes the representative firing and effect settings. It does not turn the ship into a combat simulation.

## Set target motion

| Target choice | Use |
|---|---|
| **stationary** | Examine a turret aimed at a fixed target |
| **linear** | Examine movement between target positions |
| **orbit** | Examine continuous tracking around a path |
| **custom** | Use your own list of positions |

**Target period** changes movement timing. **Orbit radius** changes the orbit size.

For Custom, enter a list of native-coordinate positions in **Target positions**. For example:

```json
[[0, 5, 20], [15, 10, 20], [15, 5, 5]]
```

Each group is `[X, Y, Z]`. Use finite numbers. The control accepts up to 100 positions. This is an optional advanced path control; presets do not require it.

## Set tracking, firing, and effects

**Base turning speed** changes representative tracking speed. **Playback speed** changes how quickly the demonstration runs.

Firing Pattern offers the generated preset, custom alternating fire, custom simultaneous fire, or a custom burst. **Custom shots per event** uses the preset when set to 0.

Profile Statistics chooses source midpoints or seeded source ranges. A **Profile seed** lets you repeat a generated variation.

Family-specific controls appear only when relevant. Examples include rocket guidance variants, repair mode, lightning detail, demo material color, and approximate beam lifetime.

Weapon Effects controls can show or hide effects, muzzle flashes, trails, impacts, target markers, and supported beam layers. **Effects quality** offers a lower-cost presentation. **Enable firing** lets you stop firing while retaining the rest of the demonstration.

## Read the playback status

Status information can include time, events, projectiles, beams, hits, resource state, and whether muzzles are authored or estimated.

Representative resource or burst behavior can interrupt continuous firing. Read the status before assuming that a stopped effect is an error.

Changing a simulation setting can rebuild playback from the start. Presentation settings can update without changing the weapon profile.

## Know the limits

The Studio uses representative source-based values and reconstructed effects. It does not prove an exact match to game visuals or timing.

Audio, recoil, ship physics, and native damage simulation are not implemented. Tracking targets are demonstration objects. Guidance, glow, particles, fallback muzzles, and some unit conversions remain approximate.

Save your asset when the demonstration settings are ready. Export a short preview before attempting a long, high-resolution animation.

## Effects comparison & calibration


These optional tools help you compare a demonstration with local reference media. Open **Calibration & Development** in the turret asset workspace.

### Load reference media

1. Choose a local reference image or video.
2. Use **Side by side / overlay** to choose the comparison layout.
3. Adjust **Overlay opacity** if using an overlay.
4. Align the live camera with the reference.
5. For video, adjust reference time offset and speed.

Reference media stays local to the comparison. The app does not assume a constant reference-video frame rate; stepping uses seconds.

Use Play, Pause, Restart, Previous frame, or Next frame to examine timing. The Camera Alignment panel gives numeric yaw, pitch, and scale controls.

### Read pixel measurements

Click the live comparison image to read its RGB value. Click two points to measure their pixel distance.

These measurements depend on camera alignment, image scale, exposure, and framing. Pixel distance is not a ship dimension or a weapon-range measurement.

### Adjust appearance calibration

Calibration changes effect appearance. It does not change the source weapon statistics.

Available groups cover flash duration and brightness, projectile trails, beam core and aura, contact effects, impacts, particles, lightning, and swirling layers.

You can use numeric controls or the **Calibration JSON** field:

- **Populate selected family defaults** prepares a starting configuration.
- **Apply calibration** validates and applies the JSON.
- **Reset calibration** returns to the uncalibrated appearance.
- **Export calibration** downloads a JSON copy.
- **Import calibration** loads JSON into the field; use Apply to apply it.

Save the asset to retain its appearance calibration. Invalid parameter names or out-of-range values are rejected.

Matching one reference frame does not establish that the demonstration matches native game behavior. Camera, geometry, weapon configuration, and exposure must also match for a useful comparison.
