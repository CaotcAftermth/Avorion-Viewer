# Control the viewport display

## Choose shading

| Shading | Purpose |
|---|---|
| **Wireframe** | Examine construction edges without solid surfaces |
| **Solid** | Examine shape with Studio or Red Wax MatCap lighting |
| **Material Preview** | Examine colors and textures under consistent preview lighting |
| **Rendered** | Examine scene lighting, emission, and supported presentation effects |

Hover over header icons to read their names. Each viewport keeps its own display settings.

## Use overlays

Open **Viewport Overlays** beside the overlays toggle.

| Group | Controls and purpose |
|---|---|
| **Guides** | Floor, X/Y/Z axes, infinite or finite axes, axis length, width, brightness, and grid scale |
| **Text** | General information, performance information, and statistics |
| **Objects** | Selected-face tint, selected-block outlines, block bounds, and model dimensions |
| **Geometry** | Wireframe overlay, edge threshold, and opacity |

**Show Overlays** is the master switch. If it is off, checked overlay options remain configured but do not appear.

**Shade Selected** tints selected faces. **Outline Selected** emphasizes selected block edges, including edges behind other surfaces. Turning either off does not deselect blocks.

**Block Bounds** shows rectangular extents. On a slope, those extents can be larger than the visible shape. **Model Dimensions** measures the whole model bounds, including hidden hull blocks.

Wireframe Threshold changes which creases appear. It does not add every triangle diagonal.

## Use X-Ray

X-Ray is available in **Solid** and **Wireframe**. Enable it in the header or shading options, then adjust **X-Ray Opacity**.

If X-Ray is unavailable, change the shading mode first.

## Adjust shading options

Open **Viewport Shading** beside the shading buttons.

- **Ambient Only** gives even illumination. Use **Ambient Brightness** and **Shape Contrast** to examine paint without a strong directional light.
- **Solid Lighting** chooses Studio or MatCap for Solid mode.
- **Background** chooses Theme, World, or a viewport color.
- **Backface Culling** hides surfaces that face away from the camera.
- **Object Outline** outlines the model. It is separate from selected-block outlines.
- **Specular Highlights** controls reflective highlights.
- **Shadows** and **Shadow Intensity** are available in supported Solid and Rendered views.
- **Depth of Field** is available in Rendered mode. Focus Distance chooses the sharp distance; Aperture controls blur.

An unavailable field usually needs another option enabled first. Hover over it to read the requirement.

## Read dimensions and units

Native model axes are **X right, Y up, Z back**. The workspace displays the ship in a Z-up scene. XML saving retains native coordinates.

In **Preferences > 3D Viewport > Model Dimensions**, choose **Meters** or **Block Units**. The current display convention uses **10 meters per block unit**. Axis-colored dimension labels identify width, height, and length.

**The 3D export option “Real scale (1 unit = 1 m)” uses a different conversion in this release.** Do not assume an on-screen meter value equals the resulting mesh size. For an exact physical export size, use **Fit longest dimension** and enter millimeters. Blueprint documentation describes its dimensions in native model units; check the labels in your prepared image.
