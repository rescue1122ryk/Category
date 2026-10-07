/* =====================================================================
   report-bike.js  -  Motor Bike Late Finish report
   Edit the settings (CONFIG) below, or the rules inside bikeLate().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).
   ===================================================================== */
(function () {
  /* ---- Bike Late Finish report -------------------------------------
       A trip is included when ALL of these are true:
         - Dispatched Vehicles Type is exactly one of vehicleTypes
           (so "ambulance,bike" is NOT included, only pure bike trips)
         - Fate Of Patient equals fate
         - Elapsed Time is greater than or equal to minElapsed
       Duplicate EC No rows are skipped (first one is kept).
    ------------------------------------------------------------------ */
  const CONFIG = {
    title:        "Motor Bike Late Finish Report",   // sheet title; the date is added automatically
    filePrefix:   "Bike Late Finish",                // download name: "<prefix> dd-mm-yyyy"
    vehicleTypes: ["bike", "buddy,bike"],
    fate:         "First Aid",
    minElapsed:   "00:40:00"                         // HH:MM:SS
  };

  const BIKE_COLS = ['EC No', 'Tehsil Name', 'Emergency Type', 'Emergency Subtype', 'Emergency Address', 'Emergency Place', 'Dispatched Vehicles Type',
    'Dispatched Vehicles', 'Total Mileage', 'Start Time', 'End Time', 'Response Time (HH:MM:SS)', 'Elapsed Time (HH:MM:SS)', 'Emergency Status', 'Fate Of Patient'];
  function bikeLate(rows) {
    const R = CONFIG;
    const head = rows[0].map(h => h.trim()), ix = n => head.indexOf(n), missing = BIKE_COLS.filter(c => ix(c) < 0);
    const flat = s => String(s).toLowerCase().replace(/\s+/g, ''), types = R.vehicleTypes.map(flat), min = secs(R.minElapsed), seen = new Set(), recs = [];
    for (const r of rows.slice(1)) {
      const g = n => ix(n) < 0 ? '' : (r[ix(n)] || '').trim();
      if (!types.includes(flat(g('Dispatched Vehicles Type')))) continue;
      if (g('Fate Of Patient').toLowerCase() !== R.fate.toLowerCase()) continue;
      if (secs(g('Elapsed Time (HH:MM:SS)')) < min) continue;
      const ec = g('EC No'); if (seen.has(ec)) continue; seen.add(ec);
      recs.push(BIKE_COLS.map(g));
    }
    const date = dateFrom(recs.length ? recs[0][9] : ''), n = BIKE_COLS.length;
    return {
      name: R.filePrefix + ' ' + date, count: recs.length, cards: [['Late finish trips', recs.length], ...countBy(recs, r => r[1])],
      rule: 'Vehicle type: ' + R.vehicleTypes.join(' / ') + '  |  Fate: ' + R.fate + '  |  Elapsed >= ' + R.minElapsed,
      warn: missing.length ? 'These columns were not found in the CSV: ' + missing.join(', ') : '',
      widths: [7.4, 12.25, 18.1, 19.1, 36.1, 10.6, 11.1, 14, 8, 19, 19, 13, 15, 12, 12].map(w => Math.round(w * 7)),
      rows: [[cl(R.title + ' Date: ' + date, 'font-size:22pt;font-weight:bold;height:36px;', { cs: n })],
        BIKE_COLS.map(c => cl(c, 'background:#008000;color:#ffffff;font-weight:bold;height:50px;')),
        ...(recs.length ? recs.map(r => r.map((v, i) => cl(v, i === 7 || i === 12 ? 'background:#ffff00;' : ''))) : [[cl('No matching records found.', '', { cs: n })]])],
      csv: [BIKE_COLS, ...recs]
    };
  }

  window.REPORTS.bike = { label: 'Bike Late Finish', input: 'trips', run: bikeLate };
})();
