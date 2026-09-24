"""Sir Vaudin — plate knight with arming sword and kite shield."""
from __future__ import annotations

import math

from rig import OUTLINE, Canvas, d_up, mix, rot, step
import body as B

BUILD = B.Build(
    name="knight",
    skin=(214, 168, 134), cloth=(88, 96, 116), cloth2=(150, 52, 54),
    metal=(158, 168, 182), leather=(96, 66, 42), hair=(58, 44, 34),
    accent=(120, 196, 226), legs=(96, 104, 120),
    hip_half=11.5, chest_half=9.0, thigh_w=23.0, shin_w=15.0,
    arm_w=21.0, fore_w=15.0, head_r=14.0,
)

POSE = dict(B.BASE_POSE, grip_x=21.0, grip_y=74.0, sword_ang=30.0,
            shield_x=27.0, shield_y=86.0, shield_ang=-10.0, plume=0.0)


def _plate(c: Canvas, j, po):
    """Pauldrons, breastplate ridge and tassets over the cloth body."""
    mt, ms, mh = B.tones(BUILD.metal)
    up, rt = j["up"], j["rt"]
    chest = j["chest"]
    c.poly([step(step(chest, up, 2), rt, -13), step(step(chest, up, 2), rt, 13),
            step(step(chest, up, -18), rt, 11), step(step(chest, up, -18), rt, -11)], OUTLINE)
    c.poly([step(step(chest, up, 1), rt, -11.5), step(step(chest, up, 1), rt, 11.5),
            step(step(chest, up, -17), rt, 9.5), step(step(chest, up, -17), rt, -9.5)], mt)
    c.poly([step(step(chest, up, 0), rt, 2), step(step(chest, up, 0), rt, 11),
            step(step(chest, up, -16), rt, 9), step(step(chest, up, -16), rt, 2)], mh)
    c.limb(step(chest, up, -6), step(step(chest, up, -6), rt, 11), 3.0, 3.0, ms)
    # tassets
    hip = j["hip"]
    for s in (-1, 1):
        a = step(step(hip, up, 6), rt, 7 * s)
        c.poly([step(a, rt, -4), step(a, rt, 4), (a[0] + rt[0] * 5 * s, a[1] - 15),
                (a[0] - rt[0] * 4 * s, a[1] - 15)], OUTLINE)
        c.poly([step(a, rt, -3), step(a, rt, 3), (a[0] + rt[0] * 4 * s, a[1] - 13.5),
                (a[0] - rt[0] * 3 * s, a[1] - 13.5)], mt if s > 0 else ms)


def _pauldron(c: Canvas, j, tag, dim):
    mt, ms, mh = B.tones(BUILD.metal, dim)
    s = j["sh_" + tag]
    sx = 1 if tag == "n" else -1
    cen = (s[0] + 1.5 * sx, s[1] + 2.5)
    ang = -12 * sx
    c.oval(cen, 14.2, 10.6, OUTLINE, angle=ang)
    c.oval(cen, 12.4, 9.0, ms, angle=ang)
    c.oval((cen[0], cen[1] + 1.0), 11.0, 7.4, mt, angle=ang)
    c.oval((cen[0] - 1.5 * sx, cen[1] + 3.0), 7.0, 3.4, mh, angle=ang)
    c.oval((cen[0] + 1 * sx, cen[1] - 4.6), 12.0, 3.0, ms, angle=ang)


def _helmet(c: Canvas, b, q, r):
    mt, ms, mh = B.tones(BUILD.metal)
    c.oval(q(-1, 3.5), r * 1.22, r * 1.12, OUTLINE)
    c.oval(q(-1, 3.5), r * 1.10, r * 1.00, mt)
    c.oval(q(-3.5, 7.0), r * 0.66, r * 0.40, mh, angle=-8)
    c.poly([q(-r * 1.0, 1.5), q(r * 1.05, -1.5), q(r * 1.05, -6.0), q(-r * 1.0, -3.5)], OUTLINE)
    c.poly([q(-r * 0.92, 0.6), q(r * 0.96, -2.4), q(r * 0.96, -4.8), q(-r * 0.92, -2.6)], (26, 30, 42))
    c.poly([q(r * 0.30, 1.0), q(r * 1.12, -2.0), q(r * 1.12, -11.0), q(r * 0.40, -9.0)], ms)
    c.limb(q(-1, r * 1.05), q(-1, r * 1.05 + 3), 5, 5, OUTLINE)
    # plume
    ct, cs, ch = B.tones(BUILD.cloth2)
    tip = q(-8 - 2, r * 1.15 + 9)
    c.limb(q(-1, r * 1.05 + 2), tip, 8.0, 3.0, OUTLINE)
    c.limb(q(-1, r * 1.05 + 2), tip, 6.0, 2.0, ct)
    c.limb(q(-2, r * 1.05 + 3), step(tip, (-1, 0), 1), 2.6, 1.2, ch)


