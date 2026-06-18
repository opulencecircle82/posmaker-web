// fix_scanner_blank_frame_and_square.js
// Two further fixes for the "scans anything, even with nothing in view" complaint:
//
// 1. BLANK-FRAME REJECTION: the hash algorithm always produces *some* hash even
//    for a flat/featureless frame (hand, counter, blank wall) — there was no
//    check for "is there actually enough visual detail to be a real product".
//    Now we measure raw edge magnitude (edgeAvg) and skip matching entirely
//    when a frame has too little structure to be a real object.
//
// 2. SQUARE SCANNER ("rlCamToggle" persistent live-scan view) had its OWN,
//    much more dangerous matching loop: threshold of 0.72 (vs the 0.15 we set
//    for the main scanner) and a confidence counter that was re-created empty
//    on every single frame, so it added items to the cart on a SINGLE loose
//    frame match with zero consecutive-frame confirmation. This is almost
//    certainly the main source of false-positive "ghost" additions. Rewritten
//    to use the same calibration as the main scanner (0.15 threshold, 0.07
//    margin, 3 consecutive confirms, blank-frame rejection).
//
// Run: node scripts/fix_scanner_blank_frame_and_square.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f))
  .sort();

// ── FIX A: expose edgeAvg (raw, pre-binarized Sobel magnitude) from features ──
const A_OLD = `  return { aHash, edgeHash, colorHist };`;
const A_NEW = `  return { aHash, edgeHash, colorHist, edgeAvg: eAvg };`;

// ── FIX B: blank-frame gate in the main scanner loop ──────────────────────
const B_OLD =
`        let best=null, bestScore=9999, secScore=9999;
        for(const scale of [0.4, 0.65, 0.85]){
          const ff=_extractFrameFeatures(video, scale);
          for(const ph of _prodHashes){
            const s=Math.min(...ph.features.map(f=>_featureScore(ff,f)));
            if(s<bestScore){secScore=bestScore;bestScore=s;best=ph;}
            else if(s<secScore) secScore=s;
          }
        }`;
const B_NEW =
`        let best=null, bestScore=9999, secScore=9999;
        for(const scale of [0.4, 0.65, 0.85]){
          const ff=_extractFrameFeatures(video, scale);
          if(ff.edgeAvg<MIN_EDGE_DETAIL) continue; // blank/featureless frame — no real object in view
          for(const ph of _prodHashes){
            const s=Math.min(...ph.features.map(f=>_featureScore(ff,f)));
            if(s<bestScore){secScore=bestScore;bestScore=s;best=ph;}
            else if(s<secScore) secScore=s;
          }
        }`;

// ── FIX C: add MIN_EDGE_DETAIL constant near the matching comment header ──
const C_OLD =
`// ── Visual product matching: shape (Sobel edges) + color (HSV) + structure ─
// Features per photo: aHash (structure) + edgeHash (shape) + colorHist (HSV hue+value)
// Frame tested at 3 scales (close / mid / far) for distance-independent matching.`;
const C_NEW =
`// ── Visual product matching: shape (Sobel edges) + color (HSV) + structure ─
// Features per photo: aHash (structure) + edgeHash (shape) + colorHist (HSV hue+value)
// Frame tested at 3 scales (close / mid / far) for distance-independent matching.
// MIN_EDGE_DETAIL: raw Sobel magnitude average below this means the frame is
// blank/featureless (hand, counter, wall) — skip matching, there's no real object in view.
const MIN_EDGE_DETAIL = 12;`;

// ── FIX D: add _sqVisConf to the square-scanner globals ───────────────────
const D_OLD = `let _sqStream = null, _sqOpen = false, _sqBcId = null, _sqSess = 0, _sqNativeBd = null;`;
const D_NEW = `let _sqStream = null, _sqOpen = false, _sqBcId = null, _sqSess = 0, _sqNativeBd = null, _sqVisConf = {};`;

