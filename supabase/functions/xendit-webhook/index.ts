// POSMaker — Xendit QR Payment Webhook
// Xendit calls this URL when a QR Ph payment is completed.
// Inserts into maya_payments table → cashier's realtime subscription fires → order auto-confirms.
//
// Deploy: Supabase Dashboard → Edge Functions → New Function → "xendit-webhook" → paste this file

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json()

    // Xendit QR payment success event
    if (body.event !== 'qr.payment.succeeded') {
      return new Response('ignored', { status: 200 })
    }

    const refNo: string = body.data?.reference_id || ''
    // refNo format: PM-{storeId-no-dashes-32chars}-{timestamp}
    const match = refNo.match(/^PM-([0-9a-f]{32})-\d+$/i)
    let storeId: string | null = null
    if (match) {
      const r = match[1]
      storeId = `${r.slice(0,8)}-${r.slice(8,12)}-${r.slice(12,16)}-${r.slice(16,20)}-${r.slice(20)}`
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    await sb.from('maya_payments').insert({
      store_id: storeId,
      ref_no: refNo,
      payment_id: body.data?.id,
      amount: body.data?.amount ?? null,
    }).then(() => {})

    return new Response('ok', { status: 200 })

  } catch (e: any) {
    console.error('xendit-webhook error:', e.message)
    return new Response(e.message, { status: 500 })
  }
})
