/* =====================================================================
   report-longdist.js  -  Long Distance report (Response Time Report RYK)
   Edit the settings (CONFIG) below, or the rules inside longDistance().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).

   Columns: EC No | Tehsil Name | Call Received at | Response Time (HH:MM:SS) |
            One Side Distance | Victim Name | Gender | Age | Caller Number |
            Emergency Type | Emergency Subtype | Fate Of Patient | Emergency Address
   ===================================================================== */
(function () {
  /* ---- Settings ------------------------------------------------------
       A trip is included when ALL of these are true (each EC No is taken once):
         - the "Long Distance" column of the trips CSV is longDistance ("Yes")
         - Response Time is at least minResponse (HH:MM:SS)
         - One Side Distance is at least minOneSideKm
         - Emergency Type is one of emergencyTypes   ([] = every type)
       One Side Distance = Total Mileage of all vehicles added together, divided by 2
       (rounded to a whole km, 17.5 becomes 18).
       The sheet date is the date of the trips in the CSV.
    ------------------------------------------------------------------ */
  const CONFIG = {
    title1:         "Long Distance Emg",
    title2:         "Response Time Report RYK",
    title3:         "Long Distance Report RYK",       // shown after the date
    longDistance:   "Yes",
    minResponse:    "00:20:00",
    minOneSideKm:   15,
    emergencyTypes: ["Medical Emergency"],
    /* [title on the sheet, CSV column]   "@id" = EC No, "@oneside" = One Side Distance */
    columns: [
      ["EC No", "@id"], ["Tehsil Name", "Tehsil Name"], ["Call Received at", "Call Received at"],
      ["Response Time (HH:MM:SS)", "Response Time (HH:MM:SS)"], ["One Side Distance", "@oneside"],
      ["Victim Name", "Victim Name"], ["Gender", "Gender"], ["Age", "Age"], ["Caller Number", "Caller Number"],
      ["Emergency Type", "Emergency Type"], ["Emergency Subtype", "Emergency Subtype"],
      ["Fate Of Patient", "Fate Of Patient"], ["Emergency Address", "Emergency Address"]
    ],
    flagColumn:     "Long Distance",
    responseColumn: "Response Time (HH:MM:SS)",
    mileageColumn:  "Total Mileage",
    typeColumn:     "Emergency Type"
  };

  const hms = s => { const m = String(s).trim().match(/^(\d+):(\d{2}):(\d{2})/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null; };
  const noPad = s => s.replace(/ 0(\d:)/, ' $1');                                  // 08/10/2026 05:08 -> 08/10/2026 5:08

  function longDistance(rows) {
    const R = CONFIG, { ix, get } = tripGetter(rows), minRT = hms(R.minResponse);
    const need = [R.flagColumn, R.responseColumn, R.mileageColumn];
    const missing = need.filter(h => ix(h) < 0);
    if (missing.length) throw new Error('columns not found in the trips CSV: ' + missing.join(', '));
    const types = R.emergencyTypes.map(norm), seen = new Set(), recs = [];
    for (const r of rows.slice(1)) {
      const ec = get(r, '@id'); if (!ec || seen.has(ec)) continue;
      if (norm(get(r, R.flagColumn)) !== norm(R.longDistance)) continue;
      const rt = hms(get(r, R.responseColumn)); if (rt == null || rt < minRT) continue;
      if (types.length && !types.includes(norm(get(r, R.typeColumn)))) continue;
      const km = (get(r, R.mileageColumn).match(/\d+(\.\d+)?/g) || []).reduce((a, v) => a + Number(v), 0);
      const one = Math.round(km / 2); if (one < R.minOneSideKm) continue;
      seen.add(ec);
      recs.push(R.columns.map(([, src]) => src === '@oneside' ? one : src === 'Call Received at' ? noPad(fmtDT(get(r, src))) : get(r, src)));
    }
    const date = csvDate(rows, ['Call Received at', 'Start Time']), n = R.columns.length, H = R.columns.map(c => c[0]);
    const per = {}; recs.forEach(r => { per[r[1]] = (per[r[1]] || 0) + 1; });
    return {
      name: 'Long Distance ' + date, count: recs.length,
      cards: [['Long distance emergencies', recs.length], ...Object.entries(per)],
      rule: 'Long Distance = ' + R.longDistance + '  |  Response time >= ' + R.minResponse + '  |  One side >= ' + R.minOneSideKm + ' km  |  ' + (R.emergencyTypes.join(' / ') || 'All types'),
      warn: '',
      widths: [62, 90, 112, 92, 72, 120, 62, 48, 104, 100, 112, 96, 240],
      rows: [
        [cl(R.title1, 'font-weight:bold;font-size:14pt;height:28px;', { cs: n })],
        [cl(R.title2, 'font-weight:bold;font-size:11pt;height:22px;', { cs: n })],
        [cl('Date: ' + date + ' ' + R.title3, 'font-weight:bold;font-size:11pt;height:22px;', { cs: n })],
        H.map(h => cl(h, 'font-weight:bold;font-size:9pt;background:#d9d9d9;height:44px;')),
        ...(recs.length ? recs.map(r => r.map(v => cl(v, 'font-size:9pt;height:42px;'))) : [[cl('No matching records found.', '', { cs: n })]])
      ],
      csv: [H, ...recs]
    };
  }

  window.REPORTS.longdist = { label: 'Long Distance', input: 'trips', run: longDistance };
})();
