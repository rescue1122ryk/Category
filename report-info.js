/* =====================================================================
   report-info.js  -  Info Call Report (Call History CSV)
   Edit the settings (CONFIG) below, or the rules inside infoReport().
   This file is independent: changing it does not affect the other reports.
   Needs report-helpers.js (loaded before it in category-checker.html).

   This report reads its OWN csv file (the Call History export), not the trips CSV.
   The file is recognised by its columns: Disposition, Agent ID, Call Duration.

   Same sheet as the hand-made one:
     Sr. No | Agent ID | Agent Name | Caller Name | Caller Number | Call Received at | Call Duration | Remarks
   Anything that is not in the CSV is left empty.
   ===================================================================== */
(function () {
  /* ---- Settings ------------------------------------------------------
       Included: calls whose Disposition = disposition (oldest call first).
       Call Received at = date and time of the call, written dd/mm/yyyy h:mm
       Call Duration    = Call Duration as written in the CSV (e.g. 3m 39s)
       Remarks          = Remarks written by the agent (left empty when there is none)
       The sheet date is the most common date of the calls in the CSV.
    ------------------------------------------------------------------ */
  const CONFIG = {
    title:       "Info Call Data From 00:00 to 23:59 (Date {date})",
    disposition: "Info"
  };

  const pad2 = n => String(n).padStart(2, '0');
  const secs = s => { const m = String(s).match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
  const nice = t => (t >= 3600 ? Math.floor(t / 3600) + 'h ' : '') + Math.floor(t % 3600 / 60) + 'm ' + (t % 60) + 's';

  function infoReport(rows) {
    const R = CONFIG, head = rows[0].map(h => String(h).trim().toLowerCase());
    const get = (r, n) => { const i = head.indexOf(n.toLowerCase()); return i < 0 ? '' : String(r[i] == null ? '' : r[i]).trim(); };

    const list = [];
    for (const r of rows.slice(1)) {
      if (get(r, 'Disposition').toLowerCase() !== R.disposition.toLowerCase()) continue;
      const m = get(r, 'Call Received At').match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})[ T]+(\d{1,2}):(\d{2})/);
      list.push({
        key: m ? m[1] + m[2].padStart(2, '0') + m[3].padStart(2, '0') + m[4].padStart(2, '0') + m[5] : '',
        date: m ? pad2(m[3]) + '-' + pad2(m[2]) + '-' + m[1] : '',
        when: m ? pad2(m[3]) + '/' + pad2(m[2]) + '/' + m[1] + ' ' + (+m[4]) + ':' + m[5] : get(r, 'Call Received At'),
        id: get(r, 'Agent ID'), agent: get(r, 'Agent Name'), caller: get(r, 'Caller Name'), num: get(r, 'Caller Number'),
        dur: get(r, 'Call Duration'), rem: get(r, 'Remarks')
      });
    }
    list.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);   // oldest first, same time keeps the CSV order

    const cnt = {}; list.forEach(x => { if (x.date) cnt[x.date] = (cnt[x.date] || 0) + 1; });
    const dates = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]), date = dates[0] || '';
    const n = 8, B = 'font-size:10pt;height:26px;', GR = 'background:#e2efda;';
    const H = ['Sr. No', 'Agent ID', 'Agent Name', 'Caller Name', 'Caller Number', 'Call Received at', 'Call Duration', 'Remarks'];
    const body = list.map((x, i) => [cl(i + 1, B), cl(x.id, B), cl(x.agent, B), cl(x.caller, B), cl(x.num, B), cl(x.when, B), cl(x.dur, B), cl(x.rem, B)]);
    const total = list.reduce((a, x) => a + secs(x.dur), 0);
    /* hands the call remarks (by Emergency No) to the Tele CPR report, which reads them from window.CALL_REMARKS */
    const store = {};
    for (const r of rows.slice(1)) { const ec = get(r, 'Emergency No'), rem = get(r, 'Remarks'); if (ec && rem) (store[ec] = store[ec] || []).push(rem); }
    window.CALL_REMARKS = store;
    if (window.REPORTS.telecpr && window.REPORTS.telecpr.refresh) window.REPORTS.telecpr.refresh();
    return {
      name: 'Info Call Report ' + date, count: list.length,
      cards: [['Info calls', list.length], ['Agents', new Set(list.map(x => x.id || x.agent)).size], ['Total call time', nice(total)]],
      rule: 'Disposition: ' + R.disposition + '  |  oldest call first  |  Anything not in the CSV is left empty',
      warn: dates.length > 1 ? 'This CSV has calls of more than one date (' + dates.join(', ') + '). The sheet date is ' + date + '.' : '',
      widths: [44, 66, 140, 104, 104, 118, 80, 340],
      rows: [
        [cl(R.title.replace('{date}', date), 'font-weight:bold;font-size:16pt;height:38px;' + GR, { cs: n })],
        H.map(h => cl(h, 'font-weight:bold;font-size:11pt;height:50px;' + GR)),
        ...(list.length ? body : [[cl('No matching records found.', '', { cs: n })]])
      ],
      csv: [H, ...list.map((x, i) => [i + 1, x.id, x.agent, x.caller, x.num, x.when, x.dur, x.rem])]
    };
  }

  window.REPORTS.info = {
    label: 'Info Call Report', input: 'file', fileLabel: 'Call History', hint: 'Call History',
    detect: (rows, H) => H.includes('disposition') && H.includes('call duration') && H.includes('agent id'),
    run: infoReport
  };
})();
