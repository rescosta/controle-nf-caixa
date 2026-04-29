import { useEffect, useState, useCallback } from 'react'
import { Calculator, Save, Settings, Trash2, ChevronDown, ChevronRight, RotateCcw, History } from 'lucide-react'
import CurrencyInput from '../../components/CurrencyInput'

interface SefazEmpresa { id: number; nome: string; cnpj: string }
interface Premissas {
  empresa_id: number
  tipo_empresa: string
  presuncao: number       // % de presunção IRPJ
  presuncao_csll: number  // % de presunção CSLL (pode diferir do IRPJ)
  aliq_irpj: number
  aliq_adicional_ir: number
  aliq_csll: number
  limite_adicional: number
  aliq_pis: number
  aliq_cofins: number
  aliq_irrf: number
  aliq_csll_retida: number
  pis_cofins_retidos: number
}
interface Historico {
  id: number; empresa_id: number; ano: number; trimestre: number
  fat_mes1: number; fat_mes2: number; fat_mes3: number; fat_total: number
  outras_receitas: number
  base_irpj: number; base_csll: number
  irpj_bruto: number; adicional_ir: number
  irrf_retido: number; irpj_a_recolher: number
  csll_bruto: number; csll_retida: number; csll_a_recolher: number
  pis: number; cofins: number; total_tributos: number; carga_efetiva: number
  observacao?: string; created_at: string
}

