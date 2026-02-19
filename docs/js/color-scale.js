// Color scale and highlighting functionality
import { 
  colorScaleEnabled, 
  setColorScaleEnabled,
  highlightEnabled,
  setHighlightEnabled,
  colorScalePalette,
  colorScaleSteps
} from './shared-state.js';
import { parseNumeric, pickTextColorForBg, quantiles } from './utils.js';

export { colorScaleEnabled, highlightEnabled };

export function syncColorScaleToggles() {
  document.querySelectorAll('.color-scale-toggle').forEach(cb => {
    if (cb) cb.checked = colorScaleEnabled;
  });
}

export function syncColorScaleOptions() {
  document.querySelectorAll('.color-scale-palette').forEach(sel => {
    if (sel) sel.value = colorScalePalette;
  });
  document.querySelectorAll('.color-scale-steps').forEach(sel => {
    if (sel) sel.value = String(colorScaleSteps);
  });
}

export function syncHighlightToggles() {
  document.querySelectorAll('.highlight-toggle').forEach(cb => { 
    if (cb) cb.checked = highlightEnabled; 
  });
}

export function clearColorScale(table) {
  if (!table) return;
  table.querySelectorAll('tbody td').forEach(td => {
    td.style.background = '';
    td.style.backgroundColor = '';
    td.style.color = '';
  });
}

export function getPalette(name, steps) {
  steps = parseInt(steps) || 5;
  const clampSteps = (arr) => {
    if (arr.length === steps) return arr;
    // simple resampling by index
    const out = [];
    for (let i = 0; i < steps; i++) {
      const idx = Math.round(i * (arr.length - 1) / (steps - 1));
      out.push(arr[idx]);
    }
    return out;
  };
  if (name === 'blue-diverging') {
    // Ensure white at center and darkest gray at the low end
    const base5 = ['rgb(176, 176, 176)','rgb(209, 209, 209)','rgb(250, 250, 250)','rgb(134, 164, 177)','rgb(0, 63, 92)'];
    const base7 = ['rgb(180,180,180)','rgb(200,200,200)','rgb(220,220,220)','rgb(250,250,250)','rgb(150,175,185)','rgb(110,140,160)','rgb(0,63,92)'];
    return clampSteps(steps === 7 ? base7 : base5);
  } else if (name === 'blue-linear') {
    // Convert to diverging with white center and dark extremes
    const base5 = ['rgb(120,120,120)','rgb(176,176,176)','rgb(250,250,250)','rgb(134,164,177)','rgb(0,63,92)'];
    const base7 = ['rgb(110,110,110)','rgb(150,150,150)','rgb(190,190,190)','rgb(250,250,250)','rgb(160,180,190)','rgb(110,140,160)','rgb(0,63,92)'];
    return clampSteps(steps === 7 ? base7 : base5);
  } else if (name === 'burgundy-gold') {
    // Diverging: dark earthy gold -> white -> dark burgundy
    const base5 = ['rgb(120,100,40)','rgb(190,170,90)','rgb(250,250,250)','rgb(170,110,120)','rgb(139,21,56)'];
    const base7 = ['rgb(110,90,35)','rgb(150,130,60)','rgb(200,180,100)','rgb(250,250,250)','rgb(185,130,135)','rgb(160,90,110)','rgb(139,21,56)'];
    return clampSteps(steps === 7 ? base7 : base5);
  }
  return ['rgb(250,250,250)']; // fallback
}

export function applyColorScale(table) {
  if (!table) return;
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  if (rows.length === 0) return;
  const colCount = (rows[0]?.children?.length) || 0;
  const palette = getPalette(colorScalePalette, colorScaleSteps);
  // For each column, compute min/max of numeric cells
  for (let c = 0; c < colCount; c++) {
    const colTds = rows.map(r => r.children[c]).filter(Boolean);
    const values = [];
    const cells = [];
    for (const td of colTds) {
      // Prefer data-value if present
      const dv = td.getAttribute('data-value');
      const v = dv != null ? parseFloat(dv) : parseNumeric(td.textContent);
      if (Number.isFinite(v)) {
        values.push(v);
        cells.push([td, v]);
      }
    }
    if (values.length < 2) continue; // not a numeric column
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (!(max > min)) continue; // no spread

    // Compute quantile thresholds based on selected steps
    const thresholds = [];
    for (let i = 1; i < palette.length; i++) {
      thresholds.push(i / palette.length);
    }
    const qs = quantiles(values, thresholds);
    for (const [td, v] of cells) {
      let idx = 0;
      while (idx < qs.length && v > qs[idx]) idx++;
      const bg = palette[idx];
      td.style.backgroundColor = bg;
      td.style.color = pickTextColorForBg(bg);
    }
  }
}

export function applyOrClear(tableSel) {
  const table = document.querySelector(tableSel);
  if (colorScaleEnabled) applyColorScale(table);
  else clearColorScale(table);
}

export function applyColorScalesForVisibleTables() {
  // Recompute color scales on visible tables
  applyOrClear('#resultsTable');
  applyOrClear('#ngramComparisonTable');
  applyOrClear('#linesTable');
}

export function renderLegend(container, palette) {
  if (!container) return;
  container.innerHTML = '';
  const steps = palette.length;
  const labels = ['Low', ...Array(steps - 2).fill(''), 'High'];
  for (let i = 0; i < palette.length; i++) {
    const box = document.createElement('div');
    box.className = 'legend-item';
    box.style.backgroundColor = palette[i];
    box.style.color = pickTextColorForBg(palette[i]);
    box.textContent = labels[i];
    container.appendChild(box);
  }
}

export function renderAllLegends() {
  const palette = getPalette(colorScalePalette, colorScaleSteps);
  document.querySelectorAll('.color-scale-legend').forEach(container => {
    renderLegend(container, palette);
  });
}