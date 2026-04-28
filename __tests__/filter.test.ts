import { describe, it, expect } from 'vitest'
import { passesHardFilter } from '@/lib/pipeline/filter'

describe('passesHardFilter', () => {
  it('passes a 3-bedroom SFR', () => {
    expect(passesHardFilter({ bedrooms: 3, hasBasementApt: false, hasAdu: false, propertyType: 'sfr' })).toBe(true)
  })

  it('passes a 2-bedroom with basement apt', () => {
    expect(passesHardFilter({ bedrooms: 2, hasBasementApt: true, hasAdu: false, propertyType: 'sfr' })).toBe(true)
  })

  it('passes a duplex regardless of bed count', () => {
    expect(passesHardFilter({ bedrooms: 2, hasBasementApt: false, hasAdu: false, propertyType: 'duplex' })).toBe(true)
  })

  it('passes with ADU', () => {
    expect(passesHardFilter({ bedrooms: 2, hasBasementApt: false, hasAdu: true, propertyType: 'sfr' })).toBe(true)
  })

  it('fails a 2-bedroom SFR with no special features', () => {
    expect(passesHardFilter({ bedrooms: 2, hasBasementApt: false, hasAdu: false, propertyType: 'sfr' })).toBe(false)
  })

  it('fails a 1-bedroom condo', () => {
    expect(passesHardFilter({ bedrooms: 1, hasBasementApt: false, hasAdu: false, propertyType: 'condo' })).toBe(false)
  })
})
