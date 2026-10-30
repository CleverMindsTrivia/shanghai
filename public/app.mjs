import * as E from './engine.mjs';
const $=s=>document.querySelector(s),root=$('#app'),KEY='shanghai.practice.v1';
let game=null,selected=new Set(),staged=[],sort='suit',timer=null,paused=false,claimMode=false,noticeTimer=null,pauseRemaining=0,revealing=false;
let handOrder=[],freshCards={},pendingPlay=null,infoMode=null;
let handDrag=null,suppressCardClickUntil=0,suppressedCardId=null;
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const red=c=>['hearts','diamonds'].includes(c.suit);
const human=()=>game?.players[0];
function card(c,{small=false,selectable=false,inert=false}={}){const tag=selectable?'button':'span';return `<${tag} ${selectable?`type="button" data-card="${esc(c.id)}" aria-pressed="${selected.has(c.id)}" aria-label="${esc(E.rankLabel(c.rank)+' of '+c.suit+(selectable&&freshCards[c.id]?', '+freshCards[c.id]:''))}"`:`role="img" aria-label="${esc(E.rankLabel(c.rank)+' of '+c.suit+(selectable&&freshCards[c.id]?', '+freshCards[c.id]:''))}"`} data-suit="${c.suit}" data-rank="${c.rank}" class="card face-art ${red(c)?'red':''} ${small?'small':''} ${selected.has(c.id)&&selectable?'selected':''} ${inert?'inert':''}"><span class="card-index">${E.rankLabel(c.rank)}<i>${E.SYMBOLS[c.suit]}</i></span><span class="card-center">${E.SYMBOLS[c.suit]}</span><span class="card-index bottom" aria-hidden="true">${E.rankLabel(c.rank)}<i>${E.SYMBOLS[c.suit]}</i></span></${tag}>`;}
function brand(){return `<a href="#" class="brand" data-action="home"><span class="brand-mark" aria-hidden="true">♠</span><span>SHANGHAI<small>THE FAMILY TABLE</small></span></a>`;}
function header(){return `<header class="topbar">${brand()}<nav><span class="practice-tag"><span></span> PRACTICE TABLE</span>${game?'<button class="text-button game-menu" data-action="menu">Menu</button>':'<button class="text-button" data-action="rules">How to play</button>'}</nav></header>`;}
function lobby(){root.innerHTML=`${header()}<main class="lobby"><div class="lobby-copy"><span class="eyebrow">SAME FAMILY. NEW TABLE.</span><h1>Some traditions<br>get <em>competitive.</em></h1><p class="intro">Your seven-round Shanghai game, with a seat saved just for you.</p><form id="start-form"><label for="player-name">What should we call you?</label><div class="start-row"><input id="player-name" name="name" maxlength="24" value="Thomas" required autocomplete="nickname"><button class="button primary" type="submit">Take a seat <span aria-hidden="true">↗</span></button></div></form><p class="fine-print">Play against Mom, Dad & Dusti · Saves on this device</p><div class="lobby-features"><span>7 rounds</span><span>3 buys</span><span>One family tradition</span></div></div><div class="lobby-art" aria-hidden="true"><div class="art-halo"></div><div class="art-card art-left">${card({id:'art1',rank:13,suit:'spades'})}</div><div class="art-card art-right">${card({id:'art3',rank:11,suit:'clubs'})}</div><div class="art-card art-middle">${card({id:'art2',rank:12,suit:'hearts'})}</div><div class="art-seal">THE LOWEST<br><b>SCORE WINS.</b></div></div></main><footer class="lobby-footer">Bring your best hand. Leave the family drama on the table.</footer>`;}
function sortHand(){handOrder=[...human().hand].sort((a,b)=>sort==='rank'?a.rank-b.rank||E.SUITS.indexOf(a.suit)-E.SUITS.indexOf(b.suit):E.SUITS.indexOf(a.suit)-E.SUITS.indexOf(b.suit)||a.rank-b.rank).map(c=>c.id);}
function sortedHand(){const cards=new Map(human().hand.map(c=>[c.id,c]));handOrder=handOrder.filter(id=>cards.has(id));for(const c of human().hand)if(!handOrder.includes(c.id))handOrder.push(c.id);return handOrder.map(id=>cards.get(id));}
function moveHandCard(id,targetId,after=false){
 sortedHand();if(id===targetId||!handOrder.includes(id)||!handOrder.includes(targetId))return false;
 const next=handOrder.filter(x=>x!==id),at=next.indexOf(targetId)+(after?1:0);
 next.splice(at,0,id);if(next.every((x,i)=>x===handOrder[i]))return false;
 handOrder=next;save();return true;
}
function clearDropTarget(){for(const el of document.querySelectorAll('.drop-before,.drop-after'))el.classList.remove('drop-before','drop-after');}
function beginHandDrag(){
 const d=handDrag;if(!d||!d.button.isConnected||!human().hand.some(c=>c.id===d.id))return;
 d.active=true;const rect=d.button.getBoundingClientRect();d.ghost=d.button.cloneNode(true);
 d.ghost.removeAttribute('data-card');d.ghost.removeAttribute('aria-pressed');d.ghost.setAttribute('aria-hidden','true');d.ghost.setAttribute('tabindex','-1');d.ghost.classList.remove('selected');d.ghost.classList.add('hand-drag-ghost');
 d.ghost.style.width=rect.width+'px';d.ghost.style.height=rect.height+'px';
 document.body.append(d.ghost);d.button.closest('.hand-card').classList.add('drag-source');
 d.offsetX=Math.min(d.startX-rect.left,rect.width-5);d.offsetY=Math.min(d.startY-rect.top,rect.height-5);
 d.button.setPointerCapture?.(d.pointerId);updateHandDrag(d.x,d.y);
}
function updateHandDrag(x,y){
 const d=handDrag;if(!d?.active)return;d.x=x;d.y=y;d.ghost.style.left=(x-d.offsetX)+'px';d.ghost.style.top=(y-d.offsetY)+'px';
 clearDropTarget();d.target=null;
 const hit=document.elementFromPoint(x,y),row=hit?.closest('.hand-row');if(!row)return;
 const candidates=[...row.querySelectorAll('[data-card]')].filter(b=>b.dataset.card!==d.id);if(!candidates.length)return;
 const target=candidates.reduce((best,b)=>{const r=b.closest('.hand-card').getBoundingClientRect(),distance=Math.abs(x-(r.left+r.width/2));return !best||distance<best.distance?{b,r,distance}:best;},null);
 d.target=target.b.dataset.card;d.after=x>target.r.left+target.r.width/2;
 target.b.closest('.hand-card').classList.add(d.after?'drop-after':'drop-before');
}
function finishHandDrag(commit=false){
 const d=handDrag;if(!d)return;clearTimeout(d.hold);handDrag=null;
 if(d.active){suppressCardClickUntil=Date.now()+600;suppressedCardId=d.id;d.ghost.remove();d.button.closest('.hand-card')?.classList.remove('drag-source');clearDropTarget();
  if(commit&&d.target)moveHandCard(d.id,d.target,d.after);
  render();const button=document.querySelector('[data-card="'+d.id+'"]');button?.focus?.({preventScroll:true});
  if(commit&&d.target){const c=human().hand.find(c=>c.id===d.id);if(c)notify(E.cardLabel(c)+' moved to position '+(handOrder.indexOf(d.id)+1)+'.');}
 }
}
document.addEventListener('pointerdown',ev=>{
 const button=ev.target.closest('[data-card]');if(!button||ev.button!==0||ev.isPrimary===false||game?.roundOver)return;
 finishHandDrag(false);handDrag={id:button.dataset.card,button,pointerId:ev.pointerId,type:ev.pointerType,startX:ev.clientX,startY:ev.clientY,x:ev.clientX,y:ev.clientY,active:false};
 handDrag.hold=setTimeout(beginHandDrag,320);
});
document.addEventListener('pointermove',ev=>{
 const d=handDrag;if(!d||ev.pointerId!==d.pointerId)return;d.x=ev.clientX;d.y=ev.clientY;
 if(!d.active&&Math.hypot(d.x-d.startX,d.y-d.startY)>7){if(d.type==='mouse'){clearTimeout(d.hold);beginHandDrag();}else{finishHandDrag(false);return;}}
 if(d.active){ev.preventDefault();updateHandDrag(d.x,d.y);}
},{passive:false});
document.addEventListener('pointerup',ev=>{if(handDrag&&ev.pointerId===handDrag.pointerId){if(handDrag.active){ev.preventDefault();updateHandDrag(ev.clientX,ev.clientY);}finishHandDrag(true);}});
document.addEventListener('pointercancel',()=>finishHandDrag(false));
document.addEventListener('lostpointercapture',ev=>{if(handDrag?.pointerId===ev.pointerId)finishHandDrag(false);});
document.addEventListener('contextmenu',ev=>{if(ev.target.closest('[data-card]'))ev.preventDefault();});
document.addEventListener('keydown',ev=>{
 if(ev.key==='Escape'&&handDrag){finishHandDrag(false);return;}
 const button=ev.target.closest('[data-card]');if(!button||!ev.altKey||!['ArrowLeft','ArrowRight'].includes(ev.key))return;
 ev.preventDefault();const id=button.dataset.card;sortedHand();const target=handOrder[handOrder.indexOf(id)+(ev.key==='ArrowRight'?1:-1)];
 if(target){moveHandCard(id,target,ev.key==='ArrowRight');render();document.querySelector('[data-card="'+id+'"]')?.focus?.({preventScroll:true});notify('Card order saved.');}
});
function cleanDraft(){
 if(!game)return;
 const ids=new Map(human().hand.map(c=>[c.id,c])),used=new Set();
 staged=game.roundOver||human().down?[]:staged.filter(m=>{
  if(!m||!Array.isArray(m.cards)||m.cards.some(id=>!ids.has(id)||used.has(id))||new Set(m.cards).size!==m.cards.length)return false;
  if(!E.validMeld(m.cards.map(id=>ids.get(id)),m.type))return false;
  m.cards.forEach(id=>used.add(id));return true;
 });
 game.privateDraft={round:game.round,groups:staged};
}
function draftReady(){const [sets,runs]=E.ROUNDS[game.round];return staged.length===sets+runs&&staged.filter(m=>m.type==='set').length===sets&&staged.filter(m=>m.type==='run').length===runs;}
function save(){cleanDraft();sortedHand();game.handView={round:game.round,order:handOrder,fresh:freshCards};try{localStorage.setItem(KEY,JSON.stringify(game));}catch{notify('This browser could not save your game. Keep this tab open.');}}
function notify(msg){$('#notice').textContent=msg;$('#notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').classList.remove('visible'),5000);}
function act(fn,preserveSelection=false){try{const before=new Set(human().hand.map(c=>c.id)),round=game.round;fn();const added=human().hand.filter(c=>!before.has(c.id));if(game.round!==round){handOrder=[];freshCards={};sortHand();}else if(added.length){freshCards=Object.fromEntries(added.map((c,i)=>[c.id,added.length===2&&i===1?'PENALTY':'NEW']));}const held=new Set(human().hand.map(c=>c.id));freshCards=Object.fromEntries(Object.entries(freshCards).filter(([id])=>held.has(id)));if(!preserveSelection)selected.clear();claimMode=false;save();render();refreshInfo();}catch(e){notify(e.message);}}
function phaseText(){if(game.roundOver)return game.finished?'The final scores are in.':`${game.players[game.lastWinner].name} went out!`;if(game.phase==='claim-discard')return 'SHANGHAI! Choose one card from your hand to discard.';if(game.phase==='reaction')return `${game.players[game.reaction.discarder].name} discarded. Your chance to make a move.`;if(game.turn!==0)return `${game.players[game.turn].name} is playing…`;return game.phase==='draw'?'Your turn. Draw from the deck or take the top discard.':human().down?'Play onto the table, or choose a card to discard.':'Build your full contract, or choose a card to discard.';}
function player(p){return `<article class="player ${game.turn===p.id&&!game.roundOver?'active':''}"><span class="avatar">${esc(p.name.slice(0,1))}</span><div class="player-name"><strong>${esc(p.name)}${game.dealer===p.id?'<span class="dealer-badge">DEALER</span>':''}</strong><small>${p.down?'Laid down':'Still holding'} · ${p.buys}/3 buys</small></div><div class="player-count"><b>${p.hand.length}</b><small>cards</small></div><span class="player-score">${p.score}<small>pts</small></span></article>`;}
function contractPanel(){const [s,r]=E.ROUNDS[game.round];return `<section class="contract-panel"><div><span class="eyebrow">ROUND ${game.round+1} OF 7</span><h1>${E.contractLabel(game.round)}</h1><p class="dealer-note">Dealer: ${esc(game.players[game.dealer].name)} · First: ${esc(game.players[(game.dealer+1)%game.players.length].name)} (to the dealer’s left)</p></div><div class="round-track" aria-label="Round progress">${E.ROUNDS.map((_,i)=>`<span class="${i===game.round?'current':i<game.round?'complete':''}" title="${esc(E.contractLabel(i))}">${i<game.round?'✓':i+1}</span>`).join('')}</div></section><div class="turn-banner ${game.turn===0?'your-turn':''}" role="status"><span class="status-dot"></span><span>${esc(phaseText())}</span><button class="text-button" data-action="pause" ${game.roundOver?'disabled':''}>${paused?'Resume':'Pause'}</button></div>`;}
function piles(){const top=game.discard.at(-1);const mayDraw=!paused&&!game.roundOver&&game.turn===0&&game.phase==='draw';const mayTake=!paused&&!game.roundOver&&(mayDraw||game.phase==='reaction'&&game.reaction.next===0);return `<div class="piles"><div class="pile"><button class="card card-back" data-action="draw-stock" ${mayDraw?'':'disabled'} aria-label="Draw from deck"><span class="back-pattern">♠<b>SHANGHAI</b>♠</span></button><span>Draw <b>${game.stock.length}</b></span></div><div class="pile"><button class="discard-pile" data-action="draw-discard" ${mayTake&&top?'':'disabled'} aria-label="Take top discard">${top?card(top):'<span class="empty-card">Empty</span>'}</button><span>Discard</span></div></div>`;}
function reaction(){
 if(game.roundOver)return '';
 const active=game.phase==='reaction',top=game.discard.at(-1),spots=active&&top?E.playableSpots(game,top):[];
 const shanghai=active&&game.reaction.discarder!==0&&spots.length,mayPass=active&&game.reaction.next===0;
 const count=active?`${Math.max(0,Math.ceil((game.reaction.expiresAt-Date.now())/1000))}s`:'Waiting';
 return `<div class="reaction-slot"><div class="reaction-panel ${active?'':'reaction-idle'}"><div><span class="eyebrow">DISCARD WINDOW</span><strong>${count} <span class="reaction-time-note">${active?'to claim':'for a discard'}</span></strong></div><div class="reaction-actions"><button class="button secondary" data-action="buy" ${active&&!paused&&E.canBuy(game,0)?'':'disabled'}>Buy + penalty <small>${human().buys}/3</small></button><button class="button shanghai" data-action="shanghai" ${!paused&&shanghai?'':'disabled'}>SHANGHAI!</button><button class="text-button reaction-pass ${mayPass?'':'unavailable'}" data-action="pass-discard" ${mayPass&&!paused?'':'disabled'} ${mayPass?'':'aria-hidden="true" tabindex="-1"'}>Pass / draw deck</button></div></div><p class="reaction-help ${claimMode?'':'unavailable'}">Choose the highlighted combination that should receive the discard.</p></div>`;
}
function melds(){
 const [sets,runs]=E.ROUNDS[game.round],slots=[...Array(sets).fill('set'),...Array(runs).fill('run')];
 const owners=[...game.players.slice(1),game.players[0]];
 const picked=human().hand.filter(c=>selected.has(c.id));
 return `<section class="table-melds"><div class="section-heading"><h2>The table</h2><small>${claimMode?'Choose a Shanghai target':selected.size?'Highlighted groups fit your selection':'Tap a group to inspect'}</small></div><div class="owner-grid">${owners.map(p=>{
 const groups=game.melds.flatMap((m,index)=>m.owner===p.id?[{m,index}]:[]),remaining=[...groups];
 return `<section class="owner-panel ${p.id===0?'your-melds':''} ${game.turn===p.id?'active-owner':''}" data-owner="${p.id}" aria-label="${esc(p.name)}’s combinations"><h3 class="owner-heading">${esc(p.name)}${game.dealer===p.id?'<span class="dealer-badge">D</span>':''}<small>${p.hand.length} cards · ${p.buys}/3 buys</small></h3><div class="owner-melds" data-slots="${slots.length}">${slots.map(type=>{
 const at=remaining.findIndex(g=>g.m.type===type);if(at<0)return `<button class="meld meld-placeholder" disabled aria-label="${esc(p.name)} has not laid down this ${type}"><strong>Not down</strong><small>${type==='set'?'Set':'Run'}</small></button>`;
 const {m,index:i}=remaining.splice(at,1)[0],ordered=E.orderMeld(m.cards,m.type);
 const canClaim=claimMode&&E.playableSpots(game,game.discard.at(-1)).includes(i),legal=!paused&&human().down&&game.turn===0&&game.phase==='play'&&picked.length&&E.validMeld([...m.cards,...picked],m.type);
 const summary=m.type==='set'?`${E.rankLabel(ordered[0].rank)}s`:`${E.rankLabel(ordered[0].rank)}–${E.rankLabel(ordered.at(-1).rank)}${E.SYMBOLS[ordered[0].suit]}`;
 return `<button class="meld ${revealing&&m.owner===0?'reveal-meld':''} ${canClaim?'claim-target':''} ${legal?'legal-target':''} ${m.type==='run'&&red(ordered[0])?'red-summary':''}" data-meld="${i}" aria-label="${esc(p.name+' '+m.type+': '+ordered.map(E.cardLabel).join(', '))}"><strong>${summary}</strong><small>${m.cards.length} cards · ${m.type}</small></button>`;
 }).join('')}</div></section>`;
 }).join('')}</div></section>`;
}
function draft(){
 if(human().down)return '';
 const canStage=!game.roundOver,canPlay=!paused&&canStage&&game.turn===0&&game.phase==='play',ready=draftReady();
 const used=new Set(staged.flatMap(m=>m.cards)),[sets,runs]=E.ROUNDS[game.round];
 const room=type=>staged.filter(m=>m.type===type).length<(type==='set'?sets:runs);
 return `<section class="draft" aria-label="Private staging area"><div class="draft-top"><div><span class="eyebrow">YOUR PRIVATE STAGING AREA</span><p>Prepare groups any time. Cards stay in your hand until you reveal the complete contract on your turn.</p></div><div class="draft-actions"><button class="button compact secondary" data-action="stage-set" ${canStage&&room('set')&&selected.size>=3?'':'disabled'}>+ Set</button><button class="button compact secondary" data-action="stage-run" ${canStage&&room('run')&&selected.size>=4?'':'disabled'}>+ Run</button><button class="button compact primary" data-action="lay" ${canPlay&&ready?'':'disabled'}>Lay all down</button></div></div>
 ${staged.length?`<div class="staged-groups">${staged.map((m,i)=>`<div class="staged-group private-group"><div class="private-group-heading"><span>${m.type==='set'?'SET':'RUN'} · ${m.cards.length} CARDS</span><button data-unstage="${i}" aria-label="Remove staged combination">×</button></div><div class="private-backs" aria-hidden="true">${m.cards.map(()=>'<span class="mini-back">♠</span>').join('')}</div><details><summary>Peek at your cards</summary><p>${m.cards.map(id=>E.cardLabel(human().hand.find(c=>c.id===id))).join(' · ')}</p></details></div>`).join('')}</div>`:''}
 <p class="draft-status" role="status">${ready?canPlay?'Complete contract ready — lay all down to reveal it together.':'Complete contract ready — wait for your turn and draw before revealing.':`${staged.filter(m=>m.type==='set').length}/${sets} sets · ${staged.filter(m=>m.type==='run').length}/${runs} runs prepared`}</p>
 ${used.size?`<small>${used.size} cards prepared · Saved between turns and refreshes. Remove a group to rearrange it.</small>`:''}</section>`;
}
function hand(){
 const claim=game.phase==='claim-discard'&&game.claimant===0,play=game.phase==='play'&&game.turn===0;
 const canDiscard=!paused&&!game.roundOver&&(claim||play)&&selected.size===1,used=new Set(staged.flatMap(m=>m.cards));
 const cards=sortedHand(),split=Math.ceil(cards.length/2),rows=cards.length>8?[cards.slice(0,split),cards.slice(split)]:[cards];
 return `<section class="hand-panel"><div class="section-heading"><h2>Your hand <span>${cards.length}</span></h2><div class="hand-tools"><label for="sort">Sort</label><select id="sort" aria-label="Sort cards by"><option value="suit" ${sort==='suit'?'selected':''}>Suit</option><option value="rank" ${sort==='rank'?'selected':''}>Rank</option></select><button class="text-button" data-action="sort-hand">Sort</button><button class="text-button" data-action="clear">Clear</button></div></div><div class="hand" aria-label="Your cards">${rows.map(row=>`<div class="hand-row" data-count="${row.length}">${row.map(c=>`<div class="hand-card ${used.has(c.id)?'staged-card':''} ${freshCards[c.id]?'new-card':''}">${card(c,{selectable:true})}<span class="hand-index ${red(c)?'red-index':''}" aria-hidden="true">${E.rankLabel(c.rank)}<small>${E.SYMBOLS[c.suit]}</small></span>${freshCards[c.id]?`<span class="new-tag">${freshCards[c.id]==='PENALTY'?'P+1':'NEW'}</span>`:used.has(c.id)?'<span class="staged-tag" aria-label="Staged">S</span>':''}</div>`).join('')}</div>`).join('')}</div><div class="hand-bottom"><span role="status">${selected.size?`${selected.size} selected: ${cards.filter(c=>selected.has(c.id)).map(E.cardLabel).join(' · ')}`:Object.keys(freshCards).length?cards.filter(c=>freshCards[c.id]).map(c=>(freshCards[c.id]==='PENALTY'?'Penalty ':'New ')+E.cardLabel(c)).join(' · '):'Tap to select · Hold to move'}</span>${!human().down?`<button class="button secondary" data-action="staging">Stage ${staged.length}/${E.ROUNDS[game.round].reduce((a,b)=>a+b)}</button>`:''}<button class="button primary" data-action="discard" ${canDiscard?'':'disabled'}>${claim?'Finish Shanghai':'Discard'}</button></div></section>`;
}
function showInfo(mode){infoMode=mode;refreshInfo();const dialog=$('#table-info');if(!dialog.open)dialog.showModal();}
function refreshInfo(){
 if(!infoMode||!game)return;const title=$('#table-info-title'),body=$('#table-info-body');
 if(infoMode==='staging'){title.textContent='Private staging';body.innerHTML=draft()||'<p>Your contract is already on the table.</p>';}
 else if(infoMode==='menu'){title.textContent='Game menu';body.innerHTML='<div class="menu-options"><button class="button secondary" data-action="scores">Scores</button><button class="button secondary" data-action="talk">Table talk</button><button class="button secondary" data-action="rules">How to play</button><button class="button secondary" data-action="new">New game</button></div>';}
 else if(infoMode==='scores'||infoMode==='talk'){title.textContent=infoMode==='scores'?'Family scores':'Table talk';body.innerHTML=$(infoMode==='scores'?'.scoreboard':'.activity').innerHTML;}
}
function inspectMeld(i){
 const m=game.melds[i];if(!m)return;
 const ordered=E.orderMeld(m.cards,m.type),picked=human().hand.filter(c=>selected.has(c.id));
 pendingPlay=null;infoMode='meld';$('#table-info-title').textContent=`${game.players[m.owner].name} · ${m.type}`;
 let action='';
 if(picked.length){if(paused||game.turn!==0||game.phase!=='play'||!human().down){notify('You can inspect groups now; play on your turn after laying down.');}
 else if(E.validMeld([...m.cards,...picked],m.type)){pendingPlay={index:i,ids:picked.map(c=>c.id),round:game.round};action=`<p>Add ${picked.map(E.cardLabel).join(' · ')}?</p><button class="button primary" data-action="confirm-play">Play selected cards</button>`;}
 else action='<p role="status">Your selected cards do not fit this group.</p>';}
 $('#table-info-body').innerHTML=`<div class="detail-cards">${ordered.map(c=>`<div>${card(c)}<strong>${E.cardLabel(c)}</strong></div>`).join('')}</div>${action}`;
 if(!$('#table-info').open)$('#table-info').showModal();
}
function results(){if(!game.roundOver)return '';const totals=[...game.players].sort((a,b)=>a.score-b.score);const winners=totals.filter(p=>p.score===totals[0].score);return `<section class="result-panel" aria-labelledby="result-title"><span class="eyebrow">${game.finished?'SEVEN ROUNDS. SETTLED.':'THAT’S A ROUND.'}</span><h2 id="result-title">${game.finished?`${winners.map(p=>esc(p.name)).join(' & ')} ${winners.length>1?'win':'wins'}!`:`${esc(game.players[game.lastWinner].name)} went out.`}</h2><p>${game.finished?'Lowest total score takes the table.':'The cards you’re still holding count against you.'}</p><div class="score-table"><div class="score-row heading"><span>PLAYER</span><span>THIS ROUND</span><span>TOTAL</span></div>${game.players.map(p=>`<div class="score-row"><strong>${esc(p.name)}${game.dealer===p.id?'<span class="dealer-badge">DEALER</span>':''}</strong><span>+${game.roundScores.at(-1).scores[p.id]}</span><b>${p.score}</b></div>`).join('')}</div><button class="button primary" data-action="${game.finished?'new':'next-round'}">${game.finished?'Play again':`Deal round ${game.round+2}`} <span aria-hidden="true">↗</span></button></section>`;}
function render(){if(handDrag?.active)return;const scrolls=[...document.querySelectorAll('.table-melds,.hand-panel,.hand,.table-controls,.meld-cards')].map(el=>({key:el.classList.contains('meld-cards')?'[data-meld="'+el.closest('[data-meld]').dataset.meld+'"] .meld-cards':'.'+el.className.split(' ')[0],top:el.scrollTop,left:el.scrollLeft}));clearTimeout(timer);if(!game){lobby();return;}const ids=new Set(human().hand.map(c=>c.id));selected=new Set([...selected].filter(id=>ids.has(id)));cleanDraft();root.innerHTML=`${header()}<main class="game-layout ${game.roundOver?'round-complete':'playing'}"><div class="game-main">${contractPanel()}<section class="felt"><div class="table-controls">${piles()}${reaction()}</div>${melds()}${paused&&!game.roundOver?'<div class="pause-label">Table paused · Your seat is saved.</div>':''}</section>${results()}${!game.roundOver?hand():''}</div><aside class="sidebar"><section class="scoreboard"><span class="eyebrow">THE FAMILY STANDINGS</span><h2>Keep it low.</h2>${[...game.players].sort((a,b)=>a.score-b.score).map((p,i)=>`<div class="standing"><span class="standing-place">${i+1}</span><span>${esc(p.name)}${p.id===0?'<small>YOU</small>':''}</span><b>${p.score}</b></div>`).join('')}<p>Lowest total after seven rounds wins.</p></section><section class="activity"><span class="eyebrow">TABLE TALK</span><ol>${game.history.slice(-8).reverse().map((s,i)=>`<li class="${i===0?'latest':''}">${esc(s)}</li>`).join('')}</ol></section><p class="fine-print">Practice edition · Progress saves here.<br>Family rooms are coming next.</p></aside></main>`;for(const pos of scrolls){const el=$(pos.key);if(el){el.scrollTop=pos.top;el.scrollLeft=pos.left;}}revealing=false;schedule();}
function schedule(){if(!game||game.roundOver||paused)return;if(game.phase==='reaction'){const left=game.reaction.expiresAt-Date.now();timer=setTimeout(()=>{if(left<=250)act(()=>E.endReaction(game),true);else{const counter=$('.reaction-panel strong');if(counter)counter.innerHTML=`${Math.max(0,Math.ceil((game.reaction.expiresAt-Date.now())/1000))}s <span class="reaction-time-note">to claim</span>`;schedule();}},Math.max(20,Math.min(250,left)));}else if(game.turn!==0&&game.phase==='draw'){timer=setTimeout(()=>act(()=>E.botTurn(game,game.turn),true),1200);}}
function stage(type){if(game.roundOver||human().down)throw Error('Prepare cards before laying down in an active round.');const limit=E.ROUNDS[game.round][type==='set'?0:1];if(staged.filter(m=>m.type===type).length>=limit)throw Error('All required groups of this type are already prepared.');const ids=[...selected];const used=new Set(staged.flatMap(m=>m.cards));if(ids.some(id=>used.has(id)))throw Error('A selected card is already staged. Remove that group to rearrange it.');const cards=ids.map(id=>human().hand.find(c=>c.id===id));if(!E.validMeld(cards,type))throw Error(type==='set'?'Choose 3 or more cards of the same rank.':'Choose 4 or more consecutive cards of the same suit.');staged.push({type,cards:ids});}
function start(name){game=E.newGame([name.trim()||'Thomas','Mom','Dad','Dusti']);selected.clear();staged=[];paused=false;handOrder=[];freshCards={};pendingPlay=null;infoMode=null;sortHand();save();render();}
document.addEventListener('submit',ev=>{if(ev.target.id!=='start-form')return;ev.preventDefault();start(new FormData(ev.target).get('name'));});
document.addEventListener('change',ev=>{if(ev.target.id==='sort'){sort=ev.target.value;sortHand();save();render();}});
document.addEventListener('click',ev=>{
 const cardButton=ev.target.closest('[data-card]');if(cardButton){if(cardButton.dataset.card===suppressedCardId&&Date.now()<suppressCardClickUntil){ev.preventDefault?.();return;}const id=cardButton.dataset.card;if(selected.has(id))selected.delete(id);else selected.add(id);render();document.querySelector('[data-card="'+id+'"]')?.focus?.();return;}
 const unstager=ev.target.closest('[data-unstage]');if(unstager){staged.splice(Number(unstager.dataset.unstage),1);save();render();refreshInfo();return;}
 const meldButton=ev.target.closest('[data-meld]');if(meldButton){if(paused&&claimMode){notify('Resume the table first.');return;}const i=Number(meldButton.dataset.meld);if(claimMode)act(()=>E.callShanghai(game,0,i));else inspectMeld(i);return;}
 const button=ev.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;
 if(['scores','talk','menu','staging'].includes(action)){showInfo(action);return;}if(action==='close-info'){$('#table-info').close();infoMode=null;pendingPlay=null;return;}
 if(action==='rules'){$('#table-info').close();infoMode=null;$('#rules').showModal();return;}if(action==='close-rules'){$('#rules').close();return;}
 if(action==='new'){$('#table-info').close();infoMode=null;$('#new-game-dialog').showModal();return;}if(action==='cancel-new'){$('#new-game-dialog').close();return;}
 if(action==='confirm-new'){$('#new-game-dialog').close();start(human()?.name||'Thomas');return;}
 if(action==='home'){ev.preventDefault();return;}
 if(action==='pause'){if(!paused&&game.phase==='reaction')pauseRemaining=Math.max(0,game.reaction.expiresAt-Date.now());paused=!paused;if(!paused&&game.phase==='reaction')game.reaction.expiresAt=Date.now()+pauseRemaining;render();return;}
 if(action==='clear'){selected.clear();render();return;}
 if(action==='sort-hand'){sortHand();save();render();return;}
 if(action==='confirm-play'){if(paused){notify('Resume the table first.');return;}const pending=pendingPlay;if(!pending)return;act(()=>{if(game.round!==pending.round)throw Error('That round has ended.');E.extend(game,0,pending.index,pending.ids);});pendingPlay=null;infoMode=null;$('#table-info').close();return;}
 if(paused&&!['stage-set','stage-run'].includes(action)){notify('Resume the table first.');return;}
 const handlers={
  'draw-stock':()=>E.draw(game,0,'stock'),
  'draw-discard':()=>{if(game.phase==='reaction')E.endReaction(game);E.draw(game,0,'discard');},
  'pass-discard':()=>{E.endReaction(game);E.draw(game,0,'stock');},
  'stage-set':()=>{stage('set');$('#table-info').close();infoMode=null;},'stage-run':()=>{stage('run');$('#table-info').close();infoMode=null;},
  'lay':()=>{E.layDown(game,0,staged);staged=[];revealing=true;$('#table-info').close();infoMode=null;},
  'discard':()=>{if(selected.size!==1)throw Error('Select exactly one card to discard.');const id=[...selected][0];E.discard(game,0,id);freshCards={};},
  'buy':()=>E.buy(game,0),
  'next-round':()=>{E.nextRound(game);staged=[];},
  'shanghai':()=>{const c=game.discard.at(-1);const spots=E.playableSpots(game,c);if(spots.length===1)E.callShanghai(game,0,spots[0]);else if(spots.length){claimMode=true;render();return;}else throw Error('This discard does not fit a combination on the table.');}
 };
 if(action==='shanghai'&&game?.phase==='reaction'&&E.playableSpots(game,game.discard.at(-1)).length>1){claimMode=true;render();return;}
 if(handlers[action])act(handlers[action]);
});
try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(parsed.version===1&&parsed.players.length===4){E.assertIntegrity(parsed);game=parsed;handOrder=parsed.handView?.round===parsed.round&&Array.isArray(parsed.handView.order)?parsed.handView.order:[];freshCards=parsed.handView?.round===parsed.round&&parsed.handView.fresh&&typeof parsed.handView.fresh==='object'?parsed.handView.fresh:{};if(!handOrder.length)sortHand();staged=parsed.privateDraft?.round===parsed.round&&Array.isArray(parsed.privateDraft.groups)?parsed.privateDraft.groups:[];cleanDraft();}}}catch{game=null;}
document.addEventListener('visibilitychange',()=>{if(document.hidden)finishHandDrag(false);else render();});
render();
