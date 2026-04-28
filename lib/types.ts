export type County = 'utah_county' | 'salt_lake' | 'other'
export type PropertyType = 'sfr' | 'duplex' | 'triplex' | 'quad' | 'condo'
export type ListingStatus = 'active' | 'pending' | 'sold'
export type RentConfidence = 'low' | 'medium' | 'high'
export type Recommendation = 'BUY' | 'WATCH' | 'PASS'
export type InteractionStatus =
  | 'interested'
  | 'saved'
  | 'pass'
  | 'contacted'
  | 'toured'
  | 'offer_made'

export interface Listing {
  id: string
  source: string
  source_id: string
  url: string | null
  address: string | null
  city: string | null
  zip: string | null
  county: County | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  lot_sqft: number | null
  year_built: number | null
  property_type: PropertyType | null
  has_basement_apt: boolean
  has_adu: boolean
  separate_entrance: boolean
  parking_spaces: number
  latitude: number | null
  longitude: number | null
  description: string | null
  days_on_market: number | null
  price_history: { price: number; date: string }[] | null
  first_seen_at: string
  last_seen_at: string
  status: ListingStatus
}

export interface ListingScore {
  id: string
  listing_id: string
  score: number
  cash_flow_score: number
  layout_score: number
  location_score: number
  risk_score: number
  rent_estimate: number | null
  rent_confidence: RentConfidence | null
  estimated_piti_fha: number | null
  estimated_piti_conventional: number | null
  rent_to_piti_ratio: number | null
  passes_filter: boolean
  recommendation: Recommendation
  score_breakdown: ScoreBreakdown | null
  scored_at: string
}

export interface ScoreBreakdown {
  cashFlow: { points: number; ratio: number }
  layout: { points: number; reason: string }
  location: { points: number; reasons: string[] }
  risk: { points: number; reasons: string[] }
}

export interface RentComp {
  id: string
  source_id: string
  address: string | null
  zip: string
  city: string | null
  county: string | null
  rent: number
  bedrooms: number
  bathrooms: number | null
  sqft: number | null
  source: string
  first_seen_at: string
  last_seen_at: string
  is_active: boolean
}

export interface UserInteraction {
  id: string
  listing_id: string
  status: InteractionStatus
  notes: string | null
  updated_at: string
}

export interface ListingWithScore extends Listing {
  listing_scores: ListingScore | null
  user_interactions: UserInteraction | null
}
