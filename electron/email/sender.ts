import nodemailer from 'nodemailer'
import dns from 'dns'
import { promisify } from 'util'
import { settingsQueries } from '../database/queries/settings'

const resolve4 = promisify(dns.resolve4)

// Resolve o hostname via dns.resolve4 (protocolo DNS direto, como nslookup)
// O Electron/macOS bloqueia getaddrinfo mas permite resolve4
async function resolveHost(hostname: string): Promise<string> {
  try {
    const addresses = await resolve4(hostname)
    console.log('[email] dns.resolve4', hostname, '->', addresses[0])
    return addresses[0]
  } catch (err) {
    console.log('[email] dns.resolve4 falhou, usando hostname original:', err)
    return hostname
  }
}

function getSettings() {
  const host   = (settingsQueries.get('email_smtp_host') ?? '').trim()
  const port   = parseInt((settingsQueries.get('email_smtp_port') ?? '587').trim(), 10)
  const secure = settingsQueries.get('email_smtp_secure') === 'true'
  const user   = (settingsQueries.get('email_smtp_user') ?? '').trim()
  const pass   = (settingsQueries.get('email_smtp_pass') ?? '').trim()
  const from   = (settingsQueries.get('email_from') ?? user).trim()
  console.log('[email] settings — host:', host, 'port:', port, 'secure:', secure, 'user:', user)
  return { host, port, secure, user, pass, from }
}

async function createTransporter() {
  const { host, port, secure, user, pass } = getSettings()
  const ip = await resolveHost(host)
  return nodemailer.createTransport({
    host: ip,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
      servername: host,  // SNI com o hostname original
    },
  })
}

export async function testEmailConnection(): Promise<void> {
  const transporter = await createTransporter()
  await transporter.verify()
}

interface SendNFPayload {
  to: string
  subject: string
  body: string
  pdfBuffer: Buffer
  pdfName: string
  anexos: { nome: string; caminho: string }[]
}

export async function sendNFEmail(payload: SendNFPayload): Promise<void> {
  const { from } = getSettings()
  const transporter = await createTransporter()
  await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.body,
    attachments: [
      { filename: payload.pdfName, content: payload.pdfBuffer, contentType: 'application/pdf' },
      ...payload.anexos.map(a => ({ filename: a.nome, path: a.caminho })),
    ],
  })
}
