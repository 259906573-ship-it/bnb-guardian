import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base='https://bnb-guardian.pages.dev',checks=[];
async function call(path,body){const r=await fetch(base+path,{signal:AbortSignal.timeout(45000),...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});const data=await r.json();checks.push({path,status:r.status,data});return {status:r.status,data};}
const h=await call('/healthz');
const w=await call('/v1/watch');
const c=await call('/agent-registration.json');assert.equal(c.status,200);assert.equal(c.data.services[0].endpoint,base+'/mcp');
for(const [id,method,params] of [[1,'initialize',{}],[2,'tools/list',{}],[3,'tools/call',{name:'venus_position',arguments:{account:'0x9F81A9588c310b90A0636E8D2fb31523a57fbaDC'}}]]){const x=await call('/mcp',{jsonrpc:'2.0',id,method,params});assert.equal(x.status,200);assert.ok(x.data.result);assert.ok(!x.data.result.isError);}
const result={version:'V0.0.3',observedAt:new Date().toISOString(),base,checks,transactionsSent:0,cronVerified:h.status===200&&w.status===200&&h.data.monitorFresh===true};writeFileSync('docs/公网部署验收.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({observedAt:result.observedAt,checks:checks.map(x=>({path:x.path,status:x.status})),monitor:h.data.monitor,cronVerified:result.cronVerified},null,2));
