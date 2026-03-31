import https from 'https'
import type { SefazEmpresa } from '../database/queries/sefaz'

export interface BhissNfse {
  chave_acesso: string
  numero: string
  competencia: string       // 'YYYY-MM'
  prestador_cnpj: string
  prestador_nome: string
  valor_servicos: number
  descricao: string
  xml: string
}

const BHISS_URL = 'https://bhissdigitalws.pbh.gov.br/bhiss-ws/nfse'

function getTag(xml: string, tag: string): string {
  const re = new RegExp(`<(?:[^:>]*:)?${tag}(?![A-Za-z0-9_])[^>]*>([\\s\\S]*?)<\\/(?:[^:>]*:)?${tag}(?![A-Za-z0-9_])\\s*>`)
  const m = xml.match(re)
  if (!m) return ''
  return m[1].trim()
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

function getAllBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[^:>]*:)?${tag}(?![A-Za-z0-9_])[^>]*>[\\s\\S]*?<\\/(?:[^:>]*:)?${tag}(?![A-Za-z0-9_])\\s*>`, 'g')
  return xml.match(re) ?? []
}

// Cabecalho com namespace do serviço BH
const CABECALHO = `<cabecalho versao="1.00" xmlns="http://www.abrasf.org.br/nfse.xsd"><versaoDados>1.00</versaoDados></cabecalho>`

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildEnvelope(cnpj: string, dataInicial: string, dataFinal: string, pagina: number): string {
  const dados = `<ConsultarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd"><Prestador><Cnpj></Cnpj></Prestador><Tomador><CpfCnpj><Cnpj>${cnpj}</Cnpj></CpfCnpj></Tomador><PeriodoEmissao><DataInicial>${dataInicial}</DataInicial><DataFinal>${dataFinal}</DataFinal></PeriodoEmissao><Pagina>${pagina}</Pagina></ConsultarNfseEnvio>`

  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.bhiss.pbh.gov.br"><soap:Header/><soap:Body><ws:ConsultarNfseRequest><nfseCabecMsg>${xmlEscape(CABECALHO)}</nfseCabecMsg><nfseDadosMsg>${xmlEscape(dados)}</nfseDadosMsg></ws:ConsultarNfseRequest></soap:Body></soap:Envelope>`
}

function httpsPost(agent: https.Agent, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(BHISS_URL)
    const req = https.request({
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      agent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(body, 'utf8'),
        'SOAPAction': '"http://ws.bhiss.pbh.gov.br/ConsultarNfse"',
      },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`BHISS HTTP ${res.statusCode}: ${text.slice(0, 400)}`))
        } else {
          resolve(text)
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout na conexão com BHISS')) })
    req.write(body)
    req.end()
  })
}

function parsePagina(soapXml: string): BhissNfse[] {
  // Extrai o outputXML da resposta SOAP
  const outputXml = getTag(soapXml, 'outputXML')
  if (!outputXml) {
    // Verifica se é um erro SOAP
    const fault = getTag(soapXml, 'faultstring')
    if (fault) throw new Error(`BHISS SOAP Fault: ${fault}`)
    return []
  }

  // Verifica erros dentro do outputXML
  const msgRetorno = getTag(outputXml, 'ListaMensagemRetorno') || getTag(outputXml, 'MensagemRetorno')
  if (msgRetorno) {
    const codigo = getTag(msgRetorno, 'Codigo')
    const msg    = getTag(msgRetorno, 'Mensagem')
    // Códigos que significam "sem resultado" (não é erro fatal)
    if (codigo && ['E10', 'E4', 'E79', 'E6', 'E69'].includes(codigo)) return []
    if (codigo) throw new Error(`BHISS ${codigo}: ${msg}`)
    return []
  }

  const blocos = getAllBlocks(outputXml, 'CompNfse')
  const resultado: BhissNfse[] = []

  for (const bloco of blocos) {
    try {
      const inf = getTag(bloco, 'InfNfse')

      const numero   = getTag(inf, 'Numero')
      const codVerif = getTag(inf, 'CodigoVerificacao')
      const dtEmiss  = getTag(inf, 'DataEmissao') || getTag(inf, 'Competencia') || ''
      const compRaw  = getTag(inf, 'Competencia') || dtEmiss
      const competencia = compRaw.slice(0, 7)

      const prestBlock = getTag(inf, 'PrestadorServico')
      const identBlk   = getTag(prestBlock, 'IdentificacaoPrestador')
      const cpfCnpjBlk = getTag(identBlk, 'CpfCnpj')
      const prestCnpj  = getTag(cpfCnpjBlk, 'Cnpj') || getTag(cpfCnpjBlk, 'Cpf') || ''
      const prestNome  = getTag(prestBlock, 'RazaoSocial') || getTag(prestBlock, 'NomeFantasia') || ''

      const servBlock = getTag(inf, 'Servico') || bloco
      const valBlock  = getTag(servBlock, 'Valores')
      const valorStr  = getTag(valBlock, 'ValorServicos') || getTag(valBlock, 'ValorLiquidoNfse') || '0'
      const valor     = parseFloat(valorStr.replace(',', '.')) || 0
      const discrimin = getTag(servBlock, 'Discriminacao') || ''

      const chave = codVerif
        ? `bhiss-${prestCnpj}-${numero}-${codVerif}`
        : `bhiss-${prestCnpj}-${numero}`

      resultado.push({
        chave_acesso:   chave,
        numero,
        competencia,
        prestador_cnpj: prestCnpj,
        prestador_nome: prestNome,
        valor_servicos: valor,
        descricao:      discrimin.slice(0, 2000),
        xml:            bloco,
      })
    } catch { /* ignora doc corrompido */ }
  }

  return resultado
}

export async function consultarBhiss(
  empresa: SefazEmpresa,
  dataInicio: string,   // 'YYYY-MM-DD'
  dataFim: string,      // 'YYYY-MM-DD'
  onProgress?: (msg: string) => void
): Promise<{ servicos: BhissNfse[]; paginas: number }> {
  if (!empresa.pfx_b64 || !empresa.pfx_senha) {
    throw new Error('Certificado digital não configurado para esta empresa.')
  }

  const agent = new https.Agent({
    pfx: Buffer.from(empresa.pfx_b64, 'base64'),
    passphrase: empresa.pfx_senha,
  })

  const cnpj = empresa.cnpj.replace(/\D/g, '')
  const servicos: BhissNfse[] = []
  let pagina = 1

  onProgress?.(`Consultando BHISS: ${dataInicio} → ${dataFim}...`)

  while (true) {
    let resposta: string
    try {
      resposta = await httpsPost(agent, buildEnvelope(cnpj, dataInicio, dataFim, pagina))
    } catch (e: any) {
      if (pagina === 1) throw e
      break
    }

    const novas = parsePagina(resposta)
    if (novas.length === 0) break

    servicos.push(...novas)
    onProgress?.(`Pág. ${pagina}: +${novas.length} NFS-e (total: ${servicos.length})`)

    if (novas.length < 10) break  // última página (BHISS retorna até 10 por página)
    pagina++
    if (pagina > 500) break       // segurança
  }

  onProgress?.(`BHISS finalizado: ${servicos.length} NFS-e em ${pagina} página(s)`)
  return { servicos, paginas: pagina }
}
