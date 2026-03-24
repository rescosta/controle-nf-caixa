import { useEffect, useState } from 'react'
import { Plus, Trash2, Mail } from 'lucide-react'
import { api } from '../../lib/api'

interface Destinatario { id: number; nome: string; email: string }

export default function SefazDestinatariosPage() {
  const [lista, setLista] = useState<Destinatario[]>([])
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')

  const carregar = () => api.sefaz.destinatarios.list().then(setLista)
  useEffect(() => { carregar() }, [])

  const salvar = async () => {
    if (!nome.trim() || !email.trim()) return
    await api.sefaz.destinatarios.create(nome.trim(), email.trim())
    setNome(''); setEmail(''); carregar()
  }

  const excluir = async (id: number) => {
    if (confirm('Remover destinatário?')) { await api.sefaz.destinatarios.delete(id); carregar() }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Mail size={22} className="text-blue-400" />
        <h2 className="text-lg font-semibold text-slate-200">Destinatários de E-mail</h2>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Novo Destinatário</h3>
        <div className="flex gap-3">
          <input className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            placeholder="Nome" value={nome} onChange={e => setNome(e.target.value)} />
          <input className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && salvar()} />
          <button onClick={salvar} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition">
            <Plus size={16} /> Adicionar
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">Os destinatários aqui cadastrados serão sugeridos ao enviar NF-es por e-mail.</p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">E-mail</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr><td colSpan={3} className="text-center py-10 text-slate-500">Nenhum destinatário cadastrado</td></tr>
            )}
            {lista.map(d => (
              <tr key={d.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                <td className="px-4 py-3 text-slate-200">{d.nome}</td>
                <td className="px-4 py-3 text-slate-400">{d.email}</td>
                <td className="px-4 py-3">
                  <button onClick={() => excluir(d.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition float-right"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
