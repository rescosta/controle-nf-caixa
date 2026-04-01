import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Modal from '../../components/Modal'
import CurrencyInput from '../../components/CurrencyInput'
import SearchableSelect from '../../components/SearchableSelect'
import { api } from '../../lib/api'
import { today, formatBRL } from '../../lib/format'
import type { NotaFiscal, Empresa, Unidade, CentroCusto, Fornecedor, NFParcela, NFProgramacao, NFAnexo } from '../../types'

interface Props {
  nf: NotaFiscal | null
  empresas: Empresa[]
  unidades: Unidade[]
  ccs: CentroCusto[]
  minNFSeq: number | null
  onClose: () => void
  onSaved: () => void
  onSavedAndNew?: () => void
}

function maskDoc(raw: string, tipo: 'cnpj' | 'cpf'): string {
  const d = raw.replace(/\D/g, '')
  if (tipo === 'cpf') {
    const n = d.slice(0, 11)
    if (n.length <= 3) return n
    if (n.length <= 6) return `${n.slice(0,3)}.${n.slice(3)}`
    if (n.length <= 9) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`
    return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`
  }
  const n = d.slice(0, 14)
  if (n.length <= 2) return n
  if (n.length <= 5) return `${n.slice(0,2)}.${n.slice(2)}`
  if (n.length <= 8) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5)}`
  if (n.length <= 12) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8)}`
  return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`
}

const EMPTY: Omit<NotaFiscal, 'id' | 'numero_seq'> = {
  empresa_id: undefined, unidade_id: undefined, centro_custo_id: undefined,
  nf_numero: '', nf_data: today(), fornecedor_id: undefined,
  descricao: '', valor_nota: 0, valor_boleto: 0,
  vencimento: today(), status: 'a_pagar', data_pagamento: undefined, data_lancamento: today(),
  forma_pagamento: 'boleto', pix_chave: '', banco_pagamento: '', agencia_pagamento: '', conta_pagamento: '',
}

export default function NFForm({ nf, empresas, unidades, ccs, minNFSeq, onClose, onSaved, onSavedAndNew }: Props) {
  const isFirstNF = (!nf && minNFSeq === null) || (nf !== null && nf.numero_seq === minNFSeq)
  const [form, setForm] = useState({
    ...EMPTY,
    ...(nf ?? {}),
    // 'pendente' é status de importação — ao editar pela primeira vez converte para 'a_pagar'
    status: nf?.status === 'pendente' ? 'a_pagar' : (nf?.status ?? EMPTY.status),
    numero_seq: nf?.numero_seq ?? 1,
  })
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [localCCs, setLocalCCs] = useState<CentroCusto[]>(ccs)
  const [parcelas, setParcelas] = useState<NFParcela[]>([])
  const [parcelado, setParcelado] = useState(false)
  const [filteredUnidades, setFilteredUnidades] = useState<Unidade[]>(unidades)
  const [saving, setSaving] = useState(false)

  // Mini-modais de cadastro rápido
  const [quickForn, setQuickForn] = useState(false)
  const [quickCC, setQuickCC] = useState(false)
  const [qfForm, setQfForm] = useState({ nome: '', cnpj: '', banco: '', agencia: '', conta: '', pix: '', telefone_fixo: '', celular: '', email: '', contato: '' })
  const [qfDocTipo, setQfDocTipo] = useState<'cnpj' | 'cpf'>('cnpj')
  const [qcForm, setQcForm] = useState({ codigo: '', descricao: '' })
  const [quickSaving, setQuickSaving] = useState(false)
  const [showProgramacao, setShowProgramacao] = useState(false)
  const [programacao, setProgramacao] = useState<NFProgramacao[]>([])
  const [anexos, setAnexos] = useState<NFAnexo[]>([])
  const [pendingAnexos, setPendingAnexos] = useState<string[]>([])
  const valorNotaMountRef = useRef(true)

  useEffect(() => {
    api.fornecedores.list().then(f => setFornecedores(f as Fornecedor[]))
    if (nf) {
      api.nf.getParcelas(nf.id).then(p => {
        const ps = p as NFParcela[]
        if (ps.length > 0) { setParcelas(ps); setParcelado(true) }
      })
      api.nf.getProgramacao(nf.id).then(p => setProgramacao(p as NFProgramacao[]))
      api.nf.getAnexos(nf.id).then(a => setAnexos(a as NFAnexo[]))
    }
  }, [nf])

  useEffect(() => {
    if (form.empresa_id) {
      setFilteredUnidades(unidades.filter(u => u.empresa_id === Number(form.empresa_id)))
    } else {
      setFilteredUnidades(unidades)
    }
  }, [form.empresa_id, unidades])

  useEffect(() => {
    if (!parcelado) return
    setParcelas(prev => {
      if (prev.length === 0) return prev
      const total = Number(form.valor_nota ?? 0)
      const valores = distribuirIgual(prev.length, total)
      return prev.map((par, idx) => ({ ...par, valor: valores[idx] }))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.valor_nota])

  useEffect(() => {
    if (valorNotaMountRef.current) { valorNotaMountRef.current = false; return }
    setForm(f => ({ ...f, valor_boleto: f.valor_nota }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.valor_nota])

  function set(key: string, value: unknown) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function distribuirIgual(n: number, total: number): number[] {
    if (n <= 0) return []
    const base = Math.floor((total * 100) / n) / 100
    const diff = parseFloat((total - parseFloat((base * n).toFixed(2))).toFixed(2))
    const result = Array(n).fill(base)
    result[n - 1] = parseFloat((base + diff).toFixed(2))
    return result
  }

  function addParcela() {
    setParcelas(prev => {
      const nova = [...prev, { numero_parcela: prev.length + 1, valor: 0, vencimento: today(), status: 'a_pagar' as const }]
      const valores = distribuirIgual(nova.length, Number(form.valor_nota ?? 0))
      return nova.map((par, idx) => ({ ...par, valor: valores[idx] }))
    })
  }

  function updateParcela(i: number, key: string, value: unknown) {
    if (key !== 'valor' || i !== 0) {
      setParcelas(p => p.map((par, idx) => idx === i ? { ...par, [key]: value } : par))
      return
    }
    // Edição do valor da primeira parcela: cascata nas demais
    setParcelas(prev => {
      const novoValor = Number(value)
      const total = Number(form.valor_nota ?? 0)
      const restante = parseFloat((total - novoValor).toFixed(2))
      if (restante < 0 || prev.length <= 1) {
        return prev.map((par, idx) => idx === 0 ? { ...par, valor: novoValor } : par)
      }
      const valoresRestantes = distribuirIgual(prev.length - 1, restante)
      return prev.map((par, idx) => {
        if (idx === 0) return { ...par, valor: novoValor }
        return { ...par, valor: valoresRestantes[idx - 1] }
      })
    })
  }

  function removeParcela(i: number) {
    setParcelas(prev => {
      const filtrada = prev.filter((_, idx) => idx !== i).map((par, idx) => ({ ...par, numero_parcela: idx + 1 }))
      if (filtrada.length === 0) return filtrada
      const valores = distribuirIgual(filtrada.length, Number(form.valor_nota ?? 0))
      return filtrada.map((par, idx) => ({ ...par, valor: valores[idx] }))
    })
  }

  function addProgRow() {
    setProgramacao(prev => [...prev, { valor: 0, vencimento: today() }])
  }

  function removeProgRow(i: number) {
    setProgramacao(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateProgRow(i: number, key: string, value: unknown) {
    setProgramacao(p => p.map((r, idx) => idx === i ? { ...r, [key]: value } : r))
  }

  async function handleSaveQuickForn() {
    if (!qfForm.nome.trim()) return
    setQuickSaving(true)
    try {
      const r = await api.fornecedores.create(qfForm) as { lastInsertRowid: number }
      const updated = await api.fornecedores.list() as Fornecedor[]
      setFornecedores(updated)
      set('fornecedor_id', r.lastInsertRowid)
      setQuickForn(false)
      setQfForm({ nome: '', cnpj: '', banco: '', agencia: '', conta: '', pix: '', telefone_fixo: '', celular: '', email: '', contato: '' })
      setQfDocTipo('cnpj')
    } finally { setQuickSaving(false) }
  }

  async function handleSaveQuickCC() {
    if (!qcForm.codigo.trim()) return
    setQuickSaving(true)
    try {
      const r = await api.centrosCusto.create(qcForm) as { lastInsertRowid: number }
      const updated = await api.centrosCusto.list() as CentroCusto[]
      setLocalCCs(updated)
      set('centro_custo_id', r.lastInsertRowid)
      setQuickCC(false)
      setQcForm({ codigo: '', descricao: '' })
    } finally { setQuickSaving(false) }
  }

  async function handleSave(mode: 'save' | 'save_and_new' = 'save') {
    setSaving(true)
    try {
      let nfId: number
      const data = {
        ...(isFirstNF ? { numero_seq: Number(form.numero_seq) || 1 } : {}),
        empresa_id: form.empresa_id || null,
        unidade_id: form.unidade_id || null,
        centro_custo_id: form.centro_custo_id || null,
        nf_numero: form.nf_numero || null,
        nf_data: form.nf_data || null,
        fornecedor_id: form.fornecedor_id || null,
        descricao: form.descricao || null,
        valor_nota: Number(form.valor_nota ?? 0),
        valor_boleto: Number(form.valor_boleto ?? 0),
        vencimento: form.vencimento || null,
        status: form.status,
        data_pagamento: form.data_pagamento || null,
        data_lancamento: form.data_lancamento ?? today(),
        forma_pagamento: form.forma_pagamento ?? 'boleto',
        pix_chave: form.pix_chave || null,
        banco_pagamento: form.banco_pagamento || null,
        agencia_pagamento: form.agencia_pagamento || null,
        conta_pagamento: form.conta_pagamento || null,
      }
      if (nf) {
        await api.nf.update(nf.id, data)
        nfId = nf.id
      } else {
        const r = await api.nf.create(data) as { lastInsertRowid: number }
        nfId = r.lastInsertRowid
      }
      if (parcelado && parcelas.length > 0) {
        await api.nf.saveParcelas(nfId, parcelas)
      } else if (!parcelado) {
        await api.nf.saveParcelas(nfId, [])
      }
      await api.nf.saveProgramacao(nfId, programacao)
      if (pendingAnexos.length > 0) {
        await api.nf.saveAnexos(nfId, pendingAnexos)
        setPendingAnexos([])
        const ax = await api.nf.getAnexos(nfId)
        setAnexos(ax as NFAnexo[])
      }
      if (mode === 'save_and_new') {
        setForm({
          ...EMPTY,
          empresa_id: form.empresa_id,
          unidade_id: form.unidade_id,
          centro_custo_id: form.centro_custo_id,
          numero_seq: 1,
        })
        setParcelas([])
        setParcelado(false)
        setProgramacao([])
        setAnexos([])
        setPendingAnexos([])
        valorNotaMountRef.current = true
        onSavedAndNew?.()
      } else {
        onSaved()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handlePickAnexos() {
    const caminhos = await api.nf.pickAnexos() as string[]
    if (!caminhos.length) return
    if (nf) {
      await api.nf.saveAnexos(nf.id, caminhos)
      const ax = await api.nf.getAnexos(nf.id)
      setAnexos(ax as NFAnexo[])
    } else {
      setPendingAnexos(prev => [...prev, ...caminhos])
    }
  }

  async function handleDeleteAnexo(id: number) {
    await api.nf.deleteAnexo(id)
    setAnexos(prev => prev.filter(a => a.id !== id))
  }

  const somaValores = parcelas.reduce((acc, p) => acc + Number(p.valor), 0)
  const hasDivergencia = parcelado && parcelas.length > 0 && Math.abs(somaValores - Number(form.valor_nota ?? 0)) > 0.005

  const empresaOpts = empresas.map(e => ({ id: e.id, label: e.nome }))
  const unidadeOpts = filteredUnidades.map(u => ({ id: u.id, label: u.nome }))
  const ccOpts = localCCs.map(cc => ({ id: cc.id, label: `${cc.codigo} — ${cc.descricao}` }))
  const fornOpts = fornecedores.map(f => ({ id: f.id, label: f.nome }))

  return (
    <>
      <Modal
        title={nf ? `Editar NF #${nf.numero_seq}` : 'Nova Nota Fiscal'}
        onClose={onClose}
        maxWidth="max-w-3xl"
        footer={
          <>
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            {!nf && (
              <button className="btn-secondary" onClick={() => handleSave('save_and_new')} disabled={saving}>
                <Plus size={14} /> {saving ? 'Salvando...' : 'Salvar e Nova'}
              </button>
            )}
            <button className="btn-primary" onClick={() => handleSave('save')} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        {isFirstNF && (
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/40 rounded-lg flex items-center gap-3">
            <div className="form-group mb-0 flex items-center gap-2">
              <label className="text-blue-300 whitespace-nowrap mb-0">Nº Sequencial inicial:</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-24"
                value={form.numero_seq}
                onFocus={e => e.target.select()}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '')
                  set('numero_seq', v === '' ? '' : parseInt(v, 10))
                }}
              />
            </div>
            <span className="text-xs text-blue-400">Editável apenas no primeiro lançamento</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label>Empresa</label>
            <SearchableSelect
              value={form.empresa_id}
              onChange={v => set('empresa_id', v)}
              options={empresaOpts}
              placeholder="Selecione a empresa..."
            />
          </div>
          <div className="form-group">
            <label>Unidade ADM</label>
            <SearchableSelect
              value={form.unidade_id}
              onChange={v => set('unidade_id', v)}
              options={unidadeOpts}
              placeholder="Selecione a unidade..."
            />
          </div>
          <div className="form-group">
            <label>Centro de Custo</label>
            <SearchableSelect
              value={form.centro_custo_id}
              onChange={v => set('centro_custo_id', v)}
              options={ccOpts}
              placeholder="Selecione o CC..."
              onAdd={() => setQuickCC(true)}
            />
          </div>
          <div className="form-group">
            <label>Fornecedor</label>
            <SearchableSelect
              value={form.fornecedor_id}
              onChange={v => {
                set('fornecedor_id', v)
                // limpar dados de pagamento ao trocar fornecedor
                set('pix_chave', '')
                set('banco_pagamento', '')
                set('agencia_pagamento', '')
                set('conta_pagamento', '')
              }}
              options={fornOpts}
              placeholder="Selecione o fornecedor..."
              onAdd={() => setQuickForn(true)}
            />
          </div>
          <div className="form-group">
            <label>Nº NF Fornecedor</label>
            <input value={form.nf_numero ?? ''} onChange={e => set('nf_numero', e.target.value)} placeholder="0000" />
          </div>
          <div className="form-group">
            <label>Data NF</label>
            <input type="date" value={form.nf_data ?? ''} onChange={e => set('nf_data', e.target.value)} />
          </div>
          <div className="form-group col-span-2">
            <label>Descrição</label>
            <textarea value={form.descricao ?? ''} onChange={e => set('descricao', e.target.value)} rows={2} placeholder="Descrição do serviço ou produto..." />
          </div>
          <div className="form-group">
            <label>Valor da Nota (R$)</label>
            <div className="flex gap-1 items-center">
              <CurrencyInput value={form.valor_nota ?? 0} onChange={v => set('valor_nota', v)} />
              <button
                type="button"
                className="btn-ghost btn-sm p-1.5 shrink-0"
                title="Programação de Pagamentos"
                onClick={() => setShowProgramacao(true)}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Valor à Pagar (R$)</label>
            <CurrencyInput value={form.valor_boleto ?? 0} onChange={v => set('valor_boleto', v)} />
            {programacao.length > 0 && (
              <div className="mt-1 flex items-center gap-2 text-xs text-blue-400">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                {programacao.length} pagamento{programacao.length > 1 ? 's' : ''} programado{programacao.length > 1 ? 's' : ''} — Total: {formatBRL(programacao.reduce((a, r) => a + Number(r.valor), 0))}
                <button type="button" className="text-blue-400 hover:text-blue-200 underline" onClick={() => setShowProgramacao(true)}>ver</button>
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Vencimento</label>
            <input type="date" value={form.vencimento ?? ''} onChange={e => set('vencimento', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Data Lançamento</label>
            <input type="date" value={form.data_lancamento ?? today()} onChange={e => set('data_lancamento', e.target.value)} />
          </div>
        </div>

        {/* Forma de Pagamento */}
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-3 font-semibold">Forma de Pagamento</div>
          <div className="flex gap-2 mb-4">
            {(['boleto', 'pix', 'transferencia'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  const forn = fornecedores.find(fo => fo.id === Number(form.fornecedor_id))
                  set('forma_pagamento', f)
                  if (f === 'pix' && forn?.pix) set('pix_chave', forn.pix)
                  if (f === 'transferencia' && forn) {
                    if (forn.banco) set('banco_pagamento', forn.banco)
                    if (forn.agencia) set('agencia_pagamento', forn.agencia)
                    if (forn.conta) set('conta_pagamento', forn.conta)
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  form.forma_pagamento === f
                    ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                    : 'border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                {f === 'boleto' ? 'Boleto' : f === 'pix' ? 'PIX' : 'Transferência'}
              </button>
            ))}
          </div>

          {form.forma_pagamento === 'pix' && (
            <div className="form-group">
              <label>Chave PIX</label>
              <input
                value={form.pix_chave ?? ''}
                onChange={e => set('pix_chave', e.target.value)}
                onFocus={e => e.target.select()}
                placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
              />
            </div>
          )}

          {form.forma_pagamento === 'transferencia' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="form-group">
                <label>Banco</label>
                <input
                  value={form.banco_pagamento ?? ''}
                  onChange={e => set('banco_pagamento', e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder="Ex: 001"
                />
              </div>
              <div className="form-group">
                <label>Agência</label>
                <input
                  value={form.agencia_pagamento ?? ''}
                  onChange={e => set('agencia_pagamento', e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder="0000-0"
                />
              </div>
              <div className="form-group">
                <label>Conta</label>
                <input
                  value={form.conta_pagamento ?? ''}
                  onChange={e => set('conta_pagamento', e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder="00000-0"
                />
              </div>
            </div>
          )}
        </div>

        {/* Parcelamento */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={parcelado} onChange={e => setParcelado(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm text-slate-300">Pagamento parcelado</span>
            </label>
            {hasDivergencia && (
              <span className="text-sm text-yellow-400 flex items-center gap-1">
                <span>⚠</span>
                <span>Soma ({formatBRL(somaValores)}) ≠ NF ({formatBRL(Number(form.valor_nota ?? 0))}) — faltam {formatBRL(Math.abs(Number(form.valor_nota ?? 0) - somaValores))}</span>
              </span>
            )}
          </div>

          {parcelado && (
            <div className="mt-3">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Parcela</th>
                      <th>Valor (R$)</th>
                      <th>Vencimento</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelas.map((p, i) => (
                      <tr key={i}>
                        <td className="text-slate-400">{p.numero_parcela}/{parcelas.length}</td>
                        <td>
                          <CurrencyInput className="w-28" value={p.valor} onChange={v => updateParcela(i, 'valor', v)} />
                        </td>
                        <td>
                          <input type="date" value={p.vencimento ?? ''} onChange={e => updateParcela(i, 'vencimento', e.target.value)} />
                        </td>
                        <td>
                          <select value={p.status} onChange={e => updateParcela(i, 'status', e.target.value)}>
                            <option value="a_pagar">A Pagar</option>
                            <option value="pago">Pago</option>
                          </select>
                        </td>
                        <td>
                          <button className="btn-ghost btn-sm p-1.5 text-red-400" onClick={() => removeParcela(i)}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn-ghost btn-sm mt-2" onClick={addParcela}>
                <Plus size={14} /> Adicionar Parcela
              </button>
            </div>
          )}
        </div>

        {/* Anexos */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Anexos (PDFs e Imagens)</div>
            <button className="btn-ghost btn-sm flex items-center gap-1" onClick={handlePickAnexos}>
              <Plus size={13} /> Adicionar arquivo
            </button>
          </div>
          {(anexos.length > 0 || pendingAnexos.length > 0) ? (
            <div className="table-container">
              <table>
                <tbody>
                  {anexos.map(a => (
                    <tr key={a.id}>
                      <td>
                        <button
                          type="button"
                          className="text-blue-400 hover:text-blue-200 hover:underline text-left truncate max-w-xs"
                          title="Clique para abrir"
                          onClick={() => api.shell.openFile(a.caminho)}
                        >
                          {a.nome}
                        </button>
                      </td>
                      <td className="text-slate-500 w-20">{a.tipo}</td>
                      <td className="w-8">
                        <button className="btn-ghost btn-sm p-1.5 text-red-400" onClick={() => handleDeleteAnexo(a.id)}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pendingAnexos.map((c, i) => (
                    <tr key={`p-${i}`}>
                      <td className="text-slate-400 italic">{c.split('/').pop()}</td>
                      <td className="text-slate-500 w-20 text-xs">pendente</td>
                      <td className="w-8">
                        <button className="btn-ghost btn-sm p-1.5 text-red-400" onClick={() => setPendingAnexos(prev => prev.filter((_, idx) => idx !== i))}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Nenhum anexo. Clique em "Adicionar arquivo" para incluir PDFs ou imagens.</p>
          )}
        </div>
      </Modal>

      {/* Mini-modal: cadastro rápido de Fornecedor */}
      {quickForn && (
        <Modal
          title="Novo Fornecedor"
          onClose={() => setQuickForn(false)}
          maxWidth="max-w-lg"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setQuickForn(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveQuickForn} disabled={quickSaving || !qfForm.nome.trim()}>
                {quickSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group col-span-2">
              <label>Nome *</label>
              <input autoFocus value={qfForm.nome} onChange={e => setQfForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do fornecedor" />
            </div>
            <div className="form-group">
              <div className="flex items-center justify-between mb-1">
                <label className="mb-0">{qfDocTipo === 'cnpj' ? 'CNPJ' : 'CPF'}</label>
                <div className="flex rounded-md overflow-hidden border border-slate-600 text-xs">
                  <button type="button" onClick={() => { setQfDocTipo('cnpj'); setQfForm(f => ({ ...f, cnpj: maskDoc(f.cnpj, 'cnpj') })) }}
                    className={`px-2 py-0.5 transition-colors ${qfDocTipo === 'cnpj' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>CNPJ</button>
                  <button type="button" onClick={() => { setQfDocTipo('cpf'); setQfForm(f => ({ ...f, cnpj: maskDoc(f.cnpj, 'cpf') })) }}
                    className={`px-2 py-0.5 transition-colors ${qfDocTipo === 'cpf' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>CPF</button>
                </div>
              </div>
              <input
                value={qfForm.cnpj}
                onChange={e => setQfForm(f => ({ ...f, cnpj: maskDoc(e.target.value, qfDocTipo) }))}
                placeholder={qfDocTipo === 'cnpj' ? '00.000.000/0001-00' : '000.000.000-00'}
                maxLength={qfDocTipo === 'cnpj' ? 18 : 14}
              />
            </div>
            <div className="form-group">
              <label>PIX</label>
              <input value={qfForm.pix} onChange={e => setQfForm(f => ({ ...f, pix: e.target.value }))} placeholder="Chave PIX" />
            </div>
            <div className="form-group">
              <label>Banco</label>
              <input value={qfForm.banco} onChange={e => setQfForm(f => ({ ...f, banco: e.target.value }))} placeholder="Ex: 001 - BB" />
            </div>
            <div className="form-group">
              <label>Agência</label>
              <input value={qfForm.agencia} onChange={e => setQfForm(f => ({ ...f, agencia: e.target.value }))} placeholder="0000" />
            </div>
            <div className="form-group col-span-2">
              <label>Conta</label>
              <input value={qfForm.conta} onChange={e => setQfForm(f => ({ ...f, conta: e.target.value }))} placeholder="00000-0" />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Programação de Pagamentos (controle financeiro futuro — separado do parcelamento) */}
      {showProgramacao && (
        <Modal
          title="Programação de Pagamentos"
          onClose={() => setShowProgramacao(false)}
          maxWidth="max-w-xl"
          footer={
            <button className="btn-primary" onClick={() => setShowProgramacao(false)}>Fechar</button>
          }
        >
          <div>
            <p className="text-xs text-slate-500 mb-3">Controle financeiro futuro — independente do valor da NF e do parcelamento.</p>
            {programacao.length > 0 && (
              <div className="table-container mb-3">
                <table>
                  <thead>
                    <tr>
                      <th>Valor (R$)</th>
                      <th>Vencimento</th>
                      <th>Observação</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {programacao.map((p, i) => (
                      <tr key={i}>
                        <td>
                          <CurrencyInput className="w-28" value={p.valor} onChange={v => updateProgRow(i, 'valor', v)} />
                        </td>
                        <td>
                          <input type="date" value={p.vencimento ?? ''} onChange={e => updateProgRow(i, 'vencimento', e.target.value)} />
                        </td>
                        <td>
                          <input className="w-full" value={p.observacao ?? ''} onChange={e => updateProgRow(i, 'observacao', e.target.value)} placeholder="Opcional" />
                        </td>
                        <td>
                          <button className="btn-ghost btn-sm p-1.5 text-red-400" onClick={() => removeProgRow(i)}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {programacao.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-4 mb-3">Nenhum pagamento programado. Clique em "+" para adicionar.</p>
            )}
            <div className="flex items-center justify-between">
              <button className="btn-ghost btn-sm" onClick={addProgRow}>
                <Plus size={14} /> Adicionar
              </button>
              {programacao.length > 0 && (
                <span className="text-sm text-slate-400">
                  Total programado: <span className="text-blue-300">{formatBRL(programacao.reduce((a, r) => a + Number(r.valor), 0))}</span>
                </span>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Mini-modal: cadastro rápido de Centro de Custo */}
      {quickCC && (
        <Modal
          title="Novo Centro de Custo"
          onClose={() => setQuickCC(false)}
          maxWidth="max-w-sm"
          footer={
            <>
              <button className="btn-secondary" onClick={() => setQuickCC(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveQuickCC} disabled={quickSaving || !qcForm.codigo.trim()}>
                {quickSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="form-group">
              <label>Código *</label>
              <input autoFocus value={qcForm.codigo} onChange={e => setQcForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ex: 1.01.035" />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <input value={qcForm.descricao} onChange={e => setQcForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição do CC" />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
