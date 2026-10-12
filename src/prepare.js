import { Contract, Interface, getAddress, keccak256, toUtf8Bytes, toQuantity } from 'ethers';
import { assertTestnet,atBlock,position,network,comptrollerAbi,vTokenAbi,registryAbi,fuguRegistryAbi,erc20Abi,lower,json } from './chain.js';
import { validateMetadata,listingMetadataURI } from './metadata.js';
import { chooseRepayment } from './risk.js';
export function envelope(kind, from, to, data, value, block) {
 const plan={version:'V0.0.3',kind,chainId:97,from:getAddress(from),to:getAddress(to),data,value:toQuantity(value),observedBlock:block.number,observedBlockHash:block.hash,expiresAt:Math.floor(Date.now()/1000)+120,requiresUserConfirmation:true,broadcast:false};
 return {...plan,planHash:keccak256(toUtf8Bytes(json(plan)))};
}
export async function simulateIntent(p,plan){
 await assertTestnet(p);if(await p.getCode(plan.to)==='0x')throw new Error('CONTRACT_NOT_DEPLOYED');
 const request={from:plan.from,to:plan.to,data:plan.data,value:plan.value};
 const result=await p.send('eth_call',[request,toQuantity(plan.observedBlock)]);
 const gas=await p.estimateGas(request),fee=await p.getFeeData(),gasPrice=fee.gasPrice;
 if(gasPrice===null)throw new Error('GAS_PRICE_UNAVAILABLE');
 const gasLimit=(gas*120n+99n)/100n,gasBudgetWei=gasLimit*gasPrice;
 return {...plan,simulation:'passed',simulationResult:result,estimatedGas:gas.toString(),gasLimit:gasLimit.toString(),gasPriceWei:gasPrice.toString(),estimatedGasCostWei:(gas*gasPrice).toString(),gasBudgetWei:gasBudgetWei.toString(),walletBalanceWei:(await p.getBalance(plan.from)).toString(),warning:'Simulation is read-only. Refresh after approval before wallet signature; gas and state may change.'};
}
export async function prepareRegister(p,wallet,baseUrl,{fetcher=fetch}={}) {
 await assertTestnet(p);const u=new URL(baseUrl);
 if(u.protocol!=='https:'||u.username||u.password||u.hostname==='localhost'||/^127\./.test(u.hostname))throw new Error('PUBLIC_HTTPS_REQUIRED');
 const uri=new URL('/agent-registration.json',u).href;
 const r=await fetcher(uri,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!r.ok)throw new Error('METADATA_UNAVAILABLE');
 const card=await r.json();validateMetadata(card,u.origin);if(card.registrations?.length)throw new Error('EXISTING_ID_REFERENCE_DO_NOT_DUPLICATE');
 const registry=new Contract(network.identityRegistry,registryAbi,p);
 if(await registry.balanceOf(wallet)!==0n)throw new Error('EXISTING_IDENTITIES_REVIEW_BEFORE_REGISTER');
 const plan=envelope('erc8004-register',wallet,network.identityRegistry,new Interface(registryAbi).encodeFunctionData('register(string)',[uri]),0n,await atBlock(p));
 const sim=await simulateIntent(p,plan);
 return {...sim,agentURI:uri,metadataVersion:card.x_version,predictedAgentId:new Interface(registryAbi).decodeFunctionResult('register(string)',sim.simulationResult)[0].toString(),predictedIdIsNotRegistration:true,agentId:null,registration_tx:null};
}
export async function prepareListing(p,wallet,agentWallet,id,baseUrl,priceUsd8,periodSeconds) {
 await assertTestnet(p);
 const identity=new Contract(network.identityRegistry,registryAbi,p);
 if(lower(await identity.ownerOf(id))!==lower(wallet))throw new Error('NOT_REGISTERED_OWNER');
 const market=new Contract(network.helloFugu.registry,fuguRegistryAbi,p);
 if(lower(await market.identityRegistry())!==lower(network.identityRegistry))throw new Error('MARKET_REGISTRY_MISMATCH');
 if(await market.listingByAgentId(id)!==0n)throw new Error('ALREADY_LISTED');
 const u=new URL(baseUrl);if(u.protocol!=='https:')throw new Error('PUBLIC_HTTPS_REQUIRED');
 if(BigInt(priceUsd8)<=0n||!Number.isSafeInteger(periodSeconds)||periodSeconds<60)throw new Error('INVALID_LISTING_TERMS');
 return simulateIntent(p,envelope('hello-fugu-list',wallet,network.helloFugu.registry,new Interface(fuguRegistryAbi).encodeFunctionData('list',[id,getAddress(agentWallet),3,priceUsd8,periodSeconds,listingMetadataURI(u.origin,id,getAddress(agentWallet))]),0n,await atBlock(p)));
}
export async function prepareRepay(p,{borrower,payer,market,capRaw,thresholds}) {
 borrower=getAddress(borrower);payer=getAddress(payer);market=getAddress(market);
 const block=await atBlock(p);const s=await position(p,borrower,block.number);
 const chosen=chooseRepayment(s,market,capRaw,thresholds);
 const v=new Contract(market,vTokenAbi,p);
 if(lower(await v.comptroller({blockTag:block.number}))!==lower(network.comptroller))throw new Error('COMPTROLLER_MISMATCH');
 const native=lower(market)===lower(network.markets.vBNB);
 let data,value=0n,token=null;
 if(native){
   value=chosen.amountRaw;
   if(await p.getBalance(payer,block.number)<=value)throw new Error('INSUFFICIENT_NATIVE_BALANCE');
   data=new Interface(vTokenAbi).encodeFunctionData('repayBorrowBehalf(address)',[borrower]);
 }else{
   token=getAddress(await v.underlying({blockTag:block.number}));const t=new Contract(token,erc20Abi,p);
   const [balance,allowance]=await Promise.all([t.balanceOf(payer,{blockTag:block.number}),t.allowance(payer,market,{blockTag:block.number})]);
   if(balance<chosen.amountRaw)throw new Error('INSUFFICIENT_TOKEN_BALANCE');
   if(allowance<chosen.amountRaw){
     // No unlimited approval; this is a separate user confirmation before repayment.
     return {...envelope('approve-exact-amount',payer,token,new Interface(erc20Abi).encodeFunctionData('approve',[market,chosen.amountRaw]),0n,block),spender:market,amountRaw:chosen.amountRaw,next:'Re-run prepareRepay after approval is confirmed. This approval is not a qualifying risk-management action.'};
   }
   data=new Interface(vTokenAbi).encodeFunctionData('repayBorrowBehalf(address,uint256)',[borrower,chosen.amountRaw]);
 }
 const request={from:payer,to:market,data,value:toQuantity(value)};
 const result=await p.send('eth_call',[request,toQuantity(block.number)]);
 if(!native && new Interface(vTokenAbi).decodeFunctionResult('repayBorrowBehalf(address,uint256)',result)[0]!==0n)throw new Error('REPAY_SIMULATION_ERROR');
 const gas=await p.estimateGas(request); const fee=await p.getFeeData();
 return {...envelope('venus-repay',payer,market,data,value,block),borrower,amountRaw:chosen.amountRaw,token,partial:chosen.partial,risk:chosen.risk,position:s,gas:toQuantity(gas),estimatedGasCostWei:gas*(fee.gasPrice||0n),simulation:'passed',warning:'Recheck risk, amount and chain in the wallet before signing. A successful transaction must also contain a Venus RepayBorrow event.'};
}
