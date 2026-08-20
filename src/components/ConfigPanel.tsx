import { useState, useEffect, useRef } from 'react'
import type { BalanceInfo, ActiveInfo, BotConfig } from '../types'
import { currencySymbol, formatCurrency } from '../lib/currency'
import { FEATURE_FLAGS } from '../feature-flags'
import { useI18n } from '../i18n/I18nProvider'

interface Props {
  balances: BalanceInfo[]
  onStart: (c: BotConfig) => void
  onClose: () => void
}

function activeOpenFor(a: ActiveInfo, ins: 'binary' | 'digital'): boolean {
  return ins === 'binary' ? a.availableBinary : a.availableDigital
}

// ── Persistência das configurações do bot ──────────────────────────────────
const CONFIG_STORAGE_KEY = 'alphacode:botConfig'

interface PersistedConfig {
  activeId?: number
  balanceId?: number
  entryAmount?: string
  stopLoss?: string
  stopWin?: string
  stopConsec?: string
  q5?: boolean
  alt?: boolean
  last2?: boolean
  hard?: boolean
  galeEnabled?: boolean
  galeRounds?: string
  sorosEnabled?: boolean
  sorosMaxLevel?: string
}

function loadPersistedConfig(): PersistedConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PersistedConfig) : {}
  } catch {
    return {}
  }
}

