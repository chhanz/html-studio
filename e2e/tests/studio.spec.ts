import { expect, test } from '@playwright/test'
import { addFixtureRoot, fakeHome, openApp, resetBackend, selectDeck } from './helpers'

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
  const read = () =>
    body.evaluate((el) => ({
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
      docScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }))
  // Thumbnails render lazily; wait until the list actually overflows.
  await expect.poll(async () => (await read()).scrollH > (await read()).clientH).toBe(true)
  const metrics = await read()
  expect(metrics.overflowY).toMatch(/auto|scroll/)
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
  await page.keyboard.press('ArrowLeft')
  await expect(frame.locator('#hs-counter')).toHaveText('3 / 4')

  // Image under the pointer → lightbox (hit-tested inside the deck frame).
  const img = frame.locator('.slide.active img')
  const box = await img.boundingBox()
  if (!box) throw new Error('fixture image not laid out')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const zoom = page.getByTestId('present-zoom')
  await expect(zoom).toBeVisible()
  // Handed over as a data URL: the dashboard CSP forbids http: image sources.
  await expect(zoom.locator('img')).toHaveAttribute('src', /^data:image\/png;base64,/)
  await expect.poll(() => zoom.locator('img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
  await expect(zoom).toHaveAccessibleName('Uptime chart')
  await page.keyboard.press('Escape') // closes the lightbox only
  await expect(zoom).toHaveCount(0)
  await expect(dialog).toBeVisible()
  await expect(frame.locator('#hs-counter')).toHaveText('3 / 4')

  await page.getByTestId('present-shield').click({ position: { x: 5, y: 5 } }) // miss: clicks never navigate
  await page.waitForTimeout(200)
  await expect(frame.locator('#hs-counter')).toHaveText('3 / 4')
  await page.keyboard.press('ArrowRight')
  await expect(frame.locator('#hs-counter')).toHaveText('4 / 4')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  // Presenting again works after a close.
  await page.getByRole('button', { name: /^Present$/ }).click()
  await expect(dialog).toBeVisible()
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

test('deck chat pane: looks up, starts once, embeds the deck session', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  const home = await fakeHome(page)
  const pane = page.getByTestId('deck-chat')
  await expect(pane).toHaveAttribute('data-status', 'idle')
  // Collapsed by default, with a one-line purpose in the header; open it.
  const header = page.getByRole('button', { name: /Deck chat/ })
  await expect(header).toHaveAttribute('aria-expanded', 'false')
  await expect(header).toContainText('ask the agent to change this deck')
  await header.click()
  await expect(header).toHaveAttribute('aria-expanded', 'true')

  await selectDeck(page, 'acme-quarterly')
  // Selecting only looks up (read-only): no session yet, offer to start.
  await expect(pane).toHaveAttribute('data-status', 'none')
  let state = await (await page.request.get('/__ctl/chat')).json()
  expect(state.slots).toHaveLength(0)
  expect(state.log.every((l: any) => l.method === 'GET')).toBe(true)

  await page.getByRole('button', { name: /^Start deck chat$/ }).click()
  await expect(pane).toHaveAttribute('data-status', 'ready')
  const embed = page.getByTestId('chat-embed')
  await expect(embed).toBeVisible()
  const key = await embed.getAttribute('data-slot')
  expect(key).toMatch(/^html-studio-[0-9a-f]{12}$/)

  state = await (await page.request.get('/__ctl/chat')).json()
  expect(state.slots).toHaveLength(1)
  const slot = state.slots[0]
  expect(slot.key).toBe(key)
  expect(slot.title).toBe('HTML Studio · acme-quarterly')
  expect(slot.project).toBe(`${home}/decks/acme-quarterly`)
  expect(slot.messages).toBe(1) // the brief
  const sends = state.log.filter((l: any) => l.path.startsWith('/api/chat?'))
  expect(sends).toHaveLength(1)
  expect(sends[0].body.slot).toBe(key)
  expect(sends[0].body.message).toContain('slides folder: 4 slides in slides/')
  expect(sends[0].body.message).toContain(`Path: ${home}/decks/acme-quarterly`)
  expect(sends[0].body.message).toContain("HTML Studio's built-in assembler")
  expect(sends[0].body.message).toContain('acknowledgement in English')

  // "Open in Chat" navigates to the same session.
  await page.getByRole('button', { name: /^Open in Chat/ }).click()
  expect(await page.evaluate(() => (window as any).__hsNav?.at(-1))).toBe(`/chat?sid=${key}`)

  // Another deck: its own lookup, no session; switching back finds the existing one without a second brief.
  await selectDeck(page, 'acme-built')
  await expect(pane).toHaveAttribute('data-status', 'none')
  await selectDeck(page, 'acme-quarterly')
  await expect(pane).toHaveAttribute('data-status', 'ready')
  await expect(page.getByTestId('chat-embed')).toHaveAttribute('data-slot', key!)
  state = await (await page.request.get('/__ctl/chat')).json()
  expect(state.slots).toHaveLength(1)
  expect(state.log.filter((l: any) => l.path.startsWith('/api/chat?'))).toHaveLength(1)

  // Collapsing the pane hides the embed but keeps the header.
  await page.getByRole('button', { name: /Deck chat/ }).click()
  await expect(page.getByTestId('chat-embed')).toHaveCount(0)
  await expect(pane).toBeVisible()
})

test('viewer fits its box at any chat size; the splitter resizes and persists', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')
  await page.getByRole('button', { name: /Deck chat/ }).click() // open the (default-collapsed) chat pane

  const fits = async () => {
    const box = await page.getByTestId('slide-fit').boundingBox()
    const stage = await page.getByTestId('slide-stage').boundingBox()
    expect(box && stage).toBeTruthy()
    // Whole 16:9 stage inside the available box (no clipped footer), aspect kept.
    expect(stage!.width).toBeLessThanOrEqual(box!.width + 1)
    expect(stage!.height).toBeLessThanOrEqual(box!.height + 1)
    expect(Math.abs(stage!.width / stage!.height - 16 / 9)).toBeLessThan(0.02)
    return stage!
  }
  const before = await fits()
  const chatBefore = (await page.getByTestId('deck-chat').boundingBox())!.height

  // Drag the splitter up: chat grows, preview shrinks, stage still fits.
  const handle = page.getByTestId('split-handle')
  const hb = (await handle.boundingBox())!
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  await page.mouse.move(hb.x + hb.width / 2, hb.y - 120, { steps: 6 })
  await page.mouse.up()
  const chatAfter = (await page.getByTestId('deck-chat').boundingBox())!.height
  expect(chatAfter).toBeGreaterThan(chatBefore + 60)
  const after = await fits()
  expect(after.height).toBeLessThan(before.height)
  const ratio = Number(await handle.getAttribute('aria-valuenow'))
  expect(ratio).toBeGreaterThan(40)

  // Persisted across a reload.
  await page.reload()
  await page.waitForFunction(() => (window as any).__hsReady === true)
  await expect(page.getByTestId('split-handle')).toHaveAttribute('aria-valuenow', String(ratio))

  // Collapsing the chat gives the preview the full height again.
  await selectDeck(page, 'acme-quarterly')
  await fits()
  await page.getByRole('button', { name: /Deck chat/ }).click()
  await expect(page.getByTestId('split-handle')).toHaveCount(0)
  const full = await fits()
  expect(full.height).toBeGreaterThan(after.height)
})

