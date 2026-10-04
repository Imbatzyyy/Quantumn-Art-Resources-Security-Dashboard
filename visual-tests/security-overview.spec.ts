import { chromium, firefox, webkit, expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [390, 1440]) {
      test(`security overview ${name} ${theme} ${width}`, async () => {
        const browser = await engine.launch()
        const context = await browser.newContext({ viewport:{width,height:900}, colorScheme:theme, reducedMotion:'reduce' })
        const page = await context.newPage()
        try {
          await page.goto(`http://127.0.0.1:4174/visual.html?screen=admin&theme=${theme}`)
          const overview=page.getByRole('region',{name:'Security overview'})
          await expect(overview.getByText('Open security alerts',{exact:true})).toBeVisible()
          await overview.getByLabel('Trend period').selectOption('7')
          await expect(overview.getByText(/alerts created in this 7-day window/)).toBeVisible()
          await overview.locator('summary').click()
          await expect(overview.locator('tbody tr')).toHaveCount(7)
          await overview.getByLabel('Trend period').selectOption('90')
          await expect(overview.locator('tbody tr')).toHaveCount(90)
          await overview.getByRole('button',{name:'Refresh security statistics'}).click()
          await expect(overview).toHaveAttribute('aria-busy','false')
          await overview.scrollIntoViewIfNeeded()
          expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
          const accessibility=await new AxeBuilder({page}).include('.security-overview').withRules(['color-contrast']).analyze()
          expect(accessibility.violations).toEqual([])
          await overview.getByRole('button',{name:/View High alerts/}).click()
          await expect(page.getByRole('heading',{level:1,name:'Security Center',exact:true})).toBeVisible()
          if(name==='chromium') {
            // New personal security controls are available to administrators too.
            if(width<768) {
              await page.getByRole('button',{name:'Open more navigation'}).click()
              await page.getByRole('dialog').getByRole('button',{name:'My Account Security',exact:true}).click()
            } else await page.getByRole('navigation',{name:'Portal navigation'}).getByRole('button',{name:'My Account Security',exact:true}).click()
            await expect(page.getByRole('heading',{level:1,name:'My Account Security',exact:true})).toBeVisible()
            await expect(page.getByText('You are signed out after 15 minutes without activity.')).toBeVisible()
          }
        } finally { await browser.close() }
      })
    }
  }
}
