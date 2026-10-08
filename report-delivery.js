/* =====================================================================
   report-delivery.js  -  Delivery Case report
   Edit the settings (CONFIG) below, or the rules inside deliveryCase().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).
   ===================================================================== */
(function () {
  /* ---- Delivery Case report ----------------------------------------
       Included: Emergency Subtype equals subtype, EC No present, and not a
       Patient Transfer / PTS trip. Duplicate EC No rows are skipped.
       The sheet date is the date of the trips in the CSV.
    ------------------------------------------------------------------ */
  const CONFIG = {
    title:   "Delivery Case Emergencies of District Rahim Yar Khan",
    subtype: "Delivery Case",
    gender:  "Female"
  };

  function deliveryCase(rows) {
    const R = CONFIG;
    const head = rows[0].map(h => h.trim()), ix = n => head.indexOf(n), seen = new Set(), recs = [];
    const missing = ['EC No', 'Emergency Subtype', 'Start Time', 'Age', 'Fate Of Patient', 'Emergency Address'].filter(c => ix(c) < 0);
    for (const r of rows.slice(1)) {
      const g = n => ix(n) < 0 ? '' : String(r[ix(n)] || '').trim();
      const ec = g('EC No'); if (!ec || ec.toUpperCase() === 'NOT ASSIGNED') continue;
      if (g('Emergency Subtype').toLowerCase() !== R.subtype.toLowerCase()) continue;
      const t = g('Emergency Type').toLowerCase(), ct = g('Call Type').toLowerCase(), cat = g('Emergency Category').toLowerCase();
      if (t.includes('patient transfer') || ct.includes('patient transfer') || cat.includes('pts') || t.includes('pts')) continue;
      if (seen.has(ec)) continue; seen.add(ec);
      let fate = g('Fate Of Patient'); const f = fate.toLowerCase();
      fate = f.includes('shifted') ? 'Shifted' : (f.includes('dead') || f.includes('expired')) ? 'Dead' : fate === '' ? 'N/A' : fate;
      recs.push([callTime(g('Start Time') || g('Call Received at')), g('Age'), fate, g('Emergency Address')]);
    }
    const n = recs.length, date = csvDate(rows, ['Start Time', 'Call Received at']), L = 'text-align:left;height:18px;', H = ['Emergency', 'Total Emg.', 'Call Time', 'Total Patients', 'Age', 'Gender', 'F/A Shifted/Dead', 'Location'];
    const data = recs.map((r, i) => i === 0
      ? [cl(R.subtype, 'font-weight:bold;mso-rotate:90;', { rs: n, rot: true }), cl(n, '', { rs: n }), cl(r[0], L), cl(n, '', { rs: n }), cl(r[1], L), cl(R.gender, '', { rs: n }), cl(r[2], L), cl(r[3], L)]
      : [cl(r[0], L), cl(r[1], L), cl(r[2], L), cl(r[3], L)]);
    return {
      name: 'Delivery Case ' + date, count: n, cards: [['Delivery cases', n], ...countBy(recs, r => r[2])],
      rule: 'Subtype: ' + R.subtype + '  |  PTS trips excluded  |  Sheet date = date of the trips in the CSV',
      warn: missing.length ? 'These columns were not found in the CSV: ' + missing.join(', ') : '',
      widths: [12, 10, 18, 12, 8, 10, 14, 55].map(w => w * 7),
      rows: [[cl(R.title, 'border:none;font-weight:bold;font-size:16pt;', { cs: 8 })], [cl('Date: ' + date, 'border:none;font-weight:bold;', { cs: 8 })], [cl('', 'border:none;', { cs: 8 })],
        H.map(c => cl(c, 'background:#c8c8c8;font-weight:bold;')), ...(n ? data : [[cl('No matching records found.', '', { cs: 8 })]])],
      csv: [H, ...recs.map(r => [R.subtype, n, r[0], n, r[1], R.gender, r[2], r[3]])]
    };
  }

  window.REPORTS.delivery = { label: 'Delivery Case', input: 'trips', run: deliveryCase };
})();
