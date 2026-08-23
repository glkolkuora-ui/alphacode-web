import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import LanguageSwitcher from '../components/LanguageSwitcher'

interface Props { onLoggedIn: () => void }
type Step = 'idle' | 'connecting'

function authQueryError(t: (key: any) => string): string | null {
  const raw = new URLSearchParams(window.location.search).get('auth')
  if (!raw || raw === 'ok') return null
  if (raw === 'denied') return t('login.authDenied')
  if (raw === 'no_verifier' || raw === 'no_verifier') return t('login.authExpired')
  if (raw === 'missing_code' || raw === 'missing_code') return t('login.authFailed')
  return t('login.authFailed')
}

export default function Login({ onLoggedIn }: Props) {
  const { t } = useI18n()
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  const onLoggedInRef = useRef(onLoggedIn)
  onLoggedInRef.current = onLoggedIn

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const auth = params.get('auth')
    if (auth === 'ok') {
      window.history.replaceState({}, '', window.location.pathname)
      try { sessionStorage.removeItem('cw_need_broker_login') } catch { /* ignore */ }
      onLoggedInRef.current()
      return
    }
    if (auth && auth !== 'ok') {
      setError(authQueryError(t) ?? t('login.authFailed'))
      window.history.replaceState({}, '', window.location.pathname)
    }

    const finish = () => {
      try { sessionStorage.removeItem('cw_need_broker_login') } catch { /* ignore */ }
      setIsConnecting(false)
      onLoggedInRef.current()
    }

    const unsubOk = window.alphaCode.on('broker:connected', finish)
    const unsubErr = window.alphaCode.on('broker:error', (msg: string) => {
      setIsConnecting(false)
      setError(typeof msg === 'string' ? msg : String(msg))
      setStep('idle')
    })

    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return
      if (ev.data?.channel === 'broker:connected') finish()
    }
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'cw_broker_auth' && ev.newValue) finish()
    }
    window.addEventListener('message', onMessage)
    window.addEventListener('storage', onStorage)

    const forceAuth = (() => {
      try { return sessionStorage.getItem('cw_need_broker_login') === '1' } catch { return false }
    })()

    void window.alphaCode.brokerIsConnected().then((res) => {
      if (res.connected && !forceAuth) finish()
    })

    const poll = window.setInterval(() => {
      if (forceAuth) return
      void window.alphaCode.brokerIsConnected().then((res) => {
        if (res.connected) finish()
      })
    }, 1500)

    return () => {
      unsubOk()
      unsubErr()
      window.removeEventListener('message', onMessage)
      window.removeEventListener('storage', onStorage)
      window.clearInterval(poll)
    }
  }, [t])

  async function handleLogin() {
    setIsConnecting(true)
    setError('')
    setStep('connecting')

    try {
      const savedEmail = (() => {
        try { return localStorage.getItem('alphacode_licensed_email') || '' } catch { return '' }
      })()
      if (savedEmail) {
        try { await window.alphaCode.setUserEmail(savedEmail) } catch { /* segue */ }
      }
      const res = await window.alphaCode.brokerStartAuth()
      if (!res.ok || !res.url) {
        setIsConnecting(false)
        setStep('idle')
        setError(res.error ?? t('login.authFailed'))
        return
      }

      let authUrl = res.url
      try {
        const auth = new URL(res.url)
        if (!auth.searchParams.get('state')) {
          auth.searchParams.set('state', window.location.origin)
        }
        authUrl = auth.toString()
      } catch { /* usa a URL do SDK */ }

      const bounce = new URL('https://traderjusticeiro.com/auth/callback')
      bounce.searchParams.set('web_return', window.location.origin)
      bounce.searchParams.set('auth_url', authUrl)
      // Mesma aba: popup + document.write no Windows deixa o site da Broker
      // em loading eterno e o desafio da Cloudflare não completa.
      window.location.assign(bounce.toString())
    } catch (err: any) {
      setIsConnecting(false)
      setStep('idle')
      setError(err?.message ?? t('login.authFailed'))
    }
  }

  return (
    <div className="login-page">
      <div className="login-orb" aria-hidden />
      <div className={`login-card glass-elevated${isConnecting ? ' login-card-loading' : ''}`}>
        <div className="login-card-accent" aria-hidden />
        {step === 'connecting' || isConnecting ? (
          <div className="login-loading">
            <div className="loading-spinner" aria-hidden />
            <h2>{t('login.connectingTitle')}</h2>
            <p>{t('login.connectingBody')}</p>
          </div>
        ) : (
        <>
        <div className="login-brand">
          <span className="brand-alpha">Alpha</span>
          <span className="brand-code">Code</span>
        </div>
        <p className="login-tagline">{t('login.tagline')}</p>
        <p className="login-desc">{t('login.desc')}</p>
        {error && <div className="login-error">{error}</div>}
        <button className="btn-broker" onClick={() => void handleLogin()}>
          {t('login.enter')}
        </button>
        </>
        )}
        <div className="login-lang-slot">
          <LanguageSwitcher variant="corner" />
        </div>
      </div>
    </div>
  )
}
