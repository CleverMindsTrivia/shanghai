// Optional room audio. Only signaling and mute/presence cross the game server.
export function createRoomVoice({element,request,notify}){
 let session=null,stream=null,joining=false,joined=false,muted=false,speaking=false,client=null,cursor=0,timer=null,meter=null,context=null,generation=0;
 let config={iceServers:[{urls:'stun:stun.l.google.com:19302'}],hasTurn:false},outbox=[],polling=false,failures=0,status='Voice is optional',blocked=false,configAt=0;
 const peers=new Map(),members=new Map();let audioHub=null;
 element.innerHTML=`<details class="room-voice"><summary><span>Room voice</span><span class="voice-summary">Off</span></summary><div class="voice-body"><p class="voice-status" role="status"></p><div class="voice-controls"><button type="button" class="button secondary" data-voice="join">Join voice</button><button type="button" class="button secondary" data-voice="mute">Mute</button><button type="button" class="button secondary" data-voice="sound">Enable sound</button><button type="button" class="button secondary" data-voice="test">Test speaker</button><button type="button" class="text-button" data-voice="leave">Leave voice</button></div><div class="voice-people"></div><small class="voice-relay"></small></div></details>`;
 const find=s=>element.querySelector(s);
 function update(){
  element.hidden=!session;
  find('.voice-summary').textContent=joining?'Joining…':joined?(muted?'Muted':'Mic on'):'Off';
  find('.voice-status').textContent=status+(blocked?' Tap Enable sound to hear the other players.':'');
  for(const action of ['join','mute','sound','test','leave']){
   const b=find(`[data-voice="${action}"]`);b.hidden=action==='join'?joined:action==='test'?false:!joined;b.disabled=joining;
  }
  const mute=find('[data-voice="mute"]');mute.textContent=muted?'Unmute':'Mute';mute.setAttribute('aria-pressed',String(muted));
  find('.voice-relay').textContent=joined?(config.hasTurn?'Relay configured · headphones help prevent echo.':'Direct connections · some networks need a TURN relay. Headphones help prevent echo.'):'Join to talk with the people at this table.';
  const people=find('.voice-people');
  for(const child of [...people.children])if(!members.has(Number(child.dataset.seat)))child.remove();
  for(const m of members.values()){
   let row=people.querySelector(`[data-seat="${m.id}"]`);
   if(!row){row=document.createElement('div');row.className='voice-person';row.dataset.seat=m.id;const name=document.createElement('strong'),label=document.createElement('span');row.append(name,label);people.append(row);}
   const own=m.id===session?.you,pc=peers.get(m.id)?.pc;
   row.children[0].textContent=m.name+(own?' (you)':'');
   row.children[1].textContent=own?(muted?'Muted':speaking?'Speaking':'Mic on'):m.muted?'Muted':pc?.connectionState==='connected'?(m.speaking?'Speaking':'Connected'):pc?.connectionState==='failed'?'Retry needed':'Connecting…';
   row.classList.toggle('voice-speaking',own?speaking&&!muted:m.speaking&&!m.muted&&pc?.connectionState==='connected');
  }
 }
 async function call(op,extra={}){return request({...extra,op,code:session.code,client,cursor});}
 function closePeer(id){const p=peers.get(id);if(!p)return;p.pc.onicecandidate=p.pc.ontrack=p.pc.onconnectionstatechange=null;p.pc.close();p.audio?.remove();peers.delete(id);}
 function enqueue(to,signal){const m=members.get(to);if(!joined||!m)return;outbox.push({id:crypto.randomUUID(),to,targetClient:m.client,signal});if(outbox.length>128){outbox=[];status='Voice connection needs a restart. Leave and rejoin voice.';update();}}
 function makePeer(id){
  const existing=peers.get(id);if(existing)return existing;
  const pc=new RTCPeerConnection({iceServers:config.iceServers}),p={pc,client:members.get(id).client,pending:[],audio:null,offering:false,retried:false};peers.set(id,p);
  for(const track of stream.getAudioTracks())pc.addTrack(track,stream);
  pc.onicecandidate=e=>{if(e.candidate)enqueue(id,{kind:'ice',candidate:e.candidate.toJSON()});};
  pc.ontrack=e=>{
   if(!p.audio){p.audio=document.createElement('audio');p.audio.autoplay=true;p.audio.playsInline=true;p.audio.setAttribute('playsinline','');p.audio.volume=1;audioHub.append(p.audio);}
   p.audio.srcObject=e.streams[0]||new MediaStream([e.track]);p.audio.play().catch(()=>{blocked=true;update();});
  };
  pc.onconnectionstatechange=()=>{
   if(pc.connectionState==='failed'){
    if(!p.retried&&session.you<id){p.retried=true;offer(id,true);}else{status='A voice connection failed. Leave and rejoin voice; a relay may be needed for this network.';}
   }
   update();
  };return p;
 }
 async function offer(id,restart=false){
  if(!joined||!members.has(id))return;const p=makePeer(id),epoch=generation;
  if(p.offering||p.pc.signalingState!=='stable')return;p.offering=true;
  try{await p.pc.setLocalDescription(await p.pc.createOffer(restart?{iceRestart:true}:{}));if(epoch===generation)enqueue(id,{kind:'offer',description:p.pc.localDescription.toJSON()});}catch{if(epoch===generation){status='Could not connect voice. Leave and rejoin to retry.';update();}}finally{p.offering=false;}
 }
 async function signal(message){
  if(!joined||!members.has(message.from)||members.get(message.from).client!==message.fromClient)return;
  const p=makePeer(message.from),s=message.signal,epoch=generation;
  try{
   if(s.kind==='offer'){
    if(p.pc.signalingState!=='stable')return; // Only the lower seat initiates offers.
    await p.pc.setRemoteDescription(s.description);for(const ice of p.pending.splice(0))await p.pc.addIceCandidate(ice);
    await p.pc.setLocalDescription(await p.pc.createAnswer());if(epoch===generation)enqueue(message.from,{kind:'answer',description:p.pc.localDescription.toJSON()});
   }else if(s.kind==='answer'){
    if(p.pc.signalingState!=='have-local-offer')return;
    await p.pc.setRemoteDescription(s.description);for(const ice of p.pending.splice(0))await p.pc.addIceCandidate(ice);
   }else if(s.kind==='ice'){if(p.pc.remoteDescription)await p.pc.addIceCandidate(s.candidate);else if(p.pending.length<100)p.pending.push(s.candidate);}
  }catch{if(epoch===generation){status='Voice could not finish connecting. Leave and rejoin to retry.';update();}}
 }
 async function receive(data){
  if(!joined)return;if(data.config){config=data.config;configAt=Date.now();for(const p of peers.values())p.pc.setConfiguration?.({iceServers:config.iceServers});}const previous=new Map(members);members.clear();for(const m of data.members)members.set(m.id,m);
  for(const id of peers.keys())if(!members.has(id)||previous.get(id)?.client!==members.get(id).client)closePeer(id);
  for(const message of data.signals)await signal(message);
  for(const m of members.values())if(m.id!==session.you&&session.you<m.id&&!peers.has(m.id))void offer(m.id);
  cursor=data.cursor;update();
 }
 async function tick(){
  if(!joined||polling)return;polling=true;const epoch=generation,batch=outbox.slice(0,32);
  try{const result=await call('poll',{messages:batch,muted,speaking,refreshConfig:Date.now()-configAt>1800000});if(epoch!==generation)return;outbox.splice(0,batch.length);failures=0;await receive(result);}
  catch(e){if(epoch!==generation)return;if(e.status===409||e.status===401||e.status===410){await leave();status=e.message;notify(e.message);}else{failures++;status='Voice reconnecting…';if(failures>=5){await leave();status='Voice lost connection. Tap Join voice to retry.';}}update();}
  finally{polling=false;}
 }
 function startMeter(){
  try{context=new (window.AudioContext||window.webkitAudioContext)();void context.resume();const source=context.createMediaStreamSource(stream),analyser=context.createAnalyser();analyser.fftSize=512;source.connect(analyser);const samples=new Uint8Array(512);
   meter=setInterval(()=>{analyser.getByteTimeDomainData(samples);const active=!muted&&Math.sqrt(samples.reduce((sum,n)=>sum+((n-128)/128)**2,0)/samples.length)>.035;if(active!==speaking){speaking=active;update();}},250);
  }catch{/* Audio works without a speaking meter. */}
 }
 async function join(){
  if(joined||joining||!session)return;
  if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==='undefined'){notify('Voice needs HTTPS and a browser with microphone support.');return;}
  joining=true;status='Allow microphone access to join voice.';const epoch=++generation;client=crypto.randomUUID();cursor=0;update();
  try{
   const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(epoch!==generation){media.getTracks().forEach(t=>t.stop());return;}stream=media;
   // Membership succeeds before any audio peers are created.
   const result=await call('join');if(epoch!==generation)return;
   config=result.config;joined=true;muted=false;speaking=false;failures=0;status='Voice on · everyone who joins this room can hear you.';
   startMeter();await receive(result);timer=setInterval(tick,1500);void tick();
   for(const track of stream.getAudioTracks())track.onended=()=>{void leave();notify('Microphone stopped. Tap Join voice to reconnect.');};
  }catch(e){if(epoch===generation){await leave();status=e.name==='NotAllowedError'?'Microphone access was denied. Allow it in your browser settings.':e.message;notify(status);}}
  finally{if(epoch===generation)joining=false;update();}
 }
 async function leave(send=true){
  const wasJoined=joined,oldSession=session,oldClient=client;++generation;joined=false;joining=false;muted=false;speaking=false;blocked=false;cursor=0;outbox=[];
  clearInterval(timer);clearInterval(meter);timer=meter=null;
  for(const id of [...peers.keys()])closePeer(id);members.clear();
  for(const track of stream?.getTracks()||[]){track.onended=null;track.stop();}stream=null;
  if(context){void context.close().catch(()=>{});context=null;}
  status='Voice is off';update();
  if(send&&wasJoined&&oldSession)try{await request({op:'leave',code:oldSession.code,client:oldClient});}catch{/* Presence expires if this device is offline. */}
 }
 function toggleMute(){if(!joined)return;muted=!muted;for(const track of stream.getAudioTracks())track.enabled=!muted;if(muted)speaking=false;update();void tick();}
 async function sound(){blocked=false;await context?.resume();for(const p of peers.values())if(p.audio)try{await p.audio.play();}catch{blocked=true;}update();}
 async function testSpeaker(){try{const ctx=new (window.AudioContext||window.webkitAudioContext)();await ctx.resume();const oscillator=ctx.createOscillator(),gain=ctx.createGain();gain.gain.value=.08;oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+.25);oscillator.onended=()=>void ctx.close();}catch{notify('Speaker test could not play. Check device volume and browser audio permissions.');}}
 function setSession(next){if(session&&(session.code!==next?.code||session.you!==next?.you))void leave();session=next;update();}
 function handleAction(action){if(action==='join')return join();if(action==='leave')return leave();if(action==='mute')return toggleMute();if(action==='sound')return sound();if(action==='test')return testSpeaker();}
 audioHub=document.createElement('div');audioHub.hidden=true;audioHub.id='voice-audio-hub';document.body.append(audioHub);
 element.addEventListener('click',e=>{const b=e.target.closest('[data-voice]');if(b&&!b.disabled)void handleAction(b.dataset.voice);});
 window.addEventListener('pagehide',()=>void leave(false));
 update();return {setSession,join,leave,toggleMute,handleAction};
}
