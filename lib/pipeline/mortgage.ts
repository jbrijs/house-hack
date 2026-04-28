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
