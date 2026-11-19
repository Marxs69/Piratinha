/* Grand Chronicle — interface: menu, escolha do mundo e da nação, barra do topo, painéis, janelas, descrições ao passar o mouse,
   minimapa, crônica, menu do botão direito (diplomacia) e o laço do tempo.
   Mapa: arrastar com o botão esquerdo seleciona tropas em área · botão direito move as tropas selecionadas (sem tropas: ações com o país)
   · arrastar com o botão direito/do meio ou WASD move a câmera · roda dá zoom. */
'use strict';

const $ = s => document.querySelector(s);
const SPEEDS = [0, 2, 6, 15, 40, 120];                       // dias por segundo
const UI = { scr: 'menu', speed: 0, last: 1, win: null, side: null, lastMap: 0, acc: 0, keys: new Set(), chron: false, seenLog: 0 };

/* ---------- utilidades de DOM ---------- */
function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
const tip = (e, t) => { if (t) e.dataset.tip = t; return e; };
function btn(txt, fn, cls = '', dis = '', tt = '') { const b = el('button', 'btn ' + cls, txt); b.onclick = e => { e.stopPropagation(); fn(e); }; if (dis) { b.disabled = true; tip(b, (tt ? tt + '\n' : '') + '⛔ ' + dis); } else tip(b, tt); return b; }
function flagEl(f, cls) { const d = el('div', cls); d.innerHTML = flagSVG(f, Math.random().toString(36).slice(2, 7)); return d; }
const kv = pairs => { const d = el('div', 'kv'); pairs.forEach(([a, b, t]) => { d.append(tip(el('span', '', a), t)); const v = el('span'); if (b instanceof Node) v.append(b); else v.textContent = b; tip(v, t); d.append(v); }); return d; };
const sec = (title, ...kids) => { const s = el('div', 'sec'); if (title) s.append(el('h3', '', title)); kids.forEach(k => k && s.append(k)); return s; };
const money = v => (v < 0 ? '−' : '') + (Math.abs(v) >= 1e6 ? (Math.abs(v) / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e4 ? Math.round(Math.abs(v) / 1e3) + 'k' : Math.round(Math.abs(v)));
const popStr = k => k >= 1000 ? (k / 1000).toFixed(k >= 1e4 ? 0 : 1) + ' mi' : Math.round(k) + ' mil';
const pct = v => Math.round(v * 100) + '%';
const sgn = v => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v * 100)) + '%';
const me = () => nat(S.player);
function bar(v, col) { const b = el('div', 'pbar'), i = el('i'); i.style.width = clamp(v, 0, 1) * 100 + '%'; if (col) i.style.background = col; b.append(i); return b; }
let hintT = 0; function say(m, k = 'info') { const h = $('#hint'); h.textContent = m; h.className = k; h.hidden = false; clearTimeout(hintT); hintT = setTimeout(() => h.hidden = true, 3500); }

/* ---------- textos das descrições ---------- */
const modLines = m => Object.entries(m).filter(([k, v]) => v && MODS[k]).map(([k, v]) => MODS[k] + ' ' + sgn(v));
function modChips(m) { const d = el('div', 'chips'); for (const k in m) { if (!m[k] || !MODS[k]) continue; d.append(el('span', 'chip ' + (m[k] > 0 ? 'p' : 'n'), MODS[k] + ' ' + sgn(m[k]))); } if (m.coupX != null) d.append(el('span', 'chip ' + (m.coupX < 1 ? 'p' : 'n'), 'Golpes ×' + m.coupX)); else if (m.coup) d.append(el('span', 'chip ' + (m.coup < 0 ? 'p' : 'n'), 'Risco de golpe ' + sgn(Math.max(-.9, m.coup)))); return d; }
const traitTip = t => { const d = TRAITS[t]; return d.n + '\n' + (modLines(d.m).join('\n') || 'Sem efeito direto') + (d.m.coup ? '\nRisco de golpe ' + sgn(d.m.coup) : '') + (d.ai ? '\nNa IA: ' + d.ai : ''); };
const SUCC = { hered: 'Herança: o filho mais velho assume. Sem herdeiros: crise de sucessão ou união pessoal com um parceiro de casamento.', elect: 'Os nobres elegem um novo governante quando o atual morre.', term: 'Eleições a cada {} anos.', party: 'O partido escolhe o sucessor.', junta: 'Os generais escolhem o sucessor; golpes são frequentes.', council: 'Um conselho escolhe o líder a cada {} anos.', theo: 'O clero escolhe um ancião.', ai: 'Uma inteligência governa para sempre: ninguém morre nem dá golpe.' };
const govTip = g => { const d = GOVS[g]; return d.n + ' · ' + d.cat + '\nTítulo: ' + d.t + '\n' + SUCC[d.succ].replace('{}', d.term) + '\n' + modLines(d.m).join('\n') + '\nRisco de golpe ×' + d.coup + (d.minProv ? '\nExige ' + d.minProv + ' províncias' : ''); };
function bTip(b) {
  const d = BUILDINGS[b], o = [d.e + ' ' + d.n];
  if (d.in) o.push('Consome: ' + Object.entries(d.in).map(([g, q]) => q + ' ' + GOODS[g].n).join(', '));
  if (d.out) o.push('Produz: ' + Object.entries(d.out).map(([g, q]) => q + ' ' + GOODS[g].n).join(', '));
  if (d.fx) Object.entries(d.fx).forEach(([k, v]) => o.push({ tax: 'Impostos do país +' + v * 100 / 4 + '%', fort: 'Fortificação +' + v, port: 'Porto: frotas e comércio', trade: 'Comércio +' + v * 100 + '%', research: 'Pesquisa +' + v + '/mês', stab: 'Estabilidade +' + v * 2, prod: 'Produção do estado +' + v * 100 + '%', speed: 'Tropas mais rápidas no estado' }[k] || k));
  o.push(d.w + ' mil trabalhadores por nível · ' + bMonths(b) + ' meses de obra');
  if (d.req) o.push('Exige: ' + ({ arable: 'terra cultivável', coast: 'litoral', forest: 'floresta', rocky: 'colinas ou montanhas', warm: 'clima quente' }[d.req] || 'recurso ' + (GOODS[d.req.slice(4)] || {}).n));
  return o.join('\n');
}
function fxLines(fx) {
  const o = []; if (!fx) return o;
  if (fx.b) o.push('Prédios: ' + fx.b.map(x => BUILDINGS[x].n).join(', ')); if (fx.g) o.push('Governos: ' + fx.g.map(x => GOVS[x].n).join(', ')); if (fx.i) o.push('Ideologias: ' + fx.i.map(x => IDEOS[x].n).join(', '));
  if (fx.m) o.push(...modLines(fx.m)); if (fx.u) o.push('Unidades: ' + Object.entries(fx.u).map(([k, v]) => ({ inf: 'infantaria', cav: 'cavalaria', art: 'artilharia', siege: 'cerco' }[k]) + ' +' + Math.round(v * 100) + '%').join(', '));
  if (fx.bo) o.push(...Object.entries(fx.bo).map(([k, v]) => BUILDINGS[k].n + ' ' + sgn(v)));
  if (fx.sea) o.push(fx.sea === 1 ? 'Navegação costeira' : 'Navegação oceânica'); if (fx.col) o.push('Colonização +' + fx.col + ' colono'); if (fx.fort) o.push('Fortificações +' + fx.fort); if (fx.slots) o.push('Canteiros de obra +' + fx.slots); if (fx.ship) o.push('Navios +' + Math.round(fx.ship * 100) + '%');
  return o;
}
function techTip(n, t, st) {
  const o = [t.n + ' · ' + t.y + ' · ' + (CATS[t.c] || '')];
  if (t.entry) { const v = VERT[t.v]; o.push('Entrada da vertente ' + v.e + ' ' + v.n + '.', 'Escolhê-la troca as tecnologias militares, navais e econômicas posteriores a ' + v.entry.y + ' pela árvore ' + v.n + ' (até 2200).', 'Bônus da árvore completa: ' + modLines(v.m).join(', ')); }
  o.push(...fxLines(t.fx));
  if (t.vt) { const v = VERT[t.v]; if (t.src.length) o.push('Traz o equivalente a: ' + t.src.map(x => TECH[x].n).join(', ')); o.push('Parte da árvore ' + v.n + ': ' + modLines(Object.fromEntries(Object.entries(v.m).map(([k, x]) => [k, x / v.len]))).join(', ')); }
  if (t.req.length) o.push('Exige: ' + t.req.map(q => TECH[q].n).join(', '));
  if (st && st !== 'done') o.push('⛔ ' + st);
  return o.join('\n');
}

/* tooltip que segue o mouse */
const TIP = $('#tip');
document.addEventListener('mouseover', e => { const t = e.target.closest('[data-tip]'); if (!t || !t.dataset.tip) { TIP.hidden = true; return; } TIP.textContent = t.dataset.tip; TIP.hidden = false; });
document.addEventListener('mousemove', e => { if (TIP.hidden) return; const w = TIP.offsetWidth, h = TIP.offsetHeight; TIP.style.left = Math.min(innerWidth - w - 8, e.clientX + 14) + 'px'; TIP.style.top = (e.clientY + 18 + h > innerHeight ? e.clientY - h - 10 : e.clientY + 18) + 'px'; });

