/* =====================================================================
   report-misc.js  -  Misc Emergencies Breakup (Fall, Animal, Hazmat, Snake, Electric Shock, Delivery)
   Edit the settings (CONFIG) below, or the rules inside miscReport().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).

   Same sheet as the hand-made one:
     Emergency | Total | Total Patient | R.Time | Age | Gender | F/A Shifted/ | Location | Detail
   followed by the Delivery Case summary (total, patients and the age groups).
   Anything that is not in the trips CSV is left empty.
   ===================================================================== */
(function () {
  /* ---- Settings ------------------------------------------------------
       Included: the Emergency Subtypes listed in totalGroups, EC No assigned (each EC No once),
       trip not Discarded. Delivery Case is shown as a summary at the bottom, not line by line.
       Emergency          = Emergency Subtype
       Total              = number of trips. Subtypes inside the same totalGroups entry share one merged Total
       Total Patient      = number of victims. Subtypes inside the same patientGroups entry share one merged cell
       R.Time             = Response Time (HH:MM:SS) of the trip
       Age / Gender       = from the victims of the trip, F/A Shifted = Fate Of Patient
                            (trips without victims get one merged "NA" cell)
       Location           = Emergency Address
       Detail             = Cause Of Emergency (only the Urdu part), when empty the remark written
                            for the vehicles (empty when the remark is only N/A, Ok, Complete ...)
       ageBrackets        = age groups of the Delivery Case summary (a patient goes into the first
                            group whose max is not smaller than the age)
       The sheet date is the date of the trips in the CSV.
    ------------------------------------------------------------------ */
  const CONFIG = {
    title:        "Misc Emergencies Breakup of District {district}",
    district:     "Rahim Yar Khan",
    delivery:     "Delivery Case",
    totalGroups:  [["Fall From Wall", "Fall From Roof"], ["Animal/Bird Rescue"], ["Hazmat"], ["Snake Emergency"], ["Electric Shock"]],
    patientGroups: [["Fall From Wall", "Fall From Roof"], ["Animal/Bird Rescue", "Hazmat", "Snake Emergency"], ["Electric Shock"]],
    ageBrackets:  [{ label: "15 Y to 20 Y", max: 20 }, { label: "21 Y to 30 Y", max: 30 }, { label: "31 Y to 40 Y", max: 40 }, { label: "41 Y to 50 Y", max: 50 }, { label: "51 Y & above", max: 999 }],
    watchTypes:   ["Fall", "Rescue Operations"],   // a subtype of these Emergency Types that is not listed above gets a warning
    ignoreRemarks: ["n/a", "na", "ok", "nil", "nill", "none", "no", "-", "good", "complete", "completed", "finished", "done"]
  };

  const pad2 = n => String(n).padStart(2, '0');
  /* per-vehicle details look like "RYA-14 | 00:05:09 | 00:36:24 | finished | remark, RYF-05 | ..." */
  function vehicles(txt) {
    return String(txt || '').split(/,\s*(?=[A-Za-z]{2,4}-?\d+\s*\|)/).map(e => e.split(' | ').map(x => x.trim())).filter(p => p.length >= 2);
  }
  /* keeps only the Urdu part of the cause: removes "(Fall From wall)" and a leading "Electric shock" */
  const urdu = s => String(s || '').replace(/\([^()؀-ۿ]*\)/g, '').replace(/^[\sA-Za-z\/\-]+/, '').trim();
  const isNA = s => !s || /^n\/a$/i.test(s) || /^not specified$/i.test(s);

  function miscReport(rows) {
    const R = CONFIG, { get } = tripGetter(rows);
    const order = R.totalGroups.reduce((a, g) => a.concat(g), []);
    const tgOf = {}, pgOf = {};
    R.totalGroups.forEach((g, i) => g.forEach(s => tgOf[norm(s)] = i));
    R.patientGroups.forEach((g, i) => g.forEach(s => pgOf[norm(s)] = i));
    const delKey = norm(R.delivery), watch = R.watchTypes.map(norm), listed = order.map(norm).concat(delKey);

    /* one entry per EC No (not discarded), with its victims */
    const trips = new Map(), other = {};
    for (const r of rows.slice(1)) {
      const ec = get(r, '@id'); if (!ec) continue;
      const sub = get(r, CFG.columns.subtype), sk = norm(sub);
      if (get(r, 'Emergency Status').toLowerCase() === 'discarded') continue;
      if (!listed.includes(sk)) { if (watch.includes(norm(get(r, CFG.columns.type)))) other[sub] = (other[sub] || 0) + 1; continue; }
      if (!trips.has(ec)) trips.set(ec, { r, sk, vic: [], seen: new Set() });
      const t = trips.get(ec), name = get(r, 'Victim Name');
      if (/^yes$/i.test(get(r, 'Has Victims')) && name && !/^n\/a$/i.test(name)) {
        const key = name + '|' + get(r, 'Age'); if (t.seen.has(key)) continue; t.seen.add(key);
        t.vic.push({ age: get(r, 'Age'), gender: get(r, 'Gender'), fate: get(r, 'Fate Of Patient') });
      }
    }

    /* sheet date = the most common date of the calls in the CSV (dd-mm-yyyy) */
    const cnt = {};
    for (const r of rows.slice(1)) {
      const m = get(r, 'Call Received at').match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
      if (m) { const d = pad2(m[3]) + '-' + pad2(m[2]) + '-' + m[1]; cnt[d] = (cnt[d] || 0) + 1; }
    }
    const date = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || csvDate(rows, ['Call Received at', 'Start Time']);

    const all = [...trips.values()];
    const items = [];
    order.forEach(s => all.filter(t => t.sk === norm(s)).forEach(t => items.push({ s, t })));
    const delivery = all.filter(t => t.sk === delKey);

    /* values of one trip */
    const info = t => {
      const r = t.r, veh = vehicles(get(r, 'Vehicle Reg No | Response Time (HH:MM:SS) | Elapsed Time (HH:MM:SS) | Emergency Status | Remarks'));
      const remarks = veh.map(p => p.slice(4).join(' | ').trim()).filter(x => x && !R.ignoreRemarks.includes(x.toLowerCase()));
      const brief = remarks.sort((a, b) => b.length - a.length)[0] || '';
      const rt = get(r, 'Response Time (HH:MM:SS)').match(/^(\d+):(\d{2}):(\d{2})/);
      const join = k => t.vic.map(v => v[k]).filter(x => !isNA(x)).join(' / ');
      return { rtime: rt ? (+rt[1]) + ':' + rt[2] + ':' + rt[3] : '', age: join('age'), gender: join('gender'), fate: join('fate'),
        loc: get(r, 'Emergency Address'), detail: urdu(get(r, 'Cause Of Emergency')) || brief };
    };

    /* sizes of the merged blocks */
    const subN = {}, tgN = {}, pgN = {}, pgP = {};
    items.forEach(({ s, t }) => {
      const k = norm(s); subN[k] = (subN[k] || 0) + 1;
      tgN[tgOf[k]] = (tgN[tgOf[k]] || 0) + 1;
      pgN[pgOf[k]] = (pgN[pgOf[k]] || 0) + 1; pgP[pgOf[k]] = (pgP[pgOf[k]] || 0) + t.vic.length;
    });

    const n = 9, B = 'font-size:11pt;height:44px;', BB = B + 'font-weight:bold;';
    const UR = B + "direction:rtl;text-align:right;font-family:'Jameel Noori Nastaleeq','Noto Nastaliq Urdu',Calibri,Arial;";
    const body = [], csv = [];
    items.forEach(({ s, t }, i) => {
      const k = norm(s), prev = items[i - 1], next = items[i + 1], v = info(t);
      const sameSub = o => o && norm(o.s) === k, sameTG = o => o && tgOf[norm(o.s)] === tgOf[k], samePG = o => o && pgOf[norm(o.s)] === pgOf[k];
      const row = [];
      if (!sameSub(prev)) row.push(cl(s, BB, { rs: subN[k] }));
      if (!sameTG(prev)) row.push(cl(tgN[tgOf[k]], BB, { rs: tgN[tgOf[k]] }));
      if (!samePG(prev)) row.push(cl(pgP[pgOf[k]], BB, { rs: pgN[pgOf[k]] }));
      row.push(cl(v.rtime, B));
      if (t.vic.length) row.push(cl(v.age, B), cl(v.gender, B), cl(v.fate, B));
      else if (!(prev && samePG(prev) && !prev.t.vic.length)) {
        let run = 1; for (let j = i + 1; items[j] && pgOf[norm(items[j].s)] === pgOf[k] && !items[j].t.vic.length; j++) run++;
        row.push(cl('NA', BB, { cs: 3, rs: run }));
      }
      row.push(cl(v.loc, B), cl(v.detail, UR));
      body.push(row);
      csv.push([s, get(t.r, '@id'), v.rtime, t.vic.length ? v.age : 'NA', t.vic.length ? v.gender : 'NA', t.vic.length ? v.fate : 'NA', v.loc, v.detail]);
    });

    /* Delivery Case summary */
    const dv = [].concat(...delivery.map(t => t.vic)), counts = R.ageBrackets.map(() => 0);
    dv.forEach(v => { const a = parseInt((String(v.age).match(/\d+/) || [''])[0], 10); if (isNaN(a)) return; const i = R.ageBrackets.findIndex(b => a <= b.max); if (i >= 0) counts[i]++; });
    const dash = x => x ? x : '-';
    const H = ['Emergency', 'Total', 'Total Patient', 'R.Time', 'Age', 'Gender', 'F/A Shifted/', 'Location', 'Detail'];
    const hs = 'font-weight:bold;font-size:12pt;background:#d9d9d9;height:54px;';
    const DB = 'font-size:11pt;font-weight:bold;';
    const delRows = [
      [cl(R.delivery, DB + 'height:50px;', { rs: 2 }), cl(delivery.length, DB, { rs: 2 }), cl('Total Patient', DB, { rs: 2 }), cl(dv.length, DB, { rs: 2 }), ...R.ageBrackets.map(b => cl(b.label, DB + 'height:50px;'))],
      counts.map(c => cl(dash(c), DB + 'height:36px;'))
    ];
    const cards = [['Misc emergencies', items.length + delivery.length], ['Total patients', items.reduce((a, o) => a + o.t.vic.length, 0) + dv.length]];
    order.concat(R.delivery).forEach(s => { const c = s === R.delivery ? delivery.length : subN[norm(s)] || 0; if (c) cards.push([s, c]); });
    const warn = Object.keys(other).length ? 'Not included in this report (subtype is not in the list): ' + Object.entries(other).map(([k, v]) => k + ' (' + v + ')').join(', ') + '. Add it to totalGroups in report-misc.js to include it.' : '';

    csv.push([], [R.delivery, 'Total', delivery.length, 'Total Patient', dv.length], ['Age group', ...R.ageBrackets.map(b => b.label)], ['Patients', ...counts.map(dash)]);
    return {
      name: 'Misc Emergencies ' + date, count: items.length + delivery.length,
      cards, rule: 'Emergency Subtypes: Fall, Animal/Bird Rescue, Hazmat, Snake, Electric Shock, Delivery  |  Discarded trips excluded  |  Anything not in the CSV is left empty',
      warn, widths: [124, 56, 66, 72, 78, 78, 86, 220, 380],
      rows: [
        [cl(R.title.replace('{district}', R.district), 'font-weight:bold;font-size:20pt;height:44px;', { cs: n })],
        [cl('Date: ' + date, 'font-weight:bold;font-size:14pt;height:32px;', { cs: n })],
        H.map(h => cl(h, hs)),
        ...(items.length ? body : [[cl('No matching records found.', '', { cs: n })]]),
        ...delRows
      ],
      csv: [['Emergency', 'EC No', 'R.Time', 'Age', 'Gender', 'F/A Shifted', 'Location', 'Detail'], ...csv]
    };
  }

  window.REPORTS.misc = { label: 'Misc Emergencies', input: 'trips', run: miscReport };
})();
