import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, startOfWeek, startOfMonth } from 'date-fns'
import type { Granularity } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPeriod(dateStr: string, granularity: Granularity): string {
  const d = new Date(dateStr)
  if (granularity === 'day') return format(d, 'MMM d')
  if (granularity === 'week') return format(startOfWeek(d), 'MMM d')
  return format(startOfMonth(d), 'MMM yyyy')
}

export function formatDelta(delta: number, unit: string = ''): string {
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}${unit}`
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

export const BRAND_COLORS: Record<string, string> = {
  Lifepro: '#6366f1',
  Oaktiv: '#22c55e',
  Petcove: '#f59e0b',
  Joyberri: '#ec4899',
  'Loft&Ivy': '#14b8a6',
  Sunello: '#f97316',
  Culvani: '#8b5cf6',
}

export const CATEGORY_COLORS: Record<string, string> = {
  'Product Quality': '#6366f1',
  'Usability & Design': '#22c55e',
  Value: '#f59e0b',
  'Customer Service': '#14b8a6',
  Fulfillment: '#f97316',
  Other: '#94a3b8',
}

export const SENTIMENT_COLORS = {
  positive: '#22c55e',
  neutral: '#94a3b8',
  negative: '#ef4444',
}

export const ALL_BRANDS = ['Lifepro', 'Oaktiv', 'Petcove', 'Joyberri', 'Loft&Ivy', 'Sunello', 'Culvani']

export const ALL_CATEGORIES = [
  'Product Quality',
  'Usability & Design',
  'Value',
  'Customer Service',
  'Fulfillment',
  'Other',
]

export function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const val = r[h] ?? ''
          const str = String(val).replace(/"/g, '""')
          return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str
        })
        .join(',')
    ),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
