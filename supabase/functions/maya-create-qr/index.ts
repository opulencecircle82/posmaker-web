// POSMaker — Maya QR Ph Payment Creator
// Called by the cashier when processing a QR Pay transaction.
// Proxies to Maya Business API server-side so API keys never reach the browser.
//
// Deploy: Supabase Dashboard → Edge Functions → New Function → "maya-create-qr" → paste this file
// No additional secrets needed (uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, auto-set by Supabase)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { storeId, amount, refNo } = await req.json()
    if (!storeId || !amount || !refNo) {
      return new Response(JSON.stringify({ error: 'Missing storeId, amount, or refNo' }), { status: 400, headers: CORS })
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: store } = await sb
      .from('stores')
      .select('maya_public_key, maya_sandbox')
      .eq('id', storeId)
      .single()

    if (!store?.maya_public_key) {
      return new Response(
        JSON.stringify({ error: 'Maya API not configured for this store. Go to Dashboard → Settings → Maya API.' }),
        { status: 400, headers: CORS }
      )
    }

    const baseUrl = store.maya_sandbox !== false
      ? 'https://pg-sandbox.paymaya.com'
      : 'https://pg.paymaya.com'

    const res = await fetch(`${baseUrl}/qrph/v1/payments`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(store.maya_public_key + ':'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        totalAmount: { value: Number(amount).toFixed(2), currency: 'PHP' },
        requestReferenceNumber: refNo,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: data?.message || `Maya API error ${res.status}`, details: data }),
        { status: res.status, headers: CORS }
      )
    }

    return new Response(
      JSON.stringify({ qrCode: data.qrCode, paymentId: data.id }),
      { headers: CORS }
    )

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS })
  }
})
