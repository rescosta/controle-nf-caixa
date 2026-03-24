import { getDb } from '../db'

export const relatoriosQueries = {
  list: () => getDb().prepare('SELECT * FROM relatorios_custo ORDER BY id DESC').all(),
  save: (nome: string, filtros: string) =>
    getDb().prepare('INSERT INTO relatorios_custo (nome, filtros) VALUES (?, ?)').run(nome, filtros),
  delete: (id: number) => getDb().prepare('DELETE FROM relatorios_custo WHERE id = ?').run(id),
}