/* ---------- telas ---------- */
function show(scr) { ['menu', 'setup', 'game'].forEach(s => $('#' + s).classList.toggle('on', s === scr)); UI.scr = scr; TIP.hidden = true; }
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
    const seed = parseInt($('#s-seed').value, 10) || 1; newGame(seed); terrRGB = null; R.view = -1; R.mode = 'pol'; R.sel = null; R.selArmies = []; R.selFleet = null;
    rebuildMap(); fitCam(); $('#s-load').hidden = true; setupCard(null); drawModes($('#s-modes'));
  }, 30);
}
function setupCard(id) {
  const c = $('#s-card'); c.innerHTML = '';
  if (id == null) { c.append(el('h3', 'gold', 'Escolha uma nação no mapa')); return; }
  const n = nat(id); UI.pick = id;
  c.append(flagEl(n.flag, 'big-flag'), el('h2', '', natName(n)));
  const cont = WD.conts[n.home];
  c.append(kv([['Governo', GOVS[n.gov].n, govTip(n.gov)], ['Ideologia', IDEOS[n.ideo].n, modLines(IDEOS[n.ideo].m).join('\n')], ['Governante', titleOf(n) + ' ' + charName(n.ruler)], ['Continente', cont.n + (cont.main ? ' (principal)' : '')], ['Províncias', provsOf(id).length], ['População', popStr(n.popT || 0)], ['Tecnologias', techCount(n)]]));
  c.append(btn('Jogar com esta nação ▶', () => { S.player = id; startPlay(true); }, 'grn'));
}
function startPlay(fresh) {
  show('game'); terrRGB = null; R.view = S.player; R.mode = 'pol'; S.mapDirty = true; rebuildMap();
  const cap = WD.provs[me().capital]; R.cam.z = 3; R.cam.x = cap.cx * K - innerWidth / 2 / R.cam.z; R.cam.y = cap.cy * K - innerHeight / 2 / R.cam.z; clampCam();
  UI.speed = 0; UI.side = null; UI.ended = false; UI.seenLog = S.log.length; closeWin(); drawModes($('#modes')); drawTop(); drawOutl(); drawSide(); drawChron();
  if (fresh) { log('Você governa ' + natName(me()) + '. Escolha uma pesquisa e aperte ▶.', 'good', [S.player]); saveGame(); }
}

/* ---------- modos de mapa ---------- */
const MODEBTN = [['pol', '🗺️', 'Político'], ['ter', '⛰️', 'Terreno'], ['dip', '🤝', 'Diplomático: verde é você, azul aliados, vermelho inimigos, laranja trégua'], ['pop', '👥', 'População'], ['reg', '🧩', 'Regiões e estados'], ['cont', '🌍', 'Continentes'], ['res', '⛏️', 'Recursos: cinza ferro, preto carvão, amarelo ouro, roxo petróleo']];
function drawModes(box) { box.innerHTML = ''; MODEBTN.forEach(([m, e, t]) => box.append(btn(e, () => { R.mode = m; S.mapDirty = true; drawModes(box); }, R.mode === m ? 'on' : '', '', t))); }

/* ---------- barra do topo ---------- */
function drawTop() {
  const t = $('#top'), n = me(); t.innerHTML = '';
  const f = flagEl(n.flag, 'flag'); tip(f, 'Bandeira: clique para editar (💰' + flagCost() + ')'); f.onclick = () => openWin('flag'); t.append(f);
  const nm = el('div', 'nname'); nm.append(el('b', '', natName(n)), el('small', '', titleOf(n) + ' ' + charName(n.ruler))); tip(nm, GOVS[n.gov].n + ' · ' + IDEOS[n.ideo].n + (n.senior != null ? '\nParceiro júnior de ' + natName(nat(n.senior)) : '')); t.append(nm);
  const res = (v, s, tt, cls = '') => { const d = el('div', 'res'); tip(d, tt); d.append(el('b', cls, v), el('small', '', s)); t.append(d); };
  const lab = { tax: 'Impostos', trade: 'Exportações', imports: 'Importações', army: 'Exército', navy: 'Marinha', admin: 'Administração', interest: 'Juros', corrupt: 'Corrupção' };
  res('💰 ' + money(n.money), (n.income >= 0 ? '+' : '−') + money(Math.abs(n.income)) + '/mês', 'Tesouro\n' + Object.entries(n.inc).filter(([, v]) => Math.abs(v) >= .5).map(([k, v]) => lab[k] + ': ' + money(v)).join('\n') + (n.money > 2000 ? '\nAcima de 2.000, 1% ao mês se perde em corrupção' : ''), n.money < 0 ? 'bad' : '');
  res('👥 ' + Math.floor(n.manpower) + 'k', 'de ' + Math.floor(n.mpMax || 0) + 'k', 'Contingente: homens disponíveis para recrutar (1k por regimento).\nCresce com a população; teto de 3% dela.');
  res('⚖️ ' + Math.round(n.stab), 'estabilidade', 'Estabilidade (0–100)\nMais alta: mais impostos, pesquisa e menos golpes.\nSobe com governo, ideologia, comida e bens; cai com guerra, dívida e território grande.', n.stab < 30 ? 'bad' : n.stab > 70 ? 'good' : '');
  const tr = n.res ? TECH[n.res] : null; res('🔬 ' + (tr ? Math.floor(n.rp / techCost(n, tr) * 100) + '%' : '—'), tr ? tr.n : 'sem pesquisa', tr ? techTip(n, tr) + '\n+' + researchRate(n).toFixed(1) + ' por mês' : 'Escolha uma pesquisa na Tecnologia', tr ? '' : 'bad');
  const w = warsOf(n.id); res('⚔️ ' + w.length, w.length ? 'em guerra' : 'em paz', w.length ? 'Contra ' + enemiesOf(n.id).map(e => nat(e).name).join(', ') : 'Nenhuma guerra', w.length ? 'bad' : '');
  [['🏛️', 'gov', 'Governo'], ['💰', 'eco', 'Economia'], ['🔬', 'tech', 'Tecnologia'], ['⚔️', 'mil', 'Militar'], ['🤝', 'dip', 'Diplomacia']].forEach(([e, id, tt]) => t.append(btn(e + ' ' + tt, () => UI.win === id ? closeWin() : openWin(id), UI.win === id ? 'on' : '')));
  const unread = S.log.length - UI.seenLog; t.append(btn('📜 Crônica' + (unread > 0 && !UI.chron ? ' (' + Math.min(99, unread) + ')' : ''), () => { UI.chron = !UI.chron; drawChron(); drawTop(); }, UI.chron ? 'on' : unread > 0 ? 'new' : ''));
  t.append(el('span', 'grow'));
  const sp = el('div', 'speed'); [0, 1, 2, 3, 4, 5].forEach(k => sp.append(btn(k ? '▶'.repeat(Math.min(k, 3)) + (k > 3 ? k : '') : '⏸', () => setSpeed(k), UI.speed === k ? 'on' : '', '', k ? 'Velocidade ' + k + ' (tecla ' + k + ')' : 'Pausar (espaço)'))); t.append(sp);
  t.append(el('div', 'date', dateStr()));
  t.append(btn('☰', () => gameMenu()));
}
function setSpeed(k) { UI.speed = k; if (k) UI.last = k; drawTop(); }
function gameMenu() {
  modal(m => {
    m.append(el('h2', '', 'Grand Chronicle'));
    m.append(btn('💾 Salvar', () => { say(saveGame() ? 'Jogo salvo.' : 'Não foi possível salvar.', 'good'); closeModal(); }));
    m.append(btn('🚪 Salvar e sair para o menu', () => { saveGame(); closeModal(); S = null; menu(); }));
    m.append(el('p', 'dim', 'Mapa: arraste com o botão esquerdo para selecionar tropas · botão direito move as tropas ou abre ações com o país · WASD ou arrastar com o botão direito move a câmera · roda dá zoom · espaço pausa.'));
    m.append(btn('Voltar', closeModal));
  });
}

/* ---------- crônica (pop-up no canto inferior direito) ---------- */
function drawChron() {
  const c = $('#chron'); c.hidden = !UI.chron || UI.scr !== 'game'; if (c.hidden) return;
  UI.seenLog = S.log.length; c.innerHTML = '';
  const h = el('header'); h.append(el('b', '', '📜 Crônica'), btn(UI.chronAll ? 'Só importantes' : 'Mostrar tudo', () => { UI.chronAll = !UI.chronAll; drawChron(); }, 'sm', '', 'Inclui sucessões e acordos entre outros países'), btn('✕', () => { UI.chron = false; drawChron(); drawTop(); }, 'x sm')); c.append(h);
  const list = el('div', 'clist'); S.log.filter(l => UI.chronAll || l.k !== 'none').slice(0, 60).forEach(l => { const r = el('div', 'cl ' + l.k); r.append(el('small', '', l.d), el('span', '', l.m)); list.append(r); }); c.append(list);
}

