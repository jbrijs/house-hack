# House Hack Intelligence System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully automated real estate deal-scoring system that scrapes Utah County and Salt Lake County listings twice daily, scores them for house-hack potential, and surfaces the best opportunities in a Next.js dashboard with email alerts.

**Architecture:** GitHub Actions triggers Apify actors (Zillow + Realtor.com for-sale, Zillow rentals) on a cron schedule. Apify fires a webhook to `/api/ingest` on Vercel when each run completes. The ingest endpoint fetches items from Apify's dataset API, normalizes them, runs the scoring pipeline (LLM feature extraction → hard filter → rent estimation → mortgage calc → scoring), and stores results in Supabase. High-scoring new listings trigger a Resend email alert.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Supabase (Postgres), Apify, OpenAI (`gpt-4o-mini`), Resend, Vercel, GitHub Actions, Vitest

---

## Phase 1: Foundation

### Task 1: Scaffold Next.js project + install dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.local` (template), `.gitignore`

- [ ] **Step 1: Initialize Next.js project inside the existing directory**

```bash
cd /Users/joebrijs/house-hack
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*" --use-npm
```

When prompted: accept all defaults. Say "yes" to overwrite the existing directory (only docs/ is there).

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js openai resend
npm install -D vitest @vitest/ui
```

- [ ] **Step 3: Add vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Create .env.local template**

Create `.env.local` (never commit this):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
INGEST_TOKEN=generate-a-random-32-char-string
ALERT_EMAIL=joebrijs@gmail.com
APIFY_TOKEN=apify_api_...
```

- [ ] **Step 6: Add .env.local to .gitignore**

Verify `.gitignore` already contains `.env.local` (create-next-app adds it). If not, add it.

- [ ] **Step 7: Verify project runs**

```bash
npm run dev
```
Expected: server starts at `http://localhost:3000` with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

### Task 2: Supabase schema migration

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/001_initial_schema.sql`:
```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- listings: one row per property, upserted each scrape
create table if not exists listings (
  id uuid primary key default uuid_generate_v4(),
  source text not null,                    -- zillow / realtor
  source_id text not null,                 -- their listing ID
  url text,
  address text,
  city text,
  zip text,
  county text,                             -- utah_county / salt_lake / other
  price integer,
  bedrooms integer,
  bathrooms numeric,
  sqft integer,
  lot_sqft integer,
  year_built integer,
  property_type text,                      -- sfr / duplex / triplex / quad / condo
  has_basement_apt boolean default false,
  has_adu boolean default false,
  separate_entrance boolean default false,
  parking_spaces integer default 0,
  latitude numeric,
  longitude numeric,
  description text,
  days_on_market integer,
  price_history jsonb,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  status text default 'active',            -- active / pending / sold
  unique(source, source_id)
);

-- listing_scores: computed score per listing, one row per listing
create table if not exists listing_scores (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references listings(id) on delete cascade,
  score integer not null default 0,
  cash_flow_score integer not null default 0,
  layout_score integer not null default 0,
  location_score integer not null default 0,
  risk_score integer not null default 0,
  rent_estimate integer,
  rent_confidence text,                    -- low / medium / high
  estimated_piti_fha integer,
  estimated_piti_conventional integer,
  rent_to_piti_ratio numeric,
  passes_filter boolean not null default false,
  recommendation text not null default 'PASS', -- BUY / WATCH / PASS
  score_breakdown jsonb,
  scored_at timestamptz default now(),
  unique(listing_id)
);

-- rent_comps: active rental listings, keyed by zip+bedrooms, not tied to a specific for-sale listing
create table if not exists rent_comps (
  id uuid primary key default uuid_generate_v4(),
  source_id text not null,
  address text,
  zip text not null,
  city text,
  county text,
  rent integer not null,
  bedrooms integer not null,
  bathrooms numeric,
  sqft integer,
  source text not null,                    -- zillow_rentals
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  is_active boolean default true,
  unique(source, source_id)
);

-- user_interactions: personal pipeline tracking
create table if not exists user_interactions (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references listings(id) on delete cascade,
  status text not null,                    -- interested / saved / pass / contacted / toured / offer_made
  notes text,
  updated_at timestamptz default now(),
  unique(listing_id)
);

-- Indexes for common queries
create index if not exists idx_listings_county on listings(county);
create index if not exists idx_listings_status on listings(status);
create index if not exists idx_listing_scores_recommendation on listing_scores(recommendation);
create index if not exists idx_listing_scores_score on listing_scores(score desc);
create index if not exists idx_listing_scores_passes_filter on listing_scores(passes_filter);
create index if not exists idx_rent_comps_zip_beds on rent_comps(zip, bedrooms);
create index if not exists idx_rent_comps_active on rent_comps(is_active, last_seen_at desc);
```

- [ ] **Step 2: Create a Supabase project**

Go to https://supabase.com, create a new project named `house-hack`. Choose the closest region (US West). Save the project URL and anon key into `.env.local`.

- [ ] **Step 3: Run the migration**

In the Supabase dashboard → SQL Editor → paste the full SQL from `001_initial_schema.sql` → click Run.

Expected: no errors, all tables visible in the Table Editor.

- [ ] **Step 4: Copy service role key**

In Supabase dashboard → Project Settings → API → copy the `service_role` key into `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase schema migration"
```

---

### Task 3: TypeScript types + Supabase client

**Files:**
- Create: `lib/types.ts`
- Create: `lib/supabase.ts`

- [ ] **Step 1: Write types**

Create `lib/types.ts`:
```typescript
export type County = 'utah_county' | 'salt_lake' | 'other'
export type PropertyType = 'sfr' | 'duplex' | 'triplex' | 'quad' | 'condo'
export type ListingStatus = 'active' | 'pending' | 'sold'
export type RentConfidence = 'low' | 'medium' | 'high'
export type Recommendation = 'BUY' | 'WATCH' | 'PASS'
export type InteractionStatus =
  | 'interested'
  | 'saved'
  | 'pass'
  | 'contacted'
  | 'toured'
  | 'offer_made'

export interface Listing {
  id: string
  source: string
  source_id: string
  url: string | null
  address: string | null
  city: string | null
  zip: string | null
  county: County | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  lot_sqft: number | null
  year_built: number | null
  property_type: PropertyType | null
  has_basement_apt: boolean
  has_adu: boolean
  separate_entrance: boolean
  parking_spaces: number
  latitude: number | null
  longitude: number | null
  description: string | null
  days_on_market: number | null
  price_history: { price: number; date: string }[] | null
  first_seen_at: string
  last_seen_at: string
  status: ListingStatus
}

export interface ListingScore {
  id: string
  listing_id: string
  score: number
  cash_flow_score: number
  layout_score: number
  location_score: number
  risk_score: number
  rent_estimate: number | null
  rent_confidence: RentConfidence | null
  estimated_piti_fha: number | null
  estimated_piti_conventional: number | null
  rent_to_piti_ratio: number | null
  passes_filter: boolean
  recommendation: Recommendation
  score_breakdown: ScoreBreakdown | null
  scored_at: string
}

export interface ScoreBreakdown {
  cashFlow: { points: number; ratio: number }
  layout: { points: number; reason: string }
  location: { points: number; reasons: string[] }
  risk: { points: number; reasons: string[] }
}

