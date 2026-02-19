// Play Detail Modal (TF-IDF analysis)
// Extracted from index.html — initialized via initPlayDetail()

(function () {
  'use strict';

  const PLAY_COUNT_TOTAL = 37;

  let sceneToPlayId, playShapeById, chunkById, playsById, tokens, tokens2, tokens3, escapeHTML;

  const playDetailCache = new Map();
  const playDetailState = {
    playId: null,
    currentN: 1,
    sortKey: 'count',
    sortDir: 'desc',
    threshold: 0,
    rowsByN: { 1: [], 2: [], 3: [] },
    maxByN: { 1: 0, 2: 0, 3: 0 }
  };
  let playDetailEls = null;

  function isPlayDetailCell(granVal, key, row) {
    if (!row || row.play_id == null) return false;
    if (granVal === 'play' && (key === 'title' || key === 'id')) return true;
    if ((granVal === 'scene' || granVal === 'act' || granVal === 'character') && key === 'play_title') return true;
    return false;
  }

  function buildPlayDetailLink(text, playId) {
    const el = document.createElement('span');
    el.className = 'play-detail-link';
    el.dataset.playId = String(playId);
    el.textContent = String(text ?? '');
    return el;
  }

  function renderPlayDetailHeaderLabel(label, playId) {
    const safe = escapeHTML(label ?? '');
    if (playId == null || Number.isNaN(Number(playId))) return safe;
    return `<span class="play-detail-link" data-play-id="${Number(playId)}">${safe}</span>`;
  }

  function ensurePlayDetailModal() {
    if (playDetailEls) return playDetailEls;

    const overlay = document.createElement('div');
    overlay.className = 'play-detail-overlay';
    overlay.innerHTML = `
      <div class="play-detail-modal" role="dialog" aria-modal="true" aria-label="Play detail">
        <div class="play-detail-head">
          <button type="button" class="play-detail-close" aria-label="Close">×</button>
          <h3 id="playDetailTitle"></h3>
          <div class="play-detail-meta" id="playDetailMeta"></div>
        </div>
        <div class="play-detail-body">
          <div class="play-detail-tabs">
            <button type="button" class="play-detail-tab-btn active" data-n="1">Unigrams</button>
            <button type="button" class="play-detail-tab-btn" data-n="2">Bigrams</button>
            <button type="button" class="play-detail-tab-btn" data-n="3">Trigrams</button>
          </div>
          <div class="play-detail-controls">
            <label for="playDetailSlider">Unusualness</label>
            <input id="playDetailSlider" type="range" min="0" max="0" value="0" step="0.0001">
            <span class="play-detail-value" id="playDetailValue">0</span>
          </div>
          <div class="play-detail-loading" id="playDetailLoading">Computing...</div>
          <table id="playDetailTable" style="display:none;">
            <thead>
              <tr>
                <th>Rank</th>
                <th data-key="ngram">N-gram</th>
                <th data-key="count">Count</th>
                <th data-key="tfidf">TF-IDF Score</th>
              </tr>
            </thead>
            <tbody id="playDetailTableBody"></tbody>
          </table>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('.play-detail-close');
    const loading = overlay.querySelector('#playDetailLoading');
    const slider = overlay.querySelector('#playDetailSlider');
    const sliderValue = overlay.querySelector('#playDetailValue');
    const table = overlay.querySelector('#playDetailTable');
    const tbodyEl = overlay.querySelector('#playDetailTableBody');
    const titleEl = overlay.querySelector('#playDetailTitle');
    const metaEl = overlay.querySelector('#playDetailMeta');
    const tabBtns = Array.from(overlay.querySelectorAll('.play-detail-tab-btn'));
    const sortableHeaders = Array.from(overlay.querySelectorAll('th[data-key]'));

    function setLoading(msg) {
      loading.textContent = msg || 'Computing...';
      loading.style.display = 'block';
      table.style.display = 'none';
    }

    function updateSliderUi() {
      const max = playDetailState.maxByN[playDetailState.currentN] || 0;
      slider.max = String(max);
      slider.min = '0';
      slider.step = String(max > 0 ? Math.max(max / 400, 0.0001) : 0.0001);
      if (playDetailState.threshold > max) playDetailState.threshold = max;
      slider.value = String(playDetailState.threshold);
      slider.disabled = max <= 0;
      sliderValue.textContent = playDetailState.threshold.toFixed(4);
    }

    function pdSortRows(rows) {
      const out = rows.slice();
      const key = playDetailState.sortKey;
      const dir = playDetailState.sortDir;
      out.sort((a, b) => {
        let cmp = 0;
        if (key === 'ngram') cmp = a.ngram.localeCompare(b.ngram);
        else if (key === 'tfidf') cmp = a.tfidf - b.tfidf;
        else cmp = a.count - b.count;
        if (cmp === 0) cmp = a.ngram.localeCompare(b.ngram);
        return dir === 'asc' ? cmp : -cmp;
      });
      return out;
    }

    function renderRows() {
      const rows = playDetailState.rowsByN[playDetailState.currentN] || [];
      const threshold = playDetailState.threshold || 0;
      const filtered = threshold > 0 ? rows.filter(r => r.tfidf >= threshold) : rows.slice();
      const sorted = pdSortRows(filtered);

      if (!sorted.length) {
        tbodyEl.innerHTML = '<tr><td colspan="4" class="muted">No n-grams at this unusualness threshold.</td></tr>';
        return;
      }

      const html = [];
      for (let i = 0; i < sorted.length; i++) {
        const row = sorted[i];
        html.push(
          `<tr>` +
          `<td>${i + 1}</td>` +
          `<td>${escapeHTML(row.ngram)}</td>` +
          `<td>${row.count}</td>` +
          `<td>${row.tfidf.toFixed(4)}</td>` +
          `</tr>`
        );
      }
      tbodyEl.innerHTML = html.join('');
    }

    function setTab(n) {
      playDetailState.currentN = n;
      tabBtns.forEach(btn => btn.classList.toggle('active', Number(btn.dataset.n) === n));
      playDetailState.threshold = 0;
      playDetailState.sortKey = 'count';
      playDetailState.sortDir = 'desc';
      updateSliderUi();
      renderRows();
    }

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => setTab(Number(btn.dataset.n)));
    });

    slider.addEventListener('input', () => {
      playDetailState.threshold = Number(slider.value) || 0;
      if (playDetailState.threshold === 0) {
        playDetailState.sortKey = 'count';
        playDetailState.sortDir = 'desc';
      }
      sliderValue.textContent = playDetailState.threshold.toFixed(4);
      renderRows();
    });

    sortableHeaders.forEach(th => {
      th.style.cursor = 'pointer';
      th.title = 'Click to sort';
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (!key) return;
        if (playDetailState.sortKey === key) {
          playDetailState.sortDir = (playDetailState.sortDir === 'asc' ? 'desc' : 'asc');
        } else {
          playDetailState.sortKey = key;
          playDetailState.sortDir = (key === 'ngram' ? 'asc' : 'desc');
        }
        renderRows();
      });
    });

    closeBtn.addEventListener('click', closePlayDetailModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePlayDetailModal();
    });

    playDetailEls = {
      overlay, loading, table, titleEl, metaEl, setLoading, setTab, updateSliderUi, renderRows
    };
    return playDetailEls;
  }

  function closePlayDetailModal() {
    if (!playDetailEls) return;
    playDetailEls.overlay.classList.remove('open');
  }

  function computePlayNgramRows(index, playId) {
    const rows = [];
    let maxTfIdf = 0;
    for (const [ngram, postings] of Object.entries(index || {})) {
      if (!Array.isArray(postings) || postings.length === 0) continue;

      let tf = 0;
      const playsSeen = new Set();

      for (const posting of postings) {
        if (!Array.isArray(posting) || posting.length < 2) continue;
        const sceneId = posting[0];
        const count = Number(posting[1]) || 0;
        if (count <= 0) continue;

        const pid = sceneToPlayId.get(sceneId) ?? (chunkById.get(sceneId) || {}).play_id;
        if (pid == null) continue;
        playsSeen.add(pid);
        if (pid === playId) tf += count;
      }

      if (tf <= 0) continue;
      const df = playsSeen.size;
      if (df <= 0) continue;

      const idf = Math.log(PLAY_COUNT_TOTAL / df);
      const tfidf = tf * idf;
      if (tfidf > maxTfIdf) maxTfIdf = tfidf;
      rows.push({ ngram, count: tf, tfidf });
    }

    rows.sort((a, b) => (b.count - a.count) || a.ngram.localeCompare(b.ngram));
    return { rows, maxTfIdf };
  }

  async function computePlayDetailData(playId) {
    if (playDetailCache.has(playId)) return playDetailCache.get(playId);

    const result = { rowsByN: { 1: [], 2: [], 3: [] }, maxByN: { 1: 0, 2: 0, 3: 0 } };
    const modal = ensurePlayDetailModal();

    modal.setLoading('Computing unigrams...');
    await new Promise(r => setTimeout(r, 0));
    const u = computePlayNgramRows(tokens, playId);
    result.rowsByN[1] = u.rows;
    result.maxByN[1] = u.maxTfIdf;

    modal.setLoading('Computing bigrams...');
    await new Promise(r => setTimeout(r, 0));
    const b = computePlayNgramRows(tokens2, playId);
    result.rowsByN[2] = b.rows;
    result.maxByN[2] = b.maxTfIdf;

    modal.setLoading('Computing trigrams...');
    await new Promise(r => setTimeout(r, 0));
    const t = computePlayNgramRows(tokens3, playId);
    result.rowsByN[3] = t.rows;
    result.maxByN[3] = t.maxTfIdf;

    playDetailCache.set(playId, result);
    return result;
  }

  async function openPlayDetailModal(playId) {
    const play = playsById.get(playId);
    if (!play) return;

    const modal = ensurePlayDetailModal();
    playDetailState.playId = playId;
    playDetailState.currentN = 1;
    playDetailState.sortKey = 'count';
    playDetailState.sortDir = 'desc';
    playDetailState.threshold = 0;
    playDetailState.rowsByN = { 1: [], 2: [], 3: [] };
    playDetailState.maxByN = { 1: 0, 2: 0, 3: 0 };

    const shape = playShapeById.get(playId) || { scenes: new Set(), acts: new Set() };
    const year = play.first_performance_year || 'Unknown year';
    const totalWords = play.total_words || 0;
    const totalLines = play.total_lines || 0;
    const scenes = shape.scenes.size || 0;
    const acts = Array.from(shape.acts).filter(a => a >= 1 && a <= 5).length;

    modal.titleEl.textContent = play.title || play.abbr || 'Unknown play';
    modal.metaEl.textContent = `${play.genre || 'Unknown genre'} \u00b7 ${year} \u00b7 ${totalWords} words \u00b7 ${totalLines} lines \u00b7 ${scenes} scenes \u00b7 ${acts} acts`;
    modal.overlay.classList.add('open');
    modal.setLoading('Computing...');
    modal.updateSliderUi();

    const data = await computePlayDetailData(playId);
    if (playDetailState.playId !== playId) return;

    playDetailState.rowsByN = data.rowsByN;
    playDetailState.maxByN = data.maxByN;
    modal.loading.style.display = 'none';
    modal.table.style.display = 'table';
    modal.setTab(1);
  }

  // Event delegation for play detail links (works across all tables)
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.play-detail-link');
    if (!trigger) return;
    const playId = Number(trigger.dataset.playId);
    if (!Number.isInteger(playId)) return;
    e.preventDefault();
    e.stopPropagation();
    openPlayDetailModal(playId);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && playDetailEls && playDetailEls.overlay.classList.contains('open')) {
      closePlayDetailModal();
    }
  });

  // Expose the init function and helpers on window
  window.initPlayDetail = function (deps) {
    sceneToPlayId = new Map(deps.chunks.map(c => [c.scene_id, c.play_id]));
    playShapeById = new Map();
    for (const c of deps.chunks) {
      if (!playShapeById.has(c.play_id)) {
        playShapeById.set(c.play_id, { scenes: new Set(), acts: new Set() });
      }
      const s = playShapeById.get(c.play_id);
      s.scenes.add(c.scene_id);
      s.acts.add(c.act);
    }
    chunkById = deps.chunkById;
    playsById = deps.playsById;
    tokens = deps.tokens;
    tokens2 = deps.tokens2;
    tokens3 = deps.tokens3;
    escapeHTML = deps.escapeHTML;
  };

  window.isPlayDetailCell = isPlayDetailCell;
  window.buildPlayDetailLink = buildPlayDetailLink;
})();
