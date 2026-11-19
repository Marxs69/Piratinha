/* Grand Chronicle — interface: menu, escolha do mundo e da nação, barra do topo, painéis laterais, janelas,
   ordens no mapa (clique seleciona, botão direito move, arrastar move a câmera, roda dá zoom) e o laço do tempo. */
'use strict';

const $ = s => document.querySelector(s);
const SPEEDS = [0, 2, 6, 15, 40, 120];                       // dias por segundo
const UI = { scr: 'menu', speed: 0, last: 1, win: null, side: null, lastMap: 0, acc: 0, feed: [] };

/* ---------- utilidades de DOM ---------- */
function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function btn(txt, fn, cls = '', dis = '') { const b = el('button', 'btn ' + cls, txt); b.onclick = e => { e.stopPropagation(); fn(e); }; if (dis) { b.disabled = true; b.title = dis; } return b; }
function flagEl(f, cls) { const d = el('div', cls); d.innerHTML = flagSVG(f, Math.random().toString(36).slice(2, 7)); return d; }
const kv = pairs => { const d = el('div', 'kv'); pairs.forEach(([a, b]) => { d.append(el('span', '', a)); const v = el('span'); if (b instanceof Node) v.append(b); else v.textContent = b; d.append(v); }); return d; };
const sec = (title, ...kids) => { const s = el('div', 'sec'); if (title) s.append(el('h3', '', title)); kids.forEach(k => k && s.append(k)); return s; };
const money = v => (v < 0 ? '−' : '') + (Math.abs(v) >= 1e6 ? (Math.abs(v) / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e4 ? Math.round(Math.abs(v) / 1e3) + 'k' : Math.round(Math.abs(v)));
const popStr = k => k >= 1000 ? (k / 1000).toFixed(k >= 1e4 ? 0 : 1) + ' mi' : Math.round(k) + ' mil';
const pct = v => Math.round(v * 100) + '%';
const sgn = v => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v * 100)) + '%';
function modChips(m) { const d = el('div', 'chips'); for (const k in m) { if (!m[k] || !MODS[k]) continue; const good = k === 'admin' ? m[k] > 0 : m[k] > 0; d.append(el('span', 'chip ' + (good ? 'p' : 'n'), MODS[k] + ' ' + sgn(m[k]))); } if (m.coupX != null) d.append(el('span', 'chip ' + (m.coupX < 1 ? 'p' : 'n'), 'Golpes ×' + m.coupX)); else if (m.coup) d.append(el('span', 'chip ' + (m.coup < 0 ? 'p' : 'n'), 'Risco de golpe ' + sgn(Math.max(-.9, m.coup)))); return d; }
const me = () => nat(S.player);
function bar(v, col) { const b = el('div', 'pbar'), i = el('i'); i.style.width = clamp(v, 0, 1) * 100 + '%'; if (col) i.style.background = col; b.append(i); return b; }
function say(m, k = 'info') { UI.feed.unshift({ m, k, t: performance.now() }); drawFeed(); }

/* ---------- telas ---------- */
function show(scr) { ['menu', 'setup', 'game'].forEach(s => $('#' + s).classList.toggle('on', s === scr)); UI.scr = scr; }
function menu() {
  show('menu'); UI.speed = 0; $('#m-cont').hidden = !hasSave();
  const r = mkRng(Date.now() & 0xffff), box = $('#mflags'); box.innerHTML = '';
  for (let i = 0; i < 5; i++) { const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(flagSVG(flagRandom(r), 'm' + i)); box.append(im); }
}
$('#m-new').onclick = () => { show('setup'); $('#s-seed').value = (Math.random() * 1e9 | 0) + ''; genWorld(); };
$('#m-cont').onclick = () => { if (loadGame()) startPlay(false); else say('Não foi possível carregar.', 'bad'); };
$('#s-back').onclick = () => { S = null; menu(); };
$('#s-gen').onclick = () => { $('#s-seed').value = (Math.random() * 1e9 | 0) + ''; genWorld(); };
$('#s-seed').onchange = () => genWorld();
function genWorld() {
  $('#s-load').hidden = false; $('#s-card').innerHTML = '';
  setTimeout(() => {
    const seed = parseInt($('#s-seed').value, 10) || 1; newGame(seed); terrRGB = null; R.view = -1; R.mode = 'pol'; R.sel = null; R.selArmy = R.selFleet = null;
    rebuildMap(); fitCam(); $('#s-load').hidden = true; setupCard(null); drawModes($('#s-modes'));
  }, 30);
}
function setupCard(id) {
  const c = $('#s-card'); c.innerHTML = '';
  if (id == null) { c.append(el('h3', 'gold', 'Escolha uma nação no mapa')); return; }
  const n = nat(id); UI.pick = id;
  c.append(flagEl(n.flag, 'big-flag'), el('h2', '', natName(n)));
  const cont = WD.conts[n.home];
  c.append(kv([['Governo', GOVS[n.gov].n], ['Ideologia', IDEOS[n.ideo].n], ['Governante', titleOf(n) + ' ' + charName(n.ruler)], ['Continente', cont.n + (cont.main ? ' (principal)' : '')], ['Províncias', provsOf(id).length], ['População', popStr(n.popT || 0)], ['Tecnologias', techCount(n)]]));
  c.append(btn('Jogar com esta nação ▶', () => { S.player = id; startPlay(true); }, 'grn'));
}
function startPlay(fresh) {
  show('game'); terrRGB = null; R.view = S.player; R.mode = 'pol'; S.mapDirty = true; rebuildMap();
  const cap = WD.provs[me().capital]; R.cam.z = 3; R.cam.x = cap.cx * K - innerWidth / 2 / R.cam.z; R.cam.y = cap.cy * K - innerHeight / 2 / R.cam.z; clampCam();
  UI.speed = 0; UI.side = null; UI.ended = false; closeWin(); drawModes($('#modes')); drawTop(); drawOutl(); drawSide();
  if (fresh) { say('Você governa ' + natName(me()) + '. Pausado: escolha uma pesquisa e aperte ▶.', 'good'); saveGame(); }
}

/* ---------- modos de mapa ---------- */
const MODEBTN = [['pol', '🗺️', 'Político'], ['ter', '⛰️', 'Terreno'], ['dip', '🤝', 'Diplomático'], ['pop', '👥', 'População'], ['reg', '🧩', 'Regiões e estados'], ['cont', '🌍', 'Continentes'], ['res', '⛏️', 'Recursos']];
function drawModes(box) { box.innerHTML = ''; MODEBTN.forEach(([m, e, t]) => { const b = btn(e, () => { R.mode = m; S.mapDirty = true; drawModes(box); }, R.mode === m ? 'on' : ''); b.title = t; box.append(b); }); }

