// Shared helpers for Free/Pro plan limits and "frozen" (over-limit) items.
// Used by dashboard-*.html and cashier-*.html.

// Returns the Set of ids that are "frozen" (everything past the first `limit`
// rows, oldest-first by created_at) when !isPro. Empty set when isPro.
function computeFrozenIds(rows, limit, isPro) {
  if (isPro) return new Set();
  return new Set(
    [...rows]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(limit)
      .map(r => r.id)
  );
}

// Small inline badge for frozen rows in dashboard tables.
function frozenBadgeHtml() {
  return ' <span class="badge" style="background:#2a1a00;color:#f59e0b" title="Over your free plan limit — upgrade to unlock">&#128274; Frozen</span>';
}

// Cashier-side (anon) Pro check via SECURITY DEFINER RPC.
async function getStorePro(sb, storeId) {
  const { data, error } = await sb.rpc('get_store_pro_status', { p_store_id: storeId });
  if (error) { console.error('getStorePro error:', error); return false; }
  return !!data;
}

// Auto-generate a SKU like "COF-001" from a category name, based on the
// highest existing SKU number already used in that category.
function genAutoSku(category, items) {
  const prefix = (category || 'ITM').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'ITM';
  const re = new RegExp('^' + prefix + '-(\\d+)$');
  let max = 0;
  for (const it of items) {
    if (it.category !== category) continue;
    const m = (it.sku || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return prefix + '-' + String(max + 1).padStart(3, '0');
}

// ── Daily Opening/Closing Checklist & Recipe/SOP Notes ─────────────────────
// Used by dashboard-*.html (owner, editable) and manager.html (staff, read-only
// items + photo-required completion). Pages must set `_OPS_STORE_ID` (the
// store's uuid) before calling loadChecklist(). Optional page globals:
//   _OPS_READONLY_ITEMS  - hide "+ Add"/remove controls & edit SOP notes (manager.html)
//   _OPS_REQUIRE_PHOTO   - require a photo before an item can be checked on
//                          (manager.html must define window._onChecklistPhotoNeeded)
let _opsData = null, _opsUseLocal = false, _sopSaveTimer = null;
let _OPS_STORE_ID = null, _OPS_READONLY_ITEMS = false, _OPS_REQUIRE_PHOTO = false;

function _opsKey() { return 'pm_ops_' + (_OPS_STORE_ID || ''); }
function _todayKey() { return new Date().toLocaleDateString('en-CA'); }

function _defaultOpsData() {
  return {
    checklistItems: {
      opening: ['Turn on lights, equipment & POS','Check stock levels & display items','Wipe down counters & display areas','Count starting cash drawer','Check POS & receipt printer'],
      closing: ['Count & reconcile cash drawer','Clean equipment & surfaces','Restock for tomorrow','Take out trash & lock up']
    },
    checklistLog: {},
    checklistPhotos: {},
    checklistCaptureTokens: {},
    sopNotes: []
  };
}

// Normalizes a checklistPhotos[date][kind][idx] entry to {img, status, capturedAt, capturedBy}.
// Older entries were stored as a plain base64 data-URI string — treat those as approved.
function _photoEntry(p) {
  if (!p) return null;
  if (typeof p === 'string') return { img: p, status: 'approved' };
  return p;
}

// Fullscreen image preview. Used instead of window.open() because Chrome
// blocks navigating a new tab/window to a data: URL.
function _viewPhoto(src) {
  let overlay = document.getElementById('_photoViewOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = '_photoViewOverlay';
    overlay.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:2000;align-items:center;justify-content:center;padding:20px;cursor:zoom-out';
    overlay.innerHTML = '<img id="_photoViewImg" style="max-width:100%;max-height:100%;border-radius:8px">';
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
  }
  document.getElementById('_photoViewImg').src = src;
}

async function loadOpsData() {
  if (_opsData) return _opsData;
  if (!_OPS_STORE_ID) return null;
  const { data, error } = await _sb.from('stores').select('ops_data').eq('id', _OPS_STORE_ID).single();
  if (!error && data && data.ops_data) {
    _opsData = typeof data.ops_data === 'string' ? JSON.parse(data.ops_data) : data.ops_data;
    _opsUseLocal = false;
  } else {
    _opsUseLocal = !!error;
    const saved = localStorage.getItem(_opsKey());
    _opsData = saved ? JSON.parse(saved) : null;
  }
  if (!_opsData) _opsData = _defaultOpsData();
  if (!_opsData.checklistItems) _opsData.checklistItems = _defaultOpsData().checklistItems;
  if (!_opsData.checklistLog) _opsData.checklistLog = {};
  if (!_opsData.checklistPhotos) _opsData.checklistPhotos = {};
  if (!_opsData.checklistCaptureTokens) _opsData.checklistCaptureTokens = {};
  if (!_opsData.sopNotes) _opsData.sopNotes = [];
  if (_pruneOldChecklistPhotos()) await saveOpsData();
  return _opsData;
}

async function saveOpsData() {
  if (!_OPS_STORE_ID || !_opsData) return;
  localStorage.setItem(_opsKey(), JSON.stringify(_opsData));
  if (!_opsUseLocal) {
    const { error } = await _sb.rpc('save_ops_data', { p_store_id: _OPS_STORE_ID, p_ops_data: _opsData });
    if (error) _opsUseLocal = true;
  }
}

// Force a fresh read from Supabase (used by manager.html while polling for a
// phone-uploaded checklist photo).
async function refreshOpsData() {
  _opsData = null;
  return loadOpsData();
}

// Deletes checklistPhotos for any date older than 5 days, keeping checklistLog
// (done/not-done history) intact. Also drops expired checklist capture tokens
// (older than 2 hours). Returns true if anything was pruned.
function _pruneOldChecklistPhotos() {
  let changed = false;
  if (_opsData.checklistPhotos) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 5);
    cutoff.setHours(0, 0, 0, 0);
    for (const dateKey of Object.keys(_opsData.checklistPhotos)) {
      if (new Date(dateKey + 'T00:00:00') < cutoff) {
        delete _opsData.checklistPhotos[dateKey];
        changed = true;
      }
    }
  }
  if (_opsData.checklistCaptureTokens) {
    const now = Date.now();
    for (const token of Object.keys(_opsData.checklistCaptureTokens)) {
      const t = _opsData.checklistCaptureTokens[token];
      if (!t || now - t.createdAt > 2 * 60 * 60 * 1000) {
        delete _opsData.checklistCaptureTokens[token];
        changed = true;
      }
    }
  }
  return changed;
}

