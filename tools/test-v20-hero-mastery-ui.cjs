'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ids = ['arator', 'baldin', 'faelas', 'mithrandir', 'peregrin'];
const bonuses = ['+1 броня', '+4% урона', '+3 п. п. шанса крита', '+2 п. п. сокращения перезарядки', '−4% интервал обычных атак'];
const heroes = Object.fromEntries(ids.map((id, i) => [id, { name: `Герой ${i}`, title: `Роль ${i}` }]));
const labels = [];
const detail = { querySelector: () => ({ before: node => labels.push(node.textContent) }) };
const buttons = ids.map(id => ({ dataset: { front: `hero-${id}` }, setAttribute(k, v) { this[k] = v; } }));
const root = { querySelector: () => detail, querySelectorAll: () => buttons };
const context = vm.createContext({
  Save: { data: { heroes: Object.fromEntries(ids.map(id => [id, { level: 9 }])) } },
  HERO_BY_ID: heroes,
  UI: function () {},
  FrontMenu: { paint() {} },
  document: { createElement: () => ({ style: {}, setAttribute() {} }) },
});
context.UI.prototype.renderHeroSelect = function () {};
context.UI.prototype.renderFrontMenu = function () {};
const source = fs.readFileSync(path.join(__dirname, 'v20-hero-mastery-ui.js'), 'utf8');
vm.runInContext(source, context, { filename: 'v20-hero-mastery-ui.js' });
const ui = new context.UI();
ui.root = root;
const ctx = { save() {}, restore() {}, fillRect() {}, fillText(s) { this.last = s; } };
const menu = { heroId: 'arator', layout: { portrait: true, x: 5, rosterY: 50, cardH: 20, unit: 1, bwidth: 350 } };
for (let i = 0; i < ids.length; i++) {
  ui.heroId = menu.heroId = ids[i];
  ui.renderHeroSelect();
  context.FrontMenu.paint(ctx, menu, 0);
  assert.match(labels.at(-1), /откроется через 1 ур\./);
  assert.ok(labels.at(-1).includes(bonuses[i]));
  assert.ok(ctx.last.includes(bonuses[i].split(' ')[0]));
  assert.match(ctx.last, /Мастерство 10/);
  context.Save.data.heroes[ids[i]].level = 10;
  ui.renderHeroSelect();
  assert.match(labels.at(-1), /получено/);
  ui.renderFrontMenu();
  assert.ok(buttons[i]['aria-label'].includes(bonuses[i]));
  assert.ok(buttons[i]['aria-label'].includes(`Герой ${i} — Роль ${i}`));
  assert.match(buttons[i]['aria-label'], /Уровень 10/);
}
assert.equal(labels.length, 10);
console.log('v20 hero mastery UI: five selected heroes, locked/earned state, canvas and accessible labels OK');