/* ---------- barra do topo ---------- */
function drawTop() {
  const t = $('#top'), n = me(); t.innerHTML = '';
  const f = flagEl(n.flag, 'flag'); f.title = 'Bandeira'; f.onclick = () => openWin('flag'); t.append(f);
  const nm = el('div', 'nname'); nm.append(el('b', '', natName(n)), el('small', '', titleOf(n) + ' ' + charName(n.ruler))); t.append(nm);
  const res = (v, s, tip, cls = '') => { const d = el('div', 'res'); d.title = tip; const b = el('b', cls, v); d.append(b, el('small', '', s)); t.append(d); };
  res('💰 ' + money(n.money), (n.income >= 0 ? '+' : '−') + money(Math.abs(n.income)) + '/mês', 'Tesouro', n.money < 0 ? 'bad' : '');
  res('👥 ' + Math.floor(n.manpower) + 'k', 'de ' + Math.floor(n.mpMax || 0) + 'k', 'Contingente');
  res('⚖️ ' + Math.round(n.stab), 'estabilidade', 'Estabilidade', n.stab < 30 ? 'bad' : n.stab > 70 ? 'good' : '');
  const tr = n.res ? TECH[n.res] : null; res('🔬 ' + (tr ? Math.floor(n.rp / techCost(n, tr) * 100) + '%' : '—'), tr ? tr.n : 'sem pesquisa', 'Pesquisa', tr ? '' : 'bad');
  const w = warsOf(n.id).length; res('⚔️ ' + w, w ? 'em guerra' : 'em paz', 'Guerras', w ? 'bad' : '');
  [['🏛️', 'gov', 'Governo'], ['💰', 'eco', 'Economia'], ['🔬', 'tech', 'Tecnologia'], ['⚔️', 'mil', 'Militar'], ['🤝', 'dip', 'Diplomacia'], ['📜', 'log', 'Crônica']].forEach(([e, id, tt]) => { const b = btn(e + ' ' + tt, () => UI.win === id ? closeWin() : openWin(id), UI.win === id ? 'on' : ''); t.append(b); });
  t.append(el('span', 'grow'));
  const sp = el('div', 'speed'); [0, 1, 2, 3, 4, 5].forEach(k => { const b = btn(k ? '▶'.repeat(Math.min(k, 3)) + (k > 3 ? k : '') : '⏸', () => setSpeed(k), UI.speed === k ? 'on' : ''); b.title = k ? 'Velocidade ' + k : 'Pausar (espaço)'; sp.append(b); }); t.append(sp);
  t.append(el('div', 'date', dateStr()));
  t.append(btn('☰', () => gameMenu()));
}
function setSpeed(k) { UI.speed = k; if (k) UI.last = k; drawTop(); }
function gameMenu() {
  modal(m => {
    m.append(el('h2', '', 'Grand Chronicle'));
    m.append(btn('💾 Salvar', () => { say(saveGame() ? 'Jogo salvo.' : 'Não foi possível salvar.', 'good'); closeModal(); }));
    m.append(btn('🚪 Salvar e sair para o menu', () => { saveGame(); closeModal(); S = null; menu(); }));
    m.append(btn('Voltar', closeModal));
  });
}

