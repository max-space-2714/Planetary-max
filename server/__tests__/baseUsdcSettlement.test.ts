import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { privateKeyToAccount } from 'viem/accounts';
import { handleBaseUsdcQuoteRoute as quote, handleBaseUsdcVerifyRoute as verify, parseUsdcToBaseUnits, BASE_NATIVE_USDC } from '../baseUsdcSettlement';
import { baseUsdcSettlementMessage } from '../../src/shared/baseUsdcSettlementMessage';
const wallet = privateKeyToAccount(`0x${'1'.repeat(64)}`);
const recipient = `0x${'2'.repeat(40)}`;
const hash = `0x${'a'.repeat(64)}`;
const topic = (address: string) => `0x${address.slice(2).toLowerCase().padStart(64,'0')}`;
let db: DatabaseSync;
let receipt: any;
let chain: string;
let signature: string;
let requests: string[];
const input = () => ({ optedIn:true, chainId:8453, domain:'MAX-SPORTS', mode:'wager', amountUsdc:'1.000000', txHash:hash, payerAddress:wallet.address, signature });
const req = (body: unknown, origin = 'https://max.test') => new Request('https://max.test/api/settlements/base-usdc/verify', { method:'POST', headers:{Origin:origin,'Content-Type':'application/json'}, body:JSON.stringify(body) });
function statement(sql:string) {
  let values: any[] = [];
  return { bind(...args:any[]) { values=args; return this; }, async run(){ return {meta:db.prepare(sql).run(...values)}; } };
}
const env = () => ({ SETTLEMENT_RECIPIENT_ADDRESS:recipient, RPC_URL:'https://rpc.test', DB:{ prepare:statement, async batch(stmts:any[]){db.exec('BEGIN');try{const result=[];for(const s of stmts)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}} } }) as any;
beforeEach(async()=>{
  db=new DatabaseSync(':memory:');
  const commerce=readFileSync('migrations/0020_direct_digital_commerce.sql','utf8');
  db.exec(commerce.match(/CREATE TABLE settlement_claims \([\s\S]*?\);/)![0]);
  for(const file of ['0022_max_finance_sovereign.sql','0024_sports_output_orders.sql','0025_output_order_settlement.sql','0026_output_receipt_claim_guards.sql']) db.exec(readFileSync(`migrations/${file}`,'utf8'));
  signature=await wallet.signMessage({message:baseUsdcSettlementMessage('https://max.test',input())});
  chain='0x2105'; requests=[];
  receipt={status:'0x1',blockNumber:'0x10',logs:[{address:BASE_NATIVE_USDC,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',topic(wallet.address),topic(recipient)],data:'0x0f4240'}]};
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{const {method}=JSON.parse(init.body);requests.push(method);return Response.json({result:method==='eth_chainId'?chain:method==='eth_blockNumber'?'0x20':receipt});}));
});
afterEach(()=>{db.close();vi.unstubAllGlobals();});
it('parses six decimal amounts without rounding',()=>{expect(parseUsdcToBaseUnits('1.000001')).toBe(1000001n);for(const x of ['-1','1e3','1.0000001','Infinity',''])expect(parseUsdcToBaseUnits(x)).toBeNull();});
it('requires opt-in, chain and same origin; quotes never write or call RPC',async()=>{
  expect((await quote(req({...input(),optedIn:false}))).status).toBe(400);
  expect((await quote(req({...input(),chainId:1}))).status).toBe(400);
  expect((await quote(req(input(),'https://other.test'))).status).toBe(403);
  const res=await quote(req(input()));expect(res.status).toBe(200);expect(await res.json()).toMatchObject({amountBaseUnits:'1000000',maxCompute:'0.000000'});
  expect(requests).toEqual([]);expect(db.prepare('SELECT count(*) n FROM output_orders').get()?.n).toBe(0);
});
it('rejects namespaces and malformed input before RPC',async()=>{
  for(const patch of [{domain:'operator_namespace'},{mode:'OPERATOR_NAMESPACE'},{tenantId:'xOPERATOR_NAMESPACE'},{amountUsdc:'1.0000001'},{txHash:'bad'},{payerAddress:'bad'},{signature:'bad'},{optedIn:false}]) expect((await verify(req({...input(),...patch}),env())).status).toBeGreaterThanOrEqual(400);
  expect((await quote(req(null))).status).toBe(400);expect(requests).toEqual([]);
});
it('requires the payer signature bound to the transfer context',async()=>{
  expect((await verify(req({...input(),mode:'p2p'}),env())).status).toBe(403);expect(requests).toEqual([]);
});
it('records matching proof atomically with migration-defined columns and keeps output locked',async()=>{
  const res=await verify(req(input()),env());expect(res.status).toBe(200);expect(await res.json()).toMatchObject({verified:true,delivery_status:'locked'});
  expect(db.prepare('SELECT tenant_id,price_usdc,delivery_status FROM output_orders').get()).toMatchObject({tenant_id:wallet.address.toLowerCase(),price_usdc:'1.000000',delivery_status:'locked'});
  expect(db.prepare('SELECT amount_usdc,from_address FROM settlement_events').get()).toMatchObject({amount_usdc:'1.000000',from_address:wallet.address.toLowerCase()});
  expect((await verify(req(input()),env())).status).toBe(409);expect(db.prepare('SELECT count(*) n FROM output_orders').get()?.n).toBe(1);
});
it('rejects wrong chain, missing/reverted/unconfirmed receipts and mismatched logs without writes',async()=>{
  const original=structuredClone(receipt);
  chain='0x1';expect((await verify(req(input()),env())).status).toBe(422);chain='0x2105';
  for(const value of [null,{...original,status:'0x0'},{...original,blockNumber:'0x20'},{...original,logs:[]},...['address','payer','recipient','amount','topic'].map(field=>{const r=structuredClone(original);const log=r.logs[0];if(field==='address')log.address=recipient;if(field==='payer')log.topics[1]=topic(recipient);if(field==='recipient')log.topics[2]=topic(wallet.address);if(field==='amount')log.data='0x01';if(field==='topic')log.topics[0]='0x00';return r;})]) {receipt=value;expect((await verify(req(input()),env())).status).toBe(422);}
  expect(db.prepare('SELECT count(*) n FROM output_orders').get()?.n).toBe(0);
});
it('rejects RPC failures and malformed receipt values',async()=>{
  receipt.logs[0].data='0xzz';expect((await verify(req(input()),env())).status).toBe(422);
  vi.stubGlobal('fetch',async()=>{throw new Error('offline')});expect((await verify(req(input()),env())).status).toBe(422);
});
it('guards receipt reuse across catalogs in both directions',async()=>{
  db.prepare('INSERT INTO settlement_claims VALUES (?,?,?)').run(hash,'digital','synthetic');
  expect((await verify(req(input()),env())).status).toBe(409);expect(db.prepare('SELECT count(*) n FROM settlement_events').get()?.n).toBe(0);
  db.exec('DELETE FROM settlement_claims');expect((await verify(req(input()),env())).status).toBe(200);
  expect(()=>db.prepare('INSERT INTO settlement_claims VALUES (?,?,?)').run(hash,'digital','synthetic')).toThrow();
});
it('rolls back the order if recording its event fails',async()=>{
  db.exec("CREATE TRIGGER fail_event BEFORE INSERT ON settlement_events BEGIN SELECT RAISE(ABORT,'test failure'); END");
  expect((await verify(req(input()),env())).status).toBe(409);expect(db.prepare('SELECT count(*) n FROM output_orders').get()?.n).toBe(0);
});
