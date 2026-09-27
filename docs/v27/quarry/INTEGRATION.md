# Контракт Красного Карьера

- ID уровня/биома: `redquarry`; floor 13; самостоятельный финал, next null.
- 16 комнат; возможные старты 0/5/10; босс 15.
- Регистрацию frozen ExpeditionLevels/BiomeV3 делает общий build до загрузки runtime. Уровень описан JSON; генератор/контрольные суммы/preview storage общие.
- `tools/v27-quarry-runtime.js` после maps: регистрирует `quarry_cleaver`, `quarry_scorcher`, `quarry_cutter`, presentation aliases. Не заменяет старт/сохранение.
- `tools/v27-quarry-combat.js` после runtime: поведение только собственного набора акторов в `redquarry`. Телеграфы используют штатные геометрические виды RootCombat, чтобы snapshot сохранялся.
- `tools/v27-quarry-art.js` после всех существующих map/art wrappers: текстурный карьер и собственные спрайты. Рендер не потребляет игровой RNG и не изменяет коллизии.
- Atlas metadata и исходный промпт в `assets/v27/quarry/`; runtime использует только оптимизированный файл, загрузка по запросу.

Публичные диагностические объекты: `window.V27Quarry`, `window.V27QuarryArt` (карта), `window.V27QuarryCombat` (боевой модуль), дополнительный atlas API художника будет указан в ART.md.

Встроенные элитные/боссовые сундуки и система наград не переопределяются: новая реликвия не выдаётся каждым обычным боем.

Общий harness/build предоставляется главным интегратором трёх карт. Проверка синтаксиса сама по себе не доказывает бой/сохранение/проходимость; фактические результаты помещаются в QA.md.

Готовая диагностика: `V27QuarrySprites` отдельно от `V27QuarryArt`. Рабочие тесты `test-v27-quarry-route.cjs`, `test-v27-quarry-art.cjs`, `test-v27-quarry-combat.cjs` используют локальный `v27-harness.cjs`, либо абсолютный fallback в worktree. У boss JSON base780HP/18dmg; общий build использует standalone combat rank1.
