import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { decodeFunctionData, erc20Abi } from 'viem';
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
  return { bind(...args:any[]) { values=args; return this; }, async first(){return db.prepare(sql).get(...values) ?? null;}, async all(){return {results:db.prepare(sql).all(...values)};}, async run(){ const result=db.prepare(sql).run(...values); return {meta:{changes:Number(result.changes)}}; } };
}
const env = () => ({ SETTLEMENT_RECIPIENT_ADDRESS:recipient, RPC_URL:'https://rpc.test', DB:{ prepare:statement, async batch(stmts:any[]){db.exec('BEGIN');try{const result=[];for(const s of stmts)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}} } }) as any;
beforeEach(async()=>{
  db=new DatabaseSync(':memory:');
  const commerce=readFileSync('migrations/0020_direct_digital_commerce.sql','utf8');
  db.exec(commerce.match(/CREATE TABLE settlement_claims \([\s\S]*?\);/)![0]);
  for(const file of ['0022_max_finance_sovereign.sql','0024_sports_output_orders.sql','0025_output_order_settlement.sql','0026_output_receipt_claim_guards.sql','0027_wallet_optional_treasury.sql']) db.exec(readFileSync(`migrations/${file}`,'utf8'));
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
  expect(await (await verify(req(input()),env())).json()).toMatchObject({verified:true,duplicate:true});expect(db.prepare('SELECT count(*) n FROM output_orders').get()?.n).toBe(1);
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

it('accepts wallet-free intake without chain configuration, with atomic idempotency and bucket routing',async()=>{
  const e=env();delete e.SETTLEMENT_RECIPIENT_ADDRESS;
  const body={optedIn:true,amountUsdc:'5.000000',mode:'paid-tier',tierCode:'tier_std_5',idempotencyKey:'k'.repeat(32)};
  expect((await verify(req(body),e)).status).toBe(200);
  expect(await (await verify(req(body),e)).json()).toMatchObject({duplicate:true,verified:false,bucket:'treasury'});
  expect((await verify(req({...body,amountUsdc:'3'}),e)).status).toBe(400);
  expect((await verify(req({...body,tierCode:'tier_ext_15',amountUsdc:'15'}),e)).status).toBe(409);
  for(const [mode,bucket] of [['wager','escrow'],['paid-tier','reallocation']]) expect(await (await verify(req({...body,mode,bucket,tierCode:mode==='paid-tier'?'tier_ext_15':undefined,amountUsdc:mode==='paid-tier'?'15':'5',idempotencyKey:crypto.randomUUID()}),e)).json()).toMatchObject({bucket});
  expect(db.prepare('SELECT count(*) n FROM output_orders').get()?.n).toBe(3);
  expect(requests).toEqual([]);
});
it('attaches a receipt later without double crediting the internal event',async()=>{
  const body={optedIn:true,domain:'MAX-SPORTS',mode:'wager',amountUsdc:'1',idempotencyKey:crypto.randomUUID()};
  const recorded=await (await verify(req(body),env())).json();
  expect((await verify(req({...input(),orderId:recorded.orderId,idempotencyKey:'wrong'}),env())).status).toBe(409);
  expect((await verify(req({...input(),orderId:recorded.orderId,idempotencyKey:body.idempotencyKey}),env())).status).toBe(200);
  expect(db.prepare('SELECT count(*) n FROM settlement_events').get()?.n).toBe(1);
  expect(db.prepare('SELECT tx_hash,accounting_bucket,verified_amount_usdc FROM settlement_events').get()).toMatchObject({tx_hash:hash,accounting_bucket:'escrow',verified_amount_usdc:'1.000000'});
});

it('uses a wallet saved later in Portal-OS1 for optional receipt verification',async()=>{
  const e=env();delete e.SETTLEMENT_RECIPIENT_ADDRESS;
  db.prepare('INSERT INTO treasury_destination(id,destination) VALUES (1,?)').run(recipient);
  expect((await verify(req(input()),e)).status).toBe(200);
});

it('provides native USDC transfer instructions only for a configured wallet without writing',async()=>{
  const e=env();
  const response=await quote(req({...input(),amountUsdc:'1.000001'}),e);
  const body=await response.json();
  expect(body.payment).toMatchObject({to:BASE_NATIVE_USDC,recipient:recipient.toLowerCase(),value:'0x0'});
  expect(decodeFunctionData({abi:erc20Abi,data:body.payment.data})).toMatchObject({functionName:'transfer',args:[recipient,1000001n]});
  expect(db.prepare('SELECT count(*) n FROM output_orders').get()?.n).toBe(0);
  expect(requests).toEqual([]);
  delete e.SETTLEMENT_RECIPIENT_ADDRESS;
  expect(await (await quote(req(input()),e)).json()).toMatchObject({ok:true,payment:null});
  db.prepare('INSERT INTO treasury_destination(id,destination) VALUES (1,?)').run(recipient);
  expect(await (await quote(req(input()),e)).json()).toMatchObject({payment:{recipient:recipient.toLowerCase()}});
  db.prepare('UPDATE treasury_destination SET destination=?').run('payout-reference');
  expect(await (await quote(req(input()),e)).json()).toMatchObject({ok:true,payment:null});
});


it('records every new hub domain through D1 buckets with opt-in and duplicate protection', async () => {
  const domains = ['MAX-INSTITUTE','MAX-REALITY','MAX-FORCE','MAX-ARCHITECTURE','MAX-ECOSYSTEM'];
  for (const [index, domain] of domains.entries()) {
    const body = { optedIn: true, domain, mode: 'paid-tier', amountUsdc: index % 2 ? '15.000000':'5.000000', tierCode:index % 2 ? 'tier_ext_15':'tier_std_5', idempotencyKey: crypto.randomUUID(), bucket: index % 2 ? 'reallocation' : 'treasury' };
    expect((await verify(req({...body, optedIn:false}),env())).status).toBe(400);
    const first = await (await verify(req(body),env())).json();
    expect(first).toMatchObject({ok:true, verified:false, bucket:body.bucket, delivery_status:'locked'});
    const retry = await (await verify(req(body),env())).json();
    expect(retry).toMatchObject({ok:true,duplicate:true,orderId:first.orderId});
    expect((await verify(req({...body, domain:'MAX-SPACES'}),env())).status).toBe(409);
    const stake = await (await verify(req({...body, mode:'stake',tierCode:undefined,bucket:'escrow', idempotencyKey:crypto.randomUUID()}),env())).json();
    expect(stake).toMatchObject({ok:true,bucket:'escrow'});
  }
  expect(db.prepare('SELECT count(*) n FROM settlement_events').get()?.n).toBe(10);
  expect(db.prepare('SELECT count(*) n FROM output_orders').get()?.n).toBe(10);
  expect(requests).toEqual([]);
});
it('accepts a signed Base USDC receipt for a new hub module without replay', async () => {
  const body = {...input(), domain:'MAX-REALITY',mode:'paid-tier',tierCode:'tier_std_5',amountUsdc:'5.000000'};
  receipt.logs[0].data='0x4c4b40';
  body.signature = await wallet.signMessage({message:baseUsdcSettlementMessage('https://max.test',body)});
  expect(await (await verify(req(body),env())).json()).toMatchObject({ok:true,verified:true});
  expect(db.prepare('SELECT accounting_bucket,amount_usdc FROM settlement_events').get()).toMatchObject({accounting_bucket:'treasury',amount_usdc:'5.000000'});
  expect(await (await verify(req(body),env())).json()).toMatchObject({verified:true,duplicate:true});
});

it('records ICV opt-ins idempotently in the selected D1 bucket', async () => {
  for (const [mode, bucket] of [['paid-tier','treasury'],['paid-tier','reallocation'],['stake','escrow']] as const) {
    const body = {optedIn:true,domain:'ICVS',mode,bucket,tierCode:mode==='paid-tier'?(bucket==='treasury'?'tier_std_5':'tier_ext_15'):undefined,amountUsdc:mode==='paid-tier'?(bucket==='treasury'?'5':'15'):'1.000001',idempotencyKey:crypto.randomUUID()};
    expect((await verify(req({...body,optedIn:false}),env())).status).toBe(400);
    const first = await (await verify(req(body),env())).json();
    expect(first).toMatchObject({ok:true,verified:false,bucket,delivery_status:'locked'});
    expect(await (await verify(req(body),env())).json()).toMatchObject({ok:true,duplicate:true,orderId:first.orderId});
  }
  expect(db.prepare('SELECT count(*) n FROM settlement_events').get()?.n).toBe(3);
  expect(db.prepare("SELECT count(*) n FROM output_orders WHERE reinvest_target='ICVS'").get()?.n).toBe(3);
  expect(requests).toEqual([]);
});

it('enforces catalog price, tier and allocation before recording or verifying',async()=>{
 const body={optedIn:true,domain:'MAX-SPORTS',mode:'paid-tier',tierCode:'tier_std_5',amountUsdc:'5',idempotencyKey:crypto.randomUUID()};
 for(const patch of [{amountUsdc:'1'},{tierCode:'unknown'},{tierCode:undefined},{bucket:'reallocation'}]) expect((await verify(req({...body,...patch}),env())).status).toBe(400);
 expect((await verify(req(body),env())).status).toBe(200);
 expect(db.prepare('SELECT tier_code,output_slug FROM output_orders').get()).toMatchObject({tier_code:'tier_std_5',output_slug:'sports_standard_research_brief'});
 expect((await quote(new Request('https://max.test/api/settlements/base-usdc/quote?namespace=public&namespace=OPERATOR_NAMESPACE',{method:'POST',headers:{Origin:'https://max.test'},body:JSON.stringify(body)}),env())).status).toBe(403);
});

it('recovers original signed receipt IDs after destination changes without another RPC call',async()=>{
 const first=await (await verify(req(input()),env())).json();
 const e=env();e.SETTLEMENT_RECIPIENT_ADDRESS='';
 db.prepare("INSERT INTO treasury_destination(id,destination) VALUES (1,'deferred')").run();
 requests=[];
 expect(await (await verify(req(input()),e)).json()).toMatchObject({verified:true,orderId:first.orderId,eventId:first.eventId,duplicate:true});
 expect(requests).toEqual([]);
 const other={...input(),domain:'MAX-ART'};
 other.signature=await wallet.signMessage({message:baseUsdcSettlementMessage('https://max.test',other)});
 expect((await verify(req(other),e)).status).toBe(409);
});
it('recovers attachment and intake retries with the same IDs and verified outcome',async()=>{
 const body={optedIn:true,domain:'MAX-SPORTS',mode:'wager',amountUsdc:'1',idempotencyKey:crypto.randomUUID()};
 const first=await (await verify(req(body),env())).json();
 const proof={...input(),orderId:first.orderId,idempotencyKey:body.idempotencyKey};
 const verified=await (await verify(req(proof),env())).json();
 expect(verified).toMatchObject({verified:true,orderId:first.orderId,eventId:first.eventId});
 expect(await (await verify(req(proof),env())).json()).toMatchObject({verified:true,orderId:first.orderId,eventId:first.eventId});
 expect(await (await verify(req(body),env())).json()).toMatchObject({verified:true,orderId:first.orderId,eventId:first.eventId});
 expect(db.prepare('SELECT count(*) n FROM settlement_events').get()?.n).toBe(1);
});
