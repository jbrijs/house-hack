import { createServiceClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScoreBadge } from '@/components/ScoreBadge'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { MortgageComparison } from '@/components/MortgageComparison'
import { RentCompsTable } from '@/components/RentCompsTable'
import { notFound } from 'next/navigation'
import Link from 'next/link'
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

  const details: [string, string | number | undefined | null][] = [
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
    ['Parking', l.parking_spaces ?? '—'],
  ]

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h1 className="text-xl font-bold leading-tight">{l.address}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {l.city}, UT {l.zip}
              <span className="mx-1.5">·</span>
              <span className="capitalize">{l.county?.replace('_', ' ')}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {score && (
              <ScoreBadge recommendation={score.recommendation as 'BUY' | 'WATCH' | 'PASS'} score={score.score} />
            )}
            {l.url && (
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                <Badge variant="outline" className="font-normal hover:bg-accent cursor-pointer">View on Zillow ↗</Badge>
              </a>
            )}
          </div>
        </div>
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to listings</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Property Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {details.map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-medium">{value as string}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {score?.score_breakdown && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScoreBreakdown breakdown={score.score_breakdown} total={score.score} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {score && l.price && score.estimated_piti_fha && score.estimated_piti_conventional && score.rent_estimate && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Mortgage Scenarios</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <MortgageComparison
                  price={l.price}
                  pitiMonthlyFHA={score.estimated_piti_fha}
                  pitiMonthlyConventional={score.estimated_piti_conventional}
                  rentEstimate={score.rent_estimate}
                />
                <p className="text-xs text-muted-foreground">
                  Rent confidence:{' '}
                  <span className="font-medium">{score.rent_confidence?.toUpperCase()}</span>
                  {score.rent_confidence === 'low' && ' — no recent comps, using baseline model'}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Rental Comps ({comps.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <RentCompsTable comps={comps} />
            </CardContent>
          </Card>

          {l.description && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Description</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground leading-relaxed">{l.description}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
