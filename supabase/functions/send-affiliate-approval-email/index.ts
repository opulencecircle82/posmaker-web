// Supabase Edge Function: send-affiliate-approval-email
//
// Called from dev-support.html when an admin approves an affiliate application.
// Sends a "Congrats, you're approved!" email with the affiliate's referral link
// and a link to log in to their affiliate dashboard, using the Resend API.
//
// Setup (one-time, done in the Supabase Dashboard):
//   1. Create a free account at https://resend.com and get an API key.
//   2. Deploy this function (Edge Functions -> New Function -> "send-affiliate-approval-email",
//      paste this file's contents).
//   3. Edge Functions -> Secrets -> add RESEND_API_KEY with your Resend API key.
//   4. (Optional) verify a sending domain in Resend; otherwise the default
//      "onboarding@resend.dev" sender works for testing.

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
    const { to, name, referralLink } = await req.json();

    if (!to || !referralLink) {
      return new Response(JSON.stringify({ error: 'Missing "to" or "referralLink".' }), {
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

    const dashboardUrl = new URL('affiliate-login.html', referralLink).toString();
    const displayName = name || to;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#222">
        <h2 style="color:#00b4d8">Welcome to the POSMaker Affiliate Program! 🎉</h2>
        <p>Hi ${displayName},</p>
        <p>Congrats — your affiliate application has been <strong>approved</strong>!</p>
        <p>Here is your personal referral link. Share it with business owners so they can sign up through you:</p>
        <p style="background:#f4f4f8;border-radius:8px;padding:12px 16px;word-break:break-all">
          <a href="${referralLink}" style="color:#00b4d8">${referralLink}</a>
        </p>
        <p>
          <a href="${dashboardUrl}" style="display:inline-block;background:#00b4d8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold">
            Click here to log in to your dashboard
          </a>
        </p>
        <p style="color:#888;font-size:13px;margin-top:24px">
          — The POSMaker Team
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
        subject: "You're approved! Welcome to the POSMaker Affiliate Program",
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
