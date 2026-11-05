# Screen images for the Blender CRT scenes (green phosphor, VT323). Run: python3 scripts/store/scene/screens.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'art'))
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); FONT = os.path.join(HERE, '..', 'art', 'VT323.ttf')
G = (62, 224, 168); D = (25, 110, 82); BG = (6, 14, 10)
W, H = 1024, 768
def screen(lines, name, big=None):
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    if big:
        f = ImageFont.truetype(FONT, big[1]); d.text((W // 2, big[2]), big[0], font=f, fill=G, anchor='mm')
    for x, y, t, px, c in lines: d.text((x, y), t, font=ImageFont.truetype(FONT, px), fill=c)
    glow = im.filter(ImageFilter.GaussianBlur(6)); im = Image.blend(im, glow, 0.35)
    d = ImageDraw.Draw(im)
    for y in range(0, H, 4): d.line((0, y, W, y), fill=(0, 0, 0), width=1)
    im.save(os.path.join(HERE, name)); print(name)
screen([], 'scr-lockup.png', ('recomp', 250, 300)); im = Image.open(os.path.join(HERE, 'scr-lockup.png'))
d = ImageDraw.Draw(im); d.text((W // 2, 520), 'software', font=ImageFont.truetype(FONT, 190), fill=G, anchor='mm')
for y in range(0, H, 4): d.line((0, y, W, y), fill=(0, 0, 0), width=1)
im.save(os.path.join(HERE, 'scr-lockup.png'))
screen([(60, 60, '$ ./recomp game.elf', 70, G), (60, 150, '  lifting 18,432 functions', 60, D), (60, 230, '  [##########--] 83%', 60, G),
        (60, 310, '  linking runtime ... ok', 60, D), (60, 410, '$ ./game', 70, G), (60, 500, '  60 fps  4K  native', 60, D), (60, 600, '$ _', 70, G)], 'scr-terminal.png')
screen([(60, 60, '80000400  lui   $sp, 0x8040', 62, G), (60, 140, '80000404  jal   recomp_main', 62, G), (60, 220, '80000408  nop', 62, D),
        (60, 300, '8000040c  lw    $ra, 0x14($sp)', 62, G), (60, 380, '80000410  jr    $ra', 62, G), (60, 460, '80000414  addiu $sp, $sp, 0x18', 62, D),
        (60, 560, '; matched 1,204 / 1,204', 62, G)], 'scr-asm.png')
screen([(0, 0, '', 10, G)], 'scr-match.png', ('100%', 300, 280)); im = Image.open(os.path.join(HERE, 'scr-match.png')); d = ImageDraw.Draw(im)
d.text((W // 2, 500), 'matching', font=ImageFont.truetype(FONT, 150), fill=G, anchor='mm'); d.rectangle((120, 610, 904, 680), outline=G, width=8)
for k in range(12): d.rectangle((136 + k * 64, 624, 186 + k * 64, 666), fill=G)
for y in range(0, H, 4): d.line((0, y, W, y), fill=(0, 0, 0), width=1)
im.save(os.path.join(HERE, 'scr-match.png'))
