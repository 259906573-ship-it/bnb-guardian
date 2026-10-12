import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
const base=process.env.SMOKE_URL||'http://127.0.0.1:8799',checks=[];
async function get(path,options){const r=await fetch(base+path,{signal:AbortSignal.timeout(30000),...options});const data=await r.json();checks.push({path,status:r.status});return {r,data};}
// Cron belongs to the companion Worker, never to the public Pages endpoint.
const cron=await fetch('http://127.0.0.1:8798/cdn-cgi/local/scheduled?format=json',{signal:AbortSignal.timeout(45000)});assert.equal(cron.status,200);assert.equal((await cron.json()).outcome,'ok');
const h=await get('/healthz');assert.equal(h.r.status,200);assert.equal(h.data.monitorFresh,true);
const watch=await get('/v1/watch');assert.equal(watch.r.status,200);assert.equal(watch.data.monitor.block,h.data.monitor.block);
const card=await get('/agent-registration.json');assert.equal(card.r.status,200);assert.equal(card.data.x_version,'V0.0.3');assert.equal(card.data.services[0].endpoint,base+'/mcp');
const account='0x9F81A9588c310b90A0636E8D2fb31523a57fbaDC';const p=await get('/v1/position?account='+account);assert.equal(p.r.status,200);assert.equal(p.data.position.chainId,97);
let rateLimited=0;for(let i=0;i<61;i++){const r=await fetch(base+'/not-a-route',{headers:{'CF-Connecting-IP':'198.51.100.97'},signal:AbortSignal.timeout(10000)});if(r.status===429)rateLimited++;else assert.equal(r.status,404);}assert.ok(rateLimited>0);
const report={version:'V0.0.3',type:'LOCAL_PAGES_AND_COMPANION_WORKER_REAL_RPC',observedAt:new Date().toISOString(),checks,cronBlock:h.data.monitor.block,pagesReadSameCronBlock:true,rateLimitVerified:true,rateLimitedResponses:rateLimited,publicDeployment:false,transactionsSent:0,limitations:['Local Pages/Worker runtimes share local D1. Public domain availability, Cloudflare schedule propagation and free-tier CPU limits still require deployment verification.']};writeFileSync('docs/Pages与后台联动验收.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
