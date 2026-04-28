'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScoreBadge } from './ScoreBadge'
import type { ListingWithScore } from '@/lib/types'

interface Props {
  listing: ListingWithScore
  onInteraction: (listingId: string, status: string) => Promise<void>
}

const confidenceColor: Record<string, string> = {
  high: 'text-emerald-600',
  medium: 'text-amber-600',
  low: 'text-orange-500',
}

export function ListingCard({ listing, onInteraction }: Props) {
  const [loading, setLoading] = useState(false)
  const score = listing.listing_scores
  const interaction = listing.user_interactions

  async function handleAction(status: string) {
    setLoading(true)
    await onInteraction(listing.id, status)
    setLoading(false)
  }

  const rentToPiti = score?.rent_to_piti_ratio ? Math.round(score.rent_to_piti_ratio * 100) : null

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <Link
              href={`/listings/${listing.id}`}
              className="font-semibold text-sm hover:text-primary hover:underline leading-snug line-clamp-1"
            >
              {listing.address}
            </Link>
            <p className="text-xs text-muted-foreground mt-0.5">{listing.city}, UT {listing.zip}</p>
          </div>
          {score && (
            <ScoreBadge recommendation={score.recommendation as 'BUY' | 'WATCH' | 'PASS'} score={score.score} />
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="text-sm font-semibold">${listing.price?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Est. Rent</p>
            <p className="text-sm font-semibold">
              {score?.rent_estimate ? `$${score.rent_estimate.toLocaleString()}/mo` : '—'}
              {score?.rent_confidence && (
                <span className={`text-xs font-normal ml-1 ${confidenceColor[score.rent_confidence]}`}>
                  ({score.rent_confidence})
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rent/PITI</p>
            <p className={`text-sm font-semibold ${rentToPiti && rentToPiti >= 80 ? 'text-emerald-600' : rentToPiti && rentToPiti >= 60 ? 'text-amber-600' : 'text-muted-foreground'}`}>
              {rentToPiti !== null ? `${rentToPiti}%` : '—'}
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex gap-1.5 flex-wrap text-xs text-muted-foreground">
          <span>{listing.bedrooms}bd</span>
          <span>·</span>
          <span>{listing.bathrooms}ba</span>
          {listing.sqft && <><span>·</span><span>{listing.sqft.toLocaleString()} sqft</span></>}
          <span>·</span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-auto">
            {listing.property_type?.toUpperCase()}
          </Badge>
          <span>·</span>
          <span>{listing.days_on_market}d</span>
        </div>

        <div className="flex gap-2 items-center pt-0.5">
          {listing.url && (
            <a href={listing.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
              View source ↗
            </a>
          )}
          <div className="ml-auto flex gap-1">
            {(['interested', 'saved', 'pass'] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={interaction?.status === s ? 'default' : 'outline'}
                className="h-6 text-xs px-2"
                disabled={loading}
                onClick={() => handleAction(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
