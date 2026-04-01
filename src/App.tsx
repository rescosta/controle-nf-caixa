import { useState, useEffect } from 'react'
import { FileText, Wallet, Settings, BarChart2, ZoomIn, ZoomOut, Sun, Moon, Minus, Square, X, Radio, BookOpen } from 'lucide-react'
import NFList from './pages/nf/NFList'
import CaixaList from './pages/caixa/CaixaList'
import ConfigPage from './pages/config/ConfigPage'
import RelatorioList from './pages/relatorios/RelatorioList'
import SefazPage from './pages/sefaz/SefazPage'
import ManualPage from './pages/manual/ManualPage'

type Tab = 'nf' | 'caixa' | 'relatorios' | 'sefaz' | 'config' | 'manual'

export default function App() {
  const [tab, setTab] = useState<Tab>('nf')
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem('ui-zoom') ?? 100))
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('ui-theme') as 'dark' | 'light') ?? 'dark'
  )
  // Detecção síncrona de plataforma — sem flash
  const isMac = !navigator.userAgent.toLowerCase().includes('windows')

  useEffect(() => {
    document.documentElement.style.zoom = zoom + '%'
    localStorage.setItem('ui-zoom', String(zoom))
  }, [zoom])

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('ui-theme', theme)
  }, [theme])

  function zoomIn()  { setZoom(z => Math.min(z + 10, 150)) }
  function zoomOut() { setZoom(z => Math.max(z - 10, 70)) }
  function toggleTheme() { setTheme(t => t === 'dark' ? 'light' : 'dark') }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Titlebar */}
      <div
        className="titlebar-drag h-10 bg-slate-900 border-b border-slate-800 flex items-center px-4 shrink-0"
        style={{ paddingLeft: isMac ? 80 : 16 }}
      >
        {!isMac && (
          <span className="text-xs text-slate-500 font-medium tracking-widest uppercase select-none">Controle NF + Caixa</span>
        )}
        <div className="ml-auto flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button onClick={zoomOut} title="Diminuir zoom" className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800">
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-slate-600 w-8 text-center">{zoom}%</span>
          <button onClick={zoomIn} title="Aumentar zoom" className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800">
            <ZoomIn size={14} />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1" />
          <button onClick={toggleTheme} title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'} className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800">
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          {!isMac && (
            <>
              <div className="w-px h-4 bg-slate-700 mx-1" />
              <button
                onClick={() => api.win.minimize()}
                title="Minimizar"
                className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <Minus size={13} />
              </button>
              <button
                onClick={() => api.win.maximize()}
                title="Maximizar / Restaurar"
                className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <Square size={12} />
              </button>
              <button
                onClick={() => api.win.close()}
                title="Fechar"
                className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-red-600 transition-colors"
              >
                <X size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Nav tabs */}
      <div className="bg-slate-900 border-b border-slate-800 flex items-center gap-1 px-4 shrink-0">
        <NavTab id="nf" active={tab} icon={<FileText size={16} />} label="Controle de NF" onClick={setTab} />
        <NavTab id="caixa" active={tab} icon={<Wallet size={16} />} label="Acerto de Caixa" onClick={setTab} />
        <NavTab id="relatorios" active={tab} icon={<BarChart2 size={16} />} label="Relatórios de Custo" onClick={setTab} />
        <NavTab id="sefaz" active={tab} icon={<Radio size={16} />} label="Monitor NF-e" onClick={setTab} />
        <div className="flex-1" />
        <NavTab id="manual" active={tab} icon={<BookOpen size={16} />} label="Manual" onClick={setTab} />
        <NavTab id="config" active={tab} icon={<Settings size={16} />} label="Configurações" onClick={setTab} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'nf' && <NFList />}
        {tab === 'caixa' && <CaixaList />}
        {tab === 'relatorios' && <RelatorioList />}
        {tab === 'sefaz' && <SefazPage />}
        {tab === 'config' && <ConfigPage />}
        {tab === 'manual' && <ManualPage />}
      </div>
    </div>
  )
}

function NavTab({ id, active, icon, label, onClick }: {
  id: Tab
  active: Tab
  icon: React.ReactNode
  label: string
  onClick: (t: Tab) => void
}) {
  const isActive = id === active
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition -webkit-app-region-no-drag ${
        isActive
          ? 'border-blue-500 text-blue-400'
          : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
      }`}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {icon}
      {label}
    </button>
  )
}

declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: string
  }
}
