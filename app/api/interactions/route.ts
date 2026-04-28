import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import type { InteractionStatus } from '@/lib/types'

const VALID_STATUSES: InteractionStatus[] = [
  'interested', 'saved', 'pass', 'contacted', 'toured', 'offer_made',
]

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json()
  const { listing_id, status, notes } = body

  if (!listing_id || !status) {
    return NextResponse.json({ error: 'listing_id and status required' }, { status: 400 })
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('user_interactions')
    .upsert(
      { listing_id, status, notes: notes ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'listing_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const listingId = searchParams.get('listing_id')

  if (!listingId) {
    return NextResponse.json({ error: 'listing_id required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('user_interactions')
    .delete()
    .eq('listing_id', listingId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
