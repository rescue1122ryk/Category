/* =====================================================================
   report-jco.js  -  JCO Emg Count (monthly report, month files read from GitHub)
   Edit the settings (COUNT and GITHUB) below, or the JCO code. Also holds the "Slim files for JCO" button code.
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).
   ===================================================================== */
(function () {
  /* ---- JCO Emg Count (monthly report, month files read from GitHub) --
       Counted per call agent ("Agent Name"): EC No assigned, each EC No once,
       and the trip types in excludeTypes are left out.
       callTypes: [] = every call type. To copy the old macro use
                  ["App Call", "EMDS Call"].
    ------------------------------------------------------------------ */
  const COUNT = {
    excludeTypes: ["Patient Transfer Service"],
    callTypes:    []
  };

  /* ---- GitHub (where the monthly CSV files are kept) ---------------
       Put one trips CSV per month inside the folder below, in the repo
       (any file name is fine, e.g. "January 2026.csv"). The JCO tab lists
       them and reads them directly. The month is taken from the dates
       inside the file. No token is needed (the repo must be public).
    ------------------------------------------------------------------ */
  const GITHUB = {
    owner:  "rescue1122ryk",
    repo:   "Category",
    branch: "main",
    folder: "jco-data"
  };

  const JC = { files: [], local: null, cache: {}, sel: '', agent: '', day: '', loaded: false, data: null, recs: [] };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const ymLabel = ym => { const [y, m] = ym.split('-'); return MONTHS[+m - 1] + ' ' + y; };
  const ymd = d => d.split('-').reverse().join('-');
  const isoDT = s => {
    const m = String(s || '').match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?)?/i);
    if (!m) return '';
    let h = +(m[4] || 0); const ap = (m[6] || '').toUpperCase(); if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
    return m[1] + '-' + p2(m[2]) + '-' + p2(m[3]) + ' ' + p2(h) + ':' + (m[5] || '00');
  };
  function jcoSlim(rows) {
    const head = rows[0].map(h => String(h).trim()), C = CFG.columns, I = n => colIx(head, n);
    const ix = [C.id, I(C.agent) >= 0 ? C.agent : 'Agent Name', C.agentId || 'Agent Id', C.type, C.subtype, 'Call Type', C.received, C.tehsil].map(I);
    if ([0, 1, 3, 6].some(k => ix[k] < 0)) return null;
    const all = rows.slice(1).map(r => ix.map((i, k) => k === 6 ? isoDT(r[i]) : i < 0 ? '' : String(r[i] == null ? '' : r[i]).trim())).filter(r => r[6]), cnt = {};
    all.forEach(r => { const m = r[6].slice(0, 7); cnt[m] = (cnt[m] || 0) + 1; });
    const month = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; if (!month) return null;
    return { v: 1, month, saved: new Date().toISOString(), cols: ['ec', 'agent', 'agentId', 'type', 'subtype', 'call', 'recv', 'tehsil'], rows: all.filter(r => r[6].startsWith(month)) };
  }
  function jcoRecs(d) {
    const R = COUNT;
    const ex = [...R.excludeTypes, ...(CFG.skipEmergencyTypes || [])].map(norm), ct = (R.callTypes || []).map(norm), seen = new Set(), out = [];
    for (const [ec, agent, agentId, type, sub, call, recv, teh] of d.rows) {
      const tn = norm(type);
      if (!ec || norm(ec) === 'notassigned' || seen.has(ec)) continue;
      if (ex.includes(tn) || tn === 'pts' || tn.includes('patienttransfer')) continue;
      if (ct.length && !ct.includes(norm(call))) continue;
      seen.add(ec); out.push({ ec, agent, type, sub, call, teh, date: recv.slice(0, 10), time: recv.slice(11) });
    }
    return out;
  }
  const isMed = t => norm(t) === 'medicalemergency', isRta = t => /roadcrash|rta|rtc/.test(norm(t));
  const chip = t => `<span class="chip ${isMed(t) ? 'm' : isRta(t) ? 'r' : ''}">${esc(t)}</span>`;

  /* ---- GitHub access: the monthly CSV files are put by hand in the repo folder ---- */
  function ghCfg() { return GITHUB; }
  const encPath = p => p.split('/').map(encodeURIComponent).join('/');
  async function jcoList() {
    const c = ghCfg(); if (!c.owner || !c.repo) throw new Error('owner / repo are empty in reports-config.js (github block)');
    const r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}/contents/${encPath(c.folder)}?ref=${encodeURIComponent(c.branch)}`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (r.status === 404) return [];
    if (!r.ok) throw new Error('GitHub says ' + r.status + (r.status === 403 ? ' (too many requests, try again after a while)' : ''));
    return (await r.json()).filter(f => f.type === 'file' && /\.csv$/i.test(f.name)).map(f => ({ name: f.name, size: f.size }));
  }
  async function jcoFetch(name) {
    const c = ghCfg(), path = encPath(c.folder + '/' + name);
    if (/^https?:/.test(location.protocol)) { try { const r = await fetch(path + '?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) return r.text(); } catch (e) { } }
    const r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}?ref=${encodeURIComponent(c.branch)}`, { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' });
    if (!r.ok) throw new Error('GitHub says ' + r.status); return r.text();
  }
  function fileKey(n) {
    const s = n.replace(/\.csv$/i, ''), m = s.match(/(20\d{2})[-_ .]?(0[1-9]|1[0-2])(?!\d)/); if (m) return m[1] + m[2];
    const y = (s.match(/20\d{2}/) || [''])[0], mi = MONTHS.findIndex(x => s.toLowerCase().includes(x.slice(0, 3).toLowerCase()));
    return y && mi >= 0 ? y + p2(mi + 1) : '';
  }

  /* ---- screen ---- */
  function fillFiles() {
    const opts = JC.files.map(f => [f.name, f.name.replace(/\.csv$/i, '')]);
    if (JC.local) opts.unshift(['@local', 'Loaded file: ' + JC.local.file + ' (' + ymLabel(JC.local.month) + ')']);
    if (!opts.some(o => o[0] === JC.sel)) JC.sel = opts[0] ? opts[0][0] : '';
    $('jMonth').innerHTML = opts.length ? opts.map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join('') : '<option value="">No month yet</option>';
    $('jMonth').value = JC.sel;
  }
  async function renderJco() {
    const msg = t => $('jMsg').textContent = t;
    if (!JC.loaded) {
      JC.loaded = true; msg('Reading the month files ...');
      try {
        JC.files = (await jcoList()).sort((a, b) => fileKey(b.name).localeCompare(fileKey(a.name)) || a.name.localeCompare(b.name));
        msg(JC.files.length ? '' : 'No CSV file found in the "' + ghCfg().folder + '" folder yet. Put the monthly CSV files there.');
      } catch (e) { JC.files = []; JC.loaded = false; msg('Could not read the month list: ' + e.message); }
    }
    fillFiles(); await jcoPick();
  }
  async function jcoPick() {
    const msg = t => $('jMsg').textContent = t, k = JC.sel, clear = () => { JC.data = null; JC.recs = []; $('jAgent').innerHTML = ''; jcoDraw(); };
    if (!k) return clear();
    let d = k === '@local' ? JC.local : JC.cache[k];
    if (!d) {
      msg('Loading ' + k + ' ...');
      try { d = jcoSlim(parseCSV(await jcoFetch(k))); if (!d) throw new Error('this is not the emergency trips report (columns not found)'); JC.cache[k] = d; msg(''); }
      catch (e) { if (k === JC.sel) { clear(); msg('Could not load ' + k + ': ' + e.message); } return; }
    }
    if (k !== JC.sel) return;
    JC.data = d; JC.recs = jcoRecs(d);
    const ag = countBy(JC.recs, r => r.agent || '(no name)').sort((a, b) => a[0].localeCompare(b[0]));
    if (JC.agent && !ag.some(a => a[0] === JC.agent)) JC.agent = '';
    $('jAgent').innerHTML = `<option value="">All call agents (${JC.recs.length})</option>` + ag.map(([a, n]) => `<option value="${esc(a)}">${esc(a)} (${n})</option>`).join('');
    $('jAgent').value = JC.agent; jcoDraw();
  }
  function jcoRows() { return JC.agent ? JC.recs.filter(r => r.agent === JC.agent) : JC.recs; }
  function jcoDraw() {
    const ym = JC.data ? JC.data.month : '';
    if (!ym) { $('jSum').innerHTML = ''; $('jCal').innerHTML = '<span class="mu">No data.</span>'; $('jDay').innerHTML = ''; $('jDayT').textContent = 'Click a date to see its emergencies'; return; }
    const rs = jcoRows(), byT = countBy(rs, r => r.type), days = Object.fromEntries(countBy(rs, r => r.date)), dayList = Object.entries(days).sort((a, b) => b[1] - a[1]);
    const ord = [...byT.filter(([t]) => isMed(t)), ...byT.filter(([t]) => isRta(t)), ...byT.filter(([t]) => !isMed(t) && !isRta(t))];
    const cardH = (v, l, c) => `<div class="card s2" style="--c:${c}"><b>${v}</b><span>${esc(l)}</span></div>`;
    $('jSum').innerHTML = cardH(rs.length, (JC.agent || 'All call agents') + ' \u2013 total emergencies (' + ymLabel(ym) + ')', 'var(--ac)') +
      ord.map(([t, n]) => cardH(n, isRta(t) ? t + ' (RTC)' : t, isMed(t) ? 'var(--ok)' : isRta(t) ? 'var(--bad)' : 'var(--warn)')).join('') +
      cardH(dayList.length, 'Days with emergencies', 'var(--mu)') + cardH(dayList.length ? dayList[0][1] : 0, dayList.length ? 'Busiest day: ' + ymd(dayList[0][0]) : 'Busiest day', 'var(--mu)');
    const [y, m] = ym.split('-').map(Number), first = (new Date(y, m - 1, 1).getDay() + 6) % 7, n = new Date(y, m, 0).getDate(), max = Math.max(1, ...Object.values(days));
    if (!JC.day.startsWith(ym)) JC.day = '';
    let cal = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => `<div class="wd">${x}</div>`).join('') + '<div class="cd e"></div>'.repeat(first);
    for (let i = 1; i <= n; i++) {
      const k = ym + '-' + p2(i), c = days[k] || 0;
      cal += `<button class="cd ${c ? '' : 'z'} ${JC.day === k ? 'on' : ''}" data-d="${k}" style="--i:${(c / max).toFixed(2)}"><b>${i}</b><span>${c}</span></button>`;
    }
    $('jCal').innerHTML = `<div class="cal">${cal}</div>`;
    if (!JC.day) { $('jDayT').textContent = 'Click a date to see its emergencies'; $('jDay').innerHTML = ''; return; }
    const dl = rs.filter(r => r.date === JC.day).sort((a, b) => a.time.localeCompare(b.time)), all = !JC.agent;
    $('jDayT').textContent = ymd(JC.day) + ' \u2013 ' + dl.length + ' emergenc' + (dl.length === 1 ? 'y' : 'ies');
    $('jDay').innerHTML = dl.length ? `<table class="dl"><thead><tr><th>#</th><th>EC No</th><th>Type</th><th>Subtype</th><th>Time</th><th>Call type</th>${all ? '<th>Call agent</th>' : ''}</tr></thead><tbody>` +
      dl.map((r, i) => `<tr><td class="mu">${i + 1}</td><td><b>${ecHTML(r.ec)}</b></td><td>${chip(r.type)}</td><td>${esc(r.sub)}</td><td>${esc(r.time)}</td><td class="mu">${esc(r.call)}</td>${all ? `<td>${esc(r.agent)}</td>` : ''}</tr>`).join('') + '</tbody></table>' : '<p class="mu" style="padding:12px">No emergencies on this date.</p>';
  }

  /* ---- slim CSV: keeps only the columns the JCO report needs (no victim / caller details) ---- */
  function slimCSV(rows) {
    const d = jcoSlim(rows); if (!d) return null;
    const head = rows[0].map(h => String(h).trim()), C = CFG.columns, I = n => colIx(head, n);
    const H = [C.id, I(C.agent) >= 0 ? C.agent : 'Agent Name', C.agentId || 'Agent Id', 'Call Type', C.type, C.subtype, C.received, C.tehsil], ix = H.map(I);
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"', lines = [H.map(q).join(',')];
    for (const r of rows.slice(1)) lines.push(ix.map(i => i < 0 ? '' : q(r[i])).join(','));
    return { month: d.month, count: lines.length - 1, text: '\ufeff' + lines.join('\r\n') };
  }


  /* ---- buttons and clicks of the JCO tab (started once by category-checker.html) ---- */
  function jcoInit() {
    $('jMonth').onchange = () => { JC.sel = $('jMonth').value; JC.day = ''; jcoPick(); };
    $('jAgent').onchange = () => { JC.agent = $('jAgent').value; jcoDraw(); };
    $('jRef').onclick = () => { JC.loaded = false; JC.cache = {}; renderJco(); };
    $('jCsv').onclick = () => {
      const rs = jcoRows(), q = ['EC No', 'Date', 'Time', 'Emergency Type', 'Emergency Subtype', 'Call Type', 'Tehsil', 'Call Agent'];
      download('JCO ' + (JC.agent || 'All agents') + ' ' + (JC.data ? JC.data.month : '') + '.csv', repCSV({ csv: [q, ...rs.map(r => [r.ec, ymd(r.date), r.time, r.type, r.sub, r.call, r.teh, r.agent])] }));
    };
    $('tabJco').addEventListener('click', e => { const b = e.target.closest('.cd[data-d]'); if (b) { JC.day = b.dataset.d; jcoDraw(); } });
    $('openJco').onclick = e => { e.stopPropagation(); afterLoad('jco'); };
    $('slimBtn').onclick = e => { e.stopPropagation(); $('slimFile').click(); };
    $('slimFile').onchange = async e => {
      const fs = [...e.target.files], ok = [], bad = []; e.target.value = ''; const m = $('slimMsg');
      for (const f of fs) {
        m.textContent = 'Working on ' + f.name + ' ...'; await new Promise(r => setTimeout(r, 30));
        try {
          const s = slimCSV(parseCSV(await f.text())); if (!s) throw new Error('not the emergency trips report');
          download('Slim ' + ymLabel(s.month) + '.csv', s.text); ok.push(ymLabel(s.month) + ' (' + s.count + ' rows)');
          await new Promise(r => setTimeout(r, 600));
        } catch (err) { bad.push(f.name + ': ' + err.message); }
      }
      m.textContent = (ok.length ? '\u2713 Slim files downloaded: ' + ok.join(', ') + '. ' : '') + (bad.length ? 'Skipped: ' + bad.join('; ') : '');
    };
  }

  window.REPORTS.jco = { label: 'JCO Emg Count', own: true, alwaysOn: true, render: renderJco, init: jcoInit,
    reset: () => { JC.agent = ''; JC.day = ''; },   // filters are cleared when you move to another report
  onTrips: (rows, name) => { JC.local = jcoSlim(rows); if (JC.local) JC.local.file = name; }   // called when a trips CSV is loaded
  };
})();
