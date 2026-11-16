/* Adventure: editor do mundo (modo dev). Só existe rodando no próprio computador (DEV_OK em main.js) e pede senha (hash só no localStorage).
   Abas: Mapa (ladrilhos e objetos de cada região), Monstros, NPCs, Missões e Arquivo.
   Tudo edita WORLD (game.js) na hora e grava no navegador (adventure-world); "Salvar no projeto" grava o regions.js.
   Mapa: botão esquerdo usa a ferramenta; direito/meio (ou espaço + arrastar) move a vista; roda aproxima.
   Atalhos: Ctrl+Z / Ctrl+Y desfaz e refaz, Delete apaga o selecionado, B pincel, R retângulo, G balde, I conta-gotas, V selecionar. */

const Dev = {
  tab: 'mapa', rid: 'vila', tool: 'tile', tile: '.', brush: 1, npcK: 'aldeao', mobK: 'geleia', sel: null, zoom: 2, ox: 20, oy: 20,
  undo: [], redo: [], drag: null, hover: null, picking: null, testPick: false, grid: true, objs: true, props: false, issues: null,
  mobId: null, npcId: null, questId: null, dirty: false,
};
const dcv = $('#dcv'), dg = dcv.getContext('2d');
const R = () => REGIONS[Dev.rid];
const DTOOLS = [['tile', '🖌 Pincel'], ['rect', '▭ Retângulo'], ['fill', '🪣 Balde'], ['pick', '💧 Conta-gotas'], ['select', '✋ Selecionar'],
  ['npc', '🧑 NPC'], ['spawn', '👾 Monstros'], ['portal', '🚪 Portal'], ['sign', '🪧 Placa'], ['chest', '🎁 Baú'], ['start', '🏁 Início']];
const LOOKS_MOB = ['geleia', 'lobo', 'goblin', 'arqueiro_g', 'esqueleto', 'rei'];
const half = v => Math.round(v * 2) / 2;
const uid = p => p + Math.random().toString(36).slice(2, 8);

/* ---------- Senha ---------- */
async function pbkdf2(pass, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 150000 }, k, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function devKey() {                              // só no navegador ('novo' = pediu para trocar)
  const k = store.get('adventure-devkey', null); return k && k !== 'novo' ? k : null;
}
const devUnlocked = () => { try { return sessionStorage.getItem('adventure-dev') === '1'; } catch (e) { return false; } };
function devOpen() {
  if (!DEV_OK) return;
  let ok = false; try { ok = sessionStorage.getItem('adventure-dev') === '1'; } catch (e) {}
  if (ok) return devEnter();
  show('dev'); $('#d-pane').innerHTML = ''; $('#d-pane').dataset.t = ''; dg.clearRect(0, 0, dcv.width, dcv.height);
  const L = $('#d-lock'), has = !!devKey(); L.hidden = false;
  $('#d-lock-t').textContent = has ? 'Senha do editor' : 'Crie a senha do editor';
  $('#d-pass2').hidden = has; $('#d-pass').value = $('#d-pass2').value = ''; $('#d-lock-err').textContent = ''; $('#d-pass').focus();
}
$('#d-lock-go').onclick = async () => {
  const p1 = $('#d-pass').value, key = devKey(), err = $('#d-lock-err');
  try {
    if (!key) {
      if (p1.length < 4) return err.textContent = 'Mínimo de 4 caracteres.';
      if (p1 !== $('#d-pass2').value) return err.textContent = 'As senhas não batem.';
      const salt = uid(''); store.set('adventure-devkey', { salt, hash: await pbkdf2(p1, salt) });
    } else if (await pbkdf2(p1, key.salt) !== key.hash) return err.textContent = 'Senha errada.';
  } catch (e) { return err.textContent = 'Este navegador não deixou verificar a senha (' + e.message + '). Abra por localhost.'; }
  try { sessionStorage.setItem('adventure-dev', '1'); } catch (e) {}
  $('#d-lock').hidden = true; devEnter();
};
$('#d-pass').addEventListener('keydown', e => { if (e.key === 'Enter') { if ($('#d-pass2').hidden) $('#d-lock-go').click(); else $('#d-pass2').focus(); } });
$('#d-pass2').addEventListener('keydown', e => { if (e.key === 'Enter') $('#d-lock-go').click(); });
$('#d-lock-back').onclick = () => { $('#d-lock').hidden = true; devLeave(); };

function devEnter() {
  setWorld(currentWorld()); View.forget(); Dev.sel = null; Dev.undo = []; Dev.redo = [];
  if (!REGIONS[Dev.rid]) Dev.rid = 'vila';
  show('dev'); $('#d-lock').hidden = true; devTab(Dev.tab); devResize(); devCenter(); devDraw();
}
function devLeave() { if (location.hash === '#dev') history.replaceState(null, '', location.pathname + location.search); show('title'); renderChars(); }

/* ---------- Gravar, desfazer ---------- */
let saveTimer = 0;
function devSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (JSON.stringify(WORLD) === JSON.stringify(baseWorld())) { try { localStorage.removeItem('adventure-world'); } catch (e) {} }
    else store.set('adventure-world', WORLD);
  }, 250);
  Dev.dirty = true; devStatus();
}
function devPush() { Dev.undo.push(JSON.stringify(WORLD)); if (Dev.undo.length > 80) Dev.undo.shift(); Dev.redo = []; }
function devRestore(from, to) {
  const u = from.pop(); if (!u) return; to.push(JSON.stringify(WORLD));
  setWorld(JSON.parse(u)); View.forget(); Dev.sel = null; if (!REGIONS[Dev.rid]) Dev.rid = 'vila';
  devSave(); devTab(Dev.tab); devDraw();
}
const devUndo = () => devRestore(Dev.undo, Dev.redo), devRedo = () => devRestore(Dev.redo, Dev.undo);
function changed(redrawMap) { setWorld(WORLD); if (redrawMap) View.forget(Dev.rid); devSave(); devDraw(); }   // depois de mexer em WORLD
function devStatus() { $('#d-status').textContent = Dev.dirty ? '● alterações não gravadas no projeto' : ''; }

/* ---------- Campos de formulário ---------- */
// Cada campo grava na hora: desfazer pega o estado de antes.
function fText(label, get, set, area) {
  const l = el('label', 'f'), i = el(area ? 'textarea' : 'input'); l.append(el('span', '', label), i); i.value = get() ?? '';
  i.onchange = () => { devPush(); set(i.value); changed(); }; return l;
}
function fNum(label, get, set, o = {}) {
  const l = el('label', 'f'), i = el('input'); i.type = 'number'; i.step = o.step || 1; if (o.min != null) i.min = o.min; if (o.max != null) i.max = o.max;
  l.append(el('span', '', label), i); i.value = get() ?? '';
  i.onchange = () => { let v = i.value === '' ? null : +i.value; if (v != null) { v = clamp(v, o.min ?? -1e9, o.max ?? 1e9); i.value = v; } devPush(); set(v); changed(o.map); }; return l;
}
function fSel(label, opts, get, set, o = {}) {
  const l = el('label', 'f'), s = el('select'); l.append(el('span', '', label), s);
  for (const [v, n] of opts) { const op = el('option'); op.value = v; op.textContent = n; s.append(op); }
  s.value = get() ?? ''; s.onchange = () => { devPush(); set(s.value); changed(o.map); if (o.after) o.after(); }; return l;
}
function fChk(label, get, set, o = {}) {
  const l = el('label', 'f chk'), i = el('input'); i.type = 'checkbox'; i.checked = !!get(); l.append(i, el('span', '', label));
  i.onchange = () => { devPush(); set(i.checked); changed(o.map); if (o.after) o.after(); }; return l;
}
function fColor(label, get, set) {
  const l = el('label', 'f'), i = el('input'); i.type = 'color'; i.value = get() || '#6cc84c'; l.append(el('span', '', label), i);
  i.onchange = () => { devPush(); set(i.value); changed(); if (Dev.tab === 'monstros') devTab('monstros'); }; return l;
}
const itemOpts = () => Object.entries(ITEMS).map(([k, I]) => [k, I.e + ' ' + I.n]);
// lista [item, número] editável (saques com chance em %, baús e recompensas com quantidade).
// rows é uma cópia de trabalho; commit(rows) grava no lugar certo depois de cada mudança.
function fPairs(title, rows, rerender, pct, commit = () => {}) {
  const box = el('div', 'pairs'), edit = f => { devPush(); f(); commit(rows); changed(); };
  box.append(el('b', '', title));
  rows.forEach((r, i) => {
    const line = el('div', 'pair'), s = el('select'), n = el('input'), x = el('button', 'btn small', '✕');
    for (const [v, t] of itemOpts()) { const o = el('option'); o.value = v; o.textContent = t; s.append(o); }
    s.value = r[0]; n.type = 'number'; n.min = pct ? .1 : 1; n.max = pct ? 100 : 999; n.step = pct ? .5 : 1; n.value = pct ? +(r[1] * 100).toFixed(1) : r[1];
    s.onchange = () => edit(() => r[0] = s.value);
    n.onchange = () => edit(() => r[1] = pct ? clamp(+n.value, .1, 100) / 100 : clamp(Math.round(+n.value), 1, 999));
    x.onclick = () => { edit(() => rows.splice(i, 1)); rerender(); };
    line.append(s, n, el('span', 'dim', pct ? '%' : '×'), x); box.append(line);
  });
  box.append(btn('＋ item', () => { edit(() => rows.push(['pocao', pct ? .1 : 1])); rerender(); }));
  return box;
}
const objPairs = o => Object.entries(o || {});
const pairsObj = rows => Object.fromEntries(rows.filter(r => ITEMS[r[0]]));

