import { WAD, lower, network } from './chain.js';
export function assess(s, triggerWad=125n*WAD/100n, targetWad=150n*WAD/100n) {
  if (triggerWad <= WAD || targetWad <= triggerWad || targetWad > 5n*WAD) throw new Error('INVALID_THRESHOLDS');
  if (s.debtUsdWad === 0n) return { status:'no-debt', action:'none', requiredRepayUsdWad:0n };
  if (s.healthFactorWad >= triggerWad) return { status:'healthy', action:'none', requiredRepayUsdWad:0n };
  const remainingDebt = s.weightedCollateralUsdWad * WAD / targetWad;
  const required = s.debtUsdWad > remainingDebt ? s.debtUsdWad-remainingDebt : 0n;
  return { status:s.healthFactorWad<WAD?'liquidatable':'at-risk', action:'repay', triggerWad, targetWad, requiredRepayUsdWad:required,
    explanation:'Collateral-factor coverage is below the configured trigger. Repay debt without borrowing or withdrawing collateral.' };
}
export function chooseRepayment(s, market, capRaw, thresholds) {
  capRaw = BigInt(capRaw);
  if (capRaw <= 0n || capRaw > (1n<<128n)-1n) throw new Error('INVALID_CAP');
  if (!Object.values(network.markets).some(x=>lower(x)===lower(market))) throw new Error('MARKET_DENIED');
  const risk = assess(s, thresholds?.triggerWad, thresholds?.targetWad);
  if (risk.action !== 'repay') throw new Error('NO_RISK_ACTION_NEEDED');
  const row = s.markets.find(x=>lower(x.market)===lower(market));
  if (!row || row.borrowedRaw===0n || row.price===0n) throw new Error('NO_DEBT_IN_MARKET');
  const desired = (risk.requiredRepayUsdWad*WAD+row.price-1n)/row.price;
  const amountRaw = [desired,capRaw,row.borrowedRaw].reduce((a,b)=>a<b?a:b);
  if (amountRaw===0n) throw new Error('ZERO_REPAYMENT');
  return { risk, amountRaw, partial:amountRaw<desired, market:row.market };
}
