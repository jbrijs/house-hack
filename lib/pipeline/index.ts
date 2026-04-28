import { createServiceClient } from '../supabase'
import { extractFeatures } from './features'
import { estimateRent } from './rent'
import { calculateFHA, calculateConventional } from './mortgage'
import { scoreListing } from './scorer'
import { sendBuyAlert } from './alert'
import type { Listing } from '../types'

export async function runPipeline(listingId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: listing, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (error || !listing) {
    console.error(`Pipeline: listing ${listingId} not found`, error)
    return
  }

  const l = listing as Listing

  // Step 1: LLM feature extraction
  if (l.description) {
    const features = await extractFeatures(l.description)
    await supabase
      .from('listings')
      .update({
        has_basement_apt: features.hasBasementApt,
        has_adu: features.hasAdu,
        separate_entrance: features.separateEntrance,
        parking_spaces: features.parkingSpaces,
      })
      .eq('id', listingId)
    l.has_basement_apt = features.hasBasementApt
    l.has_adu = features.hasAdu
    l.separate_entrance = features.separateEntrance
    l.parking_spaces = features.parkingSpaces
  }

  // Step 2: Rent estimation
  const rentResult = await estimateRent(
    l.zip ?? '',
    l.bedrooms ?? 0,
    l.has_basement_apt
  )

  // Step 3: Mortgage calculation
  const price = l.price ?? 0
  const fha = calculateFHA(price)
  const conventional = calculateConventional(price)

  // Steps 4-6: Score
  const scoreResult = scoreListing({
    bedrooms: l.bedrooms,
    hasBasementApt: l.has_basement_apt,
    hasAdu: l.has_adu,
    separateEntrance: l.separate_entrance,
    propertyType: l.property_type ?? 'sfr',
    yearBuilt: l.year_built,
    daysOnMarket: l.days_on_market,
    priceHistory: l.price_history,
    county: l.county ?? 'other',
    latitude: l.latitude,
    longitude: l.longitude,
    rentEstimate: rentResult.estimatedRent,
    pitiMonthlyFHA: fha.totalMonthlyPITI,
  })

  // Upsert score
  await supabase.from('listing_scores').upsert(
    {
      listing_id: listingId,
      score: scoreResult.score,
      cash_flow_score: scoreResult.cashFlowScore,
      layout_score: scoreResult.layoutScore,
      location_score: scoreResult.locationScore,
      risk_score: scoreResult.riskScore,
      rent_estimate: rentResult.estimatedRent,
      rent_confidence: rentResult.confidence,
      estimated_piti_fha: fha.totalMonthlyPITI,
      estimated_piti_conventional: conventional.totalMonthlyPITI,
      rent_to_piti_ratio: scoreResult.rentToPitiRatio,
      passes_filter: scoreResult.passesFilter,
      recommendation: scoreResult.recommendation,
      score_breakdown: scoreResult.scoreBreakdown,
      scored_at: new Date().toISOString(),
    },
    { onConflict: 'listing_id' }
  )

  // Step 7: Alert for new BUY listings
  if (scoreResult.recommendation === 'BUY') {
    const firstSeen = new Date(l.first_seen_at)
    const hoursOld = (Date.now() - firstSeen.getTime()) / 1000 / 3600
    if (hoursOld < 24) {
      await sendBuyAlert({
        address: l.address ?? 'Unknown address',
        price,
        score: scoreResult.score,
        rentEstimate: rentResult.estimatedRent,
        pitiMonthlyFHA: fha.totalMonthlyPITI,
        recommendation: scoreResult.recommendation,
        url: l.url,
        scoreBreakdown: scoreResult.scoreBreakdown,
      })
    }
  }
}
