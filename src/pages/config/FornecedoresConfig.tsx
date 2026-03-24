import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import type { Fornecedor } from '../../types'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

type DocTipo = 'cnpj' | 'cpf'

function maskDoc(raw: string, tipo: DocTipo): string {
  const d = raw.replace(/\D/g, '')
  if (tipo === 'cpf') {
    const n = d.slice(0, 11)
    if (n.length <= 3) return n
    if (n.length <= 6) return `${n.slice(0,3)}.${n.slice(3)}`
    if (n.length <= 9) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`
    return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`
  }
  // CNPJ: XX.XXX.XXX/XXXX-XX
  const n = d.slice(0, 14)
  if (n.length <= 2) return n
  if (n.length <= 5) return `${n.slice(0,2)}.${n.slice(2)}`
  if (n.length <= 8) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5)}`
  if (n.length <= 12) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8)}`
  return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`
}

function detectTipo(val: string): DocTipo {
  return val.replace(/\D/g, '').length <= 11 ? 'cpf' : 'cnpj'
}

const EMPTY = { nome: '', cnpj: '', banco: '', agencia: '', conta: '', pix: '', telefone_fixo: '', celular: '', email: '', contato: '' }

export default function FornecedoresConfig() {
  const [items, setItems] = useState<Fornecedor[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Fornecedor | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [docTipo, setDocTipo] = useState<DocTipo>('cnpj')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setItems(await api.fornecedores.list() as Fornecedor[])
  }, [])

  useEffect(() => { load() }, [load])

  function openForm(f?: Fornecedor) {
    setEditing(f ?? null)
    const cnpj = f?.cnpj ?? ''
    setDocTipo(cnpj ? detectTipo(cnpj) : 'cnpj')
    setForm(f ? { nome: f.nome, cnpj, banco: f.banco ?? '', agencia: f.agencia ?? '', conta: f.conta ?? '', pix: f.pix ?? '', telefone_fixo: f.telefone_fixo ?? '', celular: f.celular ?? '', email: f.email ?? '', contato: f.contato ?? '' } : { ...EMPTY })
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing) await api.fornecedores.update(editing.id, form)
      else await api.fornecedores.create(form)
      setShowForm(false); load()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deletingId) return
    await api.fornecedores.delete(deletingId)
    setDeletingId(null); load()
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function handleDocChange(raw: string) {
    set('cnpj', maskDoc(raw, docTipo))
  }

  function handleTipoChange(tipo: DocTipo) {
    setDocTipo(tipo)
    set('cnpj', maskDoc(form.cnpj, tipo))
  }

  const filtered = items.filter(i =>
    i.nome.toLowerCase().includes(search.toLowerCase()) ||
    (i.cnpj ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-100">Fornecedores</h2>
        <button className="btn-primary btn-sm" onClick={() => openForm()}><Plus size={14} /> Novo Fornecedor</button>
      </div>
      <div className="mb-3">
        <input className="w-full max-w-sm" placeholder="Buscar por nome ou documento..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr><th>Nome</th><th>Documento</th><th>Banco</th><th>Agência</th><th>Conta</th><th>PIX</th><th className="w-20">Ações</th></tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id}>
                <td className="font-medium">{item.nome}</td>
                <td className="font-mono text-slate-400">{item.cnpj ?? '-'}</td>
                <td className="text-slate-400">{item.banco ?? '-'}</td>
                <td className="font-mono text-slate-400">{item.agencia ?? '-'}</td>
                <td className="font-mono text-slate-400">{item.conta ?? '-'}</td>
                <td className="text-slate-400 max-w-32 truncate">{item.pix ?? '-'}</td>
                <td><div className="flex gap-1">
                  <button className="btn-ghost btn-sm p-1.5" onClick={() => openForm(item)}><Edit size={13} /></button>
                  <button className="btn-ghost btn-sm p-1.5 text-red-400" onClick={() => setDeletingId(item.id)}><Trash2 size={13} /></button>
                </div></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500 py-8">{search ? 'Nenhum resultado encontrado' : 'Nenhum fornecedor cadastrado'}</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editing ? 'Editar Fornecedor' : 'Novo Fornecedor'} onClose={() => setShowForm(false)} maxWidth="max-w-2xl"
          footer={<><button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></>}>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group col-span-2">
              <label>Nome *</label>
              <input autoFocus value={form.nome} onChange={e => set('nome', e.target.value)} />
            </div>

            {/* Documento com toggle CNPJ/CPF */}
            <div className="form-group">
              <div className="flex items-center justify-between mb-1">
                <label className="mb-0">{docTipo === 'cnpj' ? 'CNPJ' : 'CPF'}</label>
                <div className="flex rounded-md overflow-hidden border border-slate-600 text-xs">
                  <button
                    type="button"
                    onClick={() => handleTipoChange('cnpj')}
                    className={`px-2 py-0.5 transition-colors ${docTipo === 'cnpj' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                  >CNPJ</button>
                  <button
                    type="button"
                    onClick={() => handleTipoChange('cpf')}
                    className={`px-2 py-0.5 transition-colors ${docTipo === 'cpf' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                  >CPF</button>
                </div>
              </div>
              <input
                value={form.cnpj}
                onChange={e => handleDocChange(e.target.value)}
                placeholder={docTipo === 'cnpj' ? '00.000.000/0001-00' : '000.000.000-00'}
                maxLength={docTipo === 'cnpj' ? 18 : 14}
              />
            </div>

            <div className="form-group">
              <label>PIX</label>
              <input value={form.pix} onChange={e => set('pix', e.target.value)} placeholder="Chave PIX" />
            </div>
            <div className="form-group">
              <label>Banco</label>
              <input value={form.banco} onChange={e => set('banco', e.target.value)} placeholder="Ex: 001 - BB" />
            </div>
            <div className="form-group">
              <label>Agência</label>
              <input value={form.agencia} onChange={e => set('agencia', e.target.value)} placeholder="0000" />
            </div>
            <div className="form-group col-span-2">
              <label>Conta</label>
              <input value={form.conta} onChange={e => set('conta', e.target.value)} placeholder="00000-0" />
            </div>
            <div className="form-group">
              <label>Telefone Fixo</label>
              <input value={form.telefone_fixo} onChange={e => set('telefone_fixo', e.target.value)} placeholder="(00) 0000-0000" />
            </div>
            <div className="form-group">
              <label>Celular</label>
              <input value={form.celular} onChange={e => set('celular', e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="form-group col-span-2">
              <label>E-mail</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contato@empresa.com" />
            </div>
            <div className="form-group col-span-2">
              <label>Contato (pessoa responsável)</label>
              <input value={form.contato} onChange={e => set('contato', e.target.value)} placeholder="Nome do responsável" />
            </div>
          </div>
        </Modal>
      )}
      {deletingId !== null && <ConfirmDialog title="Excluir Fornecedor" message="Deseja excluir este fornecedor?" confirmLabel="Excluir" danger onConfirm={handleDelete} onCancel={() => setDeletingId(null)} />}
    </div>
  )
}
