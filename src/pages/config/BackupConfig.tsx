import { useState } from 'react'
import { Download, Upload, Users } from 'lucide-react'
import { api } from '../../lib/api'
import ConfirmDialog from '../../components/ConfirmDialog'

interface ImportStats {
  empresas: { imported: number; replaced: number; skipped: number }
  unidades: { imported: number; replaced: number; skipped: number }
  centros_custo: { imported: number; replaced: number; skipped: number }
  funcionarios: { imported: number; replaced: number; skipped: number }
}

const LABELS: Record<keyof ImportStats, string> = {
  empresas: 'Empresas',
  unidades: 'Unidades',
  centros_custo: 'Centros de Custo',
  funcionarios: 'Funcionários',
}

interface ConflictItem { key: string; label: string }
interface AnalyzeResult {
  filePath: string
  toImport: Record<keyof ImportStats, number>
  conflicts: Record<keyof ImportStats, ConflictItem[]>
}

type Decision = 'substituir' | 'ignorar'

export default function BackupConfig() {
  // Backup completo
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<{ filePath: string; fileName: string } | null>(null)
  const [restoreSuccess, setRestoreSuccess] = useState(false)

  // Cadastros
  const [cadExporting, setCadExporting] = useState(false)
  const [cadExportMsg, setCadExportMsg] = useState<string | null>(null)
  const [cadImporting, setCadImporting] = useState(false)
  const [cadImportError, setCadImportError] = useState<string | null>(null)
  const [cadImportStats, setCadImportStats] = useState<ImportStats | null>(null)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [confirming, setConfirming] = useState(false)

  async function handleExport() {
    setExporting(true); setExportMsg(null)
    try {
      const res = await api.backup.export()
      if (res?.ok) setExportMsg('Backup salvo com sucesso!')
    } finally { setExporting(false) }
  }

  async function handlePickFile() {
    setImporting(true); setImportError(null)
    try {
      const res = await api.backup.pickFile() as { ok?: boolean; canceled?: boolean; invalid?: boolean; filePath?: string; fileName?: string }
      if (res?.canceled) return
      if (res?.invalid) { setImportError('Arquivo inválido — não é um banco SQLite.'); return }
      if (res?.ok) setPendingFile({ filePath: res.filePath!, fileName: res.fileName! })
    } finally { setImporting(false) }
  }

  async function handleRestore() {
    if (!pendingFile) return
    const fp = pendingFile
    setPendingFile(null)
    setImporting(true)
    try {
      const res = await api.backup.restore(fp.filePath) as { ok?: boolean; invalid?: boolean }
      if (res?.invalid) { setImportError('Arquivo não encontrado ou corrompido. Selecione novamente.'); return }
      if (res?.ok) setRestoreSuccess(true)
    } finally { setImporting(false) }
  }

  async function handleCadExport() {
    setCadExporting(true); setCadExportMsg(null)
    try {
      const res = await api.cadastros.export()
      if (res?.ok) setCadExportMsg('Cadastros exportados com sucesso!')
    } finally { setCadExporting(false) }
  }

  async function handleCadImport() {
    setCadImporting(true); setCadImportError(null); setCadImportStats(null); setAnalyzeResult(null)
    try {
      const res = await api.cadastros.analyze() as AnalyzeResult & { ok?: boolean; canceled?: boolean; invalid?: boolean }
      if (res?.canceled) return
      if (res?.invalid) { setCadImportError('Arquivo inválido — selecione um .json exportado por este sistema.'); return }
      if (!res?.ok) return

      const allConflicts = (Object.values(res.conflicts) as ConflictItem[][]).flat()
      if (allConflicts.length === 0) {
        // Sem conflitos — importa direto
        const imp = await api.cadastros.importConfirmed(res.filePath, {}) as { ok?: boolean; stats?: ImportStats }
        if (imp?.ok) setCadImportStats(imp.stats as ImportStats)
      } else {
        // Inicializa todas as decisões como 'ignorar'
        const init: Record<string, Decision> = {}
        for (const item of allConflicts) init[item.key] = 'ignorar'
        setDecisions(init)
        setAnalyzeResult(res)
      }
    } finally { setCadImporting(false) }
  }

  function setAllDecisions(mode: Decision) {
    if (!analyzeResult) return
    const all: Record<string, Decision> = {}
    for (const items of Object.values(analyzeResult.conflicts) as ConflictItem[][])
      for (const item of items) all[item.key] = mode
    setDecisions(all)
  }

  async function handleConfirmImport() {
    if (!analyzeResult) return
    setConfirming(true)
    try {
      const res = await api.cadastros.importConfirmed(analyzeResult.filePath, decisions) as { ok?: boolean; stats?: ImportStats }
      if (res?.ok) {
        setCadImportStats(res.stats as ImportStats)
        setAnalyzeResult(null)
      }
    } finally { setConfirming(false) }
  }

  const totalConflicts = analyzeResult
    ? (Object.values(analyzeResult.conflicts) as ConflictItem[][]).flat().length
    : 0

  return (
    <div className="p-6 max-w-2xl space-y-8">

      {/* ── Backup Completo ── */}
      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Backup / Restauração do Banco</h2>
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Download className="text-blue-400 shrink-0" size={22} />
              <div>
                <p className="font-medium text-slate-100">Exportar Backup</p>
                <p className="text-sm text-slate-400">
                  Salva todos os dados em um arquivo <code className="text-slate-300">.db</code> no local escolhido.
                </p>
              </div>
            </div>
            {exportMsg && <p className="text-sm text-green-400">{exportMsg}</p>}
            <button className="btn-primary flex items-center gap-2" onClick={handleExport} disabled={exporting}>
              <Download size={16} /> {exporting ? 'Exportando...' : 'Exportar Backup'}
            </button>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Upload className="text-orange-400 shrink-0" size={22} />
              <div>
                <p className="font-medium text-slate-100">Restaurar Backup</p>
                <p className="text-sm text-slate-400">Substitui o banco de dados atual por um arquivo de backup.</p>
                <p className="text-sm text-orange-400 font-medium mt-1">Atenção: todos os dados atuais serão substituídos. O app será reiniciado.</p>
              </div>
            </div>
            {importError && <p className="text-sm text-red-400">{importError}</p>}
            {restoreSuccess ? (
              <div className="rounded-md bg-green-900/40 border border-green-700 px-4 py-3">
                <p className="text-sm text-green-400 font-medium">✓ Restauração concluída! O aplicativo será reiniciado automaticamente.</p>
              </div>
            ) : (
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50 transition"
                onClick={handlePickFile} disabled={importing || restoreSuccess}
              >
                <Upload size={16} /> {importing ? 'Aguarde...' : 'Importar Backup'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Cadastros Base ── */}
      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-1">Cadastros Base</h2>
        <p className="text-sm text-slate-400 mb-4">
          Exporta/importa Empresas, Unidades, Centros de Custo e Funcionários em formato <code className="text-slate-300">.json</code>.
        </p>
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Users className="text-teal-400 shrink-0" size={22} />
              <div>
                <p className="font-medium text-slate-100">Exportar Cadastros</p>
                <p className="text-sm text-slate-400">Salva Empresas, Unidades, Centros de Custo e Funcionários em um arquivo <code className="text-slate-300">.json</code>.</p>
              </div>
            </div>
            {cadExportMsg && <p className="text-sm text-green-400">{cadExportMsg}</p>}
            <button className="btn-primary flex items-center gap-2" onClick={handleCadExport} disabled={cadExporting}>
              <Download size={16} /> {cadExporting ? 'Exportando...' : 'Exportar Cadastros'}
            </button>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Upload className="text-teal-400 shrink-0" size={22} />
              <div>
                <p className="font-medium text-slate-100">Importar Cadastros</p>
                <p className="text-sm text-slate-400">Importa registros de um <code className="text-slate-300">.json</code> exportado por este sistema. Duplicados podem ser substituídos ou ignorados.</p>
              </div>
            </div>

            {cadImportError && <p className="text-sm text-red-400">{cadImportError}</p>}

            {/* Resultado final */}
            {cadImportStats && !analyzeResult && (
              <div className="bg-slate-900 rounded-lg p-4 space-y-2 text-sm">
                <p className="font-medium text-slate-200 mb-2">Resultado da importação:</p>
                {(Object.keys(LABELS) as (keyof ImportStats)[]).map(k => (
                  <div key={k} className="flex justify-between items-center">
                    <span className="text-slate-400">{LABELS[k]}</span>
                    <span className="font-mono text-xs space-x-2">
                      {cadImportStats[k].imported > 0 && <span className="text-green-400">{cadImportStats[k].imported} importados</span>}
                      {cadImportStats[k].replaced > 0 && <span className="text-orange-400">{cadImportStats[k].replaced} substituídos</span>}
                      {cadImportStats[k].skipped > 0 && <span className="text-slate-500">{cadImportStats[k].skipped} ignorados</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Resolução de conflitos */}
            {analyzeResult && (
              <div className="border border-slate-600 rounded-lg overflow-hidden">
                <div className="bg-slate-700 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-100">
                    {totalConflicts} registro{totalConflicts !== 1 ? 's' : ''} duplicado{totalConflicts !== 1 ? 's' : ''} encontrado{totalConflicts !== 1 ? 's' : ''}
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="px-2.5 py-1 text-xs rounded bg-orange-700 hover:bg-orange-600 text-white transition"
                      onClick={() => setAllDecisions('substituir')}
                    >Substituir todas</button>
                    <button
                      className="px-2.5 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-slate-200 transition"
                      onClick={() => setAllDecisions('ignorar')}
                    >Ignorar todas</button>
                  </div>
                </div>

                <div className="divide-y divide-slate-700 max-h-64 overflow-y-auto">
                  {(Object.keys(LABELS) as (keyof ImportStats)[]).map(cat => {
                    const items = analyzeResult.conflicts[cat]
                    if (items.length === 0) return null
                    return (
                      <div key={cat} className="px-4 py-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">{LABELS[cat]}</p>
                        <div className="space-y-1.5">
                          {items.map(item => (
                            <div key={item.key} className="flex items-center justify-between gap-3">
                              <span className="text-sm text-slate-300 truncate">{item.label}</span>
                              <div className="flex shrink-0 rounded overflow-hidden border border-slate-600 text-xs">
                                <button
                                  className={`px-2.5 py-1 transition ${decisions[item.key] === 'substituir' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                  onClick={() => setDecisions(d => ({ ...d, [item.key]: 'substituir' }))}
                                >Substituir</button>
                                <button
                                  className={`px-2.5 py-1 transition border-l border-slate-600 ${decisions[item.key] === 'ignorar' ? 'bg-slate-600 text-slate-100' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                  onClick={() => setDecisions(d => ({ ...d, [item.key]: 'ignorar' }))}
                                >Ignorar</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="bg-slate-750 border-t border-slate-600 px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">
                    + {(Object.values(analyzeResult.toImport) as number[]).reduce((a, b) => a + b, 0)} registro{(Object.values(analyzeResult.toImport) as number[]).reduce((a, b) => a + b, 0) !== 1 ? 's' : ''} novo{(Object.values(analyzeResult.toImport) as number[]).reduce((a, b) => a + b, 0) !== 1 ? 's' : ''} serão adicionados
                  </span>
                  <div className="flex gap-2">
                    <button className="btn-secondary btn-sm" onClick={() => setAnalyzeResult(null)}>Cancelar</button>
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-teal-700 hover:bg-teal-600 text-white disabled:opacity-50 transition"
                      onClick={handleConfirmImport} disabled={confirming}
                    >{confirming ? 'Importando...' : 'Confirmar importação'}</button>
                  </div>
                </div>
              </div>
            )}

            {!analyzeResult && (
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-teal-700 hover:bg-teal-600 text-white disabled:opacity-50 transition"
                onClick={handleCadImport} disabled={cadImporting}
              >
                <Upload size={16} /> {cadImporting ? 'Analisando...' : 'Importar Cadastros'}
              </button>
            )}
          </div>
        </div>
      </div>

      {pendingFile && (
        <ConfirmDialog
          title="Restaurar Backup"
          message={`Restaurar "${pendingFile.fileName}"? Todos os dados atuais serão substituídos e o aplicativo será reiniciado.`}
          confirmLabel="Sim, restaurar"
          danger
          onConfirm={handleRestore}
          onCancel={() => setPendingFile(null)}
        />
      )}
    </div>
  )
}
