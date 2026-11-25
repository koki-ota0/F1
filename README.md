# PITWALL 🏁 — F1 Fan Hub

「F1のすべてを、ピットウォールから。」
長年ファンも新規ファンも、チームファンもドライバーファンも、誰もが使えて遊べる **F1オールインワン・ファンサイト** です。

> 設計ドキュメント: [`docs/DESIGN.md`](docs/DESIGN.md)（20エージェント・ワークショップの成果）

---

## 主な機能

| カテゴリ | 内容 |
|---|---|
| 📡 ライブ | ライブタイミング（ポジション/ギャップ/天気）、セッション予定、カウントダウン |
| 🏆 情報 | 順位表、**レース結果**（ラウンド別 優勝/ポール/FL＋全順位）、カレンダー（サーキット情報）、ドライバー/チーム一覧＆詳細（**顔写真**付き）、歴代チャンピオン、オールタイム記録 |
| 📰 ニュース | ライブRSSフィード（オフライン時は注目記事） |
| 🤖 AI予測 | **PITWALL APEX**: モンテカルロ1500回の確率予測＋おすすめ採用。外部LLM連携可（環境変数） |
| 💬 ファンSNS | つぶやき・#タグ・いいね・トレンド（サーバ保存＋ポーリング） |
| 🎯 ゲーム | 結果**予測**（P1-P3+FL、**実結果から自動採点**・一致度/的中率・リーダーボード）、**予測リーグ**（フロントランナー賞/TOP3/FLの3リーグ、ハウスライバル付き）、**レースシミュレーター**、**クイズ** |
| 🪪 ファンゾーン | 推しドライバー/チーム登録 → サイト全体のアクセントカラーが変化、ファンカード、レベル |
| 🔑 アカウント | **ユーザー名＋パスワードだけ**（メール不要）。ファンゾーン・予測・リーグはログイン制。パスワードは scrypt でハッシュ化 |
| 🌐 日英バイリンガル | ヘッダーの言語スイッチで即時切替（保存される） |
| 🔄 随時更新 | サーバ5分ごと自動リフレッシュ / snapshot更新スクリプト / ブラウザ直接LIVE取得 |

## データを最新化する

```bash
node scripts/update-data.mjs        # ネット接続できる環境で実行 → server/data/snapshot.json
```

- サイトは**現シーズン（2026: 23戦・11チーム/25人グリッド）を最優先**で表示（Jolpica/OpenF1ライブ → snapshot → バンドル2026データ）
- アーカイブ表示時は画面上に金色バナーでシーズンを明示します
- オフライン環境では生成AI（LLM）連携なしでも APEX 統計モデルが動作します

## GitHub Pages への公開（任意）

静的ホスティング（GitHub Pages）でも動作するよう、**バンドルデータはクライアントにも同梱**しています（`npm run bundle`）。 Express の `/api` が無くても、ドライバー/チーム/カレンダー/記録/クイズ等は表示されます。

```bash
# repo settings → Pages → Source: GitHub Actions を選択
# .github/workflows/pages.yml が main への push で自動デプロイします
```

- URL: **https://kokilux.github.io/F1/**
- **同梱2026スナップショット**: `server/data/results-2026.json` には**全ラウンドの全順位**（`classification`）を焼き込んでいます（`npm run gen:2026` で OpenF1 から再生成）。静的ホストではサーバーが不在でも「全順位」が開けます
- **最新情報の更新**: ナビ右上の「🔄 最新に更新」ボタンを押すと、ブラウザから直接 Jolpica/OpenF1 を取得しカレンダー＋順位をキャッシュ（常時ポーリングなし。要求年が未公開なら**前シーズンを自動で取得**、オフラインなら直近キャッシュ→同梱2026データを表示）
- ネットワークで直接アクセス出来ない場合はビルド時のベースURL差し替えが使えます:
  ```bash
  VITE_F1_BASE=https://your-proxy.example.com/f1 VITE_OPENF1_BASE=https://your-proxy.example.com/openf1 npm run build
  ```
- 深いリンク（`/live` など）は `dist/404.html` でSPAフォールバック
- サーバ依存機能（ファンSNS共有・予測リーダーボード）は静的ホストではローカル動作に退化します（返信・リーグ・学習は localStorage で完全動作）

## 予測の採点（実結果のみ）

予測ポイントは**シミュレーションではなく公式結果**から計算します。ライブAPI（OpenF1/Jolpica）→ 同梱スナップショットの順に結果を取得し、公開されている順位だけで採点します。

