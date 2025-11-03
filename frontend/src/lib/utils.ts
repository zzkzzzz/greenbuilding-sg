import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- CSV helpers (frontend-only) ---
function quoteCell(v: unknown): string {
  const s = String(v ?? '')
  return '"' + s.replace(/"/g, '""') + '"'
}

export function buildCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(quoteCell).join(',')
  const body = rows.map(r => r.map(quoteCell).join(',')).join('\n')
  return headerLine + (body ? '\n' + body : '')
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
