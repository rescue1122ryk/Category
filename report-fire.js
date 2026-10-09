/* =====================================================================
   report-fire.js  -  Fire Report (Fire Cases)
   Edit the settings (CONFIG) below, or the rules inside fireReport().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).

   Same sheet as the hand-made one, in two blocks:
     1) Sr No | District | Cell # | Vehicle | Call Time | Distance from Nearby station (Km's) |
        Response Time (Minutes) | Fire Fighting Duration | Injured /Dead | Staff | Save | Loss
     2) Tehsil | Brief | Class | Address       (one line per fire, same Sr No)
   Anything that is not in the trips CSV is left empty to be filled in by hand:
   Fire Fighting Duration, Staff, Save, Loss and Class.
   ===================================================================== */
(function () {
  /* ---- Settings ------------------------------------------------------
       Included: Emergency Type = emergencyType, EC No assigned (each EC No once),
       trip not Discarded.
       Cell #             = Caller Number
       Vehicle            = Dispatched Vehicles (separated by a space)
       Call Time          = time of Call Received at (24 hour clock)
       Distance           = Total Mileage of the vehicle given by distanceFrom, divided by 2
                            ("first" = first vehicle listed, "min" = smallest, "max" = largest)
       Response Time      = Response Time of the FIRST vehicle, in whole minutes
       Injured /Dead      = from the victims of the trip ("-" when there are none)
       Brief              = the remark written for the vehicles when the trip was finished
                            (empty when the remark is only N/A, Ok, Nil ...)
       Class              = classBySubtype lets you map the Emergency Subtype to a class,
                            e.g. { "Short Circuit": "E-Class" }  (left empty when not listed)
       The sheet date is the date of the trips in the CSV.
    ------------------------------------------------------------------ */
  const CONFIG = {
    title:         "Reported Date: {date} (Fire Cases)",
    emergencyType: "Fire",
    distanceFrom:  "first",
    districtShort: { "Rahim Yar Khan": "RYK" },
    tehsilShort:   { "Rahim Yar Khan": "RYK", "Sadiqabad": "SDK", "Khanpur": "KPR", "Liaqatpur": "LQP" },
    classBySubtype: {},
    ignoreRemarks: ["n/a", "na", "ok", "nil", "nill", "none", "no", "-", "good"]
  };

  const pad2 = n => String(n).padStart(2, '0');
  /* per-vehicle details look like "RYA-14 | 00:05:09 | 00:36:24 | finished | remark, RYF-05 | ..." */
  function vehicles(txt) {
    return String(txt || '').split(/,\s*(?=[A-Za-z]{2,4}-?\d+\s*\|)/).map(e => e.split(' | ').map(x => x.trim())).filter(p => p.length >= 2);
  }

  function fireReport(rows) {
    const R = CONFIG, { ix, get } = tripGetter(rows), want = norm(R.emergencyType);
    const trips = new Map();
    for (const r of rows.slice(1)) {
      const ec = get(r, '@id'); if (!ec || norm(get(r, CFG.columns.type)) !== want) continue;
      if (get(r, 'Emergency Status').toLowerCase() === 'discarded') continue;
      if (!trips.has(ec)) trips.set(ec, { r, inj: 0, dead: 0, seen: new Set() });
      const t = trips.get(ec), name = get(r, 'Victim Name');
      if (/^yes$/i.test(get(r, 'Has Victims')) && name && !/^n\/a$/i.test(name)) {
        const key = name + '|' + get(r, 'Age'); if (t.seen.has(key)) continue; t.seen.add(key);
        if (/dead/i.test(get(r, 'Fate Of Patient'))) t.dead++; else t.inj++;
      }
    }
    const date = csvDate(rows, ['Call Received at', 'Start Time']), n = 12, list = [...trips.values()];
    const body1 = [], body2 = [], csv = [], per = {};
    const IC = 'font-size:10pt;height:62px;';
    list.forEach((t, i) => {
      const r = t.r, sr = i + 1, veh = vehicles(get(r, 'Vehicle Reg No | Response Time (HH:MM:SS) | Elapsed Time (HH:MM:SS) | Emergency Status | Remarks'));
      const names = get(r, 'Dispatched Vehicles').split(/\s*,\s*/).filter(Boolean);
      const miles = (get(r, 'Total Mileage').match(/\d+(\.\d+)?/g) || []).map(Number);
      const mi = !miles.length ? null : R.distanceFrom === 'min' ? Math.min(...miles) : R.distanceFrom === 'max' ? Math.max(...miles) : miles[0];
      const dist = mi == null ? '' : pad2(Math.round(mi / 2)) + ' kms';
      const rt = veh.length ? veh[0][1].match(/^(\d+):(\d{2}):(\d{2})/) : null;
      const resp = rt ? pad2(+rt[1] * 60 + +rt[2]) + ' mints' : '';
      const callT = (fmtDT(get(r, 'Call Received at')).split(' ')[1] || '').replace(/^0(\d:)/, '$1');
      const inj = [t.inj ? t.inj + ' Injured' : '', t.dead ? t.dead + ' Dead' : ''].filter(Boolean).join(' / ') || '-';
      const remarks = veh.map(p => p.slice(4).join(' | ').trim()).filter(x => x && !R.ignoreRemarks.includes(x.toLowerCase()));
      const brief = remarks.sort((a, b) => b.length - a.length)[0] || '';
      const dist0 = get(r, 'District Name'), teh = get(r, 'Tehsil Name'), addr = get(r, 'Emergency Address');
      const district = R.districtShort[dist0] || dist0, tehsil = R.tehsilShort[teh] || teh, cls = R.classBySubtype[get(r, CFG.columns.subtype)] || '';
      body1.push([cl(sr, IC), cl(district, IC), cl(get(r, 'Caller Number'), IC), cl(names.join(' '), IC), cl(callT, IC), cl(dist, IC), cl(resp, IC), cl('', IC), cl(inj, IC), cl('', IC + 'text-align:left;'), cl('', IC), cl('', IC)]);
      body2.push([cl(sr, 'height:44px;'), cl(tehsil, 'height:44px;'), cl(brief, 'height:44px;', { cs: 6 }), cl(cls, 'height:44px;'), cl(addr, 'height:44px;', { cs: 3 })]);
      csv.push([sr, district, get(r, 'Caller Number'), names.join(' '), callT, dist, resp, '', inj, '', '', '', tehsil, brief, cls, addr]);
      per[tehsil] = (per[tehsil] || 0) + 1;
    });
    const H1 = ['Sr No', 'District', 'Cell #', 'Vehicle', 'Call Time', "Distance from Nearby station (Km's)", 'Response Time (Minutes)', 'Fire Fighting Duration', 'Injured /Dead', 'Staff', 'Save', 'Loss'];
    const hs1 = 'font-weight:bold;font-size:10pt;height:84px;', hs2 = 'font-weight:bold;font-size:9pt;background:#e7e6e6;height:30px;';
    return {
      name: 'Fire Report ' + date, count: list.length,
      cards: [['Fire cases', list.length], ...Object.entries(per)],
      rule: 'Emergency Type: ' + R.emergencyType + '  |  Discarded trips excluded  |  Fire Fighting Duration, Staff, Save, Loss and Class are not in the CSV and are left empty',
      warn: '',
      widths: [38, 56, 92, 112, 64, 86, 86, 84, 72, 200, 58, 58],
      rows: [
        [cl(R.title.replace('{date}', date), 'font-weight:bold;font-size:14pt;height:28px;', { cs: n })],
        H1.map(h => cl(h, hs1)),
        ...(list.length ? body1 : [[cl('No matching records found.', '', { cs: n })]]),
        [cl('', hs2), cl('Tehsil', hs2), cl('Brief', hs2, { cs: 6 }), cl('Class', hs2), cl('Address', hs2, { cs: 3 })],
        ...body2
      ],
      csv: [[...H1, 'Tehsil', 'Brief', 'Class', 'Address'], ...csv]
    };
  }

  window.REPORTS.fire = { label: 'Fire Report', input: 'trips', run: fireReport };
})();
