'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { PipelineBoard } from '@/components/PipelineBoard'
import type { ListingWithScore, InteractionStatus } from '@/lib/types'

export default function PipelinePage() {
  const [listings, setListings] = useState<ListingWithScore[]>([])
  const [loading, setLoading] = useState(true)

  const fetchListings = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('listings')
      .select('*, listing_scores(*), user_interactions!inner(*)')
      .not('user_interactions.status', 'eq', 'pass')
      .order('updated_at', { referencedTable: 'user_interactions', ascending: false })
    setListings((data as ListingWithScore[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchListings() }, [fetchListings])

  async function handleMove(listingId: string, status: InteractionStatus) {
    await fetch('/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId, status }),
    })
    fetchListings()
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Pipeline</h1>
      {listings.length === 0 ? (
        <p className="text-sm text-gray-400">No listings in your pipeline yet. Mark listings as &quot;interested&quot; or &quot;saved&quot; from the feed.</p>
      ) : (
        <PipelineBoard listings={listings} onMove={handleMove} />
      )}
    </div>
  )
}
