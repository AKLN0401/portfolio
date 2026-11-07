"""Export the MATRIX-A5 inv_x1 cell as 3D boxes (nm) for render.html and panels.py.

usage: python3 export_boxes.py <MATRIX_A5_CFET_base dir>   -> boxes.json next to this script

x/y: gtA5_cfet_11_inv_x1_svt in gds/gtA5_cfet_stdcells.gds.
z:   starrc/GTA5cfet.itf, layers stacked from bottom_diel at z = 0.
     Via heights are not in the ITF; each via spans the two layers it connects (LVS connect rules).
Nanosheets: device models (ngaa = 3, tgaa = 6 nm, tsus = 10 nm), centred on the ITF ACT/ACT2 slab.
"""
import json, os, re, sys
import gdstk

B = sys.argv[1]
cell = [c for c in gdstk.read_gds(os.path.join(B, 'gds/gtA5_cfet_stdcells.gds')).cells
        if c.name == 'gtA5_cfet_11_inv_x1_svt'][0]
Z = {8: ('BPR', 5, 37), 3: ('GATE', 118, 183), 2: ('ACT', 128, 163), 10: ('SDCON', 130, 183),
     303: ('GATE2', 236, 301), 302: ('ACT2', 246, 281), 310: ('SDCON2', 248, 301), 20: ('M0', 324, 348),
     9: ('VBPR', 37, 130), 309: ('VBPR2', 37, 248), 324: ('VSD12', 183, 248), 352: ('VG12', 183, 236),
     312: ('VG2', 301, 324), 11: ('VSD', 183, 324)}

model = open(os.path.join(B, 'models/GT_A5_TT.inc')).read()
par = lambda k: float(re.search(rf'\b{k}\s*=\s*([0-9.e+-]+)', model).group(1))
ngaa, tgaa, tsus = int(par('ngaa')), par('tgaa') * 1e9, par('tsus') * 1e9

boxes = []
for p in cell.polygons:
    if p.layer not in Z: continue
    (x0, y0), (x1, y1) = p.bounding_box()
    name, z0, z1 = Z[p.layer]
    b = dict(L=name, x0=round(x0 * 1000, 2), y0=round(y0 * 1000, 2), x1=round(x1 * 1000, 2), y1=round(y1 * 1000, 2))
    if name in ('ACT', 'ACT2'):
        stack = ngaa * tgaa + (ngaa - 1) * tsus
        z = (z0 + z1) / 2 - stack / 2
        for k in range(ngaa):
            boxes.append(dict(b, z0=z + k * (tgaa + tsus), z1=z + k * (tgaa + tsus) + tgaa))
    else:
        boxes.append(dict(b, z0=z0, z1=z1))
boxes.sort(key=lambda b: (b['L'], -b['z1']))
json.dump(boxes, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'boxes.json'), 'w'), indent=0)
print(len(boxes), 'boxes')
