import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Eye, DollarSign, FileDown, X, CheckCircle, AlertTriangle, RotateCcw, ShieldCheck, Printer, Mail, ArrowUpRight, ChevronDown } from 'lucide-react'
import { api } from '../../lib/api'

function SearchableSelect({ value, onChange, options, placeholder, disabled }: {
  value: number | ''
  onChange: (v: number | '') => void
  options: { value: number; label: string }[]
  placeholder: string
  disabled?: boolean
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm flex items-center justify-between cursor-pointer transition
          ${open ? 'border-purple-500' : 'border-slate-600'}
          ${disabled ? 'opacity-50 pointer-events-none' : 'hover:border-slate-500'}`}>
        <span className={selected ? 'text-slate-200' : 'text-slate-500'}>{selected?.label || placeholder}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full px-3 py-2 text-sm bg-slate-900 border-b border-slate-700 text-slate-200 outline-none placeholder-slate-600" />
          <div className="max-h-48 overflow-y-auto">
            <div onClick={() => { onChange(''); setOpen(false); setSearch('') }}
              className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-700 cursor-pointer">{placeholder}</div>
            {filtered.map(o => (
              <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); setSearch('') }}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-700 ${o.value === value ? 'text-purple-400 font-medium' : 'text-slate-200'}`}>
                {o.label}
              </div>
            ))}
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-slate-500">Nenhum resultado</div>}
          </div>
        </div>
      )}
    </div>
  )
}

interface Empresa { id: number; nome: string; cnpj: string; pfx_b64?: string }
interface NfseServico {
  id: number; empresa_id: number; chave_acesso: string; nsu: string
  numero: string; serie: string; competencia: string
  prestador_cnpj: string; prestador_nome: string
  valor_servicos: number; descricao: string
  status_pagamento: 'pendente' | 'pago'; data_pagamento?: string
  tipo: 'emitida' | 'recebida'
  cancelada: number
  email_enviado: number
  created_at: string
}
interface Destinatario { id: number; nome: string; email: string }
interface EmpresaNF { id: number; nome: string }
interface UnidadeNF { id: number; nome: string; empresa_id: number }
interface CentroCusto { id: number; codigo: string; descricao: string }

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtCompetencia = (c: string) => {
  if (!c || c.length < 7) return c || '-'
  const [ano, mes] = c.split('-')
  return `${mes}/${ano}`
}

function traduzirErro(msg: string): { titulo: string; detalhe: string } {
  const limpo = msg.replace(/Error invoking remote method '[^']+': /g, '').replace(/^Error: /, '')
  if (limpo.includes('PKCS#12 MAC') || limpo.includes('Invalid password')) return { titulo: 'Senha do certificado incorreta', detalhe: 'Verifique a senha do .pfx cadastrado para esta empresa.' }
  if (limpo.includes('403') || limpo.includes('não autorizado')) return { titulo: 'Certificado não autorizado', detalhe: 'O certificado não tem permissão para este CNPJ no ADN.' }
  if (limpo.includes('Certificado digital não configurado')) return { titulo: 'Certificado não configurado', detalhe: 'Acesse Empresas SEFAZ e configure o arquivo .pfx.' }
  if (limpo.includes('ADN HTTP')) return { titulo: 'Erro na API ADN NFS-e', detalhe: limpo }
  if (limpo.includes('ECONNREFUSED') || limpo.includes('ENOTFOUND') || limpo.includes('Timeout')) return { titulo: 'Sem conexão com ADN NFS-e', detalhe: 'Verifique sua conexão com a internet.' }
  return { titulo: 'Erro na consulta NFS-e', detalhe: limpo }
}

