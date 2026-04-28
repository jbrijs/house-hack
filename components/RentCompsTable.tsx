import type { RentComp } from '@/lib/types'
import { Separator } from '@/components/ui/separator'

export function RentCompsTable({ comps }: { comps: RentComp[] }) {
  if (comps.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent rental comps found — estimate uses baseline model.</p>
  }
  return (
    <div className="space-y-0">
      <div className="grid grid-cols-3 text-xs text-muted-foreground font-medium pb-2 border-b">
        <span>Address</span>
        <span className="text-right">Beds</span>
        <span className="text-right">Rent/mo</span>
      </div>
      {comps.map((comp, i) => (
        <div key={comp.id}>
          <div className="grid grid-cols-3 py-2 text-sm">
            <span className="truncate text-foreground">{comp.address ?? comp.city}</span>
            <span className="text-right text-muted-foreground tabular-nums">{comp.bedrooms}</span>
            <span className="text-right font-medium tabular-nums">${comp.rent.toLocaleString()}</span>
          </div>
          {i < comps.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  )
}
