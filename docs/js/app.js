// Main application entry point
import './dom.js';
import { 
  extraTerms, setExtraTerms, termDisplayMode, setTermDisplayMode, 
  showZeroRows, setShowZeroRows, colorScaleEnabled, highlightEnabled,
  setColorScaleEnabled, setHighlightEnabled, setColorScalePalette, setColorScaleSteps,
  segmentsCurrentPage, setSegmentsCurrentPage, segmentsPageSize,
  linesCurrentPage, setLinesCurrentPage, linesPageSize,
  ngramCurrentPage, setNgramCurrentPage, ngramPageSize
} from './shared-state.js';
import { 
  q, gran, go, matchMode, ngramMode, termDisplayModeSel, showZeroRowsToggle,
  addTermInput, addTermBtn, termsList, currentPageSpan, totalPagesSpan, prevBtn, nextBtn
} from './dom.js';
import { loadAllData, initSegmentSelectors, renderAvailableSegments } from './data.js';
import { 
  syncColorScaleToggles, syncColorScaleOptions, syncHighlightToggles,
  renderAllLegends, applyColorScalesForVisibleTables 
} from './color-scale.js';
import { updateDeepLink, decodeExtrasParam, decodeState, arrayToMap } from './state.js';
import { 
  doSearch, refreshSegmentsFromFilters, checkSegmentsPendingChanges,
  updateSegmentsRefreshButton, saveSegmentsState
} from './segments.js';
import { 
  buildNgramsComparison, checkNgramsPendingChanges, saveNgramsState 
} from './ngrams.js';
import { 
  doLinesSearch, checkLinesPendingChanges, saveLinesState 
} from './lines.js';
import { normalizeTerm, escapeHTML, debounce } from './utils.js';

// Global state for tab management
let segmentsTab, ngramsTab, linesTab;
let tabBtns = [];

// Initialize the application
async function initApp() {
  try {
    // Load all data first
    await loadAllData();
    
    // Initialize UI components
    initTabs();
    initExtraTermsUI();
    initColorScaleToggles();
    initPaginationControls();
    initFormControls();
    
    // Apply state from URL if present
    applyStateFromURL();
    
    // Initial render
    renderExtraTerms();
    renderAllLegends();
    syncColorScaleToggles();
    syncColorScaleOptions();
    syncHighlightToggles();
    
    console.log('Shakespeare Contabulate app initialized');
    
  } catch (error) {
    console.error('Failed to initialize app:', error);
    const tbody = document.querySelector('#results tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td class="error">Failed to load data. Please refresh the page.</td></tr>';
    }
  }
}

function initTabs() {
  segmentsTab = document.getElementById('segmentsTab');
  ngramsTab = document.getElementById('ngramsTab');
  linesTab = document.getElementById('linesTab');
  tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });
}

function switchTab(tab) {
  // Update button states
  tabBtns.forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  
  // Update tab visibility
  if (segmentsTab) segmentsTab.style.display = tab === 'segments' ? 'block' : 'none';
  if (ngramsTab) ngramsTab.style.display = tab === 'ngrams' ? 'block' : 'none';
  if (linesTab) linesTab.style.display = tab === 'lines' ? 'block' : 'none';
  
  // Apply color scales for visible tables
  applyColorScalesForVisibleTables();
}

function initExtraTermsUI() {
  if (addTermBtn) {
    addTermBtn.addEventListener('click', () => {
      const term = addTermInput?.value?.trim();
      if (term) {
        addExtraTerm(term);
        if (addTermInput) addTermInput.value = '';
      }
    });
  }
  
  if (addTermInput) {
    addTermInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const term = addTermInput.value?.trim();
        if (term) {
          addExtraTerm(term);
          addTermInput.value = '';
        }
      }
    });
  }
}

function initColorScaleToggles() {
  // Color scale toggle
  document.querySelectorAll('.color-scale-toggle').forEach(cb => {
    cb.addEventListener('change', (e) => {
      setColorScaleEnabled(e.target.checked);
      applyColorScalesForVisibleTables();
    });
  });
  
  // Color scale palette
  document.querySelectorAll('.color-scale-palette').forEach(sel => {
    sel.addEventListener('change', (e) => {
      setColorScalePalette(e.target.value);
      renderAllLegends();
      applyColorScalesForVisibleTables();
    });
  });
  
  // Color scale steps
  document.querySelectorAll('.color-scale-steps').forEach(sel => {
    sel.addEventListener('change', (e) => {
      setColorScaleSteps(parseInt(e.target.value));
      renderAllLegends();
      applyColorScalesForVisibleTables();
    });
  });
  
  // Highlight toggle
  document.querySelectorAll('.highlight-toggle').forEach(cb => {
    cb.addEventListener('change', (e) => {
      setHighlightEnabled(e.target.checked);
      // Rebuild views so highlighting updates
      const segQ = q?.value?.trim();
      if (segQ) doSearch();
      const linesQ = document.getElementById('linesQuery')?.value?.trim();
      if (linesQ) doLinesSearch();
    });
  });
}

