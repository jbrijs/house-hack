import { describe, it, expect } from 'vitest'
import { calculateFHA, calculateConventional } from '@/lib/pipeline/mortgage'

describe('calculateFHA', () => {
  it('computes correct down payment at 3.5%', () => {
    const result = calculateFHA(300000)
    expect(result.downPayment).toBe(10500)
  })

  it('computes correct loan amount', () => {
    const result = calculateFHA(300000)
    expect(result.loanAmount).toBe(289500)
  })

  it('computes monthly PI in expected range for $300k', () => {
    // At 6.75% for $289,500 over 30 years ≈ $1,878/mo
    const result = calculateFHA(300000)
    expect(result.monthlyPI).toBeGreaterThan(1850)
    expect(result.monthlyPI).toBeLessThan(1920)
  })

  it('computes tax+insurance as 1.2% annual / 12', () => {
    const result = calculateFHA(300000)
    expect(result.monthlyTaxInsurance).toBe(300)
  })

  it('computes MIP at 0.55% annual / 12', () => {
    const result = calculateFHA(300000)
    // 289500 * 0.0055 / 12 ≈ 133
    expect(result.monthlyMIP).toBeGreaterThan(125)
    expect(result.monthlyMIP).toBeLessThan(145)
  })

  it('total PITI is sum of components', () => {
    const result = calculateFHA(300000)
    expect(result.totalMonthlyPITI).toBe(
      result.monthlyPI + result.monthlyTaxInsurance + result.monthlyMIP
    )
  })
})

describe('calculateConventional', () => {
  it('computes correct down payment at 5%', () => {
    const result = calculateConventional(300000)
    expect(result.downPayment).toBe(15000)
  })

  it('has no MIP', () => {
    const result = calculateConventional(300000)
    expect(result.monthlyMIP).toBe(0)
  })

  it('total PITI is PI plus tax+insurance only', () => {
    const result = calculateConventional(300000)
    expect(result.totalMonthlyPITI).toBe(result.monthlyPI + result.monthlyTaxInsurance)
  })
})
