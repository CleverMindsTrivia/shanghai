import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/engine.mjs';
import {createRoom,joinRoom,seat,apply,settle,view,execute} from '../server/rooms.mjs';
import {supabaseStore} from '../server/supabase-store.mjs';
const tokens=['a','b','c','d'].map(c=>c.repeat(64)),code='ABCDEFGH',now=10000;
function room(n=4){const r=createRoom(code,'Thomas',tokens[0],now);for(let i=1;i<n;i++)joinRoom(r,['','Mom','Dad','Dusti'][i],tokens[i]);apply(r,0,'start');return r;}
function memory(state=createRoom(code,'Thomas',tokens[0],now)){
 let row={code,state:structuredClone(state),version:1,expires_at:new Date(now+86400000).toISOString()};return {
  async create(){throw Object.assign(Error('Exists'),{status:409});},async get(){return structuredClone(row);},
  async cas(c,v,s){if(row.version!==v)return false;row={...row,version:v+1,state:structuredClone(s)};return true;},get row(){return row;}
 };
}
function reaction(){const r=room(),g=r.game;g.turn=3;g.phase='play';E.discard(g,3,g.players[3].hand[0].id,now);return r;}
test('room joining is idempotent, keys are hashed, names unique, and late joins rejected',()=>{
 const r=createRoom(code,'Thomas',tokens[0]);joinRoom(r,'Mom',tokens[1]);joinRoom(r,'Mom',tokens[1]);assert.equal(r.members.length,2);assert.notEqual(r.members[0].key,tokens[0]);assert.equal(seat(r,tokens[1]),1);
 assert.throws(()=>seat(r,tokens[2]),/does not have a seat/);assert.throws(()=>joinRoom(r,'Thomas',tokens[2]),/already seated/);apply(r,0,'start');assert.throws(()=>joinRoom(r,'Dad',tokens[2]),/already started/);
});
test('each device gets only its own hand, never the stock, seat hashes, or other private cards',()=>{
 const r=room();for(let id=0;id<4;id++){const v=view(r,id,1);assert.equal(v.hand.length,11);assert.equal(v.you,id);assert(v.game.players.every(p=>!('hand' in p)));assert(!('stock' in v.game));assert(!('key' in v.members[0]));for(const other of r.game.players.filter(p=>p.id!==id))for(const c of other.hand)assert(!JSON.stringify(v).includes('"'+c.id+'"'));}
});
test('only host starts or deals, only current seat draws, and all contracts lay together',()=>{
 const r=createRoom(code,'Thomas',tokens[0]);joinRoom(r,'Mom',tokens[1]);assert.throws(()=>apply(r,1,'start'),/Only the host/);apply(r,0,'start');const turn=r.game.turn;assert.throws(()=>apply(r,1-turn,'draw-stock'),/turn/);apply(r,turn,'draw-stock');assert.equal(r.game.players[turn].hand.length,12);assert.throws(()=>apply(r,turn,'lay',{groups:[]}),/entire round/);E.assertIntegrity(r.game);
});
test('human buy requests resolve by seat order, not announcement order, with exactly one penalty',()=>{
 const r=reaction(),offered=r.game.discard.at(-1),before=r.game.players.map(p=>p.hand.length);apply(r,2,'buy',{},now+10);apply(r,1,'buy',{},now+20);assert.equal(r.game.players[2].hand.length,before[2]);settle(r,now+4000);assert.equal(r.game.players[1].hand.length,before[1]+2);assert(r.game.players[1].hand.some(c=>c.id===offered.id));assert.equal(r.game.players[1].buys,1);assert.equal(r.game.players[2].buys,0);assert.equal(r.game.turn,0);E.assertIntegrity(r.game);
});
test('next player normal pickup beats pending buys; passing cannot be undone during the same window',()=>{
 let r=reaction();apply(r,1,'buy',{},now+10);const card=r.game.discard.at(-1);apply(r,0,'draw-discard',{},now+20);assert(r.game.players[0].hand.some(c=>c.id===card.id));assert.equal(r.game.players[1].buys,0);assert.equal(r.buyers.length,0);E.assertIntegrity(r.game);
 r=reaction();apply(r,0,'pass-discard',{},now+10);assert.throws(()=>apply(r,0,'draw-discard',{},now+20),/already passed/);settle(r,now+4000);assert.equal(r.game.phase,'draw');
});
test('announced buy blocks a later Shanghai, and next player cannot buy',()=>{
 const r=reaction();assert.throws(()=>apply(r,0,'buy',{},now),/cannot buy/);apply(r,1,'buy',{},now);assert.throws(()=>apply(r,2,'shanghai',{meld:0},now+1),/announced before/);
});
test('duplicate request IDs do not draw twice; stale and out-of-turn requests cannot mutate a room',async()=>{
 const r=room(2),store=memory(r),id=r.game.turn,request={op:'action',code,token:tokens[id],action:'draw-stock',payload:{},version:1,requestId:'11111111-1111-1111-1111-111111111111'};
 const a=await execute(store,request,now),b=await execute(store,request,now);assert.equal(a.hand.length,12);assert.equal(b.hand.length,12);assert.equal(store.row.version,2);
 await assert.rejects(execute(store,{...request,action:'discard',payload:{card:a.hand[0].id},requestId:'22222222-2222-2222-2222-222222222222'},now),/table changed/);assert.equal(store.row.version,2);
 await assert.rejects(execute(store,{op:'view',code,token:tokens[1-id].replace(/^./,'f')},now),/does not have/);
});
test('simultaneous human buy requests can merge against the same discard safely',async()=>{
 const r=reaction(),store=memory(r),cardId=r.game.discard.at(-1).id;
 await Promise.all([1,2].map(i=>execute(store,{op:'action',code,token:tokens[i],action:'buy',payload:{cardId},version:1,requestId:String(i).repeat(32)},now+10)));
 assert.deepEqual([...store.row.state.buyers].sort(),[1,2]);const result=await execute(store,{op:'view',code,token:tokens[1]},now+4000);assert.equal(result.game.players[1].buys,1);assert.equal(result.hand.length,13);E.assertIntegrity(store.row.state.game);
});
test('expired rooms and requests after the claim window reject safely',async()=>{
 const store=memory(reaction());await assert.rejects(execute(store,{op:'view',code,token:tokens[0]},now+86400001),/expired/);
 await assert.rejects(execute(store,{op:'action',code,token:tokens[1],version:1,requestId:'a'.repeat(32),action:'buy',payload:{cardId:store.row.state.game.discard.at(-1).id}},now+4001),/window ended/);assert.equal(store.row.state.game.phase,'draw');
});
test('Supabase writes use compare-and-swap and keep the service key out of results',async()=>{
 const calls=[],fetcher=async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>[]};};const store=supabaseStore('https://example.supabase.co','server-secret',fetcher);assert.equal(await store.cas(code,4,{members:[]}),false);assert(calls[0].url.includes('version=eq.4'));assert.equal(calls[0].init.method,'PATCH');assert.equal(calls[0].init.headers.Authorization,'Bearer server-secret');assert.throws(()=>supabaseStore('',''),/not connected/);
});

test('the Netlify endpoint enforces POST and rejects oversized bodies without exposing secrets',async()=>{
 const {handler}=await import('../netlify/functions/room.mjs');
 const method=await handler({httpMethod:'GET'});assert.equal(method.statusCode,405);assert.equal(method.headers['Cache-Control'],'no-store');
 const large=await handler({httpMethod:'POST',headers:{},body:'x'.repeat(12001)});assert.equal(large.statusCode,413);assert.equal(JSON.parse(large.body).error,'Request too large.');
 const invalid=await handler({httpMethod:'POST',headers:{},body:'{'});assert.equal(invalid.statusCode,400);assert.equal(JSON.parse(invalid.body).error,'Invalid request.');
});
