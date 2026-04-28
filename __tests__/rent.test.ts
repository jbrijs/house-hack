import { describe, it, expect } from 'vitest'
import { median, baselineEstimate, estimateFromComps } from '@/lib/pipeline/rent'

describe('median', () => {
  it('returns middle value for odd-length array', () => {
    expect(median([900, 1100, 1000])).toBe(1000)
  })

  it('returns average of two middle values for even-length array', () => {
    expect(median([900, 1000, 1100, 1200])).toBe(1050)
  })

  it('handles single value', () => {
    expect(median([1000])).toBe(1000)
  })
})

describe('baselineEstimate', () => {
  it('returns basement flat rate for basement apt', () => {
    expect(baselineEstimate(4, true)).toBe(1250)
  })

  it('estimates room rent: owner takes master, rents remaining rooms at $700', () => {
    // 4 bed: owner takes master, 3 rooms × $700 = $2100
    expect(baselineEstimate(4, false)).toBe(2100)
  })

  it('estimates 3 bed: 2 rentable rooms × $700 = $1400', () => {
    expect(baselineEstimate(3, false)).toBe(1400)
  })

  it('returns 0 rentable rooms for 1 bed (owner takes only room)', () => {
    expect(baselineEstimate(1, false)).toBe(0)
  })
})

describe('estimateFromComps', () => {
  it('returns high confidence with 3+ comps and uses median', () => {
    const result = estimateFromComps([900, 1100, 1000], false, 3)
    expect(result.confidence).toBe('high')
    expect(result.estimatedRent).toBe(1000)
    expect(result.compsUsed).toBe(3)
  })

  it('returns medium confidence with 1-2 comps and uses average', () => {
    const result = estimateFromComps([900, 1100], false, 3)
    expect(result.confidence).toBe('medium')
    expect(result.estimatedRent).toBe(1000)
    expect(result.compsUsed).toBe(2)
  })

  it('returns low confidence with 0 comps and falls back to baseline', () => {
    const result = estimateFromComps([], false, 4)
    expect(result.confidence).toBe('low')
    expect(result.estimatedRent).toBe(2100) // 3 rooms × $700
    expect(result.compsUsed).toBe(0)
  })
})
