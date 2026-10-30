export const SUITS = ['spades','hearts','clubs','diamonds'];
export const SYMBOLS = {spades:'♠',hearts:'♥',clubs:'♣',diamonds:'♦'};
export const ROUNDS = [[2,0],[1,1],[0,2],[3,0],[2,1],[1,2],[0,3]];
export const rankLabel = rank => ({1:'A',11:'J',12:'Q',13:'K'}[rank] || String(rank));
export const points = c => c.rank === 1 ? 15 : c.rank >= 10 ? 10 : 5;
export const cardLabel = c => `${rankLabel(c.rank)}${SYMBOLS[c.suit]}`;
export const contractLabel = n => { const [s,r]=ROUNDS[n]; return [s?`${s} set${s>1?'s':''} of 3`:null,r?`${r} run${r>1?'s':''} of 4`:null].filter(Boolean).join(' + '); };
export function shuffle(cards, rng=Math.random) {
 const out=[...cards]; for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out;
}
export function makeDeck(copies=2) {
 const cards=[];for(let d=0;d<copies;d++)for(const suit of SUITS)for(let rank=1;rank<=13;rank++)cards.push({id:`${d}-${suit}-${rank}`,suit,rank});return cards;
}
export function orderMeld(cards,type) {
 if(type==='set')return [...cards].sort((a,b)=>SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit));
 let values=cards.map(c=>c.rank);const high=values.includes(1)&&values.includes(13);
 return [...cards].sort((a,b)=>(high&&a.rank===1?14:a.rank)-(high&&b.rank===1?14:b.rank));
}
export function validMeld(cards,type) {
 if(type==='set')return cards.length>=3&&cards.every(c=>c.rank===cards[0].rank);
 if(type!=='run'||cards.length<4||!cards.every(c=>c.suit===cards[0].suit))return false;
 if(new Set(cards.map(c=>c.rank)).size!==cards.length)return false;
 const consecutive=values=>values.sort((a,b)=>a-b).every((v,i,a)=>i===0||v===a[i-1]+1);
 return consecutive(cards.map(c=>c.rank))||consecutive(cards.map(c=>c.rank===1?14:c.rank));
}
function combos(arr,n) { const result=[];function rec(start,p){if(p.length===n){result.push(p);return;}for(let i=start;i<=arr.length-(n-p.length);i++)rec(i+1,[...p,arr[i]]);}rec(0,[]);return result; }
export function findContract(hand,round) {
 const [sets,runs]=ROUNDS[round];const candidates={set:[],run:[]};
 for(let rank=1;rank<=13;rank++)candidates.set.push(...combos(hand.filter(c=>c.rank===rank),3).map(cards=>({type:'set',cards})));
 for(const suit of SUITS){const suited=hand.filter(c=>c.suit===suit);candidates.run.push(...combos(suited,4).filter(cs=>validMeld(cs,'run')).map(cards=>({type:'run',cards})));}
 const needs=[...Array(sets).fill('set'),...Array(runs).fill('run')];
 function search(i,used,found){if(i===needs.length)return found;for(const m of candidates[needs[i]]){if(m.cards.some(c=>used.has(c.id)))continue;const next=new Set(used);m.cards.forEach(c=>next.add(c.id));const answer=search(i+1,next,[...found,m]);if(answer)return answer;}return null;}
 return search(0,new Set(),[]);
}
const requireRule=(ok,message)=>{if(!ok)throw new Error(message);};
export function newGame(names=['Thomas','Mom','Dad','Dusti'],rng=Math.random) {
 requireRule(names.length>=2&&names.length<=8,'Choose 2–8 players.');
 const game={version:1,round:0,dealer:Math.floor(rng()*names.length),players:names.map((name,i)=>({id:i,name,score:0,hand:[],down:false,buys:0})),melds:[],discard:[],stock:[],history:[],roundScores:[],finished:false,roundOver:false,phase:'draw',turn:0,reaction:null,lastWinner:null};deal(game,rng);return game;
}
export function log(g,message){g.history.push(message);if(g.history.length>80)g.history.shift();}
export function deal(g,rng=Math.random) {
 g.stock=shuffle(makeDeck(g.players.length<=6?2:3),rng);g.discard=[];g.melds=[];g.reaction=null;g.roundOver=false;g.phase='draw';
 g.players.forEach(p=>{p.hand=[];p.down=false;p.buys=0;});
 for(let i=0;i<11;i++)for(const p of g.players)p.hand.push(g.stock.pop());
 g.discard.push(g.stock.pop());g.turn=(g.dealer+1)%g.players.length;log(g,`Round ${g.round+1}: ${contractLabel(g.round)}. ${g.players[g.dealer].name} deals; ${g.players[g.turn].name} starts to their left.`);
}
export function nextRound(g,rng=Math.random){requireRule(g.roundOver&&!g.finished,'Finish this round first.');g.round++;g.dealer=(g.dealer+1)%g.players.length;deal(g,rng);}
function live(g){requireRule(!g.roundOver&&!g.finished,'This round has ended.');}
function active(g,id,phase){live(g);requireRule(g.turn===id,`It is ${g.players[g.turn].name}’s turn.`);if(phase)requireRule(g.phase===phase,phase==='draw'?'Draw a card first.':'Finish the current action first.');}
function drawStock(g,rng=Math.random){
 if(!g.stock.length&&g.discard.length>1){const top=g.discard.pop();g.stock=shuffle(g.discard,rng);g.discard=[top];log(g,'Discard pile reshuffled into the deck.');}
 requireRule(g.stock.length>0,'No cards remain to draw.');return g.stock.pop();
}
export function draw(g,id,source='stock',rng=Math.random){active(g,id,'draw');requireRule(source==='stock'||source==='discard','Choose the deck or discard pile.');requireRule(source!=='discard'||g.discard.length,'The discard pile is empty.');const c=source==='stock'?drawStock(g,rng):g.discard.pop();g.players[id].hand.push(c);g.phase='play';log(g,`${g.players[id].name} drew ${source==='stock'?'from the deck':cardLabel(c)}.`);return c;}
function owned(g,id,ids){requireRule(ids.length===new Set(ids).size,'A card can only be used once.');const cards=ids.map(x=>g.players[id].hand.find(c=>c.id===x));requireRule(cards.every(Boolean),'That card is not in your hand.');return cards;}
function remove(g,id,cards){const used=new Set(cards.map(c=>c.id));g.players[id].hand=g.players[id].hand.filter(c=>!used.has(c.id));}
export function layDown(g,id,groups){active(g,id,'play');requireRule(!g.players[id].down,'You have already laid down.');const [sets,runs]=ROUNDS[g.round];requireRule(groups.filter(m=>m.type==='set').length===sets&&groups.filter(m=>m.type==='run').length===runs&&groups.length===sets+runs,'Lay the entire round’s required combinations together.');
 const cards=owned(g,id,groups.flatMap(m=>m.cards.map(c=>typeof c==='string'?c:c.id)));
 const normalized=groups.map(m=>({type:m.type,cards:m.cards.map(c=>cards.find(x=>x.id===(typeof c==='string'?c:c.id)))}));
 requireRule(normalized.every(m=>validMeld(m.cards,m.type)),'A set or run is not valid.');
 remove(g,id,cards);normalized.forEach(m=>g.melds.push({...m,owner:id,cards:orderMeld(m.cards,m.type)}));g.players[id].down=true;log(g,`${g.players[id].name} laid down.`);checkOut(g,id);
}
export function extend(g,id,meldIndex,ids){active(g,id,'play');requireRule(g.players[id].down,'Lay your complete contract before adding to the table.');const m=g.melds[meldIndex];requireRule(!!m,'Choose a combination on the table.');requireRule(ids.length>0,'Select a card first.');const cards=owned(g,id,ids);requireRule(validMeld([...m.cards,...cards],m.type),'Those cards do not fit that combination.');m.cards=orderMeld([...m.cards,...cards],m.type);remove(g,id,cards);log(g,`${g.players[id].name} added ${cards.map(cardLabel).join(', ')}.`);checkOut(g,id);}
export function playableSpots(g,card){return g.melds.flatMap((m,i)=>validMeld([...m.cards,card],m.type)?[i]:[]);}
function checkOut(g,id){if(g.players[id].hand.length)return false;finishRound(g,id);return true;}
function finishRound(g,id){g.roundOver=true;g.reaction=null;g.phase='ended';g.lastWinner=id;const scores=g.players.map(p=>p.hand.reduce((sum,c)=>sum+points(c),0));scores.forEach((v,i)=>g.players[i].score+=v);g.roundScores.push({round:g.round,winner:id,scores});g.finished=g.round===6;log(g,`${g.players[id].name} went out! ${g.finished?'The game is over.':'Round complete.'}`);}
export function discard(g,id,cardId,now=Date.now()) {
 const isClaim=g.phase==='claim-discard';if(isClaim){live(g);requireRule(g.claimant===id,'Another player is finishing Shanghai.');}else active(g,id,'play');
 const [card]=owned(g,id,[cardId]);remove(g,id,[card]);g.discard.push(card);log(g,`${g.players[id].name} discarded ${cardLabel(card)}.`);
 if(checkOut(g,id))return;
 if(isClaim){g.phase='draw';g.turn=g.resumeTurn;g.claimant=null;g.resumeTurn=null;g.reaction=null;return;}
 const next=(id+1)%g.players.length;g.phase='reaction';g.reaction={cardId:card.id,discarder:id,next,createdAt:now,expiresAt:now+4000,buyer:null,shanghaiAllowed:true};
}
export function endReaction(g){live(g);requireRule(g.phase==='reaction','There is no discard to claim.');g.turn=g.reaction.next;g.phase='draw';g.reaction=null;}
export function canBuy(g,id){return !g.roundOver&&g.phase==='reaction'&&g.reaction.discarder!==id&&g.reaction.next!==id&&g.players[id].buys<3&&!(g.reaction.next!==0&&wantsDiscard(g,g.reaction.next));}
export function buy(g,id,rng=Math.random){live(g);requireRule(canBuy(g,id),'You cannot buy this discard: the next player has first refusal, and buys are limited to 3.');requireRule(g.discard.at(-1)?.id===g.reaction.cardId,'That discard is no longer available.');
 // The practice opponents always decline buys. A future server will arbitrate player priority.
 requireRule(g.stock.length>0||g.discard.length>2,'No penalty card is available.');
 const card=g.discard.pop();const penalty=drawStock(g,rng);g.players[id].hand.push(card,penalty);g.players[id].buys++;g.reaction.buyer=id;log(g,`${g.players[id].name} bought ${cardLabel(card)} plus one penalty card (${g.players[id].buys}/3 buys).`);endReaction(g);
}
export function callShanghai(g,id,meldIndex){live(g);requireRule(g.phase==='reaction'&&g.reaction.shanghaiAllowed,'Shanghai is not available.');requireRule(id!==g.reaction.discarder,'You cannot Shanghai your own discard.');requireRule(g.players[id].hand.length>0,'No card remains to discard.');const card=g.discard.at(-1);requireRule(card?.id===g.reaction.cardId,'That discard is no longer available.');requireRule(playableSpots(g,card).includes(meldIndex),'The discard does not fit that combination.');
 const next=g.reaction.next;g.discard.pop();const m=g.melds[meldIndex];m.cards=orderMeld([...m.cards,card],m.type);g.phase='claim-discard';g.claimant=id;g.resumeTurn=next;g.reaction=null;log(g,`${g.players[id].name} called SHANGHAI! ${cardLabel(card)} was played on the table.`);
}
export function handStrength(hand){
 return hand.reduce((sum,c)=>{const same=hand.filter(x=>x.id!==c.id&&x.rank===c.rank).length;const near=hand.filter(x=>x.id!==c.id&&x.suit===c.suit&&(Math.abs(x.rank-c.rank)<=2||(x.rank===1&&c.rank>=12)||(c.rank===1&&x.rank>=12))).length;return sum+same*5+near*2;},0);
}
export function contractProgress(hand,round){
 const [sets,runs]=ROUNDS[round],candidates={set:[],run:[]};
 for(let rank=1;rank<=13;rank++){const cs=hand.filter(c=>c.rank===rank);for(let n=2;n<=Math.min(3,cs.length);n++)for(const cards of combos(cs,n))candidates.set.push({cards,score:n*n+(n===3?10:0)});}
 for(const suit of SUITS)for(let start=1;start<=11;start++){
  const window=start===11?[11,12,13,1]:[start,start+1,start+2,start+3];
  const cs=hand.filter(c=>c.suit===suit&&window.includes(c.rank));
  for(let n=2;n<=Math.min(4,cs.length);n++)for(const cards of combos(cs,n))if(new Set(cards.map(c=>c.rank)).size===n)candidates.run.push({cards,score:n*n+(n===4?10:0)});
 }
 const needs=[...Array(sets).fill('set'),...Array(runs).fill('run')];
 function search(i,used,previous=-1){if(i===needs.length)return 0;const type=needs[i],same=i>0&&type===needs[i-1];let best=search(i+1,used,-1);for(let j=same?previous+1:0;j<candidates[type].length;j++){const m=candidates[type][j];if(m.cards.some(c=>used.has(c.id)))continue;const next=new Set(used);m.cards.forEach(c=>next.add(c.id));best=Math.max(best,m.score+search(i+1,next,j));}return best;}
 return search(0,new Set());
}
export function botTurn(g,id,rng=Math.random,now=Date.now()){
 active(g,id,'draw');const p=g.players[id];const wants=wantsDiscard(g,id);
 draw(g,id,wants?'discard':'stock',rng);
 if(!p.down){const groups=findContract(p.hand,g.round);if(groups)layDown(g,id,groups);}
 if(g.roundOver)return;
 if(p.down){let changed=true;while(changed&&!g.roundOver){changed=false;for(const card of [...p.hand]){const spot=playableSpots(g,card)[0];if(spot!==undefined){extend(g,id,spot,[card.id]);changed=true;break;}}}}
 if(g.roundOver)return;
 const ranked=p.hand.map(c=>({card:c,score:p.down?0:contractProgress(p.hand.filter(x=>x.id!==c.id),g.round)})).sort((a,b)=>b.score-a.score||points(b.card)-points(a.card));discard(g,id,ranked[0].card.id,now);
}
export function wantsDiscard(g,id){const p=g.players[id],top=g.discard.at(-1);if(!top)return false;if(p.down)return playableSpots(g,top).length>0;if(findContract([...p.hand,top],g.round))return true;const best=Math.max(...[...p.hand,top].map(c=>contractProgress([...p.hand,top].filter(x=>x.id!==c.id),g.round)));return best>contractProgress(p.hand,g.round);}
export function assertIntegrity(g){const all=[...g.stock,...g.discard,...g.players.flatMap(p=>p.hand),...g.melds.flatMap(m=>m.cards)];requireRule(all.length===(g.players.length<=6?104:156),'Cards have been lost or duplicated.');requireRule(new Set(all.map(c=>c.id)).size===all.length,'A card appears twice.');return true;}