async function loadChecklist() {
  await loadOpsData();
  renderChecklist();
  renderSopNotes();
}

function renderChecklist() {
  const today = _todayKey();
  if (!_opsData.checklistLog[today]) _opsData.checklistLog[today] = { opening: [], closing: [] };
  if (!_opsData.checklistPhotos[today]) _opsData.checklistPhotos[today] = { opening: {}, closing: {} };
  const readOnly = typeof _OPS_READONLY_ITEMS !== 'undefined' && _OPS_READONLY_ITEMS;
  ['opening','closing'].forEach(kind => {
    const items  = _opsData.checklistItems[kind] || [];
    const done   = _opsData.checklistLog[today][kind] || [];
    const photos = _opsData.checklistPhotos[today][kind] || {};
    const list   = document.getElementById(kind === 'opening' ? 'ckOpenList' : 'ckCloseList');
    if (!list) return; // page has no checklist UI (e.g. checklist-capture.html)
    if (!items.length) {
      list.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">No tasks yet &#8212; add one below.</div>';
    } else {
      list.innerHTML = items.map((text, i) => {
        const entry = _photoEntry(photos[i]);
        const removeBtn = readOnly ? '' : `<button type="button" onclick="removeChecklistItem('${kind}',${i})" style="background:none;border:none;color:var(--dim);cursor:pointer;font-size:14px;padding:2px 6px">&times;</button>`;
        let proof = '', hint = '';
        if (entry) {
          const thumb = `<img src="${entry.img}" onclick="_viewPhoto('${entry.img}')" style="width:28px;height:28px;border-radius:4px;object-fit:cover;cursor:pointer;flex-shrink:0" title="View photo proof">`;
          if (entry.status === 'pending' && !readOnly) {
            proof = thumb
              + `<button type="button" onclick="approveChecklistPhoto('${kind}',${i})" class="btn btn-ghost btn-sm" style="padding:3px 8px;font-size:11px;color:#10b981;border-color:#10b98155" title="Approve">&#10003;</button>`
              + `<button type="button" onclick="declineChecklistPhoto('${kind}',${i})" class="btn btn-ghost btn-sm" style="padding:3px 8px;font-size:11px;color:#ef4444;border-color:#ef444455" title="Decline">&#10005;</button>`;
          } else if (entry.status === 'pending') {
            proof = thumb + ' <span class="badge" style="background:#2a1a00;color:#f59e0b">Pending review</span>';
          } else if (entry.status === 'approved') {
            proof = thumb + ' <span class="badge" style="background:#0d2e1f;color:#10b981">Approved</span>';
          } else if (entry.status === 'declined') {
            proof = thumb + ' <span class="badge" style="background:#2e0d0d;color:#ef4444">Declined</span>';
            if (readOnly) hint = '<div style="font-size:11px;color:#ef4444;margin-top:2px">&#9888; Na-decline ng owner ang larawang ito &#8212; i-toggle ulit ang gawain para kumuha ng bago.</div>';
          }
        }
        return `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)">
          <label class="toggle" style="flex-shrink:0"><input type="checkbox" ${done.includes(i)?'checked':''} onchange="toggleChecklistItem('${kind}',${i},this.checked,this)"><span class="slider"></span></label>
          <div style="flex:1">
            <span style="font-size:13px;${done.includes(i)?'color:var(--muted);text-decoration:line-through':''}">${text}</span>
            ${hint}
          </div>
          ${proof}
          ${removeBtn}
        </div>`;
      }).join('');
    }
    const addRow = document.getElementById(kind === 'opening' ? 'ckOpenAddRow' : 'ckCloseAddRow');
    if (addRow) addRow.style.display = readOnly ? 'none' : '';
    const statusEl = document.getElementById(kind === 'opening' ? 'ckOpenStatus' : 'ckCloseStatus');
    const pct = items.length ? Math.round((done.length / items.length) * 100) : 0;
    statusEl.textContent = items.length ? `${done.length}/${items.length} done today (${pct}%)` : '';
  });
}

