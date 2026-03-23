// @ts-check
const { test, expect } = require('@playwright/test');

async function waitForDataLoaded(page) {
  await page.waitForFunction(() => {
    return document.querySelector('.tab-btn') !== null && window.__contabulateReady === true;
  }, { timeout: 15000 });
}

async function search(page, query, { gran = 'play', ngramMode = '1', matchMode = 'exact' } = {}) {
  await page.selectOption('#gran', gran);
  await page.selectOption('#ngramMode', ngramMode);
  await page.selectOption('#matchMode', matchMode);
  await page.fill('#q', query);
  await page.press('#q', 'Enter');
  await page.waitForSelector('#results tbody tr', { timeout: 10000 });
}

test.describe('Page Load', () => {
  test('loads and shows the KJV title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/King James Bible/);
  });

  test('shows both contexts and verses tabs', async ({ page }) => {
    await page.goto('/');
    await waitForDataLoaded(page);
    await expect(page.locator('.tab-btn')).toHaveCount(2);
    await expect(page.locator('.tab-btn[data-tab="lines"]')).toContainText('Rows are Verses');
  });

  test('defaults to canonical book order on open', async ({ page }) => {
    await page.goto('/');
    await waitForDataLoaded(page);
    await page.waitForSelector('#results tbody tr', { timeout: 10000 });

    await expect(page.locator('#gran')).toHaveValue('play');
    await expect(page.locator('#results thead th.sorted-asc')).toContainText('Location');

    const firstRows = await page.locator('#results tbody tr').evaluateAll((trs) =>
      trs.slice(0, 3).map((tr) =>
        Array.from(tr.querySelectorAll('td'))
          .slice(0, 2)
          .map((td) => (td.textContent || '').trim())
      )
    );
    expect(firstRows).toEqual([
      ['01.Gen', 'Genesis'],
      ['02.Exod', 'Exodus'],
      ['03.Lev', 'Leviticus'],
    ]);
  });
});

test.describe('Segments Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForDataLoaded(page);
  });

  test('book granularity returns 66 rows for a common word', async ({ page }) => {
    await search(page, 'the', { gran: 'play' });
    await page.selectOption('#segmentsPageSize', '100');
    await expect(page.locator('#results tbody tr')).toHaveCount(66);
  });

  test('book granularity shows Bible-specific columns', async ({ page }) => {
    await search(page, 'light', { gran: 'play' });
    const texts = await page.locator('#results thead th').allTextContents();
    expect(texts.some(t => t.includes('Location'))).toBeTruthy();
    expect(texts.some(t => t.includes('Book'))).toBeTruthy();
    expect(texts.some(t => t.includes('Testament'))).toBeTruthy();
    expect(texts.some(t => t.includes('# chapters'))).toBeTruthy();
    expect(texts.some(t => t.includes('# verses'))).toBeTruthy();
    expect(texts.some(t => t.trim() === 'Reference')).toBeFalsy();
  });

  test('location column sorts books in canonical order', async ({ page }) => {
    await search(page, 'the', { gran: 'play' });
    await page.selectOption('#segmentsPageSize', '100');

    await page.locator('#results thead th').filter({ hasText: 'Location' }).first().click();
    await expect(page.locator('#results thead th.sorted-asc')).toContainText('Location');

    const firstRows = await page.locator('#results tbody tr').evaluateAll((trs) =>
      trs.slice(0, 3).map((tr) =>
        Array.from(tr.querySelectorAll('td'))
          .slice(0, 2)
          .map((td) => (td.textContent || '').trim())
      )
    );
    expect(firstRows).toEqual([
      ['01.Gen', 'Genesis'],
      ['02.Exod', 'Exodus'],
      ['03.Lev', 'Leviticus'],
    ]);
  });

  test('verse granularity shows location and verse columns', async ({ page }) => {
    await search(page, 'light', { gran: 'scene' });
    const texts = await page.locator('#results thead th').allTextContents();
    expect(texts.some(t => t.includes('Location'))).toBeTruthy();
    expect(texts.some(t => t.includes('Book'))).toBeTruthy();
    expect(texts.some(t => t.includes('Chapter'))).toBeTruthy();
    expect(texts.some(t => t.includes('Verse'))).toBeTruthy();
  });

  test('testament granularity shows two rows and book counts', async ({ page }) => {
    await search(page, 'the', { gran: 'genre' });
    await expect(page.locator('#results tbody tr')).toHaveCount(2);

    const rows = await page.locator('#results tbody tr').evaluateAll((trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim()))
    );
    const oldTestament = rows.find((cells) => cells[0] === 'Old Testament');
    const newTestament = rows.find((cells) => cells[0] === 'New Testament');
    expect(oldTestament).toBeTruthy();
    expect(newTestament).toBeTruthy();
    expect(oldTestament).toContain('39');
    expect(newTestament).toContain('27');
  });

  test('chapter granularity returns results', async ({ page }) => {
    await search(page, 'light', { gran: 'act' });
    expect(await page.locator('#results tbody tr').count()).toBeGreaterThan(0);
  });

  test('verse-text granularity updates highlights when toggled', async ({ page }) => {
    await search(page, 'light', { gran: 'line' });
    await page.locator('#segmentsTab details summary').click();

    expect(await page.locator('#results tbody td .hit').count()).toBeGreaterThan(0);

    await page.locator('#segmentsTab label', { hasText: 'Highlight matching verse text' }).click();
    await expect(page.locator('#segmentsTab .highlight-toggle')).not.toBeChecked();
    await expect(page.locator('#results tbody td .hit')).toHaveCount(0);
  });

  test('verse-text granularity disables percentage modes', async ({ page }) => {
    await page.selectOption('#termDisplayMode', 'pct');
    await page.selectOption('#gran', 'line');

    await expect(page.locator('#termDisplayMode')).toHaveValue('counts');
    await expect(page.locator('#termDisplayMode option[value="both"]')).toBeDisabled();
    await expect(page.locator('#termDisplayMode option[value="pct"]')).toBeDisabled();
    await expect(page.locator('#termDisplayMode')).toHaveAttribute('title', 'Verse-text rows show hits only.');
  });

  test('bigram and regex search both work', async ({ page }) => {
    await search(page, 'son of', { gran: 'play', ngramMode: '2' });
    expect(await page.locator('#results tbody tr').count()).toBeGreaterThan(0);

    await search(page, '^light$', { gran: 'play', matchMode: 'regex' });
    expect(await page.locator('#results tbody tr').count()).toBeGreaterThan(0);
  });
});

