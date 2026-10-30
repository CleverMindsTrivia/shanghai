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
 const context=vm.createContext({E,Set,Map,Date,console,clearTimeout(id){timers.delete(id)},setTimeout(fn){timers.set(++timerId,fn);return timerId;},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},document:{querySelector:s=>s==='#app'?root:notice,addEventListener:(n,f)=>listeners[n]=f}});
 vm.runInContext(source+`;globalThis.testing={select(ids){selected=new Set(ids)},get game(){return game},get groups(){return staged},get selected(){return selected},stage,save,draftReady,render,cleanDraft};`,context);
 return {state:context.testing,memory,root,tick(){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();},click(action){listeners.click({target:{closest:s=>s==='[data-action]'?{dataset:{action}}:null}});},reload(){return app(JSON.parse(memory.get('shanghai.practice.v1')));}};
}
const ids=(g,r)=>g.players[0].hand.filter(c=>c.rank===r).map(c=>c.id);
function prepare(a,r){a.state.select(ids(a.state.game,r));a.click('stage-set');}
test('private groups can be prepared before drawing and survive discard, other turns, and refresh',()=>{
 let a=app(fixture());prepare(a,3);assert.equal(a.state.groups.length,1);assert.equal(a.state.game.melds.length,0);
 a=a.reload();assert.equal(a.state.groups.length,1);a.click('draw-stock');a.state.select(['0-diamonds-10']);a.click('discard');
 assert.equal(a.state.groups.length,1);assert.equal(a.state.game.phase,'reaction');prepare(a,7);assert.equal(a.state.groups.length,2);
 a=a.reload();assert.equal(a.state.groups.length,2);assert(a.state.draftReady());assert.equal(a.state.game.players[0].down,false);
 assert.match(a.root.innerHTML,/mini-back/);assert.match(a.root.innerHTML,/wait for your turn/);E.assertIntegrity(a.state.game);
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
