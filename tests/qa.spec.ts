import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';

// Page types to test. Add the client's real pages here.
const PAGES = ['/', '/privacy', '/accessibility', '/404'];
const allowTemplate = process.env.QA_ALLOW_TEMPLATE === '1';

async function open(page: Page, path: string) {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => failed.push(r.url()));
  const res = await page.goto(path, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  return { res, errors, failed };
}

for (const path of PAGES) {
  test.describe(`page ${path}`, () => {
    test('basics: title, one h1, no sideways scroll, no script errors', async ({ page }, info) => {
      const { res, errors, failed } = await open(page, path);
      if (path !== '/404') expect(res?.status()).toBe(200);
      const title = await page.title();
      expect(title.length, 'title present').toBeGreaterThan(5);
      expect(await page.locator('h1').count(), 'exactly one h1').toBe(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'sideways scroll').toBeLessThanOrEqual(0);
      expect(errors, 'script or console errors').toEqual([]);
      if (failed.length) test.info().annotations.push({ type: 'warning', description: `failed loads: ${failed.join(', ')}` });

      const desc = await page.locator('meta[name=description]').getAttribute('content');
      if (!desc || desc.length < 50 || desc.length > 170) test.info().annotations.push({ type: 'warning', description: `meta description length ${desc?.length ?? 0}` });
      const small = await page.evaluate(() => [...document.querySelectorAll('p, li, a, label')].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 15 && (e as HTMLElement).innerText.trim()).length);
      if (small) test.info().annotations.push({ type: 'warning', description: `${small} text elements under 15px` });

      fs.mkdirSync('qa-screenshots', { recursive: true });
      await page.screenshot({ path: `qa-screenshots/${info.project.name}${path === '/' ? '-home' : path.replace(/\//g, '-')}.png`, fullPage: true });
    });

    test('images have alt text and heading order does not skip', async ({ page }) => {
      await open(page, path);
      const missing = await page.locator('img:not([alt])').count();
      expect(missing, 'images without an alt attribute').toBe(0);
      const levels = await page.$$eval('h1,h2,h3,h4,h5,h6', (hs) => hs.map((h) => Number(h.tagName[1])));
      for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `heading jump at index ${i}`).toBeLessThanOrEqual(1);
    });

    test('axe: no serious or critical accessibility violations', async ({ page }) => {
      await open(page, path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const bad = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact || ''));
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      const minor = results.violations.filter((v) => !['serious', 'critical'].includes(v.impact || ''));
      if (minor.length) test.info().annotations.push({ type: 'warning', description: `axe moderate/minor: ${minor.map((v) => v.id).join(', ')}` });
    });

    test('reduced motion: all text visible', async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.goto(path, { waitUntil: 'load' });
      await page.waitForTimeout(500);
      const hidden = await page.evaluate(() => [...document.querySelectorAll('main h1, main h2, main h3, main p, main label')]
        .filter((e) => (e as HTMLElement).innerText.trim() && (getComputedStyle(e).opacity === '0' || getComputedStyle(e).visibility === 'hidden')).length);
      expect(hidden, 'text hidden from reduced-motion users').toBe(0);
      await ctx.close();
    });
  });
}

test.describe('site-wide', () => {
  test('no placeholder or template content left (skipped for the template itself)', async ({ page }) => {
    await open(page, '/');
    const isTemplate = (await page.locator('meta[name="x-template"]').count()) > 0;
    if (allowTemplate) test.skip(true, 'QA_ALLOW_TEMPLATE=1');
    expect(isTemplate, 'client.json still has "template": true').toBe(false);
    const html = await page.content();
    expect(html).not.toMatch(/lorem ipsum|REPLACE_ME|example\.com|\[reply time\]/i);
    expect(await page.locator('a[href="#"]').count(), 'dead # links').toBe(0);
  });

  test('footer links to Privacy Policy and Accessibility Statement', async ({ page }) => {
    await open(page, '/');
    await expect(page.locator('footer a[href="/privacy"]')).toHaveCount(1);
    await expect(page.locator('footer a[href="/accessibility"]')).toHaveCount(1);
  });

  test('no inline executable scripts (so the strict CSP in _headers holds)', async ({ page }) => {
    await open(page, '/');
    const inline = await page.$$eval('script:not([src]):not([type="application/ld+json"]):not([type="application/json"])', (s) => s.length);
    expect(inline).toBe(0);
  });

  test('sitemap and robots exist', async ({ request }) => {
    expect((await request.get('/sitemap.xml')).status()).toBe(200);
    expect((await request.get('/robots.txt')).status()).toBe(200);
  });

  test('contact form has labels and a privacy line', async ({ page }) => {
    await open(page, '/');
    for (const id of ['name', 'email', 'message']) await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    await expect(page.locator('form.contact a[href="/privacy"]')).toHaveCount(1);
  });
});

test.describe('signature 3D figure', () => {
  test('home page figure has a text caption, a poster and a still-image fallback with no JS', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('[data-signature] figcaption')).not.toBeEmpty();
    await expect(page.locator('[data-signature] img.poster')).toBeVisible();
    await expect(page.locator('[data-signature]')).toHaveAttribute('data-state', 'static');
    await ctx.close();
  });

  test('with WebGL available the figure starts and can be paused (not on phones when mobile3d is off)', async ({ page }, info) => {
    await open(page, '/');
    await page.evaluate(() => window.scrollTo(0, 200));
    const fig = page.locator('[data-signature]');
    await expect(fig).toHaveAttribute('data-state', /running|static/, { timeout: 15_000 });
    await expect.poll(async () => fig.getAttribute('data-state'), { timeout: 20_000 }).toBe('running');
    const tier = await fig.getAttribute('data-tier');
    test.info().annotations.push({ type: 'tier', description: `${info.project.name}: ${tier}` });
    await page.locator('.signature .pause').click();
    await expect(fig).toHaveAttribute('data-state', 'paused');
    await page.locator('.signature .pause').click();
    await expect(fig).toHaveAttribute('data-state', 'running');
  });

  test('without WebGL the page still works and shows the poster', async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type: string, ...a: unknown[]) {
        if (/webgl/i.test(type)) return null;
        // @ts-expect-error pass-through
        return orig.call(this, type, ...a);
      } as typeof orig;
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.waitForTimeout(2500);
    await expect(page.locator('[data-signature]')).toHaveAttribute('data-state', 'static');
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('reduced motion keeps the figure static', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(2500);
    await expect(page.locator('[data-signature]')).toHaveAttribute('data-state', 'static');
    await ctx.close();
  });
});
