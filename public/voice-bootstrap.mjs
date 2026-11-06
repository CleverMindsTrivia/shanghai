import {createRoomVoice} from './voice.mjs';
const KEY='shanghai.room.v1';
const element=document.getElementById('room-voice');
const notify=message=>{const el=document.querySelector('#mp-notice');el.textContent=message;el.classList.add('visible');setTimeout(()=>el.classList.remove('visible'),6000);};
async function request(input){
 const session=JSON.parse(localStorage.getItem(KEY)||'null');
 if(!session?.token||session.code!==input.code)throw Error('Join the game room before enabling voice.');
 const response=await fetch('/.netlify/functions/voice',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token},body:JSON.stringify(input),signal:AbortSignal.timeout(12000)});
 let data;try{data=await response.json();}catch{throw Error('Voice service is not deployed yet.');}
 if(!response.ok)throw Object.assign(Error(data.error||'Voice could not connect.'),{status:response.status});return data;
}
const voice=createRoomVoice({element,request,notify});
window.addEventListener('shanghai-room',e=>voice.setSession(e.detail));
