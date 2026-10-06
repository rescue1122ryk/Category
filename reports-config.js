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
  }
};
