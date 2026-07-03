import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const body = await req.json()
    const status = body.status ?? body.paymentStatus ?? ''
    const isPaid = body.isPaid === true || status === 'PAYMENT_SUCCESS' || status === 'completed'

    if (!isPaid) {
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    // storeId is embedded in metadata by maya-create-qr Edge Function
    const storeId: string | null = body.metadata?.storeId ?? null

    if (!storeId) {
      return new Response(JSON.stringify({ error: 'no storeId' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const channel = supabase.channel('display-' + storeId)
    await new Promise<void>(resolve => {
      channel.subscribe(st => {
        if (st === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'customer_paid',
            payload: {
              method: 'Maya QRPh',
              amount: body.totalAmount?.value ?? body.amount ?? 0,
              ref,
              verified: true
            }
          }).then(() => resolve())
        }
      })
    })

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