/* ---------- painel lateral ---------- */
function select(kind, id) { UI.side = kind ? { kind, id } : null; R.sel = kind === 'prov' ? id : null; R.selArmy = kind === 'army' ? S.armies.find(a => a.id === id) : null; R.selFleet = kind === 'fleet' ? S.fleets.find(f => f.id === id) : null; drawSide(); }
function drawSide() {
  const sd = $('#side'), keep = sd.scrollTop; sd.innerHTML = ''; const s = UI.side;
  if (!s) { sd.hidden = true; return; } sd.hidden = false;
  const close = btn('✕', () => select(null), 'x sm'); close.style.float = 'right'; sd.append(close);
  if (s.kind === 'prov') sideProv(sd, s.id); else if (s.kind === 'nat') sideNat(sd, s.id); else if (s.kind === 'army') sideArmy(sd, s.id); else if (s.kind === 'fleet') sideFleet(sd, s.id);
  sd.scrollTop = keep;
}
function sideProv(sd, p) {
  const pr = WD.provs[p], st = WD.states[pr.state], rg = WD.regions[pr.region], ct = WD.conts[pr.cont], n = me(), o = S.own[p], c = S.ctrl[p];
  const h = el('div', 'side-h'); if (o >= 0) { const f = flagEl(nat(o).flag, 'fl'); f.onclick = () => select('nat', o); h.append(f); }
  const tt = el('div'); tt.append(el('h2', '', pr.n), el('small', 'dim', st.n + ' · ' + rg.n + ' · ' + ct.n)); h.append(tt); sd.append(h);
  if (!n.exP[p]) { sd.append(el('p', 'dim', 'Terra inexplorada.')); return; }
  sd.append(kv([['Dono', o >= 0 ? natName(nat(o)) : 'Nativos'], ...(c !== o && c >= 0 ? [['Ocupada por', natName(nat(c))]] : []), ['Terreno', TERRAIN[pr.terr].n + (pr.coast ? ' · litoral' : '')], ['Recurso', pr.res ? GOODS[pr.res].e + ' ' + GOODS[pr.res].n : '—'], ['População', popStr(S.pop[p])], ['Fortificação', fortOf(p) || '—']]));
  const msg = el('div', 'msg'), act = (fn) => () => { const e = fn(); msg.textContent = e || ''; if (!e) { drawSide(); drawTop(); drawOutl(); } };
  if (o === -1) {
    const col = S.cols.find(x => x.p === p);
    if (col) sd.append(sec('Colonização', el('div', '', natName(nat(col.o)) + ' · faltam ' + col.m + ' meses'), bar(1 - col.m / col.tot)));
    else { const e = canColonize(n, p); sd.append(sec('Colonização', btn('Colonizar (💰' + colCost(n, p) + ')', act(() => colonize(n, p)), 'grn', e), msg)); }
    return;
  }
  if (o === n.id && c === n.id) {
    const r = el('div', 'row'); ['inf', 'cav', 'art', 'vrt'].filter(t => t !== 'vrt' || n.vert).forEach(t => { const e = canRecruit(n, t, 1); r.append(btn(unitName(n, t) + ' (💰' + recCost(n, t) + ')', act(() => recruit(n, t, 1, p)), 'sm', e)); });
    const r5 = el('div', 'row'); r5.append(btn('5× ' + unitName(n, 'inf'), act(() => recruit(n, 'inf', 5, p)), 'sm', canRecruit(n, 'inf', 5)));
    if (pr.coast) r5.append(btn('⛵ Navios ×2 (💰' + shipCost(n) * 2 + ')', act(() => buildShips(n, 2, p)), 'sm', !n.fx.sea ? 'Exige Barcos longos' : n.money < shipCost(n) * 2 ? 'Sem dinheiro' : ''));
    sd.append(sec('Recrutar', r, r5, msg));
  } else if (o !== n.id) {
    const has = n.claims[st.id], fab = n.fab && n.fab.s === st.id;
    sd.append(sec('Reivindicação', has ? el('div', 'good', 'Você reivindica ' + st.n + '.') : fab ? el('div', 'dim', 'Fabricando… ' + n.fab.m + ' meses') : btn('Fabricar reivindicação em ' + st.n + ' (💰' + Math.round(40 * eraScale()) + ')', act(() => fabricate(n, st.id)), 'sm', n.fab ? 'Já fabricando' : ''), msg));
  }
  sideState(sd, st);
}
function sideState(sd, st) {
  const n = me(), so = stateOwnerOf(st.id), B = S.bld[st.id], box = sec('Estado: ' + st.n);
  let sp = 0; st.provs.forEach(p => { if (S.own[p] === so) sp += S.pop[p]; });
  box.append(kv([['Capital', WD.provs[st.cap].n], ['Controla a infraestrutura', so >= 0 ? natName(nat(so)) : '—'], ['População', popStr(sp)], ['Províncias', st.provs.length]]));
  const list = el('div');
  Object.keys(BUILDINGS).forEach(b => {
    const d = BUILDINGS[b], L = B[b] || 0, inCons = n.cons.filter(c => c.s === st.id && c.b === b);
    if (so !== n.id && !L) return;
    const avail = d.vert ? n.vert === d.vert : n.fx.b.has(b); if (!L && !avail) return;
    const err = so === n.id ? canBuild(n, st.id, b) : 'Não é seu';
    if (!L && !inCons.length && err && err !== 'Sem dinheiro' && err !== 'Sem canteiros livres') return;
    const r = el('div', 'brow'); r.append(el('span', 'e', d.e), el('span', 'nm', d.n + (inCons.length ? ' (+' + inCons.length + ' em obra)' : '')), el('span', 'lv', L || '—'));
    if (so === n.id) { const bb = btn('+ 💰' + bCost(n, b), () => { const e = build(n, st.id, b); if (e) say(e, 'bad'); drawSide(); drawTop(); drawOutl(); }, 'sm', err); bb.title = err || bMonths(b) + ' meses'; r.append(bb); }
    let io = []; if (d.in) io.push(Object.entries(d.in).map(([g, q]) => GOODS[g].e + q).join(' ')); if (d.out) io.push('→ ' + Object.entries(d.out).map(([g, q]) => GOODS[g].e + q).join(' '));
    r.title = io.join(' ') + (d.fx ? ' · ' + Object.entries(d.fx).map(([k, v]) => k + ' +' + v).join(' ') : '') + ' · ' + d.w + 'k trabalhadores';
    list.append(r);
  });
  box.append(list);
  if (so === n.id) { const cons = n.cons.filter(c => c.s === st.id); cons.forEach(c => { box.append(el('div', 'dim', BUILDINGS[c.b].n + ' · ' + c.m + ' meses')); box.append(bar(1 - c.m / c.tot)); }); }
  sd.append(box);
}
function sideNat(sd, id) {
  const n = nat(id), mine = me(), h = el('div', 'side-h');
  h.append(flagEl(n.flag, 'fl')); const tt = el('div'); tt.append(el('h2', '', natName(n)), el('small', 'dim', GOVS[n.gov].n + ' · ' + IDEOS[n.ideo].n)); h.append(tt); sd.append(h);
  const armies = S.armies.filter(a => a.o === id).reduce((s, a) => s + regs(a), 0);
  sd.append(kv([['Governante', titleOf(n) + ' ' + charName(n.ruler) + ' (' + ageOf(n.ruler) + ')'], ['Províncias', provsOf(id).length], ['População', popStr(n.popT || 0)], ['PIB', money(n.gdp || 0) + '/mês'], ['Exército', fmtK(armies)], ['Tecnologias', techCount(n)], ['Vertente', n.vert ? VERT[n.vert].n + ' ' + n.vlv : '—'], ['Relação', n.rel[mine.id] != null ? Math.round(mine.rel[id] || 0) : '—']]));
  if (id === mine.id) { sd.append(sec('', btn('🏛️ Governo', () => openWin('gov')))); return; }
  const msg = el('div', 'msg'), w = S.wars.find(w => (w.a === id && w.d === mine.id) || (w.d === id && w.a === mine.id));
  if (w) sd.append(sec('Guerra', el('div', '', 'Placar: ' + (warScore(w) * (w.a === mine.id ? 1 : -1))), btn('🕊️ Negociar paz', () => openWin('peace', w.id))));
  else {
    const claims = WD.states.filter(s => mine.claims[s.id] && s.provs.some(p => S.own[p] === id));
    const sel = el('select'); sel.append(new Option('Sem reivindicação (−15 estabilidade)', '')); claims.forEach(s => sel.append(new Option('Reivindicação: ' + s.n, s.id)));
    const truce = mine.truce[id] > S.t;
    sd.append(sec('Guerra', sel, btn('⚔️ Declarar guerra', () => { const e = declareWar(mine, n, sel.value === '' ? null : +sel.value); msg.textContent = e; if (!e) { S.mapDirty = true; drawSide(); drawTop(); drawOutl(); } }, 'red', truce ? 'Trégua até ' + yearOf(mine.truce[id]) : ''), msg));
  }
}
function unitRow(a, n) { const d = el('div'); ['inf', 'cav', 'art', 'vrt'].forEach(t => { if (a[t] > .05) d.append(el('div', 'brow', fmtK(a[t]) + ' · ' + unitName(n, t))); }); return d; }
function sideArmy(sd, id) {
  const a = S.armies.find(a => a.id === id); if (!a) { select(null); return; } const n = nat(a.o), P = WD.provs.length;
  const h = el('div', 'side-h'); h.append(flagEl(n.flag, 'fl')); const tt = el('div'); tt.append(el('h2', '', 'Exército · ' + fmtK(regs(a))), el('small', 'dim', a.p < P ? WD.provs[a.p].n : WD.seas[a.p - P].n)); h.append(tt); sd.append(h);
  sd.append(unitRow(a, n), el('div', 'dim', 'Moral'), bar(a.mor, '#7fe08a'));
  if (a.o !== S.player) return;
  sd.append(el('p', 'dim', a.path.length ? 'Marchando: ' + a.path.length + ' passos' : 'Botão direito no mapa para mover.'));
  const r = el('div', 'row');
  r.append(btn('Parar', () => { a.path = []; drawSide(); }, 'sm'));
  r.append(btn('Dividir', () => { const b = addArmy(a.o, a.p, { inf: a.inf / 2, cav: a.cav / 2, art: a.art / 2, vrt: a.vrt / 2 }); ['inf', 'cav', 'art', 'vrt'].forEach(t => a[t] /= 2); select('army', b.id); }, 'sm', regs(a) < 1 ? 'Pequeno demais' : ''));
  const here = S.armies.filter(b => b !== a && b.o === a.o && b.p === a.p);
  r.append(btn('Mesclar', () => { here.forEach(b => { ['inf', 'cav', 'art', 'vrt'].forEach(t => { a[t] += b[t]; b[t] = 0; }); }); S.armies = S.armies.filter(b => regs(b) > .08); drawSide(); }, 'sm', here.length ? '' : 'Nenhum outro exército aqui'));
  r.append(btn('Desmobilizar', () => { n.manpower += regs(a) * .5; a.inf = a.cav = a.art = a.vrt = 0; S.armies = S.armies.filter(b => regs(b) > .08); select(null); drawOutl(); }, 'sm red'));
  sd.append(r);
}
function sideFleet(sd, id) {
  const f = S.fleets.find(f => f.id === id); if (!f) { select(null); return; } const n = nat(f.o);
  const h = el('div', 'side-h'); h.append(flagEl(n.flag, 'fl')); const tt = el('div'); tt.append(el('h2', '', 'Frota · ⛵' + Math.ceil(f.ships)), el('small', 'dim', WD.seas[f.z].n)); h.append(tt); sd.append(h);
  if (f.o !== S.player) return;
  sd.append(el('p', 'dim', f.auto ? 'Explorando sozinha.' : f.path.length ? 'Navegando.' : 'Botão direito num mar para navegar.'));
  const r = el('div', 'row'); r.append(btn(f.auto ? 'Parar exploração' : '🧭 Explorar', () => { f.auto = !f.auto; if (!f.auto) f.path = []; drawSide(); }, 'sm'), btn('Parar', () => { f.path = []; f.auto = false; drawSide(); }, 'sm'));
  sd.append(r, el('p', 'dim', 'Capacidade de transporte: ' + transport(f.o) + ' regimentos'));
}

