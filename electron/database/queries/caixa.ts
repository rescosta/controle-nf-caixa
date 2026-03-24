import { getDb } from '../db'

function calcNextNumeroCaixa(): number {
  const db = getDb()
  const row = db.prepare('SELECT MAX(numero_caixa) as max FROM caixas').get() as { max: number | null }
  if (row.max !== null) return row.max + 1
  const cfgRow = db.prepare("SELECT value FROM settings WHERE key = 'seq_inicial_caixa'").get() as { value: string } | undefined
  return cfgRow ? parseInt(cfgRow.value, 10) : 1
}

export const caixaQueries = {
  // ---- CAIXAS ----
  list: (filters?: { empresa_id?: number; unidade_id?: number; busca?: string }) => {
    const conds: string[] = []
    const params: Record<string, unknown> = {}
    if (filters?.empresa_id) { conds.push('c.empresa_id = @empresa_id'); params.empresa_id = filters.empresa_id }
    if (filters?.unidade_id) { conds.push('c.unidade_id = @unidade_id'); params.unidade_id = filters.unidade_id }
    if (filters?.busca) {
      conds.push(`EXISTS (
        SELECT 1 FROM caixa_lancamentos cl
        WHERE cl.caixa_id = c.id
        AND (normalize_search(cl.historico) LIKE normalize_search(@busca) OR normalize_search(cl.favorecido) LIKE normalize_search(@busca))
      )`)
      params.busca = `%${filters.busca}%`
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : ''
    return getDb().prepare(`
      SELECT c.*, u.nome as unidade_nome, e.nome as empresa_nome,
            COALESCE(
          (SELECT SUM(valor_credito) - SUM(valor_debito) FROM caixa_lancamentos WHERE caixa_id = c.id),
          0
        ) as saldo_final
      FROM caixas c
      LEFT JOIN unidades u ON u.id = c.unidade_id
      LEFT JOIN empresas e ON e.id = c.empresa_id
      ${where} ORDER BY c.numero_caixa DESC
    `).all(params)
  },

  get: (id: number) =>
    getDb().prepare(`
      SELECT c.*, u.nome as unidade_nome, e.nome as empresa_nome
      FROM caixas c
      LEFT JOIN unidades u ON u.id = c.unidade_id
      LEFT JOIN empresas e ON e.id = c.empresa_id
      WHERE c.id = ?
    `).get(id),

  getNextNum: () => calcNextNumeroCaixa(),

  getMinNumeroCaixa: () => {
    const row = getDb().prepare('SELECT MIN(numero_caixa) as min FROM caixas').get() as { min: number | null }
    return row.min
  },

  create: (data: Record<string, unknown>) => {
    const db = getDb()
    const num = (data.numero_caixa != null && Number(data.numero_caixa) > 0)
      ? Number(data.numero_caixa)
      : calcNextNumeroCaixa()
    return db.prepare(`
      INSERT INTO caixas (numero_caixa, unidade_id, empresa_id, data_envio, periodo_inicio, periodo_fim, executado_por, responsavel, saldo_anterior, status)
      VALUES (@numero_caixa, @unidade_id, @empresa_id, @data_envio, @periodo_inicio, @periodo_fim, @executado_por, @responsavel, @saldo_anterior, 'aberto')
    `).run({ ...data, numero_caixa: num })
  },

  update: (id: number, data: Record<string, unknown>) => {
    const hasNum = data.numero_caixa != null
    return getDb().prepare(`
      UPDATE caixas SET
        ${hasNum ? 'numero_caixa=@numero_caixa,' : ''}
        unidade_id=@unidade_id, empresa_id=@empresa_id, data_envio=@data_envio,
        periodo_inicio=@periodo_inicio, periodo_fim=@periodo_fim, executado_por=@executado_por,
        responsavel=@responsavel, saldo_anterior=@saldo_anterior WHERE id=@id
    `).run({ ...data, id })
  },

  getLastCaixa: () => getDb().prepare(`
    SELECT c.*,
      COALESCE(
        (SELECT SUM(valor_credito) - SUM(valor_debito) FROM caixa_lancamentos WHERE caixa_id = c.id), 0
      ) as saldo_final
    FROM caixas c ORDER BY c.numero_caixa DESC LIMIT 1
  `).get() ?? null,

  fechar: (id: number) =>
    getDb().prepare('UPDATE caixas SET status=\'fechado\' WHERE id=?').run(id),

  reabrir: (id: number) =>
    getDb().prepare('UPDATE caixas SET status=\'aberto\' WHERE id=?').run(id),

  delete: (id: number) => {
    const db = getDb()
    db.transaction(() => {
      db.prepare('DELETE FROM refeicoes WHERE caixa_id=?').run(id)
      db.prepare('DELETE FROM caixas WHERE id=?').run(id)
    })()
  },

  // ---- LANÇAMENTOS ----
  getLancamentos: (caixa_id: number) =>
    getDb().prepare('SELECT * FROM caixa_lancamentos WHERE caixa_id=? ORDER BY numero_item').all(caixa_id),

  createLancamento: (data: Record<string, unknown>) => {
    const db = getDb()
    const maxItem = (db.prepare('SELECT MAX(numero_item) as max FROM caixa_lancamentos WHERE caixa_id=?').get(data.caixa_id) as { max: number | null }).max ?? 0

    // Calcular saldo (parte do último lançamento; saldo_anterior é apenas informativo)
    const lancamentos = db.prepare('SELECT saldo FROM caixa_lancamentos WHERE caixa_id=? ORDER BY numero_item DESC LIMIT 1').all(data.caixa_id) as Array<{ saldo: number }>
    const saldoAtual = lancamentos.length > 0 ? lancamentos[0].saldo : 0

    const debito = Number(data.valor_debito ?? 0)
    const credito = Number(data.valor_credito ?? 0)
    const novoSaldo = saldoAtual - debito + credito

    return db.prepare(`
      INSERT INTO caixa_lancamentos (caixa_id, numero_item, data, historico, favorecido, valor_debito, valor_credito, saldo, tipo)
      VALUES (@caixa_id, @numero_item, @data, @historico, @favorecido, @valor_debito, @valor_credito, @saldo, @tipo)
    `).run({ ...data, numero_item: maxItem + 1, saldo: novoSaldo })
  },

  updateLancamento: (id: number, data: Record<string, unknown>) => {
    const db = getDb()
    db.prepare(`
      UPDATE caixa_lancamentos SET data=@data, historico=@historico, favorecido=@favorecido,
        valor_debito=@valor_debito, valor_credito=@valor_credito WHERE id=@id
    `).run({ ...data, id })
    // Recalcular saldos em cascata
    recalcularSaldos(data.caixa_id as number)
  },

  deleteLancamento: (id: number, caixa_id: number) => {
    getDb().prepare('DELETE FROM caixa_lancamentos WHERE id=?').run(id)
    recalcularSaldos(caixa_id)
  },

  // ---- REFEIÇÕES ----
  getRefeicoes: (caixa_id: number, mes: number, ano: number) =>
    getDb().prepare(`
      SELECT r.*, f.nome as funcionario_nome, f.cargo
      FROM refeicoes r
      JOIN funcionarios f ON f.id = r.funcionario_id
      WHERE r.caixa_id=? AND r.mes=? AND r.ano=?
      ORDER BY f.nome, r.tipo
    `).all(caixa_id, mes, ano),

  upsertRefeicao: (data: Record<string, unknown>) => {
    const db = getDb()
    const existing = db.prepare(
      'SELECT id FROM refeicoes WHERE caixa_id=? AND funcionario_id=? AND mes=? AND ano=? AND tipo=?'
    ).get(data.caixa_id, data.funcionario_id, data.mes, data.ano, data.tipo) as { id: number } | undefined

    const dias = Array.from({ length: 31 }, (_, i) => `dia_${String(i + 1).padStart(2, '0')}`)
    const diasSet = dias.map(d => `${d}=@${d}`).join(', ')
    const diasVals = Object.fromEntries(dias.map(d => [d, data[d] ?? null]))

    if (existing) {
      db.prepare(`UPDATE refeicoes SET valor_unitario=@valor_unitario, ${diasSet} WHERE id=@id`)
        .run({ ...diasVals, valor_unitario: data.valor_unitario, id: existing.id })
    } else {
      const diasCols = dias.join(', ')
      const diasParams = dias.map(d => `@${d}`).join(', ')
      db.prepare(`
        INSERT INTO refeicoes (caixa_id, funcionario_id, mes, ano, tipo, valor_unitario, ${diasCols})
        VALUES (@caixa_id, @funcionario_id, @mes, @ano, @tipo, @valor_unitario, ${diasParams})
      `).run({ ...data, ...diasVals })
    }
  },

  getPreviousCaixa: (caixa_id: number) => {
    const db = getDb()
    const current = db.prepare('SELECT numero_caixa, unidade_id FROM caixas WHERE id=?').get(caixa_id) as { numero_caixa: number; unidade_id: number } | undefined
    if (!current) return null
    return db.prepare(`
      SELECT id, numero_caixa, periodo_inicio, periodo_fim
      FROM caixas
      WHERE unidade_id = ? AND numero_caixa < ?
      ORDER BY numero_caixa DESC LIMIT 1
    `).get(current.unidade_id, current.numero_caixa) ?? null
  },

  getPrevRefeicaoLancamento: (caixa_id: number) => {
    return getDb().prepare(`
      SELECT cl.historico, cl.favorecido, cl.valor_debito, cl.valor_credito, cl.data
      FROM caixa_lancamentos cl
      JOIN caixas prev ON cl.caixa_id = prev.id
      JOIN caixas cur  ON cur.id = ?
      WHERE prev.unidade_id = cur.unidade_id
        AND prev.numero_caixa < cur.numero_caixa
        AND cl.tipo = 'refeicoes'
      ORDER BY prev.numero_caixa DESC
      LIMIT 1
    `).get(caixa_id) ?? null
  },

  getBlockedUntil: (caixa_id: number): string | null => {
    const db = getDb()
    const current = db.prepare('SELECT numero_caixa, unidade_id FROM caixas WHERE id=?').get(caixa_id) as { numero_caixa: number; unidade_id: number } | undefined
    if (!current) return null
    const row = db.prepare(`
      SELECT MAX(periodo_fim) as max_fim
      FROM caixas
      WHERE unidade_id = ? AND numero_caixa < ?
    `).get(current.unidade_id, current.numero_caixa) as { max_fim: string | null } | undefined
    return row?.max_fim ?? null
  },

  getTotalRefeicoes: (caixa_id: number, mes: number, ano: number, periodo_inicio?: string, periodo_fim?: string) => {
    const refeicoes = getDb().prepare(
      'SELECT * FROM refeicoes WHERE caixa_id=? AND mes=? AND ano=?'
    ).all(caixa_id, mes, ano) as Record<string, unknown>[]

    let total = 0
    for (const r of refeicoes) {
      const valorUnit = Number(r.valor_unitario ?? 0)
      for (let d = 1; d <= 31; d++) {
        const col = `dia_${String(d).padStart(2, '0')}`
        const val = r[col] as string | null
        if (val && val !== '-' && val.trim() !== '') {
          if (periodo_inicio && periodo_fim) {
            // Verificar se o dia está no período
            const ano_ = Number(r['ano'])
            const mes_ = Number(r['mes'])
            const dataStr = `${ano_}-${String(mes_).padStart(2,'0')}-${String(d).padStart(2,'0')}`
            if (dataStr >= periodo_inicio && dataStr <= periodo_fim) {
              total += valorUnit
            }
          } else {
            total += valorUnit
          }
        }
      }
    }
    return total
  }
}

function recalcularSaldos(caixa_id: number): void {
  const db = getDb()
  const lancamentos = db.prepare('SELECT id, valor_debito, valor_credito FROM caixa_lancamentos WHERE caixa_id=? ORDER BY numero_item').all(caixa_id) as Array<{ id: number; valor_debito: number; valor_credito: number }>

  let saldo = 0
  const update = db.prepare('UPDATE caixa_lancamentos SET saldo=? WHERE id=?')
  for (const l of lancamentos) {
    saldo = saldo - Number(l.valor_debito ?? 0) + Number(l.valor_credito ?? 0)
    update.run(saldo, l.id)
  }
}
