import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// CI runs without Supabase env, so the app uses the local save file (same rules as the DB).
async function demo(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/demo')
  await expect(page.getByRole('heading', { level: 1, name: 'HQ' })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
}

test('loads the demo save on the player dashboard', async ({ page }) => {
  await demo(page)
  await expect(page.getByText('Level 9', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('progressbar').first()).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Daily missions' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /Complete quest: Ship the XPlan case study/ })).toBeVisible()
})

test('quick-add previews parsed tokens and creates the quest', async ({ page }) => {
  await demo(page)
  const input = page.getByLabel('Quick add quest')
  await input.fill('Leg day tomorrow 6pm p2 #fitness @Health')
  const preview = page.getByTestId('quickadd-preview')
  await expect(preview).toContainText('Tomorrow')
  await expect(preview).toContainText('6pm')
  await expect(preview).toContainText('fitness')
  await expect(preview).toContainText('Health')
  await input.press('Enter')
  await expect(input).toHaveValue('')
  await page.goto('/upcoming')
  await expect(page.getByRole('checkbox', { name: 'Complete quest: Leg day' })).toBeVisible()
})

test('completing a quest pops XP and levels up', async ({ page }) => {
  await demo(page)
  await page.getByRole('checkbox', { name: /Complete quest: Ship the XPlan case study/ }).click()
  await expect(page.getByText('Level up!')).toBeVisible()
  await expect(page.getByText('Level 10').first()).toBeVisible()
  await page.goto('/log')
  await expect(page.getByRole('checkbox', { name: /Reopen quest: Ship the XPlan case study/ })).toBeVisible()
})

test('repeating quests spawn their next occurrence', async ({ page }) => {
  await demo(page)
  await page.getByRole('checkbox', { name: 'Complete quest: Morning stretch' }).click()
  await page.goto('/upcoming')
  await expect(page.getByRole('checkbox', { name: 'Complete quest: Morning stretch' })).toBeVisible()
})

test('keyboard: palette, navigation and complete', async ({ page }) => {
  await demo(page)
  await page.keyboard.press('ControlOrMeta+k')
  const box = page.getByRole('combobox', { name: 'Command' })
  await expect(box).toBeFocused()
  await box.fill('quest log')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Quest log' })).toBeVisible()
  await page.keyboard.press('g')
  await page.keyboard.press('t')
  await expect(page.getByRole('heading', { level: 1, name: 'Daily missions' })).toBeVisible()
  await page.keyboard.press('j')
  await page.keyboard.press('x')
  await expect(page.getByText(/\+\d+ XP|Level up!/).first()).toBeVisible()
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: /shortcuts/i })).toBeVisible()
})

test('titles render as text, never HTML', async ({ page }) => {
  await demo(page)
  let alerted = false
  page.on('dialog', (d) => { alerted = true; void d.dismiss() })
  await page.getByLabel('Quick add quest').fill('<img src=x onerror=alert(1)> today')
  await page.keyboard.press('Enter')
  await expect(page.getByText('<img src=x onerror=alert(1)>', { exact: true })).toBeVisible()
  expect(alerted).toBe(false)
  expect(await page.locator('main img').count()).toBe(0)
})

test('skins can be switched and persist', async ({ page }) => {
  await demo(page)
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('combobox', { name: 'Command' }).fill('skin bloom')
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'bloom')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'bloom')
})

test('Forge pairs with its light twin Alloy', async ({ page }) => {
  await demo(page)
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'forge')
  await page.getByRole('button', { name: 'Switch to light mode (Alloy)' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'alloy')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'alloy')
  await page.getByRole('button', { name: 'Switch to dark mode (Forge)' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'forge')
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('combobox', { name: 'Command' }).fill('skin bloom')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /Switch to (light|dark) mode/ })).toHaveCount(0)
})

for (const path of ['/', '/today', '/upcoming', '/log', '/trophies']) {
  for (const skin of ['forge', 'alloy', 'bloom', 'slate']) {
    test(`no WCAG A/AA violations: ${path} (${skin})`, async ({ page }) => {
      await demo(page)
      await page.evaluate((s) => {
        const p = JSON.parse(localStorage.getItem('xplan:profile') ?? '{}')
        localStorage.setItem('xplan:profile', JSON.stringify({ ...p, skin: s }))
      }, skin)
      await page.goto(path)
      await expect(page.locator('html')).toHaveAttribute('data-skin', skin)
      await expect(page.locator('main h1')).toBeVisible()
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([])
    })
  }
}

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
  test('swipe right completes a quest', async ({ page }) => {
    await demo(page)
    const item = page.locator('[data-quest-id]').filter({ hasText: 'Read 20 pages' }).first().locator('[data-swipe]')
    await item.scrollIntoViewIfNeeded()
    const b = (await item.boundingBox())!
    const y = b.y + b.height / 2
    await item.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: b.x + 20, clientY: y, isPrimary: true, pointerId: 1 })
    for (let dx = 20; dx <= 180; dx += 20) await item.dispatchEvent('pointermove', { pointerType: 'touch', clientX: b.x + 20 + dx, clientY: y, isPrimary: true, pointerId: 1 })
    await item.dispatchEvent('pointerup', { pointerType: 'touch', clientX: b.x + 200, clientY: y, isPrimary: true, pointerId: 1 })
    await expect(page.getByRole('checkbox', { name: 'Complete quest: Read 20 pages' })).toHaveCount(0) // next repeat is tomorrow
    await page.goto('/log')
    await expect(page.getByRole('checkbox', { name: 'Reopen quest: Read 20 pages' }).first()).toBeVisible()
  })
})
