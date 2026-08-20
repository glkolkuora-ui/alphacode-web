import type { TradeRecord } from '../types'
import { formatCurrency } from '../lib/currency'
import { useI18n } from '../i18n/I18nProvider'
import { strategyLabel } from '../lib/strategies'

interface Props {
  trades: TradeRecord[]
  currency?: string
}

function timeStr(ms: number, locale: string): string {
  return new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function ResultMark({ result }: { result: string }) {
  if (result === 'PENDING') {
    return (
      <span className="result-mark result-mark--pending" aria-hidden>
        <span />
      </span>
    )
  }
  if (result === 'WIN') {
    return (
      <svg className="result-mark" viewBox="0 0 16 16" aria-hidden>
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg className="result-mark" viewBox="0 0 16 16" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function TradeLog({ trades, currency = 'USD' }: Props) {
  const { t, bcp47 } = useI18n()
  return (
    <div className="tradelog">
      <div className="tradelog-header">
        <span>{t('trades.title')}</span>
        {trades.length > 0 && <span className="tradelog-count">{trades.length}</span>}
      </div>
      <div className="tradelog-body">
        {trades.length === 0 ? (
          <div className="tradelog-empty">{t('trades.empty')}</div>
        ) : (
          trades.map((trade) => (
            <div key={trade.id} className={`trade-row ${trade.result.toLowerCase()}`}>
              <div className="trade-left">
                <span className={`direction-badge ${trade.direction.toLowerCase()}`}>
                  {trade.direction}
                </span>
                <span className="strategy-tag">{strategyLabel(trade.strategy)}</span>
              </div>
              <div className="trade-center">
                <span className={`result-tag ${trade.result.toLowerCase()}`}>
                  <ResultMark result={trade.result} />
                  {trade.result}
                </span>
              </div>
              <div className="trade-right">
                {trade.result !== 'PENDING' && (
                  <span className={`profit-val ${trade.profit >= 0 ? 'win' : 'loss'}`}>
                    {trade.profit >= 0 ? '+' : ''}{formatCurrency(trade.profit, currency)}
                  </span>
                )}
                <span className="trade-time">{timeStr(trade.enteredAt, bcp47)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
