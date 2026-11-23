import { createContext, useContext, useState, useCallback, useEffect } from 'react'

export const dict = {
  ja: {
    'nav.home': 'ホーム', 'nav.live': 'ライブ', 'nav.standings': '順位', 'nav.calendar': 'カレンダー',
    'nav.drivers': 'ドライバー', 'nav.teams': 'チーム', 'nav.games': 'ゲーム', 'nav.predict': '予測',
    'nav.sim': 'シミュレーター', 'nav.quiz': 'クイズ', 'nav.news': 'ニュース', 'nav.fan': 'ファンゾーン',

    'common.loading': '読み込み中…', 'common.live': 'LIVE', 'common.offline': 'オフライン', 'common.cached': 'キャッシュ',
    'common.source': 'データソース', 'common.points': ' pts', 'common.wins': '優勝', 'common.podiums': '表彰台', 'common.poles': 'ポール',
    'common.search': '検索…', 'common.all': 'すべて', 'common.round': 'ラウンド', 'common.date': '開催日',
    'common.circuit': 'サーキット', 'common.country': '国・地域', 'common.laps': '周回数', 'common.length': 'コース長',
    'common.turns': 'コーナー数', 'common.drsZones': 'DRSゾーン', 'common.lapRecord': 'ラップレコード',
    'common.viewAll': 'すべて見る', 'common.close': '閉じる', 'common.km': 'km', 'common.retry': '再読み込み',
    'common.backHome': 'ホームへ戻る', 'common.details': '詳細', 'common.lastUpdate': '最終更新',

    'home.heroKicker': 'F1 FAN HQ — GRID. PADDOCK. PITWALL.',
    'home.heroTitle1': 'F1のすべてを、', 'home.heroTitle2': 'ピットウォールから。',
    'home.heroLead': 'ライブタイミング・順位・カレンダー・ドライバー/チーム情報に、予測・シミュレーター・クイズ・推し活まで。誰もが使えて、誰もが遊べるF1ハブ。',
    'home.nextRace': '次のレース', 'home.countdown': 'レース開始まで', 'home.raceWeekend': 'レースウィークエンド',
    'home.sessionFp1': 'FP1', 'home.sessionFp2': 'FP2', 'home.sessionFp3': 'FP3', 'home.sessionQuali': '予選',
    'home.sessionSprint': 'スプリント', 'home.sessionRace': 'レース',
    'home.liveNow': '只今ライブ配信中', 'home.newsTicker': 'ニュースタイマー',
    'home.gamesTitle': '遊びながらF1を極める', 'home.gamesSub': '予測・シミュレーター・クイズでポイントとXPを稼ごう。',
    'home.predictCta': '次戦の結果を予測してポイントを競う',
    'home.simCta': '自分だけのレースをシミュレート',
    'home.quizCta': 'F1検定に挑戦してストリークを伸ばす',
    'home.fanCtaTitle': '推しを登録しよう', 'home.fanCtaSub': '推しのドライバーとチームを設定すると、サイト全体があなた好みの色に。',
    'home.topRecords': 'オールタイム記録', 'home.myDriver': 'マイドライバー', 'home.myTeam': 'マイチーム',
    'home.pickFavorites': '推しを選ぶ', 'home.seasonReview': 'シーズン振り返り', 'home.championsTitle': '歴代チャンピオン',
    'home.upcomingTitle': '注目のレース', 'home.viewStandings': '順位表へ', 'home.viewCalendar': 'カレンダーへ',
    'home.noUpcoming': '直近のレースはありません（シーズンオフ or ライブ接続で次戦を表示）',
    'home.guideTitle': 'はじめてのF1のために', 'home.guideSub': '最低限これだけ押さえれば十分。',
    'home.liveBadge': 'レース進行中',

    'live.title': 'ライブタイミング', 'live.sub': 'ポジション・ギャップ・タイヤ・天気をリアルタイム表示（OpenF1）',
    'live.positions': 'ポジション', 'live.gap': 'ギャップ', 'live.interval': 'インターバル', 'live.tyre': 'タイヤ',
    'live.pit': 'ピット', 'live.weather': 'コンディション', 'live.airTemp': '気温', 'live.trackTemp': 'コース温度',
    'live.humidity': '湿度', 'live.wind': '風速', 'live.rainProb': '降水確率', 'live.noLive': 'ライブデータがありません',
    'live.offlineMode': 'オフラインモード', 'live.offlineMsg': '現在ライブAPIに接続できません。接続可能な環境では自動でリアルタイムデータが表示されます。',
    'live.sessionSchedule': 'セッション予定', 'live.lap': 'ラップ', 'live.driver': 'ドライバー', 'live.team': 'チーム',
    'live.time': 'タイム', 'live.selectSession': 'セッションを選択', 'live.lastUpdate': '最終更新', 'live.safetyCar': '安全車',
    'live.notes': '黄旗・安全車・赤旗の情報はライブAPIから取得します。',

    'standings.title': '順位表', 'standings.sub': 'ドライバー / コンストラクターズの今季順位と歴代記録',
    'standings.drivers': 'ドライバーズ', 'standings.constructors': 'コンストラクターズ', 'standings.position': '順位',
    'standings.driver': 'ドライバー', 'standings.team': 'チーム', 'standings.points': 'ポイント', 'standings.wins': '優勝',
    'standings.allTime': '歴代チャンピオン', 'standings.champions': '歴代チャンピオン', 'standings.records': 'オールタイム記録',
    'standings.offlineNote': '現シーズンの順位はライブAPI接続時に取得できます。ここでは歴代の記録を表示しています。',
    'standings.asOf': '基準', 'standings.holder': '保持者', 'standings.value': '記録', 'standings.year': '年',

    'calendar.title': 'カレンダー', 'calendar.sub': 'シーズン全レースのスケジュールとサーキット情報',
    'calendar.upcoming': 'これから', 'calendar.completed': '終了', 'calendar.countdownTo': 'レースまで',
    'calendar.circuitInfo': 'サーキット情報', 'calendar.raceDay': 'レース日', 'calendar.roundLabel': 'Rd.',
    'calendar.lapRecordBy': 'ラップレコード保持者',

    'drivers.title': 'ドライバー', 'drivers.sub': '現シーズンのドライバーグリッド。戦績とプロフィール。',
    'drivers.filterTeam': 'チームで絞り込み', 'drivers.number': '番号', 'drivers.debut': 'デビュー', 'drivers.titles': 'タイトル',
    'drivers.career': '通算戦績（暫定値）', 'drivers.addFav': '推しに追加', 'drivers.removeFav': '推しから外す',
    'drivers.bio': 'プロフィール', 'drivers.stats': '戦績', 'drivers.teammate': 'チームメイト', 'drivers.rating': 'PITWALLレート',
    'drivers.noResults': '該当するドライバーがいません', 'drivers.flag': '国籍',

    'teams.title': 'チーム', 'teams.sub': '10チームのプロフィール、ロスター、戦績。',
    'teams.base': '拠点', 'teams.founded': '発足', 'teams.titles': 'タイトル', 'teams.powerUnit': 'パワーユニット',
    'teams.lineup': 'ドライバーラインアップ', 'teams.note': '备注', 'teams.championships': '世界タイトル',

    'predict.title': '結果予測', 'predict.sub': '次のレースのP1-P3とファステストラップを予想。シミュレーター結果で採点。',
    'predict.selectRace': 'レースを選ぶ', 'predict.pickP1': 'P1（優勝）', 'predict.pickP2': 'P2', 'predict.pickP3': 'P3',
    'predict.pickFL': 'ファステストラップ', 'predict.submit': '予測を送信', 'predict.myPicks': 'あなたの予測',
    'predict.leaderboard': 'リーダーボード', 'predict.scoring': '採点ルール', 'predict.scoringDesc': 'P1=10 / P2=7 / P3=5 / FL=5。3人すべて表彰台なら+5ボーナス。',
    'predict.name': '表示名', 'predict.pointsEarned': '獲得ポイント', 'predict.savedPicks': '保存済みの予測', 'predict.noPicks': 'まだ予測がありません',
    'predict.yourName': 'あなたの名前', 'predict.submitDone': '予測を保存しました！', 'predict.clear': 'クリア',
    'predict.fastestLap': ' fastest lap / 最快圈',
    'league.title': '予測リーグ', 'league.sub': 'フロントランナー賞・TOP3チャレンジ・FL賞の複数リーグでライバルと競う',
    'league.yourLeagues': '参加中リーグ', 'league.join': 'リーグに参加', 'league.joined': '参加中',
    'league.roundPicks': '今ラウンドのあなたの予想', 'league.p1Hint': 'P1（アシスタント不要）', 'league.flHint': 'ファステストラップ',
    'league.standings': '順位表', 'league.points': 'ポイント', 'league.noLeagues': 'リーグがありません。',
    'league.myEntry': 'あなたのエントリー', 'league.entryName': 'エントリーネーム', 'league.create': 'リーグを作成',
    'league.scoreRound': '結果でリーグを採点', 'league.simulatedResult': 'シミュレーション結果で採点',
    'league.me': 'あなた', 'league.totalPts': '合計',
    'league.metric.p1': 'P1的中', 'league.metric.top3': '表彰台', 'league.metric.fl': 'FL',
    'league.needPick': 'まずP1（またはFL）を選んでください',
    'league.scoreNote': '採点は localStorage に保存され、静的ホストでも動作します',

    'sim.title': 'レースシミュレーター', 'sim.sub': '独自レートとチーム戦力からレースを再現。予測の検証に。',
    'sim.chooseRace': 'レースを選ぶ', 'sim.run': 'レースを走らせる', 'sim.running': 'レース進行中…', 'sim.results': '結果',
    'sim.seasonSim': 'シーズン一括シミュレーション', 'sim.seasonResults': 'ファイナル順位', 'sim.reset': 'リセット',
    'sim.progress': '進行', 'sim.standings': 'ドライバーズ', 'sim.constructors': 'コンストラクターズ',
    'sim.points': 'ポイント', 'sim.simByPitwall': 'PITWALLシミュレーター',

    'quiz.title': 'F1クイズ', 'quiz.sub': 'カテゴリ別5問。正解+10XP、連続正解でボーナス。',
    'quiz.start': 'スタート', 'quiz.next': '次へ', 'quiz.finish': '結果を見る', 'quiz.score': 'スコア', 'quiz.xp': 'XP',
    'quiz.streak': 'ストリーク', 'quiz.bestStreak': 'ベストストリーク', 'quiz.level': 'レベル', 'quiz.correct': '正解！',
    'quiz.wrong': '不正解…', 'quiz.resultTitle': '結果発表', 'quiz.playAgain': 'もう一度', 'quiz.category': 'カテゴリ',
    'quiz.questionOf': '問', 'quiz.chooseCategory': 'カテゴリを選んでスタート', 'quiz.all': 'すべて',
    'quiz.cat.history': '歴史', 'quiz.cat.driver': 'ドライバー', 'quiz.cat.team': 'チーム', 'quiz.cat.circuit': 'サーキット', 'quiz.cat.rule': 'ルール',

    'news.title': 'ニュース', 'news.sub': 'F1関連の最新情報（ライブRSS / オフライン時は注目記事）',
    'news.source': 'ソース', 'news.offlineFeed': 'オフライン記事（ライブRSSに接続できません）', 'news.readMore': '原文を見る',
    'news.tag': 'タグ', 'news.noItems': '記事がありません',

    'fan.title': 'ファンゾーン', 'fan.sub': '推しを登録して、サイト全体をあなた好みに。',
    'fan.yourName': 'あなたの名前', 'fan.favDriver': '推しドライバー', 'fan.favTeam': '推しチーム', 'fan.save': '保存する',
    'fan.saved': '保存しました！', 'fan.yourCard': 'あなたのファンカード', 'fan.memberSince': '登録日', 'fan.reset': 'リセット',
    'fan.accentApplied': 'サイト全体のアクセントカラーが推しチームカラーに変わりました。', 'fan.xp': 'クイズXP',
    'fan.predictions': '予測ポイント', 'fan.choose': '選ぶ', 'fan.noFav': '未設定', 'fan.edit': '編集',
    'fan.favorite': 'お気に入り', 'fan.favorites': 'お気に入りドライバー',

    'misc.notFound': 'ページが見つかりません', 'misc.notFoundMsg': 'URLを確認するか、ホームに戻ってください。',
    'glossary.drs': 'DRS（ドラッグ・リダクション・システム）', 'glossary.drs.d': '追い越しを助ける可動翼。前の車との差が1秒以内のとき、指定ゾーンで使える。',
    'glossary.understeer': 'アンダーステア', 'glossary.understeer.d': '曲がりたいのに前が滑って曲がらない状態。タイヤのグリップ不足が原因。',
    'glossary.overtake': 'オーバーテイク', 'glossary.overtake.d': '追い越し。DRSやタイヤの性能差、ドライバーの仕掛けがKey。',
    'glossary.slipstream': 'スリップストリーム', 'glossary.slipstream.d': '前の車の陰で空気抵抗が減り、直線上で速く走れる现象。',
    'glossary.safetycar': '安全車（セーフティカー）', 'glossary.safetycar.d': 'コースに危険があるとき先導して速度を落とす。ピットの好機。',
    'glossary.degradation': 'タイヤ劣化（デグラデーション）', 'glossary.degradation.d': '走るほどタイヤが減ってグリップが落ちること。ピット戦略の要。',
    'home.glossary': 'F1用語ミニ辞典',

    'nav.social': 'ファンSNS', 'nav.league': '予測リーグ',

    'social.title': 'ファンSNS', 'social.sub': 'F1ファン同士のつぶやき場。推し、名シーン、予測を自由に。',
    'social.compose': '今どうしてる？', 'social.placeholder': 'F1についてつぶやく（280文字まで）',
    'social.post': '投稿する', 'social.timeline': 'タイムライン', 'social.myPosts': '自分の投稿',
    'social.all': 'すべて', 'social.like': 'いいね', 'social.likes': 'いいね',
    'social.replies': '返信', 'social.replyPlaceholder': 'コメントを返信…', 'social.sendReply': '返信する',
    'social.replyCount': (n) => `返信 ${n}件`, 'social.noReplies': 'まだ返信はありません。最初の返信をどうぞ！',
    'social.trends': 'トレンドタグ', 'social.noPosts': 'まだ投稿がありません。最初の一人に！',
    'social.charCount': '/280', 'social.members': 'ファン参加中', 'social.you': 'あなた',
    'social.justNow': 'たった今', 'social.minAgo': '分前', 'social.hourAgo': '時間前',
    'social.tagsHint': '#タグをスペース区切りで',

    'ai.title': 'AI予測（PITWALL APEX）', 'ai.sub': 'ドライバー/チーム/コース適性をモンテカルロ1500回で演算。統計モデル＋任意LLM連携。',
    'ai.run': 'AI予測を実行', 'ai.running': '演算中…', 'ai.winProb': '勝率', 'ai.podiumProb': '表彰台率',
    'ai.top10Prob': 'TOP10率', 'ai.expectedPoints': '期待ポイント', 'ai.recommended': 'AIおすすめ',
    'ai.usePrediction': 'この予測を採用', 'ai.insight': 'AIインサイト', 'ai.confidence': '確信度',
    'ai.source': '予測エンジン', 'ai.model': 'モデル', 'ai.table': '予測テーブル',
    'ai.upsetPick': '番狂わせ候補', 'ai.llmBadge': 'LLM連携', 'ai.offlineNote': 'オフラインでは APEX 統計モデルで演算します。',
    'ai.applied': '予測フォームに反映しました',
    'ai.learning': 'AIフォーム学習', 'ai.samples': '学習サンプル', 'ai.accuracy': '的中率',
    'ai.mae': '平均誤差（位置）', 'ai.biasApplied': '学習済みバイアス', 'ai.resetLearning': '学習リセット',
    'ai.noLearning': 'まだ学習データがありません。予測→採点で学習が始まります。',

    'fresh.updated': '最終更新', 'fresh.auto': '自動更新', 'fresh.live': 'ライブ取得中',
    'fresh.archiveBanner': 'アーカイブ表示中',
    'fresh.archiveMsg': 'いま表示しているのはバンドルデータ（{season}年シーズン）です。接続可能な環境では現シーズンのライブデータに自動切替わります。'
  },
  en: {
    'nav.home': 'Home', 'nav.live': 'Live', 'nav.standings': 'Standings', 'nav.calendar': 'Calendar',
    'nav.drivers': 'Drivers', 'nav.teams': 'Teams', 'nav.games': 'Games', 'nav.predict': 'Predict',
    'nav.sim': 'Simulator', 'nav.quiz': 'Quiz', 'nav.news': 'News', 'nav.fan': 'Fan Zone',

    'common.loading': 'Loading…', 'common.live': 'LIVE', 'common.offline': 'OFFLINE', 'common.cached': 'CACHE',
    'common.source': 'Data source', 'common.points': ' pts', 'common.wins': 'Wins', 'common.podiums': 'Podiums', 'common.poles': 'Poles',
    'common.search': 'Search…', 'common.all': 'All', 'common.round': 'Round', 'common.date': 'Race day',
    'common.circuit': 'Circuit', 'common.country': 'Country', 'common.laps': 'Laps', 'common.length': 'Length',
    'common.turns': 'Turns', 'common.drsZones': 'DRS zones', 'common.lapRecord': 'Lap record',
    'common.viewAll': 'View all', 'common.close': 'Close', 'common.km': 'km', 'common.retry': 'Retry',
    'common.backHome': 'Back home', 'common.details': 'Details', 'common.lastUpdate': 'Updated',

    'home.heroKicker': 'F1 FAN HQ — GRID. PADDOCK. PITWALL.',
    'home.heroTitle1': 'Everything F1,', 'home.heroTitle2': 'from the pit wall.',
    'home.heroLead': 'Live timing, standings, calendar, driver & team intel — plus predictions, a race simulator, quizzes and a fan zone. One hub for every kind of fan.',
    'home.nextRace': 'Next race', 'home.countdown': 'Until lights out', 'home.raceWeekend': 'Race weekend',
    'home.sessionFp1': 'FP1', 'home.sessionFp2': 'FP2', 'home.sessionFp3': 'FP3', 'home.sessionQuali': 'Qualifying',
    'home.sessionSprint': 'Sprint', 'home.sessionRace': 'Race',
    'home.liveNow': 'Live right now', 'home.newsTicker': 'News ticker',
    'home.gamesTitle': 'Learn F1 by playing', 'home.gamesSub': 'Predict, simulate and quiz your way to the top of the fan league.',
    'home.predictCta': 'Call the next race and race for points',
    'home.simCta': 'Run your own race simulation',
    'home.quizCta': 'Take the F1 quiz and build a streak',
    'home.fanCtaTitle': 'Register your favourites', 'home.fanCtaSub': 'Pick a driver and a team — the whole site wears their colours.',
    'home.topRecords': 'All-time records', 'home.myDriver': 'My driver', 'home.myTeam': 'My team',
    'home.pickFavorites': 'Pick favourites', 'home.seasonReview': 'Season review', 'home.championsTitle': 'Champions',
    'home.upcomingTitle': 'Featured races', 'home.viewStandings': 'Standings', 'home.viewCalendar': 'Calendar',
    'home.noUpcoming': 'No upcoming race (off-season, or connect live data to see the next one)',
    'home.guideTitle': 'New to F1?', 'home.guideSub': 'These six terms cover most of it.',
    'home.liveBadge': 'Race in progress',
    'home.glossary': 'F1 glossary',

    'live.title': 'Live timing', 'live.sub': 'Positions, gaps, tyres and weather in real time (OpenF1).',
    'live.positions': 'Positions', 'live.gap': 'Gap', 'live.interval': 'Interval', 'live.tyre': 'Tyre',
    'live.pit': 'Pit', 'live.weather': 'Conditions', 'live.airTemp': 'Air', 'live.trackTemp': 'Track',
    'live.humidity': 'Humidity', 'live.wind': 'Wind', 'live.rainProb': 'Rain %', 'live.noLive': 'No live data',
    'live.offlineMode': 'Offline mode', 'live.offlineMsg': 'Cannot reach the live API right now. In a connected environment, real-time data appears automatically.',
    'live.sessionSchedule': 'Session schedule', 'live.lap': 'Lap', 'live.driver': 'Driver', 'live.team': 'Team',
    'live.time': 'Time', 'live.selectSession': 'Select session', 'live.lastUpdate': 'Updated', 'live.safetyCar': 'Safety car',
    'live.notes': 'Flags, safety car and red flags come from the live API.',

    'standings.title': 'Standings', 'standings.sub': 'This season’s drivers & constructors, plus the history books.',
    'standings.drivers': 'Drivers', 'standings.constructors': 'Constructors', 'standings.position': 'Pos',
    'standings.driver': 'Driver', 'standings.team': 'Team', 'standings.points': 'Points', 'standings.wins': 'Wins',
    'standings.allTime': 'Champions', 'standings.champions': 'Champions', 'standings.records': 'All-time records',
    'standings.offlineNote': 'Current standings load when the live API is reachable. Showing the history books meanwhile.',
    'standings.asOf': 'As of', 'standings.holder': 'Holder', 'standings.value': 'Record', 'standings.year': 'Year',

    'calendar.title': 'Calendar', 'calendar.sub': 'All 24 rounds of 2025 with circuit facts.',
    'calendar.upcoming': 'Upcoming', 'calendar.completed': 'Completed', 'calendar.countdownTo': 'To the race',
    'calendar.circuitInfo': 'Circuit facts', 'calendar.raceDay': 'Race day', 'calendar.roundLabel': 'Rd.',
    'calendar.lapRecordBy': 'Lap record holder',

    'drivers.title': 'Drivers', 'drivers.sub': 'The current grid — profiles, career numbers and more.',
    'drivers.filterTeam': 'Filter by team', 'drivers.number': 'Number', 'drivers.debut': 'Debut', 'drivers.titles': 'Titles',
    'drivers.career': 'Career stats (approx.)', 'drivers.addFav': 'Add favourite', 'drivers.removeFav': 'Remove favourite',
    'drivers.bio': 'Profile', 'drivers.stats': 'Stats', 'drivers.teammate': 'Team mate', 'drivers.rating': 'PITWALL rating',
    'drivers.noResults': 'No drivers found', 'drivers.flag': 'Nationality',

    'teams.title': 'Teams', 'teams.sub': 'Ten teams — profiles, line-ups, history.',
    'teams.base': 'Base', 'teams.founded': 'Founded', 'teams.titles': 'Titles', 'teams.powerUnit': 'Power unit',
    'teams.lineup': 'Line-up', 'teams.note': 'Note', 'teams.championships': 'World titles',

    'predict.title': 'Predictions', 'predict.sub': 'Call P1-P3 and the fastest lap for the next race. Scored against the simulator.',
    'predict.selectRace': 'Choose a race', 'predict.pickP1': 'P1 (winner)', 'predict.pickP2': 'P2', 'predict.pickP3': 'P3',
    'predict.pickFL': 'Fastest lap', 'predict.submit': 'Submit prediction', 'predict.myPicks': 'Your predictions',
    'predict.leaderboard': 'Leaderboard', 'predict.scoring': 'Scoring', 'predict.scoringDesc': 'P1=10 / P2=7 / P3=5 / FL=5. All three on the podium = +5 bonus.',
    'predict.name': 'Display name', 'predict.pointsEarned': 'Points earned', 'predict.savedPicks': 'Saved predictions', 'predict.noPicks': 'No predictions yet',
    'predict.yourName': 'Your name', 'predict.submitDone': 'Prediction saved!', 'predict.clear': 'Clear',
    'predict.fastestLap': 'fastest lap',
    'league.title': 'Prediction Leagues', 'league.sub': 'Compete across Front Runners, Top 3 and Fastest Lap leagues.',
    'league.yourLeagues': 'Your leagues', 'league.join': 'Join league', 'league.joined': 'Joined',
    'league.roundPicks': 'Your picks this round', 'league.p1Hint': 'P1', 'league.flHint': 'Fastest lap',
    'league.standings': 'Standings', 'league.points': 'Points', 'league.noLeagues': 'No leagues yet.',
    'league.myEntry': 'Your entry', 'league.entryName': 'Entry name', 'league.create': 'Create league',
    'league.scoreRound': 'Score the race', 'league.simulatedResult': 'Score with the simulated result',
    'league.me': 'You', 'league.totalPts': 'Total',
    'league.metric.p1': 'Exact P1', 'league.metric.top3': 'Podium', 'league.metric.fl': 'FL',
    'league.needPick': 'Pick a P1 (or FL) first',
    'league.scoreNote': 'Scores are stored in localStorage and work on static hosts',

    'sim.title': 'Race simulator', 'sim.sub': 'Recreate a race from PITWALL ratings and team strength. Perfect for checking predictions.',
    'sim.chooseRace': 'Choose a race', 'sim.run': 'Run the race', 'sim.running': 'Race running…', 'sim.results': 'Results',
    'sim.seasonSim': 'Full-season simulation', 'sim.seasonResults': 'Final standings', 'sim.reset': 'Reset',
    'sim.progress': 'Progress', 'sim.standings': 'Drivers', 'sim.constructors': 'Constructors',
    'sim.points': 'Points', 'sim.simByPitwall': 'PITWALL simulator',

    'quiz.title': 'F1 Quiz', 'quiz.sub': 'Five questions per category. +10 XP per correct answer, streak bonuses.',
    'quiz.start': 'Start', 'quiz.next': 'Next', 'quiz.finish': 'See results', 'quiz.score': 'Score', 'quiz.xp': 'XP',
    'quiz.streak': 'Streak', 'quiz.bestStreak': 'Best streak', 'quiz.level': 'Level', 'quiz.correct': 'Correct!', 'quiz.wrong': 'Wrong…',
    'quiz.resultTitle': 'Results', 'quiz.playAgain': 'Play again', 'quiz.category': 'Category',
    'quiz.questionOf': 'Q', 'quiz.chooseCategory': 'Pick a category to start', 'quiz.all': 'All',
    'quiz.cat.history': 'History', 'quiz.cat.driver': 'Drivers', 'quiz.cat.team': 'Teams', 'quiz.cat.circuit': 'Circuits', 'quiz.cat.rule': 'Rules',

    'news.title': 'News', 'news.sub': 'Latest F1 stories (live RSS; archive stories while offline).',
    'news.source': 'Source', 'news.offlineFeed': 'Offline archive (live RSS unreachable)', 'news.readMore': 'Read more',
    'news.tag': 'Tag', 'news.noItems': 'No articles',

    'fan.title': 'Fan Zone', 'fan.sub': 'Register your favourites and make the site yours.',
    'fan.yourName': 'Your name', 'fan.favDriver': 'Favourite driver', 'fan.favTeam': 'Favourite team', 'fan.save': 'Save',
    'fan.saved': 'Saved!', 'fan.yourCard': 'Your fan card', 'fan.memberSince': 'Member since', 'fan.reset': 'Reset',
    'fan.accentApplied': 'The site accent is now your team colour.', 'fan.xp': 'Quiz XP',
    'fan.predictions': 'Prediction points', 'fan.choose': 'Choose', 'fan.noFav': 'Not set', 'fan.edit': 'Edit',
    'fan.favorite': 'Favourite', 'fan.favorites': 'Favourite drivers',

    'misc.notFound': 'Page not found', 'misc.notFoundMsg': 'Check the URL or head back home.',
    'glossary.drs': 'DRS (Drag Reduction System)', 'glossary.drs.d': 'A moveable rear wing that helps overtaking. Available within 1 second of the car ahead in designated zones.',
    'glossary.understeer': 'Understeer', 'glossary.understeer.d': 'The front slides and the car will not turn enough. Usually a lack of front grip.',
    'glossary.overtake': 'Overtake', 'glossary.overtake.d': 'Passing the car ahead — via DRS, tyre offset or sheer driver attack.',
    'glossary.slipstream': 'Slipstream', 'glossary.slipstream.d': 'Less air resistance behind another car, giving extra straight-line speed.',
    'glossary.safetycar': 'Safety car', 'glossary.safetycar.d': 'Leads the field at reduced speed when there is danger. A golden pit-stop window.',
    'glossary.degradation': 'Tyre degradation', 'glossary.degradation.d': 'Tyres wear and lose grip — the key to pit strategy.',

    'nav.social': 'Fan SNS', 'nav.league': 'Leagues',

    'social.title': 'Fan SNS', 'social.sub': 'A hangout for F1 fans. Talk favourites, moments and predictions.',
    'social.compose': 'What’s on your mind?', 'social.placeholder': 'Post about F1 (up to 280 chars)',
    'social.post': 'Post', 'social.timeline': 'Timeline', 'social.myPosts': 'My posts',
    'social.all': 'All', 'social.like': 'Like', 'social.likes': 'Likes',
    'social.replies': 'Replies', 'social.replyPlaceholder': 'Write a reply…', 'social.sendReply': 'Reply',
    'social.replyCount': (n) => `${n} replies`, 'social.noReplies': 'No replies yet. Be the first!',
    'social.trends': 'Trending tags', 'social.noPosts': 'No posts yet — be the first!',
    'social.charCount': '/280', 'social.members': 'fans online', 'social.you': 'you',
    'social.justNow': 'just now', 'social.minAgo': 'm ago', 'social.hourAgo': 'h ago',
    'social.tagsHint': 'space-separated #tags',

    'ai.title': 'AI Prediction (PITWALL APEX)', 'ai.sub': '1,500 Monte Carlo runs over driver/team/circuit priors. Statistical model + optional LLM.',
    'ai.run': 'Run AI prediction', 'ai.running': 'Computing…', 'ai.winProb': 'Win %', 'ai.podiumProb': 'Podium %',
    'ai.top10Prob': 'Top-10 %', 'ai.expectedPoints': 'Expected pts', 'ai.recommended': 'AI picks',
    'ai.usePrediction': 'Use this prediction', 'ai.insight': 'AI insights', 'ai.confidence': 'Confidence',
    'ai.source': 'Engine', 'ai.model': 'Model', 'ai.table': 'Prediction table',
    'ai.upsetPick': 'Upset pick', 'ai.llmBadge': 'LLM link', 'ai.offlineNote': 'Offline: computed by the APEX statistical model.',
    'ai.applied': 'Applied to the prediction form',
    'ai.learning': 'AI form learning', 'ai.samples': 'Samples', 'ai.accuracy': 'Hit rate',
    'ai.mae': 'Mean abs. error (pos)', 'ai.biasApplied': 'Learned bias', 'ai.resetLearning': 'Reset learning',
    'ai.noLearning': 'No learning data yet — predict, then score to start learning.',

    'fresh.updated': 'Updated', 'fresh.auto': 'Auto-refresh', 'fresh.live': 'Live data',
    'fresh.archiveBanner': 'Archive view',
    'fresh.archiveMsg': 'You are viewing bundled archive data ({season}). In a connected environment the current season loads automatically.'
  }
}

const LangContext = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('pitwall.lang') || 'ja')
  useEffect(() => { localStorage.setItem('pitwall.lang', lang) }, [lang])
  useEffect(() => { document.documentElement.lang = lang === 'ja' ? 'ja' : 'en' }, [lang])
  const t = useCallback((key, vars) => {
    let s = (dict[lang] && dict[lang][key]) ?? dict.ja[key] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
    return s
  }, [lang])
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within LangProvider')
  return ctx
}
