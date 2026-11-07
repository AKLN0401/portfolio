"""Panels b and c (true-scale cross-sections of the same boxes as panel a) and the combined figure.

usage: python3 panels.py <panel_a.png> <out.png>"""
import json, sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
from matplotlib import font_manager as fm
import matplotlib.image as mpimg

import os
D = os.path.dirname(os.path.abspath(__file__)); A = sys.argv[1]; OUT = sys.argv[2]
for f in fm.findSystemFonts():
    if 'Inter' in f: fm.fontManager.addfont(f)
plt.rcParams.update({'font.family': 'Inter', 'font.size': 26})

boxes = json.load(open(f'{D}/boxes.json'))
COL = {'BPR': '#b8622e', 'VBPR': '#e8954f', 'VBPR2': '#e8954f', 'VSD12': '#e8954f', 'VSD': '#e8954f', 'VG2': '#e8954f',
       'ACT': '#d2d5db', 'ACT2': '#d2d5db', 'GATE': '#7b80b0', 'GATE2': '#7b80b0', 'VG12': '#5d6296',
       'SDCON': '#f4a08f', 'SDCON2': '#8fb8f5', 'M0': '#f0a35e'}
# draw order: big/enclosing first so the channel (inside the gate) stays visible
ORDER = ['BPR', 'VBPR', 'VBPR2', 'VSD12', 'VSD', 'GATE', 'GATE2', 'ACT', 'ACT2', 'SDCON', 'SDCON2', 'VG12', 'VG2', 'M0']

def section(ax, axis, cut, beyond, lim):
    """axis='y': plane y=cut, horizontal = x. axis='x': plane x=cut, horizontal = y. beyond(b) selects shapes behind the plane."""
    h0, h1 = ('x0', 'x1') if axis == 'y' else ('y0', 'y1')
    c0, c1 = ('y0', 'y1') if axis == 'y' else ('x0', 'x1')
    # dielectric slabs from GTA5cfet.itf
    ax.add_patch(Rectangle((lim[0], 0), lim[1] - lim[0], 118, fc='#dfe3ea', ec='none', zorder=0))
    ax.add_patch(Rectangle((lim[0], 206), lim[1] - lim[0], 30, fc='#b8eef3', ec='none', zorder=0))
    for k, L in enumerate(ORDER):
        for b in boxes:
            if b['L'] != L: continue
            cutb = b[c0] < cut < b[c1]
            if not cutb and not beyond(b): continue
            x0, x1 = max(b[h0], lim[0]), min(b[h1], lim[1])
            if x1 <= x0: continue
            ax.add_patch(Rectangle((x0, b['z0']), x1 - x0, b['z1'] - b['z0'], fc=COL[L],
                                   ec='#3a3d48' if cutb else 'none', lw=0.8, alpha=1 if cutb else 0.32,
                                   zorder=(10 if cutb else 2) + k * 0.1))
    ax.set_xlim(*lim); ax.set_ylim(0, 352); ax.set_aspect('equal')
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
    ax.set_ylabel('z (nm)')
    ax.set_yticks(range(0, 351, 50))

fig = plt.figure(figsize=(36, 20), dpi=100)
axA = fig.add_axes([0.0, 0.0, 0.667, 1.0]); axA.imshow(mpimg.imread(A)); axA.axis('off')
axB = fig.add_axes([0.685, 0.10, 0.17, 0.80])
axC = fig.add_axes([0.875, 0.10, 0.12, 0.80])
# b: cut along the channel at the ACT/ACT2 centre line (y = 36 nm), looking +y
section(axB, 'y', 36.0, lambda b: b['y0'] >= 36.0, (-22.5, 100.5))
axB.set_xlabel('x (nm)'); axB.set_xticks([0, 39, 78])
# c: cut across the input gate at its centre (x = 39 nm), looking -x
section(axC, 'x', 39.0, lambda b: b['x1'] <= 39.0, (-12, 84))
axC.set_xlabel('y (nm)'); axC.set_xticks([0, 36, 72]); axC.set_ylabel('')
for ax, t in ((axA, 'a'), (axB, 'b'), (axC, 'c')):
    ax.text(0.0 if ax is not axA else 0.03, 1.02 if ax is not axA else 0.95, t, transform=ax.transAxes,
            fontsize=34, fontweight='bold', va='bottom')
fig.savefig(OUT, facecolor='white')
# white margin on the right so panel c does not touch the edge
from PIL import Image
im = Image.open(OUT).convert('RGB'); out = Image.new('RGB', (im.width + 160, im.height), 'white'); out.paste(im, (0, 0)); out.save(OUT)
print('ok', OUT)