/* ---------- painel da direita (exércitos, frotas, guerras, obras) ---------- */
function drawOutl() {
  const o = $('#outl'), n = me(); o.innerHTML = ''; const P = WD.provs.length;
  const wars = warsOf(n.id); if (wars.length) { o.append(el('h4', '', 'GUERRAS')); wars.forEach(w => { const e = nat(w.a === n.id ? w.d : w.a), r = el('div', 'orow'); r.append(flagImgEl(e.flag), el('span', 'grow', e.name), el('b', (w.score * (w.a === n.id ? 1 : -1)) >= 0 ? 'good' : 'bad', (w.a === n.id ? w.score : -w.score) + '')); r.onclick = () => openWin('peace', w.id); o.append(r); }); }
  const ar = S.armies.filter(a => a.o === n.id); if (ar.length) { o.append(el('h4', '', 'EXÉRCITOS')); ar.forEach(a => { const r = el('div', 'orow'); r.append(el('span', '', '⚔️'), el('span', 'grow', a.p < P ? WD.provs[a.p].n : WD.seas[a.p - P].n), el('b', '', fmtK(regs(a)))); r.onclick = () => { select('army', a.id); centerOn(...armyXY(a)); }; o.append(r); }); }
  const fl = S.fleets.filter(f => f.o === n.id); if (fl.length) { o.append(el('h4', '', 'FROTAS')); fl.forEach(f => { const r = el('div', 'orow'); r.append(el('span', '', f.auto ? '🧭' : '⛵'), el('span', 'grow', WD.seas[f.z].n), el('b', '', Math.ceil(f.ships) + '')); r.onclick = () => { select('fleet', f.id); centerOn(...fleetXY(f)); }; o.append(r); }); }
  const busy = n.cons.length + n.rec.length + S.cols.filter(c => c.o === n.id).length;
  if (busy) { o.append(el('h4', '', 'EM ANDAMENTO')); n.cons.forEach(c => o.append(el('div', 'orow', BUILDINGS[c.b].e + ' ' + BUILDINGS[c.b].n + ' · ' + c.m + 'm'))); n.rec.forEach(r => o.append(el('div', 'orow', (r.type === 'ship' ? '⛵ Navios' : unitName(n, r.type)) + ' ×' + r.k + ' · ' + r.m + 'm'))); S.cols.filter(c => c.o === n.id).forEach(c => o.append(el('div', 'orow', '🏕️ ' + WD.provs[c.p].n + ' · ' + c.m + 'm'))); }
}
function flagImgEl(f) { const im = new Image(); im.className = 'mini'; im.src = flagImg(f).src; return im; }
function centerOn(wx, wy) { R.cam.x = wx - innerWidth / 2 / R.cam.z; R.cam.y = wy - innerHeight / 2 / R.cam.z; clampCam(); }

