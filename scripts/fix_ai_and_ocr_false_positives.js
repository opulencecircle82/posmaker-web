// fix_ai_and_ocr_false_positives.js
// Two more unprotected detection paths found — these were never touched by the
// earlier scanner-calibration fixes and are likely the remaining source of
// "adds a product even when nothing is in view":
//
// 1. MOBILENET AI LOOP (startAiLoop): ran every 800ms with a loose 0.45 cosine-
//    similarity threshold, only needed 2 consecutive frames, and had ZERO
//    blank-frame protection (no edge-detail check at all). Tightened to match
//    the same calibration philosophy as the other loops (0.62 threshold, 0.08
//    margin, 3 frames, blank-frame gate via edgeAvg).
//
// 2. TEXT/OCR LOOPS (_startNativeTextLoop + _startTesseractLoop): added an
//    item to the cart on a SINGLE text match with ZERO consecutive-frame
//    confirmation at all — any stray OCR read of background text/labels that
//    happened to fuzzy-match a product name would instantly add it. Added a
//    3-consecutive-match confidence counter (_txtConf), same pattern as the
//    other loops.
// Run: node scripts/fix_ai_and_ocr_false_positives.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f))
  .sort();

// ── FIX A: declare _txtConf alongside the other text-loop globals ─────────
const A_OLD = `let _scanCooldown = {}, _textDetector = null, _txtLoopId = null, _scanSession = 0;`;
const A_NEW = `let _scanCooldown = {}, _textDetector = null, _txtLoopId = null, _scanSession = 0, _txtConf = {};`;

// ── FIX B: reset _txtConf when the scanner closes (alongside _visConf/_mnConf) ──
const B_OLD = `  _visConf = {}; _mnConf = {};`;
const B_NEW = `  _visConf = {}; _mnConf = {}; _txtConf = {};`;

// ── FIX C: native TextDetector loop — require 3 consecutive matches ───────
const C_OLD =
`        if(blocks.length){
          const allText=blocks.map(b=>b.rawValue).join(' ');
          const m=matchTextToProduct(allText);
          if(m && !isOnCooldown(m.id)){
            setCooldown(m.id); addItem(m.id);
            flashMatch(m.name,'&#128221; ML Kit');
          }
        }`;
const C_NEW =
`        if(blocks.length){
          const allText=blocks.map(b=>b.rawValue).join(' ');
          const m=matchTextToProduct(allText);
          if(m){
            _txtConf[m.id]=(_txtConf[m.id]||0)+1;
            if(_txtConf[m.id]>=3 && !isOnCooldown(m.id)){
              _txtConf={};
              setCooldown(m.id); addItem(m.id);
              flashMatch(m.name,'&#128221; ML Kit');
            }
          } else { _txtConf={}; }
        } else { _txtConf={}; }`;

// ── FIX D: Tesseract OCR loop — require 3 consecutive matches ─────────────
const D_OLD =
`        if(text.trim()){
          const m=matchTextToProduct(text);
          if(m&&!isOnCooldown(m.id)){
            setCooldown(m.id); addItem(m.id);
            flashMatch(m.name,'&#128269; OCR');
          }
        }`;
const D_NEW =
`        if(text.trim()){
          const m=matchTextToProduct(text);
          if(m){
            _txtConf[m.id]=(_txtConf[m.id]||0)+1;
            if(_txtConf[m.id]>=3 && !isOnCooldown(m.id)){
              _txtConf={};
              setCooldown(m.id); addItem(m.id);
              flashMatch(m.name,'&#128269; OCR');
            }
          } else { _txtConf={}; }
        } else { _txtConf={}; }`;

