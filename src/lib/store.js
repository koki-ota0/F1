import { useState, useEffect, useCallback } from 'react'

const PREFIX = 'pitwall.'

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function save(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)) } catch { /* ignore */ }
}

export function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => load(key, fallback))
  useEffect(() => { save(key, value) }, [key, value])
  return [value, setValue]
}

const FAN_DEFAULT = { name: '', driver: '', team: '', since: null }

export function useFanProfile() {
  const [fan, setFan] = usePersistentState('fan', FAN_DEFAULT)
  const update = useCallback((patch) => {
    setFan((prev) => {
      const next = { ...prev, ...patch }
      if (patch.driver || patch.team) next.since = prev.since || new Date().toISOString().slice(0, 10)
      return next
    })
  }, [setFan])
  const reset = useCallback(() => setFan(FAN_DEFAULT), [setFan])
  return { fan, update, reset }
}

export function useQuizProgress() {
  const [quiz, setQuiz] = usePersistentState('quiz', { xp: 0, bestStreak: 0, played: 0 })
  const addXp = useCallback((amount, streak) => {
    setQuiz((prev) => ({
      xp: prev.xp + amount,
      bestStreak: Math.max(prev.bestStreak, streak),
      played: prev.played + 1
    }))
  }, [setQuiz])
  return { quiz, addXp, reset: () => setQuiz({ xp: 0, bestStreak: 0, played: 0 }) }
}

export function usePredictions() {
  const [preds, setPreds] = usePersistentState('predictions', [])
  const add = useCallback((pred) => {
    setPreds((prev) => [{ ...pred, id: `p-${Date.now()}`, at: new Date().toISOString() }, ...prev].slice(0, 30))
  }, [setPreds])
  return { preds, add, clear: () => setPreds([]), setPreds }
}

export const fanLevel = (xp) => (xp < 100 ? 1 : xp < 300 ? 2 : xp < 600 ? 3 : xp < 1000 ? 4 : 5)
export const fanLevelName = (lv) => ['Rookie Fan', 'Grid Fan', 'Paddock Pass', 'Pit Wall', 'Team Principal'][lv - 1] || 'Fan'
