// rollout_calculator_widget.js
// The floating calculator widget (drag-anywhere, keyboard/numpad input,
// Settings on/off toggle) was only ever added to dashboard-bigasan.html.
// Rolls the exact same, already-tested implementation out to the other 23
// dashboards: a Settings checkbox, the load/save wiring for it, and the
// widget's HTML/CSS/script block itself.
// Run: node scripts/rollout_calculator_widget.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^dashboard-.*\.html$/.test(f) && f !== 'dashboard_backup.html' && f !== 'dashboard-bigasan.html')
  .sort();

const P1_OLD = `        <div class="field"><label>Receipt Footer</label><textarea id="sFooter" rows="2"></textarea></div>
        <button class="btn btn-accent" onclick="saveSettings()">Save Settings</button>`;
const P1_NEW = `        <div class="field"><label>Receipt Footer</label><textarea id="sFooter" rows="2"></textarea></div>
        <div class="field" style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="sShowCalc" style="width:auto">
          <label for="sShowCalc" style="margin:0">Show floating calculator widget</label>
        </div>
        <button class="btn btn-accent" onclick="saveSettings()">Save Settings</button>`;

const P2_OLD = `  document.getElementById('sFooter').value   = store.receipt_footer || '';`;
const P2_NEW = `  document.getElementById('sFooter').value   = store.receipt_footer || '';
  document.getElementById('sShowCalc').checked = store.show_calculator !== false;
  applyCalcVisibility(store.show_calculator !== false);`;

const P3_OLD = `    receipt_footer: document.getElementById('sFooter').value.trim(),
  };`;
const P3_NEW = `    receipt_footer: document.getElementById('sFooter').value.trim(),
    show_calculator: document.getElementById('sShowCalc').checked,
  };`;

const P4_OLD = `  document.getElementById('sbStore').textContent = payload.name;
  showToast('Settings saved.');
}`;
const P4_NEW = `  document.getElementById('sbStore').textContent = payload.name;
  applyCalcVisibility(payload.show_calculator);
  showToast('Settings saved.');
}`;

