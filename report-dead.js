/* =====================================================================
   report-dead.js  -  Dead Report (Dead_Victim macro)
   Edit the settings (CONFIG) below, or the rules inside deadVictim().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).
   ===================================================================== */
(function () {
  /* ---- Dead Report (Dead_Victim macro) ------------------------------
       Included: Fate Of Patient is Dead and the trip is not Discarded.
       "@nature" = Subtype (Emergency Type);  "@agent" = agent column from
       categories-config.js.  A Sr. # column is added automatically.
       The sheet date is yesterday (same as the macro =TODAY()-1).
    ------------------------------------------------------------------ */
  const CONFIG = {
    title:   "Rahim Yar Khan Report of All Dead Victim",
    fate:    "Dead",
    leftCols:[6],
    rowH:    36,
    columns: [
      ["Tehsil",                   "Tehsil Name"],
      ["Nature of Emergency",      "@nature"],
      ["Age",                      "Age"],
      ["Time of Incident",         "Start Time"],
      ["Response Time (HH:MM:SS)", "Response Time (HH:MM:SS)"],
      ["Vehicle",                  "Dispatched Vehicles"],
      ["Location",                 "Emergency Address"],
      ["Staff Name",               "@agent"]
    ]
  };

  function deadVictim(rows) {
    const R = CONFIG;
    return tripList(rows, R, { file: 'Dead Victim Report', card: 'Dead victims', sr: true, rowH: R.rowH, titleStyle: 'font-size:24pt;font-weight:bold;height:38px;background:#d0cece;',
      rule: 'Fate Of Patient: ' + R.fate + '  |  Discarded trips excluded  |  Sheet date is yesterday',
      keep: (g, r) => g(r, 'Fate Of Patient').toLowerCase().includes(R.fate.toLowerCase()) && g(r, 'Emergency Status').toLowerCase() !== 'discarded' });
  }

  window.REPORTS.dead = { label: 'Dead Report', input: 'trips', run: deadVictim };
})();
