"""Generate the 12 nm NVDLA floorplan figure (inline SVG for projects/nvdla.html).

To scale from the planner output (NPU_12nm pnr/floorplan_plan.tcl) and the SRAM macro size.
No absolute dimensions are printed on the figure.
Usage: python3 tools/gen_nvdla_floorplan.py > /tmp/fp.svg   (or pass an output path)
"""
import sys

# ---- plan (microns, layout coordinates, y up) -- copy from pnr/floorplan_plan.tcl when it changes
FP_W, FP_H = 3039.120, 3024.000
BLK = {  # x, y, w, h
    "ma": (0.000, 0.000, 246.960, 3024.000),
    "p":  (367.920, 0.000, 1131.480, 927.360),
    "a":  (1539.720, 0.000, 1131.480, 927.360),
    "o":  (367.920, 967.680, 2303.280, 745.920),
    "c":  (367.920, 1753.920, 2303.280, 1270.080),
    "mb": (2792.160, 0.000, 246.960, 3024.000),
}
EDGE_M = 20.0                     # core-to-block-edge margin
SRAM_W = 46.643                   # sram2p macro width (LEF)
SRAM_H = {"144": 158.976, "80": 97.536}
COL = ["144"] * 6 + ["80"] * 2    # one column, top to bottom
N_COLS = 8                        # per side
PAIR_CH, GAP = 12.0, 3.0          # channel between a facing pair, gap between pairs
BITS = {"op": 6280, "co": 5117, "mao": 2423, "cmb": 2423, "ap": 1950, "map": 1434, "amb": 1434, "ac": 106}

# ---- drawing
VW, VH = 960, 836
S = 650.0 / FP_H                  # px per micron
X0 = (VW - FP_W * S) / 2
Y0 = 86.0
PART = {  # colour, name, contents lines
    "ma": ("#d97706", "MA", ["CMAC"]),
    "mb": ("#d97706", "MB", ["CMAC", "mirrored"]),
    "c":  ("#2563a8", "C",  ["CDMA · CSC · CBUF", "logic between two mirrored SRAM banks"]),
    "o":  ("#7b4bb7", "O",  ["CDP · PDP · BDMA · RUBIK", "MCIF · CVIF · CSB · GLB"]),
    "p":  ("#c2185b", "P",  ["SDP"]),
    "a":  ("#2e8b57", "A",  ["CACC"]),
}
INK, MUTED, LINK = "#161616", "#525252", "#da1e28"
SANS = "IBM Plex Sans, Helvetica Neue, Arial, sans-serif"
MONO = "IBM Plex Mono, SFMono-Regular, Consolas, monospace"


def X(x):
    return X0 + x * S


def Y(y):
    return Y0 + (FP_H - y) * S


def f(v):
    return f"{v:.1f}"


out = []
a = out.append
a(f'<svg viewBox="0 0 {VW} {VH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="fp12T fp12D">')
a('<title id="fp12T">Planned NV_nvdla floorplan, to scale and mirror-symmetric about the vertical axis</title>')
a('<desc id="fp12D">MAC partitions MA and MB are full-height strips on the outer edges, MB the mirror image of MA. '
  'In the centre, C runs across the top with its 128 SRAM macros in two mirrored banks of eight identical columns, '
  'O sits below it, and P and A sit side by side along the bottom. Ribbons mark the shared edges and the number of '
  'signals crossing each one; the only link without a shared edge is A to C, 106 bits, routed through the side channel.</desc>')

# defs: std-cell row texture per partition colour, SRAM bitcell texture
a('<defs>')
for k, (c, _, _) in PART.items():
    if k == "mb":
        continue
    a(f'<pattern id="fpRow{k}" width="8" height="3.2" patternUnits="userSpaceOnUse">'
      f'<rect width="8" height="3.2" fill="{c}" fill-opacity=".07"/>'
      f'<rect width="8" height="1.1" fill="{c}" fill-opacity=".13"/></pattern>')
a('<pattern id="fpBit" width="2.4" height="2.4" patternUnits="userSpaceOnUse">'
  '<rect width="2.4" height="2.4" fill="#ffffff"/><rect width="1.2" height="1.2" fill="#2563a8" fill-opacity=".16"/></pattern>')
