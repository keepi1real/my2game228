'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'v20-hero-progression.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(`
  class Player {
    constructor(hero, level, gear) { this.hero = hero; this.level = level; this.gear = gear; }
    armor() { return this.gear.armor; }
    damage() { return this.gear.damage; }
    crit() { return this.gear.crit; }
    cdr() { return this.gear.cdr; }
    speed() { return this.gear.speed; }
  }
  globalThis.Player = Player;
`, context);
vm.runInContext(source, context, { filename: 'v20-hero-progression.js' });

const baseline = { armor: 6, damage: 100, crit: .11, cdr: .59, speed: 150 };
const expected = {
  arator: { armor: 7 },
  baldin: { damage: 104 },
  faelas: { crit: .14 },
  mithrandir: { cdr: .6 },
  peregrin: { speed: 156 },
};
function stats(player) {
  return Object.fromEntries(['armor', 'damage', 'crit', 'cdr', 'speed'].map(k => [k, player[k]()]));
}
for (const id of Object.keys(expected)) {
  const hero = Object.freeze({ id });
  const gear = Object.freeze({ ...baseline });
  for (const level of [1, 9]) {
    assert.deepEqual(stats(new context.Player(hero, level, gear)), baseline, `${id} level ${level}`);
  }
  const upgraded = { ...baseline, ...expected[id] };
  for (const level of [10, 40]) {
    assert.deepEqual(stats(new context.Player(hero, level, gear)), upgraded, `${id} level ${level}`);
  }
  // Real checkpoints serialize level and equipment, then reconstruct Player.
  // Three round trips must never compound a derived bonus or alter old fields.
  let player = new context.Player(hero, 10, gear);
  const checkpoint = JSON.stringify({ heroId: id, level: player.level, gear });
  for (let i = 0; i < 3; i++) {
    const saved = JSON.parse(checkpoint);
    player = new context.Player(hero, saved.level, saved.gear);
    assert.deepEqual(stats(player), upgraded, `${id} resume ${i}`);
    assert.equal(JSON.stringify({ heroId: id, level: player.level, gear: player.gear }), checkpoint);
  }
  assert.deepEqual(gear, baseline);
}
assert.deepEqual(stats(new context.Player({ id: 'unknown' }, 40, baseline)), baseline);
const capped = new context.Player({ id: 'mithrandir' }, 10, { ...baseline, cdr: .6 });
assert.equal(capped.cdr(), .6);
console.log('v20 hero mastery: 5 heroes, level gate, three checkpoint round trips and CDR cap OK');
