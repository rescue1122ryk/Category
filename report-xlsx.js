/* =====================================================================
   report-xlsx.js  -  Reads .xlsx files and writes .xlsx files (no internet needed)
   Used by report-pts.js (PTS Report: reads the two referral Excel files and
   downloads the 3 sheets as one .xlsx). You normally do NOT need to edit this file.
     XLSX_IO.read(arrayBuffer)  -> Promise of rows (array of arrays) of the first visible sheet
     XLSX_IO.write(sheets)      -> Uint8Array of an .xlsx file
       sheets = [{ name, widths: [px...], rows: [[{ v, s, cs, rs }]] }]   (same cells as the report sheets)
       s understands: font-weight:bold; font-size:Npt; color:#hex; background:#hex;
                      text-align:left|center|right; height:Npx; border:0
   ===================================================================== */
(function () {
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8');

  /* ---------------- zip (reading with inflate, writing with "store") ---------------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];

  function zip(files) {
    const out = [], cd = []; let off = 0;
    for (const f of files) {
      const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      const lh = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0)]);
      out.push(lh, nm, f.data);
      cd.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
      off += lh.length + nm.length + sz;
    }
    const cdSize = cd.reduce((a, b) => a + b.length, 0);
    const end = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), ...u16(0)]);
    const parts = [...out, ...cd, end], all = new Uint8Array(parts.reduce((a, b) => a + b.length, 0)); let p = 0;
    for (const b of parts) { all.set(b, p); p += b.length; }
    return all;
  }

  async function inflateRaw(u8) {
    const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  function unzip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf); let e = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('This is not a valid .xlsx file.');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const map = {};
    for (let i = 0; i < n; i++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      map[name] = async () => {
        const lnl = dv.getUint16(off + 26, true), lel = dv.getUint16(off + 28, true), st = off + 30 + lnl + lel, raw = u8.subarray(st, st + csize);
        return method === 0 ? raw : inflateRaw(raw);
      };
      p += 46 + nl + el + cl;
    }
    return map;
  }

  /* ---------------- reading ---------------- */
  const unesc = s => s.replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const texts = x => [...x.replace(/<rPh[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => unesc(m[1])).join('');
  const colNo = s => { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n; };

  async function read(buf) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open .xlsx files. Use a newer Chrome / Edge / Firefox, or save the file as CSV.');
    const z = unzip(buf), get = async n => z[n] ? dec.decode(await z[n]()) : '';
    // find the first visible sheet
    const wbx = await get('xl/workbook.xml'), rel = await get('xl/_rels/workbook.xml.rels'); let target = 'worksheets/sheet1.xml';
    for (const m of wbx.matchAll(/<sheet\b([^>]*)\/?>/g)) {
      if (/state="(hidden|veryHidden)"/.test(m[1])) continue;
      const id = (m[1].match(/r:id="([^"]+)"/) || [])[1], r = id && rel.match(new RegExp('<Relationship\\b[^>]*Id="' + id + '"[^>]*>'));
      const t = r && (r[0].match(/Target="([^"]+)"/) || [])[1]; if (t) { target = t.replace(/^\/?(xl\/)?/, ''); break; }
    }
    const ss = [...(await get('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => texts(m[1]));
    const xml = await get('xl/' + target); if (!xml) throw new Error('The sheet could not be read from this .xlsx file.');
    const rows = [];
    for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const at = m[1], ref = (at.match(/\br="([A-Z]+)(\d+)"/) || []); if (!ref[1]) continue;
      const r = +ref[2] - 1, c = colNo(ref[1]) - 1, t = (at.match(/\bt="(\w+)"/) || [])[1], body = m[2] || ''; if (r > 20000) continue;
      const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1]; let val = '';
      if (t === 's') val = ss[+v] || ''; else if (t === 'inlineStr') val = texts(body); else if (t === 'str' || t === 'e') val = unesc(v || ''); else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE'; else if (v !== undefined) val = isNaN(+v) ? unesc(v) : +v;
      if (val === '') continue;
      (rows[r] = rows[r] || [])[c] = val;
    }
    for (let i = 0; i < rows.length; i++) { rows[i] = rows[i] || []; for (let j = 0; j < rows[i].length; j++) if (rows[i][j] === undefined) rows[i][j] = ''; }
    return rows;
  }

  /* ---------------- writing ---------------- */
  const esc = s => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const colName = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  const hex = c => 'FF' + c.replace('#', '').toUpperCase().padStart(6, '0').slice(-6);

  function write(sheets) {
    const fonts = ['<font><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/></font>'], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'], reg = { f: {}, l: {}, x: {} };
    const idx = (list, key, make, bucket) => { if (!(key in bucket)) { bucket[key] = list.length; list.push(make()); } return bucket[key]; };
    const styleOf = s => {
      s = s || ''; const bold = /font-weight:\s*bold/.test(s), sz = +((s.match(/font-size:\s*([\d.]+)pt/) || [])[1] || 11), col = (s.match(/(?:^|;)\s*color:\s*(#[0-9a-f]{3,6})/i) || [])[1] || '#000000';
      const bg = (s.match(/background(?:-color)?:\s*(#[0-9a-f]{6})/i) || [])[1], al = (s.match(/text-align:\s*(left|right|center)/) || [])[1] || 'center', nob = /border:\s*(0|none)/.test(s);
      const fi = idx(fonts, bold + '|' + sz + '|' + col, () => `<font>${bold ? '<b/>' : ''}<sz val="${sz}"/><color rgb="${hex(col)}"/><name val="Calibri"/></font>`, reg.f);
      const li = bg ? idx(fills, bg, () => `<fill><patternFill patternType="solid"><fgColor rgb="${hex(bg)}"/><bgColor indexed="64"/></patternFill></fill>`, reg.l) : 0;
      const key = [fi, li, nob ? 0 : 1, al].join('|');
      return idx(xfs, key, () => `<xf numFmtId="0" fontId="${fi}" fillId="${li}" borderId="${nob ? 0 : 1}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${al}" vertical="center" wrapText="1"/></xf>`, reg.x);
    };
    const used = new Set(), names = [];
    const sheetXml = sh => {
      const occ = new Set(), byRow = [], merges = [], hts = []; let maxC = 0;
      sh.rows.forEach((row, ri) => {
        let ci = 0, ht = 0; byRow[ri] = byRow[ri] || [];
        for (const c of row) {
          while (occ.has(ri + ',' + ci)) ci++;
          const cs = c.cs || 1, rs = c.rs || 1, st = styleOf(c.s);
          byRow[ri].push([ci, c, st]);
          for (let a = 0; a < rs; a++) for (let b = 0; b < cs; b++) if (a || b) { occ.add((ri + a) + ',' + (ci + b)); (byRow[ri + a] = byRow[ri + a] || []).push([ci + b, null, st]); }
          if (cs > 1 || rs > 1) merges.push(colName(ci) + (ri + 1) + ':' + colName(ci + cs - 1) + (ri + rs));
          const m = rs === 1 && /height:\s*([\d.]+)px/.exec(c.s || ''); if (m) ht = Math.max(ht, +m[1]);
          ci += cs; maxC = Math.max(maxC, ci);
        }
        hts[ri] = ht;
      });
      const rowsXml = byRow.map((cells, ri) => {
        cells = (cells || []).sort((a, b) => a[0] - b[0]);
        return `<row r="${ri + 1}"${hts[ri] ? ` ht="${(hts[ri] * 0.75).toFixed(1)}" customHeight="1"` : ''}>` + cells.map(([ci, c, st]) => {
          const ref = colName(ci) + (ri + 1);
          if (!c || c.v === '' || c.v == null) return `<c r="${ref}" s="${st}"/>`;
          return typeof c.v === 'number' ? `<c r="${ref}" s="${st}"><v>${c.v}</v></c>` : `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
        }).join('') + '</row>';
      }).join('');
      const cols = (sh.widths || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${(w / 7).toFixed(2)}" customWidth="1"/>`).join('');
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>' +
        (cols ? '<cols>' + cols + '</cols>' : '') + '<sheetData>' + rowsXml + '</sheetData>' + (merges.length ? `<mergeCells count="${merges.length}">` + merges.map(m => `<mergeCell ref="${m}"/>`).join('') + '</mergeCells>' : '') +
        '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
    };
    const sheetFiles = sheets.map(sh => { let nm = String(sh.name || 'Sheet').replace(/[\\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet', k = 2; while (used.has(nm.toLowerCase())) nm = nm.slice(0, 28) + ' ' + k++; used.add(nm.toLowerCase()); names.push(nm); return enc.encode(sheetXml(sh)); });
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills>` +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' + `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', n = sheets.length, X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const files = [
      { name: '[Content_Types].xml', data: enc.encode(X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>') },
      { name: '_rels/.rels', data: enc.encode(X + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
      { name: 'xl/workbook.xml', data: enc.encode(X + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}"><sheets>` + names.map((nm, i) => `<sheet name="${esc(nm)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>') },
      { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${n + 1}" Type="${R}/styles" Target="styles.xml"/></Relationships>`) },
      { name: 'xl/styles.xml', data: enc.encode(styles) },
      ...sheetFiles.map((d, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: d }))
    ];
    return zip(files);
  }

  window.XLSX_IO = { read, write, zip };
})();
