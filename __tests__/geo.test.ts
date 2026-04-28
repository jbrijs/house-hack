import { describe, it, expect } from 'vitest'
import { haversineDistanceMiles, scoreLocation } from '@/lib/geo'

describe('haversineDistanceMiles', () => {
  it('returns ~0 for identical coords', () => {
    expect(haversineDistanceMiles(40.2508, -111.6493, 40.2508, -111.6493)).toBeCloseTo(0)
  })

  it('returns ~3-5 miles between BYU and UVU', () => {
    // BYU (40.2508, -111.6493) to UVU (40.2969, -111.6942) ≈ 3.8 miles
    const dist = haversineDistanceMiles(40.2508, -111.6493, 40.2969, -111.6942)
    expect(dist).toBeGreaterThan(3)
    expect(dist).toBeLessThan(5)
  })
})

describe('scoreLocation', () => {
  it('awards 10 points for property within 2 miles of BYU', () => {
    // Address right next to BYU in Provo
    const result = scoreLocation(40.252, -111.649, 'utah_county')
    expect(result.points).toBeGreaterThanOrEqual(10)
    expect(result.reasons).toContain('Near university (BYU/UVU/U of U)')
  })

  it('awards 3 points for Salt Lake County with no other signals', () => {
    // Remote SLC address far from everything
    const result = scoreLocation(40.6, -111.95, 'salt_lake')
    expect(result.reasons).toContain('Salt Lake County (larger renter pool)')
    expect(result.points).toBeGreaterThanOrEqual(3)
  })

  it('caps total at 20 even when multiple signals fire', () => {
    const result = scoreLocation(40.2508, -111.6493, 'utah_county')
    expect(result.points).toBeLessThanOrEqual(20)
  })

  it('returns 0 points for a rural address with no signals', () => {
    // Somewhere rural in Utah not near anything
    const result = scoreLocation(39.5, -110.5, 'other')
    expect(result.points).toBe(0)
  })
})
