'use client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

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
  function update(key: keyof Filters, value: string | null) {
    onChange({ ...filters, [key]: value ?? '' })
  }

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <Select value={filters.county || 'all'} onValueChange={(v) => update('county', v === 'all' ? '' : v)}>
        <SelectTrigger className="h-8 text-xs w-40">
          <SelectValue placeholder="All Counties" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Counties</SelectItem>
          <SelectItem value="utah_county">Utah County</SelectItem>
          <SelectItem value="salt_lake">Salt Lake County</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.propertyType || 'all'} onValueChange={(v) => update('propertyType', v === 'all' ? '' : v)}>
        <SelectTrigger className="h-8 text-xs w-36">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="sfr">SFR</SelectItem>
          <SelectItem value="duplex">Duplex</SelectItem>
          <SelectItem value="triplex">Triplex</SelectItem>
          <SelectItem value="quad">Quad</SelectItem>
          <SelectItem value="condo">Condo</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.recommendation || 'all'} onValueChange={(v) => update('recommendation', v === 'all' ? '' : v)}>
        <SelectTrigger className="h-8 text-xs w-36">
          <SelectValue placeholder="BUY + WATCH" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">BUY + WATCH</SelectItem>
          <SelectItem value="BUY">BUY only</SelectItem>
          <SelectItem value="WATCH">WATCH only</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="number"
        placeholder="Max price"
        value={filters.maxPrice}
        onChange={(e) => update('maxPrice', e.target.value)}
        className="h-8 text-xs w-28"
      />
      <Input
        type="number"
        placeholder="Min score"
        value={filters.minScore}
        onChange={(e) => update('minScore', e.target.value)}
        className="h-8 text-xs w-24"
      />
    </div>
  )
}
