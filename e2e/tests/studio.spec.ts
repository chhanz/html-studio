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

  // Output view follows the thumbnail strip (regression: clicking a thumbnail did nothing here) ...
  const outFrame = page.frameLocator('iframe[title="out/index.html"]')
  await expect(outFrame.locator('#hs-counter')).toHaveText('1 / 4')
  await page.locator('#slides-body li').nth(2).click()
  await expect(outFrame.locator('#hs-counter')).toHaveText('3 / 4')
  await expect(outFrame.locator('.slide.active')).toContainText('Uptime')
  // ... and the strip follows navigation inside the built deck.
  await outFrame.locator('.slide.active').click()
  await page.keyboard.press('ArrowRight')
  await expect(outFrame.locator('#hs-counter')).toHaveText('4 / 4')
  await expect(page.locator('#slides-body li').nth(3).locator('> button')).toHaveAttribute('aria-current', 'true')

  await toggle.getByRole('button', { name: /^Slides$/ }).click()
  await expect(page.getByText('4 / 4')).toBeVisible()
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
  await page.setViewportSize({ width: 1280, height: 900 }) // room for preview + notes header + chat
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')
  await page.getByRole('button', { name: /Deck chat/ }).click() // open the (default-collapsed) chat pane

  const fits = async () => {
    // The stage re-measures through a ResizeObserver, so poll until it has settled
    // inside its box: whole 16:9 stage visible (no clipped footer), aspect kept.
    let stage = (await page.getByTestId('slide-stage').boundingBox())!
    await expect
      .poll(async () => {
        const box = (await page.getByTestId('slide-fit').boundingBox())!
        stage = (await page.getByTestId('slide-stage').boundingBox())!
        return stage.width <= box.width + 1 && stage.height <= box.height + 1
      })
      .toBe(true)
    expect(Math.abs(stage.width / stage.height - 16 / 9)).toBeLessThan(0.02)
    return stage
  }
  const before = await fits()
  const chatBefore = (await page.getByTestId('deck-chat').boundingBox())!.height

  // Drag the splitter up: chat grows, preview shrinks, stage still fits.
  const handle = page.getByTestId('split-handle')
  const hb = (await handle.boundingBox())!
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(50) // pointer capture + listeners attach in the down handler
  await page.mouse.move(hb.x + hb.width / 2, hb.y - 120, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await page.getByTestId('deck-chat').boundingBox())!.height).toBeGreaterThan(chatBefore + 60)
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

test('select-to-edit: clicking an element pins it with file, selector and text; pins persist and re-anchor', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')
  await page.locator('#slides-body li').nth(2).click() // 030_uptime.html (has an image)

  const select = page.getByRole('button', { name: /^Select$/ })
  await expect(select).toHaveAttribute('aria-pressed', 'false')
  // Plain viewer: no overlay, no scripts.
  const viewer = page.locator('[data-testid="slide-stage"] iframe')
  expect(await viewer.getAttribute('sandbox')).toBe('allow-same-origin')
  expect(await viewer.getAttribute('src')).not.toContain('hs=select')

  await select.click()
  await expect(select).toHaveAttribute('aria-pressed', 'true')
  await expect(viewer).toHaveAttribute('src', /\/slide\/2\?hs=select$/)
  expect(await viewer.getAttribute('sandbox')).toContain('allow-scripts')
  const frame = page.frameLocator('[data-testid="slide-stage"] iframe')
  await expect(frame.locator('.hs-pin-layer')).toHaveCount(1) // overlay booted

  // Hover shows the highlight box with a label; click captures the element.
  const img = frame.locator('img.fixture-img')
  await img.hover()
  await expect(frame.locator('.hs-sel-label')).toHaveText('img.fixture-img')
  await img.click()
  const pin = page.getByTestId('pin')
  await expect(pin).toHaveCount(1)
  await expect(pin).toContainText('030_uptime.html')
  await expect(pin).toContainText('img.fixture-img')
  await expect(pin).toHaveAttribute('data-how', 'selector')
  await expect(frame.locator('.hs-pin')).toHaveText('1')
  await expect(frame.locator('.hs-pin')).toHaveAttribute('data-how', 'selector')

  // Comment goes in the focused input and is kept per deck (reload).
  const input = page.getByRole('textbox', { name: /Comment for pin 1/ })
  await input.fill('Make the chart wider')
  await page.locator('#slides-body li').nth(0).click()
  const h1 = frame.locator('.slide h1')
  await h1.click()
  await expect(page.getByTestId('pin')).toHaveCount(2)
  await expect(page.getByTestId('pin').nth(1)).toContainText('010_cover.html')
  await expect(page.getByTestId('pin').nth(1)).toContainText('"Acme Quarterly Review"')
  await expect(frame.locator('.hs-pin')).toHaveText('2') // only this slide's marker is drawn

  await page.reload()
  await page.waitForFunction(() => (window as any).__hsReady === true)
  await selectDeck(page, 'acme-quarterly')
  await expect(page.getByTestId('pin')).toHaveCount(2)
  await expect(page.getByRole('textbox', { name: /Comment for pin 1/ })).toHaveValue('Make the chart wider')

  // Jump from the pin to its slide; markers come back once selection is on again.
  await page.getByRole('button', { name: /Go to slide 3/ }).click()
  await expect(page.getByText('3 / 4')).toBeVisible()
  await page.getByRole('button', { name: /^Select$/ }).click()
  await expect(page.frameLocator('[data-testid="slide-stage"] iframe').locator('.hs-pin')).toHaveText('1')

  // Remove one pin; the other keeps its number.
  await page.getByRole('button', { name: /^Remove pin$/ }).first().click()
  await expect(page.getByTestId('pin')).toHaveCount(1)
  await expect(page.getByTestId('pin')).toContainText('010_cover.html')
  await page.getByRole('button', { name: /^Clear all$/ }).click()
  await expect(page.getByTestId('pins-panel')).toHaveCount(0)
})

