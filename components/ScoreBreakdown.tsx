import type { ScoreBreakdown as ScoreBreakdownType } from '@/lib/types'

export function ScoreBreakdown({ breakdown, total }: { breakdown: ScoreBreakdownType; total: number }) {
  const bars = [
    { label: 'Cash Flow', points: breakdown.cashFlow.points, max: 40, detail: `${Math.round(breakdown.cashFlow.ratio * 100)}% rent/PITI` },
    { label: 'Layout', points: breakdown.layout.points, max: 30, detail: breakdown.layout.reason },
    { label: 'Location', points: breakdown.location.points, max: 20, detail: breakdown.location.reasons.join(', ') || 'No signals' },
    { label: 'Risk', points: breakdown.risk.points, max: 10, detail: breakdown.risk.reasons.join(', ') || 'No signals' },
  ]

  return (
    <div className="space-y-3">
      <div className="text-2xl font-bold">{total}<span className="text-sm font-normal text-gray-500">/100</span></div>
      {bars.map((bar) => (
        <div key={bar.label}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700 font-medium">{bar.label}</span>
            <span className="text-gray-500">{bar.points}/{bar.max}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(bar.points / bar.max) * 100}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{bar.detail}</p>
        </div>
      ))}
    </div>
  )
}
