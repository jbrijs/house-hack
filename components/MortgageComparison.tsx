import { Separator } from '@/components/ui/separator'

interface Props {
  price: number
  pitiMonthlyFHA: number
  pitiMonthlyConventional: number
  rentEstimate: number
}

export function MortgageComparison({ price, pitiMonthlyFHA, pitiMonthlyConventional, rentEstimate }: Props) {
  const fhaOwnerCost = pitiMonthlyFHA - rentEstimate
  const convOwnerCost = pitiMonthlyConventional - rentEstimate

  const rows = [
    { label: 'Down Payment', fha: Math.round(price * 0.035), conv: Math.round(price * 0.05), highlight: false },
    { label: 'Monthly PITI', fha: pitiMonthlyFHA, conv: pitiMonthlyConventional, highlight: false },
    { label: 'Est. Rent Income', fha: rentEstimate, conv: rentEstimate, highlight: false },
    { label: 'Your Monthly Cost', fha: fhaOwnerCost, conv: convOwnerCost, highlight: true },
  ]

  return (
    <div className="space-y-0">
      <div className="grid grid-cols-3 text-xs text-muted-foreground font-medium pb-2 border-b">
        <span></span>
        <span className="text-right">FHA 3.5%</span>
        <span className="text-right">Conv. 5%</span>
      </div>
      {rows.map((row, i) => (
        <div key={row.label}>
          <div className={`grid grid-cols-3 py-2.5 text-sm ${row.highlight ? 'font-semibold' : ''}`}>
            <span className="text-muted-foreground">{row.label}</span>
            <span className={`text-right tabular-nums ${row.highlight && row.fha < 0 ? 'text-emerald-600' : ''}`}>
              ${row.fha.toLocaleString()}
            </span>
            <span className={`text-right tabular-nums ${row.highlight && row.conv < 0 ? 'text-emerald-600' : ''}`}>
              ${row.conv.toLocaleString()}
            </span>
          </div>
          {i < rows.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  )
}
