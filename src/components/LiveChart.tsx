import { useEffect, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useI18n } from '../i18n/I18nProvider'

interface Props {
  activeId?: number
  activeTicker?: string
}

interface RawCandle {
  from: number
  open: number
  high?: number
  max?: number
  low?: number
  min?: number
  close: number
}

/** O gráfico trata Unix como UTC. Sem este deslocamento, o Brasil (UTC−3) vê 18h às 15h. */
function unixToChartTime(unixSeconds: number): UTCTimestamp {
  const sec = unixSeconds > 1e12 ? Math.floor(unixSeconds / 1000) : unixSeconds
  const d = new Date(sec * 1000)
  return Math.floor(
    Date.UTC(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      d.getSeconds(),
      d.getMilliseconds(),
    ) / 1000,
  ) as UTCTimestamp
}

function toBars(candles: RawCandle[]) {
  return candles
    .filter((c) => c && Number.isFinite(Number(c.from)))
    .map((c) => ({
      time: unixToChartTime(Number(c.from)),
      open: c.open,
      high: c.max ?? c.high ?? c.close,
      low: c.min ?? c.low ?? c.close,
      close: c.close,
    }))
}

export default function LiveChart({ activeId, activeTicker }: Props) {
  const { t, bcp47 } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const seriesRef = useRef<ReturnType<ReturnType<typeof createChart>['addSeries']> | null>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)
  const reloadRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current

    const readSize = () => {
      const r = el.getBoundingClientRect()
      return {
        width: Math.floor(r.width),
        height: Math.floor(r.height),
      }
    }

    let size = readSize()
    if (size.width < 80) size = { ...size, width: 80 }
    if (size.height < 200) size = { ...size, height: 200 }

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: '#0d0f14' },
        textColor: '#6b7280',
      },
      grid: {
        vertLines: { color: '#1a1d26' },
        horzLines: { color: '#1a1d26' },
      },
      crosshair: {
        vertLine: { color: '#3b82f6' },
        horzLine: { color: '#3b82f6' },
      },
      rightPriceScale: {
        borderColor: '#1a1d26',
      },
      timeScale: {
        borderColor: '#1a1d26',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 9,
        rightOffset: 4,
      },
      localization: {
        locale: bcp47,
      },
      width: size.width,
      height: size.height,
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })

    chartRef.current = chart
    seriesRef.current = series
    series.setData([])

    let cancelled = false
    let staleSize = false

    const paint = (candles: unknown) => {
      if (cancelled || !seriesRef.current) return
      const list = Array.isArray(candles) ? candles : []
      const bars = toBars(list)
      if (!bars.length) return
      seriesRef.current.setData(bars)
      chartRef.current?.timeScale().scrollToRealTime()
    }

    const syncSize = () => {
      const current = chartRef.current
      if (!current || !containerRef.current) return false
      const { width, height } = readSize()
      if (width < 40 || height < 40) {
        staleSize = true
        return false
      }
      current.applyOptions({ width, height })
      current.timeScale().scrollToRealTime()
      return true
    }

    const reload = () => {
      const ready = syncSize()
      if (!ready) return
      void window.alphaCode.botChartSnapshot?.().then((candles) => {
        if (cancelled) return
        paint(candles)
      }).catch(() => { /* sem snapshot ainda — segue com eventos ao vivo */ })
    }

    reloadRef.current = reload
    reload()

    const unsubHistory = window.alphaCode.on('bot:candles_history', (candles: RawCandle[]) => {
      paint(candles)
    })

    const unsubCandle = window.alphaCode.on('bot:candle', (c: RawCandle) => {
      if (!seriesRef.current) return
      const [bar] = toBars([c])
      if (!bar) return
      seriesRef.current.update(bar)
    })

    const unsubReset = window.alphaCode.on('bot:chart_reset', () => {
      seriesRef.current?.setData([])
    })

    const onVisible = () => {
      if (document.visibilityState === 'hidden') {
        staleSize = true
        return
      }
      requestAnimationFrame(() => {
        staleSize = true
        reload()
      })
    }

    const onResize = () => { syncSize() }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('resize', onResize)

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return
      const ready = syncSize()
      if (ready && staleSize) {
        staleSize = false
        reload()
      }
    })
    resizeObserver.observe(el)

    return () => {
      cancelled = true
      reloadRef.current = () => {}
      unsubHistory()
      unsubCandle()
      unsubReset()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('resize', onResize)
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [bcp47])

  useEffect(() => {
    reloadRef.current()
  }, [activeTicker])

  return (
    <div className="chart-wrap">
      <div className="chart-header">
        <span className="chart-pair">{activeTicker ?? '—'}</span>
        <span className="chart-tf">M1</span>
      </div>
      <div ref={containerRef} className="chart-container" />
      {!activeId && (
        <div className="chart-placeholder">
          {t('chart.startHint')}
        </div>
      )}
    </div>
  )
}
