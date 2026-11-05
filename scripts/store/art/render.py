# Print files for the recompsoftware.com store: "recomp" over "software" in VT323 (SIL OFL, art/VT323-OFL.txt),
# both lines set to the same width. Run: python3 scripts/store/art/render.py  -> scripts/store/art/*.png
import os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); FONT = os.path.join(HERE, 'VT323.ttf')
GREEN = (62, 224, 168, 255); INK = (13, 16, 15, 255)

def line(text, width, color):
    lo, hi = 10, 6000
    while lo < hi:
        m = (lo + hi + 1) // 2; b = ImageFont.truetype(FONT, m).getbbox(text)
        lo, hi = (m, hi) if b[2] - b[0] <= width else (lo, m - 1)
    f = ImageFont.truetype(FONT, lo); b = f.getbbox(text)
    im = Image.new('RGBA', (b[2] - b[0], b[3] - b[1]), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((-b[0], -b[1]), text, font=f, fill=color)
    return im

def lockup(width, color=GREEN):
    a, b = line('recomp', width, color), line('software', width, color)
    gap = int(a.height * 0.16)
    im = Image.new('RGBA', (width, a.height + gap + b.height), (0, 0, 0, 0))
    im.paste(a, (0, 0), a); im.paste(b, (0, a.height + gap), b)
    return im

def tile(width, fg, bg, pad=0.12, radius=0.08):
    L = lockup(int(width * (1 - 2 * pad)), fg)
    h = L.height + int(width * pad * 2)
    im = Image.new('RGBA', (width, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, width - 1, h - 1), radius=int(width * radius), fill=bg)
    im.paste(L, ((width - L.width) // 2, (h - L.height) // 2), L)
    return im

out = lambda im, name: (im.save(os.path.join(HERE, name), dpi=(300, 300)), print(name, im.size))
out(lockup(4500), 'lockup-green.png')                    # tee + hoodie front, dark garments
out(lockup(2400), 'mug-green.png')                       # mug side, black mug

# ---- Stickers: original retro-computing illustrations, each one opaque die-cut shape on transparency ----
DIM = (31, 122, 92, 255); BEZEL = (207, 213, 204, 255); METAL = (168, 176, 170, 255); CREAM = (236, 240, 232, 255)
SLATE = (42, 48, 45, 255); AMBER = (255, 176, 0, 255)
def font(px): return ImageFont.truetype(FONT, px)
def text(d, xy, s, px, fill, anchor='la'): d.text(xy, s, font=font(px), fill=fill, anchor=anchor)
def canvas(w, h): im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); return im, ImageDraw.Draw(im)
def scanlines(im, box, every=10, alpha=70):
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for y in range(box[1], box[3], every): d.line((box[0], y, box[2], y), fill=(0, 0, 0, alpha), width=every // 3)
    return Image.alpha_composite(im, ov)

def crt():  # beige CRT monitor with "recomp" glowing on the screen
    im, d = canvas(1000, 920)
    d.rounded_rectangle((60, 0, 940, 700), 70, fill=BEZEL)
    d.rounded_rectangle((130, 70, 870, 560), 50, fill=INK)
    text(d, (500, 250), 'recomp', 190, GREEN, 'mm'); text(d, (500, 400), '> loading_', 90, DIM, 'mm')
    im = scanlines(im, (130, 70, 870, 560)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((720, 600, 860, 650), 12, fill=METAL); d.ellipse((150, 595, 200, 645), fill=GREEN)
    d.polygon([(380, 700), (620, 700), (680, 840), (320, 840)], fill=BEZEL); d.rounded_rectangle((200, 820, 800, 920), 30, fill=BEZEL)
    return im
def floppy():  # 3.5" floppy with a handwritten-style label
    im, d = canvas(900, 900)
    d.polygon([(0, 40), (40, 0), (860, 0), (900, 40), (900, 900), (0, 900)], fill=SLATE)
    d.rectangle((220, 0, 700, 290), fill=METAL); d.rectangle((560, 40, 650, 250), fill=SLATE)
    d.rounded_rectangle((110, 380, 790, 860), 24, fill=CREAM)
    for y in (470, 560, 650, 740): d.line((150, y + 60, 750, y + 60), fill=(200, 205, 196, 255), width=4)
    text(d, (450, 520), 'recomp', 150, INK, 'mm'); text(d, (450, 680), 'software', 110, DIM, 'mm')
    d.rectangle((40, 820, 90, 870), fill=INK)
    return im
def terminal():  # terminal window running the recompiler
    im, d = canvas(1300, 820)
    d.rounded_rectangle((0, 0, 1300, 820), 50, fill=INK); d.rounded_rectangle((0, 0, 1300, 120), 50, fill=SLATE); d.rectangle((0, 70, 1300, 120), fill=SLATE)
    for k, c in enumerate([(255, 95, 86, 255), AMBER, GREEN]): d.ellipse((50 + k * 80, 35, 100 + k * 80, 85), fill=c)
    rows = [('$ ./recomp game.elf', GREEN), ('  lifting 18,432 functions', DIM), ('  linking runtime ...  ok', DIM), ('$ ./game', GREEN)]
    for k, (t, c) in enumerate(rows): text(d, (70, 170 + k * 130), t, 108, c)
    d.rectangle((370, 575, 430, 680), fill=GREEN)
    return scanlines(im, (0, 120, 1300, 820), 12, 45)
def chip():  # IC package with pins
    im, d = canvas(1200, 760)
    for k in range(8):
        x = 150 + k * 120; d.rectangle((x, 0, x + 60, 760), fill=METAL)
    d.rounded_rectangle((60, 90, 1140, 670), 40, fill=INK); d.ellipse((110, 140, 190, 220), fill=SLATE)
    text(d, (600, 330), 'RECOMP', 230, GREEN, 'mm'); text(d, (600, 520), 'MIPS > x86-64', 100, DIM, 'mm')
    return im
def asm():  # code card: a few lines of MIPS
    im, d = canvas(1250, 760)
    d.rounded_rectangle((0, 0, 1250, 760), 60, fill=INK)
    rows = [('lui   $sp, 0x8040', GREEN), ('jal   recomp_main', GREEN), ('nop   ; delay slot', DIM), ('jr    $ra', GREEN)]
    for k, (t, c) in enumerate(rows): text(d, (80, 90 + k * 160), t, 112, c)
    return scanlines(im, (0, 0, 1250, 760), 12, 40)
def progress():  # 100% matching progress bar
    im, d = canvas(1400, 560)
    d.rounded_rectangle((0, 0, 1400, 560), 80, fill=INK)
    text(d, (700, 150), '100% matching', 170, GREEN, 'mm')
    d.rounded_rectangle((90, 300, 1310, 450), 24, outline=GREEN, width=14)
    for k in range(12): x = 120 + k * 99; d.rectangle((x, 328, x + 80, 422), fill=GREEN)
    return im
def warning():  # hazard label
    im, d = canvas(1400, 680)
    d.rounded_rectangle((0, 0, 1400, 680), 50, fill=AMBER)
    mask = Image.new('L', im.size, 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, 1400, 680), 50, fill=255)
    st = Image.new('RGBA', im.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(st)
    for x in range(-700, 1400, 140): sd.polygon([(x, 680), (x + 70, 680), (x + 750, 0), (x + 680, 0)], fill=INK)
    im.paste(st, (0, 0), Image.composite(st, Image.new('RGBA', im.size), mask).split()[3])
    d = ImageDraw.Draw(im); d.rounded_rectangle((80, 80, 1320, 600), 30, fill=INK)
    text(d, (700, 255), 'NO ROMs', 230, AMBER, 'mm'); text(d, (700, 460), 'INCLUDED', 160, AMBER, 'mm')
    return im
def disc():  # optical disc: bring your own
    im, d = canvas(1000, 1000)
    d.ellipse((0, 0, 1000, 1000), fill=METAL)
    for r, c in [(470, (190, 198, 192, 255)), (400, BEZEL), (330, (190, 198, 192, 255))]: d.ellipse((500 - r, 500 - r, 500 + r, 500 + r), fill=c)
    d.ellipse((380, 380, 620, 620), fill=CREAM); d.ellipse((450, 450, 550, 550), fill=INK)  # hub + hole
    d.rounded_rectangle((90, 660, 910, 840), 40, fill=INK)
    text(d, (500, 750), 'bring your own disc', 90, GREEN, 'mm')
    return im
def lockup_tile():  # the lockup on a CRT-screen tile
    L = lockup(1300); im, d = canvas(1500, L.height + 260)
    d.rounded_rectangle((0, 0, 1500, L.height + 260), 70, fill=INK); im.paste(L, (100, 130), L)
    return scanlines(im, (0, 0, 1500, L.height + 260), 12, 55)
def mark_pill(fg=GREEN, bg=INK):
    t = line('<recomp/>', 1300, fg); h = t.height + 240; im, d = canvas(1500, h)
    d.rounded_rectangle((0, 0, 1499, h - 1), h // 2, fill=bg); im.paste(t, (100, 120), t); return im

def fit(im, w, h):  # scale a sticker to fit inside w x h
    k = min(w / im.width, h / im.height); return im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS)
def slot(size, stickers, gap=40):  # stack stickers in one die-cut slot, centred, with clear gaps
    W, H = size; n = len(stickers); cell = (H - gap * (n + 1)) // n
    im = Image.new('RGBA', size, (0, 0, 0, 0)); y = gap
    for s in stickers:
        s = fit(s, W - 2 * gap, cell); im.paste(s, ((W - s.width) // 2, y + (cell - s.height) // 2), s); y += cell + gap
    return im
def row(size, stickers, gap=40):  # side by side
    W, H = size; n = len(stickers); cell = (W - gap * (n + 1)) // n
    im = Image.new('RGBA', size, (0, 0, 0, 0)); x = gap
    for s in stickers:
        s = fit(s, cell, H - 2 * gap); im.paste(s, (x + (cell - s.width) // 2, (H - s.height) // 2), s); x += cell + gap
    return im

S = {'crt': crt(), 'floppy': floppy(), 'terminal': terminal(), 'chip': chip(), 'asm': asm(), 'progress': progress(),
     'warning': warning(), 'disc': disc(), 'lockup': lockup_tile(), 'mark': mark_pill()}
SMALL = (825, 525); BIG = (1575, 1200)
# 4-pack: 6" x 4" sheet, one sticker per slot
for k, name in enumerate(['crt', 'floppy', 'terminal', 'lockup'], 1): out(slot(SMALL, [S[name]], gap=24), f'sheet4-{k}.png')
# 10-pack: 11" x 8.5" sheet, 4 slots holding 3 + 3 + 2 + 2
out(row(BIG, [S['crt'], S['floppy']]), 'sheet10-1.png')
out(slot(BIG, [S['terminal'], S['lockup'], S['mark']]), 'sheet10-2.png')
out(slot(BIG, [S['warning'], S['progress']]), 'sheet10-3.png')
out(row(BIG, [S['disc'], slot((780, 1200), [S['chip'], S['asm']], gap=30)]), 'sheet10-4.png')
for name, im in S.items(): out(im, f'sticker-{name}.png')
