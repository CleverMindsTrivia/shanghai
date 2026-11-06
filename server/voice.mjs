import {createHmac} from 'node:crypto';
import {RoomError,seat} from './rooms.mjs';
const need=(ok,message,status=400)=>{if(!ok)throw new RoomError(message,status);};
const validClient=x=>typeof x==='string'&&/^[a-f0-9-]{32,36}$/.test(x);
export function iceConfig(env={},code,id,now=Date.now()){
 const iceServers=[{urls:'stun:stun.l.google.com:19302'}];
 const urls=String(env.VOICE_TURN_URLS||'').split(',').map(x=>x.trim()).filter(x=>/^turns?:[^\s]+$/.test(x));
 if(urls.length){
  let username=env.VOICE_TURN_USERNAME,credential=env.VOICE_TURN_CREDENTIAL;
  if(env.VOICE_TURN_SECRET){username=`${Math.floor(now/1000)+3600}:${code}-${id}`;credential=createHmac('sha1',env.VOICE_TURN_SECRET).update(username).digest('base64');}
  if(username&&credential)iceServers.push({urls,username,credential});
 }
 return {iceServers,hasTurn:iceServers.length>1};
}
function validateSignal(message){
 need(message&&Number.isInteger(message.to)&&validClient(message.targetClient)&&validClient(message.id),'Invalid voice recipient.');
 const s=message.signal;need(s&&['offer','answer','ice'].includes(s.kind),'Invalid voice signal.');
 if(s.kind==='ice')need(s.candidate&&typeof s.candidate.candidate==='string'&&s.candidate.candidate.length<4000,'Invalid ICE candidate.');
 else need(s.description?.type===s.kind&&typeof s.description.sdp==='string'&&s.description.sdp.length<18000,'Invalid voice description.');
 need(JSON.stringify(s).length<20000,'Voice signal too large.');
}
// Signaling has its own CAS row/table so microphone activity never changes the card game's version.
export async function voiceRequest(rooms,voices,input,env={},now=Date.now()){
 const {code,token,op,client}=input;
 need(typeof code==='string'&&/^[A-HJ-NP-Z2-9]{8}$/.test(code),'Invalid room code.');
 need(['join','poll','leave'].includes(op),'Invalid voice action.');need(validClient(client),'Invalid voice session.');
 const room=await rooms.get(code);need(Date.parse(room.expires_at)>now,'This room has expired.',410);
 const id=seat(room.state,token);
 const messages=input.messages||[];need(Array.isArray(messages)&&messages.length<=32,'Too many voice signals.');messages.forEach(validateSignal);
 need(input.cursor===undefined||(Number.isSafeInteger(input.cursor)&&input.cursor>=0),'Invalid voice cursor.');
 for(let attempt=0;attempt<8;attempt++){
  let row;try{row=await voices.get(code);}catch(e){if(e.status!==404)throw new RoomError('Voice setup is unavailable. The voice database migration may still be needed.',503);}
  if(!row){try{await voices.create(code,{members:{},signals:[],seq:0});}catch(e){if(e.status!==409)throw new RoomError('Voice setup is unavailable. Run the voice database migration.',503);}continue;}
  const state=structuredClone(row.state);
  for(const [key,m] of Object.entries(state.members))if(now-m.seen>45000)delete state.members[key];
  state.signals=state.signals.filter(s=>now-s.at<90000&&state.members[s.to]?.client===s.targetClient&&state.members[s.from]?.client===s.fromClient);
  if(op==='join'){
   if(state.members[id]?.client!==client)state.signals=state.signals.filter(s=>s.to!==id&&s.from!==id);
   state.members[id]={id,client,name:room.state.members[id].name,muted:false,speaking:false,seen:now};
  }else if(op==='leave'){
   if(state.members[id]?.client===client){delete state.members[id];state.signals=state.signals.filter(s=>s.to!==id&&s.from!==id);}
  }else{
   need(state.members[id]?.client===client,'Your voice session ended. Tap Join voice to reconnect.',409);
   Object.assign(state.members[id],{seen:now,muted:input.muted===true,speaking:input.speaking===true&&input.muted!==true});
   for(const message of messages){
    need(message.to!==id&&room.state.members[message.to],'That voice seat is not in this room.');
    if(state.members[message.to]?.client!==message.targetClient)continue;
    if(state.signals.some(s=>s.from===id&&s.fromClient===client&&s.id===message.id))continue;
    state.signals.push({...message,from:id,fromClient:client,seq:++state.seq,at:now});
   }
  }
  state.signals=state.signals.slice(-400);
  if(await voices.cas(code,row.version,state))return {
   you:id,members:Object.values(state.members).map(({seen,...member})=>member),cursor:state.seq,
   signals:state.signals.filter(s=>s.to===id&&s.targetClient===client&&s.seq>(input.cursor||0)),
   ...(op==='join'||input.refreshConfig===true?{config:iceConfig(env,code,id,now)}:{})
  };
 }
 throw new RoomError('Voice is busy. Try again in a moment.',409);
}