test('pins are sent to the deck chat as a batch; agent reports flow back; questions can be answered', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')
  const home = await fakeHome(page)
  await page.getByRole('button', { name: /^Select$/ }).click()
  const frame = page.frameLocator('[data-testid="slide-stage"] iframe')
  await frame.locator('.slide h1').click()
  await page.getByRole('textbox', { name: /Comment for pin 1/ }).fill('Shorter title')
  await page.locator('#slides-body li').nth(2).click()
  await frame.locator('img.fixture-img').click()

  // Every draft needs a comment before the batch can go.
  const send = page.getByTestId('pins-send')
  await expect(send).toBeDisabled()
  await expect(page.getByTestId('pins-panel')).toContainText('Every pin needs a comment')
  await page.getByRole('textbox', { name: /Comment for pin 2/ }).fill('Wider chart')
  await expect(send).toBeEnabled()
  await send.click()

  // Both pins are out with the agent; the deck chat got created, briefed and given the batch prompt.
  await expect(page.getByTestId('pin').nth(0)).toHaveAttribute('data-status', 'sent')
  await expect(page.getByTestId('pin').nth(1)).toHaveAttribute('data-status', 'sent')
  // The chat pane now knows the session exists (it was created by the send).
  await expect(page.getByTestId('deck-chat')).toHaveAttribute('data-status', 'ready')
  const chat = await (await page.request.get('/__ctl/chat')).json()
  const sends = chat.log.filter((l: any) => l.path.startsWith('/api/chat?'))
  expect(sends).toHaveLength(2) // brief + batch
  const prompt: string = sends[1].body.message
  expect(prompt).toContain('Visual edit batch')
  expect(prompt).toContain('2 pinned comments')
  expect(prompt).toContain('deck-visual-edit/SKILL.md')
  expect(prompt).toContain('slides/010_cover.html > h1:nth-of-type(1) "Acme Quarterly Review": Shorter title')
  expect(prompt).toContain('slides/030_uptime.html > img:nth-of-type(1): Wider chart')
  const batchFile = /Read the batch \(do NOT modify this file\): (\S+)/.exec(prompt)![1]
  const cids = [...prompt.matchAll(/^- \[([a-z0-9-]+)\]/gm)].map((m) => m[1])
  expect(cids).toHaveLength(2)

  // The agent reports through report.py: first pin done, second a question.
  const report = (cid: string, status: string, text: string) =>
    page.request.get(`/__ctl/report?batch=${encodeURIComponent(batchFile)}&cid=${cid}&status=${status}&text=${encodeURIComponent(text)}`)
  expect((await report(cids[0], 'done', 'Title shortened to two words')).ok()).toBeTruthy()
  await expect(page.getByTestId('pin').nth(0)).toHaveAttribute('data-status', 'done', { timeout: 10_000 })
  await expect(page.getByTestId('pin').nth(0).getByTestId('pin-thread')).toContainText('Title shortened to two words')
  expect((await report(cids[1], 'question', 'Wider by how much?')).ok()).toBeTruthy()
  await expect(page.getByTestId('pin').nth(1)).toHaveAttribute('data-status', 'question', { timeout: 10_000 })

  // Answering a question sends a follow-up to the same session and puts the pin back in flight.
  await page.getByRole('textbox', { name: /Answer the agent's question/ }).fill('Full width')
  await page.getByRole('button', { name: /^Reply$/ }).click()
  await expect(page.getByTestId('pin').nth(1)).toHaveAttribute('data-status', 'sent')
  const chat2 = await (await page.request.get('/__ctl/chat')).json()
  const follow = chat2.log.filter((l: any) => l.path.startsWith('/api/chat?')).at(-1)
  expect(follow.body.message).toContain(`Re pin [${cids[1]}]`)
  expect(follow.body.message).toContain('Full width')
  expect(chat2.slots).toHaveLength(1)

  // Finished pins can be dismissed; the batch stays until all its pins are done.
  await page.getByRole('button', { name: /^Dismiss finished$/ }).click()
  await expect(page.getByTestId('pin')).toHaveCount(1)
  const queue = await (await page.request.get(`/apps/html-studio/api/pins/queue?path=${encodeURIComponent(`${home}/decks/acme-quarterly`)}`)).json()
  expect(queue.batches).toHaveLength(1)
})

test('deck check: finds the known issues, Fix turns an issue into a pin, Pin all covers the rest', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-messy')
  await page.getByRole('button', { name: /^Check$/ }).click()
  await expect(page.getByRole('button', { name: /Checking 2 slides/ })).toBeVisible()
  const panel = page.getByTestId('check-panel')
  await expect(panel).toBeVisible({ timeout: 60_000 })

  const counts = async () => {
    const chips = await panel.getByTestId('check-count').all()
    const out: Record<string, string> = {}
    for (const c of chips) out[(await c.getAttribute('data-rule'))!] = (await c.textContent())!
    return out
  }
  const c = await counts()
  expect(Object.keys(c).sort()).toEqual(['broken-image', 'missing-cover', 'overlap', 'punctuation'])
  expect(c['punctuation']).toMatch(/2$/) // the label's middle dots and the heading's em dash
  await expect(panel).toContainText('contains middle dot')
  await expect(panel).toContainText('contains em dash')
  await expect(panel).toContainText('img/nope.png')
  // every issue sits on slide 1; the clean slide reports nothing
  const issues = panel.getByTestId('check-issue')
  const n = await issues.count()
  expect(n).toBeGreaterThanOrEqual(5)
  await expect(panel.getByRole('button', { name: /^2\. 020_clean\.html$/ })).toHaveCount(0)

  // Fix one issue: it becomes a pin with a prefilled comment and is marked handled.
  const punct = panel.locator('[data-testid="check-issue"][data-rule="punctuation"]').first()
  await punct.getByRole('button', { name: /^Fix$/ }).click()
  await expect(punct).toHaveAttribute('data-pinned', 'true')
  const pin = page.getByTestId('pin').first()
  await expect(pin).toContainText('slides/010_intro.html')
  await expect(page.getByRole('textbox', { name: /Comment for pin 1/ })).toHaveValue(/Rewrite without em\/en dashes and middle dots/)
  // Fixing the same issue again is a no-op.
  await expect(punct.getByRole('button')).toBeDisabled()

  // Pin all: the remaining issues become pins; the check panel shows them all handled.
  await panel.getByRole('button', { name: /^Pin all/ }).click()
  await expect(page.getByTestId('pin')).toHaveCount(n)
  await expect(panel.locator('[data-testid="check-issue"][data-pinned="false"]')).toHaveCount(0)
  await expect(panel.getByRole('button', { name: /^Pin all/ })).toHaveCount(0)
  const sendBtn = page.getByTestId('pins-send')
  await expect(sendBtn).toBeEnabled() // every generated pin already has a comment
})

