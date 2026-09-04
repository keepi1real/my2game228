'use strict';
// Иконки приложения для PWA и APK: node tools/make-icons.js
//
// Рисуем их кодом, а не в редакторе: иконка простая (гора, ворота, золотое
// кольцо), а зависимости ради двух картинок ставить незачем. PNG собирается
// вручную — из встроенного zlib и четырёх обязательных чанков.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outDir = path.join(__dirname, '..', 'assets', 'icons');

// ---------- Минимальный кодировщик PNG ----------
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// rgba — Buffer длиной w*h*4, по строке на ряд.
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;    // бит на канал
  ihdr[9] = 6;    // цвет RGBA
  // 10-12: сжатие, фильтр, чересстрочность — все нулевые
  // Перед каждой строкой байт фильтра; нулевой фильтр = хранить как есть.
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Рисование ----------
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const BG = hex('#12121a'), DISC = hex('#1c1c28'), GOLD = hex('#d4a94a'), STONE = hex('#3a3a52'), DARK = hex('#0b0b10');

function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

// Сглаживание по краю фигуры: расстояние в пикселях → доля покрытия.
function cover(d, soft = 1.5) { return Math.max(0, Math.min(1, 0.5 - d / soft)); }

// `pad` — доля поля, которую занимает пустое место по краям. Для maskable-иконки
// Android обрезает углы и края, поэтому рисунок там жмётся к центру.
function drawIcon(size, pad) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const S = size * (1 - pad * 2);          // сторона поля, в котором рисуем
  const o = (u) => c + u * S;              // из долей (-0.5..0.5) в пиксели

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x + 0.5, fy = y + 0.5;
      let col = BG;

      // Диск с золотым кольцом.
      const rd = Math.hypot(fx - c, fy - c);
      col = mix(col, DISC, cover(rd - S * 0.47));

      // Гора: два склона, сходящиеся к вершине. Внутри — тёмный камень.
      const peakY = o(-0.30), baseY = o(0.26);
      const slope = (px2) => {
        // Ширина горы линейно растёт от вершины к основанию.
        const t = (fy - peakY) / (baseY - peakY);
        return Math.abs(fx - c) - t * S * px2;
      };
      if (fy > peakY && fy < baseY) {
        col = mix(col, STONE, cover(slope(0.34)) * cover(-(fy - peakY), 2));
      }
      // Второй, меньший пик слева — чтобы силуэт не был равнобедренным треугольником.
      const p2x = o(-0.20), p2y = o(-0.12);
      if (fy > p2y && fy < baseY) {
        const t2 = (fy - p2y) / (baseY - p2y);
        col = mix(col, STONE, cover(Math.abs(fx - p2x) - t2 * S * 0.17));
      }

      // Врата в основании горы: тёмная арка с золотым контуром.
      const gw = S * 0.10, gh = S * 0.20, gy = baseY;
      const dx = Math.abs(fx - c), dy = gy - fy;
      if (dy > -2 && dy < gh + 2) {
        // Арка = прямоугольник, накрытый полукругом того же радиуса.
        const inArch = dy <= gh - gw
          ? dx - gw
          : Math.hypot(dx, dy - (gh - gw)) - gw;
        col = mix(col, GOLD, cover(inArch - 2.5));
        col = mix(col, DARK, cover(inArch));
      }

      // Земля под горой отрезает всё лишнее ровной линией.
      col = mix(col, DISC, cover(-(fy - baseY)) * cover(rd - S * 0.47));

      // Кольцо поверх всего.
      col = mix(col, GOLD, cover(Math.abs(rd - S * 0.47) - S * 0.012));

      const i = (y * size + x) * 4;
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255;
    }
  }
  return encodePng(size, size, px);
}

fs.mkdirSync(outDir, { recursive: true });
// Обычные иконки рисуем во весь квадрат, maskable — с запасом: Android обрезает
// у неё до 20% с каждой стороны, и рисунок без отступа теряет кольцо.
const jobs = [
  ['icon-192.png', 192, 0.06],
  ['icon-512.png', 512, 0.06],
  ['icon-maskable-512.png', 512, 0.18],
];
for (const [name, size, pad] of jobs) {
  const buf = drawIcon(size, pad);
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log(`${name}  ${size}×${size}  ${(buf.length / 1024).toFixed(1)} КБ`);
}
