"""Package only the explicitly simulated frames produced by status-demo.mjs."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--input', type=Path, default=Path('.scratch/status-demo'))
parser.add_argument('--output', type=Path, default=Path('docs/images'))
args = parser.parse_args()
manifest = json.loads((args.input / 'manifest.json').read_text(encoding='utf-8'))
assert manifest['installedHostRecording'] == 'UNVERIFIED'
assert manifest['surface'].startswith('SIMULATED')
assert len(manifest['frames']) == 12, 'Both languages need four status frames and two settings frames'
root = Path(__file__).resolve().parent.parent
for filename, expected_hash in manifest['sources'].items():
    assert hashlib.sha256((root / filename).read_bytes()).hexdigest() == expected_hash, f'Stale source: {filename}'
args.output.mkdir(parents=True, exist_ok=True)
for row in manifest['frames']:
    source = args.input / row['filename']
    assert source.name == row['filename'], 'Only direct generated filenames are accepted'
    assert hashlib.sha256(source.read_bytes()).hexdigest() == row['sha256']
    with Image.open(source) as frame:
        assert frame.size == (1280, 1000)
    shutil.copyfile(source, args.output / source.name)
manifest['media'] = []
for locale in ('zh', 'en'):
    frames = [Image.open(args.input / f'status-{locale}-{stage}.png').convert('RGB')
              for stage in ('running', 'waiting', 'completed', 'failed')]
    target = args.output / f'status-demo-{locale}.gif'
    frames[0].save(target, save_all=True, append_images=frames[1:], duration=1800,
                   loop=0, optimize=False, disposal=2)
    with Image.open(target) as gif:
        assert gif.n_frames == 4
        assert gif.size == (1280, 1000)
        for index in range(4):
            gif.seek(index)
            assert gif.info['duration'] == 1800
    manifest['media'].append({'filename': target.name, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                              'frames': 4, 'frameDurationMs': 1800,
                              'meaning': 'SIMULATED discrete states, not recorded motion or real DSH'})
    for frame in frames:
        frame.close()
manifest['packaging'] = {'script': 'scripts/status-demo-media.py',
                         'sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
(args.output / 'status-demo-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Verified 12 simulated PNGs and two four-frame GIFs. Installed DSH recording remains UNVERIFIED.')
