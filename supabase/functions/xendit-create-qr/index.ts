// POSMaker — Xendit QR Ph Payment Creator
// Called by the cashier when processing a QR Pay transaction.
// Creates a dynamic QR Ph code scannable by GCash, Maya, BPI, BDO, and all PH bank apps.
//
// Deploy: Supabase Dashboard → Edge Functions → New Function → "xendit-create-qr" → paste this file

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const WEBHOOK_URL = 'https://djvwlwnnlldoppomhbap.supabase.co/functions/v1/xendit-webhook'

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
      .select('xendit_secret_key')
      .eq('id', storeId)
      .single()

    if (!store?.xendit_secret_key) {
      return new Response(
        JSON.stringify({ error: 'Xendit not configured. Go to Dashboard → Settings → Xendit QR Pay.' }),
        { status: 400, headers: CORS }
      )
    }

    const res = await fetch('https://api.xendit.co/v2/qr_codes', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(store.xendit_secret_key + ':'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference_id: refNo,
        type: 'DYNAMIC',
        currency: 'PHP',
        amount: Number(amount),
        callback_url: WEBHOOK_URL,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: data?.message || `Xendit error ${res.status}`, details: data }),
        { status: res.status, headers: CORS }
      )
    }

    return new Response(
      JSON.stringify({ qrCode: data.qr_string, paymentId: data.id }),
      { headers: CORS }
    )

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS })
  }
})
