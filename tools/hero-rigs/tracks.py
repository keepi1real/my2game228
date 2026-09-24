"""Pose tracks. Every state is 8 frames; locomotion loops, attacks do not."""
from __future__ import annotations

import math

TAU = math.tau
N = 8


def _legs(p, stride, lift, bob):
    """A walk/run leg cycle shared by both heroes."""
    sn, sf = math.sin(p), math.sin(p + math.pi)
    return dict(
        hip_y=64.0 - bob + bob * 1.6 * abs(math.sin(p)),
        hip_x=0.5 * math.sin(2 * p),
        thigh_n=stride * sn,
        shin_n=-lift * max(0.0, math.sin(p + 1.35)),
        foot_n=14.0 * sn,
        thigh_f=stride * sf,
        shin_f=-lift * max(0.0, math.sin(p + math.pi + 1.35)),
        foot_f=14.0 * sf,
    )


# --------------------------------------------------------------------- knight
def knight_idle(n=N):
    out = []
    for i in range(n):
        p = TAU * i / n
        b = math.sin(p)
        out.append(dict(
            squash=1.0 + 0.015 * b, hip_y=64.0 + 1.0 * b, lean=-3.0 + 1.2 * b,
            head=3.0 + 1.6 * math.sin(p + 0.7),
            grip_x=21.0 + 0.8 * math.sin(p + 0.3), grip_y=74.0 + 1.2 * b,
            sword_ang=30.0 + 3.0 * math.sin(p + 0.5),
            shield_x=27.0 + 0.7 * b, shield_y=86.0 + 1.1 * b,
            cape_sway=1.5 + 1.5 * math.sin(p + 1.0),
        ))
    return out


def knight_walk(n=N):
    out = []
    for i in range(n):
        p = TAU * i / n
        base = _legs(p, 24.0, 24.0, 2.0)
        base.update(lean=4.0 + 1.0 * math.sin(2 * p), head=1.0 - 1.0 * math.sin(2 * p),
                    grip_x=20.0 + 2.5 * math.sin(p + math.pi), grip_y=73.0 + base["hip_y"] - 64.0,
                    sword_ang=26.0 + 6.0 * math.sin(p + math.pi),
                    shield_x=26.0 + 2.0 * math.sin(p), shield_y=85.0 + base["hip_y"] - 64.0,
                    cape_sway=4.0 + 3.0 * math.sin(p + 0.8))
        out.append(base)
    return out


def knight_run(n=N):
    out = []
    for i in range(n):
        p = TAU * i / n
        base = _legs(p, 38.0, 40.0, 4.0)
        base.update(lean=15.0 + 2.0 * math.sin(2 * p), head=-4.0 - 1.5 * math.sin(2 * p),
                    hip_y=base["hip_y"] + 2.5 * max(0.0, math.sin(2 * p)),
                    grip_x=17.0 + 5.0 * math.sin(p + math.pi), grip_y=72.0,
                    sword_ang=8.0 + 12.0 * math.sin(p + math.pi),
                    shield_x=25.0 + 4.0 * math.sin(p), shield_y=84.0,
                    cape_sway=13.0 + 5.0 * math.sin(p + 0.6))
        out.append(base)
    return out


def knight_attack(n=N):
    # grip_x, grip_y, sword_ang, lean, head, thigh_n, thigh_f, hip_y, shield_x, sway
    keys = [
        (19.0, 82.0, -10.0, -6.0, 6.0, 10.0, -13.0, 65.0, 26.0, 2.0),
        (10.0, 98.0, -48.0, -15.0, 11.0, 7.0, -11.0, 66.0, 22.0, -3.0),
        (4.0, 108.0, -72.0, -21.0, 14.0, 5.0, -10.0, 66.0, 19.0, -7.0),
        (14.0, 106.0, -8.0, -5.0, 5.0, 14.0, -15.0, 65.0, 22.0, -2.0),
        (28.0, 92.0, 62.0, 10.0, -5.0, 25.0, -22.0, 62.0, 30.0, 9.0),
        (33.0, 71.0, 118.0, 21.0, -11.0, 31.0, -27.0, 58.0, 33.0, 14.0),
        (30.0, 62.0, 142.0, 24.0, -12.0, 28.0, -25.0, 56.0, 31.0, 12.0),
        (24.0, 72.0, 52.0, 7.0, 0.0, 18.0, -18.0, 61.0, 28.0, 5.0),
    ]
    out = []
    for gx, gy, sa, ln, hd, tn, tf, hy, sx, sw in keys[:n]:
        out.append(dict(grip_x=gx, grip_y=gy, sword_ang=sa, lean=ln, head=hd,
                        hip_y=hy, thigh_n=tn, shin_n=-tn * 0.55,
                        thigh_f=tf, shin_f=tf * 0.9,
                        shield_x=sx, shield_y=hy + 24.0, cape_sway=sw))
    return out


