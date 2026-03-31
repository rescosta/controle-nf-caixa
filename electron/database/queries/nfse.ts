import { getDb } from '../db'

export interface NfseServico {
  id: number
  empresa_id: number
  chave_acesso: string
  nsu: string
  numero: string
  serie: string
  competencia: string        // 'YYYY-MM'
  prestador_cnpj: string
  prestador_nome: string
  valor_servicos: number
  descricao: string
  status_pagamento: 'pendente' | 'pago'
  data_pagamento?: string
  xml_blob?: string
  fonte: string
  cancelada: number          // 0 = ativa, 1 = cancelada
  email_enviado: number      // 0 = não, 1 = enviado
  created_at: string
}

export const nfseServicosQueries = {
  list(filtros: {
    empresa_id: number
    prestador?: string
    ano?: string
    competencia?: string
    status_pagamento?: string
    fonte?: string
  }): NfseServico[] {
    let sql = 'SELECT * FROM nfse_servicos WHERE empresa_id = @empresa_id'
    const params: Record<string, unknown> = { empresa_id: filtros.empresa_id }

    if (filtros.prestador) {
      sql += ' AND (prestador_nome LIKE @prest OR prestador_cnpj LIKE @prest)'
      params.prest = `%${filtros.prestador}%`
    }
    if (filtros.ano) {
      sql += ' AND competencia LIKE @ano'
      params.ano = `${filtros.ano}%`
    }
    if (filtros.competencia) {
      sql += ' AND competencia = @competencia'
      params.competencia = filtros.competencia
    }
    if (filtros.status_pagamento && filtros.status_pagamento !== 'todas') {
      sql += ' AND status_pagamento = @status_pagamento'
      params.status_pagamento = filtros.status_pagamento
    }
    if (filtros.fonte && filtros.fonte !== 'todas') {
      sql += ' AND fonte = @fonte'
      params.fonte = filtros.fonte
    }

    sql += ' ORDER BY competencia DESC, id DESC'
    return getDb().prepare(sql).all(params) as NfseServico[]
  },

  anosDisponiveis(empresaId: number): string[] {
    const rows = getDb().prepare(
      `SELECT DISTINCT substr(competencia, 1, 4) as ano
       FROM nfse_servicos WHERE empresa_id = ? AND competencia IS NOT NULL AND competencia != ''
       ORDER BY ano DESC`
    ).all(empresaId) as { ano: string }[]
    return rows.map(r => r.ano)
  },

  inserir(servico: Omit<NfseServico, 'id' | 'status_pagamento' | 'created_at'>): boolean {
    const info = getDb().prepare(`
      INSERT OR IGNORE INTO nfse_servicos
        (empresa_id, chave_acesso, nsu, numero, serie, competencia, prestador_cnpj, prestador_nome, valor_servicos, descricao, xml_blob, fonte)
      VALUES
        (@empresa_id, @chave_acesso, @nsu, @numero, @serie, @competencia, @prestador_cnpj, @prestador_nome, @valor_servicos, @descricao, @xml_blob, @fonte)
    `).run(servico)
    return info.changes > 0
  },

  buscarXml(id: number): string | undefined {
    const row = getDb().prepare('SELECT xml_blob FROM nfse_servicos WHERE id = ?').get(id) as { xml_blob?: string } | undefined
    return row?.xml_blob
  },

  togglePagamento(id: number): void {
    getDb().prepare(`
      UPDATE nfse_servicos
      SET status_pagamento = CASE WHEN status_pagamento = 'pendente' THEN 'pago' ELSE 'pendente' END,
          data_pagamento = CASE WHEN status_pagamento = 'pendente' THEN datetime('now','localtime') ELSE NULL END
      WHERE id = ?
    `).run(id)
  },

  marcarCancelada(id: number): void {
    getDb().prepare('UPDATE nfse_servicos SET cancelada = 1 WHERE id = ?').run(id)
  },

  marcarEmailEnviado(id: number): void {
    getDb().prepare('UPDATE nfse_servicos SET email_enviado = 1 WHERE id = ?').run(id)
  },

  listarParaEventos(empresaId: number, limite = 200): { id: number; chave_acesso: string }[] {
    return getDb().prepare(
      `SELECT id, chave_acesso FROM nfse_servicos
       WHERE empresa_id = ? AND cancelada = 0
         AND chave_acesso GLOB '[0-9]*' AND length(chave_acesso) = 44
       ORDER BY id DESC LIMIT ?`
    ).all(empresaId, limite) as { id: number; chave_acesso: string }[]
  },

  deletarTodos(empresaId: number): void {
    getDb().prepare('DELETE FROM nfse_servicos WHERE empresa_id = ?').run(empresaId)
  },
}