/* ---------- painel lateral ---------- */
function select(kind, id) { UI.side = kind ? { kind, id } : null; R.sel = kind === 'prov' ? id : null; R.selArmies = kind === 'army' ? S.armies.filter(a => a.id === id) : kind === 'armies' ? S.armies.filter(a => id.includes(a.id)) : []; R.selFleet = kind === 'fleet' ? S.fleets.find(f => f.id === id) : null; drawSide(); }
function drawSide() {
  const sd = $('#side'), keep = sd.scrollTop; sd.innerHTML = ''; const s = UI.side;
  if (!s) { sd.hidden = true; return; } sd.hidden = false;
  const close = btn('✕', () => select(null), 'x sm'); close.style.float = 'right'; sd.append(close);
  if (s.kind === 'prov') sideProv(sd, s.id); else if (s.kind === 'nat') sideNat(sd, s.id); else if (s.kind === 'army') sideArmy(sd, s.id); else if (s.kind === 'armies') sideArmies(sd, s.id); else if (s.kind === 'fleet') sideFleet(sd, s.id);
  sd.scrollTop = keep;
}
const refresh = () => { drawSide(); drawTop(); drawOutl(); if (UI.win && !busy($('#win'))) drawWin(); };
function sideProv(sd, p) {
  const pr = WD.provs[p], st = WD.states[pr.state], rg = WD.regions[pr.region], ct = WD.conts[pr.cont], n = me(), o = S.own[p], c = S.ctrl[p];
  const h = el('div', 'side-h'); if (o >= 0) { const f = flagEl(nat(o).flag, 'fl'); tip(f, 'Ver ' + natName(nat(o))); f.onclick = () => select('nat', o); h.append(f); }
  const tt = el('div'); tt.append(el('h2', '', pr.n), el('small', 'dim', st.n + ' · ' + rg.n + ' · ' + ct.n)); h.append(tt); sd.append(h);
  if (!n.exP[p]) { sd.append(el('p', 'dim', 'Terra inexplorada.')); return; }
  const T = TERRAIN[pr.terr];
  sd.append(kv([['Dono', o >= 0 ? natName(nat(o)) : 'Nativos'], ...(c !== o && c >= 0 ? [['Ocupada por', natName(nat(c))]] : []), ['Terreno', T.n + (pr.coast ? ' · litoral' : ''), T.n + '\nMovimento ×' + T.move + '\nDefesa +' + Math.round(T.def * 100) + '%\nComida ×' + T.food], ['Recurso', pr.res ? GOODS[pr.res].e + ' ' + GOODS[pr.res].n : '—', 'Permite minas ou poços desse recurso no estado'], ['População', popStr(S.pop[p])], ['Fortificação', fortOf(p) || '—', 'Cada nível deixa o cerco bem mais lento.\nVem do castelo na capital do estado e da capital do país.']]));
  const msg = el('div', 'msg'), act = fn => () => { const e = fn(); msg.textContent = e || ''; if (!e) refresh(); };
  if (o === -1) {
    const col = S.cols.find(x => x.p === p);
    if (col) sd.append(sec('Colonização', el('div', '', natName(nat(col.o)) + ' · faltam ' + col.m + ' meses'), bar(1 - col.m / col.tot)));
    else sd.append(sec('Colonização', btn('Colonizar (💰' + colCost(n, p) + ')', act(() => colonize(n, p)), 'grn', canColonize(n, p), 'Envia colonos; vira sua província em alguns meses.'), msg));
    return;
  }
  if (o === n.id && c === n.id) {
    const r = el('div', 'row'); ['inf', 'cav', 'art', 'vrt'].filter(t => t !== 'vrt' || n.vert).forEach(t => r.append(btn(unitName(n, t) + ' (💰' + recCost(n, t) + ')', act(() => recruit(n, t, 1, p)), 'sm', canRecruit(n, t, 1), unitTip(n, t))));
    const r5 = el('div', 'row'); r5.append(btn('5× ' + unitName(n, 'inf'), act(() => recruit(n, 'inf', 5, p)), 'sm', canRecruit(n, 'inf', 5)));
    if (pr.coast) r5.append(btn('⛵ ' + shipName(n) + ' ×2 (💰' + shipCost(n) * 2 + ')', act(() => buildShips(n, 2, p)), 'sm', !n.fx.sea ? 'Exige Barcos longos' : n.money < shipCost(n) * 2 ? 'Sem dinheiro' : '', 'Navios ficam prontos em 4 meses no mar ao lado.'));
    sd.append(sec('Recrutar', r, r5, msg));
  } else if (o !== n.id) {
    const has0 = n.claims[st.id], fab = n.fab && n.fab.s === st.id;
    sd.append(sec('Reivindicação', has0 ? el('div', 'good', 'Você reivindica ' + st.n + '.') : fab ? el('div', 'dim', 'Fabricando… ' + n.fab.m + ' meses') : btn('Fabricar reivindicação em ' + st.n + ' (💰' + Math.round(40 * eraScale()) + ')', act(() => fabricate(n, st.id)), 'sm', n.fab ? 'Já fabricando' : '', 'Com reivindicação, declarar guerra custa só 3 de estabilidade (sem: 15).'), msg));
  }
  sideState(sd, st);
}
function unitTip(n, t) { const b = UNIT_BASE[t]; return unitName(n, t) + '\nAtaque ' + (b.a * n.up[t]).toFixed(2) + ' · defesa ' + (b.d * n.up[t]).toFixed(2) + '\nCusto 💰' + recCost(n, t) + ' · 1k de contingente\nManutenção sobe com a era' + (t === 'art' ? '\nAcelera cercos' : t === 'vrt' && n.vert ? '\nUnidade da vertente ' + VERT[n.vert].n + '; consome ' + GOODS[VERT[n.vert].good].n : ''); }
function sideState(sd, st) {
  const n = me(), so = stateOwnerOf(st.id), B = S.bld[st.id], box = sec('Estado: ' + st.n);
  let sp = 0; st.provs.forEach(p => { if (S.own[p] === so) sp += S.pop[p]; });
  box.append(kv([['Capital', WD.provs[st.cap].n], ['Infraestrutura', so >= 0 ? natName(nat(so)) : '—', 'Quem controla a capital do estado controla e constrói os prédios.'], ['População', popStr(sp)], ['Províncias', st.provs.length]]));
  const list = el('div');
  Object.keys(BUILDINGS).forEach(b => {
    const d = BUILDINGS[b], L = B[b] || 0, inCons = n.cons.filter(c => c.s === st.id && c.b === b);
    if (so !== n.id && !L) return;
    const avail = d.vert ? n.vert === d.vert : n.fx.b.has(b); if (!L && !avail) return;
    const err = so === n.id ? canBuild(n, st.id, b) : 'Não é seu';
    if (!L && !inCons.length && err && err !== 'Sem dinheiro' && err !== 'Sem canteiros livres') return;
    const r = el('div', 'brow'); tip(r, bTip(b)); r.append(el('span', 'e', d.e), el('span', 'nm', d.n + (inCons.length ? ' (+' + inCons.length + ' em obra)' : '')), el('span', 'lv', L || '—'));
    if (so === n.id) r.append(btn('+ 💰' + bCost(n, b), () => { const e = build(n, st.id, b); if (e) say(e, 'bad'); refresh(); }, 'sm', err, bTip(b)));
    list.append(r);
  });
  box.append(list);
  if (so === n.id) n.cons.filter(c => c.s === st.id).forEach(c => { box.append(el('div', 'dim', BUILDINGS[c.b].n + ' · ' + c.m + ' meses')); box.append(bar(1 - c.m / c.tot)); });
  sd.append(box);
}
function dipStatus(n, o) {
  const s = []; if (has(n, 'allies', o.id)) s.push('🤝 Aliado'); if (has(n, 'marr', o.id)) s.push('💍 Casamento real'); if (has(n, 'trade', o.id)) s.push('⚖️ Acordo comercial');
  if (has(n, 'emb', o.id)) s.push('🚫 Você embarga'); if (has(o, 'emb', n.id)) s.push('🚫 Embarga você'); if (o.senior === n.id) s.push('👑 Seu parceiro júnior'); if (n.senior === o.id) s.push('👑 Seu sênior');
  if (atWar(n.id, o.id)) s.push('⚔️ Em guerra'); else if (n.truce[o.id] > S.t) s.push('🕊️ Trégua até ' + yearOf(n.truce[o.id]));
  return s;
}
function sideNat(sd, id) {
  const n = nat(id), mine = me(), h = el('div', 'side-h');
  h.append(flagEl(n.flag, 'fl')); const tt = el('div'); tt.append(el('h2', '', natName(n)), tip(el('small', 'dim', GOVS[n.gov].n + ' · ' + IDEOS[n.ideo].n), govTip(n.gov))); h.append(tt); sd.append(h);
  const ruler = el('span', '', titleOf(n) + ' ' + charName(n.ruler) + ' (' + ageOf(n.ruler) + ')'); tip(ruler, n.ruler.tr.map(t => TRAITS[t].n + (TRAITS[t].ai ? ': ' + TRAITS[t].ai : '')).join('\n'));
  sd.append(kv([['Governante', ruler], ['Províncias', provsOf(id).length], ['População', popStr(n.popT || 0)], ['PIB', money(n.gdp || 0) + '/mês'], ['Exército', fmtK(S.armies.filter(a => a.o === id).reduce((s, a) => s + regs(a), 0))], ['Tecnologias', techCount(n)], ['Vertente', n.vert ? VERT[n.vert].n : '—'], ['Relação', id === mine.id ? '—' : Math.round(n.rel[mine.id] || 0) + '', 'Como eles veem você (−100 a 100). Muda com acordos, ideologia, fronteiras e guerras.']]));
  if (id === mine.id) { sd.append(sec('', btn('🏛️ Governo', () => openWin('gov')))); return; }
  const st = dipStatus(mine, n); if (st.length) sd.append(sec('Relações', ...st.map(x => el('div', '', x))));
  sd.append(sec('Ações', dipButtons(n)));
}
function dipButtons(t) {
  const n = me(), box = el('div', 'row'), msg = el('div', 'msg'), out = el('div');
  const go = kind => () => { const e = dipAct(n, t, kind); msg.textContent = e; if (!e) { say('Feito.', 'good'); refresh(); } };
  const accTip = kind => { const [v, why] = accept(t, n, kind); return (v >= 0 ? '✅ Aceitariam' : '❌ Recusariam') + ' (' + v + ')\n' + why.join('\n'); };
  box.append(btn('🤝 Melhorar relações (💰' + dipCost('improve') + ')', go('improve'), 'sm', (n.cd || {})[t.id] > S.t ? 'Já tentado este ano' : '', '+15 de relação com eles, uma vez por ano'));
  box.append(btn('🎁 Presente (💰' + dipCost('gift') + ')', go('gift'), 'sm', '', '+20 de relação; o ouro vai para eles'));
  box.append(has(n, 'allies', t.id) ? btn('Romper aliança', go('unally'), 'sm red', '', '−40 de relação e −5 de estabilidade') : btn('🛡️ Propor aliança', go('ally'), 'sm', '', 'Aliados são chamados para as guerras um do outro.\n' + accTip('ally')));
  if (GOVS[n.gov].succ === 'hered' && GOVS[t.gov].succ === 'hered' && !has(n, 'marr', t.id)) box.append(btn('💍 Casamento real (💰' + dipCost('marr') + ')', go('marr'), 'sm', '', '+25 de relação. Se uma das casas ficar sem herdeiro, a outra pode herdar a coroa (união pessoal).\n' + accTip('marr')));
  box.append(has(n, 'trade', t.id) ? btn('Cancelar acordo comercial', go('untrade'), 'sm') : btn('⚖️ Acordo comercial (💰' + dipCost('trade') + ')', go('trade'), 'sm', has(n, 'emb', t.id) ? 'Há embargo' : '', 'Eficiência de comércio +7% para os dois.\n' + accTip('trade')));
  box.append(btn(has(n, 'emb', t.id) ? 'Suspender embargo' : '🚫 Embargo', go('embargo'), 'sm', '', 'Embargos cortam 8% da eficiência de comércio deles e −25 de relação'));
  box.append(btn('😠 Insultar', go('insult'), 'sm', '', '−40 de relação'));
  if (t.senior === n.id) box.append(btn('👑 Integrar (💰' + dipCost('integrate') + ')', go('integrate'), 'sm grn', '', 'Anexa o parceiro júnior: exige 50 anos de união e relação 50+'));
  out.append(box);
  const w = S.wars.find(w => sideOf(w, t.id) && sideOf(w, n.id) && sideOf(w, t.id) !== sideOf(w, n.id));
  if (w) out.append(btn('🕊️ Negociar paz', () => openWin('peace', w.id), 'sm grn'));
  else {
    const claims = WD.states.filter(s => n.claims[s.id] && s.provs.some(p => S.own[p] === t.id));
    const sel = el('select'); sel.append(new Option('Sem reivindicação (−15 estabilidade)', '')); claims.forEach(s => sel.append(new Option('Reivindicação: ' + s.n, s.id)));
    const allies = (t.allies || []).map(nat).filter(x => x.alive).map(x => x.name);
    out.append(sel, btn('⚔️ Declarar guerra', () => { const e = declareWar(n, t, sel.value === '' ? null : +sel.value); msg.textContent = e; if (!e) { S.mapDirty = true; refresh(); } }, 'red', n.truce[t.id] > S.t ? 'Trégua até ' + yearOf(n.truce[t.id]) : has(n, 'allies', t.id) ? 'São aliados' : '', allies.length ? 'Aliados deles podem entrar: ' + allies.join(', ') : 'Eles não têm aliados'));
  }
  out.append(msg); return out;
}
function sideArmy(sd, id) {
  const a = S.armies.find(a => a.id === id); if (!a) { select(null); return; } const n = nat(a.o), P = WD.provs.length;
  const h = el('div', 'side-h'); h.append(flagEl(n.flag, 'fl')); const tt = el('div'); tt.append(el('h2', '', 'Exército · ' + fmtK(regs(a))), el('small', 'dim', a.p < P ? WD.provs[a.p].n : WD.seas[a.p - P].n)); h.append(tt); sd.append(h);
  ['inf', 'cav', 'art', 'vrt'].forEach(t => { if (a[t] > .05) sd.append(tip(el('div', 'brow', fmtK(a[t]) + ' · ' + unitName(n, t)), unitTip(n, t))); });
  sd.append(tip(el('div', 'dim', 'Moral'), 'Cai em batalha; quem chega a zero recua.\nRecupera fora de combate, mais rápido em casa.'), bar(a.mor, '#7fe08a'));
  if (a.o !== S.player) return;
  sd.append(el('p', 'dim', a.path.length ? 'Marchando: ' + a.path.length + ' passos' : 'Botão direito no mapa para mover.'));
  const r = el('div', 'row');
  r.append(btn('Parar', () => { a.path = []; drawSide(); }, 'sm'));
  r.append(btn('Dividir', () => { const b = addArmy(a.o, a.p, { inf: a.inf / 2, cav: a.cav / 2, art: a.art / 2, vrt: a.vrt / 2 }); ['inf', 'cav', 'art', 'vrt'].forEach(t => a[t] /= 2); select('armies', [a.id, b.id]); }, 'sm', regs(a) < 1 ? 'Pequeno demais' : ''));
  const here = S.armies.filter(b => b !== a && b.o === a.o && b.p === a.p);
  r.append(btn('Mesclar', () => merge([a, ...here]), 'sm', here.length ? '' : 'Nenhum outro exército aqui'));
  r.append(btn('Desmobilizar', () => { n.manpower += regs(a) * .5; a.inf = a.cav = a.art = a.vrt = 0; S.armies = S.armies.filter(b => regs(b) > .08); select(null); drawOutl(); }, 'sm red', '', 'Devolve metade dos homens ao contingente'));
  sd.append(r);
}
function merge(list) { const a = list[0]; list.slice(1).forEach(b => { if (b.p !== a.p) return; ['inf', 'cav', 'art', 'vrt'].forEach(t => { a[t] += b[t]; b[t] = 0; }); a.mor = Math.min(a.mor, b.mor || 1); }); S.armies = S.armies.filter(b => regs(b) > .08); select('army', a.id); }
function sideArmies(sd, ids) {
  const list = S.armies.filter(a => ids.includes(a.id)), P = WD.provs.length; if (!list.length) { select(null); return; }
  sd.append(el('h2', '', list.length + (list.length === 1 ? ' exército · ' : ' exércitos · ') + fmtK(list.reduce((s, a) => s + regs(a), 0))));
  list.forEach(a => { const r = el('div', 'orow'); r.append(el('span', '', '⚔️'), el('span', 'grow', a.p < P ? WD.provs[a.p].n : WD.seas[a.p - P].n), el('b', '', fmtK(regs(a)))); r.onclick = () => select('army', a.id); sd.append(r); });
  const r = el('div', 'row'); r.append(btn('Parar todos', () => { list.forEach(a => a.path = []); drawSide(); }, 'sm'), btn('Mesclar os que estão juntos', () => { const by = new Map(); list.forEach(a => { if (!by.has(a.p)) by.set(a.p, []); by.get(a.p).push(a); }); by.forEach(l => merge(l)); const left = S.armies.filter(a => ids.includes(a.id)).map(a => a.id); select(left.length > 1 ? 'armies' : 'army', left.length > 1 ? left : left[0]); }, 'sm'));
  sd.append(el('p', 'dim', 'Botão direito no mapa move todos.'), r);
}
function sideFleet(sd, id) {
  const f = S.fleets.find(f => f.id === id); if (!f) { select(null); return; } const n = nat(f.o);
  const h = el('div', 'side-h'); h.append(flagEl(n.flag, 'fl')); const tt = el('div'); tt.append(el('h2', '', 'Frota · ⛵' + Math.ceil(f.ships)), el('small', 'dim', WD.seas[f.z].n + (WD.seas[f.z].deep ? ' · oceano' : ''))); h.append(tt); sd.append(h);
  sd.append(el('div', '', Math.ceil(f.ships) + ' ' + shipName(n)));
  if (f.o !== S.player) return;
  sd.append(el('p', 'dim', f.auto ? 'Explorando sozinha.' : f.path.length ? 'Navegando.' : 'Botão direito num mar para navegar.'));
  const r = el('div', 'row'); r.append(btn(f.auto ? 'Parar exploração' : '🧭 Explorar', () => { f.auto = !f.auto; if (!f.auto) f.path = []; drawSide(); }, 'sm', '', 'Vai sozinha para os mares desconhecidos mais próximos'), btn('Parar', () => { f.path = []; f.auto = false; drawSide(); }, 'sm'));
  sd.append(r, tip(el('p', 'dim', 'Transporte: ' + transport(f.o) + ' regimentos'), 'Cada navio leva 3 regimentos pelo mar. Exércitos só cruzam o mar se a soma das frotas der conta.'));
}

