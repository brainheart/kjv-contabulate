// Data loading and management
import { normName } from './utils.js';

export async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

// Global data variables
export let chunks = [];
export let tokens = {};
export let tokens2 = {};
export let tokens3 = {};
export let plays = [];
export let characters = [];
export let tokensChar = {};
export let tokensChar2 = {};
export let tokensChar3 = {};
export let allLines = [];

// Lookup maps
export let chunkById = new Map();
export let playsById = new Map();
export let charactersById = new Map();

// Computed totals
export let actTotals = new Map();
export let playTotals = new Map();

// Available segments for n-grams
export let allAvailableSegments = [];
export let ngramsSelectedSegments = new Set();

export async function loadAllData() {
  try {
    [chunks, tokens, tokens2, tokens3, plays, characters, tokensChar, tokensChar2, tokensChar3] = await Promise.all([
      loadJSON('data/chunks.json'),
      loadJSON('data/tokens.json'),
      loadJSON('data/tokens2.json'),
      loadJSON('data/tokens3.json'),
      loadJSON('data/plays.json'),
      loadJSON('data/characters.json'),
      loadJSON('data/tokens_char.json'),
      loadJSON('data/tokens_char2.json'),
      loadJSON('data/tokens_char3.json'),
    ]);
  } catch(e) {
    console.error('Failed to load data:', e);
    throw e;
  }

  // Load line data
  try {
    allLines = await loadJSON('lines/all_lines.json');
  } catch(e) {
    console.warn('Lines data not available:', e);
  }

  // Build lookup maps
  chunkById = new Map(chunks.map(r => [r.scene_id, r]));
  playsById = new Map(plays.map(p => [p.play_id, p]));
  charactersById = new Map(characters.map(c => [c.character_id, c]));

  // Precompute act/play totals
  for (const r of chunks) {
    const k = `${r.play_id}:${r.act}`;
    actTotals.set(k, (actTotals.get(k)||0) + (r.total_words||0));
    playTotals.set(r.play_id, (playTotals.get(r.play_id)||0) + (r.total_words||0));
  }

  buildAvailableSegments();
}

export function buildAvailableSegments() {
  allAvailableSegments = [];
  
  // Add plays
  plays.forEach(p => {
    allAvailableSegments.push({
      type: 'play',
      id: p.play_id,
      label: p.title,
      meta: `${p.genre || 'Unknown'}, ${p.first_performance_year || 'Unknown year'}`,
      searchText: `${p.title} ${p.genre || ''} play`.toLowerCase()
    });
  });
  
  // Add genres
  const genres = [...new Set(plays.map(p => p.genre).filter(Boolean))];
  genres.forEach(g => {
    allAvailableSegments.push({
      type: 'genre',
      id: g,
      label: g,
      meta: `Genre`,
      searchText: `${g} genre`.toLowerCase()
    });
  });
  
  // Add acts
  const acts = new Map();
  chunks.forEach(chunk => {
    const key = `${chunk.play_id}:${chunk.act}`;
    if (!acts.has(key)) {
      const play = playsById.get(chunk.play_id);
      acts.set(key, {
        type: 'act',
        id: key,
        label: `${play.title} - Act ${chunk.act}`,
        meta: `Act`,
        searchText: `${play.title} act ${chunk.act}`.toLowerCase()
      });
    }
  });
  allAvailableSegments.push(...acts.values());
  
  // Add scenes
  chunks.forEach(chunk => {
    const play = playsById.get(chunk.play_id);
    allAvailableSegments.push({
      type: 'scene',
      id: chunk.scene_id,
      label: `${play.title} - Act ${chunk.act}, Scene ${chunk.scene}`,
      meta: `${chunk.total_words || 0} words`,
      searchText: `${play.title} act ${chunk.act} scene ${chunk.scene}`.toLowerCase()
    });
  });
  
  // Add all characters (sorted by word count)
  const sortedChars = [...characters].sort((a, b) => (b.total_words_spoken || 0) - (a.total_words_spoken || 0));
  sortedChars.forEach(c => {
    allAvailableSegments.push({
      type: 'character',
      id: c.character_id,
      label: `${c.name} (${c.play_title})`,
      meta: `${c.total_words_spoken || 0} words`,
      searchText: `${c.name} ${c.play_title} character`.toLowerCase()
    });
  });
}

