import {voiceRequest} from '../../server/voice.mjs';
import {supabaseStore} from '../../server/supabase-store.mjs';
import {RoomError} from '../../server/rooms.mjs';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function handler(event){
 if(event.httpMethod!=='POST')return {statusCode:405,headers:{...headers,Allow:'POST'},body:JSON.stringify({error:'Use POST.'})};
 try{
  if((event.body?.length||0)>64000)throw new RoomError('Voice request too large.',413);
  const input=JSON.parse(event.body||'{}');
  const token=(event.headers?.authorization||event.headers?.Authorization||'').replace(/^Bearer /,'');
  const rooms=supabaseStore(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
  const voices=supabaseStore(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,fetch,'shanghai_voice');
  const result=await voiceRequest(rooms,voices,{...input,token},process.env);
  return {statusCode:200,headers,body:JSON.stringify(result)};
 }catch(e){return {statusCode:e.status||400,headers,body:JSON.stringify({error:e instanceof RoomError?e.message:e instanceof SyntaxError?'Invalid request.':'Voice service is unavailable. Try again shortly.'})};}
}
