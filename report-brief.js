/* ---------------------------------------------------------------------------
   Brief of the Incident
   Upload the EMDS detail PDF (the "Caller Info / Agent Response Info / Victim" page of an emergency).
   The report reads it and fills the matching Word letter (Medical / RTA / Crime / Bullet Injury, one or many patients).
   Only the body of the letter is edited. The top-right box (diary number, office, date) is never touched.
   Needs: pdf.js, pdf.worker.js, jszip.min.js, brief-templates.js (all in the same folder).
   Tehsil letters (Sadiqabad / Khanpur / Liaquatpur): brief-tehsils.js. Without it only the Rahim Yar Khan letter is made.
--------------------------------------------------------------------------- */
(function () {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const XMLNS = 'http://www.w3.org/XML/1998/namespace';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const GLYPH = { '\uf82d': 'ctwo', '\uf0f9': 'driver', '\uf469': 'emt' };   // icons printed in front of each responder name
  const KINDNAME = { medical: 'Medical', rta: 'RTA', crime: 'Crime', bullet: 'Bullet_Injury' };
  const CAUSE = { medical: 'Medical?', rta: 'Road Traffic Crash', crime: 'Crime?', bullet: 'Bullet Injury?' };
  const items = [];            // every uploaded PDF
  let lastDate = '';           // the letter date picked last, offered again on the next card
  let seq = 0;
  let lastTehsil = 'ryk';      // the tehsil picked last, offered again on the next card (needs brief-tehsils.js)

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad2 = n => String(n).padStart(2, '0');
  const one = (re, t, d) => { const m = re.exec(t); return m ? m[1].trim() : (d == null ? '' : d); };

  /* ---------- PDF -> text lines (same idea as pdftotext -layout) ---------- */
  async function pdfText(buf) {
    if (!window.pdfjsLib) throw new Error('pdf.js could not be loaded. Keep pdf.js and pdf.worker.js in the same folder.');
    try { pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc || 'pdf.worker.js'; } catch (e) { }
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), useWorkerFetch: false, isEvalSupported: false }).promise;
    const out = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const tc = await (await pdf.getPage(n)).getTextContent();
      const its = tc.items.filter(i => i.str.trim() !== '').map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width }));
      its.sort((a, b) => b.y - a.y || a.x - b.x);
      const lines = [];
      for (const it of its) { const L = lines.find(l => Math.abs(l.y - it.y) < 3); if (L) L.items.push(it); else lines.push({ y: it.y, items: [it] }); }
      lines.sort((a, b) => b.y - a.y);
      lines.forEach(L => L.items.sort((a, b) => a.x - b.x));
      /* a value that wraps (e.g. "Tehsil Head Quarter" / "Hospital Liaqatpur") continues on the next line, starting under its label: join it back */
      for (let i = lines.length - 1; i > 0; i--) {
        const L = lines[i], prev = lines[i - 1];
        if (prev.y - L.y > 24 || L.items.some(it => /:\s*$/.test(it.s))) continue;
        const labels = prev.items.map((it, k) => ({ it, k })).filter(o => /:\s*$/.test(o.it.s));
        const col = labels.filter(o => Math.abs(o.it.x - L.items[0].x) <= 12).pop();
        if (!col || !prev.items[col.k + 1]) continue;
        prev.items[col.k + 1].s += ' ' + L.items.map(it => it.s.trim()).join(' ');
        lines.splice(i, 1);
      }
      for (const L of lines) {
        let s = '', end = null;
        for (const it of L.items) {
          if (end !== null) { const gap = it.x - end; s += gap > 4 ? '   ' : (gap > 0.6 && !/\s$/.test(s) && !/^\s/.test(it.s) ? ' ' : ''); }
          s += it.s; end = it.x + it.w;
        }
        out.push(s);
      }
      out.push('');
    }
    return out.join('\n');
  }

  /* ---------- read the fields ---------- */
  /* pdf.js can glue several fields into one line with single spaces, so a value is read "up to the next known label". */
  const LABELS = ['EC No', 'Caller Name', 'Caller No', 'Sub Emergency', 'Emergency Place', 'Emergency Status', 'Emergency Address', 'Emergency', 'District Name', 'Tehsil Name',
    'Additional Remarks', 'Husband Name', 'Father Name', 'Name', 'Age', 'Gender', 'CNIC', 'Mobile No', 'Education', 'Profession', 'Income', 'Injury', 'Cause Of Emergency',
    'Fate Of Patient', 'CPR Given', 'First Aid Given', 'Shifted To Hospital', 'Belongings handed over to', 'Address', 'Suggestion & Comments', 'Added By', 'Created At'];
  const rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ALT = LABELS.slice().sort((a, b) => b.length - a.length).map(rx).join('|');
  function fv(text, label, pre) {
    const m = new RegExp((pre || '(?:^|\\s)') + rx(label) + ':[ \\t]*(.*?)(?=\\s+(?:' + ALT + '):|[ \\t]*$)', 'm').exec(text);
    return m ? m[1].trim() : '';
  }
  function parse(t) {
    t = t.normalize('NFKC');
    if (t.replace(/\s/g, '').length < 200) throw new Error('This PDF has no readable text (it looks like a photo or scan). Use the PDF downloaded from the EMDS page.');
    if (!/Victim:/.test(t) || !/Caller Info/.test(t)) throw new Error('This does not look like the EMDS detail page (Caller Info / Victim sections not found).');
    const d = {}, head = t.split(/^\s*\d+\s+Victim:/m)[0];
    d.ec = one(/EC No:\s*(\d+)/, t);
    d.caller = fv(head, 'Caller Name'); d.callerNo = one(/Caller No:\s*(\d+)/, head);
    d.emergency = fv(head, 'Emergency', '(?:^|\\s)(?<!Sub )'); d.sub = fv(head, 'Sub Emergency');
    d.address = fv(head, 'Emergency Address');
    const a0 = t.indexOf('Agent Response Info'), a1 = t.indexOf('Vehicles Call Info');
    const agent = t.slice(a0 < 0 ? 0 : a0, a1 < 0 ? undefined : a1);
    d.callTime = one(/(\d\d:\d\d):\d\d/, agent);
    d.callDate = one(/(\d{4}\/\d\d\/\d\d)/, agent);
    let disp = t.slice(Math.max(0, t.indexOf('Dispatched Vehicle')));
    const r0 = disp.indexOf('Remarks:'); if (r0 > 0) disp = disp.slice(0, r0);
    d.vehicle = one(/^\s*([A-Z]{2,4}-\d+)/m, disp);
    d.responseMin = one(/\b(\d+)m \d+s\s+\d+m/, disp) || one(/\b(\d+)m \d+s/, disp);
    const mm = /Finished\s+(\d+)\s+(\d+)/.exec(disp);
    d.mileage = mm ? +mm[2] : 0;
    const roles = {}, lines = disp.split('\n');
    lines.forEach((ln, i) => {
      for (const g in GLYPH) if (ln.includes(g)) {
        let name = ln.split(g)[1].trim();
        for (let j = i + 1; j < lines.length && !Object.keys(GLYPH).some(x => lines[j].includes(x)); j++) {
          const c = lines[j].trim(); if (c && /^[A-Za-z][A-Za-z .']*$/.test(c)) name += ' ' + c;     // long names wrap onto a second line
        }
        roles[GLYPH[g]] = name;
      }
    });
    d.ctwo = roles.ctwo || ''; d.driver = roles.driver || ''; d.emt = roles.emt || '';
    d.patients = t.split(/^\s*\d+\s+Victim:/m).slice(1).map(p => {
      const rel = /(Husband|Father) Name:/.exec(p), cm = fv(p, 'Suggestion & Comments');
      return {
        name: fv(p, 'Name', '^\\s*'), rel: rel ? rel[1] : '', relname: rel ? fv(p, rel[1] + ' Name') : '',
        age: one(/Age:\s*(\d+)/, p), gender: fv(p, 'Gender'), injury: fv(p, 'Injury'), fate: fv(p, 'Fate Of Patient'),
        shifted: fv(p, 'Shifted To Hospital'), comments: cm,
        condition: one(/\d\d:\d\d:\d\d\s+(.+?)\s+SYS\b/, p) || one(/\d\d:\d\d:\d\d\s+(.+?)\s{2,}/, p)
      };
    });
    return d;
  }

  /* ---------- wording rules ---------- */
  const tidy = s => String(s || '').trim().replace(/\b([A-Za-z])\.(?=[A-Za-z])/g, '$1. ').split(/\s+/).filter(Boolean)
    .map(w => (w === w.toUpperCase() && w.length <= 2) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  function kindOf(d) {
    const e = (d.emergency + ' ' + d.sub).toLowerCase(), inj = d.patients.map(p => p.injury).join(' ').toLowerCase();
    if (e.includes('medical')) return 'medical';
    if (/road|traffic|rta|accident/.test(e)) return 'rta';
    if (/bullet|firing|fire arm|firearm/.test(e + ' ' + inj)) return 'bullet';
    return 'crime';
  }
  const condition = p => /^(dead|expired)$/i.test(p.fate) ? 'Absent vital signs, clinically dead.' : tidy1(p.condition);
  const tidy1 = s => { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''; };
  function shifted(p) {
    const s = p.shifted;
    if (s && s.toUpperCase() !== 'N/A') return /sheikh zayed/i.test(s) && !/khan/i.test(s) ? s + ', Rahim Yar Khan' : s;   // written exactly as in the PDF
    if (urduRefused(p.comments)) return 'No (Attendant refused to shift)';
    return 'No';
  }
  const urduRefused = c => { const r = [...c].reverse().join(''); return /مرضی|نہیں جانا|refus/i.test(c) || /مرضی|نہیں جانا/.test(r) || /یضرم|ایناج ںیہن/.test(c) || /یضرم|ایناج ںیہن/.test(r); };
  const relText = p => !p.rel ? '' : p.rel === 'Husband' ? 'W/o ' + tidy(p.relname) : (/^f/i.test(p.gender) ? 'D/o ' : 'S/o ') + tidy(p.relname);
  const phone = n => n.length === 11 ? n.slice(0, 4) + '-' + n.slice(4) : n;
  const ordinal = n => (n % 100 >= 10 && n % 100 <= 20) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  const distanceDefault = d => { const km = d.mileage / 2; return Number.isInteger(km) ? (km < 10 ? pad2(km) : String(km)) : km.toFixed(1); };   // distance = total mileage / 2 (one way)

  /* ---------- fill the Word template ---------- */
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const bodyParas = doc => [...doc.getElementsByTagNameNS(W, 'body')[0].children].filter(e => e.localName === 'p');   // direct children only: the top-right text box is never reached
  const runsOf = p => [...p.children].filter(e => e.localName === 'r');
  const runText = r => [...r.children].reduce((s, c) => s + (c.localName === 't' ? c.textContent : c.localName === 'tab' ? '\t' : ''), '');
  const paraText = p => runsOf(p).map(runText).join('');
  function setRunText(doc, r, s) {
    [...r.children].filter(c => c.localName === 't' || c.localName === 'tab').forEach(c => r.removeChild(c));
    s.split('\t').forEach((part, i) => {
      if (i > 0) r.appendChild(doc.createElementNS(W, 'w:tab'));
      if (part !== '') { const t = doc.createElementNS(W, 'w:t'); t.setAttributeNS(XMLNS, 'xml:space', 'preserve'); t.textContent = part; r.appendChild(t); }
    });
  }
  const findPara = (doc, label) => bodyParas(doc).find(p => new RegExp('^\\s*' + label, 'i').test(paraText(p)));
  function setValue(doc, label, value) {          // keep "Label:" and the gap after it, replace the rest
    const p = findPara(doc, label); if (!p) return false;
    const m = new RegExp('^(\\s*' + label + '[^:\\t]*:?[ \\t\\u00a0]*)', 'i').exec(paraText(p));
    const pre = m[1], runs = runsOf(p); let acc = '';
    for (let i = 0; i < runs.length; i++) {
      const tx = runText(runs[i]);
      if (acc.length + tx.length >= pre.length) { setRunText(doc, runs[i], pre.slice(acc.length) + value); runs.slice(i + 1).forEach(r => setRunText(doc, r, '')); return true; }
      acc += tx;
    }
    return false;
  }
  function labelOf(doc, start) { const p = findPara(doc, start); return p ? /^\s*([^:\t]+)/.exec(paraText(p))[1].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : start; }

  /* diary number + date in the top-right box (all copies of the box) and the matching hidden lines in the body */
  function setHeader(doc, diary, dateStr) {
    const [y, m, dn] = dateStr.split('-').map(Number), yy = String(y).slice(-2);
    const boxes = [...doc.getElementsByTagNameNS(W, 'txbxContent')].filter(b => /RYK\/DEO\/CRI\//.test(b.textContent));
    const paras = boxes.flatMap(b => [...b.children].filter(e => e.localName === 'p')).concat(bodyParas(doc));
    for (const p of paras) {
      const rs = runsOf(p), tx = paraText(p);
      rs.forEach(r => { const t = runText(r); if (/RESUCE/.test(t)) setRunText(doc, r, t.replace(/RESUCE/g, 'RESCUE')); });   // spelling slip that is inside the template
      if (/RYK\/DEO\/CRI\/\d+\/\d+/.test(tx)) rs.forEach(r => { const t = runText(r); if (/RYK\/DEO\/CRI\/\d+\/\d+/.test(t)) setRunText(doc, r, t.replace(/(RYK\/DEO\/CRI\/)\d+\/\d+/, '$1' + diary + '/' + yy)); });
      if (/^\s*\d{1,2}(st|nd|rd|th)\s+[A-Za-z]+,\s*\d{4}\.\s*$/.test(tx)) {
        const s = rs.findIndex(r => /^(st|nd|rd|th)$/.test(runText(r)));
        if (s > 0 && rs[s + 1]) { setRunText(doc, rs[s - 1], runText(rs[s - 1]).replace(/\d+/, String(dn))); setRunText(doc, rs[s], ordinal(dn)); setRunText(doc, rs[s + 1], ' ' + MONTHS[m - 1] + ', ' + y + '.'); }
      }
    }
  }

  async function makeDocx(it) {
    const d = it.d, P = d.patients, kind = kindOf(d), multi = P.length > 1;
    const key = (kind === 'bullet' && multi) ? 'bullet' : multi ? 'crimeN' : kind === 'medical' ? 'medical' : kind === 'rta' ? 'rta' : 'crime1';
    const zip = await JSZip.loadAsync(b64(window.BRIEF_TEMPLATES[key]));
    const xml = await zip.file('word/document.xml').async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const [yy, mo, dd] = d.callDate.split('/'), day = +dd, mon = +mo;
    if (it.diary && it.date) setHeader(doc, it.diary, it.date);
    const TH = window.BRIEF_TEHSILS, tk = (TH && it.tehsil) || 'ryk';      // Sadiqabad / Khanpur / Liaquatpur: own top-right box, signature boxes and footer
    if (TH && tk !== 'ryk') { TH.header(doc, tk); TH.signatures(doc, tk); }
    // sample-specific line in the Bullet template
    bodyParas(doc).filter(p => /^\s*\(Patients received from/i.test(paraText(p))).forEach(p => p.parentNode.removeChild(p));
    setValue(doc, 'Applicant Name', it.applicant || '____________________');
    const p0 = P[0], pv = findPara(doc, 'Victim');
    if (!multi && pv) {
      const runs = runsOf(pv), pre = /^(.*?:[ \t]*)/.exec(paraText(pv))[1];
      setRunText(doc, runs[0], pre + (tidy(p0.name) + ' ' + relText(p0)).trim() + ' ');
      if (runs[1]) setRunText(doc, runs[1], p0.age ? '    (Approx. ' + p0.age + ' Years)' : '');
      runs.slice(2).forEach(r => setRunText(doc, r, ''));
    }
    setValue(doc, 'Emergency No', 'EMDS-' + d.ec + '\t\t');
    setValue(doc, 'Date of Incident', pad2(day) + '-' + pad2(mon) + '-' + yy);
    setValue(doc, 'Call Time', d.callTime);
    setValue(doc, 'Probable cause of Emergency', CAUSE[kind] + '\t');
    const addr = d.address.charAt(0).toUpperCase() + d.address.slice(1);
    setValue(doc, 'Place of Incident', addr.replace(/,?\s*Rahim yar khan/i, ', Rahim Yar Khan'));
    setValue(doc, 'Vehicle Attended', (kind === 'bullet' || multi) && /Ambulances:/.test(paraText(findPara(doc, 'Vehicle Attended'))) ? 'Ambulances:\t' + d.vehicle : 'Ambulance:  \t' + d.vehicle);
    setValue(doc, 'Staff who dealt this emergency', tidy(d.emt) + ' (EMT), ' + tidy(d.driver) + ' (Driver)');
    setValue(doc, 'Response Time', pad2(+d.responseMin || 0) + ' Minutes');
    setValue(doc, 'Distance', (it.distance || distanceDefault(d)) + ' Km');
    setValue(doc, labelOf(doc, 'Total No. of'), pad2(P.length));
    if (!multi) { setValue(doc, 'Patient Condition', condition(p0)); setValue(doc, 'Shifted to hospital', shifted(p0)); }
    // NOTE line (keeps the small raised "th")
    const pn = bodyParas(doc).find(p => /^Rescue 1122 Control Room received/.test(paraText(p)));
    if (pn) {
      const rs = runsOf(pn), s = rs.findIndex(r => /^(st|nd|rd|th)$/.test(runText(r)));
      if (s > 0) {
        setRunText(doc, rs[s - 1], 'Rescue 1122 Control Room received a call from ' + phone(d.callerNo) + ', ' + pad2(day));
        setRunText(doc, rs[s], ordinal(day)); setRunText(doc, rs[s + 1], ' ' + MONTHS[mon - 1] + ' ' + yy + '.');
        rs.slice(s + 2).forEach(r => setRunText(doc, r, ''));
      }
    }
    // call detail row
    const re = /(\d\d:\d\d)(\s+)((?:Mr|Miss|Mrs)\.\s[^\t]*?)(\s{2,}|\t|$)/;
    for (const p of bodyParas(doc)) for (const r of runsOf(p)) { const tx = runText(r); if (re.test(tx)) setRunText(doc, r, tx.replace(re, (m, a, g, n, e) => d.callTime + g + (it.title || 'Mr.') + ' ' + tidy(d.caller) + e)); }
    // patients table
    const tbl = doc.getElementsByTagNameNS(W, 'tbl')[0];
    if (multi && tbl) {
      const rows = () => [...tbl.children].filter(e => e.localName === 'tr');
      while (rows().length - 1 < P.length) tbl.appendChild(rows().slice(-1)[0].cloneNode(true));
      while (rows().length - 1 > P.length) tbl.removeChild(rows().slice(-1)[0]);
      P.forEach((p, i) => {
        const vals = [pad2(i + 1), tidy(p.name), tidy(p.relname), p.age ? p.age + ' Y' : '', condition(p), shifted(p)];
        [...rows()[i + 1].children].filter(e => e.localName === 'tc').forEach((tc, c) => {
          const para = [...tc.children].find(e => e.localName === 'p'), rs = runsOf(para);
          if (rs.length) { setRunText(doc, rs[0], vals[c] || ''); rs.slice(1).forEach(r => setRunText(doc, r, '')); }
          else { const r = doc.createElementNS(W, 'w:r'); para.appendChild(r); setRunText(doc, r, vals[c] || ''); }
        });
      });
    }
    if (multi && tbl) {   // the template merges the Condition / Shifted cells down the table; if patients differ, un-merge so each row shows its own value
      const trs = [...tbl.children].filter(e => e.localName === 'tr').slice(1), tcs = i => trs.map(r => [...r.children].filter(e => e.localName === 'tc')[i]);
      [4, 5].forEach(ci => {
        const want = P.map(p => ci === 4 ? condition(p) : shifted(p));
        if (new Set(want).size < 2) return;
        const cells = tcs(ci), src = [...cells[0].children].find(e => e.localName === 'p');
        cells.forEach((tc, i) => {
          [...tc.getElementsByTagNameNS(W, 'vMerge')].forEach(v => v.parentNode.removeChild(v));
          if (i === 0) return;
          const np = src.cloneNode(true), old = [...tc.children].find(e => e.localName === 'p'); tc.replaceChild(np, old);
          const rs = runsOf(np); setRunText(doc, rs[0], want[i]); rs.slice(1).forEach(r => setRunText(doc, r, ''));
        });
        setRunText(doc, runsOf(src)[0], want[0]);
      });
    }
    if (TH && tk !== 'ryk') await TH.footer(zip, tk);
    zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
    const rel = relText(p0);
    const nm = tidy(p0.name).replace(/\./g, '').replace(/ /g, '_') + (rel && !multi ? '_' + rel.replace(/\./g, '').replace('W/o', 'W.O').replace('S/o', 'S.O').replace('D/o', 'D.O').replace(/ /g, '_') : '');
    return { blob, name: 'EMDS-' + d.ec + '_' + KINDNAME[kind] + '_' + nm + '_' + pad2(day) + '-' + pad2(mon) + '-' + yy + '_' + ((TH && TH[tk] && TH[tk].code) || 'RYK') + '.docx' };
  }

  /* ---------- screen ---------- */
  const $ = id => document.getElementById(id);
  function tehsilBoxes(it) {      // exactly one tehsil is ticked
    const TH = window.BRIEF_TEHSILS; if (!TH) return '';
    return '<span><b>Tehsil:</b> ' + TH.order.map(k => `<label style="margin-left:10px"><input type="checkbox" data-tehsil="${k}"${(it.tehsil || 'ryk') === k ? ' checked' : ''}> ${esc(TH[k].name)}</label>`).join('') + '</span>';
  }
  function card(it) {
    const d = it.d, P = d.patients, kind = kindOf(d);
    const miss = [];
    ['ec', 'caller', 'callerNo', 'callTime', 'callDate', 'address', 'vehicle', 'responseMin', 'emt', 'driver'].forEach(k => { if (!d[k]) miss.push(k); });
    if (!P.length) miss.push('patients'); else P.forEach((p, i) => { if (!p.name) miss.push('patient ' + (i + 1) + ' name'); });
    const rows = [['Emergency', d.emergency + (d.sub ? ' / ' + d.sub : '') + '  \u2192  ' + KINDNAME[kind].replace('_', ' ') + ' letter' + (P.length > 1 ? ' (table, ' + P.length + ' patients)' : '')],
      ['Call', d.callTime + ', ' + d.callDate + ', ' + d.caller + ' (' + phone(d.callerNo) + ')'], ['Place', d.address],
      ['Vehicle / staff', d.vehicle + ' \u2022 EMT ' + d.emt + ' \u2022 Driver ' + d.driver],
      ['Response / mileage', d.responseMin + ' min \u2022 total mileage ' + d.mileage],
      ['Patients', P.map(p => tidy(p.name) + (p.age ? ' (' + p.age + ' Y)' : '') + (p.fate ? ', ' + p.fate : '')).join('; ')]];
    return `<div class="card" style="margin:12px 0" data-id="${it.id}">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><b style="font-size:16px">EMDS-${esc(d.ec)} <span class="mu">${esc(it.file)}</span></b>
        <span><button class="p" data-act="dl">Download Word</button> <button data-act="rm">Remove</button></span></div>
      ${miss.length ? `<div class="note">Not found in the PDF: ${esc(miss.join(', '))}. Check the Word file before using it.</div>` : ''}
      <div class="note" style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-top:10px;font-size:15px;border:2px solid #e8b923">
        <b>Fill before download:</b>
        <label>Diary No. <input type="search" data-f="diary" value="${esc(it.diary)}" placeholder="e.g. 445" inputmode="numeric" style="min-width:110px;width:120px;font-size:16px"></label>
        ${tehsilBoxes(it)}
        <label>Letter date (click to open calendar) <input type="date" data-f="date" value="${esc(it.date)}" style="padding:8px 10px;border:1px solid var(--bd);border-radius:9px;background:var(--card);color:var(--tx);font:inherit;font-size:16px"></label>
      </div>
      <table class="two" style="width:100%;margin-top:8px;border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="width:150px;color:var(--mu)">${k}</td><td style="text-align:left;font-weight:600">${esc(v)}</td></tr>`).join('')}</table>
      <div class="bar" style="margin-top:10px">
        <label>Applicant name <input type="search" data-f="applicant" value="${esc(it.applicant)}" placeholder="e.g. Abu Bakar Siddique S/o Muhammad Siddique" style="min-width:320px"></label>
        <label>Caller <select data-f="title"><option${it.title === 'Mr.' ? ' selected' : ''}>Mr.</option><option${it.title === 'Miss.' ? ' selected' : ''}>Miss.</option><option${it.title === 'Mrs.' ? ' selected' : ''}>Mrs.</option></select></label>
        <label>Distance (Km) <input type="search" data-f="distance" value="${esc(it.distance)}" style="min-width:70px;width:80px"></label>
      </div></div>`;
  }
  function render() {
    const el = $('briefList'); if (!el) return;
    el.innerHTML = items.length ? items.map(card).join('') : '<p class="mu">No PDF yet. Drop the EMDS detail PDF(s) in the box at the top of the page (or use Choose files).</p>';
    $('briefAll').hidden = items.length < 2;
  }
  function save(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  async function download(it) {
    if (!it.diary || !it.date) {   // diary number and letter date are always asked, never guessed
      $('briefMsg').textContent = 'EMDS-' + it.d.ec + ': enter the Diary No. and choose the letter date (calendar) first.';
      const c = document.querySelector('[data-id="' + it.id + '"] [data-f="' + (it.diary ? 'date' : 'diary') + '"]'); if (c) { c.focus(); try { if (c.type === 'date') c.showPicker(); } catch (e) { } }
      return false;
    }
    try { const r = await makeDocx(it); save(r.blob, r.name); $('briefMsg').textContent = ''; return true; }
    catch (e) { $('briefMsg').textContent = 'Could not build the Word file: ' + e.message; return false; }
  }

  (window.REPORTS = window.REPORTS || {}).brief = {
    label: 'Brief of the Incident', sub: 'Upload EMDS PDF \u2192 Word letter', input: 'pdf', own: true, alwaysOn: true,
    async addPdf(file) {
      const d = parse(await pdfText(await file.arrayBuffer()));
      const old = items.findIndex(x => x.d.ec === d.ec); if (old >= 0) items.splice(old, 1);   // same EC uploaded again replaces the old one
      items.push({ id: ++seq, file: file.name, d, applicant: '', title: 'Mr.', distance: distanceDefault(d), diary: '', date: lastDate, tehsil: lastTehsil });
      render();
    },
    init() {
      const host = document.getElementById('result'); if (!host) return;
      const pn = document.createElement('div'); pn.id = 'panel_brief'; pn.className = 'ownpanel'; pn.hidden = true;
      pn.innerHTML = '<div class="bar"><b>Brief of the Incident</b> <small class="mu">(v2: diary no. + date)</small><span class="mu">Upload the EMDS detail PDF. The matching Word letter is filled for you. Enter the Diary No. and pick the letter date for each letter; they go into the box at the top right.</span><span style="flex:1"></span><button class="p" id="briefAll" hidden>Download all Word files</button></div><div id="briefMsg" style="color:var(--bad);font-weight:600"></div><div id="briefList"></div>';
      host.appendChild(pn);
      pn.addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b) return; const id = +b.closest('[data-id]').dataset.id, it = items.find(x => x.id === id);
        if (b.dataset.act === 'dl') download(it); else { items.splice(items.indexOf(it), 1); render(); }
      });
      pn.addEventListener('input', e => { const f = e.target.dataset.f; if (!f) return; const it = items.find(x => x.id === +e.target.closest('[data-id]').dataset.id); if (it) { it[f] = e.target.value.trim(); if (f === 'date') lastDate = it.date; } });
      pn.addEventListener('change', e => {      // tehsil tick boxes: only one can be ticked
        const k = e.target.dataset && e.target.dataset.tehsil; if (!k) return;
        const cd = e.target.closest('[data-id]'), it = items.find(x => x.id === +cd.dataset.id); if (!it) return;
        it.tehsil = k; lastTehsil = k; cd.querySelectorAll('[data-tehsil]').forEach(c => { c.checked = c.dataset.tehsil === k; });
      });
      pn.addEventListener('click', e => { const dt = e.target.closest('input[type=date]'); if (dt) { try { dt.showPicker(); } catch (x) { } } });   // open the calendar on click
      $('briefAll').onclick = async () => { for (const it of items) { if (!(await download(it))) break; await new Promise(r => setTimeout(r, 600)); } };
      render();
    },
    render() { render(); },
    _test: { parse, pdfText, makeDocx, items }
  };
})();
