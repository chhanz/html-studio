import { expect, test } from '@playwright/test'
import { resetBackend } from './helpers'

test.beforeEach(async ({ page }) => {
  await resetBackend(page)
})

test('follows navigator.language and honours a manual override', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => (window as any).__hsReady === true)
  await expect(page.getByRole('status')).toContainText('백엔드 연결됨')
  await expect(page.getByRole('button', { name: /^덱 추가$/ })).toBeVisible()

  await page.getByRole('button', { name: 'EN' }).click()
  await expect(page.getByRole('status')).toContainText('Backend connected')

  await page.reload()
  await page.waitForFunction(() => (window as any).__hsReady === true)
  await expect(page.getByRole('status')).toContainText('Backend connected') // persisted

  await page.getByRole('button', { name: 'Auto' }).click()
  await expect(page.getByRole('status')).toContainText('백엔드 연결됨')
})
