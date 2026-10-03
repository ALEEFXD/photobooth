# Plan: Keep Transparent Areas Transparent in Imported Frame PNGs

Repo: `ALEEFXD/photobooth` · Scope: import → slot detection → composite → save/print

---

## 1. Analysis

### 1.1 What `scripts/generate-frames.js` actually does

It is **not** the code path for imported PNGs, and it is **not** what turns transparency white.

- It runs only from `postinstall` and only builds the 4 built-in frames (`classic-strip`, `2x2-grid`, `filmstrip-3`, `single-portrait`).
- It skips any frame whose `frame.png` already exists (line 78), so it never touches `custom-*` folders.
- It writes transparency correctly: slot pixels are `RGBA (0,0,0,0)` and everything else is opaque (`borderColor`, alpha 255). I checked the generated PNGs: alpha is only ever `0` or `255` (52–84% fully transparent, depending on frame).
- The white in these frames is the opaque `borderColor` (`255,255,255`), which is intentional, not a lost alpha channel.

What it does contribute is an **implicit contract** the rest of the app relies on: *"every transparent pixel is a perfectly rectangular photo slot, and nothing else is transparent."* That is true for the built-ins and false for real-world imported frames. That mismatch is the real problem.

### 1.2 Where the white actually comes from (verified)

I ran the repo's own `detectSlots()` (`server/routes/frames.js`) and `compose()` (`server/compose.js`) against a test frame and against the real `custom-1790832409296` frame already in the repo.

| # | Cause | Where | Effect |
|---|-------|-------|--------|
| **C1** | The final image is flattened onto an opaque white canvas and saved as JPEG (JPEG has no alpha). | `server/compose.js` L137–148 (`create … background {255,255,255, alpha:1}` → `.jpeg()`); `client/canvas/compositor.js` L20–22 (`fillRect('#FFFFFF')`) | **Every** transparent pixel that isn't covered by a photo becomes white. This is the root cause. |
| **C2** | A transparent area only counts as a "slot" if it is a connected region with a bounding box over 50×50 and alpha ≤ 10. | `frames.js` L45/L76; `slotDetector.js` L33/L66 | Small holes (<50px) and semi-transparent pixels (alpha 11–254) are not slots, so they blend with the white canvas. Measured: a 40×40 hole → `(255,255,255)`; a 50%-alpha red band → `(255,127,126)` (pink, not see-through). |
| **C3** | Slots are rectangles (bounding boxes), and the app has no concept of "transparent but not a photo slot". | same as C2 | A transparent footer strip or any region touching the PNG edge is detected as a slot and gets filled with a photo instead of staying transparent. |
| **C4** | A slot with no photo assigned is never drawn, so the hole shows the white base. | `compose.js` L106–126, `compositor.js` L25–28 | Confirmed visually: with 1 of 3 photos, the other two torn-paper slots render pure white. |
| **C5** | Slot metadata is never validated against the PNG. | `frames.js` `PUT /:id` L158–180 accepts anything; modal overlay scales against `frames[0]?.width \|\| 1200` instead of the imported image (`FrameSelectPage.jsx` L308–311) | The repo's own custom frame is 600×1800 with real slots around `(78,377,457×384)`, but its saved `meta.json` says `(150,1650, 925×1850)`, which is outside the image. Result: server compose throws `Image to composite must have same dimensions or smaller` (HTTP 500, because the final `.composite()` is outside the `try/catch`), and the client clips to a rect that is off-canvas, so nothing is drawn and the transparent areas show the white fill. |
| **C6** | Two copies of slot detection with different thresholds. | server `> 50` vs client `>= 50` | Client preview and server result can disagree. |

Not a cause (checked): `sharp(...).png().toFile()` on upload preserves alpha. The stored custom PNG still has 39% fully transparent pixels. The loss happens at **composite/export time**, not at upload time.

### 1.3 Baseline measurements (current behaviour)

Test frame 600×900: rect slot, circular hole, 40×40 hole, 50%-alpha band, 600×80 transparent footer.

