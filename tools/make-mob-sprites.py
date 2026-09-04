#!/usr/bin/env python3
"""Готовит присланные вырезы персонажей к игре.

    pip install pillow scipy
    python3 tools/make-mob-sprites.py <файл.webp> <id> [высота]

В присланных исходниках попадается запечённый фон: ровная серая заливка, отрисованная
шахматка прозрачности, полупрозрачная дымка и россыпь непрозрачных блоков-ошмётков.
Скрипт убирает всё это, кадрирует по содержимому и ставит фигуру ступнями к нижнему
краю квадратного холста 256x256 — в том виде, какой ждёт SPRITES в js/visual-assets.js.
"""
from PIL import Image
import numpy as np
from scipy import ndimage
from collections import Counter

CANVAS = 256
FOOT_MARGIN = 7

def _kill_border_regions(im, match, min_share):
    """Гасит альфу там, где match связан с краем кадра и достаточно велик."""
    lab, cnt = ndimage.label(match, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]]))
    if cnt == 0:
        return im
    border = set(lab[0].tolist()) | set(lab[-1].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    border.discard(0)
    sizes = ndimage.sum(match, lab, range(1, cnt + 1))
    kill = [i for i in border if sizes[i - 1] / match.size >= min_share]
    if not kill:
        return im
    out = np.asarray(im).copy()
    out[..., 3] = np.where(np.isin(lab, kill), 0, out[..., 3])
    return Image.fromarray(out, 'RGBA')


def drop_flat_background(im, std_max=5.0, min_share=0.004):
    """Убирает ровную заливку фона: у неё локальный разброс яркости почти нулевой,
    а у персонажа даже на гладкой броне есть фактура."""
    lum = np.asarray(im).astype(np.float32)[..., :3].mean(2)
    mean = ndimage.uniform_filter(lum, 7)
    var = ndimage.uniform_filter(lum * lum, 7) - mean * mean
    return _kill_border_regions(im, np.sqrt(np.maximum(var, 0)) < std_max, min_share)


def drop_checker(im, tol=11, min_bucket_share=0.2, min_share=0.004):
    """Убирает отрисованную шахматку прозрачности. Точные цвета по рамке кадра
    «дрожат» из-за сжатия, поэтому берём не сами цвета, а корзины яркости среди
    обесцвеченных пикселей рамки, и гасим только попавшие в них тона. Тёмная мантия
    или бледный лук в такую корзину не попадают — у них другая яркость."""
    arr = np.asarray(im)
    rgb = arr[..., :3].astype(int)
    sat = rgb.max(2) - rgb.min(2)
    lum = rgb.mean(2)

    edge_lum = np.concatenate([lum[0], lum[-1], lum[:, 0], lum[:, -1]])
    edge_sat = np.concatenate([sat[0], sat[-1], sat[:, 0], sat[:, -1]])
    grey = edge_lum[edge_sat <= 14]
    if grey.size == 0:
        return im
    buckets = Counter((grey // 10).astype(int).tolist())
    picked = [b for b, n in buckets.most_common(2) if n / edge_lum.size >= min_bucket_share]
    if not picked:
        return im

    match = np.zeros(lum.shape, bool)
    for b in picked:
        match |= (sat <= 14) & (np.abs(lum - (b * 10 + 5)) <= tol)
    return _kill_border_regions(im, match, min_share)


def clean_alpha(im, floor=30):
    """Срезает остаточную дымку фона. В исходниках есть полупрозрачный прямоугольник
    с альфой 1-20: он невидим по отдельности, но раздувает габариты, и существо
    после кадрирования масштабируется мельче, чем должно."""
    r, g, b, a = im.split()
    a = a.point(lambda v: 0 if v < floor else min(255, round((v - floor) * 255 / (255 - floor))))
    return Image.merge('RGBA', (r, g, b, a))


def drop_junk(im, min_share=0.01):
    """Выбрасывает мелкие непрозрачные ошмётки в пустой области — мусор от вырезания.
    Оставляем связные области крупнее доли от силуэта: сам персонаж и, если есть,
    отдельно лежащее оружие. Всё мельче — обрывки фона."""
    arr = np.asarray(im).copy()
    a = arr[..., 3]
    mask = a > 8
    lab, cnt = ndimage.label(mask)
    if cnt <= 1:
        return Image.fromarray(arr, 'RGBA')
    sizes = ndimage.sum(mask, lab, range(1, cnt + 1))
    keep = {i + 1 for i, sz in enumerate(sizes) if sz / mask.sum() >= min_share}
    arr[..., 3] = np.where(np.isin(lab, list(keep)), a, 0)
    return Image.fromarray(arr, 'RGBA')


def debleed(im, iters=10):
    """Полупрозрачным пикселям отдаём цвет тела. Иначе по краю остаётся белый
    ореол от фона, из которого вырезали, и на тёмном полу он бросается в глаза."""
    arr = np.asarray(im).astype(np.float32)
    rgb, a = arr[..., :3].copy(), arr[..., 3]
    known = a >= 250
    for _ in range(iters):
        if known.all():
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros(a.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            k = np.roll(known, (dy, dx), (0, 1))
            acc += np.roll(rgb, (dy, dx), (0, 1)) * k[..., None]
            cnt += k
        fill = (~known) & (cnt > 0)
        if not fill.any():
            break
        rgb[fill] = acc[fill] / cnt[fill][..., None]
        known |= fill
    return Image.fromarray(np.dstack([rgb, a]).astype(np.uint8), 'RGBA')

def fit(im):
    """Кадрирует по содержимому и ставит на квадрат, ступни у нижнего края."""
    im = im.crop(im.split()[3].getbbox())
    avail = CANVAS - FOOT_MARGIN - 5
    k = min(avail / im.height, (CANVAS - 12) / im.width)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    out.paste(im, ((CANVAS - im.width) // 2, CANVAS - FOOT_MARGIN - im.height), im)
    return out

def build(path):
    return fit(debleed(drop_junk(clean_alpha(drop_checker(drop_flat_background(Image.open(path).convert('RGBA')))))))

def anchor_y(im):
    return round(im.split()[3].getbbox()[3] / im.height, 3)


if __name__ == '__main__':
    import sys, os
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(1)
    src, ident = sys.argv[1], sys.argv[2]
    height = int(sys.argv[3]) if len(sys.argv) > 3 else 48
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(root, 'assets', 'sprites')
    os.makedirs(out_dir, exist_ok=True)
    sprite = build(src)
    path = os.path.join(out_dir, ident + '.webp')
    sprite.save(path, 'WEBP', quality=92, method=6, exact=True)
    print(f"  {ident}: {{ src: 'assets/sprites/{ident}.webp', "
          f"anchorY: {anchor_y(sprite)}, height: {height} }},   # {os.path.getsize(path) // 1024} КБ")