export default function ConfigPanel({ balances, onStart, onClose }: Props) {
  const { t } = useI18n()
  const saved = useRef(loadPersistedConfig()).current
  const realBalances = balances.filter(b => b.type === 'real')
  const savedBalanceValid =
    saved.balanceId != null && realBalances.some(b => b.id === saved.balanceId)

  const [actives, setActives] = useState<ActiveInfo[]>([])
  const [activesError, setActivesError] = useState('')
  const [activeId,    setActiveId]    = useState(saved.activeId ?? 0)
  const [balanceId,   setBalanceId]   = useState(
    savedBalanceValid ? saved.balanceId! : (realBalances[0]?.id ?? 0),
  )
  const [instrument] = useState<'binary' | 'digital'>('digital')
  const [entryAmount, setEntryAmount] = useState(saved.entryAmount ?? '5')
  const [stopLoss,    setStopLoss]    = useState(saved.stopLoss ?? '50')
  const [stopWin,     setStopWin]     = useState(saved.stopWin ?? '50')
  const [stopConsec,  setStopConsec]  = useState(saved.stopConsec ?? '3')
  // Estratégias
  const [q5,   setQ5]   = useState(saved.q5 ?? true)
  const [alt,  setAlt]  = useState(saved.alt ?? true)
  const [last2,setLast2]= useState(saved.last2 ?? true)
  const [hard, setHard] = useState(saved.hard ?? false)
  // Gale
  const [galeEnabled, setGaleEnabled] = useState(saved.galeEnabled ?? false)
  const [galeRounds,  setGaleRounds]  = useState(saved.galeRounds ?? '2')
  // Soros
  const [sorosEnabled, setSorosEnabled] = useState(saved.sorosEnabled ?? false)
  const [sorosMaxLevel, setSorosMaxLevel] = useState(saved.sorosMaxLevel ?? '1')

  // Salva as configurações a cada mudança (persistem ao fechar/reabrir o popup)
  useEffect(() => {
    const cfg: PersistedConfig = {
      activeId, balanceId, entryAmount, stopLoss, stopWin, stopConsec,
      q5, alt, last2, hard, galeEnabled, galeRounds, sorosEnabled, sorosMaxLevel,
    }
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg))
    } catch {
      /* storage indisponível — ignora */
    }
  }, [
    activeId, balanceId, entryAmount, stopLoss, stopWin, stopConsec,
    q5, alt, last2, hard, galeEnabled, galeRounds, sorosEnabled, sorosMaxLevel,
  ])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await window.alphaCode.sdkActives(instrument)
      if (cancelled) return
      if (res.ok && res.actives) {
        setActives(res.actives)
        setActivesError(res.actives.length ? '' : t('config.noAsset'))
      } else {
        setActives([])
        setActivesError(res.error ?? t('config.noAsset'))
      }
    })()
    return () => { cancelled = true }
  }, [instrument])

  useEffect(() => {
    if (!actives.length) return
    const cur = actives.find(a => a.id === activeId)
    const firstAvail = actives.find(a => activeOpenFor(a, instrument))
    if (!cur || !activeOpenFor(cur, instrument)) {
      if (firstAvail) setActiveId(firstAvail.id)
      else setActiveId(actives[0].id)
    }
  }, [actives, activeId, instrument])

  function handleStart() {
    const active = actives.find(a => a.id === activeId)
    if (!active || !activeOpenFor(active, instrument)) return
    if (!bankrollOk) return
    onStart({
      activeId: active.id, activeTicker: active.ticker,
      instrument, balanceId: Number(balanceId),
      entryAmount: Number(entryAmount) || 5,
      strategies: { q5, alt, last2, hard },
      stopLoss: Number(stopLoss) || 0,
      stopWin:  Number(stopWin)  || 0,
      stopConsecLosses: Number(stopConsec) || 0,
      galeEnabled, galeRounds: Number(galeRounds) || 2,
      sorosEnabled: FEATURE_FLAGS.SOROS_ENABLED && sorosEnabled,
      sorosMaxLevel: Math.max(1, Math.min(3, Number(sorosMaxLevel) || 1)),
    })
  }

  const anyStrategy = q5 || alt || last2 || hard
  const selectedActive = actives.find(a => a.id === activeId)

  const selectedBalance = balances.find(b => String(b.id) === String(balanceId)) ?? null
  const currentCurrency = selectedBalance?.currency ?? 'USD'

  // Trava: banca mínima para ativar o bot
  const MIN_BANKROLL = 60
  const balanceAmount = selectedBalance?.amount ?? 0
  const bankrollOk = balanceAmount >= MIN_BANKROLL
  const sym = currencySymbol(currentCurrency)
  const sessionPair = selectedActive
    ? `${selectedActive.ticker}${selectedActive.isOtc ? ' OTC' : ''}`
    : t('config.selectAsset')

  function handleToggleHard(next: boolean) {
    setHard(next)
    if (next) {
      setQ5(false)
      setAlt(false)
      setLast2(false)
    }
  }

  function handleToggleNormal(setter: (v: boolean) => void, next: boolean) {
    setter(next)
    if (next && hard) setHard(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--setup" onClick={e => e.stopPropagation()}>
        <div className="modal-header setup-head">
          <div className="setup-head-copy">
            <span className="modal-title">{t('config.title')}</span>
            <p className="setup-head-sub">{sessionPair} · Digital</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('config.close')}>✕</button>
        </div>

        <div className="modal-body setup-body">
          <section className="setup-block">
            <div className="setup-grid">
              <div className="field-group setup-span-2">
                <label>{t('config.pair')}</label>
                <ActiveSelect
                  actives={actives}
                  value={activeId}
                  instrument={instrument}
                  onChange={setActiveId}
                />
              </div>
              <div className="field-group">
                <label>{t('config.baseAmount', { sym })}</label>
                <input type="number" min="1" value={entryAmount} onChange={e => setEntryAmount(e.target.value)} />
              </div>
              <div className="field-group setup-span-3">
                <label>{t('config.account')}</label>
                <AccountSelect
                  balances={realBalances}
                  value={balanceId}
                  onChange={setBalanceId}
                />
              </div>
            </div>
            {activesError && <div className="config-warning">{activesError}</div>}
            {!bankrollOk && (
              <div className="config-warning">
                {t('config.minBankroll', {
                  min: formatCurrency(MIN_BANKROLL, currentCurrency),
                  balance: formatCurrency(balanceAmount, currentCurrency),
                })}
              </div>
            )}
          </section>

          <section className="setup-block">
            <div className="setup-block-label">{t('config.strategies')}</div>
            <div className="strategy-chips" role="group" aria-label={t('config.strategies')}>
              <StrategyToggle label="Q5" active={q5} onChange={v => handleToggleNormal(setQ5, v)} disabled={hard} />
              <StrategyToggle label="ALT" active={alt} onChange={v => handleToggleNormal(setAlt, v)} disabled={hard} />
              <StrategyToggle label="LAST2" active={last2} onChange={v => handleToggleNormal(setLast2, v)} disabled={hard} />
              <StrategyToggle label="HARD" active={hard} onChange={handleToggleHard} />
            </div>
            {!anyStrategy && <div className="config-warning">{t('config.needStrategy')}</div>}

            <div className="setup-opt">
              <div className="setup-opt-row">
                <div>
                  <div className="setup-opt-name">{t('config.gale')}</div>
                  {galeEnabled && (
                    <p className="setup-opt-help">
                      {t('config.galeHelp', {
                        ladder: Array.from({ length: Number(galeRounds) + 1 }, (_, i) =>
                          formatCurrency(Number(entryAmount || 5) * Math.pow(2, i), currentCurrency)
                        ).join(' → '),
                      })}
                    </p>
                  )}
                </div>
                <Toggle active={galeEnabled} onChange={setGaleEnabled} />
              </div>
              {galeEnabled && (
                <div className="setup-opt-extra">
                  <label>{t('config.galeRounds')}</label>
                  <input type="number" min="1" max="5" value={galeRounds} onChange={e => setGaleRounds(e.target.value)} />
                </div>
              )}
            </div>

            {FEATURE_FLAGS.SOROS_ENABLED && (
              <div className="setup-opt">
                <div className="setup-opt-row">
                  <div className="setup-opt-name">{t('config.soros')}</div>
                  <Toggle active={sorosEnabled} onChange={setSorosEnabled} />
                </div>
                {sorosEnabled && (
                  <div className="setup-opt-extra">
                    <label>{t('config.sorosLevels')}</label>
                    <input
                      type="number"
                      min="1"
                      max="3"
                      value={sorosMaxLevel}
                      onChange={e => setSorosMaxLevel(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="setup-block">
            <div className="setup-block-label">{t('config.risk')}</div>
            <div className="protect-grid">
              <div className="field-group">
                <label>{t('config.stopLoss', { sym })}</label>
                <input type="number" min="0" value={stopLoss} onChange={e => setStopLoss(e.target.value)} placeholder={t('config.disabledPh')} />
              </div>
              <div className="field-group">
                <label>{t('config.stopWin', { sym })}</label>
                <input type="number" min="0" value={stopWin} onChange={e => setStopWin(e.target.value)} placeholder={t('config.disabledPh')} />
              </div>
              <div className="field-group">
                <label>{t('config.consecLosses')}</label>
                <input type="number" min="0" value={stopConsec} onChange={e => setStopConsec(e.target.value)} placeholder={t('config.disabledPh')} />
              </div>
            </div>
          </section>
        </div>

        <div className="modal-footer setup-foot">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('config.cancel')}</button>
          <button
            type="button"
            className="btn-primary setup-start"
            onClick={handleStart}
            disabled={
              !anyStrategy ||
              !selectedActive ||
              !activeOpenFor(selectedActive, instrument) ||
              (hard && (q5 || alt || last2)) ||
              !bankrollOk
            }
          >
            {t('config.start')}
          </button>
        </div>
      </div>
    </div>
  )
}

function StrategyToggle({ label, active, onChange, disabled }: {
  label: string
  active: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`strategy-chip${active ? ' on' : ''}${disabled ? ' disabled' : ''}`}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => !disabled && onChange(!active)}
    >
      {label}
    </button>
  )
}

function Toggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`toggle ${active ? 'on' : ''}`} onClick={() => onChange(!active)} style={{cursor:'pointer'}}>
      <div className="toggle-knob" />
    </div>
  )
}

