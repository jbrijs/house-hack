'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { ListingCard } from '@/components/ListingCard'
import { FilterBar } from '@/components/FilterBar'
import type { Filters } from '@/components/FilterBar'
import type { ListingWithScore } from '@/lib/types'

const DEFAULT_FILTERS: Filters = {
  county: '',
  propertyType: '',
  recommendation: '',
  maxPrice: '',
  minScore: '',
}

export default function ListingsFeed() {
  const [listings, setListings] = useState<ListingWithScore[]>([])
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)

  const fetchListings = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('listings')
      .select('*, listing_scores(*), user_interactions(*)')
      .eq('status', 'active')
      .order('score', { referencedTable: 'listing_scores', ascending: false })
      .limit(100)

    if (filters.county) query = query.eq('county', filters.county)
    if (filters.propertyType) query = query.eq('property_type', filters.propertyType)
    if (filters.maxPrice) query = query.lte('price', Number(filters.maxPrice))

    const { data } = await query
    let results = (data as ListingWithScore[]) ?? []

    if (filters.recommendation) {
      results = results.filter((l) => l.listing_scores?.recommendation === filters.recommendation)
    }
    if (filters.minScore) {
      results = results.filter((l) => (l.listing_scores?.score ?? 0) >= Number(filters.minScore))
    }
    results = results.filter((l) => l.listing_scores?.passes_filter === true)

    setListings(results)
    setLoading(false)
  }, [filters])

  useEffect(() => { fetchListings() }, [fetchListings])

  async function handleInteraction(listingId: string, status: string) {
    await fetch('/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId, status }),
    })
    fetchListings()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Listings</h1>
        <span className="text-sm text-muted-foreground">
          {loading ? 'Loading...' : `${listings.length} results`}
        </span>
      </div>
      <FilterBar filters={filters} onChange={setFilters} />
      {!loading && listings.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-8 text-center">
          No listings match your filters. Check back after the next scrape run.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} onInteraction={handleInteraction} />
          ))}
        </div>
      )}
    </div>
  )
}
