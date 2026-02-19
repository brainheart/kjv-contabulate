// State management, URL handling, and column ordering functionality
import {
  sortKey, sortDir, linesSortKey, linesSortDir,
  segmentsColumnOrder, segmentsColumnDefs,
  ngramsColumnOrder, ngramsColumnDefs,
  segmentsFiltersByGran, linesColumnFilters,
  extraTerms, termDisplayMode, showZeroRows,
  colorScaleEnabled, highlightEnabled,
  appliedDeepLinkState, setAppliedDeepLinkState,
  activeHeaderDrag, sortClickSuppressedUntil,
  setActiveHeaderDrag, setSortClickSuppressedUntil
} from './shared-state.js';
import { gran, q, ngramMode, matchMode } from './dom.js';

export {
  sortKey, sortDir, linesSortKey, linesSortDir,
  segmentsColumnOrder, segmentsColumnDefs,
  ngramsColumnOrder, ngramsColumnDefs
};

export function getSegmentsFiltersMap() {
  const g = (typeof gran !== 'undefined' && gran && gran.value) ? gran.value : 'scene';
  if (!segmentsFiltersByGran.has(g)) segmentsFiltersByGran.set(g, new Map());
  return segmentsFiltersByGran.get(g);
}

export function buildQueryParamsFromState() {
  const p = new URLSearchParams();
  // Only segments are supported for deep links currently
  // Display
  p.set('cs', colorScaleEnabled ? '1' : '0');
  p.set('td', termDisplayMode);
  p.set('zr', showZeroRows ? '1' : '0');
  // palette and steps omitted for cleaner URLs
  p.set('hl', highlightEnabled ? '1' : '0');
  // Segments
  p.set('q', q.value.trim());
  p.set('nm', ngramMode.value);
  p.set('gran', gran.value);
  p.set('mm', matchMode.value);
  const extras = extraTerms.map(t => t.trim()).filter(Boolean);
  if (extras.length) {
    try {
      p.set('qt', encodeURIComponent(JSON.stringify(extras)));
    } catch (e) {
      // fallback to legacy join if JSON stringify fails (shouldn't)
      p.set('qt', extras.join('|'));
    }
  }
  if (sortKey) p.set('sk', sortKey);
  if (sortDir) p.set('sd', sortDir);
  if (segmentsColumnOrder.length) p.set('co', segmentsColumnOrder.join(','));
  // Segment column filters (only for current granularity)
  const segFilters = getSegmentsFiltersMap();
  for (const [key, v] of segFilters.entries()) {
    if (v.type === 'number') {
      const min = (v.min ?? '');
      const max = (v.max ?? '');
      p.set('s_fn_' + key, `${min}~${max}`);
    } else if (v.type === 'text') {
      p.set('s_ft_' + key, v.pattern ?? '');
    }
  }
  return p;
}

export function updateDeepLink() {
  const p = buildQueryParamsFromState();
  const url = location.origin + location.pathname + '?' + p.toString();
  document.querySelectorAll('.deep-link').forEach(a => { a.href = url; a.textContent = url; });
}

export function getActiveTab() {
  const btn = document.querySelector('.tab-btn.active');
  return btn ? btn.dataset.tab : 'segments';
}

export function mapToArray(m) {
  const out = [];
  if (!m) return out;
  for (const [key, v] of m.entries()) {
    const o = { key, type: v.type };
    if (v.type === 'number') { o.min = v.min ?? ''; o.max = v.max ?? ''; }
    if (v.type === 'text') { o.pattern = v.pattern ?? ''; }
    out.push(o);
  }
  return out;
}

export function arrayToMap(arr) {
  const m = new Map();
  if (!Array.isArray(arr)) return m;
  for (const it of arr) {
    if (!it || !it.key) continue;
    if (it.type === 'number') m.set(it.key, { type:'number', min: it.min ?? '', max: it.max ?? '' });
    else if (it.type === 'text') m.set(it.key, { type:'text', pattern: it.pattern ?? '' });
  }
  return m;
}

// Legacy base64 state decoder for backward compatibility
export function decodeState(s) {
  try {
    const b64 = (s || '').replace(/ /g, '+');
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch(e) { return null; }
}

export function decodeExtrasParam(raw) {
  if (!raw) return [];
  // New format: URL-encoded JSON array
  try {
    const decoded = decodeURIComponent(raw);
    const arr = JSON.parse(decoded);
    if (Array.isArray(arr)) return arr;
  } catch(e) { /* fall through to legacy */ }
  // Legacy: pipe-separated string
  return raw.split('|').map(t => t.trim()).filter(Boolean);
}

// Column ordering functions
export function applyColumnOrder(cols, order) {
  if (!Array.isArray(order) || order.length === 0) return cols;
  const byKey = new Map();
  for (const c of cols) byKey.set(c.key, c);
  const ordered = [];
  for (const c of cols) if (byKey.has(c.key)) ordered.push(c);
  return ordered;
}

export function moveKeyBeforeTarget(order, sourceKey, targetKey) {
  const out = Array.isArray(order) ? order.slice() : [];
  const from = out.indexOf(sourceKey);
  const to = out.indexOf(targetKey);
  if (from < 0 || to < 0 || from === to) return out;
  const [moved] = out.splice(from, 1);
  const insertAt = from < to ? to - 1 : to;
  out.splice(insertAt, 0, moved);
  return out;
}

export function clearDragOverClasses(selector) {
  document.querySelectorAll(selector).forEach(el => el.classList.remove('drag-over'));
}

export function wireHeaderDrag(th, opts) {
  const { tableType, selector, onDropReorder } = opts;

  th.draggable = true;
  th.style.cursor = 'grab';
  th.addEventListener('dragstart', (e) => {
    setActiveHeaderDrag({ tableType, key: th.dataset.key });
    setSortClickSuppressedUntil(Date.now() + 400);
    th.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', th.dataset.key);
  });
  th.addEventListener('dragover', (e) => {
    if (!activeHeaderDrag || activeHeaderDrag.tableType !== tableType) return;
    if (activeHeaderDrag.key === th.dataset.key) return;
    e.preventDefault();
    th.classList.add('drag-over');
    e.dataTransfer.dropEffect = 'move';
  });
  th.addEventListener('dragleave', () => th.classList.remove('drag-over'));
  th.addEventListener('drop', (e) => {
    if (!activeHeaderDrag || activeHeaderDrag.tableType !== tableType) return;
    e.preventDefault();
    clearDragOverClasses(selector);
    const sourceKey = activeHeaderDrag.key;
    const targetKey = th.dataset.key;
    if (sourceKey && targetKey && sourceKey !== targetKey) {
      setSortClickSuppressedUntil(Date.now() + 250);
      onDropReorder(sourceKey, targetKey);
    }
  });
  th.addEventListener('dragend', () => {
    clearDragOverClasses(selector);
    th.classList.remove('dragging');
    setActiveHeaderDrag(null);
  });
}