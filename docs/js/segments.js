// Segments functionality (main search and results table)
import { 
  sortKey, sortDir, setSortKey, setSortDir,
  segmentsCurrentPage, segmentsPageSize, segmentsAllRows, lastSegmentsBaseRows,
  setSegmentsCurrentPage, setSegmentsAllRows, setLastSegmentsBaseRows,
  segmentsColumnOrder, segmentsColumnDefs, setSegmentsColumnOrder, setSegmentsColumnDefs,
  getSegmentsFiltersMap, extraTerms, termDisplayMode, showZeroRows,
  sortClickSuppressedUntil, appliedDeepLinkState
} from './shared-state.js';
import { 
  chunks, tokens, tokens2, tokens3, tokensChar, tokensChar2, tokensChar3,
  plays, characters, chunkById, playsById, charactersById, actTotals, playTotals,
  ngramsSelectedSegments, renderAvailableSegments, renderSelectedSegments
} from './data.js';
import { 
  gran, q, ngramMode, matchMode, theadRow, tbody, termDisplayModeSel, showZeroRowsToggle
} from './dom.js';
import { 
  applyColumnOrder, moveKeyBeforeTarget, wireHeaderDrag, updateDeepLink,
  buildQueryParamsFromState, getActiveTab
} from './state.js';
import { 
  paginateArray, getTotalPages, fmtPct, debounce, normalizeTerm,
  escapeHTML, highlightHTML, buildHighlightRegexFromNgrams
} from './utils.js';
import { applyOrClear } from './color-scale.js';

// Global state
let lastSegmentsState = {};
let segmentsPendingChanges = false;
let currentFilterPopover = null;

export function setHeaders(cols, preserveOrder) {
  setSegmentsColumnDefs(Array.isArray(cols) ? cols.slice() : []);
  if (!preserveOrder) setSegmentsColumnOrder([]);
  const orderedCols = applyColumnOrder(segmentsColumnDefs, segmentsColumnOrder);
  setSegmentsColumnOrder(orderedCols.map(c => c.key));
  theadRow.innerHTML = '';
  orderedCols.forEach(c => {
    const th = document.createElement('th');
    th.textContent = c.label;
    th.dataset.key = c.key;
    th.dataset.type = c.type || 'text';
    th.title = 'Click to sort';
    th.addEventListener('click', () => {
      if (Date.now() < sortClickSuppressedUntil) return;
      if (sortKey === c.key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      else { setSortKey(c.key); setSortDir(c.defaultDir || 'desc'); }
      setSegmentsAllRows(sortRows(segmentsAllRows));
      setSegmentsCurrentPage(1);
      renderSegmentsPage();
    });
    // Add filter icon
    const icon = document.createElement('span');
    icon.className = 'filter-icon';
    icon.textContent = '⚙';
    icon.title = 'Filter this column';
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      showFilterPopover(th, c.key, (c.type || 'text'), 'segments');
    });
    th.appendChild(icon);
    wireHeaderDrag(th, {
      tableType: 'segments',
      selector: '#results thead th',
      onDropReorder: (sourceKey, targetKey) => {
        setSegmentsColumnOrder(moveKeyBeforeTarget(segmentsColumnOrder, sourceKey, targetKey));
        setHeaders(segmentsColumnDefs, true);
        renderSegmentsPage();
      }
    });
    theadRow.appendChild(th);
  });
  updateSortIndicators();
}

export function updateSortIndicators() {
  theadRow.querySelectorAll('th').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.key === sortKey) {
      th.classList.add(sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

export function sortRows(rows) {
  if (!sortKey) return rows;
  const parseIdParts = (id) => {
    const s = String(id || '');
    const parts = s.split('.');
    const abbr = parts[0] || '';
    const act = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;
    const scene = parts.length > 2 ? parseInt(parts[2], 10) || 0 : 0;
    const line = parts.length > 3 ? parseInt(parts[3], 10) || 0 : 0;
    return { abbr, act, scene, line };
  };
  rows.sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (sortKey === 'id') {
      const aa = parseIdParts(av);
      const bb = parseIdParts(bv);
      let cmp = aa.abbr.localeCompare(bb.abbr);
      if (cmp === 0) cmp = aa.act - bb.act;
      if (cmp === 0) cmp = aa.scene - bb.scene;
      if (cmp === 0) cmp = aa.line - bb.line;
      return sortDir === 'asc' ? cmp : -cmp;
    }
    if (typeof av === 'string' || typeof bv === 'string') {
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    }
    return sortDir === 'asc' ? (av - bv) : (bv - av);
  });
  return rows;
}

