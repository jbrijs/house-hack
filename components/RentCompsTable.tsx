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