test('quick action chips send a prompt about the current slide to the deck chat', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')
  const home = await fakeHome(page)
  await page.getByRole('button', { name: /Deck chat/ }).click()
  const chips = page.getByTestId('quick-chips')
  await expect(chips).toContainText('Quick actions for slide 1')
  await page.locator('#slides-body li').nth(2).click()
  await expect(chips).toContainText('Quick actions for slide 3')

  // No session yet: the chip creates it (brief first), then sends the prompt.
  await chips.getByRole('button', { name: /^Summarize$/ }).click()
  await expect(chips.getByRole('status')).toHaveText('Sent to the deck chat')
  let chat = await (await page.request.get('/__ctl/chat')).json()
  expect(chat.slots).toHaveLength(1)
  expect(chat.slots[0].project).toBe(`${home}/decks/acme-quarterly`)
  let sends = chat.log.filter((l: any) => l.path.startsWith('/api/chat?'))
  expect(sends).toHaveLength(2) // brief + summarize
  expect(sends[1].body.message).toContain('Summarize slide 3 of 4 (slides/030_uptime.html) in English')
  expect(sends[1].body.message).toContain('Do not edit any file')
  await expect(page.getByTestId('deck-chat')).toHaveAttribute('data-status', 'ready')

  // Second chip reuses the session; the notes prompt names the sidecar file.
  await chips.getByRole('button', { name: /^Write notes$/ }).click()
  await expect(chips.getByRole('status')).toHaveText('Sent to the deck chat')
  chat = await (await page.request.get('/__ctl/chat')).json()
  expect(chat.slots).toHaveLength(1)
  sends = chat.log.filter((l: any) => l.path.startsWith('/api/chat?'))
  expect(sends).toHaveLength(3)
  expect(sends[2].body.message).toContain('notes/030_uptime.md')
  expect(sends[2].body.message).toContain('Do not touch the slide HTML')

  // Tighten mentions the design system when the deck has a DESIGN.md.
  await chips.getByRole('button', { name: /^Tighten text$/ }).click()
  await expect(chips.getByRole('status')).toHaveText('Sent to the deck chat')
  chat = await (await page.request.get('/__ctl/chat')).json()
  const last = chat.log.filter((l: any) => l.path.startsWith('/api/chat?')).at(-1)
  expect(last.body.message).toContain('Follow DESIGN.md / tokens.css')
  expect(last.body.message).toContain('No em/en dashes or middle dots')
})

