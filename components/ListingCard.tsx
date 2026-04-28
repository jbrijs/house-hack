'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ScoreBadge } from './ScoreBadge'
import type { ListingWithScore } from '@/lib/types'

interface Props {
  listing: ListingWithScore
  onInteraction: (listingId: string, status: string) => Promise<void>
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div>
          <Link href={`/listings/${listing.id}`} className="font-semibold text-gray-900 text-sm hover:text-blue-600 hover:underline">
            {listing.address}
          </Link>
          <p className="text-xs text-gray-500">{listing.city}, UT {listing.zip}</p>
        </div>
        {score && (
          <ScoreBadge recommendation={score.recommendation as 'BUY' | 'WATCH' | 'PASS'} score={score.score} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-3">
        <div>
          <span className="font-medium text-gray-900">${listing.price?.toLocaleString()}</span>
          <br />price
        </div>
        <div>
          <span className="font-medium text-gray-900">${score?.rent_estimate?.toLocaleString()}/mo</span>
          <br />est. rent
          {score?.rent_confidence === 'low' && <span className="text-orange-500"> (est)</span>}
        </div>
        <div>
          <span className="font-medium text-gray-900">
            {score && score.rent_to_piti_ratio ? Math.round(score.rent_to_piti_ratio * 100) : '—'}%
          </span>
          <br />rent/PITI
        </div>
      </div>

      <div className="flex gap-1 text-xs text-gray-500 mb-3">
        <span>{listing.bedrooms}bd</span>
        <span>·</span>
        <span>{listing.bathrooms}ba</span>
        <span>·</span>
        <span>{listing.sqft?.toLocaleString()} sqft</span>
        <span>·</span>
        <span>{listing.property_type?.toUpperCase()}</span>
        <span>·</span>
        <span>{listing.days_on_market}d on market</span>
      </div>

      <div className="flex gap-2 items-center">
        {listing.url && (
          <a href={listing.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
            View →
          </a>
        )}
        <div className="ml-auto flex gap-1">
          {(['interested', 'saved', 'pass'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleAction(s)}
              disabled={loading}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                interaction?.status === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
