import {writeFileSync} from 'node:fs';
import {Contract,Interface,ZeroAddress,formatEther} from 'ethers';
import {provider,network,json,registryAbi,fuguRegistryAbi,subscriptionAbi,atBlock} from '../src/chain.js';
import {prepareRegister} from '../src/prepare.js';
import {marketState,prepareHire} from '../src/marketplace.js';
const wallet='0x9F81A9588c310b90A0636E8D2fb31523a57fbaDC',p=provider();
try{
 const block=await atBlock(p),contracts={};
 for(const [name,address] of Object.entries({identity:network.identityRegistry,market:network.helloFugu.registry,subscription:network.helloFugu.subscription}))contracts[name]={address,hasCode:(await p.getCode(address,block.number))!=='0x'};
 const reg=new Contract(network.helloFugu.registry,fuguRegistryAbi,p),sub=new Contract(network.helloFugu.subscription,subscriptionAbi,p);
 const count=await reg.listingCount(),subCount=await sub.subCount(),balance=await p.getBalance(wallet),fee=await p.getFeeData();
 const registration=await prepareRegister(p,wallet,'https://bnb-guardian.pages.dev');
 writeFileSync('docs/registration-intent.json',json(registration)+'\n');
 const sample=await marketState(p,1);const oracle=await sub.oracle(),amount=await new Contract(oracle,['function quote(address,uint256) view returns(uint256)'],p).quote(ZeroAddress,sample.listing.priceUsd8PerPeriod);
 let hire;try{hire=await prepareHire(p,{wallet,listingId:1,periods:1,maxPaymentWei:amount.toString()});writeFileSync('docs/sample-hire-intent.json',json(hire)+'\n');}catch{hire={simulation:'UNAVAILABLE'};}
 const report={version:'V0.0.3',checkedAt:new Date().toISOString(),chainId:97,block:block.number,contracts,registryBinding:await reg.identityRegistry(),subscriptionRegistry:await sub.registry(),listingCount:count,subscriptionCount:subCount,walletBalanceTBNB:formatEther(balance),gasPriceWei:fee.gasPrice,registration:{simulation:registration.simulation,estimatedGas:registration.estimatedGas,gasBudgetTBNB:formatEther(registration.gasBudgetWei),predictedIdIsNotRegistration:true},sampleHire:{listingId:'1',agentId:sample.listing.erc8004AgentId,category:Number(sample.listing.category),feeBps:await sub.protocolFeeBps(),paymentTBNB:formatEther(amount),simulation:hire.simulation,estimatedGas:hire.estimatedGas||null},transactionsSent:0,limitations:['Listing 1 is a historical team-owned sample; do not count its other team hires as external users. No hire was submitted.','Actual listing simulation requires the newly registered identity.','No claim of campaign registration or eligibility.']};
 writeFileSync('docs/平台与注册只读核验.json',json(report)+'\n');console.log(json(report));
}finally{p.destroy();}
