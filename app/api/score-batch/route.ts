import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { runPipeline } from '@/lib/pipeline'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.headers.get('x-ingest-token') ?? ''
  const expected = process.env.INGEST_TOKEN ?? ''
  const tokenValid =
    token.length === expected.length &&
    expected.length > 0 &&
    timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(expected, 'utf8'))
  if (!tokenValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const batchSize = Math.min(Number(url.searchParams.get('n') ?? '10'), 20)

  const supabase = createServiceClient()

  // Get IDs that already have scores
  const { data: scoredRows } = await supabase
    .from('listing_scores')
    .select('listing_id')

  const scoredIds = (scoredRows ?? []).map(r => r.listing_id as string)

  // Count total active listings
  const { count: totalActive } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  const total = totalActive ?? 0

  // Find unscored listings
  let candidatesData: { id: string }[] | null = null
  let candidatesError: unknown = null

  if (scoredIds.length > 0) {
    const res = await supabase
      .from('listings')
      .select('id')
      .eq('status', 'active')
      .not('id', 'in', `(${scoredIds.map(id => `'${id}'`).join(',')})`)
      .limit(batchSize)
    candidatesData = res.data as { id: string }[] | null
    candidatesError = res.error
  } else {
    const res = await supabase
      .from('listings')
      .select('id')
      .eq('status', 'active')
      .limit(batchSize)
    candidatesData = res.data as { id: string }[] | null
    candidatesError = res.error
  }

  if (candidatesError) {
    console.error('Unscored query error:', candidatesError)
    return NextResponse.json({ error: String(candidatesError), scored: 0, remaining: total - scoredIds.length }, { status: 500 })
  }

  const unscored = candidatesData ?? []

  if (unscored.length === 0) {
    return NextResponse.json({ ok: true, scored: 0, remaining: Math.max(0, total - scoredIds.length) })
  }

  let scored = 0
  for (const { id } of unscored) {
    try {
      await runPipeline(id)
      scored++
    } catch (err) {
      console.error(`Pipeline failed for listing ${id}:`, err)
    }
  }

  const remaining = Math.max(0, total - scoredIds.length - scored)
  return NextResponse.json({ ok: true, scored, remaining })
}
