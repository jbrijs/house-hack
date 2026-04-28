import { Badge } from '@/components/ui/badge'

type Recommendation = 'BUY' | 'WATCH' | 'PASS'

const variants: Record<Recommendation, string> = {
  BUY: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
  WATCH: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
  PASS: 'bg-muted text-muted-foreground hover:bg-muted',
}

export function ScoreBadge({ recommendation, score }: { recommendation: Recommendation; score: number }) {
  return (
    <Badge variant="outline" className={`font-semibold tabular-nums ${variants[recommendation]}`}>
      {recommendation} · {score}
    </Badge>
  )
}
