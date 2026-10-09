/* =====================================================================
   report-telecpr.js  -  Tele CPR Report (All Dead Victims)
   Edit the settings (CONFIG) below, or the rules inside teleCprReport().
   This file is independent: changing it does not affect the other reports.
   It reads no helper functions from report-helpers.js, only the global CFG.

   Same sheet as the hand-made one:
     Sr. # | District | EC No | Nature of Emergency | TeleCPR Yes/No | Reasons for not performing tele CPR | Fate Of Patient

   Where the data comes from
     - the dead victims, EC No, nature and history: the trips CSV
     - TeleCPR Yes/No and the reason: the REMARKS the call agent wrote on the call, which are in the
       Call History CSV (upload it too, report-info.js hands them over). The trips CSV has no Tele CPR column.
   Anything that is not found is left empty to be filled in by hand.
   ===================================================================== */
(function () {
  /* ---- Settings ------------------------------------------------------
       Included: victims with Fate Of Patient = dead/expired, EC No assigned, trip not Discarded
                 (one line per victim).
       Nature of Emergency = Emergency Type (Emergency Subtype), and below it in bold the history of the
                 patient: the first text like "old history ...", "O/h ...", "H/O ..." found in the fields
                 listed in historyFields (empty when there is none).
       TeleCPR / Reasons   = from the call remark of the same EC No (Call History CSV):
                 the first remark that mentions CPR (cprWords) is the reason.
                 If it also says "ni / nahi / not / refused ..." (notDoneWords) the answer is NO, else YES.
                 No such remark = both cells stay empty.
       Fate Of Patient     = Fate Of Patient
       The sheet date is the most common date of the calls in the CSV (dd-mm-yyyy).
    ------------------------------------------------------------------ */
  const CONFIG = {
    title:         "Report of All Dead Victims Bahawalpur Division",
    deadWords:     ["dead", "expired"],
    historyFields: ["Cause Of Emergency", "First Aid Given", "Suggestion & Comments", "Clinical Diagnosis", "Treatment Provided"],
    historyRegex:  /\(?\s*(?:\bold\s+history|\bo\/h\b|\bh\/o\b|\bhistory\s+of)[^()\n]*\)?/i,
    cprWords:      /cpr/i,
    notDoneWords:  /\bni\b|\bnhi\b|\bnahi\b|\bnahe\b|\bnai\b|\bnot\b|\bno\b|refus/i
  };

  const pad2 = n => String(n).padStart(2, '0');
  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mk = (v, s, o) => Object.assign({ v: v == null ? '' : v, s: s || '' }, o || {});
  let lastRows = null;

  function teleCprReport(rows) {
    lastRows = rows;
    const R = CONFIG, head = rows[0].map(h => String(h).trim());
    const ix = n => n === '@id' ? 0 : head.indexOf(n);
    const get = (r, n) => { const i = ix(n); return i < 0 ? '' : String(r[i] == null ? '' : r[i]).trim(); };
    const remarks = window.CALL_REMARKS || null;

    const list = [], seen = new Set();
    for (const r of rows.slice(1)) {
      const ec = get(r, '@id'); if (!ec) continue;
      if (get(r, 'Emergency Status').toLowerCase() === 'discarded') continue;
      const fate = get(r, 'Fate Of Patient'), name = get(r, 'Victim Name');
      if (!R.deadWords.some(w => fate.toLowerCase().includes(w)) || !/^yes$/i.test(get(r, 'Has Victims'))) continue;
      const key = ec + '|' + name + '|' + get(r, 'Age'); if (seen.has(key)) continue; seen.add(key);

      let hist = '';
      for (const f of R.historyFields) { const m = get(r, f).match(R.historyRegex); if (m) { hist = m[0].trim(); break; } }
      const type = get(r, 'Emergency Type'), sub = get(r, 'Emergency Subtype');
      const nature = type + (sub && !/^n\/a$/i.test(sub) ? ' (' + sub + ')' : '');
      const rem = ((remarks && remarks[ec]) || []).filter(x => R.cprWords.test(x))[0] || '';
      list.push({ ec, district: get(r, 'District Name'), nature, hist, rem, tele: rem ? (R.notDoneWords.test(rem) ? 'NO' : 'YES') : '', fate });
    }

    /* sheet date = the most common date of the calls in the CSV (dd-mm-yyyy) */
    const cnt = {};
    for (const r of rows.slice(1)) {
      const m = get(r, 'Call Received at').match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
      if (m) { const d = pad2(m[3]) + '-' + pad2(m[2]) + '-' + m[1]; cnt[d] = (cnt[d] || 0) + 1; }
    }
    const date = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || '';

    const n = 7, B = 'font-size:10pt;height:40px;', hs = 'font-weight:bold;font-size:12pt;background:#d9d9d9;height:48px;';
    const body = list.map((x, i) => {
      const row = [mk(i + 1, B)];
      if (!i || list[i - 1].district !== x.district) { let k = 1; while (list[i + k] && list[i + k].district === x.district) k++; row.push(mk(x.district, 'font-size:12pt;font-weight:bold;', { rs: k, rot: true })); }
      row.push(mk(x.ec, B));
      row.push(mk(x.nature + (x.hist ? ' ' + x.hist : ''), B + 'font-size:9pt;', { h: '<div>' + esc2(x.nature) + '</div>' + (x.hist ? '<div style="font-weight:bold">' + esc2(x.hist) + '</div>' : '') }));
      row.push(mk(x.tele, B));
      row.push(mk(x.rem, B + 'font-size:9pt;direction:' + (/[؀-ۿ]/.test(x.rem) ? 'rtl' : 'ltr') + ';'));
      row.push(mk(x.fate, B));
      return row;
    });

    const H = ['Sr. #', 'District', 'EC No', 'Nature of Emergency', 'TeleCPR Yes/No', 'Reasons for not performing tele CPR', 'Fate Of Patient'];
    const yes = list.filter(x => x.tele === 'YES').length, no = list.filter(x => x.tele === 'NO').length, unk = list.length - yes - no;
    const warn = !list.length ? '' : !remarks
      ? 'TeleCPR and the reasons are not filled because the Call History CSV is not uploaded. Upload it (the agents\' call remarks are in it) and this tab updates.'
      : unk ? unk + ' of ' + list.length + ' dead victims have no tele CPR remark in the Call History CSV, so TeleCPR and the reason are left empty for them.' : '';
    return {
      name: 'Tele CPR Report ' + date, count: list.length,
      cards: [['Dead victims', list.length], ['Tele CPR: Yes', yes], ['Tele CPR: No', no], ['Not known', unk]],
      rule: 'Fate Of Patient: Dead  |  Discarded trips excluded  |  TeleCPR and reasons come from the call remarks (Call History CSV)  |  Anything not found is left empty',
      warn, widths: [46, 58, 92, 300, 78, 380, 84],
      rows: [
        [mk(R.title, 'font-weight:bold;font-size:20pt;height:44px;', { cs: n })],
        [mk('Date: ' + date, 'font-weight:bold;font-size:22pt;height:48px;', { cs: n })],
        [mk('Total Dead Victims: ' + pad2(list.length), 'font-weight:bold;font-size:14pt;background:#ffc000;height:36px;', { cs: n })],
        H.map(h => mk(h, hs)),
        ...(list.length ? body : [[mk('No matching records found.', '', { cs: n })]])
      ],
      csv: [H, ...list.map((x, i) => [i + 1, x.district, x.ec, x.nature + (x.hist ? ' ' + x.hist : ''), x.tele, x.rem, x.fate])]
    };
  }

  /* called by report-info.js when the Call History CSV is uploaded: rebuilds this report if the trips CSV is already loaded */
  function refresh() {
    try { if (lastRows && typeof D !== 'undefined' && D && D.reports) D.reports.telecpr = teleCprReport(lastRows); } catch (e) { }
  }

  window.REPORTS.telecpr = { label: 'Tele CPR Report', input: 'trips', run: teleCprReport, refresh };
})();
