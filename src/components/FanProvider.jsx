import { createContext, useContext, useEffect } from 'react'
import { useFanProfile, useQuizProgress, usePredictions, fanLevel } from '../lib/store.js'
import { useApi } from '../lib/api.js'
import { readableAccentOnDark } from '../lib/color.js'

const FanContext = createContext(null)

export function FanProvider({ children }) {
  const { fan, update, reset } = useFanProfile()
  const { quiz, addXp, reset: resetQuiz } = useQuizProgress()
  const { preds, add, clear, setPreds } = usePredictions()
  const { data: teamsData } = useApi('/api/teams')
  const teams = teamsData || []
  const team = teams.find((t) => t.id === fan.team)

  useEffect(() => {
    if (!team?.color) {
      // no favourite team: restore the PITWALL theme defaults
      document.documentElement.style.removeProperty('--accent')
      document.documentElement.style.removeProperty('--accent-2')
      return
    }
    document.documentElement.style.setProperty('--accent', team.color)
    // text highlights need a contrast-safe variant of the livery colour
    document.documentElement.style.setProperty('--accent-2', readableAccentOnDark(team.color))
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
