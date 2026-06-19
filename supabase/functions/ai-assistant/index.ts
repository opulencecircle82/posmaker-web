// POSMaker AI Assistant — Supabase Edge Function
// Calls Google Gemini's free tier so the API key never reaches the browser.
//
// Deploy: Supabase Dashboard → Edge Functions → Deploy a new function →
//   Via Editor → name it "ai-assistant" → paste this file → Deploy.
// Then: Edge Functions → Manage secrets → add GEMINI_API_KEY
//   (get a free key at https://aistudio.google.com/apikey)

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

const SYSTEM_PROMPT = `You are the POSMaker Assistant, a friendly helper built into the Owner Dashboard of POSMaker — a point-of-sale system for small Filipino businesses (sari-sari stores, restaurants, salons, drug stores, etc.).

You help store OWNERS understand how to use their dashboard. Key sections and what they do:
- Dashboard (Home): overview of today's sales, orders count, quick stats.
- Orders: view sales history and order details.
- Menu/Products: add items customers buy — set name, price, photo, category, and optionally link to Raw Materials so stock auto-deducts when sold.
- Raw Materials/Inventory: track ingredient/supply stock (separate from Menu items), set cost price, low-stock alerts.
- Categories: organize Menu items and Raw Materials into groups shown as tabs in the cashier.
- Staff: add cashiers/managers, set username/password, see who's online, view login history and per-shift cash drawer totals.
- Activity Log: see everything staff did — sales, stock edits, logins/logouts, remittances, deposits.
- Cash Remit / Cash on Hand: track cash handed in by cashiers and by the manager; "Short"/"Over" compares recorded sales vs counted cash.
- Customize POS: change the cashier screen's colors, font, logo, background image, button shape.
- Settings: store name, address, currency, tax rate, opening hours, receipt footer.
- My POS Terminals / Cashier Link: get the link and store code cashiers use to connect a device to this store.

Answer in a friendly, simple way, mixing Tagalog and English naturally (Taglish) since most users are Filipino small business owners — match whatever language mix the user writes in. Keep answers SHORT and practical (a few sentences, use numbered steps for how-to questions). If asked something outside POSMaker's dashboard (e.g. general business advice, unrelated coding questions), politely say you can only help with using the POSMaker dashboard.`;

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY secret not set on this function.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { message, history } = await req.json();
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contents = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
      { role: 'model', parts: [{ text: "Okay, I understand! I'm ready to help POSMaker store owners with their dashboard." }] },
      ...(Array.isArray(history) ? history.slice(-10) : []),
      { role: 'user', parts: [{ text: message }] },
    ];

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      },
    );

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
      || data?.error?.message
      || 'Pasensya, hindi ko na-process ang sagot. Subukan ulit.';

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
