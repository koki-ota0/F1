# PITWALL 🏁 — F1 Fan Hub

「F1のすべてを、ピットウォールから。」
長年ファンも新規ファンも、チームファンもドライバーファンも、誰もが使えて遊べる **F1オールインワン・ファンサイト** です。

> 設計ドキュメント: [`docs/DESIGN.md`](docs/DESIGN.md)（20エージェント・ワークショップの成果）

---

## 主な機能

| カテゴリ | 内容 |
|---|---|
| 📡 ライブ | ライブタイミング（ポジション/ギャップ/天気）、セッション予定、カウントダウン |
| 🏆 情報 | 順位表、カレンダー（24戦+サーキット情報）、ドライバー/チーム一覧＆詳細、歴代チャンピオン、オールタイム記録 |
| 📰 ニュース | ライブRSSフィード（オフライン時は注目記事） |
| 🎯 ゲーム | 結果**予測**（P1-P3+FL、採点、リーダーボード）、**レースシミュレーター**（単戦アニメ+シーズン一括）、**クイズ**（5カテゴリ、XP/ストリーク） |
| 🪪 ファンゾーン | 推しドライバー/チーム登録 → サイト全体のアクセントカラーが変化、ファンカード、レベル |
| 🌐 日英バイリンガル | -navbarで即時切替（保存される） |

## データソース（3段フォールバック）

1. **ライブ**: [OpenF1 API](https://openf1.org)（ポジション/ラップ/天気）
2. **履歴・現シーズン**: [Jolpica F1 API](https://api.jolpica.org)（Ergast後継）
3. **オフライン**: `server/data/*.json` のバンドルデータ（2025カレンダー/グリッド、歴代記録、クイズ40問）

> ネットワークからライブAPIに届かない環境でも、**サイトは完全に動作**します（`source` バッジで表示）。

## 技術構成

- **Frontend**: React 18 + Vite + React Router v6（SPA / 日英i18n / CSS変数テーマ）
- **Backend**: Node.js + Express（`/api/*` + ビルド静的配信 + SPAフォールバック）
- **ゲーム**: 自前のシミュレーションエンジン（`src/lib/sim.js`）
- **状態**: React Context + localStorage（推し/XP/予測）

## セットアップ

```bash
npm install
npm run serve        # ビルド + サーバ起動（http://localhost:3000）
```

開発時:

```bash
npm run dev          # Vite dev server (5173) /api は 3000 へプロキシ
npm run start        # 別途 API/静的サーバ (3000)
```

QAスモークテスト（jsdom + esbuild classic bundle）:

```bash
node scripts/smoke.mjs
```

## ディレクトリ

```
server/
  index.js           # Express: API + 静的配信 + SPA fallback
  api.js             # /api ルート（ライブ取得・キャッシュ・フォールバック）
  data/*.json        # オフラインバンドルデータ
src/
  pages/             # 13画面
  components/        # Navbar / Cards / common / FanProvider
  lib/               # i18n / api / store / sim / utils
scripts/smoke.mjs    # ランタイム QA
docs/DESIGN.md       # 設計ドキュメント
```

## ロードマップ

- v1.5: SNSシェア用カード画像出力、ライブgapグラフ、予選セグメント表示
- v2: ユーザー間マルチ予測リーグ、ファンタジーチーム、コミュニティ機能
