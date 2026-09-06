'use strict';
// Привязка звука к событиям игры.
//
// Отдельным файлом и последним в цепочке: остальные слои (v3–v11) тоже
// оборачивают методы Game, и обёртка звука должна стоять снаружи всех — тогда
// она звучит по итогу боя, а не по его середине.
//
// Всё, что здесь делается ради звука, обёрнуто в safe(). Причина не
// теоретическая: game.update вызывает ui.showPause, requestAnimationFrame в
// main.js планируется после update и render, и одно исключение из звуковой
// обёртки останавливало игру навсегда — картинка замирала, а музыка играла
// дальше, потому что Web Audio живёт отдельно от кадров. Звук — украшение,
// и он не имеет права ронять игру ни при каких обстоятельствах.
function safe(fn) {
  try { return fn(); } catch (e) {
    if (!safe.warned) { safe.warned = true; console.warn('Звук: ошибка, дальше играем без него.', e); }
  }
}

Sound.install();

// Какой записью бьёт каждый герой. Ключ — id героя, значение — id звука.
const WEAPON_SFX = {
  arator: 'hit_sword', baldin: 'hit_axe', faelas: 'bow_shot',
  mithrandir: 'staff_bolt', peregrin: 'hit_dagger',
};

const aliveHp = (g) => g.enemies.reduce((s, e) => s + (e.alive ? e.hp : 0), 0);

// ---------- Атака и попадания ----------
const sfxBaseAttack = Game.prototype.playerAttack;
Game.prototype.playerAttack = function () {
  const hpBefore = safe(() => aliveHp(this));
  sfxBaseAttack.call(this);
  safe(() => {
    Sound.play(WEAPON_SFX[this.hero.id] || 'hit_sword', { throttle: 0.05 });
    // Промах слышен отдельно: без этого ближний бой по воздуху звучит как попадание.
    if (this.hero.attack.type === 'melee' && hpBefore != null && aliveHp(this) >= hpBefore) {
      Sound.play('miss', { vol: .6 });
    }
  });
};

const sfxBaseHit = Game.prototype.hitEnemy;
Game.prototype.hitEnemy = function (e, dmg, opts = {}) {
  const hpBefore = e.hp, alive = e.alive;
  sfxBaseHit.call(this, e, dmg, opts);
  safe(() => {
    if (!alive || e.hp === hpBefore) return;
    // Крит определяем по факту: урон заметно выше расчётного без него.
    const crit = (hpBefore - e.hp) > dmg * 1.4;
    Sound.play(crit ? 'impact_crit' : 'impact_flesh', { throttle: 0.04, vol: crit ? 1 : .85 });
  });
};

const sfxBaseHurt = Game.prototype.damagePlayer;
Game.prototype.damagePlayer = function (amount, source) {
  const p = this.player, hp = p ? p.hp : 0, shield = p ? p.shield : 0;
  sfxBaseHurt.call(this, amount, source);
  safe(() => {
    if (!p) return;
    if (p.shield < shield && p.hp === hp) Sound.play('block', { throttle: .06 });
    else if (p.hp < hp && p.hp > 0) Sound.play('hurt_hero', { throttle: .12 });
  });
};

const sfxBaseDie = Game.prototype.playerDie;
Game.prototype.playerDie = function (killer) {
  const was = this.state;
  sfxBaseDie.call(this, killer);
  safe(() => { if (was === 'run') { Sound.stopMusic(1.2); Sound.play('death_hero', { throttle: 0 }); } });
};

const sfxBaseKill = Game.prototype.killEnemy;
Game.prototype.killEnemy = function (e) {
  const boss = e.isBoss, big = e.def && e.def.size >= 20;
  sfxBaseKill.call(this, e);
  safe(() => Sound.play(boss ? 'boss_roar' : big ? 'death_big' : 'death_small', { throttle: boss ? 0 : .05, vol: boss ? 1 : .8 }));
};

// ---------- Умения и рывок ----------
const sfxBaseSkill = Game.prototype.useSkill;
Game.prototype.useSkill = function (i) {
  const ready = this.player && this.player.skillCds && this.player.skillCds[i] <= 0;
  sfxBaseSkill.call(this, i);
  safe(() => { if (ready) Sound.play('skill_' + this.hero.skills[i], { throttle: .05 }); });
};

const sfxBaseDash = Game.prototype.playerDash;
Game.prototype.playerDash = function (p, dir, distance, time, opts) {
  sfxBaseDash.call(this, p, dir, distance, time, opts);
  safe(() => Sound.play('dash', { throttle: .1 }));
};

// ---------- Мир ----------
const sfxBaseChest = Game.prototype.openChest;
Game.prototype.openChest = function (c) {
  const was = c.opened;
  sfxBaseChest.call(this, c);
  safe(() => { if (!was) Sound.play('chest_open', { throttle: 0 }); });
};

if (Game.prototype.chooseRelic) {
  const sfxBaseRelic = Game.prototype.chooseRelic;
  Game.prototype.chooseRelic = function (id) {
    const r = sfxBaseRelic.call(this, id);
    safe(() => Sound.play('relic_pickup', { throttle: 0 }));
    return r;
  };
}

