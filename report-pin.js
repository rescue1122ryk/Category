/* =====================================================================
   report-pin.js  -  Pin Emergencies (HotSpot) report
   Edit the settings (CONFIG) below, or the rules inside pinEmergencies().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).
   ===================================================================== */
(function () {
  /* ---- Pin Emergencies report (HotSpot macro) -----------------------
       Columns are taken BY POSITION from the raw file (1 = column A), the
       same columns the original macro keeps after deleting the others.
       keepColumns   : raw columns kept as A, B, C, D, E in the report
                       (the 5th one is shown as a time, h:mm:ss AM/PM)
       latLngColumn  : raw column holding "lat,long" (split into F and G)
       sortKeptColumn: report column used for the descending sort (3 = C)
       lats / lons   : default pin locations. A row is highlighted (and
                       moved to the top) when its lat (4 decimals) is in
                       lats OR its long (4 decimals) is in lons.
       Duplicates are removed using the first kept column.
    ------------------------------------------------------------------ */
  const CONFIG = {
    keepColumns:    [1, 3, 5, 8, 12],
    latLngColumn:   25,
    sortKeptColumn: 3,
    lats: [28.4189, 28.421, 28.311, 28.6469, 28.9374, 28.79908, 28.7991],
    lons: [69.9194, 70.3108, 70.1267, 70.6634, 70.9406, 70.53368, 70.5337]
  };

  function pinEmergencies(rows) {
    const R = CONFIG;
    const need = Math.max(R.latLngColumn, ...R.keepColumns);
    if (rows[0].length < need) throw new Error('Pin Emergencies file: expected at least ' + need + ' columns but found ' + rows[0].length + '.');
    const pick = (r, n) => String(r[n - 1] == null ? '' : r[n - 1]).trim(), K = R.keepColumns.length;
    const HD = [...R.keepColumns.map(n => pick(rows[0], n)), pick(rows[0], R.latLngColumn), 'Long'];
    const seen = new Set(), data = [];
    for (const r of rows.slice(1)) {
      const kept = R.keepColumns.map(n => pick(r, n)); if (seen.has(kept[0])) continue; seen.add(kept[0]);
      const ll = pick(r, R.latLngColumn).split(','), lat = parseFloat(ll[0]), lng = parseFloat(ll[1]), r4 = v => Math.round(v * 1e4) / 1e4;
      const hit = (!isNaN(lat) && R.lats.some(v => Math.abs(r4(lat) - v) < 1e-9)) || (!isNaN(lng) && R.lons.some(v => Math.abs(r4(lng) - v) < 1e-9));
      data.push({ kept, lat, lng, raw: ll, hit });
    }
    const sk = R.sortKeptColumn - 1;
    data.sort((a, b) => String(b.kept[sk]).localeCompare(String(a.kept[sk]), undefined, { numeric: true, sensitivity: 'base' }));
    const ordered = [...data.filter(x => x.hit), ...data.filter(x => !x.hit)];
    const lines = ordered.map(x => { const kept = [...x.kept]; if (K >= 5) kept[4] = fmtTime12(kept[4]); return { x, cells: [...kept, isNaN(x.lat) ? (x.raw[0] || '') : x.lat.toFixed(5), isNaN(x.lng) ? (x.raw[1] || '').trim() : x.lng.toFixed(5)] }; });
    const hits = ordered.filter(x => x.hit).length, B = 'font-weight:bold;font-size:14pt;';
    return {
      name: 'Pin Emergencies ' + csvDate(rows), count: ordered.length, cards: [['Pin emergencies', ordered.length], ['Hotspot matches', hits]], warn: '',
      rule: 'Duplicates removed by "' + HD[0] + '"  |  sorted by "' + HD[sk] + '" (descending)  |  gold rows = default pin locations, moved to the top',
      widths: [22.86, 19, 22.86, 20.14, 13.86, 16, 8.43].map(w => Math.round(w * 7)),
      rows: [HD.map(x => cl(x, 'font-weight:bold;background:#f2f2f2;')),
        ...(lines.length ? lines.map(({ x, cells }) => cells.map((v, i) => cl(v, 'height:22px;' + (i === 0 || i === 2 ? B : '') + (x.hit ? 'background:#e1c864;' : '')))) : [[cl('No data found.', '', { cs: HD.length })]])],
      csv: [[...HD, 'Hotspot'], ...lines.map(({ x, cells }) => [...cells, x.hit ? 'Yes' : ''])]
    };
  }

  window.REPORTS.pin = {
    label: 'Pin Emergencies', input: 'file', fileLabel: 'Pin Emergencies', hint: 'Pin Emergencies (HotSpot)',
    detect: (rows, H) => H.length >= 26 && !(H.includes('emergency category') && H.includes('emergency subtype')) &&
      /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(String((rows[1] || [])[24] || '')),
    run: pinEmergencies
  };
})();
