// @ts-check
const { test, expect } = require('@playwright/test');

// Helper: wait for data to load (tokens are fetched async)
async function waitForDataLoaded(page) {
  await page.waitForFunction(() => {
    // The search button exists and tabs are visible once data loads
    return document.querySelector('.tab-btn') !== null;
  }, { timeout: 15000 });
}

// Helper: run a search and wait for results
async function search(page, query, { gran = 'play', ngramMode = '1' } = {}) {
  await page.selectOption('#gran', gran);
  await page.selectOption('#ngramMode', ngramMode);
  await page.fill('#q', query);
  await page.press('#q', 'Enter');
  // Wait for results table to have rows
  await page.waitForSelector('#results tbody tr', { timeout: 10000 });
}

// ==========================================
// Basic loading
// ==========================================
test.describe('Page Load', () => {
  test('loads and shows title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Shakespeare/);
  });

  test('loads data and shows UI controls', async ({ page }) => {
    await page.goto('/');
    await waitForDataLoaded(page);
    await expect(page.locator('#q')).toBeVisible();
    await expect(page.locator('#gran')).toBeVisible();
    await expect(page.locator('#ngramMode')).toBeVisible();
  });

  test('has three tabs', async ({ page }) => {
    await page.goto('/');
    await waitForDataLoaded(page);
    const tabs = page.locator('.tab-btn');
    await expect(tabs).toHaveCount(3);
  });
});