/* ---------- Abas ---------- */
function devTab(t) {
  Dev.tab = t; $$('#d-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  if (!devUnlocked()) return;
  const P = $('#d-pane'), keep = P.dataset.t === t ? P.scrollTop : 0; P.innerHTML = ''; P.dataset.t = t;
  ({ mapa: paneMap, monstros: paneMobs, npcs: paneNpcs, missoes: paneQuests, arquivo: paneFile })[t](P);
  P.scrollTop = keep;                              // mantém a rolagem ao redesenhar a mesma aba
  $('#dstage').classList.toggle('dim-stage', t !== 'mapa');
}
$$('#d-tabs button').forEach(b => b.onclick = () => devTab(b.dataset.t));

/* ----- Mapa ----- */
function paneMap(P) {
  const reg = R(), rs = el('select'); for (const [id, r] of Object.entries(REGIONS)) { const o = el('option'); o.value = id; o.textContent = r.n + ' (' + id + ')'; rs.append(o); }
  rs.value = Dev.rid; rs.onchange = () => { Dev.rid = rs.value; Dev.sel = null; devTab('mapa'); devCenter(); devDraw(); };
  P.append(el('h4', '', 'Região'), rs);
  const row = el('div', 'row'); row.append(btn('＋ Nova', newRegionForm), btn('⧉ Duplicar', dupRegion), btn('⚙ Propriedades', () => { Dev.props = !Dev.props; devTab('mapa'); }, Dev.props)); P.append(row);
  if (Dev.props) P.append(regionProps(reg));
  P.append(el('h4', '', 'Ferramenta'));
  const tg = el('div', 'grid'); for (const [k, n] of DTOOLS) tg.append(btn(n, () => { Dev.tool = k; Dev.picking = null; devTab('mapa'); devDraw(); }, Dev.tool === k)); P.append(tg);
  const sub = el('div', 'sub'); P.append(sub);
  if (['tile', 'rect', 'fill', 'pick'].includes(Dev.tool)) {
    const pal = el('div', 'tiles');
    for (const [ch, T] of Object.entries(TILES)) {
      const c = el('canvas'); c.width = c.height = 16; drawTile(c.getContext('2d'), ch, 0, 0, { map: [ch], kind: reg.kind, bio: reg.bio });
      const b = el('button', 'tl' + (Dev.tile === ch ? ' on' : '')); b.title = T.n + (T.s ? ' (sólido)' : '') + ' [' + ch + ']'; b.append(c);
      b.onclick = () => { Dev.tile = ch; if (Dev.tool === 'pick') Dev.tool = 'tile'; devTab('mapa'); }; pal.append(b);
    }
    sub.append(el('p', 'dim small', 'Ladrilho: ' + TILES[Dev.tile].n + (TILES[Dev.tile].s ? ' (sólido)' : '')), pal);
    if (Dev.tool === 'tile') { const r = el('div', 'row'); r.append(el('span', 'dim', 'Tamanho')); for (const n of [1, 2, 3, 5, 7]) r.append(btn(n + '', () => { Dev.brush = n; devTab('mapa'); }, Dev.brush === n)); sub.append(r); }
  } else if (Dev.tool === 'npc') sub.append(fSelPlain('Tipo', Object.keys(NPCS).map(k => [k, NPCS[k].n]), Dev.npcK, v => Dev.npcK = v));
  else if (Dev.tool === 'spawn') sub.append(fSelPlain('Monstro', Object.keys(MOBS).map(k => [k, MOBS[k].n]), Dev.mobK, v => Dev.mobK = v));
  else if (Dev.tool === 'portal') sub.append(el('p', 'dim small', 'Arraste um retângulo no mapa.'));
  P.append(el('h4', '', 'Selecionado'), selPanel());
  const vr = el('div', 'row'); vr.append(fChkPlain('Grade', () => Dev.grid, v => { Dev.grid = v; devDraw(); }), fChkPlain('Objetos', () => Dev.objs, v => { Dev.objs = v; devDraw(); })); P.append(vr);
  const ar = el('div', 'row'); ar.append(btn('🔎 Verificar', () => { Dev.issues = checkWorld(); devTab('mapa'); }), btn('▶ Testar aqui', () => { Dev.testPick = true; hint('Clique onde quer começar.'); })); P.append(ar);
  if (Dev.issues) P.append(issuesPanel());
}
function fSelPlain(label, opts, val, on) { const l = el('label', 'f'), s = el('select'); l.append(el('span', '', label), s); for (const [v, n] of opts) { const o = el('option'); o.value = v; o.textContent = n; s.append(o); } s.value = val; s.onchange = () => on(s.value); return l; }
function fChkPlain(label, get, set) { const l = el('label', 'chk'), i = el('input'); i.type = 'checkbox'; i.checked = get(); i.onchange = () => set(i.checked); l.append(i, ' ' + label); return l; }

function regionProps(reg) {
  const box = el('div', 'box2');
  box.append(fText('Nome', () => reg.n, v => reg.n = v || reg.n),
    fSel('Tipo', [['cidade', 'Cidade (segura, cura)'], ['campo', 'Campo'], ['masmorra', 'Masmorra']], () => reg.kind, v => { reg.kind = v; if (v === 'cidade') reg.safe = 1; else delete reg.safe; }, { map: 1 }),
    fSel('Bioma', Object.entries(BIOMES).map(([k, b]) => [k, b.n]), () => bioOf(reg), v => reg.bio = v, { map: 1, after: () => devTab('mapa') }),
    fNum('Nível sugerido', () => reg.lvl, v => { if (v) reg.lvl = v; else delete reg.lvl; }, { min: 0, max: 99 }),
    fSel('Clima', [['auto', 'Do bioma (' + (WEATHERS[BIOMES[bioOf(reg)].weather] || 'Nenhum') + ')'], ...Object.entries(WEATHERS)], () => reg.weather == null ? 'auto' : reg.weather, v => { if (v === 'auto') delete reg.weather; else reg.weather = v; }));
  const dk = el('label', 'f'), r = el('input'); r.type = 'range'; r.min = 0; r.max = 95; r.value = Math.round(darkOf(reg) * 100);
  const lab = el('span', '', 'Escuridão ' + r.value + '%'); dk.append(lab, r);
  r.oninput = () => lab.textContent = 'Escuridão ' + r.value + '%'; r.onchange = () => { devPush(); reg.dark = +r.value / 100; changed(); };
  box.append(dk, btn('Escuridão do bioma', () => { devPush(); delete reg.dark; changed(); devTab('mapa'); }));
  const w = el('input'), h = el('input'); w.type = h.type = 'number'; w.value = reg.map[0].length; h.value = reg.map.length; w.min = 10; h.min = 8; w.max = h.max = 200;
  const anc = el('select'); for (const [v, n] of [['tl', '↖ canto'], ['c', '✛ centro']]) { const o = el('option'); o.value = v; o.textContent = n; anc.append(o); }
  const sz = el('div', 'row'); sz.append(el('span', 'dim', 'Tamanho'), w, '×', h, anc, btn('Aplicar', () => resizeRegion(reg, clamp(+w.value, 10, 200), clamp(+h.value, 8, 200), anc.value)));
  box.append(sz);
  const rg = el('div', 'row'), ms = el('select'); for (const [k, n] of Object.entries(GEN_INFO)) { const o = el('option'); o.value = k; o.textContent = n; ms.append(o); } ms.value = bioOf(reg) in GEN_INFO ? bioOf(reg) : 'campo';
  rg.append(el('span', 'dim', 'Refazer o chão com'), ms, btn('🎲', () => { if (!confirm('Trocar todo o chão desta região pelo modelo? Objetos ficam.')) return; devPush(); const G = gen(ms.value, reg.map[0].length, reg.map.length); reg.map = G.map; reg.bio = G.bio; reg.kind = G.kind; if (G.kind === 'cidade') reg.safe = 1; else delete reg.safe; changed(1); devCenter(); devDraw(); }));
  box.append(rg, btn('🗑 Apagar região', () => {
    if (Dev.rid === 'vila') return alert('A vila é obrigatória (é onde se nasce e renasce).');
    const using = Object.entries(REGIONS).filter(([id, r]) => id !== Dev.rid && r.portals.some(p => p.to === Dev.rid)).map(([, r]) => r.n);
    if (!confirm('Apagar ' + reg.n + '?' + (using.length ? '\nPortais em ' + using.join(', ') + ' vão ficar sem destino.' : ''))) return;
    devPush(); delete REGIONS[Dev.rid]; Dev.rid = 'vila'; Dev.sel = null; changed(); devTab('mapa'); devCenter(); devDraw();
  }));
  return box;
}
function resizeRegion(reg, W, H, anchor) {
  devPush(); const fill = darkOf(reg) > .5 ? (bioOf(reg) === 'caverna' || bioOf(reg) === 'vulcao' ? 'k' : 'x') : 'T', ow = reg.map[0].length, oh = reg.map.length;
  const dx = anchor === 'c' ? Math.floor((W - ow) / 2) : 0, dy = anchor === 'c' ? Math.floor((H - oh) / 2) : 0;
  reg.map = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (reg.map[y - dy] && reg.map[y - dy][x - dx]) || fill).join(''));
  if (dx || dy) {                                 // objetos andam junto quando cresce pelo centro
    for (const o of [...reg.npcs, ...reg.spawns, ...reg.portals, ...(reg.signs || []), ...(reg.chests || [])]) { o.x += dx; o.y += dy; }
    if (reg.start) reg.start = [reg.start[0] + dx, reg.start[1] + dy];
    for (const r of Object.values(REGIONS)) for (const p of r.portals) if (p.to === Dev.rid) { p.tx += dx; p.ty += dy; }
  }
  changed(1); devCenter(); devDraw();
}
function newRegionForm() {
  const P = $('#d-pane'); P.innerHTML = '';
  const id = el('input'), name = el('input'), ms = el('select'), w = el('input'), h = el('input');
  id.placeholder = 'ex.: pantano_norte'; name.placeholder = 'Nome no jogo'; w.type = h.type = 'number'; w.value = 48; h.value = 32;
  for (const [k, n] of Object.entries(GEN_INFO)) { const o = el('option'); o.value = k; o.textContent = n; ms.append(o); }
  const prev = el('canvas', 'prev'); let G = null, seed = 1;
  const remake = () => { G = gen(ms.value, clamp(+w.value || 48, 10, 200), clamp(+h.value || 32, 8, 200), seed); const c = regionCanvas({ map: G.map, kind: G.kind, bio: G.bio }); prev.width = c.width; prev.height = c.height; prev.getContext('2d').drawImage(c, 0, 0); };
  ms.onchange = w.onchange = h.onchange = remake;
  const lab = (t, e) => { const l = el('label', 'f'); l.append(el('span', '', t), e); return l; };
  P.append(el('h4', '', 'Nova região'), lab('Identificador', id), lab('Nome', name), lab('Modelo', ms));
  const sz = el('div', 'row'); sz.append(el('span', 'dim', 'Tamanho'), w, '×', h); P.append(sz, prev);
  const r = el('div', 'row'); r.append(btn('🎲 Outra versão', () => { seed = Math.floor(Math.random() * 1e9); remake(); }), btn('Criar', () => {
    const k = (id.value || name.value || ms.value).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_]/g, '_').replace(/^[0-9_]+/, '') || 'regiao';
    let key = k, n = 2; while (REGIONS[key]) key = k + n++;
    devPush(); REGIONS[key] = { n: name.value.trim() || GEN_INFO[ms.value] + ' ' + (n - 1), kind: G.kind, bio: G.bio, start: G.start, npcs: [], spawns: [], portals: [], signs: [], chests: [], map: G.map };
    if (G.kind === 'cidade') REGIONS[key].safe = 1;
    Dev.rid = key; Dev.sel = null; changed(); devTab('mapa'); devCenter(); devDraw(); hint('Região criada. Ligue-a com um portal a partir de outra região.');
  }, true), btn('Cancelar', () => devTab('mapa'))); P.append(r);
  seed = Math.floor(Math.random() * 1e9); remake();
}
function dupRegion() {
  let key = Dev.rid + '_2', n = 3; while (REGIONS[key]) key = Dev.rid + '_' + n++;
  devPush(); const c = clone(R()); c.n += ' (cópia)'; c.portals = []; (c.chests || []).forEach(ch => ch.id = uid('b_')); REGIONS[key] = c; Dev.rid = key; changed(); devTab('mapa'); devCenter(); devDraw();
}

