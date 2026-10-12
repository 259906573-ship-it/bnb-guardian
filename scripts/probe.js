import { Contract } from 'ethers';
import { provider,network,assertTestnet,position,json,fuguRegistryAbi } from '../src/chain.js';
const p=provider();
try {
 await assertTestnet(p);
 const contracts={};
 for (const [name,address] of Object.entries({identity:network.identityRegistry,comptroller:network.comptroller,...network.markets,fuguRegistry:network.helloFugu.registry,fuguSubscription:network.helloFugu.subscription})) {
   contracts[name]={address,hasCode:(await p.getCode(address))!=='0x'};
 }
 const f=new Contract(network.helloFugu.registry,fuguRegistryAbi,p);
 const identity=await f.identityRegistry();
 console.log(json({chainId:97,contracts,helloFuguIdentity:identity,helloFuguListings:await f.listingCount(),position:await position(p,process.env.CAMPAIGN_WALLET||'0x9F81A9588c310b90A0636E8D2fb31523a57fbaDC')}));
} catch { console.error('Read-only probe failed. Check RPC connectivity and supported protocol state. No transaction was sent.'); process.exitCode=1; }
finally {p.destroy();}
