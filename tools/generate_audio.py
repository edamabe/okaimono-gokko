#!/usr/bin/env python3
"""Gemini TTS で音声を一括生成する。

1. Unified AI Gateway (localhost:8000/api/voice/synthesize, gemini-3.8-flash-tts / Aoede)
2. 失敗時は Vertex AI (gemini-3.1-flash-tts-preview) へフォールバック

出力: frontend/public/audio/<shop>/<id>.wav
    - 商品名: product_<id>.wav
    - 値段:   price_<円>.wav
    - その他: <voice id>.wav

    uv run python generate_audio.py [--shop supermarket] [--only start] [--force]
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.request
import wave
from pathlib import Path

from common import PUBLIC_DIR, get_key, load_shops

GATEWAY_URL = os.environ.get("AI_GATEWAY_URL", "http://localhost:8000/api/voice/synthesize")
VOICE = "Aoede"
GATEWAY_MODEL = "gemini-3.8-flash-tts"
VERTEX_MODEL = "gemini-3.1-flash-tts-preview"

DIGITS = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"]
HUNDREDS = {1: "ひゃく", 2: "にひゃく", 3: "さんびゃく", 4: "よんひゃく", 5: "ごひゃく",
            6: "ろっぴゃく", 7: "ななひゃく", 8: "はっぴゃく", 9: "きゅうひゃく"}


def yen_reading(n: int) -> str:
    """100〜999円の読み（例: 380 → さんびゃく はちじゅう えん）"""
    h, rest = divmod(n, 100)
    t, o = divmod(rest, 10)
    s = HUNDREDS.get(h, "")
    if t:
        s += ("じゅう" if t == 1 else DIGITS[t] + "じゅう")
    if o:
        s += DIGITS[o]
    return f"{s}えん！"


def build_jobs(shop: dict) -> list[tuple[str, str]]:
    jobs: list[tuple[str, str]] = []
    jobs.append((shop["title"]["voice"]["id"], shop["title"]["voice"]["text"]))
    for c in shop["corners"]:
        jobs.append((c["voice"]["id"], c["voice"]["text"]))
        for t in c["staff"].get("talks", []):
            jobs.append((t["id"], t["text"]))
        for p in c["products"]:
            jobs.append((f"product_{p['id']}", p.get("reading", p["name"]) + "！"))
    co = shop["checkout"]
    for v in co["voices"].values():
        jobs.append((v["id"], v["text"]))
    for t in co["staff"].get("talks", []):
        jobs.append((t["id"], t["text"]))
    for pay in co["payments"]:
        jobs.append((f"pay_{pay['id']}", pay["name"] + "！"))
    for price in co["prices"]:
        jobs.append((f"price_{price}", yen_reading(price)))
    for r in shop.get("reactions", []):
        jobs.append((r["id"], r["text"]))
    return jobs


def save_pcm(pcm: bytes, out: Path) -> None:
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(pcm)


def via_gateway(text: str, out: Path) -> bool:
    req = urllib.request.Request(
        GATEWAY_URL,
        data=json.dumps({"text": text, "voice": VOICE, "model": GATEWAY_MODEL}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            data = json.loads(resp.read().decode())
            b64 = data.get("audio_base64")
            if b64:
                out.write_bytes(base64.b64decode(b64))
                return True
    except Exception as e:  # noqa: BLE001
        print(f"    (gateway失敗: {e})")
    return False


_vertex = None


def via_vertex(text: str, out: Path) -> bool:
    global _vertex
    from google import genai
    from google.genai import types

    if _vertex is None:
        project = get_key("VERTEX_AI_PROJECT") or "sakuratools"
        os.environ["GOOGLE_CLOUD_QUOTA_PROJECT"] = project
        _vertex = genai.Client(vertexai=True, project=project,
                               location=get_key("VERTEX_AI_LOCATION") or "us-central1")
    try:
        r = _vertex.models.generate_content(
            model=VERTEX_MODEL,
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE))),
            ),
        )
        for part in r.candidates[0].content.parts:
            if part.inline_data and part.inline_data.data:
                save_pcm(part.inline_data.data, out)
                return True
    except Exception as e:  # noqa: BLE001
        print(f"    (vertex失敗: {e})")
    return False


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--shop")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    failed = []
    for shop in load_shops(args.shop):
        out_dir = PUBLIC_DIR / "audio" / shop["id"]
        out_dir.mkdir(parents=True, exist_ok=True)
        for vid, text in build_jobs(shop):
            if args.only and vid not in args.only:
                continue
            out = out_dir / f"{vid}.wav"
            if out.exists() and out.stat().st_size > 1000 and not args.force and not args.only:
                continue
            ok = via_gateway(text, out) or via_vertex(text, out)
            print(f"  {'✅' if ok else '❌'} {vid}: 「{text}」")
            if not ok:
                failed.append(vid)
            time.sleep(0.2)
    if failed:
        print(f"⚠️ 失敗: {failed}")
        sys.exit(1)


if __name__ == "__main__":
    main()