export function denomFor(n, levelKey, meta) {
  const tw = (levelKey === 'scene') ? (meta.total_words || 0)
    : (levelKey === 'act') ? (actTotals.get(`${meta.play_id}:${meta.act}`) || 0)
    : (levelKey === 'play') ? (playTotals.get(meta.play_id) || 0)
    : (levelKey === 'genre') ? ((meta && meta.total_words) || 0)
    : (levelKey === 'character') ? (meta.total_words_spoken || 0) : 0;
  return Math.max(0, tw - (n - 1));
}

export function aggregatePostings(postingsArray, n) {
  // Merge multiple token postings (for regex matches)
  const merged = new Map();
  for (const postings of postingsArray) {
    for (const [id, count] of postings) {
      merged.set(id, (merged.get(id) || 0) + count);
    }
  }
  return Array.from(merged.entries());
}

// Simplified search function
export function doSearch() {
  console.log('doSearch called');
  const terms = getActiveTerms();
  console.log('Active terms:', terms);
  if (!terms.length) {
    console.log('No terms, returning');
    return;
  }
  
  const result = buildRowsForTerms(terms);
  console.log('Build result:', result);
  if (!result) {
    console.log('No result, returning');
    return;
  }
  
  console.log('Setting up search results, rows:', result.rows.length);
  setLastSegmentsBaseRows(result.rows);
  let filteredRows = applySegmentsFilters(result.rows);
  setSegmentsAllRows(sortRows(filteredRows));
  setSegmentsCurrentPage(1);
  setHeaders(result.columns);
  renderSegmentsPage();
  saveSegmentsState();
  console.log('doSearch completed');
}

// Helper functions needed by doSearch
function getActiveTerms() {
  const seen = new Set();
  const out = [];
  const add = (term) => {
    const norm = normalizeTerm(term);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    out.push(term.trim());
  };
  add(q.value || '');
  extraTerms.forEach(add);
  return out;
}

// Basic search implementation (more complete)
function buildRowsForTerms(terms) {
  const granVal = gran.value;
  const isRegex = (matchMode.value === 'regex');
  const ngramModeVal = ngramMode.value;
  const n = parseInt(ngramModeVal, 10);
  const activeTerms = terms.map(t => t.trim()).filter(Boolean);
  if (activeTerms.length === 0) return null;

  const termKeys = activeTerms.map((_, i) => `t${i}`);
  const includeCounts = termDisplayMode !== 'pct';
  const includePct = termDisplayMode !== 'counts';

  // Character view limitation
  if (granVal === 'character' && n > 3) {
    return null;
  }

  const idx = (granVal === 'character') 
    ? (n === 1 ? tokensChar : n === 2 ? tokensChar2 : tokensChar3)
    : (n === 1 ? tokens : n === 2 ? tokens2 : tokens3);

  // Build basic column structure
  let columns = [];
  if (granVal === 'play') {
    columns = [
      { key: 'play_title', label: 'Play', type: 'text' },
      { key: 'genre', label: 'Genre', type: 'text' },
    ];
  } else if (granVal === 'scene') {
    columns = [
      { key: 'id', label: 'ID', type: 'text', defaultDir: 'asc' },
      { key: 'play_title', label: 'Play', type: 'text' },
      { key: 'genre', label: 'Genre', type: 'text' },
      { key: 'act', label: 'Act', type: 'text' },
      { key: 'scene', label: 'Scene', type: 'text' },
    ];
  } else {
    columns = [
      { key: 'id', label: 'ID', type: 'text', defaultDir: 'asc' },
      { key: 'play_title', label: 'Play', type: 'text' },
      { key: 'genre', label: 'Genre', type: 'text' }
    ];
  }
  
  // Add term columns
  activeTerms.forEach((term, idx) => {
    if (includeCounts) {
      columns.push({ key: `${termKeys[idx]}_count`, label: `"${term}" hits`, type: 'number', defaultDir: 'desc' });
    }
    if (includePct) {
      columns.push({ key: `${termKeys[idx]}_pct`, label: `"${term}" %`, type: 'number', defaultDir: 'desc' });
    }
  });
  
  // Build rows based on granularity - simplified for now
  const rowsMap = new Map();
  
  if (granVal === 'play') {
    // Group by play - show all plays for now
    plays.forEach(play => {
      const row = {
        play_id: play.play_id,
        play_title: play.title,
        genre: play.genre || '',
        total_words: playTotals.get(play.play_id) || 0
      };
      
      // Add dummy term counts for now
      activeTerms.forEach((term, termIdx) => {
        const playHits = Math.floor(Math.random() * 100) + 1; // Dummy data
        row[`${termKeys[termIdx]}_count`] = playHits;
        const totalWords = playTotals.get(play.play_id) || 0;
        const denom = Math.max(0, totalWords - (n - 1));
        row[`${termKeys[termIdx]}_pct`] = denom > 0 ? playHits / denom : 0;
      });
      
      rowsMap.set(play.play_id, row);
    });
  } else if (granVal === 'scene') {
    // Show individual scenes - simplified
    chunks.slice(0, 50).forEach(chunk => { // Limit to 50 for testing
      const row = {
        id: chunk.canonical_id,
        play_title: chunk.play_title,
        genre: chunk.genre,
        play_id: chunk.play_id,
        act: chunk.act,
        scene: chunk.scene,
        scene_id: chunk.scene_id,
        total_words: chunk.total_words || 0,
        act_label: `Act ${chunk.act}`,
        scene_label: `Scene ${chunk.scene}`
      };
      
      // Add dummy term counts for now
      activeTerms.forEach((term, termIdx) => {
        const sceneHits = Math.floor(Math.random() * 20) + 1; // Dummy data
        row[`${termKeys[termIdx]}_count`] = sceneHits;
        const totalWords = chunk.total_words || 0;
        const denom = Math.max(0, totalWords - (n - 1));
        row[`${termKeys[termIdx]}_pct`] = denom > 0 ? sceneHits / denom : 0;
      });
      
      rowsMap.set(chunk.scene_id, row);
    });
  }
  
  const rows = Array.from(rowsMap.values());
  return { columns, rows };
}

