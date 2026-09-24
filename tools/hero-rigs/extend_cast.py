#!/usr/bin/env python3
"""Extend the shipped knight and archer atlases with eight distinct cast poses.

Run from any directory: python tools/hero-rigs/extend_cast.py
The first four source rows are preserved pixel for pixel. The cast row is
reconstructed from the copied character rigs and pose tracks beside this file.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

import archer
import knight
import tracks

CELL = 192
ROOT = Path(__file__).resolve().parents[2]
HEROES = {"knight": knight, "archer": archer}


def embellish(frame: Image.Image, name: str, pose: dict, index: int) -> Image.Image:
    """Translucent light lives in the new row, with the posed rig underneath."""
    energy = pose["cast_energy"]
    fx = Image.new("RGBA", frame.size)
    glow = Image.new("RGBA", frame.size)
    g = ImageDraw.Draw(glow)
    d = ImageDraw.Draw(fx)
    if name == "knight":
        x, y = 88 + pose["shield_x"], 178 - pose["shield_y"]
        color = (130, 204, 255)
        # The shield acts as a spell focus. Three nested runes open and rotate.
        radius = 12 + 13 * energy
        g.ellipse((x-radius*1.5, y-radius*1.5, x+radius*1.5, y+radius*1.5),
                  fill=(*color, int(95*energy)))
        for offset, alpha in ((0, 220), (6, 120)):
            r = radius + offset
            d.arc((x-r, y-r, x+r, y+r),
                  35 + index*28, 320 + index*28, fill=(*color, int(alpha*energy)), width=2)
        for k in range(6):
            a = (k * math.tau / 6 + index*.29)
            px, py = x + (radius+3)*math.cos(a), y + (radius+3)*math.sin(a)
            d.line((px-3, py, px+3, py), fill=(232, 247, 255, int(210*energy)), width=1)
            d.line((px, py-3, px, py+3), fill=(232, 247, 255, int(210*energy)), width=1)
    else:
        x, y = 88 + pose["draw_x"] + 11, 178 - pose["draw_y"] - 12
        color = (128, 239, 158)
        radius = 9 + energy*15
        g.ellipse((x-radius*1.7, y-radius*1.7, x+radius*1.7, y+radius*1.7),
                  fill=(*color, int(110*energy)))
        # A leaf ring sprouts above the raised palm rather than firing an arrow.
        for k in range(5):
            a = k*math.tau/5 + index*.32
            px, py = x + radius*math.cos(a), y + radius*math.sin(a)
            d.ellipse((px-4, py-2, px+4, py+2),
                      fill=(160, 249, 166, int(200*energy)))
            d.line((x, y, px, py), fill=(190, 255, 200, int(95*energy)), width=1)
        d.ellipse((x-4, y-4, x+4, y+4), fill=(238, 255, 218, int(240*energy)))
    frame.alpha_composite(glow.filter(ImageFilter.GaussianBlur(7)))
    frame.alpha_composite(fx)
    return frame


def extend(name: str) -> None:
    target = ROOT / "assets" / "hero-rigs" / name
    path = target / "sprite-sheet-alpha.png"
    manifest_path = target / "manifest.json"
    old = Image.open(path).convert("RGBA")
    assert old.width == CELL*8 and old.height in (CELL*4, CELL*5), path
    sheet = Image.new("RGBA", (CELL*8, CELL*5))
    sheet.alpha_composite(old.crop((0, 0, CELL*8, CELL*4)))
    poses = tracks.HEROES[name]["cast"]()
    for i, pose in enumerate(poses):
        frame = HEROES[name].draw(pose)
        sheet.alpha_composite(embellish(frame, name, pose, i), (i*CELL, CELL*4))
    sheet.save(path, optimize=True)

    data = json.loads(manifest_path.read_text())
    data["animation"]["rows"]["cast"] = {
        "row": 4, "frames": 8, "fps": 12,
        "durations_ms": [83]*8, "loop": False,
        "frame_variant": "pixel",
    }
    data["frame_layout"]["sheetHeight"] = CELL*5
    data["frame_layout"]["rows"]["cast"] = [
        {"x": i*CELL, "y": CELL*4, "w": CELL, "h": CELL} for i in range(8)
    ]
    manifest_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(f"{name}: {sheet.width}x{sheet.height}, 40 frames")


if __name__ == "__main__":
    for hero in HEROES:
        extend(hero)
