/* =====================================================================
   report-crime.js  -  Crime Report (Crime_Emergency macro)
   Edit the settings (CONFIG) below, or the rules inside crimeReport().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).
   ===================================================================== */
(function () {
  /* ---- Crime Report (Crime_Emergency macro) -------------------------
       Included: Emergency Type equals emergencyType and EC No assigned.
       statuses: leave [] for all (the macro clears that filter), or e.g.
                 ["Called Back", "Finished", "On Location"] to restrict.
       columns : [label shown in report, header in the trips CSV]
       leftCols: report columns (0 = first) that are left aligned.
       The sheet date is yesterday (same as the macro =TODAY()-1).
    ------------------------------------------------------------------ */
  const CONFIG = {
    title:        "Crime Emergencies Breakup of District Rahim Yar Khan",
    emergencyType:"Crime",
    statuses:     [],
    leftCols:     [6, 7],
    columns: [
      ["Tehsil",                  "Tehsil Name"],
      ["Nature of Emergency",     "Emergency Subtype"],
      ["R.Time",                  "Response Time (HH:MM:SS)"],
      ["Time",                    "Start Time"],
      ["Vehicle",                 "Dispatched Vehicles"],
      ["First Aid/ Shifted/ Dead","Fate Of Patient"],
      ["Emergency Address",       "Emergency Address"],
      ["Emergency Place",         "Emergency Place"]
    ]
  };

  function crimeReport(rows) {
    const R = CONFIG;
    const st = (R.statuses || []).map(norm);
    return tripList(rows, R, { file: 'Crime Emergencies', card: 'Crime emergencies', sr: false, titleStyle: 'font-size:20pt;font-weight:bold;height:33px;',
      rule: 'Emergency Type: ' + R.emergencyType + '  |  EC No assigned' + (st.length ? '  |  Status: ' + R.statuses.join(' / ') : '') + '  |  Sheet date is yesterday',
      keep: (g, r) => norm(g(r, CFG.columns.type)) === norm(R.emergencyType) && (!st.length || st.includes(norm(g(r, 'Emergency Status')))) });
  }

  window.REPORTS.crime = { label: 'Crime Report', input: 'trips', run: crimeReport };
})();
