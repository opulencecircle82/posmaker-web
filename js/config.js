// ── Auto-update: detect new deploy and prompt refresh ─────────────────────────
(function(){
  const KEY = '__pmver' + location.pathname;
  async function _chk() {
    try {
      const r = await fetch(location.pathname + '?_v=' + Date.now(), {method:'HEAD', cache:'no-store'});
      const tag = r.headers.get('etag') || r.headers.get('last-modified') || '';
      if (!tag) return;
      const prev = localStorage.getItem(KEY);
      localStorage.setItem(KEY, tag);
      if (prev && prev !== tag && !document.getElementById('_pmBanner')) {
        // Fetch changelog
        let changes = [];
        try {
          const vr = await fetch('version.json?_v=' + Date.now(), {cache:'no-store'});
          const vj = await vr.json();
          changes = vj.changes || [];
        } catch(_) {}

        const b = document.createElement('div');
        b.id = '_pmBanner';
        b.style.cssText = 'position:fixed;bottom:72px;left:50%;transform:translateX(-50%);background:#111120;color:#f0f0f8;border:1px solid #00c8ff;border-radius:12px;font-size:12px;z-index:9999;box-shadow:0 4px 24px rgba(0,0,0,.7);min-width:260px;max-width:360px;overflow:hidden';

        const list = changes.length
          ? `<ul style="margin:6px 0 10px 0;padding-left:16px;color:#ccc;font-weight:400;line-height:1.7">${changes.map(c=>`<li>${c}</li>`).join('')}</ul>`
          : '';

        b.innerHTML = `
          <div style="background:#00c8ff;color:#09090f;padding:9px 16px;font-weight:800;display:flex;align-items:center;justify-content:space-between;gap:12px">
            <span>&#128260; New Update Available!</span>
            <button onclick="document.getElementById('_pmBanner').remove()" style="background:none;border:none;cursor:pointer;font-size:16px;color:#09090f;line-height:1;padding:0">&#215;</button>
          </div>
          <div style="padding:10px 16px">
            ${list ? `<div style="font-size:11px;font-weight:700;color:#888;letter-spacing:.5px;margin-bottom:2px">WHAT'S NEW</div>${list}` : ''}
            <button onclick="location.reload(true)" style="width:100%;padding:8px;background:#00c8ff;color:#09090f;border:none;border-radius:7px;font-weight:800;font-size:13px;cursor:pointer">Tap to Refresh</button>
          </div>`;
        document.body.appendChild(b);
      }
    } catch(_) {}
  }
  setTimeout(_chk, 8000);
  setInterval(_chk, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) _chk(); });
})();

// ── Supabase Configuration ────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://djvwlwnnlldoppomhbap.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdndsd25ubGxkb3Bwb21oYmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzgzNTEsImV4cCI6MjA5NTQxNDM1MX0.7uJUS1mLQGHUstuGvKMHzPj5aNluha0-Hf2wg8K1UA0';

// ── Vision Server (Python ORB image matching) ─────────────────────────────
// Set to your Render URL after deployment, e.g. 'https://posmaker-vision.onrender.com'
const VISION_SERVER_URL = '';

// ── PayPal Configuration ──────────────────────────────────────────────────────
// Go to developer.paypal.com → Apps & Credentials → Create App → copy Client ID
// Use Sandbox Client ID for testing, Live Client ID for production
const PAYPAL_CLIENT_ID = 'AarzFDBcc5UA1eGhFfure_7nycIE9ZWwo-lHqiqiSGATv5lCz7wO3y03BbqeJEqDR3L2XbwwENFIcXKQ';
const PAYPAL_CURRENCY  = 'PHP';