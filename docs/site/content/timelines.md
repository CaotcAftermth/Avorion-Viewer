# Create showcase cameras and timelines

## Choose a camera preset

Open **Showcase & Timeline > Camera**.

| Preset | Presentation use |
|---|---|
| **manual** | Use your own viewport framing |
| **orbit** | Move around the turret |
| **close-up** | Show the design closely |
| **barrel-focus** | Emphasize the barrel |
| **tracking-view** | Show aiming movement |
| **firing-profile** | Show firing from a useful profile |
| **projectile-follow** | Present projectile motion |
| **beam-showcase** | Present beam effects |
| **hero-shot** | Use a presentation view |
| **camera keys** | Follow your saved camera path |

Camera Field of View and Camera Distance Scale change framing. Showcase Setup controls background and lighting separately from the main ship presentation.

Dragging a preset camera normally returns you to manual framing. Camera-keys mode has special paused-edit behavior described below.

## Use the automated sequence

Enable **Automated sequence**. Choose its duration and whether to loop.

The sequence contains Inspection, Acquisition, Tracking, Firing, Detail, and Closing phases. In **Sequence Phases**, choose each phase's camera and whether firing, tracking, and the target marker are active.

Phase starts are fractions of total duration. For example, 0.5 means halfway through the sequence. Changing total duration changes the time represented by those fractions.

Use the timeline controls to seek to a time, step backward or forward, play, pause, or restart. Step controls advance by 1/30 second.

## Make a custom camera path

A camera key saves a shot at a particular time. Playback moves between the keys.

1. Open **Camera keys** in Showcase & Timeline.
2. Pause playback.
3. Frame the first shot.
4. Set **Seek time** to its time.
5. Select **Add key at current time**.
6. Set another time and frame the next shot.
7. Add another key.
8. Select **Play / Resume** to inspect the path.

The first key switches the camera to camera-keys mode. A key row lets you change its time, anchor, and transition. **Jump** goes to it. **Update from view** replaces its framing while retaining its time and anchor. **Delete** removes it.

Click a timeline key marker to jump to that key. To retime a key, edit its time field; the marker strip does not support drag-to-retime.

## Choose anchors and transitions

| Anchor | Behavior |
|---|---|
| **world** | Keeps the key fixed in the scene |
| **turret** | Follows the first muzzle position and barrel heading |
| **target** | Follows the demonstration target |

The turret anchor follows heading, not barrel elevation. An estimated first muzzle makes the anchor approximate.

Transitions to the next key can be **smooth**, **linear**, or **hold**. Hold produces a cut rather than a continuous move to the next shot.

Changing an anchor re-expresses the shot at that key's time. Review the movement between keys after an anchor change.

## Frame while using keys

While paused in camera-keys mode, orbiting or zooming frees the viewport so you can compose a shot. This does not change an existing key.

Use **Update from view** or add a new key to keep the shot. **Follow keys**, seeking, jumping, or playing returns the view to the saved path. Dragging during playback pauses it.

## Use sequence events

Timed events can switch firing, tracking, or the target marker on and off. Unset event values use the normal Studio settings.

Events affect simulation behavior. Editing them rebuilds playback at the current time.

**Fill from preset sequence** converts the current preset sequence to editable camera keys and events. It replaces existing keys after confirmation. Save an asset copy first if you need to retain the old path.

In camera-keys mode, sequence length follows the last key or event, with a minimum of one second.

## Export a showcase

Open **Showcase Export**.

1. Choose an Export preset or set your own format.
2. Set width and height.
3. Set start time, duration, and frame rate.
4. Choose transparency, effect quality, and target-marker visibility.
5. Select **Export animation / still**.
6. Wait for completion, or select **Cancel export**.
7. Keep the downloaded output and its metadata file.

**Use full sequence length** sets the start to 0 and uses the sequence duration, capped at 60 seconds.

| Format | Result and limits |
|---|---|
| **PNG** | One still frame; supports transparency |
| **PNG sequence** | ZIP of individual frames and sequence information; supports transparency |
| **GIF** | Loopable animation with limited colors and binary transparency |
| **WebM** | Silent video on browsers with supported VP8 WebCodecs; no alpha in this path |

MP4 is not supported. WebM availability depends on the browser's encoder support.

Showcase output dimensions are 16–4096 pixels per side. Frame rate is 24, 30, or 60. Duration is at most 60 seconds, and the selected time range must fit within 300 seconds.

Studio GIF has separate limits from the ship Turntable GIF: at most 1280 pixels on a side and 120 million total frame-pixels. Encoded showcase output is also limited to 256 MiB. Reduce duration, resolution, or frame rate if an export is rejected.

All showcase animations are silent. Save the library asset separately to retain the editable Studio and camera settings.
