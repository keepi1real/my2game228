# Rebuilding the five hero rigs

Таррок (`baldin`), Элира (`mithrandir`) и Шелт (`peregrin`) используют общий
суставной скелет из `body.py`, `rig.py` и `new_heroes.py`. Их исходные атласы
состоят из восьми кадров на каждый из пяти рядов: idle, walk, run, attack,
cast. Для их пересборки нужны Python 3 и Pillow:

```sh
python tools/hero-rigs/build_originals.py
```

Ваудин (`knight`) и Илвен (`archer`) используют тот же набор исходных
примитивов, а оригинальные четыре ряда сохраняются побитно. Дополнительные
восемь поз каста создаются из их исходных rig-файлов:

```sh
python tools/hero-rigs/extend_cast.py
```

Команды обновляют атласы в `assets/hero-rigs/` и их манифесты. Внутренние ID
соответствуют старым сохранениям; имена в интерфейсе новые.

Knight: the shield rises as a circular blue ward gathers. Archer: the bow lowers
and green light gathers above the raised palm. Both have eight individually
posed frames and baked light that follows the changing grip.
