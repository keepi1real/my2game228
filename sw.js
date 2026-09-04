'use strict';
// Service worker: игра должна открываться без сети — иначе смысла в установке
// на телефон нет. Стратегия «сначала кэш» здесь безопасна, потому что все файлы
// статические, а обновление приходит вместе с новым CACHE.
//
// Поднимите CACHE после правок в js/, css/ или assets/, иначе у уже установивших
// игру останется старая версия: старые кэши удаляются в activate по имени.

const CACHE = 'undermountain-v1';

// Оболочка: без неё игра не покажет вообще ничего, поэтому кладём её сразу.
// Ассеты (webp) не перечисляем — их десятки, список пришлось бы править руками
// при каждой новой картинке. Они осядут в кэше при первом же запуске.
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/visual-assets.css',
  './js/utils.js',
  './js/touch.js',
  './js/data.js',
  './js/save.js',
  './js/dungeon.js',
  './js/entities.js',
  './js/render.js',
  './js/ui.js',
  './js/visual-assets.js',
  './js/game.js',
  './js/main.js',
];

self.addEventListener('install', (e) => {
  // addAll падает целиком, если хоть один файл не отдался, — поэтому по одному:
  // пропущенная картинка не должна оставить игрока вообще без оффлайна.
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // чужие домены не наше дело

  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      // Кладём в кэш только удачные ответы: 404 в кэше живёт до смены версии.
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch (err) {
      // Сети нет и в кэше пусто. Для навигации отдаём страницу игры,
      // чтобы вместо ошибки браузера человек увидел игру.
      if (req.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
