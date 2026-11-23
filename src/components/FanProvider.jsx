import { createContext, useContext, useEffect } from 'react'
import { useFanProfile, useQuizProgress, usePredictions, fanLevel } from '../lib/store.js'
import { useApi } from '../lib/api.js'

const FanContext = createContext(null)

export function FanProvider({ children }) {
  const { fan, update, reset } = useFanProfile()
  const { quiz, addXp, reset: resetQuiz } = useQuizProgress()
  const { preds, add, clear, setPreds } = usePredictions()
  const { data: teamsData } = useApi('/api/teams')
  const teams = teamsData || []
  const team = teams.find((t) => t.id === fan.team)

  useEffect(() => {
    const color = team?.color || '#e10600'
    document.documentElement.style.setProperty('--accent', color)
    document.documentElement.style.setProperty('--accent-2', color)
  }, [team?.color])

  const value = {
    fan, update, reset,
    quiz, addXp, resetQuiz,
    preds, addPred: add, clearPreds: clear, setPreds,
    teams,
    myTeam: team || null,
    level: fanLevel(quiz.xp)
  }
  return <FanContext.Provider value={value}>{children}</FanContext.Provider>
}

export function useFan() {
  const ctx = useContext(FanContext)
  if (!ctx) throw new Error('useFan must be used within FanProvider')
  return ctx
}
