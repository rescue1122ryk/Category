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
  }
};
