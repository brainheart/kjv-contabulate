// Lines functionality (line search and results)
import { 
  linesSortKey, linesSortDir, setLinesSortKey, setLinesSortDir,
  linesCurrentPage, linesPageSize, linesAllRows,
  setLinesCurrentPage, setLinesPageSize, setLinesAllRows,
  linesColumnFilters
} from './shared-state.js';
import { allLines, chunkById, playsById } from './data.js';
import { 
  linesQueryInput, linesGranSel, linesMatchMode, linesTableContainer,
  linesCurrentPageSpan, linesTotalPagesSpan, linesPrevBtn, linesNextBtn
} from './dom.js';
import { 
  paginateArray, getTotalPages, fmtPct, debounce, stripTags, toCsvValue, 
  downloadCsv, highlightHTML, escapeRegexText, countRegexMatches,
  getLineTokens, getLineNgrams
} from './utils.js';
import { applyOrClear, highlightEnabled } from './color-scale.js';

// Global state
let linesPendingChanges = false;

export function buildLinesRows() {
  const query = linesQueryInput?.value.trim() || '';
  if (!query) return [];
  
  const granVal = linesGranSel?.value || 'scene';
  const matchModeVal = linesMatchMode?.value || 'substring';
  
  if (!allLines || allLines.length === 0) return [];
  
  let matchFn;
  let highlightRegex = null;
  
  if (matchModeVal === 'regex') {
    try {
      const regex = new RegExp(query, 'gi');
      matchFn = (line) => regex.test(line.text);
      highlightRegex = new RegExp(query, 'gi');
    } catch (e) {
      console.error('Invalid regex:', e);
      return [];
    }
  } else if (matchModeVal === 'word') {
    const tokens = getLineTokens({ text: query });
    matchFn = (line) => {
      const lineTokens = getLineTokens(line);
      return tokens.every(token => lineTokens.includes(token));
    };
    if (tokens.length > 0) {
      highlightRegex = new RegExp('\\b(' + tokens.map(escapeRegexText).join('|') + ')\\b', 'gi');
    }
  } else { // substring
    const lowerQuery = query.toLowerCase();
    matchFn = (line) => line.text.toLowerCase().includes(lowerQuery);
    highlightRegex = new RegExp(escapeRegexText(query), 'gi');
  }
  
  // Filter lines
  const matchingLines = allLines.filter(matchFn);
  
  // Build result rows
  const rows = matchingLines.map(line => {
    const chunk = chunkById.get(line.scene_id);
    const play = chunk ? playsById.get(chunk.play_id) : null;
    
    let lineHtml = line.text;
    if (highlightEnabled && highlightRegex) {
      lineHtml = highlightHTML(line.text, highlightRegex);
    }
    
    return {
      line_id: line.line_id,
      play_title: play?.title || '',
      genre: play?.genre || '',
      act: chunk?.act || '',
      act_label: chunk?.act_label || `Act ${chunk?.act || ''}`,
      scene: chunk?.scene || '',
      scene_label: chunk?.scene_label || `Scene ${chunk?.scene || ''}`,
      character: line.character || '',
      text: line.text,
      line_html: lineHtml,
      scene_id: line.scene_id,
      play_id: chunk?.play_id
    };
  });
  
  return rows;
}

export function setLinesHeaders(includePlay = true, includeAct = true, includeScene = true) {
  const thead = document.getElementById('linesHeadRow');
  if (!thead) return;
  
  const columns = [];
  
  if (includePlay) columns.push({ key: 'play_title', label: 'Play', type: 'text' });
  if (includePlay) columns.push({ key: 'genre', label: 'Genre', type: 'text' });
  if (includeAct) columns.push({ key: 'act', label: 'Act', type: 'text' });
  if (includeScene) columns.push({ key: 'scene', label: 'Scene', type: 'text' });
  columns.push({ key: 'character', label: 'Character', type: 'text' });
  columns.push({ key: 'text', label: 'Line', type: 'text' });
  
  thead.innerHTML = '';
  
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    th.dataset.key = col.key;
    th.dataset.type = col.type;
    th.title = 'Click to sort';
    
    th.addEventListener('click', () => {
      if (linesSortKey === col.key) {
        setLinesSortDir(linesSortDir === 'asc' ? 'desc' : 'asc');
      } else {
        setLinesSortKey(col.key);
        setLinesSortDir(col.defaultDir || 'asc');
      }
      setLinesAllRows(sortLinesRows(linesAllRows));
      setLinesCurrentPage(1);
      renderLinesPage();
    });
    
    thead.appendChild(th);
  });
  
  updateLinesSortIndicators();
}

export function sortLinesRows(rows) {
  if (!linesSortKey) return rows;
  
  return rows.sort((a, b) => {
    const av = a[linesSortKey];
    const bv = b[linesSortKey];
    
    if (typeof av === 'string' || typeof bv === 'string') {
      const cmp = String(av || '').localeCompare(String(bv || ''));
      return linesSortDir === 'asc' ? cmp : -cmp;
    }
    
    const cmp = (av || 0) - (bv || 0);
    return linesSortDir === 'asc' ? cmp : -cmp;
  });
}