/* ---------- painel da direita ---------- */
function drawOutl() {
  const o = $('#outl'), n = me(); o.innerHTML = ''; const P = WD.provs.length;
  const wars = warsOf(n.id); if (wars.length) { o.append(el('h4', '', 'GUERRAS')); wars.forEach(w => { const sd = sideOf(w, n.id), lead = w.a === n.id || w.d === n.id, e = nat(sd === 'A' ? w.d : w.a), sc = w.score * (sd === 'A' ? 1 : -1), r = el('div', 'orow'); r.append(flagImgEl(e.flag), el('span', 'grow', e.name + (lead ? '' : ' (aliado)')), el('b', sc >= 0 ? 'good' : 'bad', sc + '')); tip(r, 'Placar: ' + sc + '\nLado deles: ' + (sd === 'A' ? w.D : w.A).map(x => nat(x).name).join(', ')); r.onclick = () => openWin('peace', w.id); o.append(r); }); }
  const ar = S.armies.filter(a => a.o === n.id); if (ar.length) { o.append(el('h4', '', 'EXÉRCITOS')); ar.forEach(a => { const r = el('div', 'orow' + (R.selArmies.includes(a) ? ' sel' : '')); r.append(el('span', '', '⚔️'), el('span', 'grow', a.p < P ? WD.provs[a.p].n : WD.seas[a.p - P].n), el('b', '', fmtK(regs(a)))); tip(r, 'Shift + clique soma à seleção'); r.onclick = e => { if (e.shiftKey && R.selArmies.length) { const ids = R.selArmies.map(x => x.id); if (!ids.includes(a.id)) ids.push(a.id); select('armies', ids); } else { select('army', a.id); centerOn(...armyXY(a)); } drawOutl(); }; o.append(r); }); }
  const fl = S.fleets.filter(f => f.o === n.id); if (fl.length) { o.append(el('h4', '', 'FROTAS')); fl.forEach(f => { const r = el('div', 'orow'); r.append(el('span', '', f.auto ? '🧭' : '⛵'), el('span', 'grow', WD.seas[f.z].n), el('b', '', Math.ceil(f.ships) + '')); r.onclick = () => { select('fleet', f.id); centerOn(...fleetXY(f)); }; o.append(r); }); }
  const work = n.cons.length + n.rec.length + S.cols.filter(c => c.o === n.id).length;
  if (work) { o.append(el('h4', '', 'EM ANDAMENTO')); n.cons.forEach(c => o.append(el('div', 'orow', BUILDINGS[c.b].e + ' ' + BUILDINGS[c.b].n + ' · ' + c.m + 'm'))); n.rec.forEach(r => o.append(el('div', 'orow', (r.type === 'ship' ? '⛵ ' + shipName(n) : unitName(n, r.type)) + ' ×' + r.k + ' · ' + r.m + 'm'))); S.cols.filter(c => c.o === n.id).forEach(c => o.append(el('div', 'orow', '🏕️ ' + WD.provs[c.p].n + ' · ' + c.m + 'm'))); }
}
function flagImgEl(f) { const im = new Image(); im.className = 'mini'; im.src = flagImg(f).src; return im; }
function centerOn(wx, wy) { R.cam.x = wx - innerWidth / 2 / R.cam.z; R.cam.y = wy - innerHeight / 2 / R.cam.z; clampCam(); }