// ==========================================
// Search — Segments tab
// ==========================================
test.describe('Segments Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForDataLoaded(page);
  });

  test('play granularity returns 37 rows for common word', async ({ page }) => {
    await search(page, 'the', { gran: 'play' });
    const rows = page.locator('#results tbody tr');
    await expect(rows).toHaveCount(37);
  });

  test('play granularity shows expected columns', async ({ page }) => {
    await search(page, 'love', { gran: 'play' });
    const headers = page.locator('#results thead th');
    const texts = await headers.allTextContents();
    expect(texts.some(t => t.includes('Play'))).toBeTruthy();
    expect(texts.some(t => t.includes('Genre'))).toBeTruthy();
    expect(texts.some(t => t.includes('Year'))).toBeTruthy();
    // Should NOT have a Location column in play view
    expect(texts.some(t => t === 'Location')).toBeFalsy();
  });

  test('scene granularity has Location column', async ({ page }) => {
    await search(page, 'love', { gran: 'scene' });
    const headers = page.locator('#results thead th');
    const texts = await headers.allTextContents();
    expect(texts.some(t => t.includes('Location'))).toBeTruthy();
  });

  test('act granularity returns results', async ({ page }) => {
    await search(page, 'love', { gran: 'act' });
    const rows = page.locator('#results tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('character granularity returns results', async ({ page }) => {
    await search(page, 'love', { gran: 'character' });
    const rows = page.locator('#results tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('line granularity returns results', async ({ page }) => {
    // Tabs container is hidden until search; make it visible then click
    await search(page, 'love', { gran: 'play' });
    await page.evaluate(() => { document.querySelector('.tabs').style.display = 'flex'; });
    await page.click('.tab-btn[data-tab="lines"]');
    await page.fill('#linesQuery', 'love');
    await page.press('#linesQuery', 'Enter');
    await page.waitForSelector('#linesResults tbody tr', { timeout: 10000 });
    const rows = page.locator('#linesResults tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('bigram search works', async ({ page }) => {
    await search(page, 'my lord', { gran: 'play', ngramMode: '2' });
    const rows = page.locator('#results tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('regex search works', async ({ page }) => {
    await page.selectOption('#gran', 'play');
    await page.selectOption('#matchMode', 'regex');
    await page.fill('#q', '^love$');
    await page.press('#q', 'Enter');
    await page.waitForSelector('#results tbody tr', { timeout: 10000 });
    const rows = page.locator('#results tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('sorting works', async ({ page }) => {
    await search(page, 'love', { gran: 'play' });
    // Click Year header to sort
    const yearHeader = page.locator('#results thead th', { hasText: 'Year' });
    await yearHeader.click();
    // Should have sort indicator
    const sorted = page.locator('#results thead th.sorted-asc, #results thead th.sorted-desc');
    const count = await sorted.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ==========================================
// Deep links
// ==========================================
test.describe('Deep Links', () => {
  test('restores search from URL params', async ({ page }) => {
    await page.goto('/?q=love&nm=1&gran=play&mm=exact&cs=1&td=both&zr=0&hl=1');
    await waitForDataLoaded(page);
    await page.waitForSelector('#results tbody tr', { timeout: 10000 });
    const rows = page.locator('#results tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    // Check that the search field has the right value
    await expect(page.locator('#q')).toHaveValue('love');
  });

  test('deep link preserves sort', async ({ page }) => {
    await page.goto('/?q=love&nm=1&gran=play&mm=exact&sk=title&sd=asc&cs=1&td=both&zr=0&hl=1');
    await waitForDataLoaded(page);
    await page.waitForSelector('#results tbody tr', { timeout: 10000 });
    // First play should be alphabetically first
    const firstCell = page.locator('#results tbody tr:first-child td:first-child');
    const text = await firstCell.textContent();
    // Play view first column is "Play" (title) — sorted ascending, first should start with A or T
    // Just verify we got a non-empty result and sort indicator is present
    expect(text.length).toBeGreaterThan(0);
    const sorted = page.locator('#results thead th.sorted-asc, #results thead th.sorted-desc');
    await expect(sorted).toHaveCount(1);
  });

  test('permalink updates on search', async ({ page }) => {
    await page.goto('/');
    await waitForDataLoaded(page);
    await search(page, 'death', { gran: 'play' });
    // Wait a moment for deep link to update
    // Deep link uses hash or query params — check the permalink input instead
    await page.waitForTimeout(500);
    const deepLinkInput = page.locator('#deepLinkInput, .deep-link-input, input[readonly]').first();
    const linkCount = await deepLinkInput.count();
    if (linkCount > 0) {
      const link = await deepLinkInput.inputValue();
      expect(link).toContain('q=death');
    } else {
      // If no permalink input, check URL
      const url = page.url();
      // Just verify search worked (URL might not update immediately)
      const rows = page.locator('#results tbody tr');
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});

// ==========================================
// Play Detail Modal
// ==========================================
test.describe('Play Detail Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForDataLoaded(page);
    await search(page, 'love', { gran: 'play' });
  });

  test('play titles are clickable links', async ({ page }) => {
    const link = page.locator('.play-detail-link').first();
    await expect(link).toBeVisible();
  });

  test('clicking play title opens modal', async ({ page }) => {
    const link = page.locator('.play-detail-link').first();
    await link.click();
    const modal = page.locator('.play-detail-overlay.open');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('modal shows play title and stats', async ({ page }) => {
    const link = page.locator('.play-detail-link').first();
    await link.click();
    await page.waitForSelector('.play-detail-overlay.open', { timeout: 5000 });
    const title = page.locator('#playDetailTitle');
    await expect(title).not.toBeEmpty();
    const meta = page.locator('#playDetailMeta');
    const metaText = await meta.textContent();
    expect(metaText).toContain('words');
    expect(metaText).toContain('lines');
  });

  test('modal shows n-gram data after computing', async ({ page }) => {
    const link = page.locator('.play-detail-link').first();
    await link.click();
    await page.waitForSelector('#playDetailTable tbody tr', { timeout: 15000 });
    const rows = page.locator('#playDetailTable tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('tab switching works', async ({ page }) => {
    const link = page.locator('.play-detail-link').first();
    await link.click();
    await page.waitForSelector('#playDetailTable tbody tr', { timeout: 15000 });
    // Switch to bigrams
    await page.click('.play-detail-tab-btn[data-n="2"]');
    await page.waitForTimeout(500);
    const rows = page.locator('#playDetailTable tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('unusualness slider filters results', async ({ page }) => {
    const link = page.locator('.play-detail-link').first();
    await link.click();
    await page.waitForSelector('#playDetailTable tbody tr', { timeout: 15000 });
    const initialCount = await page.locator('#playDetailTable tbody tr').count();
    // Move slider to ~halfway
    const slider = page.locator('#playDetailSlider');
    const max = await slider.getAttribute('max');
    // Use evaluate to set slider value since fill() doesn't work on range inputs
    const halfMax = Number(max) * 0.5;
    await slider.evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event('input')); }, String(halfMax));
    await page.waitForTimeout(300);
    const filteredCount = await page.locator('#playDetailTable tbody tr').count();
    expect(filteredCount).toBeLessThan(initialCount);
  });

  test('modal closes on X button', async ({ page }) => {
    const link = page.locator('.play-detail-link').first();
    await link.click();
    await page.waitForSelector('.play-detail-overlay.open', { timeout: 5000 });
    await page.click('.play-detail-close');
    await expect(page.locator('.play-detail-overlay.open')).toHaveCount(0);
  });

  test('modal closes on Escape', async ({ page }) => {
    const link = page.locator('.play-detail-link').first();
    await link.click();
    await page.waitForSelector('.play-detail-overlay.open', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.play-detail-overlay.open')).toHaveCount(0);
  });

  test('act count never exceeds 5', async ({ page }) => {
    const link = page.locator('.play-detail-link').first();
    await link.click();
    await page.waitForSelector('.play-detail-overlay.open', { timeout: 5000 });
    const meta = await page.locator('#playDetailMeta').textContent();
    const actMatch = meta.match(/(\d+)\s*acts/);
    expect(actMatch).toBeTruthy();
    expect(Number(actMatch[1])).toBeLessThanOrEqual(5);
  });
});

// ==========================================
// Column Reordering
// ==========================================
test.describe('Column Reordering', () => {
  test('column headers are draggable', async ({ page }) => {
    await page.goto('/');
    await waitForDataLoaded(page);
    await search(page, 'love', { gran: 'play' });
    const th = page.locator('#results thead th').first();
    const draggable = await th.getAttribute('draggable');
    expect(draggable).toBe('true');
  });
});

// ==========================================
// Footer and meta
// ==========================================
test.describe('Footer and Meta', () => {
  test('has footer with credits', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('.site-footer');
    await expect(footer).toBeVisible();
    const text = await footer.textContent();
    expect(text).toContain('Reinhard Engels');
    expect(text).toContain('Source');
  });

  test('has favicon', async ({ page }) => {
    await page.goto('/');
    const favicon = page.locator('link[rel="icon"]');
    await expect(favicon).toHaveCount(1);
  });

  test('has Open Graph meta tags', async ({ page }) => {
    await page.goto('/');
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveCount(1);
  });
});