function initPaginationControls() {
  // Segments pagination
  const segPrevBtn = document.getElementById('segmentsPrevPage');
  const segNextBtn = document.getElementById('segmentsNextPage');
  const segFirstBtn = document.getElementById('segmentsFirstPage');
  const segLastBtn = document.getElementById('segmentsLastPage');
  
  if (segFirstBtn) segFirstBtn.addEventListener('click', () => {
    setSegmentsCurrentPage(1);
    import('./segments.js').then(m => m.renderSegmentsPage());
  });
  
  if (segPrevBtn) segPrevBtn.addEventListener('click', () => {
    if (segmentsCurrentPage > 1) {
      setSegmentsCurrentPage(segmentsCurrentPage - 1);
      import('./segments.js').then(m => m.renderSegmentsPage());
    }
  });
  
  if (segNextBtn) segNextBtn.addEventListener('click', () => {
    setSegmentsCurrentPage(segmentsCurrentPage + 1);
    import('./segments.js').then(m => m.renderSegmentsPage());
  });
  
  // Lines pagination
  const linesPrevBtn = document.getElementById('linesPrevPage');
  const linesNextBtn = document.getElementById('linesNextPage');
  
  if (linesPrevBtn) linesPrevBtn.addEventListener('click', () => {
    if (linesCurrentPage > 1) {
      setLinesCurrentPage(linesCurrentPage - 1);
      import('./lines.js').then(m => m.renderLinesPage());
    }
  });
  
  if (linesNextBtn) linesNextBtn.addEventListener('click', () => {
    setLinesCurrentPage(linesCurrentPage + 1);
    import('./lines.js').then(m => m.renderLinesPage());
  });
  
  // N-grams pagination
  const ngramsPrevBtn = document.getElementById('ngramsPrevPage');
  const ngramsNextBtn = document.getElementById('ngramsNextPage');
  
  if (ngramsPrevBtn) ngramsPrevBtn.addEventListener('click', () => {
    if (ngramCurrentPage > 1) {
      setNgramCurrentPage(ngramCurrentPage - 1);
      import('./ngrams.js').then(m => m.renderNgramsComparisonTable());
    }
  });
  
  if (ngramsNextBtn) ngramsNextBtn.addEventListener('click', () => {
    setNgramCurrentPage(ngramCurrentPage + 1);
    import('./ngrams.js').then(m => m.renderNgramsComparisonTable());
  });
}

function initFormControls() {
  // Main search button
  if (go) {
    go.addEventListener('click', () => {
      doSearch();
    });
  }
  
  // Search form submission
  const searchForm = document.getElementById('searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      doSearch();
    });
  }
  
  // Term display mode
  if (termDisplayModeSel) {
    termDisplayModeSel.addEventListener('change', (e) => {
      setTermDisplayMode(e.target.value);
      checkSegmentsPendingChanges();
    });
  }
  
  // Show zero rows toggle
  if (showZeroRowsToggle) {
    showZeroRowsToggle.addEventListener('change', (e) => {
      setShowZeroRows(e.target.checked);
      checkSegmentsPendingChanges();
    });
  }
  
  // Granularity change
  if (gran) {
    gran.addEventListener('change', () => {
      checkSegmentsPendingChanges();
    });
  }
  
  // N-gram mode change
  if (ngramMode) {
    ngramMode.addEventListener('change', () => {
      checkSegmentsPendingChanges();
    });
  }
  
  // Match mode change
  if (matchMode) {
    matchMode.addEventListener('change', () => {
      checkSegmentsPendingChanges();
    });
  }
  
  // Query input changes
  if (q) {
    const debouncedCheck = debounce(checkSegmentsPendingChanges, 300);
    q.addEventListener('input', debouncedCheck);
    
    // Handle Enter key on query input
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch();
      }
    });
  }
  
  // Lines query
  const linesQuery = document.getElementById('linesQuery');
  if (linesQuery) {
    linesQuery.addEventListener('input', debounce(() => {
      checkLinesPendingChanges();
    }, 300));
  }
  
  // Lines search button
  const linesSearchBtn = document.getElementById('linesSearchBtn');
  if (linesSearchBtn) {
    linesSearchBtn.addEventListener('click', () => {
      doLinesSearch();
    });
  }
  
  // N-grams search button
  const ngramsSearchBtn = document.getElementById('ngramsSearchBtn');
  if (ngramsSearchBtn) {
    ngramsSearchBtn.addEventListener('click', () => {
      buildNgramsComparison();
    });
  }
  
  // N-grams mode change
  const ngramsNgramMode = document.getElementById('ngramsNgramMode');
  if (ngramsNgramMode) {
    ngramsNgramMode.addEventListener('change', () => {
      checkNgramsPendingChanges();
    });
  }
}

