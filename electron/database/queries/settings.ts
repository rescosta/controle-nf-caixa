import { getDb } from '../db'

export const settingsQueries = {
  get: (key: string): string | null => {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  },
  set: (key: string, value: string): void => {
    getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  },
}
