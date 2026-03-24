import { useState } from 'react'
import EmpresasConfig from './EmpresasConfig'
import UnidadesConfig from './UnidadesConfig'
import CentrosCustoConfig from './CentrosCustoConfig'
import FornecedoresConfig from './FornecedoresConfig'
import FuncionariosConfig from './FuncionariosConfig'
import BackupConfig from './BackupConfig'
import EmailConfig from './EmailConfig'

type Section = 'empresas' | 'unidades' | 'centros' | 'fornecedores' | 'funcionarios' | 'backup' | 'email'

const CADASTROS_SECTIONS = [
  { id: 'empresas', label: 'Empresas' },
  { id: 'unidades', label: 'Unidades' },
  { id: 'centros', label: 'Centros de Custo' },
  { id: 'fornecedores', label: 'Fornecedores' },
  { id: 'funcionarios', label: 'Funcionários' },
] as const

export default function ConfigPage() {
  const [section, setSection] = useState<Section>('empresas')

  function navBtn(id: Section, label: string) {
    return (
      <button
        key={id}
        onClick={() => setSection(id)}
        className={`text-left px-4 py-2.5 text-sm transition ${
          section === id
            ? 'bg-blue-900/30 text-blue-400 border-r-2 border-blue-500'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-52 bg-slate-900 border-r border-slate-800 flex flex-col py-4 shrink-0">
        <p className="text-xs text-slate-500 uppercase tracking-wider px-4 mb-3">Cadastros</p>
        {CADASTROS_SECTIONS.map(s => navBtn(s.id, s.label))}

        <div className="border-t border-slate-800 my-3 mx-4" />
        <p className="text-xs text-slate-500 uppercase tracking-wider px-4 mb-3">Sistema</p>
        {navBtn('email', 'E-mail / SMTP')}
        {navBtn('backup', 'Backup')}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {section === 'empresas' && <EmpresasConfig />}
        {section === 'unidades' && <UnidadesConfig />}
        {section === 'centros' && <CentrosCustoConfig />}
        {section === 'fornecedores' && <FornecedoresConfig />}
        {section === 'funcionarios' && <FuncionariosConfig />}
        {section === 'email' && <EmailConfig />}
        {section === 'backup' && <BackupConfig />}
      </div>
    </div>
  )
}
