import { useEffect, useState } from 'react'
import { X, Printer } from 'lucide-react'
import { api } from '../../lib/api'
import { formatBRL, formatDate } from '../../lib/format'
import type { Caixa, CaixaLancamento, Refeicao } from '../../types'

interface Props {
  caixa: Caixa
  onClose: () => void
}

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA_ABR = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

interface MesRefeicao {
  mes: number
  ano: number
  refeicoes: Refeicao[]
}

function CalendarioFuncionario({ nome, mes, ano, refeicao, valorUnit }: {
  nome: string; mes: number; ano: number; refeicao: Refeicao | null; valorUnit: number
}) {
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const primeiroDia = new Date(ano, mes - 1, 1).getDay()

  function isMarcado(dia: number): boolean {
    if (!refeicao) return false
    const key = `dia_${String(dia).padStart(2, '0')}`
    const v = (refeicao as Record<string, unknown>)[key] as string | null
    return !!(v && v !== '-' && v.trim() !== '')
  }

  const count = Array.from({ length: diasNoMes }, (_, i) => i + 1).filter(isMarcado).length

  const cells: (number | null)[] = []
  for (let i = 0; i < primeiroDia; i++) cells.push(null)
  for (let d = 1; d <= diasNoMes; d++) cells.push(d)

  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7)
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  return (
    <div style={{ marginBottom: 12, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontWeight: 600, fontSize: 11, color: '#000' }}>{nome}</span>
        <span style={{ fontSize: 10, color: '#000' }}>
          {count} almoço{count !== 1 ? 's' : ''}
          {valorUnit > 0 ? ` × ${formatBRL(valorUnit)} = ${formatBRL(count * valorUnit)}` : ''}
        </span>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 10 }}>
        <thead>
          <tr>
            {DIAS_SEMANA_ABR.map((d, i) => (
              <th key={i} style={{ textAlign: 'center', padding: '2px 3px', background: (i === 0 || i === 6) ? '#bdbdbd' : '#ccc', color: '#000', border: '1px solid #999', width: '14.28%', fontWeight: 700 }}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((dia, di) => {
                const isWeekend = di === 0 || di === 6
                return (
                <td key={di} style={{
                  textAlign: 'center',
                  padding: '3px 2px',
                  border: '1px solid #999',
                  background: dia && isMarcado(dia) ? '#333' : isWeekend ? '#e8e8e8' : 'transparent',
                  color: dia && isMarcado(dia) ? '#fff' : dia ? '#000' : 'transparent',
                  fontWeight: dia && isMarcado(dia) ? 'bold' : 'normal',
                  fontSize: 10,
                }}>
                  {dia ?? ''}
                </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CaixaPrint({ caixa, onClose }: Props) {
  const [lancamentos, setLancamentos] = useState<CaixaLancamento[]>([])
  const [mesesRef, setMesesRef] = useState<MesRefeicao[]>([])

  useEffect(() => {
    async function load() {
      const ls = await api.caixa.getLancamentos(caixa.id)
      setLancamentos(ls as CaixaLancamento[])

      if (!caixa.periodo_inicio || !caixa.periodo_fim) return
      const start = new Date(caixa.periodo_inicio)
      const end = new Date(caixa.periodo_fim)
      const meses: MesRefeicao[] = []
      let cur = new Date(start.getFullYear(), start.getMonth(), 1)
      while (cur <= end) {
        const m = cur.getMonth() + 1
        const a = cur.getFullYear()
        const rs = await api.caixa.getRefeicoes(caixa.id, m, a) as Refeicao[]
        if (rs.length > 0) meses.push({ mes: m, ano: a, refeicoes: rs })
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
      }
      setMesesRef(meses)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caixa.id])

  const totalDebitos = lancamentos.reduce((s, l) => s + Number(l.valor_debito ?? 0), 0)
  const totalCreditos = lancamentos.reduce((s, l) => s + Number(l.valor_credito ?? 0), 0)
  const saldoFinal = lancamentos.length > 0 ? lancamentos[lancamentos.length - 1].saldo : 0

  // Collect all unique employee ids from all months
  const allFuncs = mesesRef.flatMap(mr =>
    mr.refeicoes.map(r => ({
      id: r.funcionario_id,
      nome: r.funcionario_nome ?? `Func ${r.funcionario_id}`,
    }))
  ).filter((f, i, arr) => arr.findIndex(x => x.id === f.id) === i)

  return (
    <>
      {/* Estilos de impressão — sempre ativos */}
      <style>{`
        @page { size: A4 portrait; margin: 15mm 12mm; }
        @media print {
          html, body { background: white !important; color: #000 !important; }
          body > * { visibility: hidden !important; }
          #caixa-print-root { visibility: visible !important; position: fixed; top: 0; left: 0; width: 100%; background: white !important; color: #000 !important; }
          #caixa-print-root * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* Barra de ações — oculta ao imprimir */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 print:hidden">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
            <span className="font-semibold text-slate-700">Caixa #{caixa.numero_caixa}</span>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                <Printer size={14} /> Imprimir / PDF
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-5 bg-white" style={{ color: '#111' }}>
            <style>{`
              .cp-wrap td, .cp-wrap th {
                color: #111;
                background: transparent;
                text-transform: none;
                letter-spacing: normal;
                font-size: inherit;
                white-space: normal;
              }
              .cp-wrap label { color: #111; text-transform: none; letter-spacing: normal; }
            `}</style>
            <div className="cp-wrap">
            <PrintContent
              caixa={caixa}
              lancamentos={lancamentos}
              totalDebitos={totalDebitos}
              totalCreditos={totalCreditos}
              saldoFinal={saldoFinal}
              mesesRef={mesesRef}
              allFuncs={allFuncs}
            />
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo para impressão — visível só ao imprimir */}
      <div id="caixa-print-root" className="hidden print:block">
        <PrintContent
          caixa={caixa}
          lancamentos={lancamentos}
          totalDebitos={totalDebitos}
          totalCreditos={totalCreditos}
          saldoFinal={saldoFinal}
          mesesRef={mesesRef}
          allFuncs={allFuncs}
        />
      </div>
    </>
  )
}

function PrintContent({ caixa, lancamentos, totalDebitos, totalCreditos, saldoFinal, mesesRef, allFuncs }: {
  caixa: Caixa
  lancamentos: CaixaLancamento[]
  totalDebitos: number
  totalCreditos: number
  saldoFinal: number
  mesesRef: MesRefeicao[]
  allFuncs: { id: number; nome: string }[]
}) {
  const C = { color: '#000' as const }
  const B = '1px solid #999'

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', color: '#000', fontSize: 11, padding: '0 4px' }}>
      {/* Cabeçalho */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', color: '#000' }}>
          Acerto de Caixa / Demonstrativo
        </h2>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, fontSize: 11, borderBottom: B }}>
        <tbody>
          <tr>
            <td style={{ padding: '2px 4px', ...C }}><strong>Caixa Nº:</strong> {caixa.numero_caixa}</td>
            <td style={{ padding: '2px 4px', ...C }}><strong>Unidade:</strong> {caixa.unidade_nome ?? '-'}</td>
            <td style={{ padding: '2px 4px', ...C }}><strong>Empresa:</strong> {caixa.empresa_nome ?? '-'}</td>
          </tr>
          <tr>
            <td style={{ padding: '2px 4px', ...C }} colSpan={2}>
              <strong>Período:</strong> {formatDate(caixa.periodo_inicio)} a {formatDate(caixa.periodo_fim)}
            </td>
            <td style={{ padding: '2px 4px', ...C }}><strong>Data Envio:</strong> {formatDate(caixa.data_envio)}</td>
          </tr>
          <tr>
            <td style={{ padding: '2px 4px', ...C }}><strong>Executado por:</strong> {caixa.executado_por ?? '-'}</td>
            <td style={{ padding: '2px 4px', ...C }}><strong>Responsável:</strong> {caixa.responsavel ?? '-'}</td>
            <td style={{ padding: '2px 4px', ...C }}>
              <strong>Saldo Anterior:</strong> {formatBRL(caixa.saldo_anterior)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Resumo */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10, fontSize: 11 }}>
        <tbody>
          <tr>
            <td style={{ padding: '3px 8px', border: B, ...C }}><strong>Total Débitos:</strong> {formatBRL(totalDebitos)}</td>
            <td style={{ padding: '3px 8px', border: B, ...C }}><strong>Total Créditos:</strong> {formatBRL(totalCreditos)}</td>
            <td style={{ padding: '3px 8px', border: B, fontWeight: 'bold', ...C }}><strong>Saldo Final:</strong> {formatBRL(saldoFinal)}</td>
          </tr>
        </tbody>
      </table>

      {/* Lançamentos */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 10 }}>
        <thead>
          <tr style={{ background: '#d0d0d0' }}>
            <th style={{ padding: '4px 6px', textAlign: 'center', width: 30, color: '#000', border: B, fontWeight: 700 }}>NUM</th>
            <th style={{ padding: '4px 6px', textAlign: 'left', width: 80, color: '#000', border: B, fontWeight: 700 }}>DATA</th>
            <th style={{ padding: '4px 6px', textAlign: 'left', color: '#000', border: B, fontWeight: 700 }}>HISTÓRICO</th>
            <th style={{ padding: '4px 6px', textAlign: 'left', width: 120, color: '#000', border: B, fontWeight: 700 }}>FAVORECIDO</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', width: 80, color: '#000', border: B, fontWeight: 700 }}>DÉBITO</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', width: 80, color: '#000', border: B, fontWeight: 700 }}>CRÉDITO</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', width: 90, color: '#000', border: B, fontWeight: 700 }}>SALDO</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ background: '#f0f0f0' }}>
            <td style={{ padding: '3px 6px', border: B, textAlign: 'center', color: '#555', fontStyle: 'italic' }}>-</td>
            <td style={{ padding: '3px 6px', border: B, color: '#555', fontStyle: 'italic' }}>-</td>
            <td style={{ padding: '3px 6px', border: B, fontStyle: 'italic', color: '#555' }}>Saldo Anterior</td>
            <td style={{ padding: '3px 6px', border: B, color: '#000' }}></td>
            <td style={{ padding: '3px 6px', border: B, color: '#000' }}></td>
            <td style={{ padding: '3px 6px', border: B, color: '#000' }}></td>
            <td style={{ padding: '3px 6px', border: B, textAlign: 'right', color: '#555', fontStyle: 'italic' }}>{formatBRL(caixa.saldo_anterior)}</td>
          </tr>
          {lancamentos.map((l, idx) => (
            <tr key={l.id}>
              <td style={{ padding: '3px 6px', border: B, textAlign: 'center', fontFamily: 'monospace', ...C }}>{idx + 1}</td>
              <td style={{ padding: '3px 6px', border: B, ...C }}>{formatDate(l.data)}</td>
              <td style={{ padding: '3px 6px', border: B, ...C }}>{l.historico}</td>
              <td style={{ padding: '3px 6px', border: B, ...C }}>{l.favorecido}</td>
              <td style={{ padding: '3px 6px', border: B, textAlign: 'right', ...C }}>
                {l.valor_debito ? formatBRL(l.valor_debito) : ''}
              </td>
              <td style={{ padding: '3px 6px', border: B, textAlign: 'right', ...C }}>
                {l.valor_credito ? formatBRL(l.valor_credito) : ''}
              </td>
              <td style={{ padding: '3px 6px', border: B, textAlign: 'right', fontWeight: 600, ...C }}>
                {formatBRL(l.saldo)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#d0d0d0', fontWeight: 700 }}>
            <td colSpan={4} style={{ padding: '4px 6px', border: B, ...C }}>TOTAL</td>
            <td style={{ padding: '4px 6px', border: B, textAlign: 'right', fontFamily: 'monospace', ...C }}>{formatBRL(totalDebitos)}</td>
            <td style={{ padding: '4px 6px', border: B, textAlign: 'right', fontFamily: 'monospace', ...C }}>{formatBRL(totalCreditos)}</td>
            <td style={{ padding: '4px 6px', border: B, textAlign: 'right', fontFamily: 'monospace', ...C }}>{formatBRL(saldoFinal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Calendário de refeições */}
      {mesesRef.length > 0 && (
        <>
          {(() => {
            const diasCols = Array.from({ length: 31 }, (_, i) => `dia_${String(i + 1).padStart(2, '0')}`)
            const totalRefeicoes = mesesRef.flatMap(mr => mr.refeicoes)
              .filter(r => r.tipo === 'almoco')
              .reduce((sum, r) => {
                const vUnit = Number((r as any).valor_unitario ?? 0)
                const count = diasCols.filter(k => { const v = (r as any)[k]; return v && v !== '-' && v.trim() !== '' }).length
                return sum + count * vUnit
              }, 0)
            return (
              <div style={{ borderTop: '2px solid #333', marginBottom: 10, paddingTop: 10 }}>
                <h3 style={{ margin: 0, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', color: '#000' }}>
                  Refeições
                </h3>
              </div>
            )
          })()}

          {mesesRef.map(mr => (
            <div key={`${mr.mes}-${mr.ano}`} style={{ marginBottom: 14 }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 'bold', color: '#000' }}>
                {MESES_PT[mr.mes - 1]}/{mr.ano}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {allFuncs.map(func => {
                  const ref = mr.refeicoes.find(r => r.funcionario_id === func.id && r.tipo === 'almoco') ?? null
                  return (
                    <CalendarioFuncionario
                      key={func.id}
                      nome={func.nome}
                      mes={mr.mes}
                      ano={mr.ano}
                      refeicao={ref}
                      valorUnit={Number(ref?.valor_unitario ?? 0)}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
