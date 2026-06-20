// rollout_satisfaction_survey.js
// Rolls the 5-day "Are you satisfied?" check-in survey (built + validated in
// dashboard-bigasan.html) out to the other 23 dashboard-<slug>.html files
// plus the generic dashboard.html. Three independent patches: the modal
// HTML (after the existing upgradeModal), the JS functions (after
// closeModal), and the trigger call (right after appWrap is shown).
// Run: node scripts/rollout_satisfaction_survey.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard.*\.html$/.test(f) && f !== 'dashboard_backup.html' && f !== 'dashboard-bigasan.html')
  .sort();

const P1_OLD = `    <div style="display:flex;gap:8px;flex-direction:column">
      <button class="btn btn-accent btn-full" onclick="window.open('pricing.html','_blank')">&#128640; Upgrade to Pro — View Plans</button>
      <button class="btn btn-ghost btn-full" onclick="closeModal('upgradeModal')">Close</button>
    </div>
  </div>
</div>
`;
const P1_NEW = `    <div style="display:flex;gap:8px;flex-direction:column">
      <button class="btn btn-accent btn-full" onclick="window.open('pricing.html','_blank')">&#128640; Upgrade to Pro — View Plans</button>
      <button class="btn btn-ghost btn-full" onclick="closeModal('upgradeModal')">Close</button>
    </div>
  </div>
</div>

<!-- SATISFACTION SURVEY (shown once, ~5 days after signup, only if the store has actually been used) -->
<div class="modal" id="surveyModal">
  <div class="mbox" style="width:min(420px,100%)">
    <div style="font-size:40px;text-align:center;margin-bottom:8px">&#11088;</div>
    <h3 style="text-align:center;margin-bottom:6px">Are you satisfied with the system?</h3>
    <p style="color:var(--muted);font-size:13px;text-align:center;margin-bottom:18px">You've been using POSMaker for a few days now — we'd love to hear what you think.</p>
    <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:8px;text-align:center">Rate us from 1 (Poor) to 10 (Excellent)</label>
    <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;margin-bottom:16px" id="surveyRatingRow"></div>
    <div class="field">
      <label>Comments <span style="color:var(--dim);font-weight:400">(optional)</span></label>
      <textarea id="surveyComment" rows="3" placeholder="What do you like? What can we improve?"></textarea>
    </div>
    <div style="display:flex;gap:8px;flex-direction:column;margin-top:8px">
      <button class="btn btn-accent btn-full" onclick="submitSatisfactionSurvey()">Submit Feedback</button>
      <a href="contact.html" id="surveyContactLink" target="_blank" style="text-align:center;font-size:12px;color:var(--muted);text-decoration:underline">Need help instead? Contact Support</a>
      <button class="btn btn-ghost btn-full" onclick="dismissSatisfactionSurvey()">Maybe Later</button>
    </div>
  </div>
</div>
`;

const P2_OLD = `function closeModal(id) { document.getElementById(id).classList.remove('show'); }`;
const P2_NEW = `function closeModal(id) { document.getElementById(id).classList.remove('show'); }

// ── Satisfaction Survey — shown once, ~5 days after signup, only if the
// store actually shows signs of use (a login or an order in that window).
let _surveyRating = 0;
function renderSurveyRatingRow() {
  const row = document.getElementById('surveyRatingRow');
  row.innerHTML = Array.from({ length: 10 }, (_, i) => i + 1).map(n =>
    \`<button type="button" onclick="setSurveyRating(\${n})" id="surveyBtn_\${n}" style="width:30px;height:30px;border-radius:6px;border:1.5px solid var(--border);background:var(--s2);color:var(--text);font-weight:700;font-size:13px;cursor:pointer">\${n}</button>\`
  ).join('');
}
function setSurveyRating(n) {
  _surveyRating = n;
  for (let i = 1; i <= 10; i++) {
    const b = document.getElementById('surveyBtn_' + i);
    if (!b) continue;
    b.style.background    = i <= n ? 'var(--accent)' : 'var(--s2)';
    b.style.color         = i <= n ? '#fff' : 'var(--text)';
    b.style.borderColor   = i <= n ? 'var(--accent)' : 'var(--border)';
  }
}
async function maybeShowSatisfactionSurvey() {
  if (!STORE || STORE.survey_prompted_at || !STORE.created_at) return;
  const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
  if (new Date(STORE.created_at).getTime() > fiveDaysAgo) return;
  try {
    const sinceIso = new Date(fiveDaysAgo).toISOString();
    const [{ count: loginCount }, { count: orderCount }] = await Promise.all([
      _sb.from('activity_logs').select('id', { count: 'exact', head: true }).eq('store_id', STORE.id).eq('action', 'LOGIN').gte('created_at', sinceIso),
      _sb.from('orders').select('id', { count: 'exact', head: true }).eq('store_id', STORE.id).gte('timestamp', sinceIso)
    ]);
    if ((loginCount || 0) + (orderCount || 0) === 0) return;
  } catch (_) { return; }
  const email = document.getElementById('sbUser')?.textContent || '';
  document.getElementById('surveyContactLink').href = 'contact.html?store=' + encodeURIComponent(STORE.name || '') + '&email=' + encodeURIComponent(email);
  _surveyRating = 0;
  renderSurveyRatingRow();
  document.getElementById('surveyComment').value = '';
  document.getElementById('surveyModal').classList.add('show');
}
async function _markSurveyPrompted() {
  const now = new Date().toISOString();
  STORE.survey_prompted_at = now;
  await _sb.from('stores').update({ survey_prompted_at: now }).eq('id', STORE.id);
}
async function submitSatisfactionSurvey() {
  if (!_surveyRating) { showToast('Please select a rating from 1 to 10.', true); return; }
  const comment = document.getElementById('surveyComment').value.trim();
  const email = document.getElementById('sbUser')?.textContent || '';
  await _sb.from('satisfaction_surveys').insert({
    store_id: STORE.id, store_name: STORE.name, owner_email: email, rating: _surveyRating, comment
  });
  await _markSurveyPrompted();
  document.getElementById('surveyModal').classList.remove('show');
  showToast('Thanks for your feedback!');
}
async function dismissSatisfactionSurvey() {
  await _markSurveyPrompted();
  document.getElementById('surveyModal').classList.remove('show');
}`;

const P3_OLD = `  appWrap.style.display = 'flex';

  // Set cashier link`;
const P3_NEW = `  appWrap.style.display = 'flex';
  maybeShowSatisfactionSurvey().catch(() => {});

  // Set cashier link`;

const PATCHES = [
  ['P1-modal-html', P1_OLD, P1_NEW],
  ['P2-js-functions', P2_OLD, P2_NEW],
  ['P3-trigger-call', P3_OLD, P3_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('maybeShowSatisfactionSurvey')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label); continue; }
    c = c.replace(oldStr, newStr);
  }
  if (fileErrs.length) { errors[file] = fileErrs; console.log(`⚠  ${file}: missing ${fileErrs.join(', ')} — not modified`); continue; }

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (Object.keys(errors).length) {
  console.log('\nFiles with anchor errors (not modified):');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
