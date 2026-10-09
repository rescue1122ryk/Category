/* =====================================================================
   report-staff.js  -  Staff App Not Sync report (uses the vehicle availability CSV)
   Edit the settings (CONFIG) below, or the rules inside staffApp().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).

   Layout is the same as the sheet made by hand: District Info and Station
   (call sign + address) are merged cells, a station without any qualifying
   vehicle shows "Nill" across the row.
   ===================================================================== */
(function () {
  /* ---- Settings ------------------------------------------------------
       A row is included when ALL of these are true:
         - Vehicle Type is one of vehicleTypes (Ambulance and Bike)
         - Emergency Status = status
         - Reasons is exactly "reason" (reasonMatch "exact": a row whose Reasons also lists
           other reasons, e.g. "Attendance is not marked", is left out).
           Use reasonMatch "contains" to accept extra reasons too.
         - Duration is at least minHours
       The title date is the From Date of the first qualifying row.
       stations: the station list (call sign: address). If the CSV has a
       "Station Address" column, that value is used instead.
    ------------------------------------------------------------------ */
  const CONFIG = {
    minHours:     1,
    title:        "Staff App is out of Sync",
    subtitle:     "Staff App is out of sync (1 hrs)   Rahim Yar Khan",
    reason:       "Staff App is out of sync",
    reasonMatch:  "exact",                    // "exact" or "contains"
    vehicleTypes: ["Ambulance", "Bike"],
    status:       "Not Available",
    district:     "Rahim Yar Khan",
    stations: {
      "RS-01": "Rescue 1122 Station, Near Allama Iqbal Library, WAPDA Colony Road, Rahim Yar Khan.",
      "RS-02": "Rescue 1122 Station, near by Ghosia chowk. THQ Hospital Tehsil Sadiqabad",
      "RS-03": "Rescue 1122 Station, Near by TMA office shahi road khanpur",
      "RS-04": "Liaquatpur, Rahim Yar Khan"
    }
  };

  const GREEN = '#4caf50';
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
  const gpsTxt = s => /^gps/i.test(s) ? 'GPS' + s.slice(3).toLowerCase() : s;           // GPS IS ON -> GPS is on
  const dt = s => fmtDT(s).replace(/ 0(\d:)/, ' $1');                                    // 08/10/2026 03:11 -> 08/10/2026 3:11

  function staffApp(rows) {
    const R = CONFIG;
    const H = rows[0].map(h => String(h).toLowerCase()), find = n => H.findIndex(h => h.includes(n.toLowerCase()));
    const N = { station: 'Station Call Sign', veh: 'Registration Number', type: 'Vehicle Type', from: 'From Date', to: 'To Date', dur: 'Duration', reason: 'Reasons', status: 'Emergency Status', gps: 'Location Data', addr: 'Station Address', dist: 'District Info' };
    const c = {}; for (const k in N) c[k] = find(N[k]);
    const miss = ['station', 'type', 'dur', 'reason', 'status'].filter(k => c[k] < 0);
    if (miss.length) throw new Error('Staff App CSV: required columns not found: ' + miss.map(k => N[k]).join(', '));
    const g = (r, k) => c[k] < 0 ? '' : String(r[c[k]] == null ? '' : r[c[k]]);
    const up = s => String(s).trim().toUpperCase(), flat = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
    const types = R.vehicleTypes.map(up), want = flat(R.reason);
    const qual = r => types.includes(up(g(r, 'type'))) && up(g(r, 'status')) === up(R.status) &&
      (R.reasonMatch === 'contains' ? flat(g(r, 'reason')).includes(want) : flat(g(r, 'reason')) === want) &&
      durSecs(g(r, 'dur')) >= R.minHours * 3600;
    const data = rows.slice(1);
    let date = '';
    for (const r of data) if (qual(r)) { const m = fmtDT(g(r, 'from')).match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) { date = m[1] + '-' + m[2] + '-' + m[3]; break; } }
    date = date || csvDate(rows);

    // 1) rows of each station
    const blocks = Object.entries(R.stations).map(([st, a0]) => {
      const list = data.filter(r => up(g(r, 'station')) === up(st) && qual(r));
      const addr = list.length && c.addr >= 0 && g(list[0], 'addr') ? g(list[0], 'addr') : a0;
      const dist = list.length && c.dist >= 0 && g(list[0], 'dist') ? g(list[0], 'dist') : R.district;
      return { st, addr, dist, list };
    });
    const total = blocks.reduce((a, b) => a + b.list.length, 0), lines = blocks.reduce((a, b) => a + Math.max(b.list.length, 1), 0);

    // 2) build the sheet (District Info and Station cells are merged)
    const BD = 'font-size:8pt;', BT = 'font-weight:bold;font-size:9pt;';
    const sheet = [], csv = [], per = []; let firstRow = true;
    for (const b of blocks) {
      const n = Math.max(b.list.length, 1), need = Math.ceil(b.addr.length / 26) * 17 + 8, h = Math.max(19, Math.ceil(need / n));
      if (!b.list.length) {
        const row = [];
        if (firstRow) { row.push(cl(b.dist, BT, { rs: lines })); firstRow = false; }
        row.push(cl(b.st, BT + 'height:' + h + 'px;'), cl(b.addr, BT), cl('Nill', 'font-size:9pt;color:#9c5700;', { cs: 9 }));
        sheet.push(row); csv.push([b.dist, b.st, b.addr, 'Nill', '', '', '', '', '', '', '', '']);
      }
      b.list.forEach((r, i) => {
        const row = [];
        if (firstRow) { row.push(cl(b.dist, BT, { rs: lines })); firstRow = false; }
        if (i === 0) row.push(cl(b.st, BT, { rs: n }), cl(b.addr, BT, { rs: n }));
        const vals = [g(r, 'veh'), cap(g(r, 'type')), gpsTxt(g(r, 'gps')), dt(g(r, 'from')), dt(g(r, 'to')), g(r, 'dur'), g(r, 'reason').replace(/\s*\r?\n\s*/g, ' | '), g(r, 'status'), ''];
        row.push(...vals.map(v => cl(v, BD + 'height:' + h + 'px;')));
        sheet.push(row); csv.push([b.dist, b.st, b.addr, ...vals]);
      });
      per.push([b.st, b.list.length]);
    }
    const HD = ['District Info', 'Station Call', 'Location Data (Station)', 'Vehicle', 'Vehicle Type', 'Location Data (GPS)', 'From Date', 'To Date', 'Duration', 'Reasons', 'Emergency Status', 'Remarks'];
    return {
      name: 'Staff App Out of Sync ' + date, count: total, cards: [['Out-of-sync records', total], ...per], warn: '',
      rule: R.vehicleTypes.join(' + ') + '  |  ' + R.status + '  |  Reason ' + (R.reasonMatch === 'contains' ? 'contains' : 'is exactly') + ' "' + R.reason + '"  |  Duration >= ' + R.minHours + ' hr',
      widths: [78, 62, 150, 62, 80, 92, 112, 112, 78, 140, 84, 62],
      rows: [
        [cl('', 'border:0;', { cs: 2, rs: 2 }), cl(R.title + ', Dated ' + date, 'font-weight:bold;font-size:14pt;height:28px;', { cs: 10 })],
        [cl(R.subtitle, 'font-weight:bold;font-size:11pt;height:22px;', { cs: 10 })],
        HD.map(x => cl(x, 'color:#ffffff;font-weight:bold;font-size:9pt;background:' + GREEN + ';height:30px;')),
        ...sheet
      ],
      csv: [HD, ...csv]
    };
  }

  window.REPORTS.staff = {
    label: 'Staff App Not Sync', input: 'file', fileLabel: 'Staff App', hint: 'Staff App',
    detect: (rows, H) => H.some(h => h.includes('station call sign')),   // how this CSV is recognised
    run: staffApp
  };
})();