export function renderAvailableSegments() {
  const searchInput = document.getElementById('segmentSearchInput');
  const typeFilter = document.getElementById('segmentTypeFilter');
  const container = document.getElementById('availableSegmentsList');
  
  const searchTerm = searchInput.value.toLowerCase().trim();
  const typeValue = typeFilter.value;
  
  // Filter segments
  let filtered = allAvailableSegments.filter(seg => {
    // Type filter
    if (typeValue !== 'all' && seg.type !== typeValue) return false;
    
    // Search filter
    if (searchTerm && !seg.searchText.includes(searchTerm)) return false;
    
    // Don't show already selected segments
    const isSelected = Array.from(ngramsSelectedSegments).some(selected => 
      selected.type === seg.type && String(selected.id) === String(seg.id)
    );
    if (isSelected) return false;
    
    return true;
  });
  
  // Limit to 100 results for performance
  if (filtered.length > 100) {
    filtered = filtered.slice(0, 100);
  }
  
  if (filtered.length === 0) {
    container.innerHTML = '<p class="muted" style="text-align: center; padding: 2rem;">No segments found</p>';
    return;
  }
  
  container.innerHTML = '';
  filtered.forEach(seg => {
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.4rem; margin-bottom: 0.25rem; border-bottom: 1px solid var(--border);';
    
    const typeLabel = seg.type.charAt(0).toUpperCase() + seg.type.slice(1);
    div.innerHTML = `
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 500;">${seg.label}</div>
        <div class="muted" style="font-size: 0.85rem;">${seg.meta}</div>
      </div>
      <button class="add-segment-btn" data-type="${seg.type}" data-id="${seg.id}" data-label="${seg.label}" style="padding: 0.25rem 0.6rem; font-size: 0.85rem; white-space: nowrap;">Add</button>
    `;
    container.appendChild(div);
  });
  
  // Add click handlers
  container.querySelectorAll('.add-segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const segType = btn.dataset.type;
      let segId = btn.dataset.id;
      
      // Parse numeric IDs for appropriate types
      if (segType === 'play' || segType === 'character' || segType === 'scene') {
        segId = parseInt(segId);
      }
      
      ngramsSelectedSegments.add({
        type: segType,
        id: segId,
        label: btn.dataset.label
      });
      
      renderAvailableSegments();
      renderSelectedSegments();
      
      // Import checkNgramsPendingChanges function from ngrams module when available
      if (window.checkNgramsPendingChanges) {
        window.checkNgramsPendingChanges();
      }
    });
  });
}

export function renderSelectedSegments() {
  const container = document.getElementById('selectedSegmentsList');
  const countSpan = document.getElementById('selectedSegmentsCount');
  
  countSpan.textContent = ngramsSelectedSegments.size;
  
  if (ngramsSelectedSegments.size === 0) {
    container.innerHTML = '<p class="muted" style="text-align: center; padding: 2rem;">No segments selected</p>';
    return;
  }
  
  container.innerHTML = '';
  const sortedSegments = Array.from(ngramsSelectedSegments).sort((a, b) => a.label.localeCompare(b.label));
  
  sortedSegments.forEach(seg => {
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.4rem; margin-bottom: 0.25rem; border-bottom: 1px solid var(--border);';
    
    const typeLabel = seg.type.charAt(0).toUpperCase() + seg.type.slice(1);
    div.innerHTML = `
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 500;">${seg.label}</div>
        <div class="muted" style="font-size: 0.85rem;">${typeLabel}</div>
      </div>
      <button class="remove-segment-btn" style="padding: 0.25rem 0.6rem; font-size: 0.85rem; background: #dc3545; border-color: #dc3545;">Remove</button>
    `;
    container.appendChild(div);
    
    // Add remove handler
    div.querySelector('.remove-segment-btn').addEventListener('click', () => {
      ngramsSelectedSegments.delete(seg);
      renderAvailableSegments();
      renderSelectedSegments();
      
      // Import checkNgramsPendingChanges function from ngrams module when available
      if (window.checkNgramsPendingChanges) {
        window.checkNgramsPendingChanges();
      }
    });
  });
}

export function initSegmentSelectors() {
  const searchInput = document.getElementById('segmentSearchInput');
  const typeFilter = document.getElementById('segmentTypeFilter');
  const clearAllBtn = document.getElementById('clearAllSegments');
  
  searchInput.addEventListener('input', renderAvailableSegments);
  typeFilter.addEventListener('change', renderAvailableSegments);
  
  clearAllBtn.addEventListener('click', () => {
    ngramsSelectedSegments.clear();
    renderAvailableSegments();
    renderSelectedSegments();
    
    // Import checkNgramsPendingChanges function from ngrams module when available
    if (window.checkNgramsPendingChanges) {
      window.checkNgramsPendingChanges();
    }
  });
  
  // Initial render
  renderSelectedSegments();
}