// v20: five distinct combat kits. Keep historical IDs for saves, art and equipment.
// This file is bundled inside the game's classic script after the v19 modules.
(() => {
  const roster = {
    arator: {
      name: 'Кайр', title: 'Страж шва', role: 'КОПЬЁ · ПЕЧАТИ',
      desc: 'Дозорный расколотых врат. Копьём удерживает проход и лечится печатью после удачного натиска.',
      hp: 128, dmg: 15, speed: 145, armor: 3,
      attack: { range: 66, arc: Math.PI * .53, cooldown: .48 },
    },
    baldin: {
      name: 'Тарна', title: 'Литейщица', role: 'МОЛОТ · ПАНЦИРЬ',
      desc: 'Литейщица живой керамики. Разгоняет тяжёлый молот, отбивает окружение и переживает ответный натиск.',
      hp: 178, dmg: 22, speed: 125, armor: 6,
      attack: { range: 58, arc: Math.PI * .86, cooldown: .73 },
    },
    faelas: {
      name: 'Сэйра', title: 'Ловчая эха', role: 'ЛУК · РЕЗОНАНС',
      desc: 'Стрелок с резонансным луком. Бьёт с дистанции, разрезает строй и отступает ценой замедления после выстрела.',
      hp: 88, dmg: 12, speed: 150, armor: 0,
      attack: { type: 'ranged', speed: 510, cooldown: .48, size: 5, color: '#9fe9f1' },
    },
    mithrandir: {
      name: 'Орис', title: 'Хранитель линз', role: 'МАГ · ПРИЗМЫ',
      desc: 'Единственный маг отряда. Запускает взрывные призмы, прерывает замахи и защищается орбитой линз.',
      hp: 83, dmg: 17, speed: 135, armor: 0,
      attack: { type: 'ranged', speed: 410, cooldown: .64, size: 6, color: '#b8f0d8' },
    },
    peregrin: {
      name: 'Нэма', title: 'Ночная связная', role: 'КРЮКИ · СКРЫТНОСТЬ',
      desc: 'Разведчица с парными крюками. Срывает атаки, сближается теневым шагом и добивает раненых.',
      hp: 100, dmg: 10, speed: 165, armor: 1,
      attack: { range: 51, arc: Math.PI * .58, cooldown: .31 },
    },
  };
  for (const hero of HEROES) {
    const entry = roster[hero.id];
    if (!entry) continue;
    const { attack, ...identity } = entry;
    Object.assign(hero, identity);
    Object.assign(hero.attack, attack);
    // The front menu reads this second profile instead of HEROES directly.
    if (typeof HeroRosterV18 !== 'undefined' && HeroRosterV18.entries[hero.id])
      Object.assign(HeroRosterV18.entries[hero.id], identity);
  }

  // v18 contained fifteen actual damage/control skills, but enabled them only
  // for layoutVersion 16. The newer journey layout otherwise fell back to the
  // older and often unrelated abilities. Reuse the collision-aware v18 casts.
  for (const hero of HEROES) for (const id of hero.skills) {
    const profile = HeroAbilitiesV18.profiles[id];
    if (!profile || !HeroAbilitiesV18.cast[id]) continue;
    const skill = SKILLS[id];
    skill.name = profile.name;
    skill.icon = profile.icon;
    skill.desc = profile.description;
    skill.use = (g, p, aim) => {
      const n = Math.hypot(aim.x, aim.y) || 1;
      return HeroAbilitiesV18.cast[id](g, p, { x: aim.x / n, y: aim.y / n });
    };
  }
  // The archer now fires arrows, rather than visually and narratively casting
  // disks. Preserve the existing triple spread, beam hit testing and knockback.
  Object.assign(SKILLS.volley, { name: 'Тройной залп', icon: '➹',
    desc: 'Три стрелы веером, каждая наносит 105% урона.' });
  SKILLS.volley.use = (g, p, a) => {
    const angle = Math.atan2(a.y, a.x);
    for (let i = -1; i <= 1; ++i) {
      const t = angle + i * .20;
      g.spawnProjectile({ x: p.x, y: p.y, vx: Math.cos(t) * 520, vy: Math.sin(t) * 520,
        dmg: p.damage() * 1.05, owner: 'player', size: 5, color: '#9fe9f1', life: .85,
        visualKind: 'arrow', v18Skill: 'volley' });
    }
  };
  Object.assign(SKILLS.trueshot, { name: 'Пронзающая стрела', icon: '➶',
    desc: 'Стрела проходит сквозь строй на 480 ед. и наносит каждой цели 280% урона.' });
  const beamCast = HeroAbilitiesV18.cast.trueshot;
  SKILLS.trueshot.use = (g, p, a) => beamCast(g, p, a);
  HeroAbilitiesV18.describe = (_g, id) => SKILLS[id]?.desc || '';
  // The older layout uses a disk image for every projectile from this art ID.
  // Route the archer back to the shared arrow renderer there as well.
  if (typeof SpellArtV18 !== 'undefined') {
    const oldProjectileKind = SpellArtV18.projectileKind;
    SpellArtV18.projectileKind = function (g, projectile) {
      if (g.hero?.id === 'faelas' && projectile.owner === 'player') return null;
      return oldProjectileKind.call(this, g, projectile);
    };
  }

  // Every ranged basic attack has a short commitment. Its timer is part of
  // Player.buffs and therefore survives the existing checkpoint serializer.
  const oldAttack = Game.prototype.playerAttack;
  Game.prototype.playerAttack = function () {
    const p = this.player;
    const committed = this.state === 'run' && p && p.hero.attack.type === 'ranged'
      && p.attackTimer <= 0 && p.stunTime <= 0 && !p.dash;
    const result = oldAttack.call(this);
    if (committed && p.attackTimer > 0) p.addBuff('v20ShotCommit', 1, .32);
    return result;
  };
  const oldSpeed = Player.prototype.speed;
  Player.prototype.speed = function () {
    return oldSpeed.call(this) * (this.buffStat('v20ShotCommit') ? .68 : 1);
  };

  // Close, visible pursuers catch up to a continuously retreating ranged
  // fighter. This boost is local, bounded and applies only during chase;
  // geometry and windups remain owned by the existing enemy AI.
  const oldEnemyUpdate = Game.prototype.updateEnemy;
  Game.prototype.updateEnemy = function (enemy, dt) {
    const p = this.player;
    const dx = p ? p.x - enemy.x : 0, dy = p ? p.y - enemy.y : 0;
    const d = Math.hypot(dx, dy);
    const chasing = p && p.hero.attack.type === 'ranged' && enemy.alive && !enemy.def.ranged
      && enemy.state === 'chase' && enemy.stun <= 0 && d > 72 && d < 240
      && !p.isInvisible() && this.canReach(enemy, p);
    const beforeX = enemy.x, beforeY = enemy.y;
    const result = oldEnemyUpdate.call(this, enemy, dt);
    if (chasing && enemy.alive && enemy.state === 'chase' && !enemy.telegraph && !enemy.charge
        && (enemy.x !== beforeX || enemy.y !== beforeY)) {
      // Match the navigation direction already selected by updateEnemy.
      this.moveEntity(enemy, (enemy.x - beforeX) * .13, (enemy.y - beforeY) * .13);
    }
    return result;
  };
})();
