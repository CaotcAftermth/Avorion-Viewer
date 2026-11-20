# Compare and calibrate turret effects

These optional tools help you compare a demonstration with local reference media. Open **Calibration & Development** in the turret asset workspace.

## Load reference media

1. Choose a local reference image or video.
2. Use **Side by side / overlay** to choose the comparison layout.
3. Adjust **Overlay opacity** if using an overlay.
4. Align the live camera with the reference.
5. For video, adjust reference time offset and speed.

Reference media stays local to the comparison. The app does not assume a constant reference-video frame rate; stepping uses seconds.

Use Play, Pause, Restart, Previous frame, or Next frame to examine timing. The Camera Alignment panel gives numeric yaw, pitch, and scale controls.

## Read pixel measurements

Click the live comparison image to read its RGB value. Click two points to measure their pixel distance.

These measurements depend on camera alignment, image scale, exposure, and framing. Pixel distance is not a ship dimension or a weapon-range measurement.

## Adjust appearance calibration

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
