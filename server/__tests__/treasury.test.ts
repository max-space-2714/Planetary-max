import {beforeEach,afterEach,it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import app from '../planetary-max';
let db:DatabaseSync;
function statement(sql:string){let args:any[]=[];return {bind(...values:any[]){args=values;return this;},async first(){return db.prepare(sql).get(...args)??null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const result=db.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}};}};}
const env=()=>({ADMIN_PASSWORD:'synthetic-test-password',ADMIN_SESSIONS:{idFromName:()=>({}),get:()=>({fetch:async()=>new Response(null,{status:204})})},DB:{prepare:statement}} as any);
function request(path='',body?:unknown,authorized=true,origin='https://max.test') {return app.request(`https://max.test/api/admin/treasury${path}`,{method:body?'POST':'GET',headers:{...(authorized?{Cookie:`max_admin=as1_${'a'.repeat(64)}`}:{ }),Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})},env());}
beforeEach(()=>{db=new DatabaseSync(':memory:');db.exec("CREATE TABLE digital_orders(tx_reference TEXT,amount_cents INTEGER,payment_status TEXT);");for(const file of ['0022_max_finance_sovereign.sql','0024_sports_output_orders.sql','0025_output_order_settlement.sql','0027_wallet_optional_treasury.sql','0028_funded_treasury.sql'])db.exec(readFileSync(`migrations/${file}`,'utf8'));for(const bucket of ['treasury','escrow','reallocation']) {
 db.prepare("INSERT INTO output_orders(order_id,output_title,tier_name,tx_hash,settlement_status) VALUES (?,?,?,?,'verified_settlement')").run(bucket,bucket,bucket,bucket);
 db.prepare('INSERT INTO settlement_events(event_id,tx_hash,source_kind,to_address,amount_usdc,verified_amount_usdc,accounting_bucket,order_id) VALUES (?,?,?,?,?,?,?,?)').run(bucket,bucket,'output_order','','2.000001','2.000001',bucket,bucket);
 }});
afterEach(()=>db.close());
it('requires AdminSessionDO for balances, destination and release actions',async()=>{
 for(const [path,body] of [['',undefined],['/destination',{destination:'wallet'}],['/releases',{amountUsdc:'1',reference:'r'.repeat(16)}]] as const) expect((await request(path,body,false)).status).toBe(401);
 expect((await app.request('https://max.test/api/admin/treasury',{headers:{Cookie:`max_admin=as1_${'a'.repeat(64)}`}},{...env(),ADMIN_SESSIONS:undefined})).status).toBe(503);
});
it('returns exact totals and records only bounded treasury releases with immutable destination snapshots',async()=>{
 expect(await (await request()).json()).toMatchObject({totals:{treasury:'2.000001',escrow:'2.000001',reallocation:'2.000001'}});
 const release={amountUsdc:'1.000001',reference:'r'.repeat(16)};
 expect((await request('/releases',release)).status).toBe(409);
 expect((await request('/destination',{destination:'later-wallet'})).status).toBe(200);
 expect((await request('/releases',release)).status).toBe(200);
 expect(await (await request('/releases',release)).json()).toMatchObject({recorded:true,duplicate:true});
 expect((await request('/releases',{...release,reference:'s'.repeat(16)})).status).toBe(409);
 expect((await request('/destination',{destination:'new-wallet'})).status).toBe(200);
 expect(db.prepare('SELECT destination FROM treasury_releases').get()?.destination).toBe('later-wallet');
 expect(await (await request()).json()).toMatchObject({totals:{treasury:'1.000000',escrow:'2.000001',reallocation:'2.000001'}});
});
it('rejects cross-origin writes and forbidden namespaces',async()=>{
 expect((await request('/destination',{destination:'wallet'},true,'https://evil.test')).status).toBe(403);
 expect((await request('/destination',{destination:'OPERATOR_NAMESPACE'})).status).toBe(403);
});

