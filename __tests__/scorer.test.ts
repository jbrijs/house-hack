import { describe, it, expect } from 'vitest'
import { scoreListing } from '@/lib/pipeline/scorer'
import type { ScoreInput } from '@/lib/pipeline/scorer'

const baseListing: ScoreInput = {
  bedrooms: 4,
  hasBasementApt: true,
  hasAdu: false,
  separateEntrance: true,
  propertyType: 'sfr',
  yearBuilt: 2005,
  daysOnMarket: 5,
  priceHistory: [{ price: 350000 }],
  county: 'utah_county',
  latitude: 40.252,
  longitude: -111.649,
  rentEstimate: 2000,
  pitiMonthlyFHA: 2400,
}

describe('scoreListing', () => {
  it('fails hard filter for 1-bed SFR and returns score 0', () => {
    const result = scoreListing({
      ...baseListing,
      bedrooms: 1,
      hasBasementApt: false,
      hasAdu: false,
      propertyType: 'sfr',
    })
    expect(result.passesFilter).toBe(false)
    expect(result.score).toBe(0)
    expect(result.recommendation).toBe('PASS')
  })

  it('scores cash flow: 80%+ ratio earns 40 pts', () => {
    const result = scoreListing({ ...baseListing, rentEstimate: 2400, pitiMonthlyFHA: 2400 })
    expect(result.cashFlowScore).toBe(40)
  })

  it('scores cash flow: 60-69% ratio earns 20 pts', () => {
    // rent=1500 / piti=2400 = 62.5% → 20 pts
    const result = scoreListing({ ...baseListing, rentEstimate: 1500, pitiMonthlyFHA: 2400 })
    expect(result.cashFlowScore).toBe(20)
  })

  it('scores layout: basement apt with separate entrance earns 28 pts', () => {
    const result = scoreListing(baseListing)
    expect(result.layoutScore).toBe(28)
  })

  it('scores layout: multi-unit earns 30 pts', () => {
    const result = scoreListing({ ...baseListing, propertyType: 'duplex' })
    expect(result.layoutScore).toBe(30)
  })

  it('returns BUY for high-scoring listing', () => {
    const result = scoreListing({ ...baseListing, rentEstimate: 2400, pitiMonthlyFHA: 2400 })
    expect(result.recommendation).toBe('BUY')
  })

  it('total score is sum of all four sub-scores', () => {
    const result = scoreListing(baseListing)
    expect(result.score).toBe(
      result.cashFlowScore + result.layoutScore + result.locationScore + result.riskScore
    )
  })
})
