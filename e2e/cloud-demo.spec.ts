import { expect, test, type Page, type Route } from '@playwright/test'
import { MOCK_SUPABASE } from '../playwright.config'

// Cloud mode against a mocked Supabase: auth, REST and RPC calls are answered here, so we can test
// the guest demo flow (sign in anonymously, sign out, play as guest again) without a real project.

const HQ = { level: 1, name: 'HQ' }
const today = new Date().toISOString().slice(0, 10)
const stats = { total_xp: 0, level: 1, level_floor: 0, level_next: 100, current_streak: 0, best_streak: 0, done: 0, open: 0, overdue: 0, done_today: 0, clear_rate: null, on_time_pct: null, xp_today: 0, today, heatmap: [] }
const profile = { display_name: 'Guest', avatar: 'sword', skin: 'forge', accent: null, time_zone: 'UTC' }

function session(n: number) {
  const now = Math.floor(Date.now() / 1000)
  const user = { id: `00000000-0000-4000-8000-00000000000${n}`, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  return { access_token: `mock-token-${n}`, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: `mock-refresh-${n}`, user }
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function mockSupabase(page: Page, opts: { signup?: (n: number, route: Route) => Promise<void> | void } = {}) {
  const calls = { signup: 0, logout: 0 }
  await page.routeWebSocket(/\/realtime\/v1\//, () => {})
  await page.route(`${MOCK_SUPABASE}/**`, async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path === '/auth/v1/signup') {
      calls.signup += 1
      if (opts.signup) return opts.signup(calls.signup, route)
      return json(route, session(calls.signup))
    }
    if (path === '/auth/v1/logout') {
      calls.logout += 1
      return route.fulfill({ status: 204 })
    }
    if (path === '/rest/v1/rpc/xplan_bootstrap') return json(route, [profile])
    if (path === '/rest/v1/rpc/xplan_start_demo') return json(route, null)
    if (path === '/rest/v1/rpc/xplan_stats') return json(route, stats)
    if (path.startsWith('/rest/v1/')) return json(route, [])
    return json(route, {})
  })
  return calls
}

test('sign out, then play as guest again, reaches HQ', async ({ page }) => {
  const calls = await mockSupabase(page)
  await page.goto('/demo')
  await expect(page.getByRole('heading', HQ)).toBeVisible()
  await expect(page).toHaveURL(/\/$/)

  await page.getByRole('button', { name: 'Sign out' }).first().click()
  await page.getByRole('button', { name: /play as guest/i }).click()

  // This used to hang on "Loading your save file…" forever.
  await expect(page.getByRole('heading', HQ)).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  expect(calls.signup).toBe(2)
  expect(calls.logout).toBe(1)
})

test('a failed guest sign-in shows an error with Retry instead of hanging', async ({ page }) => {
  const calls = await mockSupabase(page, {
    signup: (n, route) => (n === 1 ? json(route, { code: 429, error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' }, 429) : json(route, session(n))),
  })
  await page.goto('/demo')
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Couldn’t start the guest demo')
  await expect(alert).toContainText(/rate limit/i)
  await alert.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('heading', HQ)).toBeVisible()
  expect(calls.signup).toBe(2)
})
