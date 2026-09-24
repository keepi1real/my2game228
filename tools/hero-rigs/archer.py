"""Ilwen Greenwatch — hooded elf ranger with a longbow."""
from __future__ import annotations

import math

from rig import OUTLINE, Canvas, d_up, mix, rot, step
import body as B

BUILD = B.Build(
    name="archer",
    skin=(226, 190, 158), cloth=(74, 92, 62), cloth2=(52, 66, 46),
    metal=(150, 158, 168), leather=(104, 74, 44), hair=(226, 220, 196),
    accent=(126, 210, 150),
    hip_half=9.0, chest_half=6.0, thigh_w=18.0, shin_w=12.5,
    arm_w=16.0, fore_w=12.0, head_r=13.0, legs=(62, 54, 42),
)

POSE = dict(B.BASE_POSE, bow_x=34.0, bow_y=92.0, bow_ang=4.0,
            draw_x=6.0, draw_y=94.0, arrow=1.0, cape_sway=0.0)

LIMB, CURVE = 27.0, 9.0


def _hood_back(c: Canvas, b, q, r):
    """Hair, ear and the hood shell — drawn behind the head so the face shows."""
    ct, cs, ch = B.tones(BUILD.cloth2)
    ht = B.tones(BUILD.hair)
    c.limb(q(-r * 0.5, r * 0.2), q(-r * 1.5, -r * 1.6), 13, 8, OUTLINE)
    c.limb(q(-r * 0.5, r * 0.2), q(-r * 1.45, -r * 1.55), 10.5, 6, ht[0])
    c.limb(q(-r * 0.6, r * 0.1), q(-r * 1.3, -r * 1.3), 4.5, 2.6, ht[2])
    c.poly([q(-r * 0.55, r * 0.22), q(-r * 1.3, r * 0.66), q(-r * 0.5, -r * 0.26)], OUTLINE)
    c.poly([q(-r * 0.6, r * 0.16), q(-r * 1.16, r * 0.54), q(-r * 0.55, -r * 0.18)], BUILD.skin)
    c.oval(q(-3, 4.5), r * 1.30, r * 1.22, OUTLINE)
    c.oval(q(-3, 4.5), r * 1.18, r * 1.10, cs)
    c.oval(q(-6, 7.0), r * 0.72, r * 0.46, ct, angle=-8)


def _hood_front(c: Canvas, b, q, r):
    """The brim that overlaps the brow, plus the shoulder cowl."""
    ct, cs, ch = B.tones(BUILD.cloth2)
    c.poly([q(-r * 0.30, r * 1.16), q(r * 0.94, r * 0.44), q(r * 0.84, r * 0.06),
            q(-r * 0.34, r * 0.74)], OUTLINE)
    c.poly([q(-r * 0.30, r * 1.06), q(r * 0.84, r * 0.40), q(r * 0.76, r * 0.12),
            q(-r * 0.34, r * 0.68)], ct)
    c.poly([q(-r * 1.24, -r * 0.46), q(r * 0.86, -r * 0.66), q(r * 0.98, -r * 1.30),
            q(-r * 1.36, -r * 1.10)], OUTLINE)
    c.poly([q(-r * 1.14, -r * 0.54), q(r * 0.78, -r * 0.72), q(r * 0.88, -r * 1.20),
            q(-r * 1.26, -r * 1.02)], ct)
    c.poly([q(-r * 1.1, -r * 0.6), q(r * 0.2, -r * 0.70), q(r * 0.2, -r * 0.92),
            q(-r * 1.2, -r * 0.84)], cs)