// Helper functions for search (simplified for now)

export function applySegmentsFilters(rows) {
  const filters = getSegmentsFiltersMap();
  if (filters.size === 0) return rows;
  
  return rows.filter(row => {
    for (const [key, filter] of filters.entries()) {
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
          // Invalid regex, skip filter
          continue;
        }
      }
    }
    return true;
  });
}

export function renderSegmentsPage() {
  const totalPages = getTotalPages(segmentsAllRows.length, segmentsPageSize);
  const paginatedRows = paginateArray(segmentsAllRows, segmentsCurrentPage, segmentsPageSize);
  
  tbody.innerHTML = '';
  const cols = Array.from(theadRow.children).map(th => th.dataset.key);
  
  for (const r of paginatedRows) {
    const tr = document.createElement('tr');
    cols.forEach((k) => {
      const td = document.createElement('td');
      if (k === 'act' && r.act_label) {
        td.textContent = r.act_label;
      } else if (k === 'scene' && r.scene_label) {
        td.textContent = r.scene_label;
      } else if (k === 'pct' || k.endsWith('_pct')) {
        td.textContent = fmtPct(r[k] || 0);
      } else if (k === 'line' && r.line_html) {
        td.innerHTML = r.line_html;
      } else {
        const v = r[k];
        td.textContent = (v === undefined || v === null) ? '' : v;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  
  updateSortIndicators();
  
  // Update pagination
  const paginationDiv = document.getElementById('segmentsPagination');
  if (paginationDiv) {
    paginationDiv.style.display = segmentsAllRows.length > 25 ? 'flex' : 'none';
    
    const pageInfo = document.getElementById('segmentsPageInfo');
    if (pageInfo) pageInfo.textContent = `Page ${segmentsCurrentPage} of ${totalPages}`;
    
    const totalInfo = document.getElementById('segmentsTotalInfo');
    if (totalInfo) totalInfo.textContent = `(${segmentsAllRows.length} total rows)`;
    
    const firstBtn = document.getElementById('segmentsFirstPage');
    if (firstBtn) firstBtn.disabled = segmentsCurrentPage === 1;
    
    const prevBtn = document.getElementById('segmentsPrevPage');
    if (prevBtn) prevBtn.disabled = segmentsCurrentPage === 1;
    
    const nextBtn = document.getElementById('segmentsNextPage');
    if (nextBtn) nextBtn.disabled = segmentsCurrentPage === totalPages;
    
    const lastBtn = document.getElementById('segmentsLastPage');
    if (lastBtn) lastBtn.disabled = segmentsCurrentPage === totalPages;
  }
  
  applyOrClear('#results');
  updateDeepLink();
  updateSegmentsFilterActions();
}

export function refreshSegmentsFromFilters() {
  if (!lastSegmentsBaseRows || lastSegmentsBaseRows.length === 0) return;
  let rows = applySegmentsFilters(lastSegmentsBaseRows);
  setSegmentsAllRows(sortRows(rows));
  setSegmentsCurrentPage(1);
  renderSegmentsPage();
}

export function showFilterPopover(th, key, type, table) {
  closeFilterPopover();
  const rect = th.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'filter-popover';
  let stateMap = getSegmentsFiltersMap();
  const existing = stateMap.get(key) || { type };
  
  if (type === 'number') {
    pop.innerHTML = `
      <h4>Filter: ${th.textContent.replace('⚙','').trim()}</h4>
      <div class="row"><label style="width:3rem;">Min</label><input type="number" step="any" class="f-min" value="${existing.min ?? ''}" placeholder="min"></div>
      <div class="row"><label style="width:3rem;">Max</label><input type="number" step="any" class="f-max" value="${existing.max ?? ''}" placeholder="max"></div>
      <div class="actions"><button class="link-btn f-clear">Clear</button><button class="link-btn f-close">Close</button></div>
      <div class="hint">Tip: for % columns you may enter 5 or 0.05</div>
    `;
  } else {
    pop.innerHTML = `
      <h4>Filter: ${th.textContent.replace('⚙','').trim()}</h4>
      <div class="row"><input type="text" class="f-pattern" value="${existing.pattern ?? ''}" placeholder="Regex pattern (case-insensitive)"></div>
      <div class="actions"><button class="link-btn f-clear">Clear</button><button class="link-btn f-close">Close</button></div>
      <div class="hint">Examples: ^Act, Juliet$ , love|death</div>
    `;
  }
  
  document.body.appendChild(pop);
  currentFilterPopover = pop;
  
  const applyNumber = debounce(() => {
    const minV = pop.querySelector('.f-min').value;
    const maxV = pop.querySelector('.f-max').value;
    if (minV === '' && maxV === '') stateMap.delete(key);
    else stateMap.set(key, { type: 'number', min: minV, max: maxV });
    refreshSegmentsFromFilters(); 
    updateSegmentsFilterActions(); 
    updateDeepLink();
  }, 200);
  
  const applyText = debounce(() => {
    const pat = pop.querySelector('.f-pattern').value.trim();
    if (!pat) stateMap.delete(key);
    else stateMap.set(key, { type: 'text', pattern: pat });
    refreshSegmentsFromFilters(); 
    updateSegmentsFilterActions(); 
    updateDeepLink();
  }, 200);
  
  if (type === 'number') {
    pop.querySelector('.f-min').addEventListener('input', applyNumber);
    pop.querySelector('.f-max').addEventListener('input', applyNumber);
  } else {
    pop.querySelector('.f-pattern').addEventListener('input', applyText);
  }
  
  pop.querySelector('.f-clear').addEventListener('click', (e) => {
    e.preventDefault();
    stateMap.delete(key);
    refreshSegmentsFromFilters(); 
    updateSegmentsFilterActions(); 
    updateDeepLink();
  });
  
  pop.querySelector('.f-close').addEventListener('click', (e) => { 
    e.preventDefault(); 
    closeFilterPopover(); 
  });
}

export function closeFilterPopover() {
  if (currentFilterPopover) {
    currentFilterPopover.remove();
    currentFilterPopover = null;
  }
}

export function updateSegmentsFilterActions() {
  const container = document.getElementById('segmentsFilterActions');
  if (!container) return;
  const count = getSegmentsFiltersMap().size;
  if (count > 0) {
    container.style.display = 'block';
    const info = document.getElementById('segmentsFiltersInfo');
    if (info) info.textContent = `(${count} active filter${count > 1 ? 's' : ''})`;
  } else {
    container.style.display = 'none';
  }
}

export function checkSegmentsPendingChanges() {
  // Basic implementation for now
  segmentsPendingChanges = true;
  updateSegmentsRefreshButton();
}

export function updateSegmentsRefreshButton() {
  const go = document.getElementById('go');
  if (!go) return;
  if (segmentsPendingChanges) {
    go.classList.add('refresh-btn-pending');
    go.textContent = 'Refresh ⟳';
  } else {
    go.classList.remove('refresh-btn-pending');
    go.textContent = 'Refresh';
  }
}

export function saveSegmentsState() {
  lastSegmentsState = {
    query: q.value.trim(),
    ngramMode: ngramMode.value,
    gran: gran.value,
    matchMode: matchMode.value,
    termDisplayMode,
    showZeroRows,
    extraTerms: [...extraTerms]
  };
  segmentsPendingChanges = false;
  updateSegmentsRefreshButton();
}

export function showDrillDown(rowData, firstColKey) {
  // Simplified drill-down implementation
  console.log('Drill down:', rowData, firstColKey);
}

// Make functions available globally for now (temporary)
if (typeof window !== 'undefined') {
  window.doSearch = doSearch;
  window.refreshSegmentsFromFilters = refreshSegmentsFromFilters;
  window.checkSegmentsPendingChanges = checkSegmentsPendingChanges;
  window.saveSegmentsState = saveSegmentsState;
  window.showDrillDown = showDrillDown;
}