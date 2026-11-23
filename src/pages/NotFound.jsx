import { Link } from 'react-router-dom'
import { useLang } from '../lib/i18n.jsx'
import { EmptyState } from '../components/common.jsx'

export default function NotFound() {
  const { t } = useLang()
  return (
    <section className="section container">
      <EmptyState icon="🏴" title={t('misc.notFound')} sub={t('misc.notFoundMsg')} action={<Link className="btn primary" to="/">{t('common.backHome')}</Link>} />
    </section>
  )
}
