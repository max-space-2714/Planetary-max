import { it, expect } from 'vitest';
import app from '../planetary-max';
it('requires the opaque AdminSessionDO session even with legacy bearer credentials',async()=>{
  let checks=0;
  const env={ADMIN_PASSWORD:'synthetic-test-password',ADMIN_SESSIONS:{idFromName:()=>({}),get:()=>({fetch:async()=>{checks++;return new Response(null,{status:204});}})}} as any;
  expect((await app.request('https://max.test/api/auth/command-session',{},env)).status).toBe(401);
  expect((await app.request('https://max.test/api/auth/command-session',{headers:{Authorization:'Bearer legacy-jwt'}},env)).status).toBe(401);
  expect(checks).toBe(0);
  const res=await app.request('https://max.test/api/auth/command-session',{headers:{Cookie:`max_admin=as1_${'a'.repeat(64)}`}},env);
  expect(res.status).toBe(200);expect(await res.json()).toEqual({authenticated:true});expect(checks).toBe(1);
});
it('fails closed without configured DO authentication or with an expired session',async()=>{
  expect((await app.request('https://max.test/api/auth/command-session',{},{} as any)).status).toBe(503);
  const env={ADMIN_PASSWORD:'synthetic-test-password',ADMIN_SESSIONS:{idFromName:()=>({}),get:()=>({fetch:async()=>new Response(null,{status:401})})}} as any;
  expect((await app.request('https://max.test/api/auth/command-session',{headers:{Cookie:`max_admin=as1_${'a'.repeat(64)}`}},env)).status).toBe(401);
});
