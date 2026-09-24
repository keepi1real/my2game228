"""Drawing primitives in character space, shared by every rigged hero.

Character space: origin on the ground between the feet, +x forward (the heroes
face right), +y up. `Canvas.t` is the only place that converts to image
coordinates, so poses never deal in pixels.

This is the orc rig's primitive set with the palette lifted out, so several
characters can share it. `tools/orc-sprite-gen/rig.py` is the earlier, palette-
bound copy that predates this one.
"""
from __future__ import annotations

import math

from PIL import Image, ImageDraw

SS = 3                      # supersample factor
W = H = 192                 # final cell size
BASELINE = 178              # ground line, in final px
CX = 88                     # character origin x, in final px
OUTLINE = (22, 17, 30)


def d_down(a: float) -> tuple[float, float]:
    """Unit vector: straight down, rotated `a` degrees toward +x (forward)."""
    r = math.radians(a)
    return (math.sin(r), -math.cos(r))


def d_up(a: float) -> tuple[float, float]:
    r = math.radians(a)
    return (math.sin(r), math.cos(r))


def rot(v, deg):
    r = math.radians(deg)
    return (v[0] * math.cos(r) - v[1] * math.sin(r),
            v[0] * math.sin(r) + v[1] * math.cos(r))


def step(p, v, n):
    return (p[0] + v[0] * n, p[1] + v[1] * n)


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def ik(shoulder, target, l1, l2, sign):
    """Two-bone IK. `sign` picks which way the joint bends."""
    dx, dy = target[0] - shoulder[0], target[1] - shoulder[1]
    raw = math.hypot(dx, dy) or 1.0
    d = min(max(raw, abs(l1 - l2) + 0.01), l1 + l2 - 0.01)
    u = (dx / raw, dy / raw)
    ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
    a = math.degrees(math.acos(max(-1.0, min(1.0, ca))))
    e = rot(u, a * sign)
    return (shoulder[0] + e[0] * l1, shoulder[1] + e[1] * l1)


class Canvas:
    """Draws in character space onto a supersampled RGBA image."""

    def __init__(self, width: int = W, height: int = H, cx: int = CX, baseline: int = BASELINE):
        self.w, self.h, self.cx, self.baseline = width, height, cx, baseline
        self.img = Image.new("RGBA", (width * SS, height * SS), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    def t(self, p):
        return ((self.cx + p[0]) * SS, (self.baseline - p[1]) * SS)

    def poly(self, pts, fill):
        self.d.polygon([self.t(p) for p in pts], fill=fill)

    def disc(self, c, r, fill):
        x, y = self.t(c)
        rr = r * SS
        self.d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=fill)

    def oval(self, c, rx, ry, fill, angle=0.0):
        ca, sa = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        pts = []
        for i in range(44):
            th = 2 * math.pi * i / 44
            ux, uy = rx * math.cos(th), ry * math.sin(th)
            pts.append((c[0] + ux * ca - uy * sa, c[1] + ux * sa + uy * ca))
        self.poly(pts, fill)

    def limb(self, a, b, wa, wb, fill):
        """Tapered capsule from a to b."""
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / ln, dx / ln
        self.poly([(a[0] + nx * wa / 2, a[1] + ny * wa / 2),
                   (b[0] + nx * wb / 2, b[1] + ny * wb / 2),
                   (b[0] - nx * wb / 2, b[1] - ny * wb / 2),
                   (a[0] - nx * wa / 2, a[1] - ny * wa / 2)], fill)
        self.disc(a, wa / 2, fill)
        self.disc(b, wb / 2, fill)

    def limb_shaded(self, a, b, wa, wb, base, sh, hi, stroke=2.3):
        """A limb with its own outline, a shadow side and a lit side."""
        if stroke:
            self.limb(a, b, wa + stroke, wb + stroke, OUTLINE)
        self.limb(a, b, wa, wb, base)
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1.0
        n = (-dy / ln, dx / ln)
        self.limb(step(a, n, -wa * 0.26), step(b, n, -wb * 0.26), wa * 0.42, wb * 0.42, sh)
        self.limb(step(a, n, wa * 0.27), step(b, n, wb * 0.27), wa * 0.30, wb * 0.30, hi)
