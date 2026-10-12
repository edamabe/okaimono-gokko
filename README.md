# おかいものごっこ 🛒

「こどものへや」向けの、かわいいどうぶつたちと遊ぶお買い物ごっこアプリ。
商品をドラッグ＆ドロップでカートに入れ、レジでピッとスキャンして、お支払いまで体験できます。

## 🎮 遊びの流れ

1. **タイトル**: 「はじめる！」をタッチ →「おかいものを しよう！」
2. **売り場（3コーナー・ページ切替）**
   - 🥕 やさい・くだもの（りすさん）16品
   - 🐟 おさかな・おにく（くまさん）14品
   - 🧊 れいぞう・れいとう（ペンギンさん）15品
   - 商品をつまむと **名前を読み上げ**、カートに落とすと入る。カートの中身をカートの外へドラッグすると戻せる
3. **おかいけい**（ねこさん）
   - カートの中身がベルトコンベアで流れてくる → バーコードリーダーへドラッグで **ピッ！＋「〇〇えん！」**（ランダム）→ レジ袋へ
   - 全部スキャンすると「おしはらいは なんに しますか？」
   - 💴 げんきん → **チン！** / 💳 カード → **ピッ** / 📱 でんしけっさい → **ピロロン♪** をレジへドラッグ
   - 「ありがとうございました！」→「おかいもの できたね！」🎉

## 🛠️ 構成

```
okaimono-gokko/
├── frontend/                       React 19 + TypeScript + Vite（:3060）
│   ├── src/data/shops/*.json       ★ 店舗定義（コーナー・商品・音声文言・画像プロンプト）
│   ├── src/screens/                Title / Corner（全コーナー共通）/ Checkout
│   ├── src/lib/audio.ts            Web Audio 音声エンジン + 効果音合成
│   ├── src/lib/drag.tsx            Pointer Events 製ドラッグ＆ドロップ（iPad対応）
│   └── public/{images,audio}/<shop>/  生成アセット
├── tools/                          アセット生成（uv）
│   ├── generate_images.py          Gemini Image API（gemini-3.1-flash-image）
│   └── generate_audio.py           Gemini TTS（Gateway gemini-3.8-flash-tts → Vertex フォールバック, Aoede）
└── deploy/okaimono-gokko.service   systemd ユーザーサービス
```

- 音声はすべて Gemini TTS。効果音（ピッ・チン・ピロロン）は Web Audio API で合成
- 画像は白背景で生成 → 外周フラッドフィルで透過 → WebP

## 🏪 お店を増やす（コンビニ・アイス屋さんなど）

1. `frontend/src/data/shops/convenience.json` のように JSON を追加（`supermarket.json` をコピーして編集）
2. アセット生成
   ```bash
   cd tools
   uv run python generate_images.py --shop convenience
   uv run python generate_audio.py  --shop convenience
   ```
3. `npm run build` → `http://<host>:3060/?shop=convenience` で遊べる（複数店舗があるとタイトルに店舗選択が出る）

陳列の見た目を変えたい場合（アイスのショーケース等）は、`types.ts` の `CornerLayout` に種類を追加し、
`CornerScreen.tsx` の `ShelfLayout` に描画を足して、JSON のコーナーに `"layout": "<種類>"` を指定します。

## 🔁 個別再生成

```bash
cd tools
uv run python generate_images.py --only apple cart     # 指定IDだけ作り直し
uv run python generate_audio.py  --only start          # 指定音声だけ作り直し
uv run python generate_images.py --force               # 全部作り直し
```

## 🚀 起動

```bash
cd frontend && npm install && npm run build
ln -sf ~/okaimono-gokko/deploy/okaimono-gokko.service ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now okaimono-gokko
```
