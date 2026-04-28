import type { ScoreBreakdown as ScoreBreakdownType } from '@/lib/types'

export function ScoreBreakdown({ breakdown, total }: { breakdown: ScoreBreakdownType; total: number }) {
  const bars = [
    { label: 'Cash Flow', points: breakdown.cashFlow.points, max: 40, detail: `${Math.round(breakdown.cashFlow.ratio * 100)}% rent/PITI` },
    { label: 'Layout', points: breakdown.layout.points, max: 30, detail: breakdown.layout.reason },
    { label: 'Location', points: breakdown.location.points, max: 20, detail: breakdown.location.reasons.join(', ') || 'No signals' },
    { label: 'Risk', points: breakdown.risk.points, max: 10, detail: breakdown.risk.reasons.join(', ') || 'No signals' },
  ]

  const pct = total / 100
  const color = pct >= 0.75 ? 'text-emerald-600' : pct >= 0.5 ? 'text-amber-600' : 'text-muted-foreground'

  return (
    <div className="space-y-4">
      <div className={`text-3xl font-bold tabular-nums ${color}`}>
        {total}
        <span className="text-base font-normal text-muted-foreground">/100</span>
      </div>
      {bars.map((bar) => {
        const barPct = (bar.points / bar.max) * 100
        const barColor = barPct >= 75 ? 'bg-emerald-500' : barPct >= 50 ? 'bg-amber-400' : 'bg-slate-300'
        return (
          <div key={bar.label}>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-medium">{bar.label}</span>
              <span className="text-muted-foreground tabular-nums">{bar.points}<span className="text-xs">/{bar.max}</span></span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{bar.detail}</p>
          </div>
        )
      })}
    </div>
  )
}
