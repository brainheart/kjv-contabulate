// Ngrams segment selector controller (available/selected lists + add/remove UI)
// Extracted from index.html — initialized via createNgramsSegmentSelectorController()

(function () {
  'use strict';

  function createNgramsSegmentSelectorController(initDeps) {
    const deps = Object.assign({}, initDeps || {});
    let initialized = false;
    let allAvailableSegments = [];

    const els = {
      searchInput: document.getElementById('segmentSearchInput'),
      typeFilter: document.getElementById('segmentTypeFilter'),
      availableList: document.getElementById('availableSegmentsList'),
      selectedList: document.getElementById('selectedSegmentsList'),
      selectedCount: document.getElementById('selectedSegmentsCount'),
      clearAllBtn: document.getElementById('clearAllSegments')
    };

    function getSelectedSegments() {
      return deps.selectedSegments instanceof Set ? deps.selectedSegments : new Set();
    }

    function notifySelectionChange() {
      if (typeof deps.onSelectionChange === 'function') deps.onSelectionChange();
    }

    function buildAvailableSegments() {
      const plays = typeof deps.getPlays === 'function' ? (deps.getPlays() || []) : (deps.plays || []);
      const chunks = typeof deps.getChunks === 'function' ? (deps.getChunks() || []) : (deps.chunks || []);
      const characters = typeof deps.getCharacters === 'function' ? (deps.getCharacters() || []) : (deps.characters || []);
      const playsById = typeof deps.getPlaysById === 'function' ? deps.getPlaysById() : deps.playsById;

      allAvailableSegments = [];

      plays.forEach(p => {
        allAvailableSegments.push({
          type: 'play',
          id: p.play_id,
          label: p.title,
          meta: `${p.genre || 'Unknown'}, ${p.first_performance_year || 'Unknown year'}`,
          searchText: `${p.title} ${p.genre || ''} play`.toLowerCase()
        });
      });

      const genres = [...new Set(plays.map(p => p.genre).filter(Boolean))];
      genres.forEach(g => {
        allAvailableSegments.push({
          type: 'genre',
          id: g,
          label: g,
          meta: 'Genre',
          searchText: `${g} genre`.toLowerCase()
        });
      });

      const acts = new Map();
      chunks.forEach(chunk => {
        const key = `${chunk.play_id}:${chunk.act}`;
        if (acts.has(key)) return;
        const play = playsById && typeof playsById.get === 'function' ? playsById.get(chunk.play_id) : null;
        acts.set(key, {
          type: 'act',
          id: key,
          label: `${play ? play.title : 'Unknown'} - Act ${chunk.act}`,
          meta: 'Act',
          searchText: `${play ? play.title : 'Unknown'} act ${chunk.act}`.toLowerCase()
        });
      });
      allAvailableSegments.push(...acts.values());

      chunks.forEach(chunk => {
        const play = playsById && typeof playsById.get === 'function' ? playsById.get(chunk.play_id) : null;
        const playTitle = play ? play.title : 'Unknown';
        allAvailableSegments.push({
          type: 'scene',
          id: chunk.scene_id,
          label: `${playTitle} - Act ${chunk.act}, Scene ${chunk.scene}`,
          meta: `${chunk.total_words || 0} words`,
          searchText: `${playTitle} act ${chunk.act} scene ${chunk.scene}`.toLowerCase()
        });
      });

      const sortedChars = [...characters].sort(
        (a, b) => (b.total_words_spoken || 0) - (a.total_words_spoken || 0)
      );
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

    function renderAvailableSegments() {
      if (!els.searchInput || !els.typeFilter || !els.availableList) return;

      const selectedSegments = getSelectedSegments();
      const searchTerm = els.searchInput.value.toLowerCase().trim();
      const typeValue = els.typeFilter.value;

      let filtered = allAvailableSegments.filter(seg => {
        if (typeValue !== 'all' && seg.type !== typeValue) return false;
        if (searchTerm && !seg.searchText.includes(searchTerm)) return false;
        const isSelected = Array.from(selectedSegments).some(selected =>
          selected.type === seg.type && String(selected.id) === String(seg.id)
        );
        if (isSelected) return false;
        return true;
      });

      if (filtered.length > 100) filtered = filtered.slice(0, 100);

      if (filtered.length === 0) {
        els.availableList.innerHTML = '<p class="muted" style="text-align: center; padding: 2rem;">No segments found</p>';
        return;
      }

      els.availableList.innerHTML = '';
      filtered.forEach(seg => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.4rem; margin-bottom: 0.25rem; border-bottom: 1px solid var(--border);';
        div.innerHTML = `
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500;">${seg.label}</div>
            <div class="muted" style="font-size: 0.85rem;">${seg.meta}</div>
          </div>
          <button class="add-segment-btn" data-type="${seg.type}" data-id="${seg.id}" data-label="${seg.label}" style="padding: 0.25rem 0.6rem; font-size: 0.85rem; white-space: nowrap;">Add</button>
        `;
        els.availableList.appendChild(div);
      });

      els.availableList.querySelectorAll('.add-segment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const segType = btn.dataset.type;
          let segId = btn.dataset.id;

          if (segType === 'play' || segType === 'character' || segType === 'scene') {
            segId = Number.parseInt(segId, 10);
          }

          selectedSegments.add({
            type: segType,
            id: segId,
            label: btn.dataset.label
          });

          renderAvailableSegments();
          renderSelectedSegments();
          notifySelectionChange();
        });
      });
    }

    function renderSelectedSegments() {
      if (!els.selectedList || !els.selectedCount) return;

      const selectedSegments = getSelectedSegments();
      els.selectedCount.textContent = selectedSegments.size;

      if (selectedSegments.size === 0) {
        els.selectedList.innerHTML = '<p class="muted" style="text-align: center; padding: 2rem;">No segments selected</p>';
        return;
      }

      els.selectedList.innerHTML = '';
      const sortedSegments = Array.from(selectedSegments).sort((a, b) => a.label.localeCompare(b.label));

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
        els.selectedList.appendChild(div);

        const removeBtn = div.querySelector('.remove-segment-btn');
        if (removeBtn) {
          removeBtn.addEventListener('click', () => {
            selectedSegments.delete(seg);
            renderAvailableSegments();
            renderSelectedSegments();
            notifySelectionChange();
          });
        }
      });
    }

    function init() {
      if (initialized) return;
      initialized = true;

      if (els.searchInput) {
        els.searchInput.addEventListener('input', renderAvailableSegments);
      }
      if (els.typeFilter) {
        els.typeFilter.addEventListener('change', renderAvailableSegments);
      }
      if (els.clearAllBtn) {
        els.clearAllBtn.addEventListener('click', () => {
          const selectedSegments = getSelectedSegments();
          selectedSegments.clear();
          renderAvailableSegments();
          renderSelectedSegments();
          notifySelectionChange();
        });
      }

      renderSelectedSegments();
    }

    return {
      init,
      buildAvailableSegments,
      renderAvailableSegments,
      renderSelectedSegments
    };
  }

  window.createNgramsSegmentSelectorController = createNgramsSegmentSelectorController;
})();
