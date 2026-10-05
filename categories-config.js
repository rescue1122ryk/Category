/* =====================================================================
   categories-config.js  —  Standard Emergency Category list
   Is file ko Notepad / VS Code main kholein aur change karein.
   HTML page (emergency-category-checker.html) isi folder main rakhein.
   ===================================================================== */

window.CATEGORY_CONFIG = {

  /* ---- 1) STANDARD LIST (JPG ke mutabiq) ----------------------------
     Kisi emergency ko dusri category main move karna ho to uska naam
     ek list se kaat kar dusri list main paste kar dein.
     Agar ek naam do lists main ho (jaise "Domestic Injury") to dono
     categories ko SAHI maana jayega.
  ------------------------------------------------------------------ */
  categories: {

    "Life Threatening": [          // CATEGORY-I
      "Cardiac Arrest",
      "Unconscious",
      "Breathing Difficulty",
      "Severe Trauma",
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
      "Snake/Dog Bite",
      "Work/Occupational Injury",
      "Manhole",
      "SOB/Respiratory Distress",
      "Deep Well",
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
      "Blood in Stool",
      "Blood in Vomit",
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
      "Snake Emergency"
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

  /* ---- 2) ALIASES (CSV ka naam  ->  standard list ka naam) ----------
     CSV main kuch subtypes ka naam list se thora mukhtalif hota hai.
     Yahan batayein ke CSV wala naam kis standard naam ke barabar hai.
     Naya mapping add karna ho to ek line barha dein:
        "CSV wala naam": "Standard list wala naam",
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

    /* Neeche wale CSV subtypes abhi standard list main nahi hain
       ("Not in list" dikhayen ge). Inhain map karna ho to comment hata dein:
    ,"Bleeding":       "Severe Trauma"
    ,"Minor Injuries": "Sports Injury"
    ,"Bullet Injury":  "Severe Trauma"
    ,"Canal":          "Drowning Case"
    */
  },

  /* ---- 3) CHECK SE BAHAR (skip) ------------------------------------ */
  skipEmergencyTypes: ["Patient Transfer Service"],
  skipCategories:     ["PTS-Emergency"],

  /* ---- 4) CSV ke column ke naam ------------------------------------ */
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

  /* ---- 5) Naye CSV columns ke naam --------------------------------- */
  outputColumns: {
    status:  "Category Check",
    correct: "Correct Category (Standard)"
  }
};
