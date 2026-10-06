/* =====================================================================
   categories-config.js  —  Standard Emergency Category list
   Open this file in Notepad / VS Code to change the rules.
   Keep it in the same folder as emergency-category-checker.html.
   ===================================================================== */

window.CATEGORY_CONFIG = {

  /* ---- 1) STANDARD LIST (as per the reference sheet) ----------------------------
     To move an emergency to another category, cut its name from one
     list and paste it into another.
     If a name appears in two lists (e.g. "Domestic Injury"), both
     categories are treated as correct.
  ------------------------------------------------------------------ */
  categories: {

    "Life Threatening": [          // CATEGORY-I
      "Cardiac Arrest",
      "Unconscious",
      "Breathing Difficulty",
      "Severe Burn",
      "Drowning Case"
    ],

    "Urgent": [                    // CATEGORY-II
      "Chest Pain",
      "CVA/Stroke",
      "Asthma",
      "Spinal Injury",
      "Delivery Case",
      "Gyne Problem",
      "Shock",
      "Domestic Injury",
      "Electric Shock",
      "Crime Case",
      "Fire Case",
      "Fall",
      "Blood in Stool",
      "Blood in Vomit",
      "Snake/Dog Bite",
      "Work/Occupational Injury",
      "Manhole",
      "SOB/Respiratory Distress",
      "Deep Well",
       "Severe Trauma",
      "Lift/Room Extrication"
    ],

    "Less Urgent": [               // CATEGORY-III
      "Abdominal Pain",
      "Hypertension",
      "Hypotension",
      "Diabetic",
      "Vomiting",
      "Renal Disorder",
      "Diarrhea",
      "Allergy",
      "Anxiety",
      "Chemical/Drug Poisoning",
      "Domestic Injury",
      "Earache/Toothache",
      "Epistaxis/Nosebleed",
      "Eye Pain",
      "FBAO",
      "Food Poisoning",
      "Headache",
      "High Fever",
      "Urinary Retention",
      "Vertigo/Dizziness",
      "Animal Rescue",
      "Hazmat",
      "Animal Hit",
      "Scorpion Bite / Other Animal / Insect Bite",
      "Sports Injury",
      "Snake Emergency"            // crossed out in Cat-II and handwritten under Cat-III on the sheet
    ],

    "Non-emergency": [             // CATEGORY-IV
      "Drug Addiction",
      "Chronic Illness",
      "Epilepsy",
      "Backache",
      "Joints Pain/Muscular Pain",
      "Minor Burn Case",
      "Mass Events",
      "Building Inspection",
      "Mock Exercise",
      "Fallen Object",
      "Vehicle Extrication",
      "General Weakness"
    ]
  },

  /* ---- 2) ALIASES (CSV name  ->  standard list name) ----------
     Some subtype names in the CSV differ slightly from the standard list.
     Say here which standard name a CSV name is equal to.
     To add a mapping, add one line:
        "CSV name": "Standard list name",
  ------------------------------------------------------------------ */
  aliases: {
    "Anxiety / Psychiatric Disorder":  "Anxiety",
    "Domestic Injuries":               "Domestic Injury",
    "Animal/Bird Rescue":              "Animal Rescue",
    "Renal Disorders / Renal Colic":   "Renal Disorder",
    "Gynae Problem":                   "Gyne Problem",
    "Hypoglycemia":                    "Diabetic",
    "Hyperglycemia":                   "Diabetic",
    "Physical Assault/Violence":       "Crime Case",
    "Joints Pain":                     "Joints Pain/Muscular Pain"

    /* The CSV subtypes below are not in the standard list yet
       (they show as "Not in list"). To map them, remove the comment:
    ,"Bleeding":       "Severe Trauma"
    ,"Minor Injuries": "Sports Injury"
    ,"Bullet Injury":  "Severe Trauma"
    ,"Canal":          "Drowning Case"
    */
  },

  /* ---- 3) EXCLUDED FROM THE CHECK (skipped) ------------------------------------ */
  skipEmergencyTypes: ["Patient Transfer Service"],
  skipCategories:     ["PTS-Emergency"],

  /* ---- 4) CSV column names ------------------------------------ */
  columns: {
    subtype:  "Emergency Subtype",
    category: "Emergency Category",
    type:     "Emergency Type",
    id:       "EC No",
    agent:    "Agent Name",
    agentId:  "Agent Id",
    tehsil:   "Tehsil Name",
    received: "Call Received at"
  },

  /* ---- 5) Names of the new CSV columns --------------------------------- */
  outputColumns: {
    status:  "Category Check",
    correct: "Correct Category (Standard)"
  }
};
