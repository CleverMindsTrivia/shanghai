// Optional development check: uses the managed runtime's Playwright installation.
// Start npm run dev first, then set PLAYWRIGHT_MODULE to an installed Playwright index.mjs.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:'chromium'});
await mkdir('test-results',{recursive:true});
const errors=[];
try{
 for(const width of [390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4173');await page.getByRole('heading',{name:/Some traditions/}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`lobby overflow at ${width}`);
  if(width===1440)await page.screenshot({path:'test-results/lobby-desktop.png',fullPage:true});
  await page.getByRole('button',{name:/Take a seat/}).click();await page.getByRole('heading',{name:'2 sets of 3'}).waitFor();
  assert.equal(await page.locator('[data-card]').count(),11);
  await page.getByRole('button',{name:'Draw from deck'}).click();assert.equal(await page.locator('[data-card]').count(),12);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`table overflow at ${width}`);
  await page.screenshot({path:`test-results/table-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'How to play'}).click();assert(await page.locator('#rules').isVisible());await page.getByRole('button',{name:'Close rules'}).click();
  await page.reload();assert.equal(await page.locator('[data-card]').count(),12);
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:900}});page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:4173');
 const setup=async mode=>{
  await page.evaluate(async mode=>{
   const E=await import('/engine.mjs'),g=E.newGame();const pool=E.makeDeck();const take=(r,s='spades',d=0)=>{const i=pool.findIndex(c=>c.id===`${d}-${s}-${r}`);if(i<0)throw Error('fixture reused card');return pool.splice(i,1)[0];};g.players.forEach(p=>{p.hand=[];p.down=false;});g.melds=[];g.turn=0;g.phase='play';g.round=0;g.history=[];g.roundScores=[];g.discard=[];
   if(mode==='lay')g.players[0].hand=[...['spades','hearts','clubs','diamonds'].map(s=>take(2,s)),...['spades','hearts','clubs','diamonds'].map(s=>take(3,s)),take(7),take(8),take(9),take(10)];
   else{g.players[0].hand=[take(9),take(10)];g.melds=[{owner:2,type:'set',cards:['hearts','clubs','diamonds'].map(s=>take(5,s))}];g.players[1].hand=[take(5),take(6)];g.turn=1;}
   for(const p of g.players.slice(1))while(p.hand.length<11)p.hand.push(pool.shift());g.discard=[pool.shift()];g.stock=pool;
   if(mode!=='lay')E.discard(g,1,'0-spades-5',Date.now());
   E.assertIntegrity(g);localStorage.setItem('shanghai.practice.v1',JSON.stringify(g));
  },mode);await page.reload();
 };
 await setup('lay');
 for(const rank of [2,3]){for(const suit of ['spades','hearts','clubs','diamonds'])await page.locator(`[data-card="0-${suit}-${rank}"]`).click();await page.getByRole('button',{name:/^Stage /}).click();await page.getByRole('button',{name:'+ Set',exact:true}).click();}
 await page.getByRole('button',{name:/^Stage /}).click();await page.getByRole('button',{name:'Lay all down'}).click();assert.equal(await page.locator('[data-meld]').count(),2);assert.equal(await page.locator('[data-card]').count(),4);
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('shanghai.practice.v1')));assert(saved.players[0].down);assert.equal(saved.melds[0].cards.length,4);
 await setup('shanghai');await page.getByRole('button',{name:'SHANGHAI!',exact:true}).click();await page.locator('[data-card="0-spades-9"]').click();await page.getByRole('button',{name:'Finish Shanghai'}).click();saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('shanghai.practice.v1')));assert.equal(saved.melds[0].cards.length,4);assert.equal(saved.players[0].hand.length,1);assert.equal(saved.phase,'draw');assert.equal(saved.turn,2);
 await setup('buy');await page.getByRole('button',{name:/Buy \+ penalty/}).click();saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('shanghai.practice.v1')));assert.equal(saved.players[0].buys,1);assert.equal(saved.players[0].hand.length,4);assert.equal(saved.phase,'draw');
 assert.deepEqual(errors,[]);console.log('Browser checks passed: 390/768/1440px, no overflow or JS errors; draw, save/restore, rules, full laydown with extra cards, Shanghai, and buy penalty.');await page.close();
}finally{await browser.close();}
