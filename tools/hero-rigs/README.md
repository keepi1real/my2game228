# Original articulated hero additions

Three new original character designs, using the shared hero rig drawing primitives.
Legacy game IDs remain stable for saved games; presentation names are new.

| ID | Name | Design |
|---|---|---|
| `baldin` | Таррок | Broad copper armored axe fighter |
| `mithrandir` | Элира | Slender glass rune caster with a white crest |
| `peregrin` | Шелт | Compact masked scout with goggles and two knives |

Each `assets/<id>/sprite-sheet-alpha.png` is a genuine transparent RGBA atlas,
1536 × 960 px, with 8 columns and 5 rows. Cells are 192 × 192 px.
Characters face right; mirror the whole frame to face left.
Foot anchor: `(88, 178)` in each cell.

| Row | State | Frames | FPS | Loop |
|---|---|---|---|---|
| 0 | idle | 8 | 8 | yes |
| 1 | walk | 8 | 12 | yes |
| 2 | run | 8 | 16 | yes |
| 3 | attack | 8 | 14 | no |
| 4 | cast | 8 | 12 | no |

Each hero directory includes the engine manifest, individual transparent PNG
frames, and dark-background GIF previews. `assets/contact-sheet.png` shows all
120 frames. The manifest stores QA bounds and unique-frame counts per state.

## Rebuild

Requires Python 3 and Pillow:

```sh
python tools/hero-rigs/build_originals.py
```

The builder asserts 8 distinct frames per state and transparent safety margins
around every frame. Its output is deterministic. `rig.py`, `body.py`, and
`tracks.py` reuse the project's existing source primitives; `new_heroes.py`
contains the new character geometry and motion tracks.
