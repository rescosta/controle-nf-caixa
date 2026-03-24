import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit, Trash2, Save, X } from 'lucide-react'
import { api } from '../../lib/api'
import type { Empresa } from '../../types'
import ConfirmDialog from '../../components/ConfirmDialog'

export default function EmpresasConfig() {
  const [items, setItems] = useState<Empresa[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ nome: '', cnpj: '' })
  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState({ nome: '', cnpj: '' })
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setItems(await api.empresas.list() as Empresa[])
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!newForm.nome.trim()) return
    await api.empresas.create(newForm)
    setAdding(false); setNewForm({ nome: '', cnpj: '' }); load()
  }

  async function handleUpdate() {
    if (!editingId) return
    await api.empresas.update(editingId, editForm)
    setEditingId(null); load()
  }

  async function handleDelete() {
    if (!deletingId) return
    await api.empresas.delete(deletingId)
    setDeletingId(null); load()
  }

  const filtered = items.filter(i =>
    i.nome.toLowerCase().includes(search.toLowerCase()) ||
    (i.cnpj ?? '').includes(search)
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-100">Empresas</h2>
        <button className="btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={14} /> Nova Empresa</button>
      </div>

      <div className="mb-3">
        <input className="w-full max-w-sm" placeholder="Buscar por nome ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>CNPJ</th>
              <th className="w-20">Ações</th>
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="bg-blue-900/20">
                <td><input autoFocus className="w-full" value={newForm.nome} onChange={e => setNewForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome da empresa" /></td>
                <td><input className="w-full" value={newForm.cnpj} onChange={e => setNewForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" /></td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn-primary btn-sm p-1.5" onClick={handleAdd}><Save size={13} /></button>
                    <button className="btn-ghost btn-sm p-1.5" onClick={() => setAdding(false)}><X size={13} /></button>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map(item => (
              editingId === item.id ? (
                <tr key={item.id} className="bg-blue-900/20">
                  <td><input autoFocus className="w-full" value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} /></td>
                  <td><input className="w-full" value={editForm.cnpj} onChange={e => setEditForm(f => ({ ...f, cnpj: e.target.value }))} /></td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn-primary btn-sm p-1.5" onClick={handleUpdate}><Save size={13} /></button>
                      <button className="btn-ghost btn-sm p-1.5" onClick={() => setEditingId(null)}><X size={13} /></button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td className="font-medium">{item.nome}</td>
                  <td className="text-slate-400 font-mono">{item.cnpj ?? '-'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn-ghost btn-sm p-1.5" onClick={() => { setEditingId(item.id); setEditForm({ nome: item.nome, cnpj: item.cnpj ?? '' }) }}><Edit size={13} /></button>
                      <button className="btn-ghost btn-sm p-1.5 text-red-400" onClick={() => setDeletingId(item.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              )
            ))}
            {filtered.length === 0 && !adding && (
              <tr><td colSpan={3} className="text-center text-slate-500 py-8">{search ? 'Nenhum resultado encontrado' : 'Nenhuma empresa cadastrada'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {deletingId !== null && (
        <ConfirmDialog title="Excluir Empresa" message="Deseja excluir esta empresa?" confirmLabel="Excluir" danger onConfirm={handleDelete} onCancel={() => setDeletingId(null)} />
      )}
    </div>
  )
}
