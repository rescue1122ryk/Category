/* =====================================================================
   report-unfinal.js  -  Unfinalized Report
   Edit the settings (CONFIG) below, or the rules inside unfinalReport().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).

   One sheet with two lists:
     1) Trips that are NOT finalized, with the time that has passed since the trip
        ended and how much is left of the 12 hour deadline (or how late it is).
        Finalizing must be done before the deadline.
     2) Trips where Emergency Subtype and Cause Of Emergency do not match
        (listed even when the trip is finalized).
   The time passed is counted up to the moment you open the report.
   ===================================================================== */
(function () {
  /* ---- Settings ------------------------------------------------------
       finishedStatuses: only trips whose Emergency Status is one of these are counted
                       (trips that are not finished yet are left out of both lists)
       deadlineHours : hours allowed to finalize a trip, counted from the first
                       time found in countFrom ("End Time", else "Start Time", ...)
       finalized     : CSV column and the value that means "finalized"
       Matching (list 2): Subtype and Cause are the same when
         - their letters are the same, or one is written inside the other, or
         - they share a word (generic words in stopWords such as "pain" are ignored), or
         - the Cause contains one of the words listed for that Subtype in equivalents.
       Add words to equivalents when a normal combination is wrongly listed, e.g.
         "Minor Injuries": ["rta", "road", "accident"]
       A Cause written only in Urdu cannot be compared with the English subtype, so it is not listed
       (set skipUrduCause to false to list those too).
       A trip without victims (Has Victims = No) is not listed for an empty cause.
       Patient Transfer trips are skipped (skipEmergencyTypes in categories-config.js).
    ------------------------------------------------------------------ */
  const CONFIG = {
    title:         "Unfinalized Report",
    deadlineHours: 12,
    finishedStatuses: ["Finished"],
    countFrom:     ["End Time", "Start Time", "Call Received at"],
    finalized:     { column: "Finalized", value: "Yes" },
    causeColumn:   "Cause Of Emergency",
    skipUrduCause: true,
    emptyCause:    ["", "n/a", "na", "nil", "none", "-"],
    stopWords:     ["pain", "case", "problem", "problems", "disorder", "disorders", "emergency", "emergencies", "injury", "injuries", "other", "others", "patient", "the", "and", "with", "due", "from", "medicine", "already", "taken"],
    equivalents: {
      "Minor Injuries":       ["rta", "road", "accident", "bike", "hit", "fall", "cut", "wound", "assault", "injur", "crash"],
      "Bleeding":             ["rta", "road", "accident", "bike", "hit", "fall", "cut", "wound", "assault", "injur", "crash", "bullet"],
      "Domestic Injuries":    ["fall", "stair", "cut", "burn", "injur"],
      "Joints Pain":          ["joint", "muscular", "muscle"],
      "SOB/ Respiratory Distress": ["sob", "breath", "respir", "asthma"],
      "Hypoglycemia":         ["diabet", "sugar", "glyc", "bsr"],
      "Hyperglycemia":        ["diabet", "sugar", "glyc", "bsr"],
      "Electric Shock":       ["shock", "current", "\u06a9\u0631\u0646\u067e", "\u0628\u062c\u0644\u06cc"],
      "Unconscious":          ["conscious", "pulse", "faint"],
      "Epilepsy":             ["seiz", "fit", "convuls", "epilep"],
      "Gynae Problem":        ["gyn", "pregnan", "bleed"],
      "Renal Disorders / Renal Colic": ["kidney", "renal", "stone", "colic"],
      "Multiple Fractures":   ["rta", "accident", "fall", "fract", "collision", "bike", "hit"],
      "Severe Trauma":        ["rta", "accident", "fall", "collision", "bike", "hit", "bullet", "fire", "trauma"],
      "Anxiety / Psychiatric Disorder": ["depress", "anxi", "stress", "psych", "family", "panic"]
    }
  };

  const GREY = '#d9d9d9', RED = '#fde2e0', YEL = '#fff4d6';
  const letters = s => String(s).toLowerCase().replace(/[^a-z\u0600-\u06ff0-9]/g, '');
  const stems = (s, stop) => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !stop.has(w)).map(w => w.slice(0, 4));
  const hm = ms => { const m = Math.floor(Math.abs(ms) / 60000); return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm'; };
  function parseDT(s) {
    const m = String(s).match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i); if (!m) return null;
    let h = +m[4]; if (m[7]) { h = h % 12; if (/pm/i.test(m[7])) h += 12; }
    return new Date(+m[1], +m[2] - 1, +m[3], h, +m[5], +(m[6] || 0));
  }

  function unfinalReport(rows) {
    const R = CONFIG, { ix, get } = tripGetter(rows), now = new Date();
    const missing = [R.finalized.column, R.causeColumn].filter(h => ix(h) < 0);
    if (missing.length) throw new Error('columns not found in the trips CSV: ' + missing.join(', '));
    const fin = R.finishedStatuses.map(s => s.toLowerCase()), stop = new Set(R.stopWords), skip = (CFG.skipEmergencyTypes || []).map(norm), empty = new Set(R.emptyCause);
    const eq = {}; for (const k in R.equivalents) eq[norm(k)] = R.equivalents[k];
    const same = (sub, cause) => {
      const a = letters(sub), b = letters(cause); if (!a || !b) return false;
      if (a === b || b.includes(a) || a.includes(b)) return true;
      const sb = new Set(stems(cause, stop)); if (stems(sub, stop).some(w => sb.has(w))) return true;
      const c = String(cause).toLowerCase(); return (eq[norm(sub)] || []).some(w => c.includes(w));
    };

    // one entry per EC No
    const trips = new Map();
    for (const r of rows.slice(1)) {
      const ec = get(r, '@id'); if (!ec || skip.includes(norm(get(r, CFG.columns.type)))) continue;
      if (!fin.includes(get(r, 'Emergency Status').toLowerCase())) continue;   // not finished yet: not counted
      if (!trips.has(ec)) trips.set(ec, { r, unfin: false, bad: null });
      const t = trips.get(ec);
      if (get(r, R.finalized.column).toLowerCase() !== R.finalized.value.toLowerCase()) t.unfin = true;
      const sub = get(r, CFG.columns.subtype), cause = get(r, R.causeColumn), hasV = !/^no$/i.test(get(r, 'Has Victims'));
      if (!t.bad && sub && !/^n\/a$/i.test(sub)) {
        if (empty.has(cause.toLowerCase())) { if (hasV) t.bad = { r, why: 'Cause Of Emergency is empty' }; }
        else if (R.skipUrduCause && !/[a-z]/i.test(cause)) { /* Urdu-only text: not compared */ }
        else if (!same(sub, cause)) t.bad = { r, why: 'Cause does not match the subtype' };
      }
    }
    const info = r => { const d = R.countFrom.map(c => parseDT(get(r, c))).find(Boolean); return { d, end: get(r, R.countFrom.find(c => parseDT(get(r, c))) || '') }; };
    const agent = r => get(r, CFG.columns.agent) + (get(r, CFG.columns.agentId) ? ' (' + get(r, CFG.columns.agentId) + ')' : '');
    const dl = R.deadlineHours * 3600000;

    // list 1: not finalized, longest waiting first
    const A = [...trips.entries()].filter(([, t]) => t.unfin).map(([ec, t]) => { const { d, end } = info(t.r); return { ec, t, d, end, el: d ? now - d : -1 }; }).sort((a, b) => b.el - a.el);
    // list 2: subtype / cause mismatch
    const B = [...trips.entries()].filter(([, t]) => t.bad).map(([ec, t]) => ({ ec, t }));
    const over = A.filter(x => x.d && x.el >= dl).length;

    const n = 11, H = ['Sr #', 'EC No', 'Tehsil', 'Vehicle Call Sign', 'Agent', 'Emergency Subtype', 'Cause Of Emergency', 'Finalized', 'Trip End Time', 'Time Passed', 'Remarks'];
    const hd = H.map(h => cl(h, 'font-weight:bold;font-size:9pt;background:' + GREY + ';height:34px;', { cs: 1 }));
    const sec = txt => [cl(txt, 'font-weight:bold;font-size:11pt;text-align:left;padding:6px 10px;background:#e7e6e6;height:30px;', { cs: n })];
    const csv = [['List', ...H]], sheet = [];

    sheet.push(sec('List 1 - Trips not finalized  (deadline: ' + R.deadlineHours + ' hours after the trip ended)'), hd);
    A.forEach((x, i) => {
      const r = x.t.r, late = x.d && x.el >= dl, left = dl - x.el;
      const rem = !x.d ? 'Time not found' : late ? 'DEADLINE PASSED - late by ' + hm(x.el - dl) : 'Within deadline - ' + hm(left) + ' left';
      const st = 'font-size:9pt;height:36px;background:' + (late || !x.d ? RED : YEL) + ';';
      const vals = [i + 1, x.ec, get(r, 'Tehsil Name'), get(r, 'Dispatched Vehicles'), agent(r), get(r, CFG.columns.subtype), get(r, R.causeColumn), 'No', x.end, x.d ? hm(x.el) : '', rem];
      sheet.push(vals.map((v, k) => cl(v, st + (k === 10 ? 'font-weight:bold;' : ''))));
      csv.push(['Not finalized', ...vals.slice(1)]);
    });
    if (!A.length) sheet.push([cl('All trips are finalized.', 'height:30px;', { cs: n })]);

    sheet.push([cl('', 'border:0;height:14px;', { cs: n })]);
    sheet.push(sec('List 2 - Emergency Subtype and Cause Of Emergency do not match  (finalized trips included)'), hd.map(c => Object.assign({}, c)));
    B.forEach((x, i) => {
      const r = x.t.bad.r, st = 'font-size:9pt;height:36px;';
      const vals = [i + 1, x.ec, get(r, 'Tehsil Name'), get(r, 'Dispatched Vehicles'), agent(r), get(r, CFG.columns.subtype), get(r, R.causeColumn), x.t.unfin ? 'No' : 'Yes', get(r, 'End Time'), '', x.t.bad.why];
      sheet.push(vals.map(v => cl(v, st)));
      csv.push(['Subtype/Cause mismatch', ...vals.slice(1)]);
    });
    if (!B.length) sheet.push([cl('No mismatch found.', 'height:30px;', { cs: n })]);

    const date = csvDate(rows, ['Call Received at', 'Start Time']);
    const stamp = String(now.getDate()).padStart(2, '0') + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + now.getFullYear() + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    return {
      name: 'Unfinalized Report ' + date, count: A.length + B.length,
      cards: [['Not finalized', A.length], ['Deadline passed', over], ['Within deadline', A.length - over], ['Subtype / Cause mismatch', B.length]],
      rule: 'Deadline ' + R.deadlineHours + ' hrs after trip end  |  Time passed counted up to ' + stamp + '  |  Mismatch listed even if finalized  |  Only Finished trips are counted  |  PTS skipped',
      warn: '',
      widths: [44, 66, 96, 130, 170, 150, 230, 66, 150, 84, 230],
      rows: [
        [cl(R.title, 'font-weight:bold;font-size:16pt;height:32px;', { cs: n })],
        [cl('Date: ' + date + '      Checked on: ' + stamp, 'font-weight:bold;font-size:11pt;height:26px;', { cs: n })],
        ...sheet
      ],
      csv
    };
  }

  window.REPORTS.unfinal = { label: 'Unfinalized Report', input: 'trips', run: unfinalReport };
})();