a('<marker id="fpArr" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
  f'<path d="M0 0 L8 4 L0 8 z" fill="{MUTED}"/></marker>')
a('</defs>')
a('<style>.fpb .fpt{transition:fill-opacity .2s}.fpb:hover .fpt{fill-opacity:.16}</style>')
a(f'<g font-family="{SANS}" fill="{INK}">')

# die: background + seal-ring style double outline
dx0, dy0, dx1, dy1 = X(0) - 10, Y(FP_H) - 10, X(FP_W) + 10, Y(0) + 10
a(f'<rect x="{f(dx0)}" y="{f(dy0)}" width="{f(dx1-dx0)}" height="{f(dy1-dy0)}" rx="3" fill="#f6f6f6" stroke="{INK}" stroke-width="1.2"/>')
a(f'<rect x="{f(dx0+4)}" y="{f(dy0+4)}" width="{f(dx1-dx0-8)}" height="{f(dy1-dy0-8)}" rx="2" fill="none" stroke="{INK}" stroke-opacity=".25" stroke-width=".8"/>')

# partitions
for k in ["ma", "mb", "c", "o", "p", "a"]:
    x, y, w, h = BLK[k]
    c, name, lines = PART[k]
    pid = "ma" if k == "mb" else k
    a(f'<g class="fpb">')
    a(f'<rect x="{f(X(x))}" y="{f(Y(y+h))}" width="{f(w*S)}" height="{f(h*S)}" fill="url(#fpRow{pid})"/>')
    a(f'<rect class="fpt" x="{f(X(x))}" y="{f(Y(y+h))}" width="{f(w*S)}" height="{f(h*S)}" fill="{c}" fill-opacity="0" stroke="{c}" stroke-width="1.6"/>')
    a('</g>')

# orientation notch: top-left of MA, mirrored to top-right of MB
for k, flip in (("ma", False), ("mb", True)):
    x, y, w, h = BLK[k]
    c = PART[k][0]
    if not flip:
        x0, y0 = X(x), Y(y + h)
        a(f'<path d="M{f(x0)} {f(y0)} h11 L{f(x0)} {f(y0+11)} z" fill="{c}"/>')
    else:
        x0, y0 = X(x + w), Y(y + h)
        a(f'<path d="M{f(x0)} {f(y0)} h-11 L{f(x0)} {f(y0+11)} z" fill="{c}"/>')

# SRAM banks in C (same placement rule as the PnR script: pairs face a shared channel, right bank = mirror)
cx, cy, cw, ch = BLK["c"]
cx0, cx1, cy1 = cx + EDGE_M, cx + cw - EDGE_M, cy + ch - EDGE_M
xm = cx0 + 3.0
for i in range(N_COLS):
    pins_right = (i % 2 == 0)
    for side in ("L", "R"):
        xx = xm if side == "L" else cx0 + cx1 - xm - SRAM_W
        pr = pins_right if side == "L" else not pins_right
        ytop = cy1 - 3.0
        for m in COL:
            hh = SRAM_H[m]
            ybot = ytop - hh
            a(f'<rect x="{f(X(xx))}" y="{f(Y(ytop))}" width="{f(SRAM_W*S)}" height="{f(hh*S)}" fill="url(#fpBit)" stroke="{INK}" stroke-opacity=".55" stroke-width=".5"/>')
            px = X(xx + SRAM_W) if pr else X(xx)
            a(f'<line x1="{f(px)}" y1="{f(Y(ytop)+.4)}" x2="{f(px)}" y2="{f(Y(ybot)-.4)}" stroke="#2563a8" stroke-width="1.8"/>')
            ytop = ybot - 6.0 - GAP
    xm += SRAM_W + (6.0 + GAP if i % 2 else PAIR_CH)

