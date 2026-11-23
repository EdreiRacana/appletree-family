import type { Member } from './types'

// Fechas familiares: cumpleaños, edades y aniversarios.
// Las fechas vienen como 'YYYY-MM-DD' (sin hora) y se leen en hora local
// para que "hoy" sea el día del calendario de quien mira.

export function parseYMD(s?: string | null): { y: number, m: number, d: number } | null {
  if (!s) return null
  const mt = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!mt) return null
  return { y: Number(mt[1]), m: Number(mt[2]), d: Number(mt[3]) }
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// Siguiente aniversario (cumpleaños) a partir de hoy. 29-feb → 28-feb en años no bisiestos.
export function nextAnniversary(s: string | null | undefined, today = new Date()) {
  const p = parseYMD(s)
  if (!p) return null
  const t = startOfDay(today)
  const make = (year: number) => {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    const day = p.m === 2 && p.d === 29 && !leap ? 28 : p.d
    return new Date(year, p.m - 1, day)
  }
  let next = make(t.getFullYear())
  if (next < t) next = make(t.getFullYear() + 1)
  const daysLeft = Math.round((next.getTime() - t.getTime()) / 86_400_000)
  return { date: next, daysLeft, years: next.getFullYear() - p.y, birthYear: p.y }
}

export const isDeceased = (m: Member) => !!m.dateOfDeath

export function ageOn(m: Member, today = new Date()): number | null {
  const b = parseYMD(m.dateOfBirth)
  if (!b) return null
  const end = parseYMD(m.dateOfDeath) ?? { y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() }
  let age = end.y - b.y
  if (end.m < b.m || (end.m === b.m && end.d < b.d)) age--
  return age >= 0 ? age : null
}

export function yearsLabel(m: Member): string {
  const b = parseYMD(m.dateOfBirth)?.y
  const d = parseYMD(m.dateOfDeath)?.y
  if (d) return `${b ?? '?'} – ${d}`
  return b ? `Nació en ${b}` : ''
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`