export interface RentComp {
  id: string
  source_id: string
  address: string | null
  zip: string
  city: string | null
  county: string | null
  rent: number
  bedrooms: number
  bathrooms: number | null
  sqft: number | null
  source: string
  first_seen_at: string
  last_seen_at: string
  is_active: boolean
}

export interface UserInteraction {
  id: string
  listing_id: string
  status: InteractionStatus
  notes: string | null
  updated_at: string
}

// Joined type used in the dashboard
export interface ListingWithScore extends Listing {
  listing_scores: ListingScore | null
  user_interactions: UserInteraction | null
}
```

- [ ] **Step 2: Write Supabase client**

Create `lib/supabase.ts`:
```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Browser-safe client (uses anon key)
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Server-only client (uses service role key, bypasses RLS)
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/
git commit -m "feat: add TypeScript types and Supabase clients"
```

---

## Phase 2: Core Pipeline (TDD)

### Task 4: Mortgage calculator

**Files:**
- Create: `lib/pipeline/mortgage.ts`
- Create: `__tests__/mortgage.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/mortgage.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npm test -- mortgage
```
Expected: FAIL — `Cannot find module '@/lib/pipeline/mortgage'`

- [ ] **Step 3: Implement the mortgage calculator**

Create `lib/pipeline/mortgage.ts`:
```typescript
export interface MortgageResult {
  downPayment: number
  loanAmount: number
  monthlyPI: number
  monthlyTaxInsurance: number
  monthlyMIP: number
  totalMonthlyPITI: number
}

function monthlyPayment(principal: number, annualRate: number, months: number): number {
  const r = annualRate / 12
  return Math.round((principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1))
}

export function calculateFHA(price: number): MortgageResult {
  const downPayment = Math.round(price * 0.035)
  const loanAmount = price - downPayment
  const monthlyPI = monthlyPayment(loanAmount, 0.0675, 360)
  const monthlyTaxInsurance = Math.round((price * 0.012) / 12)
  const monthlyMIP = Math.round((loanAmount * 0.0055) / 12)
  return {
    downPayment,
    loanAmount,
    monthlyPI,
    monthlyTaxInsurance,
    monthlyMIP,
    totalMonthlyPITI: monthlyPI + monthlyTaxInsurance + monthlyMIP,
  }
}

