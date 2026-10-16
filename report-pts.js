/* =====================================================================
   report-pts.js  -  PTS Report (Patient Transfer / referral emergencies)
   Edit the settings (CONFIG) below, or the rules inside the functions.
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js and report-xlsx.js (loaded before it in category-checker.html).

   Upload these two Excel files (.xlsx) from the Rescue 1122 referral reports:
     1) IndividualReferralFormDetail  (one line per referral)
     2) VehicleWiseReferralReport     (referrals and mileage per call sign)
   The tab shows the 3 sheets and "Download Excel" saves them as ONE .xlsx file:
     Sheet 1  PTS Reports        - breakup of PTS emergencies by tehsil + brief summary of diagnoses
     Sheet 2  Watch Wise         - morning / evening / night, out of district, victims, call sign totals
     Sheet 3  Out District Report - referrals shifted out of the district
   Without the second file the call sign totals are left out of sheet 2.
   ===================================================================== */
(function () {
  /* ---- Settings ------------------------------------------------------ */
  const CONFIG = {
    district:   "Rahim Yar Khan",            // a referral is "out of district" when Referred District is different
    reasonText: "Non-availability of Specialist Doctor",   // Reason on sheet 3 for every line; "" = use each referral's own reason
    watches:    { morning: [8, 14], evening: [14, 20] },   // hours; everything else is Night (20:00 to 08:00)
    timeColumn: "Referring Date Time",       // time used to decide the watch and shown as Call Time on sheet 3
    /* age bands on sheet 2: [label, from, to] */
    ageBands: [["1Y-10Y", 0, 10], ["11Y-20Y", 11, 20], ["21Y-30Y", 21, 30], ["31Y-40Y", 31, 40], ["41Y-50Y", 41, 50], ["51Y-60Y", 51, 60], ["Above 60Y", 61, 999]],
    /* tehsils in the order they appear: name on sheets, short name, code used on sheet 1, name used on sheet 3 */
    tehsils: [
      { name: "Rahim Yar Khan", short: "RYK", code: "RYK", out: "RYK" },
      { name: "Sadiqabad",      short: "SDK", code: "SDQ", out: "Sadiqabad" },
      { name: "Khanpur",        short: "KPR", code: "KHP", out: "Khanpur" },
      { name: "Liaqatpur",      short: "LQP", code: "LQP", out: "Liaquatpur" }
    ],
    /* Referring Hospital -> tehsil. [text found in the hospital name (lower case), tehsil, name on sheet 1, name on sheet 3]
       The first line that matches is used. */
    hospitals: [
      ["hub & spoke", "Khanpur",        "Hub & spoke",  "Hub & spoke"],
      ["khan bela",   "Liaqatpur",      "RHC Khanbela", "RHC Khanbela"],
      ["sadiq",       "Sadiqabad",      "THQ- SDQ",     "THQ SDQ"],
      ["khanp",       "Khanpur",        "THQ- KHP",     "THQ KHP"],
      ["liaq",        "Liaqatpur",      "THQ- LQP",     "THQ LQP"],
      ["dhq ry",      "Rahim Yar Khan", "DHQ RYK",      "DHQ RYK"]
    ],
    /* Referred Hospital: short name used on sheet 1 (other names are written as they are) */
    referredShort: [["nishtar", "Multan Nishter"], ["dhq ry", "DHQ RY Khan"], ["bahawal victoria", "Bahawal Victoria Hospital"]],
    /* Brief Summary: diagnoses that are written differently but mean the same are counted together.
       Left side = the diagnosis in lower case without anything in brackets; right side = the name shown. */
    diagnosisAliases: {
      "ann": "ANN(asphyxia neonatrum)", "ann grade 3": "ANN(asphyxia neonatrum)",
      "mi": "MI (Myocardial Infarction)", "acute mi": "MI (Myocardial Infarction)", "myocardial infarction": "MI (Myocardial Infarction)",
      "copd": "COPD (Chronic Obstruction Pulmonary Disease)"
    }
  };

  const GREY = 'background:#c0c0c0;', BOLD = 'font-weight:bold;';
  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function when(v) {   // "Oct 14, 2026 05:18:00" or "14/10/2026 05:18" or an Excel date number
    if (typeof v === 'number' && v > 30000) { const d = new Date(Math.round((v - 25569) * 86400) * 1000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() }; }
    const s = clean(v); let m = s.match(/^([A-Za-z]{3})\w*\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (m && m[1].toLowerCase() in MON) return { y: +m[3], mo: MON[m[1].toLowerCase()], d: +m[2], h: +m[4], mi: +m[5] };
    m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\s+(\d{1,2}):(\d{2})/); if (m) return { y: +m[3], mo: +m[2] - 1, d: +m[1], h: +m[4], mi: +m[5] };
    return null;
  }
  const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };

  /* ---- recognise the two files (the title rows above the table are skipped) ---- */
  const headRow = (rows, a, b) => rows.slice(0, 15).findIndex(r => r && r.some(c => clean(c) === a) && r.some(c => clean(c) === b));
  const isInd = rows => headRow(rows, 'Referral No', 'Clinical Diagnosis') >= 0;
  const isVeh = rows => headRow(rows, 'Call Sign', 'Total Referral') >= 0;

  function readInd(rows) {
    const hi = headRow(rows, 'Referral No', 'Clinical Diagnosis'), H = rows[hi], col = n => H.findIndex(c => clean(c) === n);
    const N = { ref: 'Referral No', time: CONFIG.timeColumn, from: 'Referring Hospital', dist: 'Referred District', to: 'Referred Hospital', doc: 'Referring Doctor', why: 'Referral Reason', sex: 'Gender', age: 'Age', dx: 'Clinical Diagnosis', cs: 'Call Sign' }, C = {};
    const miss = []; for (const k in N) { C[k] = col(N[k]); if (C[k] < 0) miss.push(N[k]); }
    if (miss.length) throw new Error('Individual Referral file: columns not found: ' + miss.join(', '));
    const list = [];
    for (const r of rows.slice(hi + 1)) {
      const ref = clean(r[C.ref]); if (!/^\d+$/.test(ref)) continue;
      const o = { ref: +ref, time: r[C.time], from: clean(r[C.from]), dist: clean(r[C.dist]), to: clean(r[C.to]), doc: clean(r[C.doc]), why: clean(r[C.why]), sex: clean(r[C.sex]), age: num(r[C.age]), dx: clean(r[C.dx]), cs: clean(r[C.cs]) };
      o.t = when(o.time); list.push(o);
    }
    let date = ''; for (const r of rows.slice(0, hi)) for (const c of r) { const m = String(c).match(/Report Date\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) date = m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0') + '-' + m[3]; }
    const t0 = (list.find(x => x.t) || {}).t; if (!date && t0) date = String(t0.d).padStart(2, '0') + '-' + String(t0.mo + 1).padStart(2, '0') + '-' + t0.y;
    return { list, date };
  }

  function readVeh(rows) {
    const hi = headRow(rows, 'Call Sign', 'Total Referral'), H = rows[hi], col = n => H.findIndex(c => clean(c) === n);
    const cSr = col('Sr. No'), cCs = col('Call Sign'), cTr = col('Total Referral'), cMi = col('Mileage'), groups = []; let cur = null;
    for (const r of rows.slice(hi + 1)) {
      const a = clean(r[cSr]), cs = clean(r[cCs]);
      if (a && !cs && /\(.+\)$/.test(a)) { cur = { title: a, rows: [] }; groups.push(cur); }
      else if (cur && cs && /^\d+$/.test(a)) cur.rows.push([cs, num(r[cTr]), num(r[cMi])]);
    }
    return { groups };
  }

  /* ---- helpers for the lookups ---- */
  const hosp = n => { const l = n.toLowerCase(); return CONFIG.hospitals.find(h => l.includes(h[0])); };
  const referredShort = n => { const l = n.toLowerCase(), h = CONFIG.referredShort.find(x => l.includes(x[0])); return h ? h[1] : n; };
  const docName = s => clean(s).replace(/^(dr|doctor)\.?\s*/i, 'Dr. ');
  const dxKey = s => clean(s).toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9 +]/g, ' ').replace(/\s+/g, ' ').trim();

  function build(st) {
    const R = CONFIG, ind = st.ind, veh = st.veh;
    if (!ind) return { name: 'PTS Report', count: 0, cards: [['PTS emergencies', 0]], rule: 'Upload IndividualReferralFormDetail (.xlsx) and VehicleWiseReferralReport (.xlsx)', warn: 'Upload the IndividualReferralFormDetail Excel file to build the PTS Report.', widths: [100], rows: [[cl('', '')]], csv: [[]], sheets: [], _pts: st };
    const warns = [], list = ind.list.slice().sort((a, b) => a.ref - b.ref), date = ind.date || '';
    const dd = date.split('-'), short = dd.length === 3 ? dd[0] + '-' + dd[1] + '-' + dd[2].slice(-2) : date;
    // tehsil of every referral (by the Referring Hospital)
    const tehs = R.tehsils.map(t => Object.assign({ rows: [] }, t)), other = { name: 'Other', short: 'OTH', code: 'OTH', out: 'Other', rows: [] };
    for (const x of list) {
      const h = hosp(x.from); x.h1 = h ? h[2] : x.from; x.h3 = h ? h[3] : x.from;
      const t = h && tehs.find(t => t.name === h[1]) || other; x.teh = t; t.rows.push(x);
      x.out = clean(x.dist).toLowerCase() !== R.district.toLowerCase();
    }
    if (other.rows.length) { tehs.push(other); warns.push(other.rows.length + ' referral(s) have a Referring Hospital that is not in the settings (shown as Other): ' + [...new Set(other.rows.map(x => x.from))].join(', ')); }
    const total = list.length, outs = list.filter(x => x.out), nt = tehs.filter(t => t.rows.length || t !== other);

    /* ---------- Sheet 1: PTS Reports ---------- */
    const W1 = [48, 78, 70, 270, 130, 170, 88], s1 = [];
    const hd1 = 'font-weight:bold;font-size:9pt;color:#ffffff;background:#000000;height:30px;';
    s1.push([cl('Breakup of PTS emergencies District ' + R.district + ' ' + short, 'font-weight:bold;font-size:16pt;background:#b4c6e7;height:36px;', { cs: 7 })]);
    s1.push([cl('Total Emergency', BOLD + 'font-size:11pt;', { rs: 2 }), cl(total, BOLD + 'font-size:16pt;', { rs: 2 }), ...nt.map(t => cl(t.short, BOLD + 'font-size:11pt;background:#e7e6e6;height:24px;')), cl('Out of District', BOLD + 'font-size:10pt;background:#e7e6e6;height:24px;')]);
    s1.push([...nt.map(t => cl(t.rows.length, BOLD + 'height:24px;')), cl(outs.length, BOLD + 'height:24px;')]);
    s1.push(['Sr. No.', 'Referral No', '', 'Clinical Diagnosis', 'Referring Hospital', 'Referred Hospital', 'Call Sign'].map(h => cl(h, hd1)));
    let sr = 0; const csv1 = [['Sr No', 'Referral No', 'Tehsil', 'Clinical Diagnosis', 'Referring Hospital', 'Referred Hospital', 'Call Sign']];
    for (const t of tehs) t.rows.forEach((x, i) => {
      sr++; const row = [cl(sr, 'font-size:10pt;'), cl(x.ref, 'font-size:10pt;')];
      if (i === 0) row.push(cl(t.code + '-' + t.rows.length, BOLD + 'font-size:10pt;', { rs: t.rows.length }));
      row.push(cl(x.dx, 'font-size:9pt;'), cl(x.h1, 'font-size:9pt;'), cl(referredShort(x.to), 'font-size:9pt;'), cl(x.cs, 'font-size:9pt;'));
      s1.push(row); csv1.push([sr, x.ref, t.code, x.dx, x.h1, referredShort(x.to), x.cs]);
    });
    // brief summary of the diagnoses
    const groups = new Map();
    for (const x of list) {
      const k = dxKey(x.dx) || '(not written)', lab = R.diagnosisAliases[k] || '', g = groups.get(lab || k) || { n: 0, names: {} };
      g.n++; g.names[x.dx] = (g.names[x.dx] || 0) + 1; groups.set(lab || k, g);
      g.lab = lab;
    }
    const sum = [...groups.entries()].map(([k, g]) => [g.lab || Object.entries(g.names).sort((a, b) => b[1] - a[1])[0][0], g.n]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const per = Math.ceil(sum.length / 3);
    s1.push([cl('Brief Summary', BOLD + 'font-size:12pt;background:#e7e6e6;height:28px;', { cs: 7 })]);
    for (let i = 0; i < per; i++) {
      const a = sum[i], b = sum[i + per], c = sum[i + 2 * per], st = 'font-size:10pt;height:30px;';
      s1.push([cl(a ? a[0] : '', st, { cs: 2 }), cl(a ? a[1] : '', st + BOLD), cl(b ? b[0] : '', st), cl(b ? b[1] : '', st + BOLD), cl(c ? c[0] : '', st), cl(c ? c[1] : '', st + BOLD)]);
    }

    /* ---------- Sheet 2: Watch Wise ---------- */
    const wOf = x => { if (!x.t) return null; const h = x.t.h + x.t.mi / 60; return h >= R.watches.morning[0] && h < R.watches.morning[1] ? 0 : h >= R.watches.evening[0] && h < R.watches.evening[1] ? 1 : 2; };
    const cnt = tehs.map(t => { const c = [0, 0, 0]; t.rows.forEach(x => { const w = wOf(x); if (w != null) c[w]++; else warns.push('Referral ' + x.ref + ': time not found, not counted in the watches.'); }); return c; });
    const colSum = i => cnt.reduce((a, c) => a + c[i], 0);
    const B = BOLD + 'font-size:11pt;', W2 = [130, 100, 70, 70, 70, 70, 70, 84], s2 = [];
    const row5 = (a, c, tot, st) => [cl(a, st || B + 'text-align:left;'), cl(c[0], st || B), cl(c[1], st || B, { cs: 2 }), cl(c[2], st || B), cl(tot, st || B, { cs: 3 })];
    s2.push([cl('Breakup of PTS emergencies District ' + R.district, BOLD + 'font-size:14pt;height:30px;', { cs: 8 })]);
    s2.push([cl('Watch Wise Emergencies        Date: ' + date, BOLD + 'font-size:14pt;height:30px;', { cs: 8 })]);
    s2.push([cl('Tehsil Name', B), cl('Morning', B), cl('Evening', B, { cs: 2 }), cl('Night', B), cl('Total', B, { cs: 3 })]);
    tehs.forEach((t, i) => s2.push(row5(t.name, cnt[i], cnt[i][0] + cnt[i][1] + cnt[i][2])));
    s2.push(row5('Total Emergency', [colSum(0), colSum(1), colSum(2)], colSum(0) + colSum(1) + colSum(2), B + 'background:#e7e6e6;'));
    s2.push([cl('Out of District Shifting', B + 'background:#e7e6e6;', { cs: 8 })]);
    s2.push([cl('Tehsil Name', B + 'text-align:left;'), cl('Total Number of Shifting', B), cl('Referred Hospital Name', B, { cs: 6 })]);
    tehs.forEach(t => {
      const o = t.rows.filter(x => x.out), names = [...new Set(o.map(x => { const h = referredShort(x.to) === x.to ? x.to : x.to; return x.dist && !h.toLowerCase().includes(x.dist.toLowerCase()) ? h + ' ' + x.dist : h; }))];
      s2.push([cl(t.name, B + 'text-align:left;'), cl(o.length, B), cl(names.join(', '), 'font-size:10pt;', { cs: 6 })]);
    });
    s2.push([cl('Total ', B), cl(outs.length, B), cl('', B, { cs: 6 })]);
    const male = list.filter(x => /^m/i.test(x.sex)).length, female = list.filter(x => /^f/i.test(x.sex)).length, bands = R.ageBands.map(b => [b[0], list.filter(x => x.age >= b[1] && x.age <= b[2]).length]);
    const refs = list.map(x => x.ref), lastNight = Math.min(...refs) - 1, tonight = Math.max(...refs);
    const left = { 2: ['Last PT  No. of Lastnight', lastNight], 3: ['Last PT  No. of Tonight', tonight], 4: ['Total Emergency ', total] };
    s2.push([cl('Victims Detail', B + 'text-align:left;'), cl('Total', B), cl('Male', B, { cs: 2 }), cl('Female', B, { cs: 2 }), cl('Age of Victims', B, { cs: 2 })]);
    for (let i = 0; i < 8; i++) {
      const band = i < 7 ? bands[i] : ['Total', bands.reduce((a, b) => a + b[1], 0)], r = [];
      if (i === 0) r.push(cl('', B), cl(total, B), cl(male, B, { cs: 2 }), cl(female, B, { cs: 2 }));
      else if (left[i - 0] && i >= 2 && i <= 4) r.push(cl(left[i][0], B + 'text-align:left;', { cs: 3 }), cl(left[i][1], B, { cs: 2 }), cl('', B));
      else r.push(cl('', B, { cs: 6 }));
      r.push(cl(band[0], B), cl(band[1], B)); s2.push(r);
    }
    if (veh && veh.groups.length) {
      s2.push([cl('Sr. No', B, { cs: 3 }), cl('Call Sign', B, { cs: 2 }), cl('Total Referral', B, { cs: 2 }), cl('Mileage', B)]);
      let gr = 0, gm = 0; const sm = 'font-size:10pt;';
      veh.groups.forEach(g => {
        s2.push([cl(g.title, BOLD + 'font-size:10pt;' + GREY, { cs: 8 })]);
        let r = 0, m = 0; g.rows.forEach((x, i) => { s2.push([cl(i + 1, sm, { cs: 3 }), cl(x[0], sm, { cs: 2 }), cl(x[1], sm, { cs: 2 }), cl(x[2], sm)]); r += x[1]; m += x[2]; });
        s2.push([cl('Total', B, { cs: 5 }), cl(r, B, { cs: 2 }), cl(m, B)]); gr += r; gm += m;
        s2.push([cl('', 'border:0;height:12px;', { cs: 8 })]);
      });
      s2.push([cl('Grand Total', B, { cs: 5 }), cl(gr, B, { cs: 2 }), cl(gm, B)]);
      if (gr !== total) warns.push('Vehicle Wise report total referrals (' + gr + ') is different from the Individual Referral file (' + total + '). Check that both files are for the same day.');
    } else warns.push('VehicleWiseReferralReport (.xlsx) is not uploaded yet: call sign totals and mileage are missing on sheet 2.');

    /* ---------- Sheet 3: Out District Report ---------- */
    const W3 = [46, 80, 140, 84, 64, 200, 120, 160, 280], s3 = [], st3 = 'font-size:11pt;';
    s3.push([cl(' PTS emergencies Out of District  ' + R.district, BOLD + 'font-size:13pt;height:30px;', { cs: 9, rs: 2 })]);
    s3.push([]);   // second line of the merged title
    s3.push([cl('Date: ' + date, 'font-size:12pt;height:26px;', { cs: 9 })]);
    const oc = t => outs.filter(x => x.teh === t).length, tg = tehs.filter(t => t.rows.length || t !== other), sp = t => t.short === 'KPR' ? { cs: 2 } : {};
    const cell = (t, v, s) => cl(v, s, t.short === 'KPR' ? { cs: 2 } : {});
    s3.push([cl('Total out of District', st3, { cs: 3, rs: 2 }), cl(outs.length, BOLD + 'font-size:12pt;', { rs: 2 }), ...[0, 1, 2, 3].map(i => tg[i] ? cell(tg[i], tg[i].out, 'font-size:12pt;background:#e7e6e6;') : cl('', ''))]);
    s3.push([0, 1, 2, 3].map(i => tg[i] ? cell(tg[i], oc(tg[i]), BOLD + 'font-size:12pt;') : cl('', '')));
    s3.push(['Sr.', 'P.T.#', 'Call Time', 'Dr. Name with Designation', 'Nature of Emergency', 'Shift From', 'Shift To', 'Reason'].map((h, i) => cl(h, BOLD + 'font-size:11pt;background:#e7e6e6;height:30px;', i === 3 ? { cs: 2 } : {})));
    outs.forEach((x, i) => {
      const s = 'font-size:11pt;height:34px;';
      s3.push([cl(i + 1, s), cl(x.ref, s), cl(clean(x.time), s), cl(docName(x.doc), s, { cs: 2 }), cl(x.dx, s), cl(x.h3, s), cl(x.to, s), cl(R.reasonText || x.why, s)]);
    });
    if (!outs.length) s3.push([cl('No out of district referrals.', 'height:30px;', { cs: 9 })]);

    const sheets = [{ name: 'PTS Reports', widths: W1, rows: s1 }, { name: 'Watch Wise', widths: W2, rows: s2 }, { name: 'Out District Report', widths: W3, rows: s3 }];
    return {
      name: 'PTS Report ' + date, count: total,
      cards: [['PTS emergencies', total], ...nt.map(t => [t.name, t.rows.length]), ['Out of District', outs.length]],
      rule: '3 sheets from the Individual Referral and Vehicle Wise Referral Excel files  |  Watches: Morning ' + R.watches.morning.join('-') + ', Evening ' + R.watches.evening.join('-') + ', Night = rest  |  Download Excel saves all 3 sheets in one .xlsx',
      warn: [...new Set(warns)].join('   '),
      widths: W1, rows: s1, csv: csv1, sheets, _pts: st
    };
  }

  window.REPORTS.pts = {
    label: 'PTS Report', input: 'file', multi: true, fileLabel: 'PTS Referral Excel', hint: 'PTS Referral (IndividualReferralFormDetail + VehicleWiseReferralReport .xlsx)',
    detect: rows => isInd(rows) || isVeh(rows),
    run: (rows, prev) => {
      const st = Object.assign({}, prev && prev._pts);
      if (isInd(rows)) st.ind = readInd(rows); else st.veh = readVeh(rows);
      return build(st);
    }
  };
})();