# --------------------------------------------------------------------- archer
def archer_idle(n=N):
    out = []
    for i in range(n):
        p = TAU * i / n
        b = math.sin(p)
        out.append(dict(
            squash=1.0 + 0.016 * b, hip_y=64.0 + 1.1 * b, lean=-3.0 + 1.3 * b,
            head=3.0 + 1.6 * math.sin(p + 0.7),
            bow_x=33.0 + 0.9 * b, bow_y=90.0 + 1.3 * b, bow_ang=4.0 + 2.5 * math.sin(p + 0.4),
            draw_x=9.0, draw_y=92.0 + 1.2 * b, arrow=0.0,
            cape_sway=1.5 + 1.5 * math.sin(p + 1.0),
        ))
    return out


def archer_walk(n=N):
    out = []
    for i in range(n):
        p = TAU * i / n
        base = _legs(p, 26.0, 26.0, 2.0)
        d = base["hip_y"] - 64.0
        base.update(lean=4.0 + 1.0 * math.sin(2 * p), head=1.0 - 1.0 * math.sin(2 * p),
                    bow_x=30.0 + 2.5 * math.sin(p + math.pi), bow_y=88.0 + d,
                    bow_ang=10.0 + 5.0 * math.sin(p + math.pi),
                    draw_x=11.0 + 1.5 * math.sin(p), draw_y=90.0 + d, arrow=0.0,
                    cape_sway=4.0 + 3.0 * math.sin(p + 0.8))
        out.append(base)
    return out


def archer_run(n=N):
    out = []
    for i in range(n):
        p = TAU * i / n
        base = _legs(p, 40.0, 42.0, 4.0)
        d = base["hip_y"] - 64.0
        base.update(lean=16.0 + 2.0 * math.sin(2 * p), head=-5.0 - 1.5 * math.sin(2 * p),
                    hip_y=base["hip_y"] + 2.5 * max(0.0, math.sin(2 * p)),
                    bow_x=26.0 + 5.0 * math.sin(p + math.pi), bow_y=86.0 + d,
                    bow_ang=26.0 + 10.0 * math.sin(p + math.pi),
                    draw_x=9.0 + 3.0 * math.sin(p), draw_y=88.0 + d, arrow=0.0,
                    cape_sway=13.0 + 5.0 * math.sin(p + 0.6))
        out.append(base)
    return out


def archer_shoot(n=N):
    """Raise, draw, hold, loose, recover. The arrow leaves on release."""
    # bow_x, bow_y, bow_ang, draw_x, draw_y, arrow, lean, head, hip_y
    keys = [
        (31.0, 88.0, 8.0, 12.0, 90.0, 0.0, -2.0, 3.0, 64.0),
        (35.0, 93.0, 2.0, 18.0, 94.0, 1.0, -4.0, 5.0, 64.5),
        (36.0, 94.0, 0.0, 8.0, 95.0, 1.0, -6.0, 6.0, 65.0),
        (37.0, 95.0, -1.0, 0.0, 96.0, 1.0, -8.0, 7.0, 65.0),
        (37.0, 95.0, -1.0, -3.0, 96.0, 1.0, -9.0, 7.0, 65.0),
        (36.0, 94.0, 1.0, 14.0, 95.0, 0.0, -5.0, 5.0, 64.5),
        (34.0, 92.0, 4.0, 20.0, 93.0, 0.0, -2.0, 3.0, 64.0),
        (32.0, 90.0, 6.0, 14.0, 92.0, 0.0, -2.0, 3.0, 64.0),
    ]
    out = []
    for bx, by, ba, dx, dy, ar, ln, hd, hy in keys[:n]:
        out.append(dict(bow_x=bx, bow_y=by, bow_ang=ba, draw_x=dx, draw_y=dy,
                        arrow=ar, lean=ln, head=hd, hip_y=hy,
                        thigh_f=-16.0, shin_f=-15.0, thigh_n=13.0, shin_n=10.0,
                        cape_sway=2.0))
    return out


HEROES = {
    "knight": {"idle": knight_idle, "walk": knight_walk,
               "run": knight_run, "attack": knight_attack},
    "archer": {"idle": archer_idle, "walk": archer_walk,
               "run": archer_run, "shoot": archer_shoot},
}
