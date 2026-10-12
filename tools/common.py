"""共通ユーティリティ: 店舗データの読み込み・APIクライアント・出力パス"""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOPS_DIR = ROOT / "frontend" / "src" / "data" / "shops"
PUBLIC_DIR = ROOT / "frontend" / "public"
ENV_FILE = Path("/home/edamabe/agent-server-tools/.env")


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def get_key(name: str) -> str | None:
    return os.environ.get(name) or load_env().get(name)


def load_shops(only: str | None = None) -> list[dict]:
    shops = []
    for p in sorted(SHOPS_DIR.glob("*.json")):
        data = json.loads(p.read_text(encoding="utf-8"))
        if only and data["id"] != only:
            continue
        shops.append(data)
    return shops
