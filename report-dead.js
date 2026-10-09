/* =====================================================================
   report-dead.js  -  Dead Report (Report of All Dead Victim)
   Edit the settings (CONFIG) below, or the rules inside deadVictim().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).

   Same sheet as the hand-made one: Sr. # | Tehsil | EC No | Nature of Emergency |
   CPR Given | Fate Of Patient | Victim Name | Gender | Age | Time of Incident |
   Response Time | Location | Shifted to hospital | Dispatched Vehicles | Staff
   - Nature of Emergency has 3 lines: Emergency Type, (Subtype) and, in bold,
     the old history of the patient (O/H ..., old history of ...) taken from the
     text fields listed in historyFields.
   - Staff is not in the CSV, so it is left empty to be filled in by hand.
   ===================================================================== */
(function () {
  /* ---- Settings ------------------------------------------------------
       Included: Fate Of Patient contains fate and the trip is not Discarded.
       Time of Incident = Call Received at (24 hour clock).
       columns: [title on the sheet, CSV column]
         "@sr" = serial number, "@nature" = the 3-line Nature of Emergency,
         "@blank" = left empty (data that is not in the CSV)
       The sheet date is the date of the trips in the CSV.
    ------------------------------------------------------------------ */
  const CONFIG = {
    title:         "Rahim Yar Khan Report of All Dead Victim",
    fate:          "Dead",
    historyFields: ["First Aid Given", "Cause Of Emergency", "Suggestion & Comments"],
    rowH:          58,
    columns: [
      ["Sr. #",                    "@sr"],
      ["Tehsil",                   "Tehsil Name"],
      ["EC No",                    "EC No"],
      ["Nature of Emergency",      "@nature"],
      ["CPR Given",                "CPR Given"],
      ["Fate Of Patient",          "Fate Of Patient"],
      ["Victim Name",              "Victim Name"],
      ["Gender",                   "Gender"],
      ["Age",                      "Age"],
      ["Time of Incident",         "Call Received at"],
      ["Response Time (HH:MM:SS)", "Response Time (HH:MM:SS)"],
      ["Location",                 "Emergency Address"],
      ["Shifted to hospital",      "Shifted to hospital"],
      ["Dispatched Vehicles",      "Dispatched Vehicles"],
      ["Staff",                    "@blank"]
    ]
  };

  const noPad = s => s.replace(/ 0(\d:)/, ' $1');                      // 08/10/2026 02:55 -> 08/10/2026 2:55
  const HIST = /\(?\s*(?:o\/h|o\.h\.?|old\s+history)\b[^()\n\/]*\)?/i;   // "(O/H CVA)", "old history of TB", "o/h heart patient"

  function deadVictim(rows) {
    const R = CONFIG, { ix, get } = tripGetter(rows);
    const missing = R.columns.map(c => c[1]).filter(s => !s.startsWith('@') && ix(s) < 0);
    const hist = r => { for (const f of R.historyFields) { const m = get(r, f).match(HIST); if (m) return m[0].replace(/\s+/g, ' ').trim(); } return ''; };
    const n = R.columns.length, H = R.columns.map(c => c[0]), seen = new Set(), body = [], csv = [H], per = {};
    for (const r of rows.slice(1)) {
      const ec = get(r, '@id'); if (!ec) continue;
      if (!get(r, R.columns.find(c => c[1] === 'Fate Of Patient')[1]).toLowerCase().includes(R.fate.toLowerCase())) continue;
      if (get(r, 'Emergency Status').toLowerCase() === 'discarded') continue;
      const key = ec + '|' + get(r, 'Victim Name') + '|' + get(r, 'Age'); if (seen.has(key)) continue; seen.add(key);
      const sr = body.length + 1, typ = get(r, CFG.columns.type), sub = get(r, CFG.columns.subtype), h = hist(r);
      const nat = typ + (sub ? ' (' + sub + ')' : '') + (h ? ' ' + h : '');
      const natH = esc(typ) + (sub ? '<br>(' + esc(sub) + ')' : '') + (h ? '<br><b style="font-size:10pt">' + esc(h) + '</b>' : '');
      const vals = R.columns.map(([, s]) => s === '@sr' ? sr : s === '@nature' ? nat : s === '@blank' ? '' :
        s === 'Call Received at' ? noPad(fmtDT(get(r, s))) : s === 'Response Time (HH:MM:SS)' ? get(r, s).replace(/^0(\d):/, '$1:') : get(r, s));
      body.push(R.columns.map(([, s], i) => s === '@nature' ? cl(nat, 'font-size:9pt;', { h: natH }) : cl(vals[i], 'font-size:9pt;' + (s === 'Emergency Address' ? '' : ''))));
      csv.push(vals); const t = get(r, 'Tehsil Name'); per[t] = (per[t] || 0) + 1;
    }
    const date = csvDate(rows, ['Call Received at', 'Start Time']);
    const rowH = 'height:' + R.rowH + 'px;';
    return {
      name: 'Dead Victim Report ' + date, count: body.length,
      cards: [['Dead victims', body.length], ...Object.entries(per)],
      rule: 'Fate Of Patient: ' + R.fate + '  |  Discarded trips excluded  |  Time of Incident = Call Received at  |  Staff is left empty',
      warn: missing.length ? 'These columns were not found in the CSV: ' + missing.join(', ') : '',
      widths: [38, 72, 62, 175, 54, 58, 84, 58, 50, 110, 84, 160, 112, 92, 130],
      rows: [
        [cl(R.title, 'font-weight:bold;font-size:16pt;height:30px;', { cs: n })],
        [cl('Date: ' + date, 'font-weight:bold;font-size:12pt;height:26px;', { cs: n })],
        H.map(h => cl(h, 'font-weight:bold;font-size:9pt;background:#d9d9d9;height:46px;')),
        ...(body.length ? body.map(row => row.map(c => Object.assign(c, { s: c.s + rowH }))) : [[cl('No matching records found.', '', { cs: n })]])
      ],
      csv
    };
  }

  window.REPORTS.dead = { label: 'Dead Report', input: 'trips', run: deadVictim };
})();