/* Dropdown customizado de ativo — grupos (Aberto/OTC), busca e itens fechados travados */
function ActiveSelect({
  actives,
  value,
  instrument,
  onChange,
}: {
  actives: ActiveInfo[]
  value: number
  instrument: 'binary' | 'digital'
  onChange: (id: number) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = actives.find(a => a.id === value) ?? null

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    // Foca a busca ao abrir
    requestAnimationFrame(() => searchRef.current?.focus())
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const q = query.trim().toUpperCase()
  const match = (a: ActiveInfo) => !q || a.ticker.toUpperCase().includes(q)
  const openMarket = actives.filter(a => !a.isOtc && match(a))
  const otcMarket = actives.filter(a => a.isOtc && match(a))

  function pick(a: ActiveInfo) {
    if (!activeOpenFor(a, instrument)) return
    onChange(a.id)
    setOpen(false)
    setQuery('')
  }

  function renderOption(a: ActiveInfo, otc: boolean) {
    const isOpen = activeOpenFor(a, instrument)
    return (
      <li
        key={a.id}
        role="option"
        aria-selected={a.id === value}
        aria-disabled={!isOpen}
        className={[
          'asset-option',
          a.id === value ? 'active' : '',
          isOpen ? '' : 'disabled',
        ].join(' ')}
        onClick={() => pick(a)}
      >
        <span className="asset-ticker">
          {a.ticker}{otc ? ' (OTC)' : ''}
        </span>
        {isOpen ? (
          a.id === value && <span className="asset-check" aria-hidden>✓</span>
        ) : (
          <span className="asset-closed">{t('config.closed')}</span>
        )}
      </li>
    )
  }

  return (
    <div className={`asset-select ${open ? 'open' : ''}`} ref={ref}>
      <button
        type="button"
        className="asset-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="asset-trigger-label">
          {selected ? `${selected.ticker}${selected.isOtc ? ' (OTC)' : ''}` : t('config.selectAsset')}
        </span>
        <span className="asset-chevron" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="asset-menu">
          <div className="asset-search-wrap">
            <input
              ref={searchRef}
              type="text"
              className="asset-search"
              placeholder={t('config.searchAsset')}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <ul className="asset-list" role="listbox">
            {openMarket.length > 0 && (
              <>
                <li className="asset-group-label" aria-hidden>{t('config.openMarket')}</li>
                {openMarket.map(a => renderOption(a, false))}
              </>
            )}
            {otcMarket.length > 0 && (
              <>
                <li className="asset-group-label" aria-hidden>OTC</li>
                {otcMarket.map(a => renderOption(a, true))}
              </>
            )}
            {openMarket.length === 0 && otcMarket.length === 0 && (
              <li className="asset-empty">{t('config.noAsset')}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

/* Ícone SVG customizado de dinheiro (cédula com cifrão) */
function MoneyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <rect x="2.4" y="6" width="19.2" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 10.1v3.8M13.1 10.9c-.2-.5-.7-.7-1.2-.7-.7 0-1.2.4-1.2.95 0 .55.5.8 1.2.9.7.1 1.2.35 1.2.9 0 .55-.5.95-1.2.95-.55 0-1-.25-1.2-.75"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <circle cx="5.4" cy="12" r="0.95" fill="currentColor" />
      <circle cx="18.6" cy="12" r="0.95" fill="currentColor" />
    </svg>
  )
}

/* Ícone SVG para conta demo (controle) */
function DemoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M7.5 8.5h9a4 4 0 0 1 3.96 3.42l.36 2.5A2.1 2.1 0 0 1 16.2 15l-.5-.7a1.5 1.5 0 0 0-1.22-.63H9.52A1.5 1.5 0 0 0 8.3 14.3l-.5.7a2.1 2.1 0 0 1-3.98-.58l.36-2.5A4 4 0 0 1 7.5 8.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M7.6 11v1.8M6.7 11.9h1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="15.8" cy="11.4" r="0.9" fill="currentColor" />
      <circle cx="17.2" cy="12.8" r="0.9" fill="currentColor" />
    </svg>
  )
}

/* Dropdown customizado da conta — permite ícone SVG por opção (impossível em <option> nativo) */
function AccountSelect({
  balances,
  value,
  onChange,
}: {
  balances: BalanceInfo[]
  value: number
  onChange: (id: number) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = balances.find(b => String(b.id) === String(value)) ?? balances[0] ?? null

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function renderRow(b: BalanceInfo) {
    const isDemo = b.type === 'demo'
    return (
      <>
        <span className={`acct-ico ${isDemo ? 'demo' : 'real'}`}>
          {isDemo ? <DemoIcon /> : <MoneyIcon />}
        </span>
        <span className="acct-label">{isDemo ? t('config.demo') : t('config.real')}</span>
        <span className="acct-amount">
          {b.amount.toFixed(2)} {b.currency}
        </span>
      </>
    )
  }

  return (
    <div className={`acct-select ${open ? 'open' : ''}`} ref={ref}>
      <button
        type="button"
        className="acct-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? renderRow(selected) : <span className="acct-label">{t('config.select')}</span>}
        <span className="acct-chevron" aria-hidden>▾</span>
      </button>

      {open && balances.length > 0 && (
        <ul className="acct-menu" role="listbox">
          {balances.map(b => (
            <li
              key={b.id}
              role="option"
              aria-selected={String(b.id) === String(value)}
              className={`acct-option ${String(b.id) === String(value) ? 'active' : ''}`}
              onClick={() => {
                onChange(Number(b.id))
                setOpen(false)
              }}
            >
              {renderRow(b)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
