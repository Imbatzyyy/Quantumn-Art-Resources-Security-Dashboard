import { describe, expect, it } from 'vitest'
import { deductionLines, phStatutoryDeductions } from './payrollPh.js'

describe('Philippine statutory deductions', () => {
  it('matches the database calculation for typical salaries', () => {
    expect(phStatutoryDeductions(35000)).toEqual({ sss: 1750, philhealth: 875, pagibig: 200, withholdingTax: 1701.3, total: 4526.3 })
    expect(phStatutoryDeductions(20000)).toEqual({ sss: 1000, philhealth: 500, pagibig: 200, withholdingTax: 0, total: 1700 })
  })

  it('applies contribution floors, ceilings and the low-salary Pag-IBIG rate', () => {
    expect(phStatutoryDeductions(150000)).toMatchObject({ sss: 1750, philhealth: 2500, pagibig: 200, withholdingTax: 28262.55 })
    expect(phStatutoryDeductions(1200)).toMatchObject({ sss: 250, philhealth: 250, pagibig: 12, withholdingTax: 0 })
    expect(phStatutoryDeductions(0).total).toBe(0)
  })

  it('rounds salary credits to the nearest ₱500 bracket', () => {
    expect(phStatutoryDeductions(5249.99).sss).toBe(250)
    expect(phStatutoryDeductions(5250).sss).toBe(275)
  })

  it('itemizes statutory payroll and leaves flat-rate payroll as one line', () => {
    const base = { id: '1', employeeId: 'EMP001', period: 'Sep 2026', gross: 35000, allowances: 0, bonuses: 0, net: 0, status: 'Released' }
    expect(deductionLines({ ...base, deductions: 2887.5 })).toBeNull()
    expect(deductionLines({ ...base, deductions: 4526.3, sss: 1750, philhealth: 875, pagibig: 200, withholdingTax: 1701.3 })?.map((line) => line.label))
      .toEqual(['SSS contribution', 'PhilHealth contribution', 'Pag-IBIG contribution', 'Withholding tax'])
    expect(deductionLines({ ...base, deductions: 5000, sss: 1750, philhealth: 875, pagibig: 200, withholdingTax: 1701.3 })?.at(-1)).toEqual({ label: 'Other deductions', amount: 473.7 })
  })
})