/* ---------- janelas ---------- */
const WTITLE = { gov: 'Governo', eco: 'Economia', tech: 'Tecnologia', mil: 'Militar', dip: 'Diplomacia', flag: 'Bandeira', peace: 'Paz', log: 'Crônica' };
function openWin(id, arg) { UI.win = id; UI.warg = arg; $('#win').hidden = false; $('#win-t').textContent = WTITLE[id]; drawWin(); drawTop(); }
function closeWin() { UI.win = null; $('#win').hidden = true; if (S && S.player >= 0) drawTop(); }
$('#win-x').onclick = closeWin;
function drawWin() {
  if (!UI.win) return; const b = $('#win-b'), keep = b.scrollTop; b.innerHTML = '';
  ({ gov: winGov, eco: winEco, tech: winTech, mil: winMil, dip: winDip, flag: winFlag, peace: winPeace, log: winLog })[UI.win](b);
  b.scrollTop = keep;
}
function charCard(c, title, n, extra) {
  const d = el('div', 'card'); d.append(el('h4', '', title));
  d.append(el('div', '', charName(c) + ' · ' + ageOf(c) + ' anos'));
  const st = el('div', 'chips'); [['dip', 'Diplomacia'], ['mar', 'Marcial'], ['adm', 'Administração'], ['int', 'Intriga'], ['lea', 'Saber']].forEach(([k, t]) => st.append(el('span', 'chip', t + ' ' + c.st[k]))); d.append(st);
  const tr = el('div', 'chips'); c.tr.forEach(t => { const x = el('span', 'chip gold', TRAITS[t].n); x.title = Object.entries(TRAITS[t].m).map(([k, v]) => (MODS[k] || k) + ' ' + sgn(v)).join(', '); tr.append(x); }); d.append(tr);
  if (extra) d.append(extra); return d;
}
function winGov(b) {
  const n = me(), msg = el('div', 'msg');
  const top = el('div', 'cols'); top.append(charCard(n.ruler, titleOf(n), n));
  if (n.spouse) top.append(charCard(n.spouse, 'Cônjuge', n));
  if (n.kids && n.kids.length) { const d = el('div', 'card'); d.append(el('h4', '', 'Herdeiros')); n.kids.slice().sort((a, b) => a.born - b.born).forEach(k => d.append(el('div', '', charName(k) + ' · ' + ageOf(k) + ' anos'))); top.append(d); }
  b.append(top);
  const cc = el('div', 'cols'); cc.style.marginTop = '12px';
  COUNCIL.forEach(([k, t]) => { const c = n.council[k]; cc.append(charCard(c, t, n, btn('Trocar (💰' + Math.round(25 * eraScale()) + ')', () => { msg.textContent = swapCouncil(n, k); drawWin(); drawTop(); }, 'sm'))); });
  b.append(el('h3', 'gold', 'Conselho'), cc, msg);
  b.append(el('h3', 'gold', 'Modificadores atuais'), modChips(n.m));
  const go = el('div', 'grid-opts'), cats = {};
  Object.entries(GOVS).forEach(([g, d]) => (cats[d.cat] = cats[d.cat] || []).push([g, d]));
  const cost = Math.round(80 * eraScale());
  b.append(el('h3', 'gold', 'Governo · reforma 💰' + cost));
  Object.entries(cats).forEach(([cat, list]) => list.forEach(([g, d]) => {
    const ok = n.fx.g.has(g) || ['tribal', 'tribal_conf', 'horde', 'feudal', 'elective'].includes(g), o = el('div', 'opt' + (n.gov === g ? ' on' : '') + (ok ? '' : ' off'));
    o.append(el('b', '', d.n), el('small', 'dim', cat + ' · ' + d.t + (d.term ? ' · mandato de ' + d.term + ' anos' : '') + (d.minProv ? ' · ' + d.minProv + '+ províncias' : '')), modChips(Object.assign({}, d.m, { coupX: d.coup })));
    if (ok && n.gov !== g) o.onclick = () => { msg.textContent = setGov(n, g); drawWin(); drawTop(); };
    go.append(o);
  }));
  b.append(go);
  const io = el('div', 'grid-opts'); b.append(el('h3', 'gold', 'Ideologia'));
  Object.entries(IDEOS).forEach(([i, d]) => { const ok = n.fx.i.has(i), o = el('div', 'opt' + (n.ideo === i ? ' on' : '') + (ok ? '' : ' off')); o.style.borderLeft = '4px solid ' + d.col; o.append(el('b', '', d.n), modChips(d.m)); if (ok && n.ideo !== i) o.onclick = () => { msg.textContent = setIdeo(n, i); drawWin(); drawTop(); }; io.append(o); });
  b.append(io);
}
function winEco(b) {
  const n = me(), sum = el('div', 'cols');
  const inc = el('div', 'card'); inc.append(el('h4', '', 'Balanço mensal'));
  const t = el('table', 't'); const lab = { tax: 'Impostos', trade: 'Exportações', imports: 'Importações', army: 'Exército', navy: 'Marinha', admin: 'Administração', interest: 'Juros', corrupt: 'Corrupção' };
  Object.entries(n.inc).forEach(([k, v]) => { const r = t.insertRow(); r.insertCell().textContent = lab[k]; const c = r.insertCell(); c.className = 'n ' + (v < 0 ? 'bad' : 'good'); c.textContent = money(v); });
  const tr = t.insertRow(); tr.insertCell().textContent = 'Total'; const tc = tr.insertCell(); tc.className = 'n gold'; tc.textContent = money(n.income); inc.append(t); sum.append(inc);
  const g = el('div', 'card'); g.append(el('h4', '', 'Produção'), kv([['PIB', money(n.gdp) + '/mês'], ['População', popStr(n.popT)], ['Empregados', popStr(n.employed || 0)], ['Comida', pct(n.foodSat)], ['Canteiros', n.cons.length + ' / ' + consSlots(n)]]), modChips({ tax: n.m.tax, prod: n.m.prod, trade: n.m.trade, food: n.m.food })); sum.append(g);
  b.append(sum);
  const gt = el('table', 't'); gt.style.marginTop = '12px'; const hr = gt.insertRow(); ['Bem', 'Produção', 'Consumo', 'Importa', 'Exporta', 'Preço mundial', 'Atendido'].forEach(x => { const th = el('th', '', x); hr.append(th); });
  GOOD_IDS.forEach(id => {
    const s = n.mk.sup[id] || 0, d = n.mk.dem[id] || 0; if (s < .05 && d < .05) return;
    const r = gt.insertRow(); r.insertCell().textContent = GOODS[id].e + ' ' + GOODS[id].n;
    [s, d, n.mk.imp[id] || 0, n.mk.exp[id] || 0].forEach(v => { const c = r.insertCell(); c.className = 'n'; c.textContent = v >= 10 ? Math.round(v) : v.toFixed(1); });
    const p = r.insertCell(); p.className = 'n'; p.textContent = S.wp[id].toFixed(1); const ratio = S.wp[id] / GOODS[id].p; p.classList.add(ratio > 1.3 ? 'bad' : ratio < .7 ? 'good' : 'x');
    const sc = r.insertCell(); sc.style.width = '120px'; sc.append(bar(n.mk.sat[id] == null ? 1 : n.mk.sat[id], (n.mk.sat[id] || 1) < .8 ? '#e5636b' : '#8fd17f'));
  });
  b.append(gt);
}
function winTech(b) {
  const n = me(), y = curYear();
  const cur = el('div', 'card'); const tr = n.res ? TECH[n.res] : null;
  cur.append(el('h4', '', 'Pesquisando'), el('div', '', tr ? tr.n + ' · ' + Math.floor(n.rp) + ' / ' + techCost(n, tr) : 'Nada — escolha abaixo'), bar(tr ? n.rp / techCost(n, tr) : 0), el('small', 'dim', '+' + researchRate(n).toFixed(1) + ' por mês'));
  b.append(cur);
  const cols = el('div', 'tcols'); cols.style.marginTop = '12px';
  Object.entries(CATS).forEach(([c, name]) => {
    const col = el('div', 'tcol'); col.append(el('h4', '', name));
    TECHS.filter(t => t.c === c).sort((a, b) => a.y - b.y).forEach(t => col.append(techBox(n, t)));
    cols.append(col);
  });
  b.append(cols);
  b.append(el('h3', 'gold', 'Vertentes'));
  const vg = el('div', 'vgrid');
  VERTS.forEach(v => {
    const d = el('div', 'vcol' + (n.vert === v.id ? ' chosen' : n.vert ? ' closed' : '')); d.style.borderTop = '3px solid ' + v.col;
    d.append(el('h5', '', v.e + ' ' + v.n));
    for (let i = 0; i < 5; i++) d.append(techBox(n, TECH['v_' + v.id + i], v.unit[i]));
    vg.append(d);
  });
  b.append(vg);
}
function techBox(n, t, sub) {
  const s = techState(n, t), cls = s === 'done' ? 'done' : s ? 'lock' : 'av', d = el('div', 'tech ' + cls + (n.res === t.id ? ' cur' : ''));
  d.append(el('b', '', t.n)); const info = el('small', '', t.y + (s === 'done' ? ' · ✓' : ' · 🔬' + techCost(n, t)) + (sub ? ' · ' + sub : '')); d.append(info);
  const fx = t.fx, tip = []; if (fx.b) tip.push('Prédios: ' + fx.b.map(x => BUILDINGS[x].n).join(', ')); if (fx.g) tip.push('Governos: ' + fx.g.map(x => GOVS[x].n).join(', ')); if (fx.i) tip.push('Ideologias: ' + fx.i.map(x => IDEOS[x].n).join(', '));
  if (fx.m) tip.push(Object.entries(fx.m).map(([k, v]) => MODS[k] + ' ' + sgn(v)).join(', ')); if (fx.u) tip.push('Unidades: ' + Object.entries(fx.u).map(([k, v]) => k + ' +' + v).join(', ')); if (fx.bo) tip.push(Object.entries(fx.bo).map(([k, v]) => BUILDINGS[k].n + ' ' + sgn(v)).join(', '));
  if (fx.sea) tip.push(fx.sea === 1 ? 'Navegação costeira' : 'Navegação oceânica'); if (fx.col) tip.push('Colonização'); if (fx.fort) tip.push('Fortificações +' + fx.fort); if (fx.slots) tip.push('Canteiros +' + fx.slots);
  if (t.c === 'vert') tip.push('Vertente ' + VERT[t.v].n + ' nível ' + t.lv + ': ' + Object.entries(VERT[t.v].m).map(([k, v]) => MODS[k] + ' ' + sgn(v)).join(', ') + ' por nível');
  if (t.req.length) tip.push('Exige: ' + t.req.map(q => TECH[q].n).join(', ')); if (s && s !== 'done') tip.push(s);
  d.title = tip.join('\n');
  if (!s) d.onclick = () => { n.res = t.id; drawWin(); drawTop(); };
  return d;
}
function winMil(b) {
  const n = me(), P = WD.provs.length, msg = el('div', 'msg');
  const c = el('div', 'cols');
  const pw = el('div', 'card'); pw.append(el('h4', '', 'Unidades'));
  const t = el('table', 't'); const h = t.insertRow(); ['Tipo', 'Unidade', 'Força', 'Custo', ''].forEach(x => h.append(el('th', '', x)));
  ['inf', 'cav', 'art', 'vrt'].forEach(ty => { const r = t.insertRow(); r.insertCell().textContent = { inf: 'Infantaria', cav: 'Cavalaria', art: 'Artilharia', vrt: 'Vertente' }[ty]; r.insertCell().textContent = unitName(n, ty); const f = r.insertCell(); f.className = 'n'; f.textContent = (n.up[ty] * UNIT_BASE[ty].a).toFixed(2); const co = r.insertCell(); co.className = 'n'; co.textContent = '💰' + recCost(n, ty); r.insertCell().append(btn('+1 na capital', () => { msg.textContent = recruit(n, ty, 1); drawWin(); drawTop(); drawOutl(); }, 'sm', canRecruit(n, ty, 1))); });
  pw.append(t, msg); c.append(pw);
  const st = el('div', 'card'); st.append(el('h4', '', 'Forças'), kv([['Regimentos', fmtK(S.armies.filter(a => a.o === n.id).reduce((s, a) => s + regs(a), 0))], ['Contingente', Math.floor(n.manpower) + 'k / ' + Math.floor(n.mpMax) + 'k'], ['Navios', Math.ceil(S.fleets.filter(f => f.o === n.id).reduce((s, f) => s + f.ships, 0))], ['Transporte', transport(n.id) + ' regimentos'], ['Navegação', n.fx.sea === 2 ? 'Oceânica' : n.fx.sea ? 'Costeira' : 'Nenhuma'], ['Cerco', '×' + n.up.siege.toFixed(1)]]), modChips({ army: n.m.army, manpower: n.m.manpower, speed: n.m.speed })); c.append(st);
  b.append(c);
  const at = el('table', 't'); at.style.marginTop = '12px'; const hh = at.insertRow(); ['Exército', 'Local', 'Tropas', 'Moral', ''].forEach(x => hh.append(el('th', '', x)));
  S.armies.filter(a => a.o === n.id).forEach((a, i) => { const r = at.insertRow(); r.insertCell().textContent = '#' + (i + 1); r.insertCell().textContent = a.p < P ? WD.provs[a.p].n : WD.seas[a.p - P].n; r.insertCell().textContent = ['inf', 'cav', 'art', 'vrt'].filter(t => a[t] > .05).map(t => fmtK(a[t]) + ' ' + unitName(n, t)).join(', '); const m = r.insertCell(); m.style.width = '90px'; m.append(bar(a.mor, '#7fe08a')); r.insertCell().append(btn('Ver', () => { closeWin(); select('army', a.id); centerOn(...armyXY(a)); }, 'sm')); });
  b.append(at);
}
function winDip(b) {
  const n = me(), t = el('table', 't'), h = t.insertRow(); ['', 'Nação', 'Governo', 'Províncias', 'Exército', 'Relação', ''].forEach(x => h.append(el('th', '', x)));
  S.nations.filter(o => o.alive && o.id !== n.id && n.exP[o.capital]).sort((a, b) => provsOf(b.id).length - provsOf(a.id).length).forEach(o => {
    const r = t.insertRow(); r.insertCell().append(flagImgEl(o.flag)); r.insertCell().textContent = natName(o); r.insertCell().textContent = GOVS[o.gov].n;
    const p = r.insertCell(); p.className = 'n'; p.textContent = provsOf(o.id).length; const a = r.insertCell(); a.className = 'n'; a.textContent = fmtK(S.armies.filter(x => x.o === o.id).reduce((s, x) => s + regs(x), 0));
    const rel = r.insertCell(); rel.className = 'n'; const w = atWar(n.id, o.id); rel.textContent = w ? 'GUERRA' : n.truce[o.id] > S.t ? 'trégua' : Math.round(n.rel[o.id] || 0); if (w) rel.classList.add('bad');
    r.insertCell().append(btn('Ver', () => { closeWin(); select('nat', o.id); const c = WD.provs[o.capital]; centerOn(c.cx * K, c.cy * K); }, 'sm'));
  });
  b.append(t);
}
function winPeace(b) {
  const w = S.wars.find(x => x.id === UI.warg); if (!w) { b.append(el('p', 'dim', 'Essa guerra acabou.')); return; }
  const n = me(), e = nat(w.a === n.id ? w.d : w.a), sc = warScore(w) * (w.a === n.id ? 1 : -1), msg = el('div', 'msg');
  b.append(el('h3', '', 'Guerra contra ' + natName(e)), el('div', sc >= 0 ? 'good' : 'bad', 'Placar: ' + sc + ' · ' + Math.floor((S.t - w.start) / 360) + ' anos'), bar((sc + 100) / 200, sc >= 0 ? '#8fd17f' : '#e5636b'));
  const occ = occupiedBy(w, n.id), chosen = new Set();
  const list = el('div', 'card'); list.style.marginTop = '10px'; list.append(el('h4', '', 'Províncias ocupadas que você pode exigir'));
  const total = el('div', 'gold');
  const upd = () => { const c = Math.ceil(peaceCost(w, n.id, [...chosen]) + (mon.checked ? 12 : 0)); total.textContent = 'Custo: ' + c + ' de ' + sc; };
  occ.forEach(p => { const lb = el('label', 'brow'), cb = el('input'); cb.type = 'checkbox'; cb.onchange = () => { cb.checked ? chosen.add(p) : chosen.delete(p); upd(); }; lb.append(cb, el('span', 'nm', WD.provs[p].n + ' (' + popStr(S.pop[p]) + ')'), el('span', 'dim', Math.ceil(peaceCost(w, n.id, [p])) + '')); list.append(lb); });
  if (!occ.length) list.append(el('p', 'dim', 'Nenhuma.'));
  const ml = el('label', 'brow'), mon = el('input'); mon.type = 'checkbox'; mon.onchange = upd; ml.append(mon, el('span', 'nm', 'Reparações em ouro (💰' + money(Math.min(e.money, Math.abs(e.income) * 12 + 100)) + ')'), el('span', 'dim', '12'));
  list.append(ml, total); b.append(list); upd();
  const r = el('div', 'row'); r.style.marginTop = '10px';
  r.append(btn('🕊️ Propor', () => { const res = proposePeace(w, [...chosen], mon.checked ? Math.min(e.money, Math.abs(e.income) * 12 + 100) : 0); if (res) msg.textContent = res; else { closeWin(); say('Paz assinada.', 'good'); drawOutl(); drawTop(); } }, 'grn'));
  r.append(btn('Paz branca', () => { const res = proposePeace(w, [], 0); if (res) msg.textContent = res; else { closeWin(); say('Paz branca assinada.', 'good'); drawOutl(); drawTop(); } }));
  r.append(btn('Render-se', () => { modal(m => { m.append(el('h2', '', 'Render-se?'), el('p', '', natName(e) + ' fica com tudo o que ocupa.')); const row = el('div', 'row'); row.append(btn('Render-se', () => { makePeace(w, e.id, occupiedBy(w, e.id)); closeModal(); closeWin(); drawTop(); drawOutl(); }, 'red'), btn('Voltar', closeModal)); m.append(row); }); }, 'red'));
  b.append(r, msg);
}
function winLog(b) { S.log.slice(0, 120).forEach(l => b.append(el('div', 'brow', l.d + ' — ' + l.m))); }

