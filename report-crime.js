/* =====================================================================
   report-crime.js  -  Crime Report (grouped sheet, one block per Nature of Emergency)
   Edit the settings (CONFIG) below, or the rules inside crimeReport().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).

   Layout (same as the sheet made by hand):
     Nature of Emg | Total Emg. | Total Patient | R.Time | Age | Gender |
     F/A Shifted/Dead | Location | Cause Of Emergency
   - Nature, Total Emg. and Total Patient are merged over the whole nature.
   - R.Time and Location are merged over all patients of one emergency (EC No).
   - Age, Gender, F/A Shifted/Dead and Cause have one line per patient.
   ===================================================================== */
(function () {
  /* ---- Settings ------------------------------------------------------
       emergencyType : Emergency Type that is reported
       statuses      : [] = all statuses, or e.g. ["Finished", "Called Back"]
       cleanCause    : true = remove English words written before the Urdu text in
                       Cause Of Emergency (e.g. "Violence Case بقول ..."), as in the hand-made sheet
       headers       : the 9 column titles shown on the sheet
       fields        : the CSV column used for each value
       The sheet date is yesterday.
    ------------------------------------------------------------------ */
  const CONFIG = {
    title:         "Crime Emergencies Breakup of District Rahim Yar Khan",
    emergencyType: "Crime",
    statuses:      [],
    cleanCause:    true,
    headers: ["Nature of Emg", "Total Emg.", "Total Patient", "R.Time", "Age", "Gender", "F/A Shifted/ Dead", "Location", "Cause Of Emergency"],
    fields: {
      nature:   "Emergency Subtype",
      rtime:    "Response Time (HH:MM:SS)",
      victim:   "Victim Name",
      age:      "Age",
      gender:   "Gender",
      fate:     "Fate Of Patient",
      location: "Emergency Address",
      cause:    "Cause Of Emergency"
    }
  };

  const rt = s => String(s).replace(/^0(\d):/, '$1:');   // 00:05:33 -> 0:05:33

  function crimeReport(rows) {
    const R = CONFIG, K = R.fields, { ix, get } = tripGetter(rows), st = (R.statuses || []).map(norm);
    const missing = Object.values(K).filter(h => ix(h) < 0);

    // 1) one entry per EC No, with its patients (a trip without patient data keeps an empty line)
    const trips = new Map();
    for (const r of rows.slice(1)) {
      const ec = get(r, '@id'); if (!ec || ec.toUpperCase() === 'NOT ASSIGNED') continue;
      if (norm(get(r, CFG.columns.type)) !== norm(R.emergencyType)) continue;
      if (st.length && !st.includes(norm(get(r, 'Emergency Status')))) continue;
      if (!trips.has(ec)) trips.set(ec, { r, pats: [], seen: new Set() });
      const t = trips.get(ec), name = get(r, K.victim), age = get(r, K.age);
      if (!name && !age) continue;
      const key = name + '|' + get(r, 'CNIC') + '|' + age;
      if (t.seen.has(key)) continue; t.seen.add(key); t.pats.push(r);
    }

    // 2) group the trips by Nature of Emergency (order of first appearance)
    const groups = new Map();
    for (const t of trips.values()) {
      const nat = get(t.r, K.nature) || '(no subtype)';
      if (!groups.has(nat)) groups.set(nat, []);
      groups.get(nat).push(t);
    }

    // 3) build the sheet
    const date = dmy(yday()), n = 9, H = R.headers, body = [], csv = [H];
    const BX = 'height:46px;', B = 'font-weight:bold;';
    let totEc = 0, totPat = 0;
    for (const [nat, list] of groups) {
      const lines = list.reduce((a, t) => a + (t.pats.length || 1), 0);
      const nP = list.reduce((a, t) => a + t.pats.length, 0);
      totEc += list.length; totPat += nP;
      let first = true;
      for (const t of list) {
        const ps = t.pats.length ? t.pats : [t.r];
        ps.forEach((p, i) => {
          const row = [];
          if (first) { row.push(cl(nat, B, { rs: lines }), cl(list.length, B, { rs: lines }), cl(nP, B, { rs: lines })); first = false; }
          if (i === 0) row.push(cl(rt(get(t.r, K.rtime)), BX, { rs: ps.length }));
          const age = get(p, K.age), gen = get(p, K.gender), fate = fate3(get(p, K.fate));
          let cause = get(p, K.cause);
          if (R.cleanCause) cause = cause.replace(/^[A-Za-z0-9 .,:;\-\/()]+(?=[\u0600-\u06FF])/, '').trim();
          row.push(cl(age, BX), cl(gen, BX), cl(fate, BX));
          if (i === 0) row.push(cl(get(t.r, K.location), BX, { rs: ps.length }));
          row.push(cl(cause, BX + 'direction:rtl;text-align:right;padding:6px 10px;'));
          body.push(row);
          csv.push([nat, list.length, nP, rt(get(t.r, K.rtime)), age, gen, fate, get(t.r, K.location), cause]);
        });
      }
    }
    return {
      name: 'Crime Emergencies ' + date, count: totEc,
      cards: [['Crime emergencies', totEc], ['Patients', totPat], ...[...groups].map(([k, v]) => [k, v.length]).sort((a, b) => b[1] - a[1])],
      rule: 'Emergency Type: ' + R.emergencyType + '  |  EC No assigned' + (st.length ? '  |  Status: ' + R.statuses.join(' / ') : '') + '  |  Sheet date is yesterday',
      warn: missing.length ? 'These columns were not found in the CSV: ' + missing.join(', ') : '',
      widths: [150, 75, 80, 85, 70, 85, 110, 230, 380],
      rows: [
        [cl(R.title, 'font-size:20pt;font-weight:bold;height:36px;', { cs: n })],
        [cl('Date : ' + date, 'font-weight:bold;font-size:14pt;background:#d0cece;height:30px;', { cs: n })],
        H.map(h => cl(h, 'font-weight:bold;background:#d0cece;height:46px;')),
        ...(body.length ? body : [[cl('No matching records found.', '', { cs: n })]])
      ],
      csv
    };
  }

  window.REPORTS.crime = { label: 'Crime Report', input: 'trips', run: crimeReport };
})();