export function calculateConventional(price: number): MortgageResult {
  const downPayment = Math.round(price * 0.05)
  const loanAmount = price - downPayment
  const monthlyPI = monthlyPayment(loanAmount, 0.06875, 360)
  const monthlyTaxInsurance = Math.round((price * 0.012) / 12)
  return {
    downPayment,
    loanAmount,
    monthlyPI,
    monthlyTaxInsurance,
    monthlyMIP: 0,
    totalMonthlyPITI: monthlyPI + monthlyTaxInsurance,
  }
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- mortgage
```
Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/mortgage.ts __tests__/mortgage.test.ts
git commit -m "feat: add mortgage calculator with tests"
```

---

### Task 5: Rent estimator

**Files:**
- Create: `lib/pipeline/rent.ts`
- Create: `__tests__/rent.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/rent.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- rent
```
Expected: FAIL — `Cannot find module '@/lib/pipeline/rent'`

- [ ] **Step 3: Implement rent estimator**

Create `lib/pipeline/rent.ts`:
```typescript
import { createServiceClient } from '../supabase'

export interface RentEstimate {
  estimatedRent: number
  confidence: 'low' | 'medium' | 'high'
  compsUsed: number
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export function baselineEstimate(bedrooms: number, hasBasementApt: boolean): number {
  if (hasBasementApt) return 1250
  const rentableRooms = Math.max(0, bedrooms - 1)
  return rentableRooms * 700
}

export function estimateFromComps(
  compRents: number[],
  hasBasementApt: boolean,
  bedrooms: number
): RentEstimate {
  if (compRents.length >= 3) {
    return { estimatedRent: median(compRents), confidence: 'high', compsUsed: compRents.length }
  }
  if (compRents.length >= 1) {
    const avg = Math.round(compRents.reduce((a, b) => a + b, 0) / compRents.length)
    return { estimatedRent: avg, confidence: 'medium', compsUsed: compRents.length }
  }
  return {
    estimatedRent: baselineEstimate(bedrooms, hasBasementApt),
    confidence: 'low',
    compsUsed: 0,
  }
}

export async function estimateRent(
  zip: string,
  bedrooms: number,
  hasBasementApt: boolean
): Promise<RentEstimate> {
  const supabase = createServiceClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: comps } = await supabase
    .from('rent_comps')
    .select('rent')
    .eq('zip', zip)
    .eq('is_active', true)
    .gte('last_seen_at', thirtyDaysAgo.toISOString())
    .gte('bedrooms', bedrooms - 1)
    .lte('bedrooms', bedrooms + 1)

  const rents = (comps ?? []).map((c) => c.rent as number)
  return estimateFromComps(rents, hasBasementApt, bedrooms)
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- rent
```
Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/rent.ts __tests__/rent.test.ts
git commit -m "feat: add rent estimator with comp fallback and tests"
```

---

### Task 6: Geo / location scorer

**Files:**
- Create: `lib/geo.ts`
- Create: `__tests__/geo.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/geo.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { haversineDistanceMiles, scoreLocation } from '@/lib/geo'

describe('haversineDistanceMiles', () => {
  it('returns ~0 for identical coords', () => {
    expect(haversineDistanceMiles(40.2508, -111.6493, 40.2508, -111.6493)).toBeCloseTo(0)
  })

  it('returns ~1.5 miles between BYU and UVU (different cities)', () => {
    // BYU (40.2508, -111.6493) to UVU (40.2969, -111.6942) ≈ 3.8 miles
    const dist = haversineDistanceMiles(40.2508, -111.6493, 40.2969, -111.6942)
    expect(dist).toBeGreaterThan(3)
    expect(dist).toBeLessThan(5)
  })
})

describe('scoreLocation', () => {
  it('awards 10 points for property within 2 miles of BYU', () => {
    // Address right next to BYU in Provo
    const result = scoreLocation(40.252, -111.649, 'utah_county')
    expect(result.points).toBeGreaterThanOrEqual(10)
    expect(result.reasons).toContain('Near university (BYU/UVU/U of U)')
  })

  it('awards 3 points for Salt Lake County with no other signals', () => {
    // Remote SLC address far from everything
    const result = scoreLocation(40.6, -111.95, 'salt_lake')
    expect(result.reasons).toContain('Salt Lake County (larger renter pool)')
    expect(result.points).toBeGreaterThanOrEqual(3)
  })

  it('caps total at 20 even when multiple signals fire', () => {
    // Next to BYU (10) + near transit (5) + SLC (3) would be 18, all additive but capped
    const result = scoreLocation(40.2508, -111.6493, 'utah_county')
    expect(result.points).toBeLessThanOrEqual(20)
  })

  it('returns 0 points for a rural address with no signals', () => {
    // Somewhere rural in Utah not near anything
    const result = scoreLocation(39.5, -110.5, 'other')
    expect(result.points).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- geo
```
Expected: FAIL — `Cannot find module '@/lib/geo'`

- [ ] **Step 3: Implement geo module**

Create `lib/geo.ts`:
```typescript
export function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const UNIVERSITIES = [
  { name: 'BYU', lat: 40.2508, lng: -111.6493 },
  { name: 'UVU', lat: 40.2969, lng: -111.6942 },
  { name: 'U of U', lat: 40.7649, lng: -111.8421 },
]

const SILICON_SLOPES = { lat: 40.3916, lng: -111.8508 }

const TRANSIT_STATIONS = [
  { name: 'Provo FrontRunner', lat: 40.2338, lng: -111.6585 },
  { name: 'Orem FrontRunner', lat: 40.2969, lng: -111.6978 },
  { name: 'American Fork FrontRunner', lat: 40.3777, lng: -111.7957 },
  { name: 'Lehi FrontRunner', lat: 40.3916, lng: -111.8508 },
  { name: 'Sandy/Draper TRAX', lat: 40.5712, lng: -111.8899 },
  { name: 'Murray TRAX', lat: 40.6641, lng: -111.8879 },
  { name: 'Millcreek TRAX', lat: 40.6866, lng: -111.854 },
  { name: 'SLC Central TRAX', lat: 40.7607, lng: -111.891 },
]

export function scoreLocation(
  lat: number,
  lng: number,
  county: string
): { points: number; reasons: string[] } {
  let points = 0
  const reasons: string[] = []

  const nearUniversity = UNIVERSITIES.some(
    (u) => haversineDistanceMiles(lat, lng, u.lat, u.lng) <= 2
  )
  if (nearUniversity) {
    points += 10
    reasons.push('Near university (BYU/UVU/U of U)')
  }

  if (haversineDistanceMiles(lat, lng, SILICON_SLOPES.lat, SILICON_SLOPES.lng) <= 3) {
    points += 8
    reasons.push('Near Silicon Slopes tech corridor')
  }

  const nearTransit = TRANSIT_STATIONS.some(
    (s) => haversineDistanceMiles(lat, lng, s.lat, s.lng) <= 0.5
  )
  if (nearTransit) {
    points += 5
    reasons.push('Near FrontRunner/TRAX station')
  }

  if (county === 'salt_lake') {
    points += 3
    reasons.push('Salt Lake County (larger renter pool)')
  }

  return { points: Math.min(points, 20), reasons }
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- geo
```
Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/geo.ts __tests__/geo.test.ts
git commit -m "feat: add location scorer with Utah anchor points and tests"
```

---

### Task 7: Hard filter + scoring engine

**Files:**
- Create: `lib/pipeline/filter.ts`
- Create: `lib/pipeline/scorer.ts`
- Create: `__tests__/filter.test.ts`
- Create: `__tests__/scorer.test.ts`

- [ ] **Step 1: Write failing filter tests**

Create `__tests__/filter.test.ts`:
```typescript
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
```

- [ ] **Step 2: Write failing scorer tests**

Create `__tests__/scorer.test.ts`:
```typescript
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
    // rent=2400 / piti=2400 = 100% ratio → 40 pts
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
    // high rent coverage + near BYU + new build + fresh listing
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
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npm test -- filter scorer
```
Expected: FAIL — modules not found

- [ ] **Step 4: Implement hard filter**

Create `lib/pipeline/filter.ts`:
```typescript
export function passesHardFilter(listing: {
  bedrooms: number | null
  hasBasementApt: boolean
  hasAdu: boolean
  propertyType: string
}): boolean {
  return (
    (listing.bedrooms ?? 0) >= 3 ||
    listing.hasBasementApt ||
    listing.hasAdu ||
    ['duplex', 'triplex', 'quad'].includes(listing.propertyType)
  )
}
```

- [ ] **Step 5: Implement scoring engine**

Create `lib/pipeline/scorer.ts`:
```typescript
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
  const reductions = history.filter((h, i) => i > 0 && h.price < history[i - 1].price).length
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
```

- [ ] **Step 6: Run tests and confirm they pass**

```bash
npm test -- filter scorer
```
Expected: all 12 tests PASS

- [ ] **Step 7: Run all tests to confirm nothing is broken**

```bash
npm test
```
Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add lib/pipeline/filter.ts lib/pipeline/scorer.ts __tests__/filter.test.ts __tests__/scorer.test.ts
git commit -m "feat: add hard filter and scoring engine with tests"
```

---

### Task 8: LLM feature extractor

**Files:**
- Create: `lib/pipeline/features.ts`

No unit tests for this module — it's a thin wrapper around the OpenAI API. Integration is tested via the ingest pipeline.

- [ ] **Step 1: Implement LLM feature extractor**

Create `lib/pipeline/features.ts`:
```typescript
import OpenAI from 'openai'

export interface ExtractedFeatures {
  hasBasementApt: boolean
  hasAdu: boolean
  separateEntrance: boolean
  parkingSpaces: number
  layoutNotes: string
}

let _client: OpenAI | null = null
function getClient(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _client
}

const SYSTEM_PROMPT = `You are a real estate analyst specializing in house hacking.
Extract features from listing descriptions. Return valid JSON with exactly these fields:
- hasBasementApt: boolean — true if description mentions basement apartment/unit/suite, MIL suite, mother-in-law suite
- hasAdu: boolean — true if description mentions ADU, accessory dwelling unit, casita, guest house, carriage house
- separateEntrance: boolean — true if description mentions separate entrance, private entrance, separate entry, own entrance
- parkingSpaces: number — total parking spaces mentioned (garage + driveway), 0 if not mentioned
- layoutNotes: string — 1 sentence on house-hack potential based on the description`

export async function extractFeatures(description: string): Promise<ExtractedFeatures> {
  if (!description || description.trim().length < 20) {
    return { hasBasementApt: false, hasAdu: false, separateEntrance: false, parkingSpaces: 0, layoutNotes: '' }
  }

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: description.slice(0, 1500) }, // cap tokens
    ],
    max_tokens: 200,
    temperature: 0,
  })

  const raw = response.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw)
  return {
    hasBasementApt: Boolean(parsed.hasBasementApt),
    hasAdu: Boolean(parsed.hasAdu),
    separateEntrance: Boolean(parsed.separateEntrance),
    parkingSpaces: Number(parsed.parkingSpaces) || 0,
    layoutNotes: String(parsed.layoutNotes ?? ''),
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/pipeline/features.ts
git commit -m "feat: add LLM feature extractor (OpenAI gpt-4o-mini)"
```

---

### Task 9: Resend email alert

**Files:**
- Create: `lib/pipeline/alert.ts`

- [ ] **Step 1: Sign up for Resend**

Go to https://resend.com, create an account, create an API key, and add it to `.env.local` as `RESEND_API_KEY`.

Add a verified domain or use Resend's sandbox domain for testing. For personal use, the sandbox `onboarding@resend.dev` sender works initially.

- [ ] **Step 2: Implement alert module**

Create `lib/pipeline/alert.ts`:
```typescript
import { Resend } from 'resend'
import type { ScoreBreakdown } from '../types'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

interface AlertPayload {
  address: string
  price: number
  score: number
  rentEstimate: number
  pitiMonthlyFHA: number
  recommendation: string
  url: string | null
  scoreBreakdown: ScoreBreakdown
}

export async function sendBuyAlert(listing: AlertPayload): Promise<void> {
  const rentToPiti = Math.round((listing.rentEstimate / listing.pitiMonthlyFHA) * 100)
  const monthlyOwnerCost = listing.pitiMonthlyFHA - listing.rentEstimate

  await getResend().emails.send({
    from: 'House Hack <onboarding@resend.dev>',
    to: process.env.ALERT_EMAIL!,
    subject: `🏠 BUY ${listing.score}/100 — ${listing.address}`,
    html: `
      <h2 style="color:#16a34a">New BUY-rated listing</h2>
      <table style="font-family:monospace;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0"><strong>Address</strong></td><td>${listing.address}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Price</strong></td><td>$${listing.price.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Score</strong></td><td>${listing.score}/100</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Est. Rent</strong></td><td>$${listing.rentEstimate.toLocaleString()}/mo</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>PITI (FHA)</strong></td><td>$${listing.pitiMonthlyFHA.toLocaleString()}/mo</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Rent/PITI</strong></td><td>${rentToPiti}%</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Your cost</strong></td><td>$${monthlyOwnerCost.toLocaleString()}/mo</td></tr>
      </table>
      <br>
      <p><strong>Score Breakdown:</strong></p>
      <ul>
        <li>Cash flow: ${listing.scoreBreakdown.cashFlow.points}/40</li>
        <li>Layout: ${listing.scoreBreakdown.layout.points}/30 — ${listing.scoreBreakdown.layout.reason}</li>
        <li>Location: ${listing.scoreBreakdown.location.points}/20 — ${listing.scoreBreakdown.location.reasons.join(', ')}</li>
        <li>Risk: ${listing.scoreBreakdown.risk.points}/10 — ${listing.scoreBreakdown.risk.reasons.join(', ')}</li>
      </ul>
      ${listing.url ? `<p><a href="${listing.url}" style="color:#2563eb">View listing →</a></p>` : ''}
    `,
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/pipeline/alert.ts
git commit -m "feat: add Resend BUY alert email"
```

---

### Task 10: Pipeline orchestrator

**Files:**
- Create: `lib/pipeline/index.ts`

- [ ] **Step 1: Implement the orchestrator**

Create `lib/pipeline/index.ts`:
```typescript
import { createServiceClient } from '../supabase'
import { extractFeatures } from './features'
import { estimateRent } from './rent'
import { calculateFHA, calculateConventional } from './mortgage'
import { scoreListing } from './scorer'
import { sendBuyAlert } from './alert'
import type { Listing } from '../types'

export async function runPipeline(listingId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: listing, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (error || !listing) {
    console.error(`Pipeline: listing ${listingId} not found`, error)
    return
  }

  const l = listing as Listing

  // Step 1: LLM feature extraction (update listing if description changed)
  if (l.description) {
    const features = await extractFeatures(l.description)
    await supabase
      .from('listings')
      .update({
        has_basement_apt: features.hasBasementApt,
        has_adu: features.hasAdu,
        separate_entrance: features.separateEntrance,
        parking_spaces: features.parkingSpaces,
      })
      .eq('id', listingId)
    // Use extracted values for scoring
    l.has_basement_apt = features.hasBasementApt
    l.has_adu = features.hasAdu
    l.separate_entrance = features.separateEntrance
    l.parking_spaces = features.parkingSpaces
  }

  // Step 2: Rent estimation
  const rentResult = await estimateRent(
    l.zip ?? '',
    l.bedrooms ?? 0,
    l.has_basement_apt
  )

  // Step 3: Mortgage calculation
  const price = l.price ?? 0
  const fha = calculateFHA(price)
  const conventional = calculateConventional(price)

  // Steps 4-6: Score
  const scoreResult = scoreListing({
    bedrooms: l.bedrooms,
    hasBasementApt: l.has_basement_apt,
    hasAdu: l.has_adu,
    separateEntrance: l.separate_entrance,
    propertyType: l.property_type ?? 'sfr',
    yearBuilt: l.year_built,
    daysOnMarket: l.days_on_market,
    priceHistory: l.price_history,
    county: l.county ?? 'other',
    latitude: l.latitude,
    longitude: l.longitude,
    rentEstimate: rentResult.estimatedRent,
    pitiMonthlyFHA: fha.totalMonthlyPITI,
  })

  // Upsert score
  await supabase.from('listing_scores').upsert(
    {
      listing_id: listingId,
      score: scoreResult.score,
      cash_flow_score: scoreResult.cashFlowScore,
      layout_score: scoreResult.layoutScore,
      location_score: scoreResult.locationScore,
      risk_score: scoreResult.riskScore,
      rent_estimate: rentResult.estimatedRent,
      rent_confidence: rentResult.confidence,
      estimated_piti_fha: fha.totalMonthlyPITI,
      estimated_piti_conventional: conventional.totalMonthlyPITI,
      rent_to_piti_ratio: scoreResult.rentToPitiRatio,
      passes_filter: scoreResult.passesFilter,
      recommendation: scoreResult.recommendation,
      score_breakdown: scoreResult.scoreBreakdown,
      scored_at: new Date().toISOString(),
    },
    { onConflict: 'listing_id' }
  )

  // Step 7: Alert for new BUY listings
  if (scoreResult.recommendation === 'BUY') {
    const firstSeen = new Date(l.first_seen_at)
    const hoursOld = (Date.now() - firstSeen.getTime()) / 1000 / 3600
    if (hoursOld < 24) {
      await sendBuyAlert({
        address: l.address ?? 'Unknown address',
        price: price,
        score: scoreResult.score,
        rentEstimate: rentResult.estimatedRent,
        pitiMonthlyFHA: fha.totalMonthlyPITI,
        recommendation: scoreResult.recommendation,
        url: l.url,
        scoreBreakdown: scoreResult.scoreBreakdown,
      })
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/pipeline/index.ts
git commit -m "feat: add pipeline orchestrator"
```

---

## Phase 3: Ingest API

### Task 11: Apify normalizer + ingest route

**Files:**
- Create: `lib/pipeline/normalizer.ts`
- Create: `app/api/ingest/route.ts`

- [ ] **Step 1: Implement the Apify normalizer**

Create `lib/pipeline/normalizer.ts`:
```typescript
import type { County, PropertyType } from '../types'

// Zip codes that are definitively Utah County
const UTAH_COUNTY_ZIP_PREFIXES = ['846']
const SALT_LAKE_ZIP_PREFIXES = ['840', '841', '842', '843', '844']

function determineCounty(zip: string | null): County {
  if (!zip) return 'other'
  if (UTAH_COUNTY_ZIP_PREFIXES.some((p) => zip.startsWith(p))) return 'utah_county'
  if (SALT_LAKE_ZIP_PREFIXES.some((p) => zip.startsWith(p))) return 'salt_lake'
  return 'other'
}

function normalizePropertyType(homeType: string): PropertyType {
  const map: Record<string, PropertyType> = {
    SINGLE_FAMILY: 'sfr',
    MULTI_FAMILY: 'duplex',
    CONDO: 'condo',
    TOWNHOUSE: 'sfr',
    MANUFACTURED: 'sfr',
    LOT: 'sfr',
  }
  return map[homeType?.toUpperCase()] ?? 'sfr'
}

export interface NormalizedListing {
  source: string
  source_id: string
  url: string | null
  address: string | null
  city: string | null
  zip: string | null
  county: County
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  lot_sqft: number | null
  year_built: number | null
  property_type: PropertyType
  latitude: number | null
  longitude: number | null
  description: string | null
  days_on_market: number | null
  price_history: { price: number; date: string }[] | null
  status: 'active' | 'pending' | 'sold'
}

export function normalizeZillowListing(raw: Record<string, unknown>): NormalizedListing | null {
  const sourceId = String(raw.zpid ?? raw.id ?? '')
  if (!sourceId) return null

  const zip = String(raw.zipcode ?? raw.zip ?? '')
  const statusMap: Record<string, 'active' | 'pending' | 'sold'> = {
    FOR_SALE: 'active',
    PENDING: 'pending',
    RECENTLY_SOLD: 'sold',
  }
  const rawStatus = String(raw.homeStatus ?? raw.status ?? 'FOR_SALE').toUpperCase()

  return {
    source: 'zillow',
    source_id: sourceId,
    url: String(raw.url ?? raw.detailUrl ?? raw.hdpUrl ?? '').replace(/^\//, 'https://www.zillow.com/') || null,
    address: String(raw.streetAddress ?? raw.address ?? '').trim() || null,
    city: String(raw.city ?? '').trim() || null,
    zip: zip || null,
    county: determineCounty(zip),
    price: Number(raw.price ?? raw.unformattedPrice ?? 0) || null,
    bedrooms: Number(raw.bedrooms ?? raw.beds ?? 0) || null,
    bathrooms: Number(raw.bathrooms ?? raw.baths ?? 0) || null,
    sqft: Number(raw.livingArea ?? raw.sqft ?? 0) || null,
    lot_sqft: Number(raw.lotAreaValue ?? raw.lotSize ?? 0) || null,
    year_built: Number(raw.yearBuilt ?? 0) || null,
    property_type: normalizePropertyType(String(raw.homeType ?? 'SINGLE_FAMILY')),
    latitude: Number(raw.latitude ?? raw.lat ?? 0) || null,
    longitude: Number(raw.longitude ?? raw.lng ?? 0) || null,
    description: String(raw.description ?? raw.homeDescription ?? '').trim() || null,
    days_on_market: Number(raw.daysOnZillow ?? raw.daysOnMarket ?? 0) || null,
    price_history: Array.isArray(raw.priceHistory)
      ? (raw.priceHistory as { price: number; date: string }[])
      : null,
    status: statusMap[rawStatus] ?? 'active',
  }
}

export function normalizeZillowRental(raw: Record<string, unknown>): {
  source_id: string
  address: string | null
  zip: string | null
  city: string | null
  county: County
  rent: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  source: string
} | null {
  const sourceId = String(raw.zpid ?? raw.id ?? '')
  if (!sourceId) return null

  const zip = String(raw.zipcode ?? raw.zip ?? '')
  const rent = Number(raw.price ?? raw.rentZestimate ?? raw.rent ?? 0)
  if (!rent) return null

  return {
    source_id: sourceId,
    address: String(raw.streetAddress ?? raw.address ?? '').trim() || null,
    zip: zip || null,
    city: String(raw.city ?? '').trim() || null,
    county: determineCounty(zip),
    rent,
    bedrooms: Number(raw.bedrooms ?? raw.beds ?? 0) || null,
    bathrooms: Number(raw.bathrooms ?? raw.baths ?? 0) || null,
    sqft: Number(raw.livingArea ?? raw.sqft ?? 0) || null,
    source: 'zillow_rentals',
  }
}
```

- [ ] **Step 2: Implement ingest API route**

Create `app/api/ingest/route.ts`:
```typescript
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
  // Validate ingest token
  const token = request.headers.get('x-ingest-token')
  if (token !== process.env.INGEST_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const listingType = request.headers.get('x-listing-type') ?? 'for_sale'
  const body = await request.json()

  // Apify webhook payload contains eventData.defaultDatasetId
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
      // Upsert rental comps
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
      // Upsert for-sale listings and run scoring pipeline on new/changed ones
      for (const raw of items) {
        const normalized = normalizeZillowListing(raw)
        if (!normalized) continue

        // Check if listing already exists and if price changed
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
```

- [ ] **Step 3: Commit**

```bash
git add lib/pipeline/normalizer.ts app/api/ingest/route.ts
git commit -m "feat: add Apify normalizer and ingest webhook endpoint"
```

---

## Phase 4: User Interactions API

### Task 12: Interactions API route

**Files:**
- Create: `app/api/interactions/route.ts`

- [ ] **Step 1: Implement interactions route**

Create `app/api/interactions/route.ts`:
```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add app/api/interactions/route.ts
git commit -m "feat: add user interactions API (upsert + delete)"
```

---

## Phase 5: Dashboard

### Task 13: Shared components

**Files:**
- Create: `components/ScoreBadge.tsx`
- Create: `components/ListingCard.tsx`
- Create: `components/FilterBar.tsx`
- Create: `components/ScoreBreakdown.tsx`
- Create: `components/MortgageComparison.tsx`
- Create: `components/RentCompsTable.tsx`
- Create: `components/PipelineBoard.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update root layout**

Replace `app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'House Hack Intel',
  description: 'Utah real estate deal scanner',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex gap-6 items-center">
          <span className="font-bold text-gray-900">🏠 House Hack Intel</span>
          <a href="/" className="text-sm text-gray-600 hover:text-gray-900">Listings</a>
          <a href="/pipeline" className="text-sm text-gray-600 hover:text-gray-900">Pipeline</a>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create ScoreBadge**

Create `components/ScoreBadge.tsx`:
```tsx
type Recommendation = 'BUY' | 'WATCH' | 'PASS'

const styles: Record<Recommendation, string> = {
  BUY: 'bg-green-100 text-green-800 border-green-200',
  WATCH: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PASS: 'bg-gray-100 text-gray-500 border-gray-200',
}

export function ScoreBadge({ recommendation, score }: { recommendation: Recommendation; score: number }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${styles[recommendation]}`}>
      {recommendation} · {score}
    </span>
  )
}
```

- [ ] **Step 3: Create ListingCard**

Create `components/ListingCard.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { ScoreBadge } from './ScoreBadge'
import type { ListingWithScore } from '@/lib/types'

interface Props {
  listing: ListingWithScore
  onInteraction: (listingId: string, status: string) => Promise<void>
}

export function ListingCard({ listing, onInteraction }: Props) {
  const [loading, setLoading] = useState(false)
  const score = listing.listing_scores
  const interaction = listing.user_interactions

  async function handleAction(status: string) {
    setLoading(true)
    await onInteraction(listing.id, status)
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{listing.address}</p>
          <p className="text-xs text-gray-500">{listing.city}, UT {listing.zip}</p>
        </div>
        {score && (
          <ScoreBadge recommendation={score.recommendation as 'BUY' | 'WATCH' | 'PASS'} score={score.score} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-3">
        <div>
          <span className="font-medium text-gray-900">${listing.price?.toLocaleString()}</span>
          <br />price
        </div>
        <div>
          <span className="font-medium text-gray-900">${score?.rent_estimate?.toLocaleString()}/mo</span>
          <br />est. rent
          {score?.rent_confidence === 'low' && <span className="text-orange-500"> (est)</span>}
        </div>
        <div>
          <span className="font-medium text-gray-900">{score ? Math.round(score.rent_to_piti_ratio * 100) : '—'}%</span>
          <br />rent/PITI
        </div>
      </div>

      <div className="flex gap-1 text-xs text-gray-500 mb-3">
        <span>{listing.bedrooms}bd</span>
        <span>·</span>
        <span>{listing.bathrooms}ba</span>
        <span>·</span>
        <span>{listing.sqft?.toLocaleString()} sqft</span>
        <span>·</span>
        <span>{listing.property_type?.toUpperCase()}</span>
        <span>·</span>
        <span>{listing.days_on_market}d on market</span>
      </div>

      <div className="flex gap-2">
        {listing.url && (
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            View listing →
          </a>
        )}
        <div className="ml-auto flex gap-1">
          {(['interested', 'saved', 'pass'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleAction(s)}
              disabled={loading}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                interaction?.status === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create FilterBar**

Create `components/FilterBar.tsx`:
```tsx
'use client'

export interface Filters {
  county: string
  propertyType: string
  recommendation: string
  maxPrice: string
  minScore: string
}

interface Props {
  filters: Filters
  onChange: (filters: Filters) => void
}

export function FilterBar({ filters, onChange }: Props) {
  function update(key: keyof Filters, value: string) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <select
        value={filters.county}
        onChange={(e) => update('county', e.target.value)}
        className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white"
      >
        <option value="">All Counties</option>
        <option value="utah_county">Utah County</option>
        <option value="salt_lake">Salt Lake County</option>
      </select>

      <select
        value={filters.propertyType}
        onChange={(e) => update('propertyType', e.target.value)}
        className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white"
      >
        <option value="">All Types</option>
        <option value="sfr">SFR</option>
        <option value="duplex">Duplex</option>
        <option value="triplex">Triplex</option>
        <option value="quad">Quad</option>
        <option value="condo">Condo</option>
      </select>

      <select
        value={filters.recommendation}
        onChange={(e) => update('recommendation', e.target.value)}
        className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white"
      >
        <option value="">BUY + WATCH</option>
        <option value="BUY">BUY only</option>
        <option value="WATCH">WATCH only</option>
      </select>

      <input
        type="number"
        placeholder="Max price"
        value={filters.maxPrice}
        onChange={(e) => update('maxPrice', e.target.value)}
        className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white w-28"
      />

      <input
        type="number"
        placeholder="Min score"
        value={filters.minScore}
        onChange={(e) => update('minScore', e.target.value)}
        className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white w-24"
      />
    </div>
  )
}
```

- [ ] **Step 5: Create ScoreBreakdown**

Create `components/ScoreBreakdown.tsx`:
```tsx
import type { ScoreBreakdown as ScoreBreakdownType } from '@/lib/types'

export function ScoreBreakdown({ breakdown, total }: { breakdown: ScoreBreakdownType; total: number }) {
  const bars = [
    { label: 'Cash Flow', points: breakdown.cashFlow.points, max: 40, detail: `${Math.round(breakdown.cashFlow.ratio * 100)}% rent/PITI` },
    { label: 'Layout', points: breakdown.layout.points, max: 30, detail: breakdown.layout.reason },
    { label: 'Location', points: breakdown.location.points, max: 20, detail: breakdown.location.reasons.join(', ') || 'No signals' },
    { label: 'Risk', points: breakdown.risk.points, max: 10, detail: breakdown.risk.reasons.join(', ') || 'No signals' },
  ]

  return (
    <div className="space-y-3">
      <div className="text-2xl font-bold">{total}<span className="text-sm font-normal text-gray-500">/100</span></div>
      {bars.map((bar) => (
        <div key={bar.label}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700 font-medium">{bar.label}</span>
            <span className="text-gray-500">{bar.points}/{bar.max}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${(bar.points / bar.max) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{bar.detail}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Create MortgageComparison**

Create `components/MortgageComparison.tsx`:
```tsx
interface Props {
  price: number
  pithFHA: number
  pitiConventional: number
  rentEstimate: number
}

export function MortgageComparison({ price, pithFHA, pitiConventional, rentEstimate }: Props) {
  const rows = [
    { label: 'Down Payment', fha: Math.round(price * 0.035), conv: Math.round(price * 0.05) },
    { label: 'Monthly PITI', fha: pithFHA, conv: pitiConventional },
    { label: 'Est. Rent Income', fha: rentEstimate, conv: rentEstimate },
    { label: 'Your Monthly Cost', fha: pithFHA - rentEstimate, conv: pitiConventional - rentEstimate },
  ]

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="text-left py-2 text-gray-500 font-medium"></th>
          <th className="text-right py-2 text-gray-700 font-semibold">FHA 3.5%</th>
          <th className="text-right py-2 text-gray-700 font-semibold">Conv. 5%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-gray-100">
            <td className="py-2 text-gray-600">{row.label}</td>
            <td className={`text-right py-2 font-medium ${row.label === 'Your Monthly Cost' && row.fha < 0 ? 'text-green-600' : 'text-gray-900'}`}>
              ${row.fha.toLocaleString()}
            </td>
            <td className={`text-right py-2 font-medium ${row.label === 'Your Monthly Cost' && row.conv < 0 ? 'text-green-600' : 'text-gray-900'}`}>
              ${row.conv.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 7: Create RentCompsTable**

Create `components/RentCompsTable.tsx`:
```tsx
import type { RentComp } from '@/lib/types'

export function RentCompsTable({ comps }: { comps: RentComp[] }) {
  if (comps.length === 0) {
    return <p className="text-sm text-gray-400">No recent rental comps found. Estimate uses baseline model.</p>
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left">
          <th className="py-2 text-gray-500 font-medium">Address</th>
          <th className="py-2 text-gray-500 font-medium text-right">Beds</th>
          <th className="py-2 text-gray-500 font-medium text-right">Rent/mo</th>
        </tr>
      </thead>
      <tbody>
        {comps.map((comp) => (
          <tr key={comp.id} className="border-b border-gray-100">
            <td className="py-1.5 text-gray-700">{comp.address ?? comp.city}</td>
            <td className="py-1.5 text-right text-gray-600">{comp.bedrooms}</td>
            <td className="py-1.5 text-right font-medium">${comp.rent.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 8: Create PipelineBoard**

Create `components/PipelineBoard.tsx`:
```tsx
'use client'
import type { ListingWithScore, InteractionStatus } from '@/lib/types'

const COLUMNS: { status: InteractionStatus; label: string }[] = [
  { status: 'interested', label: 'Interested' },
  { status: 'toured', label: 'Toured' },
  { status: 'contacted', label: 'Contacted Agent' },
  { status: 'offer_made', label: 'Offer Made' },
]

interface Props {
  listings: ListingWithScore[]
  onMove: (listingId: string, status: InteractionStatus) => Promise<void>
}

export function PipelineBoard({ listings, onMove }: Props) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colListings = listings.filter((l) => l.user_interactions?.status === col.status)
        return (
          <div key={col.status} className="bg-gray-100 rounded-lg p-3 min-h-[200px]">
            <h3 className="font-semibold text-sm text-gray-700 mb-3">
              {col.label} <span className="text-gray-400">({colListings.length})</span>
            </h3>
            <div className="space-y-2">
              {colListings.map((l) => (
                <div key={l.id} className="bg-white rounded border border-gray-200 p-3 text-xs">
                  <p className="font-medium text-gray-900 mb-1">{l.address}</p>
                  <p className="text-gray-500">${l.price?.toLocaleString()}</p>
                  {l.listing_scores && (
                    <p className="text-gray-500">Score: {l.listing_scores.score}/100</p>
                  )}
                  <div className="flex gap-1 mt-2">
                    {COLUMNS.filter((c) => c.status !== col.status).map((c) => (
                      <button
                        key={c.status}
                        onClick={() => onMove(l.id, c.status)}
                        className="text-xs px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 hover:border-gray-400"
                      >
                        → {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 9: Commit**

```bash
git add components/ app/layout.tsx
git commit -m "feat: add shared dashboard components"
```

---

### Task 14: Listings feed page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Implement listings feed**

Replace `app/page.tsx`:
```tsx
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
  const supabase = createClient()

  const fetchListings = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('listings')
      .select('*, listing_scores(*), user_interactions(*)')
      .eq('status', 'active')
      .eq('listing_scores.passes_filter', true)
      .order('score', { referencedTable: 'listing_scores', ascending: false })
      .limit(100)

    if (filters.county) query = query.eq('county', filters.county)
    if (filters.propertyType) query = query.eq('property_type', filters.propertyType)
    if (filters.recommendation) query = query.eq('listing_scores.recommendation', filters.recommendation)
    if (filters.maxPrice) query = query.lte('price', Number(filters.maxPrice))
    if (filters.minScore) query = query.gte('listing_scores.score', Number(filters.minScore))

    const { data } = await query
    setListings((data as ListingWithScore[]) ?? [])
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Listings</h1>
        <span className="text-sm text-gray-400">{listings.length} results</span>
      </div>
      <FilterBar filters={filters} onChange={setFilters} />
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : listings.length === 0 ? (
        <p className="text-sm text-gray-400">No listings match your filters. Check back after the next scrape run.</p>
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
```

- [ ] **Step 2: Verify the page renders**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: feed page renders with empty state ("No listings match...").

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add listings feed page with filters"
```

---

### Task 15: Listing detail page

**Files:**
- Create: `app/listings/[id]/page.tsx`

- [ ] **Step 1: Implement listing detail**

Create `app/listings/[id]/page.tsx`:
```tsx
import { createServiceClient } from '@/lib/supabase'
import { ScoreBadge } from '@/components/ScoreBadge'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { MortgageComparison } from '@/components/MortgageComparison'
import { RentCompsTable } from '@/components/RentCompsTable'
import { notFound } from 'next/navigation'
import type { ListingWithScore, RentComp } from '@/lib/types'

export default async function ListingDetail({ params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('*, listing_scores(*), user_interactions(*)')
    .eq('id', params.id)
    .single()

  if (!listing) notFound()

  const l = listing as ListingWithScore
  const score = l.listing_scores

  // Fetch rent comps for this zip
  let comps: RentComp[] = []
  if (l.zip && l.bedrooms) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data } = await supabase
      .from('rent_comps')
      .select('*')
      .eq('zip', l.zip)
      .eq('is_active', true)
      .gte('last_seen_at', thirtyDaysAgo.toISOString())
      .gte('bedrooms', l.bedrooms - 1)
      .lte('bedrooms', l.bedrooms + 1)
      .limit(10)
    comps = (data as RentComp[]) ?? []
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{l.address}</h1>
          <p className="text-gray-500">{l.city}, UT {l.zip} · {l.county?.replace('_', ' ')}</p>
        </div>
        {score && (
          <ScoreBadge recommendation={score.recommendation as 'BUY' | 'WATCH' | 'PASS'} score={score.score} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">Property</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Price', `$${l.price?.toLocaleString()}`],
                ['Bedrooms', l.bedrooms],
                ['Bathrooms', l.bathrooms],
                ['Sqft', l.sqft?.toLocaleString()],
                ['Lot Sqft', l.lot_sqft?.toLocaleString()],
                ['Year Built', l.year_built],
                ['Type', l.property_type?.toUpperCase()],
                ['Days on Market', l.days_on_market],
                ['Basement Apt', l.has_basement_apt ? 'Yes' : 'No'],
                ['ADU', l.has_adu ? 'Yes' : 'No'],
                ['Sep. Entrance', l.separate_entrance ? 'Yes' : 'No'],
                ['Parking', l.parking_spaces],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <p className="text-gray-400 text-xs">{label}</p>
                  <p className="font-medium">{value ?? '—'}</p>
                </div>
              ))}
            </div>
            {l.url && (
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="mt-4 block text-sm text-blue-600 hover:underline">
                View on Zillow →
              </a>
            )}
          </section>

          {score && (
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">Score Breakdown</h2>
              <ScoreBreakdown breakdown={score.score_breakdown!} total={score.score} />
            </section>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {score && l.price && (
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">Mortgage Scenarios</h2>
              <MortgageComparison
                price={l.price}
                pithFHA={score.estimated_piti_fha!}
                pitiConventional={score.estimated_piti_conventional!}
                rentEstimate={score.rent_estimate!}
              />
              <p className="text-xs text-gray-400 mt-3">
                Rent estimate confidence: <span className="font-medium">{score.rent_confidence?.toUpperCase()}</span>
                {score.rent_confidence === 'low' && ' — no recent comps found, using baseline room-rate model'}
              </p>
            </section>
          )}

          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-4">
              Rental Comps ({comps.length})
            </h2>
            <RentCompsTable comps={comps} />
          </section>

          {l.description && (
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">Description</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{l.description}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Link listing cards to detail page**

In `components/ListingCard.tsx`, wrap the address in a link. Add this import and update the address element:

```tsx
import Link from 'next/link'
```

Change:
```tsx
<p className="font-semibold text-gray-900 text-sm">{listing.address}</p>
```
To:
```tsx
<Link href={`/listings/${listing.id}`} className="font-semibold text-gray-900 text-sm hover:text-blue-600 hover:underline">
  {listing.address}
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add app/listings/ components/ListingCard.tsx
git commit -m "feat: add listing detail page with score breakdown and mortgage comparison"
```

---

### Task 16: Pipeline kanban page

**Files:**
- Create: `app/pipeline/page.tsx`

- [ ] **Step 1: Implement pipeline page**

Create `app/pipeline/page.tsx`:
```tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { PipelineBoard } from '@/components/PipelineBoard'
import type { ListingWithScore, InteractionStatus } from '@/lib/types'

export default function PipelinePage() {
  const [listings, setListings] = useState<ListingWithScore[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchListings = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('listings')
      .select('*, listing_scores(*), user_interactions!inner(*)')
      .not('user_interactions.status', 'eq', 'pass')
      .order('updated_at', { referencedTable: 'user_interactions', ascending: false })
    setListings((data as ListingWithScore[]) ?? [])
    setLoading(false)
  }, [supabase])

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
        <p className="text-sm text-gray-400">No listings in your pipeline yet. Mark listings as "interested" or "saved" from the feed.</p>
      ) : (
        <PipelineBoard listings={listings} onMove={handleMove} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify pipeline page renders**

```bash
npm run dev
```

Open `http://localhost:3000/pipeline`. Expected: renders with empty state message.

- [ ] **Step 3: Commit**

```bash
git add app/pipeline/
git commit -m "feat: add pipeline kanban page"
```

---

## Phase 6: Automation

### Task 17: GitHub Actions cron workflow

**Files:**
- Create: `.github/workflows/scrape.yml`

- [ ] **Step 1: Find Apify actor IDs**

Go to https://apify.com/store and search for:
- "Zillow scraper" — look for a high-run-count actor (e.g., `maxcopell/zillow-scraper` or `compass/crawler-google-places`). Copy the actor ID shown in the URL.
- For rentals: the same Zillow actor can scrape rental URLs.

Save both actor IDs. You'll use the same actor for for-sale and rental by passing different search URLs.

- [ ] **Step 2: Add GitHub secrets**

In your GitHub repo → Settings → Secrets and variables → Actions, add:
- `APIFY_TOKEN` — your Apify API token (from https://console.apify.com/account/integrations)
- `APIFY_ZILLOW_ACTOR_ID` — the actor ID from Step 1 (e.g., `maxcopell~zillow-scraper`)
- `INGEST_WEBHOOK_URL` — your Vercel deployment URL + `/api/ingest` (set this after Task 18)
- `INGEST_TOKEN` — same value as in `.env.local`

- [ ] **Step 3: Create the workflow**

Create `.github/workflows/scrape.yml`:
```yaml
name: Trigger Apify Scrapers

on:
  schedule:
    - cron: '0 12,0 * * *'  # 6am and 6pm MT (UTC-6 in winter)
  workflow_dispatch:         # allow manual trigger for testing

jobs:
  trigger:
    runs-on: ubuntu-latest

    steps:
      - name: Trigger Zillow for-sale scraper (Utah County)
        run: |
          curl -s -f -X POST \
            "https://api.apify.com/v2/acts/${{ secrets.APIFY_ZILLOW_ACTOR_ID }}/runs" \
            -H "Authorization: Bearer ${{ secrets.APIFY_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "input": {
                "searchUrls": [
                  {"url": "https://www.zillow.com/utah-county-ut/"},
                  {"url": "https://www.zillow.com/salt-lake-county-ut/"}
                ],
                "maxItems": 200,
                "includeRentZestimate": false
              },
              "webhooks": [{
                "eventTypes": ["ACTOR.RUN.SUCCEEDED"],
                "requestUrl": "${{ secrets.INGEST_WEBHOOK_URL }}",
                "payloadTemplate": "{\"eventData\": {{eventData}}, \"resource\": {{resource}}}",
                "headersTemplate": "{\"x-ingest-token\": \"${{ secrets.INGEST_TOKEN }}\", \"x-listing-type\": \"for_sale\"}"
              }]
            }'
          echo "For-sale scraper triggered"

      - name: Trigger Zillow rentals scraper
        run: |
          curl -s -f -X POST \
            "https://api.apify.com/v2/acts/${{ secrets.APIFY_ZILLOW_ACTOR_ID }}/runs" \
            -H "Authorization: Bearer ${{ secrets.APIFY_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "input": {
                "searchUrls": [
                  {"url": "https://www.zillow.com/utah-county-ut/rentals/"},
                  {"url": "https://www.zillow.com/salt-lake-county-ut/rentals/"}
                ],
                "maxItems": 300
              },
              "webhooks": [{
                "eventTypes": ["ACTOR.RUN.SUCCEEDED"],
                "requestUrl": "${{ secrets.INGEST_WEBHOOK_URL }}",
                "payloadTemplate": "{\"eventData\": {{eventData}}, \"resource\": {{resource}}}",
                "headersTemplate": "{\"x-ingest-token\": \"${{ secrets.INGEST_TOKEN }}\", \"x-listing-type\": \"rental\"}"
              }]
            }'
          echo "Rentals scraper triggered"
```

- [ ] **Step 4: Commit**

```bash
git add .github/
git commit -m "feat: add GitHub Actions cron to trigger Apify scrapers"
```

---

## Phase 7: Deployment

### Task 18: Deploy to Vercel

- [ ] **Step 1: Push to GitHub**

Create a new GitHub repo named `house-hack` (go to github.com/new). Then:
```bash
git remote add origin git@github.com:YOUR_USERNAME/house-hack.git
git push -u origin main
```

- [ ] **Step 2: Deploy to Vercel**

Go to https://vercel.com/new, import the `house-hack` GitHub repo. Accept all defaults (Next.js is auto-detected).

- [ ] **Step 3: Add environment variables to Vercel**

In Vercel project → Settings → Environment Variables, add all variables from `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `INGEST_TOKEN`
- `ALERT_EMAIL`
- `APIFY_TOKEN`

- [ ] **Step 4: Trigger a redeploy**

In Vercel → Deployments → Redeploy (to pick up the env vars).

- [ ] **Step 5: Update the INGEST_WEBHOOK_URL GitHub secret**

Copy the Vercel deployment URL (e.g., `https://house-hack.vercel.app`). Update the `INGEST_WEBHOOK_URL` GitHub secret to `https://house-hack.vercel.app/api/ingest`.

- [ ] **Step 6: Test the end-to-end pipeline**

In GitHub → Actions → "Trigger Apify Scrapers" → click "Run workflow" (manual trigger via `workflow_dispatch`).

Wait 5-10 minutes. Check:
1. Apify console shows two actor runs completed
2. Supabase `listings` table has rows
3. Supabase `listing_scores` table has rows
4. Dashboard at your Vercel URL shows listings

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "chore: verify deployment and end-to-end pipeline"
git push
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Scrape Zillow + Realtor.com for-sale listings | Task 17 (Realtor.com: add a second actor ID to workflow — note below) |
| Scrape Zillow rentals for comp data | Task 17 |
| LLM feature extraction | Task 8 |
| Hard filter (3+ bed / multi-unit / ADU / basement) | Task 7 |
| Rent estimation (comps + baseline fallback) | Task 5 |
| Mortgage calc (FHA + conventional) | Task 4 |
| Scoring (cash flow 40 + layout 30 + location 20 + risk 10) | Task 7 |
| BUY / WATCH / PASS recommendation | Task 7 |
| Email alert for new BUY listings | Task 9 |
| Listings feed with filters | Task 14 |
| Listing detail with score breakdown | Task 15 |
| Mortgage comparison table | Task 13, Task 15 |
| Rent comps table in detail view | Task 15 |
| Pipeline kanban (Interested → Toured → Contacted → Offer) | Task 16 |
| GitHub Actions cron twice daily | Task 17 |
| Supabase data model | Task 2 |
| Token-authenticated ingest endpoint | Task 11 |

**Note on Realtor.com:** The workflow in Task 17 only triggers the Zillow actor. To add Realtor.com, find the actor ID in the Apify Store (search "realtor scraper"), add it as `APIFY_REALTOR_ACTOR_ID` in GitHub secrets, and add a third `curl` step to the workflow following the same pattern with `"x-listing-type": "for_sale"`. The normalizer will need a `normalizeRealtorListing()` function following the same pattern as `normalizeZillowListing()` — Realtor.com fields differ slightly (check the actor's output schema in Apify).

**Type consistency verified:** `ScoreBreakdown`, `ListingWithScore`, `Recommendation`, `InteractionStatus` — all defined in Task 3 and used consistently in Tasks 7, 13, 14, 15, 16. `ScoreInput` is defined in `scorer.ts` and consumed only in `pipeline/index.ts`.
