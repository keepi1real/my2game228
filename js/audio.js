'use strict';
// Звук игры: микшер, музыка по этажам и боевые эффекты.
//
// Записей в репозитории пока нет — музыка и эффекты делаются отдельно и лягут в
// assets/music/ и assets/sfx/. Пока файла нет, звук синтезируется на лету: игра
// звучит с первого запуска, а появившийся файл вытесняет синтез сам, без правок
// кода. Поэтому у каждого звука два тела: путь к файлу и рецепт синтеза.
//
// Имя Sound, а не Audio: Audio — конструктор браузера, и перекрывать его нельзя.

const AUDIO_KEY = 'shadows-undermountain-audio-v1';

// Файл ищется один раз за сессию. Если его нет — id попадает в synthOnly и больше
// не запрашивается: иначе каждый удар мечом стучался бы в сеть за 404.
const Sound = {
  ctx: null,
  master: null, musicBus: null, sfxBus: null,
  settings: { master: 0.9, music: 0.5, sfx: 0.85 },
  buffers: new Map(),      // id -> AudioBuffer
  synthOnly: new Set(),    // id, для которых файла нет
  loading: new Set(),
  lastAt: new Map(),       // id -> время последнего запуска, для тротлинга
  voices: 0,
  cur: { id: null, gain: null, stop: null },   // играющая музыка
  combatTime: 0,           // сколько ещё секунд считаем, что бой идёт
  noise: null,
  started: false,

  // ---------- Настройки ----------
  loadSettings() {
    try {
      const raw = localStorage.getItem(AUDIO_KEY);
      if (raw) Object.assign(this.settings, JSON.parse(raw));
    } catch (e) { /* приватный режим — остаются значения по умолчанию */ }
  },
  persist() {
    try { localStorage.setItem(AUDIO_KEY, JSON.stringify(this.settings)); } catch (e) { /* пусто */ }
  },
  setVolume(bus, v) {
    this.settings[bus] = clamp(v, 0, 1);
    this.persist();
    this.applyVolumes();
  },
  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.02);
    this.musicBus.gain.setTargetAtTime(s.music * this.duck, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.02);
  },
  duck: 1,
  // На паузе и в меню поверх боя музыку приглушаем, а не рвём.
  setDuck(v) { this.duck = v; this.applyVolumes(); },

  // ---------- Запуск ----------
  // Браузер не даёт создать звук до жеста пользователя, поэтому контекст рождается
  // на первом клике или нажатии клавиши, а до того все вызовы тихо ничего не делают.
  // Звук необязателен: в тестовом окружении нет ни AudioContext, ни полного
  // document, и игра обязана работать там ровно так же, только молча.
  install() {
    this.loadSettings();
    const on = (target, ev, fn, opts) => {
      if (target && typeof target.addEventListener === 'function') target.addEventListener(ev, fn, opts);
    };
    const wake = () => { this.start(); };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
      on(typeof window !== 'undefined' ? window : null, ev, wake, { passive: true });
    }
    // В скрытой вкладке rAF не идёт и игра стоит — звук тоже должен молчать,
    // иначе музыка играет из свёрнутого окна.
    on(typeof document !== 'undefined' ? document : null, 'visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else this.ctx.resume().catch(() => {});
    });
  },
  start() {
    if (this.started) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.started = true; return; }   // звука в этом браузере не будет, игра работает
    this.started = true;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyVolumes();
    this.noise = this.makeNoise();
    this.ctx.resume().catch(() => {});
    // Музыку, заказанную до первого клика, включаем теперь.
    if (this.wanted) { const id = this.wanted; this.wanted = null; this.play_music(id, 0.6); }
  },
  get on() { return !!this.ctx && this.ctx.state !== 'closed'; },

  // Две секунды белого шума — основа всех ударов, шагов и свистов.
  makeNoise() {
    const n = Math.floor(this.ctx.sampleRate * 2), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },

  // ---------- Кирпичи синтеза ----------
  // env: экспоненциальный спад. setValueAtTime(0) запрещён для exponentialRamp,
  // поэтому пол — 0.0001, ниже уровня слышимости.
  env(gain, t, peak, attack, decay) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  },
  // Шумовой всплеск через фильтр с разъездом частоты — удары, шаги, свисты.
  burst(t, o) {
    const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise;
    src.playbackRate.value = o.rate || 1;
    f.type = o.filter || 'bandpass';
    f.Q.value = o.q == null ? 1 : o.q;
    f.frequency.setValueAtTime(o.from, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, o.to || o.from), t + o.dur);
    this.env(g, t, o.gain == null ? 0.5 : o.gain, o.attack || 0.004, o.dur);
    src.connect(f); f.connect(g); g.connect(o.bus || this.sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + o.dur + (o.attack || 0.004) + 0.02);
    return g;
  },
  // Тон с разъездом высоты — звоны, гулы, магия, рёв.
  tone(t, o) {
    const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.from, t);
    if (o.to && o.to !== o.from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
    this.env(g, t, o.gain == null ? 0.3 : o.gain, o.attack || 0.005, o.dur);
    let tail = g;
    if (o.filter) {
      const f = c.createBiquadFilter();
      f.type = o.filter; f.frequency.value = o.cutoff || 1200; f.Q.value = o.q || 1;
      g.connect(f); tail = f;
    }
    osc.connect(g); tail.connect(o.bus || this.sfxBus);
    osc.start(t); osc.stop(t + o.dur + (o.attack || 0.005) + 0.02);
    return osc;
  },

  // ---------- Рецепты эффектов ----------
  // Каждый — что звучит, пока нет записи. Имена совпадают с именами файлов в
  // assets/sfx/, поэтому подкладывание записи ничего здесь не ломает.
  recipes: {
    hit_sword(t, v) { this.burst(t, { from: 3200, to: 800, dur: .09, q: .8, gain: .45 * v }); this.tone(t, { type: 'triangle', from: 1700, to: 760, dur: .1, gain: .16 * v }); },
    hit_axe(t, v) { this.burst(t, { from: 1100, to: 220, dur: .15, filter: 'lowpass', q: 1, gain: .5 * v }); this.tone(t, { from: 130, to: 58, dur: .18, gain: .3 * v }); },
    hit_dagger(t, v) { this.burst(t, { from: 5200, to: 2100, dur: .06, q: 1.2, gain: .32 * v }); },
    bow_shot(t, v) { this.burst(t, { from: 1500, to: 3000, dur: .05, q: 2, gain: .3 * v }); this.tone(t, { type: 'triangle', from: 420, to: 160, dur: .12, gain: .12 * v }); },
    staff_bolt(t, v) { this.tone(t, { type: 'sine', from: 520, to: 1500, dur: .16, gain: .22 * v }); this.tone(t + .02, { type: 'sine', from: 1560, to: 3000, dur: .12, gain: .08 * v }); },
    impact_flesh(t, v) { this.burst(t, { from: 900, to: 180, dur: .12, filter: 'lowpass', q: .7, gain: 1.15 * v }); this.tone(t, { from: 190, to: 68, dur: .13, gain: .32 * v }); },
    impact_crit(t, v) { this.burst(t, { from: 4200, to: 900, dur: .12, q: .8, gain: .5 * v }); this.tone(t, { type: 'triangle', from: 2400, to: 1180, dur: .38, gain: .2 * v }); this.tone(t, { from: 150, to: 62, dur: .2, gain: .3 * v }); },
    block(t, v) { this.burst(t, { from: 1800, to: 700, dur: .13, q: 1.6, gain: .38 * v }); this.tone(t, { type: 'square', from: 320, to: 190, dur: .1, gain: .12 * v }); },
    miss(t, v) { this.burst(t, { from: 1400, to: 380, dur: .13, q: .7, gain: .16 * v }); },
    hurt_hero(t, v) { this.tone(t, { type: 'sawtooth', from: 240, to: 150, dur: .2, gain: .2 * v, filter: 'lowpass', cutoff: 900 }); this.burst(t, { from: 700, to: 250, dur: .12, filter: 'lowpass', gain: .25 * v }); },
    death_hero(t, v) { this.tone(t, { type: 'sawtooth', from: 210, to: 62, dur: .9, gain: .26 * v, filter: 'lowpass', cutoff: 700 }); this.burst(t + .45, { from: 900, to: 200, dur: .35, filter: 'lowpass', gain: .3 * v }); },
    death_small(t, v) { this.tone(t, { type: 'square', from: 760, to: 240, dur: .22, gain: .17 * v, filter: 'lowpass', cutoff: 2200 }); this.burst(t + .1, { from: 500, to: 160, dur: .14, filter: 'lowpass', gain: .2 * v }); },
    death_big(t, v) { this.tone(t, { type: 'sawtooth', from: 170, to: 48, dur: .7, gain: .3 * v, filter: 'lowpass', cutoff: 600 }); this.burst(t + .25, { from: 600, to: 90, dur: .5, filter: 'lowpass', gain: .35 * v }); },
    boss_roar(t, v) { this.tone(t, { type: 'sawtooth', from: 120, to: 72, dur: 1.1, gain: .34 * v, filter: 'lowpass', cutoff: 800 }); this.tone(t + .05, { type: 'square', from: 61, to: 38, dur: 1.0, gain: .2 * v, filter: 'lowpass', cutoff: 400 }); this.burst(t, { from: 1200, to: 300, dur: 1.0, filter: 'lowpass', q: .5, gain: .18 * v }); },
    dash(t, v) { this.burst(t, { from: 500, to: 2600, dur: .1, q: .9, gain: .5 * v }); this.burst(t + .1, { from: 2600, to: 400, dur: .16, q: .9, gain: .36 * v }); },
    step(t, v) { this.burst(t, { from: 900, to: 260, dur: .05, filter: 'lowpass', q: .6, gain: .28 * v }); },
    relic_pickup(t, v) { [880, 1320, 1760].forEach((f, i) => this.tone(t + i * .07, { from: f, to: f, dur: .5 - i * .08, gain: .16 * v, type: 'triangle' })); },
    chest_open(t, v) { this.burst(t, { from: 700, to: 1500, dur: .3, q: 3, gain: .18 * v }); [2100, 2640, 1760].forEach((f, i) => this.tone(t + .22 + i * .05, { from: f, to: f, dur: .2, gain: .1 * v, type: 'sine' })); },
    zone_enter(t, v) { this.tone(t, { type: 'sine', from: 90, to: 44, dur: .8, gain: .32 * v }); this.burst(t, { from: 400, to: 90, dur: .75, filter: 'lowpass', q: .5, gain: .3 * v }); },
    level_up(t, v) { [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * .09, { from: f, to: f, dur: .55 - i * .06, gain: .17 * v, type: 'triangle' })); },
    talent_learn(t, v) { this.burst(t, { from: 2600, to: 900, dur: .05, q: 2, gain: .2 * v }); this.tone(t + .04, { type: 'sine', from: 330, to: 440, dur: .5, gain: .14 * v }); },
    ui_click(t, v) { this.burst(t, { from: 2400, to: 1100, dur: .03, q: 2.5, gain: .55 * v }); },
    ui_open(t, v) { this.burst(t, { from: 1800, to: 3400, dur: .22, q: .8, gain: .3 * v }); },
    heal(t, v) { [660, 880, 1100].forEach((f, i) => this.tone(t + i * .06, { from: f, to: f * 1.02, dur: .45, gain: .12 * v, type: 'sine' })); },
    shield(t, v) { this.tone(t, { type: 'sine', from: 180, to: 420, dur: .35, gain: .2 * v }); this.tone(t + .05, { type: 'triangle', from: 900, to: 900, dur: .4, gain: .07 * v }); },
    fire(t, v) { this.burst(t, { from: 300, to: 2400, dur: .12, q: .6, gain: .3 * v }); this.burst(t + .12, { from: 2000, to: 200, dur: .45, filter: 'lowpass', q: .5, gain: .35 * v }); this.tone(t + .12, { from: 160, to: 50, dur: .4, gain: .25 * v }); },
    flash(t, v) { this.burst(t, { from: 3000, to: 7000, dur: .1, q: .6, gain: .22 * v }); this.tone(t, { type: 'sine', from: 2200, to: 3300, dur: .5, gain: .1 * v }); },
    shout(t, v) { this.tone(t, { type: 'sawtooth', from: 190, to: 260, dur: .45, gain: .24 * v, filter: 'lowpass', cutoff: 1400 }); this.burst(t, { from: 700, to: 1500, dur: .4, q: .8, gain: .16 * v }); },
    stone_skin(t, v) { this.burst(t, { from: 1400, to: 200, dur: .4, filter: 'lowpass', q: .7, gain: .3 * v }); this.tone(t + .3, { from: 120, to: 90, dur: .25, gain: .22 * v }); },
    vanish(t, v) { this.burst(t, { from: 3000, to: 600, dur: .45, q: 1.2, gain: .32 * v }); },
    eat(t, v) { this.burst(t, { from: 600, to: 1400, dur: .18, q: 1.5, gain: .16 * v }); this.tone(t + .2, { type: 'sine', from: 400, to: 560, dur: .3, gain: .1 * v }); },
  },

  // Псевдонимы: у пятнадцати умений своих записей не будет — они делят звук по смыслу.
  alias: {
    skill_dashStrike: 'dash', skill_warcry: 'shout', skill_herbs: 'heal',
    skill_whirlwind: 'hit_axe', skill_stoneSkin: 'stone_skin', skill_axeThrow: 'hit_axe',
    skill_volley: 'bow_shot', skill_evade: 'dash', skill_trueshot: 'bow_shot',
    skill_fireball: 'fire', skill_flash: 'flash', skill_barrier: 'shield',
    skill_vanish: 'vanish', skill_stone: 'hit_dagger', skill_breakfast: 'eat',
  },

  // ---------- Проигрывание эффекта ----------
  // vol — громкость, rate — сдвиг высоты. Каждый вызов слегка расстраивается сам,
  // иначе двадцать одинаковых ударов подряд звучат как пулемёт.
  play(id, o = {}) {
    if (!this.on || this.ctx.state === 'suspended') return;
    const t = this.ctx.currentTime;
    // Тротлинг: один и тот же звук не чаще, чем раз в throttle секунд.
    const gap = o.throttle == null ? 0.035 : o.throttle;
    if (gap > 0) {
      const last = this.lastAt.get(id) || -1;
      if (t - last < gap) return;
      this.lastAt.set(id, t);
    }
    if (this.voices > 24) return;        // потолок голосов: на телефоне спасает кадр
    const vol = o.vol == null ? 1 : o.vol;
    const rate = (o.rate == null ? 1 : o.rate) * (1 + (Math.random() - .5) * (o.spread == null ? .12 : o.spread));

    // Порядок поиска: файл под собственным именем, файл общего звука из alias,
    // рецепт. Поэтому положить skill_fireball.mp3 достаточно — правок не нужно.
    const own = this.buffers.get(id);
    if (own) { this.playBuffer(own, t, vol, rate); return; }
    if (!this.synthOnly.has(id)) this.fetchSfx(id);

    const base = this.alias[id] || id;
    if (base !== id) {
      const shared = this.buffers.get(base);
      if (shared) { this.playBuffer(shared, t, vol, rate); return; }
      if (!this.synthOnly.has(base)) this.fetchSfx(base);
    }
    const r = this.recipes[base];
    if (!r) return;
    this.voices++;
    r.call(this, t, vol * (0.9 + Math.random() * 0.2));
    setTimeout(() => { this.voices--; }, 1200);
  },
  playBuffer(buf, t, vol, rate) {
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf; src.playbackRate.value = rate;
    g.gain.value = vol;
    src.connect(g); g.connect(this.sfxBus);
    src.start(t);
    this.voices++;
    src.onended = () => { this.voices--; };
  },

  // ---------- Загрузка записей ----------
  // Один заход за id: не нашли — id уходит в synthOnly и больше не беспокоит сеть.
  fetchSfx(id) { this.fetchAudio(id, 'assets/sfx/' + id, (buf) => this.buffers.set(id, buf)); },
  fetchAudio(id, base, done) {
    if (this.loading.has(id) || this.synthOnly.has(id)) return;
    this.loading.add(id);
    // В автономном файле сети нет: tools/bundle.js кладёт записи в AUDIO_ASSETS
    // как data:-ссылки, и берём мы их оттуда по тому же пути без расширения.
    const packed = window.AUDIO_ASSETS && window.AUDIO_ASSETS[base];
    const tryExt = (exts) => {
      if (!exts.length) { this.loading.delete(id); this.synthOnly.add(id); return; }
      fetch(packed || (base + '.' + exts[0]))
        .then((res) => { if (!res.ok) throw 0; return res.arrayBuffer(); })
        .then((ab) => this.ctx.decodeAudioData(ab))
        .then((buf) => { this.loading.delete(id); done(buf); })
        .catch(() => tryExt(packed ? [] : exts.slice(1)));   // встроенную запись пробуем один раз
    };
    tryExt(['mp3', 'ogg', 'wav']);
  },

  // ---------- Музыка ----------
  // Живая петля: файл, если он есть, иначе синтезированный эмбиент по этому же id.
  // Смена всегда через перекрёстное затухание, поэтому переход бой/тишина не режет.
  wanted: null,
  play_music(id, fade = 1.4) {
    if (!this.on) { this.wanted = id; return; }
    if (this.cur.id === id) return;
    this.stopMusic(fade);
    this.cur = { id, gain: null, stop: null };
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + fade);
    g.connect(this.musicBus);
    this.cur.gain = g;

    const startSynth = () => { if (this.cur.id === id) this.cur.stop = this.synthMusic(id, g); };
    const buf = this.buffers.get('music:' + id);
    if (buf) { this.loopBuffer(buf, g); return; }
    if (this.synthOnly.has('music:' + id)) { startSynth(); return; }
    // Пока файл едет — играет синтез; приедет — подменим на следующей смене трека.
    startSynth();
    this.fetchAudio('music:' + id, 'assets/music/' + id, (buf2) => {
      this.buffers.set('music:' + id, buf2);
      if (this.cur.id !== id) return;
      if (this.cur.stop) this.cur.stop();
      this.cur.stop = null;
      this.loopBuffer(buf2, g);
    });
  },
  loopBuffer(buf, g) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    src.connect(g); src.start(this.ctx.currentTime);
    const prev = this.cur.stop;
    this.cur.stop = () => { try { src.stop(); } catch (e) { /* уже остановлен */ } if (prev) prev(); };
  },
  stopMusic(fade = 1.4) {
    const old = this.cur;
    if (!old.gain) { this.cur = { id: null, gain: null, stop: null }; return; }
    const t = this.ctx.currentTime;
    old.gain.gain.cancelScheduledValues(t);
    old.gain.gain.setValueAtTime(Math.max(0.0001, old.gain.gain.value), t);
    old.gain.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => { if (old.stop) old.stop(); try { old.gain.disconnect(); } catch (e) { /* пусто */ } }, fade * 1000 + 120);
    this.cur = { id: null, gain: null, stop: null };
  },

  // Синтезированный эмбиент: два расстроенных голоса под фильтром плюс «воздух».
  // Не мелодия — подложка, которую можно слушать двадцать минут подряд.
  moods: {
    undermountain: { root: 55, type: 'sawtooth', cutoff: 260, air: 300, lfo: .05 },
    eclipse: { root: 62, type: 'triangle', cutoff: 700, air: 2600, lfo: .09, fifth: 1.5 },
    rootvault: { root: 49, type: 'sawtooth', cutoff: 340, air: 900, lfo: .13 },
    storm: { root: 58, type: 'sawtooth', cutoff: 480, air: 3800, lfo: .16 },
    tide: { root: 44, type: 'sine', cutoff: 300, air: 500, lfo: .07 },
    sunforge: { root: 41, type: 'square', cutoff: 220, air: 700, lfo: .11 },
    amber: { root: 52, type: 'triangle', cutoff: 400, air: 800, lfo: .06 },
    glass: { root: 65, type: 'triangle', cutoff: 1500, air: 4200, lfo: .1, fifth: 1.5 },
    menu: { root: 55, type: 'triangle', cutoff: 500, air: 900, lfo: .05, fifth: 1.5 },
    combat_1: { root: 65, type: 'sawtooth', cutoff: 700, air: 600, lfo: .5, pulse: 2.2 },
    combat_2: { root: 69, type: 'sawtooth', cutoff: 800, air: 700, lfo: .6, pulse: 2.6 },
    combat_3: { root: 58, type: 'sawtooth', cutoff: 600, air: 500, lfo: .4, pulse: 1.7 },
    boss_1: { root: 46, type: 'sawtooth', cutoff: 900, air: 900, lfo: .5, pulse: 2.4, fifth: 1.5 },
    boss_2: { root: 44, type: 'square', cutoff: 700, air: 800, lfo: .35, pulse: 1.9 },
  },
  synthMusic(id, out) {
    const c = this.ctx, m = this.moods[id] || this.moods.undermountain, t = c.currentTime, nodes = [];
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = m.cutoff; filt.Q.value = 1.2;
    filt.connect(out);
    // Медленное дыхание фильтра — без него дрон стоит мёртвым столбом.
    const lfo = c.createOscillator(), lfoGain = c.createGain();
    lfo.frequency.value = m.lfo; lfoGain.gain.value = m.cutoff * .45;
    lfo.connect(lfoGain); lfoGain.connect(filt.frequency); lfo.start(t);
    nodes.push(lfo);

    for (const mult of [1, 1.005, 2, m.fifth || 1.498]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = m.type; o.frequency.value = m.root * mult;
      g.gain.value = mult >= 2 ? .016 : .034;
      o.connect(g); g.connect(filt); o.start(t); nodes.push(o);
    }
    // «Воздух»: тихий отфильтрованный шум, дающий пространство.
    const air = c.createBufferSource(), af = c.createBiquadFilter(), ag = c.createGain();
    air.buffer = this.noise; air.loop = true;
    af.type = 'bandpass'; af.frequency.value = m.air; af.Q.value = .7;
    ag.gain.value = .018;
    air.connect(af); af.connect(ag); ag.connect(out); air.start(t); nodes.push(air);

    // У боевых тем — пульс вместо ударных.
    let pulseTimer = null;
    if (m.pulse) {
      const beat = 1 / m.pulse;
      pulseTimer = setInterval(() => {
        // ctx !== c означает, что контекст пересоздали: эта музыка уже мертва,
        // а таймер бы продолжил стучаться в закрытый контекст.
        if (!this.on || this.ctx !== c || c.state === 'suspended') return;
        const now = c.currentTime;
        this.tone(now, { from: m.root, to: m.root * .7, dur: beat * .7, gain: .07, type: 'square', filter: 'lowpass', cutoff: 200, bus: out });
        this.burst(now, { from: 160, to: 60, dur: .1, filter: 'lowpass', gain: .055, bus: out });
      }, beat * 1000);
    }
    return () => {
      if (pulseTimer) clearInterval(pulseTimer);
      for (const n of nodes) { try { n.stop(); } catch (e) { /* пусто */ } }
      try { filt.disconnect(); } catch (e) { /* пусто */ }
    };
  },

  // ---------- Что должно играть прямо сейчас ----------
  // Вызывается каждый кадр из обёртки update. Бой включается мгновенно, а
  // выключается с задержкой: иначе на каждом добитом гоблине музыка дёргалась бы.
  think(g, dt) {
    if (!this.on) return;
    const s = g.state;
    if (s === 'menu' || s === 'dead' || s === 'victory' || !g.player) {
      this.combatTime = 0;
      this.setDuck(1);
      this.play_music('menu');
      return;
    }
    this.setDuck(s === 'run' ? 1 : 0.45);   // пауза, инвентарь, экран талантов

    const boss = g.boss && g.boss.alive ? g.boss : null;
    if (boss) {
      this.combatTime = 3;
      this.play_music(g.floor >= 7 ? 'boss_2' : 'boss_1');
      return;
    }
    const p = g.player;
    const fighting = g.enemies.some((e) => e.alive && e.state && e.state !== 'idle' && dist(e.x, e.y, p.x, p.y) < 560);
    if (fighting) this.combatTime = 4;
    else this.combatTime = Math.max(0, this.combatTime - dt);

    if (this.combatTime > 0) {
      // Трек боя привязан к этажу, чтобы он не менялся посреди одной стычки.
      this.play_music(['combat_1', 'combat_2', 'combat_3'][g.floor % 3]);
    } else {
      const level = typeof ExpeditionLevels !== 'undefined' && g.journey && g.journey.levelId;
      this.play_music(level || 'undermountain');
    }
  },
};
