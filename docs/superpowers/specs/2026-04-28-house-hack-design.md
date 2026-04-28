# House Hack Intelligence System — Design Spec

**Date:** 2026-04-28  
**Owner:** Joe Brijs  
**Status:** Approved

---

## Context

Personal real estate deal analysis tool for identifying house-hack opportunities in Utah County and Salt Lake County. The user is 23, single, CS master's grad, $90k base salary, targeting $30-40k saved by end of year for a down payment. Strategy: minimize monthly housing cost while building equity, not maximize cash flow (Utah is not a cash flow market).

---

## Goals

- Automatically surface listings that meet house-hack criteria before they go pending
- Score and rank listings so the best opportunities are immediately obvious
- Project rental income from comparable active rentals in the same zip
- Notify when a new high-scoring listing appears
- Track listings through a personal pipeline (interested / saved / pass)

---

## Non-Goals

- Multi-user support or auth
- Cash flow maximization (equity + cost reduction is the goal)
- Building a scraper from scratch (delegated to Apify)
- Unrealistic rent growth projections

---

## Target Properties

All of the following qualify — no property type is excluded:

| Type | House Hack Model |
|---|---|
| Duplex / Triplex / Quad | Live in one unit, rent the others |
| SFR with basement apartment | Live upstairs, rent basement |
| SFR with ADU | Live in main house, rent ADU |
| 3+ bed SFR | Rent individual rooms to roommates |

**Hard filter:** property must have 3+ bedrooms OR a basement/separate unit OR be multi-unit. Anything below this threshold is stored but never surfaced.

---

## Architecture

```
GitHub Actions (cron: 6am + 6pm MT)
    → triggers Apify actors in parallel
        - Zillow for-sale listings (Utah County + Salt Lake County)
        - Realtor.com for-sale listings (same geography)
        - Zillow rental listings (rent comps)
    → Apify webhooks POST to /api/ingest (Vercel, token-authenticated)
    → scoring pipeline runs on new/changed listings
    → Resend email alert if new BUY-rated listing
    
User opens Next.js dashboard (Vercel)
    → reads from Supabase
    → filters, sorts, marks listings
```

---

## Data Model

### `listings`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| source | text | zillow / realtor / craigslist |
| source_id | text | their listing ID, unique per source |
| url | text | |
| address | text | |
| city | text | |
| zip | text | |
| county | text | utah_county / salt_lake |
| price | integer | |
| bedrooms | integer | |
| bathrooms | numeric | |
| sqft | integer | |
| lot_sqft | integer | |
| year_built | integer | |
| property_type | text | sfr / duplex / triplex / quad / condo |
| has_basement_apt | boolean | extracted by LLM |
| has_adu | boolean | extracted by LLM |
| separate_entrance | boolean | extracted by LLM |
| parking_spaces | integer | extracted by LLM |
| description | text | raw listing description |
| days_on_market | integer | |
| price_history | jsonb | |
| first_seen_at | timestamptz | |
| last_seen_at | timestamptz | |
| status | text | active / pending / sold |

### `listing_scores`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| listing_id | uuid | FK → listings |
| score | integer | 0–100 |
| cash_flow_score | integer | 0–40 |
| layout_score | integer | 0–30 |
| location_score | integer | 0–20 |
| risk_score | integer | 0–10 |
| rent_estimate | integer | monthly, in dollars |
| rent_confidence | text | low / medium / high |
| estimated_piti_fha | integer | monthly, 3.5% down |
| estimated_piti_conventional | integer | monthly, 5% down |
| rent_to_piti_ratio | numeric | rent / piti_fha |
| passes_filter | boolean | meets hard filter criteria |
| recommendation | text | BUY / WATCH / PASS |
| score_breakdown | jsonb | full breakdown for display |
| scored_at | timestamptz | |

### `rent_comps`
Stores active rental listings scraped from Zillow Rentals. Queried by zip + bedrooms at scoring time — not tied to a specific for-sale listing, since one comp can be relevant to many listings.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| source_id | text | rental listing ID from source |
| address | text | |
| zip | text | primary lookup key |
| city | text | |
| county | text | |
| rent | integer | monthly |
| bedrooms | integer | primary lookup key |
| bathrooms | numeric | |
| sqft | integer | |
| source | text | zillow_rentals / craigslist |
| first_seen_at | timestamptz | |
| last_seen_at | timestamptz | |
| is_active | boolean | false when no longer in scrape results |

### `user_interactions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| listing_id | uuid | FK → listings |
| status | text | interested / saved / pass / contacted |
| notes | text | |
| updated_at | timestamptz | |

---

## Scoring Pipeline

Runs in order on every new or price-changed listing via `/api/ingest`.

### Step 1 — Feature Extraction (LLM)
Pass raw description to an LLM (model TBD — OpenAI cheaper models preferred). Extract:
- `has_basement_apt` (boolean)
- `has_adu` (boolean)  
- `separate_entrance` (boolean)
- `parking` (integer — number of spaces)
- `layout_notes` (string — anything useful)

LLM call is wrapped behind a clean interface so the model can be swapped without touching pipeline code.

### Step 2 — Hard Filter
Fails if ALL of the following are false:
- `bedrooms >= 3`
- `has_basement_apt == true`
- `has_adu == true`
- `property_type in (duplex, triplex, quad)`

