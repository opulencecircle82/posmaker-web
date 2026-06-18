// add_multiobject_detection.js
// Adds COCO-SSD (in-browser object detector) as a progressive enhancement to
// the visual scanner: when loaded, it finds bounding boxes for distinct
// physical objects in the frame, crops each one, and runs the EXISTING
// hash-based matcher (aHash/edgeHash/colorHist) against each crop — so
// multiple different products held up at once can each be identified
// individually, instead of the old single "best guess for the whole frame".
// While the model is still loading (or on devices where it fails to load),
// the loop transparently falls back to the existing whole-frame multi-scale
// matching — no behavior regression, no blocking.
// Run: node scripts/add_multiobject_detection.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir)
  .filter(f => /^cashier.*\.html$/.test(f))
  .sort();

const OLD =
`function startVisualLoop(video) {
  if(!_prodHashes.length) return;
  const sess=_scanSession;
  function loop() {
    if(!scannerOpen||_scanSession!==sess){ _visLoopId=null; return; }
    if(video.readyState>=2&&video.videoWidth>0){
      try{
        let best=null, bestScore=9999, secScore=9999;
        for(const scale of [0.4, 0.65, 0.85]){
          const ff=_extractFrameFeatures(video, scale);
          if(ff.edgeAvg<MIN_EDGE_DETAIL) continue; // blank/featureless frame — no real object in view
          for(const ph of _prodHashes){
            const s=Math.min(...ph.features.map(f=>_featureScore(ff,f)));
            if(s<bestScore){secScore=bestScore;bestScore=s;best=ph;}
            else if(s<secScore) secScore=s;
          }
        }
        const pct=Math.round((1-bestScore)*100);
        if(best&&bestScore<=0.15&&(secScore-bestScore)>=0.07){
          _visConf[best.id]=(_visConf[best.id]||0)+1;
          const prod=prods.find(p=>p.id===best.id);
          if(prod) camStat('&#128247; <strong>'+prod.name+'</strong> '+pct+'% — hold still…');
          if(_visConf[best.id]>=3&&!isOnCooldown(best.id)){
            _visConf={};
            setCooldown(best.id); addItem(best.id);
            if(prod) flashMatch(prod.name,'&#128247; visual');
          }
        } else {
          _visConf={};
          if(best&&bestScore<=0.38&&scannerOpen){
            const prod=prods.find(p=>p.id===best.id);
            if(prod) camStat('&#128247; '+prod.name+'? '+pct+'%');
          }
        }
      }catch(_){}
    }
    _visLoopId=setTimeout(loop,1500);
  }
  setTimeout(loop,1200);
}`;