test('DESIGN.md: theme row shows the design, tokens.css is written on demand and restyles the preview', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await expect(page.getByRole('option', { name: /acme-quarterly/ })).toContainText('DESIGN.md')
  await selectDeck(page, 'acme-quarterly')

  const row = page.getByTestId('theme-row')
  await expect(row).toBeVisible()
  await expect(row).toContainText('Acme Lab')
  await expect(row).toContainText('AcmeSans')
  await expect(row).toHaveAttribute('data-tokens', 'missing')
  const primary = row.locator('[data-testid="theme-swatch"][data-name="primary"]')
  await expect(primary).toHaveAttribute('title', 'primary #0f766e')

  // Before: default theme accent.
  const frame = page.frameLocator('iframe[title="010_cover.html"]').first()
  const accent = () => frame.locator('html').evaluate((el) => getComputedStyle(el).getPropertyValue('--hs-accent').trim())
  expect(await accent()).toBe('#6d5efc')
  await expect(page.getByText(/^Built-in theme$/)).toBeVisible()

  await page.getByRole('button', { name: /^Generate tokens\.css$/ }).click()
  await expect(row).toHaveAttribute('data-tokens', 'fresh')
  await expect(page.getByText(/^Built-in theme \+ tokens\.css$/)).toBeVisible()
  // After: the preview server serves tokens.css and the slide picks up the DESIGN.md primary.
  const home = await fakeHome(page)
  await expect.poll(accent).toBe('#0f766e')
  const css = await (await page.request.get(`/apps/html-studio/api/design?path=${encodeURIComponent(`${home}/decks/acme-quarterly`)}`)).json()
  expect(css.tokensExists).toBe(true)
  expect(css.css).toBe('tokens.css')
})
