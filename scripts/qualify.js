import {readFileSync} from 'node:fs';
import {provider,json,lower} from '../src/chain.js';
import {verifyRepayment,verifyFuguHire,verifyIdentity,verifyRegistration,distinctAgents} from '../src/evidence.js';
const path=process.argv[2]||'config/campaign.json';const m=JSON.parse(readFileSync(path));const p=provider();
const report={registration_tx:null,agent_id:null,marketplace_url:null,hire_evidence:{outgoing:[],external:[]},functional_tx_evidence:[],version:'V0.0.3',checkedAt:new Date().toISOString(),qualified:false,checks:{},evidence:{actions:[],outgoingHires:[],externalHires:[]},issues:[],limitations:['Wallet independence and indirect/common-source funding cannot be proven from receipts alone. Manual organizer review is required.','Only the HelloFugu Chain 97 hire adapter has been implemented and verified against source; other markets are UNKNOWN, never counted.','Five repayments must be legitimate triggered work; no artificial risk creation or circular repayments.']};
const registeredAt=typeof m.registeredAt==='string'?Date.parse(m.registeredAt)/1000:NaN;
report.checks.registration=Number.isFinite(registeredAt)&&!!m.registrationEvidenceUrl?'REVIEW_REQUIRED':'MISSING';
try{
 if(m.agentId!==null&&m.agentId!==undefined&&m.publicBaseUrl&&m.registrationTx){report.evidence.registration=await verifyRegistration(p,m.registrationTx,m.agentId,m.wallet,m.publicBaseUrl,registeredAt);report.registration_tx=m.registrationTx;report.agent_id=String(m.agentId);report.evidence.identity=await verifyIdentity(p,m.agentId,m.wallet,m.publicBaseUrl);report.checks.identityAndListing='PASS';report.marketplace_url=report.evidence.identity.marketplaceUrl;}else report.checks.identityAndListing='MISSING';
}catch{report.checks.identityAndListing='FAIL';report.issues.push('Identity, public endpoint or listing could not be independently verified.');}
for(const e of m.actions||[]){try{if(report.evidence.actions.some(x=>x.txHash.toLowerCase()===e.txHash.toLowerCase()))throw new Error('DUPLICATE');report.evidence.actions.push(await verifyRepayment(p,e,m.agentWallet,registeredAt));}catch{report.issues.push(`Action rejected or unverifiable: ${e.txHash}`);}}
for(const [field,out] of [['outgoingHires','outgoingHires'],['externalHires','externalHires']])for(const e of m[field]||[]){try{
 if(e.marketplace!=='HelloFugu'||e.chainId!==97)throw new Error('UNSUPPORTED_MARKET_ADAPTER');
 const v=await verifyFuguHire(p,e,registeredAt);
 if(out==='outgoingHires'&&lower(v.subscriber)!==lower(m.wallet))throw new Error('NOT_CAMPAIGN_WALLET');
 if(out==='externalHires'&&(v.agentId!==String(m.agentId)||lower(v.subscriber)===lower(m.wallet)||lower(v.listingOwner)!==lower(m.wallet)||!v.completed||!e.deliveryEvidence))throw new Error('NOT_COMPLETED_EXTERNAL_HIRE');
 if(report.evidence[out].some(x=>x.subId===v.subId&&x.marketplace===v.marketplace))throw new Error('DUPLICATE');
 report.evidence[out].push(v);
 }catch{report.issues.push(`Hire rejected or unverifiable: ${e.txHash}`);}}
const actions=report.evidence.actions,hires=report.evidence.outgoingHires,external=report.evidence.externalHires;
report.checks.fiveActions=actions.length>=5?'PASS':'MISSING';report.checks.threeUtcDates=new Set(actions.map(x=>x.utcDate)).size>=3?'PASS':'MISSING';
report.checks.threeDifferentAgents=distinctAgents(hires)>=3?'PASS':'MISSING';report.checks.twoMarkets=new Set(hires.map(x=>x.marketplace)).size>=2?'PASS':'MISSING';
report.checks.threeExternalWallets=new Set(external.map(x=>lower(x.subscriber))).size>=3?'PASS':'MISSING';
report.checks.externalFundingIndependence='REVIEW_REQUIRED';report.checks.publicRepository=m.githubUrl?'REVIEW_REQUIRED':'MISSING';
report.checks.aiAndAutonomousExecution='REVIEW_REQUIRED';report.checks.phase2OriginalityAndListingDate='REVIEW_REQUIRED';
report.hire_evidence={outgoing:hires,external};report.functional_tx_evidence=actions;report.requestedRegistrationTx=m.registrationTx||null;report.requestedAgentId=m.agentId??null;report.reviewRequired=['Official campaign enrollment','External-wallet ownership and common/indirect funding','Originality and Phase 2 listing eligibility','Agent-origin provenance for user-signed operations','Second marketplace adapter','Actual service delivery and continuously reachable AI'];report.status='NOT_QUALIFIED_OR_NOT_FULLY_VERIFIED';console.log(json(report));p.destroy();process.exitCode=2;
