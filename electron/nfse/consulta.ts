import https from 'https'
import zlib from 'zlib'
import type { SefazEmpresa } from '../database/queries/sefaz'

export interface NfseConsultada {
  chave_acesso: string
  nsu: string
  numero: string
  serie: string
  competencia: string    // 'YYYY-MM'
  prestador_cnpj: string
  prestador_nome: string
  valor_servicos: number
  descricao: string
  xml: string
}

const BASE_PROD = 'https://adn.nfse.gov.br'
const BASE_HOMOLOG = 'https://adn.producaorestrita.nfse.gov.br'

// Helper para extrair conteúdo de uma tag XML (com ou sem namespace)
// Usa negative lookahead para evitar que 'vServ' case com 'vServPrest'
function getTag(xml: string, tag: string): string {
  const re = new RegExp(`<(?:[^:>]*:)?${tag}(?![A-Za-z0-9_])[^>]*>([\\s\\S]*?)<\\/(?:[^:>]*:)?${tag}(?![A-Za-z0-9_])\\s*>`)
  return xml.match(re)?.[1]?.trim() ?? ''
}

// Extrai o primeiro bloco delimitado por uma tag
function getBlock(xml: string, tag: string): string {
  const re = new RegExp(`<(?:[^:>]*:)?${tag}(?![A-Za-z0-9_])[^>]*>([\\s\\S]*?)<\\/(?:[^:>]*:)?${tag}(?![A-Za-z0-9_])\\s*>`)
  return xml.match(re)?.[1]?.trim() ?? ''
}

function extrairDadosNfse(xml: string, chaveJson: string, nsuStr: string): NfseConsultada | null {
  try {
    // Chave de acesso: usa a do JSON (mais confiável) ou tenta do XML
    const chave = chaveJson || getTag(xml, 'chNFSe') || getTag(xml, 'Id')

    // Número e série
    const numero = getTag(xml, 'cNFSe') || getTag(xml, 'nNFSe') || getTag(xml, 'nDPS') || ''
    const serie  = getTag(xml, 'serie') || ''

    // Competência: NFS-e nacional usa <dCompet>; fallback dhEmi/dhProc
    let competencia = ''
    const compRaw = getTag(xml, 'dCompet') || getTag(xml, 'competencia') || getTag(xml, 'dhEmi') || getTag(xml, 'dhProc') || ''
    if (compRaw) {
      // Formato pode ser YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS ou YYYY-MM
      competencia = compRaw.slice(0, 7)
    }

    // Prestador: no XML nacional, <emit> está em <infNFSe>; dentro de <DPS> há <prest>
    // Prioridade: <emit> (direto em infNFSe) > <prest> (dentro de DPS) > fallback xml completo
    const emitBlock = getBlock(xml, 'emit')
    const prestBlock = emitBlock || getBlock(xml, 'prest') || getBlock(xml, 'prestador') || xml
    const prestadorCnpj = getTag(prestBlock, 'CNPJ') || getTag(xml, 'CNPJ') || ''
    const prestadorNome = getTag(prestBlock, 'xNome') || getTag(prestBlock, 'nome') || getTag(xml, 'xNome') || ''

    // Valor: NFS-e nacional usa <vServ> dentro de <vServPrest>
    // O regex com negative lookahead já garante que 'vServ' não case com 'vServPrest'
    const valorStr =
      getTag(xml, 'vServ') ||
      getTag(xml, 'vServico') ||
      getTag(xml, 'vLiq') ||
      getTag(xml, 'vBC') ||
      '0'
    const valor = parseFloat(valorStr.replace(',', '.')) || 0

    // Discriminação: NFS-e nacional usa <xDescServ>
    const descricao = getTag(xml, 'xDescServ') || getTag(xml, 'xDiscriminacao') || getTag(xml, 'discriminacao') || getTag(xml, 'descricao') || ''

    return {
      chave_acesso: chave,
      nsu: nsuStr,
      numero,
      serie,
      competencia,
      prestador_cnpj: prestadorCnpj,
      prestador_nome: prestadorNome,
      valor_servicos: valor,
      descricao: descricao.slice(0, 2000),
      xml,
    }
  } catch {
    return null
  }
}

