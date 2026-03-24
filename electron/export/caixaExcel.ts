import * as XLSX from 'xlsx'
import { caixaQueries } from '../database/queries/caixa'

export function generateCaixaExcel(caixa_id: number): Buffer {
  const caixa = caixaQueries.get(caixa_id) as Record<string, unknown>
  const lancamentos = caixaQueries.getLancamentos(caixa_id) as Record<string, unknown>[]

  const wb = XLSX.utils.book_new()

  // ---- ABA CAIXA ----
  const cabecalho = [
    ['ACERTO DE CAIXA / DEMONSTRATIVO'],
    [`Caixa Nº: ${caixa.numero_caixa}`, '', `Unidade: ${caixa.unidade_nome}`, '', `Empresa: ${caixa.empresa_nome}`],
    [`Período: ${caixa.periodo_inicio} a ${caixa.periodo_fim}`, '', `Executado por: ${caixa.executado_por}`, '', `Responsável: ${caixa.responsavel}`],
    [`Data Envio: ${caixa.data_envio}`, '', `Saldo Anterior: R$ ${Number(caixa.saldo_anterior ?? 0).toFixed(2).replace('.', ',')}`],
    [],
    ['NUM', 'DATA', 'HISTÓRICO', 'FAVORECIDO', 'DÉBITO', 'CRÉDITO', 'SALDO']
  ]

  const linhas = lancamentos.map(l => [
    l.numero_item,
    l.data,
    l.historico,
    l.favorecido,
    Number(l.valor_debito ?? 0) || '',
    Number(l.valor_credito ?? 0) || '',
    Number(l.saldo ?? 0),
  ])

  const wsData = [...cabecalho, ...linhas]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [
    { wch: 6 }, { wch: 12 }, { wch: 40 }, { wch: 25 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }
  ]
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]

  XLSX.utils.book_append_sheet(wb, ws, 'Caixa Obra')

  // ---- ABA REFEIÇÕES ----
  const mes = Number(String(caixa.periodo_inicio).split('-')[1])
  const ano = Number(String(caixa.periodo_inicio).split('-')[0])
  const refeicoes = caixaQueries.getRefeicoes(caixa_id, mes, ano) as Record<string, unknown>[]

  const diasHeader = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
  const refHeader = ['Funcionário', 'Cargo', 'Tipo', ...diasHeader, 'Total', 'Valor Unit.', 'Total R$']

  const refLinhas = refeicoes.map(r => {
    let count = 0
    const vals = diasHeader.map(d => {
      const v = r[`dia_${d}`] as string | null
      if (v && v !== '-' && v.trim() !== '') count++
      return v ?? ''
    })
    const total = count * Number(r.valor_unitario ?? 0)
    return [r.funcionario_nome, r.cargo, r.tipo === 'almoco' ? 'Almoço' : 'Jantar', ...vals, count, r.valor_unitario, total]
  })

  const wsRef = XLSX.utils.aoa_to_sheet([refHeader, ...refLinhas])
  wsRef['!cols'] = [
    { wch: 25 }, { wch: 15 }, { wch: 10 },
    ...Array(31).fill({ wch: 4 }),
    { wch: 7 }, { wch: 11 }, { wch: 12 }
  ]
  XLSX.utils.book_append_sheet(wb, wsRef, 'Refeição')

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