# mirror axis
xc = X(FP_W / 2)
a(f'<line x1="{f(xc)}" y1="{f(dy0-18)}" x2="{f(xc)}" y2="{f(dy1+8)}" stroke="{INK}" stroke-opacity=".28" stroke-dasharray="5 4"/>')
a(f'<text x="{f(xc)}" y="{f(dy0-24)}" text-anchor="middle" font-family="{MONO}" font-size="10" fill="{MUTED}" letter-spacing=".06em">MIRROR AXIS</text>')

# chip-level ports: from O's left/right edges up both side channels to the die top edge
for k, sgn in (("ma", 1), ("mb", -1)):
    x, y, w, h = BLK[k]
    chx = X(x + w + 104.0) if sgn == 1 else X(x - 104.0)   # channel side next to C, clear of the ribbons
    ox, oy, ow, oh = BLK["o"]
    a(f'<path d="M{f(chx)} {f(Y(oy+oh/2))} V{f(dy0-6)}" fill="none" stroke="{MUTED}" stroke-width="1.1" stroke-dasharray="2 3" marker-end="url(#fpArr)"/>')
    a(f'<text x="{f(chx)}" y="{f(dy0-24)}" text-anchor="middle" font-family="{MONO}" font-size="10" fill="{MUTED}" letter-spacing=".06em">CHIP PORTS</text>')


