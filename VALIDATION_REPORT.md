# Validation Report — InnoClique Precision Upgrade (v28)

## Scope actually validated
This delivery applies a focused fix to the active comparison path. It does not claim that the entire master-prompt engineering scope is complete.

## N–O calibration arithmetic
- N = (1202.88, 252.76) PDF points
- O = (1312.26, 252.76) PDF points
- Euclidean distance = 109.38 PDF points
- Known physical distance = 7720 mm
- 7720 / 109.38 = 70.5796306454562 mm per PDF point
- Existing stored calibration constant `70.579630645456` is retained.
- `test_calibration.js` verifies the reference-point distance, known distance and resulting scale.
- The supplied ARC-1002 PDF is a one-page PDF (2384 × 1684 PDF user-space units, rotation 0) with title `DSP-DCP-DWG-ARC-1002`. The calibration's physical endpoints have not been independently surveyed against the DWG, so the arithmetic is verified but the real-world reference distance is not independently certified.

## Root cause corrected
The PDF calibration routine set `scaleLocked: true` for the N–O calibration, and the comparison run passed that flag into geometry metadata. The production `core()` function then forwarded only `scaleKnown` to `similarityRegister()`. As a result, the active solver did not receive the lock and could still change scale. The v28 fix forwards `scaleLocked` through a shared `registrationOptions()` helper. The same fix is in the static `index.html` and the embedded HTML generator in `innoclique_site.py`.

## Automated tests
| Test | Result |
|---|---|
| `node test_alignment_transform.js` | PASS — identity, translation, 90-degree rotation and thin-line down-scale |
| `node test_registration.js` | PASS — synthetic registration, direct scale lock, and production core option forwarding |
| `node test_layer_selection.js` | PASS — XREF-aware wall/door/structure selection and annotation/equipment exclusion |
| `node test_calibration.js` | PASS — N–O distance and calibration arithmetic |
| `python -m py_compile innoclique_site.py` | PASS — exit code 0 |

## Runtime smoke test
- Started the application with `python innoclique_site.py`.
- `GET /` returned HTTP 200 with `text/html`.
- `GET /api/ai/status` returned HTTP 200.
- This confirms server startup and basic route response only; it is not a full browser/UI regression.

## Supplied architectural drawing package
- Located matching ARC-1002 DWG and PDF files in the supplied `1-Architectural.zip`.
- Extracted and inspected the ARC-1002 PDF metadata and text.
- No `dwg2dxf` or ODA File Converter executable is installed in this execution environment. The browser-side bundled DWG WASM reader was not driven through a browser here.
- Therefore, an actual end-to-end ARC-1002 CAD-versus-PDF overlay was **not** executed.

## Accuracy
No independently labelled ground-truth CAD/PDF correspondences were supplied. TP, FP, FN, precision, recall, F1 and the 90% target are therefore **not measured**. Registration confidence is not treated as comparison accuracy.

## Unresolved engineering work
- Independently verify the physical N–O reference endpoints and 7720 mm distance against authoritative drawing dimensions.
- Execute the actual ARC-1002 DWG/PDF comparison in a Windows browser using the bundled DWG reader or an installed converter.
- Implement multi-point landmark matching with RANSAC/weighted estimation and separate hold-out validation.
- Add region-level residual/distortion diagnostics.
- Add vector/entity-level correspondence for DXF and PDF geometry; current primary comparison remains raster-mask based.
- Expand page-pairing validation across the complete multi-page drawing set and evaluate per-page registration.
- Establish a manually validated ground-truth set before reporting precision, recall, F1 or a 90% claim.


# Validation — v29 (vector precision overlay and PDF intelligence)

## Automated tests (all pass)
| Test | Result |
|---|---|
| `node test_alignment_transform.js` | PASS |
| `node test_registration.js` | PASS |
| `node test_layer_selection.js` | PASS |
| `node test_calibration.js` | PASS |
| `node test_v29_precision.js` | PASS — 20 checks: CAD/Revit/raster recognition, 23.5° + shift recovered exactly with scale held, planted 300 mm wall shift reported as 0 / 300 mm on the wall, removed wall reported missing, the page's sample pair reported as exactly 300 mm / 1.80 m / 1.40 m, a building drawn 400 mm wider reported as "Revit is 400 mm wider", paper space excluded, viewport 1:200 read, mirrored circle placed correctly, exact spline, dashed run kept, dash gaps bridged while a 0.9 m door opening is still reported, 2 m axis-line dash gaps bridged on axis layers but not on wall layers, SHX strokes removed |
| `python -m py_compile innoclique_site.py` | PASS; `build_html()` output identical to `index.html` |