function httpsGet(url: string, agent: https.Agent): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8')
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`ADN HTTP ${res.statusCode}: ${body.slice(0, 300)}`))
        } else {
          resolve(body)
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout na conexão com ADN NFS-e')) })
  })
}

export async function consultarNfse(
  empresa: SefazEmpresa & { ultimo_nsu_nfse?: string },
  onProgress?: (msg: string) => void
): Promise<{ servicos: NfseConsultada[]; ultimoNsu: string; temMais: boolean; debugRaw?: string; paginas: number }> {
  if (!empresa.pfx_b64 || !empresa.pfx_senha) {
    throw new Error('Certificado digital não configurado para esta empresa.')
  }

  const base = empresa.ambiente === 'producao' ? BASE_PROD : BASE_HOMOLOG
  const agent = new https.Agent({
    pfx: Buffer.from(empresa.pfx_b64, 'base64'),
    passphrase: empresa.pfx_senha,
  })

  let ultimoNsu = empresa.ultimo_nsu_nfse ?? '0'
  const servicos: NfseConsultada[] = []
  let temMais = false
  let debugRaw = ''
  let paginasFeitas = 0
  const MAX_PAGINAS = 100

  const cnpj = empresa.cnpj.replace(/\D/g, '')
  onProgress?.(`Consultando NFS-e a partir do NSU ${ultimoNsu}...`)

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const url = `${base}/contribuintes/DFe/${ultimoNsu}?cnpjConsulta=${cnpj}`

    let resposta: Record<string, unknown>
    try {
      const body = await httpsGet(url, agent)
      try {
        resposta = JSON.parse(body)
      } catch {
        // Resposta não é JSON — lança com o conteúdo bruto para diagnóstico
        throw new Error(`ADN retornou resposta inválida (não-JSON): ${body.slice(0, 500)}`)
      }
    } catch (e: any) {
      const msg: string = e.message ?? ''
      // ADN retorna 404 quando não há docs a partir do NSU — é fim normal, não erro
      if (msg.includes('404') && (msg.includes('NENHUM_DOCUMENTO_LOCALIZADO') || msg.includes('E2220') || msg.includes('DADOS_NAO_ENCONTRADOS'))) {
        temMais = false
        break
      }
      if (pagina === 0) throw e
      break
    }

    // Campos reais da API ADN Nacional NFS-e (confirmados via resposta real)
    // StatusProcessamento: "DOCUMENTOS_LOCALIZADOS" | "DADOS_NAO_ENCONTRADOS"
    // LoteDFe: array de documentos
    // Cada doc: NSU (number), ChaveAcesso, TipoDocumento ("NFSE"|"CTE"|...), ArquivoXml (base64+gzip)
    const status = String(resposta.StatusProcessamento ?? '')
    const docs: unknown[] = (resposta.LoteDFe ?? resposta.nfses ?? resposta.documentos ?? []) as unknown[]

    if (docs.length === 0 || status === 'DADOS_NAO_ENCONTRADOS') {
      temMais = false
      debugRaw = JSON.stringify(resposta).slice(0, 800)
      // Verifica se a API indica um NSU máximo global — se sim, pula para lá
      // (o ADN, assim como o SEFAZ, tem NSU global; pode haver docs do nosso CNPJ em NSUs muito maiores)
      const maxNsuApi = Number(resposta.MaxNSU ?? resposta.maxNSU ?? resposta.UltimoNSU ?? resposta.ultimoNSU ?? 0)
      if (maxNsuApi > 0 && maxNsuApi > Number(ultimoNsu)) {
        onProgress?.(`Sem docs no NSU ${ultimoNsu} — pulando para MaxNSU ${maxNsuApi}...`)
        ultimoNsu = String(maxNsuApi)
        temMais = true
        continue
      }
      break
    }

    paginasFeitas = pagina + 1
    onProgress?.(`Página ${paginasFeitas} | NSU ${ultimoNsu} | ${docs.length} doc(s)...`)

    let maxNsuPagina = Number(ultimoNsu) || 0

    for (const doc of docs as Record<string, unknown>[]) {
      const nsuDoc = Number(doc.NSU ?? doc.nsu ?? 0)
      // Atualiza NSU para TODOS os tipos de documento, não só NFSE
      if (nsuDoc > maxNsuPagina) maxNsuPagina = nsuDoc

      // Filtra: só processa NFS-e (ignora CT-e, eventos, etc.)
      const tipo = String(doc.TipoDocumento ?? doc.tipoDocumento ?? 'NFSE')
      if (!tipo.toUpperCase().includes('NFSE')) continue

      const chaveAcesso = String(doc.ChaveAcesso ?? doc.chaveAcesso ?? doc.chNFSe ?? '')

      // Decodifica XML: base64 + gzip (ArquivoXml começa com "H4sI")
      let xml = ''
      const arquivoXml = doc.ArquivoXml ?? doc.xmlGzip ?? doc.xml ?? ''
      if (arquivoXml) {
        try {
          const buf = Buffer.from(String(arquivoXml), 'base64')
          try { xml = zlib.gunzipSync(buf).toString('utf8') }
          catch { xml = buf.toString('utf8') }
        } catch { /* documento corrompido — ignora */ }
      }

      if (!xml && !chaveAcesso) continue

      const nfse = extrairDadosNfse(xml, chaveAcesso, String(nsuDoc))
      if (nfse) servicos.push(nfse)
    }

    // Avança NSU: usa maxNSU + 1 para garantir avanço estrito (API usa NSU >= ultNSU, não >)
    const proximoNsu = String(maxNsuPagina + 1)
    temMais = status === 'DOCUMENTOS_LOCALIZADOS'

    if (maxNsuPagina > 0 && proximoNsu !== ultimoNsu) {
      ultimoNsu = proximoNsu
    } else {
      break
    }

    if (!temMais) break
  }

  onProgress?.(`Consulta finalizada: ${servicos.length} NFS-e(s) | NSU final: ${ultimoNsu} | ${paginasFeitas} página(s)`)
  return { servicos, ultimoNsu, temMais, debugRaw, paginas: paginasFeitas }
}

