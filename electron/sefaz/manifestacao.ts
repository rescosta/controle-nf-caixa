import { SefazEmpresa } from '../database/queries/sefaz'

export interface ResultadoManifestacao {
  manifestados: number
  erros: number
}

const LOTE_SIZE = 20

export async function manifestarCiencia(
  empresa: SefazEmpresa,
  chaves: string[],
  onProgress?: (msg: string) => void
): Promise<ResultadoManifestacao> {
  if (chaves.length === 0) return { manifestados: 0, erros: 0 }

  const { RecepcaoEvento } = require('@vexta-systems/node-mde')
  const pfxBuffer = Buffer.from(empresa.pfx_b64!, 'base64')
  const tpAmb = empresa.ambiente === 'producao' ? '1' : '2'

  const recepcao = new RecepcaoEvento({
    pfx: pfxBuffer,
    passphrase: empresa.pfx_senha,
    tpAmb,
    cnpj: empresa.cnpj.replace(/\D/g, ''),
  })

  let manifestados = 0
  let erros = 0
  const totalLotes = Math.ceil(chaves.length / LOTE_SIZE)

  for (let i = 0; i < chaves.length; i += LOTE_SIZE) {
    const lote = chaves.slice(i, i + LOTE_SIZE)
    const loteNum = Math.floor(i / LOTE_SIZE) + 1

    onProgress?.(`Manifestando ciência: lote ${loteNum}/${totalLotes} (${lote.length} nota(s))...`)

    try {
      const resultado = await recepcao.enviarEvento({
        idLote: String(Date.now()).slice(-9),
        lote: lote.map((chNFe: string) => ({ chNFe, tipoEvento: 210210 })),
      })

      if (resultado.error) {
        const xMotivo =
          resultado.error?.json?.retEnvEvento?.retEvento?.infEvento?.xMotivo ||
          resultado.error?.json?.fault?.faultstring ||
          'Erro na manifestação'
        console.warn(`[SEFAZ] Erro ao manifestar lote ${loteNum}: ${xMotivo}`)
        erros += lote.length
      } else {
        const retEvento = resultado.data?.retEvento
        if (Array.isArray(retEvento)) {
          for (const ev of retEvento) {
            const cStat = String(ev?.infEvento?.cStat || '')
            if (cStat === '135' || cStat === '573') manifestados++
            else erros++
          }
        } else {
          manifestados += lote.length
        }
      }
    } catch (e: any) {
      console.error(`[SEFAZ] Exceção ao manifestar lote ${loteNum}:`, e.message)
      erros += lote.length
    }
  }

  return { manifestados, erros }
}
