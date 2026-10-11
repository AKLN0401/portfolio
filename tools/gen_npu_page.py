"""Build projects/npu-tapeout.html from npu1x1/docs/overview.html.

- overview CSS scoped under .npu-doc (so it can't restyle the site header/footer)
- inline WebP data URIs -> assets/npu/*.webp, 3D model + viewer -> assets/npu/npu-3d.js
- OG image assets/og/npu.png (1200x630) from the GDS render
Usage: python tools/gen_npu_page.py <npu repo>/docs/overview.html .   (needs Pillow; run from the portfolio root)
"""
import base64, io, json, os, re, sys
from PIL import Image

src, port = sys.argv[1:3]
html = open(src).read()

# ---------- CSS: scope every rule under .npu-doc ----------
css = re.search(r"<style>(.*?)</style>", html, re.S).group(1)
css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)

def scope_sel(sel):
    sel = sel.strip()
    if sel in (":root", "body", "main"):
        return ".npu-doc"
    if sel == "*":
        return ".npu-doc *"
    return ".npu-doc " + sel

def scope_block(text):
    out, i = [], 0
    while i < len(text):
        j = text.find("{", i)
        if j < 0:
            break
        head = text[i:j].strip()
        if head.startswith("@media"):
            depth, k = 1, j + 1
            while depth:
                depth += {"{": 1, "}": -1}.get(text[k], 0); k += 1
            out.append(f"{head} {{\n{scope_block(text[j + 1:k - 1])}}}\n")
            i = k
            continue
        k = text.index("}", j)
        body = text[j + 1:k].strip()
        if head == "body":       # page body belongs to the site; keep only the text settings
            body = "font-size: 16px; line-height: 1.6; color: var(--ink);"
        if head == "main":       # layout comes from .wrap
            i = k + 1
            continue
        sels = [s for s in head.split(",") if s.strip() not in ("h1",)]
        if sels:
            out.append(", ".join(scope_sel(s) for s in sels) + " { " + body + " }\n")
        i = k + 1
    return "".join(out)

scoped = scope_block(css)
scoped += (".npu-doc h2[id] { scroll-margin-top: 72px; }\n"
           ".npu-doc > .facts { margin-top: 0; }\n"
           ".npu-doc nav { margin-top: 28px; }\n")

# ---------- body: drop the page's own label / h1 / subtitle ----------
main = re.search(r"<main>(.*?)</main>", html, re.S).group(1)
main = re.sub(r'\s*(?:<p class="label">.*?</p>\s*)?<h1>.*?</h1>\s*<p class="sub">.*?</p>', "\n", main, count=1, flags=re.S)
assert "<h1" not in main

# ---------- assets ----------
script = re.search(r"<!-- ASSETS:BEGIN.*?-->\s*<script>(.*?)</script>\s*<!-- ASSETS:END -->", html, re.S).group(1)
m = re.match(r"\s*const ASSETS = (\{.*?\});\n", script, re.S)
assets = json.loads(m.group(1))
adir = os.path.join(port, "assets", "npu"); os.makedirs(adir, exist_ok=True)
urls = {}
for k, uri in assets.items():
    data = base64.b64decode(uri.split(",", 1)[1])
    open(os.path.join(adir, f"{k}.webp"), "wb").write(data)
    urls[k] = f"../assets/npu/{k}.webp"
rest = script[m.end():]
open(os.path.join(adir, "npu-3d.js"), "w").write(
    "// Layout images and interactive 3D model of the GDS (WebGL2, no libraries)\n"
    f"const ASSETS = {json.dumps(urls)};\n{rest.strip()}\n")

# OG image 1200x630: centre crop of the full-tile render
im = Image.open(io.BytesIO(base64.b64decode(assets["gds"].split(",", 1)[1]))).convert("RGB")
w, h = im.size; ch = round(w * 630 / 1200)
top = (h - ch) // 2
im.crop((0, top, w, top + ch)).resize((1200, 630), Image.LANCZOS).save(os.path.join(port, "assets", "og", "npu.png"), optimize=True)

