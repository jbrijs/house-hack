import { createServiceClient } from '../supabase'

export interface RentEstimate {
  estimatedRent: number
  confidence: 'low' | 'medium' | 'high'
  compsUsed: number
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export function baselineEstimate(bedrooms: number, hasBasementApt: boolean): number {
  if (hasBasementApt) return 1250
  const rentableRooms = Math.max(0, bedrooms - 1)
  return rentableRooms * 700
}

export function estimateFromComps(
  compRents: number[],
  hasBasementApt: boolean,
  bedrooms: number
): RentEstimate {
  if (compRents.length >= 3) {
    return { estimatedRent: median(compRents), confidence: 'high', compsUsed: compRents.length }
  }
  if (compRents.length >= 1) {
    const avg = Math.round(compRents.reduce((a, b) => a + b, 0) / compRents.length)
    return { estimatedRent: avg, confidence: 'medium', compsUsed: compRents.length }
  }
  return {
    estimatedRent: baselineEstimate(bedrooms, hasBasementApt),
    confidence: 'low',
    compsUsed: 0,
  }
}

export async function estimateRent(
  zip: string,
  bedrooms: number,
  hasBasementApt: boolean
): Promise<RentEstimate> {
  const supabase = createServiceClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: comps } = await supabase
    .from('rent_comps')
    .select('rent')
    .eq('zip', zip)
    .eq('is_active', true)
    .gte('last_seen_at', thirtyDaysAgo.toISOString())
    .gte('bedrooms', bedrooms - 1)
    .lte('bedrooms', bedrooms + 1)

  const rents = (comps ?? []).map((c) => c.rent as number)
  return estimateFromComps(rents, hasBasementApt, bedrooms)
}
