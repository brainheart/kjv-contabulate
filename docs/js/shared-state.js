// Shared mutable state across modules

// Extra terms for comparison
export let extraTerms = [];
export function setExtraTerms(terms) {
  extraTerms = terms;
}

// Term display mode and zero rows toggle
export let termDisplayMode = 'both';
export let showZeroRows = false;
export function setTermDisplayMode(mode) {
  termDisplayMode = mode;
}
export function setShowZeroRows(show) {
  showZeroRows = show;
}

// Color scale and highlight settings
export let colorScaleEnabled = true;
export let highlightEnabled = true;
export let colorScalePalette = 'blue-diverging';
export let colorScaleSteps = 7;
export function setColorScaleEnabled(enabled) {
  colorScaleEnabled = enabled;
}
export function setHighlightEnabled(enabled) {
  highlightEnabled = enabled;
}
export function setColorScalePalette(palette) {
  colorScalePalette = palette;
}
export function setColorScaleSteps(steps) {
  colorScaleSteps = steps;
}

// Sort state
export let sortKey = '';
export let sortDir = '';
export let linesSortKey = '';
export let linesSortDir = '';
export function setSortKey(key) {
  sortKey = key;
}
export function setSortDir(dir) {
  sortDir = dir;
}
export function setLinesSortKey(key) {
  linesSortKey = key;
}
export function setLinesSortDir(dir) {
  linesSortDir = dir;
}

// Column order
export let segmentsColumnOrder = [];
export let segmentsColumnDefs = [];
export let ngramsColumnOrder = [];
export let ngramsColumnDefs = [];
export function setSegmentsColumnOrder(order) {
  segmentsColumnOrder = order;
}
export function setSegmentsColumnDefs(defs) {
  segmentsColumnDefs = defs;
}
export function setNgramsColumnOrder(order) {
  ngramsColumnOrder = order;
}
export function setNgramsColumnDefs(defs) {
  ngramsColumnDefs = defs;
}

// Column filters maps
export const segmentsFiltersByGran = new Map(); // gran -> Map(columnKey -> filter)
export const linesColumnFilters = new Map();

// Pagination state
export let segmentsCurrentPage = 1;
export let segmentsPageSize = 50;
export let segmentsAllRows = [];
export let lastSegmentsBaseRows = [];
export function setSegmentsCurrentPage(page) {
  segmentsCurrentPage = page;
}
export function setSegmentsPageSize(size) {
  segmentsPageSize = size;
}
export function setSegmentsAllRows(rows) {
  segmentsAllRows = rows;
}
export function setLastSegmentsBaseRows(rows) {
  lastSegmentsBaseRows = rows;
}

// Lines pagination state
export let linesCurrentPage = 1;
export let linesPageSize = 50;
export let linesAllRows = [];
export function setLinesCurrentPage(page) {
  linesCurrentPage = page;
}
export function setLinesPageSize(size) {
  linesPageSize = size;
}
export function setLinesAllRows(rows) {
  linesAllRows = rows;
}

// N-grams pagination state
export let ngramCurrentPage = 1;
export let ngramPageSize = 50;
export let ngramAllRows = [];
export function setNgramCurrentPage(page) {
  ngramCurrentPage = page;
}
export function setNgramPageSize(size) {
  ngramPageSize = size;
}
export function setNgramAllRows(rows) {
  ngramAllRows = rows;
}

// Header drag state
export let activeHeaderDrag = null;
export let sortClickSuppressedUntil = 0;
export function setActiveHeaderDrag(drag) {
  activeHeaderDrag = drag;
}
export function setSortClickSuppressedUntil(time) {
  sortClickSuppressedUntil = time;
}

// Deep link state
export let appliedDeepLinkState = false;
export function setAppliedDeepLinkState(applied) {
  appliedDeepLinkState = applied;
}