## Client drawings (supplied architectural package; files not included in this delivery)
The supplied PDFs were all recognised as **CAD drawings plotted from AutoCAD 2024** (metadata
`AutoCAD 2024 - English`, producer `pdfplot16.hdi`, the DWG's own layer names, AutoCAD SHX text marks), not Revit.
These pairs therefore check the DWG against its own plotted sheet, which is the strongest test of alignment.

| Pair | Route | Rotation | Overlay residual (median / 90%) | Line agreement (CAD→PDF / PDF→CAD) | Time |
|---|---|---|---|---|---|
| ARC-1002 DWG + PDF | in the browser (built-in DWG reader) | 0.0002° | 1.1 mm / 2.1 mm | 95.6% / 97.5% (before dash handling) | about 12 s |
| ARC-1002 DXF (ODA) + PDF | engine in Node | 0.0002° | 1.1 mm / 2.1 mm | 99.9% / 100.0%, 4 issues left | 1.5 s |
| ARC-1003 DXF (ODA) + PDF | engine in Node | −0.0002° | 2.0 mm / 3.8 mm | 96.7% / 96.6% | 3.3 s |
| ARC-1003 DWG + PDF | in the browser (built-in DWG reader) | — | 2.0 mm / 3.8 mm | 92.2% / 96.0% (before dash-gap bridging) | about 42 s |

- Scale: the CAD layout viewport gives exactly 1:200; with the scale left free the best fit moves it by only
  −0.003% (ARC-1002) and −0.005% (ARC-1003), confirming the printed scale.
- Recovery from an arbitrary placement: the ARC-1002 PDF rotated by a further 23.5° and shifted was recovered to
  −23.4997° with the same 1.1 mm median residual.
- Dashed linetypes: the DWG stores an axis, centre, hidden or boundary line as one continuous line, while the PDF
  plots its dashes (on these sheets 0.06-0.5 m gaps, and about 2 m gaps for axis lines). These gaps are matched
  (up to 0.35 m always; up to 0.6 m between dash-like pieces; up to 2.5 m only when neither line is on a wall,
  door or structure layer) and also closed for the room check. An earlier draft of this report described some of
  these dashed lines as content missing from the sheet; that was wrong, they were plotted dashed.
- ARC-1002: 4 issues remain (one 1.26 m line and three grid-based room differences). ARC-1003: the remaining issues
  are mostly grid-based room differences and CAD content beyond the plotted window (the sheet's viewport is clipped).

## Issue counts on the client sheets (DWG against its own AutoCAD plot, LOD 300, 50 mm)
| Sheet | First v29 browser run | Now |
|---|---|---|
| ARC-1002 | 139 | 3 |
| ARC-1003 | 332 | 50 (18 of them room-grid differences) |
| ARC-1005 | 30 | 9 |

Changes that removed false issues: an issue must be at least the LOD's smallest feature (0.25 m at LOD 300);
matched lines are shared by both room grids; PDF lines strictly inside a CAD hatch area are hatch pattern
(CAD plots only; CAD lines are still all checked); overall size is measured from lines that have a partner square
across in the other drawing. The remaining ARC-1003 items are mainly the site boundary beyond the plotted window,
facade linetype strokes, short lines on layer 0 at the sheet edges, and rooms affected by those lines.

## Browser QA pass (all features, error capture on)
Sample pair, Revit-style PDF, scanned image, wrong-slot swap, client DWG + PDF, ZIP batch with pair navigation,
LOD 500 / 5 mm, all-lines mode, auto-align off, N-O calibration, every display switch, all 3D modes and camera
buttons, issue click-to-zoom, CSV and screenshot export, the Plan to 3D tool, and the backend endpoints
(/api/convert-dwg 3.7 s for ARC-1002, /api/dwg-engine, /api/ai/status): no JavaScript errors. With the server
converter used first, ARC-1002 in the browser: 100.0% agreement, 3 issues.

## Whole-drawing 2D view (all layers)
| Sheet | Lines drawn (CAD / PDF) | Agree (CAD / PDF line length) | Extra time |
|---|---|---|---|
| ARC-1005 Roof Floor – Lower Level | 404,058 / 91,031 | 99.7% / 99.7% | about 11 s |
| ARC-1003 Ground Floor | 831,606 / 225,580 | 98.0% / 97.5% | about 5 s |

Remaining colour on ARC-1003 is mainly electrical equipment drawn differently in the DWG blocks and grid
bubbles held in nested blocks; hatching, text and dimensions are shown as light-grey context.

## Revit path (synthetic, because no real Revit export was supplied)
A Revit-style sheet (Revit metadata, no layers, title block with Revit fields, 1:100) was generated from a CAD
plan with planted errors. Recognised as "Revit export (Revit 2024)", 99% confidence; sheet border and title block
removed; scale from the printed 1:100.

| Planted | Reported |
|---|---|
| wall moved 300 mm across its length, 13.00 m long | "Revit sits 300 mm up the page", feature 13.00 m, marker on the wall |
| 6.00 m wall removed | "A 6.00 m long wall-like linear run is missing" at its CAD coordinates |
| 3.00 m extra wall | "A 2.99 m long wall-like linear run has no match in CAD" |

## Limits
- No real Revit export was available. Revit PDFs are recognised from several signals because exporters write
  different metadata; a PDF with no identifying signal is reported as "unknown origin" and still compared.
- A layerless (Revit) PDF cannot separate walls from furniture by layer; line weight, path length and the sheet
  clean-up are used. Rooms are still checked on the grid.
- Agreement figures are drawing-to-drawing agreement after alignment, not a site survey or a certified accuracy.
