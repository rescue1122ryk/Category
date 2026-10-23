/* =====================================================================
   brief-tehsils.js  -  Tehsil letters for "Brief of the Incident"
   Rahim Yar Khan is the normal letter. Sadiqabad, Khanpur and Liaquatpur use the same letter with
   their own top-right box (diary number, office, place), their own signature boxes and their own footer.
   Change a tehsil's wording here (nothing else needs to be touched):
     diary(n, yy) : diary number line, n = the Diary No. typed on the page, yy = year (26)
     office       : office name in the top-right box
     place        : place line in the top-right box
     sign         : place written under "RESCUE & SAFETY OFFICER" in the signature box
     footer       : the last lines of the page. null = keep the Rahim Yar Khan footer
   Used by report-brief.js (loaded before it in category-checker.html).
   ===================================================================== */
(function () {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', XMLNS = 'http://www.w3.org/XML/1998/namespace';

  const TEHSILS = {
    ryk: { name: 'Rahim Yar Khan', code: 'RYK' },
    sdk: {
      name: 'Sadiqabad', code: 'SDK',
      diary: (n, yy) => 'SDK-RSO/' + n + '/' + yy + '(PES)', office: 'Rescue & Safety Officer', place: 'SADIQ ABAD', sign: 'SADIQABAD',
      footer: { address: 'Near Ghousia Chowk THQ Hospital, Sadiqabad', phone: '068-5702000, 5702001', email: 'rescue1122sdk@gmail.com' }
    },
    khp: {
      name: 'Khanpur', code: 'KHP',
      diary: (n, yy) => 'KHP-RSO/' + n + '/' + yy + ' (PES)', office: 'Rescue & Safety Officer', place: 'KHANPUR (R.Y.KHAN)', sign: 'KHANPUR',
      footer: { address: 'Near TMA Office Shahi Road, Khanpur    Office Ph: 068-5572722,', phoneLabel: 'Control Room Ph:', phone: '068-5571722', email: 'rescue1122khp@gmail.com' }
    },
    lqp: {
      name: 'Liaquatpur', code: 'LQP',
      diary: (n, yy) => 'LQP/RSO/' + n + '/' + yy + ' (PES)', office: 'RESCUE & SAFETY OFFICER', place: 'LIAQUATPUR', sign: 'LIAQUATPUR',
      footer: null          // the Liaquatpur sample letter shows the Rahim Yar Khan footer; put the Liaquatpur station address / phone / email here if it should be different
    }
  };
  const ORDER = ['ryk', 'sdk', 'khp', 'lqp'];
  /* the Rahim Yar Khan wording that is replaced */
  const RYK_FOOTER = { address: 'Behind Allama Iqbal Library, WAPDA Colony Road, Rahim Yar Khan', phone: '068-9230011, 9230183', email: 'rescue1122ryk@yahoo.com' };
  const LIFT_PARAS = 4;              // empty lines removed above the signature boxes, so the three signature boxes fit above the footer
  const SIGNATURE_GAP = 800000;      // how far (EMU, 360000 = 1 cm) the District Emergency Officer box sits below the first signature row

  /* ---------- small helpers (text can be split over several runs, so replace across runs) ---------- */
  const paraRuns = p => [...p.getElementsByTagNameNS(W, 'r')].filter(r => { let a = r.parentNode; while (a && a.localName !== 'p') a = a.parentNode; return a === p; });
  const rtext = r => [...r.children].reduce((s, c) => s + (c.localName === 't' ? c.textContent : c.localName === 'tab' ? '\t' : ''), '');
  const ptext = p => paraRuns(p).map(rtext).join('');
  function setText(r, s) {
    [...r.children].filter(c => c.localName === 't' || c.localName === 'tab').forEach(c => r.removeChild(c));
    const doc = r.ownerDocument;
    s.split('\t').forEach((part, i) => {
      if (i > 0) r.appendChild(doc.createElementNS(W, 'w:tab'));
      if (part !== '') { const t = doc.createElementNS(W, 'w:t'); t.setAttributeNS(XMLNS, 'xml:space', 'preserve'); t.textContent = part; r.appendChild(t); }
    });
  }
  function replaceIn(p, find, repl) {
    const runs = paraRuns(p), parts = runs.map(rtext), i = parts.join('').indexOf(find); if (i < 0) return false;
    let pos = 0, done = false;
    runs.forEach((r, k) => {
      const a = pos, b = pos + parts[k].length; pos = b;
      if (b > i && a < i + find.length) { const from = Math.max(i, a) - a, to = Math.min(i + find.length, b) - a; setText(r, parts[k].slice(0, from) + (done ? '' : repl) + parts[k].slice(to)); done = true; }
    });
    return true;
  }
  const replaceRe = (p, re, repl) => { const m = re.exec(ptext(p)); return m ? replaceIn(p, m[0], repl) : false; };
  const boxes = doc => [...doc.getElementsByTagNameNS(W, 'txbxContent')];
  const parasOf = el => [...el.getElementsByTagNameNS(W, 'p')];
  const numAttr = (el, name) => +el.getAttribute(name);

  /* ---------- top-right box ---------- */
  function header(doc, key) {
    const T = TEHSILS[key]; if (!T || !T.diary) return;
    const body = doc.getElementsByTagNameNS(W, 'body')[0], hidden = [];
    for (const e of [...body.children]) { if (e.localName !== 'p') continue; if (/Brief of the Incident/i.test(e.textContent)) break; hidden.push(e); }   // the old lines hidden behind the box
    const paras = boxes(doc).filter(b => /RYK\/DEO\/CRI\//.test(b.textContent)).flatMap(parasOf).concat(hidden);
    for (const p of paras) {
      const m = /No\.?\s*RYK\/DEO\/CRI\/([^\/\s]+)\/(\d+)\s*\((?:PESD|PES)\)/.exec(ptext(p));
      if (m) replaceIn(p, m[0], 'No. ' + T.diary(m[1], m[2]));
      replaceRe(p, /District Emergency Officer/i, T.office);
      replaceRe(p, /RAHIM YAR KHAN/i, T.place);
    }
  }

  /* ---------- signature boxes: left = Rescue & Safety Officer, right = Control Room Incharge, below in the middle = District Emergency Officer ---------- */
  function signatures(doc, key) {
    const T = TEHSILS[key]; if (!T || !T.sign) return;
    const runOf = b => { let a = b; while (a && a.localName !== 'r') a = a.parentNode; return a; };
    const find = re => [...new Set(boxes(doc).filter(b => re.test(b.textContent)).map(runOf).filter(Boolean))][0];
    const deoRun = find(/DISTRICT EMERGENCY OFFICER/i), criRun = find(/CONTROL ROOM INCHARG/i);
    if (!deoRun || !criRun) return false;
    const extra = deoRun.cloneNode(true);                                   // the third box: District Emergency Officer, centred below
    const texts = (run, re, b) => boxes(run).forEach(bx => parasOf(bx).forEach(p => replaceRe(p, re, b)));
    texts(criRun, /CONTROL ROOM INCHARGE/i, 'RESCUE & SAFETY OFFICER'); texts(criRun, /RAHIM YAR KHAN/i, T.sign);
    texts(deoRun, /DISTRICT EMERGENCY OFFICER/i, 'CONTROL ROOM INCHARGE');
    // size of the writing area
    const sect = doc.getElementsByTagNameNS(W, 'sectPr')[0], pgSz = sect && sect.getElementsByTagNameNS(W, 'pgSz')[0], pgMar = sect && sect.getElementsByTagNameNS(W, 'pgMar')[0];
    const colW = pgSz && pgMar ? (numAttr(pgSz, 'w:w') - numAttr(pgMar, 'w:left') - numAttr(pgMar, 'w:right')) * 635 : 6300000;
    const ids = [...doc.getElementsByTagName('*')].filter(e => e.localName === 'docPr').map(e => +e.getAttribute('id') || 0);
    let nextId = Math.max(0, ...ids) + 1;
    const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
    [...extra.getElementsByTagNameNS(WP, 'anchor')].forEach(a => {
      const cx = +a.getElementsByTagNameNS(WP, 'extent')[0].getAttribute('cx'), h = a.getElementsByTagNameNS(WP, 'positionH')[0], v = a.getElementsByTagNameNS(WP, 'positionV')[0];
      h.getElementsByTagNameNS(WP, 'posOffset')[0].textContent = String(Math.round((colW - cx) / 2));
      const vo = v.getElementsByTagNameNS(WP, 'posOffset')[0]; vo.textContent = String(+vo.textContent + SIGNATURE_GAP);
      const dp = a.getElementsByTagNameNS(WP, 'docPr')[0]; if (dp) { dp.setAttribute('id', String(nextId)); dp.setAttribute('name', 'Frame' + nextId); nextId++; }
      a.setAttribute('relativeHeight', String(+a.getAttribute('relativeHeight') + 10));
    });
    [...extra.getElementsByTagName('*')].filter(e => e.localName === 'rect' && e.getAttribute('style')).forEach(r => {      // the same box for older Word (VML)
      let s = r.getAttribute('style'); const w = /width:([\d.]+)pt/.exec(s), mt = /margin-top:(-?[\d.]+)pt/.exec(s);
      if (w) s = s.replace(/margin-left:-?[\d.]+pt/, 'margin-left:' + ((colW / 12700 - +w[1]) / 2).toFixed(1) + 'pt');
      if (mt) s = s.replace(/margin-top:-?[\d.]+pt/, 'margin-top:' + (+mt[1] + SIGNATURE_GAP / 12700).toFixed(1) + 'pt');
      r.setAttribute('style', s);
    });
    // lift the signature boxes: take away empty lines in front of them
    const pOf = r => { let a = r; while (a && a.localName !== 'p') a = a.parentNode; return a; };
    const first = (pOf(criRun).compareDocumentPosition(pOf(deoRun)) & 4) ? pOf(criRun) : pOf(deoRun);
    for (let n = LIFT_PARAS, prev = first.previousSibling; n > 0 && prev; ) {
      const cur = prev; prev = prev.previousSibling;
      if (cur.nodeType !== 1) continue;
      const blank = cur.localName === 'p' && !cur.textContent.trim() && !cur.getElementsByTagNameNS(W, 'sectPr').length && !cur.getElementsByTagName('*').length === false && ![...cur.getElementsByTagName('*')].some(e => ['drawing', 'pict', 'AlternateContent', 'sectPr'].includes(e.localName));
      if (!blank) break;
      cur.parentNode.removeChild(cur); n--;
    }
    // the text of the third box stays "DISTRICT EMERGENCY OFFICER / RAHIM YAR KHAN" (it was cloned before the first box was renamed)
    deoRun.parentNode.insertBefore(extra, deoRun.nextSibling);
    return true;
  }

  /* ---------- footer (word/footer*.xml) ---------- */
  async function footer(zip, key) {
    const T = TEHSILS[key], F = T && T.footer; if (!F) return;
    for (const name of Object.keys(zip.files).filter(n => /^word\/footer\d*\.xml$/.test(n))) {
      const d = new DOMParser().parseFromString(await zip.file(name).async('string'), 'application/xml');
      for (const p of parasOf(d)) {
        const t = ptext(p);
        if (t.includes(RYK_FOOTER.address)) replaceIn(p, RYK_FOOTER.address, F.address);
        if (t.includes(RYK_FOOTER.phone)) { if (F.phoneLabel) replaceIn(p, 'Ph:', F.phoneLabel); replaceIn(p, RYK_FOOTER.phone, F.phone); }
        if (t.includes(RYK_FOOTER.email)) replaceIn(p, RYK_FOOTER.email, F.email);
      }
      zip.file(name, new XMLSerializer().serializeToString(d));
      const rn = name.replace('word/', 'word/_rels/') + '.rels';
      if (zip.file(rn)) zip.file(rn, (await zip.file(rn).async('string')).split(RYK_FOOTER.email).join(F.email));   // the e-mail link
    }
  }

  window.BRIEF_TEHSILS = Object.assign({ order: ORDER, header, signatures, footer }, TEHSILS);
})();
