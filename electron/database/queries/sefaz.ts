import { getDb } from '../db'

// ===================== TIPOS =====================

export interface SefazEmpresa {
  id: number
  nome: string
  cnpj: string
  uf: string
  pfx_b64?: string
  pfx_senha?: string
  ambiente: 'producao' | 'homologacao'
  ultimo_nsu: string
  sefaz_consultas_count: number
  sefaz_consultas_data: string
  sefaz_cooldown_ate: string
  ativo: number
}

export interface SefazNfe {
  id: number
  empresa_id: number
  chave_acesso: string
  nsu: string
  nf_numero: string
  nf_data: string
  fornecedor_cnpj: string
  fornecedor_nome: string
  valor_nota: number
  status_pagamento: 'pendente' | 'pago'
  data_pagamento?: string
  email_enviado: number
  xml_blob?: string
  tipo_nfe: 'procNFe' | 'resNFe'
  created_at: string
}

export interface SefazDestinatario {
  id: number
  nome: string
  email: string
  ativo: number
}

// ===================== EMPRESAS SEFAZ =====================

export const sefazEmpresasQueries = {
  list(): SefazEmpresa[] {
    return getDb().prepare('SELECT * FROM sefaz_empresas WHERE ativo = 1 ORDER BY nome').all() as SefazEmpresa[]
  },
  get(id: number): SefazEmpresa | undefined {
    return getDb().prepare('SELECT * FROM sefaz_empresas WHERE id = ?').get(id) as SefazEmpresa | undefined
  },
  create(data: Omit<SefazEmpresa, 'id' | 'ultimo_nsu' | 'sefaz_consultas_count' | 'sefaz_consultas_data' | 'sefaz_cooldown_ate' | 'ativo'>): number {
    const result = getDb()
      .prepare(`INSERT INTO sefaz_empresas (nome, cnpj, uf, pfx_b64, pfx_senha, ambiente)
                VALUES (@nome, @cnpj, @uf, @pfx_b64, @pfx_senha, @ambiente)`)
      .run(data)
    return result.lastInsertRowid as number
  },
  update(id: number, data: Partial<Omit<SefazEmpresa, 'id' | 'ultimo_nsu' | 'sefaz_consultas_count' | 'sefaz_consultas_data' | 'sefaz_cooldown_ate'>>): void {
    const campos = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
    getDb().prepare(`UPDATE sefaz_empresas SET ${campos} WHERE id = @id`).run({ ...data, id })
  },
  delete(id: number): void {
    getDb().prepare('UPDATE sefaz_empresas SET ativo = 0 WHERE id = ?').run(id)
  },
  atualizarNsu(id: number, nsu: string): void {
    getDb().prepare('UPDATE sefaz_empresas SET ultimo_nsu = ? WHERE id = ?').run(nsu, id)
  },
  atualizarNsuNfse(id: number, nsu: string): void {
    getDb().prepare('UPDATE sefaz_empresas SET ultimo_nsu_nfse = ? WHERE id = ?').run(nsu, id)
  },
  // Rate limiting
  getEstadoRateLimit(id: number): { count: number; data: string; cooldown: string } {
    const row = getDb()
      .prepare('SELECT sefaz_consultas_count, sefaz_consultas_data, sefaz_cooldown_ate FROM sefaz_empresas WHERE id = ?')
      .get(id) as { sefaz_consultas_count: number; sefaz_consultas_data: string; sefaz_cooldown_ate: string } | undefined
    return { count: row?.sefaz_consultas_count ?? 0, data: row?.sefaz_consultas_data ?? '', cooldown: row?.sefaz_cooldown_ate ?? '' }
  },
  registrarConsulta(id: number): void {
    const hoje = new Date().toISOString().slice(0, 10)
    const estado = sefazEmpresasQueries.getEstadoRateLimit(id)
    const countHoje = estado.data === hoje ? estado.count : 0
    getDb().prepare('UPDATE sefaz_empresas SET sefaz_consultas_count = ?, sefaz_consultas_data = ? WHERE id = ?')
      .run(countHoje + 1, hoje, id)
  },
  ativarCooldown(id: number): void {
    const ate = new Date(Date.now() + 65 * 60 * 1000).toISOString()
    getDb().prepare('UPDATE sefaz_empresas SET sefaz_cooldown_ate = ?, sefaz_consultas_count = 0 WHERE id = ?').run(ate, id)
  },
  limparCooldown(id: number): void {
    getDb().prepare('UPDATE sefaz_empresas SET sefaz_cooldown_ate = ? WHERE id = ?').run('', id)
  },
}

