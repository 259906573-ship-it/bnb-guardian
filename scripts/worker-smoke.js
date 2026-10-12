import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
const base=process.env.SMOKE_URL||'http://127.0.0.1:8798',results=[];
async function call(path,options={}){const r=await fetch(base+path,{signal:AbortSignal.timeout(45000),...options});const data=await r.json();results.push({path,status:r.status});return {r,data};}
const triggered=await call('/cdn-cgi/local/scheduled?format=json');assert.equal(triggered.r.status,200);assert.equal(triggered.data.outcome,'ok');
const h=await call('/healthz');assert.equal(h.r.status,200);assert.equal(h.data.version,'V0.0.3');assert.equal(h.data.monitorFresh,true);assert.equal(h.data.transactionsSent,0);
const card=await call('/agent-registration.json');assert.equal(card.data.active,true);assert.equal(card.data.x_version,'V0.0.3');
const watch=await call('/v1/watch');assert.equal(watch.r.status,200);assert.ok(watch.data.positions.length>0);
const account='0x9F81A9588c310b90A0636E8D2fb31523a57fbaDC';const pos=await call('/v1/position?account='+account);assert.equal(pos.r.status,200);assert.equal(pos.data.position.chainId,97);
const m=await call('/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'venus_position',arguments:{account}}})});assert.equal(m.r.status,200);assert.equal(JSON.parse(m.data.result.content[0].text).position.chainId,97);
const report={version:'V0.0.3',type:'LOCAL_WORKER_REAL_RPC',observedAt:new Date().toISOString(),base,results,cron:h.data.monitor,block:pos.data.position.blockNumber,transactionsSent:0,publicDeployment:false,limitations:['Local Workerd scheduled invocation and D1 persistence tested; not a deployed Cloudflare Cron, not a signed operation, not an AI model call.']};writeFileSync('docs/Workers本地验收.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
