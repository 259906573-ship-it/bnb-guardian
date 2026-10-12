import config from '../config/network.json' with { type: 'json' };
import { Contract, BrowserProvider, getAddress, Interface } from 'ethers';
export const network = config;
export const WAD = 10n ** 18n;
export const comptrollerAbi = [
  'function getAssetsIn(address) view returns(address[])',
  'function getAccountLiquidity(address) view returns(uint256,uint256,uint256)',
  'function markets(address) view returns(bool,uint256,bool)',
  'function oracle() view returns(address)',
  'function mintedVAIs(address) view returns(uint256)'
];
export const vTokenAbi = [
  'function getAccountSnapshot(address) view returns(uint256,uint256,uint256,uint256)',
  'function comptroller() view returns(address)',
  'function underlying() view returns(address)',
  'function repayBorrowBehalf(address,uint256) returns(uint256)',
  'function repayBorrowBehalf(address) payable',
  'event RepayBorrow(address payer,address borrower,uint256 repayAmount,uint256 accountBorrows,uint256 totalBorrows)',
  'event Failure(uint256 errorCode,uint256 info,uint256 detail)'
];
export const registryAbi = [
  'function register(string) returns(uint256)',
  'function balanceOf(address) view returns(uint256)',
  'function getAgentWallet(uint256) view returns(address)',
  'function ownerOf(uint256) view returns(address)',
  'function tokenURI(uint256) view returns(string)',
  'event Registered(uint256 indexed agentId,string agentURI,address indexed owner)'
];
export const fuguRegistryAbi = [
  'function list(uint256,address,uint8,uint128,uint32,string) returns(uint256)',
  'function getListing(uint256) view returns(tuple(uint256 erc8004AgentId,address owner,address agentWallet,uint8 category,uint128 priceUsd8PerPeriod,uint32 periodSeconds,bool active,bool curated,string metadataURI))',
  'function identityRegistry() view returns(address)',
  'function listingByAgentId(uint256) view returns(uint256)',
  'function listingCount() view returns(uint256)'
];
export const subscriptionAbi = [
  'function getSub(uint256) view returns(tuple(uint256 listingId,address subscriber,address payToken,uint128 deposited,uint128 claimed,uint64 startedAt,uint64 endsAt,bool cancelled,uint16 feeBps))',
  'function claim(uint256)',
  'function subscribe(uint256,uint32,address,uint256,uint256) payable returns(uint256)',
  'function oracle() view returns(address)',
  'function registry() view returns(address)',
  'function protocolFeeBps() view returns(uint16)',
  'function claimable(uint256) view returns(uint256)',
  'function subCount() view returns(uint256)',
  'event Subscribed(uint256 indexed subId,uint256 indexed listingId,address indexed subscriber,address payToken,uint256 amount)',
  'event Claimed(uint256 indexed subId,address indexed to,uint256 amountToOwner,uint256 fee)',
  'event Cancelled(uint256 indexed subId,uint256 refunded)'
];
export const erc20Abi = ['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)'];
export const vtInterface = new Interface(vTokenAbi);
export const lower = a => getAddress(a).toLowerCase();
export const json = v => JSON.stringify(v, (_, x) => typeof x === 'bigint' ? x.toString() : x, 2);
const READ_METHODS = new Set(['eth_chainId','eth_blockNumber','eth_call','eth_getBlockByNumber','eth_getBlockByHash','eth_getBalance','eth_getCode','eth_getTransactionReceipt','eth_getTransactionByHash','eth_estimateGas','eth_gasPrice','eth_maxPriorityFeePerGas','eth_getLogs']);
export function rpcTransport(url, fetcher=fetch, maxCalls=45) {
  const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw new Error('RPC_HTTPS_REQUIRED');
  let count=0;
  return { async request({method,params=[]}) {
    if(!READ_METHODS.has(method))throw new Error('RPC_METHOD_DENIED');
    if(++count>maxCalls)throw new Error('RPC_BUDGET_EXCEEDED');
    const r=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),body:JSON.stringify({jsonrpc:'2.0',id:count,method,params})});
    if(!r.ok)throw new Error('RPC_HTTP_FAILED');const data=await r.json();
    if(data.error||!Object.hasOwn(data,'result'))throw new Error('RPC_RESPONSE_FAILED');return data.result;
  }};
}
export function provider(url = globalThis.process?.env?.RPC_URL || network.rpcUrl, options={}) {
  return new BrowserProvider(rpcTransport(url,options.fetcher,options.maxCalls??Infinity),undefined,{cacheTimeout:-1});
}
export async function assertTestnet(p) {
  const id = BigInt(await p.send('eth_chainId', []));
  if (id !== 97n) throw new Error('CHAIN_DENIED: only BSC Testnet 97 is allowed');
}
export async function atBlock(p) {
  await assertTestnet(p);
  const b = await p.getBlock('latest');
  if (!b || Math.floor(Date.now()/1000) - b.timestamp > 120) throw new Error('STALE_BLOCK');
  return b;
}
export async function position(p, account, blockNumber) {
  account = getAddress(account);
  await assertTestnet(p);
  const b = blockNumber === undefined ? await atBlock(p) : await p.getBlock(blockNumber);
  if (!b) throw new Error('BLOCK_UNAVAILABLE');
  const overrides = { blockTag: b.number };
  const c = new Contract(network.comptroller, comptrollerAbi, p);
  const [assets, liquidity, oracle, vai] = await Promise.all([
    c.getAssetsIn(account, overrides), c.getAccountLiquidity(account, overrides),
    c.oracle(overrides), c.mintedVAIs(account, overrides)
  ]);
  if (liquidity[0] !== 0n) throw new Error('COMPTROLLER_ERROR');
  // VAI has a separate repayment path. Refuse incomplete risk accounting.
  if (vai !== 0n) throw new Error('UNSUPPORTED_VAI_DEBT');
  const o = new Contract(oracle, ['function getUnderlyingPrice(address) view returns(uint256)'], p);
  const rows = await Promise.all(assets.map(async market => {
    const v = new Contract(market, vTokenAbi, p);
    const [s, cfg, price] = await Promise.all([v.getAccountSnapshot(account, overrides), c.markets(market, overrides), o.getUnderlyingPrice(market, overrides)]);
    if (s[0] !== 0n || !cfg[0] || price === 0n) throw new Error('INVALID_MARKET_SNAPSHOT');
    const suppliedRaw = s[1] * s[3] / WAD;
    const supplyUsdWad = suppliedRaw * price / WAD;
    return { market:getAddress(market), suppliedRaw, borrowedRaw:s[2], price, collateralFactor:cfg[1], weightedCollateralUsdWad:supplyUsdWad*cfg[1]/WAD, debtUsdWad:s[2]*price/WAD };
  }));
  const weightedCollateralUsdWad = rows.reduce((a,x)=>a+x.weightedCollateralUsdWad,0n);
  const debtUsdWad = rows.reduce((a,x)=>a+x.debtUsdWad,0n);
  const difference = weightedCollateralUsdWad-debtUsdWad-(liquidity[1]-liquidity[2]);
  const tolerance = 10n**12n + weightedCollateralUsdWad/10n**12n;
  if (difference > tolerance || difference < -tolerance) throw new Error('ACCOUNTING_MISMATCH');
  return { account, chainId:97, protocol:'venus-core-testnet', blockNumber:b.number, blockHash:b.hash, timestamp:b.timestamp,
    weightedCollateralUsdWad, debtUsdWad, healthFactorWad:debtUsdWad===0n?null:weightedCollateralUsdWad*WAD/debtUsdWad,
    liquidityUsdWad:liquidity[1], shortfallUsdWad:liquidity[2], oracle:getAddress(oracle), markets:rows,
    limitations:['Stored balances, matching protocol liquidity accounting; interest and prices can change before execution.','Health factor is collateral-factor coverage for Venus Core, not an Aave liquidation-threshold metric.'] };
}
