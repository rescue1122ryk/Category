/* =====================================================================
   report-staff.js  -  Staff App Not Sync report (uses the vehicle availability CSV)
   Edit the settings (CONFIG) below, or the rules inside staffApp().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).
   ===================================================================== */
(function () {
  /* ---- Staff App Not Sync report (uses the vehicle availability CSV) --
       Included: Vehicle Type = vehicleType, Emergency Status = status,
       Reasons contains "reason", and Duration is at least minHours.
       The title date is the From Date of the first qualifying row.
       stations: the station list (call sign: address). A station with no
       qualifying rows is shown as NILL. If the CSV has a "Station Address"
       column, that value is used instead of the address below.
    ------------------------------------------------------------------ */
  const CONFIG = {
    minHours:    1,
    title:       "Staff App is out of Sync",
    subtitle:    "Staff App is out of sync (1 hrs) \u2014 Rahim Yar Khan",
    reason:      "Staff App is out of sync",
    vehicleType: "Ambulance",
    status:      "Not Available",
    district:    "Rahim Yar Khan",
    stations: {
      "RS-01": "Rescue 1122 Station, Near Allama Iqbal Library, WAPDA Colony Road, Rahim Yar Khan.",
      "RS-02": "Rescue 1122 Station, near by Ghosia chowk. THQ Hospital Tehsil Sadiqabad",
      "RS-03": "Rescue 1122 Station, Near by TMA office shahi road khanpur",
      "RS-04": "Liaquatpur, Rahim Yar Khan"
    }
  };

  function staffApp(rows) {
    const R = CONFIG;
    const H = rows[0].map(h => String(h).toLowerCase()), find = n => H.findIndex(h => h.includes(n.toLowerCase()));
    const N = { station: 'Station Call Sign', veh: 'Registration Number', type: 'Vehicle Type', from: 'From Date', to: 'To Date', dur: 'Duration', reason: 'Reasons', status: 'Emergency Status', gps: 'Location Data', addr: 'Station Address', dist: 'District Info' };
    const c = {}; for (const k in N) c[k] = find(N[k]);
    const miss = ['station', 'type', 'dur', 'reason', 'status'].filter(k => c[k] < 0);
    if (miss.length) throw new Error('Staff App CSV: required columns not found: ' + miss.map(k => N[k]).join(', '));
    const g = (r, k) => c[k] < 0 ? '' : String(r[c[k]] == null ? '' : r[c[k]]);
    const up = s => String(s).trim().toUpperCase();
    const qual = r => up(g(r, 'type')) === up(R.vehicleType) && up(g(r, 'status')) === up(R.status) &&
      g(r, 'reason').toLowerCase().includes(R.reason.toLowerCase()) && durSecs(g(r, 'dur')) >= R.minHours * 3600;
    const data = rows.slice(1);
    let date = '';
    for (const r of data) if (qual(r)) { const m = fmtDT(g(r, 'from')).match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) { date = m[1] + '-' + m[2] + '-' + m[3]; break; } }
    date = date || dmy(new Date());
    const sheet = [], csv = [], per = [];
    let rr = 4, total = 0;
    const A = { 0: 1, 1: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 10: 1 };
    const mk = (vals, nill) => vals.map((v, i) => cl(v, 'font-size:8pt;height:28px;' + ((A[i] || nill) ? '' : 'text-align:left;') + (rr % 2 === 0 ? 'background:#e8f5e9;' : '')));
    for (const [st, a0] of Object.entries(R.stations)) {
      let first = true, n = 0;
      for (const r of data) {
        if (up(g(r, 'station')) !== up(st) || !qual(r)) continue;
        const dist = c.dist >= 0 ? g(r, 'dist') : R.district, addr = c.addr >= 0 ? g(r, 'addr') : a0;
        const vals = [first ? dist : '', first ? st : '', first ? addr : '', g(r, 'veh'), 'Ambulance', g(r, 'gps'), fmtDT(g(r, 'from')), fmtDT(g(r, 'to')), g(r, 'dur'),
          g(r, 'reason').replace(/\r?\n/g, ' | '), 'Not Available', ''];
        sheet.push(mk(vals)); csv.push([dist, st, addr, ...vals.slice(3)]); first = false; n++; total++; rr++;
      }
      if (!n) { sheet.push(mk([R.district, st, a0, '', '', 'NILL', '', '', '', '', '', ''], true)); csv.push([R.district, st, a0, '', '', 'NILL', '', '', '', '', '', '']); rr++; }
      per.push([st, n]);
    }
    const HD = ['District Info', 'Station Call', 'Location Data (Station)', 'Vehicle', 'Vehicle Type', 'Location Data (GPS)', 'From Date', 'To Date', 'Duration', 'Reasons', 'Emergency Status', 'Remarks'];
    return {
      name: 'Staff App Out of Sync ' + date, count: total, cards: [['Out-of-sync records', total], ...per], warn: '',
      rule: R.vehicleType + '  |  ' + R.status + '  |  Reason contains "' + R.reason + '"  |  Duration >= ' + R.minHours + ' hr',
      widths: [14, 11, 38, 10, 11, 12, 14, 14, 11, 38, 13, 10].map(w => w * 7),
      rows: [[cl(R.title + ', Dated ' + date, 'color:#ffffff;font-weight:bold;font-size:14pt;background:#2e7d32;height:28px;', { cs: 12 })],
        [cl(R.subtitle, 'font-weight:bold;font-size:11pt;background:#c8e6c9;height:22px;', { cs: 12 })],
        HD.map(x => cl(x, 'color:#ffffff;font-weight:bold;font-size:9pt;background:#43a047;height:30px;')), ...sheet],
      csv: [HD, ...csv]
    };
  }

  window.REPORTS.staff = {
    label: 'Staff App Not Sync', input: 'file', fileLabel: 'Staff App', hint: 'Staff App',
    detect: (rows, H) => H.some(h => h.includes('station call sign')),   // how this CSV is recognised
    run: staffApp
  };
})();
