import type { PayrollRecord } from '../types/hrms.js'

export interface StatutoryDeductions {
  sss: number
  philhealth: number
  pagibig: number
  withholdingTax: number
  total: number
}

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * Employee shares on a monthly salary, mirroring the database calculation
 * (private.ph_statutory_deductions) so previews match generated payroll:
 * SSS 5% of the ₱5,000–₱35,000 salary credit, PhilHealth 2.5% of salary
 * between ₱10,000 and ₱100,000, Pag-IBIG 2% (1% at ₱1,500 or less) up to
 * ₱10,000, and BIR TRAIN monthly withholding on the remaining taxable pay.
 */
export function phStatutoryDeductions(monthlySalary: number): StatutoryDeductions {
  const salary = Math.max(Number(monthlySalary) || 0, 0)
  if (salary === 0) return { sss: 0, philhealth: 0, pagibig: 0, withholdingTax: 0, total: 0 }
  const credit = Math.min(35000, Math.max(5000, Math.floor((salary + 250) / 500) * 500))
  const sss = round2(credit * 0.05)
  const philhealth = round2(Math.min(100000, Math.max(10000, salary)) * 0.025)
  const pagibig = round2(Math.min(salary, 10000) * (salary <= 1500 ? 0.01 : 0.02))
  const taxable = Math.max(salary - sss - philhealth - pagibig, 0)
  const withholdingTax = round2(
    taxable <= 20833 ? 0
      : taxable < 33333 ? (taxable - 20833) * 0.15
        : taxable < 66667 ? 1875 + (taxable - 33333) * 0.2
          : taxable < 166667 ? 8541.8 + (taxable - 66667) * 0.25
            : taxable < 666667 ? 33541.8 + (taxable - 166667) * 0.3
              : 183541.8 + (taxable - 666667) * 0.35,
  )
  return { sss, philhealth, pagibig, withholdingTax, total: round2(sss + philhealth + pagibig + withholdingTax) }
}

/** The itemized lines of a payroll record, or null for flat-rate payroll. */
export function deductionLines(record: PayrollRecord): Array<{ label: string; amount: number }> | null {
  const items = [
    { label: 'SSS contribution', amount: record.sss ?? 0 },
    { label: 'PhilHealth contribution', amount: record.philhealth ?? 0 },
    { label: 'Pag-IBIG contribution', amount: record.pagibig ?? 0 },
    { label: 'Withholding tax', amount: record.withholdingTax ?? 0 },
  ]
  const itemized = round2(items.reduce((sum, item) => sum + item.amount, 0))
  if (itemized === 0) return null
  const other = round2(record.deductions - itemized)
  return other > 0 ? [...items, { label: 'Other deductions', amount: other }] : items
}
