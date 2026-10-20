/* =====================================================================
   report-cnic.js  -  CNIC Print A4
   Choose the front and the back picture of a CNIC (or drop the two pictures on the upload box:
   the first one is the Front, the second one the Back) and download a Word file:
   one A4 page with 4 rows, back on the left and front on the right, black and white with a
   thin border - the same page as the hand-made cnic_print.docx.
   Edit the settings (CONFIG) below. This file is independent of the other reports.
   Needs report-xlsx.js (it also holds the zip writer used for the .docx).
   ===================================================================== */
(function () {
  /* ---- Settings (centimetres) ---------------------------------------- */
  const CONFIG = {
    rows:      4,        // copies of front + back on the page (4 fit on A4)
    cardW:     8.9,      // size of every card on the page
    cardH:     5.6,
    rowH:      6.55,     // height of one row (card + gap)
    margins:   { top: 1.6, side: 1.3, bottom: 1.0 },
    gray:      true,     // black and white (a Word picture effect: the real colours stay inside the picture)
    borderPt:  0.25,     // thin black line around every card (0 = no line)
    fileName:  "CNIC Print A4.docx",
    maxPixels: 1600      // pictures are reduced to this width/height before they are put in the Word file
  };

  const $ = id => document.getElementById(id);
  const S = { front: null, back: null, gray: CONFIG.gray };
  const EMU = 360000, TW = 567;                          // per cm: EMU and twips

  /* ---- read a picture: JPEG bytes + size (canvas makes every format and phone rotation work) ---- */
  function dims(b) {                                    // fallback when the browser cannot draw it
    if (b[0] === 0x89 && b[1] === 0x50) return { w: (b[16] << 24 | b[17] << 16 | b[18] << 8 | b[19]) >>> 0, h: (b[20] << 24 | b[21] << 16 | b[22] << 8 | b[23]) >>> 0, mime: 'image/png' };
    for (let i = 2; i < b.length - 9;) { if (b[i] !== 0xFF) { i++; continue; } const m = b[i + 1]; if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: b[i + 5] << 8 | b[i + 6], w: b[i + 7] << 8 | b[i + 8], mime: 'image/jpeg' }; i += 2 + (b[i + 2] << 8 | b[i + 3]); }
    throw new Error('This picture could not be read. Use a JPG or PNG file.');
  }
  async function prepare(file) {
    const raw = new Uint8Array(await file.arrayBuffer()), url = URL.createObjectURL(new Blob([raw], { type: file.type || 'image/jpeg' }));
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; setTimeout(() => rej(new Error('timeout')), 6000); });
      const k = Math.min(1, CONFIG.maxPixels / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
      return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: 'image/jpeg', w, h, url, name: file.name };
    } catch (e) {
      const d = dims(raw); return { bytes: raw, mime: d.mime, w: d.w, h: d.h, url, name: file.name };
    }
  }

  /* ---- the Word file ---- */
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const sizeOf = im => {                                 // fill the card box, or fit inside it when the picture has a very different shape
    const box = CONFIG.cardW / CONFIG.cardH, r = im.w / im.h; let w = CONFIG.cardW, h = CONFIG.cardH;
    if (Math.abs(r / box - 1) > 0.08) { if (r > box) h = CONFIG.cardW / r; else w = CONFIG.cardH * r; }
    return [Math.round(w * EMU), Math.round(h * EMU)];
  };
  function pic(rid, im, id, gray) {
    const [cx, cy] = sizeOf(im), ln = CONFIG.borderPt ? `<a:ln w="${Math.round(CONFIG.borderPt * 12700)}"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln>` : '';
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="Picture ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${rid}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}">${gray ? '<a:grayscl/>' : ''}</a:blip><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${ln}</pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }
  function buildDocx(front, back, gray) {
    const colW = Math.round((CONFIG.cardW + 0.3) * TW), rowH = Math.round(CONFIG.rowH * TW), M = CONFIG.margins; let id = 0;
    const cell = (rid, im) => `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>${pic(rid, im, ++id, gray)}</w:p></w:tc>`;
    let rows = ''; for (let i = 0; i < CONFIG.rows; i++) rows += `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${rowH}" w:hRule="exact"/></w:trPr>${cell('rId2', back)}${cell('rId1', front)}</w:tr>`;
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body><w:tbl><w:tblPr><w:tblW w:w="${colW * 2}" w:type="dxa"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${colW}"/><w:gridCol w:w="${colW}"/></w:tblGrid>${rows}</w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${Math.round(M.top * TW)}" w:right="${Math.round(M.side * TW)}" w:bottom="${Math.round(M.bottom * TW)}" w:left="${Math.round(M.side * TW)}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const ext = im => im.mime === 'image/png' ? 'png' : 'jpg', enc = new TextEncoder(), X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    return window.XLSX_IO.zip([
      { name: '[Content_Types].xml', data: enc.encode(X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') },
      { name: '_rels/.rels', data: enc.encode(X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>') },
      { name: 'word/_rels/document.xml.rels', data: enc.encode(X + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/front.${ext(front)}"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/back.${ext(back)}"/></Relationships>`) },
      { name: 'word/document.xml', data: enc.encode(doc) },
      { name: 'word/media/front.' + ext(front), data: front.bytes },
      { name: 'word/media/back.' + ext(back), data: back.bytes }
    ]);
  }

  /* ---- screen: slots, A4 preview, download, print ---- */
  function say(t, bad) { const m = $('cn_msg'); m.textContent = t || ''; m.style.color = bad ? '#c2281c' : ''; }
  function render() {
    for (const k of ['front', 'back']) { const b = $('cn_' + k), im = S[k]; b.innerHTML = im ? `<img src="${im.url}" alt="${k}">` : '<span class="mu">Click here or drop the picture</span>'; b.classList.toggle('on', !!im); }
    const ok = S.front && S.back; $('cn_dl').disabled = !ok; $('cn_pr').disabled = !ok; $('cn_sw').disabled = !(S.front || S.back);
    const cells = []; for (let i = 0; i < CONFIG.rows; i++) for (const k of ['back', 'front']) cells.push(S[k] ? `<img src="${S[k].url}" style="${S.gray ? 'filter:grayscale(1);' : ''}">` : '<i></i>');
    $('cn_page').innerHTML = cells.join('');
  }
  async function addImage(file) {
    const im = await prepare(file);
    if (!S.front) S.front = im; else if (!S.back) S.back = im; else { S.front = im; S.back = null; }
    say(''); render();
  }
  async function setSlot(k, file) { if (!file) return; try { S[k] = await prepare(file); say(''); render(); } catch (e) { say(file.name + ': ' + e.message, true); } }
  function download() {
    try {
      const bytes = buildDocx(S.front, S.back, S.gray), a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })); a.download = CONFIG.fileName; a.click(); say('Downloaded ' + CONFIG.fileName + '.');
    } catch (e) { say(e.message, true); }
  }
  function print() {
    const w = window.open('', '_blank'); if (!w) { say('The browser blocked the print window. Allow pop-ups for this page.', true); return; }
    let cells = ''; for (let i = 0; i < CONFIG.rows; i++) for (const k of ['back', 'front']) { const [cx, cy] = sizeOf(S[k]); cells += `<div class="c"><img src="${S[k].url}" style="width:${cx / EMU}cm;height:${cy / EMU}cm"></div>`; }
    w.document.write(`<!doctype html><title>CNIC Print A4</title><style>@page{size:A4;margin:0}body{margin:0}.g{width:${(CONFIG.cardW + 0.3) * 2}cm;margin:${CONFIG.margins.top}cm auto 0;display:grid;grid-template-columns:1fr 1fr}.c{height:${CONFIG.rowH}cm;display:flex;align-items:center;justify-content:center}img{border:${CONFIG.borderPt}pt solid #000;${S.gray ? 'filter:grayscale(1);-webkit-filter:grayscale(1);' : ''}}</style><div class="g">${cells}</div><script>onload=function(){setTimeout(function(){print()},300)}<\/script>`); w.document.close();
  }
  function init() {
    const st = document.createElement('style');
    st.textContent = '.cn-slots{display:flex;gap:16px;flex-wrap:wrap;margin:12px 0}.cn-slot{flex:1;min-width:240px}.cn-box{margin-top:6px;height:150px;border:2px dashed #19a354;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;text-align:center;padding:6px}.cn-box.on{border-style:solid}.cn-box img{max-width:100%;max-height:100%}.cn-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:10px 0}.cn-page{margin-top:14px;width:min(340px,100%);aspect-ratio:21/29.7;background:#fff;border:1px solid var(--bd);box-shadow:0 2px 10px rgba(0,0,0,.15);display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(' + CONFIG.rows + ',1fr);gap:6px 8px;padding:6% 5% 3%}.cn-page img{width:100%;height:100%;object-fit:contain;border:1px solid #000}.cn-page i{border:1px dashed #bbb}';
    document.head.appendChild(st);
    const d = document.createElement('div'); d.id = 'panel_cnic'; d.className = 'ownpanel card'; d.hidden = true;
    d.innerHTML = `<h3>CNIC Print A4</h3><p class="mu">Choose the <b>front</b> and the <b>back</b> picture of the CNIC (or drop the two pictures on the upload box: the first is the Front, the second the Back). The Word file has ${CONFIG.rows} copies of each on one A4 page: back on the left, front on the right.</p>
      <div class="cn-slots"><div class="cn-slot"><b>Front</b><div class="cn-box" id="cn_front"></div></div><div class="cn-slot"><b>Back</b><div class="cn-box" id="cn_back"></div></div></div>
      <input type="file" id="cn_file" accept="image/*" hidden>
      <div class="cn-row"><button class="p" id="cn_dl" disabled>Download Word (.docx)</button><button id="cn_pr" disabled>Print</button><button id="cn_sw" disabled>Swap front and back</button><label><input type="checkbox" id="cn_gray"${S.gray ? ' checked' : ''}> Black and white</label><button id="cn_cl">Clear</button></div>
      <div id="cn_msg" class="mu"></div><div class="cn-page" id="cn_page"></div>`;
    $('tabCheck').insertAdjacentElement('beforebegin', d);
    let slot = '';
    for (const k of ['front', 'back']) {
      const b = $('cn_' + k);
      b.onclick = () => { slot = k; $('cn_file').click(); };
      b.ondragover = e => e.preventDefault();
      b.ondrop = e => { e.preventDefault(); e.stopPropagation(); setSlot(k, e.dataTransfer.files[0]); };
    }
    $('cn_file').onchange = e => { setSlot(slot, e.target.files[0]); e.target.value = ''; };
    $('cn_sw').onclick = () => { [S.front, S.back] = [S.back, S.front]; render(); };
    $('cn_gray').onchange = e => { S.gray = e.target.checked; render(); };
    $('cn_cl').onclick = () => { S.front = S.back = null; say(''); render(); };
    $('cn_dl').onclick = download; $('cn_pr').onclick = print; render();
  }

  window.REPORTS.cnic = { label: 'CNIC Print A4', own: true, alwaysOn: true, render, init, addImage, _build: buildDocx, _prepare: prepare };
})();
