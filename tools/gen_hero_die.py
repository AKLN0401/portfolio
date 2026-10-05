"""Generate an illustrative SoC die layout as SVG.

Procedural and generic: no real process geometry, no library data.
Usage: python3 tools/gen_hero_die.py assets/hero-die.svg
"""
import random
import sys

R = random.Random(20260926)
OUT = sys.argv[1]

W = 1000
CORE = (164, 164, 836, 836)        # x0, y0, x1, y1
ROW_H = 4.0
VAR_W = 224.0

# muted layer palette on a dark background (EDA physical view, not "neon")
BG = "#0d0f11"
DIE = "#14171a"
CELL = ["#2c3a33", "#324137", "#2f3542", "#39402f", "#2a3340", "#3a3530", "#34403c"]
CELL_SEQ = ["#3f4a36", "#44503d"]   # flops: slightly lighter, larger cells
M_H = "#6d8aa3"                     # horizontal routing layers
M_V = "#9a8460"                     # vertical routing layers
VDD = "#a58a4c"
VSS = "#50708f"
CLK = "#c0584b"
FENCE = "#8a939b"
LABEL = "#a3abb2"

out = []
w = out.append


def f(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


# ----------------------------------------------------------------- floorplan
# hard macros: (x, y, w, h, kind, orientation)
macros = []
# CPU L1 macros
macros += [(174, 174, 92, 64, "sram", 0), (274, 174, 92, 64, "sram", 0)]
# L2 bank: 2 columns x 4 rows on the right edge
for c in range(2):
    for r_ in range(4):
        macros.append((614 + c * 113, 174 + r_ * 86, 105, 78, "sram", c))
# bottom row of buffers
for i in range(5):
    macros.append((174 + i * 84, 788, 78, 44, "sram", 0))
# register files in the uncore
macros += [(620, 560, 56, 40, "rf", 0), (684, 560, 56, 40, "rf", 0)]
# PLL
pll = (716, 720, 116, 112)

blocks = [  # fence outlines + labels
    (168, 168, 470, 424, "CPU"),
    (168, 436, 596, 772, "ACCEL"),
    (606, 168, 836, 520, "L2 SRAM"),
    (606, 530, 836, 708, "UNCORE"),
    (168, 780, 596, 836, "BUF"),
    (478, 168, 596, 424, "NOC"),
]


def density(x, y):
    """Standard-cell utilisation map: 0 = sparse, 1 = medium, 2 = dense."""
    if 168 <= x <= 470 and 168 <= y <= 424:
        return 2
    if 168 <= x <= 596 and 436 <= y <= 772:
        # hotspot toward the centre of the accelerator
        return 2 if (x - 380) ** 2 + (y - 600) ** 2 < 150 ** 2 else 1
    if 478 <= x <= 596:
        return 1
    return 0


# ------------------------------------------------------------ SVG preamble
w(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}" width="{W}" height="{W}">')
w("<title>Illustrative SoC die layout</title>")
w("<defs>")
w(f'<clipPath id="core"><rect x="{CORE[0]}" y="{CORE[1]}" width="{CORE[2]-CORE[0]}" height="{CORE[3]-CORE[1]}"/></clipPath>')

# standard-cell row variants at three utilisation levels
FILL_P = {0: 0.42, 1: 0.18, 2: 0.06}
for lvl in (0, 1, 2):
    for v in range(8):
        w(f'<symbol id="r{lvl}{v}" overflow="visible">')
        x = 0.0
        while x < VAR_W:
            seq = R.random() < 0.18
            cw = R.choice([6, 7, 8, 9]) if seq else R.choice([1.4, 2, 2, 2.6, 3, 3.6, 4.2, 5])
            if R.random() < FILL_P[lvl]:
                x += cw  # filler / whitespace
                continue
            col = R.choice(CELL_SEQ) if seq else R.choice(CELL)
            w(f'<rect x="{f(x)}" y="0.45" width="{f(max(cw-0.35,0.8))}" height="3.1" fill="{col}"/>')
            # a pin or two on larger cells
            if cw >= 3 and R.random() < 0.7:
                px = x + R.uniform(0.4, cw - 1.0)
                w(f'<rect x="{f(px)}" y="{f(R.uniform(1.0,2.2))}" width="0.5" height="0.9" fill="#58646e"/>')
            x += cw
        w("</symbol>")

# routing tiles: short segments on alternating-direction layers
TILE = 56
for lvl, (nh, nv) in enumerate([(10, 8), (22, 18), (40, 32)]):
    for v in range(6):
        w(f'<symbol id="t{lvl}{v}" overflow="visible">')
        for _ in range(nh):
            y = round(R.uniform(0, TILE) / 0.8) * 0.8
            x0 = R.uniform(-4, TILE)
            ln = R.choice([4, 6, 9, 14, 22, 30])
            w(f'<line x1="{f(x0)}" y1="{f(y)}" x2="{f(x0+ln)}" y2="{f(y)}" stroke="{M_H}" stroke-width="{R.choice([0.35,0.35,0.5])}"/>')
        for _ in range(nv):
            x = round(R.uniform(0, TILE) / 0.8) * 0.8
            y0 = R.uniform(-4, TILE)
            ln = R.choice([4, 6, 9, 14, 22, 30])
            w(f'<line x1="{f(x)}" y1="{f(y0)}" x2="{f(x)}" y2="{f(y0+ln)}" stroke="{M_V}" stroke-width="{R.choice([0.35,0.35,0.5])}"/>')
        # vias at a few crossings
        for _ in range(nh // 3):
            w(f'<rect x="{f(R.uniform(0,TILE))}" y="{f(R.uniform(0,TILE))}" width="0.7" height="0.7" fill="#c8ccd0" fill-opacity="0.55"/>')
        w("</symbol>")

# SRAM bitcell array, sense-amp strip, cap array for the PLL
w('<pattern id="bit" width="2.2" height="1.5" patternUnits="userSpaceOnUse">'
  '<rect width="2.2" height="1.5" fill="#1f2a30"/>'
  '<rect x="0.15" y="0.15" width="0.9" height="0.55" fill="#35505c"/>'
  '<rect x="1.15" y="0.8" width="0.9" height="0.55" fill="#35505c"/>'
  '<rect x="0" y="0.7" width="2.2" height="0.1" fill="#4a6572"/></pattern>')
w('<pattern id="sa" width="2.2" height="6" patternUnits="userSpaceOnUse">'
  '<rect width="2.2" height="6" fill="#262b2e"/>'
  '<rect x="0.3" y="0.4" width="0.7" height="5.2" fill="#4b5a4a"/>'
  '<rect x="1.3" y="1.5" width="0.5" height="3" fill="#5d6450"/></pattern>')
w('<pattern id="dec" width="6" height="1.5" patternUnits="userSpaceOnUse">'
  '<rect width="6" height="1.5" fill="#2a2f2a"/>'
  '<rect x="0.4" y="0.25" width="3.6" height="1" fill="#4c5a45"/></pattern>')
w('<pattern id="cap" width="5" height="5" patternUnits="userSpaceOnUse">'
  '<rect width="5" height="5" fill="#1e2226"/>'
  '<rect x="0.6" y="0.6" width="3.8" height="3.8" fill="#3b4652"/>'
  '<rect x="1.6" y="1.6" width="1.8" height="1.8" fill="#56636f"/></pattern>')
w('<pattern id="rails" width="4" height="4" patternUnits="userSpaceOnUse">'
  '<rect y="0" width="4" height="0.45" fill="#3a4148"/></pattern>')
w("</defs>")

# ------------------------------------------------------------------ die
w(f'<rect width="{W}" height="{W}" fill="{BG}"/>')
w(f'<rect x="22" y="22" width="956" height="956" fill="{DIE}"/>')
# seal ring
w('<rect x="26" y="26" width="948" height="948" fill="none" stroke="#5c6166" stroke-width="3"/>')
w('<rect x="32" y="32" width="936" height="936" fill="none" stroke="#3b3f44" stroke-width="1.2"/>')

# ------------------------------------------------------------------ I/O ring
PAD_D = 62   # depth of an I/O cell
IO0 = 34
CORNER = PAD_D
PAD0 = IO0 + CORNER
pads_per_side = 26
pitch = (W - 2 * PAD0) / pads_per_side


def io_cell(side, i):
    kind = "sig"
    if i % 5 == 2:
        kind = "vdd"
    elif i % 5 == 3 and i % 2:
        kind = "vss"
    s = pitch - 3
    a = PAD0 + i * pitch + 1.5
    # local frame: along = a..a+s, depth = IO0..IO0+PAD_D (outer -> inner)
    def rect(u, d, du, dd, **kw):
        if side == "top":
            x, y, ww, hh = u, d, du, dd
        elif side == "bottom":
            x, y, ww, hh = u, W - d - dd, du, dd
        elif side == "left":
            x, y, ww, hh = d, u, dd, du
        else:
            x, y, ww, hh = W - d - dd, u, dd, du
        attrs = " ".join(f'{k.replace("_","-")}="{v}"' for k, v in kw.items())
        w(f'<rect x="{f(x)}" y="{f(y)}" width="{f(ww)}" height="{f(hh)}" {attrs}/>')

    rect(a, IO0, s, PAD_D, fill="#1b2024", stroke="#3a4147", stroke_width="0.6")
    bp = min(s - 5, 22)
    # bond pad and passivation opening
    rect(a + (s - bp) / 2, IO0 + 3, bp, bp, fill="#6f767c", fill_opacity="0.5")
    rect(a + (s - bp) / 2 + 2, IO0 + 5, bp - 4, bp - 4, fill="none", stroke="#9aa1a7", stroke_width="0.5")
    # ESD clamp fingers
    for k in range(5):
        rect(a + 2.5 + k * (s - 5) / 5, IO0 + bp + 6, (s - 5) / 5 - 0.8, 13, fill="#3e5549")
    # driver / level-shifter region
    rect(a + 2, IO0 + bp + 22, s - 4, PAD_D - bp - 25, fill="#252c2b")
    for k in range(3):
        rect(a + 3, IO0 + bp + 24 + k * 4.4, s - 6, 2.4, fill="#394434")
    if kind != "sig":
        col = VDD if kind == "vdd" else VSS
        rect(a + s / 2 - 2.5, IO0 + bp + 4, 5, PAD_D - bp + 4, fill=col, fill_opacity="0.75")


for side in ("top", "bottom", "left", "right"):
    for i in range(pads_per_side):
        io_cell(side, i)

# corner cells
for cx, cy in ((IO0, IO0), (W - IO0 - CORNER, IO0), (IO0, W - IO0 - CORNER), (W - IO0 - CORNER, W - IO0 - CORNER)):
    w(f'<rect x="{cx}" y="{cy}" width="{CORNER}" height="{CORNER}" fill="#1a1e21" stroke="#3a4147" stroke-width="0.6"/>')
    for k in range(1, 8):
        w(f'<line x1="{cx}" y1="{f(cy+k*CORNER/8)}" x2="{cx+CORNER}" y2="{f(cy+k*CORNER/8)}" stroke="#2a3035" stroke-width="0.8"/>')

# ------------------------------------------------------------------ core power ring
K = (W - 2 * (PAD0 + 8)) / 708
w(f'<g transform="translate({f(PAD0 + 8 - 146 * K)} {f(PAD0 + 8 - 146 * K)}) scale({K:.4f})">')
w(f'<rect x="146" y="146" width="708" height="708" fill="none" stroke="{VSS}" stroke-width="5" stroke-opacity="0.85"/>')
w(f'<rect x="155" y="155" width="690" height="690" fill="none" stroke="{VDD}" stroke-width="5" stroke-opacity="0.85"/>')

# ------------------------------------------------------------------ std cells
w('<g clip-path="url(#core)">')
w(f'<rect x="{CORE[0]}" y="{CORE[1]}" width="{CORE[2]-CORE[0]}" height="{CORE[3]-CORE[1]}" fill="#111416"/>')
y = CORE[1]
row = 0
while y < CORE[3]:
    x = CORE[0] - R.uniform(0, VAR_W)
    while x < CORE[2]:
        lvl = density(x + VAR_W / 2, y)
        v = R.randrange(8)
        if row % 2:
            w(f'<use href="#r{lvl}{v}" transform="translate({f(x)} {f(y+ROW_H)}) scale(1 -1)"/>')
        else:
            w(f'<use href="#r{lvl}{v}" x="{f(x)}" y="{f(y)}"/>')
        x += VAR_W
    y += ROW_H
    row += 1
w(f'<rect x="{CORE[0]}" y="{CORE[1]}" width="{CORE[2]-CORE[0]}" height="{CORE[3]-CORE[1]}" fill="url(#rails)"/>')

# routing, density follows cell utilisation plus a congestion hotspot
w('<g opacity="0.8">')
ty = CORE[1]
while ty < CORE[3]:
    tx = CORE[0]
    while tx < CORE[2]:
        lvl = density(tx + TILE / 2, ty + TILE / 2)
        w(f'<use href="#t{lvl}{R.randrange(6)}" x="{tx}" y="{ty}"/>')
        tx += TILE
    ty += TILE
w("</g>")

# power mesh: vertical straps (lower metal) and horizontal straps (upper metal)
w('<g opacity="0.55">')
for x in range(176, 836, 42):
    w(f'<rect x="{x}" y="{CORE[1]}" width="1.6" height="{CORE[3]-CORE[1]}" fill="{VDD}"/>')
    w(f'<rect x="{x+3.4}" y="{CORE[1]}" width="1.6" height="{CORE[3]-CORE[1]}" fill="{VSS}"/>')
w("</g>")
w('<g opacity="0.42">')
for yy in range(190, 836, 42):
    w(f'<rect x="{CORE[0]}" y="{yy}" width="{CORE[2]-CORE[0]}" height="2.4" fill="{VDD}"/>')
    w(f'<rect x="{CORE[0]}" y="{yy+4.6}" width="{CORE[2]-CORE[0]}" height="2.4" fill="{VSS}"/>')
w("</g>")
# repeated processing-element tiles in the accelerator
for i in range(6):
    for j in range(4):
        x0 = 184 + i * 66
        y0 = 456 + j * 76
        w(f'<rect x="{x0}" y="{y0}" width="60" height="70" fill="none" stroke="#8fa596" stroke-width="0.8" stroke-opacity="0.75"/>')

w("</g>")

# ------------------------------------------------------------------ macros


def sram(x, y, ww, hh, orient):
    w(f'<rect x="{f(x-4)}" y="{f(y-4)}" width="{f(ww+8)}" height="{f(hh+8)}" fill="#101214"/>')
    w(f'<rect x="{f(x)}" y="{f(y)}" width="{f(ww)}" height="{f(hh)}" fill="#1a1f23" stroke="#737c84" stroke-width="0.7"/>')
    dec_w = ww * 0.1
    io_h = hh * 0.16
    ctl_w = ww * 0.16
    arr_h = hh - io_h - 3
    half = (ww - dec_w - 4) / 2
    # two bitcell arrays either side of the row decoder
    w(f'<rect x="{f(x+1.5)}" y="{f(y+1.5)}" width="{f(half)}" height="{f(arr_h)}" fill="url(#bit)"/>')
    w(f'<rect x="{f(x+2.5+half+dec_w)}" y="{f(y+1.5)}" width="{f(half)}" height="{f(arr_h)}" fill="url(#bit)"/>')
    w(f'<rect x="{f(x+2+half)}" y="{f(y+1.5)}" width="{f(dec_w)}" height="{f(arr_h)}" fill="url(#dec)"/>')
    # column mux / sense amps / write drivers
    w(f'<rect x="{f(x+1.5)}" y="{f(y+2+arr_h)}" width="{f(half)}" height="{f(io_h-1)}" fill="url(#sa)"/>')
    w(f'<rect x="{f(x+2.5+half+dec_w)}" y="{f(y+2+arr_h)}" width="{f(half)}" height="{f(io_h-1)}" fill="url(#sa)"/>')
    # control block
    w(f'<rect x="{f(x+2+half)}" y="{f(y+2+arr_h)}" width="{f(dec_w)}" height="{f(io_h-1)}" fill="#343a2f"/>')
    # array subdivisions (bank strapping)
    for k in (1, 2, 3):
        yy = y + 1.5 + k * arr_h / 4
        w(f'<line x1="{f(x+1.5)}" y1="{f(yy)}" x2="{f(x+ww-1.5)}" y2="{f(yy)}" stroke="#101416" stroke-width="0.8"/>')
    # macro power ring and pins on the channel-facing edge
    w(f'<rect x="{f(x+0.6)}" y="{f(y+0.6)}" width="{f(ww-1.2)}" height="{f(hh-1.2)}" fill="none" stroke="{VDD}" stroke-width="0.5" stroke-opacity="0.8"/>')
    edge_x = x if orient else x + ww
    for k in range(int(hh // 3)):
        yy = y + 2 + k * 3
        w(f'<rect x="{f(edge_x-1 if orient else edge_x-1.2)}" y="{f(yy)}" width="2.2" height="0.9" fill="#b9bfc4" fill-opacity="0.7"/>')
    for k in range(int(ww // 3)):
        w(f'<rect x="{f(x+2+k*3)}" y="{f(y+hh-1.1)}" width="0.9" height="2.2" fill="#b9bfc4" fill-opacity="0.7"/>')


def regfile(x, y, ww, hh):
    w(f'<rect x="{f(x-3)}" y="{f(y-3)}" width="{f(ww+6)}" height="{f(hh+6)}" fill="#101214"/>')
    w(f'<rect x="{f(x)}" y="{f(y)}" width="{f(ww)}" height="{f(hh)}" fill="#1c2124" stroke="#737c84" stroke-width="0.6"/>')
    for k in range(int((hh - 4) // 2.2)):
        w(f'<rect x="{f(x+2)}" y="{f(y+2+k*2.2)}" width="{f(ww-4)}" height="1.3" fill="#3c4a3f"/>')


for (x, y, ww, hh, kind, o) in macros:
    if kind == "sram":
        sram(x, y, ww, hh, o)
    else:
        regfile(x, y, ww, hh)

# PLL: guard ring, loop-filter capacitor array, VCO ring
px, py, pw, ph = pll
w(f'<rect x="{px-4}" y="{py-4}" width="{pw+8}" height="{ph+8}" fill="#101214"/>')
w(f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" fill="#1a1d20" stroke="#737c84" stroke-width="0.7"/>')
w(f'<rect x="{px+3}" y="{py+3}" width="{pw-6}" height="{ph-6}" fill="none" stroke="#5e7a64" stroke-width="2"/>')
w(f'<rect x="{px+9}" y="{py+9}" width="58" height="{ph-18}" fill="url(#cap)"/>')
cx, cy = px + 92, py + 34
w(f'<polygon points="{cx-12},{cy-18} {cx+12},{cy-18} {cx+18},{cy-6} {cx+18},{cy+6} {cx+12},{cy+18} {cx-12},{cy+18} {cx-18},{cy+6} {cx-18},{cy-6}" fill="none" stroke="#9a8460" stroke-width="2.2"/>')
w(f'<polygon points="{cx-7},{cy-11} {cx+7},{cy-11} {cx+11},{cy-4} {cx+11},{cy+4} {cx+7},{cy+11} {cx-7},{cy+11} {cx-11},{cy+4} {cx-11},{cy-4}" fill="none" stroke="#9a8460" stroke-width="1.4"/>')
for k in range(8):
    w(f'<rect x="{px+74}" y="{py+60+k*5.4}" width="36" height="3.4" fill="#3d4636"/>')

# ------------------------------------------------------------------ clock
w(f'<g stroke="{CLK}" fill="none" stroke-linecap="square">')
# trunk from the PLL out to the core
w(f'<polyline points="{px},{py+20} 600,{py+20} 600,604 380,604" stroke-width="1.8"/>')


def htree(cx, cy, dx, dy, depth, sw):
    if depth == 0:
        return
    w(f'<line x1="{f(cx-dx)}" y1="{f(cy)}" x2="{f(cx+dx)}" y2="{f(cy)}" stroke-width="{f(sw)}"/>')
    for sx in (-1, 1):
        x = cx + sx * dx
        w(f'<line x1="{f(x)}" y1="{f(cy-dy)}" x2="{f(x)}" y2="{f(cy+dy)}" stroke-width="{f(sw*0.85)}"/>')
        for sy in (-1, 1):
            htree(x, cy + sy * dy, dx / 2, dy / 2, depth - 1, sw * 0.7)


htree(380, 604, 104, 84, 3, 1.5)
# CPU and uncore branches
w(f'<polyline points="600,604 600,430 320,430 320,300" stroke-width="1.2"/>')
w(f'<polyline points="600,604 720,604 720,620" stroke-width="1.0"/>')
w("</g>")

# ------------------------------------------------------------------ fences + labels
for x0, y0, x1, y1, name in blocks:
    w(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="none" stroke="{FENCE}" stroke-width="0.9" stroke-opacity="0.75"/>')
    tw = len(name) * 7.4 + 8
    w(f'<rect x="{x0+3}" y="{y0+3}" width="{f(tw)}" height="14" fill="#0d0f11" fill-opacity="0.85"/>')
    w(f'<text x="{x0+7}" y="{y0+13.5}" font-family="IBM Plex Mono, Menlo, monospace" font-size="11" letter-spacing="0.6" fill="{LABEL}">{name}</text>')
w(f'<rect x="{px+3}" y="{py+ph-17}" width="34" height="14" fill="#0d0f11" fill-opacity="0.85"/>')
w(f'<text x="{px+7}" y="{py+ph-6.5}" font-family="IBM Plex Mono, Menlo, monospace" font-size="11" letter-spacing="0.6" fill="{LABEL}">PLL</text>')

w("</g>")
w("</svg>")

with open(OUT, "w") as fh:
    fh.write("\n".join(out))
print(OUT, sum(len(s) + 1 for s in out), "bytes")
