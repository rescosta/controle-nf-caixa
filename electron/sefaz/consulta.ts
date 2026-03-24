import { SefazEmpresa } from '../database/queries/sefaz'

export interface NfeConsultada {
  chave_acesso: string
  nsu: string
  nf_numero: string
  nf_data: string
  fornecedor_cnpj: string
  fornecedor_nome: string
  valor_nota: number
  xml: string
  tipo_nfe: 'procNFe' | 'resNFe'
}

export interface ResultadoConsulta {
  nfes: NfeConsultada[]
  ultimoNsu: string
  maxNsu: string
  temMais: boolean
  chavesResNfe: string[]
  cStat656: boolean
}

function extrairDadosNfe(json: any, xml: string, nsu: string): NfeConsultada | null {
  try {
    const infNFe = json?.nfeProc?.NFe?.infNFe || json?.NFe?.infNFe
    if (infNFe) {
      const chave = (infNFe['@_Id'] || infNFe.Id || '').replace('NFe', '')
      return {
        chave_acesso: chave,
        nsu,
        nf_numero: String(infNFe.ide?.nNF || ''),
        nf_data: String(infNFe.ide?.dhEmi || infNFe.ide?.dEmi || '').substring(0, 10),
        fornecedor_cnpj: String(infNFe.emit?.CNPJ || ''),
        fornecedor_nome: String(infNFe.emit?.xFant || infNFe.emit?.xNome || ''),
        valor_nota: Number(infNFe.total?.ICMSTot?.vNF || 0),
        xml,
        tipo_nfe: 'procNFe',
      }
    }

    const res = json?.resNFe
    if (res) {
      return {
        chave_acesso: String(res.chNFe || ''),
        nsu,
        nf_numero: '',
        nf_data: String(res.dhEmi || '').substring(0, 10),
        fornecedor_cnpj: String(res.CNPJ || res.CPF || ''),
        fornecedor_nome: String(res.xNome || ''),
        valor_nota: Number(res.vNF || 0),
        xml,
        tipo_nfe: 'resNFe',
      }
    }

    return null
  } catch {
    return null
  }
}

export async function consultarSefaz(
  empresa: SefazEmpresa,
  onProgress?: (msg: string) => void
): Promise<ResultadoConsulta> {
  const { DistribuicaoNFe } = require('@vexta-systems/node-mde')

  if (!empresa.pfx_b64 || !empresa.pfx_senha) {
    throw new Error('Certificado digital não configurado para esta empresa.')
  }
  if (!empresa.uf) {
    throw new Error('UF não configurada para esta empresa.')
  }

  const pfxBuffer = Buffer.from(empresa.pfx_b64, 'base64')
  const tpAmb = empresa.ambiente === 'producao' ? '1' : '2'

  const dist = new DistribuicaoNFe({
    pfx: pfxBuffer,
    passphrase: empresa.pfx_senha,
    cUFAutor: empresa.uf as any,
    cnpj: empresa.cnpj.replace(/\D/g, ''),
    tpAmb,
  })

  onProgress?.(`Consultando SEFAZ a partir do NSU ${empresa.ultimo_nsu}...`)

  const resultado = await dist.consultaUltNSU(empresa.ultimo_nsu)

  if (resultado.error) {
    if (resultado.status && resultado.status !== 200) {
      throw new Error(
        `SEFAZ: Erro HTTP ${resultado.status} — Certificado não autorizado ou CNPJ não corresponde ao certificado.`
      )
    }
    const xMotivo =
      resultado.error?.json?.retDistDFeInt?.xMotivo ||
      resultado.error?.json?.fault?.faultstring ||
      'Erro desconhecido. Verifique o certificado e o CNPJ.'
    throw new Error(`SEFAZ: ${xMotivo}`)
  }

  const data = resultado.data
  const ultimoNsu = String(data?.ultNSU || empresa.ultimo_nsu).padStart(15, '0')
  const maxNsu = String(data?.maxNSU || ultimoNsu).padStart(15, '0')
  const cStat = String(data?.cStat || '')

  if (cStat === '656') {
    return { nfes: [], ultimoNsu, maxNsu, temMais: false, chavesResNfe: [], cStat656: true }
  }

  if (!data?.docZip || cStat === '137') {
    onProgress?.('Nenhuma NF-e nova encontrada.')
    return { nfes: [], ultimoNsu, maxNsu, temMais: false, chavesResNfe: [], cStat656: false }
  }

  const temMais = maxNsu > ultimoNsu
  if (temMais) {
    onProgress?.(`NSU ${ultimoNsu} de ${maxNsu} — há mais documentos. Consulte novamente.`)
  }

  const lista = Array.isArray(data.docZip) ? data.docZip : [data.docZip]
  const nfes: NfeConsultada[] = []
  const chavesResNfe: string[] = []

  for (const doc of lista) {
    const nsuDoc = String(doc.nsu || '')
    if (!nsuDoc) continue
    const schema = doc.schema || ''
    if (!schema.includes('NFe') && !schema.includes('nfe')) continue

    const nfe = extrairDadosNfe(doc.json, doc.xml || '', nsuDoc)
    if (!nfe?.chave_acesso) continue

    nfes.push(nfe)
    if (nfe.tipo_nfe === 'resNFe') chavesResNfe.push(nfe.chave_acesso)
  }

  onProgress?.(`Consulta: ${nfes.length} NF-e(s) | ${chavesResNfe.length} resumo(s) para manifestar.`)
  return { nfes, ultimoNsu, maxNsu, temMais, chavesResNfe, cStat656: false }
}
