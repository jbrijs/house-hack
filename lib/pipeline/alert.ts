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
  const rentToPiti = listing.pitiMonthlyFHA > 0
    ? Math.round((listing.rentEstimate / listing.pitiMonthlyFHA) * 100)
    : 0
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
