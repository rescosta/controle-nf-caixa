import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit, Trash2, Save, X } from 'lucide-react'
import { api } from '../../lib/api'
import type { CentroCusto } from '../../types'
import ConfirmDialog from '../../components/ConfirmDialog'

export default function CentrosCustoConfig() {
  const [items, setItems] = useState<CentroCusto[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ codigo: '', descricao: '' })
  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState({ codigo: '', descricao: '' })
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setItems(await api.centrosCusto.list() as CentroCusto[])
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!newForm.codigo.trim()) return
    await api.centrosCusto.create(newForm)
    setAdding(false); setNewForm({ codigo: '', descricao: '' }); load()
  }

  async function handleUpdate() {
    if (!editingId) return
    await api.centrosCusto.update(editingId, editForm)
    setEditingId(null); load()
  }

  async function handleDelete() {
    if (!deletingId) return
    await api.centrosCusto.delete(deletingId)
    setDeletingId(null); load()
  }

  const filtered = items.filter(i =>
    i.codigo.toLowerCase().includes(search.toLowerCase()) ||
    i.descricao.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-100">Centros de Custo</h2>
        <button className="btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={14} /> Novo CC</button>
      </div>
      <div className="mb-3">
        <input className="w-full max-w-sm" placeholder="Buscar por código ou descrição..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr><th>Código</th><th>Descrição</th><th className="w-20">Ações</th></tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="bg-blue-900/20">
                <td><input autoFocus className="w-full" value={newForm.codigo} onChange={e => setNewForm(f => ({ ...f, codigo: e.target.value }))} placeholder="001" /></td>
                <td><input className="w-full" value={newForm.descricao} onChange={e => setNewForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição do centro de custo" /></td>
                <td><div className="flex gap-1"><button className="btn-primary btn-sm p-1.5" onClick={handleAdd}><Save size={13} /></button><button className="btn-ghost btn-sm p-1.5" onClick={() => setAdding(false)}><X size={13} /></button></div></td>
              </tr>
            )}
            {filtered.map(item => (
              editingId === item.id ? (
                <tr key={item.id} className="bg-blue-900/20">
                  <td><input autoFocus className="w-full" value={editForm.codigo} onChange={e => setEditForm(f => ({ ...f, codigo: e.target.value }))} /></td>
                  <td><input className="w-full" value={editForm.descricao} onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} /></td>
                  <td><div className="flex gap-1"><button className="btn-primary btn-sm p-1.5" onClick={handleUpdate}><Save size={13} /></button><button className="btn-ghost btn-sm p-1.5" onClick={() => setEditingId(null)}><X size={13} /></button></div></td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td className="font-mono font-medium">{item.codigo}</td>
                  <td>{item.descricao}</td>
                  <td><div className="flex gap-1"><button className="btn-ghost btn-sm p-1.5" onClick={() => { setEditingId(item.id); setEditForm({ codigo: item.codigo, descricao: item.descricao }) }}><Edit size={13} /></button><button className="btn-ghost btn-sm p-1.5 text-red-400" onClick={() => setDeletingId(item.id)}><Trash2 size={13} /></button></div></td>
                </tr>
              )
            ))}
            {filtered.length === 0 && !adding && <tr><td colSpan={3} className="text-center text-slate-500 py-8">{search ? 'Nenhum resultado encontrado' : 'Nenhum centro de custo cadastrado'}</td></tr>}
          </tbody>
        </table>
      </div>
      {deletingId !== null && <ConfirmDialog title="Excluir Centro de Custo" message="Deseja excluir este centro de custo?" confirmLabel="Excluir" danger onConfirm={handleDelete} onCancel={() => setDeletingId(null)} />}
    </div>
  )
}