| Probe | Slots filled | 1 slot filled |
|-------|--------------|---------------|
| rect slot | photo | photo |
| circular hole | photo (as bbox slot) | **white** |
| 40×40 hole | **white** | **white** |
| 50%-alpha band | **pink-white blend** | **pink-white blend** |
| transparent footer | **photo** (wrongly treated as slot) | **white** |
| output | JPEG, 3 channels, no alpha | same |

---

## 2. Goal and rules

A pixel in the imported PNG that is transparent **and not a photo slot** must be transparent in the output, and partially transparent pixels must stay partially transparent.

1. **Photo slot** → photo shows through.
2. **Keep-transparent region** → output alpha stays 0 (or the original alpha).
3. **Semi-transparent pixels** → keep their original alpha; never blend into white.
4. **Output format follows the content:** PNG (with alpha) when the frame has keep-transparent areas or the user asks for it; JPEG with white background otherwise (current behaviour, for printing).

Note: printers cannot print transparency. Transparent areas print as paper colour. The transparent PNG is for digital use (stickers, overlays, further editing). The plan keeps JPEG available.

---

## 3. Implementation plan

### Phase 0: Safety net (small, do first)

1. **Validate slots on write** in `POST /api/frames` and `PUT /api/frames/:id`: integers, `width/height > 0`, fully inside `[0, frame.width] × [0, frame.height]`. Return 400 with a clear message otherwise. This alone prevents the C5 white-out and the 500.
2. **Fix modal scaling** in `FrameSelectPage.jsx`: store the imported image's `naturalWidth/Height` when the file loads and use that (not `frames[0]`) for overlay percentages.
3. **Make `compose()` fail soft:** wrap the final composite, skip out-of-bounds slots with a logged warning.
4. **Repair or remove** the broken `custom-1790832409296` metadata (re-run detection).

### Phase 1: Don't flatten onto white

1. `server/compose.js`: change the base canvas to `background: { r:0, g:0, b:0, alpha:0 }`.
2. `client/canvas/compositor.js`: remove the unconditional `fillRect('#FFFFFF')`; add an optional `background` param (`null` = transparent, `'#fff'` = flatten). The canvas starts transparent by default.
3. Output format selection in `compose()` and `results.js` (L55 currently hard-codes `'.jpg'`):
   - `format: 'png' | 'jpeg'` (default `auto`: PNG if the frame is flagged `keepTransparent`, else JPEG).
   - JPEG path flattens onto white explicitly (`.flatten({ background: '#fff' })`), so existing behaviour is unchanged for built-ins.
4. `ResultPage.jsx`: button label and request reflect the format ("SAVE PNG" / "SAVE JPEG"); optionally a small toggle "TRANSPARENT BACKGROUND".
5. Preview wrappers (`ResultPage`, `AdjustPage`, `CapturePage`): show a **checkerboard** behind the canvas so users can see transparency instead of an opaque grey/white box.

### Phase 2: Separate "photo slot" from "keep transparent"

1. **Single source of truth for detection.** Create `server/frameAnalysis.js` exporting `analyzeFrame(buffer)`; use it from `POST /api/frames`, a new `POST /api/frames/analyze` (modal preview), and `generate-frames.js`. Delete `client/canvas/slotDetector.js` or make it call the endpoint. One threshold (`MIN_SLOT = 50`, `ALPHA_CUTOFF = 10`).
2. `analyzeFrame` returns, per connected transparent region: bbox, area, `touchesEdge`, and a classification:
   - **photo** if enclosed (not touching the image edge) and ≥ `MIN_SLOT`;
   - **keep** otherwise (edge-touching, tiny, or user-marked).
3. **Slot mask.** Write `slot-mask.png` (8-bit grey, 255 = photo area) in the frame folder, built from the *actual region pixels* (not the bbox), **dilated by 2 px** so the photo sits under anti-aliased edge pixels and no halo appears. Add to `meta.json`:
   ```json
   { "slots": [...], "slotMask": "slot-mask.png", "keepTransparent": true }
   ```
   `keepTransparent` is true when any transparent/semi-transparent pixel exists outside the mask.
