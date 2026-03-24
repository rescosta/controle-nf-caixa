import { useState, useEffect } from 'react'
import { X, Printer, Download, Save, ArrowLeft, BarChart2 } from 'lucide-react'
import { api } from '../../lib/api'
import { formatBRL, formatDate } from '../../lib/format'
import type { NotaFiscal, Empresa, Unidade, CentroCusto, Fornecedor } from '../../types'
import SearchableSelect from '../../components/SearchableSelect'

interface Filtros {
  empresa_id: string
  unidade_id: string
  centro_custo_id: string
  fornecedor_id: string
  status: string
  data_inicio: string
  data_fim: string
}

interface Props {
  empresas: Empresa[]
  unidades: Unidade[]
  ccs: CentroCusto[]
  fornecedores: Fornecedor[]
  initialFilters?: Filtros
  onClose: () => void
  onSaved?: () => void
}

const EMPTY_FILTERS: Filtros = {
  empresa_id: '',
  unidade_id: '',
  centro_custo_id: '',
  fornecedor_id: '',
  status: '',
  data_inicio: '',
  data_fim: '',
}

interface ColDef { key: string; label: string; width: number }

const COLUNAS: ColDef[] = [
  { key: 'seq',        label: 'SEQ',        width: 48  },
  { key: 'lancamento', label: 'LANÇAMENTO', width: 76  },
  { key: 'empresa',    label: 'EMPRESA',    width: 165 },
  { key: 'unidade',    label: 'UNIDADE',    width: 100 },
  { key: 'cc',         label: 'CC',         width: 58  },
  { key: 'fornecedor', label: 'FORNECEDOR', width: 155 },
  { key: 'nf_numero',  label: 'Nº NF',      width: 52  },
  { key: 'descricao',  label: 'DESCRIÇÃO',  width: 165 },
  { key: 'valor_nota', label: 'VALOR NOTA', width: 85  },
  { key: 'vencimento', label: 'VENCIMENTO', width: 76  },
  { key: 'status',     label: 'STATUS',     width: 60  },
]

function filtrosToParams(f: Filtros): Record<string, unknown> {
  const p: Record<string, unknown> = {}
  if (f.empresa_id) p.empresa_id = Number(f.empresa_id)
  if (f.unidade_id) p.unidade_id = Number(f.unidade_id)
  if (f.centro_custo_id) p.centro_custo_id = Number(f.centro_custo_id)
  if (f.fornecedor_id) p.fornecedor_id = Number(f.fornecedor_id)
  if (f.status) p.status = f.status
  if (f.data_inicio) p.data_inicio = f.data_inicio
  if (f.data_fim) p.data_fim = f.data_fim
  return p
}

