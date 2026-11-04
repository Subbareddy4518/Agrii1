import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AdminTopBar from '../AdminTopBar.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

export default function Settings() {
  const { openSidebar } = useOutletContext()
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <div>
      <AdminTopBar title={t('admin.settings.title')} onMenuClick={openSidebar} />
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-cloud-200 shadow-card p-5 sm:p-6">
          <h3 className="font-display font-semibold text-forest-950 mb-4">
            {t('admin.settings.accountTitle')}
          </h3>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-forest-900/50">{t('admin.users.colName')}</dt>
              <dd className="text-forest-950 font-medium">{user?.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-forest-900/50">{t('admin.users.colMobile')}</dt>
              <dd className="text-forest-950 font-medium">{user?.mobile}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-forest-900/50">{t('admin.sidebar.role')}</dt>
              <dd className="text-forest-950 font-medium capitalize">{user?.role}</dd>
            </div>
          </dl>
          <p className="text-xs text-forest-900/40 mt-5">
            {t('admin.settings.passwordHint')}
          </p>
        </div>
      </div>
    </div>
  )
}