// Painel do objeto selecionado
function selPanel() {
  const box = el('div', 'box2'), s = Dev.sel;
  if (!s) { box.append(el('p', 'dim small', 'Nada. Clique num objeto (ou use uma ferramenta de objeto).')); return box; }
  const o = s.o, reg = R(), re = () => devTab('mapa');
  const del = btn('🗑 Apagar', () => { devPush(); if (s.kind === 'arrival') return; const l = reg[s.kind]; l.splice(l.indexOf(o), 1); Dev.sel = null; changed(); re(); });
  if (s.kind === 'npcs') {
    box.append(fSel('Tipo', Object.keys(NPCS).map(k => [k, NPCS[k].n]), () => o.k, v => o.k = v, { after: re }),
      fText('Nome (vazio = do tipo)', () => o.n, v => { if (v) o.n = v; else delete o.n; }),
      fText('Fala (vazio = do tipo)', () => o.talk, v => { if (v) o.talk = v; else delete o.talk; }, 1),
      btn('✎ Editar o tipo ' + (NPCS[o.k] ? NPCS[o.k].n : ''), () => { Dev.npcId = o.k; devTab('npcs'); }), del);
  } else if (s.kind === 'spawns') {
    const M = MOBS[o.m] || {};
    box.append(fSel('Monstro', Object.keys(MOBS).map(k => [k, MOBS[k].n]), () => o.m, v => o.m = v, { after: re }),
      fNum('Quantidade', () => o.n, v => o.n = Math.max(1, Math.round(v || 1)), { min: 1, max: 60 }),
      fNum('Raio (quadrados)', () => o.r, v => o.r = Math.max(0, v || 0), { step: .5, min: 0, max: 60 }),
      fNum('Nível (vazio = ' + (M.lvl || 1) + ')', () => o.lvl, v => { if (v) o.lvl = Math.round(v); else delete o.lvl; }, { min: 1, max: 99 }),
      fNum('Reaparece em s (vazio = ' + (M.respawn || MOB_RESPAWN) + ')', () => o.respawn, v => { if (v) o.respawn = v; else delete o.respawn; }, { min: 1, max: 3600 }));
    if (o.drops) box.append(fPairs('Saque desta área', o.drops, re, 1), btn('Usar o saque padrão do monstro', () => { devPush(); delete o.drops; changed(); re(); }));
    else box.append(el('p', 'dim small', 'Saque padrão: ' + ((M.drops || []).map(([it, c]) => ITEMS[it] ? ITEMS[it].n + ' ' + Math.round(c * 100) + '%' : '').filter(Boolean).join(', ') || 'nada')), btn('Personalizar saque', () => { devPush(); o.drops = clone(M.drops || []); changed(); re(); }));
    box.append(btn('✎ Editar o monstro ' + (M.n || ''), () => { Dev.mobId = o.m; devTab('monstros'); }), del);
  } else if (s.kind === 'portals' || s.kind === 'arrival') {
    const p = o, to = REGIONS[p.to];
    if (s.kind === 'arrival') box.append(el('p', 'small', 'Chegada do portal de ' + (REGIONS[s.from] ? REGIONS[s.from].n : '?') + '.'), btn('Ir para o portal', () => { Dev.rid = s.from; Dev.sel = { kind: 'portals', o: p }; devTab('mapa'); devCenter(); devDraw(); }));
    box.append(fSel('Leva a', Object.keys(REGIONS).map(k => [k, REGIONS[k].n]), () => p.to, v => { p.to = v; [p.tx, p.ty] = defaultArrival(v, s.from || findPortalRegion(p) || Dev.rid); }, { after: re }));
    if (s.kind === 'portals') {
      const sz = el('div', 'row'); sz.append(fNum('x', () => p.x, v => p.x = Math.round(v)), fNum('y', () => p.y, v => p.y = Math.round(v)), fNum('largura', () => p.w, v => p.w = Math.max(1, Math.round(v)), { min: 1, max: 60 }), fNum('altura', () => p.h, v => p.h = Math.max(1, Math.round(v)), { min: 1, max: 60 })); box.append(sz);
    }
    const ar = el('div', 'row'); ar.append(fNum('Chegada x', () => p.tx, v => p.tx = v, { step: .5 }), fNum('y', () => p.ty, v => p.ty = v, { step: .5 })); box.append(ar);
    if (to) {
      const [fx, fy] = arrivalSpot(to, p.tx, p.ty), bad = Math.abs(fx / TILE - p.tx) > .01 || Math.abs(fy / TILE - p.ty) > .01;
      if (bad) box.append(el('p', 'warn small', '⚠ Chegada em parede ou em cima de um portal: o jogo vai mover o herói para ' + (fx / TILE).toFixed(1) + ', ' + (fy / TILE).toFixed(1) + '.'), btn('Corrigir', () => { devPush(); p.tx = half(fx / TILE); p.ty = half(fy / TILE); changed(); re(); }));
      if (s.kind === 'portals') box.append(btn('🎯 Ver e arrastar a chegada em ' + to.n, () => { Dev.rid = p.to; Dev.sel = { kind: 'arrival', o: p, from: s.from || findPortalRegion(p) }; devTab('mapa'); devCenter(); devDraw(); }));
    }
    box.append(fSel('Transição', Object.entries(TRANSITIONS), () => p.fx || 'auto', v => { if (v === 'auto') delete p.fx; else p.fx = v; }),
      btn('▶ Ver transição', () => previewTrans(p.fx && p.fx !== 'auto' ? p.fx : BIOMES[bioOf(to || R())].trans)));
    box.append(el('b', 'small', 'Trava'), fNum('Nível mínimo', () => p.req && p.req.lvl, v => { p.req = { ...(p.req || {}) }; if (v) p.req.lvl = Math.round(v); else delete p.req.lvl; if (!Object.keys(p.req).length) delete p.req; }, { min: 0, max: 99 }),
      fSel('Missão concluída', [['', '— nenhuma —'], ...Object.entries(QUESTS).map(([k, Q]) => [k, Q.n])], () => (p.req && p.req.q) || '', v => { p.req = { ...(p.req || {}) }; if (v) p.req.q = v; else delete p.req.q; if (!Object.keys(p.req).length) delete p.req; }));
    if (s.kind === 'portals') box.append(del);
  } else if (s.kind === 'signs') {
    box.append(fText('Texto', () => o.text, v => o.text = v, 1), del);
  } else if (s.kind === 'chests') {
    if (!o.items) o.items = {};
    box.append(fNum('Ouro', () => o.gold, v => o.gold = Math.max(0, Math.round(v || 0)), { min: 0, max: 99999 }), fPairs('Itens', objPairs(o.items), re, 0, rows => o.items = pairsObj(rows)));
    box.append(el('p', 'dim small', 'Cada herói abre uma vez.'), del);
  } else if (s.kind === 'start') box.append(el('p', 'small', 'Início da região: onde se nasce ao entrar por "Testar" ou sem portal.'));
  return box;
}
// Chegada padrão num destino: ao lado do portal que volta para a região de origem; sem ele, perto do início (ou do centro).
function defaultArrival(toId, fromId) {
  const T = REGIONS[toId], back = T.portals.find(b => b.to === fromId);
  const [x, y] = back ? arrivalSpot(T, back.x + back.w / 2, back.y + back.h / 2) : arrivalSpot(T, T.start ? T.start[0] + .5 : T.map[0].length / 2, T.start ? T.start[1] + .5 : T.map.length / 2);
  return [half(x / TILE), half(y / TILE)];
}
function findPortalRegion(p) { for (const [id, r] of Object.entries(REGIONS)) if (r.portals.includes(p)) return id; return null; }
function previewTrans(kind) { const c = $('#d-trans'); c.hidden = false; const old = Trans.cv; Trans.cv = c; Trans.run(kind, () => {}); setTimeout(() => { Trans.cv = old; c.hidden = true; }, (Trans.OUT + Trans.IN) * 1000 + 100); }

