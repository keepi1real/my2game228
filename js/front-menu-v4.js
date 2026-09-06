'use strict';
// One canvas composition + native DOM buttons. Layout data is shared between
// painting and hit targets; keyboard, screen reader and touch use real buttons.
const FrontMenu = (()=>{
  const backdrop=loadImage('assets/crown-v11/glass-terrain.png');
  const roles={arator:'МЕЧ · РЫВОК',baldin:'ТОПОР · ВИХРЬ',faelas:'ЛУК · ЗАЛП',mithrandir:'ПОСОХ · ОГОНЬ',peregrin:'КИНЖАЛ · ТЕНЬ'};
  function checkpoint(){try{const d=JSON.parse(localStorage.getItem(SeamlessFloor.key));return d&&[3,4].includes(d.version)&&(d.version===3||ExpeditionLevels.get(d.levelId))&&d.player?.hp>0&&Array.isArray(d.rooms)&&d.rooms.length===16?d:null;}catch(e){return null;}}
function layout(w=1024,h=640,saved=false){
    const portrait=h>w,wide=w/h>1.9,unit=portrait?Math.min(w/720,h/1280):Math.min(w/1024,h/640),x=portrait?48*unit:58*unit;
    const bwidth=portrait?w-x*2:354*unit,rosterY=portrait?h*.49:285*unit,cardW=(bwidth-4*8*unit)/5,cardH=portrait?104*unit:62*unit;
    const mainY=rosterY+cardH+(portrait?100:58)*unit,buttonH=(portrait?88:58)*unit;
    const boxes=HEROES.map((hero,i)=>({id:'hero-'+hero.id,hero:hero.id,label:hero.name+' — '+hero.title,x:x+i*(cardW+8*unit),y:rosterY,w:cardW,h:cardH}));
    boxes.push({id:saved?'continue':'new',label:saved?'Продолжить поход':'Начать поход',x,y:mainY,w:bwidth,h:buttonH,primary:true});
    boxes.push({id:saved?'new':'amber',label:saved?'Новый поход':'Некрополь · этаж VII',x,y:mainY+buttonH+12*unit,w:bwidth,h:(portrait?76:44)*unit});
    const footerY=mainY+buttonH+(portrait?112:68)*unit,footerItems=['camp','help','campaign','floors','archive'],fw=(bwidth-32*unit)/footerItems.length;
    for(const [i,id] of footerItems.entries())boxes.push({id,label:id==='camp'?'Лагерь':id==='help'?'Помощь':id==='campaign'?'Кампания':id==='floors'?'Этажи':'Архив',x:x+i*(fw+8*unit),y:footerY,w:fw,h:(portrait?72:44)*unit,quiet:true});
    return {w,h,portrait,wide,unit,x,bwidth,rosterY,cardH,mainY,boxes,heroX:portrait?w*.66:w*.745,heroY:portrait?rosterY-30*unit:h*.79,heroHeight:portrait?335*unit:300*unit};
  }
  function text(c,label,x,y,size,color='#e9debf',align='left',serif=false){c.font=(serif?'':'500 ')+size+'px '+(serif?'Georgia, serif':'Arial, sans-serif');c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(label,x,y);}
  function paint(c,menu,time){
    const L=menu.layout,{w,h,unit:u,x,portrait}=L,hero=HERO_BY_ID[menu.heroId];
    c.save();c.fillStyle='#07141c';c.fillRect(0,0,w,h);
    if(ready(backdrop)){const scale=Math.max(w/backdrop.width,h/backdrop.height)*1.08,iw=backdrop.width*scale,ih=backdrop.height*scale;c.drawImage(backdrop,(w-iw)/2+Math.sin(time*.08)*6,(h-ih)/2,iw,ih);}
    let gr=c.createLinearGradient(0,0,w,0);gr.addColorStop(0,'rgba(4,13,20,.98)');gr.addColorStop(portrait?.5:.4,'rgba(4,13,20,.84)');gr.addColorStop(1,'rgba(4,13,20,.2)');c.fillStyle=gr;c.fillRect(0,0,w,h);
    gr=c.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(3,11,18,.3)');gr.addColorStop(.48,'rgba(3,11,18,.1)');gr.addColorStop(1,'rgba(3,11,18,.97)');c.fillStyle=gr;c.fillRect(0,0,w,h);
    c.strokeStyle='rgba(177,158,102,.25)';c.lineWidth=u;c.strokeRect(20*u,20*u,w-40*u,h-40*u);
    // The right side is a living character stage, not another navigation panel.
    ActorMotion.glow(c,L.heroX,L.heroY-L.heroHeight*.6,L.heroHeight,hero.color,.24);
    ActorMotion.rune(c,L.heroX,L.heroY+6*u,L.heroHeight*.4,time*.1,'#b5aa70',.45);
    c.save();c.translate(L.heroX,L.heroY);const s={phase:0,walk:0,age:time,facing:-1,left:0,total:1,hit:0,angle:Math.PI};ActorMotion.draw(c,'heroes',hero.id,{x:0,y:0,aim:{x:-1,y:0}},{height:L.heroHeight,state:s});c.restore();
    for(let i=0;i<32;i++){const sx=((i*173.3+Math.sin(time*.4+i)*15)%(w*.64))+w*.36,sy=(h-i*97-time*(7+i%5))%h;c.fillStyle=i%4?'rgba(160,221,200,.25)':'rgba(246,196,113,.55)';c.beginPath();c.arc(sx,(sy+h)%h,(i%3+1)*u*.6,0,Math.PI*2);c.fill();}
    const titleY=portrait?75*u:88*u;
    text(c,'НОВЫЕ БИОМЫ · АРТЕФАКТЫ · ТАЛАНТЫ',x,titleY,portrait?18*u:10*u,'#d6b095');
    text(c,'ТЕНИ',x,titleY+48*u,(portrait?58:53)*u,'#f2e8cc','left',true);
    text(c,'ПОДГОРЬЯ',x,titleY+106*u,(portrait?58:53)*u,'#e6cb8e','left',true);
    c.fillStyle='#baa06b';c.fillRect(x,titleY+146*u,58*u,u);
    if(!portrait){text(c,'Выбирай силу. Найди свой путь.',x,251*u,13*u,'#b9c3d7');}
    else{text(c,'Выбирай силу. Найди свой путь.',x,titleY+181*u,22*u,'#b9c3d7');}
    text(c,'ВЫБЕРИ ГЕРОЯ',x,L.rosterY-18*u,(portrait?20:10)*u,'#9eb8b2');
    for(const b of L.boxes){
      const hover=menu.focus===b.id,chosen=b.hero===hero.id;c.save();
      c.fillStyle=b.hero?(chosen?'rgba(131,107,53,.48)':'rgba(5,17,24,.84)'):b.primary?'rgba(166,129,60,.93)':b.id==='amber'?'rgba(42,91,86,.93)':b.quiet?'rgba(5,15,22,.45)':'rgba(14,32,39,.9)';
      c.fillRect(b.x,b.y,b.w,b.h);c.strokeStyle=chosen||b.primary?'#d6bc7c':hover?'#e1d2aa':'rgba(125,155,147,.35)';c.lineWidth=hover?2*u:u;c.strokeRect(b.x,b.y,b.w,b.h);
      if(b.hero){const img=artImage('portrait','heroes',b.hero);if(ready(img)){c.save();c.beginPath();c.rect(b.x+u,b.y+u,b.w-2*u,b.h-2*u);c.clip();const d=portraitDef('heroes',b.hero),sw=img.width/(d.zoom||2),sh=sw*(b.h/b.w),sx=img.width*(d.focusX||.5)-sw/2,sy=Math.max(0,img.height*(d.focusY||.2)-sh*.38);c.drawImage(img,sx,sy,sw,sh,b.x,b.y,b.w,b.h);c.restore();}if(chosen){c.strokeStyle='#efd69a';c.lineWidth=2*u;c.strokeRect(b.x,b.y,b.w,b.h);c.fillStyle='#eed497';c.fillRect(b.x+b.w/2-3*u,b.y+b.h-2*u,6*u,4*u);}}
      else {text(c,b.label,b.primary?b.x+22*u:b.x+b.w/2,b.y+b.h/2,(portrait?(b.quiet?21:27):(b.quiet?12:b.primary?18:14))*u,b.primary?'#111b20':'#d7dacb',b.primary?'left':'center');if(b.primary)text(c,'→',b.x+b.w-28*u,b.y+b.h/2,25*u,'#111b20','center');}
      c.restore();
    }
    text(c,hero.name+' / '+roles[hero.id],x,L.rosterY+L.cardH+24*u,(portrait?23:12)*u,'#e8d7ad');
    text(c,AdventureProgress.heroes[hero.id][1],x,L.rosterY+L.cardH+(portrait?59:43)*u,(portrait?18:10)*u,'#d6b095');
    if(portrait){}
    else{text(c,hero.name.toUpperCase(),L.heroX,L.heroY+28*u,20*u,'#e9dbad','center',true);text(c,hero.title,L.heroX,L.heroY+54*u,11*u,'#bfd1c5','center');}
    text(c,menu.error||'8 ЭТАЖЕЙ · 12 ТАЛАНТОВ · 6 АРТЕФАКТОВ',x,h-39*u,(portrait?16:9)*u,menu.error?'#ffb299':'#c1a38b');
    c.restore();
  }
  function size(){const ww=window.innerWidth||1024,hh=window.innerHeight||640;return ww<hh?{w:720,h:Math.round(720*hh/ww)}:{w:Math.round(640*ww/hh),h:640};}
  return {checkpoint,layout,paint,size};
})();

