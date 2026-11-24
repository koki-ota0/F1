# PITWALL — リアルタイム情報更新の設計（v2.3）

> 対象: 「今のままだと最新情報の更新がうまくいかない」を、**他API・他サービスの調査**のうえ
> **本物の最新情報が届く設計**に作り替える。捏造データは一切出さず、届かなければ「届いていない」と正直に表示する。

---

## §A. 問題の再定義

現状（v2.2 まで）の更新経路は **Jolpica F1 API 一点依存**だった。

| 経路 | 実体 | 問題 |
| --- | --- | --- |
| Express `/api/*` | サーバが Jolpica を fetch | オフライン/ブロック環境では全滅。取得失敗時は静かにバンドルへ劣化 |
| クライアント直接 fetch | `https://api.jolpica.org/f1` | **GitHub Pages 等の静的ホストでは CORS / ネットワークでブロックされやすい**（サンドボックスからも到達不能: curl 000, TLS 切断）。しかもポーリング前提 |
| 手動更新ボタン | `refreshLive()` = Jolpica calendar + standings のみ | OpenF1（無料・keyless・CORS 許可）を**使っていなかった**。ライブタイミングは OpenF1 想定の文言なのに実データは固定 |

つまり「最新に更新できない」の主因は **単一ソース依存** と **ブラウザ直取りのみ** の2点。

---

## §B. 調査結果（利用可能なソース）

サンドボックスは送信先を `github.com / codeload.github.com / api.github.com / registry.npmjs.org / pypi.org / files.pythonhosted.org` に限定しているため、**到达性はサンドボックス ≠ 実ブラウザ** であることに注意。OpenF1 は `fetch_page`（実ブラウザ相当プロキシ）経由で実測した。

### B.1 OpenF1 API（`https://api.openf1.org/v1`）— **一次ソース（ライブ）**
- 認証不要・レート緩和・CORS 許可（ブラウザ直取り可）。**Keyless**。
- 実測 OK:
  - `/meetings?year=` … ターゲットフラグ画像 `country_flag` / サーキット画像 `circuit_image` / `date_start/end`
  - `/sessions?meeting_key=&session_type=Race` … `session_key`, `date_start/end`
  - `/drivers?session_key=` … 22台分 `full_name`, `name_acronym`, `team_name`, `team_colour`(hex), `headshot_url`(formula1.com CDN)
  - `/positions?session_key=` … ラップ毎 position/gap/lap_number（履歴として積算。**レース間隙でも直近レースを取得可能**＝オフシーズンライブ画面のもやもやを解決）
  - `/weather?session_key=` … 分単位 `air_temperature`, `track_temperature`, `humidity`, `wind_speed`, `rainfall`
  - `/laps?session_key=&driver_number=` … セクター/速度（実測 OK）
- 実測 **失敗**（エンドポイント不在かプロキシの一過性かは未確定）: `/driver_standings?session_key=`, `/results?session_key=`, `/results?year=&round=`
- 特性: **シーズン成績（WDC/WCC）は出さない**。セッション中心。履歴ポジションは取れる。

### B.2 Jolpica F1 API（`https://api.jolpica.org/f1`）— **一次ソース（歴史/順位）**
- 無料・keyless・CORS 许可。**WDC/WCC を提供する唯一の公開ソース**。`/2026/drivers/` などシーズン途中も更新される。
- サンドボックスからは到達不能。実ブラウザでは通常到達。→ **中継リレー**併用が有効（§C.4）。

### B.3 公式データセット `jolpica/jolpica-f1-data`（GitHub リポジトリ）
- `data/<year>/00-Schedule/{calendar.json,drivers.json,circuit.json}`、`data/<year>/<GP>/race/starting_grid.json` 等。
- `gh api` で **2026 ディレクトリ存在・活発に更新**（2026-11-12 "Jolpica driver patch"）を確認。calendar.json 49KB / drivers.json 5.5KB。
- 用途: **ビルド時バンドルの信頼できるソース**（Jolpica の PDF パース結果をコミュニティが整備）。オフライン劣化のベースにも最適。

### B.4 F1 公式
- ニュース RSS（既存 implementation）。タイミング画面（`https://www.formula1.com/en/live-results.html`）は JS 描画＋定期的 JSON 更新。
- 画像 CDN `.../images/fom-website/...` はドライバー headshot の信頼できる供給元。

### B.5 FastF1 / Ergast
- FastF1 は Python 製ライブラリで API ではない。Ergast は 2024 年で新規終了。→ 今回は採用せず、**候補として記録のみ**。

---

## §C. 新設計：マルチプロバイダ + 信頼できる表示

