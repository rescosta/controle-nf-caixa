export function formatBRL(value: number | string | null | undefined): string {
  const n = Number(value ?? 0)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  // date is YYYY-MM-DD
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function today(): string {
  return localDate()
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return localDate(d)
}

export function isVencido(vencimento: string | null | undefined, status: string): boolean {
  if (!vencimento || status === 'pago') return false
  return vencimento < today()
}

export function isVencendoHoje(vencimento: string | null | undefined, status: string): boolean {
  if (!vencimento || status === 'pago') return false
  return vencimento === today()
}

export function normalizeSearch(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
