import { expect, test } from '@playwright/test'
import { addFixtureRoot, openApp, resetBackend, selectDeck } from './helpers'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await resetBackend(page)
})

test('boots, connects, shows version and ui build stamp', async ({ page }) => {
  await openApp(page)
  await expect(page.getByRole('status')).toContainText(/Version \d+\.\d+\.\d+/)
  await expect(page.getByRole('status')).toContainText(/ui \d{4}/)
  await expect(page.getByText(/No decks yet/)).toBeVisible()
})

test('connects automatically once a late backend comes up', async ({ page }) => {
  await page.request.get('/__ctl/backend/stop')
  await page.goto('/')
  await page.waitForFunction(() => (window as any).__hsReady === true)
  // While the backend is down: no "No decks" half-state, add/refresh disabled.
  await expect(page.getByRole('status')).toContainText(/Connecting|unreachable/)
  await expect(page.getByRole('button', { name: /^Add deck$/ })).toBeDisabled()
  await expect(page.getByText(/No decks yet/)).toHaveCount(0)

  await page.request.get('/__ctl/backend/start')
  await expect(page.getByRole('status')).toContainText(/Backend connected/, { timeout: 15_000 })
  await expect(page.getByRole('button', { name: /^Add deck$/ })).toBeEnabled()
})

test('adds a root, lists decks, removes the root', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await expect(page.getByRole('option', { name: /acme-quarterly/ })).toContainText('4 slides')
  await expect(page.getByRole('option', { name: /acme-built/ })).toContainText('3 slides')
  await expect(page.getByRole('option', { name: /acme-built/ })).toContainText('single file')

  await page.getByRole('button', { name: /^Remove / }).click()
  await expect(page.getByText(/No decks yet/)).toBeVisible()
})

test('rejects a root outside the home directory with a readable error', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: /^Add deck$/ }).click()
  await page.getByPlaceholder('~/Documents/decks').fill('/usr')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await expect(page.getByRole('alert')).toContainText(/inside your home directory/)
  // A 400 from the backend is NOT a connection problem: status stays green.
  await expect(page.getByRole('status')).toContainText(/Backend connected/)
  await expect(page.getByRole('alert')).not.toContainText(/unreachable|not running/)
})

test('previews a slides deck: thumbnails, viewer, keyboard, image resolves', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')

  // Deck section auto-collapses, slides section opens with 4 thumbnails.
  await expect(page.locator('#slides-body li')).toHaveCount(4)
  await expect(page.getByText('1 / 4')).toBeVisible()

  // Viewer iframe renders the wrapped slide.
  const viewer = page.locator('iframe[title="010_cover.html"]').last()
  await expect(viewer).toBeVisible()
  const src = await viewer.getAttribute('src')
  expect(src).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/slide\/0$/)
  const page0 = await (await page.request.get(src!)).text()
  expect(page0).toContain('Acme Quarterly Review')
  expect(page0).toContain('<base href="/">')
  expect(page0).toContain('class="pageno">1<')

  // Keyboard navigation moves the viewer and the strip selection.
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('3 / 4')).toBeVisible()
  await expect(page.locator('#slides-body [aria-current="true"]')).toContainText('030_uptime.html')

  // The image referenced as img/chart.png actually loads inside the frame.
  const frame = page.frameLocator('iframe[title="030_uptime.html"]').last()
  const natural = await frame.locator('img.fixture-img').evaluate((img: HTMLImageElement) =>
    img.complete ? img.naturalWidth : new Promise((r) => (img.onload = () => r(img.naturalWidth))),
  )
  expect(natural).toBe(8)

  await page.keyboard.press('End')
  await expect(page.getByText('4 / 4')).toBeVisible()
  await page.keyboard.press('Home')
  await expect(page.getByText('1 / 4')).toBeVisible()
})

