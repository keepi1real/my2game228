#!/usr/bin/env python3
"""Собирает игровые спрайты из живописных иллюстраций в assets/heroes и assets/enemies.

    pip install pillow rembg onnxruntime
    python3 tools/make-sprites.py

Персонажи на исходных иллюстрациях уже стоят в полный рост лицом к зрителю — это ровно та
поза, которая нужна спрайту. Скрипт снимает фон, поднимает тени, добавляет контровой свет
(без него тёмный силуэт сливается с тёмным полом) и ставит фигуру ступнями к нижнему краю
квадратного холста. Результат кладётся в assets/sprites/ и подключается в js/visual-assets.js.

Модель сегментации (~180 МБ) скачивается при первом запуске.
"""
from PIL import Image, ImageChops, ImageFilter, ImageEnhance
from rembg import remove, new_session

SESSION = new_session('isnet-general-use')
CANVAS = 256          # спрайт показывается максимум на 88 px, 256 даёт запас на плотные экраны
FOOT_MARGIN = 7       # сколько пикселей пустоты оставить под ступнями
TOP_MARGIN = 5

def cutout(path):
    im = Image.open(path).convert('RGBA')
    return remove(im, session=SESSION, alpha_matting=True,
                  alpha_matting_foreground_threshold=250,
                  alpha_matting_background_threshold=15,
                  alpha_matting_erode_size=8)

def clean_alpha(im, floor=26):
    """Убирает дымку из полупрозрачных остатков фона и подрезает бахрому."""
    r, g, b, a = im.split()
    a = a.point(lambda v: 0 if v < floor else min(255, int((v - floor) * 255 / (255 - floor))))
    a = a.filter(ImageFilter.MedianFilter(3))
    return Image.merge('RGBA', (r, g, b, a))

def lift_shadows(im, amount=0.30):
    """Живописные фигуры очень тёмные по тону. На тёмном полу и мелком размере они
    проваливаются в фон, поэтому поднимаем нижнюю часть тонового диапазона."""
    r, g, b, a = im.split()
    lut = [min(255, round(255 * ((v / 255) ** (1 - amount)))) for v in range(256)]
    return Image.merge('RGBA', (r.point(lut), g.point(lut), b.point(lut), a))


def rim_light(im, colour=(226, 236, 248), strength=1.0, dx=-6, dy=-6, spread=1.5):
    """Контровой свет: полоска света по верхне-левому краю плюс слабый ореол по всему контуру.
    Без него тёмный силуэт сливается с тёмным полом подземелья."""
    a = im.split()[3]
    # Направленный край: альфа минус её же сдвиг = полоска с той стороны, откуда светим.
    band = ImageChops.subtract(a, ImageChops.offset(a, dx, dy))
    band = band.filter(ImageFilter.GaussianBlur(spread))
    # Ореол по всему контуру, заметно слабее.
    ring = ImageChops.subtract(a, a.filter(ImageFilter.MinFilter(5)))
    ring = ring.filter(ImageFilter.GaussianBlur(spread))
    # Свет падает сверху, поэтому ореол гасим к низу фигуры: иначе светятся подошвы.
    grad = Image.linear_gradient('L').resize(im.size)          # 0 сверху → 255 снизу
    grad = grad.point(lambda v: int(62 + (255 - v) * 0.76))     # сверху ярко, снизу слабо
    ring = ImageChops.multiply(ring, grad).point(lambda v: int(v * 0.9))
    mask = ImageChops.lighter(band, ring)
    mask = ImageChops.multiply(mask, a).point(lambda v: int(v * strength))
    light = Image.new('RGBA', im.size, colour + (255,))
    out = im.copy()
    out.paste(light, (0, 0), mask)
    out.putalpha(a)
    return out

def punch(im, contrast=1.14, colour=1.12):
    """Уменьшение съедает контраст и цвет — компенсируем заранее."""
    r, g, b, a = im.split()
    rgb = Image.merge('RGB', (r, g, b))
    rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    rgb = ImageEnhance.Color(rgb).enhance(colour)
    return Image.merge('RGBA', rgb.split() + (a,))

def fit_canvas(im):
    """Кадрирует по содержимому и ставит на квадрат 512, ступни у нижнего края."""
    bbox = im.split()[3].getbbox()
    im = im.crop(bbox)
    avail_h = CANVAS - FOOT_MARGIN - TOP_MARGIN
    scale = min(avail_h / im.height, (CANVAS - 20) / im.width)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    out = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    out.paste(im, ((CANVAS - im.width) // 2, CANVAS - FOOT_MARGIN - im.height), im)
    return out

def anchor_y(im):
    rows = im.split()[3].getbbox()
    return round(rows[3] / im.height, 3)

def build(src, **kw):
    lift = kw.pop('lift', 0.30)
    im = clean_alpha(cutout(src))
    im = lift_shadows(im, lift)
    im = punch(im)
    im = rim_light(im, **kw)
    return fit_canvas(im)


# ---------- Партия ----------
# Рост подобран по природе персонажа: эльф выше всех, гном коренастый, хоббит самый мелкий.
# height — высота фигуры на экране в пикселях, её же надо прописать в SPRITES.
BATCH = [
    ('heroes',  'arator',     'heroes/arator.webp',      56, {}),
    ('heroes',  'baldin',     'heroes/baldin.webp',      46, {}),
    ('heroes',  'faelas',     'heroes/faelas.webp',      58, {}),
    ('heroes',  'mithrandir', 'heroes/mithrandir.webp',  56, dict(lift=0.38)),
    ('heroes',  'peregrin',   'heroes/peregrin.webp',    42, {}),
    ('enemies', 'goblin',     'enemies/goblin.webp',     48, {}),
    ('enemies', 'warg',       'enemies/warg.webp',       42, dict(lift=0.36)),
    ('enemies', 'spider',     'enemies/spider.webp',     36, dict(lift=0.40)),
    ('enemies', 'troll',      'enemies/troll.webp',      88, {}),
]

if __name__ == '__main__':
    import os, sys
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src_dir, out_dir = os.path.join(root, 'assets'), os.path.join(root, 'assets', 'sprites')
    os.makedirs(out_dir, exist_ok=True)
    only = set(sys.argv[1:])
    print('Строка для SPRITES в js/visual-assets.js:')
    for group, ident, rel, height, kw in BATCH:
        if only and ident not in only:
            continue
        sprite = build(os.path.join(src_dir, rel), **kw)
        path = os.path.join(out_dir, ident + '.webp')
        sprite.save(path, 'WEBP', quality=92, method=6, exact=True)
        print(f"  {ident}: {{ src: 'assets/sprites/{ident}.webp', "
              f"anchorY: {anchor_y(sprite)}, height: {height} }},   # {os.path.getsize(path) // 1024} КБ")
