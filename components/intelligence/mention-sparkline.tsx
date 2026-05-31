'use client'

import { useMemo } from 'react'
import { BarChart, Bar, ResponsiveContainer } from 'recharts'

interface MentionSparklineProps {
  dates: string[]
}

export function MentionSparkline({ dates }: MentionSparklineProps) {
  const data = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of dates) {
      if (!d) continue
      const key = d.slice(0, 7) // YYYY-MM
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }))
  }, [dates])

  if (data.length === 0) return null

  return (
    <div className="w-[120px] h-[40px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