/* editor de bandeira: partição, esmaltes, peça honrosa, móvel; aleatória infinita e SVG para baixar */
function winFlag(b) {
  const n = me(); if (!UI.fdraft) UI.fdraft = JSON.parse(JSON.stringify(n.flag)); const f = UI.fdraft;
  const wrap = el('div', 'fed'), prev = el('div', 'prev'); prev.innerHTML = flagSVG(f, 'ed'); wrap.append(prev);
  const ctl = el('div', 'fctl'), redraw = () => { prev.innerHTML = flagSVG(f, 'ed'); };
  const sel = (label, opts, val, on) => { const l = el('label', '', label), s = el('select'); Object.entries(opts).forEach(([k, v]) => s.append(new Option(v, k))); s.value = val; s.onchange = () => { on(s.value); drawWin(); }; l.append(s); return l; };
  const sw = (label, val, on) => { const l = el('label', '', label), d = el('div', 'sw'); T_IDS.forEach(t => { const x = el('button', val === t ? 'on' : ''); x.style.background = TINCT[t].c; x.title = TINCT[t].n; x.onclick = () => { on(t); drawWin(); }; d.append(x); }); l.append(d); return l; };
  ctl.append(sel('Partição', DIVS, f.d, v => { f.d = v; if (v === 'barry') f.k = f.k || 7; if (v === 'paly') f.k = f.k || 5; }));
  ctl.append(sw('Esmalte 1', f.t[0], t => f.t[0] = t), sw('Esmalte 2', f.t[1], t => f.t[1] = t), sw('Esmalte 3', f.t[2], t => f.t[2] = t));
  const o = f.o || { k: 'none', t: 'or' }; ctl.append(sel('Peça honrosa', ORDS, o.k, v => { f.o = v === 'none' ? null : Object.assign({}, o, { k: v }); })); if (f.o) ctl.append(sw('Esmalte da peça', f.o.t, t => f.o.t = t));
  const c = f.c || { k: 'none', t: 'argent', n: 1, at: 'center' }; ctl.append(sel('Móvel', CHARGES, c.k, v => { f.c = v === 'none' ? null : Object.assign({}, c, { k: v }); }));
  if (f.c) { ctl.append(sw('Esmalte do móvel', f.c.t, t => f.c.t = t), sel('Posição', CPOS, f.c.at, v => f.c.at = v), sel('Quantidade', { 1: '1', 2: '2', 3: '3' }, f.c.n || 1, v => f.c.n = +v)); }
  const r = el('div', 'row');
  r.append(btn('🎲 Aleatória', () => { UI.fdraft = flagRandom(Math.random); drawWin(); }), btn('✔ Aplicar', () => { n.flag = JSON.parse(JSON.stringify(f)); S.mapDirty = true; drawTop(); say('Nova bandeira hasteada.', 'good'); }, 'grn'), btn('⬇ Baixar SVG', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([flagSVG(f, 'dl')], { type: 'image/svg+xml' })); a.download = n.name.toLowerCase() + '.svg'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }), btn('Desfazer', () => { UI.fdraft = null; drawWin(); }));
  ctl.append(r); wrap.append(ctl); b.append(wrap);
}

