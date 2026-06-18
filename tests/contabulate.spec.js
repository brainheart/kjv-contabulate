// @ts-check
const { test, expect } = require('@playwright/test');

async function waitForDataLoaded(page) {
  await page.waitForFunction(() => {
    return document.querySelector('.tab-btn') !== null && window.__contabulateReady === true;
  }, { timeout: 15000 });
}

async function search(page, query, { gran = 'play', ngramMode = '1', matchMode = 'exact' } = {}) {
  await page.selectOption('#gran', gran);
  await page.selectOption('#matchMode', matchMode);
  if (matchMode === 'regex') {
    await page.selectOption('#ngramMode', ngramMode);
  }
  await page.fill('#q', query);
  await page.press('#q', 'Enter');
  await page.waitForSelector('#results tbody tr', { timeout: 10000 });
  if (gran === 'line') {
    await expect(page.locator('#results thead')).toContainText('Verse', { timeout: 10000 });
  }
}

test.describe('Page Load', () => {
  test('loads and shows the KJV title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/King James Bible/);
    await expect(page.locator('a[href="https://github.com/HistoricalChristianFaith/Commentaries-Database"]').first()).toBeVisible();
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
    expect(texts.some(t => t.includes('# comments'))).toBeTruthy();
    expect(texts.some(t => t.includes('Comments / verse'))).toBeTruthy();
    expect(texts.some(t => t.trim() === 'Reference')).toBeFalsy();
  });

  test('extra metric columns start visible and can be removed and re-added', async ({ page }) => {
    await search(page, 'light', { gran: 'play' });

    let texts = await page.locator('#results thead th').allTextContents();
    expect(texts.some(t => t.includes('# comments'))).toBeTruthy();
    expect(texts.some(t => t.includes('# words'))).toBeTruthy();
    expect(texts.some(t => t.includes('Words / Sentence'))).toBeTruthy();

    await page.locator('#results thead th').filter({ hasText: '# comments' }).getByRole('button', { name: /Remove/ }).click();
    texts = await page.locator('#results thead th').allTextContents();
    expect(texts.some(t => t.includes('# comments'))).toBeFalsy();

    await page.locator('#segmentsTab details summary').click();
    await expect(page.locator('#extraColumnControls label', { hasText: '# comments' }).locator('input')).not.toBeChecked();
    await page.locator('#extraColumnControls label', { hasText: '# comments' }).click();

    texts = await page.locator('#results thead th').allTextContents();
    expect(texts.some(t => t.includes('# comments'))).toBeTruthy();
    await expect(page.locator('#extraColumnControls label', { hasText: '# comments' }).locator('input')).toBeChecked();

    await page.locator('#extraColumnControls label', { hasText: 'Words / Sentence' }).locator('input').uncheck();
    texts = await page.locator('#results thead th').allTextContents();
    expect(texts.some(t => t.includes('Words / Sentence'))).toBeFalsy();
  });

  test('can add and remove individual commentator columns', async ({ page }) => {
    await search(page, 'light', { gran: 'play' });
    let texts = await page.locator('#results thead th').allTextContents();
    expect(texts.some(t => t.includes('Augustine of Hippo'))).toBeFalsy();

    await page.locator('#segmentsTab details summary').click();
    const optionTexts = await page.locator('#commentatorColumnSelect option').allTextContents();
    expect(optionTexts.length).toBeGreaterThan(100);
    expect(optionTexts.some(t => t === 'Theophylact of Ohrid (8,088)')).toBeTruthy();

    await page.locator('#commentatorColumnSelect').selectOption('augustine');
    await page.locator('#addCommentatorColumn').click();

    texts = await page.locator('#results thead th').allTextContents();
    expect(texts.some(t => t.includes('Augustine of Hippo'))).toBeTruthy();
    expect(texts.some(t => t.includes('Thomas Aquinas'))).toBeFalsy();

    await page.locator('#commentatorColumnFilter').fill('theophylact');
    const filteredOptionTexts = await page.locator('#commentatorColumnSelect option').allTextContents();
    expect(filteredOptionTexts.length).toBe(2);
    expect(filteredOptionTexts.some(t => t === 'Theophylact of Ohrid (8,088)')).toBeTruthy();
    await expect(page.locator('#commentatorColumnControls .commentator-filter-count')).toContainText('1 of');
    await page.locator('#addCommentatorColumn').click();
    texts = await page.locator('#results thead th').allTextContents();
    expect(texts.some(t => t.includes('Augustine of Hippo'))).toBeTruthy();
    expect(texts.some(t => t.includes('Theophylact of Ohrid'))).toBeTruthy();

    await page.locator('#results thead th').filter({ hasText: 'Augustine of Hippo' }).getByRole('button', { name: /Remove/ }).click();
    texts = await page.locator('#results thead th').allTextContents();
    expect(texts.some(t => t.includes('Augustine of Hippo'))).toBeFalsy();
    expect(texts.some(t => t.includes('Theophylact of Ohrid'))).toBeTruthy();
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

  test('granularity selector uses Verse for verse text rows', async ({ page }) => {
    const options = await page.locator('#gran option').evaluateAll((opts) =>
      opts.map((opt) => ({ value: opt.value, text: (opt.textContent || '').trim() }))
    );
    expect(options.some((opt) => opt.value === 'scene')).toBeFalsy();
    expect(options).toContainEqual({ value: 'line', text: 'Verse' });
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
    const headers = await page.locator('#results thead th').allTextContents();
    expect(headers.some(t => t.includes('# verses'))).toBeTruthy();
    expect(headers.some(t => t.includes('Comments / verse'))).toBeTruthy();
  });

  test('chapter granularity returns results', async ({ page }) => {
    await search(page, 'light', { gran: 'act' });
    expect(await page.locator('#results tbody tr').count()).toBeGreaterThan(0);
    const headers = await page.locator('#results thead th').allTextContents();
    expect(headers.some(t => t.includes('# verses'))).toBeTruthy();
    expect(headers.some(t => t.includes('Comments / verse'))).toBeTruthy();
  });

  test('verse granularity updates highlights when toggled', async ({ page }) => {
    await search(page, 'light', { gran: 'line' });
    await page.locator('#segmentsTab details summary').click();

    await expect(page.locator('#results tbody td .hit').first()).toBeVisible({ timeout: 10000 });

    await page.locator('#segmentsTab label', { hasText: 'Highlight matching verse text' }).click();
    await expect(page.locator('#segmentsTab .highlight-toggle')).not.toBeChecked();
    await expect(page.locator('#results tbody td .hit')).toHaveCount(0);
  });

  test('verse granularity shows counts even when percent display is selected', async ({ page }) => {
    await page.selectOption('#newTermDisplay', 'pct');
    await search(page, 'light', { gran: 'line' });

    const texts = await page.locator('#results thead th').allTextContents();
    expect(texts.some(t => t.includes('# "light"'))).toBeTruthy();
    expect(texts.some(t => t.includes('% "light"'))).toBeFalsy();
  });

  test('verse granularity shows rows without a search term', async ({ page }) => {
    await page.selectOption('#gran', 'line');
    await expect(page.locator('#results tbody tr:first-child td:first-child')).toHaveText('01.Gen.001.001', { timeout: 10000 });

    const headers = await page.locator('#results thead th').allTextContents();
    expect(headers.some(t => t.includes('Location'))).toBeTruthy();
    expect(headers.some(t => t.includes('# comments'))).toBeTruthy();
    expect(headers.some(t => t.includes('Verse'))).toBeTruthy();

    const firstRow = await page.locator('#results tbody tr').first().locator('td').allTextContents();
    expect(firstRow[0].trim()).toBe('01.Gen.001.001');
    expect(firstRow[1].trim()).toBe('Genesis');
    expect(firstRow[firstRow.length - 1]).toContain('In the beginning');
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
    await page.evaluate(() => {
      const tabs = document.querySelector('.tabs');
      tabs.classList.remove('is-hidden');
      tabs.style.display = 'flex';
    });
    await page.click('.tab-btn[data-tab="lines"]');
  });

  test('shows matching verses with Bible-specific headers', async ({ page }) => {
    await page.fill('#linesQuery', 'light');
    await page.press('#linesQuery', 'Enter');
    await expect(page.locator('#linesResults thead')).toContainText('Verse', { timeout: 10000 });

    const texts = await page.locator('#linesResults thead th').allTextContents();
    expect(texts.some(t => t.includes('Book'))).toBeTruthy();
    expect(texts.some(t => t.includes('Chapter'))).toBeTruthy();
    expect(texts.some(t => t.includes('Verse'))).toBeTruthy();
    expect(texts.some(t => t.includes('Verse'))).toBeTruthy();
  });

  test('removes verse highlights when the toggle is unchecked', async ({ page }) => {
    await page.fill('#linesQuery', 'light');
    await page.press('#linesQuery', 'Enter');
    await expect(page.locator('#linesResults thead')).toContainText('Verse', { timeout: 10000 });
    await page.locator('#linesTab details').evaluate((el) => { el.open = true; });

    await expect(page.locator('#linesResults tbody td .hit').first()).toBeVisible({ timeout: 10000 });

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

  test('restores selected commentator columns from URL params', async ({ page }) => {
    await page.goto('/?q=light&nm=1&gran=play&mm=exact&commentators=augustine,theophylact_of_ohrid');
    await waitForDataLoaded(page);
    await page.waitForSelector('#results tbody tr', { timeout: 10000 });

    const texts = await page.locator('#results thead th').allTextContents();
    expect(texts.some(t => t.includes('Augustine of Hippo'))).toBeTruthy();
    expect(texts.some(t => t.includes('Theophylact of Ohrid'))).toBeTruthy();
    expect(texts.some(t => t.includes('Luther'))).toBeFalsy();

    await page.locator('#segmentsTab details summary').click();
    await expect(page.locator('#selectedCommentatorColumns')).toContainText('Augustine of Hippo');
    await expect(page.locator('#selectedCommentatorColumns')).toContainText('Theophylact of Ohrid');
    const optionTexts = await page.locator('#commentatorColumnSelect option').allTextContents();
    expect(optionTexts.some(t => t.includes('Martin Luther'))).toBeTruthy();
    expect(optionTexts.some(t => t.includes('Augustine of Hippo'))).toBeFalsy();
  });

  test('maps legacy verse URL granularities to text-backed Verse view', async ({ page }) => {
    await page.goto('/?q=light&nm=1&gran=line&mm=exact&sk=location&sd=asc&cs=1&zr=0&hl=1');
    await waitForDataLoaded(page);
    await page.waitForSelector('#results tbody tr', { timeout: 10000 });
    await expect(page.locator('#gran')).toHaveValue('line');
    let texts = await page.locator('#results thead th').allTextContents();
    expect(texts.some(t => t.includes('Verse'))).toBeTruthy();

    await page.goto('/?q=light&nm=1&gran=scene&mm=exact&sk=location&sd=asc&cs=1&zr=0&hl=1');
    await waitForDataLoaded(page);
    await page.waitForSelector('#results tbody tr', { timeout: 10000 });
    await expect(page.locator('#gran')).toHaveValue('line');
    texts = await page.locator('#results thead th').allTextContents();
    expect(texts.some(t => t.includes('Verse'))).toBeTruthy();
  });
});
