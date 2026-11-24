# 実装メモ: 2026年データの本番反映（Results / Standings / Live / キャッシュ）

**日付:** 2026-11-23
**前提調査:** `docs/INVESTIGATION-2026-data.md`（OpenF1 エンドポイントの実測結果）

---

## 1. 背景（なぜ 2025 しか出なかったか）

OpenF1 の旧エンドポイント名（`/v1/positions`, `/v1/results`, `/v1/driver_standings`,
`/v1/constructor_standings`）を使い続けていたため全リクエストが失敗し、
Jolpica も到達不能 → Results・Standings が「2025 アーカイブ」に劣化していた。

正しいエンドポイント:

| 目的 | エンドポイント |
| --- | --- |
| レース結果（完走順） | `/v1/session_result?session_key=<k>` |
| ドライバーズ選手権 | `/v1/championship_drivers?session_key=<k>` |
| コンストラクターズ | `/v1/championship_teams?session_key=<k>` |
| ポジション履歴 | `/v1/position?session_key=<k>&date>=…&date<=…`（短い窓必須） |
| 天気 | `/v1/weather?session_key=<k>` |
| ドライバー名/チーム | `/v1/drivers?session_key=<k>` |

無料枠は 3 req/s・30 req/min、過去データは 2023 年以降。**シーズン全取得で ~50 リクエスト**
になるため、ブラウザから直接叩かずサーバ側で集約・キャッシュする方針。

---

## 2. データ階層（サーバ）

```
/api/results?year=2026
  1. buildSeasonResults()  … OpenF1 sessions + session_result（10分キャッシュ）
  2. server/data/results-2026.json    ← 生成スナップショット (source: bundle)
  3. server/data/results-2025.json    ← 前年アーカイブ (source: archive)

/api/standings?year=2026&type=drivers
  1. Jolpica（従来）
  2. OpenF1 championship_* （最新完走ラウンド基準）
  3. readSnapshot()（手動 sync キャッシュ、7日有効）
  4. server/data/standings-2026.json  ← 生成スナップショット (source: bundle)
  5. server/data/standings-2025.json  ← 前年アーカイブ (source: archive)
```

`/api/live` は 2 つの形を返す（どちらも実データ、合成なし）:

- `source: 'live'` → レース開催中: 直近ポジション窓 + weather
- `source: 'result'` → 最終戦後: 最終Classification + weather + meeting 情報

### 生成スナップショットの取り扱い（重要）
`server/data/{results,standings}-2026.json` は **捏造ではなく 2026-11-23 に OpenF1 から
取得した値の焼き込み**です。各ファイルに `retrievedAt: 2026-11-23T00:00:00Z` と
`source` を明記し、UI には「同梱スナップショット / バンドル（2026）」バッジを表示します。
ライブ API に到達した時点で上書きされます（`source: live` に切替）。

再生成: `npm run gen:2026`（`scripts/gen-2026-snapshot.mjs` → `npm run bundle`）。

---

## 3. クライアント階層（`src/lib/api.js`）

```
getResults(year):   /api/results → localStorage(live.results.<y>) →
                    static/results-2026.json (+OpenF1最新ラウンド差分) → 2025 archive
getStandings(y,t): /api/standings → Jolpica → localStorage →
                    OpenF1 championship → static/standings-2026.json → 2025 archive
getRaceResult():   /api/results?round= → localStorage → OpenF1 直取 → Jolpica
getCalendar():     /api/calendar → localStorage → static/calendar.json
```

スタティックホスト（GitHub Pages）では `/api/*` が焼き込み JSON になる。
`scripts/postbuild.mjs` が **現行シーズン（2026）のファイルを `/api/results`,
`/api/standings` として焼き込み、`source:'bundle'` を付与**する。これがないと
ページは 2025 アーカイブにフォールバックしてしまう（今回の不具合の一つ）。

## 4. `/live` の置き換え（旧ポーリング方式の廃止）

旧実装は「セッション中だけ interval でポーリング」だったため、レース週以外は
常にオフライン表示になり、日本のファンが何も見られない状態だった。

新実装（`src/lib/live.js` + `src/pages/Live.jsx`）:

- `refreshLive(year)` が 5 ジョブを並列実行し localStorage に保存
  （calendar, lineup, results summary, drivers standings, constructors standings）
- `loadClientLive()` が `positions`（開催中）または `classification`（最終戦後）を返す
- 画面上部に「SCHEDULE」カード（FP1/FP2/FP3/予選/レースの日時）、
  天気カード、`最終結果` バッジ付きの最終Classificationテーブルを表示
- スタティックホストでは `window.__PITWALL_API__ === false` のためintervalを行わず
  更新ボタン（オンデマンド）のみ

## 5. QA

- `npm run qa:browser` — headless Chromium（@sparticuz/chromium + puppeteer-core）。
  沙箱は api.openf1.org に届かないため `VITE_OPENF1_BASE=http://127.0.0.1:4180/f1`
  を先にビルド時に注入し、`scripts/mock-openf1.mjs` で OpenF1 形状の fixture を返す。
- `npm run mock:openf1` — 上記 fixture サーバ（ローカルQA専用、本番不使用）
- `npm run qa:build` — jsdom 版スモーク/インタラクション（API・静的ホスト両方）

### 確認済み（2026-11-23）
- ブラウザ（Express + OpenF1 fixture）: 全チェック PASS
  - Results: 2026 タブ初期表示、Rd.1 George Russell / Rd.23 Max Verstappen 等 25 ラウンド
  - Standings: CHAMPIONSHIP 2026、Antonelli 402 pts、WDC 25行 / WCC 11行
  - Live: OpenF1 由来 22 行のClassification + 天気 + SCHEDULE カード
  - calendar / home 含めレイアウト崩れ・console エラーなし
- 静的ホストシミュレータ（:4173）: 14/14 PASS、Results は「バンドル（2026）」バッジ、
  Standings は「同梱スナップショット」バッジ + Antonelli 402
- Express サーバ（API 到達不能時）: `/api/results` `/api/standings` ともに
  `source: bundle`・2026 の 25 行

## 6. 残課題
- シーズン最終戦（Qatar/Abu Dhabi）後は `npm run gen:2026` でスナップショット更新
- OpenF1 有料枠（in-session live）は無料 tier では取得不可。現時点は最終戦後の
  Classification を「最新」として表示する設計。
- ドライバー #31/#22/#50 は公開 API に氏名が未掲載のため番号表示のまま
