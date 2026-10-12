import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
const base='http://127.0.0.1:8803',checks=[];
async function call(path,body){const r=await fetch(base+path,{signal:AbortSignal.timeout(100000),...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});const data=await r.json();checks.push({path,status:r.status});return {r,data};}
const account='0x9F81A9588c310b90A0636E8D2fb31523a57fbaDC';
for(const path of ['/healthz','/v1/watch','/agent-registration.json','/.well-known/agent-registration.json','/.well-known/agent-card.json']){const x=await call(path);assert.equal(x.r.status,200);}
const position=await call('/v1/position?account='+account);assert.equal(position.data.position.chainId,97);
const bad=await call('/v1/marketplace/invoke',{account,subId:'1',signature:'0x',expiresAt:Math.floor(Date.now()/1000)+60});assert.equal(bad.r.status,403);
const challenge=await call('/v1/marketplace/challenge?subId=1&account='+account);assert.equal(challenge.r.status,200);assert.equal(challenge.data.requiresUserSignature,true);
const ai=await call('/v1/explain',{account});assert.equal(ai.r.status,200);assert.equal(ai.data.explanation.aiVerified,true);assert.equal(ai.data.explanation.authority,'explanation-only');assert.equal(ai.data.transactionsSent,0);
writeFileSync('docs/本地V003端到端验收.json',JSON.stringify({version:'V0.0.3',checkedAt:new Date().toISOString(),checks,explanation:ai.data.explanation,health:position.data.risk,transactionsSent:0,marketplaceInvocation:'Invalid hire/signature rejected; successful external paid hire not yet possible without identity and listing'},null,2)+'\n');console.log(JSON.stringify({checks,realAI:ai.data.explanation.aiVerified,transactionsSent:0},null,2));