test('speaker notes: autosaves notes/<slide>.md, marks the thumbnail, survives reload, empty text removes the file', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')
  const home = await fakeHome(page)
  const deckPath = `${home}/decks/acme-quarterly`
  const header = page.getByRole('button', { name: /^Notes for slide 1/ })
  await expect(header).toHaveAttribute('aria-expanded', 'false')
  await expect(header).toContainText('speaker notes')
  await header.click()
  const box = page.getByRole('textbox', { name: /Notes for slide 1/ })
  await expect(box).toBeVisible()
  await expect(box).toHaveValue('')
  await expect(header).toContainText('notes/010_cover.md')

  await box.fill('- Welcome everyone\n- Agenda first')
  const panel = page.getByTestId('notes-panel')
  await expect(panel).toHaveAttribute('data-save', 'saved', { timeout: 5000 })
  const note = await (await page.request.get(`/apps/html-studio/api/note?path=${encodeURIComponent(deckPath)}&slide=010_cover.html`)).json()
  expect(note.text).toBe('- Welcome everyone\n- Agenda first\n')
  await expect(page.locator('#slides-body li').nth(0).getByTestId('strip-note')).toBeVisible()
  await expect(page.locator('#slides-body li').nth(1).getByTestId('strip-note')).toHaveCount(0)

  // Another slide has its own (empty) note; coming back restores the text.
  await page.locator('#slides-body li').nth(1).click()
  await expect(page.getByRole('textbox', { name: /Notes for slide 2/ })).toHaveValue('')
  await page.locator('#slides-body li').nth(0).click()
  await expect(page.getByRole('textbox', { name: /Notes for slide 1/ })).toHaveValue('- Welcome everyone\n- Agenda first\n')

  // Notes never reach the slide or the print document.
  const slide = await (await page.request.get(`${(await (await page.request.get(`/apps/html-studio/api/preview/start`, { data: { path: deckPath } })).json()).baseUrl}/print`)).text()
  expect(slide).not.toContain('Welcome everyone')

  // Reload keeps the note and the marker; the pane's open state is remembered.
  await page.reload()
  await page.waitForFunction(() => (window as any).__hsReady === true)
  await selectDeck(page, 'acme-quarterly')
  await expect(page.getByRole('textbox', { name: /Notes for slide 1/ })).toHaveValue('- Welcome everyone\n- Agenda first\n')
  await expect(page.locator('#slides-body li').nth(0).getByTestId('strip-note')).toBeVisible()

  // Clearing removes the sidecar file.
  await page.getByRole('textbox', { name: /Notes for slide 1/ }).fill('')
  await expect(page.getByTestId('notes-panel')).toHaveAttribute('data-save', 'saved', { timeout: 5000 })
  const idx = await (await page.request.get(`/apps/html-studio/api/notes?path=${encodeURIComponent(deckPath)}`)).json()
  expect(idx.withNotes).toEqual([])
  await expect(page.locator('#slides-body li').nth(0).getByTestId('strip-note')).toHaveCount(0)
})

