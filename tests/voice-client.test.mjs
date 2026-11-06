import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/voice.mjs',import.meta.url),'utf8').replace('export function createRoomVoice','function createRoomVoice');
function fixture({deny=false,setupError=false,delayed=false}={}){
 class Element{
  constructor(){this.children=[];this.dataset={};this.classList={toggle(){}};this.hidden=false;}
  setAttribute(){}addEventListener(){}append(...children){for(const c of children){c.parent=this;this.children.push(c);}}remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
  querySelector(s){return this.children.find(c=>s===`[data-seat="${c.dataset.seat}"]`)||null;}
 }
 const parts=new Map(),element=new Element();element.querySelector=s=>{if(!parts.has(s))parts.set(s,new Element());return parts.get(s);};
 const track={enabled:true,stopped:false,stop(){this.stopped=true;}},stream={getAudioTracks:()=>[track],getTracks:()=>[track]},calls=[],connections=[],timers=new Map();let serial=0,permission;
 class PC{constructor(){this.connectionState='new';this.signalingState='stable';connections.push(this);}addTrack(t){assert.equal(t,track);}close(){this.closed=true;}async createOffer(){return {type:'offer',sdp:'offer'};}async setLocalDescription(d){this.localDescription={...d,toJSON:()=>d};this.signalingState=d.type==='offer'?'have-local-offer':'stable';}async setRemoteDescription(d){this.remoteDescription=d;this.signalingState=d.type==='offer'?'have-remote-offer':'stable';}async createAnswer(){return {type:'answer',sdp:'answer'};}async addIceCandidate(){} }
 const notices=[],result={config:{iceServers:[],hasTurn:false},cursor:0,signals:[],members:[{id:0,name:'Thomas',client:'a'},{id:1,name:'Mom',client:'b'}]};
 const request=async input=>{calls.push(input);if(setupError)throw Error('Voice setup unavailable');return result;};
 const context=vm.createContext({document:{body:new Element(),createElement:()=>new Element()},window:{addEventListener(){}},navigator:{mediaDevices:{getUserMedia:()=>delayed?new Promise(r=>permission=r):deny?Promise.reject(Object.assign(Error(),{name:'NotAllowedError'})):Promise.resolve(stream)}},RTCPeerConnection:PC,crypto:{randomUUID:()=> '1'.repeat(32)},setInterval:f=>{timers.set(++serial,f);return serial;},clearInterval:id=>timers.delete(id),console});
 context.options={element,request,notify:x=>notices.push(x)};vm.runInContext(source+';globalThis.voice=createRoomVoice(options);',context);
 return {voice:context.voice,parts,track,calls,connections,notices,timers,allow:()=>permission(stream),result};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('voice is opt-in; seat zero can join, mute stops outbound track, leaving releases microphone',async()=>{
 const f=fixture();f.voice.setSession({code:'ABCDEFGH',you:0});assert.equal(f.calls.length,0);await f.voice.join();await settle();
 assert.equal(f.calls[0].op,'join');assert.equal(f.connections.length,1);f.voice.toggleMute();assert.equal(f.track.enabled,false);f.voice.toggleMute();assert.equal(f.track.enabled,true);
 await f.voice.leave();assert.equal(f.track.stopped,true);assert.equal(f.connections[0].closed,true);assert.equal(f.timers.size,0);assert.equal(f.calls.at(-1).op,'leave');
});
test('denied microphone access never joins server or creates connections',async()=>{
 const f=fixture({deny:true});f.voice.setSession({code:'ABCDEFGH',you:0});await f.voice.join();assert.equal(f.calls.length,0);assert.equal(f.connections.length,0);assert.match(f.notices[0],/denied/);
});
test('failed setup releases a microphone already acquired',async()=>{
 const f=fixture({setupError:true});f.voice.setSession({code:'ABCDEFGH',you:0});await f.voice.join();assert.equal(f.track.stopped,true);assert.equal(f.connections.length,0);assert.match(f.notices[0],/setup/);
});
test('leaving while microphone permission is pending stops the late stream',async()=>{
 const f=fixture({delayed:true});f.voice.setSession({code:'ABCDEFGH',you:0});const pending=f.voice.join();await f.voice.leave();f.allow();await pending;assert.equal(f.track.stopped,true);assert.equal(f.calls.length,0);
});
test('room changes stop old voice; normal game refreshes preserve the microphone',async()=>{
 const f=fixture();f.voice.setSession({code:'ABCDEFGH',you:0});await f.voice.join();await settle();f.voice.setSession({code:'ABCDEFGH',you:0});assert.equal(f.track.stopped,false);f.voice.setSession({code:'BCDEFGHJ',you:0});assert.equal(f.track.stopped,true);
});
