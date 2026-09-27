# Дополнение главного инженера: живописное окружение

После первого настоящего Canvas render плоские резервные опоры заменены оригинальными растровыми материалами. Использован встроенный imagegen, исходные результаты сохранены без перекраски/удаления альфы.

* `assets/v27/darkroot/root-props.png`: 1254×1254 RGBA, 57.96% пикселей полностью прозрачны. Просмотрен исходник; четыре неодинаковые области измерены по альфе, предположение о равной сетке отвергнуто.
* `assets/v27/darkroot/root-soil.png`: непрерывная матовая земля без каменных плит. Повтор в мировых координатах с масштабом 0.4, не скользит при движении камеры.

| Тип | Source rect x/y/w/h | Опора внутри rect |
| --- | --- | --- |
| dr_stump | 10, 0, 706, 720 | 360, 690 |
| dr_ring | 778, 0, 470, 699 | 233, 675 |
| dr_cluster | 10, 815, 790, 385 | 390, 348 |
| dr_seedpod | 758, 700, 493, 540 | 250, 515 |

Высокие предметы затухают до alpha 0.34, если перекрывают героя. Растровые корневые скопления обрамляют наружную границу проходимого пола; они не создают новых препятствий и рисуются перед землёй. Старое каменное основание отключено только для darkroot, остальные карты вызывают прежние методы.

После просмотра босса с реальным предупреждением высота декоративного семени ограничена 154 px, низких корневых скоплений — 108 px. Спрайт Сердцевика увеличен до 154 px: яркий реквизит больше не превосходит главного противника по высоте. Эти ограничения меняют только рисование, не сохранённые радиусы/позиции препятствий.

## Задания imagegen

Props: production transparent 2.5D painted RPG sprite atlas, inside an immense ancient root; four separate full objects — twisted root stump, root column with cracked clay graft rings and bronze staples, low cluster of knotted roots, split seedpod with pale green ivory seed. Pine-black/teal/grey-green palette, white fibers, soft top-left light, tactile bark and ceramics, no purple/elf architecture/cubic geometry/text. Four cells requested; фактически получены неравные области, использованы измеренные rects выше.

Soil: seamless matte dry brown-grey soil with muted pine-green undertone, fine organic grain, sparse thin roots and pale fibers, quiet combat-readable contrast. Straight top-down, even diffuse light, no paving/slabs/grid/large objects/runes/rings/focal point/vignette/text. Value target approximately #3c4032.
