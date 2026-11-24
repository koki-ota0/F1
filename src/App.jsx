import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import { FanProvider } from './components/FanProvider.jsx'
import { RefreshProvider } from './components/RefreshProvider.jsx'
import { useLang } from './lib/i18n.jsx'
import Home from './pages/Home.jsx'
import Live from './pages/Live.jsx'
import Standings from './pages/Standings.jsx'
import Results from './pages/Results.jsx'
import CalendarPage from './pages/Calendar.jsx'
import Drivers from './pages/Drivers.jsx'
import DriverDetail from './pages/DriverDetail.jsx'
import Teams from './pages/Teams.jsx'
import TeamDetail from './pages/TeamDetail.jsx'
import Predict from './pages/Predict.jsx'
import Sim from './pages/Sim.jsx'
import Quiz from './pages/Quiz.jsx'
import News from './pages/News.jsx'
import Social from './pages/Social.jsx'
import League from './pages/League.jsx'
import Fan from './pages/Fan.jsx'
import NotFound from './pages/NotFound.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function Shell() {
  const { t } = useLang()
  return (
    <>
      <ScrollToTop />
      <a className="skip-link" href="#main">{t('common.skipToContent')}</a>
      <Navbar />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/live" element={<Live />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/results" element={<Results />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/drivers/:id" element={<DriverDetail />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/predict" element={<Predict />} />
          <Route path="/sim" element={<Sim />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/news" element={<News />} />
          <Route path="/social" element={<Social />} />
          <Route path="/league" element={<League />} />
          <Route path="/fan" element={<Fan />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <RefreshProvider>
      <FanProvider>
        <Shell />
      </FanProvider>
    </RefreshProvider>
  )
}
