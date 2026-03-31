import { useState } from 'react'
import { FileText, Building2, Mail, Briefcase } from 'lucide-react'
import SefazNFesPage from './SefazNFesPage'
import SefazEmpresasPage from './SefazEmpresasPage'
import SefazDestinatariosPage from './SefazDestinatariosPage'
import NfseServicosPage from './NfseServicosPage'

type SubTab = 'nfes' | 'nfse' | 'empresas' | 'destinatarios'

export default function SefazPage() {
  const [sub, setSub] = useState<SubTab>('nfes')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-navegação */}
      <div className="bg-slate-850 border-b border-slate-700 flex items-center gap-1 px-4 shrink-0" style={{ background: 'rgb(15 23 42 / 0.7)' }}>
        <SubNavTab id="nfes" active={sub} icon={<FileText size={14} />} label="NF-es Recebidas" onClick={setSub} />
        <SubNavTab id="nfse" active={sub} icon={<Briefcase size={14} />} label="NFS-e Tomadas" onClick={setSub} />
        <SubNavTab id="empresas" active={sub} icon={<Building2 size={14} />} label="Empresas SEFAZ" onClick={setSub} />
        <SubNavTab id="destinatarios" active={sub} icon={<Mail size={14} />} label="Destinatários" onClick={setSub} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-hidden">
        {sub === 'nfes' && <SefazNFesPage />}
        {sub === 'nfse' && <NfseServicosPage />}
        {sub === 'empresas' && <div className="h-full overflow-auto"><SefazEmpresasPage /></div>}
        {sub === 'destinatarios' && <div className="h-full overflow-auto"><SefazDestinatariosPage /></div>}
      </div>
    </div>
  )
}

function SubNavTab({ id, active, icon, label, onClick }: {
  id: SubTab; active: SubTab; icon: React.ReactNode; label: string; onClick: (t: SubTab) => void
}) {
  const isActive = id === active
  return (
    <button onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 transition ${isActive ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'}`}>
      {icon}{label}
    </button>
  )
}