test('present opens the presenter window in ANOTHER browser and stays in sync: slides, pen, black', async ({ page, browser }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')
  const home = await fakeHome(page)
  const deckPath = `${home}/decks/acme-quarterly`
  await page.request.post('/apps/html-studio/api/note', { data: { path: deckPath, slide: '020_agenda.html', text: '- Three items\n- Keep it short' } })
  await page.getByRole('button', { name: /^Build$/ }).click()
  await expect(page.getByRole('status').filter({ hasText: /Build succeeded/ })).toBeVisible()
  await page.getByRole('group', { name: /^View$/ }).getByRole('button', { name: /^Slides$/ }).click()

  // Present: the show opens here; the presenter window is requested from the backend
  // (no browser launch in tests, so we open its URL ourselves in a separate browser context).
  await page.getByRole('button', { name: /^Present$/ }).click()
  const dialog = page.getByRole('dialog', { name: /Presentation/ })
  await expect(dialog).toBeVisible()
  const frame = page.frameLocator('iframe[title="Presentation"]')
  await expect(frame.locator('#hs-counter')).toHaveText('1 / 4')
  await expect(page.getByTestId('present-presenter')).toHaveAttribute('data-on', 'false')
  const presenterUrl = (await (await page.request.post('/apps/html-studio/api/present', { data: { path: deckPath, slide: 1, mode: 'presenter', language: 'en' } })).json()).url as string
  expect(presenterUrl).toMatch(/\/presenter\?lang=en#1$/)
  const other = await browser.newContext()
  const presenter = await other.newPage()
  await presenter.goto(presenterUrl)
  await expect(presenter.locator('#cur-label')).toHaveText('Slide 1 of 4')
  await expect(presenter.locator('#notes')).toHaveText('No notes for this slide.')
  await expect(page.getByTestId('present-presenter')).toHaveAttribute('data-on', 'true')

  // Presenter navigates: the show follows; notes and next slide update in the presenter.
  await presenter.keyboard.press('ArrowRight')
  await expect(presenter.locator('#cur-label')).toHaveText('Slide 2 of 4')
  await expect(presenter.locator('#notes')).toContainText('Keep it short')
  await expect(presenter.locator('#next-label')).toHaveText('Next: slide 3')
  await expect(frame.locator('#hs-counter')).toHaveText('2 / 4')

  // The show navigates (clicker on the presenting machine): the presenter follows.
  await page.keyboard.press('ArrowRight')
  await expect(frame.locator('#hs-counter')).toHaveText('3 / 4')
  await expect(presenter.locator('#cur-label')).toHaveText('Slide 3 of 4')

  // Pen: a drag on the presenter's current slide draws a stroke that the show mirrors.
  const stage = presenter.locator('#cur-stage')
  const box = (await stage.boundingBox())!
  const stateUrl = presenterUrl.replace(/\/presenter.*$/, '/present/state')
  const strokesOf = async (slide: number) => ((await (await page.request.get(stateUrl)).json()).ink?.[String(slide)] ?? []) as { id: string; pts: [number, number][] }[]
  await presenter.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5)
  await presenter.mouse.down()
  await presenter.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 12 })
  await presenter.mouse.up()
  const ink = page.getByTestId('present-ink')
  await expect(ink).toHaveAttribute('data-strokes', '1')
  await expect.poll(async () => (await strokesOf(2))[0]?.pts.length ?? 0).toBeGreaterThan(5)
  const pts = (await strokesOf(2))[0].pts
  expect(pts[0][0]).toBeGreaterThan(200) // 20% of the 1280 stage
  expect(pts[0][0]).toBeLessThan(320)
  expect(pts[pts.length - 1][0]).toBeGreaterThan(700) // 60%
  // The drawing belongs to slide 3: the next slide is blank, coming back shows it again.
  await presenter.keyboard.press('ArrowRight')
  await expect(frame.locator('#hs-counter')).toHaveText('4 / 4')
  await expect(ink).toHaveAttribute('data-strokes', '0')
  await presenter.keyboard.press('ArrowLeft')
  await expect(frame.locator('#hs-counter')).toHaveText('3 / 4')
  await expect(ink).toHaveAttribute('data-strokes', '1')
  // A second stroke, then Clear removes this slide's drawing everywhere.
  await presenter.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.2)
  await presenter.mouse.down()
  await presenter.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4, { steps: 6 })
  await presenter.mouse.up()
  await expect(ink).toHaveAttribute('data-strokes', '2')
  await presenter.getByRole('button', { name: 'Clear pen' }).click()
  await expect(ink).toHaveAttribute('data-strokes', '0')
  expect(await strokesOf(2)).toEqual([])
  // Draw once more so the end of the show has something to wipe.
  await presenter.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3)
  await presenter.mouse.down()
  await presenter.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.3, { steps: 4 })
  await presenter.mouse.up()
  await expect(ink).toHaveAttribute('data-strokes', '1')

  // Black both ways.
  await presenter.locator('#black').click()
  await expect(page.getByTestId('present-black')).toBeVisible()
  await page.mouse.move(400, 300) // the control bar auto-hides; a pointer move brings it back
  await page.getByRole('button', { name: /^Black$/ }).click({ force: true })
  await expect(page.getByTestId('present-black')).toHaveCount(0)
  await expect(presenter.locator('#black')).toHaveAttribute('aria-pressed', 'false')

  // Esc ends the show; the studio lands on the slide we ended on, and the pen is gone
  // (server state reset, presenter canvas cleared).
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('3 / 4')).toBeVisible()
  await expect.poll(async () => JSON.stringify((await (await page.request.get(stateUrl)).json()).ink)).toBe('{}')
  await expect.poll(() => presenter.evaluate(() => {
    const c = document.getElementById('cur-ink') as HTMLCanvasElement
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    for (let i = 3; i < d.length; i += 4) if (d[i]) return 'inked'
    return 'blank'
  })).toBe('blank')
  await other.close()
})

