/* =====================================================================
   reports-config.js  -  Settings for the extra reports
   Keep it in the same folder as emergency-category-checker.html.
   ===================================================================== */

window.REPORTS_CONFIG = {

  /* ---- Bike Late Finish report -------------------------------------
     A trip is included when ALL of these are true:
       - Dispatched Vehicles Type is exactly one of vehicleTypes
         (so "ambulance,bike" is NOT included, only pure bike trips)
       - Fate Of Patient equals fate
       - Elapsed Time is greater than or equal to minElapsed
     Duplicate EC No rows are skipped (first one is kept).
  ------------------------------------------------------------------ */
  bikeLateFinish: {
    title:        "Motor Bike Late Finish Report",   // sheet title; the date is added automatically
    filePrefix:   "Bike Late Finish",                // download name: "<prefix> dd-mm-yyyy"
    vehicleTypes: ["bike", "buddy,bike"],
    fate:         "First Aid",
    minElapsed:   "00:40:00"                         // HH:MM:SS
  },

  /* ---- Delivery Case report ----------------------------------------
     Included: Emergency Subtype equals subtype, EC No present, and not a
     Patient Transfer / PTS trip. Duplicate EC No rows are skipped.
     The sheet date is today's date (same as the original macro).
  ------------------------------------------------------------------ */
  deliveryCase: {
    title:   "Delivery Case Emergencies of District Rahim Yar Khan",
    subtype: "Delivery Case",
    gender:  "Female"
  },

  /* ---- Long Duration report ----------------------------------------
     Included: Elapsed Time is MORE than minHours and the trip is not a
     Patient Transfer. If you change minHours, change title2 to match.
  ------------------------------------------------------------------ */
  longDuration: {
    minHours: 2,
    title1:   "Punjab Emergency Service Rescue 1122, Bahawalpur Division",
    title2:   "Long Duration Emergencies (More than 2 hours)"
  },

  /* ---- Staff App Not Sync report (uses the vehicle availability CSV) --
     Included: Vehicle Type = vehicleType, Emergency Status = status,
     Reasons contains "reason", and Duration is at least minHours.
     The title date is the From Date of the first qualifying row.
     stations: the station list (call sign: address). A station with no
     qualifying rows is shown as NILL. If the CSV has a "Station Address"
     column, that value is used instead of the address below.
  ------------------------------------------------------------------ */
  staffApp: {
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
  },

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
  pinEmergencies: {
    keepColumns:    [1, 3, 5, 8, 12],
    latLngColumn:   25,
    sortKeptColumn: 3,
    lats: [28.4189, 28.421, 28.311, 28.6469, 28.9374, 28.79908, 28.7991],
    lons: [69.9194, 70.3108, 70.1267, 70.6634, 70.9406, 70.53368, 70.5337]
  },

  /* ---- Late Accept report (vehicle response file) ------------------
     Included: Acknowledge duration is at least minMinutes.
     A repeated EC No + vehicle pair is shown once.
  ------------------------------------------------------------------ */
  lateAccept: {
    minMinutes: 5,
    district:   "Rahim Yar Khan",
    title:      "Late Accept emergency by operational staff"
  },

  /* ---- Crime Report (Crime_Emergency macro) -------------------------
     Included: Emergency Type equals emergencyType and EC No assigned.
     statuses: leave [] for all (the macro clears that filter), or e.g.
               ["Called Back", "Finished", "On Location"] to restrict.
     columns : [label shown in report, header in the trips CSV]
     leftCols: report columns (0 = first) that are left aligned.
     The sheet date is yesterday (same as the macro =TODAY()-1).
  ------------------------------------------------------------------ */
  crimeReport: {
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
  },

  /* ---- Dead Report (Dead_Victim macro) ------------------------------
     Included: Fate Of Patient is Dead and the trip is not Discarded.
     "@nature" = Subtype (Emergency Type);  "@agent" = agent column from
     categories-config.js.  A Sr. # column is added automatically.
     The sheet date is yesterday (same as the macro =TODAY()-1).
  ------------------------------------------------------------------ */
  deadVictim: {
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
  },

  /* ---- JCO Emg Count (monthly report, data kept on GitHub) ----------
     Counted per call agent ("Agent Name"): EC No assigned, each EC No once,
     and the trip types in excludeTypes are left out.
     callTypes: [] = every call type. To copy the old macro use
                ["App Call", "EMDS Call"].
  ------------------------------------------------------------------ */
  jcoCount: {
    excludeTypes: ["Patient Transfer Service"],
    callTypes:    []
  },

  /* ---- GitHub (where the monthly JCO data is saved / read) ---------
     owner / repo : your GitHub user and repository name
     folder       : folder inside the repo (created automatically)
     Do NOT write the token here. The "GitHub settings" button in the
     JCO tab asks for it and keeps it only in your own browser.
  ------------------------------------------------------------------ */
  github: {
    owner:  "rescue1122ryk",
    repo:   "Category",
    branch: "main",
    folder: "jco-data"
  }
};
