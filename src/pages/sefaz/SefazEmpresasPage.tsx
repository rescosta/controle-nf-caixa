import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Upload, Building2 } from 'lucide-react'
import { api } from '../../lib/api'

const UFS = [
  { code: '12', label: 'AC' }, { code: '27', label: 'AL' }, { code: '16', label: 'AP' },
  { code: '13', label: 'AM' }, { code: '29', label: 'BA' }, { code: '23', label: 'CE' },
  { code: '53', label: 'DF' }, { code: '32', label: 'ES' }, { code: '52', label: 'GO' },
  { code: '21', label: 'MA' }, { code: '51', label: 'MT' }, { code: '50', label: 'MS' },
  { code: '31', label: 'MG' }, { code: '15', label: 'PA' }, { code: '25', label: 'PB' },
  { code: '41', label: 'PR' }, { code: '26', label: 'PE' }, { code: '22', label: 'PI' },
  { code: '33', label: 'RJ' }, { code: '24', label: 'RN' }, { code: '43', label: 'RS' },
  { code: '11', label: 'RO' }, { code: '14', label: 'RR' }, { code: '42', label: 'SC' },
  { code: '35', label: 'SP' }, { code: '28', label: 'SE' }, { code: '17', label: 'TO' },
]

interface Empresa {
  id: number; nome: string; cnpj: string; uf: string; pfx_b64?: string
  pfx_senha?: string; ambiente: 'producao' | 'homologacao'; ultimo_nsu: string
}

const vazio = { nome: '', cnpj: '', uf: '35', pfx_b64: '', pfx_senha: '', ambiente: 'producao' as const }

export default function SefazEmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [form, setForm] = useState(vazio)
  const [editId, setEditId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [pfxNome, setPfxNome] = useState('')

  const carregar = () => api.sefaz.empresas.list().then(setEmpresas)
  useEffect(() => { carregar() }, [])

  const selecionarPfx = async () => {
    const b64 = await api.sefaz.empresas.pickPfx()
    if (b64) { setForm(f => ({ ...f, pfx_b64: b64 })); setPfxNome('certificado.pfx') }
  }

  const salvar = async () => {
    if (!form.nome || !form.cnpj) return
    if (editId) {
      await api.sefaz.empresas.update(editId, form)
    } else {
      await api.sefaz.empresas.create(form)
    }
    setShowForm(false); setEditId(null); setForm(vazio); setPfxNome(''); carregar()
  }

  const editar = (e: Empresa) => {
    setForm({ nome: e.nome, cnpj: e.cnpj, uf: e.uf, pfx_b64: e.pfx_b64 || '', pfx_senha: e.pfx_senha || '', ambiente: e.ambiente })
    setPfxNome(e.pfx_b64 ? 'certificado cadastrado' : '')
    setEditId(e.id); setShowForm(true)
  }

  const excluir = async (id: number) => {
    if (confirm('Remover empresa?')) { await api.sefaz.empresas.delete(id); carregar() }
  }

  const cancelar = () => { setShowForm(false); setEditId(null); setForm(vazio); setPfxNome('') }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 size={22} className="text-blue-400" />
          <h2 className="text-lg font-semibold text-slate-200">Empresas — Monitor SEFAZ</h2>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition">
            <Plus size={16} /> Nova Empresa
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">{editId ? 'Editar Empresa' : 'Nova Empresa'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Nome</label>
              <input className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Razão Social" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">CNPJ</label>
              <input className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">UF</label>
              <select className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value }))}>
                {UFS.map(u => <option key={u.code} value={u.code}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ambiente</label>
              <select className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                value={form.ambiente} onChange={e => setForm(f => ({ ...f, ambiente: e.target.value as any }))}>
                <option value="producao">Produção</option>
                <option value="homologacao">Homologação</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Certificado Digital (.pfx)</label>
              <button onClick={selecionarPfx} className="w-full flex items-center gap-2 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-300 hover:border-blue-500 transition text-left">
                <Upload size={14} className="text-slate-400" />
                {pfxNome || 'Selecionar arquivo .pfx'}
              </button>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Senha do Certificado</label>
              <input type="password" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                value={form.pfx_senha} onChange={e => setForm(f => ({ ...f, pfx_senha: e.target.value }))} placeholder="Senha do .pfx" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={cancelar} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition">Cancelar</button>
            <button onClick={salvar} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition">Salvar</button>
          </div>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Empresa</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">CNPJ</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">UF</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Ambiente</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Certificado</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Último NSU</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {empresas.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-slate-500">Nenhuma empresa cadastrada</td></tr>
            )}
            {empresas.map(e => (
              <tr key={e.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                <td className="px-4 py-3 font-medium text-slate-200">{e.nome}</td>
                <td className="px-4 py-3 font-mono text-slate-400 text-xs">{e.cnpj}</td>
                <td className="px-4 py-3 text-slate-300">{UFS.find(u => u.code === e.uf)?.label || e.uf}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${e.ambiente === 'producao' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                    {e.ambiente === 'producao' ? 'Produção' : 'Homologação'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {e.pfx_b64 ? <span className="text-green-400 text-xs">✓ Configurado</span> : <span className="text-red-400 text-xs">Não configurado</span>}
                </td>
                <td className="px-4 py-3 font-mono text-slate-500 text-xs">{e.ultimo_nsu}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => editar(e)} className="p-1.5 text-slate-400 hover:text-blue-400 transition"><Pencil size={14} /></button>
                    <button onClick={() => excluir(e.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
