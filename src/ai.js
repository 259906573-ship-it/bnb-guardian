import {keccak256,toUtf8Bytes} from 'ethers';
import {json} from './chain.js';
const instructions='你是 Venus BSC 测试网风险解释助手。只解释给定链上数据与确定性规则，用简洁中文区分事实、限制及不确定性。无债务不需偿债。markets 仅包含已加入抵押的市场；空数组不能证明用户在整个协议没有任何存款。coverage 是抵押因子覆盖率，不是 Aave 清算阈值 HF。不要编造价格、雇佣、交易或收益承诺，不建议借款或取出抵押品。不产生交易参数或金额，不执行工具。所有资金操作必须由用户独立签名确认。';
export function aiConfigured(env){return env.AI_PROVIDER==='ollama'?!!env.OLLAMA_MODEL:env.AI_PROVIDER==='openai'&&!!env.OPENAI_API_KEY&&!!env.OPENAI_MODEL&&env.ALLOW_PAID_AI==='true';}
export async function explain(snapshot,risk,env=globalThis.process?.env||{},fetcher=fetch){
 const input=json({snapshot,risk}),assessmentHash=keccak256(toUtf8Bytes(input));
 const fallback={mode:'rules-only',text:risk.explanation||'确定性规则未要求偿债。',aiVerified:false,assessmentHash,authority:'explanation-only'};
 if(!aiConfigured(env))return {...fallback,aiError:'AI_NOT_CONFIGURED_OR_PAYMENT_NOT_APPROVED'};
 try{
 let endpoint,body,headers={'Content-Type':'application/json'},model;
 if(env.AI_PROVIDER==='ollama'){
  endpoint=env.OLLAMA_URL||'http://127.0.0.1:11434';const u=new URL(endpoint);
  if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.protocol!=='http:')throw new Error('LOCAL_MODEL_ONLY');
  endpoint=u.origin+'/api/chat';model=env.OLLAMA_MODEL;
  body={model,stream:false,think:false,keep_alive:'5m',messages:[{role:'system',content:instructions},{role:'user',content:input}],options:{temperature:0.1,num_predict:650}};
 }else{endpoint='https://api.openai.com/v1/responses';model=env.OPENAI_MODEL;headers.Authorization=`Bearer ${env.OPENAI_API_KEY}`;body={model,store:false,max_output_tokens:700,instructions,input};}
 const r=await fetcher(endpoint,{method:'POST',headers,signal:AbortSignal.timeout(env.AI_PROVIDER==='ollama'?90000:20000),body:JSON.stringify(body)});if(!r.ok)throw new Error('AI_UNAVAILABLE');
 const d=await r.json();const text=env.AI_PROVIDER==='ollama'?d.message?.content:(d.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
 if(typeof text!=='string'||!text.trim()||text.length>12000)throw new Error('AI_INVALID_RESPONSE');
 return {mode:env.AI_PROVIDER,model,text,aiVerified:true,assessmentHash,authority:'explanation-only',usage:env.AI_PROVIDER==='ollama'?{inputTokens:d.prompt_eval_count,outputTokens:d.eval_count}:d.usage};
 }catch{return {...fallback,aiError:'AI_UNAVAILABLE'};}
}
