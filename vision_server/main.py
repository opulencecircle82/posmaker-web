"""
POSMaker Vision Server — ORB + Color Histogram product matching
Each camera frame is compared against stored product images using:
  1. ORB feature descriptors  (shape / text on packaging)
  2. HSV color histogram       (box/label color)
Combined score picks the best product match.

Deploy on Render (free):
  Root Dir   : vision_server
  Build      : pip install -r requirements.txt
  Start      : uvicorn main:app --host 0.0.0.0 --port $PORT
"""

import base64, json, os, time
import cv2
import numpy as np
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Config ─────────────────────────────────────────────────────────────────────
SUPABASE_URL  = os.getenv("SUPABASE_URL",  "https://djvwlwnnlldoppomhbap.supabase.co")
SUPABASE_ANON = os.getenv("SUPABASE_ANON", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdndsd25ubGxkb3Bwb21oYmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzgzNTEsImV4cCI6MjA5NTQxNDM1MX0.7uJUS1mLQGHUstuGvKMHzPj5aNluha0-Hf2wg8K1UA0")

CACHE_TTL    = 300   # seconds before re-fetching from Supabase
ORB_FEATURES = 800
ORB_WEIGHT   = 0.60  # how much ORB contributes to final score
COLOR_WEIGHT = 0.40  # how much color histogram contributes

# ── FastAPI ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="POSMaker Vision")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

orb = cv2.ORB_create(nfeatures=ORB_FEATURES)
bf  = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

# { store_id: {"ts": float, "products": [...]} }
_cache: dict = {}


# ── Image utilities ─────────────────────────────────────────────────────────────

def _b64_to_bgr(b64: str):
    """Decode base64 image → BGR ndarray (resized to max 512px wide)."""
    try:
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        raw = base64.b64decode(b64 + "==")
        arr = np.frombuffer(raw, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        h, w = img.shape[:2]
        scale = min(1.0, 512 / max(h, w, 1))
        if scale < 1.0:
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        return img
    except Exception:
        return None


def _orb_desc(bgr):
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    _, desc = orb.detectAndCompute(gray, None)
    return desc if desc is not None and len(desc) >= 5 else None


def _color_hist(bgr):
    """32-bin HSV histogram (H + S channels) — compact color fingerprint."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h_hist = cv2.calcHist([hsv], [0], None, [32], [0, 180]).flatten()
    s_hist = cv2.calcHist([hsv], [1], None, [32], [0, 256]).flatten()
    hist = np.concatenate([h_hist, s_hist])
    total = hist.sum()
    return hist / total if total > 0 else hist


def _orb_score(q_desc, ref_desc) -> float:
    """Normalised ORB good-match score [0..1]."""
    if q_desc is None or ref_desc is None:
        return 0.0
    if len(q_desc) < 2 or len(ref_desc) < 2:
        return 0.0
    try:
        matches = bf.knnMatch(q_desc, ref_desc, k=2)
        good = sum(1 for m in matches if len(m) == 2 and m[0].distance < 0.75 * m[1].distance)
        return min(good / 30.0, 1.0)  # 30+ good matches → score 1.0
    except Exception:
        return 0.0


def _color_score(q_hist, ref_hist) -> float:
    """Histogram correlation [0..1] — 1 = identical color distribution."""
    try:
        v = float(cv2.compareHist(
            q_hist.astype(np.float32),
            ref_hist.astype(np.float32),
            cv2.HISTCMP_CORREL,
        ))
        return max(v, 0.0)  # correlation can be negative; clamp to 0
    except Exception:
        return 0.0


# ── Product index ───────────────────────────────────────────────────────────────

def _build_entry(row: dict):
    """Extract ORB descriptors + color histogram for one product (all images)."""
    raw = row.get("image_b64") or ""
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        srcs = parsed if isinstance(parsed, list) else [raw]
    except Exception:
        srcs = [raw]

    images = []
    for src in srcs:
        if not src:
            continue
        bgr = _b64_to_bgr(src)
        if bgr is None:
            continue
        images.append({"desc": _orb_desc(bgr), "hist": _color_hist(bgr)})

    if not images:
        return None

    return {
        "id":     row["id"],
        "name":   row["name"],
        "price":  float(row.get("price") or 0),
        "images": images,
    }


def _load_store(store_id: str) -> list:
    now = time.time()
    cached = _cache.get(store_id)
    if cached and now - cached["ts"] < CACHE_TTL:
        return cached["products"]

    hdrs = {"apikey": SUPABASE_ANON, "Authorization": f"Bearer {SUPABASE_ANON}"}
    url = (
        f"{SUPABASE_URL}/rest/v1/products"
        f"?store_id=eq.{store_id}&available=eq.true"
        f"&image_b64=not.is.null&select=id,name,price,image_b64"
    )
    try:
        rows = requests.get(url, headers=hdrs, timeout=15).json()
        if not isinstance(rows, list):
            print("Supabase error:", rows)
            return []
    except Exception as e:
        print("Fetch error:", e)
        return []

    products = [e for row in rows for e in [_build_entry(row)] if e]
    _cache[store_id] = {"ts": now, "products": products}
    print(f"[index] store={store_id}  indexed={len(products)}")
    return products


# ── Request models ───────────────────────────────────────────────────────────────

class MatchReq(BaseModel):
    store_id:  str
    image_b64: str
    min_score: float = 0.25   # 0..1 combined threshold


class WarmupReq(BaseModel):
    store_id: str


# ── Endpoints ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"ok": True, "cached_stores": list(_cache.keys())}


@app.post("/warmup")
def warmup(req: WarmupReq):
    products = _load_store(req.store_id)
    return {"ok": True, "indexed": len(products)}


@app.delete("/cache/{store_id}")
def clear_cache(store_id: str):
    _cache.pop(store_id, None)
    return {"ok": True}


@app.post("/match")
def match(req: MatchReq):
    """
    Match a camera frame against all product images.
    Score = ORB_WEIGHT * orb_score + COLOR_WEIGHT * color_score
    Returns best match if score >= min_score, else {"id": null}.
    """
    bgr = _b64_to_bgr(req.image_b64)
    if bgr is None:
        return {"id": None, "reason": "bad_image"}

    q_desc = _orb_desc(bgr)
    q_hist = _color_hist(bgr)

    products = _load_store(req.store_id)
    if not products:
        return {"id": None, "reason": "no_indexed_products"}

    best_id    = None
    best_name  = ""
    best_price = 0.0
    best_score = 0.0

    for prod in products:
        for img in prod["images"]:
            score = ORB_WEIGHT * _orb_score(q_desc, img["desc"]) + \
                    COLOR_WEIGHT * _color_score(q_hist, img["hist"])
            if score > best_score:
                best_score = score
                best_id    = prod["id"]
                best_name  = prod["name"]
                best_price = prod["price"]

    if best_score >= req.min_score:
        return {"id": best_id, "name": best_name, "price": best_price, "score": round(best_score, 3)}

    return {"id": None, "score": round(best_score, 3), "reason": "below_threshold"}
