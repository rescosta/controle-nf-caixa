import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

export default function NumeracaoConfig() {
  const [valor, setValor] = useState<number>(1)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.settings.get('seq_inicial').then((v: string | null) => {
      if (v) setValor(parseInt(v, 10))
    })
  }, [])

  async function handleSalvar() {
    await api.settings.set('seq_inicial', String(valor))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-lg">
      <h2 className="text-lg font-semibold text-slate-100 mb-1">Numeração das Notas Fiscais</h2>
      <p className="text-sm text-slate-400 mb-6">
        Define o número inicial da sequência. O sistema usa sempre o maior entre este valor e o
        último número já utilizado — alterar este campo não afeta NFs já existentes.
      </p>

      <div className="bg-slate-800 rounded-lg p-5 border border-slate-700 space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Número inicial (seq_inicial)</label>
          <input
            type="number"
            min={1}
            max={9999}
            value={valor}
            onFocus={e => e.target.select()}
            onChange={e => setValor(Math.max(1, Math.min(9999, parseInt(e.target.value) || 1)))}
            className="w-40 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={handleSalvar}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded transition"
        >
          {saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