def _shield(c: Canvas, j, po):
    """Kite shield strapped to the far forearm."""
    mt, ms, mh = B.tones(BUILD.metal, True)
    ct, cs, ch = B.tones(BUILD.cloth2, True)
    cen = (po["shield_x"], po["shield_y"])
    ang = po["shield_ang"]
    u = rot((0.0, 1.0), -ang)
    n = (u[1], -u[0])
    top = step(cen, u, 20)
    bot = step(cen, u, -25)
    pts = [step(top, n, -14), step(top, n, 14), step(step(cen, u, -4), n, 13),
           bot, step(step(cen, u, -4), n, -13)]
    c.poly([step(p, (p[0] - cen[0], p[1] - cen[1]), 0.10) for p in pts], OUTLINE)
    c.poly(pts, ct)
    c.poly([step(top, n, -13), step(top, n, -1), step(bot, n, 0.5),
            step(step(cen, u, -4), n, -12)], cs)
    c.limb(step(top, n, -10), step(bot, n, 0), 4.4, 3.2, mh)
    c.limb(step(step(cen, u, 6), n, -9), step(step(cen, u, 6), n, 9), 4.0, 4.0, mt)
    c.oval(cen, 4.6, 4.6, OUTLINE)
    c.oval(cen, 3.4, 3.4, mh)


def _sword(c: Canvas, j, po):
    mt, ms, mh = B.tones(BUILD.metal)
    lt, ls, lh = B.tones(BUILD.leather)
    grip = (po["grip_x"], po["grip_y"])
    u = rot((0.0, 1.0), -po["sword_ang"])
    n = (u[1], -u[0])
    pommel = step(grip, u, -8)
    guard = step(grip, u, 7)
    tip = step(guard, u, 58)
    c.limb(pommel, guard, 7.5, 7.5, OUTLINE)
    c.limb(pommel, guard, 5.5, 5.5, lt)
    c.disc(pommel, 4.6, OUTLINE)
    c.disc(pommel, 3.4, mh)
    c.limb(step(guard, n, -13), step(guard, n, 13), 6.5, 6.5, OUTLINE)
    c.limb(step(guard, n, -12), step(guard, n, 12), 4.6, 4.6, mt)
    c.poly([step(guard, n, -4.6), step(guard, n, 4.6),
            step(tip, n, 1.4), step(tip, n, -1.4)], OUTLINE)
    c.poly([step(guard, n, -3.4), step(guard, n, 3.4),
            step(tip, n, 0.9), step(tip, n, -0.9)], mt)
    c.poly([step(guard, n, 0.4), step(guard, n, 3.0),
            step(tip, n, 0.7), step(tip, n, 0.1)], mh)
    return u


def draw(pose: dict):
    po = dict(POSE)
    po.update(pose)
    j = B.skeleton(po)
    B.solve_arm(j, "n", (po["grip_x"], po["grip_y"]), -1)
    B.solve_arm(j, "f", (po["shield_x"], po["shield_y"] - 4), -1)

    c = Canvas(BUILD.cell, BUILD.cell)
    B.cloak(c, BUILD, j, po, sway=po.get("cape_sway", 0.0))
    B.arm(c, BUILD, j, "f", True)
    B.leg(c, BUILD, j, "f", True)
    B.torso(c, BUILD, j, po)
    _plate(c, j, po)
    _pauldron(c, j, "f", True)
    B.leg(c, BUILD, j, "n", False)
    B.head(c, BUILD, j, po, _helmet)
    B.arm(c, BUILD, j, "n", False)
    _pauldron(c, j, "n", False)
    c.limb_shaded(j["elb_f"], j["hand_f"], BUILD.fore_w, BUILD.fore_w - 4,
                  *B.tones(BUILD.metal, True))
    _shield(c, j, po)
    u = _sword(c, j, po)
    B.fist(c, BUILD, j, "n", u, False)
    return B.finish(c, BUILD.cell)
