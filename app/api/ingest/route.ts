import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { normalizeZillowListing, normalizeZillowRental } from '@/lib/pipeline/normalizer'
import { runPipeline } from '@/lib/pipeline'

async function fetchApifyDataset(datasetId: string): Promise<Record<string, unknown>[]> {
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${process.env.APIFY_TOKEN}&limit=500`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Apify dataset fetch failed: ${res.status}`)
  return res.json()
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.headers.get('x-ingest-token')
  if (token !== process.env.INGEST_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const listingType = request.headers.get('x-listing-type') ?? 'for_sale'
  const body = await request.json()

  const datasetId = body?.eventData?.defaultDatasetId
  if (!datasetId) {
    return NextResponse.json({ error: 'No datasetId in payload' }, { status: 400 })
  }

  const supabase = createServiceClient()
  let processed = 0
  let scored = 0

  try {
    const items = await fetchApifyDataset(datasetId)

    if (listingType === 'rental') {
      for (const raw of items) {
        const normalized = normalizeZillowRental(raw)
        if (!normalized || !normalized.zip || !normalized.rent || !normalized.bedrooms) continue

        await supabase.from('rent_comps').upsert(
          {
            source_id: normalized.source_id,
            address: normalized.address,
            zip: normalized.zip,
            city: normalized.city,
            county: normalized.county,
            rent: normalized.rent,
            bedrooms: normalized.bedrooms,
            bathrooms: normalized.bathrooms,
            sqft: normalized.sqft,
            source: normalized.source,
            last_seen_at: new Date().toISOString(),
            is_active: true,
          },
          { onConflict: 'source,source_id' }
        )
        processed++
      }
    } else {
      for (const raw of items) {
        const normalized = normalizeZillowListing(raw)
        if (!normalized) continue

        const { data: existing } = await supabase
          .from('listings')
          .select('id, price')
          .eq('source', normalized.source)
          .eq('source_id', normalized.source_id)
          .single()

        const isNew = !existing
        const priceChanged = existing && existing.price !== normalized.price

        const { data: upserted } = await supabase
          .from('listings')
          .upsert(
            {
              ...normalized,
              last_seen_at: new Date().toISOString(),
              ...(isNew ? { first_seen_at: new Date().toISOString() } : {}),
            },
            { onConflict: 'source,source_id' }
          )
          .select('id')
          .single()

        if (upserted && (isNew || priceChanged)) {
          await runPipeline(upserted.id)
          scored++
        }
        processed++
      }
    }

    return NextResponse.json({ ok: true, processed, scored })
  } catch (err) {
    console.error('Ingest error:', err)
    return NextResponse.json({ error: 'Ingest failed' }, { status: 500 })
  }
}