test('code view edits a slide: highlighted source, Save writes, preview and built output refresh, conflicts are caught', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')
  const home = await fakeHome(page)
  const deckPath = `${home}/decks/acme-quarterly`
  await page.getByRole('button', { name: /^Build$/ }).click()
  await expect(page.getByRole('status').filter({ hasText: /Build succeeded/ })).toBeVisible()
  // Go to slide 2 and open the code view.
  await page.locator('#slides-body li').nth(1).click()
  await page.getByRole('group', { name: /^View$/ }).getByRole('button', { name: /^Code$/ }).click()
  const editor = page.getByTestId('code-editor')
  await expect(editor).toContainText('Slide 2 source')
  await expect(editor).toContainText('slides/020_agenda.html')
  const ta = editor.getByRole('textbox')
  await expect(ta).toHaveValue(/Agenda · 안건/)
  // Highlight layer colours the tag names.
  const tagSpan = editor.locator('pre span', { hasText: '<section' }).first()
  await expect(tagSpan).toHaveCSS('color', /rgb/)
  expect(await tagSpan.evaluate((el) => el.getAttribute('style'))).toContain('--accent')
  await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled()

  // Edit: replace the heading; the title shows the unsaved dot, Save enables.
  const original = await ta.inputValue()
  await ta.fill(original.replace('<h2>Agenda · 안건</h2>', '<h2>Plan for today</h2>'))
  await expect(editor).toContainText('Unsaved changes')
  await expect(editor.getByRole('button', { name: 'Save' })).toBeEnabled()
  // Tab inserts two spaces instead of leaving the field.
  await ta.focus()
  await ta.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0))
  await page.keyboard.press('Tab')
  await expect(ta).toHaveValue(/^  <section/)
  await ta.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0))
  await page.keyboard.press('Shift+Tab')
  await expect(ta).toHaveValue(/^<section/)

  // Save: the viewer under the editor shows the new heading, the file is written,
  // and the built output was rebuilt with it.
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(editor).toContainText('Saved')
  await expect(page.getByTestId('code-view').frameLocator('iframe[title="020_agenda.html"]').locator('h2')).toHaveText('Plan for today')
  const onDisk = await (await page.request.get(`/__ctl/read?path=${encodeURIComponent(deckPath + '/slides/020_agenda.html')}`)).text()
  expect(onDisk).toContain('<h2>Plan for today</h2>')
  const built = await (await page.request.get(`/__ctl/read?path=${encodeURIComponent(deckPath + '/out/index.html')}`)).text()
  expect(built).toContain('Plan for today')

  // The preview sits above the editor; dragging the handle up gives the editor more room, and the split is remembered.
  const handle = page.getByTestId('code-split-handle')
  const before = (await editor.boundingBox())!.height
  expect((await handle.boundingBox())!.y).toBeLessThan((await editor.boundingBox())!.y)
  const hb = (await handle.boundingBox())!
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 - 60, { steps: 5 })
  await page.mouse.up()
  expect((await editor.boundingBox())!.height).toBeGreaterThan(before + 30)
  expect(Number(await page.evaluate(() => localStorage.getItem('hs.codeRatio')))).toBeLessThan(0.45)

  // A draft survives switching slides and coming back.
  await ta.fill(original.replace('<h2>Agenda · 안건</h2>', '<h2>Draft heading</h2>'))
  await expect(editor).toContainText('Unsaved changes')
  await page.locator('#slides-body li').nth(2).click()
  await expect(editor).toContainText('Slide 3 source')
  await expect(ta).toHaveValue(/Uptime/)
  await page.locator('#slides-body li').nth(1).click()
  await expect(editor).toContainText('Slide 2 source')
  await expect(ta).toHaveValue(/Draft heading/)
  await expect(editor).toContainText('Unsaved changes')

  // Meanwhile the agent writes the file: saving is refused, the bar offers reload or overwrite.
  await page.request.post('/__ctl/write', { data: { path: deckPath + '/slides/020_agenda.html', text: original.replace('<h2>Agenda · 안건</h2>', '<h2>Agent wrote this</h2>') } })
  await editor.getByRole('button', { name: 'Save' }).click()
  const bar = editor.getByRole('alert')
  await expect(bar).toContainText('changed on disk')
  await bar.getByRole('button', { name: 'Reload from disk' }).click()
  await expect(ta).toHaveValue(/Agent wrote this/)
  await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled()
  await expect(editor.getByRole('alert')).toHaveCount(0)
})

