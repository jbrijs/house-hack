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
