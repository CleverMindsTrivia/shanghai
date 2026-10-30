import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as E from '../public/engine.mjs';
const source=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8').replace("import * as E from './engine.mjs';",'');
function fixture(){
 const g=E.newGame(),pool=E.makeDeck(),take=(r,s)=>pool.splice(pool.findIndex(c=>c.rank===r&&c.suit===s),1)[0];
 g.players[0].hand=[...['spades','hearts','clubs'].map(s=>take(3,s)),...['spades','hearts','clubs'].map(s=>take(7,s)),take(10,'diamonds')];
 for(const p of g.players.slice(1))p.hand=pool.splice(0,11);
 g.discard=[pool.shift()];g.stock=pool;g.phase='draw';g.turn=0;E.assertIntegrity(g);return g;
}
function app(g){
 const memory=new Map([['shanghai.practice.v1',JSON.stringify(g)]]),listeners={},root={innerHTML:''},notice={textContent:'',classList:{add(){},remove(){}}},timers=new Map();let timerId=0;
 const panels=new Map();const panel=s=>{if(!panels.has(s))panels.set(s,{innerHTML:'',textContent:'',open:false,showModal(){this.open=true},close(){this.open=false}});return panels.get(s);};
 const context=vm.createContext({E,Set,Map,Date,console,clearTimeout(id){timers.delete(id)},setTimeout(fn){timers.set(++timerId,fn);return timerId;},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},document:{querySelectorAll:()=>[],querySelector:s=>s==='#app'?root:s==='#notice'?notice:panel(s),addEventListener:(n,f)=>listeners[n]=f}});
 vm.runInContext(source+`;globalThis.testing={select(ids){selected=new Set(ids)},get game(){return game},get groups(){return staged},get selected(){return selected},get order(){return sortedHand().map(c=>c.id)},get fresh(){return freshCards},draft,stage,save,draftReady,render,cleanDraft,moveHandCard};`,context);
 return {state:context.testing,memory,root,panel,event(type,event){listeners[type](event)},tick(){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();},meld(index){listeners.click({target:{closest:s=>s==='[data-meld]'?{dataset:{meld:String(index)}}:null}})},click(action){listeners.click({target:{closest:s=>s==='[data-action]'?{dataset:{action}}:null}});},reload(){return app(JSON.parse(memory.get('shanghai.practice.v1')));}};
}
const ids=(g,r)=>g.players[0].hand.filter(c=>c.rank===r).map(c=>c.id);
function prepare(a,r){a.state.select(ids(a.state.game,r));a.click('stage-set');}
test('private groups can be prepared before drawing and survive discard, other turns, and refresh',()=>{
 let a=app(fixture());prepare(a,3);assert.equal(a.state.groups.length,1);assert.equal(a.state.game.melds.length,0);
 a=a.reload();assert.equal(a.state.groups.length,1);a.click('draw-stock');a.state.select(['0-diamonds-10']);a.click('discard');
 assert.equal(a.state.groups.length,1);assert.equal(a.state.game.phase,'reaction');prepare(a,7);assert.equal(a.state.groups.length,2);
 a=a.reload();assert.equal(a.state.groups.length,2);assert(a.state.draftReady());assert.equal(a.state.game.players[0].down,false);
 assert.match(a.state.draft(),/mini-back/);assert.match(a.state.draft(),/wait for your turn/);E.assertIntegrity(a.state.game);
});
test('incomplete and out-of-turn drafts cannot lay down; complete contract reveals together after drawing',()=>{
 const a=app(fixture());prepare(a,3);a.click('lay');assert.equal(a.state.game.melds.length,0);a.click('draw-stock');a.click('lay');assert.equal(a.state.game.melds.length,0);
 prepare(a,7);a.click('lay');assert.equal(a.state.game.melds.length,2);assert(a.state.game.players[0].down);assert.equal(a.state.groups.length,0);assert.match(a.root.innerHTML,/reveal-meld/);E.assertIntegrity(a.state.game);
});
test('discarding a prepared card removes only its group; a new round clears all drafts',()=>{
 const a=app(fixture());prepare(a,3);prepare(a,7);a.click('draw-stock');a.state.select([ids(a.state.game,3)[0]]);a.click('discard');
 assert.equal(a.state.groups.length,1);assert.equal(a.state.groups[0].cards.length,3);assert(a.state.groups[0].cards.every(id=>id.endsWith('-7')));
 a.state.game.roundOver=true;a.state.game.lastWinner=1;a.state.game.roundScores.push({scores:[0,0,0,0]});a.state.save();assert.equal(a.state.groups.length,0);assert.equal(a.reload().state.groups.length,0);
});