it('excludes unpaid commitments from releases and handles totals larger than int64',async()=>{
 db.exec("DELETE FROM settlement_events; DELETE FROM output_orders");
 for(let i=0;i<10;i++) db.prepare("INSERT INTO settlement_events(event_id,tx_hash,rail,source_kind,to_address,amount_usdc,accounting_bucket) VALUES (?,?,'INTERNAL_LEDGER','output_order','','999999999999.999999','treasury')").run(String(i),String(i));
 expect(await (await request()).json()).toMatchObject({totals:{treasury:'0.000000'},commitments:{treasury:'9999999999999.999990'}});
 await request('/destination',{destination:'wallet'});
 expect((await request('/releases',{amountUsdc:'1',reference:'unfunded_release_1'})).status).toBe(409);
 for(let i=0;i<10;i++) db.prepare("INSERT INTO artwork_funding VALUES (?,?)").run('art'+i,'999999999999.999999');
 expect(await (await request()).json()).toMatchObject({totals:{treasury:'9999999999999.999990'}});
 expect((await request('/releases',{amountUsdc:'1',reference:'funded_release_01'})).status).toBe(200);
});
it('adapts legacy digital sales and verified_settlement without double counting receipts',async()=>{
 db.prepare("UPDATE settlement_events SET accounting_bucket='verified_settlement' WHERE event_id='treasury'").run();
 db.prepare("INSERT INTO digital_orders VALUES ('digital',501,'confirmed')").run();
 db.prepare("INSERT INTO digital_orders VALUES ('treasury',200,'confirmed')").run();
 db.prepare("INSERT INTO artwork_funding VALUES ('digital','5.010000')").run();
 expect(await (await request()).json()).toMatchObject({totals:{treasury:'7.010001'}});
});
it('serializes competing releases through the revision check',async()=>{
 await request('/destination',{destination:'wallet'});
 const responses=await Promise.all(['a','b'].map(c=>request('/releases',{amountUsdc:'2',reference:c.repeat(16)})));
 expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
});

it('recovers the original release after depletion and destination changes and rejects changed payloads',async()=>{
 await request('/destination',{destination:'original'});
 const body={amountUsdc:'2.000001',reference:crypto.randomUUID(),destination:'original'};
 const first=await (await request('/releases',body)).json();
 await request('/destination',{destination:'replacement'});
 expect(await (await request('/releases',body)).json()).toMatchObject({releaseId:first.releaseId,duplicate:true,release:{destination:'original'}});
 expect((await request('/releases',{...body,amountUsdc:'1'})).status).toBe(409);
 expect((await request('/releases',{...body,destination:'replacement'})).status).toBe(409);
 expect(db.prepare('SELECT count(*) n FROM treasury_releases').get()?.n).toBe(1);
});
it('does not redirect a new release when its destination changed before submission',async()=>{
 await request('/destination',{destination:'new'});
 expect((await request('/releases',{amountUsdc:'1',reference:crypto.randomUUID(),destination:'old'})).status).toBe(409);
 expect(db.prepare('SELECT count(*) n FROM treasury_releases').get()?.n).toBe(0);
});
it('sums release rows beyond int64 without overflow or precision loss',async()=>{
 for(let i=0;i<1100;i++) {
   db.prepare("INSERT INTO artwork_funding VALUES (?,?)").run('large'+i,'999999999999.999999');
   db.prepare("INSERT INTO treasury_releases(release_id,amount_atomic,destination,reference) VALUES (?,?,?,?)")
     .run('large'+i,Number.MAX_SAFE_INTEGER,'wallet','large'+i);
 }
 const response=await request(); expect(response.status).toBe(200);
 const expected=1100n*999999999999999999n-1100n*BigInt(Number.MAX_SAFE_INTEGER)+2000001n;
 const {formatAtomicToUsdc}=await import('../verify-base-usdc');
 expect(await response.json()).toMatchObject({totals:{treasury:formatAtomicToUsdc(expected)}});
});

it('keeps a verified receipt larger than the intake limit available without overflowing',async()=>{
 db.prepare('INSERT INTO artwork_funding VALUES (?,?)').run('large-receipt','100000000000000000000.123456');
 const result=await request(); expect(result.status).toBe(200);
 expect(await result.json()).toMatchObject({totals:{treasury:'100000000000000000002.123457'}});
 await request('/destination',{destination:'wallet'});
 expect((await request('/releases',{amountUsdc:'1',reference:'large_funded_release'})).status).toBe(200);
});
