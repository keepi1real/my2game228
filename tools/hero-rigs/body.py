"""A humanoid body every rigged hero shares: skeleton, limbs, torso, head.

Characters supply a `Build` (proportions plus palette) and their own gear; the
body code below never knows which hero it is drawing.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from PIL import Image, ImageFilter

from rig import (OUTLINE, SS, Canvas, d_down, d_up, ik, mix, rot, step)

THIGH, SHIN, FOOT = 30, 27, 18
UPARM, FOREARM = 26, 23
SPINE, NECK, HEADOFF = 36, 10, 19


@dataclass
class Build:
    name: str
    skin: tuple
    cloth: tuple            # main garment
    cloth2: tuple           # secondary garment / cloak
    metal: tuple
    leather: tuple
    hair: tuple
    accent: tuple
    legs: tuple | None = None   # defaults to cloth2
    hip_half: float = 10.5
    chest_half: float = 7.0     # added on top of hip_half at the shoulders
    thigh_w: float = 21.0
    shin_w: float = 14.0
    arm_w: float = 19.0
    fore_w: float = 14.0
    head_r: float = 14.5
    shoulder_x: float = 4.2
    cell: int = 192


def tones(c, dim=False):
    """base / shadow / highlight for a colour, dimmed for the far side."""
    base = mix(c, (30, 34, 48), 0.35) if dim else c
    return base, mix(base, (18, 20, 34), 0.45), mix(base, (255, 246, 220), 0.30)


BASE_POSE = dict(
    hip_y=64.0, hip_x=0.0, lean=-3.0, head=3.0, squash=1.0,
    thigh_f=-14.0, shin_f=-13.0, foot_f=0.0,
    thigh_n=12.0, shin_n=9.0, foot_n=0.0,
)


def skeleton(po: dict) -> dict:
    hip = (po["hip_x"], po["hip_y"])
    up = d_up(po["lean"])
    rt = (up[1], -up[0])
    chest = step(hip, up, SPINE * po["squash"])
    neck = step(chest, up, NECK)
    head_c = step(neck, d_up(po["lean"] + po["head"]), HEADOFF)
    j = {"hip": hip, "chest": chest, "neck": neck, "head": head_c, "up": up, "rt": rt}
    for tag, sx in (("f", -1.0), ("n", 1.0)):
        h = (hip[0] + sx * 3.0, hip[1] - 2)
        knee = step(h, d_down(po[f"thigh_{tag}"]), THIGH)
        ankle = step(knee, d_down(po[f"shin_{tag}"]), SHIN)
        toe = step(ankle, d_down(po[f"foot_{tag}"] + 90), FOOT)
        j[f"hip_{tag}"], j[f"knee_{tag}"] = h, knee
        j[f"ankle_{tag}"], j[f"toe_{tag}"] = ankle, toe
        j[f"sh_{tag}"] = step(step(chest, up, 3.0), rt, 4.2 * sx)
    return j


def solve_arm(j, tag, target, sign=-1):
    j[f"hand_{tag}"] = target
    j[f"elb_{tag}"] = ik(j[f"sh_{tag}"], target, UPARM, FOREARM, sign)


# ------------------------------------------------------------------ body parts
def boot(c: Canvas, b: Build, ankle, toe, dim):
    lt, ls, lh = tones(b.leather, dim)
    fwd = 1.0 if toe[0] >= ankle[0] else -1.0
    sole = ankle[1] - 6.0
    heel = (ankle[0] - 3.5 * fwd, sole + 5.0)
    tip = (ankle[0] + 8.5 * fwd, sole + 4.0)
    c.limb_shaded(heel, tip, 11.0, 8.0, lt, ls, lh, stroke=2.2)
    c.limb_shaded((ankle[0] - 0.5 * fwd, ankle[1] + 3.0), heel, 11.0, 10.5, lt, ls, lh, stroke=2.2)
    c.limb(step(heel, (fwd, -0.4), 1.6), step(tip, (-fwd, -0.4), 1.6), 3.4, 2.8, OUTLINE)


def leg(c: Canvas, b: Build, j, tag, dim):
    lt, ls, lh = tones(b.legs or b.cloth2, dim)
    c.limb_shaded(j["hip_" + tag], j["knee_" + tag], b.thigh_w, b.shin_w + 1, lt, ls, lh)
    c.limb_shaded(j["knee_" + tag], j["ankle_" + tag], b.shin_w, b.shin_w - 3, lt, ls, lh)
    boot(c, b, j["ankle_" + tag], j["toe_" + tag], dim)


def arm(c: Canvas, b: Build, j, tag, dim, sleeve=None):
    st, ss, sh = tones(sleeve or b.cloth, dim)
    kt, ks, kh = tones(b.skin, dim)
    S, E, Hd = j["sh_" + tag], j["elb_" + tag], j["hand_" + tag]
    c.limb_shaded(S, E, b.arm_w, b.fore_w + 1, st, ss, sh)
    c.limb_shaded(E, Hd, b.fore_w, b.fore_w - 4, kt, ks, kh)
    v = (Hd[0] - E[0], Hd[1] - E[1])
    mt, ms, mh = tones(b.leather, dim)
    c.limb(step(E, v, 0.42), step(E, v, 0.80), b.fore_w + 1.5, b.fore_w - 2, OUTLINE)
    c.limb(step(E, v, 0.44), step(E, v, 0.78), b.fore_w - 0.5, b.fore_w - 3.5, mt)
    c.limb(step(E, v, 0.50), step(E, v, 0.72), b.fore_w - 6, b.fore_w - 7, mh)


def fist(c: Canvas, b: Build, j, tag, along, dim):
    kt, ks, kh = tones(b.skin, dim)
    Hd = j["hand_" + tag]
    n = (-along[1], along[0])
    a, b2 = step(Hd, n, -4.6), step(Hd, n, 4.6)
    c.limb(a, b2, 11.4, 11.4, OUTLINE)
    c.limb(a, b2, 9.4, 9.4, ks)
    c.limb(step(a, along, 1.2), step(b2, along, 1.2), 7.4, 7.4, kt)
    c.limb(step(a, along, 2.4), step(b2, along, 2.0), 4.0, 3.6, kh)


def torso(c: Canvas, b: Build, j, po):
    hip, chest = j["hip"], j["chest"]
    up, rt = j["up"], j["rt"]
    ct, cs, ch = tones(b.cloth)

    def pt(t, side):
        p = (hip[0] + (chest[0] - hip[0]) * t, hip[1] + (chest[1] - hip[1]) * t)
        w = b.hip_half + b.chest_half * t ** 0.6
        return (p[0] + rt[0] * w * side, p[1] + rt[1] * w * side)

    c.poly([pt(t, 1.16) for t in (0, .3, .6, 1)] + [pt(t, -1.16) for t in (1, .6, .3, 0)], OUTLINE)
    c.poly([pt(t, 1) for t in (0, .25, .5, .75, 1)] +
           [pt(t, -1) for t in (1, .75, .5, .25, 0)], ct)
    c.poly([pt(t, 1.02) for t in (.08, .4, .72, .98)] +
           [pt(t, 0.2) for t in (.98, .72, .4, .08)], ch)
    c.poly([pt(t, -1.02) for t in (.04, .4, .75, 1)] +
           [pt(t, -0.25) for t in (1, .75, .4, .04)], cs)
    # belt
    top = step(hip, up, 5)
    lt, ls, lh = tones(b.leather)
    c.limb(step(top, rt, -b.hip_half - 3), step(top, rt, b.hip_half + 3), 12, 12, OUTLINE)
    c.limb(step(top, rt, -b.hip_half - 2), step(top, rt, b.hip_half + 2), 8.5, 8.5, lt)
    c.oval(step(top, rt, 4), 5.4, 4.4, OUTLINE)
    c.oval(step(top, rt, 4), 4.0, 3.2, b.metal)


def cloak(c: Canvas, b: Build, j, po, sway: float = 0.0):
    """A cape hanging off the shoulders, drawn behind everything."""
    up, rt = j["up"], j["rt"]
    top = step(j["chest"], up, 5)
    ct, cs, ch = tones(b.cloth2)
    hem = (j["hip"][0] - rt[0] * 12 - sway, 5.0)
    c.poly([step(top, rt, -9), step(top, rt, 8),
            (j["hip"][0] + rt[0] * 4 - sway * 0.5, j["hip"][1] - 26),
            hem, (hem[0] - 16, hem[1] + 6)], OUTLINE)
    c.poly([step(top, rt, -8), step(top, rt, 6.5),
            (j["hip"][0] + rt[0] * 3 - sway * 0.5, j["hip"][1] - 26),
            (hem[0] + 1, hem[1] + 1.5), (hem[0] - 13.5, hem[1] + 6)], cs)
    c.poly([step(top, rt, -7), step(top, rt, 0),
            (j["hip"][0] - rt[0] * 2 - sway * 0.5, j["hip"][1] - 26),
            (hem[0] - 7, hem[1] + 4)], ct)


def head(c: Canvas, b: Build, j, po, face_fn=None, pre_fn=None):
    hc = j["head"]
    up = d_up(po["lean"] + po["head"])
    rt = (up[1], -up[0])

    def q(f, u):
        return (hc[0] + rt[0] * f + up[0] * u, hc[1] + rt[1] * f + up[1] * u)

    kt, ks, kh = tones(b.skin)
    if pre_fn:
        pre_fn(c, b, q, b.head_r)
    c.limb(j["neck"], step(j["neck"], up, 9), 14, 12, OUTLINE)
    c.limb(j["neck"], step(j["neck"], up, 8), 11, 9.5, ks)
    r = b.head_r
    c.oval(hc, r + 1.6, r + 1.4, OUTLINE)
    c.oval(hc, r, r - 0.4, kt)
    c.oval(q(-3, 4), r * 0.72, r * 0.42, kh, angle=-7)
    c.oval(q(-r * 0.6, -3), r * 0.5, r * 0.62, ks)
    # jaw and nose
    c.oval(q(r * 0.42, -r * 0.62), r * 0.5, r * 0.36, kt, angle=-12)
    c.poly([q(r * 0.70, -r * 0.30), q(r * 1.02, -r * 0.55), q(r * 0.66, -r * 0.62)], ks)
    # eye
    c.oval(q(r * 0.46, -r * 0.16), 2.9, 2.1, (24, 20, 16), angle=-10)
    c.oval(q(r * 0.52, -r * 0.13), 1.8, 1.3, b.accent, angle=-10)
    c.oval(q(r * 0.58, -r * 0.11), 0.8, 0.9, (255, 250, 232))
    c.poly([q(-r * 0.2, r * 0.12), q(r * 0.82, -r * 0.06),
            q(r * 0.82, -r * 0.26), q(-r * 0.18, -r * 0.08)], ks)
    if face_fn:
        face_fn(c, b, q, r)


def finish(c: Canvas, cell: int) -> Image.Image:
    """One more outline pass around the whole silhouette, then downsample."""
    body = c.img
    a = body.split()[3]
    k = 3 * SS if (3 * SS) % 2 else 3 * SS + 1
    grown = a.filter(ImageFilter.MaxFilter(k)).point(lambda v: 255 if v > 40 else 0)
    out = Image.new("RGBA", body.size, OUTLINE + (0,))
    out.putalpha(grown)
    return Image.alpha_composite(out, body).resize((cell, cell), Image.LANCZOS)