export function updateLinesSortIndicators() {
  const thead = document.getElementById('linesHeadRow');
  if (!thead) return;
  
  thead.querySelectorAll('th').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.key === linesSortKey) {
      th.classList.add(linesSortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

export function renderLinesPage() {
  const tbody = document.getElementById('linesTableBody');
  if (!tbody) return;
  
  const totalPages = getTotalPages(linesAllRows.length, linesPageSize);
  const paginatedRows = paginateArray(linesAllRows, linesCurrentPage, linesPageSize);
  
  tbody.innerHTML = '';
  
  if (paginatedRows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">No lines found</td></tr>';
    return;
  }
  
  const thead = document.getElementById('linesHeadRow');
  const columns = thead ? Array.from(thead.children).map(th => th.dataset.key) : [];
  
  for (const row of paginatedRows) {
    const tr = document.createElement('tr');
    
    columns.forEach(key => {
      const td = document.createElement('td');
      
      if (key === 'text') {
        td.innerHTML = row.line_html || row.text || '';
      } else if (key === 'act') {
        td.textContent = row.act_label || row.act || '';
      } else if (key === 'scene') {
        td.textContent = row.scene_label || row.scene || '';
      } else {
        td.textContent = row[key] || '';
      }
      
      tr.appendChild(td);
    });
    
    tbody.appendChild(tr);
  }
  
  // Update pagination
  updateLinesPagination(totalPages);
  updateLinesSortIndicators();
  applyOrClear('#linesTable');
}

function updateLinesPagination(totalPages) {
  const paginationDiv = document.getElementById('linesPagination');
  if (!paginationDiv) return;
  
  paginationDiv.style.display = linesAllRows.length > linesPageSize ? 'flex' : 'none';
  
  if (linesCurrentPageSpan) {
    linesCurrentPageSpan.textContent = linesCurrentPage.toString();
  }
  
  if (linesTotalPagesSpan) {
    linesTotalPagesSpan.textContent = totalPages.toString();
  }
  
  const firstBtn = document.getElementById('linesFirstPage');
  const prevBtn = document.getElementById('linesPrevPage');
  const nextBtn = document.getElementById('linesNextPage');
  const lastBtn = document.getElementById('linesLastPage');
  
  if (firstBtn) firstBtn.disabled = linesCurrentPage === 1;
  if (prevBtn) prevBtn.disabled = linesCurrentPage === 1;
  if (nextBtn) nextBtn.disabled = linesCurrentPage === totalPages;
  if (lastBtn) lastBtn.disabled = linesCurrentPage === totalPages;
}

export function doLinesSearch() {
  const query = linesQueryInput?.value.trim() || '';
  if (!query) {
    setLinesAllRows([]);
    renderLinesPage();
    return;
  }
  
  const rows = buildLinesRows();
  setLinesAllRows(sortLinesRows(rows));
  setLinesCurrentPage(1);
  setLinesHeaders();
  renderLinesPage();
  saveLinesState();
}

export function applyLinesFilters(rows) {
  if (linesColumnFilters.size === 0) return rows;
  
  return rows.filter(row => {
    for (const [key, filter] of linesColumnFilters.entries()) {
      const val = row[key];
      
      if (filter.type === 'number') {
        const num = parseFloat(val);
        if (isNaN(num)) continue;
        if (filter.min && num < parseFloat(filter.min)) return false;
        if (filter.max && num > parseFloat(filter.max)) return false;
      } else if (filter.type === 'text') {
        if (!filter.pattern) continue;
        try {
          const re = new RegExp(filter.pattern, 'i');
          if (!re.test(String(val))) return false;
        } catch (e) {
          continue;
        }
      }
    }
    return true;
  });
}

export function downloadLinesCsvAll(filename) {
  const thead = document.getElementById('linesHeadRow');
  if (!thead || !linesAllRows || linesAllRows.length === 0) return;
  
  const cols = Array.from(thead.children).map(th => ({
    key: th.dataset.key,
    label: (th.childNodes[0]?.textContent || th.textContent || '').replace('⚙','').trim()
  }));
  
  if (cols.length === 0) return;
  
  const filtered = applyLinesFilters(linesAllRows);
  const rows = [cols.map(c => c.label)];
  
  for (const r of filtered) {
    rows.push(cols.map(c => {
      if (c.key === 'act') return r.act_label || r.act;
      if (c.key === 'scene') return r.scene_label || r.scene;
      if (c.key === 'text') return stripTags(r.text);
      return r[c.key] ?? '';
    }));
  }
  
  downloadCsv(filename, rows);
}

export function updateLinesFilterActions() {
  // Simplified for now
}

export function checkLinesPendingChanges() {
  linesPendingChanges = true;
  updateLinesRefreshButton();
}

export function updateLinesRefreshButton() {
  const btn = document.getElementById('linesRefreshBtn');
  if (!btn) return;
  
  if (linesPendingChanges) {
    btn.classList.add('refresh-btn-pending');
    btn.textContent = 'Refresh ⟳';
  } else {
    btn.classList.remove('refresh-btn-pending');
    btn.textContent = 'Refresh';
  }
}

export function saveLinesState() {
  linesPendingChanges = false;
  updateLinesRefreshButton();
}

// Make functions globally available for backward compatibility
if (typeof window !== 'undefined') {
  window.doLinesSearch = doLinesSearch;
  window.checkLinesPendingChanges = checkLinesPendingChanges;
  window.saveLinesState = saveLinesState;
}