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
| 🤖 AI予測 | **PITWALL APEX**: モンテカルロ1500回の確率予測＋おすすめ採用。外部LLM連携可（環境変数） |
| 💬 ファンSNS | つぶやき・#タグ・いいね・トレンド（サーバ保存＋ポーリング） |
| 🎯 ゲーム | 結果**予測**（P1-P3+FL、採点、リーダーボード）、**レースシミュレーター**（単戦アニメ+シーズン一括）、**クイズ**（5カテゴリ、XP/ストリーク） |
| 🪪 ファンゾーン | 推しドライバー/チーム登録 → サイト全体のアクセントカラーが変化、ファンカード、レベル |
| 🌐 日英バイリンガル | -navbarで即時切替（保存される） |
| 🔄 随時更新 | サーバ5分ごと自動リフレッシュ / snapshot更新スクリプト / ブラウザ直接LIVE取得 |

## データを最新化する

```bash
node scripts/update-data.mjs        # ネット接続できる環境で実行 → server/data/snapshot.json
```

- サイトは**現シーズン（2026: 25戦・11チーム/22人グリッド）を最優先**で表示（Jolpica/OpenF1ライブ → snapshot → バンドル2026データ）
- アーカイブ表示時は画面上に金色バナーでシーズンを明示します
- オフライン環境では生成AI（LLM）連携なしでも APEX 統計モデルが動作します

## GitHub Pages への公開（任意）

静的ホスティング（GitHub Pages）でも動作するよう、**バンドルデータはクライアントにも同梱**しています（`npm run bundle`）。 Express の `/api` が無くても、ドライバー/チーム/カレンダー/記録/クイズ等は表示されます。

```bash
# repo settings → Pages → Source: GitHub Actions を選択
# .github/workflows/pages.yml が main への push で自動デプロイします
```

- URL: `https://<owner>.github.io/F1/`
- 20等の**ライブAPI**はブラウザから直接Jolpica/OpenF1へ取得を試行（CORSが通れば最新版に自動切替）
- 深いリンク（`/live` など）は `dist/404.html` でSPAフォールバック
- サーバ依存機能（ファンSNS共有・予測リーダーボード）は静的ホストではローカル動作に退化します

## AI予測のLLM連携（任意）

OpenAI互換エンドポイントを設定すると、APEXモデルとLLMのブレンド予測になります（未設定時はAPEXのみ・自動フォールバック）。

```bash
export PITWALL_LLM_URL=https://your-endpoint/v1/chat/completions
export PITWALL_LLM_KEY=sk-...
export PITWALL_LLM_MODEL=gpt-4o-mini   # 任意
npm run serve
```

## データソース（3段フォールバック）

1. **ライブ**: [OpenF1 API](https://openf1.org)（ポジション/ラップ/天気）
2. **履歴・現シーズン**: [Jolpica F1 API](https://api.jolpica.org)（Ergast後継）
3. **オフライン**: `server/data/*.json` のバンドルデータ（2026カレンダー/グリッド、歴代記録、クイズ40問）

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
  pages/             # 15画面（/league 含む）
  components/        # Navbar / Cards / common / FanProvider
  lib/               # i18n / api / store / sim / model(APEX) / learning / league / utils
scripts/smoke.mjs    # ランタイム QA
docs/DESIGN.md       # 設計ドキュメント
```

## ロードマップ

- v1.5: SNSシェア用カード画像出力、ライブgapグラフ、予選セグメント表示
- v2: AIフォーム学習（結果から自律補正）、ファンSNS返信スレッド、マルチ予測リーグ（フロントランナー賞 / TOP3チャレンジ / FL賞）→ **実装済み**
- v2.1+: フォロー/フォロワー、リーグ作成・カスタムルール、招待共有、ファンタジーチーム
