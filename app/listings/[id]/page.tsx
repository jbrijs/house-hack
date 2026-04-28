import { createServiceClient } from '@/lib/supabase'
import { ScoreBadge } from '@/components/ScoreBadge'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { MortgageComparison } from '@/components/MortgageComparison'
import { RentCompsTable } from '@/components/RentCompsTable'
import { notFound } from 'next/navigation'
import type { ListingWithScore, RentComp } from '@/lib/types'

export default async function ListingDetail({ params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('*, listing_scores(*), user_interactions(*)')
    .eq('id', params.id)
    .single()

  if (!listing) notFound()

  const l = listing as ListingWithScore
  const score = l.listing_scores

  let comps: RentComp[] = []
  if (l.zip && l.bedrooms) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data } = await supabase
      .from('rent_comps')
      .select('*')
      .eq('zip', l.zip)
      .eq('is_active', true)
      .gte('last_seen_at', thirtyDaysAgo.toISOString())
      .gte('bedrooms', l.bedrooms - 1)
      .lte('bedrooms', l.bedrooms + 1)
      .limit(10)
    comps = (data as RentComp[]) ?? []
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{l.address}</h1>
          <p className="text-gray-500">{l.city}, UT {l.zip} · {l.county?.replace('_', ' ')}</p>
        </div>
        {score && (
          <ScoreBadge recommendation={score.recommendation as 'BUY' | 'WATCH' | 'PASS'} score={score.score} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">Property</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {([
                ['Price', l.price ? `$${l.price.toLocaleString()}` : '—'],
                ['Bedrooms', l.bedrooms ?? '—'],
                ['Bathrooms', l.bathrooms ?? '—'],
                ['Sqft', l.sqft ? l.sqft.toLocaleString() : '—'],
                ['Lot Sqft', l.lot_sqft ? l.lot_sqft.toLocaleString() : '—'],
                ['Year Built', l.year_built ?? '—'],
                ['Type', l.property_type?.toUpperCase() ?? '—'],
                ['Days on Market', l.days_on_market ?? '—'],
                ['Basement Apt', l.has_basement_apt ? 'Yes' : 'No'],
                ['ADU', l.has_adu ? 'Yes' : 'No'],
                ['Sep. Entrance', l.separate_entrance ? 'Yes' : 'No'],
                ['Parking', l.parking_spaces],
              ] as [string, string | number][]).map(([label, value]) => (
                <div key={label}>
                  <p className="text-gray-400 text-xs">{label}</p>
                  <p className="font-medium">{value}</p>
                </div>
              ))}
            </div>
            {l.url && (
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="mt-4 block text-sm text-blue-600 hover:underline">
                View on Zillow →
              </a>
            )}
          </section>

          {score?.score_breakdown && (
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">Score Breakdown</h2>
              <ScoreBreakdown breakdown={score.score_breakdown} total={score.score} />
            </section>
          )}
        </div>

        <div className="space-y-6">
          {score && l.price && score.estimated_piti_fha && score.estimated_piti_conventional && score.rent_estimate && (
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">Mortgage Scenarios</h2>
              <MortgageComparison
                price={l.price}
                pitiMonthlyFHA={score.estimated_piti_fha}
                pitiMonthlyConventional={score.estimated_piti_conventional}
                rentEstimate={score.rent_estimate}
              />
              <p className="text-xs text-gray-400 mt-3">
                Rent estimate confidence: <span className="font-medium">{score.rent_confidence?.toUpperCase()}</span>
                {score.rent_confidence === 'low' && ' — no recent comps, using baseline model'}
              </p>
            </section>
          )}

          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">
              Rental Comps ({comps.length})
            </h2>
            <RentCompsTable comps={comps} />
          </section>

          {l.description && (
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">Description</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{l.description}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
