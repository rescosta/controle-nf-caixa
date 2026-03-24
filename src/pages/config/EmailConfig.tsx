import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { Mail, CheckCircle, XCircle, Loader2, Trash2, Eye, EyeOff } from 'lucide-react'

const KEYS = [
  'email_smtp_host',
  'email_smtp_port',
  'email_smtp_secure',
  'email_smtp_user',
  'email_smtp_pass',
  'email_from',
  'email_to_padrao',
  'email_assinatura_img',
  'email_senha_assinatura',
] as const

type SettingKey = typeof KEYS[number]

export default function EmailConfig() {
  const [cfg, setCfg] = useState<Record<SettingKey, string>>({
    email_smtp_host: '',
    email_smtp_port: '587',
    email_smtp_secure: 'false',
    email_smtp_user: '',
    email_smtp_pass: '',
    email_from: '',
    email_to_padrao: '',
    email_assinatura_img: '',
    email_senha_assinatura: '',
  })
  const [showSenha, setShowSenha] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null)
  const [testError, setTestError] = useState('')

  useEffect(() => {
    Promise.all(KEYS.map(k => api.settings.get(k))).then(values => {
      const next = { ...cfg }
      KEYS.forEach((k, i) => { if (values[i]) next[k] = values[i] as string })
      setCfg(next)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function set(key: SettingKey, value: string) {
    setCfg(c => ({ ...c, [key]: value }))
    setSaved(false)
    setTestResult(null)
  }

  function setTrimmed(key: SettingKey, value: string) {
    set(key, value.trimStart())
  }

  function onBlurTrim(key: SettingKey) {
    setCfg(c => ({ ...c, [key]: c[key].trim() }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all(KEYS.map(k => api.settings.set(k, cfg[k])))
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    setTestError('')
    try {
      await api.email.test()
      setTestResult('ok')
    } catch (e: unknown) {
      setTestResult('error')
      setTestError(e instanceof Error ? e.message : String(e))
    } finally {
      setTesting(false)
    }
  }

  async function handlePickImage() {
    const result = await api.settings.pickImage()
    if (result) set('email_assinatura_img', result as string)
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Mail size={18} className="text-blue-400" />
        <h2 className="text-lg font-semibold text-slate-100">Configurações de E-mail</h2>
      </div>

      {/* SMTP */}
      <div className="mb-6">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">Servidor SMTP</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group col-span-2">
            <label>Host SMTP</label>
            <input
              value={cfg.email_smtp_host}
              onChange={e => setTrimmed('email_smtp_host', e.target.value)}
              onBlur={() => onBlurTrim('email_smtp_host')}
              placeholder="smtp.gmail.com"
            />
          </div>
          <div className="form-group">
            <label>Porta</label>
            <input
              value={cfg.email_smtp_port}
              onChange={e => set('email_smtp_port', e.target.value.replace(/\D/g, ''))}
              placeholder="587"
            />
          </div>
          <div className="form-group flex items-end pb-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={cfg.email_smtp_secure === 'true'}
                onChange={e => set('email_smtp_secure', e.target.checked ? 'true' : 'false')}
              />
              <span className="text-sm text-slate-300">SSL/TLS (porta 465)</span>
            </label>
          </div>
          <div className="form-group">
            <label>Usuário</label>
            <input
              value={cfg.email_smtp_user}
              onChange={e => setTrimmed('email_smtp_user', e.target.value)}
              onBlur={() => onBlurTrim('email_smtp_user')}
              placeholder="usuario@email.com"
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              value={cfg.email_smtp_pass}
              onChange={e => setTrimmed('email_smtp_pass', e.target.value)}
              onBlur={() => onBlurTrim('email_smtp_pass')}
              placeholder="••••••••"
            />
          </div>
          <div className="form-group">
            <label>Remetente (from)</label>
            <input
              value={cfg.email_from}
              onChange={e => setTrimmed('email_from', e.target.value)}
              onBlur={() => onBlurTrim('email_from')}
              placeholder="empresa@email.com"
            />
          </div>
          <div className="form-group">
            <label>Destinatário padrão</label>
            <input
              value={cfg.email_to_padrao}
              onChange={e => setTrimmed('email_to_padrao', e.target.value)}
              onBlur={() => onBlurTrim('email_to_padrao')}
              placeholder="destino@email.com"
            />
          </div>
        </div>
      </div>

      {/* Assinatura */}
      <div className="mb-6">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">Assinatura</p>
        <p className="text-xs text-slate-500 mb-3">
          Imagem exibida acima da linha de assinatura no PDF gerado para envio.
        </p>
        {cfg.email_assinatura_img ? (
          <div className="flex items-start gap-4 p-3 bg-slate-800 border border-slate-700 rounded-lg">
            <img
              src={cfg.email_assinatura_img}
              alt="Assinatura"
              className="max-h-20 object-contain border border-slate-600 rounded bg-white p-1"
            />
            <div className="flex flex-col gap-2">
              <button className="btn-secondary btn-sm" onClick={handlePickImage}>Alterar imagem</button>
              <button
                className="btn-ghost btn-sm text-red-400 flex items-center gap-1"
                onClick={() => set('email_assinatura_img', '')}
              >
                <Trash2 size={13} /> Remover
              </button>
            </div>
          </div>
        ) : (
          <button className="btn-secondary btn-sm" onClick={handlePickImage}>
            Selecionar imagem de assinatura (PNG / JPG)
          </button>
        )}

        <div className="form-group mt-4">
          <label>Senha de autorização</label>
          <p className="text-xs text-slate-500 mb-1">Exigida para confirmar o envio de e-mails.</p>
          <div className="flex items-center gap-1 max-w-xs">
            <input
              className="w-full"
              type={showSenha ? 'text' : 'password'}
              value={cfg.email_senha_assinatura}
              onChange={e => setTrimmed('email_senha_assinatura', e.target.value)}
              onBlur={() => onBlurTrim('email_senha_assinatura')}
              placeholder="••••••••"
            />
            <button
              className="btn-ghost btn-sm p-1"
              type="button"
              onClick={() => setShowSenha(v => !v)}
            >
              {showSenha ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
        </button>
        <button className="btn-secondary flex items-center gap-2" onClick={handleTest} disabled={testing}>
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
          {testing ? 'Testando...' : 'Testar conexão'}
        </button>
        {testResult === 'ok' && (
          <span className="flex items-center gap-1 text-green-400 text-sm">
            <CheckCircle size={14} /> Conexão OK
          </span>
        )}
        {testResult === 'error' && (
          <span className="flex items-center gap-1 text-red-400 text-sm" title={testError}>
            <XCircle size={14} /> {testError.replace(/^Error invoking remote method '[^']+': /, '').slice(0, 80)}
          </span>
        )}
      </div>
    </div>
  )
}