function toggleChecklistItem(kind, idx, checked, checkboxEl) {
  if (checked && typeof _OPS_REQUIRE_PHOTO !== 'undefined' && _OPS_REQUIRE_PHOTO) {
    if (checkboxEl) checkboxEl.checked = false;
    if (typeof window._onChecklistPhotoNeeded === 'function') window._onChecklistPhotoNeeded(kind, idx, checkboxEl);
    return;
  }
  const today = _todayKey();
  const log = _opsData.checklistLog[today][kind];
  if (checked) {
    if (!log.includes(idx)) log.push(idx);
  } else {
    _opsData.checklistLog[today][kind] = log.filter(i => i !== idx);
    const photos = _opsData.checklistPhotos[today] && _opsData.checklistPhotos[today][kind];
    if (photos) delete photos[idx];
  }
  saveOpsData();
  renderChecklist();
}

// Called by manager.html / checklist-capture.html once a photo has been attached
// for a checklist item. New photos always start as 'pending' owner review.
function completeChecklistItemWithPhoto(kind, idx, photoB64, capturedBy) {
  const today = _todayKey();
  if (!_opsData.checklistLog[today]) _opsData.checklistLog[today] = { opening: [], closing: [] };
  if (!_opsData.checklistPhotos[today]) _opsData.checklistPhotos[today] = { opening: {}, closing: {} };
  const log = _opsData.checklistLog[today][kind];
  if (!log.includes(idx)) log.push(idx);
  _opsData.checklistPhotos[today][kind][idx] = {
    img: photoB64, status: 'pending', capturedAt: new Date().toISOString(), capturedBy: capturedBy || 'upload'
  };
  saveOpsData();
  renderChecklist();
}

// Owner approves a pending checklist photo.
function approveChecklistPhoto(kind, idx) {
  const today = _todayKey();
  const photos = _opsData.checklistPhotos[today] && _opsData.checklistPhotos[today][kind];
  const entry = photos && _photoEntry(photos[idx]);
  if (!entry) return;
  entry.status = 'approved';
  photos[idx] = entry;
  saveOpsData();
  renderChecklist();
}

// Owner declines a pending checklist photo — un-checks the item so staff can retake it.
function declineChecklistPhoto(kind, idx) {
  const today = _todayKey();
  const photos = _opsData.checklistPhotos[today] && _opsData.checklistPhotos[today][kind];
  const entry = photos && _photoEntry(photos[idx]);
  if (!entry) return;
  entry.status = 'declined';
  photos[idx] = entry;
  const log = _opsData.checklistLog[today][kind] || [];
  _opsData.checklistLog[today][kind] = log.filter(i => i !== idx);
  saveOpsData();
  renderChecklist();
}