test('computer actions and discard windows preserve selection so staging works during another turn',()=>{
 const g=fixture();g.turn=1;const a=app(g),cards=ids(g,7);a.state.select(cards.slice(0,2));a.tick();
 assert.equal(a.state.selected.size,2);assert.equal(a.state.game.phase,'reaction');
 a.state.game.reaction.expiresAt=Date.now()-1;a.state.render();a.tick();assert.equal(a.state.selected.size,2);
 a.state.select(cards);a.click('stage-set');assert.equal(a.state.groups.length,1);assert.equal(a.state.game.players[0].down,false);assert.equal(a.state.game.melds.length,0);
});
test('paused table permits private preparation but cannot reveal the contract',()=>{
 const a=app(fixture());a.click('pause');prepare(a,3);prepare(a,7);assert.equal(a.state.groups.length,2);a.click('lay');assert.equal(a.state.game.melds.length,0);
});

test('interleaved table melds stay grouped by player and retain their original play targets',()=>{
 const g=fixture(),pool=E.makeDeck();g.melds=[];
 for(const [rank,owner] of [[2,1],[3,0],[4,1],[5,0]]){
  const cards=['spades','hearts','clubs'].map(s=>pool.splice(pool.findIndex(c=>c.rank===rank&&c.suit===s),1)[0]);g.melds.push({owner,type:'set',cards});
 }
 g.players.forEach(p=>{p.hand=pool.splice(0,3);p.down=p.id<2;});g.discard=[pool.shift()];g.stock=pool;E.assertIntegrity(g);
 const a=app(g),panels=[...a.root.innerHTML.matchAll(/<section class="owner-panel[^>]*data-owner="(\d+)"[\s\S]*?<\/section>/g)];
 assert.equal(panels.length,4);assert.deepEqual(panels.map(m=>m[1]),['1','2','3','0']);
 assert.deepEqual([...panels[3][0].matchAll(/data-meld="(\d+)"/g)].map(m=>m[1]),['1','3']);
 assert.deepEqual([...panels[0][0].matchAll(/data-meld="(\d+)"/g)].map(m=>m[1]),['0','2']);
 g.turn=0;g.phase='play';
 const add=g.stock.splice(g.stock.findIndex(c=>c.rank===2),1)[0];g.players[0].hand.push(add);
 // The same original target still receives cards after the display is regrouped.
 E.extend(g,0,0,[add.id]);assert.equal(g.melds[0].owner,1);assert.equal(g.melds[0].cards.length,4);E.assertIntegrity(g);
});

test('draw appends a marked card without rearranging the hand; order and marker survive refresh',()=>{
 const a=app(fixture()),before=[...a.state.order];a.click('draw-stock');
 assert.deepEqual([...a.state.order].slice(0,before.length),before);
 assert.equal(Object.values(a.state.fresh).join(','),'NEW');
 const b=a.reload();assert.deepEqual([...b.state.order],[...a.state.order]);assert.deepEqual({...b.state.fresh},{...a.state.fresh});
 a.state.select([a.state.order.at(-1)]);a.click('discard');assert.equal(Object.keys(a.state.fresh).length,0);
});
test('buy labels the purchased card and the separate penalty, retaining private drafts',()=>{
 const g=fixture();g.players[3].down=true;g.turn=2;g.phase='play';E.discard(g,2,g.players[2].hand[0].id);
 const a=app(g);prepare(a,3);const before=[...a.state.order];a.click('buy');
 assert.equal(a.state.game.players[0].buys,1);assert.equal(a.state.game.players[0].hand.length,before.length+2);
 assert.deepEqual([...a.state.order].slice(0,before.length),before);assert.deepEqual(Object.values(a.state.fresh),['NEW','PENALTY']);assert.equal(a.state.groups.length,1);
});
test('17 cards fit two hand rows and every round reserves all four seats and contract slots',()=>{
 const g=fixture();g.players[0].hand.push(...g.stock.splice(0,10));
 const a=app(g);assert.equal(a.state.game.players[0].hand.length,17);
 assert.equal((a.root.innerHTML.match(/class="hand-row"/g)||[]).length,2);
 assert.equal((a.root.innerHTML.match(/data-card=/g)||[]).length,17);
 for(let round=0;round<7;round++){a.state.game.round=round;a.state.render();assert.equal((a.root.innerHTML.match(/data-owner=/g)||[]).length,4);assert.equal((a.root.innerHTML.match(/meld-placeholder/g)||[]).length,4*E.ROUNDS[round].reduce((x,y)=>x+y));}
});

test('group inspection never plays cards until the explicit confirmation; stale turn is rejected',()=>{
 const g=fixture();const cards=g.players[0].hand.filter(c=>c.rank===3);g.players[0].hand=g.players[0].hand.filter(c=>c.rank!==3);g.melds=[{owner:1,type:'set',cards}];g.players[0].down=true;g.turn=0;g.phase='play';
 const extra=g.stock.splice(g.stock.findIndex(c=>c.rank===3),1)[0];g.players[0].hand.push(extra);E.assertIntegrity(g);
 const a=app(g);a.state.select([extra.id]);a.meld(0);assert.equal(a.state.game.melds[0].cards.length,3);assert.match(a.panel('#table-info-body').innerHTML,/confirm-play/);
 a.click('confirm-play');assert.equal(a.state.game.melds[0].cards.length,4);assert(!a.state.game.players[0].hand.some(c=>c.id===extra.id));
 const another=a.state.game.stock.splice(a.state.game.stock.findIndex(c=>c.rank===3),1)[0];a.state.game.players[0].hand.push(another);a.state.select([another.id]);a.meld(0);a.state.game.turn=1;a.click('confirm-play');assert.equal(a.state.game.melds[0].cards.length,4);assert(a.state.game.players[0].hand.some(c=>c.id===another.id));
});

test('custom hand order moves between rows, survives drawing and reload, and keeps selection and staged groups',()=>{
 const g=fixture();g.players[0].hand.push(...g.stock.splice(0,10));const a=app(g);
 prepare(a,3);const original=[...a.state.order],moving=original[0],last=original.at(-1);a.state.select([moving]);
 assert(a.state.moveHandCard(moving,last,true));assert.equal(a.state.order.at(-1),moving);assert.deepEqual([...a.state.order].slice(0,-1),original.slice(1));
 assert(a.state.selected.has(moving));assert.equal(a.state.groups.length,1);assert(a.state.groups[0].cards.includes(moving));
 E.assertIntegrity(a.state.game);const b=a.reload();assert.deepEqual([...b.state.order],[...a.state.order]);assert.equal(b.state.groups.length,1);
 const before=[...b.state.order];b.click('draw-stock');assert.deepEqual([...b.state.order].slice(0,before.length),before);assert.equal(Object.values(b.state.fresh).join(','),'NEW');
 const freshId=Object.keys(b.state.fresh)[0];b.state.moveHandCard(freshId,b.state.order[0],false);assert.equal(b.state.order[0],freshId);assert.equal(b.state.fresh[freshId],'NEW');E.assertIntegrity(b.state.game);
});
test('reordering rejects missing cards and leaves physical hands and scoring unchanged',()=>{
 const a=app(fixture()),before=[...a.state.order],cards=JSON.stringify(a.state.game.players[0].hand);
 assert.equal(a.state.moveHandCard(before[0],before[0]),false);assert.equal(a.state.moveHandCard('missing',before[0]),false);assert.equal(a.state.moveHandCard(before[0],'missing'),false);
 assert.deepEqual([...a.state.order],before);a.state.moveHandCard(before.at(-1),before[0]);assert.equal(a.state.order[0],before.at(-1));
 assert.equal(JSON.stringify(a.state.game.players[0].hand),cards);assert.equal(a.state.game.players[0].score,0);assert.equal(a.state.game.melds.length,0);
});

test('hand long presses block text selection and copy menus without affecting text outside the hand',()=>{
 const a=app(fixture());let prevented=0;
 for(const type of ['selectstart','contextmenu']){
  a.event(type,{target:{closest:s=>s==='.hand'?{}:null},preventDefault(){prevented++}});
  a.event(type,{target:{closest:()=>null},preventDefault(){throw Error('Outside-hand text should remain selectable');}});
 }
 assert.equal(prevented,2);
 const cardButtons=[...a.root.innerHTML.matchAll(/<button[^>]*data-card="[^"]+"[\s\S]*?<\/button>/g)];
 assert.equal(cardButtons.length,a.state.game.players[0].hand.length);
 assert(cardButtons.every(([html])=>html.includes('class="hand-index')),'The rank label must be inside its card button so holding it starts the same gesture.');
});

test('completed rounds keep the same board layout styles and show scores instead of a hand',()=>{
 const a=app(fixture());
 for(let round=0;round<7;round++){
  const g=a.state.game;g.round=round;g.roundOver=true;g.finished=round===6;g.lastWinner=0;g.phase='ended';g.roundScores=[{round,winner:0,scores:[0,20,30,40]}];a.state.render();
  assert.match(a.root.innerHTML,/<main class="game-layout playing round-complete">/);
  assert.equal((a.root.innerHTML.match(/data-owner=/g)||[]).length,4);
  assert.match(a.root.innerHTML,/class="result-panel"/);
  assert.doesNotMatch(a.root.innerHTML,/class="hand-panel"/);
 }
});
