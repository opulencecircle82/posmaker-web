"""
POSMaker Vision Server
Matches camera frames against product images using OpenCV ORB descriptors.

Run:
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8765

Tablet must be on the same Wi-Fi network as this machine.
Set vision server URL in POS: localStorage.setItem('pm_vision_url', 'http://<this-pc-ip>:8765')
"""

import base64
import json
import os
import time

import cv2
import numpy as np
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL  = os.getenv("SUPABASE_URL",  "https://djvwlwnnlldoppomhbap.supabase.co")
SUPABASE_ANON = os.getenv("SUPABASE_ANON", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdndsd25ubGxkb3Bwb21oYmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzgzNTEsImV4cCI6MjA5NTQxNDM1MX0.7uJUS1mLQGHUstuGvKMHzPj5aNluha0-Hf2wg8K1UA0")
CACHE_TTL     = 300   # seconds before re-fetching product list
MIN_MATCHES   = 14    # good ORB matches required to confirm detection

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="POSMaker Vision Server")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── OpenCV setup ──────────────────────────────────────────────────────────────
orb = cv2.ORB_create(nfeatures=1000)
bf  = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

# ── In-memory product index ───────────────────────────────────────────────────
# { store_id: { "ts": float, "data": [ {"id", "name", "price", "descs": [ndarray]} ] } }
_cache: dict = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _decode_img(b64_str: str) -> np.ndarray | None:
    """Decode a base64 image (with or without data: prefix) to grayscale ndarray."""
    try:
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        raw = base64.b64decode(b64_str + "==")  # lenient padding
        arr = np.frombuffer(raw, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
        return img
    except Exception:
        return None


def _extract_desc(img: np.ndarray | None) -> np.ndarray | None:
    """Return ORB descriptors for an image, or None if too few keypoints."""
    if img is None:
        return None
    # Resize so feature extraction is consistent regardless of upload size
    h, w = img.shape[:2]
    scale = min(1.0, 640 / max(h, w, 1))
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    _, desc = orb.detectAndCompute(img, None)
    return desc if desc is not None and len(desc) >= 8 else None


def _good_matches(q_desc: np.ndarray, ref_desc: np.ndarray) -> int:
    """Count Lowe-ratio-filtered matches between two descriptor sets."""
    if q_desc is None or ref_desc is None:
        return 0
    if len(q_desc) < 2 or len(ref_desc) < 2:
        return 0
    try:
        raw = bf.knnMatch(q_desc, ref_desc, k=2)
        return sum(1 for m in raw if len(m) == 2 and m[0].distance < 0.75 * m[1].distance)
    except Exception:
        return 0


def _fetch_store_products(store_id: str) -> list:
    """Download products with images from Supabase and build ORB descriptor index."""
    hdrs = {
        "apikey": SUPABASE_ANON,
        "Authorization": f"Bearer {SUPABASE_ANON}",
    }
    url = (
        f"{SUPABASE_URL}/rest/v1/products"
        f"?store_id=eq.{store_id}"
        f"&available=eq.true"
        f"&image_b64=not.is.null"
        f"&select=id,name,price,image_b64"
    )
    try:
        resp = requests.get(url, headers=hdrs, timeout=15)
        rows = resp.json()
        if not isinstance(rows, list):
            print(f"Supabase error: {rows}")
            return []
    except Exception as e:
        print(f"Fetch error: {e}")
        return []

    data = []
    for row in rows:
        raw = row.get("image_b64") or ""
        if not raw:
            continue

        # image_b64 may be a JSON array of base64 strings (multi-image products)
        try:
            parsed = json.loads(raw)
            srcs = parsed if isinstance(parsed, list) else [raw]
        except Exception:
            srcs = [raw]

        descs = [d for s in srcs if s for d in [_extract_desc(_decode_img(s))] if d is not None]
        if descs:
            data.append({
                "id":    row["id"],
                "name":  row["name"],
                "price": float(row.get("price") or 0),
                "descs": descs,
            })

    print(f"[index] store={store_id}  products_with_images={len(data)}")
    return data


def _get_index(store_id: str) -> list:
    """Return cached product index, refreshing if stale."""
    now = time.time()
    cached = _cache.get(store_id)
    if cached and now - cached["ts"] < CACHE_TTL:
        return cached["data"]
    data = _fetch_store_products(store_id)
    _cache[store_id] = {"ts": now, "data": data}
    return data


# ── Request models ─────────────────────────────────────────────────────────────

class MatchReq(BaseModel):
    store_id:  str
    image_b64: str          # base64 camera frame (JPEG preferred, ~320×240 is enough)
    threshold: int = MIN_MATCHES


class WarmupReq(BaseModel):
    store_id: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"ok": True, "cached_stores": list(_cache.keys())}


@app.post("/warmup")
def warmup(req: WarmupReq):
    """Pre-load product index so first /match is fast."""
    data = _get_index(req.store_id)
    return {"ok": True, "indexed": len(data)}


@app.delete("/cache/{store_id}")
def clear_cache(store_id: str):
    """Force re-index on next /match (call after uploading new product images)."""
    _cache.pop(store_id, None)
    return {"ok": True}


@app.post("/match")
def match(req: MatchReq):
    """
    Match a camera frame against indexed products.

    Returns:
        {"id": "<product_id>", "name": "...", "price": 120.0, "score": 22}  on match
        {"id": null, "score": 4, "reason": "..."}                            on miss
    """
    # Decode query frame
    q_img = _decode_img(req.image_b64)
    if q_img is None:
        return {"id": None, "reason": "bad_image"}

    q_desc = _extract_desc(q_img)
    if q_desc is None:
        return {"id": None, "reason": "no_features"}

    # Load / refresh product index
    products = _get_index(req.store_id)
    if not products:
        return {"id": None, "reason": "no_indexed_products"}

    # Find best-matching product
    best_id    = None
    best_name  = ""
    best_price = 0.0
    best_score = 0

    for prod in products:
        score = max(_good_matches(q_desc, d) for d in prod["descs"])
        if score > best_score:
            best_score = score
            best_id    = prod["id"]
            best_name  = prod["name"]
            best_price = prod["price"]

    if best_score >= req.threshold:
        return {"id": best_id, "name": best_name, "price": best_price, "score": best_score}

    return {"id": None, "score": best_score, "reason": "below_threshold"}