const WIDGET_BLOCK = `
<!-- ── FLOATING CALCULATOR WIDGET ── -->
<div id="calcIcon" title="Calculator" style="position:fixed;bottom:90px;right:20px;width:48px;height:48px;border-radius:50%;background:var(--s1);border:1px solid var(--border);display:none;align-items:center;justify-content:center;cursor:grab;box-shadow:0 4px 16px rgba(0,0,0,.4);z-index:600;font-size:22px;touch-action:none;user-select:none">&#129518;</div>
<div id="calcPanel" style="display:none;position:fixed;bottom:148px;right:20px;width:220px;background:var(--s1);border:1px solid var(--border);border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.5);z-index:600;padding:12px">
  <div id="calcDragHandle" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:move;touch-action:none;user-select:none">
    <strong style="font-size:12px;color:var(--muted)">Calculator</strong>
    <span style="cursor:pointer;color:var(--muted);font-size:14px" onclick="toggleCalc()">&#10005;</span>
  </div>
  <div id="calcDisplay" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:right;font-size:20px;font-weight:700;color:var(--text);margin-bottom:8px;min-height:30px;overflow-x:auto;white-space:nowrap">0</div>
  <div style="display:flex;flex-direction:column;gap:6px">
    <div style="display:flex;gap:6px">
      <button type="button" class="calc-btn" onclick="calcClear()" style="flex:1;background:#3a1a1a;color:#ef4444">C</button>
      <button type="button" class="calc-btn" onclick="calcInput('/')" style="flex:1">&#247;</button>
      <button type="button" class="calc-btn" onclick="calcInput('*')" style="flex:1">&#215;</button>
      <button type="button" class="calc-btn" onclick="calcInput('-')" style="flex:1">&#8722;</button>
    </div>
    <div style="display:flex;gap:6px">
      <button type="button" class="calc-btn" onclick="calcInput('7')" style="flex:1">7</button>
      <button type="button" class="calc-btn" onclick="calcInput('8')" style="flex:1">8</button>
      <button type="button" class="calc-btn" onclick="calcInput('9')" style="flex:1">9</button>
      <button type="button" class="calc-btn" onclick="calcInput('+')" style="flex:1">+</button>
    </div>
    <div style="display:flex;gap:6px">
      <button type="button" class="calc-btn" onclick="calcInput('4')" style="flex:1">4</button>
      <button type="button" class="calc-btn" onclick="calcInput('5')" style="flex:1">5</button>
      <button type="button" class="calc-btn" onclick="calcInput('6')" style="flex:1">6</button>
      <button type="button" class="calc-btn" onclick="calcEquals()" style="flex:1;background:var(--accent);color:#fff">=</button>
    </div>
    <div style="display:flex;gap:6px">
      <button type="button" class="calc-btn" onclick="calcInput('1')" style="flex:1">1</button>
      <button type="button" class="calc-btn" onclick="calcInput('2')" style="flex:1">2</button>
      <button type="button" class="calc-btn" onclick="calcInput('3')" style="flex:1">3</button>
      <button type="button" class="calc-btn" onclick="calcInput('0')" style="flex:1">0</button>
    </div>
    <div style="display:flex;gap:6px">
      <button type="button" class="calc-btn" onclick="calcInput('.')" style="flex:1">.</button>
    </div>
  </div>
</div>
<style>
.calc-btn{padding:10px 0;background:var(--s2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;font-weight:600;cursor:pointer}
.calc-btn:active{opacity:.7}
</style>
<script>
let _calcExpr = '';

function calcUpdateDisplay() {
  document.getElementById('calcDisplay').textContent = _calcExpr || '0';
}
function calcInput(val) {
  _calcExpr += val;
  calcUpdateDisplay();
}
function calcClear() {
  _calcExpr = '';
  calcUpdateDisplay();
}
function calcEquals() {
  if (!_calcExpr) return;
  try {
    const safe = _calcExpr.replace(/[^0-9+\\-*/.]/g, '');
    const result = Function('"use strict";return (' + safe + ')')();
    _calcExpr = Number.isFinite(result) ? String(result) : 'Error';
  } catch (_) {
    _calcExpr = 'Error';
  }
  calcUpdateDisplay();
}

function applyCalcVisibility(show) {
  const icon = document.getElementById('calcIcon');
  if (show === false) {
    icon.style.display = 'none';
    document.getElementById('calcPanel').style.display = 'none';
  } else {
    icon.style.display = 'flex';
  }
}

function toggleCalc() {
  const panel = document.getElementById('calcPanel');
  const opening = panel.style.display !== 'block';
  panel.style.display = opening ? 'block' : 'none';
  if (opening) repositionCalcPanel();
}

// Keeps the open panel anchored near wherever the icon currently sits,
// flipping above/below the icon so it never runs off the top/bottom edge.
function repositionCalcPanel() {
  const icon = document.getElementById('calcIcon');
  const panel = document.getElementById('calcPanel');
  const ir = icon.getBoundingClientRect();
  const pw = panel.offsetWidth || 220;
  const ph = panel.offsetHeight || 320;
  let top = ir.top - ph - 10;
  if (top < 10) top = Math.min(ir.bottom + 10, window.innerHeight - ph - 10);
  panel.style.top    = Math.max(10, top) + 'px';
  panel.style.left   = Math.max(10, Math.min(window.innerWidth - pw - 10, ir.left)) + 'px';
  panel.style.bottom = 'auto';
  panel.style.right  = 'auto';
}

// Drag-anywhere on screen: the small icon when closed, the panel's title
// bar when open. A press+release with no real movement still counts as a
// click (so tapping the icon still opens/closes it).
function makeDraggable(handle, target, onClick) {
  let dragging = false, moved = false, offX = 0, offY = 0, startX = 0, startY = 0;
  function start(e) {
    const pt = e.touches ? e.touches[0] : e;
    const rect = target.getBoundingClientRect();
    dragging = true; moved = false;
    startX = pt.clientX; startY = pt.clientY;
    offX = pt.clientX - rect.left; offY = pt.clientY - rect.top;
    target.style.top = rect.top + 'px';
    target.style.left = rect.left + 'px';
    target.style.bottom = 'auto'; target.style.right = 'auto';
    e.preventDefault();
  }
  function move(e) {
    if (!dragging) return;
    const pt = e.touches ? e.touches[0] : e;
    if (Math.abs(pt.clientX - startX) > 4 || Math.abs(pt.clientY - startY) > 4) moved = true;
    let x = pt.clientX - offX, y = pt.clientY - offY;
    x = Math.max(0, Math.min(window.innerWidth  - target.offsetWidth,  x));
    y = Math.max(0, Math.min(window.innerHeight - target.offsetHeight, y));
    target.style.left = x + 'px';
    target.style.top  = y + 'px';
    e.preventDefault();
  }
  function end() {
    if (dragging && !moved && onClick) onClick();
    dragging = false;
  }
  handle.addEventListener('mousedown', start);
  handle.addEventListener('touchstart', start, { passive: false });
  document.addEventListener('mousemove', move);
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('mouseup', end);
  document.addEventListener('touchend', end);
}
makeDraggable(document.getElementById('calcIcon'), document.getElementById('calcIcon'), toggleCalc);
makeDraggable(document.getElementById('calcDragHandle'), document.getElementById('calcPanel'), null);

window.addEventListener('resize', () => {
  if (document.getElementById('calcPanel').style.display === 'block') repositionCalcPanel();
});

// Keyboard + numpad input — only while the panel is open and no other field
// on the page is focused, so it never hijacks typing elsewhere.
document.addEventListener('keydown', function (e) {
  const panel = document.getElementById('calcPanel');
  if (!panel || panel.style.display !== 'block') return;
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.key >= '0' && e.key <= '9') { calcInput(e.key); e.preventDefault(); }
  else if (['+', '-', '*', '/', '.'].includes(e.key)) { calcInput(e.key); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === '=') { calcEquals(); e.preventDefault(); }
  else if (e.key === 'Backspace') { _calcExpr = _calcExpr.slice(0, -1); calcUpdateDisplay(); e.preventDefault(); }
  else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') { calcClear(); e.preventDefault(); }
});
</script>
</body>
</html>`;

const PATCHES = [
  ['P1-settings-checkbox', P1_OLD, P1_NEW],
  ['P2-load',              P2_OLD, P2_NEW],
  ['P3-save-payload',      P3_OLD, P3_NEW],
  ['P4-save-apply',        P4_OLD, P4_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('id="calcIcon"')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label); continue; }
    c = c.replace(oldStr, newStr);
  }
  if (!c.trim().endsWith('</html>')) fileErrs.push('P5-body-end-not-found');
  else c = c.replace(/\s*<\/body>\s*<\/html>\s*$/, WIDGET_BLOCK + '\n');

  if (fileErrs.length) { errors[file] = fileErrs; console.log(`⚠  ${file}: missing ${fileErrs.join(', ')}`); continue; }

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