// Returns a capture token for today's `kind` checklist, reusing a non-expired one
// if it exists (so re-opening the QR modal shows the same link/QR).
async function getOrCreateCaptureToken(kind) {
  await loadOpsData();
  const today = _todayKey();
  const tokens = _opsData.checklistCaptureTokens;
  for (const [tok, t] of Object.entries(tokens)) {
    if (t && t.kind === kind && t.date === today && Date.now() - t.createdAt < 2 * 60 * 60 * 1000) return tok;
  }
  const token = (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)));
  tokens[token] = { kind, date: today, createdAt: Date.now() };
  await saveOpsData();
  return token;
}

function addChecklistItem(kind) {
  const input = document.getElementById(kind === 'opening' ? 'ckOpenNew' : 'ckCloseNew');
  const text = input.value.trim();
  if (!text) return;
  _opsData.checklistItems[kind].push(text);
  input.value = '';
  saveOpsData();
  renderChecklist();
}

function removeChecklistItem(kind, idx) {
  const item = (_opsData.checklistItems[kind] || [])[idx] || 'this item';
  if (!confirm(`Are you sure you want to delete "${item}" from the checklist?`)) return;
  _opsData.checklistItems[kind].splice(idx, 1);
  Object.values(_opsData.checklistLog).forEach(day => {
    if (day[kind]) day[kind] = day[kind].filter(i => i !== idx).map(i => i > idx ? i - 1 : i);
  });
  Object.values(_opsData.checklistPhotos || {}).forEach(day => {
    if (!day || !day[kind]) return;
    const remapped = {};
    Object.entries(day[kind]).forEach(([k, v]) => {
      const i = parseInt(k, 10);
      if (i === idx) return;
      remapped[i > idx ? i - 1 : i] = v;
    });
    day[kind] = remapped;
  });
  saveOpsData();
  renderChecklist();
}

function renderSopNotes() {
  const el = document.getElementById('sopNotesList');
  const notes = _opsData.sopNotes || [];
  const readOnly = typeof _OPS_READONLY_ITEMS !== 'undefined' && _OPS_READONLY_ITEMS;
  const addBtn = document.getElementById('sopAddBtn');
  if (addBtn) addBtn.style.display = readOnly ? 'none' : '';
  if (!notes.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">No recipe / SOP notes yet'
      + (readOnly ? '.' : '. Click "+ New Note" to write the steps for a task (e.g. "Caramel Macchiato &#8212; 2 pumps syrup, steam milk to 65&deg;C, pour over espresso") so every staff member does it the same way.')
      + '</div>';
    return;
  }
  if (readOnly) {
    el.innerHTML = notes.map(n => `
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700;margin-bottom:6px">${(n.title||'(untitled)').replace(/</g,'&lt;')}</div>
        <div style="font-size:12px;color:var(--muted);white-space:pre-wrap">${(n.notes||'').replace(/</g,'&lt;')}</div>
      </div>`).join('');
    return;
  }
  el.innerHTML = notes.map(n => `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px">
      <div style="display:flex;gap:8px;margin-bottom:6px">
        <input value="${(n.title||'').replace(/"/g,'&quot;')}" placeholder="Title (e.g. Caramel Macchiato)" oninput="updateSopNote('${n.id}','title',this.value)" style="flex:1;padding:7px 10px;background:var(--s1);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;font-weight:700;font-family:Inter,sans-serif;outline:none">
        <button type="button" onclick="removeSopNote('${n.id}')" style="background:#e53e3e;border:none;border-radius:6px;color:#fff;cursor:pointer;padding:0 12px;font-size:13px">&times;</button>
      </div>
      <textarea oninput="updateSopNote('${n.id}','notes',this.value)" placeholder="Steps / recipe / SOP details..." style="width:100%;min-height:70px;padding:8px 10px;background:var(--s1);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;font-family:Inter,sans-serif;outline:none;resize:vertical">${n.notes||''}</textarea>
    </div>`).join('');
}

function addSopNote() {
  _opsData.sopNotes.push({ id: 'sop_' + Date.now(), title: '', notes: '' });
  saveOpsData();
  renderSopNotes();
}

function removeSopNote(id) {
  _opsData.sopNotes = _opsData.sopNotes.filter(n => n.id !== id);
  saveOpsData();
  renderSopNotes();
}

function updateSopNote(id, field, value) {
  const n = _opsData.sopNotes.find(x => x.id === id);
  if (!n) return;
  n[field] = value;
  clearTimeout(_sopSaveTimer);
  _sopSaveTimer = setTimeout(saveOpsData, 600);
}
