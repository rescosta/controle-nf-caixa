import { useEffect, useState, useCallback } from 'react'
import { Plus, Folder, FolderOpen, Trash2, Edit, ArrowRight, Search, X, Printer } from 'lucide-react'
import SearchableSelect from '../../components/SearchableSelect'
import { api } from '../../lib/api'
import { formatDate, formatBRL } from '../../lib/format'
import type { Caixa, Empresa, Unidade } from '../../types'
import CaixaForm from './CaixaForm'
import CaixaDetail from './CaixaDetail'
import CaixaPrint from './CaixaPrint'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'

export default function CaixaList() {
  const [caixas, setCaixas] = useState<Caixa[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [minCaixaNum, setMinCaixaNum] = useState<number | null>(null)
  const [lastCaixa, setLastCaixa] = useState<Caixa | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCaixa, setEditingCaixa] = useState<Caixa | null>(null)
  const [openCaixa, setOpenCaixa] = useState<Caixa | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [printingCaixa, setPrintingCaixa] = useState<Caixa | null>(null)
  const [filterEmpresa, setFilterEmpresa] = useState('')
  const [filterDe, setFilterDe] = useState('')
  const [filterAte, setFilterAte] = useState('')
  const [busca, setBusca] = useState('')

  const load = useCallback(async () => {
    const [cs, last] = await Promise.all([
      api.caixa.list({ busca: busca.trim() || undefined }),
      api.caixa.getLastCaixa(),
    ])
    setCaixas(cs as Caixa[])
    setLastCaixa(last as Caixa | null)
  }, [busca])

  useEffect(() => {
    Promise.all([api.empresas.list(), api.unidades.list(), api.caixa.getMinNumeroCaixa()]).then(([e, u, minNum]) => {
      setEmpresas(e as Empresa[]); setUnidades(u as Unidade[])
      setMinCaixaNum(minNum as number | null)
    })
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete() {
    if (!deletingId) return
    await api.caixa.delete(deletingId)
    setDeletingId(null)
    load()
  }

  async function toggleStatus(c: Caixa) {
    if (c.status === 'aberto') await api.caixa.fechar(c.id)
    else await api.caixa.reabrir(c.id)
    load()
  }

  const caixasFiltradas = caixas.filter(c => {
    if (filterEmpresa && String(c.empresa_id) !== filterEmpresa) return false
    if (filterDe && c.periodo_fim && c.periodo_fim < filterDe) return false
    if (filterAte && c.periodo_inicio && c.periodo_inicio > filterAte) return false
    return true
  })

  const hasFilter = filterEmpresa || filterDe || filterAte || busca

  if (openCaixa) {
    return (
      <CaixaDetail
        caixa={openCaixa}
        onBack={() => { setOpenCaixa(null); load() }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-100">Acerto de Caixa</h1>
          <button className="btn-primary btn-sm" onClick={() => { setEditingCaixa(null); setShowForm(true) }}>
            <Plus size={14} /> Novo Caixa
          </button>
        </div>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Empresa</label>
            <SearchableSelect
              value={filterEmpresa ? Number(filterEmpresa) : undefined}
              onChange={id => setFilterEmpresa(id ? String(id) : '')}
              options={empresas.map(e => ({ id: e.id, label: e.nome }))}
              placeholder="Todas as empresas"
              className="min-w-48"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Período — de</label>
            <input
              type="date"
              value={filterDe}
              onChange={e => setFilterDe(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">até</label>
            <input
              type="date"
              value={filterAte}
              onChange={e => setFilterAte(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar histórico ou favorecido..."
              className="pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded focus:outline-none focus:border-blue-500 text-slate-200 placeholder:text-slate-600 w-64"
            />
            {busca && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" onClick={() => setBusca('')}>
                <X size={12} />
              </button>
            )}
          </div>
          {hasFilter && (
            <button
              className="btn-ghost btn-sm flex items-center gap-1 text-slate-400 hover:text-slate-200"
              onClick={() => { setFilterEmpresa(''); setFilterDe(''); setFilterAte(''); setBusca('') }}
            >
              <X size={13} /> Limpar
            </button>
          )}
          <span className="text-xs text-slate-500 self-end pb-1.5 ml-auto">
            {caixasFiltradas.length} de {caixas.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {caixasFiltradas.length === 0 ? (
          <EmptyState
            icon={<Folder size={48} />}
            title="Nenhum acerto de caixa"
            description="Clique em Novo Caixa para abrir um acerto"
            action={<button className="btn-primary btn-sm" onClick={() => setShowForm(true)}><Plus size={14} /> Novo Caixa</button>}
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nº Caixa</th>
                  <th>Empresa</th>
                  <th>Unidade</th>
                  <th>Período</th>
                  <th>Data Envio</th>
                  <th>Executado Por</th>
                  <th>Responsável</th>
                  <th>Saldo Ant.</th>
                  <th>Saldo Final</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {caixasFiltradas.map(c => (
                  <tr key={c.id}>
                    <td className="font-mono font-bold text-blue-400">#{c.numero_caixa}</td>
                    <td>{c.empresa_nome ?? '-'}</td>
                    <td>{c.unidade_nome ?? '-'}</td>
                    <td className="text-slate-400">{formatDate(c.periodo_inicio)} – {formatDate(c.periodo_fim)}</td>
                    <td className="text-slate-400">{formatDate(c.data_envio)}</td>
                    <td>{c.executado_por ?? '-'}</td>
                    <td>{c.responsavel ?? '-'}</td>
                    <td className="font-mono text-right">{formatBRL(c.saldo_anterior)}</td>
                    <td className={`font-mono text-right font-semibold ${(c.saldo_final ?? c.saldo_anterior) < 0 ? 'text-red-400' : 'text-slate-200'}`}>
                      {formatBRL(c.saldo_final ?? c.saldo_anterior)}
                    </td>
                    <td>
                      <button onClick={() => toggleStatus(c)} title="Clique para alternar status">
                        {c.status === 'aberto'
                          ? <span className="badge-blue flex items-center gap-1"><FolderOpen size={12} />Aberto</span>
                          : <span className="badge-gray flex items-center gap-1"><Folder size={12} />Fechado</span>}
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-ghost btn-sm p-1.5 text-blue-400" title="Abrir lançamentos" onClick={() => setOpenCaixa(c)}>
                          <ArrowRight size={14} />
                        </button>
                        <button className="btn-ghost btn-sm p-1.5" title="Editar" onClick={() => { setEditingCaixa(c); setShowForm(true) }}>
                          <Edit size={14} />
                        </button>
                        <button className="btn-ghost btn-sm p-1.5 text-slate-400" title="Imprimir" onClick={() => setPrintingCaixa(c)}>
                          <Printer size={14} />
                        </button>
                        <button className="btn-ghost btn-sm p-1.5 text-red-400 hover:bg-red-900/30" title="Excluir" onClick={() => setDeletingId(c.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <CaixaForm
          caixa={editingCaixa}
          empresas={empresas}
          unidades={unidades}
          minCaixaNum={minCaixaNum}
          ultimoSaldoFinal={editingCaixa ? undefined : (lastCaixa?.saldo_final ?? lastCaixa?.saldo_anterior)}
          ultimoPeriodoFim={editingCaixa ? undefined : lastCaixa?.periodo_fim}
          onClose={() => setShowForm(false)}
          onSaved={async (newId?: number) => {
            setShowForm(false)
            load()
            api.caixa.getMinNumeroCaixa().then(m => setMinCaixaNum(m as number | null))
            if (newId) {
              const novoCaixa = await api.caixa.get(newId) as Caixa
              setOpenCaixa(novoCaixa)
            }
          }}
        />
      )}

      {printingCaixa && (
        <CaixaPrint caixa={printingCaixa} onClose={() => setPrintingCaixa(null)} />
      )}

      {deletingId !== null && (
        <ConfirmDialog
          title="Excluir Caixa"
          message="Tem certeza que deseja excluir este caixa? Todos os lançamentos também serão excluídos."
          confirmLabel="Excluir"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  )
}