// Extra terms management
function pruneExtraTermsAgainstPrimary() {
  const primaryNorm = normalizeTerm(q?.value || '');
  const filtered = extraTerms.filter(t => normalizeTerm(t) !== primaryNorm);
  if (filtered.length !== extraTerms.length) {
    setExtraTerms(filtered);
    renderExtraTerms();
  }
}

function getActiveTerms() {
  const seen = new Set();
  const out = [];
  const add = (term) => {
    const norm = normalizeTerm(term);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    out.push(term.trim());
  };
  add(q?.value || '');
  extraTerms.forEach(add);
  return out;
}

function renderExtraTerms() {
  if (!termsList) return;
  const terms = extraTerms.filter(t => t && t.trim());
  if (terms.length === 0) {
    termsList.classList.add('muted');
    termsList.textContent = 'No extra terms yet. Add some to see side-by-side columns.';
    return;
  }
  termsList.classList.remove('muted');
  termsList.innerHTML = '';
  terms.forEach((term, idx) => {
    const pill = document.createElement('span');
    pill.className = 'term-pill';
    pill.innerHTML = `<span>${escapeHTML(term)}</span><button type="button" class="remove-term" data-idx="${idx}" aria-label="Remove term ${escapeHTML(term)}">×</button>`;
    termsList.appendChild(pill);
  });
  termsList.querySelectorAll('.remove-term').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.idx, 10);
      if (!Number.isNaN(i)) {
        const newTerms = [...extraTerms];
        newTerms.splice(i, 1);
        setExtraTerms(newTerms);
        renderExtraTerms();
        checkSegmentsPendingChanges();
        doSearch();
      }
    });
  });
}

function addExtraTerm(term) {
  const val = (term ?? '').trim();
  if (!val) return;
  const normVal = normalizeTerm(val);
  const primaryNorm = normalizeTerm(q?.value || '');
  if (normVal === primaryNorm) return;
  const existing = extraTerms.map(normalizeTerm);
  if (existing.includes(normVal)) return;
  const newTerms = [...extraTerms, val];
  setExtraTerms(newTerms);
  renderExtraTerms();
  checkSegmentsPendingChanges();
  doSearch();
}

function applyStateFromURL() {
  const sp = new URLSearchParams(location.search);
  
  // New readable params first
  if (sp.has('tab') || sp.has('q') || sp.has('l_q') || sp.has('co')) {
    try {
      // Display
      if (sp.has('cs')) setColorScaleEnabled(sp.get('cs') === '1');
      if (sp.has('hl')) setHighlightEnabled(sp.get('hl') === '1');
      syncColorScaleToggles(); 
      syncColorScaleOptions(); 
      syncHighlightToggles();
      
      // Segments
      if (sp.has('q') && q) q.value = sp.get('q');
      if (sp.has('nm') && ngramMode) ngramMode.value = sp.get('nm');
      if (sp.has('gran') && gran) gran.value = sp.get('gran');
      if (sp.has('mm') && matchMode) matchMode.value = sp.get('mm');
      
      if (sp.has('td')) {
        const td = sp.get('td');
        setTermDisplayMode(td);
        if (termDisplayModeSel) termDisplayModeSel.value = td;
      }
      
      if (sp.has('zr')) {
        const zr = sp.get('zr') === '1';
        setShowZeroRows(zr);
        if (showZeroRowsToggle) showZeroRowsToggle.checked = zr;
      }
      
      if (sp.has('qt')) {
        const decoded = decodeExtrasParam(sp.get('qt'));
        setExtraTerms(decoded);
        pruneExtraTermsAgainstPrimary();
        renderExtraTerms();
      }
      
      // Auto-search if query present
      if (sp.has('q') && q?.value?.trim()) {
        setTimeout(() => doSearch(), 100);
      }
      
    } catch (e) {
      console.warn('Failed to apply URL state:', e);
    }
  }
  // Legacy base64 state support
  else if (sp.has('state')) {
    const state = decodeState(sp.get('state'));
    if (state) {
      try {
        // Apply legacy state...
        console.log('Applying legacy state:', state);
      } catch (e) {
        console.warn('Failed to apply legacy state:', e);
      }
    }
  }
}

// Make key functions globally available for backward compatibility
if (typeof window !== 'undefined') {
  window.getActiveTerms = getActiveTerms;
  window.pruneExtraTermsAgainstPrimary = pruneExtraTermsAgainstPrimary;
  window.renderExtraTerms = renderExtraTerms;
  window.addExtraTerm = addExtraTerm;
}

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}