test('strip arranges slides: add, duplicate, drag to reorder, archive and restore; notes follow their slide', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')
  const home = await fakeHome(page)
  const deckPath = `${home}/decks/acme-quarterly`
  await page.request.post('/apps/html-studio/api/note', { data: { path: deckPath, slide: '020_agenda.html', text: '- agenda note' } })
  const items = page.locator('#slides-body ol > li')
  await expect(items).toHaveCount(4)
  const names = () => items.locator('> button').evaluateAll((els) => els.map((e) => e.getAttribute('title')))

  // Add after slide 2: a blank slide appears as slide 3 and becomes current; later slides are renumbered.
  await items.nth(1).locator('> button').click()
  await page.getByTestId('strip-add').click()
  await page.getByRole('dialog', { name: 'Add a slide' }).getByRole('button', { name: 'Insert Blank' }).click()
  await expect(items).toHaveCount(5)
  expect(await names()).toEqual(['010_cover.html', '020_agenda.html', '030_new.html', '040_uptime.html', '050_roadmap.html'])
  await expect(page.locator('#slides-body [aria-current="true"]')).toContainText('030_new.html')
  await expect(page.frameLocator('[data-testid="slide-stage"] iframe').locator('h2')).toHaveText('New slide')

  // Duplicate the agenda from its menu.
  await items.nth(1).locator('> button').click()
  await page.getByRole('button', { name: 'Slide actions' }).click()
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()
  await expect(items).toHaveCount(6)
  expect(await names()).toEqual(['010_cover.html', '020_agenda.html', '030_agenda-copy.html', '040_new.html', '050_uptime.html', '060_roadmap.html'])
  await expect(page.locator('#slides-body [aria-current="true"]')).toContainText('030_agenda-copy.html')

  // Move down via the menu, then drag the cover onto the third slide (it lands after it).
  await page.getByRole('button', { name: 'Slide actions' }).click()
  await page.getByRole('menuitem', { name: 'Move down' }).click()
  await expect.poll(names).toEqual(['010_cover.html', '020_agenda.html', '030_new.html', '040_agenda-copy.html', '050_uptime.html', '060_roadmap.html'])
  const drag = async (from: number, to: number) => {
    const a = (await items.nth(from).boundingBox())!
    const b = (await items.nth(to).boundingBox())!
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + 15, { steps: 3 })
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 })
    await page.mouse.up()
  }
  await items.nth(0).locator('> button').click() // selecting scrolls it into view: the strip is taller than its box
  await drag(0, 2)
  await expect.poll(names).toEqual(['010_agenda.html', '020_new.html', '030_cover.html', '040_agenda-copy.html', '050_uptime.html', '060_roadmap.html'])
  // The note followed the agenda slide to its new name.
  const notes = await (await page.request.get(`/apps/html-studio/api/notes?path=${encodeURIComponent(deckPath)}`)).json()
  expect(notes.withNotes).toEqual(['010_agenda.html'])
  await expect(items.nth(0).getByTestId('strip-note')).toBeVisible()

  // Archive the blank slide: it leaves the strip and shows up in the archive box; restore puts it back after the current slide.
  await items.nth(1).locator('> button').click()
  await page.getByRole('button', { name: 'Slide actions' }).click()
  await page.getByRole('menuitem', { name: 'Archive' }).click()
  await expect(items).toHaveCount(5)
  expect(await names()).not.toContain('020_new.html')
  const box = page.getByTestId('archive-list')
  await expect(box).toContainText('Archive (1)')
  await box.getByRole('button', { name: /Archive \(1\)/ }).click()
  await expect(box).toContainText('020_new.html')
  await items.nth(4).locator('> button').click() // current = last (roadmap)
  await box.getByRole('button', { name: 'Restore' }).click()
  await expect(items).toHaveCount(6)
  expect(await names()).toEqual(['010_agenda.html', '020_cover.html', '030_agenda-copy.html', '040_uptime.html', '050_roadmap.html', '060_new.html'])
  await expect(box).toHaveCount(0)
  await expect(page.locator('#slides-body [aria-current="true"]')).toContainText('060_new.html')
})