/* ---------- janelas ---------- */
const WTITLE = { gov: 'Governo', eco: 'Economia', tech: 'Tecnologia', mil: 'Militar', dip: 'Diplomacia', flag: 'Bandeira', peace: 'Paz' };
function openWin(id, arg) { UI.win = id; UI.warg = arg; $('#win').hidden = false; $('#win-t').textContent = WTITLE[id]; drawWin(); drawTop(); }
function closeWin() { UI.win = null; $('#win').hidden = true; if (S && S.player >= 0) drawTop(); }
$('#win-x').onclick = closeWin;
function drawWin() {
  if (!UI.win) return; const b = $('#win-b'), keep = b.scrollTop; b.innerHTML = '';
  ({ gov: winGov, eco: winEco, tech: winTech, mil: winMil, dip: winDip, flag: winFlag, peace: winPeace })[UI.win](b);
  b.scrollTop = keep;
}
function charCard(c, title, extra) {
  const d = el('div', 'card'); d.append(el('h4', '', title));
  d.append(el('div', '', charName(c) + ' · ' + ageOf(c) + ' anos'));
  const st = el('div', 'chips'); Object.entries(STATS).forEach(([k, s]) => st.append(tip(el('span', 'chip', s.n + ' ' + c.st[k]), s.n + ': ' + c.st[k] + '\n' + s.d))); d.append(st);
  const tr = el('div', 'chips'); c.tr.forEach(t => tr.append(tip(el('span', 'chip gold', TRAITS[t].n), traitTip(t)))); d.append(tr);
  if (extra) d.append(extra); return d;
}
function govUnlockYear(g) { if (BASE_GOVS.includes(g)) return 860; const t = TECHS.find(t => (t.fx.g || []).includes(g)); return t ? t.y : 860; }
function ideoUnlockYear(i) { if (i === 'trad' || i === 'warrior') return 860; const t = TECHS.find(t => (t.fx.i || []).includes(i)); return t ? t.y : 860; }
function byEraGroups(keys, yearOf) { const m = new Map(); keys.forEach(k => { const e = eraOf(yearOf(k)); if (!m.has(e)) m.set(e, []); m.get(e).push(k); }); return ERAS.map(([, e]) => [e, m.get(e)]).filter(([, l]) => l); }
function winGov(b) {
  const n = me(), msg = el('div', 'msg');
  const top = el('div', 'cols'); top.append(charCard(n.ruler, titleOf(n)));
  if (n.spouse) top.append(charCard(n.spouse, 'Cônjuge'));
  if (n.kids && n.kids.length) { const d = el('div', 'card'); d.append(el('h4', '', 'Herdeiros')); n.kids.slice().sort((a, b) => a.born - b.born).forEach(k => d.append(tip(el('div', '', charName(k) + ' · ' + ageOf(k) + ' anos'), k.tr.map(traitTip).join('\n\n')))); top.append(d); }
  b.append(top);
  if (n.senior != null) b.append(el('p', 'gold', 'Sua coroa é governada por ' + natName(nat(n.senior)) + ' (união pessoal).'));
  const cc = el('div', 'cols'); cc.style.marginTop = '12px';
  COUNCIL.forEach(([k, t, s]) => cc.append(charCard(n.council[k], t, btn('Trocar (💰' + councilCost() + ')', () => councilPick(k, t), 'sm', '', 'Escolha entre 3 candidatos. Este cargo usa ' + STATS[s].n + '.'))));
  b.append(el('h3', 'gold', 'Conselho'), cc, msg);
  b.append(el('h3', 'gold', 'Modificadores atuais'), modChips(n.m));
  b.append(el('h3', 'gold', 'Governo · reforma 💰' + Math.round(80 * eraScale())));
  byEraGroups(Object.keys(GOVS), govUnlockYear).forEach(([e, list]) => { b.append(el('h4', 'era', e)); const go = el('div', 'grid-opts');
    list.forEach(g => { const d = GOVS[g], ok = govOk(n, g), o = el('div', 'opt' + (n.gov === g ? ' on' : '') + (ok ? '' : ' off')); tip(o, govTip(g) + (ok ? '\nReforma: −10 de estabilidade (mesmo grupo) ou −25' : '\n⛔ Exige ' + ((TECHS.find(t => (t.fx.g || []).includes(g)) || {}).n || '')));
      o.append(el('b', '', d.n), el('small', 'dim', d.cat + ' · ' + d.t + (d.term ? ' · mandato de ' + d.term + ' anos' : '')), modChips(Object.assign({}, d.m, { coupX: d.coup })));
      if (ok && n.gov !== g) o.onclick = () => { const e = setGov(n, g); msg.textContent = e; if (!e) { refresh(); renameAsk(); } };
      go.append(o); });
    b.append(go); });
  b.append(el('h3', 'gold', 'Ideologia'));
  byEraGroups(Object.keys(IDEOS), ideoUnlockYear).forEach(([e, list]) => { b.append(el('h4', 'era', e)); const io = el('div', 'grid-opts');
    list.forEach(i => { const d = IDEOS[i], ok = n.fx.i.has(i), o = el('div', 'opt' + (n.ideo === i ? ' on' : '') + (ok ? '' : ' off')); o.style.borderLeft = '4px solid ' + d.col; tip(o, d.n + '\n' + modLines(d.m).join('\n') + '\nAgressividade na IA ×' + d.war + '\nTrocar custa 12 de estabilidade' + (ok ? '' : '\n⛔ Exige tecnologia'));
      o.append(el('b', '', d.n), modChips(d.m)); if (ok && n.ideo !== i) o.onclick = () => { const e = setIdeo(n, i); msg.textContent = e; if (!e) { refresh(); renameAsk(); } }; io.append(o); });
    b.append(io); });
}
function councilPick(k, title) {
  const n = me(), cands = councilCands(n, k);
  modal(m => {
    m.append(el('h2', '', title + ': escolha um candidato'), el('p', 'dim', 'Custa 💰' + councilCost() + '.'));
    const c = el('div', 'cols'); cands.forEach(ch => c.append(charCard(ch, charName(ch), btn('Nomear', () => { const e = swapCouncil(n, k, ch); if (e) say(e, 'bad'); closeModal(); refresh(); }, 'sm grn', n.money < councilCost() ? 'Sem dinheiro' : '')))); m.append(c, btn('Cancelar', closeModal));
  }, true);
}
function renameAsk() {
  const n = me();
  modal(m => {
    m.append(el('h2', '', 'Novo nome?'), el('p', 'dim', 'Depois de uma reforma, o país pode mudar de nome.'));
    const inp = el('input', 'tin'); inp.value = n.name; inp.maxLength = 24; const prev = el('div', 'gold', natName(n)); inp.oninput = () => { prev.textContent = (GOVS[n.gov].fmt || '{}').replace('{}', inp.value || '…'); };
    const msg = el('div', 'msg'), r = el('div', 'row'); r.append(btn('Renomear', () => { const e = rename(n, inp.value); if (e) msg.textContent = e; else { closeModal(); S.mapDirty = true; refresh(); } }, 'grn'), btn('Manter', closeModal));
    m.append(inp, prev, msg, r); setTimeout(() => inp.focus(), 50);
  });
}
function winEco(b) {
  const n = me(), sum = el('div', 'cols');
  const inc = el('div', 'card'); inc.append(el('h4', '', 'Balanço mensal'));
  const t = el('table', 't'); const lab = { tax: ['Impostos', '6% do PIB, ajustado por governo, mercados e estabilidade'], trade: ['Exportações', 'Excedentes vendidos ao mercado mundial'], imports: ['Importações', 'O que falta é comprado, até um orçamento; comida primeiro'], army: ['Exército', 'Manutenção dos regimentos'], navy: ['Marinha', 'Manutenção dos navios'], admin: ['Administração', 'Cresce com população e províncias'], interest: ['Juros', '1% da dívida ao mês'], corrupt: ['Corrupção', '1% ao mês do que passa de 2.000'] };
  Object.entries(n.inc).forEach(([k, v]) => { const r = t.insertRow(), c0 = r.insertCell(); c0.textContent = lab[k][0]; tip(c0, lab[k][1]); const c = r.insertCell(); c.className = 'n ' + (v < 0 ? 'bad' : 'good'); c.textContent = money(v); });
  const tr = t.insertRow(); tr.insertCell().textContent = 'Total'; const tc = tr.insertCell(); tc.className = 'n gold'; tc.textContent = money(n.income); inc.append(t); sum.append(inc);
  const embs = S.nations.filter(o => o.alive && has(o, 'emb', n.id)).length;
  const g = el('div', 'card'); g.append(el('h4', '', 'Produção'), kv([['PIB', money(n.gdp) + '/mês'], ['População', popStr(n.popT)], ['Empregados', popStr(n.employed || 0)], ['Comida', pct(n.foodSat), 'Abaixo de 95% a população encolhe'], ['Canteiros', n.cons.length + ' / ' + consSlots(n), 'Obras ao mesmo tempo: tecnologia, população e tesouro dão mais'], ['Acordos comerciais', (n.trade || []).length + '', '+7% de eficiência de comércio cada'], ['Embargos contra você', embs + '', '−8% de eficiência de comércio cada']]), modChips({ tax: n.m.tax, prod: n.m.prod, trade: n.m.trade, food: n.m.food })); sum.append(g);
  b.append(sum);
  const gt = el('table', 't'); gt.style.marginTop = '12px'; const hr = gt.insertRow(); ['Bem', 'Produção', 'Consumo', 'Importa', 'Exporta', 'Preço mundial', 'Atendido'].forEach(x => hr.append(el('th', '', x)));
  GOOD_IDS.forEach(id => {
    const s = n.mk.sup[id] || 0, d = n.mk.dem[id] || 0; if (s < .05 && d < .05) return;
    const r = gt.insertRow(), c0 = r.insertCell(); c0.textContent = GOODS[id].e + ' ' + GOODS[id].n; tip(c0, GOODS[id].n + ' · preço base ' + GOODS[id].p + '\nFeito por: ' + (Object.values(BUILDINGS).filter(x => x.out && x.out[id]).map(x => x.n).join(', ') || 'subsistência'));
    [s, d, n.mk.imp[id] || 0, n.mk.exp[id] || 0].forEach(v => { const c = r.insertCell(); c.className = 'n'; c.textContent = v >= 10 ? Math.round(v) : v.toFixed(1); });
    const p = r.insertCell(); p.className = 'n'; p.textContent = S.wp[id].toFixed(1); const ratio = S.wp[id] / GOODS[id].p; p.classList.add(ratio > 1.3 ? 'bad' : ratio < .7 ? 'good' : 'x');
    const sc = r.insertCell(); sc.style.width = '120px'; sc.append(bar(n.mk.sat[id] == null ? 1 : n.mk.sat[id], (n.mk.sat[id] || 1) < .8 ? '#e5636b' : '#8fd17f'));
  });
  b.append(gt);
}
function winTech(b) {
  const n = me();
  const cur = el('div', 'card'); const tr = n.res ? TECH[n.res] : null;
  cur.append(el('h4', '', 'Pesquisando'), el('div', '', tr ? tr.n + ' · ' + Math.floor(n.rp) + ' / ' + techCost(n, tr) : 'Nada — escolha abaixo'), bar(tr ? n.rp / techCost(n, tr) : 0), tip(el('small', 'dim', '+' + researchRate(n).toFixed(1) + ' por mês'), 'Vem da população, universidades, estabilidade e modificadores.\nPesquisar antes do ano custa 3% a mais por ano adiantado.'));
  if (n.vert) cur.append(el('div', 'gold', 'Vertente: ' + VERT[n.vert].e + ' ' + VERT[n.vert].n + ' · ' + n.vlv + ' de ' + VERT[n.vert].len));
  b.append(cur);
  const cols = el('div', 'tcols'); cols.style.marginTop = '12px';
  Object.entries(CATS).forEach(([c, name]) => {
    const col = el('div', 'tcol'); col.append(el('h4', '', name));
    TECHS.filter(t => t.c === c && !t.vt).sort((a, b) => a.y - b.y).forEach(t => col.append(techBox(n, t)));
    cols.append(col);
  });
  b.append(cols);
  if (n.vert) {
    const v = VERT[n.vert]; b.append(el('h3', 'gold', 'Árvore ' + v.e + ' ' + v.n));
    const vc = el('div', 'tcols v3'); [['mil', 'Militar'], ['nav', 'Naval'], ['eco', 'Economia']].forEach(([c, name]) => { const col = el('div', 'tcol'); col.append(el('h4', '', name)); TECHS.filter(t => t.v === v.id && t.vt && t.c === c).forEach(t => col.append(techBox(n, t))); vc.append(col); });
    b.append(vc);
  }
}
function techBox(n, t) {
  const s = techState(n, t), cls = s === 'done' || hasT(n, t.id) ? 'done' : s ? 'lock' : 'av', d = el('div', 'tech ' + cls + (n.res === t.id ? ' cur' : '') + (t.v ? ' vt' : ''));
  if (t.v) d.style.borderLeft = '4px solid ' + VERT[t.v].col;
  d.append(el('b', '', (t.entry ? VERT[t.v].e + ' ' : '') + t.n)); d.append(el('small', '', t.y + (cls === 'done' ? ' · ✓' : ' · 🔬' + techCost(n, t)) + (t.entry ? ' · ' + VERT[t.v].n : '')));
  tip(d, techTip(n, t, s));
  if (!s) d.onclick = () => { n.res = t.id; drawWin(); drawTop(); };
  return d;
}
function winMil(b) {
  const n = me(), P = WD.provs.length, msg = el('div', 'msg');
  const c = el('div', 'cols');
  const pw = el('div', 'card'); pw.append(el('h4', '', 'Exército'));
  const t = el('table', 't'); const h = t.insertRow(); ['Tipo', 'Unidade', 'Força', 'Custo', ''].forEach(x => h.append(el('th', '', x)));
  ['inf', 'cav', 'art', 'vrt'].filter(ty => ty !== 'vrt' || n.vert).forEach(ty => { const r = t.insertRow(); r.insertCell().textContent = { inf: 'Infantaria', cav: 'Cavalaria', art: 'Artilharia', vrt: 'Vertente' }[ty]; const u = r.insertCell(); u.textContent = unitName(n, ty); tip(u, unitTip(n, ty)); const f = r.insertCell(); f.className = 'n'; f.textContent = (n.up[ty] * UNIT_BASE[ty].a).toFixed(2); const co = r.insertCell(); co.className = 'n'; co.textContent = '💰' + recCost(n, ty); r.insertCell().append(btn('+1 na capital', () => { msg.textContent = recruit(n, ty, 1); refresh(); }, 'sm', canRecruit(n, ty, 1))); });
  pw.append(t, msg); c.append(pw);
  const st = el('div', 'card'); st.append(el('h4', '', 'Forças'), kv([['Regimentos', fmtK(S.armies.filter(a => a.o === n.id).reduce((s, a) => s + regs(a), 0))], ['Contingente', Math.floor(n.manpower) + 'k / ' + Math.floor(n.mpMax || 0) + 'k'], ['Navegação', n.fx.sea === 2 ? 'Oceânica' : n.fx.sea ? 'Costeira' : 'Nenhuma', 'Costeira: mares junto à terra. Oceânica (Caravela): mar aberto.'], ['Cerco', '×' + n.up.siege.toFixed(1)]]), modChips({ army: n.m.army, manpower: n.m.manpower, speed: n.m.speed })); c.append(st);
  const nv = el('div', 'card'); nv.append(el('h4', '', 'Marinha · ' + shipName(n)));
  const ports = provsOf(n.id).filter(p => WD.provs[p].coast && S.ctrl[p] === n.id).sort((a, b) => (S.bld[WD.provs[b].state].port || 0) - (S.bld[WD.provs[a].state].port || 0));
  nv.append(kv([['Navios', Math.ceil(S.fleets.filter(f => f.o === n.id).reduce((s, f) => s + f.ships, 0)) + ''], ['Transporte', transport(n.id) + ' regimentos', '3 regimentos por navio'], ['Força por navio', n.fx.ship.toFixed(1)], ['Custo', '💰' + shipCost(n) + ' por navio']]));
  if (ports.length && n.fx.sea) {
    const sel = el('select'); ports.slice(0, 60).forEach(p => sel.append(new Option(WD.provs[p].n + ' (' + WD.states[WD.provs[p].state].n + ')', p)));
    const row = el('div', 'row'); [1, 3, 10].forEach(k => row.append(btn('+' + k + ' ' + shipName(n), () => { const e = buildShips(n, k, +sel.value); msg.textContent = e; if (!e) refresh(); }, 'sm', n.money < shipCost(n) * k ? 'Sem dinheiro' : '', 'Prontos em 4 meses no mar ao lado do estaleiro')));
    nv.append(el('small', 'dim', 'Estaleiro'), sel, row);
  } else nv.append(el('p', 'dim', n.fx.sea ? 'Sem litoral.' : 'Exige Barcos longos.'));
  c.append(nv);
  b.append(c);
  const at = el('table', 't'); at.style.marginTop = '12px'; const hh = at.insertRow(); ['Força', 'Local', 'Tropas', 'Moral', ''].forEach(x => hh.append(el('th', '', x)));
  S.armies.filter(a => a.o === n.id).forEach((a, i) => { const r = at.insertRow(); r.insertCell().textContent = '⚔️ ' + (i + 1); r.insertCell().textContent = a.p < P ? WD.provs[a.p].n : WD.seas[a.p - P].n; r.insertCell().textContent = ['inf', 'cav', 'art', 'vrt'].filter(t => a[t] > .05).map(t => fmtK(a[t]) + ' ' + unitName(n, t)).join(', '); const m = r.insertCell(); m.style.width = '90px'; m.append(bar(a.mor, '#7fe08a')); r.insertCell().append(btn('Ver', () => { closeWin(); select('army', a.id); centerOn(...armyXY(a)); }, 'sm')); });
  S.fleets.filter(f => f.o === n.id).forEach((f, i) => { const r = at.insertRow(); r.insertCell().textContent = '⛵ ' + (i + 1); r.insertCell().textContent = WD.seas[f.z].n; r.insertCell().textContent = Math.ceil(f.ships) + ' ' + shipName(n); r.insertCell().textContent = f.auto ? '🧭' : ''; r.insertCell().append(btn('Ver', () => { closeWin(); select('fleet', f.id); centerOn(...fleetXY(f)); }, 'sm')); });
  b.append(at);
}
function winDip(b) {
  const n = me(), t = el('table', 't'), h = t.insertRow(); ['', 'Nação', 'Governo', 'Províncias', 'Exército', 'Relação', 'Status', ''].forEach(x => h.append(el('th', '', x)));
  S.nations.filter(o => o.alive && o.id !== n.id && n.exP[o.capital]).sort((a, b) => (has(n, 'allies', b.id) - has(n, 'allies', a.id)) || provsOf(b.id).length - provsOf(a.id).length).forEach(o => {
    const r = t.insertRow(); r.insertCell().append(flagImgEl(o.flag)); r.insertCell().textContent = natName(o); const gv = r.insertCell(); gv.textContent = GOVS[o.gov].n; tip(gv, govTip(o.gov));
    const p = r.insertCell(); p.className = 'n'; p.textContent = provsOf(o.id).length; const a = r.insertCell(); a.className = 'n'; a.textContent = fmtK(S.armies.filter(x => x.o === o.id).reduce((s, x) => s + regs(x), 0));
    const rel = r.insertCell(); rel.className = 'n ' + ((o.rel[n.id] || 0) < 0 ? 'bad' : 'good'); rel.textContent = Math.round(o.rel[n.id] || 0); tip(rel, 'Como eles veem você');
    const stt = r.insertCell(); stt.textContent = dipStatus(n, o).map(x => x.split(' ')[0]).join(' '); tip(stt, dipStatus(n, o).join('\n'));
    r.insertCell().append(btn('Ações', () => { closeWin(); select('nat', o.id); const c = WD.provs[o.capital]; centerOn(c.cx * K, c.cy * K); }, 'sm'));
  });
  b.append(t);
}
function winPeace(b) {
  const w = S.wars.find(x => x.id === UI.warg); if (!w) { b.append(el('p', 'dim', 'Essa guerra acabou.')); return; }
  const n = me(), mySide = sideOf(w, n.id), lead = w.a === n.id || w.d === n.id, e = nat(mySide === 'A' ? w.d : w.a), sc = warScore(w) * (mySide === 'A' ? 1 : -1), msg = el('div', 'msg');
  b.append(el('h3', '', 'Guerra contra ' + natName(e)), tip(el('div', sc >= 0 ? 'good' : 'bad', 'Placar: ' + sc + ' · ' + Math.floor((S.t - w.start) / 360) + ' anos'), 'Vem das províncias ocupadas, das batalhas e de manter o objetivo da guerra.'), bar((sc + 100) / 200, sc >= 0 ? '#8fd17f' : '#e5636b'));
  b.append(el('div', 'dim', 'Seu lado: ' + (mySide === 'A' ? w.A : w.D).map(x => nat(x).name).join(', ') + ' · Lado deles: ' + (mySide === 'A' ? w.D : w.A).map(x => nat(x).name).join(', ')));
  if (!lead) { b.append(el('p', 'gold', 'Você entrou como aliado; só o líder da guerra negocia a paz.')); return; }
  const occ = occupiedBy(w, n.id), chosen = new Set();
  const list = el('div', 'card'); list.style.marginTop = '10px'; list.append(el('h4', '', 'Províncias ocupadas que você pode exigir'));
  const total = el('div', 'gold'), mon = el('input');
  const upd = () => { const c = Math.ceil(peaceCost(w, n.id, [...chosen]) + (mon.checked ? 12 : 0)); total.textContent = 'Custo: ' + c + ' de ' + sc; };
  occ.forEach(p => { const lb = el('label', 'brow'), cb = el('input'); cb.type = 'checkbox'; cb.onchange = () => { cb.checked ? chosen.add(p) : chosen.delete(p); upd(); }; lb.append(cb, el('span', 'nm', WD.provs[p].n + ' (' + popStr(S.pop[p]) + ')'), el('span', 'dim', Math.ceil(peaceCost(w, n.id, [p])) + '')); list.append(lb); });
  if (!occ.length) list.append(el('p', 'dim', 'Nenhuma.'));
  const ml = el('label', 'brow'); mon.type = 'checkbox'; mon.onchange = upd; ml.append(mon, el('span', 'nm', 'Reparações em ouro (💰' + money(Math.min(e.money, Math.abs(e.income) * 12 + 100)) + ')'), el('span', 'dim', '12'));
  list.append(ml, total); b.append(list); upd();
  const r = el('div', 'row'); r.style.marginTop = '10px';
  r.append(btn('🕊️ Propor', () => { const res = proposePeace(w, [...chosen], mon.checked ? Math.min(e.money, Math.abs(e.income) * 12 + 100) : 0); if (res) msg.textContent = res; else { closeWin(); refresh(); } }, 'grn'));
  r.append(btn('Paz branca', () => { const res = proposePeace(w, [], 0); if (res) msg.textContent = res; else { closeWin(); refresh(); } }));
  r.append(btn('Render-se', () => modal(m => { m.append(el('h2', '', 'Render-se?'), el('p', '', natName(e) + ' fica com tudo o que ocupa.')); const row = el('div', 'row'); row.append(btn('Render-se', () => { makePeace(w, e.id, occupiedBy(w, e.id)); closeModal(); closeWin(); refresh(); }, 'red'), btn('Voltar', closeModal)); m.append(row); }), 'red'));
  b.append(r, msg);
}
/* editor de bandeira: partição, esmaltes, peça honrosa, móvel; aleatória infinita e SVG para baixar */
function winFlag(b) {
  const n = me(); if (!UI.fdraft) UI.fdraft = JSON.parse(JSON.stringify(n.flag)); const f = UI.fdraft;
  const wrap = el('div', 'fed'), prev = el('div', 'prev'); prev.innerHTML = flagSVG(f, 'ed'); wrap.append(prev);
  const ctl = el('div', 'fctl');
  const sel = (label, opts, val, on) => { const l = el('label', '', label), s = el('select'); Object.entries(opts).forEach(([k, v]) => s.append(new Option(v, k))); s.value = val; s.onchange = () => { on(s.value); drawWin(); }; l.append(s); return l; };
  const sw = (label, val, on) => { const l = el('label', '', label), d = el('div', 'sw'); T_IDS.forEach(t => { const x = el('button', val === t ? 'on' : ''); x.style.background = TINCT[t].c; tip(x, TINCT[t].n + (TINCT[t].metal ? ' (metal)' : ' (cor)') + '\nRegra heráldica: metal sobre cor e cor sobre metal'); x.onclick = () => { on(t); drawWin(); }; d.append(x); }); l.append(d); return l; };
  ctl.append(sel('Partição', DIVS, f.d, v => { f.d = v; if (v === 'barry') f.k = f.k || 7; if (v === 'paly') f.k = f.k || 5; }));
  ctl.append(sw('Esmalte 1', f.t[0], t => f.t[0] = t), sw('Esmalte 2', f.t[1], t => f.t[1] = t), sw('Esmalte 3', f.t[2], t => f.t[2] = t));
  const o = f.o || { k: 'none', t: 'or' }; ctl.append(sel('Peça honrosa', ORDS, o.k, v => { f.o = v === 'none' ? null : Object.assign({}, o, { k: v }); })); if (f.o) ctl.append(sw('Esmalte da peça', f.o.t, t => f.o.t = t));
  const c = f.c || { k: 'none', t: 'argent', n: 1, at: 'center' }; ctl.append(sel('Móvel', CHARGES, c.k, v => { f.c = v === 'none' ? null : Object.assign({}, c, { k: v }); }));
  if (f.c) ctl.append(sw('Esmalte do móvel', f.c.t, t => f.c.t = t), sel('Posição', CPOS, f.c.at, v => f.c.at = v), sel('Quantidade', { 1: '1', 2: '2', 3: '3' }, f.c.n || 1, v => f.c.n = +v));
  const r = el('div', 'row'), msg = el('div', 'msg');
  r.append(btn('🎲 Aleatória', () => { UI.fdraft = flagRandom(Math.random); drawWin(); }, '', '', 'Sorteia uma bandeira nova; nada muda até hastear'),
    btn('✔ Hastear (💰' + flagCost() + ')', () => { const e = setFlag(n, f); msg.textContent = e; if (!e) { S.mapDirty = true; refresh(); log('Nova bandeira hasteada em ' + natName(n) + '.', 'good', [n.id]); } }, 'grn', n.money < flagCost() ? 'Sem dinheiro' : '', 'Troca a bandeira do país'),
    btn('⬇ Baixar SVG', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([flagSVG(f, 'dl')], { type: 'image/svg+xml' })); a.download = n.name.toLowerCase() + '.svg'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }),
    btn('Desfazer', () => { UI.fdraft = null; drawWin(); }));
  ctl.append(r, msg); wrap.append(ctl); b.append(wrap);
}

