import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/demo')
  await expect(page.getByRole('heading', { level: 1, name: 'HQ' })).toBeVisible()
})

test('icon buttons show a tooltip on hover and keyboard focus; Esc dismisses it', async ({ page }) => {
  const help = page.getByRole('button', { name: 'Keyboard shortcuts' })
  const tip = page.getByRole('tooltip')
  await help.hover()
  await expect(tip).toBeVisible()
  await expect(tip).toHaveText('Keyboard shortcuts')
  await page.keyboard.press('Escape')
  await expect(tip).toBeHidden()

  await page.mouse.move(0, 0)
  await help.focus() // programmatic focus after a keypress counts as keyboard focus
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(tip).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tip).toBeHidden()
})

test('short tooltip on quest checkboxes describes without repeating the label', async ({ page }) => {
  const box = page.getByRole('checkbox', { name: /^Complete quest: / }).first()
  await box.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Complete quest')
  await expect(box).not.toHaveAttribute('aria-describedby', /app-tooltip/)
})

test('no tooltip after a click', async ({ page }) => {
  const help = page.getByRole('button', { name: 'Keyboard shortcuts' })
  await help.hover()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await help.click()
  await expect(page.getByRole('tooltip')).toBeHidden()
})

test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
  test('tapping an icon button never leaves a tooltip behind', async ({ page }) => {
    await page.getByRole('button', { name: 'Search' }).tap()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(800)
    await expect(page.getByRole('tooltip')).toBeHidden()
  })
})
