type Recommendation = 'BUY' | 'WATCH' | 'PASS'

const styles: Record<Recommendation, string> = {
  BUY: 'bg-green-100 text-green-800 border-green-200',
  WATCH: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PASS: 'bg-gray-100 text-gray-500 border-gray-200',
}

export function ScoreBadge({ recommendation, score }: { recommendation: Recommendation; score: number }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${styles[recommendation]}`}>
      {recommendation} · {score}
    </span>
  )
}
