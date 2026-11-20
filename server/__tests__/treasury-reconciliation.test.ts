import {it,expect,vi,afterEach} from 'vitest';
vi.mock('../base-settlement',()=>({settlementConfigured:()=>true,verifyBaseTransfer:vi.fn(async()=>({amountUnits:'5000001'}))}));
import {reconcileArtworkFunding} from '../treasury-reconciliation';
import {verifyBaseTransfer} from '../base-settlement';
afterEach(()=>vi.clearAllMocks());
it('verifies historical art before funding and rejects mismatches',async()=>{
 const run=vi.fn(),bind=vi.fn(()=>({first:async()=>({buyer_wallet:'0x'+'2'.repeat(40)}),run}));
 const env={DB:{prepare:()=>({bind})}} as any;
 const request=()=>new Request('https://max.test/api/admin/treasury/reconcile',{method:'POST',headers:{Origin:'https://max.test'},body:JSON.stringify({txHash:'0x'+'a'.repeat(64)})});
 expect((await reconcileArtworkFunding(request(),env)).status).toBe(200);expect(bind).toHaveBeenLastCalledWith('0x'+'a'.repeat(64),'5.000001');expect(run).toHaveBeenCalledTimes(1);
 vi.mocked(verifyBaseTransfer).mockResolvedValueOnce({status:403,body:{error:'Mismatch'}});
 expect((await reconcileArtworkFunding(request(),env)).status).toBe(403);expect(run).toHaveBeenCalledTimes(1);
});
