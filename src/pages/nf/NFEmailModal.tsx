import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, CheckCircle, XCircle, Paperclip, Eye, EyeOff, ShieldAlert, X } from 'lucide-react'
import Modal from '../../components/Modal'
import { api } from '../../lib/api'
import { buildNFHtml } from './NFPrint'
import type { NotaFiscal, NFParcela, NFProgramacao, NFAnexo } from '../../types'

interface Props {
  nf: NotaFiscal
  onClose: () => void
  onSent?: () => void
}

export default function NFEmailModal({ nf, onClose, onSent }: Props) {
  const [to, setTo] = useState('')
  const [parcelas, setParcelas] = useState<NFParcela[]>([])
  const [programacao, setProgramacao] = useState<NFProgramacao[]>([])
  const [anexos, setAnexos] = useState<NFAnexo[]>([])
  const [assinaturaImg, setAssinaturaImg] = useState<string | null>(null)
  const [incluirAssinatura, setIncluirAssinatura] = useState(true)
  const [showSenhaModal, setShowSenhaModal] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<'ok' | 'error' | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    Promise.all([
      api.nf.getParcelas(nf.id),
      api.nf.getProgramacao(nf.id),
      api.nf.getAnexos(nf.id),
      api.settings.get('email_to_padrao'),
      api.settings.get('email_assinatura_img'),
    ]).then(([p, pg, ax, toDefault, assinatura]) => {
      setParcelas(p as NFParcela[])
      setProgramacao(pg as NFProgramacao[])
      setAnexos(ax as NFAnexo[])
      if (toDefault) setTo(toDefault as string)
      if (assinatura) setAssinaturaImg(assinatura as string)
    })
  }, [nf.id])

  async function handleConfirmSenha(senha: string) {
    setSending(true)
    setResult(null)
    setErrorMsg('')
    try {
      const valid = await api.email.validatePassword(senha) as boolean
      if (!valid) {
        setSending(false)
        return false // sinaliza senha inválida para o mini-modal
      }
      const assinatura = incluirAssinatura && assinaturaImg ? assinaturaImg : undefined
      const html = buildNFHtml(nf, parcelas, programacao, assinatura)
      await api.email.sendNF({ to: to.trim(), html, nfSeq: nf.numero_seq, nfId: nf.id })
      setShowSenhaModal(false)
      setResult('ok')
      onSent?.()
      return true
    } catch (e: unknown) {
      setShowSenhaModal(false)
      setResult('error')
      setErrorMsg(e instanceof Error ? e.message : String(e))
      return true
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Modal
        title={`Enviar NF #${nf.numero_seq} por E-mail`}
        onClose={onClose}
        maxWidth="max-w-md"
        footer={
          result === 'ok' ? (
            <button className="btn-primary" onClick={onClose}>Fechar</button>
          ) : (
            <>
              <button className="btn-secondary" onClick={onClose}>Cancelar</button>
              <button
                className="btn-primary flex items-center gap-2"
                onClick={() => setShowSenhaModal(true)}
                disabled={sending || !to.trim()}
              >
                {sending
                  ? <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                  : <><Send size={14} /> Enviar</>}
              </button>
            </>
          )
        }
      >
        <div className="space-y-4">
          {result === 'ok' && (
            <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-700/40 rounded-lg text-green-400">
              <CheckCircle size={16} />
              <span className="text-sm">E-mail enviado com sucesso!</span>
            </div>
          )}
          {result === 'error' && (
            <div className="p-3 bg-red-900/20 border border-red-700/40 rounded-lg text-red-400">
              <div className="flex items-center gap-2 mb-1">
                <XCircle size={16} />
                <span className="text-sm font-medium">Falha ao enviar</span>
              </div>
              <p className="text-xs text-red-300">{errorMsg}</p>
            </div>
          )}

          <div className="form-group">
            <label>Destinatário</label>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value.trimStart())}
              onBlur={e => setTo(e.target.value.trim())}
              placeholder="email@destino.com"
              autoFocus
            />
          </div>

          {assinaturaImg && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={incluirAssinatura}
                onChange={e => setIncluirAssinatura(e.target.checked)}
              />
              <span className="text-sm text-slate-300">Incluir imagem de assinatura no PDF</span>
            </label>
          )}

          {incluirAssinatura && assinaturaImg && (
            <div className="p-2 bg-slate-800 rounded-lg">
              <img src={assinaturaImg} alt="Assinatura" className="max-h-16 object-contain bg-white p-1 rounded" />
            </div>
          )}

          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Anexos da NF</p>
            {anexos.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum anexo cadastrado nesta NF.</p>
            ) : (
              <ul className="space-y-1">
                {anexos.map(a => (
                  <li key={a.id} className="flex items-center gap-2 text-sm text-slate-300">
                    <Paperclip size={12} className="text-slate-500 shrink-0" />
                    <span className="truncate">{a.nome}</span>
                    <span className="text-xs text-slate-500 shrink-0">{a.tipo}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Todos os anexos serão incorporados em um único PDF junto com a folha de rosto da NF.
          </p>
        </div>
      </Modal>

      {showSenhaModal && (
        <SenhaConfirmModal
          onConfirm={handleConfirmSenha}
          onClose={() => setShowSenhaModal(false)}
        />
      )}
    </>
  )
}

/* Mini-modal de confirmação de senha */
function SenhaConfirmModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (senha: string) => Promise<boolean>
  onClose: () => void
}) {
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [invalida, setInvalida] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleConfirm() {
    if (!senha) return
    setLoading(true)
    setInvalida(false)
    const ok = await onConfirm(senha)
    if (!ok) {
      setInvalida(true)
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop semitransparente — não fecha ao clicar */}
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        {/* Título e X */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-100">Confirmar envio</h3>
          <button className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-800" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          Digite sua senha de funcionário para autorizar o envio.
        </p>

        {/* Campo senha */}
        <div className="form-group mb-2">
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type={showSenha ? 'text' : 'password'}
              className="flex-1"
              value={senha}
              onChange={e => { setSenha(e.target.value); setInvalida(false) }}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
              placeholder="Sua senha"
            />
            <button className="btn-ghost btn-sm p-1.5 shrink-0" onClick={() => setShowSenha(v => !v)}>
              {showSenha ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {invalida && (
          <div className="flex items-center gap-1.5 text-red-400 text-xs mb-3">
            <ShieldAlert size={13} /> Senha incorreta.
          </div>
        )}

        {/* Ações */}
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleConfirm}
            disabled={loading || !senha}
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Enviando...</>
              : <><Send size={14} /> Confirmar</>}
          </button>
        </div>
      </div>
    </div>
  )
}
