import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { runMigrations } from './migrations'

let db: Database.Database | undefined

export function getDbPath(): string {
  return join(app.getPath('userData'), 'controle-nf-caixa.db')
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath())
    db.function('normalize_search', (s: string | null): string => {
      if (!s) return ''
      return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    })
    runMigrations(db)
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = undefined
  }
}
