'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {boot,ids,root}=require('./v27-harness.cjs');
async function audit(options={}){
  const h=await boot({teams:Object.keys(ids),...options});
  const {g,a}=h;
  const sentinels=['undermountain-biomes-v3','undermountain-biomes-v20-preview','undermountain-biomes-v21-observatory-preview'];
  for(const key of sentinels)h.storage.set(key,'old-save-sentinel');
  const geometry=()=>JSON.stringify({rooms:g.journey.rooms.map(r=>({id:r.id,center:r.center,polygons:r.polygons,obstacles:r.obstacles})),corridors:g.journey.corridors});
  let starts=0;
  for(const [team,id] of Object.entries(ids))for(const hero of a.HEROES)for(const difficulty of ['journey','veteran']){
    g.startSeamlessJourney(731,hero.id,id,difficulty);
    assert.equal(g.state,'run');assert.equal(g.journey.rooms.length,16);assert.equal(g.floor,1);
    assert.equal(a.AdventureRun.next(g.journey),null);assert.equal(g.hero.id,hero.id);
    assert(!g.map.circleBlocked(g.player.x,g.player.y,g.player.r),'blocked '+team+' '+hero.id);
    assert.equal(g.enemies.filter(e=>e.isBoss&&e.homeRoom===15).length,1);
    for(const e of g.enemies)for(const key of ['x','y','hp','maxHp','dmg','speed'])assert(Number.isFinite(e[key]),`${team} ${e.type}.${key}`);
    const before=geometry();g.saveJourney();assert(g.resumeSeamlessJourney(),team+' resume');assert.equal(geometry(),before,'geometry changed on resume');
    assert.equal(a.SeamlessFloor.key,h.env.V27Preview.key(id));
    g.renderer.render();await h.settleImages();
    h.step(.12);assert.equal(g.state,'run');g.renderer.render();starts++;
  }
  for(const key of sentinels)assert.equal(h.storage.get(key),'old-save-sentinel');
  g.ui.showMenu();for(const id of Object.values(ids))assert(h.ui.innerHTML.includes(`data-v27-start="${id}"`));
  assert.equal((h.ui.innerHTML.match(/data-v27-resume=/g)||[]).length,3);
  g.startSeamlessJourney(42,'arator','undermountain','journey');assert.equal(a.SeamlessFloor.key,'undermountain-biomes-v20-preview');
  assert.equal(g.journey.levelId,'undermountain');assert.equal(a.AdventureRun.next(g.journey),'eclipse');
  console.log(`PASS v27 integration: ${starts} starts (3 maps × 5 heroes × 2 difficulties), finite enemies, full-radius spawn, 30 save/resume geometry checks, old saves untouched, menu and campaign return.`);
  return {starts};
}
if(require.main===module){const roots=process.env.V27_WORKTREES?Object.fromEntries(Object.keys(ids).map(t=>[t,path.join(process.env.V27_WORKTREES,'team-'+t)])):undefined;audit({roots}).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={audit};
