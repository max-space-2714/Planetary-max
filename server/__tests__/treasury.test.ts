import {beforeEach,afterEach,it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import app from '../planetary-max';
let db:DatabaseSync;
function statement(sql:string){let args:any[]=[];return {bind(...values:any[]){args=values;return this;},async first(){return db.prepare(sql).get(...args)??null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const result=db.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}};}};}
const env=()=>({ADMIN_PASSWORD:'synthetic-test-password',ADMIN_SESSIONS:{idFromName:()=>({}),get:()=>({fetch:async()=>new Response(null,{status:204})})},DB:{prepare:statement}} as any);
function request(path='',body?:unknown,authorized=true,origin='https://max.test') {return app.request(`https://max.test/api/admin/treasury${path}`,{method:body?'POST':'GET',headers:{...(authorized?{Cookie:`max_admin=as1_${'a'.repeat(64)}`}:{ }),Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})},env());}
beforeEach(()=>{db=new DatabaseSync(':memory:');for(const file of ['0022_max_finance_sovereign.sql','0024_sports_output_orders.sql','0025_output_order_settlement.sql','0027_wallet_optional_treasury.sql'])db.exec(readFileSync(`migrations/${file}`,'utf8'));for(const bucket of ['treasury','escrow','reallocation'])db.prepare('INSERT INTO settlement_events(event_id,tx_hash,source_kind,to_address,amount_usdc,accounting_bucket) VALUES (?,?,?,?,?,?)').run(bucket,bucket,'output_order','','2.000001',bucket);});
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
 expect((await request('/releases',release)).status).toBe(409);
 expect((await request('/releases',{...release,reference:'s'.repeat(16)})).status).toBe(409);
 expect((await request('/destination',{destination:'new-wallet'})).status).toBe(200);
 expect(db.prepare('SELECT destination FROM treasury_releases').get()?.destination).toBe('later-wallet');
 expect(await (await request()).json()).toMatchObject({totals:{treasury:'1.000000',escrow:'2.000001',reallocation:'2.000001'}});
});
it('rejects cross-origin writes and forbidden namespaces',async()=>{
 expect((await request('/destination',{destination:'wallet'},true,'https://evil.test')).status).toBe(403);
 expect((await request('/destination',{destination:'OPERATOR_NAMESPACE'})).status).toBe(403);
});
