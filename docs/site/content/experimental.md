# Tabletop XR & iPhone AR

Experimental inspection and presentation tools. Hardware support varies.

## Tabletop XR prototype

Load a ship and choose **Tabletop XR** in the viewport. The inspection window shows
a snapshot of the visible hull, normalized to 80 cm along its longest dimension.
Drag to rotate and scroll to resize in the desktop preview. **Reset view** restores
the initial placement. Source blocks, paint, and editor cameras are unchanged.

On a browser with an immersive WebXR headset, choose **Enter VR**. Hold one
controller grip to move and rotate the ship; hold both grips and move your hands
apart or together to resize it. Point at the floating **Reset** or **Exit VR**
buttons and pull the trigger. The headset's system exit also returns to the preview.
Reset places the ship in front of your current head position, including when seated.

WebXR requires HTTPS or localhost. The local development server accepts only its
loopback address; a standalone headset needs an HTTPS-hosted build or an appropriate
development forwarding setup. Unsupported browsers retain the desktop preview.

This prototype includes hull materials and loaded textures, but excludes mounted
turrets, editing, coverage overlays, bloom, ambient occlusion, and animated exhaust.
It uses a separate GPU context and model allocation while open. Large-ship headset
performance and physical controller behavior still require testing on hardware.

## iPhone AR tabletop test

Run `npm run ar:phone` (or double-click `Start iPhone AR Test.cmd`) and open the
printed localhost URL on this PC. The page prepares a small sample ship
automatically. Download its USDZ, transfer it to your iPhone (for example through
OneDrive), save it to Files, and tap it. Choose **AR** and scan your table. Use
Quick Look's drag, pinch, and rotation controls. Choose an XML in the test page
to export your own ship; choose 20, 40, or 80 cm as its initial longest dimension.
For direct Safari access on the same Wi-Fi, run `npm run ar:phone -- --lan`
or double-click `Start iPhone AR Test.cmd`. Open the printed LAN URL on your
iPhone, then tap **View in AR**. LAN mode exposes the test page and application
source assets on your network; it does not serve project metadata or accept
uploads. The command without `--lan` stays loopback-only. Close the server
console when finished.

The phone test uses Apple's native AR Quick Look, not a WebXR AR session.
Quick Look opens a locally generated USDZ with native shapes and primary paint
colors; shader textures, secondary paint details, effects, and mounted turret
designs are not included. No model is uploaded to the PC or a cloud service.
The standalone page does not require WebXR or a local HTTPS certificate.

The main **Tabletop XR** dialog also offers **Prepare iPhone AR**, **View in AR**,
and **Download USDZ**. The phone-friendly page is included at
`prototypes/phone-ar/index.html` in static builds. When that build is hosted on
a site you can access from iPhone Safari, **View in AR** opens Quick Look directly.

