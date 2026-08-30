import axe, { type ElementContext, type RunOptions } from 'axe-core'
import { expect } from 'vitest'

const options: RunOptions = {
  // The test DOM has no layout engine, so it cannot calculate rendered color
  // contrast accurately. Contrast remains part of authenticated browser QA.
  rules: { 'color-contrast': { enabled: false } },
}

export async function expectNoAccessibilityViolations(context: ElementContext) {
  const { violations } = await axe.run(context, options)
  expect(
    violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      targets: violation.nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([])
}
