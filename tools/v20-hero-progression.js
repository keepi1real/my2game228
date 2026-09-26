// v20 hero mastery: derived from the existing hero ID and level in checkpoints.
// Load after v20-heroes and the historical progression patches. No save fields.
(() => {
  const mastery = player => player.level >= 10 ? player.hero?.id : null;

  const baseArmor = Player.prototype.armor;
  Player.prototype.armor = function () {
    return baseArmor.call(this) + (mastery(this) === 'arator' ? 1 : 0);
  };

  const baseDamage = Player.prototype.damage;
  Player.prototype.damage = function () {
    const damage = baseDamage.call(this);
    return mastery(this) === 'baldin' ? damage * 1.04 : damage;
  };

  const baseCrit = Player.prototype.crit;
  Player.prototype.crit = function () {
    return baseCrit.call(this) + (mastery(this) === 'faelas' ? .03 : 0);
  };

  const baseCdr = Player.prototype.cdr;
  Player.prototype.cdr = function () {
    const cdr = baseCdr.call(this);
    return mastery(this) === 'mithrandir' ? Math.min(.6, cdr + .02) : cdr;
  };

  const baseSpeed = Player.prototype.speed;
  Player.prototype.speed = function () {
    const speed = baseSpeed.call(this);
    return mastery(this) === 'peregrin' ? speed * 1.04 : speed;
  };
})();
