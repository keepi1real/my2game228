# Звуковые эффекты

Пока папка пуста — каждый звук синтезируется рецептом из `js/audio.js`
(`Sound.recipes`). Положенный сюда файл с тем же именем вытесняет рецепт.

После добавления файлов: `node tools/audio-index.js` — он обновляет
`assets/audio.json`, по которому игра узнаёт, за чем идти в сеть. Обе сборки
(`bundle.js`, `make-webdir.js`) делают это сами.

Формат: `mp3`, `ogg` или `wav`. Имя файла = id звука. Одна короткая запись на
файл; игра сама слегка меняет высоту при каждом воспроизведении, чтобы
повторы не звучали одинаково.

Оружие: `hit_sword` `hit_axe` `hit_dagger` `bow_shot` `staff_bolt`
Попадания: `impact_flesh` `impact_crit` `block` `miss`
Герой: `hurt_hero` `death_hero` `dash` `step`
Враги: `death_small` `death_big` `boss_roar`
Мир: `relic_pickup` `chest_open` `zone_enter` `level_up` `talent_learn`
Интерфейс: `ui_click` `ui_open`
Умения: `heal` `shield` `fire` `flash` `shout` `stone_skin` `vanish` `eat`

Пятнадцать умений своих файлов не имеют — по умолчанию они делят звуки по
смыслу через таблицу `Sound.alias`. Чтобы дать умению собственный звук, просто
положите `skill_<id>.mp3` — например `skill_fireball.mp3`. Файл под собственным
именем ищется раньше общего, так что правок в коде не нужно.

Id умений: `dashStrike` `warcry` `herbs` `whirlwind` `stoneSkin` `axeThrow`
`volley` `evade` `trueshot` `fireball` `flash` `barrier` `vanish` `stone`
`breakfast`.
