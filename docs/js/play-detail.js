// Play detail modal functionality
import { playsById, chunks, tokens, tokens2, tokens3, chunkById } from './data.js';

// Constants and state
export const PLAY_COUNT_TOTAL = 'total';
let playDetailCache = new Map();
let playDetailState = { playId: null, term: null, n: 1 };

export function sceneToPlayId(sceneId) {
  const chunk = chunkById.get(sceneId);
  return chunk ? chunk.play_id : null;
}

export function playShapeById(playId) {
  const play = playsById.get(playId);
  if (!play) return null;
  
  const playChunks = chunks.filter(c => c.play_id === playId);
  const acts = new Map();
  
  for (const chunk of playChunks) {
    const actKey = chunk.act;
    if (!acts.has(actKey)) {
      acts.set(actKey, []);
    }
    acts.get(actKey).push(chunk.scene);
  }
  
  return {
    title: play.title,
    acts: Array.from(acts.entries()).map(([act, scenes]) => ({
      act: parseInt(act),
      scenes: scenes.sort((a, b) => a - b)
    }))
  };
}

export function isPlayDetailCell(granVal, colKey, rowData) {
  // Only show play detail links for numeric columns in play/act/scene views
  if (granVal === 'line' || granVal === 'character') return false;
  if (!colKey.includes('_count') && !colKey.includes('_pct')) return false;
  return rowData.play_id != null;
}

export function buildPlayDetailLink(value, playId) {
  const span = document.createElement('span');
  span.className = 'play-detail-link';
  span.textContent = value;
  span.style.cursor = 'pointer';
  span.style.textDecoration = 'underline';
  span.title = 'Click to see breakdown by scene';
  
  span.addEventListener('click', (e) => {
    e.stopPropagation();
    openPlayDetailModal(playId, 'sample_term', 1);
  });
  
  return span;
}

export function renderPlayDetailHeaderLabel(text) {
  return text; // Simplified for now
}

export function ensurePlayDetailModal() {
  let modal = document.getElementById('playDetailModal');
  if (modal) return modal;
  
  modal = document.createElement('div');
  modal.id = 'playDetailModal';
  modal.className = 'modal';
  modal.style.cssText = `
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.5);
  `;
  
  modal.innerHTML = `
    <div class="modal-content" style="background: white; margin: 5% auto; padding: 20px; width: 80%; max-width: 800px; border-radius: 5px;">
      <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 id="playDetailTitle">Play Detail</h2>
        <span class="close" style="font-size: 28px; font-weight: bold; cursor: pointer;">&times;</span>
      </div>
      <div id="playDetailContent">
        Loading...
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add close event listeners
  modal.querySelector('.close').addEventListener('click', closePlayDetailModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closePlayDetailModal();
    }
  });
  
  return modal;
}

export function closePlayDetailModal() {
  const modal = document.getElementById('playDetailModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

export function computePlayNgramRows(playId, term, n) {
  // Simplified implementation
  const play = playsById.get(playId);
  if (!play) return [];
  
  const playChunks = chunks.filter(c => c.play_id === playId);
  const idx = n === 1 ? tokens : n === 2 ? tokens2 : tokens3;
  
  const rows = [];
  
  for (const chunk of playChunks) {
    const postings = idx[term.toLowerCase()] || [];
    const count = postings.find(([id]) => id === chunk.scene_id)?.[1] || 0;
    
    rows.push({
      act: chunk.act,
      scene: chunk.scene,
      scene_id: chunk.scene_id,
      canonical_id: chunk.canonical_id,
      count,
      total_words: chunk.total_words || 0,
      percentage: chunk.total_words ? (count / chunk.total_words * 100) : 0
    });
  }
  
  return rows.sort((a, b) => {
    if (a.act !== b.act) return a.act - b.act;
    return a.scene - b.scene;
  });
}

export function computePlayDetailData(playId, term, n) {
  const cacheKey = `${playId}:${term}:${n}`;
  
  if (playDetailCache.has(cacheKey)) {
    return playDetailCache.get(cacheKey);
  }
  
  const rows = computePlayNgramRows(playId, term, n);
  const data = {
    playId,
    term,
    n,
    rows,
    totalCount: rows.reduce((sum, row) => sum + row.count, 0)
  };
  
  playDetailCache.set(cacheKey, data);
  return data;
}

export function openPlayDetailModal(playId, term, n) {
  const modal = ensurePlayDetailModal();
  const play = playsById.get(playId);
  
  if (!play) {
    console.error('Play not found:', playId);
    return;
  }
  
  playDetailState = { playId, term, n };
  
  // Update modal title
  const title = document.getElementById('playDetailTitle');
  if (title) {
    title.textContent = `${play.title} - "${term}" breakdown`;
  }
  
  // Show modal
  modal.style.display = 'block';
  
  // Load content
  const content = document.getElementById('playDetailContent');
  if (content) {
    content.innerHTML = 'Loading...';
    
    // Compute data
    const data = computePlayDetailData(playId, term, n);
    
    // Render table
    let html = `
      <div style="margin-bottom: 1rem;">
        Total occurrences: <strong>${data.totalCount}</strong>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid #ccc;">
            <th style="text-align: left; padding: 0.5rem;">Act</th>
            <th style="text-align: left; padding: 0.5rem;">Scene</th>
            <th style="text-align: right; padding: 0.5rem;">Count</th>
            <th style="text-align: right; padding: 0.5rem;">%</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    for (const row of data.rows) {
      if (row.count > 0) {
        html += `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 0.5rem;">${row.act}</td>
            <td style="padding: 0.5rem;">${row.scene}</td>
            <td style="padding: 0.5rem; text-align: right;">${row.count}</td>
            <td style="padding: 0.5rem; text-align: right;">${row.percentage.toFixed(2)}%</td>
          </tr>
        `;
      }
    }
    
    html += '</tbody></table>';
    content.innerHTML = html;
  }
}

// Event listeners for modal functionality
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePlayDetailModal();
  }
});

// Make functions globally available for backward compatibility
if (typeof window !== 'undefined') {
  window.isPlayDetailCell = isPlayDetailCell;
  window.buildPlayDetailLink = buildPlayDetailLink;
  window.openPlayDetailModal = openPlayDetailModal;
  window.closePlayDetailModal = closePlayDetailModal;
}