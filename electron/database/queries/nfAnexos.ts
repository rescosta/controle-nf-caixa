import { getDb } from '../db'

interface NFAnexo {
  id: number
  nf_id: number
  nome: string
  caminho: string
  tipo: string
}

export const nfAnexosQueries = {
  list: (nf_id: number): NFAnexo[] =>
    getDb().prepare('SELECT * FROM nf_anexos WHERE nf_id = ? ORDER BY id').all(nf_id) as NFAnexo[],

  create: (data: { nf_id: number; nome: string; caminho: string; tipo: string }) =>
    getDb().prepare(
      'INSERT INTO nf_anexos (nf_id, nome, caminho, tipo) VALUES (@nf_id, @nome, @caminho, @tipo)'
    ).run(data),

  delete: (id: number) =>
    getDb().prepare('DELETE FROM nf_anexos WHERE id = ?').run(id),
}
