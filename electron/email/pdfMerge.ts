import { PDFDocument, rgb } from 'pdf-lib'
import { readFileSync } from 'fs'

interface Anexo {
  nome: string
  caminho: string
  tipo: string
}

export async function mergePDFs(nfPdfBuffer: Buffer, anexos: Anexo[]): Promise<Buffer> {
  const merged = await PDFDocument.create()

  // 1. Folha de rosto — páginas do PDF da NF
  const nfDoc = await PDFDocument.load(nfPdfBuffer)
  const nfPages = await merged.copyPages(nfDoc, nfDoc.getPageIndices())
  nfPages.forEach(p => merged.addPage(p))

  // 2. Anexos em ordem
  for (const anexo of anexos) {
    try {
      const bytes = readFileSync(anexo.caminho)
      const ext = anexo.caminho.toLowerCase()

      if (ext.endsWith('.pdf')) {
        const doc = await PDFDocument.load(bytes)
        const pages = await merged.copyPages(doc, doc.getPageIndices())
        pages.forEach(p => merged.addPage(p))
      } else if (ext.endsWith('.png')) {
        const img = await merged.embedPng(bytes)
        const { width, height } = fitToA4(img.width, img.height)
        const page = merged.addPage([595, 842]) // A4 pt
        const x = (595 - width) / 2
        const y = (842 - height) / 2
        page.drawImage(img, { x, y, width, height })
      } else if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) {
        const img = await merged.embedJpg(bytes)
        const { width, height } = fitToA4(img.width, img.height)
        const page = merged.addPage([595, 842])
        const x = (595 - width) / 2
        const y = (842 - height) / 2
        page.drawImage(img, { x, y, width, height })
      }
    } catch (err) {
      // Anexo corrompido ou inacessível — adiciona página de erro
      console.warn('[pdfMerge] erro ao processar anexo:', anexo.nome, err)
      const page = merged.addPage([595, 842])
      page.drawText(`Anexo não pôde ser incorporado: ${anexo.nome}`, {
        x: 50, y: 400, size: 12, color: rgb(0.6, 0.1, 0.1)
      })
    }
  }

  return Buffer.from(await merged.save())
}

// Redimensiona mantendo proporção para caber em A4 (595×842 pt) com margem de 40pt
function fitToA4(w: number, h: number): { width: number; height: number } {
  const maxW = 515
  const maxH = 762
  const ratio = Math.min(maxW / w, maxH / h, 1)
  return { width: w * ratio, height: h * ratio }
}
