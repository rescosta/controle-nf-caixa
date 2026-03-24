import { useState, useEffect } from 'react'

interface Props {
  value: number
  onChange: (n: number) => void
  className?: string
  placeholder?: string
}

function toDisplay(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseDisplay(s: string): number {
  // "1.234,56" → 1234.56
  const cleaned = s.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

export default function CurrencyInput({ value, onChange, className, placeholder }: Props) {
  const [display, setDisplay] = useState(toDisplay(value))

  useEffect(() => {
    setDisplay(toDisplay(value))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Permite apenas dígitos, vírgula e ponto
    const raw = e.target.value.replace(/[^\d,.]/g, '')
    setDisplay(raw)
  }

  function handleBlur() {
    const n = parseDisplay(display)
    onChange(n)
    setDisplay(toDisplay(n))
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.select()
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder ?? '0,00'}
      className={className}
    />
  )
}
