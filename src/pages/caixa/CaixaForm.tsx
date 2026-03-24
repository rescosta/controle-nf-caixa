import { useState, useEffect } from 'react'
import Modal from '../../components/Modal'
import { api } from '../../lib/api'
import { today, addDays } from '../../lib/format'
import type { Caixa, Empresa, Funcionario, Unidade } from '../../types'

interface Props {
  caixa: Caixa | null
  empresas: Empresa[]
  unidades: Unidade[]
  minCaixaNum: number | null
  ultimoSaldoFinal?: number
  ultimoPeriodoFim?: string
  onClose: () => void
  onSaved: (newId?: number) => void
}

export default function CaixaForm({ caixa, empresas, unidades, minCaixaNum, ultimoSaldoFinal, ultimoPeriodoFim, onClose, onSaved }: Props) {
  const isFirstCaixa = (!caixa && minCaixaNum === null) || (caixa !== null && caixa.numero_caixa === minCaixaNum)
  const [form, setForm] = useState({
    numero_caixa: caixa?.numero_caixa ?? 1,
    empresa_id: caixa?.empresa_id ?? '',
    unidade_id: caixa?.unidade_id ?? '',
    data_envio: caixa?.data_envio ?? today(),
    periodo_inicio: caixa?.periodo_inicio ?? (ultimoPeriodoFim ? addDays(ultimoPeriodoFim, 1) : ''),
    periodo_fim: caixa?.periodo_fim ?? '',
    executado_por: caixa?.executado_por ?? '',
    responsavel: caixa?.responsavel ?? '',
    saldo_anterior: caixa?.saldo_anterior ?? ultimoSaldoFinal ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [filteredUnidades, setFilteredUnidades] = useState<Unidade[]>(unidades)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])

  useEffect(() => {
    if (form.empresa_id) {
      setFilteredUnidades(unidades.filter(u => u.empresa_id === Number(form.empresa_id)))
    } else {
      setFilteredUnidades(unidades)
    }
  }, [form.empresa_id, unidades])

  useEffect(() => {
    api.funcionarios.list().then(fs => setFuncionarios(fs as Funcionario[]))
  }, [])

  function set(key: string, value: unknown) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const data = {
        ...(isFirstCaixa ? { numero_caixa: Number(form.numero_caixa) || 1 } : {}),
        empresa_id: form.empresa_id || null,
        unidade_id: form.unidade_id || null,
        data_envio: form.data_envio || null,
        periodo_inicio: form.periodo_inicio || null,
        periodo_fim: form.periodo_fim || null,
        executado_por: form.executado_por || null,
        responsavel: form.responsavel || null,
        saldo_anterior: Number(form.saldo_anterior ?? 0),
      }
      if (caixa) {
        await api.caixa.update(caixa.id, data)
        onSaved()
      } else {
        const result = await api.caixa.create(data) as { lastInsertRowid: number }
        onSaved(Number(result.lastInsertRowid))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={caixa ? `Editar Caixa #${caixa.numero_caixa}` : 'Novo Acerto de Caixa'}
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      {isFirstCaixa && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/40 rounded-lg flex items-center gap-3">
          <div className="form-group mb-0 flex items-center gap-2">
            <label className="text-blue-300 whitespace-nowrap mb-0">Nº Caixa inicial:</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-24"
              value={form.numero_caixa}
              onFocus={e => e.target.select()}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '')
                set('numero_caixa', v === '' ? '' : parseInt(v, 10))
              }}
            />
          </div>
          <span className="text-xs text-blue-400">Editável apenas no primeiro caixa</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label>Empresa</label>
          <select value={form.empresa_id} onChange={e => set('empresa_id', e.target.value)}>
            <option value="">Selecione...</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Unidade</label>
          <select value={form.unidade_id} onChange={e => set('unidade_id', e.target.value)}>
            <option value="">Selecione...</option>
            {filteredUnidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Data de Envio</label>
          <input type="date" value={form.data_envio} onChange={e => set('data_envio', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Saldo Anterior (R$)</label>
          <input type="text" inputMode="decimal" value={form.saldo_anterior} onChange={e => set('saldo_anterior', e.target.value)} onFocus={e => e.target.select()} />
        </div>
        <div className="form-group">
          <label>Período Início</label>
          <input type="date" value={form.periodo_inicio} onChange={e => set('periodo_inicio', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Período Fim</label>
          <input type="date" value={form.periodo_fim} onChange={e => set('periodo_fim', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Executado Por</label>
          <select value={form.executado_por} onChange={e => set('executado_por', e.target.value)}>
            <option value="">Selecione...</option>
            {funcionarios.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Responsável</label>
          <select value={form.responsavel} onChange={e => set('responsavel', e.target.value)}>
            <option value="">Selecione...</option>
            {funcionarios.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  )
}