test('sidebar slide list scrolls inside its own pane', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 520 }) // short window forces overflow
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')
  const body = page.locator('#slides-body')
  const metrics = await body.evaluate((el) => ({
    scrollH: el.scrollHeight,
    clientH: el.clientHeight,
    overflowY: getComputedStyle(el).overflowY,
    docScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }))
  expect(metrics.overflowY).toMatch(/auto|scroll/)
  expect(metrics.scrollH).toBeGreaterThan(metrics.clientH)
  // The page itself does not grow: the pane is the scroller.
  expect(metrics.docScroll).toBeLessThanOrEqual(2)
  await body.evaluate((el) => (el.scrollTop = 10_000))
  expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
})

test('builds a slides deck with the built-in assembler and shows the output', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')
  const build = page.getByRole('button', { name: /^Build$/ })
  await expect(build).toBeEnabled()
  await build.click()
  await expect(page.getByRole('status').filter({ hasText: /Build succeeded/ })).toBeVisible()
  await expect(page.getByText(/Built-in assembler/)).toBeVisible()

  // View toggle appears and the output iframe loads the assembled deck.
  const toggle = page.getByRole('group', { name: /^View$/ })
  await expect(toggle).toBeVisible()
  const out = page.locator('iframe[title="out/index.html"]')
  await expect(out).toBeVisible()
  const outSrc = await out.getAttribute('src')
  const html = await (await page.request.get(outSrc!)).text()
  expect(html).toContain('Acme Quarterly Review')
  expect(html).toContain('hs-counter')

  await toggle.getByRole('button', { name: /^Slides$/ }).click()
  await expect(page.getByText('1 / 4')).toBeVisible()
})

test('single-file deck: previews sections, build is disabled with a hint', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-built')
  await expect(page.locator('#slides-body li')).toHaveCount(3)
  const viewer = page.locator('iframe[title="index.html#1"]').last()
  const src = await viewer.getAttribute('src')
  const html = await (await page.request.get(src!)).text()
  expect(html).toContain('Acme Launch')
  expect(html).toContain('<symbol id="i-check"') // hidden icon library carried over
  expect(html).toContain('.slide.cover{background:#1e1b4b') // own <style> carried over
  expect(html).not.toContain('--hs-accent') // default theme NOT injected

  const build = page.getByRole('button', { name: /^Build$/ })
  await expect(build).toBeDisabled()
  await expect(build).toHaveAttribute('title', /Single-file deck/)
  // Built output is viewable immediately: the file is the output.
  await expect(page.getByRole('group', { name: /^View$/ })).toBeVisible()
})

test('present opens an in-app presenter at the current slide', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')
  await page.getByRole('button', { name: /^Build$/ }).click()
  await expect(page.getByRole('status').filter({ hasText: /Build succeeded/ })).toBeVisible()
  await page.getByRole('group', { name: /^View$/ }).getByRole('button', { name: /^Slides$/ }).click()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('3 / 4')).toBeVisible()

  await page.getByRole('button', { name: /^Present$/ }).click()
  const dialog = page.getByRole('dialog', { name: /Presentation/ })
  await expect(dialog).toBeVisible()
  const frame = page.frameLocator('iframe[title="Presentation"]')
  await expect(frame.locator('.slide.active')).toContainText('Uptime')
  await expect(frame.locator('#hs-counter')).toHaveText('3 / 4')

  await page.keyboard.press('ArrowRight')
  await expect(frame.locator('#hs-counter')).toHaveText('4 / 4')
  await page.mouse.move(400, 300) // control bar auto-hides; a pointer move reveals it
  await expect(dialog.getByText('4 / 4')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('exports the built deck to PDF', async ({ page }) => {
  test.setTimeout(120_000) // headless Chromium cold start can be slow
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')
  await page.getByRole('button', { name: /^Build$/ }).click()
  await expect(page.getByRole('status').filter({ hasText: /Build succeeded/ })).toBeVisible()
  await page.getByRole('button', { name: /^PDF$/ }).click()
  const done = page.getByRole('status').filter({ hasText: /PDF saved/ })
  await expect(done).toBeVisible({ timeout: 60_000 })
  await expect(done).toContainText(/acme-quarterly\.pdf/)
  await expect(page.getByRole('button', { name: /Show in folder/ })).toBeVisible()
})
