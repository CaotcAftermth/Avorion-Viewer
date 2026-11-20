# Set the background, lighting, and effects

## Choose a background

The viewport shading options offer three backgrounds:

- **Theme** uses the app's viewport theme.
- **Viewport** uses the color chosen for that viewport.
- **World** uses the generated space sky when the skybox is enabled.

Open **Properties > World** to change the sky. If a sky change has no visible effect, check that the viewport's Background is World and **Enable Skybox** is on.

## Make a space sky

The World controls let you choose a sky palette, seed, and generation settings. A seed is a number that identifies a generated result. Reusing the same seed and settings helps you reproduce a background.

Use the World controls to adjust nebula colors, clouds, dark clouds, dust haze, stars, sun glow, brightness, rotation, and sky resolution. **New Sky** chooses another seed. Use a custom palette to choose the nebula colors yourself.

| World setting | Effect |
|---|---|
| **Sky Seed** | Selects a repeatable generated arrangement |
| **Sector X / Sector Y** | Changes generated cloud placement and star density |
| **Sky Palette** | Chooses a predefined color pair, seed-based pair, or Custom colors |
| **Nebula Color A / B** | Sets the two custom nebula colors |
| **Nebula Clouds** | Changes the number of cloud patches |
| **Cloud Size** | Changes their apparent angular size |
| **Nebula Intensity** | Changes colored cloud brightness |
| **Nebula Highlights** | Changes pale detail within the clouds |
| **Dark Clouds** | Changes dark cloud silhouettes |
| **Dust Haze** | Adds distant haze and reduces star visibility |
| **Star Density / Star Brightness** | Changes star abundance and brightness |
| **Sun Glow** | Changes the large seeded stellar glow |
| **World Brightness** | Changes overall sky brightness without changing the ship's studio lighting |
| **World Rotation** | Turns the background around the vertical axis |
| **Sky Resolution** | Changes background resolution and its graphics-memory cost |

Rotation changes the sky's direction. It is useful for moving a bright cloud away from the ship's outline. Higher Sky Resolution costs more graphics memory and generation time.

The generated sky is a presentation background. It does not reproduce an exact game sector, planets, animated rifts, or local volumetric fog.

## Light the ship

Open **Properties > Shaders**, then choose **Rendered** shading to judge your scene changes.

| Control group | Main use |
|---|---|
| **Surface** | Adjust reflective strength and roughness |
| **Lighting** | Enable light sources; adjust ambient light, directional light, direction, exposure, and corner shading |
| **Game Surface** | Adjust texture scale, surface detail, reflection, and diagnostic View Pass |
| **Environment** | Choose light and fill colors, plus sky ambient strength |
| **Emission** | Adjust windows, glow, bloom, light spill, engines, thrusters, and hangar barriers |

Use **Light Azimuth** to move the directional light around the ship. Use **Light Elevation** to raise or lower it. **Exposure** changes overall surface brightness.

**Ambient Occlusion** darkens nearby corners and crevices. **AO Radius** changes the distance over which nearby surfaces contribute. It works in Material Preview and Rendered views under the supported settings.

**Roughness** spreads reflections. A lower value gives a tighter highlight. **Facing Reflection** and **Grazing Reflection** control reflection at different viewing angles.

Use **Texture Scale** to change surface pattern size. **Normal Strength** changes the apparent surface detail from the loaded maps. These display changes do not reshape blocks.

**View Pass** can show albedo, masks, normals, lighting, or face orientation. Return it to **Shaded** for the normal image.

## Set glow and emission

Emission makes a surface appear luminous. Bloom adds a glow around bright areas.

- **Window Color** supplies the viewer default for windows without a secondary color.
- **Window Emission** changes window brightness.
- **Glow Strength** changes general emission.
- **Hologram Glow** adjusts hologram brightness.
- **Bloom** changes the surrounding glow in Rendered mode.
- **Bloom Threshold** chooses how bright a surface must be before it blooms.
- **Light Spill** and **Light Spill Radius** control light cast onto nearby hull surfaces.

Light spill is approximate. It can pass through blocks and does not create spill shadows. These settings change the viewer presentation, not game performance or ship statistics.

## Preview engines and thrusters

In Shaders > Emission, choose an **Engine State**:

- **Idle** shows no engine plume.
- **Cruise** shows cruise plumes.
- **Boost** shows boost plumes.

Adjust cruise or boost plume length if needed. Engine plumes require Rendered shading and can be reduced by the large-model rendering policy.

**Plumes from Hidden Thin Engines** can keep the plume visible when the thin-block display filter hides its engine body. Manually hiding the engine still hides its effect.

Set **Thruster Preview** to Active to preview the selected thruster directions. Direction controls let you examine individual directions. This is a display preview; it does not move the ship or simulate flight.

## Make a clean presentation

1. Choose Rendered shading.
2. Set the camera and background.
3. Adjust the main light and exposure.
4. Add moderate glow or bloom if needed.
5. Hide unnecessary overlays and selection decoration.
6. Check that visibility includes every part you want.
7. Open Image Export and inspect its preview.

Use Material Preview or Ambient Only when you want to judge paint under simpler lighting. Colored scene lighting can change how a paint color appears.