// ── FIX E: MobileNet AI loop — blank-frame gate + tightened threshold ─────
const E_OLD =
`        // Color histogram from center crop for hybrid scoring
        const frameColor=_featuresFromCanvas(cv2,224,224).colorHist;

        let best=null, second=null, bestSim=0, secondSim=0;
        for(const pe of _prodEmbeds){
          const mnSim=Math.max(...pe.vecs.map(v=>_cosSim(fv,v)));
          // Color L1 distance → similarity (0-1)
          const colorDist=pe.colorHist?pe.colorHist.reduce((s,v,i)=>s+Math.abs(v-(frameColor[i]||0)),0):1;
          const colorSim=Math.max(0,1-colorDist/2);
          // Hybrid: 65% neural + 35% color
          const sim=0.65*mnSim+0.35*colorSim;
          if(sim>bestSim){secondSim=bestSim;second=best;bestSim=sim;best=pe;}
          else if(sim>secondSim){secondSim=sim;second=pe;}
        }
        const prod=best?prods.find(p=>p.id===best.id):null;
        const pct=(bestSim*100).toFixed(0);
        const gap=bestSim-secondSim;
        const confident=bestSim>0.45&&gap>0.05;
        // Show: product name + % + gap indicator
        if(prod){
          const gapTxt=second?' (+'+Math.round(gap*100)+'%)':'';
          camStat('&#129302; '+(confident?'<strong>'+prod.name+'</strong>':prod.name)+' '+pct+'%'+gapTxt);
        }
        if(best&&confident){
          _miss[best.id]=0;
          _mnConf[best.id]=(_mnConf[best.id]||0)+1;
          if(_mnConf[best.id]>=2&&!isOnCooldown(best.id)){
            _mnConf={}; Object.keys(_miss).forEach(k=>_miss[k]=0);
            setCooldown(best.id); addItem(best.id); flashMatch(prod.name,'&#129302; AI');
          }
        } else if(best){
          _miss[best.id]=(_miss[best.id]||0)+1;
          if(_miss[best.id]>=3) _mnConf[best.id]=0;
        } else { _mnConf={}; camStat('&#129302; AI scanning…'); }`;
const E_NEW =
`        // Color histogram + edge detail from center crop for hybrid scoring + blank-frame gate
        const frameFeats=_featuresFromCanvas(cv2,224,224);
        const frameColor=frameFeats.colorHist;
        const blankFrame=frameFeats.edgeAvg<MIN_EDGE_DETAIL;

        let best=null, second=null, bestSim=0, secondSim=0;
        if(!blankFrame){
          for(const pe of _prodEmbeds){
            const mnSim=Math.max(...pe.vecs.map(v=>_cosSim(fv,v)));
            // Color L1 distance → similarity (0-1)
            const colorDist=pe.colorHist?pe.colorHist.reduce((s,v,i)=>s+Math.abs(v-(frameColor[i]||0)),0):1;
            const colorSim=Math.max(0,1-colorDist/2);
            // Hybrid: 65% neural + 35% color
            const sim=0.65*mnSim+0.35*colorSim;
            if(sim>bestSim){secondSim=bestSim;second=best;bestSim=sim;best=pe;}
            else if(sim>secondSim){secondSim=sim;second=pe;}
          }
        }
        const prod=best?prods.find(p=>p.id===best.id):null;
        const pct=(bestSim*100).toFixed(0);
        const gap=bestSim-secondSim;
        const confident=!blankFrame&&bestSim>0.62&&gap>=0.08;
        // Show: product name + % + gap indicator
        if(blankFrame){
          _mnConf={}; camStat('&#129302; AI: point at a product');
        } else if(prod){
          const gapTxt=second?' (+'+Math.round(gap*100)+'%)':'';
          camStat('&#129302; '+(confident?'<strong>'+prod.name+'</strong>':prod.name)+' '+pct+'%'+gapTxt);
        }
        if(best&&confident){
          _miss[best.id]=0;
          _mnConf[best.id]=(_mnConf[best.id]||0)+1;
          if(_mnConf[best.id]>=3&&!isOnCooldown(best.id)){
            _mnConf={}; Object.keys(_miss).forEach(k=>_miss[k]=0);
            setCooldown(best.id); addItem(best.id); flashMatch(prod.name,'&#129302; AI');
          }
        } else if(best){
          _miss[best.id]=(_miss[best.id]||0)+1;
          if(_miss[best.id]>=3) _mnConf[best.id]=0;
        } else { _mnConf={}; camStat('&#129302; AI scanning…'); }`;

const PATCHES = [
  ['A-decl',    A_OLD, A_NEW],
  ['B-reset',   B_OLD, B_NEW],
  ['C-native',  C_OLD, C_NEW],
  ['D-tess',    D_OLD, D_NEW],
  ['E-ai-loop', E_OLD, E_NEW],
];

let patched = 0, skipped = 0;
const errors = {};

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('_txtConf')) { console.log(`—  ${file}: already patched`); skipped++; continue; }

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
