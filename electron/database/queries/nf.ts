import { getDb } from '../db'

function calcNextSeq(): number {
  const db = getDb()
  const row = db.prepare('SELECT MAX(numero_seq) as max FROM notas_fiscais').get() as { max: number | null }
  if (row.max !== null) return row.max + 1
  const cfgRow = db.prepare("SELECT value FROM settings WHERE key = 'seq_inicial'").get() as { value: string } | undefined
  return cfgRow ? parseInt(cfgRow.value, 10) : 1
}

const NF_SELECT = `
  SELECT
    nf.*,
    e.nome as empresa_nome,
    u.nome as unidade_nome,
    cc.codigo as cc_codigo, cc.descricao as cc_descricao,
    f.nome as fornecedor_nome
  FROM notas_fiscais nf
  LEFT JOIN empresas e ON e.id = nf.empresa_id
  LEFT JOIN unidades u ON u.id = nf.unidade_id
  LEFT JOIN centros_custo cc ON cc.id = nf.centro_custo_id
  LEFT JOIN fornecedores f ON f.id = nf.fornecedor_id
`

export const nfQueries = {
  list: (filters?: {
    empresa_id?: number
    unidade_id?: number
    centro_custo_id?: number
    fornecedor_id?: number
    status?: string
    data_inicio?: string
    data_fim?: string
  }) => {
    const conds: string[] = []
    const params: Record<string, unknown> = {}

    if (filters?.empresa_id) { conds.push('nf.empresa_id = @empresa_id'); params.empresa_id = filters.empresa_id }
    if (filters?.unidade_id) { conds.push('nf.unidade_id = @unidade_id'); params.unidade_id = filters.unidade_id }
    if (filters?.centro_custo_id) { conds.push('nf.centro_custo_id = @centro_custo_id'); params.centro_custo_id = filters.centro_custo_id }
    if (filters?.fornecedor_id) { conds.push('nf.fornecedor_id = @fornecedor_id'); params.fornecedor_id = filters.fornecedor_id }
    if (filters?.status) { conds.push('nf.status = @status'); params.status = filters.status }
    if (filters?.data_inicio) { conds.push('nf.vencimento >= @data_inicio'); params.data_inicio = filters.data_inicio }
    if (filters?.data_fim) { conds.push('nf.vencimento <= @data_fim'); params.data_fim = filters.data_fim }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : ''
    return getDb().prepare(`${NF_SELECT} ${where} ORDER BY nf.numero_seq DESC`).all(params)
  },

  get: (id: number) =>
    getDb().prepare(`${NF_SELECT} WHERE nf.id = ?`).get(id),

  getNextSeq: () => calcNextSeq(),

  getMinSeq: () => {
    const row = getDb().prepare('SELECT MIN(numero_seq) as min FROM notas_fiscais').get() as { min: number | null }
    return row.min
  },

  getFirstNF: () =>
    getDb().prepare('SELECT id, numero_seq FROM notas_fiscais ORDER BY numero_seq ASC LIMIT 1').get() as { id: number; numero_seq: number } | undefined,

  create: (data: Record<string, unknown>) => {
    const db = getDb()
    const seq = (data.numero_seq != null && Number(data.numero_seq) > 0)
      ? Number(data.numero_seq)
      : calcNextSeq()
    return db.prepare(`
      INSERT INTO notas_fiscais
        (numero_seq, empresa_id, unidade_id, centro_custo_id, nf_numero, nf_data,
         fornecedor_id, descricao, valor_nota, valor_boleto, vencimento, status, data_lancamento,
         forma_pagamento, pix_chave, banco_pagamento, agencia_pagamento, conta_pagamento)
      VALUES
        (@numero_seq, @empresa_id, @unidade_id, @centro_custo_id, @nf_numero, @nf_data,
         @fornecedor_id, @descricao, @valor_nota, @valor_boleto, @vencimento, @status, @data_lancamento,
         @forma_pagamento, @pix_chave, @banco_pagamento, @agencia_pagamento, @conta_pagamento)
    `).run({ ...data, numero_seq: seq })
  },

  duplicate: (id: number) => {
    const db = getDb()
    const orig = db.prepare('SELECT * FROM notas_fiscais WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!orig) return null
    return db.prepare(`
      INSERT INTO notas_fiscais
        (numero_seq, empresa_id, unidade_id, centro_custo_id, nf_numero, nf_data,
         fornecedor_id, descricao, valor_nota, valor_boleto, vencimento, status, data_lancamento,
         forma_pagamento, pix_chave, banco_pagamento, agencia_pagamento, conta_pagamento)
      VALUES
        (@numero_seq, @empresa_id, @unidade_id, @centro_custo_id, @nf_numero, @nf_data,
         @fornecedor_id, @descricao, @valor_nota, @valor_boleto, @vencimento, 'a_pagar', @data_lancamento,
         @forma_pagamento, @pix_chave, @banco_pagamento, @agencia_pagamento, @conta_pagamento)
    `).run({ ...orig, numero_seq: calcNextSeq(), data_pagamento: null })
  },

  update: (id: number, data: Record<string, unknown>) => {
    const hasSeq = data.numero_seq != null
    return getDb().prepare(`
      UPDATE notas_fiscais SET
        ${hasSeq ? 'numero_seq=@numero_seq,' : ''}
        empresa_id=@empresa_id, unidade_id=@unidade_id, centro_custo_id=@centro_custo_id,
        nf_numero=@nf_numero, nf_data=@nf_data, fornecedor_id=@fornecedor_id,
        descricao=@descricao, valor_nota=@valor_nota, valor_boleto=@valor_boleto,
        vencimento=@vencimento, status=@status, data_pagamento=@data_pagamento,
        forma_pagamento=@forma_pagamento, pix_chave=@pix_chave,
        banco_pagamento=@banco_pagamento, agencia_pagamento=@agencia_pagamento, conta_pagamento=@conta_pagamento
      WHERE id=@id
    `).run({ ...data, id })
  },

  marcarPago: (id: number, data_pagamento: string) =>
    getDb().prepare(
      'UPDATE notas_fiscais SET status=\'pago\', data_pagamento=? WHERE id=?'
    ).run(data_pagamento, id),

  desfazerPagamento: (id: number) =>
    getDb().prepare(
      'UPDATE notas_fiscais SET status=\'a_pagar\', data_pagamento=NULL WHERE id=?'
    ).run(id),

  markEmailEnviado: (id: number) =>
    getDb().prepare('UPDATE notas_fiscais SET email_enviado = 1 WHERE id = ?').run(id),

  delete: (id: number) =>
    getDb().prepare('DELETE FROM notas_fiscais WHERE id = ?').run(id),

  // Parcelas
  getParcelas: (nf_id: number) =>
    getDb().prepare('SELECT * FROM nf_parcelas WHERE nf_id = ? ORDER BY numero_parcela').all(nf_id),

  createParcela: (data: Record<string, unknown>) =>
    getDb().prepare(
      'INSERT INTO nf_parcelas (nf_id, numero_parcela, valor, vencimento, status) VALUES (@nf_id, @numero_parcela, @valor, @vencimento, @status)'
    ).run(data),

  updateParcela: (id: number, data: Record<string, unknown>) =>
    getDb().prepare(
      'UPDATE nf_parcelas SET valor=@valor, vencimento=@vencimento, status=@status, data_pagamento=@data_pagamento WHERE id=@id'
    ).run({ ...data, id }),

  deleteParcelas: (nf_id: number) =>
    getDb().prepare('DELETE FROM nf_parcelas WHERE nf_id = ?').run(nf_id),

  // Programação de Pagamentos (separado de parcelas — controle financeiro futuro)
  getProgramacao: (nf_id: number) =>
    getDb().prepare('SELECT * FROM nf_programacao WHERE nf_id = ? ORDER BY vencimento').all(nf_id),

  saveProgramacao: (nf_id: number, items: Record<string, unknown>[]) => {
    const db = getDb()
    db.prepare('DELETE FROM nf_programacao WHERE nf_id = ?').run(nf_id)
    const ins = db.prepare('INSERT INTO nf_programacao (nf_id, valor, vencimento, observacao) VALUES (@nf_id, @valor, @vencimento, @observacao)')
    for (const item of items) ins.run({ nf_id, valor: item.valor ?? 0, vencimento: item.vencimento ?? null, observacao: item.observacao ?? null })
  },

  // Stats para dashboard — reflete os mesmos filtros de list()
  stats: (filters?: {
    empresa_id?: number
    unidade_id?: number
    centro_custo_id?: number
    status?: string
    data_inicio?: string
    data_fim?: string
  }) => {
    const db = getDb()
    const now = new Date()
    const hoje = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const conds: string[] = []
    const params: Record<string, unknown> = {}
    if (filters?.empresa_id) { conds.push('empresa_id = @empresa_id'); params.empresa_id = filters.empresa_id }
    if (filters?.unidade_id) { conds.push('unidade_id = @unidade_id'); params.unidade_id = filters.unidade_id }
    if (filters?.centro_custo_id) { conds.push('centro_custo_id = @centro_custo_id'); params.centro_custo_id = filters.centro_custo_id }
    if (filters?.data_inicio) { conds.push('vencimento >= @data_inicio'); params.data_inicio = filters.data_inicio }
    if (filters?.data_fim) { conds.push('vencimento <= @data_fim'); params.data_fim = filters.data_fim }

    const base = conds.length ? 'AND ' + conds.join(' AND ') : ''

    return {
      total_a_pagar: (db.prepare(`SELECT COALESCE(SUM(valor_boleto),0) as v FROM notas_fiscais WHERE status='a_pagar' ${base}`).get(params) as { v: number }).v,
      vencendo_hoje: (db.prepare(`SELECT COUNT(*) as c FROM notas_fiscais WHERE status='a_pagar' AND vencimento=@hoje ${base}`).get({ ...params, hoje }) as { c: number }).c,
      vencidos: (db.prepare(`SELECT COUNT(*) as c FROM notas_fiscais WHERE status='a_pagar' AND vencimento<@hoje ${base}`).get({ ...params, hoje }) as { c: number }).c,
    }
  }
}
