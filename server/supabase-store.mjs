export function supabaseStore(url,key,fetcher=fetch){
 if(!url||!key)throw Object.assign(new Error('Private rooms are not connected yet.'),{status:503});
 const base=new URL('/rest/v1/shanghai_rooms',url);if(base.protocol!=='https:')throw Error('Supabase requires HTTPS.');
 async function call(method,query,body){const response=await fetcher(base.href+query,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000)});if(!response.ok)throw Object.assign(new Error(response.status===409?'Room already exists.':'The room service is unavailable.'),{status:response.status===409?409:503});return response.json();}
 return {
  async create(code,state){await call('POST','',{code,state,version:1});},
  async get(code){const rows=await call('GET','?code=eq.'+encodeURIComponent(code)+'&select=code,state,version,expires_at');if(!rows[0])throw Object.assign(new Error('Room not found.'),{status:404});return rows[0];},
  async cas(code,version,state){const rows=await call('PATCH','?code=eq.'+encodeURIComponent(code)+'&version=eq.'+version,{state,version:version+1});return rows.length===1;}
 };
}
