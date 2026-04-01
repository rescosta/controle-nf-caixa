import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Download, CheckCircle, Trash2, Edit, FileText, Printer, RotateCcw, BarChart2, Copy, X, Mail } from 'lucide-react'
import { api } from '../../lib/api'
import { formatBRL, formatDate, isVencido, isVencendoHoje, today, addDays } from '../../lib/format'
import type { NotaFiscal, Empresa, Unidade, CentroCusto, Fornecedor } from '../../types'
import NFForm from './NFForm'
import NFPrintModal from './NFPrint'
import NFEmailModal from './NFEmailModal'
import SearchableSelect from '../../components/SearchableSelect'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'
import RelatorioModal from '../relatorios/RelatorioModal'

interface Stats { total_a_pagar: number; vencendo_hoje: number; vencidos: number }
type QuickDays = 3 | 7 | 15 | 30 | null

export default function NFList() {
  const [notas, setNotas] = useState<NotaFiscal[]>([])
  const [stats, setStats] = useState<Stats>({ total_a_pagar: 0, vencendo_hoje: 0, vencidos: 0 })
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [ccs, setCcs] = useState<CentroCusto[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [minNFSeq, setMinNFSeq] = useState<number | null>(null)
  const [firstNFId, setFirstNFId] = useState<number | null>(null)
  const [showNumeracao, setShowNumeracao] = useState(false)
  const [numeracaoVal, setNumeracaoVal] = useState('')
  const [showRelatorio, setShowRelatorio] = useState(false)
  const [quickDays, setQuickDays] = useState<QuickDays>(30)
  const [filters, setFilters] = useState(() => ({
    empresa_id: '', unidade_id: '', centro_custo_id: '', fornecedor_id: '', status: '',
    data_inicio: addDays(today(), -30), data_fim: addDays(today(), 30), search: ''
  }))
  const [showForm, setShowForm] = useState(false)
  const [editingNF, setEditingNF] = useState<NotaFiscal | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [pagandoId, setPagandoId] = useState<number | null>(null)
  const [dataPagamento, setDataPagamento] = useState(today())
  const [printingNF, setPrintingNF] = useState<NotaFiscal | null>(null)
  const [desfazendoId, setDesfazendoId] = useState<number | null>(null)
  const [emailNF, setEmailNF] = useState<NotaFiscal | null>(null)

  const load = useCallback(async () => {
    const f: Record<string, unknown> = {}
    if (filters.empresa_id) f.empresa_id = Number(filters.empresa_id)
    if (filters.unidade_id) f.unidade_id = Number(filters.unidade_id)
    if (filters.centro_custo_id) f.centro_custo_id = Number(filters.centro_custo_id)
    if (filters.fornecedor_id) f.fornecedor_id = Number(filters.fornecedor_id)
    const statusBackend = filters.status === 'vencidos' || filters.status === 'vencendo_hoje' ? 'a_pagar' : filters.status
    if (statusBackend) f.status = statusBackend
    if (filters.data_inicio) f.data_inicio = filters.data_inicio
    if (filters.data_fim) f.data_fim = filters.data_fim
    const [ns, st] = await Promise.all([api.nf.list(f), api.nf.stats(f)])
    setNotas(ns as NotaFiscal[])
    setStats(st as Stats)
  }, [filters])

  useEffect(() => {
    Promise.all([api.empresas.list(), api.unidades.list(), api.centrosCusto.list(), api.fornecedores.list(), api.nf.getMinSeq(), api.nf.getFirstNF()]).then(([e, u, cc, f, minSeq, firstNF]) => {
      setEmpresas(e as Empresa[]); setUnidades(u as Unidade[]); setCcs(cc as CentroCusto[]); setFornecedores(f as Fornecedor[])
      setMinNFSeq(minSeq as number | null)
      const first = firstNF as { id: number; numero_seq: number } | null
      setFirstNFId(first?.id ?? null)
      setNumeracaoVal(String(first?.numero_seq ?? 1))
    })
  }, [])

  useEffect(() => {
    if (quickDays !== null) {
      setFilters(f => ({ ...f, data_inicio: addDays(today(), -quickDays), data_fim: addDays(today(), quickDays) }))
    } else {
      setFilters(f => ({ ...f, data_inicio: '', data_fim: '' }))
    }
  }, [quickDays])

  useEffect(() => { load() }, [load])

  const filtered = notas.filter(n => {
    if (filters.status === 'vencidos' && !isVencido(n.vencimento, n.status)) return false
    if (filters.status === 'vencendo_hoje' && !isVencendoHoje(n.vencimento, n.status)) return false
    if (!filters.search) return true
    const s = filters.search.toLowerCase()
    return (
      String(n.numero_seq).includes(s) ||
      (n.fornecedor_nome ?? '').toLowerCase().includes(s) ||
      (n.descricao ?? '').toLowerCase().includes(s) ||
      (n.nf_numero ?? '').toLowerCase().includes(s)
    )
  })

  async function handleDelete() {
    if (!deletingId) return
    await api.nf.delete(deletingId)
    setDeletingId(null)
    load()
  }

  async function handleMarcarPago() {
    if (!pagandoId) return
    await api.nf.marcarPago(pagandoId, dataPagamento)
    setPagandoId(null)
    load()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-100">Controle de Notas Fiscais</h1>
          <div className="flex gap-2">
<button className="btn-secondary btn-sm" onClick={() => setShowRelatorio(true)}>
              <BarChart2 size={14} /> Relatório
            </button>
            <button className="btn-secondary btn-sm" onClick={() => api.nf.exportExcel(filters as Record<string,unknown>)}>
              <Download size={14} /> Exportar Excel
            </button>
            <button className="btn-primary btn-sm" onClick={() => { setEditingNF(null); setShowForm(true) }}>
              <Plus size={14} /> Nova NF
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatCard label="Total a Pagar" value={formatBRL(stats.total_a_pagar)} color="blue" />
          <StatCard label="Vencendo Hoje" value={String(stats.vencendo_hoje)} color="yellow" />
          <StatCard label="Vencidos" value={String(stats.vencidos)} color="red" />
        </div>

        {/* Quick filters de período */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-slate-500 mr-1">Vencimento:</span>
          {([3, 7, 15, 30] as const).map(d => (
            <button
              key={d}
              onClick={() => setQuickDays(d)}
              className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                quickDays === d
                  ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                  : 'border-slate-600 text-slate-400 hover:border-slate-500'
              }`}
            >
              {d} dias
            </button>
          ))}
          <button
            onClick={() => setQuickDays(null)}
            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
              quickDays === null
                ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                : 'border-slate-600 text-slate-400 hover:border-slate-500'
            }`}
          >
            Tudo
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 w-96 shrink-0">
            <Search size={14} className="text-slate-500" />
            <input
              className="bg-transparent border-0 p-0 flex-1 text-sm focus:ring-0 text-slate-200"
              placeholder="Buscar NF, fornecedor, descrição..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
          </div>
          <SearchableSelect
            value={filters.empresa_id ? Number(filters.empresa_id) : undefined}
            onChange={id => setFilters(f => ({ ...f, empresa_id: id ? String(id) : '' }))}
            options={empresas.map(e => ({ id: e.id, label: e.nome }))}
            placeholder="Todas empresas"
            className="min-w-36"
          />
          <SearchableSelect
            value={filters.unidade_id ? Number(filters.unidade_id) : undefined}
            onChange={id => setFilters(f => ({ ...f, unidade_id: id ? String(id) : '' }))}
            options={unidades.map(u => ({ id: u.id, label: u.nome }))}
            placeholder="Todas unidades"
            className="min-w-36"
          />
          <SearchableSelect
            value={filters.fornecedor_id ? Number(filters.fornecedor_id) : undefined}
            onChange={id => setFilters(f => ({ ...f, fornecedor_id: id ? String(id) : '' }))}
            options={fornecedores.map(f => ({ id: f.id, label: f.nome }))}
            placeholder="Todos fornecedores"
            className="min-w-36"
          />
          <SearchableSelect
            value={filters.centro_custo_id ? Number(filters.centro_custo_id) : undefined}
            onChange={id => setFilters(f => ({ ...f, centro_custo_id: id ? String(id) : '' }))}
            options={ccs.map(cc => ({ id: cc.id, label: `${cc.codigo} - ${cc.descricao}` }))}
            placeholder="Todos CC"
            className="min-w-36"
          />
          <select className="text-sm py-2" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">Todos status</option>
            <option value="a_pagar">A Pagar</option>
            <option value="pago">Pago</option>
            <option value="vencidos">Vencidos</option>
            <option value="vencendo_hoje">Vencendo hoje</option>
          </select>
          <input type="date" className="text-sm py-2" value={filters.data_inicio} onChange={e => { setQuickDays(null); setFilters(f => ({ ...f, data_inicio: e.target.value })) }} title="Vencimento de" />
          <input type="date" className="text-sm py-2" value={filters.data_fim} onChange={e => { setQuickDays(null); setFilters(f => ({ ...f, data_fim: e.target.value })) }} title="Vencimento até" />
          {(filters.empresa_id || filters.unidade_id || filters.fornecedor_id || filters.centro_custo_id || filters.status || filters.search || filters.data_inicio || filters.data_fim) && (
            <button
              className="btn-ghost btn-sm flex items-center gap-1 text-slate-400 hover:text-slate-200"
              onClick={() => { setQuickDays(null); setFilters({ empresa_id: '', unidade_id: '', centro_custo_id: '', fornecedor_id: '', status: '', data_inicio: '', data_fim: '', search: '' }) }}
            >
              <X size={13} /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {filtered.length === 0 ? (
          <EmptyState icon={<FileText size={48} />} title="Nenhuma NF encontrada" description="Clique em Nova NF para lançar uma nota fiscal" action={<button className="btn-primary btn-sm" onClick={() => setShowForm(true)}><Plus size={14} /> Nova NF</button>} />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nº Seq</th>
                  <th>Lançamento</th>
                  <th>Empresa</th>
                  <th>Unidade</th>
                  <th>Fornecedor</th>
                  <th>Nº NF</th>
                  <th>Descrição</th>
                  <th>Valor Nota</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(n => {
                  const vencido = isVencido(n.vencimento, n.status)
                  const vencendoHoje = isVencendoHoje(n.vencimento, n.status)
                  return (
                    <tr key={n.id} className={vencido ? 'bg-red-950/20' : vencendoHoje ? 'bg-yellow-950/20' : ''}>
                      <td className="font-mono text-slate-400">#{n.numero_seq}</td>
                      <td className="text-slate-400">{formatDate(n.data_lancamento)}</td>
                      <td>{n.empresa_nome ?? '-'}</td>
                      <td>{n.unidade_nome ?? '-'}</td>
                      <td className="font-medium max-w-40 truncate" title={n.fornecedor_nome ?? undefined}>{n.fornecedor_nome ?? '-'}</td>
                      <td className="font-mono text-slate-400">{n.nf_numero ?? '-'}</td>
                      <td className="max-w-48 truncate" title={n.descricao}>{n.descricao ?? '-'}</td>
                      <td className="text-right font-mono">{formatBRL(n.valor_nota)}</td>
                      <td className={`font-mono ${vencido ? 'text-red-400' : vencendoHoje ? 'text-yellow-400' : ''}`}>
                        {formatDate(n.vencimento)}
                        {vencido && <span className="ml-1 text-xs text-red-500">VENCIDO</span>}
                        {vencendoHoje && <span className="ml-1 text-xs text-yellow-500">HOJE</span>}
                      </td>
                      <td>
                        {n.status === 'pago'
                          ? <span className="badge-green">Pago{n.data_pagamento ? ` ${formatDate(n.data_pagamento)}` : ''}</span>
                          : n.status === 'pendente'
                          ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-400">Pendente</span>
                          : <span className="badge-yellow">A Pagar</span>}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {(n.status === 'a_pagar' || n.status === 'pendente') && (
                            <button className="btn-ghost btn-sm p-1.5 text-green-400 hover:bg-green-900/30" title="Marcar como pago" onClick={() => { setPagandoId(n.id); setDataPagamento(today()) }}>
                              <CheckCircle size={14} />
                            </button>
                          )}
                          {n.status === 'pago' && (
                            <button className="btn-ghost btn-sm p-1.5 text-orange-400 hover:bg-orange-900/30" title="Desfazer pagamento" onClick={() => setDesfazendoId(n.id)}>
                              <RotateCcw size={14} />
                            </button>
                          )}
                          <button className="btn-ghost btn-sm p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20" title="Duplicar" onClick={async () => { await api.nf.duplicate(n.id); load() }}>
                            <Copy size={14} />
                          </button>
                          <button className="btn-ghost btn-sm p-1.5" title="Editar" onClick={() => { setEditingNF(n); setShowForm(true) }}>
                            <Edit size={14} />
                          </button>
                          <button className="btn-ghost btn-sm p-1.5 text-slate-400 hover:bg-slate-700/50" title="Imprimir / PDF" onClick={() => setPrintingNF(n)}>
                            <Printer size={14} />
                          </button>
                          <button
                            className={`btn-ghost btn-sm p-1.5 hover:bg-blue-900/20 relative ${n.email_enviado ? 'text-green-400' : 'text-slate-400 hover:text-blue-400'}`}
                            title={n.email_enviado ? 'E-mail enviado' : 'Enviar por e-mail'}
                            onClick={() => setEmailNF(n)}
                          >
                            <Mail size={14} />
                            {n.email_enviado ? (
                              <span className="absolute -bottom-0.5 -right-0.5 bg-slate-900 rounded-full">
                                <CheckCircle size={8} className="text-green-400" />
                              </span>
                            ) : null}
                          </button>
                          <button className="btn-ghost btn-sm p-1.5 text-red-400 hover:bg-red-900/30" title="Apagar" onClick={() => setDeletingId(n.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modais */}
      {showForm && (
        <NFForm
          nf={editingNF}
          empresas={empresas}
          unidades={unidades}
          ccs={ccs}
          minNFSeq={minNFSeq}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); api.nf.getMinSeq().then(s => setMinNFSeq(s as number | null)) }}
          onSavedAndNew={() => { load(); api.nf.getMinSeq().then(s => setMinNFSeq(s as number | null)) }}
        />
      )}

      {deletingId !== null && (
        <ConfirmDialog
          title="Excluir NF"
          message="Tem certeza que deseja excluir esta nota fiscal? Todas as parcelas também serão excluídas."
          confirmLabel="Excluir"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {pagandoId !== null && (
        <Modal title="Marcar como Pago" onClose={() => setPagandoId(null)} maxWidth="max-w-sm">
          <div className="form-group">
            <label>Data do Pagamento</label>
            <input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button className="btn-secondary" onClick={() => setPagandoId(null)}>Cancelar</button>
            <button className="btn-success" onClick={handleMarcarPago}><CheckCircle size={14} /> Confirmar Pagamento</button>
          </div>
        </Modal>
      )}

      {printingNF && (
        <NFPrintModal nf={printingNF} onClose={() => setPrintingNF(null)} />
      )}

      {emailNF && (
        <NFEmailModal nf={emailNF} onClose={() => setEmailNF(null)} onSent={load} />
      )}

      {desfazendoId !== null && (
        <ConfirmDialog
          title="Desfazer Pagamento"
          message="Deseja reverter esta NF para 'A Pagar'? A data de pagamento será removida."
          confirmLabel="Desfazer"
          danger
          onConfirm={async () => {
            await api.nf.desfazerPagamento(desfazendoId)
            setDesfazendoId(null)
            load()
          }}
          onCancel={() => setDesfazendoId(null)}
        />
      )}

      {showNumeracao && (
        <Modal title="Numeração de NF" onClose={() => setShowNumeracao(false)} maxWidth="max-w-sm">
          <p className="text-sm text-slate-400 mb-4">
            {firstNFId
              ? 'Define o número sequencial do primeiro lançamento cadastrado. Os demais são ajustados automaticamente a partir dele.'
              : 'Nenhum lançamento cadastrado. O próximo será criado com este número.'}
          </p>
          <div className="form-group">
            <label>Número inicial</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={numeracaoVal}
              onChange={e => setNumeracaoVal(e.target.value.replace(/\D/g, ''))}
              onFocus={e => e.target.select()}
              onKeyDown={e => { if (e.key === 'Enter') (document.getElementById('btn-salvar-numeracao') as HTMLButtonElement)?.click() }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button className="btn-secondary" onClick={() => setShowNumeracao(false)}>Cancelar</button>
            <button
              id="btn-salvar-numeracao"
              className="btn-primary"
              onClick={async () => {
                const val = parseInt(numeracaoVal, 10)
                if (!val || val < 1) return
                if (firstNFId) {
                  await api.nf.update(firstNFId, { numero_seq: val })
                } else {
                  await api.settings.set('seq_inicial', String(val))
                }
                setShowNumeracao(false)
                const [minSeq, firstNF] = await Promise.all([api.nf.getMinSeq(), api.nf.getFirstNF()])
                setMinNFSeq(minSeq as number | null)
                const first = firstNF as { id: number; numero_seq: number } | null
                setFirstNFId(first?.id ?? null)
                load()
              }}
            >
              Salvar
            </button>
          </div>
        </Modal>
      )}

      {showRelatorio && (
        <RelatorioModal
          empresas={empresas}
          unidades={unidades}
          ccs={ccs}
          fornecedores={fornecedores}
          onClose={() => setShowRelatorio(false)}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: 'blue' | 'yellow' | 'red' }) {
  const colors = {
    blue: 'border-blue-700/50 bg-blue-900/20 text-blue-300',
    yellow: 'border-yellow-700/50 bg-yellow-900/20 text-yellow-300',
    red: 'border-red-700/50 bg-red-900/20 text-red-300',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-xs uppercase tracking-wide opacity-70 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
