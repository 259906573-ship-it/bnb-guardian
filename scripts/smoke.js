import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.SMOKE_URL||'http://127.0.0.1:8797';
const results=[];
async function check(path,options){const r=await fetch(base+path,{signal:AbortSignal.timeout(25000),...options});const data=await r.json();assert.equal(r.status,200);results.push({path,status:r.status});return data;}
const health=await check('/healthz');assert.equal(health.chainId,97);assert.equal(health.monitor.ok,true);assert.equal(health.registered,false);
const card=await check('/agent-registration.json');assert.equal(card.name,'BNB Guardian');assert.equal(card.services[0].name,'MCP');
const account='0x9F81A9588c310b90A0636E8D2fb31523a57fbaDC';
const pos=await check(`/v1/position?account=${account}`);assert.equal(pos.position.chainId,97);assert.equal(pos.position.account,account);assert.equal(pos.risk.action,'none');
for(const [method,params] of [['initialize',{}],['tools/list',{}],['tools/call',{name:'venus_position',arguments:{account}}]]){
 const x=await check('/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});assert.ok(x.result);if(method==='tools/call')assert.equal(JSON.parse(x.result.content[0].text).position.chainId,97);
}
const report={version:'V0.0.3',type:'LOCAL_READ_ONLY_SMOKE',observedAt:new Date().toISOString(),base,results,observedBlock:pos.position.blockNumber,observedBlockHash:pos.position.blockHash,borrowedUsdWad:pos.position.debtUsdWad,transactionsSent:0,limitations:['Live read and MCP checks only. No public deployment, AI call, positive-debt repayment, marketplace or registration transaction was verified.']};
writeFileSync('docs/本地接口验证.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
