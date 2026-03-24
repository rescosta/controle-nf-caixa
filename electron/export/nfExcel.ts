import * as XLSX from 'xlsx'
import { nfQueries } from '../database/queries/nf'

export function generateNFExcel(filters?: Record<string, unknown>): Buffer {
  const notas = nfQueries.list(filters as Parameters<typeof nfQueries.list>[0]) as Record<string, unknown>[]
  const stats = nfQueries.stats()

  const wb = XLSX.utils.book_new()

  // ---- Cabeçalho ----
  const cabecalho = [
    ['CONTROLE DE NOTAS FISCAIS A PAGAR'],
    [`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`],
    [`Total a Pagar: R$ ${stats.total_a_pagar.toFixed(2).replace('.', ',')}`],
    [`Vencidos: ${stats.vencidos}  |  Vencendo Hoje: ${stats.vencendo_hoje}`],
    [],
    ['Nº Seq', 'Data Lanç.', 'Empresa', 'Unidade', 'C. Custo', 'Fornecedor', 'Nº NF', 'Data NF', 'Descrição', 'Valor Nota', 'Valor Boleto', 'Vencimento', 'Status', 'Data Pagto']
  ]

  const linhas = notas.map(n => [
    n.numero_seq,
    n.data_lancamento,
    n.empresa_nome,
    n.unidade_nome,
    `${n.cc_codigo} - ${n.cc_descricao}`,
    n.fornecedor_nome,
    n.nf_numero,
    n.nf_data,
    n.descricao,
    Number(n.valor_nota ?? 0),
    Number(n.valor_boleto ?? 0),
    n.vencimento,
    n.status === 'pago' ? 'Pago' : 'A Pagar',
    n.data_pagamento ?? '',
  ])

  const wsData = [...cabecalho, ...linhas]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Larguras de coluna
  ws['!cols'] = [
    { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 30 }, { wch: 14 },
    { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }
  ]

  // Merge título
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 13 } }]

  XLSX.utils.book_append_sheet(wb, ws, 'NF a Pagar')

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