export default function NfseServicosPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState<number | null>(null)
  const [servicos, setServicos] = useState<NfseServico[]>([])
  const [consultando, setConsultando] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [ultimaConsulta, setUltimaConsulta] = useState('')
  const [filtros, setFiltros] = useState({ prestador: '', ano: '', competencia: '', status_pagamento: 'todas', fonte: 'todas', tipo: 'todas' })
  const [anosDisponiveis, setAnosDisponiveis] = useState<string[]>([])

  const [modalErro, setModalErro] = useState<{ titulo: string; detalhe: string } | null>(null)
  const [modalSucesso, setModalSucesso] = useState<{ total: number; temMais: boolean; debugRaw?: string; reimport?: boolean; exportado?: boolean; ultimoNsu?: string; paginas?: number } | null>(null)
  const [modalVisualizar, setModalVisualizar] = useState<NfseServico | null>(null)
  const [confirmReimportar, setConfirmReimportar] = useState(false)
  const [verificandoEventos, setVerificandoEventos] = useState(false)
  const [modalEventos, setModalEventos] = useState<{ verificadas: number; canceladas: number } | null>(null)
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([])
  const [destinatariosSel, setDestinatariosSel] = useState<number[]>([])
  const [modalEmail, setModalEmail] = useState<NfseServico | null>(null)
  const [enviandoEmail, setEnviandoEmail] = useState(false)

  const [modalExportar, setModalExportar] = useState<NfseServico | null>(null)
  const [exportando, setExportando] = useState(false)
  const [exportEmpresaId, setExportEmpresaId] = useState<number | ''>('')
  const [exportUnidadeId, setExportUnidadeId] = useState<number | ''>('')
  const [exportCcId, setExportCcId] = useState<number | ''>('')
  const [empresasNF, setEmpresasNF] = useState<EmpresaNF[]>([])
  const [unidadesNF, setUnidadesNF] = useState<UnidadeNF[]>([])
  const [ccNF, setCcNF] = useState<CentroCusto[]>([])

  useEffect(() => {
    api.sefaz.empresas.list().then((emps: Empresa[]) => {
      setEmpresas(emps)
      if (emps.length > 0) setEmpresaId(emps[0].id)
    })
    api.sefaz.destinatarios.list().then((d: Destinatario[]) => {
      setDestinatarios(d)
      setDestinatariosSel(d.map(x => x.id))
    })
    api.empresas.list().then((e: EmpresaNF[]) => setEmpresasNF(e))
    api.centrosCusto.list().then((c: CentroCusto[]) => setCcNF(c))
    const unsub = (api as any).nfse.onProgress((msg: string) => setProgressMsg(msg))
    return unsub
  }, [])

  const carregar = useCallback(async () => {
    if (!empresaId) return
    const lista = await (api as any).nfse.servicos.list({ empresa_id: empresaId, ...filtros })
    setServicos(lista)
    const anos = await (api as any).nfse.servicos.anosDisponiveis(empresaId)
    setAnosDisponiveis(anos)
  }, [empresaId, filtros])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (exportEmpresaId) {
      api.unidades.listByEmpresa(Number(exportEmpresaId)).then((u: UnidadeNF[]) => setUnidadesNF(u))
      setExportUnidadeId('')
    } else {
      setUnidadesNF([])
    }
  }, [exportEmpresaId])

  const consultar = async () => {
    if (!empresaId) return
    const emp = empresas.find(e => e.id === empresaId)
    if (!emp?.pfx_b64) return setModalErro({ titulo: 'Certificado não configurado', detalhe: 'Acesse Empresas SEFAZ e configure o .pfx para esta empresa.' })
    setConsultando(true); setProgressMsg('')
    try {
      const r = await (api as any).nfse.consultar(empresaId)
      setUltimaConsulta(new Date().toLocaleString('pt-BR'))
      setModalSucesso({ total: r.total, temMais: r.temMais, debugRaw: r.debugRaw, ultimoNsu: r.ultimoNsu, paginas: r.paginas })
      await carregar()
    } catch (e: any) {
      setModalErro(traduzirErro(e.message))
    } finally {
      setConsultando(false); setProgressMsg('')
    }
  }

  const reimportar = async () => {
    if (!empresaId) return
    setConfirmReimportar(false)
    setConsultando(true); setProgressMsg('')
    try {
      const r = await (api as any).nfse.reimportar(empresaId)
      setUltimaConsulta(new Date().toLocaleString('pt-BR'))
      setModalSucesso({ total: r.total, temMais: r.temMais, debugRaw: r.debugRaw, reimport: true, ultimoNsu: r.ultimoNsu, paginas: r.paginas })
      await carregar()
    } catch (e: any) {
      setModalErro(traduzirErro(e.message))
    } finally {
      setConsultando(false); setProgressMsg('')
    }
  }

  const enviarEmail = async () => {
    if (!modalEmail) return
    const selecionados = destinatarios.filter(d => destinatariosSel.includes(d.id)).map(d => d.email)
    if (selecionados.length === 0) return setModalErro({ titulo: 'Nenhum destinatário', detalhe: 'Selecione ao menos um destinatário.' })
    const empresa = empresas.find(e => e.id === modalEmail.empresa_id)
    setEnviandoEmail(true)
    try {
      const xml = await (api as any).nfse.servicos.buscarXml(modalEmail.id)
      await api.sefaz.email.enviar({
        destinatarios: selecionados,
        empresaNome: empresa?.nome || '',
        fornecedorNome: modalEmail.prestador_nome,
        fornecedorCnpj: modalEmail.prestador_cnpj,
        nfNumero: modalEmail.numero || '-',
        valorNota: modalEmail.valor_servicos,
        nfData: modalEmail.competencia,
        statusPagamento: modalEmail.status_pagamento,
        chaveAcesso: modalEmail.chave_acesso,
        xmlBlob: xml || null,
      })
      await (api as any).nfse.servicos.marcarEmailEnviado(modalEmail.id)
      setModalEmail(null); await carregar()
    } catch (e: any) {
      setModalErro({ titulo: 'Erro ao enviar e-mail', detalhe: e.message.replace(/Error invoking remote method '[^']+': /g, '').replace(/^Error: /, '') })
    } finally {
      setEnviandoEmail(false)
    }
  }

  const imprimir = (s: NfseServico) => { setModalVisualizar(s); setTimeout(() => window.print(), 300) }

  const verificarEventos = async () => {
    if (!empresaId) return
    const emp = empresas.find(e => e.id === empresaId)
    if (!emp?.pfx_b64) return setModalErro({ titulo: 'Certificado não configurado', detalhe: 'Configure o .pfx para esta empresa.' })
    setVerificandoEventos(true); setProgressMsg('Verificando cancelamentos no ADN...')
    try {
      const r = await (api as any).nfse.verificarEventos(empresaId)
      setModalEventos({ verificadas: r.verificadas, canceladas: r.canceladas })
      await carregar()
    } catch (e: any) {
      setModalErro(traduzirErro(e.message))
    } finally {
      setVerificandoEventos(false); setProgressMsg('')
    }
  }

  const exportarNF = async () => {
    if (!modalExportar || !exportEmpresaId) return
    setExportando(true)
    try {
      await (api as any).nfse.exportarNF({
        nfse: modalExportar,
        empresaId: Number(exportEmpresaId),
        unidadeId: exportUnidadeId ? Number(exportUnidadeId) : null,
        centroCustoId: exportCcId ? Number(exportCcId) : null,
      })
      setModalExportar(null)
      setExportEmpresaId(''); setExportUnidadeId(''); setExportCcId('')
      setModalSucesso({ total: -1, temMais: false, exportado: true } as any)
    } catch (e: any) {
      setModalErro({ titulo: 'Erro ao exportar', detalhe: e.message.replace(/Error invoking remote method '[^']+': /g, '').replace(/^Error: /, '') })
    } finally {
      setExportando(false)
    }
  }

  const baixarXml = async (s: NfseServico) => {
    const xml = await (api as any).nfse.servicos.buscarXml(s.id)
    if (!xml) return
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `NFSe_${s.numero || s.chave_acesso?.slice(0, 8) || s.id}.xml`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700 bg-slate-800/50 shrink-0 flex-wrap gap-y-2">
        <select className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-56"
          value={empresaId ?? ''} onChange={e => setEmpresaId(Number(e.target.value))}>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <button onClick={consultar} disabled={consultando || !empresaId}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
          <RefreshCw size={15} className={consultando ? 'animate-spin' : ''} />
          {consultando ? 'Consultando...' : 'Consultar NFS-e'}
        </button>
        <button onClick={() => setConfirmReimportar(true)} disabled={consultando || !empresaId}
          title="Apaga todos os registros desta empresa e reimporta tudo do início"
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-lg text-sm transition">
          <RotateCcw size={14} /> Reimportar todos
        </button>
        <button onClick={verificarEventos} disabled={verificandoEventos || consultando || !empresaId}
          title="Verifica no ADN se alguma NFS-e importada foi cancelada"
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-lg text-sm transition">
          <ShieldCheck size={14} className={verificandoEventos ? 'animate-pulse' : ''} />
          {verificandoEventos ? 'Verificando...' : 'Verificar cancelamentos'}
        </button>
        {ultimaConsulta && <span className="text-xs text-slate-500">Última consulta: {ultimaConsulta}</span>}
        <div className="flex-1" />
        <span className="text-xs text-slate-500">{servicos.length} NFS-e(s)</span>
      </div>

      {progressMsg && (
        <div className="px-6 py-2 bg-blue-900/30 border-b border-blue-800/50 text-blue-300 text-sm flex items-center gap-2 shrink-0">
          <RefreshCw size={14} className="animate-spin" /> {progressMsg}
        </div>
      )}

      {/* Aviso BHISS */}
      <div className="border-b border-slate-700/50 bg-slate-800/20 px-6 py-2 shrink-0 flex items-center gap-2">
        <AlertTriangle size={13} className="text-slate-500 shrink-0" />
        <span className="text-xs text-slate-500">
          <strong className="text-slate-400">BHISS (BH antigo):</strong> o webservice municipal retorna NFS-e emitidas pelo prestador, não recebidas como tomador.
          NFS-e tomadas de BH pré-2020 devem ser importadas manualmente via{' '}
          <span className="text-slate-400">fazenda.pbh.gov.br/nfse</span>.
          Dados BHISS já importados permanecem na lista.{' '}
          <strong className="text-amber-500">Ao filtrar por "Emitidas", use também "Fonte: ADN Nacional" para evitar duplicatas com o BHISS.</strong>
        </span>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-700 bg-slate-800/30 shrink-0 flex-wrap">
        <input className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-44"
          placeholder="Prestador..." value={filtros.prestador} onChange={e => setFiltros(f => ({ ...f, prestador: e.target.value }))} />
        <select className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          value={filtros.ano} onChange={e => setFiltros(f => ({ ...f, ano: e.target.value, competencia: '' }))}>
          <option value="">Ano: Todos</option>
          {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          value={filtros.status_pagamento} onChange={e => setFiltros(f => ({ ...f, status_pagamento: e.target.value }))}>
          <option value="todas">Pagamento: Todas</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </select>
        <select className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          value={filtros.fonte ?? 'todas'} onChange={e => setFiltros(f => ({ ...f, fonte: e.target.value }))}>
          <option value="todas">Fonte: Todas</option>
          <option value="adn">ADN Nacional</option>
          <option value="bhiss">BHISS (BH antigo)</option>
        </select>
        <select className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}>
          <option value="todas">Tipo: Todas</option>
          <option value="recebida">Recebidas</option>
          <option value="emitida">Emitidas</option>
        </select>
        <button onClick={() => setFiltros({ prestador: '', ano: '', competencia: '', status_pagamento: 'todas', fonte: 'todas', tipo: 'todas' })}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 border border-slate-600 rounded-lg transition">Limpar</button>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900 border-b border-slate-700">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide min-w-[280px]" style={{ resize: 'horizontal', overflow: 'hidden' }}>Prestador</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">CNPJ</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Nº NFS-e</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Competência</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Valor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Pagamento</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Ações</th>
            </tr>
          </thead>
          <tbody>
            {servicos.length === 0 && (
              <tr><td colSpan={8} className="text-center py-16 text-slate-500">{empresaId ? 'Nenhuma NFS-e encontrada' : 'Selecione uma empresa'}</td></tr>
            )}
            {servicos.map(s => (
              <tr key={s.id} className={`border-b border-slate-700/40 hover:bg-slate-800/50 transition ${s.cancelada ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${s.cancelada ? 'line-through text-slate-500' : 'text-slate-200'}`}>{s.prestador_nome || '-'}</span>
                    {!!s.cancelada && <span className="px-1.5 py-0.5 bg-red-900/60 text-red-400 text-xs rounded font-medium">Cancelada</span>}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-slate-400 text-xs">{s.prestador_cnpj || '-'}</td>
                <td className="px-4 py-3">
                  {s.tipo === 'emitida'
                    ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-violet-500/20 text-violet-300">Emitida</span>
                    : <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">Recebida</span>
                  }
                </td>
                <td className="px-4 py-3 font-mono text-slate-300">{s.numero || '-'}{s.serie ? `/${s.serie}` : ''}</td>
                <td className="px-4 py-3 text-slate-300">{fmtCompetencia(s.competencia)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${s.cancelada ? 'line-through text-slate-500' : 'text-green-400'}`}>{fmtBRL(s.valor_servicos)}</td>
                <td className="px-4 py-3">
                  {!s.cancelada && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.status_pagamento === 'pago' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                      {s.status_pagamento === 'pago' ? '✓ Pago' : 'Pendente'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setModalVisualizar(s)} title="Visualizar" className="p-1.5 text-slate-400 hover:text-blue-400 transition rounded"><Eye size={14} /></button>
                    <button onClick={() => imprimir(s)} title="Imprimir" className="p-1.5 text-slate-400 hover:text-slate-200 transition rounded"><Printer size={14} /></button>
                    {!s.cancelada && <button onClick={() => (api as any).nfse.servicos.togglePagamento(s.id).then(carregar)} title={s.status_pagamento === 'pago' ? 'Desfazer pagamento' : 'Marcar como pago'} className="p-1.5 text-slate-400 hover:text-green-400 transition rounded"><DollarSign size={14} /></button>}
                    <button onClick={() => { setModalEmail(s); setDestinatariosSel(destinatarios.map(d => d.id)) }}
                      title={s.email_enviado ? 'Reenviar e-mail' : 'Enviar e-mail'}
                      className={`p-1.5 transition rounded ${s.email_enviado ? 'text-green-400 hover:text-green-300' : 'text-blue-400 hover:text-blue-300'}`}>
                      <Mail size={14} />
                    </button>
                    {s.tipo !== 'emitida' && (
                      <button onClick={() => {
                        setModalExportar(s)
                        // Tenta pré-preencher empresa pelo CNPJ da empresa SEFAZ selecionada
                        const sefazEmp = empresas.find(e => e.id === empresaId)
                        const cnpjSefaz = (sefazEmp?.cnpj ?? '').replace(/\D/g, '')
                        const match = cnpjSefaz ? empresasNF.find(e => ((e as any).cnpj ?? '').replace(/\D/g, '') === cnpjSefaz) : null
                        setExportEmpresaId(match ? match.id : '')
                        setExportUnidadeId(''); setExportCcId('')
                      }}
                        title="Exportar para Controle de NF"
                        className="p-1.5 text-slate-400 hover:text-purple-400 transition rounded">
                        <ArrowUpRight size={14} />
                      </button>
                    )}
                    <button onClick={() => baixarXml(s)} title="Baixar XML" className="p-1.5 text-slate-400 hover:text-slate-200 transition rounded"><FileDown size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Visualizar */}
      {modalVisualizar && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setModalVisualizar(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-[520px] max-w-[95vw] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div id="print-nfse-area">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-slate-200">NFS-e Tomada</h2>
                <button onClick={() => setModalVisualizar(null)} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-4 text-sm space-y-2">
                {([
                  ['Prestador', <span className="font-medium text-slate-100">{modalVisualizar.prestador_nome || '-'}</span>],
                  ['CNPJ Prestador', <span className="font-mono text-slate-300">{modalVisualizar.prestador_cnpj || '-'}</span>],
                  ['Número NFS-e', <span className="font-mono text-slate-300">{modalVisualizar.numero || '-'}{modalVisualizar.serie ? `/${modalVisualizar.serie}` : ''}</span>],
                  ['Competência', <span className="text-slate-300">{fmtCompetencia(modalVisualizar.competencia)}</span>],
                  ['Valor Serviços', <span className="font-bold text-green-400 text-base">{fmtBRL(modalVisualizar.valor_servicos)}</span>],
                  ['Pagamento', <span className={`px-2 py-0.5 rounded text-xs font-medium ${modalVisualizar.status_pagamento === 'pago' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/40 text-red-400'}`}>{modalVisualizar.status_pagamento === 'pago' ? '✓ Pago' : 'Pendente'}</span>],
                  ['E-mail', <span className={modalVisualizar.email_enviado ? 'text-green-400' : 'text-slate-500'}>{modalVisualizar.email_enviado ? '✓ Enviado' : 'Não enviado'}</span>],
                  ...(modalVisualizar.cancelada ? [['Status', <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-900/60 text-red-400">Cancelada</span>]] : []),
                ] as [string, React.ReactNode][]).map(([label, value], i) => (
                  <div key={i} className="flex gap-3">
                    <span className="w-36 text-slate-500 shrink-0">{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
                {modalVisualizar.descricao && (
                  <div className="pt-2 border-t border-slate-700">
                    <div className="text-slate-500 text-xs mb-1">Discriminação</div>
                    <div className="text-xs text-slate-400 whitespace-pre-wrap max-h-32 overflow-y-auto">{modalVisualizar.descricao}</div>
                  </div>
                )}
                {modalVisualizar.chave_acesso && (
                  <div className="pt-2 border-t border-slate-700">
                    <div className="text-slate-500 text-xs mb-1">Chave de Acesso</div>
                    <div className="font-mono text-xs text-slate-400 break-all">{modalVisualizar.chave_acesso}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setModalVisualizar(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Fechar</button>
              <button onClick={() => { baixarXml(modalVisualizar); setModalVisualizar(null) }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition">
                <FileDown size={14} /> Baixar XML
              </button>
              <button onClick={() => { setModalEmail(modalVisualizar); setModalVisualizar(null); setDestinatariosSel(destinatarios.map(d => d.id)) }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition">
                <Mail size={14} /> Enviar E-mail
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition">
                <Printer size={14} /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação Reimportar */}
      {confirmReimportar && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setConfirmReimportar(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-[400px] max-w-[95vw] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex gap-4 items-start mb-5">
              <AlertTriangle size={28} className="text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-slate-200 mb-2">Reimportar todos?</div>
                <div className="text-sm text-slate-400 leading-relaxed">
                  Isso irá <span className="text-red-400 font-medium">apagar todos os registros</span> desta empresa (incluindo status de pagamento) e reimportar tudo do início. Esta ação não pode ser desfeita.
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmReimportar(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancelar</button>
              <button onClick={reimportar} className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition">
                <RotateCcw size={14} /> Confirmar reimportação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sucesso */}
      {modalSucesso && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setModalSucesso(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-[480px] max-w-[95vw] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex gap-4 items-start mb-5">
              <CheckCircle size={28} className="text-green-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-green-400 mb-3">
                  {modalSucesso.exportado ? 'NFS-e exportada!' : modalSucesso.reimport ? 'Reimportação concluída!' : 'Consulta NFS-e concluída!'}
                </div>
                <div className="text-sm text-slate-300 space-y-1.5">
                  {modalSucesso.exportado ? (
                    <div>✅ Nota exportada para <strong>Controle de NF</strong> com status <span className="text-slate-400">Pendente</span>. Acesse a aba para completar os dados.</div>
                  ) : (
                    <>
                      <div>📥 <strong>{modalSucesso.total}</strong> NFS-e(s) nova(s) importada(s)</div>
                      {modalSucesso.total === 0 && <div className="text-slate-500">Nenhuma NFS-e nova encontrada.</div>}
                      <div className="text-xs text-slate-500">
                        Páginas consultadas: {modalSucesso.paginas ?? '-'} | NSU final: {modalSucesso.ultimoNsu ?? '-'}
                      </div>
                    </>
                  )}
                </div>
                {!modalSucesso.exportado && modalSucesso.temMais && (
                  <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-xs text-yellow-300">
                    ⏳ Ainda há documentos pendentes. Consulte novamente para baixar mais.
                  </div>
                )}
                {modalSucesso.debugRaw && (
                  <div className="mt-3">
                    <div className="text-xs text-slate-500 mb-1">Resposta bruta da API (para diagnóstico):</div>
                    <pre className="text-xs text-slate-400 bg-slate-900 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40">{modalSucesso.debugRaw}</pre>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setModalSucesso(null)} className="px-5 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition">OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Verificar Eventos */}
      {modalEventos && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setModalEventos(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-[380px] max-w-[95vw] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex gap-4 items-start mb-5">
              <ShieldCheck size={28} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-blue-400 mb-2">Verificação concluída</div>
                <div className="text-sm text-slate-300 space-y-1">
                  <div>NFS-e verificadas: <strong>{modalEventos.verificadas}</strong></div>
                  <div>Canceladas encontradas: <strong className={modalEventos.canceladas > 0 ? 'text-red-400' : 'text-green-400'}>{modalEventos.canceladas}</strong></div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setModalEventos(null)} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition">OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Exportar para Controle de NF */}
      {modalExportar && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setModalExportar(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-[500px] max-w-[95vw] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                <ArrowUpRight size={16} className="text-purple-400" /> Exportar para Controle de NF
              </h2>
              <button onClick={() => setModalExportar(null)} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
            </div>

            {/* Resumo da NFS-e */}
            <div className="bg-slate-900/60 rounded-lg p-3 text-sm mb-5 space-y-1.5">
              <div className="flex gap-3"><span className="w-28 text-slate-500 shrink-0">Prestador</span><span className="text-slate-200 font-medium">{modalExportar.prestador_nome || '-'}</span></div>
              <div className="flex gap-3"><span className="w-28 text-slate-500 shrink-0">CNPJ</span><span className="font-mono text-slate-300 text-xs">{modalExportar.prestador_cnpj || '-'}</span></div>
              <div className="flex gap-3"><span className="w-28 text-slate-500 shrink-0">Nº NFS-e</span><span className="font-mono text-slate-300">{modalExportar.numero || '-'}</span></div>
              <div className="flex gap-3"><span className="w-28 text-slate-500 shrink-0">Competência</span><span className="text-slate-300">{fmtCompetencia(modalExportar.competencia)}</span></div>
              <div className="flex gap-3"><span className="w-28 text-slate-500 shrink-0">Valor</span><span className="font-bold text-green-400">{fmtBRL(modalExportar.valor_servicos)}</span></div>
            </div>

            {/* Seleção de empresa/unidade/centro de custo */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Empresa <span className="text-red-400">*</span></label>
                <SearchableSelect value={exportEmpresaId} onChange={setExportEmpresaId}
                  options={empresasNF.map(e => ({ value: e.id, label: e.nome }))}
                  placeholder="Selecione a empresa..." />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Unidade</label>
                <SearchableSelect value={exportUnidadeId} onChange={setExportUnidadeId}
                  options={unidadesNF.map(u => ({ value: u.id, label: u.nome }))}
                  placeholder="Selecione a unidade..." disabled={!exportEmpresaId} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Centro de Custo</label>
                <SearchableSelect value={exportCcId} onChange={setExportCcId}
                  options={ccNF.map(c => ({ value: c.id, label: `${c.codigo} — ${c.descricao}` }))}
                  placeholder="Selecione o centro de custo..." />
              </div>
            </div>

            <div className="text-xs text-slate-500 mb-4">O fornecedor será criado automaticamente se não existir. Status será <span className="text-slate-400">Pendente</span>.</div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setModalExportar(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancelar</button>
              <button onClick={exportarNF} disabled={exportando || !exportEmpresaId}
                className="flex items-center gap-2 px-5 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                <ArrowUpRight size={14} /> {exportando ? 'Exportando...' : 'Exportar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal E-mail */}
      {modalEmail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setModalEmail(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-[480px] max-w-[95vw] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-200">Enviar NFS-e por E-mail</h2>
              <button onClick={() => setModalEmail(null)} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
            </div>
            <div className="text-sm text-slate-400 mb-4 space-y-1">
              <div><span className="text-slate-500">Prestador:</span> <span className="text-slate-200">{modalEmail.prestador_nome || '-'}</span></div>
              <div><span className="text-slate-500">Competência:</span> <span className="text-slate-200">{fmtCompetencia(modalEmail.competencia)}</span></div>
              <div><span className="text-slate-500">Valor:</span> <span className="text-green-400 font-semibold">{fmtBRL(modalEmail.valor_servicos)}</span></div>
            </div>
            <div className="mb-5">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Destinatários</div>
              {destinatarios.length === 0 ? (
                <div className="text-sm text-slate-500">Nenhum destinatário cadastrado. Acesse Configurações → E-mail.</div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {destinatarios.map(d => (
                    <label key={d.id} className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={destinatariosSel.includes(d.id)}
                        onChange={e => setDestinatariosSel(prev => e.target.checked ? [...prev, d.id] : prev.filter(x => x !== d.id))}
                        className="w-4 h-4 rounded accent-blue-500" />
                      <span className="text-sm text-slate-300 group-hover:text-slate-100">{d.nome} <span className="text-slate-500 text-xs">({d.email})</span></span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModalEmail(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancelar</button>
              <button onClick={enviarEmail} disabled={enviandoEmail || destinatarios.length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                <Mail size={14} /> {enviandoEmail ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Erro */}
      {modalErro && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setModalErro(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-[420px] max-w-[95vw] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex gap-4 items-start mb-5">
              <AlertTriangle size={28} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-red-400 mb-2">{modalErro.titulo}</div>
                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{modalErro.detalhe}</div>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setModalErro(null)} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition">OK</button>
            </div>
          </div>
        </div>
      )}
      <style>{`@media print { body * { visibility: hidden; } #print-nfse-area, #print-nfse-area * { visibility: visible; } #print-nfse-area { position: fixed; inset: 0; padding: 40px; background: white; color: black; } }`}</style>
    </div>
  )
}