Failed listings get `passes_filter: false`, `score: 0`, `recommendation: PASS`. Stored but not shown in dashboard by default.

### Step 3 — Rent Estimation
1. Pull active rental comps from `rent_comps` where `zip` matches, `is_active = true`, `last_seen_at` within 30 days, `bedrooms` within ±1 of listing
2. If 3+ comps exist: median comp rent → `confidence: high`
3. If 1-2 comps: average comp rent → `confidence: medium`
4. If 0 comps: fall back to baseline model → `confidence: low`

**Baseline model (fallback):**
- Regular bedroom: $700/room (midpoint of $650-850)
- Master bedroom: $975/room (midpoint of $850-1,100)
- Basement unit: $1,250/flat (midpoint of $1,000-1,500)
- Assumed owner occupies master, rents remaining rooms/units

### Step 4 — Mortgage Estimate
Two scenarios stored for every listing:

**FHA (3.5% down):**
- Down payment: `price * 0.035`
- Loan: `price * 0.965`
- Rate: 6.75% (30yr fixed)
- PI: standard amortization formula
- Taxes + insurance: `price * 0.012 / 12`
- MIP: 0.55% annually on loan balance / 12

**Conventional (5% down):**
- Same formula, 5% down, no MIP, rate: 6.875%

### Step 5 — Scoring (0–100)

**Cash flow score (40 pts)**  
Based on `rent_to_piti_ratio` (using FHA):
- ≥ 80%: 40 pts
- 70-79%: 30 pts
- 60-69%: 20 pts (minimum acceptable)
- 50-59%: 10 pts
- < 50%: 0 pts

**Layout score (30 pts)**
- Multi-unit (duplex/triplex/quad): 30 pts
- SFR with basement apt + separate entrance: 28 pts
- SFR with basement apt, no separate entrance: 22 pts
- SFR with ADU: 25 pts
- 4+ bed SFR (roommate model): 18 pts
- 3 bed SFR: 12 pts

**Location score (20 pts)**
- Within 2 miles of BYU, UVU, or U of U: +10 pts
- Within 3 miles of Lehi/Silicon Slopes tech corridor: +8 pts
- Within 0.5 miles of FrontRunner/TRAX station: +5 pts
- Salt Lake County generally: +3 pts (larger renter pool)
- (Points are additive, capped at 20)

**Risk score (10 pts)**
- Year built ≥ 2000: 5 pts, 1980-1999: 3 pts, < 1980: 0 pts
- No price reductions: 3 pts, 1 reduction: 1 pt, 2+: 0 pts
- Days on market < 14: 2 pts, 14-30: 1 pt, > 30: 0 pts

### Step 6 — Recommendation
- `score >= 75` AND `passes_filter`: **BUY**
- `score 50-74` AND `passes_filter`: **WATCH**
- All others: **PASS**

### Step 7 — Alert
If `recommendation == BUY` AND `first_seen_at` is within the last 24 hours: send Resend email with listing summary, score breakdown, and Zillow URL.

---

## Dashboard

**Three views:**

**Listings Feed** (default)
- Only shows `passes_filter: true`
- Sorted by score descending
- Card shows: address, price, score badge (color-coded), estimated rent, rent-to-PITI %, bedrooms, property type, days on market, rent confidence
- Quick actions: Save / Pass / Interested
- Global filters: county, property type, min bedrooms, max price, min score, recommendation

**Listing Detail**
- Full score breakdown
- FHA vs conventional mortgage comparison
- Rent comps table
- LLM-extracted features
- Price history
- Zillow/source link
- Notes field

**Pipeline (Saved / Interested)**
- Kanban-style: Interested → Toured → Contacted Agent → Offer Made
- Notes per listing

---

## Ingestion

**GitHub Actions cron:** `0 12,0 * * *` (6am + 6pm MT / UTC-6)

Triggers three Apify actors in parallel:
1. `apify/zillow-scraper` — for-sale, Utah County + Salt Lake County, sort by newest
2. `apify/realtor-scraper` — same geography
3. `apify/zillow-scraper` in rental mode — active rentals for comp data

Each actor fires a webhook to `POST /api/ingest?token=<secret>` on completion.

**Ingest endpoint:**
- Validates token
- Upserts listings by `(source, source_id)` — no duplicates
- Runs scoring pipeline only on: new listings OR listings with price change
- Stores all results in Supabase

---

## Infrastructure & Cost

| Service | Plan | Est. Monthly Cost |
|---|---|---|
| Vercel | Hobby (free) | $0 |
| Supabase | Free tier | $0 |
| Apify | Pay-per-use | ~$5-10 |
| Resend | Free (100/day) | $0 |
| GitHub Actions | Free tier | $0 |
| OpenAI (LLM) | Pay-per-use | ~$1-3 |
| **Total** | | **~$6-13/month** |

---

## Success Criteria

The system is working when:
- Listings are ingested and scored automatically twice daily without manual intervention
- A BUY-rated listing appears in the dashboard with a score breakdown, rent estimate, and mortgage comparison
- A new BUY triggers an email notification within minutes of the Apify run completing
- User can mark listings as Interested/Pass/Saved and add notes
