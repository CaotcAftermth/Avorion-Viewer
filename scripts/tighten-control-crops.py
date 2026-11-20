"""Crop documentation screenshots to their existing amber outline, without resampling."""
import json
from pathlib import Path
from PIL import Image

root = Path('docs/site/assets')
manifest_path = root / 'control-captures.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
density = manifest['density']
count = 0
for entry in manifest['entries']:
    if not entry.get('file'):
        continue
    path = root / entry['file']
    with Image.open(path) as original:
        image = original.convert('RGB')
        # Exact screenshot-only outline color; this does not estimate the tool silhouette.
        mask = Image.new('1', image.size)
        mask.putdata([pixel == (255, 202, 105) for pixel in image.getdata()])
        bounds = mask.getbbox()
        if bounds is None:
            raise RuntimeError(f'No yellow outline found: {path}')
        cropped = original.crop(bounds)
        cropped.save(path)
        width, height = cropped.size
    entry['outlineCropPixels'] = list(bounds)
    entry['pixelWidth'], entry['pixelHeight'] = width, height
    entry['cssWidth'], entry['cssHeight'] = width / density, height / density
    entry['framing'] = 'yellow outline; no outer margin'
    with Image.open(path) as check:
        pixels = check.convert('RGB')
        edge_mask = Image.new('1', pixels.size)
        edge_mask.putdata([pixel == (255, 202, 105) for pixel in pixels.getdata()])
        assert edge_mask.getbbox() == (0, 0, width, height), str(path)
    count += 1
manifest['framing'] = 'yellow outline; no outer margin'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f'Tightened and verified {count} captures without resampling.')
