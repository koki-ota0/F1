# 調査: 「2026年のレース結果・順位表を取得できるか？」

**結論: 可能です。** 2026年シーズンの結果・ドライバー/コンストラクター順位は、**OpenF1 API の正しいエンドポイント名**で取得できます（2026-11-23 に実測確認済み）。

---

## 1. なぜ今まで「2025年しか出ない」のか（根本原因）

コードが **旧い/存在しない OpenF1 エンドポイント名**を使っていたため、要求が常に失敗 → バンドル(2025)アーカイブへ劣化していました。

| コードが呼んでいた名前 | 正しい現在の名前 |
| --- | --- |
| `/v1/positions` | **`/v1/position`** |
| `/v1/driver_standings` | **`/v1/championship_drivers`**（beta） |
| `/v1/constructor_standings` | **`/v1/championship_teams`**（beta） |
| `/v1/results` | **`/v1/session_result`** |

- `src/lib/live.js` / `src/lib/api.js` / `server/api.js` の OpenF1 系がこちらの旧名ベース。
- Jolpica（`/2026/drivers/` など）はサンドボックスから到達不能（curl 000）。実ブラウザでも GitHub Pages ではブロックされやすい。
- その結果、Results・Standings は「Jolpica 失敗 → 2025 archive を表示」になり、2026年データが表示されませんでした。

### 実測した失敗例（すべて「エンドポイント不在」が原因）
- `/v1/positions?session_key=9693&driver_number=1` → 失敗（正しくは `/v1/position`）
- `/v1/driver_standings?session_key=9478` → 失敗（正しくは `/v1/championship_drivers`）
- `/v1/results?year=2025&round=1` → 失敗（正しくは `/v1/session_result?session_key=…`）

---

## 2. 実測できた 2026年データ（OpenF1, 2026-11-23 時点）

### 2.1 シーズン構成
- 2026年は **25ラウンド**（我々の同梱カレンダー `server/data/calendar.json` と**完全一致**）。
- 最終開催済みラウンド = **Las Vegas GP（Round 23, 2026-11-22）**、`meeting_key=1300`, `session_key=11420`。
- 次は Qatar（11-29, session 11428）→ Abu Dhabi（12-06, session 11436）。
- OpenF1 の meetings には `is_cancelled:true` のバーレーン(Rd.4)/サウジアラビア(Rd.5) があり、代わりにマレーシアGP(Rd.18, meeting 1308)が組込まれている。

### 2.2 レース結果（全ラウンド取得可能）
`GET /v1/session_result?session_key=<race_session_key>` → 完走順・ポイント・DNF/DNS/DSQ・タイム。
- Las Vegas: **1位 Max VERSTAPPEN(#3)** / 2位 Norris(#1) / 3位 Piastri(#81) …
- Round 1 (オーストラリア, session 11234): **1位 George RUSSELL(#63)** …
- `position<=N` フィルタで先頭のみ取得可（効率化）。
- **ラウンド→session_key は一覧取得可能**: `GET /v1/sessions?year=2026&session_type=Race`（25件＋スプリント）。

### 2.3 順位表（WDC/WCC）
`GET /v1/championship_drivers?session_key=<直近レース>` → 全25台の `position_current`, `points_current`, `points_start`。
- 2026-11-22時点 WDC: 1位 ANTONELLI(#12) 402 / 2位 VERSTAPPEN(#3) 304 / 3位 HAMILTON(#44) 267 …

`GET /v1/championship_teams?session_key=11420` → 2026 WCC: 1位 Mercedes 666 / 2位 Ferrari 517 / 3位 Red Bull 440 / 4位 McLaren 431 …

- **ラウンド毎の順位推移**も `points_start`/`points_current` + 各ラウンドの session_result から再構成可能。
- `championship_*` は「そのレース終了後」のスナップショット。直近完了レースの session_key を使えば「今の順位」が出る。

### 2.4 ライブタイミング
`GET /v1/position?session_key=<k>&date>=<t>&date<=<t+window>` → 時間窓指定で全車ポジション取得可（実測OK）。
- 無指定 `/v1/position?session_key=11420` はペイロード过大で失敗する → **短い時間窓で_pollする設計**が有効。
- `laps` / `weather` / `car_data` / `pit` / `race_control` も利用可（`laps?...&driver_number=` 実測OK）。

### 2.5 注意・未取得のもの
- **`/v1/starting_grid` は失敗**（2025のセッションでも失敗 → 公開API側の問題の可能性）。グリッド/ポールは qualifying の `session_result` から代用するのが安全。
- `/v1/driver_standings` `/v1/results` `/v1/positions` は**存在しない**（旧ドキュメント由来）。
- 無料枠は 3 req/s・30 req/min（historical, 2023年以降）。ライブ配信中の实时 data は有料（€9.90/月）だが、**レース終了後は historical として取得可能**。

---

## 3. Jolpica / GitHubデータセットの状況

- `api.jolpica.org` はサンドボックスから**到達不能**（curl 000, TLS切断）。実ブラウザでは通常到達。
- `jolpica/jolpica-f1-data`（GitHub）の 2026 フォルダは **schedule + 01-Australian/race/starting_grid.json のみ**。2026の results/standings ファイルは**存在しない**（2025も results は数ラウンド分のみと散在）。
- よって **現状の 2026 リアルタイムソースは OpenF1 が最有力**。Jolpica は「実ブラウザ到達時の補完」位置づけでよい。

---

## 4. 実装方針（次ステップ案 / 未着手）

1. `src/lib/providers.js` に OpenF1 新エンドポイントを追加:
   - `openf1RaceSessions(year)` ← `/sessions?year=&session_type=Race`
   - `openf1SessionResult(sessionKey)` ← `/session_result`
   - `openf1ChampionshipDrivers/Teams(sessionKey)` ← `/championship_drivers|teams`
   - `openf1PositionsWindow(sessionKey, from, to)` ← `/position` + date 窓
2. `/api/results?year=2026` → OpenF1 から **ラウンド別の結果サマリ**（優勝者/ポール）を構築。
3. `/api/standings?year=2026` → **Jolpica → OpenF1 championship_* の順**でフォールバック（既存アーカイブは最終手段）。
4. `getResults/getStandings` の「archive 即返し」を廃し、**2026 が取れなければ 2025 と明示**（現行の season バッジ維持）。
5. `/live` は position 時間窓 poll に切替（session 終了後も直近レースを表示）。
6. QA: `scripts/interact5.mjs` に 2026 モック or 取得済み JSON で結果/順位の先行確認。

**検証コスト**: 25ラウンド × (session_result + championship) ≈ 50 req → 無料枠的には**サーバ側で1回だけ**構築してキャッシュ/焼き込みするのが安全（ブラウザからの大量直接叩きは rate-limit リスク）。
