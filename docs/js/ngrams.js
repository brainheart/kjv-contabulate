// N-grams functionality
import { 
  ngramCurrentPage, ngramPageSize, ngramAllRows,
  setNgramCurrentPage, setNgramPageSize, setNgramAllRows,
  ngramsColumnOrder, ngramsColumnDefs, setNgramsColumnOrder, setNgramsColumnDefs
} from './shared-state.js';
import { 
  tokens, tokens2, tokens3, ngramsSelectedSegments, 
  chunks, plays, characters, chunkById, playsById, charactersById
} from './data.js';
import { 
  ngramTableContainer, ngramCurrentPageSpan, ngramTotalPagesSpan, 
  ngramPrevBtn, ngramNextBtn
} from './dom.js';
import { paginateArray, getTotalPages } from './utils.js';
import { applyOrClear } from './color-scale.js';

// Global state
let ngramsPendingChanges = false;

export function buildNgramsComparison() {
  if (ngramsSelectedSegments.size === 0) {
    renderEmptyNgramsTable();
    return;
  }
  
  // Get ngram mode from the ngrams tab selector
  const ngramModeSelect = document.getElementById('ngramsNgramMode');
  const n = parseInt(ngramModeSelect?.value || '1', 10);
  
  // Get the appropriate token index
  const idx = n === 1 ? tokens : n === 2 ? tokens2 : tokens3;
  
  // Collect all tokens for the selected segments
  const tokenCounts = new Map();
  
  for (const segment of ngramsSelectedSegments) {
    const segmentTokens = getTokensForSegment(segment, idx);
    
    for (const [token, count] of segmentTokens) {
      if (!tokenCounts.has(token)) {
        tokenCounts.set(token, new Map());
      }
      tokenCounts.get(token).set(segment.label, count);
    }
  }
  
  // Build columns
  const columns = [
    { key: 'token', label: 'Token', type: 'text' },
    ...Array.from(ngramsSelectedSegments).map(seg => ({
      key: `seg_${seg.label}`, 
      label: seg.label, 
      type: 'number', 
      defaultDir: 'desc'
    }))
  ];
  
  // Build rows
  const rows = [];
  for (const [token, segmentCounts] of tokenCounts) {
    const row = { token };
    let totalCount = 0;
    
    for (const segment of ngramsSelectedSegments) {
      const count = segmentCounts.get(segment.label) || 0;
      row[`seg_${segment.label}`] = count;
      totalCount += count;
    }
    
    if (totalCount > 0) {
      rows.push(row);
    }
  }
  
  // Sort by total count descending
  rows.sort((a, b) => {
    const totalA = Array.from(ngramsSelectedSegments).reduce((sum, seg) => 
      sum + (a[`seg_${seg.label}`] || 0), 0);
    const totalB = Array.from(ngramsSelectedSegments).reduce((sum, seg) => 
      sum + (b[`seg_${seg.label}`] || 0), 0);
    return totalB - totalA;
  });
  
  setNgramsColumnDefs(columns);
  setNgramAllRows(rows);
  setNgramCurrentPage(1);
  renderNgramsComparisonTable();
}

function getTokensForSegment(segment, idx) {
  const tokens = new Map();
  
  if (segment.type === 'play') {
    // Get all chunks for this play
    const playChunks = chunks.filter(c => c.play_id === segment.id);
    for (const chunk of playChunks) {
      addChunkTokens(chunk.scene_id, idx, tokens);
    }
  } else if (segment.type === 'scene') {
    addChunkTokens(segment.id, idx, tokens);
  }
  // Add other segment types as needed
  
  return tokens;
}

function addChunkTokens(sceneId, idx, tokens) {
  for (const [token, postings] of Object.entries(idx)) {
    for (const [id, count] of postings) {
      if (id === sceneId) {
        tokens.set(token, (tokens.get(token) || 0) + count);
      }
    }
  }
}

