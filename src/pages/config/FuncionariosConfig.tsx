import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit, Trash2, Save, X } from 'lucide-react'
import { api } from '../../lib/api'
import type { Funcionario, Empresa } from '../../types'
import ConfirmDialog from '../../components/ConfirmDialog'

export default function FuncionariosConfig() {
  const [items, setItems] = useState<Funcionario[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ nome: '', cargo: '', empresa_id: '' })
  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState({ nome: '', cargo: '', empresa_id: '' })
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const [f, e] = await Promise.all([api.funcionarios.list(), api.empresas.list()])
    setItems(f as Funcionario[]); setEmpresas(e as Empresa[])
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!newForm.nome.trim()) return
    await api.funcionarios.create({ nome: newForm.nome, cargo: newForm.cargo || undefined, empresa_id: newForm.empresa_id ? Number(newForm.empresa_id) : undefined })
    setAdding(false); setNewForm({ nome: '', cargo: '', empresa_id: '' }); load()
  }

  async function handleUpdate() {
    if (!editingId) return
    await api.funcionarios.update(editingId, { nome: editForm.nome, cargo: editForm.cargo || undefined, empresa_id: editForm.empresa_id ? Number(editForm.empresa_id) : undefined })
    setEditingId(null); load()
  }

  async function handleDelete() {
    if (!deletingId) return
    await api.funcionarios.delete(deletingId)
    setDeletingId(null); load()
  }

  const EmpresaSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select className="w-full" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Sem empresa</option>
      {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
    </select>
  )

  const filtered = items.filter(i =>
    i.nome.toLowerCase().includes(search.toLowerCase()) ||
    (i.cargo ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (i.empresa_nome ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-100">Funcionários</h2>
        <button className="btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={14} /> Novo Funcionário</button>
      </div>
      <div className="mb-3">
        <input className="w-full max-w-sm" placeholder="Buscar por nome, cargo ou empresa..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr><th>Nome</th><th>Cargo</th><th>Empresa</th><th className="w-20">Ações</th></tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="bg-blue-900/20">
                <td><input autoFocus className="w-full" value={newForm.nome} onChange={e => setNewForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" /></td>
                <td><input className="w-full" value={newForm.cargo} onChange={e => setNewForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Cargo" /></td>
                <td><EmpresaSelect value={newForm.empresa_id} onChange={v => setNewForm(f => ({ ...f, empresa_id: v }))} /></td>
                <td><div className="flex gap-1"><button className="btn-primary btn-sm p-1.5" onClick={handleAdd}><Save size={13} /></button><button className="btn-ghost btn-sm p-1.5" onClick={() => setAdding(false)}><X size={13} /></button></div></td>
              </tr>
            )}
            {filtered.map(item => (
              editingId === item.id ? (
                <tr key={item.id} className="bg-blue-900/20">
                  <td><input autoFocus className="w-full" value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} /></td>
                  <td><input className="w-full" value={editForm.cargo} onChange={e => setEditForm(f => ({ ...f, cargo: e.target.value }))} /></td>
                  <td><EmpresaSelect value={editForm.empresa_id} onChange={v => setEditForm(f => ({ ...f, empresa_id: v }))} /></td>
                  <td><div className="flex gap-1"><button className="btn-primary btn-sm p-1.5" onClick={handleUpdate}><Save size={13} /></button><button className="btn-ghost btn-sm p-1.5" onClick={() => setEditingId(null)}><X size={13} /></button></div></td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td className="font-medium">{item.nome}</td>
                  <td className="text-slate-400">{item.cargo ?? '-'}</td>
                  <td className="text-slate-400">{item.empresa_nome ?? '-'}</td>
                  <td><div className="flex gap-1"><button className="btn-ghost btn-sm p-1.5" onClick={() => { setEditingId(item.id); setEditForm({ nome: item.nome, cargo: item.cargo ?? '', empresa_id: String(item.empresa_id ?? '') }) }}><Edit size={13} /></button><button className="btn-ghost btn-sm p-1.5 text-red-400" onClick={() => setDeletingId(item.id)}><Trash2 size={13} /></button></div></td>
                </tr>
              )
            ))}
            {filtered.length === 0 && !adding && <tr><td colSpan={4} className="text-center text-slate-500 py-8">{search ? 'Nenhum resultado encontrado' : 'Nenhum funcionário cadastrado'}</td></tr>}
          </tbody>
        </table>
      </div>
      {deletingId !== null && <ConfirmDialog title="Excluir Funcionário" message="Deseja desativar este funcionário?" confirmLabel="Desativar" danger onConfirm={handleDelete} onCancel={() => setDeletingId(null)} />}
    </div>
  )
}