/* ----- Verificação ----- */
function checkWorld() {
  const out = [], add = (rid, msg, sel, fix) => out.push({ rid, msg, sel, fix });
  const seen = new Set(['vila']), q = ['vila'];
  while (q.length) { const r = REGIONS[q.shift()]; for (const p of r.portals) if (REGIONS[p.to] && !seen.has(p.to)) { seen.add(p.to); q.push(p.to); } }
  for (const [id, r] of Object.entries(REGIONS)) {
    if (!seen.has(id)) add(id, 'Não dá para chegar aqui a partir da vila.');
    if (r.start && hitsWall(r, (r.start[0] + .5) * TILE, (r.start[1] + .5) * TILE, 5)) add(id, 'Início em parede.', { kind: 'start', o: r });
    for (const p of r.portals) {
      const t = REGIONS[p.to];
      if (!t) { add(id, 'Portal sem destino (' + p.to + ').', { kind: 'portals', o: p }); continue; }
      const [fx, fy] = arrivalSpot(t, p.tx, p.ty);
      if (Math.abs(fx / TILE - p.tx) > .01 || Math.abs(fy / TILE - p.ty) > .01) add(id, 'Chegada em ' + t.n + ' cai em parede ou portal.', { kind: 'portals', o: p }, () => { p.tx = half(fx / TILE); p.ty = half(fy / TILE); });
      if (!t.portals.some(b => b.to === id)) add(id, 'Portal para ' + t.n + ' não tem volta.', { kind: 'portals', o: p });
      if (p.req && p.req.q && !QUESTS[p.req.q]) add(id, 'Trava pede uma missão que não existe.', { kind: 'portals', o: p });
    }
    for (const n of r.npcs) { if (!NPCS[n.k]) add(id, 'NPC de tipo inexistente (' + n.k + ').', { kind: 'npcs', o: n }); if (hitsWall(r, n.x * TILE, n.y * TILE, 4)) add(id, 'NPC em parede.', { kind: 'npcs', o: n }); }
    for (const s of r.spawns) {
      if (!MOBS[s.m]) add(id, 'Monstro inexistente (' + s.m + ').', { kind: 'spawns', o: s });
      if (!s.r && hitsWall(r, s.x * TILE, s.y * TILE, 6)) add(id, 'Monstro nasce em parede.', { kind: 'spawns', o: s });
      for (const [it] of s.drops || []) if (!ITEMS[it]) add(id, 'Saque com item inexistente.', { kind: 'spawns', o: s });
    }
    for (const c of r.chests || []) if (hitsWall(r, c.x * TILE, c.y * TILE, 4)) add(id, 'Baú em parede.', { kind: 'chests', o: c });
  }
  for (const [k, Q] of Object.entries(QUESTS)) {
    if (!NPCS[Q.giver]) add(null, 'Missão “' + Q.n + '” sem NPC que dê.');
    else if (!(NPCS[Q.giver].quests || []).includes(k)) add(null, 'Missão “' + Q.n + '” não está na lista de ' + NPCS[Q.giver].n + '.');
    if (Q.kind === 'kill' && !MOBS[Q.target] && !Object.values(MOBS).some(M => M.fam === Q.target)) add(null, 'Missão “' + Q.n + '” pede um monstro que não existe.');
    if (Q.kind === 'fetch' && !ITEMS[Q.target]) add(null, 'Missão “' + Q.n + '” pede um item que não existe.');
  }
  return out;
}
function issuesPanel() {
  const box = el('div', 'box2'); box.append(el('b', '', Dev.issues.length ? Dev.issues.length + ' problema(s)' : '✔ Nenhum problema'));
  for (const it of Dev.issues) {
    const r = el('div', 'issue'); r.append(el('span', '', (it.rid ? REGIONS[it.rid] ? REGIONS[it.rid].n + ': ' : '' : '') + it.msg));
    if (it.rid) r.append(btn('Ver', () => { Dev.rid = it.rid; Dev.sel = it.sel && it.sel.kind !== 'start' ? it.sel : null; devTab('mapa'); devCenter(); devDraw(); }));
    if (it.fix) r.append(btn('Corrigir', () => { devPush(); it.fix(); changed(); Dev.issues = checkWorld(); devTab('mapa'); }));
    box.append(r);
  }
  return box;
}

