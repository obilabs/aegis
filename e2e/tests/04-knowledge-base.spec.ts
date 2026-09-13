/**
 * Step 7: publish a KB article, read it on the public KB without signing in,
 * and leave "was this helpful?" feedback (kb_article_feedback, migration 098).
 */
import { test } from '@playwright/test'
import { authFile, expect, expectPortalRendered, saveState, shot, sql, uniq, watchPage } from './helpers'

test.describe.configure({ mode: 'serial' })

test('admin publishes a public article; an anonymous visitor reads it and leaves feedback', async ({ browser }) => {
  const admin = await browser.newContext({ storageState: authFile('admin') })
  const page = await admin.newPage()
  const w = watchPage(page, '04 kb author')

  const title = `Resetting a frozen laptop ${uniq()}`
  await page.goto('/portal/kb/new')
  await expectPortalRendered(page)
  await page.locator('#title').fill(title)
  await page.locator('#summary').fill('Steps to recover a laptop that will not respond.')
  await page.locator('#content').fill('## Steps\n\n1. Hold the power button for 15 seconds.\n2. Unplug the charger.\n3. Start it again.')
  await page.locator('#visibility').selectOption('public')
  const saved = page.waitForResponse((r) => /\/api\/portal\/kb\/articles/.test(r.url()) && ['POST', 'PUT', 'PATCH'].includes(r.request().method()))
  await page.getByRole('button', { name: 'Publish' }).click()
  const res = await saved
  expect(res.status(), await res.text()).toBeLessThan(300)
  // The editor leaves /portal/kb/new for the article page, or the KB home when
  // the article has no category.
  await page.waitForURL((url) => url.pathname.startsWith('/portal/kb') && !url.pathname.endsWith('/new'), {
    timeout: 30_000,
    waitUntil: 'commit',
  })
  const slug = sql(`SELECT slug FROM kb_articles WHERE title = '${title}'`)
  expect(slug).toBeTruthy()
  expect(sql(`SELECT status || '/' || visibility FROM kb_articles WHERE slug = '${slug}'`)).toBe('published/public')
  saveState({ kbSlug: slug, kbTitle: title })
  w.flush()
  await admin.close()

  // Anonymous visitor.
  const anon = await browser.newContext()
  const pub = await anon.newPage()
  const pw = watchPage(pub, '04 kb public')
  await pub.goto('/kb')
  await expect(pub.getByRole('link', { name: new RegExp(title) }).first()).toBeVisible()
  await pub.goto(`/kb/${slug}`)
  await expect(pub.getByRole('heading', { name: title })).toBeVisible()
  await expect(pub.getByText('Hold the power button for 15 seconds.')).toBeVisible()

  const feedback = pub.waitForResponse((r) => r.url().includes(`/api/kb/public/article/${slug}/feedback`))
  await pub.getByRole('button', { name: /Yes, helpful/ }).click()
  const fb = await feedback
  expect(fb.status(), await fb.text()).toBe(200)
  await expect(pub.getByText('Thank you for your feedback!')).toBeVisible()
  await shot(pub, '13-public-kb-feedback')

  const rows = sql(
    `SELECT f.is_helpful::text || '/' || f.source FROM kb_article_feedback f JOIN kb_articles a ON a.id = f.article_id WHERE a.slug = '${slug}'`,
  )
  expect(rows).toBe('true/public_kb')
  expect(sql(`SELECT helpful_count FROM kb_articles WHERE slug = '${slug}'`)).toBe('1')

  // A second vote from the same visitor is refused rather than double-counted.
  const again = await pub.request.post(`/api/kb/public/article/${slug}/feedback`, { data: { is_helpful: false } })
  expect(again.status()).toBe(409)

  // Internal articles are not on the public KB.
  const internalSlug = sql(`SELECT slug FROM kb_articles WHERE status = 'published' AND visibility = 'internal' LIMIT 1`)
  expect(internalSlug, 'expected seeded internal articles').toBeTruthy()
  const internal = await pub.request.get(`/api/kb/public/article/${internalSlug}`)
  expect([401, 403, 404]).toContain(internal.status())

  expect(pw.serverErrors()).toEqual([])
  pw.flush()
  await anon.close()
})
