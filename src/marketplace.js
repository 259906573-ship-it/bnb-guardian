import {Contract,Interface,getAddress,ZeroAddress,verifyMessage,keccak256,toUtf8Bytes} from 'ethers';
import {network,assertTestnet,atBlock,registryAbi,fuguRegistryAbi,subscriptionAbi,lower,json} from './chain.js';
import {envelope,simulateIntent} from './prepare.js';
export const marketUrl=id=>`https://app.hellofugu.xyz/agent/97:${id}`;
export async function marketState(p,listingId){
 const b=await atBlock(p),options={blockTag:b.number};
 const reg=new Contract(network.helloFugu.registry,fuguRegistryAbi,p),sub=new Contract(network.helloFugu.subscription,subscriptionAbi,p);
 if(lower(await reg.identityRegistry(options))!==lower(network.identityRegistry)||lower(await sub.registry(options))!==lower(network.helloFugu.registry))throw new Error('MARKET_CONTRACT_MISMATCH');
 const listing=await reg.getListing(listingId,options);const owner=await new Contract(network.identityRegistry,registryAbi,p).ownerOf(listing.erc8004AgentId,options);
 if(lower(owner)!==lower(listing.owner))throw new Error('LISTING_OWNER_DRIFT');
 return {block:b,listing,sub,options};
}
export async function prepareHire(p,{wallet,listingId,periods=1,maxPaymentWei}){
 await assertTestnet(p);wallet=getAddress(wallet);
 if(!Number.isSafeInteger(periods)||periods<1||periods>30)throw new Error('INVALID_PERIODS');
 const {block,listing,sub,options}=await marketState(p,listingId);
 if(!listing.active)throw new Error('LISTING_INACTIVE');
 if(lower(wallet)===lower(listing.owner)||lower(wallet)===lower(listing.agentWallet))throw new Error('SELF_HIRE_DENIED');
 const oracle=await sub.oracle(options),fee=await sub.protocolFeeBps(options);
 const amount=await new Contract(oracle,['function quote(address,uint256) view returns(uint256)'],p).quote(ZeroAddress,listing.priceUsd8PerPeriod*BigInt(periods),options);
 const cap=BigInt(maxPaymentWei);if(amount<=0n||amount>cap)throw new Error('PAYMENT_CAP_EXCEEDED');
 if(await p.getBalance(wallet,block.number)<amount)throw new Error('INSUFFICIENT_PAYMENT_BALANCE');
 const deadline=block.timestamp+120;
 const plan=envelope('hello-fugu-hire',wallet,network.helloFugu.subscription,new Interface(subscriptionAbi).encodeFunctionData('subscribe',[listingId,periods,ZeroAddress,cap,deadline]),amount,block);
 return {...await simulateIntent(p,plan),listingId:String(listingId),agentId:listing.erc8004AgentId.toString(),marketplaceUrl:marketUrl(listing.erc8004AgentId),paymentWei:amount.toString(),maxPaymentWei:cap.toString(),protocolFeeBps:Number(fee),periods,deadline,qualifyingStatus:'PENDING_USER_SIGNATURE_AND_SUBSCRIBED_EVENT',hire_tx:null};
}
export async function prepareClaim(p,{wallet,subId}){
 const b=await atBlock(p),sub=new Contract(network.helloFugu.subscription,subscriptionAbi,p),s=await sub.getSub(subId,{blockTag:b.number});
 const {listing}=await marketState(p,s.listingId);
 if(lower(wallet)!==lower(listing.owner))throw new Error('NOT_LISTING_OWNER');
 if(s.cancelled||BigInt(b.timestamp)<s.endsAt)throw new Error('SUBSCRIPTION_NOT_COMPLETED');
 if(await sub.claimable(subId,{blockTag:b.number})===0n)throw new Error('NOTHING_TO_CLAIM');
 return simulateIntent(p,envelope('hello-fugu-claim',wallet,network.helloFugu.subscription,new Interface(subscriptionAbi).encodeFunctionData('claim',[subId]),0n,b));
}
export function challenge({base,subId,account,expiresAt},now=Date.now()){
 account=getAddress(account);if(!/^\d+$/.test(String(subId)))throw new Error('INVALID_SUB_ID');
 if(!Number.isSafeInteger(expiresAt)||expiresAt<=Math.floor(now/1000)||expiresAt>Math.floor(now/1000)+300)throw new Error('INVALID_EXPIRY');
 return `BNB Guardian V0.0.3 read-only service invocation\nDomain: ${new URL(base).origin}\nChain: 97\nSubscription: ${subId}\nAccount: ${account}\nExpires: ${expiresAt}\nPurpose: Venus risk report only; no transfer approval.`;
}
export function verifyInvocation(input,base,now=Date.now()){
 const message=challenge({...input,base},now);
 if(lower(verifyMessage(message,input.signature))!==lower(input.account))throw new Error('SUBSCRIBER_SIGNATURE_MISMATCH');
 return {message,deliveryId:keccak256(toUtf8Bytes(message))};
}
export async function authorizeInvocation(p,input,env,base,now=Date.now()){
 if(!env.AGENT_ID)throw new Error('AGENT_NOT_REGISTERED');
 const auth=verifyInvocation(input,base,now),b=await atBlock(p);
 const s=await new Contract(network.helloFugu.subscription,subscriptionAbi,p).getSub(input.subId,{blockTag:b.number});
 const {listing}=await marketState(p,s.listingId);
 if(String(listing.erc8004AgentId)!==String(env.AGENT_ID)||lower(listing.owner)!==lower(env.CAMPAIGN_WALLET)||Number(listing.category)!==3||!listing.active)throw new Error('NOT_GUARDIAN_LISTING');
 if(lower(s.subscriber)!==lower(input.account)||s.cancelled||s.deposited<=0n||BigInt(b.timestamp)<s.startedAt||BigInt(b.timestamp)>=s.endsAt)throw new Error('INACTIVE_OR_WRONG_SUBSCRIPTION');
 if(lower(s.subscriber)===lower(listing.owner)||lower(s.subscriber)===lower(listing.agentWallet))throw new Error('SELF_HIRE_DENIED');
 return {...auth,subId:String(input.subId),listingId:String(s.listingId),subscriber:getAddress(s.subscriber),agentId:String(listing.erc8004AgentId),observedBlock:b.number};
}
export async function recordDelivery(db,auth,report,now=Date.now()){
 if(!db)throw new Error('DELIVERY_STORAGE_REQUIRED');
 const resultHash=keccak256(toUtf8Bytes(json(report)));
 await db.prepare('INSERT INTO service_deliveries(delivery_id,sub_id,subscriber,agent_id,delivered_at,result_hash,payload) VALUES(?,?,?,?,?,?,?) ON CONFLICT(delivery_id) DO NOTHING').bind(auth.deliveryId,auth.subId,auth.subscriber,auth.agentId,now,resultHash,json({auth,report})).run();
 return {deliveryId:auth.deliveryId,resultHash,recorded:true,completion:'DELIVERED_REPORT_ONLY; onchain claim and organizer review still required',transactionsSent:0};
}