/* ---------- modais: paz, chamado às armas, propostas da IA, fim ---------- */
function modal(fill, wide) { const m = $('#modal-b'); m.innerHTML = ''; m.classList.toggle('wide', !!wide); fill(m); $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }
function pendingModals() {
  if (!$('#modal').hidden) return;
  if (S.offer) { peaceOffer(); return; }
  if (S.calls && S.calls.length) { const c = S.calls.shift(), w = S.wars.find(x => x.id === c.w); if (!w) return; const lead = nat(c.from), foe = nat(c.side === 'A' ? w.d : w.a); UI.speed = 0; drawTop();
    modal(m => { m.append(el('h2', '', 'Chamado às armas'), el('p', '', natName(lead) + ' pede sua ajuda na guerra contra ' + natName(foe) + '.'), el('p', 'dim', 'Recusar acaba com a aliança.')); const r = el('div', 'row'); r.append(btn('Entrar na guerra', () => { answerCall(c, true); closeModal(); refresh(); S.mapDirty = true; }, 'red'), btn('Recusar', () => { answerCall(c, false); closeModal(); refresh(); })); m.append(r); }); return; }
  if (S.dipOffers && S.dipOffers.length) { const o = S.dipOffers.shift(), from = nat(o.from); if (!from.alive) return; UI.speed = 0; drawTop();
    const txt = { ally: 'propõe uma aliança.', marr: 'propõe um casamento real.', trade: 'propõe um acordo comercial.' }[o.kind];
    modal(m => { m.append(flagEl(from.flag, 'mflag'), el('h2', '', natName(from)), el('p', '', txt)); const r = el('div', 'row'); r.append(btn('Aceitar', () => { const e = dipAct(from, me(), o.kind); if (e) say(e, 'bad'); closeModal(); refresh(); }, 'grn'), btn('Recusar', () => { from.rel[S.player] = (from.rel[S.player] || 0) - 10; closeModal(); })); m.append(r); }); }
}
function peaceOffer() {
  const o = S.offer; S.offer = null; const w = S.wars.find(x => x.id === o.w); if (!w) return;
  const n = me(), e = nat(sideOf(w, n.id) === 'A' ? w.d : w.a); UI.speed = 0; drawTop();
  modal(m => {
    m.append(el('h2', '', 'Proposta de paz'), el('p', '', natName(e) + (o.winner == null ? ' propõe paz branca.' : ' exige ' + o.provs.length + ' província' + (o.provs.length === 1 ? '' : 's') + ':')));
    o.provs.forEach(p => m.append(el('div', 'dim', '· ' + WD.provs[p].n)));
    const r = el('div', 'row'); r.append(btn('Aceitar', () => { makePeace(w, o.winner, o.provs); closeModal(); refresh(); }, 'grn'), btn('Recusar', closeModal, 'red')); m.append(r);
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

/* ---------- menu do botão direito (ações com outro país) ---------- */
function ctxMenu(sx, sy, p) {
  const c = $('#ctx'), n = me(), o = S.own[p]; c.innerHTML = '';
  if (o === n.id || !n.exP[p]) { c.hidden = true; return; }
  if (o < 0) c.append(el('h4', '', WD.provs[p].n + ' · nativos'), btn('🏕️ Colonizar (💰' + colCost(n, p) + ')', () => { const e = colonize(n, p); say(e || 'Colonos a caminho.', e ? 'bad' : 'good'); c.hidden = true; refresh(); }, '', canColonize(n, p)));
  else {
    const t = nat(o), h = el('div', 'side-h'); h.append(flagEl(t.flag, 'fl')); const tt = el('div', 'col'); tt.append(el('b', '', natName(t)), el('small', 'dim', 'Relação ' + Math.round(t.rel[n.id] || 0) + (dipStatus(n, t).length ? ' · ' + dipStatus(n, t).join(' · ') : ''))); h.append(tt); c.append(h);
    c.append(btn('Ver nação', () => { c.hidden = true; select('nat', o); }, 'sm'), dipButtons(t));
  }
  c.hidden = false; const w = c.offsetWidth, hh = c.offsetHeight; c.style.left = Math.max(6, Math.min(innerWidth - w - 6, sx)) + 'px'; c.style.top = Math.max(56, Math.min(innerHeight - hh - 6, sy)) + 'px';
}
document.addEventListener('pointerdown', e => { if (!e.target.closest('#ctx')) $('#ctx').hidden = true; }, true);

/* ---------- entrada no mapa ---------- */
const cv = $('#cv'); let drag = null;
cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx: R.cam.x, cy: R.cam.y, moved: false, btn: e.button }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true; if (!drag.moved) return;
  if (drag.btn === 0 && UI.scr === 'game') R.box = { x0: Math.min(drag.x, e.clientX), y0: Math.min(drag.y, e.clientY), x1: Math.max(drag.x, e.clientX), y1: Math.max(drag.y, e.clientY) };
  else { R.cam.x = drag.cx - dx / R.cam.z; R.cam.y = drag.cy - dy / R.cam.z; clampCam(); }
});
cv.addEventListener('pointerup', e => {
  const d = drag; drag = null; if (!d || !S) return;
  if (R.box) { const b = R.box; R.box = null; const ids = S.armies.filter(a => a.o === S.player).filter(a => { const [x, y] = toScreen(...armyXY(a)); return x >= b.x0 - 10 && x <= b.x1 + 10 && y >= b.y0 - 10 && y <= b.y1 + 10; }).map(a => a.id);
    if (ids.length === 1) select('army', ids[0]); else if (ids.length) select('armies', ids); else select(null); drawOutl(); return; }
  if (d.moved) return;
  if (e.button === 0) leftClick(e.clientX, e.clientY, e.shiftKey); else if (e.button === 2) rightClick(e.clientX, e.clientY);
});
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { e.preventDefault(); const [wx, wy] = toWorld(e.clientX, e.clientY); R.cam.z *= e.deltaY < 0 ? 1.15 : 1 / 1.15; clampCam(); R.cam.x = wx - e.clientX / R.cam.z; R.cam.y = wy - e.clientY / R.cam.z; clampCam(); }, { passive: false });
function leftClick(sx, sy, shift) {
  const i = cellAt(sx, sy);
  if (UI.scr === 'setup') { if (i >= 0 && WD.prov[i] >= 0 && S.own[WD.prov[i]] >= 0) setupCard(S.own[WD.prov[i]]); return; }
  const u = unitAt(sx, sy);
  if (u && u.a) { if (shift && u.a.o === S.player && R.selArmies.length) { const ids = R.selArmies.map(a => a.id); if (!ids.includes(u.a.id)) ids.push(u.a.id); select('armies', ids); } else select('army', u.a.id); return; }
  if (u && u.f) { select('fleet', u.f.id); return; }
  if (i < 0) { select(null); return; } const p = WD.prov[i];
  if (p >= 0) select('prov', p); else select(null);
}
function rightClick(sx, sy) {
  const i = cellAt(sx, sy); if (i < 0) return; const n = me(), P = WD.provs.length;
  const mine = R.selArmies.filter(a => a.o === n.id && S.armies.includes(a));
  if (mine.length) {
    let to = WD.prov[i]; if (to < 0 && WD.sea[i] >= 0) to = P + WD.sea[i]; if (to < 0) return;
    let fail = 0; mine.forEach(a => { if (!orderArmy(a, to)) fail++; });
    if (fail) say('Sem caminho até lá para ' + fail + ' exército' + (fail > 1 ? 's' : '') + (n.fx.sea ? ' (faltam navios para o transporte?)' : '') + '.', 'bad'); drawSide();
  } else if (R.selFleet && R.selFleet.o === n.id) {
    const z = WD.sea[i]; if (z < 0) return; R.selFleet.auto = false; if (!orderFleet(R.selFleet, z)) say('Sem rota até esse mar.', 'bad'); drawSide();
  } else if (WD.prov[i] >= 0) ctxMenu(sx, sy, WD.prov[i]);
}
addEventListener('keydown', e => {
  if (UI.scr === 'menu' || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (/^Key[WASD]$/.test(e.code) || /^Arrow/.test(e.code)) { UI.keys.add(e.code); e.preventDefault(); return; }
  if (UI.scr !== 'game') return;
  if (e.code === 'Space') { e.preventDefault(); setSpeed(UI.speed ? 0 : UI.last); }
  else if (/^Digit[1-5]$/.test(e.code)) setSpeed(+e.code.slice(5));
  else if (e.code === 'Escape') { if (!$('#modal').hidden) closeModal(); else if (!$('#ctx').hidden) $('#ctx').hidden = true; else if (UI.win) closeWin(); else select(null); }
});
addEventListener('keyup', e => UI.keys.delete(e.code));
addEventListener('blur', () => UI.keys.clear());
const MINI = $('#mini');                                     // minimapa: clique ou arraste para mover a câmera
MINI.addEventListener('pointerdown', e => { const go = ev => { const r = MINI.getBoundingClientRect(); centerOn((ev.clientX - r.left) / r.width * R.base.width, (ev.clientY - r.top) / r.height * R.base.height); }; go(e); MINI.setPointerCapture(e.pointerId); MINI.onpointermove = ev => { if (ev.buttons) go(ev); }; });

/* ---------- laço ---------- */
const busy = box => box.contains(document.activeElement) && /^(SELECT|INPUT)$/.test(document.activeElement.tagName);
let lastT = performance.now(), lastUi = 0, lastMonth = -1, lastMini = 0;
function loop(now) {
  const dt = Math.min(.25, (now - lastT) / 1000); lastT = now;
  if (UI.keys.size && S) { const v = 700 * dt / R.cam.z, k = UI.keys; if (k.has('KeyW') || k.has('ArrowUp')) R.cam.y -= v; if (k.has('KeyS') || k.has('ArrowDown')) R.cam.y += v; if (k.has('KeyA') || k.has('ArrowLeft')) R.cam.x -= v; if (k.has('KeyD') || k.has('ArrowRight')) R.cam.x += v; clampCam(); }
  if (S && UI.scr === 'game' && !S.over && UI.speed && $('#modal').hidden) {
    UI.acc += dt * SPEEDS[UI.speed]; let n = 0;
    while (UI.acc >= 1 && n < 30) { UI.acc -= 1; n++; advanceDay(); if (S.offer || S.over || (S.calls && S.calls.length) || (S.dipOffers && S.dipOffers.length)) break; if (S.t % 360 === 0) saveGame(); }
    if (UI.acc > 3) UI.acc = 0;
  }
  if (S && UI.scr === 'game') {
    S.news.length = 0; pendingModals();
    if (S.over && $('#modal').hidden && !UI.ended) { UI.ended = true; endScreen(); }
    const month = Math.floor(S.t / 30);
    if (month !== lastMonth || now - lastUi > 1000) { lastMonth = month; lastUi = now; drawTop(); drawOutl(); if (!busy($('#side'))) drawSide(); if (UI.win && UI.win !== 'flag' && UI.win !== 'peace' && !busy($('#win'))) drawWin(); drawChron(); }
    if (now - lastMini > 200) { lastMini = now; drawMini(MINI); }
  }
  if (S && (UI.scr === 'game' || UI.scr === 'setup')) { if (S.mapDirty && now - UI.lastMap > 300) { UI.lastMap = now; rebuildMap(); } drawFrame(); }
  requestAnimationFrame(loop);
}
initRender(cv); menu(); requestAnimationFrame(loop);

/* depuração: #dbg&seed=N&days=D&win=tech&mode=pol&z=2&war=D&prov=1&setup=1&chron=1&ctx=1&council=1&vert=steam abre direto numa partida (testes e screenshots) */
(() => {
  const q = new URLSearchParams(location.hash.slice(1)); if (!q.has('dbg')) return;
  newGame(+q.get('seed') || 7); const main = S.nations.filter(n => n.kind === (q.get('kind') || 'main')).sort((a, b) => provsOf(b.id).length - provsOf(a.id).length)[0];
  S.player = main.id; if (q.get('vert')) { main.techs['v_' + q.get('vert')] = 1; main.vert = q.get('vert'); calcMods(main); }
  for (let d = 0; d < (+q.get('days') || 0); d++) advanceDay();
  if (q.has('war')) {
    const nb = new Set(); provsOf(main.id).forEach(p => WD.provs[p].adj.forEach(o => { if (S.own[o] >= 0 && S.own[o] !== main.id) nb.add(S.own[o]); }));
    const t = nat([...nb][0]); declareWar(main, t, null); S.calls = [];
    S.armies.filter(a => a.o === main.id).forEach(a => orderArmy(a, provsOf(t.id).find(p => WD.provs[p].adj.some(o => S.own[o] === main.id))));
    for (let d = 0; d < +q.get('war'); d++) advanceDay();
  }
  S.offer = null; S.calls = []; S.dipOffers = [];
  startPlay(false); if (q.get('mode')) { R.mode = q.get('mode'); drawModes($('#modes')); }
  if (q.get('z')) { R.cam.z = +q.get('z'); centerOn(WD.provs[main.capital].cx * K, WD.provs[main.capital].cy * K); }
  if (q.get('win')) openWin(q.get('win'), q.get('win') === 'peace' && warsOf(main.id)[0] ? warsOf(main.id)[0].id : undefined);
  if (q.get('prov')) select('prov', main.capital);
  if (q.get('box')) select('armies', S.armies.filter(a => a.o === main.id).map(a => a.id));
  if (q.get('chron')) { UI.chron = true; drawChron(); drawTop(); }
  if (q.get('ctx')) { const p = provsOf(main.id).map(p => WD.provs[p].adj.find(o => S.own[o] >= 0 && S.own[o] !== main.id)).find(x => x != null); const [sx, sy] = toScreen(WD.provs[p].cx * K, WD.provs[p].cy * K); ctxMenu(sx, sy, p); }
  if (q.get('council')) councilPick('marshal', 'Marechal');
  if (q.get('setup')) { S.player = -1; show('setup'); R.view = -1; S.mapDirty = true; fitCam(); setupCard(main.id); drawModes($('#s-modes')); }
  if (q.get('scroll')) $('#win-b').scrollTop = 1e6;
  if (q.get('tip')) { const t = document.querySelector(q.get('tip')), r = t.getBoundingClientRect(); t.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); document.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 5, clientY: r.bottom - 5 })); }
  rebuildMap(); drawFrame(); drawMini(MINI);
})();
