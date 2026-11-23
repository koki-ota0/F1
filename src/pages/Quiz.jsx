import { useMemo, useState } from 'react'
import { useLang } from '../lib/i18n.jsx'
import { useApi } from '../lib/api.js'
import { SectionHead, Loading, Badge } from '../components/common.jsx'
import { useFan } from '../components/FanProvider.jsx'
import { fanLevel, fanLevelName } from '../lib/store.js'

const CATS = [
  ['history', 'quiz.cat.history'],
  ['driver', 'quiz.cat.driver'],
  ['team', 'quiz.cat.team'],
  ['circuit', 'quiz.cat.circuit'],
  ['rule', 'quiz.cat.rule']
]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Quiz() {
  const { t, lang } = useLang()
  const { data: all, loading } = useApi('/api/trivia')
  const { quiz, addXp } = useFan()
  const [cat, setCat] = useState(null)
  const [questions, setQuestions] = useState([])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [done, setDone] = useState(false)

  const start = (c) => {
    const pool = (all || []).filter((q) => (c === 'all' ? true : q.category === c))
    setCat(c)
    setQuestions(shuffle(pool).slice(0, 5))
    setIdx(0); setPicked(null); setScore(0); setStreak(0); setDone(false)
  }

  const choose = (i) => {
    if (picked != null) return
    setPicked(i)
    const ok = i === questions[idx].answer
    if (ok) { setScore((s) => s + 1); setStreak((s) => s + 1) } else setStreak(0)
  }

  const nextQ = () => {
    if (idx + 1 >= questions.length) {
      const xp = score * 10 + Math.max(0, streak - 1) * 2
      addXp(xp, streak)
      setDone(true)
    } else {
      setIdx((i) => i + 1); setPicked(null)
    }
  }

  const restart = () => { setCat(null); setQuestions([]); setDone(false) }

  if (loading) return <div className="section container"><Loading /></div>

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 820 }}>
        <SectionHead
          eyebrow="QUIZ"
          title={t('quiz.title')}
          sub={t('quiz.sub')}
          right={<Badge kind="gold">Lv.{fanLevel(quiz.xp)} · {quiz.xp} XP</Badge>}
        />

        {!cat && (
          <div className="grid grid-2">
            {[['all', 'quiz.all'], ...CATS].map(([key, label]) => (
              <button key={key} className="card hover" style={{ textAlign: 'left', border: '1px solid var(--line)', background: 'linear-gradient(180deg,var(--panel),var(--panel-2))' }} onClick={() => start(key)}>
                <div style={{ fontSize: 26 }}>{key === 'all' ? '🏆' : { history: '📜', driver: '🏎️', team: '🏭', circuit: '🗺️', rule: '📏' }[key]}</div>
                <div className="card-title" style={{ marginTop: 10 }}>{t(label)}</div>
                <div className="note" style={{ marginTop: 4 }}>{t('quiz.questionOf')} 5</div>
              </button>
            ))}
          </div>
        )}

        {cat && !done && questions.length > 0 && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span className="tag">{t(`quiz.cat.${cat === 'all' ? 'all' : cat}`)}</span>
              <span className="num" style={{ color: 'var(--accent-2)' }}>{t('quiz.questionOf')} {idx + 1}/{questions.length}</span>
            </div>
            <div className="progress" style={{ marginBottom: 18 }}><i style={{ width: `${((idx + 1) / questions.length) * 100}%` }} /></div>
            <h3 style={{ fontSize: 19, lineHeight: 1.5, margin: '0 0 18px' }}>{questions[idx].q}</h3>
            <div>
              {questions[idx].options.map((opt, i) => {
                const cls = picked == null ? '' : i === questions[idx].answer ? 'correct' : i === picked ? 'wrong' : ''
                return (
                  <button key={i} className={`quiz-opt ${cls}`} onClick={() => choose(i)} disabled={picked != null}>
                    {opt}
                  </button>
                )
              })}
            </div>
            {picked != null && (
              <div style={{ marginTop: 16 }}>
                <p className={picked === questions[idx].answer ? 'hl' : ''} style={{ fontWeight: 800, margin: '0 0 6px' }}>
                  {picked === questions[idx].answer ? `✅ ${t('quiz.correct')}` : `❌ ${t('quiz.wrong')}`}
                </p>
                <p className="note" style={{ margin: '0 0 14px' }}>{questions[idx].explain}</p>
                <button className="btn primary" onClick={nextQ}>{idx + 1 >= questions.length ? t('quiz.finish') : t('quiz.next')}</button>
              </div>
            )}
          </div>
        )}

        {done && (
          <div className="card" style={{ textAlign: 'center', padding: 34 }}>
            <div style={{ fontSize: 44 }}>🏁</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>{t('quiz.resultTitle')}</h3>
            <div className="grid grid-3" style={{ margin: '22px 0' }}>
              <div><div className="num" style={{ fontSize: 34, color: 'var(--accent-2)' }}>{score}/{questions.length}</div><div className="note">{t('quiz.score')}</div></div>
              <div><div className="num" style={{ fontSize: 34 }}>{score * 10 + Math.max(0, streak - 1) * 2}</div><div className="note">{t('quiz.xp')}</div></div>
              <div><div className="num" style={{ fontSize: 34 }}>{quiz.bestStreak}</div><div className="note">{t('quiz.bestStreak')}</div></div>
            </div>
            <p className="note">{t('quiz.level')}: Lv.{fanLevel(quiz.xp)} {fanLevelName(fanLevel(quiz.xp))} · {quiz.xp} XP</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
              <button className="btn primary" onClick={restart}>{t('quiz.playAgain')}</button>
              <button className="btn" onClick={() => start(cat)}>{t('quiz.start')}</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
