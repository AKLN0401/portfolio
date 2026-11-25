# Khoi Nguyen — Engineering Portfolio

Source for **[akln0401.github.io/portfolio](https://akln0401.github.io/portfolio/)**: digital IC / ASIC design (RTL-to-GDSII, synthesis, DFT, physical design, timing signoff) and cleanroom CMOS/MEMS fabrication.

## Projects

| Project | Summary | Code |
|---|---|---|
| [NVIDIA NVDLA 12 nm](https://akln0401.github.io/portfolio/projects/nvdla.html) | Open-source deep-learning accelerator in a 12 nm FinFET flow at 1.1 GHz: multi-Vt, clock gating, full scan, hard-macro partitions in a mirror-symmetric floorplan, foundry DRC/LVS signoff | — |
| [RISC-V + INT8 Systolic Array on CFET](https://akln0401.github.io/portfolio/projects/gaa-sysarray.html) | lowRISC Ibex core with a memory-mapped 8×8 INT8 systolic array, RTL to GDS on the MATRIX-A5 CFET PDK with backside power delivery | [GAA_SysArray_CFET](https://github.com/AKLN0401/GAA_SysArray_CFET) |
| [One-Tile int4 NPU for Tiny Tapeout](https://akln0401.github.io/portfolio/projects/npu-tapeout.html) | 2×2 int4 MAC array with per-row clock gating and full scan, signed off in one SKY130 Tiny Tapeout tile | [npu-2x2-int4-16bit](https://github.com/AKLN0401/npu-2x2-int4-16bit) |
| [Printed Flexible MEMS Switch](https://akln0401.github.io/portfolio/projects/mems-switch.html) | Lorentz-force MEMS switch on polyimide with electrostatic hold-down (EUROSENSORS 2026) | — |
| [Tap-to-Click Glove](https://akln0401.github.io/portfolio/projects/glove.html) | Capstone: glove mouse using silver/carbon sensors printed on stretchable TPU | — |
| [Delay-fault detection, 12 nm RISC-V](https://akln0401.github.io/portfolio/research.html#delay-fault) | Variable D-Q delay flip-flops for transition-fault testing on an RV32IM test chip (GF 12LP+), with the CMOS Design and Reliability Group, Waterloo. Replaces the former `riscv.html` and `dft.html`, which now redirect here | — |

## Repository layout

| Path | Contents |
|---|---|
| `index.html` | Home: portrait and introduction, then the project cards |
| `about.html` | Story, experience, publications, education, certifications, skills |
| `research.html` | Cleanroom fabrication and Waterloo delay-fault research |
| `projects/` | One case-study page per project |
| `css/style.css` | The single stylesheet (Archivo + IBM Plex Mono, 12-column grid); sections are numbered at the top of the file |
| `js/` | Mobile menu and footer year (static site, no build step) |
| `assets/` | Images, CV, 3D model data |
| `assets/cards/` | Homepage card images rendered from the site's own SVG figures |
| `tools/` | Generators for figures and pages; `apply_chrome.py` rewrites the shared header, footer and font link on every page |

## Running locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Deployed with GitHub Pages from `main`.

## Contact

[Email](mailto:anhkhoi_2005@icloud.com) · [LinkedIn](https://www.linkedin.com/in/anhkhoilenguyen/) · [CV](https://akln0401.github.io/portfolio/assets/khoi-nguyen-cv.pdf)
