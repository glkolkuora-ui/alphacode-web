import { useState, useEffect, useCallback, useRef } from 'react'
import type { BotStatus, BalanceInfo, TradeRecord, BotConfig } from '../types'
import ConfigPanel from '../components/ConfigPanel'
import ScoreBoard from '../components/ScoreBoard'
import TradeLog from '../components/TradeLog'
import LiveChart from '../components/LiveChart'
import LogConsole from '../components/LogConsole'
import { formatCurrency } from '../lib/currency'
import { useI18n } from '../i18n/I18nProvider'

export default function Operacoes() {
  const { t } = useI18n()
  const tRef = useRef(t)
  tRef.current = t
  const [balances, setBalances] = useState<BalanceInfo[]>([])
  const [status,   setStatus]   = useState<BotStatus | null>(null)
  const [logs,     setLogs]     = useState<string[]>([])
  const [loading,  setLoading]  = useState(true)
  const [configOpen, setConfigOpen] = useState(false)
  const [opsPane, setOpsPane] = useState<'placar' | 'historico' | 'log'>('placar')
  const [activeBalance, setActiveBalance] = useState(0)
  const [displayBalanceId, setDisplayBalanceId] = useState<number | null>(null)

  const addLog = useCallback((msg: string) => setLogs(p => [msg, ...p].slice(0, 200)), [])

  const currency =
    status?.currency
    ?? balances.find(b => b.id === displayBalanceId)?.currency
    ?? balances.find(b => b.id === status?.balanceId)?.currency
    ?? balances.find(b => b.type === 'real')?.currency
    ?? balances[0]?.currency
    ?? 'USD'

  const currencyRef = useRef(currency)
  currencyRef.current = currency

  useEffect(() => {
    async function init() {
      setLoading(true)
      const bRes = await window.alphaCode.sdkBalances()
      if (bRes.ok && bRes.balances) setBalances(bRes.balances)
      setStatus(await window.alphaCode.botGetStatus())
      setLoading(false)
    }
    init()

    const unsubs = [
      window.alphaCode.on('session:hello', (p: { running?: boolean }) => {
        if (p?.running) {
          void window.alphaCode.botGetStatus().then((s) => { if (s) setStatus(s) })
        }
      }),
      window.alphaCode.on('bot:status',        s  => setStatus(s)),
      window.alphaCode.on('bot:started',        s  => { setStatus(s); addLog(tRef.current('ops.logStarted')) }),
      window.alphaCode.on('bot:stopped',        s  => { setStatus(s); setDisplayBalanceId(null); addLog(tRef.current('ops.logStopped')) }),
      window.alphaCode.on('bot:trade_entered', (t: TradeRecord) =>
        addLog(tRef.current('ops.logEntry', { strategy: t.strategy, direction: t.direction, amount: formatCurrency(t.amount, currencyRef.current) }))),
      window.alphaCode.on('bot:trade_result',  (tr: TradeRecord) =>
        addLog(`[${tr.result}] ${tr.strategy} ${tr.direction} ${tr.profit >= 0 ? '+' : ''}${formatCurrency(tr.profit, currencyRef.current)}`)),
      window.alphaCode.on('bot:stop_triggered',(d: any) => {
        const map: Record<string, 'ops.stopReason.stop_loss' | 'ops.stopReason.stop_win' | 'ops.stopReason.consec_losses'> = {
          stop_loss: 'ops.stopReason.stop_loss',
          stop_win: 'ops.stopReason.stop_win',
          consec_losses: 'ops.stopReason.consec_losses',
        }
        const reasonKey = map[String(d.reason)]
        addLog(tRef.current('ops.logStop', { reason: reasonKey ? tRef.current(reasonKey) : String(d.reason ?? '') }))
      }),
      window.alphaCode.on('bot:log',           (m: string) => addLog(m)),
      window.alphaCode.on('bot:balance',       (v: number) => setActiveBalance(v)),
      window.alphaCode.on('bot:error',         (e: string) => addLog(tRef.current('ops.logError', { error: e }))),
    ]
    const poll = window.setInterval(() => {
      void window.alphaCode.botGetStatus().then((s) => { if (s) setStatus(s) })
    }, 2000)
    return () => {
      unsubs.forEach(u => u())
      window.clearInterval(poll)
    }
  }, [addLog])

  async function handleStart(config: BotConfig) {
    setConfigOpen(false)
    const res = await window.alphaCode.botStart(config)
    const statusRes = (res as any)?.status ?? await window.alphaCode.botGetStatus()
    if (statusRes) setStatus(statusRes)
    if (!res.ok) addLog(t('ops.logError', { error: res.error ?? '' }))
    else setDisplayBalanceId(config.balanceId)
  }

  async function handleStop() {
    await window.alphaCode.botStop()
    const s = await window.alphaCode.botGetStatus()
    if (s) setStatus(s)
  }

  async function openConfig() {
    setLoading(true)
    try {
      const bRes = await window.alphaCode.sdkBalances()
      if (bRes.ok && bRes.balances) setBalances(bRes.balances)
      else addLog(t('ops.logError', { error: bRes.error ?? 'Sem saldo da corretora' }))
    } finally {
      setLoading(false)
      setConfigOpen(true)
    }
  }

  const isRunning = status?.running ?? false

  const sessionAction = !isRunning ? (
    <button className="btn-start" onClick={() => void openConfig()} disabled={loading}>
      {t('ops.start')}
      <span className="btn-start-pulse" aria-hidden>
        <svg viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" fill="currentColor" />
        </svg>
      </span>
    </button>
  ) : (
    <button className="btn-stop" onClick={handleStop}>
      {t('ops.stop')}
      <span className="btn-stop-mark" aria-hidden>
        <svg viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
        </svg>
      </span>
    </button>
  )

  return (
    <div className={`operacoes${isRunning ? ' operacoes--live' : ''}`}>
      <div className={`operacoes-body operacoes-body--${opsPane}`} data-dock={opsPane}>
        <div className="operacoes-chart">
          <LiveChart activeId={status?.activeId} activeTicker={status?.activeTicker} />
        </div>
        <div className="operacoes-mobile-tabs" role="tablist" aria-label={t('ops.panes')} data-dock={opsPane}>
          <button
            type="button"
            role="tab"
            aria-selected={opsPane === 'log'}
            className={opsPane === 'log' ? 'active' : ''}
            onClick={() => setOpsPane('log')}
          >
            {t('log.title')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={opsPane === 'placar'}
            className={opsPane === 'placar' ? 'active' : ''}
            onClick={() => setOpsPane('placar')}
          >
            {t('score.title')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={opsPane === 'historico'}
            className={opsPane === 'historico' ? 'active' : ''}
            onClick={() => setOpsPane('historico')}
          >
            {t('trades.title')}
          </button>
        </div>
        <div className="operacoes-dock">
          <LogConsole logs={logs} />
          <ScoreBoard
            status={status}
            activeBalance={activeBalance}
            currency={currency}
            action={sessionAction}
          />
          <TradeLog trades={status?.trades ?? []} currency={currency} />
        </div>
        <div className="operacoes-mobile-cta">
          {sessionAction}
        </div>
      </div>

      {configOpen && (
        <ConfigPanel
          balances={balances}
          onStart={handleStart}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </div>
  )
}
