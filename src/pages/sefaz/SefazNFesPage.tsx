import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, Eye, Printer, DollarSign, Mail, FileDown, X, CheckCircle, AlertTriangle, ArrowUpRight, ChevronDown } from 'lucide-react'
import { api } from '../../lib/api'

interface Empresa { id: number; nome: string; cnpj: string; pfx_b64?: string }
interface Nfe {
  id: number; empresa_id: number; chave_acesso: string; nsu: string
  nf_numero: string; nf_data: string; fornecedor_cnpj: string; fornecedor_nome: string
  valor_nota: number; status_pagamento: 'pendente' | 'pago'; data_pagamento?: string
  email_enviado: number; tipo_nfe: 'procNFe' | 'resNFe'; created_at: string
}
interface Destinatario { id: number; nome: string; email: string }
interface EmpresaNF { id: number; nome: string; cnpj?: string }
interface UnidadeNF { id: number; nome: string; empresa_id: number }
interface CentroCusto { id: number; codigo: string; descricao: string }

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (d: string) => d ? d.split('-').reverse().join('/') : '-'

function getTagXml(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<(?:[^:>]*:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]*:)?${tag}\\s*>`))
  return m?.[1]?.trim() ?? ''
}

// Select com busca embutida
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

function traduzirErro(msg: string): { titulo: string; detalhe: string } {
  const limpo = msg.replace(/Error invoking remote method '[^']+': /g, '').replace(/^Error: /, '')
  if (limpo.startsWith('SEFAZ_COOLDOWN:')) {
    const mins = limpo.split(':')[1] || '65'
    return { titulo: 'SEFAZ bloqueou temporariamente', detalhe: `O SEFAZ bloqueou por excesso de requisições. Aguarde ${mins} minuto(s) antes de tentar novamente.` }
  }
  if (limpo.startsWith('SEFAZ_LIMITE:')) return { titulo: 'Limite diário atingido', detalhe: 'Você atingiu o limite de 19 consultas hoje. Tente amanhã.' }
  if (limpo.includes('PKCS#12 MAC') || limpo.includes('Invalid password')) return { titulo: 'Senha do certificado incorreta', detalhe: 'Verifique a senha do .pfx cadastrado para esta empresa.' }
  if (limpo.includes('403') || limpo.includes('não autorizado')) return { titulo: 'Certificado não autorizado', detalhe: 'O certificado não tem permissão para este CNPJ.' }
  if (limpo.includes('Certificado digital não configurado')) return { titulo: 'Certificado não configurado', detalhe: 'Acesse Empresas SEFAZ e configure o arquivo .pfx.' }
  if (limpo.includes('ECONNREFUSED') || limpo.includes('ENOTFOUND')) return { titulo: 'Sem conexão com o SEFAZ', detalhe: 'Verifique sua conexão com a internet.' }
  if (limpo.startsWith('SEFAZ:')) return { titulo: 'Resposta do SEFAZ', detalhe: limpo.replace('SEFAZ: ', '') }
  return { titulo: 'Erro na consulta', detalhe: limpo }
}

export default function SefazNFesPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState<number | null>(null)
  const [nfes, setNfes] = useState<Nfe[]>([])
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([])
  const [consultando, setConsultando] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [ultimaConsulta, setUltimaConsulta] = useState('')
  const [filtros, setFiltros] = useState({ fornecedor: '', data_de: '', data_ate: '', status_pagamento: 'todas', email_enviado: 'todas' })

  // Modais
  const [modalErro, setModalErro] = useState<{ titulo: string; detalhe: string } | null>(null)
  const [modalSucesso, setModalSucesso] = useState<{ total: number; atualizadas: number; manifestados: number; errosManifestacao: number; temMais: boolean; exportado?: boolean } | null>(null)
  const [modalEmail, setModalEmail] = useState<Nfe | null>(null)
  const [modalVisualizar, setModalVisualizar] = useState<Nfe | null>(null)
  const [destinatariosSel, setDestinatariosSel] = useState<number[]>([])
  const [enviandoEmail, setEnviandoEmail] = useState(false)

  // Export
  const [modalExportar, setModalExportar] = useState<Nfe | null>(null)
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
    const unsub = api.sefaz.onProgress((msg: string) => setProgressMsg(msg))
    return unsub
  }, [])

  useEffect(() => {
    if (exportEmpresaId) {
      api.unidades.listByEmpresa(Number(exportEmpresaId)).then((u: UnidadeNF[]) => setUnidadesNF(u))
      setExportUnidadeId('')
    } else {
      setUnidadesNF([])
    }
  }, [exportEmpresaId])

  const carregar = useCallback(async () => {
    if (!empresaId) return
    const lista = await api.sefaz.nfes.list({ empresa_id: empresaId, ...filtros })
    setNfes(lista)
  }, [empresaId, filtros])

  useEffect(() => { carregar() }, [carregar])

  const consultar = async () => {
    if (!empresaId) return
    const emp = empresas.find(e => e.id === empresaId)
    if (!emp?.pfx_b64) return setModalErro({ titulo: 'Certificado não configurado', detalhe: 'Acesse Empresas SEFAZ e configure o .pfx para esta empresa.' })
    setConsultando(true); setProgressMsg('')
    try {
      const r = await api.sefaz.consultar(empresaId)
      setUltimaConsulta(new Date().toLocaleString('pt-BR'))
      setModalSucesso({ total: r.total, atualizadas: r.atualizadas, manifestados: r.manifestados, errosManifestacao: r.errosManifestacao, temMais: r.temMais })
      await carregar()
    } catch (e: any) {
      setModalErro(traduzirErro(e.message))
    } finally {
      setConsultando(false); setProgressMsg('')
    }
  }

  const baixarXml = async (nfe: Nfe) => {
    const xml = await api.sefaz.nfes.buscarXml(nfe.id)
    if (!xml) return
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `NFe_${nfe.nf_numero || nfe.chave_acesso.slice(0, 8)}.xml`
    a.click(); URL.revokeObjectURL(url)
  }

  const abrirExportar = async (nfe: Nfe) => {
    setModalExportar(nfe)
    setExportEmpresaId(''); setExportUnidadeId(''); setExportCcId('')
    // Tenta extrair CNPJ do destinatário do XML e pré-preencher empresa
    try {
      const xml = await api.sefaz.nfes.buscarXml(nfe.id)
      if (xml) {
        const destBlock = xml.match(/<dest[^>]*>([\s\S]*?)<\/dest>/)?.[1] ?? ''
        const cnpjDest = getTagXml(destBlock, 'CNPJ').replace(/\D/g, '')
        if (cnpjDest) {
          // Busca nas empresas do sistema principal
          const match = empresasNF.find(e => (e.cnpj ?? '').replace(/\D/g, '') === cnpjDest)
          if (match) setExportEmpresaId(match.id)
        }
      }
    } catch { /* sem XML ainda — ignora */ }
  }

  const exportarNF = async () => {
    if (!modalExportar || !exportEmpresaId) return
    setExportando(true)
    try {
      await api.sefaz.nfes.exportarNF({
        nfe: modalExportar as unknown as Record<string, unknown>,
        empresaId: Number(exportEmpresaId),
        unidadeId: exportUnidadeId ? Number(exportUnidadeId) : null,
        centroCustoId: exportCcId ? Number(exportCcId) : null,
      })
      setModalExportar(null)
      setExportEmpresaId(''); setExportUnidadeId(''); setExportCcId('')
      setModalSucesso({ total: 0, atualizadas: 0, manifestados: 0, errosManifestacao: 0, temMais: false, exportado: true })
    } catch (e: any) {
      setModalErro({ titulo: 'Erro ao exportar', detalhe: e.message.replace(/Error invoking remote method '[^']+': /g, '').replace(/^Error: /, '') })
    } finally {
      setExportando(false)
    }
  }

  const enviarEmail = async () => {
    if (!modalEmail) return
    const selecionados = destinatarios.filter(d => destinatariosSel.includes(d.id)).map(d => d.email)
    if (selecionados.length === 0) return setModalErro({ titulo: 'Nenhum destinatário', detalhe: 'Selecione ao menos um destinatário.' })
    const empresa = empresas.find(e => e.id === modalEmail.empresa_id)
    setEnviandoEmail(true)
    try {
      const xml = await api.sefaz.nfes.buscarXml(modalEmail.id)
      await api.sefaz.email.enviar({
        destinatarios: selecionados,
        empresaNome: empresa?.nome || '',
        fornecedorNome: modalEmail.fornecedor_nome,
        fornecedorCnpj: modalEmail.fornecedor_cnpj,
        nfNumero: modalEmail.nf_numero,
        valorNota: modalEmail.valor_nota,
        nfData: modalEmail.nf_data,
        statusPagamento: modalEmail.status_pagamento,
        chaveAcesso: modalEmail.chave_acesso,
        xmlBlob: xml || null,
      })
      await api.sefaz.nfes.marcarEmailEnviado(modalEmail.id)
      setModalEmail(null); await carregar()
    } catch (e: any) {
      setModalErro({ titulo: 'Erro ao enviar e-mail', detalhe: e.message.replace(/Error invoking remote method '[^']+': /g, '').replace(/^Error: /, '') })
    } finally {
      setEnviandoEmail(false)
    }
  }

  const imprimirNfe = (nfe: Nfe) => { setModalVisualizar(nfe); setTimeout(() => window.print(), 300) }

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
          {consultando ? 'Consultando...' : 'Consultar SEFAZ'}
        </button>
        {ultimaConsulta && <span className="text-xs text-slate-500">Última consulta: {ultimaConsulta}</span>}
        <div className="flex-1" />
        <span className="text-xs text-slate-500">{nfes.length} NF-e(s)</span>
      </div>

      {progressMsg && (
        <div className="px-6 py-2 bg-blue-900/30 border-b border-blue-800/50 text-blue-300 text-sm flex items-center gap-2 shrink-0">
          <RefreshCw size={14} className="animate-spin" /> {progressMsg}
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-700 bg-slate-800/30 shrink-0 flex-wrap">
        <input className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-44"
          placeholder="Fornecedor..." value={filtros.fornecedor} onChange={e => setFiltros(f => ({ ...f, fornecedor: e.target.value }))} />
        <input type="date" className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          value={filtros.data_de} onChange={e => setFiltros(f => ({ ...f, data_de: e.target.value }))} title="Data de" />
        <input type="date" className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          value={filtros.data_ate} onChange={e => setFiltros(f => ({ ...f, data_ate: e.target.value }))} title="Data até" />
        <select className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          value={filtros.status_pagamento} onChange={e => setFiltros(f => ({ ...f, status_pagamento: e.target.value }))}>
          <option value="todas">Pagamento: Todas</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </select>
        <select className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          value={filtros.email_enviado} onChange={e => setFiltros(f => ({ ...f, email_enviado: e.target.value }))}>
          <option value="todas">E-mail: Todas</option>
          <option value="enviadas">Enviadas</option>
          <option value="nao_enviadas">Não enviadas</option>
        </select>
        <button onClick={() => setFiltros({ fornecedor: '', data_de: '', data_ate: '', status_pagamento: 'todas', email_enviado: 'todas' })}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 border border-slate-600 rounded-lg transition">Limpar</button>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900 border-b border-slate-700">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Fornecedor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">CNPJ</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Nº NF</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Valor</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Data</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Pagamento</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Ações</th>
            </tr>
          </thead>
          <tbody>
            {nfes.length === 0 && (
              <tr><td colSpan={7} className="text-center py-16 text-slate-500">{empresaId ? 'Nenhuma NF-e encontrada' : 'Selecione uma empresa'}</td></tr>
            )}
            {nfes.map(nfe => (
              <tr key={nfe.id} className="border-b border-slate-700/40 hover:bg-slate-800/50 transition">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-200 max-w-[200px] truncate">{nfe.fornecedor_nome || '-'}</div>
                  {nfe.tipo_nfe === 'resNFe' && <div className="text-xs text-yellow-500 mt-0.5">⏳ Aguardando XML completo</div>}
                </td>
                <td className="px-4 py-3 font-mono text-slate-400 text-xs">{nfe.fornecedor_cnpj || '-'}</td>
                <td className="px-4 py-3 font-mono text-slate-300">{nfe.nf_numero || '-'}</td>
                <td className="px-4 py-3 text-right font-semibold text-green-400">{fmtBRL(nfe.valor_nota)}</td>
                <td className="px-4 py-3 text-slate-300">{fmtData(nfe.nf_data)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${nfe.status_pagamento === 'pago' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                    {nfe.status_pagamento === 'pago' ? '✓ Paga' : 'Pendente'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setModalVisualizar(nfe)} title="Visualizar" className="p-1.5 text-slate-400 hover:text-blue-400 transition rounded"><Eye size={14} /></button>
                    <button onClick={() => imprimirNfe(nfe)} title="Imprimir" className="p-1.5 text-slate-400 hover:text-slate-200 transition rounded"><Printer size={14} /></button>
                    <button onClick={() => api.sefaz.nfes.togglePagamento(nfe.id).then(carregar)} title={nfe.status_pagamento === 'pago' ? 'Desfazer pagamento' : 'Marcar como paga'} className="p-1.5 text-slate-400 hover:text-green-400 transition rounded"><DollarSign size={14} /></button>
                    <button onClick={() => { setModalEmail(nfe); setDestinatariosSel(destinatarios.map(d => d.id)) }} title={nfe.email_enviado ? 'Reenviar e-mail' : 'Enviar e-mail'}
                      className={`p-1.5 transition rounded ${nfe.email_enviado ? 'text-green-400 hover:text-green-300' : 'text-blue-400 hover:text-blue-300'}`}>
                      <Mail size={14} />
                    </button>
                    <button onClick={() => abrirExportar(nfe)} title="Exportar para Controle de NF"
                      className="p-1.5 text-slate-400 hover:text-purple-400 transition rounded">
                      <ArrowUpRight size={14} />
                    </button>
                    <button onClick={() => baixarXml(nfe)} title="Baixar XML" className="p-1.5 text-slate-400 hover:text-slate-200 transition rounded"><FileDown size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
            <div className="bg-slate-900/60 rounded-lg p-3 text-sm mb-5 space-y-1.5">
              <div className="flex gap-3"><span className="w-28 text-slate-500 shrink-0">Fornecedor</span><span className="text-slate-200 font-medium">{modalExportar.fornecedor_nome || '-'}</span></div>
              <div className="flex gap-3"><span className="w-28 text-slate-500 shrink-0">CNPJ</span><span className="font-mono text-slate-300 text-xs">{modalExportar.fornecedor_cnpj || '-'}</span></div>
              <div className="flex gap-3"><span className="w-28 text-slate-500 shrink-0">Nº NF-e</span><span className="font-mono text-slate-300">{modalExportar.nf_numero || '-'}</span></div>
              <div className="flex gap-3"><span className="w-28 text-slate-500 shrink-0">Data</span><span className="text-slate-300">{fmtData(modalExportar.nf_data)}</span></div>
              <div className="flex gap-3"><span className="w-28 text-slate-500 shrink-0">Valor</span><span className="font-bold text-green-400">{fmtBRL(modalExportar.valor_nota)}</span></div>
            </div>
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

      {/* Modal Visualizar */}
      {modalVisualizar && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setModalVisualizar(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-[520px] max-w-[95vw] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div id="print-nfe-area">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-slate-200">NF-e Recebida</h2>
                <button onClick={() => setModalVisualizar(null)} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-4 text-sm space-y-2">
                {[
                  ['Fornecedor', <span className="font-medium text-slate-100">{modalVisualizar.fornecedor_nome || '-'}</span>],
                  ['CNPJ', <span className="font-mono text-slate-300">{modalVisualizar.fornecedor_cnpj || '-'}</span>],
                  ['Número NF', <span className="font-mono text-slate-300">{modalVisualizar.nf_numero || '-'}</span>],
                  ['Data Emissão', <span className="text-slate-300">{fmtData(modalVisualizar.nf_data)}</span>],
                  ['Valor Total', <span className="font-bold text-green-400 text-base">{fmtBRL(modalVisualizar.valor_nota)}</span>],
                  ['Pagamento', <span className={`px-2 py-0.5 rounded text-xs font-medium ${modalVisualizar.status_pagamento === 'pago' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/40 text-red-400'}`}>{modalVisualizar.status_pagamento === 'pago' ? '✓ Paga' : 'Pendente'}</span>],
                  ['E-mail Enviado', <span className={modalVisualizar.email_enviado ? 'text-green-400' : 'text-slate-500'}>{modalVisualizar.email_enviado ? '✓ Sim' : 'Não'}</span>],
                  ['Tipo', modalVisualizar.tipo_nfe === 'procNFe' ? <span className="text-green-400 text-xs">✓ XML Completo</span> : <span className="text-yellow-400 text-xs">⏳ Resumo — aguardando XML</span>],
                ].map(([label, value], i) => (
                  <div key={i} className="flex gap-3">
                    <span className="w-32 text-slate-500 shrink-0">{label as string}</span>
                    <span>{value as React.ReactNode}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-700">
                  <div className="text-slate-500 text-xs mb-1">Chave de Acesso</div>
                  <div className="font-mono text-xs text-slate-400 break-all">{modalVisualizar.chave_acesso}</div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setModalVisualizar(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Fechar</button>
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

      {/* Modal E-mail */}
      {modalEmail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setModalEmail(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-[480px] max-w-[95vw] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-200">Enviar NF-e por E-mail</h2>
              <button onClick={() => setModalEmail(null)} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-4 text-sm mb-4 space-y-1">
              <div className="font-medium text-slate-200">{modalEmail.fornecedor_nome}</div>
              <div className="text-slate-400 text-xs">{modalEmail.fornecedor_cnpj}</div>
              <div className="flex gap-4 mt-2 text-slate-300">
                <span>NF {modalEmail.nf_numero || '-'}</span>
                <span>{fmtData(modalEmail.nf_data)}</span>
                <span className="font-semibold text-green-400">{fmtBRL(modalEmail.valor_nota)}</span>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-slate-400 mb-2">Destinatários</label>
              {destinatarios.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum destinatário cadastrado. Acesse a aba Destinatários.</p>
              ) : (
                <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 max-h-36 overflow-y-auto space-y-2">
                  {destinatarios.map(d => (
                    <label key={d.id} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={destinatariosSel.includes(d.id)}
                        onChange={e => setDestinatariosSel(prev => e.target.checked ? [...prev, d.id] : prev.filter(x => x !== d.id))}
                        className="rounded" />
                      <span className="text-sm text-slate-300">{d.nome}</span>
                      <span className="text-xs text-slate-500">{d.email}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModalEmail(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancelar</button>
              <button onClick={enviarEmail} disabled={enviandoEmail}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                <Mail size={14} /> {enviandoEmail ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sucesso */}
      {modalSucesso && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setModalSucesso(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-[400px] max-w-[95vw] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex gap-4 items-start mb-5">
              <CheckCircle size={28} className="text-green-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-green-400 mb-3">{modalSucesso.exportado ? 'NF-e exportada!' : 'Consulta SEFAZ concluída!'}</div>
                <div className="text-sm text-slate-300 space-y-1.5">
                  {modalSucesso.exportado ? (
                    <div>✅ Nota exportada para <strong>Controle de NF</strong> com status <span className="text-slate-400">Pendente</span>. Acesse a aba para completar os dados.</div>
                  ) : (
                    <>
                      <div>📥 <strong>{modalSucesso.total}</strong> NF-e(s) nova(s) importada(s)</div>
                      {modalSucesso.atualizadas > 0 && <div>🔄 <strong>{modalSucesso.atualizadas}</strong> resumo(s) com XML completo</div>}
                      {modalSucesso.manifestados > 0 && <div>📋 <strong>{modalSucesso.manifestados}</strong> ciência(s) manifestada(s)</div>}
                      {modalSucesso.errosManifestacao > 0 && <div className="text-red-400">⚠️ <strong>{modalSucesso.errosManifestacao}</strong> erro(s) na manifestação</div>}
                      {modalSucesso.total === 0 && !modalSucesso.temMais && <div className="text-slate-500">Nenhuma NF-e nova encontrada.</div>}
                    </>
                  )}
                </div>
                {!modalSucesso.exportado && modalSucesso.temMais && (
                  <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-xs text-yellow-300">
                    ⏳ Ainda há documentos pendentes no SEFAZ. Consulte novamente para baixar mais.
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

      <style>{`@media print { body * { visibility: hidden; } #print-nfe-area, #print-nfe-area * { visibility: visible; } #print-nfe-area { position: fixed; inset: 0; padding: 40px; background: white; color: black; } }`}</style>
    </div>
  )
}
