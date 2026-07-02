// POSMaker — Maya Payment Webhook Receiver
// Maya calls this URL when a QR Ph payment is completed.
// Inserts a row into maya_payments → triggers cashier's realtime subscription → auto-confirms order.
//
// Deploy: Supabase Dashboard → Edge Functions → New Function → "maya-webhook" → paste this file
// Webhook URL to enter in Maya Business portal:
//   https://djvwlwnnlldoppomhbap.supabase.co/functions/v1/maya-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json()

    // Maya sends various events; only act on successful payment
    if (body.status !== 'PAYMENT_SUCCESS') {
      return new Response('ignored', { status: 200 })
    }

    const refNo: string = body.requestReferenceNumber || ''
    // refNo format: PM-{storeId-no-dashes-32chars}-{timestamp}
    // e.g. PM-550e8400e29b41d4a7164466140000001234567890
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
      payment_id: body.id,
      amount: body.totalAmount?.value ?? null,
    }).then(() => {})

    return new Response('ok', { status: 200 })

  } catch (e: any) {
    console.error('maya-webhook error:', e.message)
    return new Response(e.message, { status: 500 })
  }
})
