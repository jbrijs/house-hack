interface Props {
  price: number
  pitiMonthlyFHA: number
  pitiMonthlyConventional: number
  rentEstimate: number
}

export function MortgageComparison({ price, pitiMonthlyFHA, pitiMonthlyConventional, rentEstimate }: Props) {
  const rows = [
    { label: 'Down Payment', fha: Math.round(price * 0.035), conv: Math.round(price * 0.05) },
    { label: 'Monthly PITI', fha: pitiMonthlyFHA, conv: pitiMonthlyConventional },
    { label: 'Est. Rent Income', fha: rentEstimate, conv: rentEstimate },
    { label: 'Your Monthly Cost', fha: pitiMonthlyFHA - rentEstimate, conv: pitiMonthlyConventional - rentEstimate },
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
