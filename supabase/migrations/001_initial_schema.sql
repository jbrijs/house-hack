-- listings: one row per property, upserted each scrape
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
