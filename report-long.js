/* =====================================================================
   report-long.js  -  Long Duration report
   Edit the settings (CONFIG) below, or the rules inside longDuration().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).
   ===================================================================== */
(function () {
  /* ---- Long Duration report ----------------------------------------
       Included: Elapsed Time is MORE than minHours and the trip is not a
       Patient Transfer. If you change minHours, change title2 to match.
    ------------------------------------------------------------------ */
  const CONFIG = {
    minHours: 2,
    title1:   "Punjab Emergency Service Rescue 1122, Bahawalpur Division",
    title2:   "Long Duration Emergencies (More than 2 hours)"
  };

  function longDuration(rows) {
    const R = CONFIG;
    const H = rows[0].map(h => h.toLowerCase().trim()), last = f => { let r = -1; H.forEach((h, i) => { if (f(h)) r = i; }); return r; };
    const c = {
      ec: last(h => h.includes('ec no')), dist: last(h => h.includes('district name')), teh: last(h => h.includes('tehsil name')),
      type: last(h => h.includes('emergency type') && !h.includes('subtype')), sub: last(h => h.includes('emergency subtype')), addr: last(h => h.includes('emergency address')),
      veh: last(h => h.includes('vehicle reg no') && !h.includes('response') && !h.includes('acknowledge')), mile: last(h => h.includes('total mileage')),
      call: last(h => h.includes('call received')), start: last(h => h.includes('start time')), end: last(h => h.includes('end time')),
      resp: last(h => h.includes('response time') && h.includes('hh:mm')), elap: last(h => h.includes('elapsed time') && h.includes('hh:mm')),
      fate: last(h => h.includes('fate of patient')), long: last(h => h.includes('long distance'))
    };
    const HD = ['EC No', 'District Name', 'Tehsil Name', 'Emergency Type', 'Emergency Subtype', 'Emergency Address', 'Remarks By Staff', 'Vehicle No', 'Total Mileage', 'Call Received', 'Start Time', 'End Time', 'Response Time', 'Elapsed Time', 'Fate Of Patient', 'Remarks'];
    const base = { name: 'Long Duration Emergencies', count: 0, cards: [], rule: 'Elapsed Time more than ' + R.minHours + ' hours  |  PTS trips excluded', widths: [], csv: [] };
    if (c.ec < 0 || c.elap < 0) return { ...base, warn: 'EC No or Elapsed Time column was not found in the CSV.', rows: [[cl('No data', '')]] };
    const recs = []; let date = '';
    for (const r of rows.slice(1)) {
      const g = k => c[k] < 0 ? '' : String(r[c[k]] || '').trim();
      if (g('type').toLowerCase().includes('patient transfer')) continue;
      const el = g('elap'); if (!el || el.toUpperCase() === 'N/A') continue;
      const s = secs(el); if (s < 0 || s / 3600 <= R.minHours) continue;
      const dm = g('call').match(/\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/); if (!date && dm) date = dateFrom(dm[0]);
      let addr = g('addr'); if (addr.length > 60) addr = addr.slice(0, 57) + '...';
      const rem = g('long').toLowerCase() === 'yes' ? 'Long Distance' : g('type').toLowerCase().includes('rescue operations') ? 'Mass Event / Other' : 'Long Duration';
      recs.push([g('ec'), g('dist'), g('teh'), g('type'), g('sub'), addr, rem, g('veh').split(',')[0].trim(), g('mile').split(',')[0].trim(), g('call'), g('start'), g('end'), g('resp'), el, g('fate'), '']);
    }
    date = date || dmy(new Date());
    const n = HD.length, T = 'color:#ffffff;font-weight:bold;';
    return {
      ...base, name: 'Long Duration Emergencies ' + date, count: recs.length, cards: [['Long duration trips', recs.length], ...countBy(recs, r => r[6])], warn: '',
      widths: [10, 14, 14, 18, 18, 40, 14, 12, 12, 16, 16, 16, 12, 12, 16, 12].map(w => w * 7),
      rows: [[cl(R.title1, T + 'background:#006400;font-size:16pt;height:28px;', { cs: n })], [cl(R.title2 + ' (' + date + ')', T + 'background:#228b22;font-size:12pt;height:22px;', { cs: n })],
        HD.map(h => cl(h, h === 'Remarks By Staff' ? 'background:#ffff00;color:#000000;font-weight:bold;font-size:10pt;height:30px;' : T + 'background:#4472c4;font-size:10pt;height:30px;')),
        ...(recs.length ? recs.map(r => r.map((v, i) => cl(v, 'font-size:9pt;height:35px;' + (i === 5 ? 'text-align:left;' : '') + (i === 6 ? 'background:#fff2cc;' : '')))) : [[cl('No matching records found.', '', { cs: n })]])],
      csv: [HD, ...recs]
    };
  }

  window.REPORTS.long = { label: 'Long Duration', input: 'trips', run: longDuration };
})();
