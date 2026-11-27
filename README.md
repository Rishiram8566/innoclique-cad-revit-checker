# Innoclique — updated project (v27)

This package is based on the newly supplied `InnoClique-Updated-Project(1).zip` folder. The existing page layout, CSS, controls, labels, navigation, 2D/3D viewer and workflows are preserved.

## Run on Windows

1. Extract the ZIP.
2. Open the extracted `project` folder in VS Code.
3. Open PowerShell in that folder.
4. Run:

   ```powershell
   python innoclique_site.py
   ```

5. Open `http://localhost:8000` if the browser does not open automatically.

Python 3.10+ is recommended. The local server uses the Python standard library. The DWG reader is included in `vendor/`; the PDF.js, Three.js and ZIP browser libraries use their configured CDN URLs.

## CAD-to-Revit changes (v27)

- Removed the preliminary centre-point translation. Original cleaned CAD and Revit masks now enter the registration solver in their common raster frame.
- Removed the second local translation optimizer after similarity registration. Rotation, uniform scale and translation are solved together once, so a second pass cannot undo the best-fit transform.
- Replaced forward pixel splatting with inverse raster mapping. This avoids holes after rotation/scaling and removes the old directional `+x/+y` pixel stamping bias.
- Added sub-pixel coverage sampling for down-scaled thin linework.
- Fixed XREF layer handling: nested architectural wall, door and structural layers such as `XREF_...$0$A-ARCH-WALL` are now eligible for the default architectural comparison instead of being excluded just because their names contain `XREF`.
- Fixed the main-geometry filter to receive the actual layer-name array. Previously it inspected `P.names`, which is not part of the parser's geometry object, so semantic wall/door rules were not applied correctly.
- Replaced the global ink-to-edge stroke-width ratio with a capped local distance-transform estimate. Large filled PDF regions no longer masquerade as extremely thick strokes.
- Dense hatch/fill suppression now runs before stroke-width normalisation in main-walls mode.
- Source drawing data remains unchanged; transforms and cleanup are comparison-only.

## Tests included

Run from the project folder:

```powershell
node test_alignment_transform.js
node test_registration.js
node test_layer_selection.js
node test_calibration.js
node test_v29_precision.js
python -m py_compile innoclique_site.py
```

The tests cover identity/translation/rotation/down-scale raster transforms, recovery of a controlled synthetic CAD/Revit rotation and scale, and XREF-aware architectural layer selection.

## Accuracy target

The application reports geometry-overlap agreement, precision, recall and F1 at the selected LOD/tolerance. These are raster comparison diagnostics, not independently verified construction accuracy. The code does not hard-code 90%. A 90% result on a real pair must be verified against that pair's known dimensions and matching geometry; it cannot be guaranteed by a code change alone.

## Credentials

No API keys are included in this project archive. If optional AI layer classification is used, configure `ASSEMBLYAI_API_KEY` as an environment variable on the machine running the server.


## v28 — calibrated-scale registration wiring fix

The active `core()` comparison path now forwards both `scaleKnown` and `scaleLocked` from the PDF calibration result into `similarityRegister()`. Previously, the PDF calibration code set `scaleLocked: true`, but `core()` forwarded only `scaleKnown`; the production solver could therefore still adjust the N–O-calibrated scale by up to its bounded search range. The solver now receives the lock and holds the calibrated scale at 1.0 in the common calibrated frame while solving rotation and translation.

The same change is present in both `index.html` and the HTML generator inside `innoclique_site.py`, so a regenerated interface retains the fix. A regression assertion checks the production call path, not only the solver in isolation. `test_calibration.js` checks the N–O distance and scale arithmetic.

The legacy numbered Python scripts are retained unchanged; `python innoclique_site.py` serves `index.html` and is the documented application entry point.


## v29 — precision overlay, exact mismatch positions, PDF intelligence

When both a CAD file and a Revit drawing are uploaded, the two are now compared as **line work**, not as pictures:

- **PDF line work with layers.** A PDF is read for its own vector lines (PDF.js operator list), including its
  layer (optional-content) names. AutoCAD "SHX text" strokes are removed using the PDF's own text marks.
- **PDF intelligence: CAD or Revit?** Each PDF is recognised from its metadata (creator/producer/title),
  layer naming style (AutoCAD `XREF$0$` / AIA names vs Revit categories), AutoCAD SHX text marks, Revit
  title-block fields and raster/vector content. The result is shown on the file card and in the report
  (for example "PDF recognised as CAD drawing (plotted from AutoCAD 2024)"). If a Revit export is put in the
  CAD slot and a CAD drawing in the Revit slot, they are swapped. A ZIP of drawings shows each PDF's origin,
  prefers Revit exports when pairing, and can use CAD-plotted PDFs as the CAD side when it has no DWG/DXF.
- **Same layers on both sides.** When the PDF carries the CAD file's own layer names, exactly the same layer
  selection is compared on both. The CAD file's own dimensions and hatch patterns are recognised in the plot
  and left out. Layerless (Revit) PDFs: sheet border, title block and side panel are recognised and left out.
- **Exact scale.** Order: your N-O calibration (always used as entered, cross-checked) > the CAD layout viewport
  (when the PDF is a plot of that layout) > the printed title-block scale > auto-fit. A built-in N-O value that agrees with the printed
  standard scale within 0.5% uses the exact standard scale. A free-scale check reports any deviation.
- **Precision alignment.** Wall-direction + line-position profile search for the start, then robust
  point-to-line ICP on the real lines (scale held when it is known). The report gives the overlay residual
  (median and 90%) and any local misfit.
- **Exact mismatches.** Every CAD and Revit line is checked against the other at your tolerance (not the
  grid). A moved wall is reported with one rigid offset measured line to line (for example "Revit sits 300 mm
  up the page"), missing/extra runs with their real length, each with the marker on the line itself and its
  **CAD coordinates** (also in the CSV: `CAD_X`, `CAD_Y`, `Offset_X_mm`, `Offset_Y_mm`).
- **DXF/DWG reader fixes.** Paper-space (layout) objects such as the title block are no longer mixed into the
  model; layout viewports, dimensions, hatch boundaries, splines (exact B-spline) and 2D solids are read;
  mirrored objects (extrusion 0,0,-1) are placed correctly; dashed lines are judged as whole runs, and the gaps of
  a dashed line (partner dashes on both sides; long gaps only on non-wall layers) are not reported as missing.

- **The whole drawing in detail.** The 2D view draws every line of both drawings (all layers: equipment,
  chillers, tanks, grids, hatching), aligned and crisp. Grey = both drawings agree, red = only in CAD, blue = only
  in Revit, at your tolerance; hatching, text and dimensions are light-grey context. Switch: "Show the whole drawing
  in detail (all layers)". The issue list still covers walls and doors (or all lines when that option is off).

- **3D view from the real line work.** No generated wall blocks: the 3D view shows every line of both drawings as
  crisp 3D lines on the floor (grey = agree, light grey = hatching/text), with mismatches as bold red (only in CAD) and
  blue (only in Revit) strips. The CAD, Revit and overlay 3D modes also use the real lines; the legend follows the mode.

Images and scanned PDFs still use the previous image-based comparison. See `CHANGELOG_PRECISION_UPGRADE.md`
and `VALIDATION_REPORT.md` for the measured results.
