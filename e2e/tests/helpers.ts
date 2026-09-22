import { expect, type Page } from '@playwright/test'

/** Reset app state (roots, trust) and make sure the backend is running. */
export async function resetBackend(page: Page) {
  const res = await page.request.get('/__ctl/reset')
  expect(res.ok()).toBeTruthy()
}

export async function fakeHome(page: Page): Promise<string> {
  const res = await page.request.get('/health')
  return (await res.json()).home as string
}

export async function openApp(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => (window as any).__hsReady === true)
  await expect(page.getByRole('status')).toContainText(/Backend connected|백엔드 연결됨/)
}

/** Add the fixtures folder as a deck root via the typed-path fallback (picker is disabled in e2e). */
export async function addFixtureRoot(page: Page) {
  const home = await fakeHome(page)
  await page.getByRole('button', { name: /^Add deck$|^덱 추가$/ }).click()
  const input = page.getByPlaceholder('~/Documents/decks')
  await input.fill(`${home}/decks`)
  await page.getByRole('button', { name: /^Add$|^추가$/ }).click()
  await expect(page.getByRole('option', { name: /acme-quarterly/ })).toBeVisible()
}

export async function selectDeck(page: Page, name: string) {
  await page.getByRole('option', { name: new RegExp(name) }).click()
  // Slides section opens and thumbnails render.
  await expect(page.locator('#slides-body')).toBeVisible()
}
