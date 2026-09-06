'use strict';
// Service worker: игра должна открываться без сети — иначе смысла в установке
// на телефон нет. Стратегия «сначала кэш» здесь безопасна, потому что все файлы
// статические, а обновление приходит вместе с новым CACHE.
//
// Поднимите CACHE после правок в js/, css/ или assets/, иначе у уже установивших
// игру останется старая версия: старые кэши удаляются в activate по имени.

const CACHE = 'undermountain-expedition-v11-r2';

// Оболочка и все обязательные изображения входят в начальный кэш,
// чтобы после первого запуска каждый из восьми этажей был доступен без сети.
const SHELL = [
  './',
  './index.html',
  './archive.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/visual-assets.css',
  './css/room-visual.css',
  './css/room-route.css',
  './css/front-menu-v4.css',
  './js/utils.js',
  './js/touch.js',
  './js/data.js',
  './js/save.js',
  './js/audio.js',
  './js/dungeon.js',
  './js/entities.js',
  './js/render.js',
  './js/ui.js',
  './js/visual-assets.js',
  './js/game.js',
  './js/room-visual-art.js',
  './js/room-visual-preview.js',
  './js/room-route-data.js',
  './js/room-route.js',
  './js/room-route-render.js',
  './js/biome-config-v3.js',
  './js/expedition-levels.js',
  './js/biome-art-v3.js',
  './js/seamless-floor-data.js',
  './js/seamless-floor.js',
  './js/seamless-floor-render.js',
  './js/bestiary-v6.js',
  './js/actor-animation-v4.js',
  './js/bestiary-combat-v6.js',
  './js/storm-v7.js',
  './js/front-menu-v4.js',
  './js/relics-v8.js',
  './js/relic-ui-v8.js',
  './js/elite-v8.js',
  './js/depths-v9.js',
  './js/progression-v11.js',
  './js/talent-ui-v11.js',
  './js/crown-v11.js',
  './js/audio-hooks.js',
  './js/main.js',
  './assets/crown-v11/amber-atlas.png',
  './assets/crown-v11/amber-terrain.png',
  './assets/crown-v11/glass-atlas.png',
  './assets/crown-v11/glass-terrain.png',
  './assets/recovered-v9/00ba704ad91c157b.png',
  './assets/recovered-v9/02cdd561c425e2d1.webp',
  './assets/recovered-v9/09d6f3708aa79351.webp',
  './assets/recovered-v9/0c37604280605fce.webp',
  './assets/recovered-v9/1097ec1be6494cdc.png',
  './assets/recovered-v9/1ce53d80bb775b0d.png',
  './assets/recovered-v9/1e2edb8cf85b0dde.webp',
  './assets/recovered-v9/217edd95b5cb8a6e.webp',
  './assets/recovered-v9/22a81fe6245d6d38.png',
  './assets/recovered-v9/26f6a2ba16c9bd8b.webp',
  './assets/recovered-v9/27c8c9437b8b20b2.webp',
  './assets/recovered-v9/28c227b7804268f6.webp',
  './assets/recovered-v9/2b5a7e25da393de7.png',
  './assets/recovered-v9/318205eef8f25986.webp',
  './assets/recovered-v9/396d4bea8ed61311.png',
  './assets/recovered-v9/40622ae1a1ba2752.png',
  './assets/recovered-v9/47214fe4696649b3.png',
  './assets/recovered-v9/4a8aa437eaf2f6b9.png',
  './assets/recovered-v9/5003907889809929.png',
  './assets/recovered-v9/5267ab2daaf73f8a.png',
  './assets/recovered-v9/5852ca97ad774164.png',
  './assets/recovered-v9/61d1a78975f9b7e4.webp',
  './assets/recovered-v9/61e143dc83e6ff23.webp',
  './assets/recovered-v9/6f2def79e8a1b3cb.webp',
  './assets/recovered-v9/7d010cebbde2f0e1.webp',
  './assets/recovered-v9/7f998b1a611bd1d0.webp',
  './assets/recovered-v9/8eb1f4ea83897334.png',
  './assets/recovered-v9/9168b5109cb1e05b.png',
  './assets/recovered-v9/99ee88127d6f4130.webp',
  './assets/recovered-v9/9fa3609406a4d3d2.png',
  './assets/recovered-v9/a239904e77c0a785.webp',
  './assets/recovered-v9/a30ea68273459456.png',
  './assets/recovered-v9/a3ce9e139f7178af.webp',
  './assets/recovered-v9/aeaed9ebed580575.png',
  './assets/recovered-v9/b22bb4347cd681a2.png',
  './assets/recovered-v9/b404977b38812d98.png',
  './assets/recovered-v9/b45855b22b0a3bb3.webp',
  './assets/recovered-v9/b9347b74a379712b.png',
  './assets/recovered-v9/c19b630edf099d64.webp',
  './assets/recovered-v9/c2ec897f818d8b5f.webp',
  './assets/recovered-v9/c339c2ecd2a7da88.png',
  './assets/recovered-v9/c6209440101d5ad5.webp',
  './assets/recovered-v9/cac266de1222cd49.webp',
  './assets/recovered-v9/d09a3eda17fc4ccd.png',
  './assets/recovered-v9/e9e18c2a4a5864cb.webp',
  './assets/recovered-v9/fd056d2673d0d0ce.webp',
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
    if (req.mode === 'navigate') {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      } catch (err) {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
        throw err;
      }
    }

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
