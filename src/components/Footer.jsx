import { Link } from 'react-router-dom'
import { useLang } from '../lib/i18n.jsx'

export default function Footer() {
  const { t } = useLang()
  return (
    <footer className="footer">
      <div className="container">
        <div className="fgrid">
          <div>
            <div className="brand" style={{ marginBottom: 10 }}><span className="slash" /> PITWALL</div>
            <p className="note">
              F1ファンのためのオールインワンハブ。ライブタイミング・順位・カレンダー・ drivers/teams・予測・シミュレーター・クイズ・ファンゾーン。
            </p>
          </div>
          <div>
            <h5>CONTENTS</h5>
            <Link to="/live">{t('nav.live')}</Link>
            <Link to="/standings">{t('nav.standings')}</Link>
            <Link to="/calendar">{t('nav.calendar')}</Link>
          </div>
          <div>
            <h5>GAMES</h5>
            <Link to="/predict">{t('nav.predict')}</Link>
            <Link to="/sim">{t('nav.sim')}</Link>
            <Link to="/quiz">{t('nav.quiz')}</Link>
          </div>
          <div>
            <h5>FANS</h5>
            <Link to="/drivers">{t('nav.drivers')}</Link>
            <Link to="/teams">{t('nav.teams')}</Link>
            <Link to="/fan">{t('nav.fan')}</Link>
            <Link to="/news">{t('nav.news')}</Link>
            <Link to="/social">{t('nav.social')}</Link>
          </div>
        </div>
        <div className="fbot">
          <span>PITWALL is a fan-made demo. Not affiliated with Formula 1, Liberty Media or any team. Data: OpenF1 / Jolpica F1 / bundled dataset.</span>
          <span>© 2026 PITWALL · <a className="inline-link" href="https://kokilux.github.io/F1/" target="_blank" rel="noreferrer">kokilux.github.io/F1</a></span>
        </div>
      </div>
    </footer>
  )
}
