import { passesHardFilter } from './filter'
import { scoreLocation } from '../geo'
import type { ScoreBreakdown, Recommendation } from '../types'

export interface ScoreInput {
  bedrooms: number | null
  hasBasementApt: boolean
  hasAdu: boolean
  separateEntrance: boolean
  propertyType: string
  yearBuilt: number | null
  daysOnMarket: number | null
  priceHistory: { price: number }[] | null
  county: string
  latitude: number | null
  longitude: number | null
  rentEstimate: number
  pitiMonthlyFHA: number
}

export interface ScoreResult {
  score: number
  cashFlowScore: number
  layoutScore: number
  locationScore: number
  riskScore: number
  rentToPitiRatio: number
  passesFilter: boolean
  recommendation: Recommendation
  scoreBreakdown: ScoreBreakdown
}

function computeCashFlow(rent: number, piti: number): { points: number; ratio: number } {
  const ratio = piti > 0 ? rent / piti : 0
  let points = 0
  if (ratio >= 0.8) points = 40
  else if (ratio >= 0.7) points = 30
  else if (ratio >= 0.6) points = 20
  else if (ratio >= 0.5) points = 10
  return { points, ratio: Math.round(ratio * 100) / 100 }
}

function computeLayout(input: ScoreInput): { points: number; reason: string } {
  const { propertyType, hasBasementApt, hasAdu, separateEntrance, bedrooms } = input
  if (['duplex', 'triplex', 'quad'].includes(propertyType))
    return { points: 30, reason: 'Multi-unit property' }
  if (hasBasementApt && separateEntrance)
    return { points: 28, reason: 'Basement apt with separate entrance' }
  if (hasAdu)
    return { points: 25, reason: 'ADU on property' }
  if (hasBasementApt)
    return { points: 22, reason: 'Basement apt (shared entrance)' }
  if ((bedrooms ?? 0) >= 4)
    return { points: 18, reason: '4+ bed SFR (roommate model)' }
  return { points: 12, reason: '3 bed SFR (roommate model)' }
}

function computeRisk(input: ScoreInput): { points: number; reasons: string[] } {
  let points = 0
  const reasons: string[] = []

  const year = input.yearBuilt ?? 0
  if (year >= 2000) { points += 5; reasons.push('Built 2000+') }
  else if (year >= 1980) { points += 3; reasons.push('Built 1980–1999') }

  const history = input.priceHistory ?? []
  const reductions = history.filter((h, i) => i > 0 && h.price > history[i - 1].price).length
  if (reductions === 0) { points += 3; reasons.push('No price reductions') }
  else if (reductions === 1) { points += 1; reasons.push('1 price reduction') }

  const dom = input.daysOnMarket ?? 0
  if (dom < 14) { points += 2; reasons.push('Fresh listing (<14 days)') }
  else if (dom < 30) { points += 1; reasons.push('Active listing (<30 days)') }

  return { points, reasons }
}

export function scoreListing(input: ScoreInput): ScoreResult {
  const passes = passesHardFilter({
    bedrooms: input.bedrooms,
    hasBasementApt: input.hasBasementApt,
    hasAdu: input.hasAdu,
    propertyType: input.propertyType,
  })

  if (!passes) {
    return {
      score: 0,
      cashFlowScore: 0,
      layoutScore: 0,
      locationScore: 0,
      riskScore: 0,
      rentToPitiRatio: 0,
      passesFilter: false,
      recommendation: 'PASS',
      scoreBreakdown: {
        cashFlow: { points: 0, ratio: 0 },
        layout: { points: 0, reason: 'Failed hard filter' },
        location: { points: 0, reasons: [] },
        risk: { points: 0, reasons: [] },
      },
    }
  }

  const cf = computeCashFlow(input.rentEstimate, input.pitiMonthlyFHA)
  const layout = computeLayout(input)
  const loc =
    input.latitude != null && input.longitude != null
      ? scoreLocation(input.latitude, input.longitude, input.county)
      : { points: 0, reasons: ['No coordinates'] }
  const risk = computeRisk(input)

  const score = cf.points + layout.points + loc.points + risk.points
  const recommendation: Recommendation =
    score >= 75 ? 'BUY' : score >= 50 ? 'WATCH' : 'PASS'

  return {
    score,
    cashFlowScore: cf.points,
    layoutScore: layout.points,
    locationScore: loc.points,
    riskScore: risk.points,
    rentToPitiRatio: cf.ratio,
    passesFilter: true,
    recommendation,
    scoreBreakdown: {
      cashFlow: cf,
      layout,
      location: loc,
      risk,
    },
  }
}
