'use client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScoreBadge } from './ScoreBadge'
import type { ListingWithScore, InteractionStatus } from '@/lib/types'

const COLUMNS: { status: InteractionStatus; label: string }[] = [
  { status: 'interested', label: 'Interested' },
  { status: 'saved', label: 'Saved' },
  { status: 'toured', label: 'Toured' },
  { status: 'contacted', label: 'Contacted Agent' },
  { status: 'offer_made', label: 'Offer Made' },
]

interface Props {
  listings: ListingWithScore[]
  onMove: (listingId: string, status: InteractionStatus) => Promise<void>
}

export function PipelineBoard({ listings, onMove }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {COLUMNS.map((col) => {
        const colListings = listings.filter((l) => l.user_interactions?.status === col.status)
        return (
          <div key={col.status} className="min-h-[200px]">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-semibold text-sm">{col.label}</h3>
              <Badge variant="secondary" className="h-5 text-xs px-1.5">{colListings.length}</Badge>
            </div>
            <div className="space-y-2">
              {colListings.map((l) => (
                <Card key={l.id} className="shadow-none">
                  <CardContent className="p-3 space-y-2">
                    <p className="font-medium text-xs leading-snug">{l.address}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">${l.price?.toLocaleString()}</span>
                      {l.listing_scores && (
                        <ScoreBadge
                          recommendation={l.listing_scores.recommendation as 'BUY' | 'WATCH' | 'PASS'}
                          score={l.listing_scores.score}
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {COLUMNS.filter((c) => c.status !== col.status).map((c) => (
                        <Button
                          key={c.status}
                          variant="outline"
                          size="sm"
                          className="h-5 text-xs px-1.5 font-normal"
                          onClick={() => onMove(l.id, c.status)}
                        >
                          → {c.label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
