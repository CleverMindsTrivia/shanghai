import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceRequest,iceConfig} from '../server/voice.mjs';
import {createRoom,joinRoom} from '../server/rooms.mjs';
import {supabaseStore} from '../server/supabase-store.mjs';
const code='ABCDEFGH',a='a'.repeat(64),b='b'.repeat(64),ca='1'.repeat(32),cb='2'.repeat(32),cc='3'.repeat(32),now=100000;
function setup(){
 const room=createRoom(code,'Thomas',a,now);joinRoom(room,'Mom',b);
 const rooms={get:async c=>{assert.equal(c,code);return {state:structuredClone(room),version:10,expires_at:new Date(now+86400000).toISOString()};}};
 let stored=null;
 const voices={get:async()=>{if(!stored)throw Object.assign(Error(),{status:404});return structuredClone(stored);},create:async(c,state)=>{if(stored)throw Object.assign(Error(),{status:409});stored={state,version:1};},cas:async(c,version,state)=>{if(stored.version!==version)return false;stored={state:structuredClone(state),version:version+1};return true;}};
 return {room,rooms,voices,run:(input,time=now)=>voiceRequest(rooms,voices,{code,token:a,client:ca,...input},{},time)};
}
test('voice requires a valid seat and unexpired room; never returns cards or keys',async()=>{
 const f=setup();await assert.rejects(f.run({op:'join',token:'c'.repeat(64)}),/seat/);
 const result=await f.run({op:'join'});assert.equal(result.you,0);assert.equal(result.members[0].name,'Thomas');assert.equal(JSON.stringify(result).includes(a),false);assert.equal('game' in result,false);
 await assert.rejects(f.run({op:'join'},now+86400001),/expired/);
});
test('voice delivers directed signals once per cursor and keeps gameplay untouched',async()=>{
 const f=setup();await f.run({op:'join'});await f.run({op:'join',token:b,client:cb});
 const message={id:cc,to:1,targetClient:cb,signal:{kind:'offer',description:{type:'offer',sdp:'test SDP'}}};
 await f.run({op:'poll',messages:[message]});await f.run({op:'poll',messages:[message]});
 const received=await f.run({op:'poll',token:b,client:cb});assert.equal(received.signals.length,1);assert.equal(received.signals[0].from,0);
 assert.equal((await f.run({op:'poll',token:b,client:cb,cursor:received.cursor})).signals.length,0);
 assert.equal((await f.run({op:'poll'})).signals.length,0);assert.equal((await f.rooms.get(code)).version,10);assert.equal(f.room.game,null);
});
test('voice sessions replace old tabs, reject forged recipients, and expire stale members',async()=>{
 const f=setup();await f.run({op:'join'});await f.run({op:'join',token:b,client:cb});await f.run({op:'join',client:cc});
 await assert.rejects(f.run({op:'poll'}),/session ended/);
 await assert.rejects(f.run({op:'poll',client:cc,messages:[{id:ca,to:7,targetClient:cb,signal:{kind:'ice',candidate:{candidate:'ice'}}}]}),/not in this room/);
 const result=await f.run({op:'poll',client:cc,muted:true,speaking:true});assert.equal(result.members[0].muted,true);assert.equal(result.members[0].speaking,false);
 // A member may refresh its own heartbeat before expiry; peers without heartbeats disappear.
 await f.run({op:'poll',client:cc},now+30000);
 assert.deepEqual((await f.run({op:'poll',client:cc},now+50000)).members.map(x=>x.id),[0]);
});
test('voice leave stops membership, stale leave cannot evict a replacement, oversized signals rejected',async()=>{
 const f=setup();await f.run({op:'join'});await f.run({op:'join',client:cc});await f.run({op:'leave'});
 assert.equal((await f.run({op:'poll',client:cc})).members.length,1);
 await assert.rejects(f.run({op:'poll',client:cc,messages:[{id:ca,to:1,targetClient:cb,signal:{kind:'offer',description:{type:'offer',sdp:'x'.repeat(18001)}}}]}),/Invalid voice description/);
 await f.run({op:'leave',client:cc});await assert.rejects(f.run({op:'poll',client:cc}),/session ended/);
});
test('concurrent joins preserve both members with CAS retries',async()=>{
 const f=setup();await Promise.all([f.run({op:'join'}),f.run({op:'join',token:b,client:cb})]);assert.equal((await f.run({op:'poll'})).members.length,2);
});
test('TURN config uses scoped expiring HMAC credentials without exposing the signing secret',()=>{
 const config=iceConfig({VOICE_TURN_URLS:'turn:relay.example:3478,https://bad.example',VOICE_TURN_SECRET:'private-signing-secret'},code,0,now);
 assert.equal(config.hasTurn,true);assert.match(config.iceServers[1].username,/3700:ABCDEFGH-0/);assert.equal(JSON.stringify(config).includes('private-signing-secret'),false);assert.deepEqual(config.iceServers[1].urls,['turn:relay.example:3478']);
 assert.equal(iceConfig({VOICE_TURN_URLS:'turn:relay.example'}).hasTurn,false);
});
test('voice storage uses a separate allowed table and refuses arbitrary table names',async()=>{
 let url;const store=supabaseStore('https://example.supabase.co','private',async u=>{url=u;return {ok:true,json:async()=>[{state:{},version:1}]};},'shanghai_voice');await store.get(code);assert.match(url,/rest\/v1\/shanghai_voice/);
 assert.throws(()=>supabaseStore('https://example.supabase.co','private',fetch,'other_project'),/Invalid storage/);
});
