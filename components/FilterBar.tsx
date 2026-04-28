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
      <select value={filters.county} onChange={(e) => update('county', e.target.value)} className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white">
        <option value="">All Counties</option>
        <option value="utah_county">Utah County</option>
        <option value="salt_lake">Salt Lake County</option>
      </select>
      <select value={filters.propertyType} onChange={(e) => update('propertyType', e.target.value)} className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white">
        <option value="">All Types</option>
        <option value="sfr">SFR</option>
        <option value="duplex">Duplex</option>
        <option value="triplex">Triplex</option>
        <option value="quad">Quad</option>
        <option value="condo">Condo</option>
      </select>
      <select value={filters.recommendation} onChange={(e) => update('recommendation', e.target.value)} className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white">
        <option value="">BUY + WATCH</option>
        <option value="BUY">BUY only</option>
        <option value="WATCH">WATCH only</option>
      </select>
      <input type="number" placeholder="Max price" value={filters.maxPrice} onChange={(e) => update('maxPrice', e.target.value)} className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white w-28" />
      <input type="number" placeholder="Min score" value={filters.minScore} onChange={(e) => update('minScore', e.target.value)} className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white w-24" />
    </div>
  )
}
