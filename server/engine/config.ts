/**
 * BROKER CONFIGURATION
 * Fica APENAS no processo principal do Electron.
 * O usuário jamais vê essas credenciais.
 */
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
  redirectUri:  process.env.BROKER_REDIRECT_URI ?? 'https://claudepro.online/metacode/auth/callback',
  scope:        'full offline_access',
}