test.describe('Verses Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForDataLoaded(page);
    await search(page, 'light', { gran: 'play' });
    await page.evaluate(() => { document.querySelector('.tabs').style.display = 'flex'; });
    await page.click('.tab-btn[data-tab="lines"]');
  });

  test('shows matching verses with Bible-specific headers', async ({ page }) => {
    await page.fill('#linesQuery', 'light');
    await page.press('#linesQuery', 'Enter');
    await page.waitForSelector('#linesResults tbody tr', { timeout: 10000 });

    const texts = await page.locator('#linesResults thead th').allTextContents();
    expect(texts.some(t => t.includes('Book'))).toBeTruthy();
    expect(texts.some(t => t.includes('Chapter'))).toBeTruthy();
    expect(texts.some(t => t.includes('Verse'))).toBeTruthy();
    expect(texts.some(t => t.includes('Verse Text'))).toBeTruthy();
  });

  test('removes verse highlights when the toggle is unchecked', async ({ page }) => {
    await page.fill('#linesQuery', 'light');
    await page.press('#linesQuery', 'Enter');
    await page.waitForSelector('#linesResults tbody tr', { timeout: 10000 });
    await page.locator('#linesTab details').evaluate((el) => { el.open = true; });

    expect(await page.locator('#linesResults tbody td .hit').count()).toBeGreaterThan(0);

    await page.locator('#linesTab label', { hasText: 'Highlight matching verse text' }).click();
    await expect(page.locator('#linesTab .highlight-toggle')).not.toBeChecked();
    await expect(page.locator('#linesResults tbody td .hit')).toHaveCount(0);
  });
});

test.describe('Deep Links', () => {
  test('restores search and sorting from URL params', async ({ page }) => {
    await page.goto('/?q=light&nm=1&gran=play&mm=exact&sk=title&sd=asc&cs=1&td=both&zr=0&hl=1');
    await waitForDataLoaded(page);
    await page.waitForSelector('#results tbody tr', { timeout: 10000 });

    await expect(page.locator('#q')).toHaveValue('light');
    await expect(page.locator('#results thead th.sorted-asc')).toContainText('Book');

    const firstBookCellText = (await page.locator('#results tbody tr:first-child td:nth-child(2)').textContent() || '').trim();
    expect(firstBookCellText).toMatch(/^1 /);
  });
});
