import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit, Trash2, Save, X } from 'lucide-react'
import { api } from '../../lib/api'
import type { Unidade, Empresa } from '../../types'
import ConfirmDialog from '../../components/ConfirmDialog'

export default function UnidadesConfig() {
  const [items, setItems] = useState<Unidade[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ nome: '', empresa_id: '' })
  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState({ nome: '', empresa_id: '' })
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const [u, e] = await Promise.all([api.unidades.list(), api.empresas.list()])
    setItems(u as Unidade[]); setEmpresas(e as Empresa[])
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!newForm.nome.trim()) return
    await api.unidades.create({ nome: newForm.nome, empresa_id: newForm.empresa_id ? Number(newForm.empresa_id) : undefined })
    setAdding(false); setNewForm({ nome: '', empresa_id: '' }); load()
  }

  async function handleUpdate() {
    if (!editingId) return
    await api.unidades.update(editingId, { nome: editForm.nome, empresa_id: editForm.empresa_id ? Number(editForm.empresa_id) : undefined })
    setEditingId(null); load()
  }

  async function handleDelete() {
    if (!deletingId) return
    await api.unidades.delete(deletingId)
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
    (i.empresa_nome ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-100">Unidades</h2>
        <button className="btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={14} /> Nova Unidade</button>
      </div>
      <div className="mb-3">
        <input className="w-full max-w-sm" placeholder="Buscar por nome ou empresa..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr><th>Nome</th><th>Empresa</th><th className="w-20">Ações</th></tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="bg-blue-900/20">
                <td><input autoFocus className="w-full" value={newForm.nome} onChange={e => setNewForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome da unidade" /></td>
                <td><EmpresaSelect value={newForm.empresa_id} onChange={v => setNewForm(f => ({ ...f, empresa_id: v }))} /></td>
                <td><div className="flex gap-1"><button className="btn-primary btn-sm p-1.5" onClick={handleAdd}><Save size={13} /></button><button className="btn-ghost btn-sm p-1.5" onClick={() => setAdding(false)}><X size={13} /></button></div></td>
              </tr>
            )}
            {filtered.map(item => (
              editingId === item.id ? (
                <tr key={item.id} className="bg-blue-900/20">
                  <td><input autoFocus className="w-full" value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} /></td>
                  <td><EmpresaSelect value={editForm.empresa_id} onChange={v => setEditForm(f => ({ ...f, empresa_id: v }))} /></td>
                  <td><div className="flex gap-1"><button className="btn-primary btn-sm p-1.5" onClick={handleUpdate}><Save size={13} /></button><button className="btn-ghost btn-sm p-1.5" onClick={() => setEditingId(null)}><X size={13} /></button></div></td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td className="font-medium">{item.nome}</td>
                  <td className="text-slate-400">{item.empresa_nome ?? '-'}</td>
                  <td><div className="flex gap-1"><button className="btn-ghost btn-sm p-1.5" onClick={() => { setEditingId(item.id); setEditForm({ nome: item.nome, empresa_id: String(item.empresa_id ?? '') }) }}><Edit size={13} /></button><button className="btn-ghost btn-sm p-1.5 text-red-400" onClick={() => setDeletingId(item.id)}><Trash2 size={13} /></button></div></td>
                </tr>
              )
            ))}
            {filtered.length === 0 && !adding && <tr><td colSpan={3} className="text-center text-slate-500 py-8">{search ? 'Nenhum resultado encontrado' : 'Nenhuma unidade cadastrada'}</td></tr>}
          </tbody>
        </table>
      </div>
      {deletingId !== null && <ConfirmDialog title="Excluir Unidade" message="Deseja excluir esta unidade?" confirmLabel="Excluir" danger onConfirm={handleDelete} onCancel={() => setDeletingId(null)} />}
    </div>
  )
}
