import type { County, PropertyType } from '../types'

const UTAH_COUNTY_ZIP_PREFIXES = ['846']
const SALT_LAKE_ZIP_PREFIXES = ['840', '841', '842', '843', '844']

function determineCounty(zip: string | null): County {
  if (!zip) return 'other'
  if (UTAH_COUNTY_ZIP_PREFIXES.some((p) => zip.startsWith(p))) return 'utah_county'
  if (SALT_LAKE_ZIP_PREFIXES.some((p) => zip.startsWith(p))) return 'salt_lake'
  return 'other'
}

function normalizePropertyType(homeType: string): PropertyType {
  const map: Record<string, PropertyType> = {
    SINGLE_FAMILY: 'sfr',
    MULTI_FAMILY: 'duplex',
    CONDO: 'condo',
    TOWNHOUSE: 'sfr',
    MANUFACTURED: 'sfr',
    LOT: 'sfr',
  }
  return map[homeType?.toUpperCase()] ?? 'sfr'
}

export interface NormalizedListing {
  source: string
  source_id: string
  url: string | null
  address: string | null
  city: string | null
  zip: string | null
  county: County
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  lot_sqft: number | null
  year_built: number | null
  property_type: PropertyType
  latitude: number | null
  longitude: number | null
  description: string | null
  days_on_market: number | null
  price_history: { price: number; date: string }[] | null
  status: 'active' | 'pending' | 'sold'
}

export function normalizeZillowListing(raw: Record<string, unknown>): NormalizedListing | null {
  const sourceId = String(raw.zpid ?? raw.id ?? '')
  if (!sourceId) return null

  const zip = String(raw.zipcode ?? raw.zip ?? '')
  const statusMap: Record<string, 'active' | 'pending' | 'sold'> = {
    FOR_SALE: 'active',
    PENDING: 'pending',
    RECENTLY_SOLD: 'sold',
  }
  const rawStatus = String(raw.homeStatus ?? raw.status ?? 'FOR_SALE').toUpperCase()

  const rawUrl = String(raw.url ?? raw.detailUrl ?? raw.hdpUrl ?? '')
  const url = rawUrl
    ? rawUrl.startsWith('http') ? rawUrl : `https://www.zillow.com${rawUrl}`
    : null

  return {
    source: 'zillow',
    source_id: sourceId,
    url,
    address: String(raw.streetAddress ?? raw.address ?? '').trim() || null,
    city: String(raw.city ?? '').trim() || null,
    zip: zip || null,
    county: determineCounty(zip),
    price: Number(raw.price ?? raw.unformattedPrice ?? 0) || null,
    bedrooms: Number(raw.bedrooms ?? raw.beds ?? 0) || null,
    bathrooms: Number(raw.bathrooms ?? raw.baths ?? 0) || null,
    sqft: Number(raw.livingArea ?? raw.sqft ?? 0) || null,
    lot_sqft: Number(raw.lotAreaValue ?? raw.lotSize ?? 0) || null,
    year_built: Number(raw.yearBuilt ?? 0) || null,
    property_type: normalizePropertyType(String(raw.homeType ?? 'SINGLE_FAMILY')),
    latitude: Number(raw.latitude ?? raw.lat ?? 0) || null,
    longitude: Number(raw.longitude ?? raw.lng ?? 0) || null,
    description: String(raw.description ?? raw.homeDescription ?? '').trim() || null,
    days_on_market: Number(raw.daysOnZillow ?? raw.daysOnMarket ?? 0) || null,
    price_history: Array.isArray(raw.priceHistory)
      ? (raw.priceHistory as { price: number; date: string }[])
      : null,
    status: statusMap[rawStatus] ?? 'active',
  }
}

export function normalizeZillowRental(raw: Record<string, unknown>): {
  source_id: string
  address: string | null
  zip: string | null
  city: string | null
  county: County
  rent: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  source: string
} | null {
  const sourceId = String(raw.zpid ?? raw.id ?? '')
  if (!sourceId) return null

  const zip = String(raw.zipcode ?? raw.zip ?? '')
  const rent = Number(raw.price ?? raw.rentZestimate ?? raw.rent ?? 0)
  if (!rent) return null

  return {
    source_id: sourceId,
    address: String(raw.streetAddress ?? raw.address ?? '').trim() || null,
    zip: zip || null,
    city: String(raw.city ?? '').trim() || null,
    county: determineCounty(zip),
    rent,
    bedrooms: Number(raw.bedrooms ?? raw.beds ?? 0) || null,
    bathrooms: Number(raw.bathrooms ?? raw.baths ?? 0) || null,
    sqft: Number(raw.livingArea ?? raw.sqft ?? 0) || null,
    source: 'zillow_rentals',
  }
}
