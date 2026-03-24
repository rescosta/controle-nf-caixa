import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Save, CheckCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { formatBRL } from '../../lib/format'
import type { Caixa, Funcionario, Refeicao } from '../../types'

interface Props {
  mes: number
  ano: number
  caixa: Caixa
  onBack: () => void
}

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA_ABR = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] // índice = getDay()

export default function RefeicoesMes({ mes, ano, caixa, onBack }: Props) {
  const [mesCurrent, setMesCurrent] = useState(mes)
  const [anoCurrent, setAnoCurrent] = useState(ano)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [refeicoes, setRefeicoes] = useState<Refeicao[]>([])
  const [valorUnitAlmoco, setValorUnitAlmoco] = useState(0)
  const [valorUnitStr, setValorUnitStr] = useState('')

  function setValorUnit(v: number) {
    setValorUnitAlmoco(v)
    setValorUnitStr(v > 0 ? v.toFixed(2).replace('.', ',') : '')
  }
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null)
  const [prevRefeicaoRef, setPrevRefeicaoRef] = useState<{
    historico?: string; valor_debito?: number; valor_credito?: number; data?: string
  } | null>(null)

  const diasNoMes = new Date(anoCurrent, mesCurrent, 0).getDate()
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1)

  function getDiaSemana(dia: number): string {
    return DIAS_SEMANA_ABR[new Date(anoCurrent, mesCurrent - 1, dia).getDay()]
  }

  function isWeekend(dia: number): boolean {
    const dow = new Date(anoCurrent, mesCurrent - 1, dia).getDay()
    return dow === 0 || dow === 6
  }

  function prevMonth() {
    if (mesCurrent === 1) { setMesCurrent(12); setAnoCurrent(a => a - 1) }
    else setMesCurrent(m => m - 1)
  }

  function nextMonth() {
    if (mesCurrent === 12) { setMesCurrent(1); setAnoCurrent(a => a + 1) }
    else setMesCurrent(m => m + 1)
  }

  const load = useCallback(async () => {
    const [fs, rs] = await Promise.all([
      api.funcionarios.list(),
      api.caixa.getRefeicoes(caixa.id, mesCurrent, anoCurrent),
    ])
    setFuncionarios(fs as Funcionario[])
    const refData = rs as Refeicao[]
    setRefeicoes(refData)
    const alm = refData.find(r => r.tipo === 'almoco')
    if (alm && Number(alm.valor_unitario ?? 0) > 0) {
      setValorUnit(Number(alm.valor_unitario))
    } else {
      const saved = await api.settings.get('valor_unit_almoco') as string | null
      if (saved) setValorUnit(parseFloat(saved))
    }
  }, [caixa.id, mesCurrent, anoCurrent])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.caixa.getBlockedUntil(caixa.id).then(val => {
      setBlockedUntil(val as string | null)
    })
    api.caixa.getPrevRefeicaoLancamento(caixa.id).then(val => {
      setPrevRefeicaoRef(val as any ?? null)
    })
  }, [caixa.id])

  function getRefeicao(func_id: number): Refeicao {
    const existing = refeicoes.find(r => r.funcionario_id === func_id && r.tipo === 'almoco')
    if (existing) return existing
    return {
      funcionario_id: func_id, mes: mesCurrent, ano: anoCurrent, tipo: 'almoco',
      valor_unitario: valorUnitAlmoco
    }
  }

  function getDia(r: Refeicao, dia: number): string {
    if (caixa.periodo_inicio) {
      const dataStr = `${anoCurrent}-${String(mesCurrent).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      if (dataStr < caixa.periodo_inicio) return ''
    }
    const key = `dia_${String(dia).padStart(2, '0')}`
    return (r[key] as string) ?? ''
  }

  function isDiaBloqueado(dia: number): boolean {
    if (!blockedUntil) return false
    const dataStr = `${anoCurrent}-${String(mesCurrent).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    return dataStr <= blockedUntil
  }

  function setDia(func_id: number, dia: number, value: string) {
    const key = `dia_${String(dia).padStart(2, '0')}`
    setRefeicoes(prev => {
      const idx = prev.findIndex(r => r.funcionario_id === func_id && r.tipo === 'almoco')
      if (idx >= 0) {
        const upd = [...prev]
        upd[idx] = { ...upd[idx], [key]: value }
        return upd
      } else {
        return [...prev, { funcionario_id: func_id, mes: mesCurrent, ano: anoCurrent, tipo: 'almoco', valor_unitario: valorUnitAlmoco, [key]: value }]
      }
    })
    setDirty(true)
  }

  function countDias(r: Refeicao): number {
    return dias.filter(d => {
      if (isDiaBloqueado(d)) return false
      const v = getDia(r, d)
      return v && v !== '-' && v.trim() !== ''
    }).length
  }

  async function handleSave() {
    setSaving(true)
    try {
      for (const func of funcionarios) {
        const r = getRefeicao(func.id)
        const diasData: Record<string, string | null> = {}
        dias.forEach(d => {
          const key = `dia_${String(d).padStart(2, '0')}`
          diasData[key] = getDia(r, d) || null
        })
        await api.caixa.upsertRefeicao({
          caixa_id: caixa.id,
          funcionario_id: func.id,
          mes: mesCurrent,
          ano: anoCurrent,
          tipo: 'almoco',
          valor_unitario: valorUnitAlmoco,
          ...diasData
        })
      }
      await api.settings.set('valor_unit_almoco', String(valorUnitAlmoco))
      setDirty(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  function handleConcluir() {
    if (dirty) {
      handleLancarNoCaixa()
    } else {
      onBack()
    }
  }

  async function handleLancarNoCaixa() {
    if (!caixa.periodo_inicio || !caixa.periodo_fim) return
    // Salva os dados na memória antes de ler do banco
    if (dirty) await handleSave()
    const start = new Date(caixa.periodo_inicio)
    const end   = new Date(caixa.periodo_fim)
    let total = 0
    const mesesLabels: string[] = []
    let cur = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur <= end) {
      const m = cur.getMonth() + 1
      const a = cur.getFullYear()
      const t = await api.caixa.getTotalRefeicoes(caixa.id, m, a, caixa.periodo_inicio, caixa.periodo_fim) as number
      total += t
      mesesLabels.push(`${MESES_PT[m - 1]}/${a}`)
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
    await api.caixa.createLancamento({
      caixa_id: caixa.id,
      data: caixa.periodo_fim,
      historico: `Transporte Planilha Refeições — ${mesesLabels.join(' + ')}`,
      favorecido: null,
      valor_debito: total,
      valor_credito: 0,
      tipo: 'refeicoes',
    })
    onBack()
  }

  const totalAlmoco = funcionarios.reduce((s, f) => {
    const r = getRefeicao(f.id)
    return s + countDias(r) * valorUnitAlmoco
  }, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-4">
          <button className="btn-ghost btn-sm p-2" onClick={onBack}><ArrowLeft size={16} /></button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100">Refeições —</h1>
              <button className="btn-ghost btn-sm p-1" onClick={prevMonth}><ChevronLeft size={16} /></button>
              <span className="text-xl font-bold text-slate-100">{MESES_PT[mesCurrent - 1]}/{anoCurrent}</span>
              <button className="btn-ghost btn-sm p-1" onClick={nextMonth}><ChevronRight size={16} /></button>
            </div>
            <p className="text-sm text-slate-400">Caixa #{caixa.numero_caixa} — {caixa.unidade_nome}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Almoço R$</label>
              <input
                type="text"
                inputMode="decimal"
                className="w-24 text-sm text-right"
                value={valorUnitStr}
                placeholder="0,00"
                onFocus={e => e.target.select()}
                onChange={e => {
                  setValorUnitStr(e.target.value)
                  const v = parseFloat(e.target.value.replace(',', '.'))
                  setValorUnitAlmoco(isNaN(v) ? 0 : v)
                  setDirty(true)
                }}
                onBlur={() => setValorUnitStr(valorUnitAlmoco > 0 ? valorUnitAlmoco.toFixed(2).replace('.', ',') : '')}
              />
            </div>
          </div>
          <div className="flex gap-2">
            {dirty && (
              <button className="btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
            )}
            <button className="btn-success btn-sm" onClick={handleLancarNoCaixa}>
              <Plus size={14} /> Lançar no Caixa
            </button>
            <button className="btn-secondary btn-sm" onClick={handleConcluir}>
              <CheckCircle size={14} /> OK / Concluir
            </button>
          </div>
        </div>

        {/* Totais */}
        <div className="flex gap-4 mt-3">
          <div className="card py-2 px-4 flex gap-4 items-center">
            <span className="text-xs text-slate-500">Total de Refeições:</span>
            <span className="font-mono font-bold text-blue-400">{formatBRL(totalAlmoco)}</span>
          </div>
          {prevRefeicaoRef && (
            <div className="card py-2 px-4 flex gap-4 items-center opacity-60 border-purple-700/40 bg-purple-900/10">
              <span className="text-xs text-slate-500 italic">Ref. caixa anterior:</span>
              <span className="font-mono font-bold text-purple-300">
                {formatBRL(prevRefeicaoRef.valor_debito ?? prevRefeicaoRef.valor_credito ?? 0)}
              </span>
              {prevRefeicaoRef.historico && (
                <span className="text-xs text-slate-500 truncate max-w-48">{prevRefeicaoRef.historico}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="sticky left-0 bg-slate-900 z-10" />
                {dias.map(d => (
                  <th key={d} className={`text-center text-xs px-1 pt-1 ${isWeekend(d) ? 'bg-slate-700/50 text-slate-400' : 'text-slate-500'}`}>
                    {getDiaSemana(d)}
                  </th>
                ))}
                <th /><th />
              </tr>
              <tr>
                <th className="sticky left-0 bg-slate-900 z-10 min-w-40">Funcionário</th>
                {dias.map(d => (
                  <th key={d} className={`text-center min-w-10 px-1 pb-1 ${isWeekend(d) ? 'bg-slate-700/50' : ''}`}>
                    {String(d).padStart(2,'0')}
                  </th>
                ))}
                <th className="text-center min-w-12">Qtd</th>
                <th className="text-right min-w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {funcionarios.map(f => {
                const r = getRefeicao(f.id)
                const count = countDias(r)
                return (
                  <tr key={f.id}>
                    <td className="sticky left-0 bg-slate-800 font-medium">{f.nome}</td>
                    {dias.map(d => {
                      const bloqueado = isDiaBloqueado(d)
                      const val = getDia(r, d)
                      const marcado = val === 'BH'
                      return (
                        <td key={d} className={`px-0 py-0.5 text-center ${isWeekend(d) ? 'bg-slate-700/25' : ''}`}>
                          {bloqueado ? (
                            <span className="w-9 h-6 rounded text-xs bg-slate-900 text-slate-700 flex items-center justify-center cursor-not-allowed select-none mx-auto">
                              —
                            </span>
                          ) : (
                            <button
                              onClick={() => setDia(f.id, d, marcado ? '' : 'BH')}
                              className={`w-9 h-6 rounded text-xs font-bold leading-none transition ${
                                marcado
                                  ? 'bg-blue-600'
                                  : 'bg-slate-700 text-slate-500 hover:bg-slate-600 hover:text-slate-300'
                              }`}
                            >
                              {marcado ? '\u00A0' : '—'}
                            </button>
                          )}
                        </td>
                      )
                    })}
                    <td className="text-center font-mono font-bold">{count}</td>
                    <td className="text-right font-mono">{formatBRL(count * valorUnitAlmoco)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
