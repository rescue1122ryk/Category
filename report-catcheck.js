/* =====================================================================
   report-catcheck.js  -  Category Checker tab
   Pick a disease / subtype and see its correct category.
   A password-protected button can move it to another category for good:
     1) the change is used at once and remembered in this browser, and
     2) the page offers to write it into categories-config.js
        (Chrome / Edge: pick the file once and it is updated directly;
         other browsers: the updated file is downloaded - replace the old one).
   The password is not written here in plain text, only as a code (passwordHash).
   To change the password, replace passwordHash with the code of the new password.
   This file is independent: it does not affect the other reports.
   ===================================================================== */
(function () {
  const CONFIG = {
    passwordHash: "a7c7a36fef5e1",
    storageKey:   "rescue1122_category_changes"
  };

  const $ = id => document.getElementById(id);
  const h53 = (s, seed = 0) => { let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed; for (let i = 0, ch; i < s.length; i++) { ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16); };
  const loadCh = () => { try { return JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}'); } catch (e) { return {}; } };
  const saveCh = o => { try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(o)); } catch (e) { } };
  const COLORS = { 'Life Threatening': '#c2281c', 'Urgent': '#d9731a', 'Less Urgent': '#b8960b', 'Non-emergency': '#1f8a4c' };

  /* move a subtype into one category (used at page load and after a change) */
  function applyMove(name, cat) {
    const n = norm(name);
    for (const k of Object.keys(CFG.categories)) CFG.categories[k] = CFG.categories[k].filter(x => norm(x) !== n);
    CFG.categories[cat].push(name);
    for (const a of Object.keys(CFG.aliases || {})) if (norm(a) === n) delete CFG.aliases[a];
  }
  if (CFG) Object.entries(loadCh()).forEach(([n, c]) => { if (CFG.categories[c]) applyMove(n, c); });

  function find(name) {
    const n = norm(name); if (!n) return null;
    const inLists = m => Object.keys(CFG.categories).filter(c => CFG.categories[c].some(x => norm(x) === m));
    let cats = inLists(n), via = '';
    if (!cats.length) { const al = Object.entries(CFG.aliases || {}).find(([a]) => norm(a) === n); if (al) { via = al[1]; cats = inLists(norm(al[1])); } }
    return { cats, via };
  }

  /* edit the text of categories-config.js: remove the name everywhere, add it to the new category */
  function editConfig(text, name, cat) {
    const n = norm(name), q = name.replace(/"/g, '\\"'), out = []; let blk = '', inAl = false, added = false;
    for (const line of text.split('\n')) {
      let m;
      if (!blk && !inAl && (m = line.match(/^\s*"([^"]+)"\s*:\s*\[/)) && CFG.categories[m[1]]) blk = m[1];
      else if (!blk && /^\s*aliases\s*:\s*\{/.test(line)) inAl = true;
      else if (blk && /^\s*\]/.test(line)) {
        if (blk === cat) {
          for (let j = out.length - 1; j >= 0 && !/\[/.test(out[j]); j--) {   // make sure the previous name ends with a comma
            const mm = out[j].match(/^(\s*"[^"]*")(\s*,)?(\s*\/\/.*)?$/);
            if (mm) { if (!mm[2]) out[j] = mm[1] + ',' + (mm[3] || ''); break; }
          }
          out.push('      "' + q + '",'); added = true;
        }
        blk = '';
      }
      else if (inAl && /^\s*\}/.test(line)) inAl = false;
      else if (blk && (m = line.match(/^\s*"([^"]*)"\s*,?\s*(\/\/.*)?$/)) && norm(m[1]) === n) continue;
      else if (inAl && (m = line.match(/^\s*"([^"]+)"\s*:\s*"[^"]*"\s*,?\s*$/)) && norm(m[1]) === n) continue;
      out.push(line);
    }
    if (!added) throw new Error('Category "' + cat + '" was not found in the file.');
    return out.join('\n');
  }

  const readInput = () => new Promise((res, rej) => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.js'; i.onchange = () => i.files[0] ? i.files[0].text().then(res, rej) : rej(new Error('No file chosen')); i.click(); });
  async function writeFile(name, cat) {
    if (window.showOpenFilePicker) {
      try {
        const [fh] = await window.showOpenFilePicker({ types: [{ description: 'categories-config.js', accept: { 'text/javascript': ['.js'] } }] });
        const next = editConfig(await (await fh.getFile()).text(), name, cat);
        const w = await fh.createWritable(); await w.write(next); await w.close(); return 'saved';
      } catch (e) { if (e.name === 'AbortError') return 'cancelled'; if (/not found in the file/.test(e.message)) throw e; }
    }
    const next = editConfig(await readInput(), name, cat);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([next], { type: 'text/javascript' })); a.download = 'categories-config.js'; a.click();
    return 'downloaded';
  }

  function render() {
    $('cc_to').innerHTML = Object.keys(CFG.categories).map(c => `<option>${esc(c)}</option>`).join('');
    update();
  }
  /* drop-down list: every known name when empty, names starting with the typed letters first */
  const allNames = () => { const s = new Set(); Object.values(CFG.categories).forEach(l => l.forEach(x => s.add(x))); Object.keys(CFG.aliases || {}).forEach(x => s.add(x)); return [...s].sort((a, b) => a.localeCompare(b)); };
  let act = -1;
  function showDD() {
    const q = $('cc_in').value.trim().toLowerCase(), all = allNames();
    const list = q ? [...all.filter(x => x.toLowerCase().startsWith(q)), ...all.filter(x => !x.toLowerCase().startsWith(q) && x.toLowerCase().includes(q))] : all;
    act = -1;
    $('cc_dd').innerHTML = list.map(x => `<div data-v="${esc(x)}"><span>${esc(x)}</span><small>${esc((find(x) || { cats: [] }).cats.join(' / '))}</small></div>`).join('');
    $('cc_dd').hidden = !list.length;
  }
  function pick(v) { $('cc_in').value = v; $('cc_dd').hidden = true; update(); }
  function update() {
    const v = $('cc_in').value.trim(), r = find(v), box = $('cc_res');
    $('cc_chg').hidden = !v; $('cc_msg').textContent = '';
    if (!v) { box.innerHTML = '<span class="mu">Type or choose a disease / subtype above.</span>'; return; }
    const badge = (t, c) => `<span class="cc-b" style="background:${c}">${esc(t)}</span>`;
    box.innerHTML = r.cats.length
      ? `<b>${esc(v)}</b> &rarr; ${r.cats.map(c => badge(c, COLORS[c] || '#555')).join(' ')}` + (r.cats.length > 1 ? ' <span class="mu">(both are accepted)</span>' : '') + (r.via ? ` <span class="mu">(same as ${esc(r.via)})</span>` : '')
      : `<b>${esc(v)}</b> &rarr; ${badge('Not in list', '#777')} <span class="mu">You can add it to a category below.</span>`;
    const first = r.cats[0]; if (first && r.cats.length === 1) $('cc_to').value = first;
  }

  function init() {
    const st = document.createElement('style');
    st.textContent = '.cc-b{color:#fff;padding:5px 14px;border-radius:20px;font-weight:700}#cc_res{font-size:18px;margin:16px 0;line-height:2}.cc-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px}.cc-row input,.cc-row select{padding:9px 12px;border:1px solid var(--bd);border-radius:10px;background:var(--card);color:inherit;font-size:15px}';
    st.textContent += '.cc-wrap{position:relative;flex:1;min-width:300px}.cc-dd{position:absolute;left:0;right:0;top:100%;margin-top:4px;max-height:320px;overflow:auto;background:var(--card);border:1px solid var(--bd);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.18);z-index:30}.cc-dd div{padding:9px 14px;cursor:pointer;display:flex;justify-content:space-between;gap:12px}.cc-dd div small{color:var(--mu)}.cc-dd div:hover,.cc-dd div.act{background:rgba(25,163,84,.15)}';
    document.head.appendChild(st);
    const d = document.createElement('div'); d.id = 'panel_catcheck'; d.className = 'ownpanel card'; d.hidden = true;
    d.innerHTML = `<button class="cc-back" id="cc_back">&larr; Back to reports</button>
      <h3>Category Checker</h3><p class="mu">Choose a disease / subtype to see which category it belongs to.</p>
      <div class="cc-row"><div class="cc-wrap"><input id="cc_in" placeholder="Click here or type the first letter, e.g. B" style="width:100%;box-sizing:border-box" autocomplete="off"><div id="cc_dd" class="cc-dd" hidden></div></div></div>
      <div id="cc_res"></div>
      <div id="cc_chg" hidden><hr style="border:0;border-top:1px solid var(--bd)"><b>Change its category permanently</b>
        <div class="cc-row"><select id="cc_to"></select><input id="cc_pw" type="password" placeholder="Password" autocomplete="off"><button class="p" id="cc_go">Change category</button></div>
        <div id="cc_msg" class="mu" style="margin-top:10px"></div></div>`;
    $('tabCheck').insertAdjacentElement('beforebegin', d);
    $('tab_check').after($('tab_catcheck'));
    $('cc_in').addEventListener('input', () => { showDD(); update(); });
    $('cc_back').onclick = () => { showTab(''); window.scrollTo(0, 0); };
    $('cc_in').addEventListener('focus', showDD); $('cc_in').addEventListener('click', showDD);
    $('cc_in').addEventListener('blur', () => setTimeout(() => $('cc_dd').hidden = true, 150));
    $('cc_dd').addEventListener('mousedown', e => { const r = e.target.closest('[data-v]'); if (r) { e.preventDefault(); pick(r.dataset.v); } });
    $('cc_in').addEventListener('keydown', e => {
      const rows = [...$('cc_dd').children];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if ($('cc_dd').hidden) showDD(); act = Math.max(0, Math.min(rows.length - 1, act + (e.key === 'ArrowDown' ? 1 : -1))); rows.forEach((r, i) => r.classList.toggle('act', i === act)); if (rows[act]) rows[act].scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter' && act >= 0 && rows[act]) { e.preventDefault(); pick(rows[act].dataset.v); }
      else if (e.key === 'Escape') $('cc_dd').hidden = true;
    });
    $('cc_go').onclick = async () => {
      const name = $('cc_in').value.trim(), cat = $('cc_to').value, msg = $('cc_msg');
      if (h53($('cc_pw').value) !== CONFIG.passwordHash) { msg.style.color = '#c2281c'; msg.textContent = 'Wrong password. Nothing was changed.'; return; }
      msg.style.color = ''; $('cc_pw').value = '';
      let how = 'cancelled';
      try { how = await writeFile(name, cat); } catch (e) { msg.textContent = 'File not updated: ' + e.message; }
      applyMove(name, cat);
      const ch = loadCh(); if (how === 'saved' || how === 'downloaded') delete ch[name]; else ch[name] = cat; saveCh(ch);
      render(); $('cc_in').value = name; update();
      $('cc_msg').style.color = '#1f8a4c';
      $('cc_msg').textContent = '"' + name + '" is now in ' + cat + '. ' + (how === 'saved' ? 'categories-config.js was updated.' : how === 'downloaded' ? 'Replace your old categories-config.js with the downloaded file.' : 'Saved in this browser only (the file was not updated). Upload the trips CSV again to re-check.');
    };
  }

  window.REPORTS.catcheck = { label: 'Category Checker', own: true, alwaysOn: true, render, init, reset: () => { const i = $('cc_in'); if (i) { i.value = ''; update(); } }, _edit: editConfig };
})();