if (Game.prototype.descendSeamlessFloor) {
  const sfxBaseDescend = Game.prototype.descendSeamlessFloor;
  Game.prototype.descendSeamlessFloor = function () {
    const ok = sfxBaseDescend.call(this);
    safe(() => { if (ok) Sound.play('zone_enter', { throttle: 0 }); });
    return ok;
  };
}

// Вход в новую комнату и появление босса. Зоны обновляются каждый кадр, поэтому
// сравниваем с прошлым значением, а не звучим на каждом вызове.
if (Game.prototype.updateSeamlessZones) {
  const sfxBaseZones = Game.prototype.updateSeamlessZones;
  Game.prototype.updateSeamlessZones = function () {
    const room = this.journey ? this.journey.current : null;
    const hadBoss = !!(this.boss && this.boss.alive);
    sfxBaseZones.call(this);
    safe(() => {
      const now = this.journey ? this.journey.current : null;
      if (now != null && now !== room) Sound.play('zone_enter', { throttle: .3, vol: .7 });
      if (!hadBoss && this.boss && this.boss.alive) Sound.play('boss_roar', { throttle: 0 });
    });
  };
}

// Изучение таланта — не метод Game, а модуль прогрессии.
if (typeof AdventureProgress !== 'undefined' && AdventureProgress.learn) {
  const sfxBaseLearn = AdventureProgress.learn;
  AdventureProgress.learn = function (g, id) {
    const ok = sfxBaseLearn.call(this, g, id);
    safe(() => { if (ok) Sound.play('talent_learn', { throttle: 0 }); });
    return ok;
  };
}

// ---------- Шаги ----------
// Шаг отмеряется пройденным расстоянием, а не таймером: тогда он совпадает с
// ногами на экране и молчит, когда герой стоит.
const sfxBasePlayer = Game.prototype.updatePlayer;
Game.prototype.updatePlayer = function (dt) {
  const p = this.player, x = p ? p.x : 0, y = p ? p.y : 0;
  sfxBasePlayer.call(this, dt);
  safe(() => {
    if (!p) return;
    p.stepWalked = (p.stepWalked || 0) + dist(x, y, p.x, p.y);
    if (p.stepWalked >= 38) { p.stepWalked = 0; Sound.play('step', { throttle: .1, vol: .55, spread: .3 }); }
  });
};

// ---------- Музыка ----------
const sfxBaseUpdate = Game.prototype.update;
Game.prototype.update = function (dt) {
  sfxBaseUpdate.call(this, dt);
  safe(() => Sound.think(this, dt));
};

const sfxBaseEnd = Game.prototype.endRun;
Game.prototype.endRun = function (victory) {
  sfxBaseEnd.call(this, victory);
  safe(() => { if (victory) Sound.play('level_up', { throttle: 0 }); });
};

// ---------- Громкость на паузе ----------
// Экранов паузы два: базовый и «Привал» из слоя v11, который его перекрывает.
// Поэтому не правим ни один из них, а дорисовываем ползунки в то, что отрисовалось.
//
// Разметка живёт здесь, а не в ui.js: звук должен целиком выключаться одним
// файлом. Когда она лежала в ui.js, старый ui.js из кэша вместе с новым этим
// файлом валил showPause — и вместе с ним весь игровой цикл.
function volumeHtml() {
  const s = Sound.settings;
  const row = (id, name) => `
    <label class="vol-row"><span>${name}</span>
      <input type="range" min="0" max="100" value="${Math.round(s[id] * 100)}" data-vol="${id}">
      <span class="vol-num" data-num="${id}">${Math.round(s[id] * 100)}</span></label>`;
  return `<div class="volumes">${row('master', 'Звук')}${row('music', 'Музыка')}${row('sfx', 'Эффекты')}</div>`;
}
const sfxBasePause = UI.prototype.showPause;
UI.prototype.showPause = function () {
  sfxBasePause.call(this);
  safe(() => {
    const panel = this.root.querySelector('.panel');
    const buttons = panel && panel.querySelector('.menu-buttons');
    if (!buttons || panel.querySelector('.volumes')) return;
    buttons.insertAdjacentHTML('beforebegin', volumeHtml());
    this.root.querySelectorAll('[data-vol]').forEach((el) => {
      el.addEventListener('input', () => safe(() => {
        const id = el.getAttribute('data-vol');
        Sound.setVolume(id, el.value / 100);
        const num = this.root.querySelector(`[data-num="${id}"]`);
        if (num) num.textContent = el.value;
      }));
    });
  });
};

// ---------- Интерфейс ----------
// Одним делегированным слушателем на весь UI: кнопки перерисовываются целиком
// на каждом экране, и вешать обработчик на каждую пришлось бы бесконечно.
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('click', (e) => {
    safe(() => {
      if (e.target && e.target.closest && e.target.closest('#ui button, #ui .menu-hero, #ui [data-a]')) Sound.play('ui_click', { throttle: .04 });
    });
  }, true);
}
