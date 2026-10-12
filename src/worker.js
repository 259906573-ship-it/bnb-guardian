import {getAddress} from 'ethers';
import {provider,atBlock,position,json,network} from './chain.js';
import {assess} from './risk.js';
import {metadata} from './metadata.js';
import {explain,aiConfigured} from './ai.js';
import {challenge,authorizeInvocation,recordDelivery} from './marketplace.js';
import {VERSION,SEMVER} from './version.js';

const DEFAULT_WALLET='0x9F81A9588c310b90A0636E8D2fb31523a57fbaDC';
const STALE_MS=180000;
const tools=[{name:'venus_position',description:'Read-only Venus BSC Testnet position and deterministic repayment risk analysis.',inputSchema:{type:'object',properties:{account:{type:'string',pattern:'^0x[0-9a-fA-F]{40}$'}},required:['account'],additionalProperties:false}}];
const response=(status,data)=>new Response(json(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fresh=(beat,now)=>beat?.ok===true&&Number.isFinite(beat.observedAt)&&now>=beat.observedAt&&now-beat.observedAt<STALE_MS;
async function readBeat(db){if(!db)return null;const row=await db.prepare('SELECT payload FROM monitor_state WHERE name = ?').bind('heartbeat').first();return row?JSON.parse(row.payload):null;}
async function writeBeat(db,beat){await db.prepare('INSERT INTO monitor_state(name,observed_at,payload) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET observed_at=excluded.observed_at,payload=excluded.payload WHERE excluded.observed_at >= monitor_state.observed_at').bind('heartbeat',beat.observedAt,json(beat)).run();}
async function allowed(request,env,time){
 const ip=request.headers.get('CF-Connecting-IP')||'local';
 if(env.RATE_LIMITER)return (await env.RATE_LIMITER.limit({key:ip})).success;
 if(!env.MONITOR_DB)throw new Error('RATE_STORAGE_REQUIRED');
 const bucket=Math.floor(time/60000);
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${bucket}:${ip}`));
 const key=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
 const row=await env.MONITOR_DB.prepare('INSERT INTO request_limits(ip_hash,bucket,hits) VALUES(?,?,1) ON CONFLICT(ip_hash,bucket) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,bucket).first();
 return row?.hits<=60;
}
async function boundedBody(request){
 const reader=request.body?.getReader();if(!reader)throw new Error('EMPTY_BODY');
 const chunks=[];let size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new Error('BODY_TOO_LARGE');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return new TextDecoder().decode(bytes);
}
function watchAddresses(env){
 const list=(env.WATCH_ADDRESSES||env.CAMPAIGN_WALLET||DEFAULT_WALLET).split(',').filter(Boolean).map(getAddress);
 const unique=[...new Set(list)];if(!unique.length||unique.length>3)throw new Error('WATCH_LIMIT');return unique;
}
function canonical(request,env){const url=new URL(env.PUBLIC_BASE_URL||new URL(request.url).origin);if(url.username||url.password)throw new Error('INVALID_PUBLIC_URL');return url.origin;}
const card=(base,env,active)=>metadata(base,env,active);

// Dependency injection is used only by tests. Production always uses the real RPC.
export function createWorker({createProvider=provider,readPosition=position,readBlock=atBlock,now=Date.now}={}){
 const makeProvider=env=>createProvider(env.RPC_URL||network.rpcUrl,{maxCalls:45});
 async function monitor(env,scheduledTime){
  if(!env.MONITOR_DB)throw new Error('MONITOR_DB_REQUIRED');
  const observedAt=now();const snapshots=[];let p;
  try{
   const accounts=watchAddresses(env);p=makeProvider(env);
   const block=await readBlock(p);
   for(const account of accounts){const snapshot=await readPosition(p,account,block.number);snapshots.push({version:VERSION,position:snapshot,risk:assess(snapshot)});}
   const beat={ok:true,observedAt,scheduledTime,block:block.number,blockHash:block.hash,accounts:snapshots.length,transactionsSent:0};
   const statements=snapshots.map(data=>env.MONITOR_DB.prepare('INSERT INTO monitored_positions(account,observed_at,payload) VALUES(?,?,?) ON CONFLICT(account) DO UPDATE SET observed_at=excluded.observed_at,payload=excluded.payload WHERE excluded.observed_at >= monitored_positions.observed_at').bind(data.position.account,observedAt,json(data)));
   statements.push(env.MONITOR_DB.prepare('INSERT INTO monitor_state(name,observed_at,payload) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET observed_at=excluded.observed_at,payload=excluded.payload WHERE excluded.observed_at >= monitor_state.observed_at').bind('heartbeat',observedAt,json(beat)));
   statements.push(env.MONITOR_DB.prepare('DELETE FROM request_limits WHERE bucket < ?').bind(Math.floor(observedAt/60000)-10));
   await env.MONITOR_DB.batch(statements);return beat;
  }catch{
   await writeBeat(env.MONITOR_DB,{ok:false,observedAt,scheduledTime,error:'MONITOR_OR_CHAIN_FAILED',transactionsSent:0});
   throw new Error('MONITOR_OR_CHAIN_FAILED');
  }finally{p?.destroy();}
 }
 async function report(env,account){
  account=getAddress(account);const p=makeProvider(env);
  try{const snapshot=await readPosition(p,account);return {version:VERSION,position:snapshot,risk:assess(snapshot)};}finally{p.destroy();}
 }
 return {
  async scheduled(controller,env){await monitor(env,controller.scheduledTime);},
  async fetch(request,env){
   try{
    const u=new URL(request.url),base=canonical(request,env);
    // When a canonical URL is configured, reject alternate-host requests.
    if(env.PUBLIC_BASE_URL&&u.origin!==base)return response(403,{error:'HOST_DENIED'});
    if(!await allowed(request,env,now()))return response(429,{error:'RATE_LIMIT'});
    if(request.method==='GET'&&u.pathname==='/healthz'){
     let beat=null;try{beat=await readBeat(env.MONITOR_DB);}catch{return response(503,{version:VERSION,error:'MONITOR_STORAGE_UNAVAILABLE',transactionsSent:0});}
     const p=makeProvider(env);let block;
     try{block=await readBlock(p);}finally{p.destroy();}
     const ok=fresh(beat,now());return response(ok?200:503,{name:'BNB Guardian',version:VERSION,chainId:97,runtime:'cloudflare-workers',rpc:{ok:true,block:block.number},monitor:beat||{ok:false,error:'NO_SCHEDULED_RUN'},monitorFresh:ok,execution:'user-confirmation-required',registered:!!env.AGENT_ID,aiConfigured:aiConfigured(env),transactionsSent:0});
    }
    if(request.method==='GET'&&['/agent-registration.json','/.well-known/agent-registration.json','/.well-known/agent-card.json'].includes(u.pathname))return response(200,card(base,env,fresh(await readBeat(env.MONITOR_DB),now())));
    if(request.method==='GET'&&u.pathname==='/v1/position')return response(200,await report(env,u.searchParams.get('account')));
    if(request.method==='GET'&&u.pathname==='/v1/watch'){
     if(!env.MONITOR_DB)return response(503,{error:'MONITOR_DB_REQUIRED'});
     const beat=await readBeat(env.MONITOR_DB),rows=await env.MONITOR_DB.prepare('SELECT observed_at,payload FROM monitored_positions ORDER BY account').all();
     const ok=fresh(beat,now());return response(ok?200:503,{version:VERSION,monitor:beat,monitorFresh:ok,positions:(rows.results||[]).map(row=>({observedAt:row.observed_at,data:JSON.parse(row.payload),stale:now()-row.observed_at>=STALE_MS}))});
    }
    if(request.method==='GET'&&u.pathname==='/v1/marketplace/challenge'){
     const expiresAt=Math.floor(now()/1000)+300;
     const message=challenge({base,subId:u.searchParams.get('subId'),account:u.searchParams.get('account'),expiresAt},now());
     return response(200,{version:VERSION,expiresAt,message,requiresUserSignature:true,scope:'read-only report; no payment authorization'});
    }
    if(request.method==='POST'&&['/v1/explain','/v1/marketplace/invoke'].includes(u.pathname)){
     if(Number(request.headers.get('Content-Length')||0)>8192)return response(413,{error:'BODY_TOO_LARGE'});
     const text=await boundedBody(request);let x;try{x=JSON.parse(text);}catch{return response(400,{error:'INVALID_JSON'});}
     if(u.pathname==='/v1/explain'){
      if(!aiConfigured(env))return response(503,{error:'AI_NOT_CONFIGURED_OR_PAYMENT_NOT_APPROVED'});
      if(env.AI_PROVIDER==='openai'&&(!env.EXPLAIN_API_TOKEN||request.headers.get('Authorization')!==`Bearer ${env.EXPLAIN_API_TOKEN}`))return response(401,{error:'EXPLAIN_AUTH_REQUIRED'});
      if(!env.MONITOR_DB)return response(503,{error:'AI_BUDGET_STORAGE_REQUIRED'});
      const bucket=Math.floor(now()/60000);
      const row=await env.MONITOR_DB.prepare('INSERT INTO request_limits(ip_hash,bucket,hits) VALUES(?,?,1) ON CONFLICT(ip_hash,bucket) DO UPDATE SET hits=hits+1 RETURNING hits').bind('ai-global',bucket).first();
      if(row.hits>2)return response(429,{error:'AI_RATE_LIMIT'});
      const data=await report(env,x.account);const explanation=await explain(data.position,data.risk,env);
      return response(explanation.aiVerified?200:503,{...data,explanation,transactionsSent:0});
     }
     const p=makeProvider(env);let auth;
     try{auth=await authorizeInvocation(p,x,env,base,now());}catch{return response(403,{error:'HIRE_OR_SIGNATURE_NOT_VALID'});}finally{p.destroy();}
     const data=await report(env,auth.subscriber),delivery=await recordDelivery(env.MONITOR_DB,auth,data,now());
     return response(200,{version:VERSION,...data,delivery});
    }
    if(request.method==='POST'&&u.pathname==='/mcp'){
     // Read a bounded stream, including when Content-Length is omitted.
     const reader=request.body?.getReader();if(!reader)return response(400,{error:'EMPTY_BODY'});
     const chunks=[];let size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return response(413,{error:'BODY_TOO_LARGE'});}chunks.push(value);}
     const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
     let x;try{x=JSON.parse(new TextDecoder().decode(bytes));}catch{return response(400,{error:'INVALID_JSON'});}
     if(!x||x.jsonrpc!=='2.0'||typeof x.method!=='string')return response(400,{error:'INVALID_RPC'});
     if(x.id===undefined)return new Response(null,{status:202});
     let result;
     if(x.method==='initialize')result={protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'bnb-guardian',version:SEMVER}};
     else if(x.method==='tools/list')result={tools};
     else if(x.method==='tools/call'&&x.params?.name==='venus_position'){
      try{result={content:[{type:'text',text:json(await report(env,x.params.arguments?.account))}]};}
      catch{return response(200,{jsonrpc:'2.0',id:x.id,result:{isError:true,content:[{type:'text',text:'POSITION_OR_CHAIN_UNAVAILABLE'}]}});}
     }else return response(200,{jsonrpc:'2.0',id:x.id,error:{code:-32601,message:'Method not found'}});
     return response(200,{jsonrpc:'2.0',id:x.id,result});
    }
    if(request.method==='GET'&&u.pathname==='/')return response(200,{name:'BNB Guardian',version:VERSION,chainId:97,runtime:'cloudflare-workers',endpoints:['/healthz','/agent-registration.json','/mcp','/v1/position','/v1/watch'],execution:'No signing or broadcasting',status:'development; registration, listing and functional transactions are not verified'});
    return response(404,{error:'NOT_FOUND'});
   }catch{return response(503,{error:'REQUEST_OR_CHAIN_UNAVAILABLE',transactionSent:false});}
  }
 };
}
export default createWorker();
