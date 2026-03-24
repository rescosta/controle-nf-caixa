import nodemailer from 'nodemailer'
import dns from 'dns'
import { promisify } from 'util'
import { settingsQueries } from '../database/queries/settings'

const resolve4 = promisify(dns.resolve4)

async function resolveHost(hostname: string): Promise<string> {
  try {
    const addresses = await resolve4(hostname)
    return addresses[0]
  } catch {
    return hostname
  }
}

async function createTransporter() {
  const host   = (settingsQueries.get('email_smtp_host') ?? '').trim()
  const port   = parseInt((settingsQueries.get('email_smtp_port') ?? '587').trim(), 10)
  const secure = settingsQueries.get('email_smtp_secure') === 'true'
  const user   = (settingsQueries.get('email_smtp_user') ?? '').trim()
  const pass   = (settingsQueries.get('email_smtp_pass') ?? '').trim()
  const ip = await resolveHost(host)
  return nodemailer.createTransport({
    host: ip, port, secure, requireTLS: !secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false, servername: host },
  })
}

export interface SefazEmailPayload {
  destinatarios: string[]
  empresaNome: string
  fornecedorNome: string
  fornecedorCnpj: string
  nfNumero: string
  valorNota: number
  nfData: string
  statusPagamento: string
  chaveAcesso: string
  xmlBlob?: string | null
}

export async function sendSefazNfeEmail(payload: SefazEmailPayload): Promise<void> {
  const from = (settingsQueries.get('email_from') || settingsQueries.get('email_smtp_user') || '').trim()
  const transporter = await createTransporter()

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtData = (d: string) => d ? d.split('-').reverse().join('/') : '-'

  const body = [
    `NF-e Recebida — ${payload.empresaNome}`,
    '',
    `Fornecedor: ${payload.fornecedorNome}`,
    `CNPJ: ${payload.fornecedorCnpj}`,
    `Número NF: ${payload.nfNumero || '(resumo)'}`,
    `Data de Emissão: ${fmtData(payload.nfData)}`,
    `Valor: ${fmtBRL(payload.valorNota)}`,
    `Status Pagamento: ${payload.statusPagamento === 'pago' ? 'Paga' : 'Pendente'}`,
    '',
    `Chave de Acesso: ${payload.chaveAcesso}`,
  ].join('\n')

  const attachments: nodemailer.SendMailOptions['attachments'] = []
  if (payload.xmlBlob) {
    attachments.push({
      filename: `NFe_${payload.nfNumero || payload.chaveAcesso.slice(0, 8)}.xml`,
      content: Buffer.from(payload.xmlBlob, 'utf-8'),
      contentType: 'application/xml',
    })
  }

  await transporter.sendMail({
    from,
    to: payload.destinatarios.join(', '),
    subject: `NF-e Recebida — ${payload.fornecedorNome} — ${fmtBRL(payload.valorNota)}`,
    text: body,
    attachments,
  })
}
