// Supabase Edge Function: send-inactivity-warning-email
//
// Called by the process_inactive_stores() Postgres function (via pg_cron +
// pg_net, see sql/schema.sql) when a store has had no login and no orders
// for ~3 months minus 1 week. Warns the owner that their store will be
// deleted in 1 week unless they log back in or place an order, using the
// Resend API — same setup as send-affiliate-approval-email.
//
// Setup (one-time, done in the Supabase Dashboard):
//   1. Edge Functions -> New Function -> "send-inactivity-warning-email",
//      paste this file's contents.
//   2. Edge Functions -> Secrets -> RESEND_API_KEY (shared with the other
//      email function — no need to add it twice if already set).

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('AFFILIATE_EMAIL_FROM') || 'POSMaker <onboarding@resend.dev>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, name } = await req.json();

    if (!to) {
      return new Response(JSON.stringify({ error: 'Missing "to".' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const storeName = name || 'your store';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#222">
        <h2 style="color:#f59e0b">Your POSMaker account has been inactive</h2>
        <p>Hi,</p>
        <p>We noticed <strong>${storeName}</strong> hasn't had any logins or sales in a while.</p>
        <p>Your account is inactive for several months now. <strong>You have 1 week remaining</strong> — if there's no activity within that time, we will deactivate your account.</p>
        <p>To keep your store active, simply log in or process a sale within the next 7 days.</p>
        <p style="color:#888;font-size:13px;margin-top:24px">
          Thank you,<br>The POSMaker Team
        </p>
      </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: 'Action needed: your POSMaker account is inactive',
        html,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: result }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