// Verifica eventos (cancelamento/substituição) de uma NFS-e via chave de acesso
// Retorna true se há evento de cancelamento
export async function verificarEventosNfse(
  empresa: SefazEmpresa,
  chaveAcesso: string
): Promise<boolean> {
  if (!empresa.pfx_b64 || !empresa.pfx_senha) return false
  // Chave deve ter exatamente 44 dígitos numéricos (notas BHISS com formato 'bhiss-...' são puladas)
  if (!/^\d{44}$/.test(chaveAcesso)) return false

  const base = empresa.ambiente === 'producao' ? BASE_PROD : BASE_HOMOLOG
  const agent = new https.Agent({
    pfx: Buffer.from(empresa.pfx_b64, 'base64'),
    passphrase: empresa.pfx_senha,
  })

  try {
    const url = `${base}/contribuintes/NFSe/${chaveAcesso}/Eventos`
    const body = await httpsGet(url, agent)
    const resposta = JSON.parse(body)
    // Procura evento de cancelamento no array retornado
    const eventos: unknown[] = Array.isArray(resposta) ? resposta : (resposta.eventos ?? resposta.Eventos ?? [])
    return eventos.some((e: any) => {
      const tipo = String(e.tpEvento ?? e.tipo ?? e.TipoEvento ?? '').toUpperCase()
      return tipo.includes('CANCEL') || tipo === '601' || tipo === '602'
    })
  } catch {
    return false
  }
}
