/** Prefixa o relógio local e troca qualquer hora UTC que veio do servidor. */
export function stampLog(msg: string, locale = 'pt-BR'): string {
  const time = new Date().toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const body = String(msg ?? '').replace(
    /^\[\d{1,2}:\d{2}:\d{2}(?:\.\d+)?(?:\s*[AP]M)?\]\s*/i,
    '',
  )
  return `[${time}] ${body}`
}