test('layout library: pick a built-in layout rendered in the deck style, save a slide as my layout, insert it, delete it', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  await selectDeck(page, 'acme-quarterly')
  const home = await fakeHome(page)
  const deckPath = `${home}/decks/acme-quarterly`
  const items = page.locator('#slides-body ol > li')
  await expect(items).toHaveCount(4)
  const names = () => items.locator('> button').evaluateAll((els) => els.map((e) => e.getAttribute('title')))

  // Open the picker from slide 1: eight built-ins, thumbnails come from the preview server's /layout pages.
  await items.nth(0).locator('> button').click()
  await page.getByTestId('strip-add').click()
  const dialog = page.getByRole('dialog', { name: 'Add a slide' })
  await expect(dialog.getByTestId('layout-card')).toHaveCount(8)
  await expect(dialog.locator('[data-layout="kpi"] iframe')).toHaveAttribute('src', /\/layout\/kpi$/)
  await expect(dialog.frameLocator('[data-layout="kpi"] iframe').locator('h2')).toHaveText('Key numbers')
  await expect(dialog).toContainText('None yet')
  await dialog.getByRole('button', { name: 'Insert Key numbers' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(items).toHaveCount(5)
  expect(await names()).toEqual(['010_cover.html', '020_kpi.html', '030_agenda.html', '040_uptime.html', '050_roadmap.html'])
  await expect(page.locator('#slides-body [aria-current="true"]')).toContainText('020_kpi.html')
  await expect(page.frameLocator('[data-testid="slide-stage"] iframe').locator('h2')).toHaveText('Key numbers')

  // Save the agenda as my layout.
  await items.nth(2).locator('> button').click()
  await page.getByRole('button', { name: 'Slide actions' }).click()
  await page.getByRole('menuitem', { name: 'Save as layout' }).click()
  const saveDialog = page.getByRole('dialog', { name: 'Save as layout' })
  await saveDialog.getByLabel('Layout name').fill('Acme agenda')
  await saveDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(saveDialog.getByRole('status')).toContainText('Saved as Acme agenda')
  await expect(saveDialog.locator('[data-layout="my-acme-agenda"]')).toBeVisible()
  await saveDialog.getByRole('button', { name: 'Close' }).click()

  // It is offered in the picker (for every deck); insert it after the last slide, then delete it.
  await items.nth(4).locator('> button').click()
  await page.getByTestId('strip-add').click()
  await expect(dialog.getByTestId('layout-card')).toHaveCount(9)
  await dialog.getByRole('button', { name: 'Insert Acme agenda' }).click()
  await expect(items).toHaveCount(6)
  expect((await names())[5]).toBe('060_acme-agenda.html')
  const added = await (await page.request.get(`/__ctl/read?path=${encodeURIComponent(deckPath + '/slides/060_acme-agenda.html')}`)).text()
  expect(added).toContain('Agenda')
  await page.getByTestId('strip-add').click()
  await dialog.getByRole('button', { name: 'Delete layout Acme agenda' }).click()
  await expect(dialog.getByTestId('layout-card')).toHaveCount(8)
  await dialog.getByRole('button', { name: 'Close' }).click()
})

test('new deck wizard creates a themed deck, selects it, asks the agent for an outline, and remembers defaults', async ({ page }) => {
  await openApp(page)
  await addFixtureRoot(page)
  const home = await fakeHome(page)
  await page.getByTestId('deck-new').click()
  const dialog = page.getByRole('dialog', { name: 'New deck' })
  await dialog.getByLabel('Title').fill('Acme Q4 Plan')
  await expect(dialog.getByLabel('Deck folder name')).toHaveValue('acme-q4-plan')
  await dialog.getByLabel('Presenter').fill('Jamie Lee')
  await dialog.getByLabel('Purpose').fill('Agree the Q4 priorities')
  await dialog.getByLabel('Audience').fill('Acme leadership')
  await dialog.getByLabel('Source material').fill('- planning notes\n- last quarter deck')
  await dialog.getByRole('radio', { name: /Colours and font/ }).check()
  await dialog.locator('#nd-font').fill('Pretendard')
  await dialog.getByRole('button', { name: 'Create deck' }).click()
  await expect(dialog).toHaveCount(0)

  // The deck is selected and shows the filled cover + agenda.
  await expect(page.locator('#slides-body ol > li')).toHaveCount(2)
  await expect(page.frameLocator('[data-testid="slide-stage"] iframe').locator('h1')).toHaveText('Acme Q4 Plan')
  await expect(page.frameLocator('[data-testid="slide-stage"] iframe').locator('p.muted').first()).toHaveText('Acme leadership')
  const deckPath = `${home}/decks/acme-q4-plan`
  const studio = JSON.parse(await (await page.request.get(`/__ctl/read?path=${encodeURIComponent(deckPath + '/studio.json')}`)).text())
  expect(studio).toMatchObject({ slidesDir: 'slides', css: 'tokens.css', title: 'Acme Q4 Plan', presenter: 'Jamie Lee' })
  const brief = await (await page.request.get(`/__ctl/read?path=${encodeURIComponent(deckPath + '/brief.md')}`)).text()
  expect(brief).toContain('## Source material\n\n- planning notes')
  expect(await (await page.request.get(`/__ctl/read?path=${encodeURIComponent(deckPath + '/tokens.css')}`)).text()).toContain('--font-sans: Pretendard')

  // The deck chat was started with the brief and the outline request.
  type LogEntry = { body?: { message?: string } }
  await expect.poll(async () => {
    const ctl = await (await page.request.get('/__ctl/chat')).json()
    return (ctl.log as LogEntry[]).filter((m) => m.body?.message).length
  }).toBeGreaterThanOrEqual(2)
  const ctl = await (await page.request.get('/__ctl/chat')).json()
  const msgs = (ctl.log as LogEntry[]).filter((m) => m.body?.message).map((m) => m.body!.message!)
  expect(msgs[0]).toContain('attached to an HTML slide deck')
  expect(msgs[1]).toContain('Propose an outline')
  expect(msgs[1]).toContain('Acme leadership')

  // Defaults are remembered for the next deck; a duplicate folder is refused.
  const decksHeader = page.getByRole('button', { name: /^▸?\s*(Decks|덱)/ }).first()
  if ((await decksHeader.getAttribute('aria-expanded')) !== 'true') await decksHeader.click()
  await page.getByTestId('deck-new').click()
  await expect(dialog.getByLabel('Presenter')).toHaveValue('Jamie Lee')
  await expect(dialog.getByRole('radio', { name: /Colours and font/ })).toBeChecked()
  await dialog.getByLabel('Title').fill('Acme Q4 Plan')
  await dialog.getByRole('button', { name: 'Create deck' }).click()
  await expect(dialog.getByRole('alert')).toContainText('already exists')
})
