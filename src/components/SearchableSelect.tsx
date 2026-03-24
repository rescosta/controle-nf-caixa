import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'

export interface SelectOption {
  id: number | string
  label: string
}

interface Props {
  value: number | string | undefined
  onChange: (id: number | string) => void
  options: SelectOption[]
  placeholder?: string
  onAdd?: () => void
  className?: string
}

export default function SearchableSelect({ value, onChange, options, placeholder = 'Selecione...', onAdd, className }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => String(o.id) === String(value))
  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    if (open) {
      setSearch('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function handleSelect(id: number | string) {
    onChange(id)
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative flex gap-1 ${className ?? ''}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-md border border-slate-600 bg-slate-800 text-sm text-left focus:outline-none focus:border-blue-500 min-w-0"
      >
        <span className={`truncate ${selected ? 'text-slate-100' : 'text-slate-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0 ml-1">
          {selected && (
            <X
              size={12}
              className="text-slate-500 hover:text-slate-300"
              onClick={handleClear}
            />
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Botão + */}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          title="Cadastrar novo"
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-md border border-slate-600 bg-slate-800 text-slate-400 hover:text-blue-400 hover:border-blue-500 transition-colors"
        >
          <Plus size={14} />
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden min-w-full w-max max-w-xs">
          <div className="p-2 border-b border-slate-700">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') setOpen(false)
                if (e.key === 'Enter' && filtered.length === 1) handleSelect(filtered[0].id)
              }}
              placeholder="Pesquisar..."
              className="w-full px-2 py-1 text-sm bg-slate-900 border border-slate-700 rounded text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-500 text-center">Nenhum resultado</div>
            ) : (
              filtered.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => handleSelect(o.id)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    String(o.id) === String(value)
                      ? 'bg-blue-900/40 text-blue-300'
                      : 'text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