# ---------- page ----------
TITLE = "One-Tile int4 NPU for Tiny Tapeout — Khoi Nguyen"
DESC = ("A 2×2 int4 MAC-array accelerator with per-row clock gating and full scan, taken from RTL to a "
        "signed-off SkyWater SKY130 layout in one Tiny Tapeout tile.")
URL = "https://akln0401.github.io/portfolio/projects/npu-tapeout.html"
OG = "https://akln0401.github.io/portfolio/assets/og/npu.png?v=20261011"
REPO = "https://github.com/AKLN0401/npu-2x2-int4-16bit"

tmpl = open(os.path.join(port, "projects", "riscv.html")).read()
head_end = tmpl.index("</head>")
head = tmpl[:head_end]
head = head.replace("RISC-V Fault Detection — Khoi Nguyen", TITLE)
head = re.sub(r'(name="description" content=")[^"]*', lambda g: g.group(1) + DESC, head)
head = re.sub(r'((?:og|twitter):description" content=")[^"]*', lambda g: g.group(1) + DESC, head)
head = head.replace("https://akln0401.github.io/portfolio/projects/riscv.html", URL)
head = head.replace("https://akln0401.github.io/portfolio/assets/og/riscv.png?v=20261004", OG)
head = re.sub(r'(og:image:alt" content=")[^"]*', lambda g: g.group(1) + "Layout of the one-tile int4 NPU in SkyWater SKY130", head)
assert "riscv" not in head.lower(), "template head still mentions riscv"
header = tmpl[tmpl.index("<body>"):tmpl.index("<main")]
footer = tmpl[tmpl.index("<footer"):tmpl.index("</body>")]

page = f"""{head}<style>
/* chip-page styles, scoped to the case-study body */
{scoped}</style>
</head>
{header}<main id="main">
  <section class="page-hero">
    <div class="wrap">
      <a class="breadcrumb" href="../index.html#projects">&larr; All projects</a>
      <h1>One-Tile int4 NPU for Tiny Tapeout</h1>
      <p class="dek">A 2×2 int4 multiply-accumulate array with 16-bit accumulators, one clock gate per row and a 96-flop scan chain, taken from RTL to a signed-off layout in a single 161&nbsp;×&nbsp;112&nbsp;µm Tiny Tapeout tile. Built for the TTSKY26d shuttle; the demo board's microcontroller drives it over the pins.</p>
      <p style="margin-top:24px;"><a class="btn btn-primary" href="{REPO}">Source on GitHub</a> <a class="btn" href="#layout">3D layout</a></p>
    </div>
  </section>

  <section class="section" style="border-top:none; padding-top:0;">
    <div class="wrap">
      <div class="npu-doc">
{main.strip()}
      </div>
    </div>
  </section>
</main>

{footer}<script src="../assets/npu/npu-3d.js"></script>
</body>
</html>
"""
open(os.path.join(port, "projects", "npu-tapeout.html"), "w").write(page)
print("page", len(page), "bytes; assets:", sorted(os.listdir(adir)))

# ---------- portfolio wording ----------
p = os.path.join(port, "projects", "npu-tapeout.html"); s = open(p).read()
for old, new in [
    ("<dt>Goals kept</dt><dd>AI accelerator, one ICG per row, every functional flop on a scan chain to pins</dd>",
     "<dt>Features</dt><dd>AI accelerator, one clock gate (ICG) per row, every functional flop on a scan chain to the pins</dd>"),
    ("Next: GitHub <code>gds</code> action and submission (§4)",
     "Source on GitHub; next: Tiny Tapeout CI build and submission to TTSKY26d (§4)"),
    ("<li>Git repo ready; push to GitHub, <code>gds</code> action + precheck green</li>",
     "<li>Public GitHub repo; Tiny Tapeout <code>gds</code> build, precheck and gate-level test in CI</li>"),
]:
    s = s.replace(old, new)   # no-op once the source page has the wording
open(p, "w").write(s)

# the OG image is quantized to 256 colours to stay < 1 MB
og = os.path.join(port, "assets", "og", "npu.png")
Image.open(og).convert("RGB").quantize(256, method=Image.Quantize.MEDIANCUT).save(og, optimize=True)