const frontBaseUIRender=UI.prototype.render,frontBaseHide=UI.prototype.hide;
function closeFront(ui){if(!ui.g.frontMenu)return;ui.g.frontMenu=null;ui.g.canvas.width=VIEW_W;ui.g.canvas.height=VIEW_H;if(ui.g.canvas.style)ui.g.canvas.style.cssText='';}
UI.prototype.render=function(html){if(!html.includes('data-front-surface'))closeFront(this);return frontBaseUIRender.call(this,html);};
UI.prototype.hide=function(){closeFront(this);return frontBaseHide.call(this);};
UI.prototype.showMenu=function(){
  this.g.input.keys={};this.g.input.pressed={};this.g.input.mouse.down=false;
  const old=this.g.frontMenu,save=FrontMenu.checkpoint(),size=FrontMenu.size(),heroId=old?.heroId||save?.heroId||Save.data.lastHero||'arator';
  this.g.frontMenu={heroId:HERO_BY_ID[heroId]?heroId:'arator',layout:FrontMenu.layout(size.w,size.h,!!save),saved:!!save,focus:old?.focus,error:old?.error||''};
  this.renderFrontMenu();
};
UI.prototype.renderFrontMenu=function(){
  const m=this.g.frontMenu,L=m.layout;this.g.canvas.width=L.w;this.g.canvas.height=L.h;
  if(this.g.canvas.style)this.g.canvas.style.cssText='width:100vw;height:100vh;max-width:none;max-height:none;image-rendering:auto;cursor:default';
  this.render(`<div class="front-surface" data-front-surface role="region" aria-label="Главное меню. Тени Подгорья"><h1 class="front-sr">Тени Подгорья</h1><p class="front-sr">Выберите героя для бесшовного Подгорья. Все пять героев доступны в этом походе. Кампания сохраняет свои открытия и прогресс.</p>${L.boxes.map(b=>`<button class="front-hit" data-front="${b.id}" ${b.hero?`aria-pressed="${b.hero===m.heroId}"`:''} style="left:${b.x/L.w*100}%;top:${b.y/L.h*100}%;width:${b.w/L.w*100}%;height:${b.h/L.h*100}%" aria-label="${b.label}"><span class="front-sr">${b.label}</span></button>`).join('')}</div>`);
  this.bind('[data-front]','click',el=>this.frontAction(el.dataset.front));
  this.bind('[data-front]','focus',el=>{if(this.g.frontMenu)this.g.frontMenu.focus=el.dataset.front;});
  this.bind('[data-front]','pointerenter',el=>{if(this.g.frontMenu)this.g.frontMenu.focus=el.dataset.front;});
  this.bind('[data-front]','pointerleave',()=>{if(this.g.frontMenu)this.g.frontMenu.focus=null;});
};
UI.prototype.frontAction=function(id){
  const m=this.g.frontMenu;if(!m)return;
  if(id.startsWith('hero-')){const heroId=id.slice(5);if(!HERO_BY_ID[heroId])return;m.heroId=heroId;for(const el of this.root.querySelectorAll('[data-front^="hero-"]'))el.setAttribute('aria-pressed',String(el.dataset.front==='hero-'+heroId));return;}
  if(id==='new'){const h=m.heroId;this.g.startSeamlessJourney(undefined,h);}
  else if(id==='tide'||id==='sunforge'||id==='amber'||id==='glass')this.g.startSeamlessJourney(undefined,m.heroId,id);
  else if(id==='storm')this.g.startSeamlessJourney(undefined,m.heroId,'storm');
  else if(id==='rootvault')this.g.startSeamlessJourney(undefined,m.heroId,'rootvault');
  else if(id==='floors')this.showExpeditionFloors(m.heroId);
  else if(id==='eclipse')this.g.startSeamlessJourney(undefined,m.heroId,'eclipse');
  else if(id==='continue'){if(!this.g.resumeSeamlessJourney()){m.error='Сохранение недоступно. Начните новый поход.';m.saved=false;m.layout=FrontMenu.layout(m.layout.w,m.layout.h,false);this.renderFrontMenu();}}
  else if(id==='campaign')this.showHeroSelect();
  else if(id==='camp')this.showCamp('upgrades');
  else if(id==='help'||id==='about')this.showExpeditionHelp();
  else if(id==='archive'){window.location.href='archive.html';}
};
UI.prototype.showExpeditionFloors=function(heroId){
  const descriptions={amber:'Янтарный некрополь: саркофаги, смоляные сады, Могильные стражи и Кадильщики. Янтарный царь отмечает печати и бьёт широким сектором.',glass:'Сады Лунного Стекла: серебряные ивы, зеркальные галереи, Дуэлянты и Призматическая моль. Хранительница перекрещивает лучи и создаёт лунные кольца.',tide:'Затопленные архивы: петли сухих галерей над нефритовой водой. Хранитель прилива поднимает кольцо воды и веер волн.',sunforge:'Кузня Чёрного Солнца: базальтовые дворы, горны и наковальни. Кузнец затмения преследует героя серией ударов молота.',storm:'Ледяная цитадель. Погасите два маяка, чтобы ослабить Архонта Бури. Кузница и картографы предлагают награды на выбор.',undermountain:'Корни, бронзовый бастион и пепельные горны. Хранитель Пепельной Короны.',eclipse:'Звёздные архивы, лунные сады и Астроном Пустоты.',rootvault:'Грибные сады, красные корни и колокольни. Четыре новых вида стражей, Звонарь и Матерь корней.'};
  this.render(`<div class="overlay overlay-front"><div class="panel expedition-help"><h2>Выбери начало похода</h2><p>Герой: ${HERO_BY_ID[heroId].name}. Каждый этаж — 16 зон с открытыми переходами. Прямой вход заменяет сохранение и даёт подходящий стартовый уровень, оружие и до 5 очков талантов.</p>${Object.values(ExpeditionLevels.levels).map(l=>`<h3>${l.floor}. ${l.name}</h3><p>${descriptions[l.id]}</p><button data-expedition="${l.id}">Начать: ${l.name}</button>`).join('')}<button class="primary" data-floor-back>Вернуться</button></div></div>`);
  this.bind('[data-expedition]','click',el=>{const id=el.dataset.expedition;if(ExpeditionLevels.get(id))this.g.startSeamlessJourney(undefined,heroId,id);});
  this.bind('[data-floor-back]','click',()=>this.showMenu());
};
UI.prototype.showExpeditionHelp=function(){
  this.render('<div class="overlay overlay-front"><div class="panel expedition-help"><h2>Восемь этажей Подгорья</h2><p>Начните поход у Пепельной Короны: 16 залов, открытые переходы, сундуки и родники. Победите Хранителя и его охрану — лестница приведёт в Обсерваторию затмения с вашим героем и снаряжением.</p><p>На втором этаже — ещё 16 зон, звёздные архивы, лунные сады и Астроном Пустоты. Его залпы и призванная охрана защищают лестницу в Багряный корнесвод. Все обычные залы зачищать необязательно: можно искать короткий путь или награды в ответвлениях.</p><p>Третий этаж — Багряный корнесвод. Ловчий бросается по отмеченной полосе; Панцирник бьёт перед собой; Певчий оставляет опасные споры; Моль выпускает три искры. Уйдите с подсвеченной области до завершения круга подготовки. Внутри кольца Звонаря безопасно, а от разломов Матери корней можно уйти по диагонали. Оглушение прерывает подготовку новых врагов.</p><p>Звонарь охраняет сундук в ответвлении. Финальная лестница откроется после Матери корней и всей её охраны. Кнопка «Этажи» позволяет выбрать любой из восьми этажей. Прямой вход запускает нового героя и заменяет сохранение похода. Открытия кампании хранятся отдельно.</p><p>После Корнесвода лестница ведёт в Цитадель Белой Бури. Маяки ослабляют урон и броню Архонта, но гасить их необязательно. Кузница даёт +15% урона или +3 брони до конца похода. Картографы предлагают раскрытие карты либо лечение с зельем. Каждый выбор можно сделать один раз. Архонт помечает полосы ветра и круги молнии; уйдите с них до удара. Лестница за его троном ведёт в Затопленные архивы — пятый этаж.</p><p>Пятый этаж — Затопленные архивы. Вода окружает сухие галереи с петлями и ответвлениями. Хранитель прилива поднимает кольцо воды: внутри и снаружи безопасно. От веера волн можно уйти за спину. После него лестница ведёт на шестой этаж — в Кузню Чёрного Солнца.</p><p>В Кузне чередуются литейные дворы, террасы и залы наковален. Кузнец затмения отмечает место каждого удара молота заново: продолжайте двигаться между ударами. Во второй фазе ударов три, а огненные полосы поворачиваются. Оглушение прерывает серию. Победите его и всю охрану: лестница ведёт в Янтарный некрополь, а затем в Сады Лунного Стекла. Только лестница после Хранительницы и её охраны завершает поход.</p><h3>Реликвии и элитная стража</h3><p>После зачистки боевого или элитного зала появляется реликвия. Подойдите и нажмите E: выберите одну из трёх наград. В окне выбора бой на паузе. Реликвию можно оставить и забрать позже — она отмечена ромбом на карте. Усиления действуют до конца похода и имеют три ранга. Собранные ранги видны в инвентаре. Лечение применяется сразу; зелье и огненный свиток пополняют запас.</p><p>Элитный страж отмечен руной и именем приёма. «Гул глубин» создаёт кольцо: внутри и снаружи него безопасно. «Печать пепла» оставляет круг на месте героя: выйдите из него. Подготовка длится 1,2 секунды; оглушение её прерывает.</p><h3>Таланты и артефакты</h3><p>K или «Таланты героя» в паузе открывает три ветки по четыре узла. Нужен предыдущий узел ветки и одно очко. В походе с первого этажа доступно одно очко; каждые четыре зачистки боевых, элитных залов или боссов дают ещё одно, максимум девять. При прямом входе на поздний этаж доступно до пяти стартовых очков. Выбор действует до конца похода; в окне талантов бой на паузе.</p><p>В Некрополе и Лунных садах некоторые награды предлагают уникальный артефакт. Его можно взять один раз: эффекты описаны в карточке и инвентаре. Усиления и таланты сохраняются при спуске и продолжении похода. Кампания хранится отдельно.</p><h3>Приёмы героев</h3><p>Аратор: третий удар серии сильнее на 60%, пауза 3 секунды или промах обрывает серию. Балдин: после потери здоровья или щита следующая попавшая обычная атака за 5 секунд сильнее на 50% и даёт щит 6 ед. на 3 секунды. Фаелас: обычная стрела от 170 ед. сильнее на 25%. Митрандир: умение заряжает следующий выстрел посоха двойным уроном на 6 секунд. Перегрин: рывок готовит критический удар на 3 секунды; восстановление приёма 4 секунды.</p><h3>На телефоне</h3><p>Левый стик — движение. Справа — атака, рывок и три умения. Кнопка E появляется рядом с реликвией, сундуком, родником или лестницей. Карта доступна из паузы.</p><h3>На компьютере</h3><p>WASD — движение · мышь — прицел · ЛКМ / пробел — атака · 1, 2, 3 — умения · Shift — рывок · F — лечение · E — действие · M — карта · Esc — пауза.</p><p>Поход сохраняется автоматически. «Продолжить поход» вернёт на тот же этаж и к той же точке.</p><button class="primary" data-front-back>Вернуться в меню</button></div></div>');
  this.bind('[data-front-back]','click',()=>this.showMenu());
};
const frontBaseRender=Renderer.prototype.render;
Renderer.prototype.render=function(){if(this.g.frontMenu){FrontMenu.paint(this.ctx,this.g.frontMenu,this.g.time);return;}return frontBaseRender.call(this);};
window.addEventListener('resize',()=>{const g=window.game;if(g?.frontMenu)g.ui.showMenu();});