/* ----- Monstros ----- */
function listPane(P, title, entries, cur, pick, add) {
  P.append(el('h4', '', title));
  const l = el('div', 'list'); for (const [k, n, tag] of entries) { const b = btn(n + (tag ? ' ' + tag : ''), () => pick(k), k === cur); l.append(b); } P.append(l);
  if (add) P.append(add);
}
const isCustom = (T, k) => !(k in T);
function editable(kind, id) {                     // devolve a definição em WORLD.extra (copia a original na primeira edição)
  const ex = WORLD.extra[kind] = WORLD.extra[kind] || {}, base = { mobs: MOBS, npcs: NPCS, quests: QUESTS }[kind];
  if (!ex[id]) ex[id] = clone(base[id]); return ex[id];
}
function paneMobs(P) {
  if (!MOBS[Dev.mobId]) Dev.mobId = Object.keys(MOBS)[0];
  listPane(P, 'Monstros', Object.keys(MOBS).map(k => [k, MOBS[k].n, isCustom(PRISTINE.mobs, k) ? '★' : WORLD.extra.mobs && WORLD.extra.mobs[k] ? '✎' : '']), Dev.mobId, k => { Dev.mobId = k; devTab('monstros'); },
    btn('＋ Novo monstro (cópia deste)', () => { devPush(); const id = uid('m_'), M = clone(MOBS[Dev.mobId]); M.n += ' novo'; M.look = M.look || Dev.mobId; delete M.boss; (WORLD.extra.mobs = WORLD.extra.mobs || {})[id] = M; Dev.mobId = id; changed(); devTab('monstros'); }));
  const id = Dev.mobId, M = MOBS[id], E = () => editable('mobs', id), set = f => v => f(E(), v);
  const pv = el('canvas', 'mobprev'); const spr = mobSprite(id, 0), z = 4 * mobSize(M); pv.width = spr.width * z; pv.height = spr.height * z; const pg = pv.getContext('2d'); pg.imageSmoothingEnabled = false; pg.drawImage(spr, 0, 0, pv.width, pv.height);
  const box = el('div', 'box2'); P.append(el('h4', '', M.n), pv, box);
  box.append(fText('Nome', () => M.n, set((e, v) => e.n = v || e.n)),
    fSel('Aparência', LOOKS_MOB.map(k => [k, PRISTINE.mobs[k].n]), () => M.look || id, set((e, v) => e.look = v), { after: () => devTab('monstros') }),
    fColor('Cor principal', () => M.tint || (PAL[M.look || id] || {}).g, set((e, v) => e.tint = v)),
    fNum('Tamanho', () => mobSize(M), set((e, v) => e.size = clamp(v || 1, .5, 4)), { step: .1, min: .5, max: 4 }),
    fNum('Nível de referência', () => M.lvl || 1, set((e, v) => e.lvl = Math.max(1, Math.round(v || 1))), { min: 1, max: 99 }),
    fNum('Vida', () => M.hp, set((e, v) => e.hp = Math.max(1, Math.round(v))), { min: 1 }),
    fNum('Dano', () => M.dmg, set((e, v) => e.dmg = Math.max(0, v)), { min: 0 }),
    fNum('Velocidade', () => M.spd, set((e, v) => e.spd = Math.max(0, v)), { min: 0, max: 300 }),
    fNum('Raio do corpo', () => M.r, set((e, v) => e.r = clamp(v, 3, 30)), { min: 3, max: 30 }),
    fNum('Visão (px)', () => M.aggro, set((e, v) => e.aggro = Math.max(0, v)), { min: 0, max: 600 }),
    fNum('Alcance do ataque', () => M.range, set((e, v) => e.range = Math.max(4, v)), { min: 4, max: 400 }),
    fNum('Preparo do golpe (s)', () => M.wind, set((e, v) => e.wind = clamp(v, .05, 3)), { step: .05, min: .05, max: 3 }),
    fNum('Intervalo entre golpes (s)', () => M.cd, set((e, v) => e.cd = clamp(v, .2, 10)), { step: .1, min: .2, max: 10 }),
    fNum('XP', () => M.xp, set((e, v) => e.xp = Math.max(0, Math.round(v))), { min: 0 }),
    fNum('Ouro mínimo', () => M.gold[0], set((e, v) => e.gold = [Math.max(0, Math.round(v)), Math.max(Math.round(v), e.gold[1])]), { min: 0 }),
    fNum('Ouro máximo', () => M.gold[1], set((e, v) => e.gold = [Math.min(e.gold[0], Math.round(v)), Math.max(0, Math.round(v))]), { min: 0 }),
    fNum('Reaparece em s', () => M.respawn || MOB_RESPAWN, set((e, v) => e.respawn = Math.max(1, v)), { min: 1, max: 3600 }),
    fText('Família (para missões, ex.: goblin)', () => M.fam, set((e, v) => { if (v) e.fam = v; else delete e.fam; })),
    fChk('Ataca à distância', () => !!M.shot, set((e, v) => { if (v) { e.shot = { spd: 150, pk: 'flecha_m' }; e.keep = e.keep || 60; e.range = Math.max(e.range, 100); } else { delete e.shot; delete e.keep; e.range = Math.min(e.range, 20); } }), { after: () => devTab('monstros') }));
  if (M.shot) box.append(fSel('Projétil', [['flecha_m', 'Flecha'], ['osso_m', 'Osso'], ['fogo', 'Bola de fogo'], ['faisca', 'Faísca']], () => M.shot.pk, set((e, v) => e.shot.pk = v)), fNum('Distância que mantém', () => M.keep || 0, set((e, v) => e.keep = Math.max(0, v)), { min: 0, max: 300 }));
  box.append(fChk('Chefe (barra no topo, anel de projéteis, chama ajuda)', () => !!M.boss, set((e, v) => { if (v) e.boss = 1; else delete e.boss; }), { after: () => devTab('monstros') }));
  if (M.boss) box.append(fSel('Ajuda chamada', Object.keys(MOBS).filter(k => k !== id).map(k => [k, MOBS[k].n]), () => M.minion || 'esqueleto', set((e, v) => e.minion = v)), fNum('Distância que persegue', () => M.leash || LEASH, set((e, v) => e.leash = Math.max(40, v)), { min: 40, max: 2000 }));
  box.append(fPairs('Saque padrão', clone(M.drops || []), () => devTab('monstros'), 1, rows => E().drops = clone(rows)));
  if (!isCustom(PRISTINE.mobs, id) && WORLD.extra.mobs && WORLD.extra.mobs[id]) box.append(btn('↺ Voltar ao original', () => { devPush(); delete WORLD.extra.mobs[id]; changed(); devTab('monstros'); }));
  if (isCustom(PRISTINE.mobs, id)) box.append(btn('🗑 Apagar monstro', () => {
    const used = Object.values(REGIONS).some(r => r.spawns.some(s => s.m === id)); if (!confirm('Apagar ' + M.n + '?' + (used ? '\nAlgumas áreas usam este monstro e vão ficar vazias.' : ''))) return;
    devPush(); delete WORLD.extra.mobs[id]; Dev.mobId = null; changed(); devTab('monstros');
  }));
}
/* ----- NPCs ----- */
function paneNpcs(P) {
  if (!NPCS[Dev.npcId]) Dev.npcId = Object.keys(NPCS)[0];
  listPane(P, 'Tipos de NPC', Object.keys(NPCS).map(k => [k, NPCS[k].n, isCustom(PRISTINE.npcs, k) ? '★' : WORLD.extra.npcs && WORLD.extra.npcs[k] ? '✎' : '']), Dev.npcId, k => { Dev.npcId = k; devTab('npcs'); },
    btn('＋ Novo NPC', () => { devPush(); const id = uid('n_'); (WORLD.extra.npcs = WORLD.extra.npcs || {})[id] = { n: 'Novo NPC', look: 'aldeao', talk: 'Olá!' }; Dev.npcId = id; changed(); devTab('npcs'); }));
  const id = Dev.npcId, N = NPCS[id], E = () => editable('npcs', id), set = f => v => f(E(), v);
  const pv = el('canvas', 'mobprev'), spr = personSprite(N.look, 0); pv.width = spr.width * 4; pv.height = spr.height * 4; const pg = pv.getContext('2d'); pg.imageSmoothingEnabled = false; pg.drawImage(spr, 0, 0, pv.width, pv.height);
  const box = el('div', 'box2'); P.append(el('h4', '', N.n), pv, box);
  box.append(fText('Nome', () => N.n, set((e, v) => e.n = v || e.n)),
    fSel('Aparência', Object.keys(LOOK).map(k => [k, k]), () => N.look, set((e, v) => e.look = v), { after: () => devTab('npcs') }),
    fText('Fala', () => N.talk, set((e, v) => e.talk = v), 1),
    fChk('Compra itens do herói', () => N.buys, set((e, v) => { if (v) e.buys = 1; else delete e.buys; })),
    fChk('Cura', () => N.heal, set((e, v) => { if (v) e.heal = 1; else delete e.heal; })));
  const shop = el('div', 'checks'); shop.append(el('b', '', 'Vende'));
  for (const [k, I] of Object.entries(ITEMS)) shop.append(fChk(I.e + ' ' + I.n, () => (N.shop || []).includes(k), set((e, v) => { e.shop = (e.shop || []).filter(x => x !== k); if (v) e.shop.push(k); if (!e.shop.length) delete e.shop; })));
  const qs = el('div', 'checks'); qs.append(el('b', '', 'Dá as missões'));
  for (const [k, Q] of Object.entries(QUESTS)) qs.append(fChk(Q.n, () => (N.quests || []).includes(k), v => { const e = E(); e.quests = (e.quests || []).filter(x => x !== k); if (v) { e.quests.push(k); for (const [ok, on] of Object.entries(NPCS)) if (ok !== id && (on.quests || []).includes(k)) editable('npcs', ok).quests = on.quests.filter(x => x !== k); editable('quests', k).giver = id; } if (!e.quests.length) delete e.quests; }, { after: () => devTab('npcs') }));
  box.append(shop, qs);
  const where = Object.entries(REGIONS).filter(([, r]) => r.npcs.some(n => n.k === id)).map(([, r]) => r.n);
  box.append(el('p', 'dim small', where.length ? 'No mapa em: ' + where.join(', ') : 'Ainda não está em nenhum mapa (aba Mapa → NPC).'));
  if (!isCustom(PRISTINE.npcs, id) && WORLD.extra.npcs && WORLD.extra.npcs[id]) box.append(btn('↺ Voltar ao original', () => { devPush(); delete WORLD.extra.npcs[id]; changed(); devTab('npcs'); }));
  if (isCustom(PRISTINE.npcs, id)) box.append(btn('🗑 Apagar NPC', () => { if (!confirm('Apagar ' + N.n + '? Ele some dos mapas.')) return; devPush(); delete WORLD.extra.npcs[id]; for (const r of Object.values(REGIONS)) r.npcs = r.npcs.filter(n => n.k !== id); Dev.npcId = null; changed(); devTab('npcs'); }));
}
/* ----- Missões ----- */
function paneQuests(P) {
  if (!QUESTS[Dev.questId]) Dev.questId = Object.keys(QUESTS)[0];
  listPane(P, 'Missões', Object.keys(QUESTS).map(k => [k, QUESTS[k].n, isCustom(PRISTINE.quests, k) ? '★' : WORLD.extra.quests && WORLD.extra.quests[k] ? '✎' : '']), Dev.questId, k => { Dev.questId = k; devTab('missoes'); },
    btn('＋ Nova missão', () => { devPush(); const id = uid('q_'); (WORLD.extra.quests = WORLD.extra.quests || {})[id] = { n: 'Nova missão', giver: 'capita', kind: 'kill', target: 'geleia', count: 5, d: 'Derrote 5 geleias.', reward: { gold: 30, xp: 50, items: {} } }; const n = editable('npcs', 'capita'); n.quests = [...(n.quests || []), id]; Dev.questId = id; changed(); devTab('missoes'); }));
  const id = Dev.questId; if (!id) return; const Q = QUESTS[id], E = () => editable('quests', id), set = f => v => f(E(), v);
  const box = el('div', 'box2'); P.append(el('h4', '', Q.n), box);
  const targets = Q.kind === 'fetch' ? itemOpts() : [...Object.entries(MOBS).map(([k, M]) => [k, M.n]), ...[...new Set(Object.values(MOBS).map(M => M.fam).filter(Boolean))].map(f => [f, 'Qualquer ' + f])];
  box.append(fText('Nome', () => Q.n, set((e, v) => e.n = v || e.n)),
    fSel('Quem dá', Object.entries(NPCS).map(([k, N]) => [k, N.n]), () => Q.giver, v => { const e = E(); for (const [ok, on] of Object.entries(NPCS)) if ((on.quests || []).includes(id)) editable('npcs', ok).quests = on.quests.filter(x => x !== id); e.giver = v; const n = editable('npcs', v); n.quests = [...(n.quests || []), id]; }),
    fSel('Tipo', [['kill', 'Derrotar'], ['fetch', 'Entregar itens']], () => Q.kind, set((e, v) => { e.kind = v; e.target = v === 'fetch' ? 'geleia' : 'geleia'; }), { after: () => devTab('missoes') }),
    fSel(Q.kind === 'fetch' ? 'Item' : 'Alvo', targets, () => Q.target, set((e, v) => e.target = v)),
    fNum('Quantidade', () => Q.count, set((e, v) => e.count = Math.max(1, Math.round(v))), { min: 1, max: 999 }),
    fSel('Requer antes', [['', '— nada —'], ...Object.entries(QUESTS).filter(([k]) => k !== id).map(([k, q]) => [k, q.n])], () => Q.req || '', set((e, v) => { if (v) e.req = v; else delete e.req; })),
    fText('Objetivo (aparece no diário)', () => Q.d, set((e, v) => e.d = v), 1),
    fNum('Ouro', () => Q.reward.gold, set((e, v) => e.reward.gold = Math.max(0, Math.round(v || 0))), { min: 0 }),
    fNum('XP', () => Q.reward.xp, set((e, v) => e.reward.xp = Math.max(0, Math.round(v || 0))), { min: 0 }),
    fNum('Arma da classe (nível 0–3, vazio = nenhuma)', () => Q.reward.weapon, set((e, v) => { if (v != null && v !== '') e.reward.weapon = clamp(Math.round(v), 0, 3); else delete e.reward.weapon; }), { min: 0, max: 3 }));
  box.append(fPairs('Itens de recompensa', objPairs(Q.reward.items), () => devTab('missoes'), 0, rows => E().reward.items = pairsObj(rows)));
  if (!isCustom(PRISTINE.quests, id) && WORLD.extra.quests && WORLD.extra.quests[id]) box.append(btn('↺ Voltar ao original', () => { devPush(); delete WORLD.extra.quests[id]; changed(); devTab('missoes'); }));
  if (isCustom(PRISTINE.quests, id)) box.append(btn('🗑 Apagar missão', () => { if (!confirm('Apagar a missão ' + Q.n + '?')) return; devPush(); delete WORLD.extra.quests[id]; for (const [k, N] of Object.entries(NPCS)) if ((N.quests || []).includes(id)) editable('npcs', k).quests = N.quests.filter(x => x !== id); Dev.questId = null; changed(); devTab('missoes'); }));
}
/* ----- Arquivo ----- */
function paneFile(P) {
  P.append(el('h4', '', 'Projeto'));
  const fs = !!window.showSaveFilePicker;
  P.append(btn('💾 Salvar no projeto (regions.js)', saveProject, true));
  if (fs) P.append(btn('Escolher outro arquivo', async () => { await idb('del', 'regions'); saveProject(); }));
  else P.append(el('p', 'dim small', 'Este navegador não grava direto em arquivo: vai baixar o regions.js para você pôr em games/adventure/. No Brave, ligue brave://flags/#file-system-access-api para gravar direto.'));
  P.append(btn('⬇ Baixar regions.js', () => download(worldJs())), btn('📋 Copiar JSON', async () => { try { await navigator.clipboard.writeText(JSON.stringify(WORLD)); hint('JSON copiado.'); } catch (e) { prompt('Copie:', JSON.stringify(WORLD)); } }),
    btn('📥 Colar JSON', () => {
      const s = prompt('Cole o JSON do mundo:'); if (!s) return;
      try { let w = JSON.parse(s); if (w.vila) w = { regions: w, extra: WORLD.extra }; if (!w.regions || !w.regions.vila) throw new Error('falta a vila'); devPush(); setWorld(w); View.forget(); Dev.rid = 'vila'; Dev.sel = null; devSave(); devTab('arquivo'); hint('Importado.'); }
      catch (e) { alert('JSON inválido: ' + e.message); }
    }),
    btn('↺ Descartar edições (voltar ao arquivo)', () => {
      if (!confirm('Descartar as edições deste navegador e voltar ao que está no regions.js?')) return;
      try { localStorage.removeItem('adventure-world'); localStorage.removeItem('adventure-regions'); } catch (e) {}
      devPush(); setWorld(baseWorld()); View.forget(); Dev.sel = null; if (!REGIONS[Dev.rid]) Dev.rid = 'vila'; Dev.dirty = false; devStatus(); devTab('arquivo');
    }));
  P.append(el('h4', '', 'Senha'), btn('🔑 Trocar senha', () => { store.set('adventure-devkey', 'novo'); try { sessionStorage.removeItem('adventure-dev'); } catch (e) {} devOpen(); }));
  P.append(el('p', 'dim small', 'A senha fica só neste navegador. Não use uma senha que você usa em outro lugar.'));
}
function worldJs() {
  const obj = o => '{' + Object.entries(o).map(([k, v]) => k + ': ' + JSON.stringify(v)).join(', ') + '}';
  let s = '/* Adventure: mapas das regiões. Gerado e editado pelo modo dev (index.html#dev → Arquivo).\n   map = linhas de ladrilhos (legenda em TILES, data.js); posições em quadrados (x, y), com .5 = centro.\n   start = onde se nasce; npcs = personagens (k = chave em NPCS); spawns = monstros (m, n, raio r, lvl, drops);\n   portals = retângulos que levam a outra região (to) no ponto tx, ty (req = trava, fx = transição); signs = placas; chests = baús.\n   bio = bioma, dark = escuridão (0 a 1), weather = clima, lvl = nível sugerido. */\nconst REGIONS_BASE = {\n';
  for (const [id, r] of Object.entries(REGIONS)) {
    const { npcs, spawns, portals, signs, chests, map, ...meta } = r;
    s += `  ${JSON.stringify(id).slice(1, -1).match(/^[a-z_$][\w$]*$/i) ? id : JSON.stringify(id)}: {\n    ${Object.entries(meta).map(([k, v]) => k + ': ' + JSON.stringify(v)).join(', ')},\n`;
    for (const [k, a] of [['npcs', npcs], ['spawns', spawns], ['portals', portals], ['signs', signs], ['chests', chests]]) if (a) s += `    ${k}: [` + (a.length ? '\n' + a.map(o => '      ' + obj(o)).join(',\n') + ',\n    ' : '') + '],\n';
    s += '    map: [\n' + map.map(l => `      '${l}',`).join('\n') + '\n    ],\n  },\n';
  }
  const ex = { mobs: WORLD.extra.mobs || {}, npcs: WORLD.extra.npcs || {}, quests: WORLD.extra.quests || {} };   // o hash da senha nunca vai para o arquivo (ele é publicado no Pages)
  s += '};\n\n/* Monstros, NPCs e missões criados ou alterados no editor (mesmas chaves de MOBS, NPCS e QUESTS em data.js; uma chave igual substitui a original). */\nconst WORLD_EXTRA = {\n';
  for (const k of ['mobs', 'npcs', 'quests']) s += `  ${k}: {` + (Object.keys(ex[k]).length ? '\n' + Object.entries(ex[k]).map(([id, v]) => `    ${id}: ${JSON.stringify(v)},`).join('\n') + '\n  ' : '') + '},\n';
  return s + '};\n';
}
function download(text) { const a = el('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript' })); a.download = 'regions.js'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function idb(op, key, val) {                      // guarda o "atalho" do arquivo escolhido para gravar de novo sem perguntar
  return new Promise(res => {
    try {
      const rq = indexedDB.open('adventure-dev', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('h');
      rq.onsuccess = () => { const tx = rq.result.transaction('h', op === 'get' ? 'readonly' : 'readwrite'), s = tx.objectStore('h'), r = op === 'get' ? s.get(key) : op === 'del' ? s.delete(key) : s.put(val, key); r.onsuccess = () => res(r.result); r.onerror = () => res(null); };
      rq.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}
async function saveProject() {
  const text = worldJs();
  if (window.showSaveFilePicker) {
    try {
      let h = await idb('get', 'regions');
      if (!h) { h = await showSaveFilePicker({ suggestedName: 'regions.js', types: [{ description: 'JavaScript', accept: { 'text/javascript': ['.js'] } }] }); await idb('put', 'regions', h); }
      const perm = await h.queryPermission({ mode: 'readwrite' }); if (perm !== 'granted' && await h.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('sem permissão');
      const w = await h.createWritable(); await w.write(text); await w.close();
      Dev.dirty = false; devStatus(); hint('Gravado em ' + h.name + '. Recarregue o jogo para ver como os jogadores verão.'); return;
    } catch (e) { if (e.name === 'AbortError') return; console.warn(e); hint('Não deu para gravar direto (' + e.message + '); baixando.'); }
  }
  download(text); Dev.dirty = false; devStatus();
}

/* ---------- Vista do mapa ---------- */
function devResize() { const r = $('#dstage').getBoundingClientRect(), dpr = devicePixelRatio || 1; dcv.width = r.width * dpr; dcv.height = r.height * dpr; dcv.style.width = r.width + 'px'; dcv.style.height = r.height + 'px'; }
function devCenter() { const r = $('#dstage').getBoundingClientRect(), reg = R(); Dev.zoom = clamp(Math.floor(Math.min(r.width / (reg.map[0].length * TILE), r.height / (reg.map.length * TILE)) * 4) / 4, .5, 4); Dev.ox = (r.width - reg.map[0].length * TILE * Dev.zoom) / 2; Dev.oy = (r.height - reg.map.length * TILE * Dev.zoom) / 2; }
addEventListener('resize', () => { if ($('#dev').classList.contains('on')) { devResize(); devDraw(); } });
const toTile = e => { const r = dcv.getBoundingClientRect(); return [(e.clientX - r.left - Dev.ox) / Dev.zoom / TILE, (e.clientY - r.top - Dev.oy) / Dev.zoom / TILE]; };
function hint(s) { $('#d-hint').textContent = s || ''; }

function handlesOf(sel) {                         // alças de redimensionar do selecionado (em quadrados)
  if (!sel) return [];
  const o = sel.o;
  if (sel.kind === 'portals') return [['e', o.x + o.w, o.y + o.h / 2], ['s', o.x + o.w / 2, o.y + o.h], ['w', o.x, o.y + o.h / 2], ['n', o.x + o.w / 2, o.y], ['se', o.x + o.w, o.y + o.h]];
  if (sel.kind === 'spawns') return [['r', o.x + Math.max(.5, o.r), o.y]];
  return [];
}
function devDraw() {
  if (!$('#dev').classList.contains('on')) return;
  const reg = R(), dpr = devicePixelRatio || 1, z = Dev.zoom, w = reg.map[0].length, h = reg.map.length;
  dg.setTransform(1, 0, 0, 1, 0, 0); dg.fillStyle = '#15121a'; dg.fillRect(0, 0, dcv.width, dcv.height);
  dg.setTransform(dpr * z, 0, 0, dpr * z, dpr * Dev.ox, dpr * Dev.oy); dg.imageSmoothingEnabled = false;
  dg.drawImage(View.regionImg(Dev.rid).img, 0, 0);
  if (darkOf(reg) > .03) { dg.fillStyle = `rgba(6,4,10,${darkOf(reg) * .45})`; dg.fillRect(0, 0, w * TILE, h * TILE); }
  if (Dev.grid && z >= 1.5) { dg.strokeStyle = 'rgba(0,0,0,.13)'; dg.lineWidth = 1 / z; dg.beginPath(); for (let x = 0; x <= w; x++) { dg.moveTo(x * TILE, 0); dg.lineTo(x * TILE, h * TILE); } for (let y = 0; y <= h; y++) { dg.moveTo(0, y * TILE); dg.lineTo(w * TILE, y * TILE); } dg.stroke(); }
  const txt = (s, x, y, col) => { dg.font = Math.max(6, 11 / z) + 'px sans-serif'; dg.textAlign = 'center'; dg.fillStyle = 'rgba(0,0,0,.75)'; dg.fillText(s, x + .5 / z * 2, y + .5 / z * 2); dg.fillStyle = col; dg.fillText(s, x, y); };
  const isSel = o => Dev.sel && Dev.sel.o === o, lw = 1 / z;
  if (Dev.objs) {
    for (const sp of reg.spawns) {
      const x = sp.x * TILE, y = sp.y * TILE, M = MOBS[sp.m]; dg.fillStyle = isSel(sp) ? 'rgba(255,90,90,.3)' : 'rgba(255,90,90,.13)'; dg.strokeStyle = '#ff6a6a'; dg.lineWidth = lw * (isSel(sp) ? 2 : 1);
      dg.beginPath(); dg.arc(x, y, Math.max(.5, sp.r) * TILE, 0, TAU); dg.fill(); dg.stroke();
      if (M) { const spr = mobSprite(sp.m, 0); dg.drawImage(spr, x - spr.width / 2, y - spr.height / 2); txt(M.n + ' ×' + sp.n + ' · Nv ' + (sp.lvl || M.lvl || 1) + (sp.drops ? ' · saque próprio' : ''), x, y - spr.height / 2 - 2, '#ffb0b0'); }
      else txt('? ' + sp.m, x, y, '#ff6060');
    }
    for (const p of reg.portals) {
      dg.fillStyle = isSel(p) ? 'rgba(120,180,255,.45)' : 'rgba(120,180,255,.22)'; dg.strokeStyle = p.req ? '#ffc04a' : '#7ab4ff'; dg.lineWidth = lw * (isSel(p) ? 2 : 1);
      dg.fillRect(p.x * TILE, p.y * TILE, p.w * TILE, p.h * TILE); dg.strokeRect(p.x * TILE, p.y * TILE, p.w * TILE, p.h * TILE);
      txt((p.req ? '🔒 ' : '') + '→ ' + (REGIONS[p.to] ? REGIONS[p.to].n : '?'), (p.x + p.w / 2) * TILE, (p.y + p.h / 2) * TILE + 2, '#cfe4ff');
    }
    for (const n of reg.npcs) {
      const x = n.x * TILE, y = n.y * TILE, N = NPCS[n.k] || NPCS.aldeao, spr = personSprite(N.look, 0);
      if (isSel(n)) { dg.strokeStyle = '#ffe080'; dg.lineWidth = lw * 2; dg.strokeRect(x - 7, y - spr.height - 1, 14, spr.height + 3); }
      dg.drawImage(spr, x - 5, y - spr.height + 1); txt(n.n || N.n, x, y - spr.height - 2, '#ffe9a0');
    }
    for (const [list, spr, col] of [[reg.signs || [], 'placa', '#e8d0a0'], [reg.chests || [], 'bau', '#ffd84a']]) for (const c of list) {
      const s = sprite(SPR[spr], PAL[spr === 'placa' ? 'placa' : 'bau'], spr), x = c.x * TILE, y = c.y * TILE;
      if (isSel(c)) { dg.strokeStyle = '#ffe080'; dg.lineWidth = lw * 2; dg.strokeRect(x - s.width / 2 - 1, y - s.height, s.width + 2, s.height + 2); }
      dg.drawImage(s, x - s.width / 2, y - s.height + 1); if (spr === 'placa' && c.text) txt(c.text.slice(0, 24) + (c.text.length > 24 ? '…' : ''), x, y - s.height - 2, col);
      if (spr === 'bau') txt([(c.gold ? c.gold + '🪙' : ''), Object.keys(c.items || {}).length ? Object.values(c.items).reduce((a, b) => a + b, 0) + ' itens' : ''].filter(Boolean).join(' ') || 'vazio', x, y - s.height - 2, col);
    }
    if (reg.start) { const x = (reg.start[0] + .5) * TILE, y = (reg.start[1] + .5) * TILE; dg.fillStyle = '#ffd84a'; dg.beginPath(); dg.moveTo(x, y); dg.lineTo(x - 4, y - 8); dg.lineTo(x + 4, y - 8); dg.fill(); txt('início', x, y - 9, '#ffd84a'); }
    // chegadas de portais (de qualquer região) que caem aqui: arrastáveis
    for (const [id, o] of Object.entries(REGIONS)) for (const p of o.portals) if (p.to === Dev.rid) {
      const x = p.tx * TILE, y = p.ty * TILE, [fx, fy] = arrivalSpot(reg, p.tx, p.ty), bad = Math.abs(fx - x) > .1 || Math.abs(fy - y) > .1, sel = isSel(p) && Dev.sel.kind === 'arrival';
      dg.strokeStyle = bad ? '#ff5a5a' : '#7ab4ff'; dg.fillStyle = bad ? 'rgba(255,90,90,.25)' : 'rgba(120,180,255,.25)'; dg.lineWidth = lw * (sel ? 2.5 : 1.5);
      dg.beginPath(); dg.arc(x, y, 6, 0, TAU); dg.fill(); dg.stroke(); txt('chegada de ' + o.n + (bad ? ' ⚠' : ''), x, y + 13, bad ? '#ffb0b0' : '#cfe4ff');
      if (bad) { dg.setLineDash([2 / z, 2 / z]); dg.beginPath(); dg.moveTo(x, y); dg.lineTo(fx, fy); dg.stroke(); dg.setLineDash([]); }
    }
    for (const [, hx, hy] of handlesOf(Dev.sel)) { dg.fillStyle = '#fff'; dg.strokeStyle = '#000'; dg.lineWidth = lw; const s = 5 / z + 1.5; dg.fillRect(hx * TILE - s, hy * TILE - s, s * 2, s * 2); dg.strokeRect(hx * TILE - s, hy * TILE - s, s * 2, s * 2); }
  }
  const hv = Dev.hover;
  if (hv && (Dev.tool === 'tile' || Dev.tool === 'fill' || Dev.tool === 'pick')) { const b = Dev.tool === 'tile' ? Dev.brush : 1, o = Math.floor((b - 1) / 2); dg.strokeStyle = '#fff'; dg.lineWidth = lw; dg.strokeRect((Math.floor(hv[0]) - o) * TILE, (Math.floor(hv[1]) - o) * TILE, b * TILE, b * TILE); }
  if (Dev.drag && Dev.drag.rect) { const [a, b] = Dev.drag.rect; dg.strokeStyle = Dev.tool === 'portal' ? '#7ab4ff' : '#fff'; dg.lineWidth = lw; dg.setLineDash([3 / z, 3 / z]); dg.strokeRect(Math.min(a[0], b[0]) * TILE, Math.min(a[1], b[1]) * TILE, (Math.abs(a[0] - b[0]) + 1) * TILE, (Math.abs(a[1] - b[1]) + 1) * TILE); dg.setLineDash([]); }
  dg.setTransform(1, 0, 0, 1, 0, 0);
  if (hv) { const t = tileAt(reg, Math.floor(hv[0]), Math.floor(hv[1])); dg.font = 12 * dpr + 'px sans-serif'; dg.textAlign = 'left'; dg.fillStyle = '#ddd'; dg.fillText(`${Math.floor(hv[0])}, ${Math.floor(hv[1])}  ${TILES[t] ? TILES[t].n : t}`, 10 * dpr, dcv.height - 10 * dpr); }
}

/* ---------- Edição no mapa ---------- */
function setTile(reg, tx, ty, ch) {
  if (ty < 0 || ty >= reg.map.length || tx < 0 || tx >= reg.map[0].length || reg.map[ty][tx] === ch) return false;
  reg.map[ty] = reg.map[ty].slice(0, tx) + ch + reg.map[ty].slice(tx + 1); return true;
}
function repaint(x0, y0, x1, y1) {                // redesenha só os ladrilhos mexidos (e vizinhos, que dependem deles)
  const reg = R(), C = View.regionImg(Dev.rid), g = C.img.getContext('2d');
  for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (y >= 0 && x >= 0 && y < reg.map.length && x < reg.map[0].length) drawTile(g, reg.map[y][x], x, y, reg);
  C.torches = torchesOf(reg);
}
function paintAt(t) {
  const reg = R(), b = Dev.brush, o = Math.floor((b - 1) / 2), x0 = Math.floor(t[0]) - o, y0 = Math.floor(t[1]) - o; let ch = false;
  for (let y = y0; y < y0 + b; y++) for (let x = x0; x < x0 + b; x++) ch = setTile(reg, x, y, Dev.tile) || ch;
  if (ch) repaint(x0, y0, x0 + b - 1, y0 + b - 1);
}
function fillRect(a, b) { const reg = R(), x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]), x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setTile(reg, x, y, Dev.tile); repaint(x0, y0, x1, y1); }
function fillAt(t) {
  const reg = R(), sx = Math.floor(t[0]), sy = Math.floor(t[1]); if (!reg.map[sy] || sx < 0 || sx >= reg.map[0].length) return;
  const from = reg.map[sy][sx]; if (from === Dev.tile) return;
  const q = [[sx, sy]];
  while (q.length) { const [x, y] = q.pop(); if (!reg.map[y] || x < 0 || x >= reg.map[0].length || reg.map[y][x] !== from) continue; setTile(reg, x, y, Dev.tile); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  View.forget(Dev.rid);
}
function pickObj(t) {
  const reg = R(), [x, y] = t;
  for (const [, hx, hy] of handlesOf(Dev.sel)) if (Math.abs(hx - x) < .4 && Math.abs(hy - y) < .4) return null;
  for (const [id, o] of Object.entries(REGIONS)) for (const p of o.portals) if (p.to === Dev.rid && Math.hypot(p.tx - x, p.ty - y) < .5) return { kind: 'arrival', o: p, from: id };
  for (const n of reg.npcs) if (Math.abs(n.x - x) < .6 && y > n.y - 1.4 && y < n.y + .4) return { kind: 'npcs', o: n };
  for (const c of reg.signs || []) if (Math.abs(c.x - x) < .6 && y > c.y - 1 && y < c.y + .3) return { kind: 'signs', o: c };
  for (const c of reg.chests || []) if (Math.abs(c.x - x) < .6 && y > c.y - 1 && y < c.y + .3) return { kind: 'chests', o: c };
  for (const p of reg.portals) if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return { kind: 'portals', o: p, from: Dev.rid };
  for (const s of reg.spawns) if (Math.hypot(s.x - x, s.y - y) < Math.max(.8, Math.min(s.r, 1.5))) return { kind: 'spawns', o: s };
  return null;
}
const startMove = (sel, t) => { Dev.sel = sel; const o = sel.o, k = sel.kind === 'arrival'; Dev.drag = { move: sel, d: [(k ? o.tx : o.x) - t[0], (k ? o.ty : o.y) - t[1]] }; };

let spaceDown = false;
dcv.addEventListener('contextmenu', e => e.preventDefault());
dcv.addEventListener('pointerdown', e => {
  if (!devUnlocked()) return;
  const ae = document.activeElement; if (ae && ae !== document.body && $('#d-pane').contains(ae)) ae.blur();   // grava o campo que estava sendo digitado
  dcv.setPointerCapture(e.pointerId); const t = toTile(e), reg = R();
  if (e.button !== 0 || spaceDown) { Dev.drag = { pan: [e.clientX - Dev.ox, e.clientY - Dev.oy] }; return; }
  if (Dev.testPick) { Dev.testPick = false; hint(''); devTest(Dev.rid, t[0] * TILE, t[1] * TILE); return; }
  // alça do selecionado
  for (const [k, hx, hy] of handlesOf(Dev.sel)) if (Math.abs(hx - t[0]) < .45 && Math.abs(hy - t[1]) < .45) { devPush(); Dev.drag = { handle: k }; return; }
  const tool = (e.shiftKey && ['tile', 'rect', 'fill'].includes(Dev.tool)) ? 'pick' : Dev.tool;
  if (tool === 'pick') { Dev.tile = tileAt(reg, Math.floor(t[0]), Math.floor(t[1])); if (Dev.tool === 'pick') Dev.tool = 'tile'; devTab('mapa'); return; }
  if (['npc', 'spawn', 'sign', 'chest', 'select', 'portal'].includes(tool)) { const o = pickObj(t); if (o) { devPush(); startMove(o, t); devTab('mapa'); devDraw(); return; } }
  devPush();
  const at = [half(t[0]), half(t[1])];
  if (tool === 'tile') { paintAt(t); Dev.drag = { paint: 1 }; }
  else if (tool === 'rect') { const a = [Math.floor(t[0]), Math.floor(t[1])]; Dev.drag = { rect: [a, a], fill: 1 }; }
  else if (tool === 'fill') fillAt(t);
  else if (tool === 'npc') { const n = { k: Dev.npcK, x: at[0], y: at[1] }; reg.npcs.push(n); startMove({ kind: 'npcs', o: n }, t); }
  else if (tool === 'spawn') { const s = { m: Dev.mobK, x: at[0], y: at[1], r: 3, n: 3 }; reg.spawns.push(s); startMove({ kind: 'spawns', o: s }, t); }
  else if (tool === 'sign') { const s = { x: at[0], y: at[1], text: 'Placa' }; (reg.signs = reg.signs || []).push(s); startMove({ kind: 'signs', o: s }, t); }
  else if (tool === 'chest') { const c = { id: uid('b_'), x: at[0], y: at[1], gold: 20, items: { pocao: 1 } }; (reg.chests = reg.chests || []).push(c); startMove({ kind: 'chests', o: c }, t); }
  else if (tool === 'portal') { const a = [Math.floor(t[0]), Math.floor(t[1])]; Dev.drag = { rect: [a, a] }; }
  else if (tool === 'start') reg.start = [Math.floor(t[0]), Math.floor(t[1])];
  else if (tool === 'select') Dev.sel = null;
  devSave(); devTab('mapa'); devDraw();
});
dcv.addEventListener('pointermove', e => {
  const t = toTile(e); Dev.hover = t; const d = Dev.drag;
  if (d && d.pan) { Dev.ox = e.clientX - d.pan[0]; Dev.oy = e.clientY - d.pan[1]; }
  else if (d && d.paint) paintAt(t);
  else if (d && d.move) {
    const { kind, o } = d.move, nx = t[0] + d.d[0], ny = t[1] + d.d[1];
    if (kind === 'arrival') { o.tx = half(nx); o.ty = half(ny); }
    else if (kind === 'portals') { o.x = Math.round(nx); o.y = Math.round(ny); }
    else { o.x = half(nx); o.y = half(ny); }
  } else if (d && d.handle) {
    const o = Dev.sel.o, k = d.handle, tx = Math.round(t[0]), ty = Math.round(t[1]);
    if (k === 'r') o.r = Math.max(0, half(Math.hypot(t[0] - o.x, t[1] - o.y)));
    if (k.includes('e')) o.w = Math.max(1, tx - o.x);
    if (k.includes('s')) o.h = Math.max(1, ty - o.y);
    if (k === 'w') { const r = o.x + o.w; o.x = Math.min(tx, r - 1); o.w = r - o.x; }
    if (k === 'n') { const b = o.y + o.h; o.y = Math.min(ty, b - 1); o.h = b - o.y; }
  } else if (d && d.rect) d.rect[1] = [Math.floor(t[0]), Math.floor(t[1])];
  devDraw();
});
dcv.addEventListener('pointerup', () => {
  const d = Dev.drag; Dev.drag = null; if (!d) return;
  if (d.rect && d.fill) fillRect(...d.rect);
  else if (d.rect) {
    const [a, b] = d.rect, to = Object.keys(REGIONS).find(k => k !== Dev.rid) || Dev.rid, [tx, ty] = defaultArrival(to, Dev.rid);
    const p = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]) + 1, h: Math.abs(a[1] - b[1]) + 1, to, tx, ty };
    R().portals.push(p); Dev.sel = { kind: 'portals', o: p, from: Dev.rid }; hint('Portal criado: escolha o destino e a chegada ao lado.');
  }
  if (d.move || d.paint || d.handle || d.rect) { devSave(); devTab('mapa'); }
  devDraw();
});
dcv.addEventListener('pointerleave', () => { Dev.hover = null; devDraw(); });
dcv.addEventListener('wheel', e => {
  e.preventDefault(); const r = dcv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, z0 = Dev.zoom;
  Dev.zoom = clamp(Dev.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2), .3, 10); Dev.ox = mx - (mx - Dev.ox) * Dev.zoom / z0; Dev.oy = my - (my - Dev.oy) * Dev.zoom / z0; devDraw();
}, { passive: false });
addEventListener('keyup', e => { if (e.code === 'Space') spaceDown = false; });
addEventListener('keydown', e => {
  if (!$('#dev').classList.contains('on') || !$('#d-lock').hidden || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  const k = e.code;
  if ((e.ctrlKey || e.metaKey) && k === 'KeyZ') { e.preventDefault(); e.shiftKey ? devRedo() : devUndo(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'KeyY') { e.preventDefault(); devRedo(); }
  else if ((e.ctrlKey || e.metaKey) && k === 'KeyS') { e.preventDefault(); saveProject(); }
  else if ((k === 'Delete' || k === 'Backspace') && Dev.sel && Dev.sel.kind !== 'arrival' && Dev.sel.kind !== 'start') { const l = R()[Dev.sel.kind]; if (!l) return; devPush(); l.splice(l.indexOf(Dev.sel.o), 1); Dev.sel = null; changed(); devTab('mapa'); }
  else if (k === 'Escape') { Dev.picking = null; Dev.testPick = false; Dev.sel = null; hint(''); devTab('mapa'); devDraw(); }
  else if (k === 'Space') { spaceDown = true; e.preventDefault(); }
  else if (Dev.tab === 'mapa' && !e.ctrlKey) { const t = { KeyB: 'tile', KeyR: 'rect', KeyG: 'fill', KeyI: 'pick', KeyV: 'select' }[k]; if (t) { Dev.tool = t; devTab('mapa'); devDraw(); } }
});
$('#d-undo').onclick = devUndo; $('#d-redo').onclick = devRedo;
addEventListener('beforeunload', e => { if (Dev.dirty && $('#dev').classList.contains('on')) { e.preventDefault(); e.returnValue = ''; } });

function devTest(rid, x, y) {
  if (hitsWall(REGIONS[rid], x, y, 5)) return hint('Ali é parede. Clique num lugar livre.');
  clearTimeout(saveTimer); store.set('adventure-world', WORLD);   // o teste lê o mundo gravado
  devStart = { r: rid, x, y };
  if (!chars.length) { chars.push(newChar('Teste', 'guerreiro')); saveChars(); }
  slot = Math.max(0, slot); start(() => Net.startHost(chars[slot], ''));
}
$('#d-back').onclick = devLeave;
$('#t-dev').onclick = devOpen; $('#t-dev').hidden = !DEV_OK;
if (location.hash === '#dev' && DEV_OK) devOpen();
