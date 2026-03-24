import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Plus, Trash2, Edit, Download, UtensilsCrossed, Save, X, Printer, Search } from 'lucide-react'
import { api } from '../../lib/api'
import { formatBRL, formatDate, today, normalizeSearch } from '../../lib/format'
import type { Caixa, CaixaLancamento } from '../../types'
import RefeicoesMes from './RefeicoesMes'
import CaixaPrint from './CaixaPrint'
import ConfirmDialog from '../../components/ConfirmDialog'

interface Props {
  caixa: Caixa
  onBack: () => void
}

interface LancamentoEdit {
  id?: number
  data: string
  historico: string
  favorecido: string
  valor_debito: string
  valor_credito: string
  tipo: string
}

const parseVal = (s: string) => parseFloat((s || '0').replace(',', '.')) || 0

const emptyEdit = (): LancamentoEdit => ({
  data: today(), historico: '', favorecido: '',
  valor_debito: '', valor_credito: '', tipo: 'normal'
})

export default function CaixaDetail({ caixa, onBack }: Props) {
  const [lancamentos, setLancamentos] = useState<CaixaLancamento[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<LancamentoEdit>(emptyEdit())
  const [addingNew, setAddingNew] = useState(false)
  const [newForm, setNewForm] = useState<LancamentoEdit>(emptyEdit())
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showRefeicoes, setShowRefeicoes] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [busca, setBusca] = useState('')

  const load = useCallback(async () => {
    const ls = await api.caixa.getLancamentos(caixa.id)
    setLancamentos(ls as CaixaLancamento[])
  }, [caixa.id])

  useEffect(() => { load() }, [load])

  const saldoFinal = lancamentos.length > 0 ? lancamentos[lancamentos.length - 1].saldo : 0

  const lancamentosFiltrados = busca.trim()
    ? lancamentos.filter(l =>
        normalizeSearch(l.historico ?? '').includes(normalizeSearch(busca)) ||
        normalizeSearch(l.favorecido ?? '').includes(normalizeSearch(busca))
      )
    : lancamentos

  async function handleAdd() {
    await api.caixa.createLancamento({
      caixa_id: caixa.id,
      data: newForm.data || null,
      historico: newForm.historico || null,
      favorecido: newForm.favorecido || null,
      valor_debito: parseVal(newForm.valor_debito),
      valor_credito: parseVal(newForm.valor_credito),
      tipo: newForm.tipo,
    })
    setAddingNew(false)
    setNewForm(emptyEdit())
    load()
  }

  async function handleUpdate() {
    if (!editingId) return
    await api.caixa.updateLancamento(editingId, {
      caixa_id: caixa.id,
      data: editForm.data || null,
      historico: editForm.historico || null,
      favorecido: editForm.favorecido || null,
      valor_debito: parseVal(editForm.valor_debito),
      valor_credito: parseVal(editForm.valor_credito),
      tipo: editForm.tipo,
    })
    setEditingId(null)
    load()
  }

  async function handleDelete() {
    if (!deletingId) return
    await api.caixa.deleteLancamento(deletingId, caixa.id)
    setDeletingId(null)
    load()
  }

  function startEdit(l: CaixaLancamento) {
    setEditingId(l.id)
    setEditForm({
      data: l.data ?? '',
      historico: l.historico ?? '',
      favorecido: l.favorecido ?? '',
      valor_debito: l.valor_debito ? Number(l.valor_debito).toFixed(2).replace('.', ',') : '',
      valor_credito: l.valor_credito ? Number(l.valor_credito).toFixed(2).replace('.', ',') : '',
      tipo: l.tipo,
    })
  }

  if (showRefeicoes) {
    const mes = caixa.periodo_inicio ? Number(caixa.periodo_inicio.split('-')[1]) : new Date().getMonth() + 1
    const ano = caixa.periodo_inicio ? Number(caixa.periodo_inicio.split('-')[0]) : new Date().getFullYear()
    return (
      <RefeicoesMes
        mes={mes}
        ano={ano}
        caixa={caixa}
        onBack={() => { setShowRefeicoes(false); load() }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-4 mb-3">
          <button className="btn-ghost btn-sm p-2" onClick={onBack}>
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-100">
              Caixa #{caixa.numero_caixa} — {caixa.unidade_nome}
            </h1>
            <p className="text-sm text-slate-400">
              Período: {formatDate(caixa.periodo_inicio)} a {formatDate(caixa.periodo_fim)} |
              Executado por: {caixa.executado_por} | Responsável: {caixa.responsavel}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setShowRefeicoes(true)}>
              <UtensilsCrossed size={14} /> Refeições
            </button>
            <button className="btn-secondary btn-sm" onClick={() => setShowPrint(true)}>
              <Printer size={14} /> Imprimir
            </button>
            <button className="btn-secondary btn-sm" onClick={() => api.caixa.exportExcel(caixa.id)}>
              <Download size={14} /> Exportar Excel
            </button>
            <button className="btn-primary btn-sm" onClick={() => setAddingNew(true)} disabled={caixa.status === 'fechado'}>
              <Plus size={14} /> Novo Lançamento
            </button>
            <button className="btn-success btn-sm" onClick={onBack}>
              OK / Concluir
            </button>
          </div>
        </div>

        {/* Saldo info */}
        <div className="flex gap-4">
          <div className="card py-3 px-4 flex-1">
            <div className="text-xs text-slate-500 uppercase">Saldo Anterior <span className="text-slate-600 normal-case">(informativo)</span></div>
            <div className="text-lg font-bold font-mono text-slate-400">{formatBRL(caixa.saldo_anterior)}</div>
          </div>
          <div className="card py-3 px-4 flex-1">
            <div className="text-xs text-slate-500 uppercase">Total Débitos</div>
            <div className="text-lg font-bold font-mono text-red-400">
              {formatBRL(lancamentos.reduce((s, l) => s + Number(l.valor_debito ?? 0), 0))}
            </div>
          </div>
          <div className="card py-3 px-4 flex-1">
            <div className="text-xs text-slate-500 uppercase">Total Créditos</div>
            <div className="text-lg font-bold font-mono text-green-400">
              {formatBRL(lancamentos.reduce((s, l) => s + Number(l.valor_credito ?? 0), 0))}
            </div>
          </div>
          <div className={`card py-3 px-4 flex-1 ${saldoFinal < 0 ? 'border-red-700/50 bg-red-900/20' : 'border-green-700/50 bg-green-900/20'}`}>
            <div className="text-xs text-slate-500 uppercase">Saldo Final</div>
            <div className={`text-lg font-bold font-mono ${saldoFinal < 0 ? 'text-red-400' : 'text-green-400'}`}>
              {formatBRL(saldoFinal)}
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar histórico ou favorecido..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded focus:outline-none focus:border-blue-500 text-slate-200 placeholder:text-slate-600"
            />
            {busca && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" onClick={() => setBusca('')}>
                <X size={12} />
              </button>
            )}
          </div>
          {busca && (
            <span className="text-xs text-slate-500">{lancamentosFiltrados.length} de {lancamentos.length}</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="w-12">NUM</th>
                <th className="w-28">DATA</th>
                <th>HISTÓRICO</th>
                <th>FAVORECIDO</th>
                <th className="w-32 text-right">DÉBITO</th>
                <th className="w-32 text-right">CRÉDITO</th>
                <th className="w-36 text-right">SALDO</th>
                {caixa.status === 'aberto' && <th className="w-20">AÇÕES</th>}
              </tr>
            </thead>
            <tbody>
              {/* Linha saldo anterior */}
              <tr className="bg-slate-900/50">
                <td className="text-slate-500">-</td>
                <td className="text-slate-500">-</td>
                <td className="text-slate-400 italic">Saldo Anterior</td>
                <td></td>
                <td></td>
                <td></td>
                <td className="text-right font-mono font-bold">{formatBRL(caixa.saldo_anterior)}</td>
                {caixa.status === 'aberto' && <td></td>}
              </tr>

              {lancamentosFiltrados.map((l, idx) => (
                editingId === l.id ? (
                  <EditRow
                    key={l.id}
                    form={editForm}
                    onChange={setEditForm}
                    onSave={handleUpdate}
                    onCancel={() => setEditingId(null)}
                    showActions
                  />
                ) : (
                  <tr key={l.id} className={l.tipo === 'refeicoes' ? 'bg-purple-900/10' : ''}>
                    <td className="font-mono text-slate-500">{idx + 1}</td>
                    <td className="text-slate-400">{formatDate(l.data)}</td>
                    <td className={l.tipo === 'refeicoes' ? 'text-purple-300' : ''}>{l.historico}</td>
                    <td className="text-slate-400">{l.favorecido}</td>
                    <td className="text-right font-mono text-red-400">{l.valor_debito ? formatBRL(l.valor_debito) : ''}</td>
                    <td className="text-right font-mono text-green-400">{l.valor_credito ? formatBRL(l.valor_credito) : ''}</td>
                    <td className={`text-right font-mono font-semibold ${l.saldo < 0 ? 'text-red-400' : 'text-slate-200'}`}>
                      {formatBRL(l.saldo)}
                    </td>
                    {caixa.status === 'aberto' && (
                      <td>
                        <div className="flex gap-1">
                          <button className="btn-ghost btn-sm p-1.5" onClick={() => startEdit(l)}><Edit size={13} /></button>
                          <button className="btn-ghost btn-sm p-1.5 text-red-400" onClick={() => setDeletingId(l.id)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              ))}

              {/* Nova linha */}
              {addingNew && (
                <EditRow
                  form={newForm}
                  onChange={setNewForm}
                  onSave={handleAdd}
                  onCancel={() => setAddingNew(false)}
                  showActions
                />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPrint && (
        <CaixaPrint caixa={caixa} onClose={() => setShowPrint(false)} />
      )}

      {deletingId !== null && (
        <ConfirmDialog
          title="Excluir Lançamento"
          message="Deseja excluir este lançamento? O saldo será recalculado automaticamente."
          confirmLabel="Excluir"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  )
}

function EditRow({ form, onChange, onSave, onCancel, showActions }: {
  form: LancamentoEdit
  onChange: (f: LancamentoEdit) => void
  onSave: () => void
  onCancel: () => void
  showActions: boolean
}) {
  function set(key: keyof LancamentoEdit, value: string) {
    onChange({ ...form, [key]: value })
  }
  function formatValor(key: 'valor_debito' | 'valor_credito', value: string) {
    const n = parseVal(value)
    onChange({ ...form, [key]: n > 0 ? n.toFixed(2).replace('.', ',') : '' })
  }
  return (
    <tr className="bg-blue-900/20 border-y border-blue-700/40">
      <td><input className="w-full" disabled value="—" /></td>
      <td><input type="date" className="w-full" value={form.data} onChange={e => set('data', e.target.value)} /></td>
      <td><input className="w-full" value={form.historico} onChange={e => set('historico', e.target.value)} placeholder="Histórico..." /></td>
      <td><input className="w-full" value={form.favorecido} onChange={e => set('favorecido', e.target.value)} placeholder="Favorecido..." /></td>
      <td><input type="text" inputMode="decimal" className="w-full text-right" value={form.valor_debito} onChange={e => set('valor_debito', e.target.value)} onBlur={e => formatValor('valor_debito', e.target.value)} placeholder="0,00" /></td>
      <td><input type="text" inputMode="decimal" className="w-full text-right" value={form.valor_credito} onChange={e => set('valor_credito', e.target.value)} onBlur={e => formatValor('valor_credito', e.target.value)} placeholder="0,00" /></td>
      <td className="text-right text-slate-500 italic text-sm">Calculado</td>
      {showActions && (
        <td>
          <div className="flex gap-1">
            <button className="btn-primary btn-sm p-1.5" onClick={onSave}><Save size={13} /></button>
            <button className="btn-ghost btn-sm p-1.5" onClick={onCancel}><X size={13} /></button>
          </div>
        </td>
      )}
    </tr>
  )
}
