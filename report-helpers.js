/* =====================================================================
   report-helpers.js  -  Small shared functions used by the report files
   (date / time helpers, column lookup, the table builder for the trip lists).
   You normally do NOT need to edit this file. Load it before the report-*.js files.
   ===================================================================== */
const CFG = window.CATEGORY_CONFIG;
window.REPORTS = window.REPORTS || {};   // every report file registers itself here

const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '');

const p2 = v => String(v).padStart(2, '0');

const dmy = d => p2(d.getDate()) + '-' + p2(d.getMonth() + 1) + '-' + d.getFullYear();

function dateFrom(s) { const m = String(s || '').match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/); return m ? p2(m[3]) + '-' + p2(m[2]) + '-' + m[1] : dmy(new Date()); }

const cl = (v, s, o) => Object.assign({ v, s: s || '' }, o || {});

const countBy = (a, f) => { const m = {}; a.forEach(x => { const k = f(x); m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((x, y) => y[1] - x[1]); };

function secs(t) { const m = String(t || '').trim().match(/^(\d+):(\d{2}):(\d{2})$/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : -1; }

function callTime(s) {
  const m = String(s).match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})[ T]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i);
  if (!m) return s;
  let h = +m[4]; const ap = (m[6] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
  return p2(m[3]) + '/' + p2(m[2]) + '/' + m[1] + ' ' + h + ':' + m[5];
}

function durSecs(d) {
  let t = String(d || '').toLowerCase().trim(), h = 0, m = 0, s = 0, p;
  if ((p = t.indexOf('h')) >= 0) { h = parseFloat(t.slice(0, p)) || 0; t = t.slice(p + 1); }
  if ((p = t.indexOf('m')) >= 0) { m = parseFloat(t.slice(0, p)) || 0; t = t.slice(p + 1); }
  if ((p = t.indexOf('s')) >= 0) s = parseFloat(t.slice(0, p)) || 0;
  const tot = h * 3600 + m * 60 + s;
  return tot > 0 ? tot : Math.max(0, secs(d));
}

function fmtDT(v) {
  const s = String(v == null ? '' : v).trim();
  const m = s.match(/^(?:(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})|(\d{1,2})[\/-](\d{1,2})[\/-](\d{4}))(?:[ T]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?)?/i);
  if (!m) return s;
  const y = m[1] || m[6], mo = m[1] ? m[2] : m[5], d = m[1] ? m[3] : m[4];
  let out = p2(d) + '/' + p2(mo) + '/' + y;
  if (m[7]) { let h = +m[7]; const ap = (m[9] || '').toUpperCase(); if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0; out += ' ' + p2(h) + ':' + m[8]; }
  return out;
}

function ackSecs(s) {
  s = String(s || '').toLowerCase().trim(); if (!s || s === 'n/a') return 0;
  let t = 0, m;
  if ((m = s.match(/(\d+)\s*h/))) t += +m[1] * 3600;
  if ((m = s.match(/(\d+)\s*m/))) t += +m[1] * 60;
  if ((m = s.match(/(\d+)\s*s/))) t += +m[1];
  if (t === 0 && s !== '' && !isNaN(s)) t = Math.round(+s);
  if (t === 0) t = Math.max(0, secs(s));
  return t;
}

function fmtTime12(s) {
  const m = String(s).match(/(\d{1,2}):(\d{2}):(\d{2})\s*([AP]M)?/i); if (!m) return s;
  let h = +m[1], ap = (m[4] || '').toUpperCase();
  if (!ap) { ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; }
  return h + ':' + m[2] + ':' + m[3] + ' ' + ap;
}

function colIx(head, name) { const n = String(name).trim().toLowerCase(); return head.map(x => String(x).trim().toLowerCase()).indexOf(n); }

const yday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d; };

const fate3 = f => { const l = String(f).toLowerCase(); return l.includes('shifted') ? 'Shifted' : (l.includes('dead') || l.includes('expired')) ? 'Dead' : f === '' ? 'N/A' : f; };

function tripGetter(rows) {
  const head = rows[0].map(h => String(h).trim()), alias = { '@agent': CFG.columns.agent, '@id': CFG.columns.id };
  const ix = n => colIx(head, alias[n] || n);
  const get = (r, n) => { const i = ix(n); return i < 0 ? '' : String(r[i] == null ? '' : r[i]).trim(); };
  return { ix, get };
}

function tripList(rows, R, o) {
  const { ix, get } = tripGetter(rows), C = CFG.columns, cols = R.columns, left = R.leftCols || [];
  const missing = cols.map(c => c[1]).filter(h => h !== '@nature' && ix(h) < 0);
  const val = (r, h) => h === '@nature' ? get(r, C.subtype) + (get(r, C.type) ? ' (' + get(r, C.type) + ')' : '') : h === 'Fate Of Patient' ? fate3(get(r, h)) : get(r, h);
  const seen = new Set(), recs = [];
  for (const r of rows.slice(1)) {
    const ec = get(r, '@id'); if (!ec || ec.toUpperCase() === 'NOT ASSIGNED') continue;
    if (!o.keep(get, r)) continue;
    if (seen.has(ec)) continue; seen.add(ec);
    recs.push(cols.map(c => val(r, c[1])));
  }
  const date = dmy(yday()), HD = (o.sr ? ['Sr. #'] : []).concat(cols.map(c => c[0])), n = HD.length, off = o.sr ? 1 : 0;
  const body = recs.map((v, i) => (o.sr ? [i + 1, ...v] : v).map((x, j) => cl(x, 'height:' + (o.rowH || 22) + 'px;' + (left.includes(j - off) ? 'text-align:left;padding-left:12px;' : ''))));
  return {
    name: o.file + ' ' + date, count: recs.length, cards: [[o.card, recs.length], ...countBy(recs, r => r[0])], rule: o.rule,
    warn: missing.length ? 'These columns were not found in the CSV: ' + missing.join(', ') : '',
    widths: HD.map((h, j) => j === 0 && o.sr ? 50 : left.includes(j - off) ? 260 : 125),
    rows: [[cl(R.title, o.titleStyle, { cs: n })], [cl('Date: ' + date, 'border:none;text-align:right;font-weight:bold;font-size:14pt;', { cs: n })],
      HD.map(h => cl(h, 'font-weight:bold;background:#d0cece;height:38px;')), ...(recs.length ? body : [[cl('No matching records found.', '', { cs: n })]])],
    csv: [HD, ...recs.map((v, i) => o.sr ? [i + 1, ...v] : v)]
  };
}