export default function RelatorioModal({ empresas, unidades, ccs, fornecedores, initialFilters, onClose, onSaved }: Props) {
  const [step, setStep] = useState<'filters' | 'preview'>(initialFilters ? 'preview' : 'filters')
  const [filtros, setFiltros] = useState<Filtros>(initialFilters ?? EMPTY_FILTERS)
  const [notas, setNotas] = useState<NotaFiscal[]>([])
  const [loading, setLoading] = useState(false)
  const [savingMode, setSavingMode] = useState(false)
  const [nomeRelatorio, setNomeRelatorio] = useState('')
  const [savedOk, setSavedOk] = useState(false)
  const [colsSelecionadas, setColsSelecionadas] = useState<Set<string>>(
    () => new Set(COLUNAS.map(c => c.key))
  )

  useEffect(() => {
    if (initialFilters) {
      gerarRelatorio(initialFilters)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function gerarRelatorio(f: Filtros = filtros) {
    setLoading(true)
    const ns = await api.nf.list(filtrosToParams(f))
    setNotas(ns as NotaFiscal[])
    setStep('preview')
    setLoading(false)
  }

  async function handleSave() {
    if (!nomeRelatorio.trim()) return
    await api.relatorios.save(nomeRelatorio.trim(), JSON.stringify(filtros))
    setSavedOk(true)
    setSavingMode(false)
    setNomeRelatorio('')
    onSaved?.()
    setTimeout(() => setSavedOk(false), 3000)
  }

  function handleExportExcel() {
    api.nf.exportExcel(filtrosToParams(filtros))
  }

  const totalNota = notas.reduce((acc, n) => acc + (n.valor_nota ?? 0), 0)

  async function handlePrint() {
    const html = buildReportHtml(notas, totalNota, labelFiltros(), colsSelecionadas)
    await api.print.report(html)
  }

  function toggleCol(key: string) {
    setColsSelecionadas(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  function labelFiltros() {
    const parts: string[] = []
    if (filtros.data_inicio || filtros.data_fim) parts.push(`Período: ${formatDate(filtros.data_inicio) ?? '...'} a ${formatDate(filtros.data_fim) ?? '...'}`)
    if (filtros.empresa_id) { const e = empresas.find(x => x.id === Number(filtros.empresa_id)); if (e) parts.push(`Empresa: ${e.nome}`) }
    if (filtros.unidade_id) { const u = unidades.find(x => x.id === Number(filtros.unidade_id)); if (u) parts.push(`Unidade: ${u.nome}`) }
    if (filtros.centro_custo_id) { const cc = ccs.find(x => x.id === Number(filtros.centro_custo_id)); if (cc) parts.push(`CC: ${cc.codigo}`) }
    if (filtros.fornecedor_id) { const f = fornecedores.find(x => x.id === Number(filtros.fornecedor_id)); if (f) parts.push(`Fornecedor: ${f.nome}`) }
    if (filtros.status) parts.push(`Status: ${filtros.status === 'a_pagar' ? 'A Pagar' : 'Pago'}`)
    return parts.length ? parts.join(' | ') : 'Sem filtros (todos os registros)'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-[1300px] max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <BarChart2 size={18} className="text-blue-400" />
            Relatório de Custo
          </div>
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <>
                <button
                  onClick={() => setStep('filters')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
                >
                  <ArrowLeft size={14} /> Voltar
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
                >
                  <Printer size={14} /> Imprimir / PDF
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700 text-white text-sm hover:bg-green-600"
                >
                  <Download size={14} /> Exportar XLSX
                </button>
                {!savingMode ? (
                  <button
                    onClick={() => setSavingMode(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 text-white text-sm hover:bg-blue-600"
                  >
                    <Save size={14} /> Salvar
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 w-48 focus:outline-none focus:border-blue-500"
                      placeholder="Nome do relatório..."
                      value={nomeRelatorio}
                      onChange={e => setNomeRelatorio(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSavingMode(false) }}
                    />
                    <button onClick={handleSave} className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-sm hover:bg-blue-600">OK</button>
                    <button onClick={() => setSavingMode(false)} className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600">×</button>
                  </div>
                )}
                {savedOk && <span className="text-green-400 text-sm">Salvo!</span>}
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-slate-200">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {step === 'filters' && (
            <div className="p-6 space-y-5">
              <h2 className="text-slate-300 font-medium">Selecione os filtros do relatório</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label>Vencimento — De</label>
                  <input type="date" value={filtros.data_inicio} onChange={e => setFiltros(f => ({ ...f, data_inicio: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Vencimento — Até</label>
                  <input type="date" value={filtros.data_fim} onChange={e => setFiltros(f => ({ ...f, data_fim: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Empresa</label>
                  <SearchableSelect
                    value={filtros.empresa_id ? Number(filtros.empresa_id) : undefined}
                    onChange={id => setFiltros(f => ({ ...f, empresa_id: id ? String(id) : '' }))}
                    options={empresas.map(e => ({ id: e.id, label: e.nome }))}
                    placeholder="Todas as empresas"
                  />
                </div>
                <div className="form-group">
                  <label>Unidade</label>
                  <SearchableSelect
                    value={filtros.unidade_id ? Number(filtros.unidade_id) : undefined}
                    onChange={id => setFiltros(f => ({ ...f, unidade_id: id ? String(id) : '' }))}
                    options={unidades.map(u => ({ id: u.id, label: u.nome }))}
                    placeholder="Todas as unidades"
                  />
                </div>
                <div className="form-group">
                  <label>Centro de Custo</label>
                  <SearchableSelect
                    value={filtros.centro_custo_id ? Number(filtros.centro_custo_id) : undefined}
                    onChange={id => setFiltros(f => ({ ...f, centro_custo_id: id ? String(id) : '' }))}
                    options={ccs.map(cc => ({ id: cc.id, label: `${cc.codigo} — ${cc.descricao}` }))}
                    placeholder="Todos os CCs"
                  />
                </div>
                <div className="form-group">
                  <label>Fornecedor</label>
                  <SearchableSelect
                    value={filtros.fornecedor_id ? Number(filtros.fornecedor_id) : undefined}
                    onChange={id => setFiltros(f => ({ ...f, fornecedor_id: id ? String(id) : '' }))}
                    options={fornecedores.map(f => ({ id: f.id, label: f.nome }))}
                    placeholder="Todos os fornecedores"
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
                    <option value="">Todas (A Pagar + Pago)</option>
                    <option value="a_pagar">A Pagar</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
              </div>

              {/* Seletor de colunas */}
              <div className="border-t border-slate-700 pt-4">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Colunas do relatório</p>
                <div className="grid grid-cols-4 gap-x-6 gap-y-2">
                  {COLUNAS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        style={{ appearance: 'auto', width: 14, height: 14, accentColor: '#3b82f6', cursor: 'pointer' }}
                        checked={colsSelecionadas.has(col.key)}
                        disabled={col.key === 'valor_nota'}
                        onChange={() => toggleCol(col.key)}
                      />
                      <span className={col.key === 'valor_nota' ? 'text-slate-500' : ''}>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  className="btn-primary"
                  disabled={loading || colsSelecionadas.size === 0}
                  onClick={() => gerarRelatorio()}
                >
                  <BarChart2 size={14} /> {loading ? 'Carregando...' : 'Gerar Relatório'}
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="overflow-auto bg-slate-200 p-4 min-h-full">
              <div className="bg-white" style={{ minWidth: 980, padding: '24px 28px' }}>
                <RelatorioPrintLayout
                  notas={notas}
                  totalNota={totalNota}
                  labelFiltros={labelFiltros()}
                  colsSelecionadas={colsSelecionadas}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RelatorioPrintLayout({ notas, totalNota, labelFiltros, colsSelecionadas }: {
  notas: NotaFiscal[]
  totalNota: number
  labelFiltros: string
  colsSelecionadas: Set<string>
}) {
  const cols = COLUNAS.filter(c => colsSelecionadas.has(c.key))
  const valorNotaIdx = cols.findIndex(c => c.key === 'valor_nota')
  const colsAfterValor = cols.length - valorNotaIdx - 1

  const td: React.CSSProperties = { padding: '4px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1e293b' }

  const cellRenderers: Record<string, (n: NotaFiscal) => React.ReactNode> = {
    seq:        n => <td key="seq"        style={{ ...td, fontFamily: 'monospace' }}>#{n.numero_seq}</td>,
    lancamento: n => <td key="lancamento" style={td}>{formatDate(n.data_lancamento)}</td>,
    empresa:    n => <td key="empresa"    style={td}>{n.empresa_nome ?? '-'}</td>,
    unidade:    n => <td key="unidade"    style={td}>{n.unidade_nome ?? '-'}</td>,
    cc:         n => <td key="cc"         style={{ ...td, fontFamily: 'monospace' }}>{n.cc_codigo ?? '-'}</td>,
    fornecedor: n => <td key="fornecedor" style={td}>{n.fornecedor_nome ?? '-'}</td>,
    nf_numero:  n => <td key="nf_numero"  style={{ ...td, fontFamily: 'monospace' }}>{n.nf_numero ?? '-'}</td>,
    descricao:  n => <td key="descricao"  style={td}>{n.descricao ?? '-'}</td>,
    valor_nota: n => <td key="valor_nota" style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{formatBRL(n.valor_nota)}</td>,
    vencimento: n => <td key="vencimento" style={{ ...td, fontFamily: 'monospace' }}>{formatDate(n.vencimento)}</td>,
    status:     n => (
      <td key="status" style={td}>
        <span style={{
          display: 'inline-block', padding: '2px 5px', borderRadius: 4,
          backgroundColor: n.status === 'pago' ? '#dcfce7' : '#fef9c3',
          color: n.status === 'pago' ? '#14532d' : '#713f12',
          fontSize: 9, fontWeight: 700, border: `1px solid ${n.status === 'pago' ? '#86efac' : '#fde047'}`,
        }}>
          {n.status === 'pago' ? 'Pago' : 'A Pagar'}
        </span>
      </td>
    ),
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#1e293b', background: '#fff' }}>
      <div style={{ borderBottom: '2px solid #1e293b', paddingBottom: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>Relatório de Custo</h1>
        <div style={{ marginTop: 6, color: '#334155', fontSize: 10 }}>
          <div><strong>Filtros:</strong> {labelFiltros}</div>
          <div style={{ marginTop: 2 }}>Gerado em: {new Date().toLocaleString('pt-BR')}</div>
        </div>
      </div>

      {notas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#475569' }}>Nenhuma nota fiscal encontrada para os filtros selecionados.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, tableLayout: 'fixed' }}>
          <colgroup>
            {cols.map(c => <col key={c.key} style={{ width: c.width }} />)}
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: '#e2e8f0' }}>
              {cols.map(c => (
                <th key={c.key} style={{ padding: '5px 4px', textAlign: 'left', borderBottom: '2px solid #94a3b8', color: '#0f172a', whiteSpace: 'nowrap', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {notas.map((n, i) => (
              <tr key={n.id} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {cols.map(c => cellRenderers[c.key](n))}
              </tr>
            ))}
          </tbody>
          {valorNotaIdx !== -1 && (
            <tfoot>
              <tr style={{ backgroundColor: '#e2e8f0', fontWeight: 700, borderTop: '2px solid #94a3b8' }}>
                {valorNotaIdx > 0
                  ? <td colSpan={valorNotaIdx} style={{ padding: '6px 4px', color: '#0f172a' }}>Total — {notas.length} nota{notas.length !== 1 ? 's' : ''} fiscal{notas.length !== 1 ? 'is' : ''}</td>
                  : <td style={{ padding: '6px 4px', color: '#0f172a' }}>Total — {notas.length} nota{notas.length !== 1 ? 's' : ''} fiscal{notas.length !== 1 ? 'is' : ''}</td>
                }
                <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'monospace', color: '#0f172a' }}>{formatBRL(totalNota)}</td>
                {colsAfterValor > 0 && <td colSpan={colsAfterValor} />}
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  )
}

function buildReportHtml(notas: NotaFiscal[], totalNota: number, labelFiltros: string, colsSelecionadas: Set<string>): string {
  const cols = COLUNAS.filter(c => colsSelecionadas.has(c.key))
  const valorNotaIdx = cols.findIndex(c => c.key === 'valor_nota')
  const colsAfterValor = cols.length - valorNotaIdx - 1

  const cell = 'padding:4px 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1e293b'

  const cellHtml: Record<string, (n: NotaFiscal) => string> = {
    seq:        n => `<td style="${cell};font-family:monospace">#${n.numero_seq}</td>`,
    lancamento: n => `<td style="${cell}">${formatDate(n.data_lancamento) ?? '-'}</td>`,
    empresa:    n => `<td style="${cell}">${n.empresa_nome ?? '-'}</td>`,
    unidade:    n => `<td style="${cell}">${n.unidade_nome ?? '-'}</td>`,
    cc:         n => `<td style="${cell};font-family:monospace">${n.cc_codigo ?? '-'}</td>`,
    fornecedor: n => `<td style="${cell}">${n.fornecedor_nome ?? '-'}</td>`,
    nf_numero:  n => `<td style="${cell};font-family:monospace">${n.nf_numero ?? '-'}</td>`,
    descricao:  n => `<td style="${cell}">${n.descricao ?? '-'}</td>`,
    valor_nota: n => `<td style="${cell};text-align:right;font-family:monospace">${formatBRL(n.valor_nota)}</td>`,
    vencimento: n => `<td style="${cell};font-family:monospace">${formatDate(n.vencimento) ?? '-'}</td>`,
    status:     n => `<td style="${cell}"><span style="display:inline-block;padding:2px 5px;border-radius:4px;background:${n.status === 'pago' ? '#dcfce7' : '#fef9c3'};color:${n.status === 'pago' ? '#14532d' : '#713f12'};font-size:9px;font-weight:700;border:1px solid ${n.status === 'pago' ? '#86efac' : '#fde047'}">${n.status === 'pago' ? 'Pago' : 'A Pagar'}</span></td>`,
  }

  const rows = notas.map((n, i) =>
    `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};border-bottom:1px solid #e2e8f0">${cols.map(c => cellHtml[c.key](n)).join('')}</tr>`
  ).join('')

  const emptyRow = `<tr><td colspan="${cols.length}" style="padding:32px;text-align:center;color:#475569">Nenhuma nota fiscal encontrada para os filtros selecionados.</td></tr>`

  const colgroupHtml = cols.map(c => `<col style="width:${c.width}px">`).join('')
  const theadHtml = cols.map(c => `<th style="padding:5px 4px;text-align:left;border-bottom:2px solid #94a3b8;color:#0f172a;white-space:nowrap;font-weight:700;overflow:hidden;text-overflow:ellipsis">${c.label}</th>`).join('')

  const tfootHtml = valorNotaIdx !== -1 ? `
    <tfoot>
      <tr style="background:#e2e8f0;font-weight:700;border-top:2px solid #94a3b8">
        <td ${valorNotaIdx > 0 ? `colspan="${valorNotaIdx}"` : ''} style="padding:6px 5px;color:#0f172a">Total — ${notas.length} nota${notas.length !== 1 ? 's' : ''} fiscal${notas.length !== 1 ? 'is' : ''}</td>
        <td style="padding:6px 5px;text-align:right;font-family:monospace;color:#0f172a">${formatBRL(totalNota)}</td>
        ${colsAfterValor > 0 ? `<td colspan="${colsAfterValor}"></td>` : ''}
      </tr>
    </tfoot>` : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Custo</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #1e293b; background: #fff; padding: 16px; }
  @page { size: A4 landscape; margin: 10mm; }
</style>
</head>
<body>
  <div style="border-bottom:2px solid #1e293b;padding-bottom:12px;margin-bottom:16px">
    <h1 style="font-size:16px;font-weight:700;color:#0f172a">Relatório de Custo</h1>
    <div style="margin-top:6px;color:#334155;font-size:10px">
      <div><strong>Filtros:</strong> ${labelFiltros}</div>
      <div style="margin-top:2px">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed">
    <colgroup>${colgroupHtml}</colgroup>
    <thead><tr style="background:#e2e8f0">${theadHtml}</tr></thead>
    <tbody>${notas.length === 0 ? emptyRow : rows}</tbody>
    ${tfootHtml}
  </table>
</body>
</html>`
}