| カテゴリ | ポイント |
|---|---|
| P1 完全一致 | 10 |
| P1 が表彰台 / トップ10 | 4 / 1 |
| P2 完全一致 / 表彰台 | 8 / 3 |
| P3 完全一致 / 表彰台 | 6 / 2 |
| FL 完全一致 / トップ10 | 5 / 1 |
| 表彰台3人完全一致ボーナス | +5 |

- **一致度（accuracy）** = 完全一致したカテゴリ数 / 公開されているカテゴリ数。位置が不明なカテゴリは分母に入れません（正直な計算）
- **的中率（hit rate）** = 得点できたカテゴリ / 公開カテゴリ
- 予測はレースごとに1件（アカウント単位）。結果が出るとロックされ、再送信はできません
- リーグは同じ結果で全エントリー（アカウント＋決定論的ボット）を採点。過去の予測は参加時に自動取り込み
- 旧来の「シードユーザーの架空ポイント」は削除しました（捏造データなし）

## アカウント（ユーザー名＋パスワード）

ファンゾーン・結果予測・予測リーグはアカウント制です。メール認証は不要で、**ユーザー名とパスワードだけ**で登録できます。

- 登録/ログイン: `/login`（アプリのヘッダーからも遷移）
- パスワード: scrypt(N=16384, r=8, p=1)＋ユーザーごとのランダムソルト、 timing-safe 比較。**平文保存なし**
- セッション: 30日間の不透明トークン。httpOnly / SameSite=Lax クッキーと `Authorization: Bearer` の両方に対応（トークンは SHA-256 で保存）
- 試行制限: ログイン＝アカウントごとに 12回/15分、登録＝IPごとに 20回/時
- アカウントデータは `server/data/users.json` / `sessions.json` に保存（Git では除外。運用環境の書き込みが必要）
- **GitHub Pages などの静的ホストではアカウント機能は利用できません**（`/api/auth/*` が無いため、率直にその旨を表示します）。サーバー付き運用（Express）で完全動作します

### 入力チェック（登録が通らないとき）

エラーは「どの項目が、なぜダメか」を返します。汎用の「入力内容を確認してください」は出しません。

| ルール | 失敗時の `code` | 画面の表示 |
|---|---|---|
| ユーザー名 `^[A-Za-z0-9_-]{3,20}$`（日本語・空白・記号は不可） | `username_format` | 「3〜20文字の半角英数字・アンダースコア・ハイフンで…」 |
| ユーザー名が既に使用中（大小文字を区別しない） | `username_taken` | 「そのユーザー名はすでに使われています」 |
| パスワード 8〜128文字 | `password_length` | 「8〜128文字にしてください」 |
| 英字と数字の両方を含む | `password_strength` | 「英字と数字の両方を含めてください」 |
| よく使われるパスワード（`password1` 等） | `password_common` | 「簡単すぎます。別のものに」 |
| 回数制限 | `rate_limited` | 「しばらく待ってから再試行を」 |
| サーバーが無い（静的ホスト／API停止） | `server_unavailable` | 「この環境ではアカウント機能は利用できません」 |

該当フィールドには `aria-invalid` が付き、フォーカスが移動します。静的ビルドでは**入力前から**サーバー不要の旨を表示します。

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

## ドライバー画像の統一ソース

ドライバーのポートレートは **1つのソースに統一** しています。

- **唯一のソース**: `public/images/drivers/<id>.jpg`（F1公式のオフィシャルポートレートを同梱）
- `DriverPhoto` はこの同梱画像を既定で読み、`src` プロパティで明示的な上書きのみ許可します（例: ライブディレクトリが返す公式 headshot）。**X/Twitter など外部SNSは一切使用しません**
- 画像取得失敗時はイニシャルバースクリーンにフォールバックします（`Cards.jsx` の `failed`）
- OpenF1 `/v1/drivers?session_key=` は最新セッションに出走しないドライバーを欠落するため、単独のソースにはしていません

## ニュースのソースとリンク

