"""Apply the shared V2 header, footer, font link and stylesheet version to every page.
Usage: python3 tools/apply_chrome.py   (run from the repository root; idempotent)
"""
import re, pathlib

CSS_V = "20261125"
FONTS = ("https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..700"
         "&family=IBM+Plex+Mono:wght@400;500&display=swap")
NAV = [("Work", "index.html#work", "work"), ("Research", "research.html", "research"),
       ("About", "about.html", "about")]

def section_of(path):
    name = path.name
    if path.parent.name == "projects":
        return "work"
    return {"research.html": "research", "about.html": "about"}.get(name, "home")

def header(pre, cur):
    items = "\n".join(
        f'        <li><a href="{pre}{href}"{" aria-current=\"page\"" if key == cur else ""}>{label}</a></li>'
        for label, href, key in NAV)
    return f'''<header class="site-header">
  <div class="wrap">
    <a class="logo" href="{pre}index.html">
      <strong>Khoi Nguyen</strong>
      <span>Digital IC &middot; ASIC physical design</span>
    </a>
    <nav aria-label="Primary">
      <ul class="nav-list" id="nav-list">
{items}
        <li><a class="nav-cv" href="{pre}assets/khoi-nguyen-cv.pdf">R&eacute;sum&eacute;</a></li>
      </ul>
    </nav>
    <button class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="nav-list">
      <span class="nav-toggle-bars"><span></span><span></span><span></span></span>
    </button>
  </div>
</header>'''

def footer(pre):
    return f'''<footer class="site-footer" id="contact">
  <div class="wrap footer-grid">
    <div class="footer-lead">
      <h2>Get in touch</h2>
      <p>Open to digital IC, ASIC and physical-design internship and co-op conversations.</p>
    </div>
    <ul class="footer-links">
      <li><a href="mailto:anhkhoi_2005@icloud.com"><span>Email</span><span>anhkhoi_2005@icloud.com</span></a></li>
      <li><a href="https://www.linkedin.com/in/anhkhoilenguyen/" target="_blank" rel="noopener"><span>LinkedIn</span><span>anhkhoilenguyen</span></a></li>
      <li><a href="https://github.com/AKLN0401" target="_blank" rel="noopener"><span>GitHub</span><span>AKLN0401</span></a></li>
      <li><a href="{pre}assets/khoi-nguyen-cv.pdf"><span>R&eacute;sum&eacute;</span><span>PDF</span></a></li>
    </ul>
    <p class="footer-copy"><button type="button" class="copy-email" data-email="anhkhoi_2005@icloud.com">Copy email address</button> <span class="copy-status" role="status" aria-live="polite"></span></p>
    <div class="footer-base">
      <span>&copy; <span data-year>2026</span> Khoi Nguyen</span>
      <span>Winnipeg, Manitoba</span>
    </div>
  </div>
</footer>'''

root = pathlib.Path(__file__).resolve().parent.parent
for path in sorted(list(root.glob("*.html")) + list(root.glob("projects/*.html"))):
    src = path.read_text(encoding="utf-8")
    if 'http-equiv="refresh"' in src:
        continue
    pre = "../" if path.parent.name == "projects" else ""
    cur = section_of(path)
    h = header(pre, cur)
    if re.search(r'<header class="site-header">.*?</header>', src, flags=re.S):
        src = re.sub(r'<header class="site-header">.*?</header>', lambda m: h, src, count=1, flags=re.S)
    else:  # page without a header: insert it before <main>
        src = src.replace("<main", h + "\n\n<main", 1)
    src = re.sub(r'<footer class="site-footer".*?</footer>', lambda m: footer(pre), src, count=1, flags=re.S)
    src = re.sub(r'https://fonts\.googleapis\.com/css2\?[^"]*', FONTS, src)
    src = re.sub(r'style\.css\?v=[^"]*', f"style.css?v={CSS_V}", src)
    src = src.replace('<meta name="theme-color" content="#f4f2ed" />', '<meta name="theme-color" content="#f4f4f2" />')
    path.write_text(src, encoding="utf-8")
    print("chrome:", path.relative_to(root))
