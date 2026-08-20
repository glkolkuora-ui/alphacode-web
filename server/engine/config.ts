/**
 * BROKER CONFIGURATION
 * Fica APENAS no processo principal do Electron.
 * O usuário jamais vê essas credenciais.
 */
import fs from 'fs'
import path from 'path'

function loadDotEnv() {
  try {
    const file = path.join(process.cwd(), '.env')
    if (!fs.existsSync(file)) return
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
  } catch {
    /* ignore */
  }
}
loadDotEnv()

export const BROKER_CONFIG = {
  /** Client ID Meta Code — reutilizado no Alpha Code. */
  clientId:     350522037064121,
  /**
   * Secret só no servidor (Railway BROKER_CLIENT_SECRET).
   * USE_EDGE_AUTH=false neste fork: o refresh não passa pelo vault do Alpha Code.
   */
  clientSecret: process.env.BROKER_CLIENT_SECRET ?? '',
  platformId:   482,
  wsUrl:        'wss://ws.trade.broker10.com/echo/websocket',
  apiUrl:       'https://api.trade.broker10.com',
  redirectUri:  process.env.BROKER_REDIRECT_URI ?? 'https://traderjusticeiro.com/auth/callback',
  scope:        'full offline_access',
}
