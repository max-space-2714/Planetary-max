import {it,expect,vi} from 'vitest';
vi.mock('cloudflare:workers',()=>({DurableObject:class {}}));
import worker from '../../src/worker';
it('rejects all namespace values before early routes and never dispatches public ledgers',async()=>{
 const dispatch=vi.fn();const env={TENANT_BEEMAX_DO:{get:dispatch}} as any;
 for(const path of ['/api/gateway/health','/api/internet-feeds','/','/api/tenant/user/modules/icvs']) {
  expect((await worker.fetch(new Request('https://max.test'+path+'?namespace=public&namespace=OPERATOR_NAMESPACE'),env,{} as any)).status).toBe(403);
  expect((await worker.fetch(new Request('https://max.test'+path,{headers:{'x-target-namespace':'OPERATOR_NAMESPACE'}}),env,{} as any)).status).toBe(403);
 }
 for(const method of ['GET','POST']) expect((await worker.fetch(new Request('https://max.test/api/tenant/other/ledger',{method}),env,{} as any)).status).toBe(403);
 expect(dispatch).not.toHaveBeenCalled();
});
it('does not fetch private feeds or read their old public cache key',async()=>{
 const remote=vi.fn();vi.stubGlobal('fetch',remote);
 const get=vi.fn(async()=>null),put=vi.fn();
 try {
 const response=await worker.fetch(new Request('https://max.test/api/internet-feeds'),{PRIVATE_WWW_FEED_URL:'https://private.test',PRIVATE_WWW_FEED_TOKEN:'synthetic',KV_BINDING:{get,put}} as any,{} as any);
 expect(response.status).toBe(200);expect(remote).not.toHaveBeenCalled();expect(get).toHaveBeenCalledWith('public_internet_feeds_v2:all','json');
 } finally {vi.unstubAllGlobals();}
});
it('root handler remains zero-write',async()=>{
 const response=await worker.fetch(new Request('https://max.test/'),{} as any,{} as any);
 expect(await response.json()).toMatchObject({write_performed:false});
});
it('private feeds require a verified AdminSessionDO and are never cached publicly',async()=>{
 const remote=vi.fn(async()=>Response.json({items:[{title:'private synthetic',summary:'operator only'}]}));vi.stubGlobal('fetch',remote);
 const put=vi.fn(),get=vi.fn();
 const env={ADMIN_PASSWORD:'synthetic',ADMIN_SESSIONS:{idFromName:()=>({}),get:()=>({fetch:async()=>new Response(null,{status:204})})},PRIVATE_WWW_FEED_URL:'https://private.test',KV_BINDING:{get,put}} as any;
 try {
 expect((await worker.fetch(new Request('https://max.test/api/admin/internet-feeds'),env,{} as any)).status).toBe(401);
 expect(remote).not.toHaveBeenCalled();
 const response=await worker.fetch(new Request('https://max.test/api/admin/internet-feeds',{headers:{Cookie:`max_admin=as1_${'a'.repeat(64)}`}}),env,{} as any);
 expect(await response.json()).toMatchObject({items:[{title:'private synthetic'}]});expect(get).not.toHaveBeenCalled();expect(put).not.toHaveBeenCalled();
 } finally {vi.unstubAllGlobals();}
});
