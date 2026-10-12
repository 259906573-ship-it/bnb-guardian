import test from 'node:test';import assert from 'node:assert/strict';
import {assess,chooseRepayment} from '../src/risk.js';
import {WAD,network,assertTestnet} from '../src/chain.js';
import {inWindow,distinctAgents} from '../src/evidence.js';
const market=network.markets.vUSDT;
function snapshot(collateral,debt){return {weightedCollateralUsdWad:BigInt(collateral)*WAD,debtUsdWad:BigInt(debt)*WAD,healthFactorWad:debt?BigInt(collateral)*WAD/BigInt(debt):null,markets:[{market,price:WAD,borrowedRaw:BigInt(debt)*WAD}]};}
test('No debt never generates a repayment',()=>assert.equal(assess(snapshot(100,0)).action,'none'));
test('Healthy and exact trigger do not spend',()=>{assert.equal(assess(snapshot(150,100)).action,'none');assert.equal(assess(snapshot(125,100)).action,'none');});
test('At-risk position computes repayment to target using integer math',()=>{const r=assess(snapshot(120,100));assert.equal(r.requiredRepayUsdWad,20n*WAD);assert.equal(r.status,'at-risk');});
test('Partial repayment respects exact cap and outstanding debt',()=>{const r=chooseRepayment(snapshot(120,100),market,5n*WAD);assert.equal(r.amountRaw,5n*WAD);assert.equal(r.partial,true);assert.equal(chooseRepayment(snapshot(0,100),market,200n*WAD).amountRaw,100n*WAD);});
test('Reject unsafe thresholds and unauthorized market',()=>{assert.throws(()=>assess(snapshot(120,100),WAD,2n*WAD));assert.throws(()=>chooseRepayment(snapshot(120,100),'0x0000000000000000000000000000000000000001',WAD));});
test('Reject risk-free quota transactions, zero and negative amounts',()=>{assert.throws(()=>chooseRepayment(snapshot(150,100),market,WAD));assert.throws(()=>chooseRepayment(snapshot(120,100),market,0n));assert.throws(()=>chooseRepayment(snapshot(120,100),market,-1n));});
test('Mainnet and wrong-chain RPC are refused',async()=>{await assert.rejects(assertTestnet({send:async()=> '0x38'}),/CHAIN_DENIED/);await assertTestnet({send:async()=> '0x61'});});
test('Registration and exact campaign cutoff use UTC onchain time',()=>{const registered=Date.parse('2026-10-12T00:00:00Z')/1000;assert.equal(inWindow(registered-1,registered),false);assert.equal(inWindow(registered,registered),true);assert.equal(inWindow(Date.parse('2026-11-05T12:00:01Z')/1000,registered),false);assert.equal(inWindow(registered,NaN),false);});
test('Agent repeated across two markets counts only once',()=>{const identityRegistry=network.identityRegistry;assert.equal(distinctAgents([{agentId:'1',identityRegistry,chainId:97,marketplace:'A'},{agentId:'1',identityRegistry,chainId:97,marketplace:'B'}]),1);});
