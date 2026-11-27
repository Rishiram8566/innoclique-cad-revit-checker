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
python -m py_compile innoclique_site.py
```

The tests cover identity/translation/rotation/down-scale raster transforms, recovery of a controlled synthetic CAD/Revit rotation and scale, and XREF-aware architectural layer selection.

## Accuracy target

The application reports geometry-overlap agreement, precision, recall and F1 at the selected LOD/tolerance. These are raster comparison diagnostics, not independently verified construction accuracy. The code does not hard-code 90%. A 90% result on a real pair must be verified against that pair's known dimensions and matching geometry; it cannot be guaranteed by a code change alone.

## Credentials

No API keys are included in this project archive. If optional AI layer classification is used, configure `ASSEMBLYAI_API_KEY` as an environment variable on the machine running the server.


## Precision upgrade note

The current release additionally locks the physical scale whenever an authoritative calibration source is selected (including the N–O reference). In that mode, the registration solver cannot silently change scale or fall back to a wide scale sweep; it estimates rotation and translation only. See `CHANGELOG_PRECISION_UPGRADE.md` and `VALIDATION_REPORT.md`.

The automated tests include a regression case for this behaviour. This update does not claim independently measured 90% F1: a labelled real CAD/PDF validation set is still required.