export function renderNgramsComparisonTable() {
  const container = document.getElementById('ngramComparisonTableContainer');
  if (!container) return;
  
  if (ngramsSelectedSegments.size === 0 || ngramAllRows.length === 0) {
    container.innerHTML = '<p class="muted">No segments selected or no data available.</p>';
    return;
  }
  
  // Create table HTML
  const totalPages = getTotalPages(ngramAllRows.length, ngramPageSize);
  const paginatedRows = paginateArray(ngramAllRows, ngramCurrentPage, ngramPageSize);
  
  let html = `
    <table id="ngramComparisonTable" class="results-table">
      <thead>
        <tr id="ngramComparisonHeadRow">
  `;
  
  // Add headers
  for (const col of ngramsColumnDefs) {
    html += `<th data-key="${col.key}" data-type="${col.type || 'text'}">${col.label}</th>`;
  }
  
  html += `
        </tr>
      </thead>
      <tbody>
  `;
  
  // Add rows
  for (const row of paginatedRows) {
    html += '<tr>';
    for (const col of ngramsColumnDefs) {
      const value = row[col.key] || '';
      html += `<td>${value}</td>`;
    }
    html += '</tr>';
  }
  
  html += `
      </tbody>
    </table>
  `;
  
  // Add pagination
  if (ngramAllRows.length > ngramPageSize) {
    html += `
      <div id="ngramsPagination" class="pagination" style="display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1rem;">
        <button id="ngramsFirstPage">First</button>
        <button id="ngramsPrevPage">Prev</button>
        <span id="ngramsPageInfo">Page ${ngramCurrentPage} of ${totalPages}</span>
        <button id="ngramsNextPage">Next</button>
        <button id="ngramsLastPage">Last</button>
        <span id="ngramsTotalInfo">(${ngramAllRows.length} total rows)</span>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // Add pagination event listeners
  setupNgramsPagination(totalPages);
  
  // Apply color scales
  applyOrClear('#ngramComparisonTable');
}

function setupNgramsPagination(totalPages) {
  const firstBtn = document.getElementById('ngramsFirstPage');
  const prevBtn = document.getElementById('ngramsPrevPage');
  const nextBtn = document.getElementById('ngramsNextPage');
  const lastBtn = document.getElementById('ngramsLastPage');
  
  if (firstBtn) {
    firstBtn.disabled = ngramCurrentPage === 1;
    firstBtn.addEventListener('click', () => {
      setNgramCurrentPage(1);
      renderNgramsComparisonTable();
    });
  }
  
  if (prevBtn) {
    prevBtn.disabled = ngramCurrentPage === 1;
    prevBtn.addEventListener('click', () => {
      if (ngramCurrentPage > 1) {
        setNgramCurrentPage(ngramCurrentPage - 1);
        renderNgramsComparisonTable();
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.disabled = ngramCurrentPage === totalPages;
    nextBtn.addEventListener('click', () => {
      if (ngramCurrentPage < totalPages) {
        setNgramCurrentPage(ngramCurrentPage + 1);
        renderNgramsComparisonTable();
      }
    });
  }
  
  if (lastBtn) {
    lastBtn.disabled = ngramCurrentPage === totalPages;
    lastBtn.addEventListener('click', () => {
      setNgramCurrentPage(totalPages);
      renderNgramsComparisonTable();
    });
  }
}

function renderEmptyNgramsTable() {
  const container = document.getElementById('ngramComparisonTableContainer');
  if (container) {
    container.innerHTML = '<p class="muted">Select segments to compare their n-gram frequencies.</p>';
  }
}

export function checkNgramsPendingChanges() {
  // Basic implementation for now
  ngramsPendingChanges = true;
  updateNgramsRefreshButton();
}

export function updateNgramsRefreshButton() {
  const btn = document.getElementById('ngramsRefreshBtn');
  if (!btn) return;
  
  if (ngramsPendingChanges) {
    btn.classList.add('refresh-btn-pending');
    btn.textContent = 'Refresh ⟳';
  } else {
    btn.classList.remove('refresh-btn-pending');
    btn.textContent = 'Refresh';
  }
}

export function saveNgramsState() {
  ngramsPendingChanges = false;
  updateNgramsRefreshButton();
}

// Make functions globally available for backward compatibility
if (typeof window !== 'undefined') {
  window.buildNgramsComparison = buildNgramsComparison;
  window.checkNgramsPendingChanges = checkNgramsPendingChanges;
  window.saveNgramsState = saveNgramsState;
}