### C.1 プロバイダ抽象 `src/lib/providers.js`
```
OPENF1   = import.meta.env.VITE_OPENF1_BASE || https://api.openf1.org/v1
JOLPICA  = import.meta.env.VITE_F1_BASE    || https://api.jolpica.org/f1
RELAYS   = JSON.parse(import.meta.env.VITE_F1_RELAYS)  // ["https://api.allorigins.win/raw?url={url}"]
fetchVia(url): direct → relay … の順で試行（AbortController で短タイムアウト）
```
- 同一の provider チェーンを **server/api.js と client の両方** に持つ（サーバ集約系とクライアント直取り系の共通土台）。

### C.2 2系統の併存（ユーザー確認済みの運用を崩さない）
| 系統 | トリガ | 実装 |
| --- | --- | --- |
| **サーバ集約**（Express） | `/api/*` がキャッシュ＋バックグラウンド warm-up（5分） | server/api.js に provider フォールバック + health を追加 |
| **クライアントondemand**（GitHub Pages） | ナビの「🔄 最新に更新」押下時のみ | `refreshLive()` が OpenF1→Jolpica の順で取得成功分を localStorage に保存 |

- **ポーリングは Express 環境のみ**。静的ホストでは `setInterval` を張らない（`window.__PITWALL_API__` で判定。dev/build index.html に injection、postbuild で false に上書き）。

### C.3 各ページのソース戦略
| データ | 一次 | 二次 | 三次（正直な劣化） |
| --- | --- | --- | --- |
| カレンダー | Jolpica `/<y>/races/`（ラウンド metadata） | OpenF1 `/meetings?year=`（旗・サーキット画） | 手動キャッシュ → バンドル2026 |
| WDC/WCC | Jolpica `/<y>/drivers|constructors/` | （ソース唯一）→ 中継 | 手動キャッシュ → **2025 archive** ＋「XX年を見ています」バッジ |
| 出走順/顔写真 | OpenF1 meetings→session→drivers（headshot/team_colour） | Jolpica starting_grid | バンドル drivers/teams ＋同梱肖像 |
| ライブタイミング | OpenF1 positions/weather | — | 「オフライン。接続可能な環境では自動／更新ボタンで」＋最終更新/Provider状態 |
| レース結果 | Jolpica `/<y>/<r>/results/` | — | cache → **2025 archive**（明示「per-race分類は含まない」） |
| ニュース | F1公式RSS → Autosport → Crash.net | — | 同梱アーカイブ |

### C.4 ブロック対策（最も効く一手）
- **OpenF1 をカルCanary にする**: keyless/CORS なので GitHub Pages でも直接届く可能性が最も高い。ライブ・出走順・旗/コース画像をここに寄せる。
- **CORS リレー**を `VITE_F1_RELAYS` で注入可能にし、Jolpica がブロックされたときの予備経路とする（既定オフ、利用者は `.env` で設定）。

### C.5 ヘルスチェック（正直な表示）
- `/api/meta` に `providers: { openf1: {ok,at}, jolpica: {ok,at} }` を追加。各 endpoint が provider を叩いた結果を記録。
- クライアントは `readStatus()`（`live.status`）から **最終更新時刻 / 成功数 n/n / 使用中リレー数** を Live ページとナビのツールチップに表示。

### C.6 データ年龄と出典の可視化（受入条件）
- 全カードに `source`（live/cache/bundle/archive/offline）＋ `updatedAt` を表示。文言は「最終更新 hh:mm:ss」「提供元: OpenF1/Jolpica」。
- バンドル/アーカイブ表示時は season バッジ（例: `CHAMPIONSHIP 2025`）。

---

## §D. 実装リスト（コード）
1. `src/lib/providers.js` — 新規。fetch chain + OpenF1/Jolpica ラッパ + probeProviders。
2. `src/lib/live.js` — refreshLive を OpenF1（meetings/session/drivers）＋ Jolpica（standings）へ拡張。`loadClientLive(year)` 追加。
3. `src/lib/api.js` — `LIVE_BASES` を providers から供給、calendar/standings/results を `fetchVia` に切替。
4. `src/pages/Live.jsx` — loadClientLive を使う。gap 実値・lap・Provider・最終更新表示。静的ホストはポーリング停止。
5. `server/api.js` — getCalendar に OpenF1 fallback＋providerHealth、`/api/grid` 新設。
6. `index.html` + `scripts/postbuild.mjs` — `__PITWALL_API__` フラグ。
7. i18n 追加キー（live.staticHint / sourcesOk / provider / start / sessionInfo / dataAge / openf1Note）。

## §E. 検証計画
- smoke 15/15（両ポート）、interact / interact3 / interact5 を再実行。
- OpenF1 モック（fetch_page で取得した実レスポンス形状）で client 経路を QA。
- オフライン時も「データは出るが、 age と source が正しい」ことをテスト。

## §F. 残リスク
- サンドボックスから OpenF1/Jolpica ともに実 fetch 不可 → 実データ経路の最終確認は実ブラウザ。
- リレーは恣意的に増やすと逆に遅い。既定は direct のみ。