// ===================== NF-ES SEFAZ =====================

export const sefazNfesQueries = {
  list(filtros: {
    empresa_id: number
    fornecedor?: string
    data_de?: string
    data_ate?: string
    status_pagamento?: string
    email_enviado?: string
  }): SefazNfe[] {
    let sql = 'SELECT * FROM sefaz_nfes WHERE empresa_id = @empresa_id'
    const params: Record<string, unknown> = { empresa_id: filtros.empresa_id }

    if (filtros.fornecedor) {
      sql += ' AND (fornecedor_nome LIKE @forn OR fornecedor_cnpj LIKE @forn)'
      params.forn = `%${filtros.fornecedor}%`
    }
    if (filtros.data_de) { sql += ' AND nf_data >= @data_de'; params.data_de = filtros.data_de }
    if (filtros.data_ate) { sql += ' AND nf_data <= @data_ate'; params.data_ate = filtros.data_ate }
    if (filtros.status_pagamento && filtros.status_pagamento !== 'todas') {
      sql += ' AND status_pagamento = @status_pagamento'; params.status_pagamento = filtros.status_pagamento
    }
    if (filtros.email_enviado === 'enviadas') sql += ' AND email_enviado = 1'
    else if (filtros.email_enviado === 'nao_enviadas') sql += ' AND email_enviado = 0'

    sql += ' ORDER BY nf_data DESC, id DESC'
    return getDb().prepare(sql).all(params) as SefazNfe[]
  },

  inserir(nfe: Omit<SefazNfe, 'id' | 'status_pagamento' | 'email_enviado' | 'created_at'>): void {
    getDb().prepare(`
      INSERT OR IGNORE INTO sefaz_nfes
        (empresa_id, chave_acesso, nsu, nf_numero, nf_data, fornecedor_cnpj, fornecedor_nome, valor_nota, xml_blob, tipo_nfe)
      VALUES
        (@empresa_id, @chave_acesso, @nsu, @nf_numero, @nf_data, @fornecedor_cnpj, @fornecedor_nome, @valor_nota, @xml_blob, @tipo_nfe)
    `).run(nfe)
  },

  // Atualiza resNFe → procNFe quando XML completo chegar
  atualizarCompleta(chave: string, dados: { nf_numero: string; xml_blob: string }): boolean {
    const result = getDb()
      .prepare(`UPDATE sefaz_nfes SET nf_numero = ?, xml_blob = ?, tipo_nfe = 'procNFe' WHERE chave_acesso = ? AND tipo_nfe = 'resNFe'`)
      .run(dados.nf_numero, dados.xml_blob, chave)
    return result.changes > 0
  },

  buscarXml(id: number): string | undefined {
    const row = getDb().prepare('SELECT xml_blob FROM sefaz_nfes WHERE id = ?').get(id) as { xml_blob?: string } | undefined
    return row?.xml_blob
  },

  togglePagamento(id: number): void {
    getDb().prepare(`
      UPDATE sefaz_nfes
      SET status_pagamento = CASE WHEN status_pagamento = 'pendente' THEN 'pago' ELSE 'pendente' END,
          data_pagamento = CASE WHEN status_pagamento = 'pendente' THEN datetime('now','localtime') ELSE NULL END
      WHERE id = ?
    `).run(id)
  },

  marcarEmailEnviado(id: number): void {
    getDb().prepare('UPDATE sefaz_nfes SET email_enviado = 1 WHERE id = ?').run(id)
  },
}

// ===================== DESTINATÁRIOS SEFAZ =====================

export const sefazDestinatariosQueries = {
  list(): SefazDestinatario[] {
    return getDb().prepare('SELECT * FROM sefaz_destinatarios WHERE ativo = 1 ORDER BY nome').all() as SefazDestinatario[]
  },
  create(nome: string, email: string): void {
    getDb().prepare('INSERT INTO sefaz_destinatarios (nome, email) VALUES (?, ?)').run(nome, email)
  },
  delete(id: number): void {
    getDb().prepare('UPDATE sefaz_destinatarios SET ativo = 0 WHERE id = ?').run(id)
  },
}
