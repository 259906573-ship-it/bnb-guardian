import {readFileSync} from 'node:fs';
import {provider,json} from '../src/chain.js';
import {prepareRegister,prepareListing,prepareRepay} from '../src/prepare.js';
import {prepareHire,prepareClaim} from '../src/marketplace.js';
const p=provider();
try{
 const [kind,path]=process.argv.slice(2);if(!path)throw new Error('INPUT_REQUIRED');const x=JSON.parse(readFileSync(path));let plan;
 if(kind==='register')plan=await prepareRegister(p,x.wallet,x.baseUrl);
 else if(kind==='list')plan=await prepareListing(p,x.wallet,x.agentWallet,x.agentId,x.baseUrl,x.priceUsd8PerPeriod,x.periodSeconds);
 else if(kind==='hire')plan=await prepareHire(p,x);
 else if(kind==='claim')plan=await prepareClaim(p,x);
 else if(kind==='repay')plan=await prepareRepay(p,x);
 else throw new Error('UNKNOWN_KIND');
 console.log(json(plan));
}catch{console.error('Cannot prepare a safe unsigned intent. Verify the inputs, RPC, risk trigger, balances and permissions. No transaction was sent.');process.exitCode=1;}finally{p.destroy();}
