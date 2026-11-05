# Shirt print files from the Blender renders: the scene over the "recomp / software" lockup, 4500 x 5400 transparent PNG.
# Run after scene.py: python3 scripts/store/scene/compose.py  -> scripts/store/art/shirt-<scene>.png
import os
HERE = os.path.dirname(os.path.abspath(__file__))
from PIL import Image
W, H = 4500, 5400
def lockup_only():  # reuse the lockup function without re-rendering all the art files
    src = open(os.path.join(HERE, '..', 'art', 'render.py')).read(); src = src[:src.index('out = lambda')]
    ns = {'__file__': os.path.join(HERE, '..', 'art', 'render.py')}; exec(src, ns); return ns['lockup']
lockup = lockup_only()
for name in ('battlestation', 'crtwall'):
    r = Image.open(os.path.join(HERE, f'render-{name}.png')).convert('RGBA'); r = r.crop(r.getchannel('A').getbbox())
    k = min(4200 / r.width, 3500 / r.height); r = r.resize((int(r.width * k), int(r.height * k)), Image.LANCZOS)
    L = lockup(2900)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); top = (H - r.height - 260 - L.height) // 2
    im.paste(r, ((W - r.width) // 2, top), r); im.paste(L, ((W - L.width) // 2, top + r.height + 260), L)
    out = os.path.join(HERE, '..', 'art', f'shirt-{name}.png'); im.save(out, dpi=(300, 300)); print(out, r.size)