/* ---------- modais ---------- */
function modal(fill) { const m = $('#modal-b'); m.innerHTML = ''; fill(m); $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }
function peaceOffer() {
  const o = S.offer; S.offer = null; const w = S.wars.find(x => x.id === o.w); if (!w) return;
  const n = me(), e = nat(w.a === n.id ? w.d : w.a); UI.speed = 0; drawTop();
  modal(m => {
    m.append(el('h2', '', 'Proposta de paz'), el('p', '', natName(e) + (o.winner == null ? ' propõe paz branca.' : ' exige ' + o.provs.length + ' província' + (o.provs.length === 1 ? '' : 's') + ':')));
    o.provs.forEach(p => m.append(el('div', 'dim', '· ' + WD.provs[p].n)));
    const r = el('div', 'row'); r.append(btn('Aceitar', () => { makePeace(w, o.winner, o.provs); closeModal(); drawTop(); drawOutl(); }, 'grn'), btn('Recusar', closeModal, 'red')); m.append(r);
  });
}
function endScreen() {
  UI.speed = 0; const ranking = S.nations.filter(n => n.alive).sort((a, b) => score(b) - score(a)).slice(0, 10);
  modal(m => {
    m.append(el('h2', '', S.over === 'dead' ? 'Sua nação caiu' : 'Fim da crônica'));
    ranking.forEach((n, i) => { const r = el('div', 'brow'); r.append(el('span', '', (i + 1) + '.'), flagImgEl(n.flag), el('span', 'nm' + (n.id === S.player ? ' gold' : ''), natName(n)), el('b', '', score(n))); m.append(r); });
    m.append(btn('Menu', () => { closeModal(); localStorage.removeItem('chronicle-save'); S = null; menu(); }));
  });
}
function drawFeed() { const f = $('#feed'); f.innerHTML = ''; const now = performance.now(); UI.feed = UI.feed.filter(x => now - x.t < 9000).slice(0, 6); UI.feed.forEach(x => f.append(el('div', x.k, x.m))); }

