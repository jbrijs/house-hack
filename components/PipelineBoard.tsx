'use client'
import type { ListingWithScore, InteractionStatus } from '@/lib/types'

const COLUMNS: { status: InteractionStatus; label: string }[] = [
  { status: 'interested', label: 'Interested' },
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
    <div className="grid grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colListings = listings.filter((l) => l.user_interactions?.status === col.status)
        return (
          <div key={col.status} className="bg-gray-100 rounded-lg p-3 min-h-[200px]">
            <h3 className="font-semibold text-sm text-gray-700 mb-3">
              {col.label} <span className="text-gray-400">({colListings.length})</span>
            </h3>
            <div className="space-y-2">
              {colListings.map((l) => (
                <div key={l.id} className="bg-white rounded border border-gray-200 p-3 text-xs">
                  <p className="font-medium text-gray-900 mb-1">{l.address}</p>
                  <p className="text-gray-500">${l.price?.toLocaleString()}</p>
                  {l.listing_scores && (
                    <p className="text-gray-500">Score: {l.listing_scores.score}/100</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {COLUMNS.filter((c) => c.status !== col.status).map((c) => (
                      <button
                        key={c.status}
                        onClick={() => onMove(l.id, c.status)}
                        className="text-xs px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 hover:border-gray-400"
                      >
                        → {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