const NEW =
`// ── Multi-object detector (COCO-SSD) — progressive enhancement ───────────
// Generic pretrained object detector: finds bounding boxes for distinct
// physical objects (not specific to our products). We crop each box and run
// it through the existing per-product hash matcher to identify WHICH product
// it is. Falls back to whole-frame matching until this finishes loading.
let _cocoModel = null, _cocoLoading = false;
async function _loadCocoModel(){
  if(_cocoModel || _cocoLoading) return;
  _cocoLoading = true;
  try{
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
    _cocoModel = await cocoSsd.load({base:'lite_mobilenet_v2'});
  }catch(_){ /* stays null — loop keeps using whole-frame fallback */ }
  _cocoLoading = false;
}
function _cropVideoRegion(video,x,y,w,h,outSize){
  const c=document.createElement('canvas'); c.width=outSize; c.height=outSize;
  c.getContext('2d').drawImage(video,Math.max(0,x),Math.max(0,y),w,h,0,0,outSize,outSize);
  return c;
}
function _matchFeaturesAgainstProducts(ff){
  let best=null, bestScore=9999, secScore=9999;
  for(const ph of _prodHashes){
    const s=Math.min(...ph.features.map(f=>_featureScore(ff,f)));
    if(s<bestScore){secScore=bestScore;bestScore=s;best=ph;}
    else if(s<secScore) secScore=s;
  }
  return {best,bestScore,secScore};
}

function startVisualLoop(video) {
  if(!_prodHashes.length) return;
  const sess=_scanSession;
  _loadCocoModel(); // fire-and-forget; loop upgrades automatically once ready
  function evalMatch(best,bestScore,secScore,tag){
    const pct=Math.round((1-bestScore)*100);
    if(best&&bestScore<=0.15&&(secScore-bestScore)>=0.07){
      _visConf[best.id]=(_visConf[best.id]||0)+1;
      const prod=prods.find(p=>p.id===best.id);
      if(prod) camStat('&#128247; <strong>'+prod.name+'</strong> '+pct+'%'+tag+' — hold still…');
      if(_visConf[best.id]>=3&&!isOnCooldown(best.id)){
        _visConf[best.id]=0;
        setCooldown(best.id); addItem(best.id);
        if(prod) flashMatch(prod.name,'&#128247; visual');
      }
      return true;
    }
    if(best&&bestScore<=0.38&&scannerOpen){
      const prod=prods.find(p=>p.id===best.id);
      if(prod) camStat('&#128247; '+prod.name+'? '+pct+'%'+tag);
    }
    return false;
  }
  async function loop() {
    if(!scannerOpen||_scanSession!==sess){ _visLoopId=null; return; }
    if(video.readyState>=2&&video.videoWidth>0){
      try{
        let handledByDetector=false;
        if(_cocoModel){
          const preds=await _cocoModel.detect(video).catch(()=>[]);
          const boxes=preds.filter(p=>p.score>0.4&&p.bbox[2]>40&&p.bbox[3]>40).slice(0,4);
          if(boxes.length){
            handledByDetector=true;
            const seen={};
            for(const box of boxes){
              const [bx,by,bw,bh]=box.bbox;
              const crop=_cropVideoRegion(video,bx,by,bw,bh,200);
              const ff=_featuresFromCanvas(crop,200,200);
              if(ff.edgeAvg<MIN_EDGE_DETAIL) continue;
              const {best,bestScore,secScore}=_matchFeaturesAgainstProducts(ff);
              if(best&&!seen[best.id]){ seen[best.id]=true; evalMatch(best,bestScore,secScore,' &#183; '+boxes.length+' in view'); }
            }
          } else {
            _visConf={}; // detector active and sees zero objects — trust it, definitely blank
            handledByDetector=true;
          }
        }
        if(!handledByDetector){
          let best=null, bestScore=9999, secScore=9999;
          for(const scale of [0.4, 0.65, 0.85]){
            const ff=_extractFrameFeatures(video, scale);
            if(ff.edgeAvg<MIN_EDGE_DETAIL) continue;
            const r=_matchFeaturesAgainstProducts(ff);
            if(r.bestScore<bestScore){bestScore=r.bestScore;secScore=r.secScore;best=r.best;}
          }
          if(!evalMatch(best,bestScore,secScore,'')) _visConf={};
        }
      }catch(_){}
    }
    _visLoopId=setTimeout(loop,1500);
  }
  setTimeout(loop,1200);
}`;

let patched = 0, skipped = 0;
const errors = [];

for (const file of files) {
  const fp = path.join(dir, file);
  const raw = fs.readFileSync(fp, 'utf-8');
  const hasCRLF = raw.includes('\r\n');
  let c = raw.replace(/\r\n/g, '\n');

  if (c.includes('_loadCocoModel')) { console.log(`—  ${file}: already patched`); skipped++; continue; }
  if (!c.includes(OLD)) { console.log(`⚠  ${file}: anchor not found (expected for barbershop — no scanner code)`); errors.push(file); continue; }

  c = c.replace(OLD, NEW);
  const out = hasCRLF ? c.replace(/\n/g, '\r\n') : c;
  fs.writeFileSync(fp, out, 'utf-8');
  console.log(`✓  ${file}`);
  patched++;
}

console.log(`\nDone: ${patched} written, ${skipped} skipped, ${errors.length} no-anchor.`);
