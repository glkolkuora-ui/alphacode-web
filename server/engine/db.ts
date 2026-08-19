import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL ?? ''

export const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('railway.internal') ? false : { rejectUnauthorized: false },
      max: 8,
    })
  : null

export function requirePool(): Pool {
  if (!pool) throw new Error('DATABASE_URL missing')
  return pool
}

export async function pingDb(): Promise<boolean> {
  if (!pool) return false
  try {
    await pool.query('SELECT 1')
    return true
  } catch {
    return false
  }
}

export async function applySchemaIfNeeded(): Promise<void> {
  if (!pool) {
    console.warn('[DB] DATABASE_URL ausente — schema não aplicado')
    return
  }
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql')
  if (!fs.existsSync(schemaPath)) {
    console.warn('[DB] schema.sql não encontrado em', schemaPath)
    return
  }
  const sql = fs.readFileSync(schemaPath, 'utf8')
  await pool.query(sql)
  console.log('[DB] schema aplicado')
}
