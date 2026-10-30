import {execute,RoomError} from '../../server/rooms.mjs';
import {supabaseStore} from '../../server/supabase-store.mjs';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function handler(event){
 if(event.httpMethod!=='POST')return {statusCode:405,headers:{...headers,Allow:'POST'},body:JSON.stringify({error:'Use POST.'})};
 try{
  if((event.body?.length||0)>12000)throw new RoomError('Request too large.',413);
  const input=JSON.parse(event.body||'{}');
  if(input.op==='status')return {statusCode:200,headers,body:JSON.stringify({available:!!(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)})};
  const token=(event.headers.authorization||event.headers.Authorization||'').replace(/^Bearer /,'');
  const result=await execute(supabaseStore(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY),{...input,token});
  return {statusCode:200,headers,body:JSON.stringify(result)};
 }catch(e){const status=e.status||400;return {statusCode:status,headers,body:JSON.stringify({error:e instanceof RoomError||e.status?e.message:e instanceof SyntaxError?'Invalid request.':'That move could not be completed.'})};}
}
