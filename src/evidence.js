import { Contract, Interface } from 'ethers';
import {network,assertTestnet,position,lower,registryAbi,fuguRegistryAbi,subscriptionAbi,vtInterface} from './chain.js';
import {validateMetadata} from './metadata.js';
import {assess} from './risk.js';
export const campaignStart=Date.parse('2026-10-01T00:00:00Z')/1000;
export const campaignEnd=Date.parse('2026-11-05T12:00:00Z')/1000;
export function inWindow(timestamp,registeredAt){return Number.isFinite(registeredAt)&&timestamp>=Math.max(campaignStart,registeredAt)&&timestamp<=campaignEnd;}
export function distinctAgents(hires){return new Set(hires.map(x=>`${x.chainId}:${x.identityRegistry.toLowerCase()}:${x.agentId}`)).size;}
export async function verifyRepayment(p,e,operator,registeredAt){
 await assertTestnet(p);
 const receipt=await p.getTransactionReceipt(e.txHash);if(!receipt||receipt.status!==1)throw new Error('MISSING_SUCCESSFUL_RECEIPT');
 const tx=await p.getTransaction(e.txHash);const block=await p.getBlock(receipt.blockNumber);
 if(!inWindow(block.timestamp,registeredAt))throw new Error('OUTSIDE_REGISTERED_WINDOW');
 if(!Object.values(network.markets).some(a=>lower(a)===lower(tx.to))||lower(tx.from)!==lower(operator))throw new Error('NOT_AGENT_VENUS_ACTION');
 const events=receipt.logs.filter(l=>lower(l.address)===lower(tx.to)).flatMap(l=>{try{return [vtInterface.parseLog(l)];}catch{return [];}});
 if(events.some(x=>x?.name==='Failure'))throw new Error('VENUS_FAILURE_EVENT');
 const event=events.find(x=>x?.name==='RepayBorrow');if(!event||event.args.repayAmount===0n)throw new Error('NO_ACTUAL_REPAYMENT');
 if(lower(event.args.borrower)!==lower(e.borrower)||lower(event.args.payer)!==lower(operator))throw new Error('REPAY_EVENT_MISMATCH');
 // Prior-block snapshots are conservative evidence, not a replay of intra-block ordering.
 const before=await position(p,e.borrower,receipt.blockNumber-1);const after=await position(p,e.borrower,receipt.blockNumber);
 if(assess(before).action!=='repay')throw new Error('PRIOR_BLOCK_NOT_AT_RISK');
 const pre=before.markets.find(x=>lower(x.market)===lower(tx.to));const post=after.markets.find(x=>lower(x.market)===lower(tx.to));
 if(!pre||!post||post.borrowedRaw>=pre.borrowedRaw)throw new Error('NO_OBSERVED_DEBT_REDUCTION');
 return {txHash:e.txHash,chainId:97,block:receipt.blockNumber,timestamp:block.timestamp,utcDate:new Date(block.timestamp*1000).toISOString().slice(0,10),borrower:event.args.borrower,amountRaw:event.args.repayAmount,market:tx.to,proof:'successful RepayBorrow + prior-block risk + debt reduction',limitations:'Intra-block changes and contract wallet relays require manual review.'};
}
export async function verifyFuguHire(p,e,registeredAt){
 await assertTestnet(p);
 const sub=new Contract(network.helloFugu.subscription,subscriptionAbi,p),reg=new Contract(network.helloFugu.registry,fuguRegistryAbi,p);
 if(lower(await reg.identityRegistry())!==lower(network.identityRegistry))throw new Error('MARKET_IDENTITY_BINDING_CHANGED');
 const receipt=await p.getTransactionReceipt(e.txHash);if(!receipt||receipt.status!==1)throw new Error('HIRE_RECEIPT_MISSING');
 const block=await p.getBlock(receipt.blockNumber);if(!inWindow(block.timestamp,registeredAt))throw new Error('HIRE_OUTSIDE_WINDOW');
 const iface=new Interface(subscriptionAbi);
 const event=receipt.logs.filter(l=>lower(l.address)===lower(network.helloFugu.subscription)).flatMap(l=>{try{return [iface.parseLog(l)];}catch{return [];}}).find(x=>x?.name==='Subscribed'&&x.args.subId===BigInt(e.subId));
 if(!event||event.args.amount<=0n)throw new Error('NO_HIRE_EVENT');
 const s=await sub.getSub(e.subId);const listing=await reg.getListing(s.listingId);
 if(lower(s.subscriber)!==lower(event.args.subscriber)||s.listingId!==event.args.listingId)throw new Error('HIRE_STATE_MISMATCH');
 const identity=new Contract(network.identityRegistry,registryAbi,p);await identity.ownerOf(listing.erc8004AgentId);
 const latest=await p.getBlock('latest');
 let completed=!s.cancelled&&s.deposited>0n&&s.claimed===s.deposited&&BigInt(latest.timestamp)>=s.endsAt;
 let completionTx=null;
 if(completed){
  if(!e.claimTx)completed=false;
  else{const claim=await p.getTransactionReceipt(e.claimTx);if(!claim||claim.status!==1)throw new Error('CLAIM_RECEIPT_MISSING');
   const cb=await p.getBlock(claim.blockNumber);if(!inWindow(cb.timestamp,registeredAt)||BigInt(cb.timestamp)<s.endsAt)throw new Error('CLAIM_NOT_FINAL_IN_WINDOW');
   const ce=claim.logs.filter(l=>lower(l.address)===lower(network.helloFugu.subscription)).flatMap(l=>{try{return[iface.parseLog(l)];}catch{return[];}}).find(x=>x?.name==='Claimed'&&x.args.subId===BigInt(e.subId));
   if(!ce||lower(ce.args.to)!==lower(listing.owner)||ce.args.amountToOwner+ce.args.fee<=0n)throw new Error('CLAIM_EVENT_MISMATCH');completionTx=e.claimTx;
  }
 }
 return {marketplace:'HelloFugu',chainId:97,identityRegistry:network.identityRegistry,agentId:listing.erc8004AgentId.toString(),subscriber:s.subscriber,listingOwner:listing.owner,agentWallet:listing.agentWallet,category:Number(listing.category),completed,completionTx,deliveryEvidence:e.deliveryEvidence||null,txHash:e.txHash,subId:String(e.subId),timestamp:block.timestamp};
}
export async function verifyIdentity(p,id,wallet,base){
 await assertTestnet(p);const r=new Contract(network.identityRegistry,registryAbi,p);
 if(lower(await r.ownerOf(id))!==lower(wallet))throw new Error('IDENTITY_OWNER_MISMATCH');
 const uri=await r.tokenURI(id);const u=new URL(uri);
 if(u.protocol!=='https:'||u.origin!==new URL(base).origin)throw new Error('REGISTERED_DOMAIN_MISMATCH');
 const response=await fetch(uri,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!response.ok)throw new Error('CARD_UNAVAILABLE');const card=await response.json();
 validateMetadata(card,base,id);
 if(!card.name||!card.description||card.x_category!=='health factor'||!card.active)throw new Error('CARD_INVALID');
 const mcp=card.services?.find(x=>x.name==='MCP');if(!mcp||new URL(mcp.endpoint).origin!==u.origin)throw new Error('MCP_MISSING');
 const invoke=await fetch(mcp.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream'},signal:AbortSignal.timeout(20000),body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'venus_position',arguments:{account:wallet}}})});
 const reply=await invoke.json();if(!invoke.ok||!reply.result?.content?.length||reply.result.isError)throw new Error('AGENT_INVOCATION_FAILED');
 const parsed=JSON.parse(reply.result.content[0].text);if(parsed.position?.chainId!==97)throw new Error('AGENT_RESPONSE_CHAIN_MISMATCH');
 const market=new Contract(network.helloFugu.registry,fuguRegistryAbi,p),listingId=await market.listingByAgentId(id);if(listingId===0n)throw new Error('NOT_LISTED');const l=await market.getListing(listingId);
 if(!l.active||Number(l.category)!==3||lower(l.owner)!==lower(wallet))throw new Error('LISTING_INVALID');
 return {id:String(id),chainId:97,owner:wallet,card:uri,listingId:listingId.toString(),marketplaceUrl:`https://app.hellofugu.xyz/agent/97:${id}`};
}

export async function verifyRegistration(p,txHash,id,wallet,base,registeredAt){
 await assertTestnet(p);const receipt=await p.getTransactionReceipt(txHash);
 if(!receipt||receipt.status!==1)throw new Error('REGISTRATION_RECEIPT_MISSING');
 const block=await p.getBlock(receipt.blockNumber),tx=await p.getTransaction(txHash);
 if(!inWindow(block.timestamp,registeredAt)||lower(tx.from)!==lower(wallet)||lower(tx.to)!==lower(network.identityRegistry))throw new Error('REGISTRATION_ORIGIN_OR_TIME_INVALID');
 const iface=new Interface(registryAbi),event=receipt.logs.filter(l=>lower(l.address)===lower(network.identityRegistry)).flatMap(l=>{try{return[iface.parseLog(l)];}catch{return[];}}).find(e=>e?.name==='Registered'&&String(e.args.agentId)===String(id));
 if(!event||lower(event.args.owner)!==lower(wallet))throw new Error('REGISTRATION_EVENT_MISMATCH');
 const r=new Contract(network.identityRegistry,registryAbi,p);
 if(lower(await r.ownerOf(id))!==lower(wallet))throw new Error('REGISTRATION_OWNER_CHANGED');
 const uri=await r.tokenURI(id);if(new URL(uri).origin!==new URL(base).origin)throw new Error('REGISTRATION_DOMAIN_MISMATCH');
 const resp=await fetch(uri,{redirect:'error',signal:AbortSignal.timeout(12000)});if(!resp.ok)throw new Error('METADATA_UNAVAILABLE');validateMetadata(await resp.json(),base,id);
 return {registration_tx:txHash,agent_id:String(id),chainId:97,owner:wallet,agentURI:uri,registeredTimestamp:block.timestamp,utcDate:new Date(block.timestamp*1000).toISOString().slice(0,10)};
}
