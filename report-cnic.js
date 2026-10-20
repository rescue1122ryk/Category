/* ---------------------------------------------------------------------------
   CNIC Print A4
   Upload the photo of a CNIC front and back (JPG / PNG). The report builds an A4 Word file with the card
   copied 4 times (back on the left, front on the right, grey, thin border), same as cnic_print.docx.
   Needs: jszip.min.js (same folder).
--------------------------------------------------------------------------- */
(function () {
  const items = [];             // every uploaded image, in the order it arrived
  let seq = 0;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const EMU = 360000;                                   // 1 cm
  const CARD_W = 3228975, CARD_H = 1985010;             // card size taken from the sample file (8.97 x 5.51 cm)

  /* ---------- image -> grey JPEG ---------- */
  async function prepare(it, grey, light) {
    const img = new Image(); img.src = it.url; await img.decode();
    const k = Math.min(1, 1500 / img.naturalWidth), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
    if (grey) {
      const d = x.getImageData(0, 0, w, h), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        let g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
        if (light) g = (g - 128) * 0.85 + 128 + 22;        // gentle version of the sample's "lighter front" (keeps the text readable)
        g = g < 0 ? 0 : g > 255 ? 255 : g; p[i] = p[i + 1] = p[i + 2] = g;
      }
      x.putImageData(d, 0, 0);
    }
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
    return new Uint8Array(await blob.arrayBuffer());
  }

  /* ---------- A4 Word file ---------- */
  const NSDECL = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const pict = (rid, id, name) => `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${CARD_W}" cy="${CARD_H}"/><wp:docPr id="${id}" name="${name}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${CARD_W}" cy="${CARD_H}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln w="3175"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;

  async function makeDocx(set, o) {
    const front = set.find(x => x.role === 'front'), back = set.find(x => x.role === 'back');
    if (!front || !back) throw new Error('One image must be Front and the other Back.');
    const fb = await prepare(front, o.grey, o.light && o.grey), bb = await prepare(back, o.grey, false);
    const left = o.order === 'ff' ? ['rId10', 'front'] : ['rId11', 'back'], right = o.order === 'ff' ? ['rId11', 'back'] : ['rId10', 'front'];   // rId10 = front, rId11 = back
    const cell = (r, i) => `<w:tc><w:tcPr><w:tcW w:w="5273" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>${pict(r[0], i, r[1] + i)}</w:p></w:tc>`;
    let rows = '', id = 1;
    for (let i = 0; i < o.copies; i++) rows += `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="3500" w:hRule="atLeast"/></w:trPr>${cell(left, id++)}${cell(right, id++)}</w:tr>`;
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NSDECL}><w:body><w:tbl><w:tblPr><w:tblW w:w="10546" w:type="dxa"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="5273"/><w:gridCol w:w="5273"/></w:tblGrid>${rows}</w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="567" w:right="680" w:bottom="567" w:left="680" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/front.jpg"/><Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/back.jpg"/></Relationships>');
    zip.file('word/document.xml', doc); zip.file('word/media/front.jpg', fb); zip.file('word/media/back.jpg', bb);
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
    const nm = (o.name || '').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_');
    return { blob, name: 'CNIC_Print_A4' + (nm ? '_' + nm : '') + '.docx' };
  }

  /* ---------- screen ---------- */
  const sets = () => { const s = []; for (let i = 0; i < items.length; i += 2) s.push(items.slice(i, i + 2)); return s; };
  const opt = { grey: true, light: true, copies: 4, order: 'bf' };
  function thumb(it) {
    return `<div style="text-align:center"><img src="${it.url}" alt="" style="width:260px;max-width:100%;border:1px solid var(--bd);border-radius:8px;display:block">
      <div class="mu" style="font-size:12px;margin:4px 0">${esc(it.file)}</div>
      <select data-role="${it.id}"><option value="front"${it.role === 'front' ? ' selected' : ''}>Front (photo side)</option><option value="back"${it.role === 'back' ? ' selected' : ''}>Back (address side)</option></select></div>`;
  }
  function render() {
    const el = $('cnicList'); if (!el) return;
    const S = sets();
    el.innerHTML = S.length ? S.map((s, i) => `<div class="card" style="margin:12px 0" data-set="${i}">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><b>CNIC ${i + 1}</b>
        <span><button data-act="swap">Swap front / back</button> <button class="p" data-act="dl"${s.length < 2 ? ' disabled' : ''}>Download Word (A4)</button> <button data-act="rm">Remove</button></span></div>
      ${s.length < 2 ? '<div class="note">Waiting for the other side of this CNIC. Upload the second image.</div>' : ''}
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px">${s.map(thumb).join('')}</div>
      <div class="bar" style="margin-top:10px"><label>Person name (for the file name, optional) <input type="search" data-name="${i}" value="${esc(s[0].pname || '')}" style="min-width:240px"></label></div></div>`).join('') : '<p class="mu">No CNIC yet. Drop the front and back pictures of a CNIC in the box at the top of the page (or use Choose files).</p>';
  }
  const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };

  (window.REPORTS = window.REPORTS || {}).cnic = {
    label: 'CNIC Print A4', sub: 'Upload CNIC front + back → Word', input: 'image', own: true, alwaysOn: true,
    addImage(file) {            // called once per picture, in upload order
      const n = items.length;
      items.push({ id: ++seq, file: file.name, url: URL.createObjectURL(file), role: /back|rear/i.test(file.name) ? 'back' : /front/i.test(file.name) ? 'front' : (n % 2 ? 'back' : 'front') });
      render(); return Promise.resolve();
    },
    init() {
      const host = $('result'); if (!host) return;
      const pn = document.createElement('div'); pn.id = 'panel_cnic'; pn.className = 'ownpanel'; pn.hidden = true;
      pn.innerHTML = `<div class="bar"><b>CNIC Print A4</b> <small class="mu">(v1)</small><span class="mu">Upload the front and back picture of a CNIC. You get an A4 Word file with 4 copies, ready to print.</span></div>
        <div class="bar"><label><input type="checkbox" id="cnicGrey" checked> Grey print (saves ink)</label>
          <label><input type="checkbox" id="cnicLight" checked> Lighten the front (photo side)</label>
          <label>Copies <select id="cnicCopies"><option>1</option><option>2</option><option>3</option><option selected>4</option></select></label>
          <label>Layout <select id="cnicOrder"><option value="bf" selected>Back | Front (as in your sample)</option><option value="ff">Front | Back</option></select></label>
          <span style="flex:1"></span><button id="cnicClear">Clear all</button></div>
        <div id="cnicMsg" style="color:var(--bad);font-weight:600"></div><div id="cnicList"></div>`;
      host.appendChild(pn);
      $('cnicGrey').onchange = e => { opt.grey = e.target.checked; $('cnicLight').disabled = !opt.grey; };
      $('cnicLight').onchange = e => opt.light = e.target.checked;
      $('cnicCopies').onchange = e => opt.copies = +e.target.value;
      $('cnicOrder').onchange = e => opt.order = e.target.value;
      $('cnicClear').onclick = () => { items.splice(0).forEach(i => URL.revokeObjectURL(i.url)); render(); };
      pn.addEventListener('change', e => { const r = e.target.dataset.role; if (r) { const it = items.find(x => x.id === +r); it.role = e.target.value; const s = sets().find(x => x.includes(it)); const o = s.find(x => x !== it); if (o && o.role === it.role) { o.role = it.role === 'front' ? 'back' : 'front'; } render(); } });
      pn.addEventListener('input', e => { const n = e.target.dataset.name; if (n != null) { const s = sets()[+n]; if (s) s[0].pname = e.target.value; } });
      pn.addEventListener('click', async e => {
        const b = e.target.closest('[data-act]'); if (!b) return; const i = +b.closest('[data-set]').dataset.set, s = sets()[i];
        if (b.dataset.act === 'rm') { s.forEach(it => { URL.revokeObjectURL(it.url); items.splice(items.indexOf(it), 1); }); render(); }
        else if (b.dataset.act === 'swap') { s.forEach(it => it.role = it.role === 'front' ? 'back' : 'front'); render(); }
        else { try { $('cnicMsg').textContent = ''; const r = await makeDocx(s, Object.assign({ name: s[0].pname }, opt)); save(r.blob, r.name); } catch (err) { console.error(err); $('cnicMsg').textContent = 'Could not build the Word file: ' + err.message; } }
      });
      render();
    },
    render() { render(); },
    _test: { makeDocx, items, opt }
  };
})();
