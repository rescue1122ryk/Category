/* =====================================================================
   report-late.js  -  Late Accept report (vehicle response file)
   Edit the settings (CONFIG) below, or the rules inside lateAccept().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).
   ===================================================================== */
(function () {
  /* ---- Late Accept report (vehicle response file) ------------------
       Included: Acknowledge duration is at least minMinutes.
       A repeated EC No + vehicle pair is shown once.
    ------------------------------------------------------------------ */
  const CONFIG = {
    minMinutes: 5,
    district:   "Rahim Yar Khan",
    title:      "Late Accept emergency by operational staff"
  };

  function lateAccept(rows) {
    const R = CONFIG;
    const H = rows[0].map(h => String(h).trim().toLowerCase()), last = names => { let r = -1; H.forEach((h, i) => { if (names.includes(h)) r = i; }); return r; };
    const c = { ec: last(['emergency no', 'ec no', 'emergency no.']), type: last(['emergency type']), sub: last(['emergency subtype']), veh: last(['vehicle']), station: last(['station name']),
      call: last(['call time']), ack: last(['acknowledge']), disp: last(['dispatch']), resp: last(['response time']), status: last(['status']) };
    if (c.ec < 0 || c.ack < 0) throw new Error('Late Accept file: the "EC No" or "Acknowledge" column was not found.');
    const g = (r, k) => c[k] < 0 ? '' : String(r[c[k]] == null ? '' : r[c[k]]).trim();
    const m0 = rows[1] && c.call >= 0 ? fmtDT(g(rows[1], 'call')).match(/^(\d{2})\/(\d{2})\/(\d{4})/) : null;
    const date = m0 ? m0[1] + '-' + m0[2] + '-' + m0[3] : dmy(new Date()), seen = new Set(), recs = [];
    for (const r of rows.slice(1)) {
      const ec = g(r, 'ec'); if (!ec || ['N/A', 'NOT ASSIGNED'].includes(ec.toUpperCase())) continue;
      const key = ec + '|' + g(r, 'veh'); if (seen.has(key)) continue; seen.add(key);
      const a = ackSecs(g(r, 'ack')); if (a < R.minMinutes * 60) continue;
      const veh = g(r, 'veh').toUpperCase(), p = veh.slice(0, 3), vt = p === 'RYA' ? 'Ambulance' : p === 'RYB' ? 'Bike' : p === 'RYR' ? 'Rescue' : 'Other';
      recs.push([ec, R.district, g(r, 'station'), g(r, 'type'), g(r, 'sub'), vt, veh, g(r, 'ack'), g(r, 'disp'), '0:' + p2(Math.floor(a / 60)) + ':' + p2(a % 60), '', g(r, 'resp'), '', '', '', g(r, 'status')]);
    }
    const HD = ['EC no', 'District Name', 'Tehsil Name', 'Emergency Type', 'Emergency Subtype', 'Dispatched Vehicle Type', 'Dispatched Vehicle', 'Acknowledgement', 'Dispatch', 'Late Accept', 'On Location', 'Response time', 'Remarks by Vehicle Staff', 'Ignition On', 'Trip Start', 'Emergency status'];
    const n = recs.length, G = 'color:#ffffff;font-weight:bold;background:#00b050;';
    const data = recs.map((r, i) => r.map((v, j) => cl(v, 'height:18px;' + (j === 9 ? 'color:#ff0000;' : ''), j === 1 && i === 0 ? { rs: n } : {})).filter((_, j) => j !== 1 || i === 0));
    return {
      name: 'Late Accept ' + date, count: n, cards: [['Late accepts', n], ...countBy(recs, r => r[5])], warn: '',
      rule: 'Acknowledge duration >= ' + R.minMinutes + ' minutes  |  one row per EC No + vehicle',
      widths: [10, 14, 10, 16, 16, 14, 12, 12, 12, 11, 12, 12, 18, 11, 11, 12].map(w => w * 7),
      rows: [[cl(R.title + ', ' + date, G + 'font-size:14pt;', { cs: 16 })], [cl(R.district, G + 'font-size:12pt;', { cs: 16 })],
        [cl('', 'border:none;', { cs: 13 }), cl('Tracker', 'font-weight:bold;background:#b4c6e7;', { cs: 2 })],
        HD.map(x => cl(x, 'font-weight:bold;background:#b4c6e7;height:30px;')), ...(n ? data : [[cl('No matching records found.', '', { cs: 16 })]])],
      csv: [HD, ...recs]
    };
  }

  window.REPORTS.late = {
    label: 'Late Accept', input: 'file', fileLabel: 'Late Accept', hint: 'Late Accept (vehicle response)',
    detect: (rows, H) => H.includes('acknowledge') && (H.includes('emergency no') || H.includes('ec no') || H.includes('emergency no.')),
    run: lateAccept
  };
})();
