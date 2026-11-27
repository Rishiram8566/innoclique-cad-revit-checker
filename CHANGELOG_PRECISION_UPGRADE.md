# InnoClique v27 Precision Upgrade — Change Log

## Scope
This update preserves the existing v27 application structure and UI. It makes a focused registration correction for drawings with an authoritative physical scale.

## Modified files
- `index.html`
  - Added an explicit `scaleLocked` registration mode for authoritative PDF scale calibrations.
  - When N–O or another accepted scale source is selected, registration searches rotation and translation while fixing the similarity scale at 1.0 in the already calibrated common coordinate frame.
  - Prevented the wide-scale fallback from overriding a locked calibration when confidence is low.
  - Reports the locked-scale state in registration diagnostics.
- `innoclique_site.py`
  - Mirrored the same comparison-engine change in the server's embedded HTML generator so regenerated HTML does not lose the fix.
- `test_registration.js`
  - Added a controlled test asserting that calibrated-scale registration preserves scale 1.0 while recovering rotation and translation.

## Preserved
- Original N–O reference points: N=(1202.88, 252.76), O=(1312.26, 252.76).
- Known distance: 7720 mm.
- PDF distance: 109.38 points.
- Calibration: 70.5796306454562 mm/PDF point (displayed/stored legacy value: 70.579630645456).
- Existing UI, styles, branding, workflows, vendor assets and original project files.

## Important limitation
This is a targeted engineering correction, not a claim that every requirement in the supplied master prompt has been implemented. The current comparison engine remains primarily raster-mask based. Full vector-entity correspondence, multi-landmark RANSAC with independent validation, per-region distortion diagnostics, and ground-truth F1 evaluation require representative source CAD/PDF drawing pairs and a larger separately validated implementation. No 90% accuracy claim is made.


## v28 — production calibration lock propagation

### Root cause corrected
- `smartPdfCalibration()` correctly returned `scaleLocked: true` for the built-in N–O calibration, and `run()` carried that flag into the geometry metadata.
- The active `core()` function did not forward `geo.scaleLocked` to `similarityRegister()`. It passed only `scaleKnown`, so the production path could still search a non-unit scale even though the N–O calibration was authoritative.
- Added `registrationOptions(geo, cell)` and wired the active comparison core through it. Calibrated PDF scale is now held at 1.0 after the PDF has been converted into the common calibrated coordinate frame; the solver can estimate rotation and translation without rescaling the calibrated drawing.
- Applied the same change to `index.html` and the embedded HTML in `innoclique_site.py`; verified the generated HTML is byte-for-byte equal to the shipped `index.html`.
- Added a production-path regression assertion and `test_calibration.js` for the N–O arithmetic.

### Files changed in v28
- `index.html`
- `innoclique_site.py`
- `test_registration.js`
- `test_calibration.js` (new)
- `README.md`
- `CHANGELOG_PRECISION_UPGRADE.md`
- `VALIDATION_REPORT.md`

### Scope
This is a targeted correction to the active runtime pipeline. It does not implement the full vector-entity correspondence, RANSAC multi-landmark estimation, per-region distortion model, or independent ground-truth accuracy evaluation requested in the master prompt.


## v29 — vector precision overlay and PDF intelligence

### Problems found in v28
- A PDF was compared as a full-sheet picture (text, hatches, furniture, title block included) against a
  layer-filtered CAD file, so many reported mismatches were sheet content, not model differences.
- Registration was refined only on a ~384 px grid (about 0.3 m on a 110 m plan).
- Mismatch sizes and positions were measured on the raster grid (78 mm cells at LOD 300).
- The DXF reader mixed paper-space objects (title block) into the model, ignored layout viewports, and placed
  mirrored objects (extrusion 0,0,-1) on the wrong side; the in-browser DWG converter did the same.
- The built-in ARC-1002 N-O value (70.5796 mm/pt) is 0.034% off the printed 1:200 (70.5556 mm/pt),
  about 40 mm over the building.

### Changes (index.html, mirrored in innoclique_site.py; build_html() output is byte-identical to index.html)
- PDF vector reader with layer names; AutoCAD SHX text removal; PDF origin recognition (CAD / Revit / BIM / scan).
- Layer pairing between a CAD file and its own plot; CAD dimension/hatch recognition in the plot; viewport clip.
- Sheet border / title block / side panel removal for layerless PDFs (vector version of the existing cleanup).
- Scale from the CAD layout viewport; N-O snaps to the printed standard scale when they agree within 0.5%.
- Vector coarse search + robust point-to-line ICP; overlay residual and local misfit in the report.
- Vector mismatch measurement at the user tolerance; one rigid offset per moved feature; separate missing and
  extra issues; markers on the line; CAD coordinates in the table and CSV.
- DXF reader: paper space (group 67), VIEWPORT, DIMENSION, HATCH boundaries, SPLINE (de Boor), SOLID/TRACE,
  OCS extrusion; dashed runs. In-browser DWG converter: model/layout split, VIEWPORT, DIMENSION, HATCH, SOLID,
  exact SPLINE, extrusion.
- Dash gaps: a line that is continuous in one drawing and plotted dashed in the other is matched across gaps
  when partner dashes lie on both sides: up to 0.35 m always, up to 0.6 m between dash-like pieces, up to 2.5 m
  only when neither line is on a wall / door / structure layer. Bridged gaps are also closed for the room check.
- Overall size uses 1%-99% of each drawing's line work, so one long stray or clipped line cannot drive it.
- Whole-drawing 2D view: every line of both drawings (all layers) drawn as vectors at up to 3x grid resolution,
  each piece coloured agree / only in CAD / only in Revit by the same tolerance and dash rules; hatching, text and
  dimensions (by layer name, by CAD hatch/dimension geometry, and anything inside a CAD hatch boundary) shown as
  light context. New switch c_sD. Dash-dot linetypes (dashes up to 12 m) bridged on non-wall layers.
- Fewer false issues: minimum issue size = LOD minimum feature; matched lines shared by both room grids; PDF lines
  inside CAD hatch areas not checked as walls (CAD plots only); overall size from partner-supported lines.
- 3D view: generated wall blocks removed (they were guessed from grid pixels and did not follow the real walls). With
  vector results the 3D view draws the exact line work as 3D lines, mismatches as bold strips; the image path keeps the
  flat comparison plan at a finer resolution (up to 3000 px). The 3D legend follows the selected mode.
- QA pass fixes: DWG files go through the converter installed with the local server first (ODA / LibreDWG; more
  faithful: ARC-1002 3 issues instead of 9), the in-browser reader is the fallback; missing / extra run lengths are
  exact (tolerance band at a matched end added back, once per end); every issue carries CAD coordinates, rooms and
  overall size included; an N-O calibration you type always wins over the layout viewport, with cross-checks;
  image-path note about hatches corrected.
- CAD side may be a vector PDF; Revit/CAD slots are swapped when the files were put the wrong way round.
- New test: `test_v29_precision.js` (synthetic data).

### Not changed
- Images and scanned PDFs use the v28 image-based comparison. Room checks remain grid-based.