def _quiver(c: Canvas, j, po):
    lt, ls, lh = B.tones(BUILD.leather, True)
    up, rt = j["up"], j["rt"]
    base = step(step(j["chest"], up, -6), rt, -11)
    top = step(step(j["chest"], up, 12), rt, -15)
    c.limb(base, top, 13, 12, OUTLINE)
    c.limb(base, top, 10.5, 9.5, lt)
    c.limb(step(base, up, 4), step(top, up, -4), 4.5, 4.0, lh)
    for k, dx in enumerate((-3.0, 0.0, 3.0)):
        a = step(top, rt, dx * 0.5)
        tip = (a[0] - 3 + dx * 0.6, a[1] + 12 + abs(dx))
        c.limb(a, tip, 2.6, 2.2, OUTLINE)
        c.limb(a, tip, 1.6, 1.2, (238, 232, 214))
        c.poly([(tip[0] - 2.5, tip[1] - 1), (tip[0] + 2.5, tip[1] - 2), (tip[0], tip[1] + 4)],
               BUILD.accent)


def _bow(c: Canvas, j, po, front: bool):
    """Riser and string. Called twice: limbs behind the archer, string in front."""
    lt, ls, lh = B.tones(BUILD.leather)
    cen = (po["bow_x"], po["bow_y"])
    u = rot((0.0, 1.0), -po["bow_ang"])
    n = (u[1], -u[0])
    pts = []
    for i in range(13):
        t = -1.0 + 2.0 * i / 12
        pts.append(step(step(cen, u, t * LIMB), n, CURVE * (1 - t * t)))
    if not front:
        for a, b2 in zip(pts, pts[1:]):
            c.limb(a, b2, 6.2, 6.2, OUTLINE)
        for a, b2 in zip(pts, pts[1:]):
            c.limb(a, b2, 4.2, 4.2, lt)
        for a, b2 in zip(pts[3:10], pts[4:11]):
            c.limb(a, b2, 1.8, 1.8, lh)
        return
    # an un-nocked bow rests with a straight string; only a drawn one bends
    nock = (po["draw_x"], po["draw_y"])
    segments = ((pts[0], nock), (nock, pts[-1])) if po["arrow"] > 0.5 else ((pts[0], pts[-1]),)
    for a, b2 in segments:
        c.limb(a, b2, 2.6, 2.6, OUTLINE)
        c.limb(a, b2, 1.3, 1.3, (236, 232, 218))
    if po["arrow"] > 0.5:
        d = (cen[0] - nock[0], cen[1] - nock[1])
        ln = math.hypot(*d) or 1.0
        d = (d[0] / ln, d[1] / ln)
        tip = step(nock, d, ln + 20)
        c.limb(nock, tip, 3.4, 3.0, OUTLINE)
        c.limb(nock, tip, 2.0, 1.7, (214, 186, 148))
        c.poly([step(tip, d, 5), step(step(tip, d, -2), (-d[1], d[0]), 3),
                step(step(tip, d, -2), (d[1], -d[0]), 3)], BUILD.metal)
        for s in (1, -1):
            f = step(nock, d, 4)
            c.poly([f, step(step(f, d, 7), (-d[1] * s, d[0] * s), 4),
                    step(f, d, 9)], BUILD.accent)


def draw(pose: dict):
    po = dict(POSE)
    po.update(pose)
    j = B.skeleton(po)
    B.solve_arm(j, "f", (po["bow_x"] - 1, po["bow_y"]), -1)
    B.solve_arm(j, "n", (po["draw_x"], po["draw_y"]), -1)

    c = Canvas(BUILD.cell, BUILD.cell)
    B.cloak(c, BUILD, j, po, sway=po.get("cape_sway", 0.0))
    _quiver(c, j, po)
    _bow(c, j, po, front=False)
    B.arm(c, BUILD, j, "f", True)
    B.leg(c, BUILD, j, "f", True)
    B.torso(c, BUILD, j, po)
    B.leg(c, BUILD, j, "n", False)
    B.head(c, BUILD, j, po, _hood_front, _hood_back)
    B.arm(c, BUILD, j, "n", False)
    bow_u = (po["bow_x"] - po["draw_x"], po["bow_y"] - po["draw_y"])
    ln = math.hypot(*bow_u) or 1.0
    B.fist(c, BUILD, j, "n", (bow_u[0] / ln, bow_u[1] / ln), False)
    B.fist(c, BUILD, j, "f", (0.0, 1.0), True)
    _bow(c, j, po, front=True)
    return B.finish(c, BUILD.cell)
