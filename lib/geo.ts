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
