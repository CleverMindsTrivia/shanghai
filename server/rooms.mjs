import {createHash,randomInt,timingSafeEqual} from 'node:crypto';
import * as E from '../public/engine.mjs';
export class RoomError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const need=(ok,message,status=400)=>{if(!ok)throw new RoomError(message,status);};
export const tokenHash=token=>{need(typeof token==='string'&&/^[a-f0-9]{64}$/.test(token),'Invalid seat key.',401);return createHash('sha256').update(token).digest('hex');};
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const nameOf=name=>{need(typeof name==='string','Enter your name.');const n=name.trim().replace(/[\u0000-\u001f\u007f]/g,'');need(n.length>=1&&n.length<=24,'Use a name of 1–24 characters.');return n;};
export function seat(room,token){const hash=tokenHash(token),id=room.members.findIndex(m=>equal(m.key,hash));need(id>=0,'This device does not have a seat in this room.',401);return id;}
export function createRoom(code,name,token,now=Date.now()){need(/^[A-HJ-NP-Z2-9]{8}$/.test(code),'Invalid room code.');return {code,members:[{name:nameOf(name),key:tokenHash(token)}],game:null,buyers:[],seen:[],createdAt:now};}
export function joinRoom(room,name,token){const hash=tokenHash(token);if(room.members.some(m=>equal(m.key,hash)))return;need(!room.game,'This game has already started.',409);need(room.members.length<4,'This first multiplayer version supports four seats.',409);const n=nameOf(name);need(!room.members.some(m=>m.name.toLowerCase()===n.toLowerCase()),'That name is already seated.');room.members.push({name:n,key:hash});}
const rng=()=>randomInt(0,0x100000000)/0x100000000;
function buyAllowed(room,id){const g=room.game;return !g.roundOver&&g.phase==='reaction'&&g.reaction.discarder!==id&&g.reaction.next!==id&&g.players[id].buys<3;}
function awardBuy(room,id){
 const g=room.game;need(buyAllowed(room,id),'That buy is no longer available.');
 const offered=g.discard.at(-1);need(offered?.id===g.reaction.cardId,'That discard is no longer available.');
 need(g.stock.length>0||g.discard.length>2,'No penalty card is available.');
 g.discard.pop();if(!g.stock.length){const top=g.discard.pop();g.stock=E.shuffle(g.discard,rng);g.discard=[top];}
 const penalty=g.stock.pop();g.players[id].hand.push(offered,penalty);g.players[id].buys++;E.log(g,`${g.players[id].name} bought ${E.cardLabel(offered)} plus one penalty card.`);E.endReaction(g);room.buyers=[];
}
export function settle(room,now=Date.now()){
 const g=room.game;if(!g||g.phase!=='reaction'||now<g.reaction.expiresAt)return false;
 const next=g.reaction.next,n=g.players.length;
 const candidates=room.buyers.filter(id=>buyAllowed(room,id)).sort((a,b)=>(a-next+n)%n-(b-next+n)%n);
 if(candidates.length)awardBuy(room,candidates[0]);else{E.endReaction(g);room.buyers=[];}return true;
}
export function apply(room,id,action,payload={},now=Date.now()){
 need(Number.isInteger(id)&&id>=0&&id<room.members.length,'Invalid seat.',401);
 if(action==='start'){need(id===0,'Only the host can deal.',403);need(!room.game,'This room has already started.',409);need(room.members.length>=2,'Wait for at least one other player.');room.game=E.newGame(room.members.map(m=>m.name),rng);return;}
 const g=room.game;need(g,'Wait for the host to deal.',409);settle(room,now);
 if(action==='next-round'){need(id===0,'Only the host can deal the next round.',403);E.nextRound(g,rng);room.buyers=[];return;}
 const ids=payload.ids;const safeIds=()=>{need(Array.isArray(ids)&&ids.length<=30&&ids.every(x=>typeof x==='string'),'Choose cards from your hand.');return ids;};
 if(action==='draw-discard'&&g.phase==='reaction'){need(g.reaction.next===id,'The next player has first refusal.');need(!g.reaction.passed,'You already passed on this discard.');E.endReaction(g);room.buyers=[];E.draw(g,id,'discard',rng);}
 else if(action==='pass-discard'){need(g.phase==='reaction'&&g.reaction.next===id,'Only the next player can pass.');
  // Keep the entire claim window open for higher-priority buyers. Passing merely declines normal pickup.
  g.reaction.passed=true;E.log(g,`${g.players[id].name} passed on the discard.`);
 }
 else if(action==='draw-stock'){if(g.phase==='reaction'&&g.reaction.next===id){g.reaction.passed=true;E.log(g,`${g.players[id].name} passed on the discard.`);}else E.draw(g,id,'stock',rng);}
 else if(action==='draw-discard'){need(!(g.reaction?.passed),'You already passed on this discard.');E.draw(g,id,'discard',rng);}
 else if(action==='lay'){need(Array.isArray(payload.groups)&&payload.groups.length<=3,'Prepare the complete contract.');need(payload.groups.every(m=>m&&['set','run'].includes(m.type)&&Array.isArray(m.cards)&&m.cards.every(x=>typeof x==='string')),'Invalid contract.');E.layDown(g,id,payload.groups);}
 else if(action==='extend'){need(Number.isInteger(payload.meld),'Choose a table group.');E.extend(g,id,payload.meld,safeIds());}
 else if(action==='discard'){need(typeof payload.card==='string','Choose one card to discard.');E.discard(g,id,payload.card,now);room.buyers=[];}
 else if(action==='buy'){need(buyAllowed(room,id),'You cannot buy this discard.');if(!room.buyers.includes(id)){room.buyers.push(id);E.log(g,`${g.players[id].name} requested a buy.`);}}
 else if(action==='shanghai'){need(!room.buyers.length,'A buy was announced before Shanghai.');need(Number.isInteger(payload.meld),'Choose a group for the discarded card.');E.callShanghai(g,id,payload.meld);room.buyers=[];}
 else throw new RoomError('Unknown move.');
 E.assertIntegrity(g);
}
export function view(room,id,version){
 const g=room.game;return {code:room.code,version,you:id,host:id===0,members:room.members.map((m,i)=>({id:i,name:m.name})),status:g?'playing':'waiting',hand:g?g.players[id].hand:[],game:g?{
 round:g.round,dealer:g.dealer,turn:g.turn,phase:g.phase,roundOver:g.roundOver,finished:g.finished,lastWinner:g.lastWinner,claimant:g.claimant??null,
 players:g.players.map(p=>({id:p.id,name:p.name,score:p.score,count:p.hand.length,down:p.down,buys:p.buys})),melds:g.melds,discard:g.discard.at(-1)??null,stockCount:g.stock.length,
 reaction:g.reaction?{next:g.reaction.next,discarder:g.reaction.discarder,expiresAt:g.reaction.expiresAt,passed:!!g.reaction.passed,buyers:[...room.buyers]}:null,roundScores:g.roundScores,history:g.history.slice(-8)
 }:null};
}
export async function execute(store,request,now=Date.now()){
 const {op,code,token,name,action,payload,requestId,version}=request;
 need(typeof code==='string'&&/^[A-HJ-NP-Z2-9]{8}$/.test(code),'Enter an eight-character room code.');tokenHash(token);
 if(op==='create'){
  const state=createRoom(code,name,token,now);try{await store.create(code,state);}catch(e){if(e.status!==409)throw e;const existing=await store.get(code);seat(existing.state,token);}
 }
 for(let attempt=0;attempt<6;attempt++){
  const row=await store.get(code);need(row&&Date.parse(row.expires_at)>now,'Room not found or expired.',404);const state=structuredClone(row.state);
  if(op==='join'){joinRoom(state,name,token);const id=seat(state,token);if(JSON.stringify(state)===JSON.stringify(row.state))return view(state,id,row.version);if(await store.cas(code,row.version,state))return view(state,id,row.version+1);continue;}
  const id=seat(state,token);const settled=settle(state,now);
  if(settled){
   if(await store.cas(code,row.version,state)){if(op==='action'&&!state.seen.some(x=>x.id===id&&x.requestId===requestId))throw new RoomError('The claim window ended. Review the table and try again.',409);}
   continue;
  }
  if(op==='action'){
   need(typeof requestId==='string'&&/^[a-f0-9-]{16,64}$/.test(requestId),'Missing move identifier.');
   if(state.seen.some(x=>x.id===id&&x.requestId===requestId))return view(state,id,row.version);
   const sameClaim=['buy','shanghai'].includes(action)&&state.game?.phase==='reaction'&&payload?.cardId===state.game.reaction.cardId&&Number.isInteger(version)&&version<=row.version;
   need(version===row.version||sameClaim,'The table changed. Review it and try your move again.',409);
   if(['buy','shanghai'].includes(action))need(payload?.cardId===state.game?.reaction?.cardId,'That discard is no longer available.',409);
   apply(state,id,action,payload,now);state.seen.push({id,requestId});state.seen=state.seen.slice(-64);
  }else need(['view','create'].includes(op),'Unknown room request.');
  if(op==='action'||settled){if(await store.cas(code,row.version,state))return view(state,id,row.version+1);continue;}
  return view(state,id,row.version);
 }
 throw new RoomError('The table is busy. Try again.',409);
}