const TRIMESTRES = [1, 2, 3, 4]
const NOMES_TRIMESTRES = ['1º Trim (Jan–Mar)', '2º Trim (Abr–Jun)', '3º Trim (Jul–Set)', '4º Trim (Out–Dez)']
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`
const anoAtual = new Date().getFullYear()

const TIPOS_EMPRESA = [
  { value: 'servicos',    label: 'Serviços',                 presuncao: 0.32, presuncao_csll: 0.32 },
  { value: 'imobiliaria', label: 'Imobiliária / Loteamento', presuncao: 0.08, presuncao_csll: 0.12 },
  { value: 'comercio',    label: 'Comércio / Indústria',     presuncao: 0.08, presuncao_csll: 0.12 },
]

function calcular(fat1: number, fat2: number, fat3: number, outrasReceitas: number, p: Premissas) {
  const fat = fat1 + fat2 + fat3
  const presIrpj = p.presuncao ?? 0.32
  const presCsll = p.presuncao_csll ?? p.presuncao ?? 0.32
  // Outras receitas entram 100% na base, sem aplicar percentual de presunção
  const base_irpj = fat * presIrpj + outrasReceitas
  const base_csll = fat * presCsll + outrasReceitas
  const irpj_bruto = base_irpj * p.aliq_irpj
  const adicional_ir = Math.max(0, base_irpj - p.limite_adicional) * p.aliq_adicional_ir
  const irrf_retido = fat * p.aliq_irrf
  const irpj_a_recolher = Math.max(0, irpj_bruto + adicional_ir - irrf_retido)
  const csll_bruto = base_csll * p.aliq_csll
  const csll_retida = fat * p.aliq_csll_retida
  const csll_a_recolher = Math.max(0, csll_bruto - csll_retida)
  const pis = fat * p.aliq_pis
  const cofins = fat * p.aliq_cofins
  const pis_a_pagar = p.pis_cofins_retidos ? 0 : pis
  const cofins_a_pagar = p.pis_cofins_retidos ? 0 : cofins
  const total_tributos = irpj_a_recolher + csll_a_recolher + pis_a_pagar + cofins_a_pagar
  const carga_efetiva = fat > 0 ? (irpj_a_recolher + csll_a_recolher + pis + cofins) / fat : 0
  return {
    fat_total: fat, base_irpj, base_csll,
    irpj_bruto, adicional_ir, irrf_retido, irpj_a_recolher,
    csll_bruto, csll_retida, csll_a_recolher,
    pis, cofins, total_tributos, carga_efetiva,
  }
}

export default function TributosPage() {
  const [empresas, setEmpresas] = useState<SefazEmpresa[]>([])
  const [empresaId, setEmpresaId] = useState<number | null>(null)
  const [ano, setAno] = useState(anoAtual)
  const [trimestre, setTrimestre] = useState(Math.ceil((new Date().getMonth() + 1) / 3))
  const [premissas, setPremissas] = useState<Premissas | null>(null)
  const [fat1, setFat1] = useState(0)
  const [fat2, setFat2] = useState(0)
  const [fat3, setFat3] = useState(0)
  const [outrasReceitas, setOutrasReceitas] = useState(0)
  const [nfeFat1, setNfeFat1] = useState(0)
  const [nfeFat2, setNfeFat2] = useState(0)
  const [nfeFat3, setNfeFat3] = useState(0)
  const [fromHistory, setFromHistory] = useState(false)
  const [historico, setHistorico] = useState<Historico[]>([])
  const [salvando, setSalvando] = useState(false)
  const [modalPremissas, setModalPremissas] = useState(false)
  const [editPremissas, setEditPremissas] = useState<Premissas | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  useEffect(() => {
    ;(api as any).sefaz.empresas.list().then((emps: SefazEmpresa[]) => {
      setEmpresas(emps)
      if (emps.length > 0) setEmpresaId(emps[0].id)
    })
  }, [])

  const carregarPremissas = useCallback(async () => {
    if (!empresaId) return
    const p = await (api as any).tributos.getPremissas(empresaId)
    setPremissas(p)
  }, [empresaId])

  const carregarFaturamento = useCallback(async () => {
    if (!empresaId) return
    const nfe = await (api as any).tributos.getFaturamento(empresaId, ano, trimestre)
    const m1 = nfe.mes1 ?? 0
    const m2 = nfe.mes2 ?? 0
    const m3 = nfe.mes3 ?? 0
    setNfeFat1(m1); setNfeFat2(m2); setNfeFat3(m3)

    const hist = await (api as any).tributos.getHistoricoTrimestre(empresaId, ano, trimestre)
    if (hist) {
      setFat1(hist.fat_mes1); setFat2(hist.fat_mes2); setFat3(hist.fat_mes3)
      setOutrasReceitas(hist.outras_receitas ?? 0)
      setFromHistory(true)
    } else {
      setFat1(m1); setFat2(m2); setFat3(m3)
      setOutrasReceitas(0)
      setFromHistory(false)
    }
  }, [empresaId, ano, trimestre])

  const carregarHistorico = useCallback(async () => {
    if (!empresaId) return
    const h = await (api as any).tributos.getHistorico(empresaId)
    setHistorico(h)
  }, [empresaId])

  const resetParaNFSe = () => {
    setFat1(nfeFat1); setFat2(nfeFat2); setFat3(nfeFat3)
    setOutrasReceitas(0)
    setFromHistory(false)
  }

  useEffect(() => {
    carregarPremissas()
    carregarHistorico()
  }, [carregarPremissas, carregarHistorico])

  useEffect(() => {
    carregarFaturamento()
  }, [carregarFaturamento])

  const resultado = premissas ? calcular(fat1, fat2, fat3, outrasReceitas, premissas) : null
  const presuncaoIgual = premissas ? premissas.presuncao === (premissas.presuncao_csll ?? premissas.presuncao) : true

  const salvarTrimestre = async () => {
    if (!empresaId || !premissas || !resultado) return
    setSalvando(true)
    try {
      await (api as any).tributos.salvarTrimestre({
        empresa_id: empresaId,
        ano,
        trimestre,
        fat_mes1: fat1,
        fat_mes2: fat2,
        fat_mes3: fat3,
        outras_receitas: outrasReceitas,
        observacao: null,
        ...resultado,
      })
      await carregarHistorico()
      setFromHistory(true)
    } catch (err) {
      alert(`Erro ao salvar: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSalvando(false)
    }
  }

  const salvarPremissas = async () => {
    if (!empresaId || !editPremissas) return
    await (api as any).tributos.savePremissas(empresaId, editPremissas)
    setModalPremissas(false)
    await carregarPremissas()
  }

  const excluirHistorico = async (id: number) => {
    await (api as any).tributos.deleteHistorico(id)
    setConfirmDelete(null)
    await carregarHistorico()
  }

  const tipoLabel = TIPOS_EMPRESA.find(t => t.value === premissas?.tipo_empresa)?.label ?? 'Serviços'

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 pb-16 space-y-6">
      {/* Seleção */}
      <div className="flex items-center gap-3 flex-wrap">
        <select className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-56"
          value={empresaId ?? ''} onChange={e => setEmpresaId(Number(e.target.value))}>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <select value={ano} onChange={e => setAno(Number(e.target.value))}
          className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-24">
          {Array.from({ length: anoAtual - 2019 + 5 }, (_, i) => 2020 + i).map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <div className="flex rounded-lg overflow-hidden border border-slate-600">
          {TRIMESTRES.map(t => (
            <button key={t} onClick={() => setTrimestre(t)}
              className={`px-4 py-2 text-sm font-medium transition ${trimestre === t ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
              {t}T
            </button>
          ))}
        </div>
        {premissas && (
          <span className="text-xs text-slate-400 px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700">
            {tipoLabel}
          </span>
        )}
        <div className="flex-1" />
        <button onClick={() => { setEditPremissas(premissas ? { ...premissas } : null); setModalPremissas(true) }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800 transition">
          <Settings size={14} /> Premissas
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Faturamento */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Calculator size={15} className="text-blue-400" /> Faturamento — {NOMES_TRIMESTRES[trimestre - 1]}
            </h3>
            <button onClick={resetParaNFSe} title="Restaurar valores das NFS-e"
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 border border-slate-600 rounded-lg hover:bg-slate-700 transition">
              <RotateCcw size={11} /> NFS-e
            </button>
          </div>
          {fromHistory ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
              <History size={12} /> Valores carregados do histórico salvo. Edite se necessário ou clique em "NFS-e" para restaurar.
            </div>
          ) : (
            <p className="text-xs text-slate-500">Valores das NFS-e emitidas via ADN Nacional. Edite se necessário.</p>
          )}
          {[
            { label: `Mês ${(trimestre - 1) * 3 + 1}`, val: fat1, set: setFat1 },
            { label: `Mês ${(trimestre - 1) * 3 + 2}`, val: fat2, set: setFat2 },
            { label: `Mês ${(trimestre - 1) * 3 + 3}`, val: fat3, set: setFat3 },
          ].map(({ label, val, set }) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-400 w-16 shrink-0">{label}</span>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none select-none">R$</span>
                <CurrencyInput value={val} onChange={set}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 text-right" />
              </div>
            </div>
          ))}
          {/* Outras Receitas */}
          <div className="border-t border-slate-700/60 pt-3 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-400 w-16 shrink-0 leading-tight">Outras<br />Receitas</span>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none select-none">R$</span>
                <CurrencyInput value={outrasReceitas} onChange={setOutrasReceitas}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 text-right" />
              </div>
            </div>
            <p className="text-xs text-slate-600">Juros, rendimentos etc. — entram 100% na base, sem percentual de presunção.</p>
          </div>

          <div className="border-t border-slate-700 pt-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Total Faturamento</span>
            <span className="text-base font-bold text-white">{fmtBRL(fat1 + fat2 + fat3)}</span>
          </div>
          {premissas && resultado && (
            <div className="space-y-0.5 text-xs text-slate-500">
              {presuncaoIgual ? (
                <div>Base de cálculo ({fmtPct(premissas.presuncao)} presunção{outrasReceitas > 0 ? ' + outras receitas' : ''}): {fmtBRL(resultado.base_irpj)}</div>
              ) : (
                <>
                  <div>Base IRPJ ({fmtPct(premissas.presuncao)}{outrasReceitas > 0 ? ' + outras receitas' : ''}): {fmtBRL(resultado.base_irpj)}</div>
                  <div>Base CSLL ({fmtPct(premissas.presuncao_csll)}{outrasReceitas > 0 ? ' + outras receitas' : ''}): {fmtBRL(resultado.base_csll)}</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Resultado */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Apuração dos Tributos</h3>
          {!resultado ? (
            <p className="text-sm text-slate-500">Selecione uma empresa</p>
          ) : (
            <>
              <Section label="IRPJ">
                {!presuncaoIgual && (
                  <Row label={`Base (${premissas ? fmtPct(premissas.presuncao) : ''} presunção)`} val={resultado.base_irpj} />
                )}
                <Row label={`Bruto (${premissas ? fmtPct(premissas.aliq_irpj) : ''})`} val={resultado.irpj_bruto} />
                <Row label={`Adicional IR (${premissas ? fmtPct(premissas.aliq_adicional_ir) : ''})`} val={resultado.adicional_ir} />
                <Row label="IRRF retido na fonte" val={resultado.irrf_retido} negative />
                <RowTotal label="IRPJ a Recolher" val={resultado.irpj_a_recolher} color="text-orange-400" />
              </Section>
              <Section label="CSLL">
                {!presuncaoIgual && (
                  <Row label={`Base (${premissas ? fmtPct(premissas.presuncao_csll ?? premissas.presuncao) : ''} presunção)`} val={resultado.base_csll} />
                )}
                <Row label={`Bruto (${premissas ? fmtPct(premissas.aliq_csll) : ''})`} val={resultado.csll_bruto} />
                <Row label="CSLL retida na fonte" val={resultado.csll_retida} negative />
                <RowTotal label="CSLL a Recolher" val={resultado.csll_a_recolher} color="text-orange-400" />
              </Section>
              <Section label="PIS / COFINS">
                {premissas?.pis_cofins_retidos ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">PIS ({fmtPct(premissas.aliq_pis)}) apurado</span>
                      <span className="text-slate-400">{fmtBRLs(resultado.pis)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">COFINS ({fmtPct(premissas.aliq_cofins)}) apurado</span>
                      <span className="text-slate-400">{fmtBRLs(resultado.cofins)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1">
                      <span className="font-semibold">100% retidos na fonte pelo tomador — DARF: R$ 0,00</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <Row label={`PIS (${premissas ? fmtPct(premissas.aliq_pis) : ''})`} val={resultado.pis} />
                    <Row label={`COFINS (${premissas ? fmtPct(premissas.aliq_cofins) : ''})`} val={resultado.cofins} />
                  </>
                )}
              </Section>
              <div className="border-t border-slate-600 pt-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-200">
                    {premissas?.pis_cofins_retidos ? 'Total a Recolher (DARF)' : 'Total Carga Tributária'}
                  </span>
                  <span className="text-lg font-bold text-red-400">{fmtBRL(resultado.total_tributos)}</span>
                </div>
                {premissas?.pis_cofins_retidos && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">PIS + COFINS retidos (carga total)</span>
                    <span className="text-xs text-slate-500">{fmtBRLs(resultado.pis + resultado.cofins)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Carga efetiva sobre faturamento</span>
                  <span className="text-xs font-semibold text-slate-400">{fmtPct(resultado.carga_efetiva)}</span>
                </div>
              </div>
              <button onClick={salvarTrimestre} disabled={salvando || (fat1 + fat2 + fat3) === 0}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                <Save size={14} />
                {salvando ? 'Salvando...' : `Salvar ${trimestre}T/${ano} no Histórico`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Histórico */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl">
        <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-2 rounded-t-xl">
          <History size={14} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">Histórico Trimestral</h3>
          <span className="text-xs text-slate-500 ml-1">— salve um trimestre para registrá-lo aqui</span>
        </div>
        {historico.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-slate-600">Nenhum trimestre salvo ainda.</div>
        ) : (
          <div className="overflow-x-auto rounded-b-xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-900/50 border-b border-slate-700">
                <tr>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium">Trimestre</th>
                  <th className="text-right px-4 py-2 text-slate-400 font-medium">Faturamento</th>
                  <th className="text-right px-4 py-2 text-slate-400 font-medium">IRPJ</th>
                  <th className="text-right px-4 py-2 text-slate-400 font-medium">CSLL</th>
                  <th className="text-right px-4 py-2 text-slate-400 font-medium">PIS</th>
                  <th className="text-right px-4 py-2 text-slate-400 font-medium">COFINS</th>
                  <th className="text-right px-4 py-2 text-slate-400 font-medium">Total</th>
                  <th className="text-right px-4 py-2 text-slate-400 font-medium">Carga %</th>
                  <th className="text-center px-4 py-2 text-slate-400 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {historico.map(h => (
                  <tr key={h.id} className="border-b border-slate-700/40 hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 font-semibold text-slate-300">{h.trimestre}T/{h.ano}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{fmtBRL(h.fat_total)}</td>
                    <td className="px-4 py-2.5 text-right text-orange-300">{fmtBRL(h.irpj_a_recolher)}</td>
                    <td className="px-4 py-2.5 text-right text-orange-300">{fmtBRL(h.csll_a_recolher)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{fmtBRL(h.pis)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{fmtBRL(h.cofins)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-red-400">{fmtBRL(h.total_tributos)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">{fmtPct(h.carga_efetiva)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {confirmDelete === h.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => excluirHistorico(h.id)} className="px-2 py-0.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition">Confirmar</button>
                          <button onClick={() => setConfirmDelete(null)} className="px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-600 rounded transition">Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(h.id)} className="p-1 text-slate-500 hover:text-red-400 transition rounded">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Premissas */}
      {modalPremissas && editPremissas && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-600 rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[88vh]">
            <div className="px-6 pt-6 pb-3 shrink-0">
              <h2 className="text-base font-bold text-slate-100 mb-0.5">Premissas Tributárias</h2>
              <p className="text-xs text-slate-500">Alíquotas aplicadas ao cálculo de Lucro Presumido. Altere somente com orientação contábil.</p>
            </div>

            <div className="overflow-y-auto px-6 pb-4 space-y-4 flex-1">
              {/* Tipo de atividade */}
              <div>
                <label className="text-xs text-slate-400 block mb-2">Tipo de Atividade</label>
                <div className="flex gap-2 flex-wrap">
                  {TIPOS_EMPRESA.map(t => (
                    <button key={t.value}
                      onClick={() => setEditPremissas(p => p ? ({
                        ...p,
                        tipo_empresa: t.value,
                        presuncao: t.presuncao,
                        presuncao_csll: t.presuncao_csll,
                      }) : p)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition font-medium ${
                        editPremissas.tipo_empresa === t.value
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-600 mt-1.5">Selecionar o tipo preenche automaticamente os percentuais de presunção abaixo.</p>
              </div>

              <div className="space-y-3">
                {/* Presunção IRPJ */}
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-400 w-48 shrink-0">Presunção IRPJ (%)</label>
                  <div className="flex-1 relative">
                    <input type="number" step={0.01} min={0}
                      value={Number((editPremissas.presuncao * 100).toFixed(4))}
                      onChange={e => setEditPremissas(p => p ? ({ ...p, presuncao: Number(e.target.value) / 100 }) : p)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                    <span className="absolute right-3 top-1.5 text-xs text-slate-500">%</span>
                  </div>
                  <span className="text-xs text-slate-600 w-28 shrink-0">8% imob · 32% serv.</span>
                </div>
                {/* Presunção CSLL */}
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-400 w-48 shrink-0">Presunção CSLL (%)</label>
                  <div className="flex-1 relative">
                    <input type="number" step={0.01} min={0}
                      value={Number(((editPremissas.presuncao_csll ?? editPremissas.presuncao) * 100).toFixed(4))}
                      onChange={e => setEditPremissas(p => p ? ({ ...p, presuncao_csll: Number(e.target.value) / 100 }) : p)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                    <span className="absolute right-3 top-1.5 text-xs text-slate-500">%</span>
                  </div>
                  <span className="text-xs text-slate-600 w-28 shrink-0">12% imob · 32% serv.</span>
                </div>

                {([
                  { key: 'aliq_irpj',        label: 'Alíquota IRPJ (%)',            hint: '15%' },
                  { key: 'aliq_adicional_ir', label: 'Adicional IR (%)',             hint: '10% s/ excedente' },
                  { key: 'limite_adicional',  label: 'Limite Adicional IR (R$)',     hint: 'R$ 60.000/trim.', isMoney: true },
                  { key: 'aliq_csll',         label: 'Alíquota CSLL (%)',            hint: '9%' },
                  { key: 'aliq_pis',          label: 'Alíquota PIS (%)',             hint: '0,65%' },
                  { key: 'aliq_cofins',       label: 'Alíquota COFINS (%)',          hint: '3%' },
                  { key: 'aliq_irrf',         label: 'IRRF retido pelo tomador (%)', hint: '1,5%' },
                  { key: 'aliq_csll_retida',  label: 'CSLL retida pelo tomador (%)', hint: '1%' },
                ] as { key: keyof Premissas; label: string; hint: string; isMoney?: boolean }[]).map(({ key, label, hint, isMoney }) => (
                  <div key={key} className="flex items-center gap-3">
                    <label className="text-xs text-slate-400 w-48 shrink-0">{label}</label>
                    <div className="flex-1 relative">
                      <input type="number" step={isMoney ? 1000 : 0.0001} min={0}
                        value={isMoney ? editPremissas[key] : Number((editPremissas[key] as number * 100).toFixed(4))}
                        onChange={e => setEditPremissas(p => p ? ({ ...p, [key]: isMoney ? Number(e.target.value) : Number(e.target.value) / 100 }) : p)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                      {!isMoney && <span className="absolute right-3 top-1.5 text-xs text-slate-500">%</span>}
                    </div>
                    <span className="text-xs text-slate-600 w-28 shrink-0">{hint}</span>
                  </div>
                ))}

                <div className="border-t border-slate-700 pt-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!editPremissas.pis_cofins_retidos}
                      onChange={e => setEditPremissas(p => p ? ({ ...p, pis_cofins_retidos: e.target.checked ? 1 : 0 }) : p)}
                      className="w-4 h-4 accent-blue-500" />
                    <div>
                      <p className="text-xs text-slate-300 font-medium">PIS/COFINS 100% retidos pelo tomador</p>
                      <p className="text-xs text-slate-500">DARF de PIS/COFINS será R$ 0,00 (valores apurados exibidos como referência).</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-700 justify-end shrink-0">
              <button onClick={() => setModalPremissas(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-600 rounded-lg transition">Cancelar</button>
              <button onClick={salvarPremissas} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition">Salvar Premissas</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Helpers de layout                                                    */
/* ------------------------------------------------------------------ */
const fmtBRLs = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/80 text-xs font-semibold text-slate-300 hover:bg-slate-700/60 transition">
        {label}
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {open && <div className="px-3 py-2 space-y-1.5 bg-slate-900/20">{children}</div>}
    </div>
  )
}
function Row({ label, val, negative }: { label: string; val: number; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{negative ? '(−) ' : ''}{label}</span>
      <span className={negative ? 'text-slate-400' : 'text-slate-300'}>{fmtBRLs(val)}</span>
    </div>
  )
}
function RowTotal({ label, val, color }: { label: string; val: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-xs border-t border-slate-700/50 pt-1.5 mt-0.5">
      <span className="font-semibold text-slate-300">{label}</span>
      <span className={`font-bold ${color}`}>{fmtBRLs(val)}</span>
    </div>
  )
}