4. **Composite order** (server and client must match):
   1. transparent canvas
   2. draw each photo clipped to its slot rect
   3. apply `slot-mask` with `dest-in` (sharp: `blend: 'dest-in'`; canvas: `globalCompositeOperation = 'destination-in'`) so photos cannot leak into non-slot areas
   4. draw frame PNG on top with normal source-over (preserves partial alpha)
5. **Import modal:** list each detected region with a PHOTO / KEEP TRANSPARENT toggle (default from the classification above). Manual rect edits regenerate the mask as a union of rects. Warn if the PNG has no alpha channel or zero photo slots.
6. **Backward compatibility:** if `slot-mask.png` is missing (built-ins, legacy customs), build a rect mask from `slots` at compose time. Add `scripts/migrate-frames.js` to re-analyze existing `custom-*` frames. Update `generate-frames.js` to emit `slot-mask.png` + `keepTransparent: false` for new built-ins (its `existsSync` skip stays, hence the migration script).

### Phase 3: Edge cases

- Empty slot (C4): when a slot has no photo yet, leave it transparent in the preview instead of white (flatten only on JPEG export).
- Rotated photos (`compose.js` L24–26) fill corners with white. Clip to the mask so this can't show through; consider `background` alpha 0.
- 16-bit / palette / grayscale+alpha PNGs: run uploads through `sharp(buf).ensureAlpha().png()` and test one of each.
- Very large PNGs: keep the 20 MB limit; analysis uses one raw buffer pass.

---

## 4. Files touched

| File | Change |
|------|--------|
| `server/frameAnalysis.js` | **new**: detection, classification, mask generation |
| `server/routes/frames.js` | use `analyzeFrame`; validate slots; add `/analyze`; write mask + flags |
| `server/compose.js` | transparent base, mask step, format selection, fail-soft |
| `server/routes/results.js` | accept `format`; extension from format |
| `client/canvas/compositor.js` | no forced white; mask step; `background` param |
| `client/canvas/slotDetector.js` | remove or thin wrapper over `/analyze` |
| `client/pages/FrameSelectPage.jsx` | image-dimension scaling fix; per-region toggle |
| `client/pages/{Result,Adjust,Capture}Page.jsx` | checkerboard preview, format button |
| `client/styles/print.css` | confirm canvas prints correctly with transparency |
| `scripts/generate-frames.js` | emit mask + `keepTransparent:false` via shared helper |
| `scripts/migrate-frames.js` | **new**: re-analyze legacy custom frames |

---

## 5. Acceptance tests

Generate the 600×900 fixture from §1.3 plus the real torn-paper frame, then probe pixels of the output:

| Case | Expected after fix |
|------|--------------------|
| Rect slot, photo assigned | photo colour |
| Circular hole, photo assigned | photo inside the circle only |
| 40×40 hole (keep) | alpha = 0 in PNG output |
| 50%-alpha band | alpha ≈ 128, original colour (not pink-white) |
| Transparent footer touching edge | alpha = 0 (not a slot) |
| Empty slot | transparent in PNG; white only in JPEG export |
| Built-in frames | **byte-identical visual result** to today (JPEG, white where expected) |
| Out-of-bounds slot via PUT | 400, no change saved |
| Client canvas vs server PNG | pixel difference within tolerance on the fixtures |

Output assertions: PNG has 4 channels (`hasAlpha: true`); JPEG has 3.

---

## 6. Decisions needed

1. **Default format:** auto (PNG only when the frame has keep-transparent areas) vs always offer both buttons?
2. **Printing:** is the PNG for digital use only, or must print produce a specific background colour in place of transparency (add a `printBackground` setting)?
3. **Edge-touching transparent slots:** the heuristic treats them as keep-transparent. A full-bleed single-photo frame would need the toggle. Acceptable?

## 7. Suggested order

Phase 0 → Phase 1 → Phase 2 → Phase 3. Phase 0 is about an hour and fixes the broken custom frame. Phase 1 alone fixes "transparent turns white" for simple frames. Phase 2 is needed for the irregular and mixed cases.