def ribbon(x1, y1, x2, y2, bits, label, lx, ly):
    wpx = 2.5 + 7.5 * bits / BITS["op"]
    a(f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{LINK}" stroke-opacity=".22" stroke-width="{f(wpx+5)}" stroke-linecap="round"/>')
    a(f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" stroke="{LINK}" stroke-width="{f(wpx*.45)}" stroke-linecap="round"/>')
    tw = 7.0 * len(label) + 12
    a(f'<rect x="{f(lx-tw/2)}" y="{f(ly-9)}" width="{f(tw)}" height="18" rx="9" fill="#ffffff" stroke="{LINK}" stroke-width="1"/>')
    a(f'<text x="{f(lx)}" y="{f(ly+3.8)}" text-anchor="middle" font-family="{MONO}" font-size="10.5" font-weight="600" fill="{LINK}">{label}</text>')


p, A_, o, c = BLK["p"], BLK["a"], BLK["o"], BLK["c"]
ma, mb = BLK["ma"], BLK["mb"]
y_op = (p[1] + p[3] + o[1]) / 2
y_co = (o[1] + o[3] + c[1]) / 2
x_pa = (p[0] + p[2] + A_[0]) / 2
x_l = (ma[0] + ma[2] + p[0]) / 2
x_r = (A_[0] + A_[2] + mb[0]) / 2
inset = 30.0
ribbon(X(p[0] + inset), Y(y_op), X(p[0] + p[2] - inset), Y(y_op), BITS["op"], "6,280", X(p[0] + p[2] / 2), Y(y_op))
ribbon(X(o[0] + inset), Y(y_co), X(o[0] + o[2] - inset), Y(y_co), BITS["co"], "5,117", X(o[0] + o[2] / 2), Y(y_co))
ribbon(X(x_pa), Y(p[3] - inset), X(x_pa), Y(inset), BITS["ap"], "1,950", X(x_pa), Y(p[3] / 2))
ribbon(X(x_l), Y(o[1] + o[3] - inset), X(x_l), Y(o[1] + inset), BITS["mao"], "2,423", X(x_l), Y(o[1] + o[3] / 2))
ribbon(X(x_l), Y(p[3] - inset), X(x_l), Y(inset), BITS["map"], "1,434", X(x_l), Y(p[3] / 2))
ribbon(X(x_r), Y(c[1] + c[3] - inset), X(x_r), Y(c[1] + inset), BITS["cmb"], "2,423", X(x_r), Y(c[1] + c[3] / 2))
ribbon(X(x_r), Y(A_[3] - inset), X(x_r), Y(inset), BITS["amb"], "1,434", X(x_r), Y(A_[3] / 2))

# A-C: no shared edge; it goes round O through the right side channel
xr2 = mb[0] - 16.0
a(f'<path d="M{f(X(A_[0]+A_[2]-160))} {f(Y(A_[3]-140))} H{f(X(xr2))} V{f(Y(c[1]+200))} H{f(X(c[0]+c[2]-600))}" '
  f'fill="none" stroke="{LINK}" stroke-width="1.3" stroke-dasharray="1.5 3" stroke-linecap="round" stroke-linejoin="round"/>')
a(f'<circle cx="{f(X(A_[0]+A_[2]-160))}" cy="{f(Y(A_[3]-140))}" r="2.4" fill="{LINK}"/>')
a(f'<circle cx="{f(X(c[0]+c[2]-600))}" cy="{f(Y(c[1]+200))}" r="2.4" fill="{LINK}"/>')
a(f'<text x="{f(X(A_[0]+A_[2]-160)-6)}" y="{f(Y(A_[3]-140)+4)}" text-anchor="end" font-family="{MONO}" font-size="10" fill="{LINK}">A–C 106</text>')

# labels (drawn last so they sit on top)
def label(k, cx_, cy_, big=26):
    c, name, lines = PART[k]
    a(f'<text x="{f(cx_)}" y="{f(cy_)}" text-anchor="middle" font-size="{big}" font-weight="600" fill="{c}" letter-spacing="-.01em" stroke="#ffffff" stroke-width="5" stroke-linejoin="round" paint-order="stroke">{name}</text>')
    for i, t in enumerate(lines):
        a(f'<text x="{f(cx_)}" y="{f(cy_ + 17 + 14*i)}" text-anchor="middle" font-family="{MONO}" font-size="10" fill="{MUTED}" stroke="#ffffff" stroke-width="4" stroke-linejoin="round" paint-order="stroke">{t}</text>')


label("ma", X(ma[0] + ma[2] / 2), Y(FP_H / 2) - 6, 20)
label("mb", X(mb[0] + mb[2] / 2), Y(FP_H / 2) - 6, 20)
label("c", X(c[0] + c[2] / 2), Y(c[1] + c[3] / 2) - 4)
label("o", X(o[0] + o[2] / 2), Y(o[1] + o[3] / 2) - 6)
label("p", X(p[0] + p[2] / 2), Y(p[3] / 2) + 30)
label("a", X(A_[0] + A_[2] / 2), Y(A_[3] / 2) + 30)

# legend
ly = dy1 + 40
lx = X0 - 10
a(f'<g font-family="{MONO}" font-size="10.5" fill="{MUTED}">')
a(f'<line x1="{f(lx)}" y1="{f(ly)}" x2="{f(lx+24)}" y2="{f(ly)}" stroke="{LINK}" stroke-opacity=".22" stroke-width="10" stroke-linecap="round"/>')
a(f'<line x1="{f(lx)}" y1="{f(ly)}" x2="{f(lx+24)}" y2="{f(ly)}" stroke="{LINK}" stroke-width="2" stroke-linecap="round"/>')
a(f'<text x="{f(lx+34)}" y="{f(ly+3.5)}">shared edge · signals crossing</text>')
lx2 = lx + 250
a(f'<rect x="{f(lx2)}" y="{f(ly-8)}" width="10" height="16" fill="url(#fpBit)" stroke="{INK}" stroke-opacity=".55" stroke-width=".5"/>')
a(f'<line x1="{f(lx2+10)}" y1="{f(ly-8)}" x2="{f(lx2+10)}" y2="{f(ly+8)}" stroke="#2563a8" stroke-width="1.8"/>')
a(f'<text x="{f(lx2+20)}" y="{f(ly+3.5)}">SRAM macro · bold edge = pins</text>')
lx3 = lx2 + 240
a(f'<path d="M{f(lx3)} {f(ly-8)} h11 L{f(lx3)} {f(ly+3)} z" fill="{PART["ma"][0]}"/>')
a(f'<rect x="{f(lx3)}" y="{f(ly-8)}" width="16" height="16" fill="none" stroke="{PART["ma"][0]}" stroke-width="1.2"/>')
a(f'<text x="{f(lx3+26)}" y="{f(ly+3.5)}">orientation · MB = MA mirrored</text>')
a('</g>')

a('</g></svg>')
svg = "".join(out)
if len(sys.argv) > 1:
    open(sys.argv[1], "w").write(svg)
else:
    sys.stdout.write(svg)
