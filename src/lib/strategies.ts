/** Códigos internos do motor — o rótulo comercial é só na UI. */
export const STRATEGY_LABELS: Record<string, string> = {
  Q5: 'Alfa 5x',
  ALT: 'Xcode',
  LAST2: '2P1',
  HARD: 'Just Pro',
}

export function strategyLabel(code: string): string {
  return STRATEGY_LABELS[code] ?? code
}

const CODE_ORDER = ['LAST2', 'HARD', 'ALT', 'Q5'] as const

export function relabelStrategyText(text: string): string {
  return CODE_ORDER.reduce(
    (out, code) => out.replace(new RegExp(`\\b${code}\\b`, 'g'), STRATEGY_LABELS[code]),
    text,
  )
}
