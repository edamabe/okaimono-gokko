#!/usr/bin/env python3
"""Gemini Image API でイラストを一括生成する。

店舗定義 JSON (frontend/src/data/shops/*.json) を走査し、
商品・キャラクター・背景・小道具の画像を frontend/public/images/<shop>/ に WebP で保存する。
既存ファイルはスキップ（--force で再生成, --only <id> で個別再生成）。

    uv run python generate_images.py [--shop supermarket] [--only apple] [--force]
"""

from __future__ import annotations

import argparse
import io
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from google import genai
from google.genai import types
from PIL import Image, ImageDraw

from common import PUBLIC_DIR, get_key, load_shops

IMAGE_MODEL = "gemini-3.1-flash-image"

STYLE_OBJECT = (
    "Cute kawaii flat illustration for toddlers, thick soft rounded dark-brown outlines, "
    "bright cheerful pastel colors, simple shapes, gentle shading, single object centered with margin, "
    "isolated on a pure solid white background (#FFFFFF), no shadow on background, "
    "absolutely no text, no letters, no numbers, no logos."
)
STYLE_CHARACTER = (
    "Cute kawaii animal character for a toddler picture book, thick soft rounded outlines, "
    "bright pastel colors, big sparkling eyes, rosy cheeks, centered, "
    "isolated on a pure solid white background (#FFFFFF), absolutely no text."
)
STYLE_BACKGROUND = (
    "Cute kawaii children's picture book background illustration, soft pastel colors, "
    "simple rounded shapes, slightly blurred and low-contrast so foreground items stand out, "
    "no characters, no people, absolutely no text, no letters, no signs with words."
)
STYLE_SCENE = (
    "Cute kawaii children's picture book illustration, soft pastel colors, thick soft rounded outlines, "
    "adorable animal characters, warm and happy mood, leave the bottom third calm for a title panel, "
    "absolutely no text, no letters, no signs with words."
)


def build_jobs(shop: dict) -> list[dict]:
    """店舗データから画像生成ジョブ一覧を組み立てる（拡張時もここは変更不要）"""
    jobs: list[dict] = []

    def add(kind: str, item_id: str, prompt: str, aspect: str = "1:1", subdir: str = ""):
        style = {"object": STYLE_OBJECT, "character": STYLE_CHARACTER,
                 "background": STYLE_BACKGROUND, "scene": STYLE_SCENE}[kind]
        jobs.append({
            "id": item_id,
            "prompt": f"{prompt}. {style}",
            "aspect": aspect,
            "transparent": kind in ("object", "character"),
            "path": Path(shop["id"]) / subdir / f"{item_id}.webp",
        })

    t = shop["title"]["image"]
    add("scene", t["id"], t["prompt"], t.get("aspect", "16:9"))
    add("character", shop["shopper"]["id"], shop["shopper"]["prompt"], subdir="chars")
    add("object", shop["cart"]["id"], shop["cart"]["prompt"], subdir="props")

    for c in shop["corners"]:
        add("background", c["background"]["id"], c["background"]["prompt"], "16:9", "bg")
        add("character", c["staff"]["id"], c["staff"]["prompt"], subdir="chars")
        for p in c["products"]:
            add("object", p["id"], p["prompt"], subdir="products")

    co = shop["checkout"]
    add("background", co["background"]["id"], co["background"]["prompt"], "16:9", "bg")
    add("character", co["staff"]["id"], co["staff"]["prompt"], subdir="chars")
    for pr in co["props"]:
        add("object", pr["id"], pr["prompt"], subdir="props")
    for pay in co["payments"]:
        add("object", f"pay_{pay['id']}", pay["prompt"], subdir="props")
    return jobs


def remove_white_background(img: Image.Image, tol: int = 28) -> Image.Image:
    """外周から白をフラッドフィルして透過にする（被写体内部の白は保持）"""
    img = img.convert("RGBA")
    w, h = img.size
    marker = (255, 0, 255, 0)
    seeds = [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)]
    seeds += [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]
    px = img.load()
    for s in seeds:
        r, g, b, a = px[s]
        if a != 0 and r > 255 - tol * 2 and g > 255 - tol * 2 and b > 255 - tol * 2:
            ImageDraw.floodfill(img, s, marker, thresh=tol)
    # マーカー色を完全透過に
    pixels = getattr(img, "get_flattened_data", img.getdata)()
    data = [(0, 0, 0, 0) if p == marker else p for p in pixels]
    img.putdata(data)
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    # 余白付き正方形キャンバスへ
    side = int(max(img.size) * 1.06)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
    return canvas


def generate_one(client: genai.Client, job: dict, retries: int = 3) -> bytes:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            resp = client.models.generate_content(
                model=IMAGE_MODEL,
                contents=job["prompt"],
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    image_config=types.ImageConfig(aspect_ratio=job["aspect"]),
                ),
            )
            for part in resp.candidates[0].content.parts:
                if part.inline_data and part.inline_data.data:
                    return part.inline_data.data
            raise ValueError("画像データなし")
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"{job['id']}: {last}")


def process(client: genai.Client, job: dict, out_root: Path) -> str:
    raw = generate_one(client, job)
    img = Image.open(io.BytesIO(raw))
    out = out_root / job["path"]
    out.parent.mkdir(parents=True, exist_ok=True)
    if job["transparent"]:
        img = remove_white_background(img)
        img.thumbnail((512, 512), Image.LANCZOS)
        img.save(out, "WEBP", quality=88, method=6)
    else:
        img = img.convert("RGB")
        img.thumbnail((1600, 1600), Image.LANCZOS)
        img.save(out, "WEBP", quality=82, method=6)
    return str(job["path"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--shop")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    key = get_key("GEMINI_API_KEY_PAID") or get_key("GEMINI_API_KEY")
    if not key:
        sys.exit("GEMINI_API_KEY が見つかりません")
    client = genai.Client(api_key=key)
    out_root = PUBLIC_DIR / "images"

    jobs = []
    for shop in load_shops(args.shop):
        for j in build_jobs(shop):
            if args.only and j["id"] not in args.only:
                continue
            if (out_root / j["path"]).exists() and not args.force and not args.only:
                continue
            jobs.append(j)

    print(f"🎨 生成対象: {len(jobs)} 枚 (model={IMAGE_MODEL})")
    failed = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(process, client, j, out_root): j for j in jobs}
        for f in as_completed(futs):
            try:
                print(f"  ✅ {f.result()}")
            except Exception as e:  # noqa: BLE001
                failed.append(futs[f]["id"])
                print(f"  ❌ {e}")
    if failed:
        print(f"⚠️ 失敗: {failed}  →  --only {' '.join(failed)} で再実行してください")
        sys.exit(1)


if __name__ == "__main__":
    main()
