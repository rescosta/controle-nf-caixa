import { getDb } from '../db'

export interface TributosPremissas {
  id: number
  empresa_id: number
  presuncao: number
  aliq_irpj: number
  aliq_adicional_ir: number
  aliq_csll: number
  limite_adicional: number
  aliq_pis: number
  aliq_cofins: number
  aliq_irrf: number
  aliq_csll_retida: number
  pis_cofins_retidos: number  // 1 = PIS/COFINS 100% retidos pelo tomador (não geram DARF)
}

export interface TributosHistorico {
  id: number
  empresa_id: number
  ano: number
  trimestre: number
  fat_mes1: number
  fat_mes2: number
  fat_mes3: number
  fat_total: number
  base_irpj: number
  irpj_bruto: number
  adicional_ir: number
  irrf_retido: number
  irpj_a_recolher: number
  csll_bruto: number
  csll_retida: number
  csll_a_recolher: number
  pis: number
  cofins: number
  total_tributos: number
  carga_efetiva: number
  observacao?: string
  created_at: string
}

// Meses de cada trimestre (YYYY-MM)
function mesesDoTrimestre(ano: number, trimestre: number): string[] {
  const base = (trimestre - 1) * 3 + 1
  return [base, base + 1, base + 2].map(m => `${ano}-${String(m).padStart(2, '0')}`)
}

export const tributosQueries = {
  getPremissas(empresa_id: number): TributosPremissas {
    const db = getDb()
    db.prepare(`
      INSERT OR IGNORE INTO tributos_premissas (empresa_id) VALUES (?)
    `).run(empresa_id)
    return db.prepare('SELECT * FROM tributos_premissas WHERE empresa_id = ?').get(empresa_id) as TributosPremissas
  },

  savePremissas(empresa_id: number, data: Partial<TributosPremissas>): void {
    getDb().prepare(`
      UPDATE tributos_premissas SET
        presuncao = @presuncao,
        aliq_irpj = @aliq_irpj,
        aliq_adicional_ir = @aliq_adicional_ir,
        aliq_csll = @aliq_csll,
        limite_adicional = @limite_adicional,
        aliq_pis = @aliq_pis,
        aliq_cofins = @aliq_cofins,
        aliq_irrf = @aliq_irrf,
        aliq_csll_retida = @aliq_csll_retida,
        pis_cofins_retidos = @pis_cofins_retidos
      WHERE empresa_id = @empresa_id
    `).run({ ...data, empresa_id })
  },

  // Retorna faturamento (soma valor_servicos de NFS-e emitidas) por mês do trimestre.
  // Usa somente fonte='adn' para evitar duplicatas com BHISS (que usa número diferente
  // para a mesma NFS-e). BHISS é fonte legada e não deve ser somada junto ao ADN.
  getFaturamentoTrimestre(empresa_id: number, ano: number, trimestre: number): { mes1: number; mes2: number; mes3: number } {
    const db = getDb()
    const [m1, m2, m3] = mesesDoTrimestre(ano, trimestre)
    const soma = (mes: string): number => {
      const row = db.prepare(`
        SELECT COALESCE(SUM(valor_servicos), 0) as total
        FROM nfse_servicos
        WHERE empresa_id = ? AND tipo = 'emitida' AND competencia = ? AND fonte = 'adn'
      `).get(empresa_id, mes) as { total: number }
      return row.total
    }
    return { mes1: soma(m1), mes2: soma(m2), mes3: soma(m3) }
  },

  salvarHistorico(data: Omit<TributosHistorico, 'id' | 'created_at'>): void {
    getDb().prepare(`
      INSERT OR REPLACE INTO tributos_historico
        (empresa_id, ano, trimestre,
         fat_mes1, fat_mes2, fat_mes3, fat_total,
         base_irpj, irpj_bruto, adicional_ir, irrf_retido, irpj_a_recolher,
         csll_bruto, csll_retida, csll_a_recolher,
         pis, cofins, total_tributos, carga_efetiva, observacao)
      VALUES
        (@empresa_id, @ano, @trimestre,
         @fat_mes1, @fat_mes2, @fat_mes3, @fat_total,
         @base_irpj, @irpj_bruto, @adicional_ir, @irrf_retido, @irpj_a_recolher,
         @csll_bruto, @csll_retida, @csll_a_recolher,
         @pis, @cofins, @total_tributos, @carga_efetiva, @observacao)
    `).run(data)
  },

  getHistorico(empresa_id: number): TributosHistorico[] {
    return getDb().prepare(`
      SELECT * FROM tributos_historico
      WHERE empresa_id = ?
      ORDER BY ano DESC, trimestre DESC
    `).all(empresa_id) as TributosHistorico[]
  },

  getHistoricoTrimestre(empresa_id: number, ano: number, trimestre: number): TributosHistorico | undefined {
    return getDb().prepare(`
      SELECT * FROM tributos_historico
      WHERE empresa_id = ? AND ano = ? AND trimestre = ?
    `).get(empresa_id, ano, trimestre) as TributosHistorico | undefined
  },

  deleteHistorico(id: number): void {
    getDb().prepare('DELETE FROM tributos_historico WHERE id = ?').run(id)
  },
}
