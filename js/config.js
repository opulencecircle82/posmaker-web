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
        const b = document.createElement('div');
        b.id = '_pmBanner';
        b.style.cssText = 'position:fixed;bottom:72px;left:50%;transform:translateX(-50%);background:#00c8ff;color:#09090f;padding:10px 22px;border-radius:8px;font-weight:700;font-size:12px;z-index:9999;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.55);white-space:nowrap';
        b.textContent = '\u{1F504} New update — tap to refresh';
        b.onclick = () => location.reload(true);
        document.body.appendChild(b);
      }
    } catch(_) {}
  }
  setTimeout(_chk, 8000);                      // 8s after load
  setInterval(_chk, 10 * 60 * 1000);           // every 10 min
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