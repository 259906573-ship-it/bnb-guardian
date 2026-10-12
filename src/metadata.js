import {network} from './chain.js';
import {VERSION} from './version.js';
export function metadata(base,env={},active=false){
 const u=new URL(base);if(u.username||u.password)throw new Error('PUBLIC_URL_CREDENTIALS');
 const registrations=env.AGENT_ID?[{agentId:String(env.AGENT_ID),agentRegistry:`eip155:97:${network.identityRegistry}`}]:[];
 return {type:'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',name:'BNB Guardian',description:`${VERSION}: monitors Venus Core BSC Testnet collateral-factor coverage and prepares user-confirmed repayments. AI explanations never authorize transfers.`,services:[{name:'web',endpoint:u.origin},{name:'MCP',endpoint:`${u.origin}/mcp`,version:'2025-06-18'}],x402Support:false,active,registrations,supportedTrust:[],x_category:'health factor',x_chainId:97,x_version:VERSION,x_health:`${u.origin}/healthz`,x_executionMode:'user-confirmed unsigned intents',x_imageStatus:'PENDING_HIGHEST_QUALITY_MASCOT',x_ai:{authority:'explanation-only',configured:!!((env.AI_PROVIDER==='ollama'&&env.OLLAMA_MODEL)||(env.AI_PROVIDER==='openai'&&env.OPENAI_API_KEY&&env.OPENAI_MODEL&&env.ALLOW_PAID_AI==='true'))},x_marketplace:{name:'HelloFugu',listingStatus:env.AGENT_ID?'UNVERIFIED':'AWAITING_ID',registry:network.helloFugu.registry,invoke:`${u.origin}/v1/marketplace/invoke`,challenge:`${u.origin}/v1/marketplace/challenge`}};
}
export function validateMetadata(card,base,id=null){
 const origin=new URL(base).origin;
 if(card.type!=='https://eips.ethereum.org/EIPS/eip-8004#registration-v1'||card.name!=='BNB Guardian'||card.x_category!=='health factor'||card.x_chainId!==97)throw new Error('INVALID_METADATA');
 if(!card.services?.some(s=>s.name==='MCP'&&s.endpoint===origin+'/mcp'))throw new Error('INVALID_MCP_ENDPOINT');
 if(id!==null&&!card.registrations?.some(r=>String(r.agentId)===String(id)&&r.agentRegistry.toLowerCase()===`eip155:97:${network.identityRegistry}`.toLowerCase()))throw new Error('REGISTRATION_REFERENCE_MISMATCH');
 return true;
}

export function listingMetadataURI(base,id,agentWallet){
 const origin=new URL(base).origin;
 const data={name:'BNB Guardian',summary:'Venus Core BSC Testnet risk reports and user-confirmed repayment preparation',description:'Independent Venus integration; AI explains risk but cannot sign or transfer funds.',category:'HEALTH_FACTOR',agentWallet,erc8004Identity:{chainId:97,agentId:String(id),registry:network.identityRegistry},onchainExecution:false,limits:'No autonomous signing. Functional transaction evidence pending. V0.0.3 paid-hire success awaiting registration and listing.',verify:origin+'/agent-registration.json',services:[{name:'MCP',endpoint:origin+'/mcp'}]};
 const bytes=new TextEncoder().encode(JSON.stringify(data));
 return 'data:application/json;base64,'+btoa(String.fromCharCode(...bytes));
}
