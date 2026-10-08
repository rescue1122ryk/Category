/* =====================================================================
   vehicles-config.js  -  Vehicle to Tehsil list
   Add every vehicle registration under the tehsil it belongs to.
   Keep it in the same folder as emergency-category-checker.html.
   ===================================================================== */

window.VEHICLE_CONFIG = {

  /* ---- 1) VEHICLES PER TEHSIL ---------------------------------------
     Tehsil names must match the "Tehsil Name" column in the CSV.
     If a trip's vehicle is listed under a different tehsil than the one
     written in the CSV, it is marked wrong and the correct tehsil is
     suggested. A vehicle that is in no list shows as "Not in list".
     A vehicle may be listed under more than one tehsil; the trip is
     then correct if the CSV tehsil matches any of them.
     NOTE: "RYA05" and "RYA-05" are treated as the same vehicle.
  ------------------------------------------------------------------ */
  tehsils: {
    "Rahim Yar Khan": [
      "RYA-01", "RYA-02", "RYA-03", "RYA-24", "RYA-34", "RYA05", "RYA-11", "RYA-12",
      "RYA-13", "RYA-14", "RYB-17", "RYF-01", "RYF-02", "RYB-28", "RYF-03", "RYF-04",
      "RYF-05", "RYR-01", "RYR-02", "RYB-01", "RYB-02", "RYB-03", "RYB-05", "RYB-06",
      "RYB-08", "RYB-09", "RYB-10", "RYB-11", "RYB-12", "RYB-13", "RYB-14", "RYB-15",
      "RYB-16", "RYB-19", "RYB-20", "RYB-21", "RYB-22", "RYB-23", "RYB-24", "RYB-25",
      "RYB-30", "RYB-31", "RYB-32", "RYB-33", "RYB-52", "RYB-35", "RYB-36", "RYB-37",
      "RYB-38", "RYB-39", "RYB-40", "RYB-41", "RYB-42", "RYB-43", "RYB-44", "RYB-45",
      "RYB-46", "RYB-47", "RYB-48", "RYB-49", "RYB-50"
    ],
    "Sadiqabad": [
      "RYA-04", "RYA-07", "RYA-18", "RYA-06", "RYA-15", "RYA-19", "RYA-08", "RYA-20",
      "SDF-01", "SDF-02", "SDR-01", "RYA-23", "RYA-09", "RYB-04", "RYB-07", "RYB-26",
      "RYB-27", "RYB-29", "RYB-34"
    ],
    "Khanpur": [
      "RYB-18", "RYA-05", "RYA-28", "RYA-35", "RYA-25", "RYA-16", "RYA-17",
      "RYA-26", "RYA-27", "KPF-01", "KPR-01"
    ],
    "Liaqatpur": [
      "RYA-10", "RYA-21", "RYA-22", "RYA-36", "RYA-30", "LPA-06", "RYA-32", "LPA-08",
      "RYA-33", "RYA-29", "LPF-01", "LPR-01"
    ]
  },

  /* ---- 2) CSV column names ----------------------------------------- */
  columns: {
    vehicle: "Vehicle Reg No",
    tehsil:  "Tehsil Name"
  },

  /* ---- 3) Names of the new CSV columns ----------------------------- */
  outputColumns: {
    status:  "Vehicle Check",
    correct: "Correct Tehsil (Vehicle)"
  }
};