/* ---------- entrada no mapa ---------- */
const cv = $('#cv'); let drag = null;
cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx: R.cam.x, cy: R.cam.y, moved: false, btn: e.button }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { if (!drag || drag.btn !== 0) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; if (drag.moved) { R.cam.x = drag.cx - dx / R.cam.z; R.cam.y = drag.cy - dy / R.cam.z; clampCam(); } });
cv.addEventListener('pointerup', e => { const d = drag; drag = null; if (!d || d.moved || !S) return; if (e.button === 0) leftClick(e.clientX, e.clientY); else if (e.button === 2) rightClick(e.clientX, e.clientY); });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { e.preventDefault(); const [wx, wy] = toWorld(e.clientX, e.clientY); R.cam.z *= e.deltaY < 0 ? 1.15 : 1 / 1.15; clampCam(); R.cam.x = wx - e.clientX / R.cam.z; R.cam.y = wy - e.clientY / R.cam.z; clampCam(); }, { passive: false });
function leftClick(sx, sy) {
  const i = cellAt(sx, sy);
  if (UI.scr === 'setup') { if (i >= 0 && WD.prov[i] >= 0 && S.own[WD.prov[i]] >= 0) setupCard(S.own[WD.prov[i]]); return; }
  const u = unitAt(sx, sy); if (u) { u.a ? select('army', u.a.id) : select('fleet', u.f.id); return; }
  if (i < 0) { select(null); return; } const p = WD.prov[i];
  if (p >= 0) select('prov', p); else select(null);
}
function rightClick(sx, sy) {
  const i = cellAt(sx, sy); if (i < 0) return; const n = me(), P = WD.provs.length;
  if (R.selArmy && R.selArmy.o === n.id) {
    let to = WD.prov[i]; if (to < 0 && WD.sea[i] >= 0) to = P + WD.sea[i]; if (to < 0) return;
    if (!orderArmy(R.selArmy, to)) say('Sem caminho até lá' + (n.fx.sea && transport(n.id) < regs(R.selArmy) ? ' (faltam navios para o transporte)' : '') + '.', 'bad'); drawSide();
  } else if (R.selFleet && R.selFleet.o === n.id) {
    const z = WD.sea[i]; if (z < 0) return; R.selFleet.auto = false; if (!orderFleet(R.selFleet, z)) say('Sem rota até esse mar.', 'bad'); drawSide();
  }
}
addEventListener('keydown', e => {
  if (UI.scr !== 'game' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'Space') { e.preventDefault(); setSpeed(UI.speed ? 0 : UI.last); }
  else if (/^Digit[1-5]$/.test(e.code)) setSpeed(+e.code.slice(5));
  else if (e.code === 'Escape') { if (!$('#modal').hidden) closeModal(); else if (UI.win) closeWin(); else select(null); }
});

/* ---------- laço ---------- */
const busy = box => box.contains(document.activeElement) && /^(SELECT|INPUT)$/.test(document.activeElement.tagName);
let lastT = performance.now(), lastUi = 0, lastMonth = -1;
function loop(now) {
  const dt = Math.min(.25, (now - lastT) / 1000); lastT = now;
  if (S && UI.scr === 'game' && !S.over && UI.speed && $('#modal').hidden) {
    UI.acc += dt * SPEEDS[UI.speed]; let n = 0;
    while (UI.acc >= 1 && n < 30) { UI.acc -= 1; n++; advanceDay(); if (S.offer || S.over) break; if (S.t % 360 === 0) saveGame(); }
    if (UI.acc > 3) UI.acc = 0;
  }
  if (S && UI.scr === 'game') {
    if (S.news.length) { S.news.splice(0).forEach(x => UI.feed.unshift({ m: x.m, k: x.k, t: now })); drawFeed(); }
    if (S.offer) peaceOffer();
    if (S.over && $('#modal').hidden && !UI.ended) { UI.ended = true; endScreen(); }
    const month = Math.floor(S.t / 30);
    if (month !== lastMonth || now - lastUi > 1000) { lastMonth = month; lastUi = now; drawTop(); drawOutl(); if (!busy($('#side'))) drawSide(); if (UI.win && UI.win !== 'flag' && UI.win !== 'peace' && !busy($('#win'))) drawWin(); drawFeed(); }
  }
  if (S && (UI.scr === 'game' || UI.scr === 'setup')) { if (S.mapDirty && now - UI.lastMap > 300) { UI.lastMap = now; rebuildMap(); } drawFrame(); }
  requestAnimationFrame(loop);
}
initRender(cv); menu(); requestAnimationFrame(loop);

/* depuração: #dbg&seed=N&days=D&win=tech&mode=pol&z=2 abre direto numa partida (para testes e screenshots) */
(() => {
  const q = new URLSearchParams(location.hash.slice(1)); if (!q.has('dbg')) return;
  newGame(+q.get('seed') || 7); const main = S.nations.filter(n => n.kind === (q.get('kind') || 'main')).sort((a, b) => provsOf(b.id).length - provsOf(a.id).length)[0];
  S.player = main.id; for (let d = 0; d < (+q.get('days') || 0); d++) advanceDay();
  if (q.has('war')) {                                         // declara guerra a um vizinho e deixa correr
    const nb = new Set(); provsOf(main.id).forEach(p => WD.provs[p].adj.forEach(o => { if (S.own[o] >= 0 && S.own[o] !== main.id) nb.add(S.own[o]); }));
    const t = nat([...nb][0]); declareWar(main, t, null);
    S.armies.filter(a => a.o === main.id).forEach(a => orderArmy(a, provsOf(t.id).find(p => WD.provs[p].adj.some(o => S.own[o] === main.id))));
    for (let d = 0; d < +q.get('war'); d++) advanceDay();
  }
  startPlay(false); if (q.get('mode')) { R.mode = q.get('mode'); drawModes($('#modes')); }
  if (q.get('z')) { R.cam.z = +q.get('z'); centerOn(WD.provs[main.capital].cx * K, WD.provs[main.capital].cy * K); }
  if (q.get('win')) openWin(q.get('win'), q.get('win') === 'peace' && S.wars[0] ? warsOf(main.id)[0].id : undefined);
  if (q.get('prov')) select('prov', main.capital);
  if (q.get('setup')) { S.player = -1; show('setup'); R.view = -1; S.mapDirty = true; fitCam(); setupCard(main.id); drawModes($('#s-modes')); }
  rebuildMap(); drawFrame();
})();