// ── FIX E: rewrite the square scanner loop with proper calibration ────────
const E_OLD =
`function _startSqVisualLoop(video, sess) {
  if (!_prodHashes.length) return;
  const stat = document.getElementById('sqStatus');
  const isMobile = /android|mobile|tablet/i.test(navigator.userAgent);
  function loop() {
    if (!_sqOpen || _sqSess !== sess) { _sqVisLoopId = null; return; }
    try {
      let best = null, bestScore = Infinity, secScore = Infinity;
      for (const scale of [0.4, 0.65, 0.85]) {
        const ff = _extractFrameFeatures(video, scale);
        for (const ph of _prodHashes) {
          const s = Math.min(...ph.features.map(f => _featureScore(ff, f)));
          if (s < bestScore) { secScore = bestScore; bestScore = s; best = ph; }
          else if (s < secScore) { secScore = s; }
        }
      }
      const _visConf = {};  // reuse local conf map per loop
      if (best && bestScore < 0.72 && (secScore - bestScore) > 0.08) {
        if (!isOnCooldown(best.id)) {
          setCooldown(best.id); addItem(best.id);
          const p = prods.find(x => x.id == best.id);
          if (p) showSqHit(p);
          if (stat) {
            stat.textContent = '🖼 ' + (p?.name || best.id);
            setTimeout(() => { sqStatusUpdate(); }, 1500);
          }
        }
      }
    } catch(_) {}
    _sqVisLoopId = setTimeout(loop, isMobile ? 1800 : 1000);
  }
  setTimeout(loop, 800);
}`;
const E_NEW =
`function _startSqVisualLoop(video, sess) {
  if (!_prodHashes.length) return;
  const stat = document.getElementById('sqStatus');
  const isMobile = /android|mobile|tablet/i.test(navigator.userAgent);
  _sqVisConf = {};
  function loop() {
    if (!_sqOpen || _sqSess !== sess) { _sqVisLoopId = null; return; }
    try {
      let best = null, bestScore = Infinity, secScore = Infinity;
      for (const scale of [0.4, 0.65, 0.85]) {
        const ff = _extractFrameFeatures(video, scale);
        if (ff.edgeAvg < MIN_EDGE_DETAIL) continue; // blank/featureless frame — no real object in view
        for (const ph of _prodHashes) {
          const s = Math.min(...ph.features.map(f => _featureScore(ff, f)));
          if (s < bestScore) { secScore = bestScore; bestScore = s; best = ph; }
          else if (s < secScore) { secScore = s; }
        }
      }
      if (best && bestScore <= 0.15 && (secScore - bestScore) >= 0.07) {
        _sqVisConf[best.id] = (_sqVisConf[best.id] || 0) + 1;
        if (_sqVisConf[best.id] >= 3 && !isOnCooldown(best.id)) {
          _sqVisConf = {};
          setCooldown(best.id); addItem(best.id);
          const p = prods.find(x => x.id == best.id);
          if (p) showSqHit(p);
          if (stat) {
            stat.textContent = '🖼 ' + (p?.name || best.id);
            setTimeout(() => { sqStatusUpdate(); }, 1500);
          }
        }
      } else {
        _sqVisConf = {};
      }
    } catch(_) {}
    _sqVisLoopId = setTimeout(loop, isMobile ? 1800 : 1000);
  }
  setTimeout(loop, 800);
}`;

const PATCHES = [
  ['A-edgeAvg',      A_OLD, A_NEW],
  ['B-blank-gate',   B_OLD, B_NEW],
  ['C-constant',     C_OLD, C_NEW],
  ['D-sqVisConf',    D_OLD, D_NEW],
  ['E-sq-loop',      E_OLD, E_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('MIN_EDGE_DETAIL')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

  const fileErrs = [];
  for (const [label, oldStr, newStr] of PATCHES) {
    if (!c.includes(oldStr)) { fileErrs.push(label); continue; }
    c = c.replace(oldStr, newStr);
  }
  if (fileErrs.length) errors[file] = fileErrs;

  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(fileErrs.length ? `⚠  ${file}: missing ${fileErrs.join(', ')}` : `✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped.`);
if (Object.keys(errors).length) {
  console.log('\nFiles with anchor errors:');
  for (const [f, e] of Object.entries(errors)) console.log(`  ${f}: ${e.join(', ')}`);
}
