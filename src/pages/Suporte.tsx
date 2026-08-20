import { useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'

export default function Suporte() {
  const { t } = useI18n()
  const [open, setOpen] = useState(0)
  const faqs = [
    { q: t('support.faq1q'), a: t('support.faq1a') },
    { q: t('support.faq2q'), a: t('support.faq2a') },
    { q: t('support.faq3q'), a: t('support.faq3a') },
    { q: t('support.faq4q'), a: t('support.faq4a') },
    { q: t('support.faq5q'), a: t('support.faq5a') },
    { q: t('support.faq6q'), a: t('support.faq6a') },
  ]

  return (
    <div className="page-content suporte-page">
      <div className="page-header">
        <span className="ops-kicker">{t('support.title')}</span>
        <h1 className="page-title">{t('support.subtitle')}</h1>
      </div>

      <div className="suporte-layout">
        <div className="faq-list">
          {faqs.map((f, i) => {
            const isOpen = open === i
            return (
              <div key={i} className={`faq-item${isOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="faq-q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span>{f.q}</span>
                  <svg viewBox="0 0 16 16" aria-hidden>
                    {isOpen
                      ? <path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      : <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
                  </svg>
                </button>
                {isOpen && <div className="faq-a">{f.a}</div>}
              </div>
            )
          })}
        </div>

        <aside className="suporte-contato">
          <div className="contato-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 3v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v9z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="contato-titulo">{t('support.contactTitle')}</div>
          <p className="contato-desc">{t('support.contactDesc')}</p>
          <p className="contato-hours">{t('support.hours')}</p>
        </aside>
      </div>
    </div>
  )
}