- ライブ時は [F1公式 Atom フィード](https://www.formula1.com/content/fom-website/en/latest/all.xml) をパースし、**各記事は必ず元記事URLへのリンク**になります（`/api/news` → `News.jsx`）
- フィードに `<link href>` しか無いAtom仕様のため、`server/api.js` の `parseFeed` は `href` 属性も拾ってリンク切れを防いでいます
- オフライン時は `server/data/news.json`（2026-11-23 取得の公式記事10件、全件URL付き）に切り替わります

## カレンダーのデータソース

- **Rd番号・正式名称・サーキット・周回数・周長・総距離・初開催・ラップレコード・表彰台**は F1公式 2026 レースページ（`/en/racing/2026/<slug>`）から取得
- セッション時刻は Jolpica F1 API のタイムテーブル＋F1公式掲載の現地時刻。Sepang（Rd.16 バーレーンGP移設）はF1公式時刻を採用
- 2026年は **23GP**（バーレーンGPはマレーシア移設、サウジGP中止）。Rd.16 は Sepang でバーレーンGP、Rd.14 は Madring（スペインGP）です
- カレンダーカードの「レース概要を見る」で、コース図・公式名称・セッション日程・表彰台・公式ページへのリンクを展開できます

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

UI/UX 監査（ヘッドレス Chromium が必要。`@sparticuz/chromium` + `puppeteer-core` を dev deps に含む）:

```bash
# 全17ルート × 1440/390px のスクリーンショットとレイアウト計測
LD_LIBRARY_PATH=/home/user/chromelibs/lib node scripts/shot-all.mjs

# computed style 監査（文字サイズ / コントラスト / タップ目標 / はみ出し / alt）
LD_LIBRARY_PATH=/home/user/chromelibs/lib node scripts/ui-audit.mjs

# アルファ合成する本物の WCAG AA コントラスト監査（全ルート × 1440/390px）
LD_LIBRARY_PATH=/home/user/chromelibs/lib node scripts/contrast-audit.mjs

# 1280→360px の12段階の幅で横スクロールが出ないか検査
LD_LIBRARY_PATH=/home/user/chromelibs/lib node scripts/width-audit.mjs

# 操作系スモーク（ドロワー開閉 / タブ / 開閉パネル / 言語切替）
BASE=http://localhost:3000 node scripts/interact5.mjs

# 2026シーズンの内容（グリッド・順位・結果）が実データか
BASE=http://localhost:3000 node scripts/verify-2026.mjs

# 静的ホスト相当（GitHub Pages）でディープリンク＋同梱データ動作を確認
node scripts/static-server.mjs 4170      # dist/ を配信（SPAフォールバック付き）
BASE=http://localhost:4170 node scripts/smoke.mjs
```

## UI/UX ポリシー（2026-11 全面見直し）

- **ナビゲーションは全幅で同一**: ブランド＋言語スイッチ＋☰ドロワーの1行構成。
  横並びリンクは幅があると2段に折り返れ、狭い幅では窮屈になるため、
  コンテンツ（ライブ/順位/結果/カレンダー/ドライバー/チーム）、
  ゲーム（予測/シミュレーター/クイズ）、
  コミュニティ（ニュース/SNS/リーグ/ファン）の3グループに分けた
  スライドイントロワーに集約しています（`src/components/Navbar.jsx`）。
- **深いリンクも必ず描画**: 静的ホストには `/api/drivers/:id` が無いため、
  `src/lib/api.js` の `staticFallback()` が同梱JSONから解決します
  （`Vite base:'/'` + `assetUrl()` でアセットパスも修正済み）。
- **結果ページ**: ラウンドカード（Rd・優勝者・ポール/FL）と、
  独立スクロールフレームの「全順位」パネルに分離。
  優勝者は必ず名前表示（`driverName()` が番号だけの行を受付ディレクトリで解決）。
- **対話パターン**: オフライン/バンドル時は「全順位データがありません」と
  理由を明示し、到達可能環境では自動で表が入ります。

## ディレクトリ

```
server/
  index.js           # Express: API + 静的配信 + SPA fallback
  api.js             # /api ルート（ライブ取得・キャッシュ・フォールバック）
  data/*.json        # オフラインバンドルデータ
src/
  pages/             # 16画面（/results, /login 含む）
  public/images/     # ドライバー顔写真（同梱）
  components/        # Navbar / Cards / common / FanProvider
  lib/               # i18n / api / store / sim / model(APEX) / learning / league / utils
scripts/smoke.mjs    # ランタイム QA
scripts/ui-audit.mjs / contrast-audit.mjs / width-audit.mjs / interact5.mjs / verify-2026.mjs  # UI/UX 監査
scripts/static-server.mjs  # GitHub Pages 相当の静的配信シミュレータ
docs/DESIGN.md       # 設計ドキュメント
```

## ロードマップ

- v1.5: SNSシェア用カード画像出力、ライブgapグラフ、予選セグメント表示
- v2: AIフォーム学習（結果から自律補正）、ファンSNS返信スレッド、マルチ予測リーグ（フロントランナー賞 / TOP3チャレンジ / FL賞）→ **実装済み**
- v2.2: **レース結果ページ**（2025アーカイブ同梱＋ライブ全順位）、**ドライバー顔写真** → 実装済み
- v2.3+: フォロー/フォロワー、リーグ作成・カスタムルール、招待共有、ファンタジーチーム
