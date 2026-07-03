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

    const secretKey = Deno.env.get('MAYA_SECRET_KEY')
    if (!secretKey) {
      return new Response(JSON.stringify({ error: 'Maya not configured.' }), { status: 400, headers: CORS })
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: store } = await sb
      .from('stores')
      .select('maya_sandbox, maya_public_key')
      .eq('id', storeId)
      .single()

    const baseUrl = store?.maya_sandbox === true
      ? 'https://pg-sandbox.paymaya.com'
      : 'https://pg.paymaya.com'

    const authKey = store?.maya_public_key || secretKey
    const amt = Number(Number(amount).toFixed(2))

    const res = await fetch(`${baseUrl}/checkout/v1/checkouts`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(authKey + ':'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        totalAmount: {
          value: amt,
          currency: 'PHP',
          details: {
            discount: 0,
            serviceCharge: 0,
            shippingFee: 0,
            tax: 0,
            subtotal: amt,
          },
        },
        buyer: {
          firstName: 'Customer',
          lastName: '',
          contact: {
            phone: '+639990000000',
            email: 'customer@posmaker.ph',
          },
        },
        items: [
          {
            name: 'Order',
            quantity: 1,
            code: 'ORDER',
            description: 'POS Payment',
            amount: { value: amt, currency: 'PHP' },
            totalAmount: { value: amt, currency: 'PHP' },
          },
        ],
        requestReferenceNumber: refNo,
        metadata: { storeId },
        redirectUrl: {
          success: 'https://posmaker.ggff.net/',
          failure: 'https://posmaker.ggff.net/',
          cancel: 'https://posmaker.ggff.net/',
        },
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
      JSON.stringify({ qrCode: data.redirectUrl, checkoutId: data.checkoutId }),
      { headers: CORS }
    )

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS })
  }
})
