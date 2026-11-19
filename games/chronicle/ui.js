/* Grand Chronicle — interface: menu, escolha do mundo e da nação, barra do topo, painéis, janelas, descrições ao passar o mouse,
   minimapa, crônica, menu do botão direito (diplomacia) e o laço do tempo.
   Mapa: arrastar com o botão esquerdo seleciona tropas em área · botão direito move as tropas selecionadas (sem tropas: ações com o país)
   · arrastar com o botão direito/do meio ou WASD move a câmera · roda dá zoom. */
'use strict';

const $ = s => document.querySelector(s);
const SPEEDS = [0, 2, 6, 15, 40, 90];                       // dias por segundo
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
  if (d.fx) Object.entries(d.fx).forEach(([k, v]) => { const t = { tax: 'Impostos do país +' + v * 100 / 4 + '%', fort: 'Fortificação +' + v, port: 'Porto: frotas e comércio', trade: 'Comércio +' + Math.round(v * 100) + '%', research: 'Pesquisa +' + v + '/mês', stab: 'Estabilidade +' + v * 2, prod: 'Produção do estado +' + Math.round(v * 100) + '%', speed: 'Tropas ' + Math.round(v * 100) + '% mais rápidas no estado', infra: 'Aparece no mapa ligando estados vizinhos', mill: 'Fazendas do estado +15% por nível; subsistência +5%', pipe: 'Petróleo do estado +30%; aparece no mapa', svc: SVC[v] ? SVC[v].n + ': cada nível atende ' + Math.round(SVC_CAP(curYear())) + ' mil pessoas (' + SVC[v].d.toLowerCase() + ')' : '', yard: 'Navios 30% mais baratos neste estado', mp: 'Contingente +5% e recrutas 1 mês mais rápidos aqui', army: 'Força militar +' + Math.round(v * 100) + '%', launch: 'Lança foguetes e satélites' }[k]; if (t) o.push(t); });
  if (d.tl) o.push('Usa ' + d.tl + ' de Ferramentas: sem elas rende até 20% menos');
  if (d.in && d.in.power) o.push('Energia só é consumida a partir de 1885');
  const J = JOBS[jobGroup(b)]; o.push(d.w + ' mil empregos por nível (' + JOB_N[jobGroup(b)].toLowerCase() + ': ' + CLASS_IDS.filter(k => J[k]).map(k => Math.round(J[k] * 100) + '% ' + CLASSES[k].n.toLowerCase()).join(', ') + ') · ' + bMonths(b) + ' meses de obra');
  if (SLAVE_JOBS.includes(b)) o.push('Aceita escravos (se a lei permitir): até +25% de produção');
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
  if (t.entry) { const v = VERT[t.v]; o.push('Entrada da vertente ' + v.e + ' ' + v.n + '.', 'Escolhê-la troca as tecnologias militares, navais e econômicas posteriores a ' + v.entry.y + ' pela árvore ' + v.n + ' (até 2200).', 'Bônus da árvore completa: ' + modLines(v.m).join(', '), 'Exige ' + needName(t.v) + ' no território ou numa província vizinha' + (S && S.player >= 0 ? (vertNeedOk(n, t.v) ? ' ✓' : ' ✗') : '')); if (VUNITS[t.v]) { const U = VUNITS[t.v]; o.push('Tropas próprias (evoluem com a árvore):', ...['inf', 'cav', 'art', 'ship'].map(k => '· ' + U[k].map(x => x[1]).join(' → '))); } }
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
$('#s-era').onchange = () => genWorld();
tip($('#s-era').parentElement, 'Ano de início: em eras avançadas os países já começam com as tecnologias, governos, prédios, colônias e vertentes da época');
function genWorld() {
  $('#s-load').hidden = false; $('#s-card').innerHTML = '';
  setTimeout(() => {
    const seed = parseInt($('#s-seed').value, 10) || 1; newGame(seed, +$('#s-era').value || START_YEAR); terrRGB = null; R.view = -1; R.mode = 'pol'; R.sel = null; R.selArmies = []; R.selFleet = null;
    rebuildMap(); fitCam(); $('#s-load').hidden = true; setupCard(null); drawModes($('#s-modes'));
  }, 30);
}
function setupCard(id) {
  const c = $('#s-card'); c.innerHTML = '';
  if (id == null) { c.append(el('h3', 'gold', 'Escolha uma nação no mapa')); return; }
  const n = nat(id); UI.pick = id;
  c.append(flagEl(n.flag, 'big-flag'), el('h2', '', natName(n)));
  const cont = WD.conts[n.home];
  c.append(kv([['Ano', curYear() + ' · ' + eraOf(curYear())], ['Governo', GOVS[n.gov].n, govTip(n.gov)], ['Ideologia', IDEOS[n.ideo].n, modLines(IDEOS[n.ideo].m).join('\n')], ['Governante', titleOf(n) + ' ' + charName(n.ruler)], ['Continente', cont.n + (cont.main ? ' (principal)' : '')], ['Províncias', provsOf(id).length], ['População', popStr(n.popT || 0)], ['Tecnologias', techCount(n)]]));
  const vo = vertStartOpts(n);
  if (n.vert || vo.length) {
    const vb = el('div', 'card'); vb.append(el('h4', '', 'Vertente: ' + (n.vert ? VERT[n.vert].e + ' ' + VERT[n.vert].n : 'nenhuma')));
    if (n.vert) vb.append(tip(el('small', 'dim', 'Tropas: ' + ['inf', 'cav', 'art'].map(t => unitName(n, t)).join(', ')), techTip(n, TECH['v_' + n.vert])));
    const sel = el('select'); sel.append(new Option('Nenhuma (árvore normal)', '')); vo.forEach(v => sel.append(new Option(v.e + ' ' + v.n + ' (desde ' + v.entry.y + ')', v.id))); sel.value = n.vert || '';
    sel.onchange = () => { setVertStart(n, sel.value || null); econAll(); calcMods(n); setupCard(id); };
    vb.append(tip(sel, 'Desfaça ou troque a vertente antes de começar. Só aparecem as que já existem no ano de início e cujo recurso o país tem.'));
    if (n.vert) vb.append(btn('↩ Desfazer vertente', () => { setVertStart(n, null); econAll(); calcMods(n); setupCard(id); }, 'sm', '', 'Volta para a árvore normal de tecnologia; os prédios da vertente somem'));
    c.append(vb);
  }
  c.append(btn('Jogar com esta nação ▶', () => { S.player = id; startPlay(true); }, 'grn'));
}
function startPlay(fresh) {
  show('game'); terrRGB = null; R.view = S.player; R.mode = 'pol'; S.mapDirty = true; rebuildMap();
  const cap = WD.provs[me().capital]; R.cam.z = 3; R.cam.x = cap.cx * K - innerWidth / 2 / R.cam.z; R.cam.y = cap.cy * K - innerHeight / 2 / R.cam.z; clampCam();
  UI.speed = 0; UI.side = null; UI.ended = false; UI.seenLog = S.log.length; closeWin(); drawModes($('#modes'), true); drawTop(); drawOutl(); drawSide(); drawChron();
  if (fresh) { log('Você governa ' + natName(me()) + '. Escolha uma pesquisa e aperte ▶.', 'good', [S.player]); saveGame(); }
}

/* ---------- modos de mapa ---------- */
const MODEBTN = [['pol', '🗺️', 'Político'], ['ter', '⛰️', 'Terreno'], ['dip', '🤝', 'Diplomático'], ['pop', '👥', 'População'], ['reg', '🧩', 'Regiões e estados'], ['cont', '🌍', 'Continentes'], ['res', '⛏️', 'Recursos'], ['cul', '🎭', 'Culturas'], ['rel', '🙏', 'Religiões'], ['plague', '☠️', 'Doenças'], ['svc:health', '🏥', 'Saúde'], ['svc:edu', '📚', 'Educação'], ['svc:adm', '🏛️', 'Administração pública'], ['svc:sec', '🛡️', 'Segurança']];
const MODE_GROUPS = [['svc', '🏥', 'Serviços públicos', ['svc:health', 'svc:edu', 'svc:adm', 'svc:sec']]];
function drawModes(box, game) {
  box.innerHTML = ''; box.classList.toggle('grid', !!game); const setM = m => { R.mode = m; S.mapDirty = true; UI.modeGrp = null; drawModes(box, game); if (game) { if (m === 'res') select('res'); else if (UI.side && UI.side.kind === 'res') select(null); } };
  const grouped = new Set(MODE_GROUPS.flatMap(g => g[3]));
  MODEBTN.filter(([m]) => !grouped.has(m)).forEach(([m, e, t]) => box.append(btn(e, () => setM(m), R.mode === m ? 'on' : '', '', t)));
  MODE_GROUPS.forEach(([id, e, t, ms]) => { const on = ms.includes(R.mode), b = btn(e + '▾', () => { UI.modeGrp = UI.modeGrp === id ? null : id; drawModes(box, game); }, on ? 'on' : '', '', t); box.append(b);
    if (UI.modeGrp === id) { const pop = el('div', 'mpop'); ms.forEach(m => { const d = MODEBTN.find(x => x[0] === m); pop.append(btn(d[1] + ' ' + d[2], () => setM(m), R.mode === m ? 'on' : '')); }); box.append(pop); } });
}

/* ---------- barra do topo ---------- */
function drawTop() {
  const t = $('#top'), n = me(); t.innerHTML = '';
  const f = flagEl(n.flag, 'flag'); tip(f, 'Bandeira: clique para editar (💰' + flagCost() + ')'); f.onclick = () => openWin('flag'); t.append(f);
  const nm = el('div', 'nname'); nm.append(el('b', '', natName(n)), el('small', '', titleOf(n) + ' ' + charName(n.ruler))); tip(nm, GOVS[n.gov].n + ' · ' + IDEOS[n.ideo].n + (n.senior != null ? '\n' + (n.subj ? SUBJECTS[n.subj.tier].n : 'Súdito') + ' de ' + natName(nat(n.senior)) : '')); t.append(nm);
  const res = (v, s, tt, cls = '', sc = '', click) => { const d = el('div', 'res'); tip(d, tt); d.append(el('b', cls, v), el('small', sc, s)); if (click) { d.style.cursor = 'pointer'; d.onclick = click; } t.append(d); };
  const lab = { tax: 'Impostos', trade: 'Exportações', imports: 'Importações', transport: 'Frete entre estados', tribute: 'Tributo', rep: 'Reparações', plunder: 'Pilhagem', army: 'Exército', navy: 'Marinha', admin: 'Administração', svc: 'Serviços públicos', interest: 'Juros', corrupt: 'Corrupção' };
  res('💰 ' + money(n.money), (n.income >= 0 ? '+' : '−') + money(Math.abs(n.income)) + '/mês', 'Tesouro\n' + Object.entries(n.inc).filter(([, v]) => Math.abs(v) >= .5).map(([k, v]) => lab[k] + ': ' + money(v)).join('\n') + (n.money > 2000 ? '\nAcima de 2.000, 1% ao mês se perde em corrupção' : ''), n.money < 0 ? 'bad' : '', n.income >= 0 ? 'incg' : 'incb');
  const np = statesOf(n), cap = domCap(n); res('🏰 ' + np + (cap < 1e8 ? '/' + cap : ''), 'domínio', 'Limite de domínio (Domain Limit)\nTítulo: ' + RANK_N[n.rank || 0] + ' (' + titleOf(n) + ')\nEstados controlados, inteiros ou não: ' + np + ' de ' + (cap < 1e8 ? cap : 'sem limite') + '\nAcima do limite: −3 de estabilidade por estado, sem colonizar e sem anexar além disso na paz.\nProclame um título maior na janela de Governo.', np > cap ? 'bad' : np > cap * .85 ? 'gold' : '');
  res('👥 ' + popStr(n.popT || 0), 'população', 'Contingente: ' + Math.floor(n.manpower) + 'k de ' + Math.floor(n.mpMax || 0) + 'k (homens livres para recrutar; 1k por regimento, teto de 3% da população livre)\nPopulação: ' + popStr(n.popT || 0) + ' · empregados: ' + popStr(n.employed || 0) + '\n' + CLASS_IDS.map(k => CLASSES[k].e + ' ' + CLASSES[k].n + ': ' + popStr((n.cls || {})[k] || 0) + ' · satisfação ' + pct(((n.csat || {})[k] ?? 1))).join('\n') + '\nComida: ' + pct(n.foodSat || 1) + (n.foodSat < .95 ? ' — fome: a população encolhe' : '') + '\nCrescimento ' + sgn(n.m.growth || 0) + ' (saúde, leis e tecnologia)\nClique para abrir a janela de População', '', '', () => openWin('pop'));
  res('⚖️ ' + Math.round(n.stab), 'estabilidade', 'Estabilidade (0–100): anda até 2 pontos por mês rumo ao alvo.\nMais alta: mais impostos, pesquisa e menos golpes e revoltas.\nAlvo agora: ' + Math.round(stabParts(n).reduce((a, x) => a + x[1], 0)) + '\n' + stabParts(n).map(([k, v]) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + ' ' + k).join('\n'), n.stab < 30 ? 'bad' : n.stab > 70 ? 'good' : '');
  if ((n.press || 0) >= 1) res('🗡️ ' + Math.round(n.press) + '%', 'pressão', 'Pressão do conselho: sobe enquanto exigências dos conselheiros não são atendidas.\nEm 100% o conselheiro mais exigente dá um golpe e impõe o que quer.\nVeja e atenda as exigências na janela de Governo.', n.press > 70 ? 'bad' : n.press > 40 ? 'gold' : '', '', () => openWin('gov'));
  const reb = Object.values(S.rebels || {}).filter(r => r.o === n.id).length; if (reb) res('🏴 ' + reb, 'rebeldes', 'Províncias suas nas mãos de rebeldes: não produzem e tiram estabilidade.\nMande tropas: elas cercam a província para retomá-la.\nSe os rebeldes tomarem 30% do país, impõem o que querem.', 'bad');
  const tr = n.res ? TECH[n.res] : null; res('🔬 ' + (tr ? Math.floor(n.rp / techCost(n, tr) * 100) + '%' : '—'), tr ? tr.n : 'sem pesquisa', tr ? techTip(n, tr) + '\n+' + researchRate(n).toFixed(1) + ' por mês' : 'Escolha uma pesquisa na Tecnologia', tr ? '' : 'bad');
  const w = warsOf(n.id); res('⚔️ ' + w.length, w.length ? 'em guerra' : 'em paz', w.length ? 'Contra ' + enemiesOf(n.id).map(e => nat(e).name).join(', ') : 'Nenhuma guerra', w.length ? 'bad' : '');
  drawNav();
  t.append(el('span', 'grow'));
  const sp = el('div', 'speed'); [0, 1, 2, 3, 4, 5].forEach(k => sp.append(btn(k ? '▶'.repeat(Math.min(k, 3)) + (k > 3 ? k : '') : '⏸', () => setSpeed(k), UI.speed === k ? 'on' : '', '', k ? 'Velocidade ' + k + ' (tecla ' + k + ')' : 'Pausar (espaço)'))); t.append(sp);
  t.append(tip(el('div', 'date', dateStr()), eraOf(curYear()) + '\nCada mês: economia, pesquisa, obras e política. Cada dia: movimento e batalhas.'));
  t.append(btn('☰', () => gameMenu(), '', '', 'Menu: salvar, sair e controles'));
}
function drawNav() {                                          // coluna de botões quadrados à esquerda
  const nv = $('#lnav'), n = me(); nv.innerHTML = '';
  [['🏛️', 'gov', 'Governo', 'Governante, conselho e suas exigências, forma de governo, ideologia e leis sociais'], ['💰', 'eco', 'Economia', 'Balanço, bens (produção, consumo, preços) e leis econômicas'], ['👥', 'pop', 'População', 'Classes sociais e suas necessidades, empregos e culturas'], ['🙏', 'faith', 'Fé', 'Fé oficial, fervor, chefe religioso, guerra santa e as religiões do povo'], ['🔬', 'tech', 'Tecnologia', 'Árvore de pesquisa e vertentes'], ['⚔️', 'mil', 'Militar', 'Recrutamento, exércitos, generais, exploradores e marinha'], ['🤝', 'dip', 'Diplomacia', 'Países conhecidos e relações'], ['🏗️', 'build', 'Construção', 'Prédios de todos os estados e canteiros de obra'], ...(curYear() >= 2040 || hasT(n, 'spc_rockets') ? [['🚀', 'space', 'Espaço', 'Satélites, missões à lua e civilizações alienígenas']] : [])]
    .forEach(([e, id, tt, d]) => { const b = btn('', () => UI.win === id ? closeWin() : openWin(id), 'sq' + (UI.win === id ? ' on' : ''), '', tt + '\n' + d); b.append(el('span', 'ic', e), el('small', '', tt)); nv.append(b); });
}
function setSpeed(k) { UI.speed = k; if (k) UI.last = k; drawTop(); }
function gameMenu() {
  modal(m => {
    m.append(el('h2', '', 'Grand Chronicle'));
    m.append(btn('💾 Salvar', () => { say(saveGame() ? 'Jogo salvo.' : 'Não foi possível salvar.', 'good'); closeModal(); }));
    m.append(btn('🚪 Salvar e sair para o menu', () => { saveGame(); closeModal(); S = null; menu(); }));
    m.append(btn('🔧 Recalcular (debug)', () => { const r = repairGame(true); closeModal(); refresh(); say('Recalculado: ' + r.fixed + ' valor' + (r.fixed === 1 ? '' : 'es') + ' inválido' + (r.fixed === 1 ? '' : 's') + ' corrigido' + (r.fixed === 1 ? '' : 's') + ', ' + r.merged + ' exércitos da IA juntados.', 'good'); }, '', '', 'Refaz os cálculos: corrige números inválidos (−NaN/mês), refaz a economia e os modificadores, junta exércitos pequenos da IA parados no mesmo lugar e replaneja as marchas dela.'));
    m.append(el('p', 'dim', 'Mapa: arraste com o botão esquerdo para selecionar tropas · botão direito move as tropas ou abre ações com o país · WASD ou arrastar com o botão direito move a câmera · roda dá zoom · espaço pausa.'));
    m.append(btn('Voltar', closeModal));
  });
}

/* ---------- crônica (pop-up no canto inferior direito) ---------- */
function drawChron() {
  const unread = S.log.length - UI.seenLog, cb = $('#chronbar'); cb.textContent = '📜 Crônicas' + (unread > 0 && !UI.chron ? ' · ' + Math.min(99, unread) + ' novas' : '') + (UI.chron ? '  ▼' : '  ▲'); cb.classList.toggle('new', unread > 0 && !UI.chron);
  const c = $('#chron'); c.hidden = !UI.chron || UI.scr !== 'game'; if (c.hidden) return;
  UI.seenLog = S.log.length; c.innerHTML = '';
  const h = el('header'); h.append(el('b', '', ''), btn(UI.chronAll ? 'Só importantes' : 'Mostrar tudo', () => { UI.chronAll = !UI.chronAll; drawChron(); }, 'sm', '', 'Inclui sucessões e acordos entre outros países')); c.append(h);
  const list = el('div', 'clist'); S.log.filter(l => UI.chronAll || l.k !== 'none').slice(0, 60).forEach(l => { const r = el('div', 'cl ' + l.k); r.append(el('small', '', l.d), el('span', '', l.m)); list.append(r); }); c.append(list);
}

/* ---------- painel lateral ---------- */
function select(kind, id) { UI.side = kind ? { kind, id } : null; R.sel = kind === 'prov' ? id : null; R.selArmies = kind === 'army' ? S.armies.filter(a => a.id === id) : kind === 'armies' ? S.armies.filter(a => id.includes(a.id)) : []; R.selFleet = kind === 'fleet' ? S.fleets.find(f => f.id === id) : null; drawSide(); }
function drawSide() {
  const sd = $('#side'), keep = sd.scrollTop; sd.innerHTML = ''; const s = UI.side;
  if (!s) { sd.hidden = true; $('#side2').hidden = true; return; } sd.hidden = false;
  const close = btn('✕', () => select(null), 'x sm'); close.style.float = 'right'; sd.append(close);
  if (s.kind === 'prov') sideProv(sd, s.id); else if (s.kind === 'nat') sideNat(sd, s.id); else if (s.kind === 'army') sideArmy(sd, s.id); else if (s.kind === 'armies') sideArmies(sd, s.id); else if (s.kind === 'fleet') sideFleet(sd, s.id); else if (s.kind === 'res') { sd.append(el('h2', '', '⛏️ Recursos por estado')); resList(sd, true); }
  sd.scrollTop = keep;
  const s2 = $('#side2'), st = s.kind === 'prov' ? WD.provs[s.id].state : null;
  if (st == null || UI.prodOpen !== st) { s2.hidden = true; return; }
  const k2 = s2.scrollTop; s2.innerHTML = ''; s2.hidden = false; const cx = btn('✕', () => { UI.prodOpen = null; drawSide(); }, 'x sm'); cx.style.float = 'right';
  s2.append(cx, el('h2', '', '🏭 ' + WD.states[st].n), buildingRows(me(), WD.states[st], PROD_G)); s2.scrollTop = k2;
}
const refresh = () => { drawSide(); drawTop(); drawOutl(); if (UI.win && !busy($('#win'))) drawWin(); };
function sideProv(sd, p) {
  const pr = WD.provs[p], st = WD.states[pr.state], rg = WD.regions[pr.region], ct = WD.conts[pr.cont], n = me(), o = S.own[p], c = S.ctrl[p];
  const h = el('div', 'side-h'); if (o >= 0) { const f = flagEl(nat(o).flag, 'fl'); tip(f, 'Ver ' + natName(nat(o))); f.onclick = () => select('nat', o); h.append(f); }
  const tt = el('div'); tt.append(el('h2', '', pr.n), el('small', 'dim', st.n + ' · ' + rg.n + ' · ' + ct.n)); h.append(tt); sd.append(h);
  if (!n.exP[p]) { sd.append(el('p', 'dim', 'Terra inexplorada.')); return; }
  const T = TERRAIN[pr.terr];
  const RU = { farm: 'Fazendas', fiber: 'Plantações', wood: 'Madeireiras', stone: 'Pedreiras', fish: 'Pesqueiros' }, MU = { iron: 'Mina de ferro', coal: 'Mina de carvão', gold: 'Mina de ouro', copper: 'Mina de cobre', oil: 'Poço de petróleo', uranium: 'Mina de urânio', rare: 'Mina de terras raras' };
  const resTxt = [...(resVisible(p) ? [GOODS[provRes(p)].e + ' ' + GOODS[provRes(p)].n] : []), ...natRes(p).map(k => NATRES[k][0] + ' ' + NATRES[k][1])].join(' · ') || '—';
  const resTip = [...(resVisible(p) ? [GOODS[provRes(p)].n + ': permite ' + MU[provRes(p)] + ' no estado (3 níveis por jazida)'] : []), ...natRes(p).map(k => NATRES[k][1] + ': permite ' + RU[k] + ' no estado')].join('\n') || 'Sem recursos';
  const tile = (ic, lb, v, t) => { const d = el('div', 'ptile'); d.append(el('small', '', ic + ' ' + lb), el('b', '', v)); return tip(d, t); };
  const pg = el('div', 'pinfo');
  pg.append(tile('👑', c !== o && c >= 0 ? 'Dono · ocupada' : 'Dono', o >= 0 ? nat(o).name + (c !== o && c >= 0 ? ' → ' + nat(c).name : '') : 'Nativos', o >= 0 ? natName(nat(o)) + (c !== o && c >= 0 ? '\nOcupada por ' + natName(nat(c)) : '') : 'Terra sem dono'),
    tile('⛰️', 'Terreno', T.n + (pr.coast ? ' · litoral' : ''), T.n + '\nMovimento ×' + T.move + '\nDefesa +' + Math.round(T.def * 100) + '%\nComida ×' + T.food + '\nLargura de combate ×' + T.width),
    tile('⛏️', 'Recursos', resTxt, resTip + '\nPetróleo, urânio e terras raras ficam ocultos até prospectar.'),
    tile('👥', 'População', popStr(S.pop[p]), 'Gente que vive nesta província'),
    tile('🏰', 'Fortificação', (fortOf(p) || '—') + '', 'Cada nível deixa o cerco bem mais lento.\nVem do castelo na capital do estado e da capital do país.'));
  sd.append(pg);
  const msg = el('div', 'msg'), act = fn => () => { const e = fn(); msg.textContent = e || ''; if (!e) refresh(); };
  if (o >= 0 && nat(o).capital === p) sd.append(tip(el('div', 'gold', '⭐ Capital de ' + nat(o).name), 'Fortificação +2. Se cair: −2 de estabilidade por mês e +25% de rendição.'));
  else if (o === n.id && c === n.id) sd.append(btn('⭐ Tornar capital (💰' + capCost() + ')', act(() => setCapital(n, p)), 'sm', n.capCd > S.t ? 'Só a cada 10 anos (até ' + yearOf(n.capCd) + ')' : S.ctrl[n.capital] !== n.id ? 'A capital atual está ocupada' : n.money < capCost() ? 'Sem dinheiro' : '', 'Muda a capital para cá: −5 de estabilidade; uma vez a cada 10 anos'));
  if (o === -1) {
    const col = S.cols.find(x => x.p === p);
    if (col) sd.append(sec('Colonização', el('div', '', natName(nat(col.o)) + ' · faltam ' + col.m + ' meses'), bar(1 - col.m / col.tot)));
    else sd.append(sec('Colonização', btn('Colonizar (💰' + colCost(n, p) + ')', act(() => colonize(n, p)), 'grn', canColonize(n, p), 'Envia colonos; vira sua província em alguns meses.'), msg));
    return;
  }
  if (o === n.id && c === n.id) {
    const r = el('div', 'rgrid'); UT.filter(t => t !== 'vrt' || n.vert).forEach(t => { const b0 = btn('', act(() => recruit(n, t, 1, p)), 'rbtn r-' + t, canRecruit(n, t, 1), unitTip(n, t)); b0.append(el('span', 'ue', unitE(n, t)), el('b', '', unitName(n, t)), el('small', '', '1k · 💰' + recCost(n, t))); r.append(b0); });
    const r5 = el('div', 'row'); r5.append(btn('🗡️ 5× ' + unitName(n, 'inf') + ' (💰' + recCost(n, 'inf', 5) + ')', act(() => recruit(n, 'inf', 5, p)), 'sm', canRecruit(n, 'inf', 5)));
    if (pr.coast) r5.append(btn('⛵ ' + shipName(n) + ' ×2 (💰' + shipCost(n) * 2 + ')', act(() => buildShips(n, 2, p)), 'sm', !n.fx.sea ? 'Exige Barcos longos' : n.money < shipCost(n) * 2 ? 'Sem dinheiro' : '', 'Navios ficam prontos em 4 meses no mar ao lado.'));
    sd.append(sec('Recrutar', r, r5, msg));
  } else if (o !== n.id) {
    const has0 = n.claims[st.id], fab = n.fab && n.fab.s === st.id;
    sd.append(sec('Reivindicação', has0 ? el('div', 'good', 'Você reivindica ' + st.n + '.') : fab ? el('div', 'dim', 'Fabricando… ' + n.fab.m + ' meses') : btn('Fabricar reivindicação em ' + st.n + ' (💰' + Math.round(40 * eraScale()) + ')', act(() => fabricate(n, st.id)), 'sm', n.fab ? 'Já fabricando' : '', 'Com reivindicação, declarar guerra custa só 3 de estabilidade (sem: 15).'), msg));
  }
  sideState(sd, st);
}
function unitTip(n, t) {
  const f = k => (unitStat(n, t, k) * (['fire', 'shock', 'def'].includes(k) ? n.up[t] : 1)).toFixed(2), nd = unitNeeds(n, t);
  return unitName(n, t) + '\nFogo ' + f('fire') + ' · choque ' + f('shock') + ' · defesa ' + f('def') + '\nMoral ' + f('mor') + ' · letalidade ' + f('kill') + ' · movimento ' + f('spd')
    + (UNIT_BASE[t].back ? '\nLuta da segunda linha (metade do dano) quando a primeira está cheia' : '') + '\nConsome por regimento/mês: ' + Object.keys(nd).map(g => GOODS[g].e + ' ' + GOODS[g].n.toLowerCase() + ' ' + nd[g]).join(', ')
    + '\nCusto 💰' + recCost(n, t) + ' · 1k de contingente' + (t === 'art' ? '\nAcelera cercos' : '');
}
const PROD_G = ['prod', 'ind', 'energy', 'vert'];              // grupos que ficam no painel lateral de produção
function buildingRows(n, st, groupsOnly) {                   // prédios do estado divididos em grupos, com − e + (groupsOnly: só esses grupos)
  const so = stateOwnerOf(st.id), B = S.bld[st.id], wrap = el('div'), groups = {};
  Object.keys(BUILDINGS).forEach(b => {
    const d = BUILDINGS[b], L = B[b] || 0, inCons = n.cons.filter(c => c.s === st.id && c.b === b);
    if (so !== n.id && !L) return;
    const avail = d.vert ? n.vert === d.vert : n.fx.b.has(b); if (!L && !avail) return;
    const err = so === n.id ? canBuild(n, st.id, b) : 'Não é seu';
    if (!L && !inCons.length && err && err !== 'Sem dinheiro' && err !== 'Sem canteiros livres' && err !== 'Sem trabalhadores livres no estado') return;
    const r = el('div', 'brow'); tip(r, bTip(b)); r.append(el('span', 'e', d.e), el('span', 'nm', d.n + (inCons.length ? ' (+' + inCons.length + ' em obra)' : '')), el('span', 'lv', L || '—'));
    if (so === n.id) { if (L) r.append(btn('−', () => { S.bld[st.id][b] = L - 1; if (!S.bld[st.id][b]) delete S.bld[st.id][b]; const f = d.fx; if (f && (f.infra || f.pipe)) S.mapDirty = true; refresh(); }, 'sm', '', 'Desmontar um nível (sem reembolso): libera trabalhadores')); r.append(btn('+ 💰' + bCost(n, b), () => { const e = build(n, st.id, b); if (e) say(e, 'bad'); refresh(); }, 'sm', err, bTip(b))); }
    const g = bGroupOf(b); (groups[g] = groups[g] || []).push(r);
  });
  BGROUPS.forEach(([g, name]) => { if (!groups[g] || (groupsOnly ? !groupsOnly.includes(g) : PROD_G.includes(g))) return; wrap.append(el('h4', 'bgrp', name)); groups[g].forEach(r => wrap.append(r)); });
  return wrap;
}
function sideState(sd, st) {
  const n = me(), so = stateOwnerOf(st.id), B = S.bld[st.id], box = sec('Estado: ' + st.n);
  let sp = 0; st.provs.forEach(p => { if (S.own[p] === so) sp += S.pop[p]; });
  box.append(kv([['Capital', WD.provs[st.cap].n], ['Infraestrutura', so >= 0 ? natName(nat(so)) : '—', 'Quem controla a capital do estado controla e constrói os prédios.'], ['População', popStr(sp)], ['Províncias', st.provs.length]]));
  const si = S.stInfo && S.stInfo[st.id]; if (so === n.id && si) box.append(tip(el('div', 'dim', '🚚 Insumos do próprio estado: ' + pct(si.loc) + (si.cost >= .5 ? ' · frete 💰' + money(si.cost) + '/mês' : '')), 'Fábricas usam primeiro o que o estado produz: barato e na hora.\nO que falta vem de outros estados (perde até 25% no caminho e paga frete) ou é importado de outros países, pela distância e por mar ou terra.\nEstradas e ferrovias no estado reduzem perdas e frete.'));
  const pc = BGROUPS.filter(([g]) => PROD_G.includes(g)).map(([, , l]) => l).flat().reduce((t, b) => t + (B[b] || 0), 0), open = UI.prodOpen === st.id;
  box.append(btn('🏭 Produção e indústria' + (pc ? ' · ' + pc + ' níveis' : '') + (open ? '  ◀' : '  ▶'), () => { UI.prodOpen = open ? null : st.id; drawSide(); }, 'prodbtn' + (open ? ' on' : ''), '', 'Produção e extração, indústria e energia do estado, num painel ao lado'));
  box.append(buildingRows(n, st));
  if (so >= 0 && S.scov && S.scov[st.id]) { const cvb = el('div', 'svcs'); for (const k in SVC) { const v = S.scov[st.id][k] || 0, r = el('div', 'brow'); r.append(el('span', 'e', SVC[k].e), el('span', 'nm', SVC[k].n), el('span', 'lv', pct(v))); tip(r, SVC[k].n + ' · ' + svcName(k, curYear()) + '\n' + SVC[k].d + '\nCada nível atende ' + Math.round(SVC_CAP(curYear())) + ' mil pessoas'); cvb.append(r, bar(v, '#7fc8e0')); } box.append(el('h3', '', 'Serviços'), cvb); }
  const deps = st.provs.filter(p => resVisible(p)).map(p => GOODS[provRes(p)].e + ' ' + GOODS[provRes(p)].n + ' (' + WD.provs[p].n + ')'); if (deps.length) box.append(tip(el('div', 'dim', 'Jazidas: ' + deps.join(', ')), 'Petróleo, urânio e terras raras só aparecem depois de prospectar'));
  if (so === n.id) box.append(btn('🔍 Prospectar (💰' + prospectCost() + ')', () => { const e = prospect(n, st.id); if (e) say(e, 'bad'); refresh(); }, 'sm', canProspect(n, st.id), 'Procura petróleo, urânio e terras raras (conforme suas tecnologias) por 6 meses; às vezes acha jazidas novas'));
  if ((n.pros || []).some(x => x.s === st.id)) box.append(el('div', 'dim', 'Prospecção em andamento…'));
  if (so === n.id) n.cons.filter(c => c.s === st.id).forEach(c => { box.append(el('div', 'dim', BUILDINGS[c.b].n + ' · ' + c.m + ' meses')); box.append(bar(1 - c.m / c.tot)); });
  sd.append(box);
}
function dipStatus(n, o) {
  const s = []; if (has(n, 'allies', o.id)) s.push('🤝 Aliado'); if (has(n, 'marr', o.id)) s.push('💍 Casamento real'); if (has(n, 'trade', o.id)) s.push('⚖️ Acordo comercial');
  if (has(n, 'emb', o.id)) s.push('🚫 Você embarga'); if (has(o, 'emb', n.id)) s.push('🚫 Embarga você'); if (o.senior === n.id) s.push((o.subj ? SUBJECTS[o.subj.tier].e + ' Seu ' + SUBJECTS[o.subj.tier].n.toLowerCase() : '👑 Seu súdito') + ' · liberdade ' + Math.round(o.subj ? o.subj.lib : 0) + '%'); if (n.senior === o.id) s.push('👑 Seu suserano');
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
  if (t.senior === n.id) box.append(btn('👑 Súdito: liberdade ' + Math.round(t.subj ? t.subj.lib : 0) + '%', () => { UI.dipTab = 'subj'; openWin('dip'); }, 'sm grn', '', 'Leis, nível e integração na aba Súditos da diplomacia'));
  out.append(box);
  const w = S.wars.find(w => sideOf(w, t.id) && sideOf(w, n.id) && sideOf(w, t.id) !== sideOf(w, n.id));
  if (w) out.append(btn('🕊️ Negociar paz', () => { UI.peaceL = t.id; UI.peacePick = null; openWin('peace', w.id); }, 'sm grn'));
  else {
    const claims = WD.states.filter(s => n.claims[s.id] && s.provs.some(p => S.own[p] === t.id));
    const sel = el('select'); sel.append(new Option('Sem reivindicação (−15 estabilidade)', '')); claims.forEach(s => sel.append(new Option('Reivindicação: ' + s.n, s.id)));
    const allies = (t.allies || []).map(nat).filter(x => x.alive).map(x => x.name);
    if (!holyWhy(n, t)) sel.append(new Option('⚔️ ' + holyName(n.relig) + ' (−3 estabilidade)', 'holy'));
    out.append(sel, btn('⚔️ Declarar guerra', () => { const e = sel.value === 'holy' ? declareWar(n, t, null, 'holy') : declareWar(n, t, sel.value === '' ? null : +sel.value); msg.textContent = e; if (!e) { S.mapDirty = true; refresh(); } }, 'red', n.truce[t.id] > S.t ? 'Trégua até ' + yearOf(n.truce[t.id]) : has(n, 'allies', t.id) ? 'São aliados' : '', allies.length ? 'Aliados deles podem entrar: ' + allies.join(', ') : 'Eles não têm aliados'));
  }
  out.append(msg); return out;
}
const VET_COL = ['#9a9a9a', '#cfcfcf', '#7fb3d5', '#b48be0', '#e8c25a'];
const vetTip = a => { const v = vetOf(a), k = vetLv(a), nx = VET[k + 1]; return 'Veterania: ' + v.n + '\nDano e defesa ×' + v.m + ' · moral ×' + v.mo + '\n' + (nx ? 'Próximo nível (' + nx.n + ') com ' + pct(nx.x) + ' de experiência; agora ' + pct(a.xp || 0) : 'Nível máximo') + '\nSobe lutando (e, em paz, treinando até ' + VET[2].n + '). Reforços e recrutas diluem.'; };
function battleBox(sd, p) {                                    // painel da batalha em andamento
  const bt = S.battles[p]; if (!bt) return;
  const c = el('div', 'card'); c.append(el('h4', '', '⚔️ Batalha · dia ' + bt.d + ' · fase de ' + (bt.ph === 'fire' ? 'fogo' : 'choque')));
  c.append(tip(el('div', 'dim', 'Dados: ' + (bt.ra ?? 0) + ' × ' + (bt.rb ?? 0) + ' · com bônus: ' + (+(bt.pa ?? 0)).toFixed(1) + ' × ' + (+(bt.pb ?? 0)).toFixed(1) + ' · largura ' + (bt.Wa || '?') + '/' + (bt.Wb || '?')),
    'Um dado (0–9) por lado a cada 3 dias; as fases de fogo e choque se alternam.\nBônus: general melhor (+1 a cada 4 de marcial de diferença), reconhecimento, terreno contra quem ataca (engenheiros reduzem), desembarque (−2).\nLargura: quantos regimentos lutam na primeira linha; o resto espera. Artilharia atira da segunda linha com metade do dano.'));
  sd.append(c);
}
const UNIT_E = { inf: '🗡️', cav: '🐎', art: '💣' };
const unitE = (n, t) => t === 'vrt' ? (n.vert ? VERT[n.vert].e : '✨') : UNIT_E[t];
/* abastecimento do exército: bens atendidos (pelos tipos de tropa dele) e linha de suprimento */
function armySupply(a) { const n = nat(a.o), r = Math.max(.01, regs(a)), g = n.tsat ? UT.reduce((s, t) => s + a[t] * (n.tsat[t] ?? 1), 0) / r : 1; return g * (a.p >= WD.provs.length || inSupply(a) ? 1 : .5); }
const barRow = (label, v, col, tt) => { const d = el('div', 'abar'); d.append(el('span', 'abl', label), bar(clamp(v, 0, 1), col)); return tip(d, tt); };
function sideArmy(sd, id) {
  const a = S.armies.find(a => a.id === id); if (!a) { select(null); return; } const n = nat(a.o), P = WD.provs.length, mine = a.o === S.player;
  const h = el('div', 'side-h'); h.append(flagEl(n.flag, 'fl')); const tt = el('div'); tt.append(el('h2', '', 'Exército · ' + fmtK(regs(a))), el('small', 'dim', a.p < P ? WD.provs[a.p].n : WD.seas[a.p - P].n + ' (embarcado)')); h.append(tt); sd.append(h);
  // tropas: um cartão por tipo
  const tg = el('div', 'utiles'); UT.forEach(t => { if (a[t] <= .05) return; const c = el('div', 'utile'); c.append(el('span', 'ue', unitE(n, t)), el('b', '', fmtK(a[t])), el('small', '', unitName(n, t)), el('small', 'dim', pct(a[t] / Math.max(.01, regs(a))))); tg.append(tip(c, unitTip(n, t))); });
  sd.append(tg);
  // estado: moral, abastecimento, treino e cansaço
  const v = vetLv(a), sup = armySupply(a), [x, why] = a.p < P ? attritionOf(a) : [0, []];
  sd.append(sec('Estado',
    barRow('Moral ' + pct(a.mor), a.mor, '#7fe08a', 'Cai em batalha; quem chega a zero recua.\nRecupera fora de combate: mais rápido em casa, devagar se cansado, quase nada sem suprimento (teto de 60%).'),
    barRow('📦 Abastecimento ' + pct(sup), sup, sup < .7 ? '#e5636b' : '#e8c25a', 'Bens que as tropas deste exército consomem (armas, comida, cavalos...) e a linha de suprimento (fora dela, só metade chega).\nAbaixo de 100%: menos dano em batalha.' + (a.p < P ? '\nSuprimento da província: ' + Math.round(provSupply(a.p, a.o)) + 'k · atrito ' + (x * 100).toFixed(1) + '%/mês' + (why.length ? ' (' + why.join(', ') + ')' : '') + '\nLinha de suprimento: até ' + logiRange(n) + ' províncias de território amigo.' : '')),
    barRow('🎖️ ' + VET[v].n + ' ' + pct(a.xp || 0), Math.min(1, (a.xp || 0) / .9), VET_COL[v], vetTip(a)),
    barRow('Cansaço ' + pct(a.fat || 0), a.fat || 0, '#e5a35b', 'Marchar e lutar cansam (terreno difícil cansa mais).\nCansaço tira até 35% do dano e deixa a moral voltar mais devagar. Passa descansando com suprimento.')));
  if (a.p < P) battleBox(sd, a.p);
  if (a.inv) sd.append(el('p', 'gold', '⚓ Invasão de ' + WD.provs[a.inv.to].n + ': ' + { go: 'indo ao porto de ' + WD.provs[a.inv.port].n, sail: 'navegando', land: 'desembarcando', back: 'voltando ao porto' }[a.inv.st]));
  // general
  const gc = el('div', 'gencard');
  if (a.gen) { const g = a.gen; gc.append(tip(el('b', 'gold', '★ ' + charName(g)), genTip(g)), el('small', 'dim', ageOf(g) + ' anos · marcial ' + g.st.mar + ' · força ' + sgn(genMul(g) - 1)), el('small', 'dim', g.tr.map(t => TRAITS[t].n).join(', '))); }
  else gc.append(tip(el('b', 'dim', 'Sem general'), 'O general melhor ganha bônus no dado da batalha (+1 a cada 4 de marcial de diferença).'));
  if (mine) gc.append(btn(a.gen ? 'Trocar (💰' + genCost() + ')' : 'Nomear (💰' + genCost() + ')', () => genPick(a), 'sm', n.money < genCost() ? 'Sem dinheiro' : '', 'Escolha entre 3 candidatos. Marcial e traços mudam a força em batalha e nos cercos.'));
  sd.append(sec('General', gc));
  if (!mine) return;
  const rs = el('div', 'row'); Object.keys(STANCES).forEach(k => { const d = STANCES[k]; rs.append(btn(d.e + ' ' + d.n, () => { setStance(a, k); drawSide(); }, 'sm' + ((a.st || 'bal') === k ? ' on' : ''), '', 'Postura: ' + d.n + '\n' + d.d + (d.beats ? '\nVence ' + STANCES[d.beats].n.toLowerCase() + ' (+15% de dano)' : ''))); });
  sd.append(sec('Postura', rs));
  const ap = el('div'), sp = Object.keys(a.sup || {}); if (sp.length) { const ch = el('div', 'chips'); sp.forEach(k => ch.append(tip(el('span', 'chip p', SUPPORT[k].e + ' ' + supName(n, k)), SUPPORT[k].d))); ap.append(ch); }
  const rsu = el('div', 'row'); Object.keys(SUPPORT).forEach(k => { if (a.sup && a.sup[k]) return; rsu.append(btn(SUPPORT[k].e + ' ' + supName(n, k) + ' (💰' + supCost(n, k) + ')', () => { const e = addSupport(n, a, k); if (e) say(e, 'bad'); drawSide(); }, 'sm', !supOk(n, k) ? 'Exige ' + TECH[SUPPORT[k].tech].n : n.money < supCost(n, k) ? 'Sem dinheiro' : '', SUPPORT[k].d + '\nManutenção 💰' + (SUPPORT[k].up * eraScale()).toFixed(1) + '/mês · consome ' + Object.keys(SUPPORT[k].need).map(g => GOODS[g].n.toLowerCase()).join(', ') + '\nCompra só em território próprio')); });
  if (rsu.children.length) ap.append(rsu); sd.append(sec('Apoio', ap));
  const tr = el('div', 'row');
  tr.append(btn(a.drill ? '🎯 Treinando' : '🎯 Treinar', () => { a.drill = !a.drill; drawSide(); }, 'sm' + (a.drill ? ' on' : ''), '', 'Em paz, parado em território próprio: +1,5% de experiência por mês até ' + VET[2].n + '.\nManutenção +50% enquanto treina.'));
  tr.append(btn(a.exp ? '🧭 Explorando' : '🧭 Explorar', () => { a.exp = !a.exp; a.path = []; drawSide(); }, 'sm' + (a.exp ? ' on' : ''), a.exp ? '' : expWhy(a), 'Modo explorador: só tropa barata (infantaria, até 5 regimentos).\nAnda sozinha até a terra incógnita mais próxima e revela o mapa; em terra de nativos perde um pouco de gente.'));
  sd.append(sec('Treino e exploração', tr));
  const fs = frontsOf(n.id); if (fs.length) { const rf = el('div', 'row'); fs.forEach(f => rf.append(btn('🚩 ' + frontName(f), () => { a.front = a.front === f.id ? null : f.id; a.path = []; drawSide(); }, 'sm' + (a.front === f.id ? ' on' : ''), '', 'Atribuir a este front (clique de novo para liberar).\nO exército segue a ordem do front: defender a linha ou avançar concentrado.')));
    sd.append(sec('Front' + (a.front != null && frontById(a.front) ? ' · ' + (fordOf(a.o, a.front) === 'adv' ? 'avançar' : 'defender') : ''), rf)); }
  const r = el('div', 'row');
  r.append(btn('Parar', () => { a.path = []; if (a.inv) cancelInvasion(a); drawSide(); }, 'sm'));
  r.append(btn('Dividir', () => { const b = splitArmy(a, .5); select('armies', [a.id, b.id]); }, 'sm', regs(a) < 1 ? 'Pequeno demais' : a.inv ? 'Em invasão' : ''));
  const here = S.armies.filter(b => b !== a && b.o === a.o && b.p === a.p);
  r.append(btn('Mesclar', () => merge([a, ...here]), 'sm', here.length ? '' : 'Nenhum outro exército aqui'));
  r.append(btn('Desmobilizar', () => { n.manpower += regs(a); UT.forEach(t => a[t] = 0); S.armies = S.armies.filter(b => regs(b) > .08); select(null); drawOutl(); }, 'sm red', a.inv ? 'Em invasão' : '', 'Os homens voltam para a reserva (contingente)'));
  sd.append(sec(a.exp ? 'Ordens · explorando' : a.path.length ? 'Ordens · marchando (' + a.path.length + ' passos)' : 'Ordens', r, el('small', 'dim', 'Botão direito no mapa move; numa costa além-mar, planeja uma invasão.')));
}
function merge(list) { const a = list[0]; list.slice(1).forEach(b => { if (b.p !== a.p || b.inv || a.inv) return; mergeInto(a, b); a.exp = false; }); S.armies = S.armies.filter(b => regs(b) > .08); select('army', a.id); }
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
  sd.append(tip(el('p', 'dim', f.auto ? 'Explorando sozinha.' : f.path.length ? 'Navegando.' : 'Botão direito num mar para navegar' + (seaExploreOk(n) ? ', até mares desconhecidos.' : '.')), seaExploreOk(n) ? 'Com Bússola, a frota navega por clique até mares desconhecidos e revela o caminho.' : 'Sem Bússola, só navega por clique em mares já conhecidos; use 🧭 Explorar para descobrir novos.'));
  const r = el('div', 'row'); r.append(btn(f.auto ? 'Parar exploração' : '🧭 Explorar', () => { f.auto = !f.auto; if (!f.auto) f.path = []; drawSide(); }, 'sm' + (f.auto ? ' on' : ''), '', 'Vai sozinha para os mares de fronteira mais próximos (desconhecidos ou com costa desconhecida) e revela o litoral'), btn('Parar', () => { f.path = []; f.auto = false; drawSide(); }, 'sm'));
  sd.append(r, tip(el('p', 'dim', 'Capacidade: ' + Math.floor(fleetCap(f)) + ' regimentos (' + shipCap(n) + ' por navio)' + (carriedRegs(f) ? ' · a bordo: ' + fmtK(carriedRegs(f)) : '')), 'Tropas de terra só cruzam um mar sozinhas (barcos locais, ' + FERRY_DAYS + ' dias) e se ele estiver livre de navios inimigos.\nMais longe que isso, é preciso uma invasão: o exército embarca nesta frota num porto, navega e desembarca. Se a frota perder no caminho, volta com o que sobrar.'));
  sd.append(tip(el('p', 'dim', n.fx.sea >= 2 ? '🌊 Navegação oceânica' : '🌊 Navegação costeira: o oceano só perto da costa'), 'Sem Caravela, a frota só entra em oceano que encosta em mar raso, e perde 2% dos navios a cada trecho de oceano em tempestades.\nCom Caravela (navegação oceânica) cruza qualquer oceano.'));
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
const WTITLE = { pop: 'População', gov: 'Governo', faith: 'Fé', eco: 'Economia', tech: 'Tecnologia', mil: 'Militar', dip: 'Diplomacia', flag: 'Bandeira', peace: 'Paz', space: 'Espaço', build: 'Construção' };
function openWin(id, arg) { UI.win = id; UI.warg = arg; $('#win').hidden = false; $('#win-t').textContent = WTITLE[id]; drawWin(); drawTop(); }
function closeWin() { UI.win = null; $('#win').hidden = true; if (S && S.player >= 0) drawTop(); }
$('#win-x').onclick = closeWin;
$('#chronbar').onclick = () => { UI.chron = !UI.chron; drawChron(); };
function drawWin() {
  if (!UI.win) return; const b = $('#win-b'), keep = b.scrollTop; b.innerHTML = '';
  ({ pop: winPop, gov: winGov, faith: winFaithW, eco: winEco, tech: winTech, mil: winMil, dip: winDip, flag: winFlag, peace: winPeace, space: winSpace, build: winBuild })[UI.win](b);
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
const tabs = (b, key, list) => { const t = el('div', 'tabs'); UI[key] = UI[key] || list[0][0]; list.forEach(([k, n]) => t.append(btn(n, () => { UI[key] = k; drawWin(); }, UI[key] === k ? 'on' : ''))); b.append(t); return UI[key]; };
const leanChip = c => {
  const box = el('div', 'chips'), d = IDEOS[c.ld];
  if (d) { const x = el('span', 'chip', '⚑ ' + d.n); x.style.borderColor = d.col; box.append(tip(x, 'Inclinação ideológica: ' + d.n + '\nPuxa o país para essa ideologia (governante pesa 3, conselheiro 1).\nConselheiro de outra ideologia exige a troca (pressão do conselho).')); }
  if (c.lg && GOVS[c.lg]) box.append(tip(el('span', 'chip', '🏛️ ' + GOVS[c.lg].n), 'Quer esta forma de governo.\nConselheiro: aumenta a pressão até ser atendido. Governante: −2 de estabilidade enquanto não for.\nSó aparece o que o país já pode adotar.'));
  if (c.ll && LAWS[c.ll.k]) box.append(tip(el('span', 'chip', '📜 ' + LAWS[c.ll.k].n + ': ' + LAWS[c.ll.k].o[c.ll.o].n), 'Quer esta lei.\nConselheiro: aumenta a pressão até ser atendido. Governante: −2 de estabilidade enquanto não for.'));
  return box.children.length ? box : null; };
function govForms(b, n, msg) {
  b.append(el('h3', 'gold', 'Forma de governo · reforma 💰' + Math.round(80 * eraScale())));
  byEraGroups(Object.keys(GOVS), govUnlockYear).forEach(([e, list]) => { b.append(el('h4', 'era', e)); const go = el('div', 'grid-opts');
    list.forEach(g => { const d = GOVS[g], why = govWhy(n, g), cd = n.govCd > S.t && n.gov !== g, ok = !why && !cd, o = el('div', 'opt' + (n.gov === g ? ' on' : '') + (ok ? '' : ' off'));
      tip(o, govTip(g) + (condTxt(govWhen(g)).length ? '\nRequisitos: ' + condTxt(govWhen(g)).join(', ') : '') + (d.until ? '\nDepois de ' + d.until + ' perde legitimidade a cada ano' + (d.next ? ' (a reforma natural é ' + GOVS[d.next].n + ')' : '') : '') + (ok ? '\nReforma: −10 de estabilidade (mesmo grupo) ou −25' : '\n⛔ ' + why));
      if (cd && !why) tip(o, o.dataset.tip + '\n⏳ Reforma recente: a próxima mudança de governo só em ' + yearOf(n.govCd));
      o.append(el('b', '', d.n), el('small', 'dim', d.cat + ' · ' + d.t + (d.term ? ' · mandato de ' + d.term + ' anos' : '') + (d.minRank ? ' · ' + RANK_N[d.minRank] : '') + (d.until ? ' · até ' + d.until : '')), modChips(Object.assign({}, d.m, { coupX: d.coup })));
      if (ok && n.gov !== g) o.onclick = () => { const e = setGov(n, g); msg.textContent = e; if (!e) refresh(); };
      go.append(o); });
    b.append(go); });
}
function lawGrid(b, n, eco, msg) {
  b.append(el('h3', 'gold', (eco ? 'Leis econômicas' : 'Leis') + ' · mudar custa 💰' + lawCost() + ' e 3 de estabilidade'));
  const lw = el('div', 'laws'); Object.entries(LAWS).filter(([, L]) => !!L.eco === eco).forEach(([k, L]) => { const row = el('div', 'lawrow'); row.append(el('b', '', L.n));
    Object.entries(L.o).forEach(([o, d]) => { const on = n.laws[k] === o, ok = lawOk(n, k, o), cd = (n.lawCd || {})[k] > S.t, op = el('div', 'opt law' + (on ? ' on' : '') + (ok ? '' : ' off'));
      op.append(el('b', '', d.n), modChips(d.m)); tip(op, d.n + '\n' + (modLines(d.m).join('\n') || 'Sem modificadores') + (d.m.coup ? '\nRisco de golpe ' + sgn(d.m.coup) : '') + (d.svc ? '\nServiços: efeito e custo ×' + d.svc : '') + (d.d ? '\n' + d.d : '') + (ok ? '' : '\n⛔ Exige ' + condFail(n, d.when).join(', ')) + (cd && !on ? '\n⛔ Mudada há pouco' : ''));
      if (!on && ok && !cd) op.onclick = () => { const e = setLaw(n, k, o); msg.textContent = e; if (!e) refresh(); }; row.append(op); });
    lw.append(row); });
  b.append(lw, msg);
}
/* soma de cada modificador e, no tooltip, de onde vem cada parte (mesma lista que a simulação usa) */
const modBreakTip = (n, k) => modBreak(n, k).map(([l, v]) => l + ' ' + sgn(v)).join('\n') || 'Nenhuma fonte';
function modTable(b, n) {
  const c = el('div', 'card');
  [...Object.keys(MODS), 'coup'].forEach(k => { const v = n.m[k] || 0; if (!v && !modBreak(n, k).length) return;
    const r = el('div', 'brow'); r.append(el('span', 'nm', MODS[k] || 'Risco de golpe'), el('span', 'lv ' + ((k === 'coup' ? -v : v) >= 0 ? 'good' : 'bad'), sgn(v))); tip(r, modBreakTip(n, k)); c.append(r); });
  b.append(c);
}
/* corte: prestígio, sucessão, opinião, segredos, educação e esquemas (nomes mudam com a era e o governo) */
function opBar(v) { const d = el('div', 'opbar'), f = el('div', 'opfill'); const x = (v ?? 0) / 100; f.style.left = x < 0 ? (50 + x * 50) + '%' : '50%'; f.style.width = Math.abs(x) * 50 + '%'; f.style.background = x < 0 ? '#e5636b' : '#8fd17f'; d.append(f); return d; }
function winCourt(b, n) {
  const msg = el('div', 'msg'), c = el('div', 'cols'), pv = n.pres ?? 50;
  const pc = el('div', 'card'); pc.append(tip(el('h4', '', '👑 ' + presName(n) + ' · ' + Math.round(pv)), 'Sobe com vitórias, investidura e segredos expostos; cai com derrotas e esquemas descobertos. Volta devagar a 50.\nCada 10 acima de 50: estabilidade +2% e risco de golpe −10%. Também melhora a opinião da corte.'), bar(pv / 100, '#e8c25a')); c.append(pc);
  const sc = el('div', 'card'), law = LAWS.succ.o[n.laws.succ], hered = GOVS[n.gov].succ === 'hered';
  sc.append(el('h4', '', '⚜️ Sucessão'));
  if (!hered) sc.append(el('div', 'dim', GOVS[n.gov].n + ': ' + ({ elect: 'eleição', term: 'mandatos', council: 'escolha do conselho', theo: 'o clero escolhe', junta: 'a junta escolhe', ai: 'a máquina decide' }[GOVS[n.gov].succ] || 'regras próprias')));
  else { const kids = (n.kids || []).slice().sort((a, b) => a.born - b.born); sc.append(tip(el('div', '', 'Lei: ' + law.n), law.d + '\nMude na aba Leis.'), el('div', 'dim', kids.length ? 'Herdeiro: ' + charName(kids[0]) + ' · ' + ageOf(kids[0]) + ' anos' : 'Sem herdeiros: crise de sucessão ou união pessoal'));
    if (n.regent) sc.append(el('div', 'gold', 'Regência de ' + charName(n.regent) + ' até ' + charName(n.ruler) + ' fazer 16 anos')); }
  c.append(sc); b.append(c);
  // personagens
  const t = el('table', 't'); t.style.marginTop = '12px'; const h = t.insertRow(); ['Personagem', 'Cargo', 'Idade', 'Opinião', 'Segredo', ''].forEach(x => h.append(el('th', '', x)));
  const rows = [...COUNCIL.map(([k]) => [n.council[k], roleName(n, k), k]), [n.spouse, roleName(n, 'spouse'), null], ...(n.kids || []).map(k => [k, k.f ? 'Herdeira' : 'Herdeiro', null])].filter(x => x[0]);
  rows.forEach(([ch, role, slot]) => { const r = t.insertRow(); r.insertCell().append(tip(el('span', '', charName(ch)), ch.tr.map(traitTip).join('\n\n'))); r.insertCell().textContent = role; r.insertCell().textContent = ageOf(ch) + '';
    const oc = r.insertCell(); oc.style.width = '120px'; oc.append(tip(opBar(ch.op), 'Opinião sobre o governante: ' + Math.round(ch.op ?? 0) + '\n' + (opParts(n, ch).map(([k, v]) => k + ' ' + (v > 0 ? '+' : '') + v).join('\n') || 'Indiferente') + (slot ? '\nAbaixo de −30, conspira (risco de golpe).' : '')));
    const se = r.insertCell(); if (ch.secK && ch.sec) { se.append(tip(el('span', '', SECRETS[ch.sec].e + ' ' + SECRETS[ch.sec].n), 'Descoberto pelo ' + roleName(n, 'spymaster').toLowerCase()));
      if (ch.secK === 1) { se.append(btn('Chantagear', () => { msg.textContent = useSecret(n, ch, 'blackmail'); drawWin(); }, 'sm', '', 'Fica com medo: opinião +30 e não conspira por 10 anos'));
        if (slot) se.append(btn('Expor', () => { msg.textContent = useSecret(n, ch, 'expose'); drawWin(); }, 'sm red', '', 'Cai em desgraça e deixa o cargo; ' + presName(n).toLowerCase() + ' +3')); } }
    else se.append(el('span', 'dim', '—'));
    const ac = r.insertCell(); const a = ageOf(ch);
    if (!slot && n.kids && n.kids.includes(ch) && a < 16) { const sel = el('select'); COUNCIL.forEach(([k]) => sel.append(new Option('Tutor: ' + roleName(n, k), k))); sel.value = ch.tut || ''; sel.onchange = () => { ch.tut = sel.value; drawWin(); }; ac.append(tip(sel, 'Aos 16 anos: +3 no atributo do tutor e, com sorte, um traço dele (' + (ch.tut ? TUTOR_TR[ch.tut].map(x => TRAITS[x].n.toLowerCase()).join(', ') : 'escolha um tutor') + ')')); }
  });
  b.append(t);
  // esquemas
  const ec = el('div', 'card'); ec.style.marginTop = '12px'; ec.append(tip(el('h4', '', '🕵️ Esquemas · força ' + Math.round(schemePower(n))), 'Força: astúcia do ' + roleName(n, 'spymaster').toLowerCase() + ' e metade da do governante (conspiradores +5).\nUm esquema por vez; contra outro país, a força deles atrapalha e o risco de ser descoberto sobe.\nDescoberto: ' + presName(n).toLowerCase() + ' −10 (e relação −50 com o alvo).'));
  if (n.scheme) { const s0 = n.scheme; ec.append(el('div', '', schemeTxt(n, s0)), bar(s0.prog, '#b48be0'), btn('Cancelar', () => { n.scheme = null; drawWin(); }, 'sm')); }
  else {
    const fs = S.nations.filter(o => o.alive && o.id !== n.id && n.exP[o.capital]).sort((a, b) => (n.rel[a.id] || 0) - (n.rel[b.id] || 0));
    Object.keys(SCHEMES).forEach(k => { const d = SCHEMES[k], r = el('div', 'row'); r.append(tip(el('b', 'nm', schemeName(k)), d.d + '\nCusto 💰' + schemeCost(k) + ' · cerca de ' + d.m + ' meses'));
      const sel = el('select'); if (d.tgt !== 'foreign') COUNCIL.forEach(([s0]) => sel.append(new Option(roleName(n, s0) + ': ' + charName(n.council[s0]) + ' (' + Math.round(n.council[s0].op ?? 0) + ')', 'own:' + s0)));
      if (d.tgt !== 'own') fs.slice(0, 40).forEach(o => sel.append(new Option(natName(o) + ' (' + Math.round(n.rel[o.id] || 0) + ')', 'nat:' + o.id)));
      r.append(sel, btn('Começar (💰' + schemeCost(k) + ')', () => { const [ty, v] = sel.value.split(':'); msg.textContent = startScheme(n, k, ty === 'own' ? { own: v } : { nat: +v }); drawWin(); drawTop(); }, 'sm', n.money < schemeCost(k) ? 'Sem dinheiro' : ''));
      ec.append(r); });
  }
  const intel = Object.entries(n.intel || {}).filter(([id]) => nat(+id).alive); if (intel.length) { ec.append(el('h4', '', 'Segredos de outros governantes'));
    intel.forEach(([id, I]) => { const o = nat(+id), r = el('div', 'brow'); r.append(el('span', 'nm', charName(o.ruler) + ' · ' + natName(o) + ' · ' + SECRETS[I.sec].e + ' ' + SECRETS[I.sec].n), btn('Expor', () => { msg.textContent = exposeForeign(n, +id); drawWin(); }, 'sm red', o.ruler.id !== I.cid ? 'Outro governante agora' : '', presName(o) + ' deles −15 e estabilidade −8; o seu +3')); ec.append(r); }); }
  b.append(ec, msg);
}
/* janela da Fé: a fé oficial e as religiões do povo */
function winFaithW(b) { const n = me(), tab = tabs(b, 'faithTab', [['state', '🙏 Fé oficial'], ['rel', '⛪ Religiões do povo']]); if (tab === 'state') winFaith(b, n); else winPop(b, 'rel'); }
/* fé oficial: doutrina, fervor, chefe religioso e guerra santa */
function winFaith(b, n) {
  const R0 = RELIGIONS[REL_IDS[n.relig]], F = faithOf(n.relig), h = headOf(n.relig), msg = el('div', 'msg'), c = el('div', 'cols');
  const d = el('div', 'card'); d.append(el('h4', '', R0.e + ' ' + R0.n), el('div', 'dim', F.d || ''), modChips(F.doc)); c.append(d);
  const fv = el('div', 'card'), v = n.ferv ?? 50; fv.append(tip(el('h4', '', '🙏 Fervor · ' + Math.round(v) + '% (alvo ' + Math.round(n.fervT ?? v) + '%)'), 'Anda 1 ponto por mês até o alvo:\n' + fervParts(n).map(([k, x]) => k + ' ' + (x > 0 ? '+' : '') + x).join('\n')), bar(v / 100, '#e8c25a'));
  c.append(tip(fv, 'Alto: estabilidade e contingente, um pouco menos de pesquisa; a fé oficial converte mais rápido.\nBaixo: o contrário, e heresias e reformas se espalham.\nCada 10 pontos acima de 50: estabilidade +2%, contingente +1%, pesquisa −1%.'));
  b.append(c);
  if (h) { const hc = el('div', 'card'), seat = seatOf(n.relig), fav = n.fav ?? 50; hc.style.marginTop = '12px';
    hc.append(el('h4', '', '⛪ ' + h[0] + (n.excom ? ' · ⛔ excomungado' : '')), el('div', 'dim', 'Sede: ' + (seat != null ? WD.provs[seat].n + ' (' + (S.own[seat] >= 0 ? natName(nat(S.own[seat])) : 'sem dono') + ')' + (seatLost(n.relig) ? ' — em mãos infiéis' : '') : '—')));
    hc.append(tip(el('div', '', 'Favor do ' + h[1].toLowerCase() + ': ' + Math.round(fav)), 'Abaixo de ' + FERV.excom + ' pode haver excomunhão (−10% de estabilidade e −30 de relação com os da mesma fé); volta ao normal com ' + FERV.lift + '.\nSobe com doações, vitórias em guerras santas e peregrinações.'), bar(fav / 100, fav < FERV.excom ? '#e5636b' : '#7fb3d5'));
    const r = el('div', 'row');
    r.append(btn('💰 Doar (💰' + donateCost() + ')', () => { msg.textContent = faithAct(n, 'donate'); drawWin(); drawTop(); }, 'sm', n.money < donateCost() ? 'Sem dinheiro' : '', 'Favor +10'));
    r.append(btn('👑 Pedir investidura (−' + FERV.invest + ' favor)', () => { msg.textContent = faithAct(n, 'invest'); drawWin(); }, 'sm', fav < FERV.invest ? 'Favor insuficiente' : n.investCd > S.t ? 'Investidura recente' : '', 'Estabilidade +5% por 10 anos e prestígio +5; uma vez a cada 10 anos'));
    hc.append(r); b.append(hc); }
  const tg = [...neighbors(n)].map(nat).concat(seatLost(n.relig) && S.own[seatOf(n.relig)] >= 0 ? [nat(S.own[seatOf(n.relig)])] : []).filter((t, i, a) => a.indexOf(t) === i && !holyWhy(n, t));
  const hw = el('div', 'card'); hw.style.marginTop = '12px'; hw.append(tip(el('h4', '', '⚔️ ' + holyName(n.relig)), 'Contra vizinhos de outra família de fé ou contra quem tem a sede da sua fé.\nCusta só −3 de estabilidade; vencer dá +15 de fervor e de favor a todos do seu lado com a mesma fé.' + (h ? '\nConvocar como ' + holyName(n.relig).toLowerCase() + ' (−' + FERV.crusade + ' favor) chama os países da mesma fé com favor 50+.' : '')));
  if (!tg.length) hw.append(el('div', 'dim', 'Nenhum alvo possível agora.'));
  tg.slice(0, 12).forEach(t => { const r = el('div', 'brow'); r.append(flagImgEl(t.flag), el('span', 'nm', natName(t) + ' · ' + RELIGIONS[REL_IDS[t.relig]].e), btn('Declarar', () => { const e = declareWar(n, t, null, 'holy'); msg.textContent = e; if (!e) { closeWin(); refresh(); } }, 'sm red'));
    if (h) r.append(btn('Convocar', () => { const e = faithAct(n, 'crusade', t); msg.textContent = e; if (!e) { closeWin(); refresh(); } }, 'sm red', (n.fav ?? 50) < FERV.crusade ? 'Favor insuficiente' : ''));
    hw.append(r); });
  b.append(hw, msg);
}
function winGov(b) {
  const n = me(), msg = el('div', 'msg'), tab = tabs(b, 'govTab', [['gov', '🏛️ Governo'], ['court', '🕯️ Corte'], ['ideo', '⚑ Ideologia'], ['laws', '📜 Leis'], ['mods', '📊 Modificadores']]);
  if (tab === 'court') { winCourt(b, n); return; }
  if (tab === 'laws') { lawGrid(b, n, false, msg); return; }
  if (tab === 'mods') { modTable(b, n); return; }
  if (tab === 'ideo') {
    const inf = ideoInfluence(n), c = el('div', 'card'); c.append(el('h4', '', 'Ideologia atual: ' + IDEOS[n.ideo].n), modChips(IDEOS[n.ideo].m));
    c.append(el('h4', '', 'Influência do governante e do conselho'));
    const who = [[titleOf(n), n.ruler, 3], ...COUNCIL.map(([k]) => [roleName(n, k), n.council[k], 1])];
    Object.entries(inf).sort((a, b) => b[1] - a[1]).forEach(([i, v]) => { const r = el('div', 'brow'); r.append(el('span', 'nm', IDEOS[i].n), el('span', 'lv', v + '')); tip(r, who.filter(([, ch]) => ch && ch.ld === i).map(([t, ch, w]) => t + ' ' + charName(ch) + ' (+' + w + ')').join('\n')); c.append(r, bar(v / 8, IDEOS[i].col)); });
    c.append(tip(el('small', 'dim', 'Mudar para uma ideologia com influência custa menos estabilidade; em eleições, os partidos influentes ganham apoio.'), 'Troque conselheiros para mudar a influência.'));
    b.append(c);
    if (isElective(n) && n.sup) {
      const ec = el('div', 'card'); ec.style.marginTop = '12px'; const g = GOVS[n.gov];
      ec.append(el('h4', '', '🗳️ Eleitorado e apoio'), el('div', 'dim', g.succ === 'elect' ? 'Eleição quando o governante morrer' : 'Próxima eleição: ' + (n.termEnd || curYear())));
      Object.entries(n.sup).sort((a, b) => b[1] - a[1]).forEach(([i, v]) => { const r = el('div', 'brow'); r.append(el('span', 'nm', 'Partido ' + IDEOS[i].n + (i === n.ideo ? ' (governo)' : '')), el('span', 'lv', pct(v))); tip(r, modLines(IDEOS[i].m).join('\n')); ec.append(r, bar(v, IDEOS[i].col)); });
      ec.append(tip(el('small', 'dim', 'O apoio ao governo sobe com estabilidade e lucro; cai com guerra, fome e impostos altos.'), 'Se outro partido vencer, a ideologia muda e um novo governante assume.'));
      ec.append(btn('📣 Campanha (💰' + campaignCost() + ')', () => { const e = campaign(n); msg.textContent = e; if (!e) refresh(); }, 'sm', n.campCd > S.t ? 'Campanha recente' : '', '+6% de apoio ao partido do governo; uma vez por ano'));
      b.append(ec);
    }
    b.append(el('h3', 'gold', 'Mudar ideologia'), msg);
    byEraGroups(Object.keys(IDEOS), ideoUnlockYear).forEach(([e, list]) => { b.append(el('h4', 'era', e)); const io = el('div', 'grid-opts');
      list.forEach(i => { const d = IDEOS[i], ok = n.fx.i.has(i), o = el('div', 'opt' + (n.ideo === i ? ' on' : '') + (ok ? '' : ' off')); o.style.borderLeft = '4px solid ' + d.col; tip(o, d.n + '\n' + modLines(d.m).join('\n') + '\nAgressividade na IA ×' + d.war + '\nTrocar custa ' + Math.max(2, 12 - (inf[i] || 0) * 2) + ' de estabilidade' + (ok ? '' : '\n⛔ Exige tecnologia') + (n.ideoCd > S.t && n.ideo !== i ? '\n⏳ Mudança recente: a próxima só em ' + yearOf(n.ideoCd) : ''));
        o.append(el('b', '', d.n + (inf[i] ? ' · ⚑' + inf[i] : '')), modChips(d.m)); if (ok && n.ideo !== i) o.onclick = () => { const e = setIdeo(n, i); msg.textContent = e; if (!e) refresh(); }; io.append(o); });
      b.append(io); });
    return;
  }
  const top = el('div', 'cols'), cardL = (c, t, x) => { const d = charCard(c, t, x); const l = leanChip(c); if (l) d.insertBefore(l, d.children[2]); return d; };
  top.append(cardL(n.ruler, titleOf(n)));
  if (n.spouse) top.append(cardL(n.spouse, 'Cônjuge'));
  if (n.kids && n.kids.length) { const d = el('div', 'card'); d.append(el('h4', '', 'Herdeiros')); n.kids.slice().sort((a, b) => a.born - b.born).forEach(k => d.append(tip(el('div', '', charName(k) + ' · ' + ageOf(k) + ' anos'), k.tr.map(traitTip).join('\n\n')))); top.append(d); }
  b.append(top);
  if (n.senior != null) b.append(el('p', 'gold', (n.subj ? SUBJECTS[n.subj.tier].n : 'Súdito') + ' de ' + natName(nat(n.senior)) + ' · liberdade ' + Math.round(n.subj ? n.subj.lib : 0) + '%.'));
  const cc = el('div', 'cols'); cc.style.marginTop = '12px';
  COUNCIL.forEach(([k, , s]) => { const t = roleName(n, k); cc.append(cardL(n.council[k], t, btn('Trocar (💰' + councilCost() + ')', () => councilPick(k, t), 'sm', '', 'Escolha entre 3 candidatos. Este cargo usa ' + STATS[s].n + '.'))); });
  b.append(el('h3', 'gold', 'Conselho'), cc, msg);
  const dm = demandsOf(n), dc = el('div', 'card'); dc.style.marginTop = '12px';
  dc.append(tip(el('h4', '', '🗡️ Exigências · pressão do conselho ' + Math.round(n.press || 0) + '%'), 'Cada conselheiro pode querer uma forma de governo, uma lei ou uma ideologia — sempre algo que o país já pode adotar.\nExigências de conselheiros não atendidas aumentam a pressão (mais rápido com estabilidade baixa, classe alta insatisfeita e governos propensos a golpe).\nEm 100%, o conselheiro mais exigente toma o poder e impõe tudo o que queria.\nAs vontades do próprio governante custam −2 de estabilidade cada.'), bar((n.press || 0) / 100, (n.press || 0) > 70 ? '#e5636b' : '#d9b45a'));
  if (!dm.length) dc.append(el('div', 'dim', 'Ninguém exige nada agora.'));
  dm.forEach(d => { const r = el('div', 'brow'); r.append(el('span', 'nm', (d.slot === 'ruler' ? '👑 ' : '') + d.t + ' ' + charName(d.c) + ' → ' + demandTxt(d)), el('span', 'lv', d.slot === 'ruler' ? '−2⚖️' : '+' + d.w));
    const go = d.ty === 'law' ? btn('Adotar (💰' + lawCost() + ')', () => { const e = setLaw(n, d.k, d.v); msg.textContent = e; if (!e) refresh(); }, 'sm', (n.lawCd || {})[d.k] > S.t ? 'Mudada há pouco' : '', 'Muda a lei agora: −3 de estabilidade')
      : d.ty === 'gov' ? btn('Reformar (💰' + Math.round(80 * eraScale()) + ')', () => { const e = setGov(n, d.v); msg.textContent = e; if (!e) refresh(); }, 'sm', n.govCd > S.t ? 'Reforma recente (até ' + yearOf(n.govCd) + ')' : '', govTip(d.v))
      : btn('Adotar', () => { const e = setIdeo(n, d.v); msg.textContent = e; if (!e) refresh(); }, 'sm', n.ideoCd > S.t ? 'Mudança recente (até ' + yearOf(n.ideoCd) + ')' : '', modLines(IDEOS[d.v].m).join('\n'));
    r.append(go); tip(r, d.slot === 'ruler' ? 'Vontade do governante: −2 de estabilidade enquanto não for atendida' : 'Exigência do ' + d.t.toLowerCase() + ': soma ' + d.w + ' à pressão. Atenda ou troque o conselheiro.'); dc.append(r); });
  b.append(dc);
  const tc = el('div', 'card'), ns = statesOf(n), r = n.rank || 0, cap = domCap(n); tc.style.marginTop = '12px';
  tc.append(el('h4', '', 'Título · ' + RANK_N[r]), el('div', '', natName(n) + ' · ' + titleOf(n)), tip(el('small', ns > cap ? 'bad' : 'dim', 'Limite de domínio: ' + ns + ' de ' + cap + ' estados · ' + WD.conts[homeCont(n)].n + ': ' + Math.round(contShare(n) * 100) + '% controlado'), 'Limite de domínio (Domain Limit): quantos estados o título sustenta, inteiros ou não.\nO Reino sustenta 3/4 dos estados do continente de origem; o Império (com 2/3 dele) sustenta o continente inteiro e mais.\nAcima do limite: −3 de estabilidade por estado a mais, sem colonizar e sem anexar além disso na paz.'), bar(cap < 1e8 ? ns / cap : .2, ns > cap ? '#e5636b' : '#d9b45a'));
  const ladder = el('div', 'chips'); RANK_N.forEach((rn, k) => ladder.append(tip(el('span', 'chip' + (k === r ? ' p' : ''), rn + ': ' + rankFmt(n, k).replace('{}', n.name)), rn + '\nTítulo do governante: ' + rankTitle(n, k) + '\nLimite de domínio: ' + rankCap(n, k) + ' estados' + (k >= 3 ? ' (pelo tamanho de ' + WD.conts[homeCont(n)].n + ')' : '') + '\nProclamar exige ' + rankReqTxt(n, k)))); tc.append(ladder);
  if (r < 4) tc.append(btn('👑 Proclamar ' + RANK_N[r + 1] + ' (💰' + rankCost(n) + ')', () => { const e = rankUp(n); msg.textContent = e; if (!e) refresh(); }, 'grn', r + 1 < 4 && ns < RANK_REQ[r + 1] ? 'Exige ' + RANK_REQ[r + 1] + ' estados (tem ' + ns + ')' : r + 1 === 4 && contShare(n) < RANK_EMP ? 'Exige controlar 2/3 de ' + WD.conts[homeCont(n)].n + ' (tem ' + Math.round(contShare(n) * 100) + '%)' : n.money < rankCost(n) ? 'Sem dinheiro' : '', 'Vira ' + rankFmt(n, r + 1).replace('{}', n.name) + ' · −5 de estabilidade'));
  tc.append(tip(el('div', 'dim', '⭐ Capital: ' + WD.provs[n.capital].n + (n.capCd > S.t ? ' · nova mudança em ' + yearOf(n.capCd) : '')), 'A capital tem +2 de fortificação. Se for ocupada: −2 de estabilidade por mês e +25% de rendição na guerra.\nPara mudar, clique numa província sua e use "Tornar capital" (uma vez a cada 10 anos).'));
  b.append(tc);
  govForms(b, n, msg);
}
function winEco(b) {
  const n = me(), msg = el('div', 'msg'), tab = tabs(b, 'ecoTab', [['over', '📊 Visão geral'], ['goods', '📦 Bens'], ['laws', '⚖️ Leis econômicas']]);
  if (tab === 'laws') { lawGrid(b, n, true, msg); return; }
  if (tab === 'goods') {
    const gt = el('table', 't'); const hr = gt.insertRow(); ['Bem', 'Produção', 'Consumo', 'Importa', 'Exporta', 'Preço mundial', 'Atendido'].forEach(x => hr.append(el('th', '', x)));
    GOOD_IDS.forEach(id => {
      const s = n.mk.sup[id] || 0, d = n.mk.dem[id] || 0; if (s < .05 && d < .05) return;
      const r = gt.insertRow(), c0 = r.insertCell(); c0.textContent = GOODS[id].e + ' ' + GOODS[id].n; tip(c0, GOODS[id].n + ' · preço base ' + GOODS[id].p + '\nFeito por: ' + (Object.values(BUILDINGS).filter(x => x.out && x.out[id]).map(x => x.n).join(', ') || 'subsistência') + '\n' + (goodUsers(id) || 'Ninguém consome diretamente') + '\nFalta: produção e satisfação das classes caem; o que falta é importado até o orçamento.');
      [s, d, n.mk.imp[id] || 0, n.mk.exp[id] || 0].forEach((v, i) => { const c = r.insertCell(); c.className = 'n'; c.textContent = v >= 10 ? Math.round(v) : v.toFixed(1);
        const sr = (n.mk.src || {})[id]; if (i === 2 && v > .05 && sr) tip(c, sr.o >= 0 ? 'Vem de ' + natName(nat(sr.o)) + ' por ' + (sr.sea ? 'mar' : 'terra') + ' · preço ×' + sr.m.toFixed(2) + ' (distância e rota)' : 'Ninguém exporta: comprado no mercado mundial a preço ×1,35'); });
      const p = r.insertCell(); p.className = 'n'; p.textContent = S.wp[id].toFixed(1); const ratio = S.wp[id] / GOODS[id].p; p.classList.add(ratio > 1.3 ? 'bad' : ratio < .7 ? 'good' : 'x'); tip(p, 'Preço mundial: sobe quando o mundo consome mais do que produz');
      const sc = r.insertCell(); sc.style.width = '120px'; sc.append(bar(n.mk.sat[id] == null ? 1 : n.mk.sat[id], (n.mk.sat[id] || 1) < .8 ? '#e5636b' : '#8fd17f'));
    });
    b.append(gt); return;
  }
  const sum = el('div', 'cols');
  const inc = el('div', 'card'); inc.append(el('h4', '', 'Balanço mensal'));
  const t = el('table', 't'); const lab = { tax: ['Impostos', '6% do PIB, ajustado por governo, leis, administração, mercados e estabilidade.\nMais impostos: mais ouro, porém leis de imposto alto custam estabilidade.'], trade: ['Exportações', 'Excedentes vendidos ao mercado mundial; portos, acordos e leis de comércio ajudam'], imports: ['Importações', 'O que falta é comprado até um orçamento; comida primeiro.\nO preço sobe com a distância até o país exportador: por mar (os dois com litoral) sai bem mais barato que por terra; acordos comerciais e portos ajudam.\nSem dinheiro, o que falta derruba estabilidade e produção.'], tribute: ['Tributo', 'Pago pelo súdito ao suserano: parte dos impostos, pelo nível e pela lei de tributo.'], rep: ['Reparações', 'Parte dos impostos paga ao vencedor de uma guerra por 10 anos.'], transport: ['Frete entre estados', 'Prédios usam primeiro o que o próprio estado produz (barato e na hora).\nO resto vem de outros estados: chega com perdas e paga frete. O frete encarece a produção e sai do PIB tributável — aqui aparece o imposto que deixa de entrar.\nEstradas, ferrovias e rodovias no estado reduzem perdas e frete.'], army: ['Exército', 'Manutenção dos regimentos; sobe com a era'], navy: ['Marinha', 'Manutenção dos navios'], admin: ['Administração', 'Cresce com população e províncias; a cobertura de administração reduz em até 30%'], svc: ['Serviços públicos', 'Manutenção de hospitais, escolas, repartições e guardas (a lei de gastos muda isso)'], interest: ['Juros', '1% da dívida ao mês. Dívida grande demais leva à falência: estabilidade despenca e metade do exército debanda.'], corrupt: ['Corrupção', '1% ao mês do que passa de 2.000 no tesouro se perde.\nA cobertura de administração reduz em até 60%. Gaste em obras, exército ou pesquisa em vez de acumular.'] };
  Object.entries(n.inc).forEach(([k, v]) => { const r = t.insertRow(), c0 = r.insertCell(); c0.textContent = lab[k][0]; tip(c0, lab[k][1]); const c = r.insertCell(); c.className = 'n ' + (v < 0 ? 'bad' : 'good'); c.textContent = money(v); tip(c, lab[k][1]); });
  const tr = t.insertRow(); tr.insertCell().textContent = 'Total'; const tc = tr.insertCell(); tc.className = 'n gold'; tc.textContent = money(n.income); inc.append(t); sum.append(inc);
  const embs = S.nations.filter(o => o.alive && has(o, 'emb', n.id)).length;
  const g = el('div', 'card'); g.append(el('h4', '', 'Produção'), kv([['PIB', money(n.gdp) + '/mês', 'Valor de tudo o que o país produz por mês; base dos impostos'], ['População', popStr(n.popT)], ['Empregados', popStr(n.employed || 0), 'Quem trabalha nos prédios; o resto vive da subsistência.\nCada prédio exige trabalhadores livres no estado.'], ['Comida', pct(n.foodSat), 'Abaixo de 95% a população encolhe e a estabilidade cai'], ['Canteiros', n.cons.length + ' / ' + consSlots(n), 'Obras ao mesmo tempo: tecnologia, população, tesouro e canteiros comprados (janela de Construção)'], ['Acordos comerciais', (n.trade || []).length + '', '+7% de eficiência de comércio cada'], ['Embargos contra você', embs + '', '−8% de eficiência de comércio cada']]), modChips({ tax: n.m.tax, prod: n.m.prod, trade: n.m.trade, food: n.m.food })); sum.append(g);
  const sv = el('div', 'card'); sv.append(el('h4', '', 'Cobertura dos serviços'));
  for (const k in SVC) { const v = (n.cov || {})[k] || 0, r = el('div', 'brow'); r.append(el('span', 'e', SVC[k].e), el('span', 'nm', SVC[k].n + ' · ' + svcName(k, curYear())), el('span', 'lv', pct(v))); tip(r, SVC[k].d + '\nConstrua no painel do estado. Estados com a capital ocupada perdem os serviços.'); sv.append(r, bar(v, '#7fc8e0')); }
  const ps = n.mk.sup.power || 0, pd = n.mk.dem.power || 0; sv.append(tip(el('div', pd > ps ? 'bad' : 'dim', '⚡ Energia: produz ' + Math.round(ps) + ' · consome ' + Math.round(pd)), 'Fábricas e população consomem energia a partir de 1885; sem energia, as fábricas produzem menos.\nFontes: carvão, óleo, hidrelétrica, nuclear, eólica, solar, fusão e a usina da sua vertente.'));
  sum.append(sv); b.append(sum);
}
function winTech(b) {
  const n = me(), areas = [['mil', '⚔️ Militar'], ['nav', '⚓ Naval'], ['eco', '💰 Economia'], ['soc', '🏛️ Sociedade'], ...(n.vert ? [['vert', VERT[n.vert].e + ' ' + VERT[n.vert].n]] : [])], tab = tabs(b, 'techTab', areas);
  const head = el('div', 'thead'), tr = n.res ? TECH[n.res] : null, cur = el('div', 'card tcur');
  const left = tr ? Math.max(0, techCost(n, tr) - n.rp) : 0, mon = tr ? Math.ceil(left / Math.max(.1, researchRate(n))) : 0;
  cur.append(el('h4', '', '🔬 Pesquisando agora'), el('b', tr ? '' : 'bad', tr ? tr.n + ' · ' + tr.y : 'Nada — clique numa tecnologia ▶ abaixo'), bar(tr ? n.rp / techCost(n, tr) : 0),
    tip(el('small', 'dim', tr ? Math.floor(n.rp) + ' / ' + techCost(n, tr) + ' · +' + researchRate(n).toFixed(1) + '/mês · ~' + (mon > 24 ? Math.round(mon / 12) + ' anos' : mon + ' meses') : '+' + researchRate(n).toFixed(1) + ' por mês'), 'Pontos de pesquisa vêm da população, universidades, educação, classe média, estabilidade e modificadores.\nPesquisar antes do tempo custa muito mais (⚠).'));
  if (tr) tip(cur, techTip(n, tr));
  const side = el('div', 'tside');
  const lg = el('div', 'chips'); [['done', '✓ Pesquisada', 'Já é sua'], ['av', '▶ Disponível', 'Clique para pesquisar'], ['lock', '🔒 Bloqueada', 'Falta pré-requisito, recurso ou outra vertente'], ['early', '⚠ Fora de época', 'Muito adiantada: custo multiplicado']].forEach(([c, t, d]) => lg.append(tip(el('span', 'chip lg-' + c, t), d)));
  const sb = el('input', 'tsearch'); sb.placeholder = '🔍 Buscar tecnologia (nome ou efeito)'; sb.value = UI.techQ || ''; sb.oninput = () => { UI.techQ = sb.value; const keep = sb.selectionStart; drawWin(); const nb = $('.tsearch'); if (nb) { nb.focus(); nb.setSelectionRange(keep, keep); } };
  const fl = btn(UI.techAv ? '▶ Só disponíveis' : '☰ Todas', () => { UI.techAv = !UI.techAv; drawWin(); }, 'sm' + (UI.techAv ? ' on' : ''), '', 'Alterna entre mostrar tudo ou só o que dá para pesquisar agora');
  const fr = el('div', 'row'); fr.append(fl, lg); side.append(sb, fr);
  if (n.vert) side.append(btn('↩ Abandonar ' + VERT[n.vert].n + ' (💰' + dropVertCost() + ')', () => modal(m => { m.append(el('h2', '', 'Abandonar ' + VERT[n.vert].n + '?'), el('p', '', 'Você mantém o progresso equivalente da árvore normal, mas perde os bônus, as tropas especiais (viram infantaria) e os prédios da vertente. −20 de estabilidade; outra vertente só daqui a 20 anos.')); const rr = el('div', 'row'); rr.append(btn('Abandonar', () => { const e = dropVert(n); if (e) say(e, 'bad'); closeModal(); UI.techTab = 'eco'; refresh(); }, 'red'), btn('Voltar', closeModal)); m.append(rr); }), 'sm red', n.money < dropVertCost() ? 'Sem dinheiro' : '', 'Desfaz a escolha da vertente para poder trocar por outra'));
  head.append(cur, side); b.append(head);
  const q = (UI.techQ || '').trim().toLowerCase();
  let list = q ? TECHS.filter(t => (!t.vt || t.v === n.vert) && (t.n.toLowerCase().includes(q) || fxLines(t.fx).join(' ').toLowerCase().includes(q))) : tab === 'vert' ? TECHS.filter(t => t.v === n.vert && t.vt) : TECHS.filter(t => t.c === tab && !t.vt);
  if (UI.techAv) list = list.filter(t => !techState(n, t));
  if (q) b.append(el('small', 'dim', list.length + ' resultado' + (list.length === 1 ? '' : 's') + ' em todas as áreas'));
  const nowEra = eraOf(curYear()), groups = new Map(); list.slice().sort((a, c) => a.y - c.y).forEach(t => { const e = eraOf(t.y); if (!groups.has(e)) groups.set(e, []); groups.get(e).push(t); });
  groups.forEach((ts, e) => {
    const done = ts.filter(t => hasT(n, t.id)).length, sec0 = el('div', 'tera' + (e === nowEra ? ' now' : ''));
    const h = el('div', 'terah'); h.append(el('b', '', e + (e === nowEra ? ' · agora' : '')), el('small', 'dim', done + ' / ' + ts.length), bar(done / ts.length, '#8fd17f')); tip(h, e + ': ' + done + ' de ' + ts.length + ' tecnologias desta área pesquisadas');
    const grid = el('div', 'tgrid'); ts.forEach(t => grid.append(techBox(n, t))); sec0.append(h, grid); b.append(sec0);
  });
  if (!groups.size) b.append(el('p', 'dim', UI.techAv ? 'Nada disponível nesta área agora.' : 'Nada encontrado.'));
}
function winDip(b) {
  const n = me(), tab = tabs(b, 'dipTab', [['nat', '🌍 Nações'], ['subj', '👑 Súditos (' + subjectsOf(n.id).length + ')']]);
  if (tab === 'subj') { winSubjects(b, n); return; }
  const list = el('div', 'dlist');
  S.nations.filter(o => o.alive && o.id !== n.id && n.exP[o.capital]).sort((a, b) => (has(n, 'allies', b.id) - has(n, 'allies', a.id)) || (atWar(n.id, b.id) - atWar(n.id, a.id)) || provsOf(b.id).length - provsOf(a.id).length).forEach(o => {
    const r = el('div', 'drow'), rel = Math.round(o.rel[n.id] || 0), st = dipStatus(n, o);
    r.append(flagImgEl(o.flag), el('span', 'dn', o.name), el('span', 'dst', st.map(x => x.split(' ')[0]).join('')), el('b', rel < 0 ? 'bad' : 'good', rel + ''));
    tip(r, natName(o) + '\n' + GOVS[o.gov].n + ' · ' + IDEOS[o.ideo].n + '\n' + provsOf(o.id).length + ' províncias · exército ' + fmtK(S.armies.filter(x => x.o === o.id).reduce((s, x) => s + regs(x), 0)) + '\nRelação (como eles veem você): ' + rel + (st.length ? '\n' + st.join('\n') : ''));
    r.onclick = () => { closeWin(); select('nat', o.id); const c = WD.provs[o.capital]; centerOn(c.cx * K, c.cy * K); };
    list.append(r);
  });
  b.append(list);
}
function winPeace(b) {
  const w = S.wars.find(x => x.id === UI.warg); if (!w) { b.append(el('p', 'dim', 'Essa guerra acabou.')); return; }
  const n = me(), mySide = sideOf(w, n.id), foeSide = mySide === 'A' ? 'D' : 'A', iLead = leaderOf(w, mySide) === n.id, foes = sideIds(w, foeSide), msg = el('div', 'msg');
  const sMy = surrender(w, mySide), sFoe = surrender(w, foeSide);
  b.append(el('h3', '', 'Guerra contra ' + natName(nat(leaderOf(w, foeSide))) + ' · ' + Math.floor((S.t - w.start) / 360) + ' anos'));
  const c = el('div', 'cols');
  const sc = el('div', 'card'); sc.append(el('h4', '', 'Rendição dos lados'), tip(el('div', 'good', 'Deles: ' + pct(sFoe)), 'O líder pesa sozinho: se ele cai, o lado cai. Senão, a média dos países pelo tamanho.'), bar(sFoe, '#8fd17f'), tip(el('div', 'bad', 'Nossa: ' + pct(sMy)), 'Em 100% o seu lado capitula e os vencedores impõem os termos.'), bar(sMy, '#e5636b')); c.append(sc);
  // escolha do país com quem negociar
  const L = UI.peaceL = foes.includes(UI.peaceL) ? UI.peaceL : foes.find(id => leaderOf(w, foeSide) !== id || iLead) ?? foes[0];
  const fc = el('div', 'card'); fc.append(tip(el('h4', '', 'Negociar com'), 'Cada país inimigo tem a própria rendição: território dele ocupado (pela população), tropas perdidas e capital tomada. Tudo ocupado = 100%.\nCom o líder inimigo, a paz encerra a guerra toda (só o líder do seu lado negocia). Com os demais, é uma paz separada: só aquele país sai.'));
  foes.forEach(id => { const lead = leaderOf(w, foeSide) === id, ok = !lead || iLead, r = el('div', 'brow' + (id === L ? ' gold' : '') + (ok ? '' : ' dim')); r.append(flagImgEl(nat(id).flag), el('span', 'nm', nat(id).name + (lead ? ' (líder)' : '')), el('b', '', pct(surrenderOf(w, id)))); if (ok) r.onclick = () => { UI.peaceL = id; UI.peacePick = null; drawWin(); }; tip(r, ok ? 'Clique para negociar' : 'Só o líder do seu lado negocia com o líder inimigo'); fc.append(r); });
  c.append(fc); b.append(c);
  if (leaderOf(w, foeSide) === L && !iLead) { b.append(el('p', 'gold', 'Você entrou como aliado: o líder da guerra negocia com o líder inimigo. Você pode fazer paz separada com os outros países.')); return; }
  const ln = nat(L), budget = warPointsVs(w, L), P0 = UI.peacePick = UI.peacePick && UI.peacePick.w === w.id && UI.peacePick.L === L ? UI.peacePick : { w: w.id, L, s: new Set(), subj: null, rep: false };
  const byState = new Map(); provsOf(L).forEach(p => { const st = WD.provs[p].state; if (!byState.has(st)) byState.set(st, []); byState.get(st).push(p); });
  const picked = [...P0.s].flatMap(st => byState.get(st) || []), t = { provs: picked, subj: P0.subj, rep: P0.rep }, cost = termsCost(w, n.id, L, t), why = termsWhy(w, n.id, L, t);
  b.append(tip(el('div', cost > budget ? 'bad' : 'gold', 'Pontos: ' + cost + ' de ' + budget + ' · ' + natName(ln)), 'Os pontos são a rendição deste país (0–100). Os preços são partes DESTE país: tomar tudo dele, todo ocupado, custa 100.\nOcupado pelo seu lado: preço cheio. Não ocupado: ×1,5. Reivindicado: ×0,75.'));
  // território por região → estado
  const regs0 = new Map(); for (const [st, ps] of byState) { const rg = WD.states[st].region; if (!regs0.has(rg)) regs0.set(rg, []); regs0.get(rg).push([st, ps]); }
  const mine = sideIds(w, mySide), price = ps => Math.round(ps.reduce((s, p) => s + provPrice(w, n.id, p), 0));
  const grid = el('div', 'plist tree');
  for (const [rg, sts] of regs0) {
    const all = sts.every(([st]) => P0.s.has(st)), h = el('label', 'prow preg' + (all ? ' on' : '')), cb = el('input'); cb.type = 'checkbox'; cb.checked = all;
    cb.onchange = () => { sts.forEach(([st]) => cb.checked ? P0.s.add(st) : P0.s.delete(st)); drawWin(); };
    h.append(cb, el('b', 'nm', '🧩 ' + WD.regions[rg].n), el('span', 'dim', sts.length + ' estado' + (sts.length > 1 ? 's' : '')), el('b', '', price(sts.flatMap(x => x[1])) + '')); tip(h, 'Região inteira (só os estados deste país)'); grid.append(h);
    sts.forEach(([st, ps]) => { const on = P0.s.has(st), r = el('label', 'prow pst' + (on ? ' on' : '')), cb2 = el('input'); cb2.type = 'checkbox'; cb2.checked = on;
      cb2.onchange = () => { cb2.checked ? P0.s.add(st) : P0.s.delete(st); drawWin(); };
      const occ = ps.filter(p => mine.includes(S.ctrl[p])).length, claim = !!n.claims[st];
      r.append(cb2, el('span', 'nm', WD.states[st].n + ' · ' + ps.length + 'p'), el('span', 'dim', (claim ? '📜' : '') + (occ ? '⚔️' + occ + '/' + ps.length : '')), el('b', '', price(ps) + ''));
      tip(r, 'Custo: ' + price(ps) + ' pontos' + (claim ? '\n📜 Reivindicado: ×0,75' : '') + '\n⚔️ Ocupadas pelo seu lado: ' + occ + ' de ' + ps.length + ' (as outras custam ×1,5)' + (ps.some(p => ln.capital === p) ? '\n⭐ Contém a capital' : '')); grid.append(r); });
  }
  b.append(el('h4', '', 'Território'), grid);
  // vassalagem e reparações
  const rest = 100 - picked.reduce((s, p) => s + provShare(p), 0), vr = el('div', 'row');
  Object.keys(SUBJECTS).filter(k => SUBJECTS[k].cost).forEach(k => { const d = SUBJECTS[k], cst = Math.round(d.cost * rest);
    vr.append(btn(d.e + ' ' + d.n + ' (' + cst + ')', () => { P0.subj = P0.subj === k ? null : k; drawWin(); }, 'sm' + (P0.subj === k ? ' on' : ''), ln.senior != null ? 'Já é súdito de outro país' : '', d.n + ': ' + d.d + '\nLiberdade inicial ' + d.base + '% · tributo ' + pct(d.tri) + ' dos impostos' + (d.war ? ' · luta nas suas guerras' : '') + '\nCusta ' + pct(d.cost) + ' do que sobrar do país')); });
  vr.append(btn('💰 Reparações (' + REP.cost + ')', () => { P0.rep = !P0.rep; drawWin(); }, 'sm' + (P0.rep ? ' on' : ''), '', pct(REP.share) + ' dos impostos deles por ' + REP.years + ' anos'));
  b.append(el('h4', '', 'Vassalagem e reparações'), vr);
  const r = el('div', 'row'); r.style.marginTop = '10px';
  r.append(btn('🕊️ Impor paz', () => { const res = proposePeace(w, L, t); if (res) msg.textContent = res; else { UI.peacePick = null; closeWin(); refresh(); } }, 'grn', why || (!picked.length && !t.subj && !t.rep ? 'Escolha algum termo' : ''), leaderOf(w, foeSide) === L ? 'Encerra a guerra toda' : 'Paz separada: só ' + ln.name + ' sai da guerra'));
  r.append(btn('Paz branca', () => { const res = proposePeace(w, L, null); if (res) msg.textContent = res; else { closeWin(); refresh(); } }, '', '', 'Ninguém perde nada'));
  if (iLead) r.append(btn('Render-se', () => modal(m => { m.append(el('h2', '', 'Render-se?'), el('p', '', 'O líder inimigo impõe os termos que a rendição dele permitir.')); const row = el('div', 'row'); row.append(btn('Render-se', () => { const wl = leaderOf(w, foeSide); separatePeace(w, n.id, wl, aiTerms(w, wl, n.id, Math.max(warPointsVs(w, n.id), 30))); closeModal(); closeWin(); refresh(); }, 'red'), btn('Voltar', closeModal)); m.append(row); }), 'red'));
  b.append(r, msg);
}
/* aba de súditos (diplomacia): barra de liberdade, leis, nível e integração */
const termsTxt = (L, t) => !t ? 'paz branca' : [t.provs.length ? t.provs.length + ' província' + (t.provs.length > 1 ? 's' : '') + ' (' + [...new Set(t.provs.map(p => WD.states[WD.provs[p].state].n))].slice(0, 6).join(', ') + ')' : '', t.subj ? 'virar ' + SUBJECTS[t.subj].n.toLowerCase() : '', t.rep ? 'reparações por ' + REP.years + ' anos' : ''].filter(Boolean).join(' · ') || 'nada';
function libBar(t) {
  const s = t.subj, d = el('div', 'libbar'), f = el('div', 'libfill'), m = el('div', 'libtg'); f.style.width = s.lib + '%'; f.style.background = s.lib > 75 ? '#e5636b' : s.lib > 50 ? '#e5a35b' : '#8fd17f'; m.style.left = (s.tg ?? s.lib) + '%'; d.append(f, m);
  return tip(d, 'Liberdade: ' + Math.round(s.lib) + '% (alvo ' + Math.round(s.tg ?? s.lib) + '%)\n0% = integrado · 100% = livre (rompe e declara independência)\n' + libParts(t).map(([k, v]) => k + ' ' + (v > 0 ? '+' : '') + v).join('\n'));
}
function winSubjects(b, n) {
  if (isSubj(n)) { const o = nat(n.senior), T = SUBJECTS[n.subj.tier], c = el('div', 'card'); c.append(el('h4', '', T.e + ' ' + T.n + ' de ' + natName(o)), libBar(n), el('div', 'dim', T.d));
    c.append(btn('🏴 Declarar independência', () => modal(m => { m.append(el('h2', '', 'Declarar independência?'), el('p', '', natName(o) + ' vai declarar guerra.')); const r = el('div', 'row'); r.append(btn('Romper', () => { independence(n); closeModal(); refresh(); }, 'red'), btn('Voltar', closeModal)); m.append(r); }), 'red sm', '', 'Rompe o laço e começa uma guerra de independência' + (n.subj.tier === 'union' ? ' (na união pessoal, a coroa só se separa)' : '')));
    b.append(c); }
  const list = subjectsOf(n.id);
  if (!list.length) { b.append(el('p', 'dim', 'Nenhum súdito. Na paz, você pode exigir que o inimigo vire fantoche, vassalo, protetorado ou domínio; casamentos reais podem trazer uniões pessoais.')); return; }
  list.forEach(t => { const s = t.subj, T = SUBJECTS[s.tier], c = el('div', 'card'); c.style.marginTop = '10px';
    c.append(el('h4', '', T.e + ' ' + natName(t) + ' · ' + T.n), libBar(t));
    const info = el('div', 'dim', provsOf(t.id).length + ' províncias · tributo ' + money(Math.max(0, -(t.inc && t.inc.tribute) || 0)) + '/mês' + (s.integ ? ' · integrando (−' + integRate(t).toFixed(1) + '/mês, 💰' + integCost() + '/mês)' : '')); c.append(info);
    for (const k in SUBJ_LAWS) { const L = SUBJ_LAWS[k], r = el('div', 'row'); r.append(el('small', 'dim', L.n + ':'));
      for (const v in L.o) { const d = L.o[v]; r.append(btn(d.n, () => { const e = setSubjLaw(n, t, k, v); if (e) say(e, 'bad'); drawWin(); }, 'sm' + (s.laws[k] === v ? ' on' : ''), s.lawCd > S.t && s.laws[k] !== v ? 'Mudança recente' : '', 'Liberdade ' + (d.lib > 0 ? '+' : '') + (d.lib || 0) + (d.tri != null ? ' · tributo ×' + d.tri : '') + (d.mp ? ' · cede ' + pct(d.mp) + ' do contingente' : '') + (d.demil ? ' · exército limitado' : '') + (d.int ? ' · integração ×' + d.int : '') + '\nTrocar custa −5 de relação com eles; uma vez por ano')); }
      c.append(r); }
    if (s.tier !== 'union') { const r = el('div', 'row'); r.append(el('small', 'dim', 'Nível:')); ['puppet', 'vassal', 'protect', 'dominion'].forEach(k => r.append(btn(SUBJECTS[k].e + ' ' + SUBJECTS[k].n, () => { const e = setSubjTier(n, t, k); if (e) say(e, 'bad'); drawWin(); }, 'sm' + (s.tier === k ? ' on' : ''), s.tierCd > S.t && s.tier !== k ? 'Mudança recente' : '', SUBJECTS[k].d + '\nMais controle: +15 de liberdade na hora; menos controle: −5'))); c.append(r); }
    const r2 = el('div', 'row'); r2.append(btn(s.integ ? '⏸️ Parar integração' : '🔗 Integrar', () => { s.integ = !s.integ; drawWin(); }, 'sm grn' + (s.integ ? ' on' : ''), !s.integ && !integOk(t) ? 'Só com liberdade até 50%' : '', 'Empurra a barra para 0% (' + integRate(t).toFixed(1) + ' por mês, 💰' + integCost() + '/mês); em 0% o país é anexado em paz.\nPara sozinha se a liberdade passar de 50%.'));
    r2.append(btn('Libertar', () => { freeSubject(t, 'foi libertado por'); t.rel[n.id] = Math.min(100, (t.rel[n.id] || 0) + 40); drawWin(); refresh(); }, 'sm red', '', 'Vira independente (relação +40)')); c.append(r2);
    b.append(c); });
}
/* recursos por estado (painel do mapa de recursos e sub-aba da Construção); a cor é a mesma do estado no mapa */
const RES_ALLOWS = { iron: 'Mina de ferro', coal: 'Mina de carvão', gold: 'Mina de ouro', copper: 'Mina de cobre', oil: 'Poço de petróleo', uranium: 'Mina de urânio', rare: 'Mina de terras raras', farm: 'Fazenda', fiber: 'Plantação', wood: 'Madeireira', stone: 'Pedreira', fish: 'Pesqueiro' };
function stateRes(st, n) {
  const min = {}, nat0 = {}, per = [];
  st.provs.forEach(p => { if (n && !n.exP[p]) return; const ic = []; if (resVisible(p)) { const r = provRes(p); min[r] = (min[r] || 0) + 1; ic.push(GOODS[r].e); } natRes(p).forEach(k => { nat0[k] = (nat0[k] || 0) + 1; ic.push(NATRES[k][0]); }); per.push(WD.provs[p].n + ' ' + (ic.join('') || '—')); });
  return { min, nat: nat0, per };
}
function resList(box, compact) {
  const n = me(), all = !!UI.resAll, r0 = el('div', 'row');
  r0.append(btn('Meus estados', () => { UI.resAll = false; refresh(); }, 'sm' + (all ? '' : ' on'), '', 'Só os estados onde você constrói'), btn('Todos os conhecidos', () => { UI.resAll = true; refresh(); }, 'sm' + (all ? ' on' : ''), '', 'Todos os estados já explorados, de qualquer dono'));
  box.append(r0, tip(el('small', 'dim', 'Petróleo, urânio e terras raras só aparecem depois de prospectar.'), 'Prospecte no painel do estado (exige a tecnologia de cada recurso).'));
  const sts = WD.states.filter(st => n.exP[st.cap] && (all ? stateOwnerOf(st.id) >= 0 : stateOwnerOf(st.id) === n.id))
    .sort((a, c) => (stateOwnerOf(a.id) === n.id ? 0 : 1) - (stateOwnerOf(c.id) === n.id ? 0 : 1) || stateOwnerOf(a.id) - stateOwnerOf(c.id) || a.n.localeCompare(c.n));
  const list = el('div', 'reslist' + (compact ? ' compact' : ''));
  sts.forEach(st => {
    const R0 = stateRes(st, n), row = el('div', 'resrow'), sw = el('span', 'sw'), o = stateOwnerOf(st.id); sw.style.background = 'rgb(' + stateTone(st.id).map(Math.round).join(',') + ')';
    const h = el('div', 'resh'); h.append(sw, el('b', '', st.n)); if (o !== n.id) h.append(el('small', 'dim', nat(o).name)); row.append(h);
    const ch = el('div', 'chips');
    Object.entries(R0.min).forEach(([r, k]) => ch.append(tip(el('span', 'chip p', GOODS[r].e + ' ' + GOODS[r].n + (k > 1 ? ' ×' + k : '')), GOODS[r].n + ': ' + k + ' jazida' + (k > 1 ? 's' : '') + ' → até ' + k * RES_MULT[r] + ' níveis de ' + RES_ALLOWS[r] + '\n' + (goodUsers(r) || ''))));
    Object.entries(R0.nat).forEach(([k, v]) => ch.append(tip(el('span', 'chip', NATRES[k][0] + ' ' + NATRES[k][1] + (v > 1 ? ' ×' + v : '')), NATRES[k][1] + ' em ' + v + ' província' + (v > 1 ? 's' : '') + ' → ' + RES_ALLOWS[k] + (st.caps[{ farm: 'farm', fiber: 'plantation', wood: 'lumber', stone: 'quarry', fish: 'fishery' }[k]] ? ' (até ' + st.caps[{ farm: 'farm', fiber: 'plantation', wood: 'lumber', stone: 'quarry', fish: 'fishery' }[k]] + ' níveis)' : ''))));
    if (!ch.children.length) ch.append(el('span', 'dim', 'Sem recursos'));
    row.append(ch); tip(h, st.n + ' · por província:\n' + R0.per.join('\n') + '\nClique para ir até o estado');
    h.onclick = () => { R.sel = st.cap; centerOn(WD.provs[st.cap].cx * K, WD.provs[st.cap].cy * K); if (UI.win === 'build') closeWin(); };
    list.append(row);
  });
  if (!sts.length) list.append(el('p', 'dim', 'Nenhum estado.'));
  box.append(list);
}
function winBuild(b) {                                        // todos os estados e seus prédios por grupo
  if (tabs(b, 'buildTab', [['bld', '🏗️ Prédios'], ['res', '⛏️ Recursos por estado']]) === 'res') { resList(b, false); return; }
  const n = me(), sts = WD.states.filter(st => stateOwnerOf(st.id) === n.id).map(st => { let sp = 0; st.provs.forEach(p => { if (S.own[p] === n.id) sp += S.pop[p]; }); return [st, sp]; }).sort((a, c) => c[1] - a[1]);
  b.append(kv([['Canteiros', n.cons.length + ' / ' + consSlots(n), 'Obras ao mesmo tempo: vêm de tecnologias, população, tesouro e canteiros comprados'], ['Estados com infraestrutura', sts.length + '', 'Você constrói onde controla a capital do estado']]));
  b.append(btn('🏗️ Abrir canteiro (💰' + slotCost(n) + ')', () => { const e = buySlot(n); if (e) say(e, 'bad'); refresh(); }, 'sm grn', n.money < slotCost(n) ? 'Sem dinheiro' : '', 'Um canteiro de obras a mais, para sempre. Cada um custa mais que o anterior.'));
  const grid = el('div', 'bgrid');
  sts.forEach(([st, sp]) => {
    const c = el('div', 'card bstate'), h = el('div', 'bsh'), occ = S.ctrl[st.cap] !== n.id;
    h.append(el('b', '', st.n + (st.provs.includes(n.capital) ? ' ⭐' : '')), el('small', 'dim', popStr(sp) + ' · ' + Math.max(0, Math.floor(freeLabor(n, st.id))) + 'k livres' + (occ ? ' · OCUPADO' : '')));
    h.onclick = () => { closeWin(); select('prov', st.cap); centerOn(WD.provs[st.cap].cx * K, WD.provs[st.cap].cy * K); }; tip(h, 'Ir para o estado');
    c.append(h, buildingRows(n, st)); grid.append(c);
  });
  b.append(grid);
}
function councilPick(k, title) {
  const n = me(), cands = councilCands(n, k);
  modal(m => {
    m.append(el('h2', '', title + ': escolha um candidato'), tip(el('p', 'dim', 'Custa 💰' + councilCost() + ' · novos nomes em ' + yearOf(candsUntil(n, k))), 'A lista de candidatos é a mesma por ' + CANDS_YEARS + ' anos; quem você tirar do cargo volta para ela.'));
    const c = el('div', 'cols'); cands.forEach(ch => c.append(charCard(ch, charName(ch), btn('Nomear', () => { const e = swapCouncil(n, k, ch); if (e) say(e, 'bad'); closeModal(); refresh(); }, 'sm grn', n.money < councilCost() ? 'Sem dinheiro' : '')))); m.append(c, btn('Cancelar', closeModal));
  }, true);
}
const genTip = c => 'General ' + charName(c) + ' · ' + ageOf(c) + ' anos\nMarcial ' + c.st.mar + ' · força em batalha e cercos ' + sgn(genMul(c) - 1) + '\n' + c.tr.map(t => TRAITS[t].n + (GEN_TR[t] ? ' ' + sgn(GEN_TR[t]) : '')).join(', ') + '\nPode morrer de velhice ou numa derrota.';
function genPick(a) {
  const n = me(), cands = genCands(n);
  modal(m => {
    m.append(el('h2', '', 'Escolha um general'), el('p', 'dim', 'Custa 💰' + genCost() + '. Marcial e traços (Bravo, Estrategista…) mudam a força do exército.'));
    const c = el('div', 'cols'); cands.forEach(ch => c.append(charCard(ch, charName(ch) + ' · ' + sgn(genMul(ch) - 1), btn('Nomear', () => { const e = setGeneral(n, a, ch); if (e) say(e, 'bad'); closeModal(); refresh(); }, 'sm grn', n.money < genCost() ? 'Sem dinheiro' : '', genTip(ch))))); m.append(c, btn('Cancelar', closeModal));
  }, true);
}
/* população: classes e necessidades, empregos, culturas, religiões e sexo */
function winPop(b, forceTab) {
  const n = me(), tab = forceTab || tabs(b, 'popTab', [['cls', '🎩 Classes'], ['jobs', '🛠️ Empregos'], ['cul', '🎭 Culturas']]), P = Math.max(1, n.popT || 0), cls = n.cls || {}, cs = n.csat || {};
  if (tab === 'cls') {
    const w = VOTE_W[n.laws.vote] || VOTE_W.nobles, wt = { high: w[0], mid: w[1], low: w[2], slave: 0 }, WL = LAWS.women.o[n.laws.women];
    const top = el('div', 'cols poptop'), cw = el('div', 'card'), cm = el('div', 'card'); cw.append(el('h4', '', '⚖️ Peso político'));
    cw.append(tip(el('div', 'dim', 'Sufrágio: ' + LAWS.vote.o[n.laws.vote].n + ' · alta ' + pct(w[0]) + ' · média ' + pct(w[1]) + ' · baixa ' + pct(w[2]) + ' · escravos não pesam'), 'A satisfação de cada classe, pesada assim, entra no alvo da estabilidade.\nMude o peso com a lei de Sufrágio (Governo → Leis).'));
    cm.append(el('h4', '', '⚧ Mulheres'), tip(el('div', 'dim', 'Lei: ' + WL.n + ' · força de trabalho livre ' + pct(WL.lab) + ' · governante mulher ' + pct(WL.fr)), WL.d + '\nMais direitos: mais gente trabalhando nos prédios e mais governantes mulheres.'));
    top.append(cw, cm); b.append(top);
    const grid = el('div', 'cols');
    CLASS_IDS.forEach(k => {
      const C = CLASSES[k], v = cls[k] || 0, sat = cs[k] == null ? 1 : cs[k], c = el('div', 'card'); c.style.borderTop = '3px solid ' + C.col;
      const fw = k === 'slave' ? .8 : k === 'high' ? Math.max(.05, (WL.lab - .5) * 2) : Math.max(.1, (WL.lab - .45) / WL.lab + .1), fem = k === 'slave' ? .4 : .505;
      c.append(tip(el('h4', '', C.e + ' ' + C.n), C.d), el('div', '', popStr(v) + ' · ' + pct(v / P) + ' da população'),
        tip(el('small', 'dim', '♂ ' + popStr(v * (1 - fem)) + ' · ♀ ' + popStr(v * fem) + ' · ♀ trabalhando ' + pct(fw)), 'Homens e mulheres desta classe.\nMulheres trabalhando: estimativa pela lei das Mulheres' + (k === 'slave' ? ' (escravas trabalham sempre)' : '') + '.\nO contingente militar sai dos homens livres.'),
        tip(el('small', 'dim', 'Satisfação ' + pct(sat) + (wt[k] ? ' · peso político ' + pct(wt[k]) : '')), 'Quanto das necessidades a classe consegue (pelo valor de cada bem).\nBaixa: menos estabilidade' + (k === 'low' ? ' e revoltas populares abaixo de 55%' : k === 'high' ? ' e mais golpes' : k === 'mid' ? ' e menos pesquisa e impostos' : '') + '.'), bar(sat, sat < .55 ? '#e5636b' : sat < .8 ? '#d9b45a' : '#8fd17f'));
      const nd = classNeeds(curYear(), k); c.append(el('h4', 'bgrp', 'Necessidades por mil/mês'));
      Object.entries(nd).filter(([g, q]) => q).forEach(([g, q]) => { const r = el('div', 'brow');
        if (g === 'svc') { const sv = ((n.cov || {}).health || 0) / 2 + ((n.cov || {}).edu || 0) / 2; r.append(el('span', 'e', '🏥'), el('span', 'nm', 'Saúde e educação'), el('span', 'lv', pct(sv))); tip(r, 'Cobertura média de saúde e educação: pesa 25% na satisfação desta classe'); }
        else { const gd = g === 'staple' ? { e: '🌾', n: 'Grãos ou peixe' } : GOODS[g], st = g === 'staple' ? n.foodSat : (n.mk.sat[g] ?? 1); r.append(el('span', 'e', gd.e), el('span', 'nm', gd.n + ' ' + (q >= .1 ? q.toFixed(2) : q.toFixed(3))), el('span', 'lv ' + (st < .8 ? 'bad' : ''), pct(st))); tip(r, gd.n + ': ' + q.toFixed(3) + ' por mil pessoas por mês · atendido ' + pct(st) + (g !== 'staple' ? '\n' + goodUsers(g) : '')); }
        c.append(r); });
      if (k === 'slave') c.append(tip(el('small', 'dim', 'Lei: ' + LAWS.slavery.o[n.laws.slavery].n + ' · ' + pct(n.sf || 0) + ' dos empregos braçais'), LAWS.slavery.o[n.laws.slavery].d + '\nPovos escravizados (aba Culturas/Religiões) também viram escravos.\nEstabilidade: −' + (slaveShare(n) * 50 + Math.max(0, slaveShare(n) - .15) * 150).toFixed(1) + ' (pesa muito acima de 15%)'));
      grid.append(c);
    });
    b.append(grid); return;
  }
  if (tab === 'jobs') {
    const jobs = n.jobs || {}, tot = Object.values(jobs).reduce((a, x) => a + x, 0), lab = laborShare(n);
    b.append(kv([['População', popStr(P)], ['Força de trabalho', popStr((P - (cls.slave || 0)) * lab + (cls.slave || 0) * .8), 'Livres: ' + pct(lab) + ' da população (lei das Mulheres); escravos: 80%'], ['Empregados nos prédios', popStr(n.employed || 0), 'Cada prédio emprega mil trabalhadores por nível (veja a construção)'], ['Escravos nos empregos braçais', popStr(Math.min((cls.slave || 0) * .8, (n.employed || 0))), 'Fazendas, plantações, minas, madeireiras e pedreiras aceitam escravos'], ['Sem emprego (subsistência)', popStr(n.unemp || 0), 'Vivem da terra: plantam grãos, fazem roupas e um pouco de bens em casa.\nViram classe baixa; construir prédios os emprega.']]));
    const t = el('table', 't'); t.style.marginTop = '10px'; const h = t.insertRow(); ['Setor', 'Empregos', '%', 'Baixa', 'Média', 'Alta'].forEach(x => h.append(el('th', '', x)));
    Object.entries(jobs).sort((a, c) => c[1] - a[1]).forEach(([g, v]) => { const r = t.insertRow(), c0 = r.insertCell(); c0.textContent = JOB_N[g]; tip(c0, 'Prédios: ' + Object.keys(BUILDINGS).filter(x => jobGroup(x) === g).map(x => BUILDINGS[x].n).slice(0, 14).join(', '));
      [popStr(v), pct(v / Math.max(1, tot)), ...['low', 'mid', 'high'].map(k => pct(JOBS[g][k]))].forEach(x => { const c = r.insertCell(); c.className = 'n'; c.textContent = x; }); });
    b.append(t);
    const sv = el('div', 'card'); sv.style.marginTop = '10px'; sv.append(el('h4', '', 'Serviços públicos'));
    for (const k in SVC) { const v = (n.cov || {})[k] || 0, r = el('div', 'brow'); r.append(el('span', 'e', SVC[k].e), el('span', 'nm', SVC[k].n + ' · ' + svcName(k, curYear())), el('span', 'lv', pct(v))); tip(r, SVC[k].d + '\nEmpregam sobretudo a classe média. A classe média e a alta exigem saúde e educação.'); sv.append(r, bar(v, '#7fc8e0')); }
    b.append(sv); return;
  }
  // culturas e religiões: régua de autonomia de cada povo que não é o principal
  const cul = tab === 'cul', src = (cul ? n.culs : n.rels) || {}, law = cul ? LAWS.culture.o[n.laws.culture] : LAWS.relig.o[n.laws.relig], min = cul ? n.minC || 0 : n.minR || 0, pol = (cul ? n.cpol : n.rpol) || {};
  const slots = cul ? culSlots(n) : relSlots(n), used = Object.values(pol).filter(v => v === 2).length, main = cul ? n.cul : n.relig, msg = el('div', 'msg');
  const nm = k => cul ? CULTURES[k].n + (CULTURES[k].minor ? ' · menor' : '') : RELIGIONS[REL_IDS[k]].e + ' ' + RELIGIONS[REL_IDS[k]].n + (RELIGIONS[REL_IDS[k]].fict ? ' · heresia' : RELIGIONS[REL_IDS[k]].minor ? ' · menor' : '');
  const col = k => cul ? 'rgb(' + hsl((k * .17) % 1, .45, .55).join(',') + ')' : RELIGIONS[REL_IDS[k]].col;
  b.append(kv([[cul ? 'Cultura principal' : 'Fé oficial', nm(main), cul ? 'Nomes, governantes e a cultura para onde as outras se assimilam.' : 'Províncias se convertem a ela aos poucos (templos e Igreja de Estado aceleram).'],
    ['Lei', law.n, law.d + '\nMude em Governo → Leis.'], [cul ? 'Culturas aceitas' : 'Fés reconhecidas', used + ' / ' + slots + ' vagas', cul ? 'Vagas de culturas secundárias: Só a principal 1, Culturas aceitas 3, Multiculturalismo 8; +1 com título de Império.' : 'Vagas de fés reconhecidas: Igreja de Estado 0, Tolerância 1, Liberdade de culto 3, Estado laico 8.'],
    ['Peso das minorias', pct(min) + ' → estabilidade −' + (min * 8).toFixed(1), 'Soma da população de cada minoria × o peso do seu nível de autonomia × a lei.']]));
  b.append(tip(el('p', 'dim', 'Autonomia de cada ' + (cul ? 'cultura' : 'religião') + ': ← mais controle · ⚪ livre no centro · mais direitos → (mudar: 💰' + polCost() + ', −2 de estabilidade; para baixo −4)'), '−2: ' + (cul ? CPOL[-2].n : RPOL_N[-2][0]) + ' — vira escravo (exige escravidão permitida)\n−1: ' + (cul ? CPOL[-1].n : RPOL_N[-1][0]) + ' — assimila/converte 3× mais rápido, mais revoltas\n0: Livre\n+1: ' + (cul ? CPOL[1].n : RPOL_N[1][0]) + ' — metade do peso\n+2: ' + (cul ? CPOL[2].n : RPOL_N[2][0]) + ' — sem peso, ocupa vaga e pode virar ' + (cul ? 'a principal' : 'a oficial')), msg);
  const list = el('div', 'polist');
  Object.entries(src).sort((a, c) => c[1] - a[1]).forEach(([k, v]) => {
    const row = el('div', 'polrow'), isMain = +k === main, cur = pol[k] || 0; row.style.borderLeft = '4px solid ' + col(k);
    const head = el('div', 'polh'); head.append(el('b', '', nm(k) + (isMain ? (cul ? ' (principal)' : ' (oficial)') : '')), el('span', 'dim', popStr(v) + ' · ' + pct(v / P))); row.append(head, bar(v / P, col(k)));
    if (!isMain) {
      const sl = el('div', 'polsl');
      [-2, -1, 0, 1, 2].forEach(lv => { const L = CPOL[lv], name = cul ? L.n : RPOL_N[lv][0], d = cul ? L.d : RPOL_N[lv][1], why = lv === cur ? '' : polWhy(n, tab, k, lv);
        sl.append(btn(L.e + ' ' + name, () => { const e = setPol(n, tab, k, lv); msg.textContent = e; if (!e) refresh(); }, 'sm' + (lv === cur ? ' on' : '') + (lv < 0 ? ' red' : lv === 2 ? ' grn' : ''), lv === cur ? '' : why, name + '\n' + d + '\nPeso como minoria ×' + L.w + (lv === cur ? '\n✔ Atual' : ''))); });
      row.append(sl);
      if (cur === 2) row.append(btn('👑 Tornar ' + (cul ? 'principal' : 'oficial') + ' (💰' + mainCost() + ')', () => { const e = makeMain(n, tab, k); msg.textContent = e; if (!e) refresh(); }, 'sm', n.money < mainCost() ? 'Sem dinheiro' : (n.mainCd || 0) > S.t ? 'Mudança recente (até ' + yearOf(n.mainCd) + ')' : '', 'A ' + (cul ? 'cultura principal atual vira aceita' : 'fé oficial atual vira reconhecida') + '. −15 de estabilidade; uma vez a cada 20 anos.'));
    }
    list.append(row); });
  b.append(list);
}
function techBox(n, t) {
  const s = techState(n, t), cls = s === 'done' || hasT(n, t.id) ? 'done' : s ? 'lock' : 'av', d = el('div', 'tech ' + cls + (n.res === t.id ? ' cur' : '') + (t.v ? ' vt' : ''));
  if (t.v) d.style.borderLeft = '4px solid ' + VERT[t.v].col;
  d.append(el('b', '', (cls === 'done' ? '✓ ' : cls === 'av' ? '▶ ' : '🔒 ') + (t.entry ? VERT[t.v].e + ' ' : '') + t.n)); d.append(el('small', '', t.y + (cls === 'done' ? '' : ' · 🔬' + techCost(n, t)) + (t.entry ? ' · ' + VERT[t.v].n : '') + (fxLines(t.fx)[0] ? ' · ' + fxLines(t.fx)[0].slice(0, 38) : '')));
  if (n.res === t.id) d.append(bar(n.rp / techCost(n, t)));
  const am = aheadMul(t); if (am > 2.8 && cls !== 'done') { d.classList.add('early'); d.append(el('small', 'warn', '⚠ Fora de época: custo ×' + am.toFixed(1))); }
  tip(d, techTip(n, t, s) + (am > 2.8 && cls !== 'done' ? '\n⚠ Fora de época: ' + (t.y - curYear()) + ' anos adiantada, custo ×' + am.toFixed(1) : ''));
  if (!s) d.onclick = () => { n.res = t.id; drawWin(); drawTop(); };
  return d;
}
function milFronts(b, n) {
  const fs = frontsOf(n.id);
  if (!fs.length) { b.append(el('p', 'dim', warsOf(n.id).length ? 'Nenhuma linha de contato com o inimigo: a guerra é além-mar ou longe. Use invasões navais.' : 'Em paz: sem fronts.')); return; }
  b.append(tip(el('p', 'dim', 'Atribua exércitos a um front e dê a ordem: defender espalha as tropas pelos pontos mais ameaçados; avançar concentra tudo no ponto mais fraco do inimigo.'), 'Os fronts são as linhas de contato entre os lados de cada guerra. Mudam sozinhos conforme o território muda de mão.'));
  for (const f of fs) {
    const w = S.wars.find(x => x.id === f.w), foe = nat(f.side === 'A' ? w.d : w.a), list = S.armies.filter(a => a.o === n.id && a.front === f.id);
    const ours = list.reduce((s, a) => s + armyPower(a), 0), theirs = f.foe.reduce((s, q) => s + threatAt(q).filter(x => atWar(n.id, x.o)).reduce((t, x) => t + armyPower(x), 0), 0), ord = fordOf(n.id, f.id);
    const c = el('div', 'card'); c.style.marginTop = '10px';
    c.append(el('h4', '', '🚩 ' + frontName(f) + ' · contra ' + natName(foe)), el('div', 'dim', f.provs.length + ' províncias na linha · ' + list.length + ' exército' + (list.length === 1 ? '' : 's') + ' (' + fmtK(list.reduce((s, a) => s + regs(a), 0)) + ')'));
    c.append(tip(el('div', '', 'Força: ' + Math.round(ours) + ' × ' + Math.round(theirs)), 'Força estimada dos exércitos atribuídos contra os inimigos vistos junto à linha (tipos, tecnologia, veterania, suprimento, cansaço e moral).'), bar(ours / Math.max(1, ours + theirs), ours >= theirs ? '#8fd17f' : '#e5636b'));
    const r = el('div', 'row');
    r.append(btn('🛡️ Defender', () => { setFord(n.id, f.id, 'hold'); frontOrders(n); drawWin(); }, 'sm' + (ord === 'hold' ? ' on' : '')), btn('⚔️ Avançar', () => { setFord(n.id, f.id, 'adv'); frontOrders(n); drawWin(); }, 'sm' + (ord === 'adv' ? ' on' : ''), '', 'Ataca quando a força concentrada passa de 1,2× a defesa do alvo'));
    const sel = R.selArmies.filter(a => a.o === n.id && S.armies.includes(a));
    r.append(btn('➕ Atribuir selecionados (' + sel.length + ')', () => { sel.forEach(a => { if (!a.inv && !a.exp) { a.front = f.id; a.path = []; } }); frontOrders(n); drawWin(); }, 'sm', sel.length ? '' : 'Selecione exércitos no mapa'));
    r.append(btn('➕ Todos os livres', () => { S.armies.filter(a => a.o === n.id && a.front == null && !a.inv && !a.exp && a.p < WD.provs.length).forEach(a => a.front = f.id); frontOrders(n); drawWin(); }, 'sm'));
    r.append(btn('Liberar', () => { list.forEach(a => a.front = null); drawWin(); }, 'sm', list.length ? '' : 'Nenhum exército'));
    c.append(r); b.append(c);
  }
}
function milUnits(b, n) {
  const t = el('table', 't'); const h = t.insertRow(); ['Tropa', 'Fogo', 'Choque', 'Defesa', 'Moral', 'Letal.', 'Mov.', 'Consome'].forEach(x => h.append(el('th', '', x)));
  UT.filter(ty => ty !== 'vrt' || n.vert).forEach(ty => { const r = t.insertRow(), u = r.insertCell(); u.append(tip(el('span', '', unitName(n, ty)), unitTip(n, ty)));
    ['fire', 'shock', 'def'].forEach(k => { const c = r.insertCell(); c.className = 'n'; c.textContent = (unitStat(n, ty, k) * n.up[ty]).toFixed(2); });
    ['mor', 'kill', 'spd'].forEach(k => { const c = r.insertCell(); c.className = 'n'; c.textContent = unitStat(n, ty, k).toFixed(2); });
    const nd = unitNeeds(n, ty); r.insertCell().textContent = Object.keys(nd).map(g => GOODS[g].e).join(' '); });
  b.append(t);
  const c = el('div', 'cols'); c.style.marginTop = '12px';
  const v = el('div', 'card'); v.append(el('h4', '', '🎖️ Veterania')); VET.forEach((x, i) => v.append(tip(el('div', 'brow', x.n + ' · dano ×' + x.m + ' · moral ×' + x.mo), 'A partir de ' + pct(x.x) + ' de experiência'))); v.append(tip(el('small', 'dim', 'Recrutas saem melhores com academias no estado e com recrutamento voluntário.'), 'Lei de recrutamento: voluntários +8% de experiência inicial; mobilização total −6%.')); c.append(v);
  const s2 = el('div', 'card'); s2.append(el('h4', '', '🧰 Apoio')); Object.keys(SUPPORT).forEach(k => s2.append(tip(el('div', 'brow' + (supOk(n, k) ? '' : ' dim'), SUPPORT[k].e + ' ' + supName(n, k) + (supOk(n, k) ? '' : ' (exige ' + TECH[SUPPORT[k].tech].n + ')')), SUPPORT[k].d))); c.append(s2);
  const s3 = el('div', 'card'); s3.append(el('h4', '', '📐 Posturas')); Object.keys(STANCES).forEach(k => s3.append(tip(el('div', 'brow', STANCES[k].e + ' ' + STANCES[k].n), STANCES[k].d + (STANCES[k].beats ? '\nVence ' + STANCES[STANCES[k].beats].n.toLowerCase() : '')))); c.append(s3);
  b.append(c);
  b.append(tip(el('p', 'dim', 'Largura de combate ' + (WIDTH_BASE + n.fx.width) + ' (× terreno) · linha de suprimento ' + logiRange(n) + ' províncias · ' + shipCap(n) + ' regimento(s) por navio'), 'Largura e logística sobem com tecnologias militares e de transporte.'));
}
function winMil(b) {
  const n = me(), P = WD.provs.length, msg = el('div', 'msg'), tab = tabs(b, 'milTab', [['army', '⚔️ Exército'], ['fronts', '🚩 Fronts'], ['units', '📋 Tropas e doutrina']]);
  if (tab === 'fronts') { milFronts(b, n); return; }
  if (tab === 'units') { milUnits(b, n); return; }
  const c = el('div', 'cols');
  const pw = el('div', 'card'); pw.append(el('h4', '', 'Exército'));
  const t = el('table', 't'); const h = t.insertRow(); ['Tipo', 'Unidade', 'Fogo / choque', 'Custo', ''].forEach(x => h.append(el('th', '', x)));
  ['inf', 'cav', 'art', 'vrt'].filter(ty => ty !== 'vrt' || n.vert).forEach(ty => { const r = t.insertRow(); r.insertCell().textContent = { inf: 'Infantaria', cav: 'Cavalaria', art: 'Artilharia', vrt: 'Vertente' }[ty]; const u = r.insertCell(); u.textContent = unitName(n, ty); tip(u, unitTip(n, ty)); const f = r.insertCell(); f.className = 'n'; f.textContent = (n.up[ty] * unitStat(n, ty, 'fire')).toFixed(1) + ' / ' + (n.up[ty] * unitStat(n, ty, 'shock')).toFixed(1); const co = r.insertCell(); co.className = 'n'; co.textContent = '💰' + recCost(n, ty); r.insertCell().append(btn('+1 na capital', () => { msg.textContent = recruit(n, ty, 1); refresh(); }, 'sm', canRecruit(n, ty, 1))); });
  pw.append(t, msg); c.append(pw);
  const st = el('div', 'card'); st.append(el('h4', '', 'Forças'), kv([['Regimentos', fmtK(S.armies.filter(a => a.o === n.id).reduce((s, a) => s + regs(a), 0))], ['Contingente', Math.floor(n.manpower) + 'k / ' + Math.floor(n.mpMax || 0) + 'k'], ['Navegação', n.fx.sea === 2 ? 'Oceânica' : n.fx.sea ? 'Costeira' : 'Nenhuma', 'Costeira: mares junto à terra. Oceânica (Caravela): mar aberto.'], ['Cerco', '×' + n.up.siege.toFixed(1)]]), modChips({ army: n.m.army, manpower: n.m.manpower, speed: n.m.speed })); c.append(st);
  const nv = el('div', 'card'); nv.append(el('h4', '', 'Marinha · ' + shipName(n)));
  const ports = provsOf(n.id).filter(p => WD.provs[p].coast && S.ctrl[p] === n.id).sort((a, b) => (S.bld[WD.provs[b].state].port || 0) - (S.bld[WD.provs[a].state].port || 0));
  nv.append(kv([['Navios', Math.ceil(S.fleets.filter(f => f.o === n.id).reduce((s, f) => s + f.ships, 0)) + ''], ['Transporte', Math.floor(transportCap(n.id)) + ' regimentos', shipCap(n) + ' regimento(s) por navio; sobe com Coca, Galeão, Vapor, Dreadnought...'], ['Força por navio', n.fx.ship.toFixed(1)], ['Custo', '💰' + shipCost(n) + ' por navio']]));
  if (ports.length && n.fx.sea) {
    const sel = el('select'); ports.slice(0, 60).forEach(p => sel.append(new Option(WD.provs[p].n + ' (' + WD.states[WD.provs[p].state].n + ')', p)));
    const row = el('div', 'row'); [1, 3, 10].forEach(k => row.append(btn('+' + k + ' ' + shipName(n), () => { const e = buildShips(n, k, +sel.value); msg.textContent = e; if (!e) refresh(); }, 'sm', n.money < shipCost(n) * k ? 'Sem dinheiro' : '', 'Prontos em 4 meses no mar ao lado do estaleiro')));
    nv.append(el('small', 'dim', 'Estaleiro'), sel, row);
  } else nv.append(el('p', 'dim', n.fx.sea ? 'Sem litoral.' : 'Exige Barcos longos.'));
  c.append(nv);
  b.append(c);
  const sup = el('div', 'card'); sup.style.marginTop = '12px'; const asat = n.armySat == null ? 1 : n.armySat;
  sup.append(tip(el('h4', '', '📦 Suprimentos do exército · ' + pct(asat)), 'Cada tipo de tropa consome os próprios bens (armas, comida, roupas, cavalos, ferro, aço, petróleo...) e as companhias de apoio também.\nSem suprimentos a força em batalha cai até 40%; longe da linha de suprimento, só metade chega.'), bar(asat, asat < .8 ? '#e5636b' : '#8fd17f'));
  const tsr = el('div', 'chips'); UT.filter(t => t !== 'vrt' || n.vert).forEach(t => { const v = (n.tsat || {})[t] ?? 1; tsr.append(tip(el('span', 'chip ' + (v < .8 ? 'n' : 'p'), unitName(n, t) + ' ' + pct(v)), unitTip(n, t))); }); sup.append(tsr);
  const AD = armyDemand(n).d, sr = el('div', 'chips'); Object.keys(AD).forEach(g => sr.append(tip(el('span', 'chip ' + ((n.mk.sat[g] ?? 1) < .8 ? 'n' : 'p'), GOODS[g].e + ' ' + GOODS[g].n + ' ' + pct(n.mk.sat[g] ?? 1)), GOODS[g].n + ': atendido ' + pct(n.mk.sat[g] ?? 1) + '\n' + goodUsers(g)))); sup.append(sr); b.append(sup);
  const at = el('table', 't'); at.style.marginTop = '12px'; const hh = at.insertRow(); [['Força', ''], ['Local', ''], ['Tropas', ''], ['Veterania', 'Recruta, Regular, Veterano, Experiente e Elite'], ['General', 'Cada exército pode ter um general: marcial e traços mudam a força em batalha e nos cercos.'], ['Moral', 'Cai em batalha; recupera fora de combate'], ['', '']].forEach(([x, t]) => hh.append(tip(el('th', '', x), t)));
  S.armies.filter(a => a.o === n.id).forEach((a, i) => { const r = at.insertRow(); r.insertCell().textContent = (a.exp ? '🧭 ' : '⚔️ ') + (i + 1); r.insertCell().textContent = a.p < P ? WD.provs[a.p].n : WD.seas[a.p - P].n; r.insertCell().textContent = ['inf', 'cav', 'art', 'vrt'].filter(t => a[t] > .05).map(t => fmtK(a[t]) + ' ' + unitName(n, t)).join(', ');
    const vc = r.insertCell(); vc.append(tip(el('span', '', VET[vetLv(a)].n + (Object.keys(a.sup || {}).length ? ' ' + Object.keys(a.sup).map(k => SUPPORT[k].e).join('') : '')), vetTip(a)));
    const g = r.insertCell(); if (a.gen) { g.append(tip(el('span', 'gold', '★ ' + charName(a.gen) + ' (' + sgn(genMul(a.gen) - 1) + ')'), genTip(a.gen))); } g.append(btn(a.gen ? 'Trocar' : 'Nomear', () => genPick(a), 'sm', n.money < genCost() ? 'Sem dinheiro' : '', 'Escolha entre 3 candidatos (💰' + genCost() + ')'));
    const m = r.insertCell(); m.style.width = '90px'; m.append(bar(a.mor, '#7fe08a')); r.insertCell().append(btn('Ver', () => { closeWin(); select('army', a.id); centerOn(...armyXY(a)); }, 'sm')); });
  S.fleets.filter(f => f.o === n.id).forEach((f, i) => { const r = at.insertRow(); r.insertCell().textContent = '⛵ ' + (i + 1); r.insertCell().textContent = WD.seas[f.z].n; r.insertCell().textContent = Math.ceil(f.ships) + ' ' + shipName(n) + ' · leva ' + Math.floor(fleetCap(f)) + 'k'; r.insertCell(); r.insertCell().textContent = f.auto ? '🧭' : f.inv ? '⚓' : ''; r.insertCell(); r.insertCell().append(btn('Ver', () => { closeWin(); select('fleet', f.id); centerOn(...fleetXY(f)); }, 'sm')); });
  b.append(at);
}
/* espaço: foguete da vertente, satélites, missões à lua e civilizações alienígenas */
function drawMoon(cv, M, known) {
  const c = cv.getContext('2d'), w = cv.width, h = cv.height, r = Math.min(w, h) * .42; c.clearRect(0, 0, w, h);
  c.fillStyle = '#05070d'; c.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(255,255,255,' + (.2 + (i * 37 % 10) / 14) + ')'; c.fillRect((i * 97) % w, (i * 53) % h, 1.5, 1.5); }
  const g = c.createRadialGradient(w / 2 - r * .35, h / 2 - r * .35, r * .1, w / 2, h / 2, r); g.addColorStop(0, known ? M.col : '#555'); g.addColorStop(1, '#000');
  c.fillStyle = g; c.beginPath(); c.arc(w / 2, h / 2, r, 0, Math.PI * 2); c.fill();
  if (known) { c.save(); c.beginPath(); c.arc(w / 2, h / 2, r, 0, Math.PI * 2); c.clip(); M.craters.forEach(([x, y, s]) => { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(w / 2 + x * r, h / 2 + y * r, s * r, 0, Math.PI * 2); c.fill(); }); if (M.life === 'complex' || M.life === 'intel') { c.fillStyle = 'rgba(70,160,60,.35)'; M.craters.slice(0, 5).forEach(([x, y, s]) => { c.beginPath(); c.arc(w / 2 - y * r, h / 2 + x * r, s * r * 1.6, 0, Math.PI * 2); c.fill(); }); } c.restore(); }
  else { c.fillStyle = '#ddd'; c.font = '700 40px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', w / 2, h / 2); }
}
function winSpace(b) {
  const n = me(), M = S.moon, known = !!M.known[n.id], rk = ROCKETS[n.vert || 'none'], msg = el('div', 'msg');
  const top = el('div', 'cols');
  const mc = el('div', 'card'), cv = el('canvas'); cv.width = 320; cv.height = 220; cv.className = 'moon'; drawMoon(cv, M, known); mc.append(el('h4', '', '🌑 ' + (known ? M.n : 'Lua desconhecida')), cv);
  if (known) mc.append(kv([['Tipo', M.type], ['Gravidade', M.grav + 'g'], ['Vida', { none: 'Nenhuma', micro: 'Microscópica', complex: 'Fauna e flora complexas', intel: 'Inteligente' }[M.life]], ['Bases', Object.keys(M.base).filter(k => M.base[k]).map(k => nat(+k).name).join(', ') || '—']]));
  else mc.append(el('p', 'dim', 'Envie uma sonda para descobrir o que há lá.'));
  top.append(mc);
  const pc = el('div', 'card'); pc.append(el('h4', '', '🚀 Programa espacial · ' + rk), kv([['Centro de lançamento', launchOk(n) ? 'Sim' : 'Não', 'Construa um Centro de lançamento num estado' + (n.vert === 'space' ? ' (ou um Porto espacial)' : '')], ['Satélites', (n.sats || 0) + ' / 20', 'Cada satélite: pesquisa +1%, comércio +0,5%'], ['Em órbita no mundo', S.nations.reduce((a, x) => a + (x.sats || 0), 0) + '']]));
  if (n.sproj) pc.append(el('div', 'gold', SPACE[n.sproj.k].n + ' · ' + n.sproj.m + ' meses'), bar(1 - n.sproj.m / n.sproj.tot));
  const r = el('div', 'row'); Object.entries(SPACE).forEach(([k, d]) => r.append(btn(d.n + ' (💰' + spaceCost(k) + ')', () => { const e = spaceGo(n, k); msg.textContent = e; if (!e) refresh(); }, 'sm', canSpace(n, k), { sat: 'Pesquisa +1% e comércio +0,5%', probe: 'Revela a lua e se há vida', land: '+10 de estabilidade e glória', base: 'Pesquisa +5% e 2 de Hélio-3 por mês' }[k])));
  pc.append(r, msg); top.append(pc); b.append(top);
  if (known && M.life === 'intel') {
    const cc = el('div', 'card'); cc.style.marginTop = '12px'; cc.append(el('h4', '', '👽 Civilizações de ' + M.n));
    M.civs.forEach((c, i) => { const row = el('div', 'brow'); row.append(el('span', 'nm', c.n + ' · ' + ALIEN_ERAS[c.era] + (c.subj != null ? ' · subjugada por ' + nat(c.subj).name : c.aggro ? ' · agressiva' : ' · pacífica')), el('span', 'lv', 'rel ' + (c.rel[n.id] || 0)));
      tip(row, 'Poder estimado: ' + c.pow + (c.aggro && c.era >= 4 ? '\nPode atacar bases lunares' + (c.era >= 7 ? ' e a Terra' : '') : '')); cc.append(row);
      const rr = el('div', 'row'); [['gift', '🎁 Presente'], ['trade', '⚖️ Comércio'], ['war', '⚔️ Ofensiva']].forEach(([k, t]) => rr.append(btn(t, () => { const e = alienAct(n, i, k); msg.textContent = e; refresh(); }, 'sm', hasT(n, 'spc_contact') ? '' : 'Exige Protocolos de contato', { gift: '+25 de relação', trade: 'Pesquisa +5% (exige confiança)', war: 'Exige base lunar; se vencer, subjuga a civilização' }[k]))); cc.append(rr); });
    b.append(cc);
  }
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
  if (S.conf) { const w = S.wars.find(x => x.id === S.conf.w); UI.peaceL = S.conf.L; UI.peacePick = null; S.conf = null; if (w) { UI.speed = 0; drawTop(); (S.evq = S.evq || []).push({ t: '🏳️ O inimigo capitulou', m: 'Escolha os termos: estados, vassalagem ou reparações, com os pontos da rendição deles.' }); openWin('peace', w.id); } }
  if (S.evq && S.evq.length && S.evq[0].ev) { const ev = S.evq[0], n = me(), d = EVENT[ev.ev]; if (UI.speed) UI.resume = UI.speed; UI.speed = 0; drawTop();   // pausa e, depois da escolha, volta à velocidade de antes   // evento com escolhas: fica na fila até escolher
    if (!d || n.evWait !== ev.ev) { S.evq.shift(); return; }
    modal(m => { m.append(el('h2', '', ev.t), el('p', '', ev.m)); const r = el('div', 'col evopts'), ok = evOpts(n, d);
      d.opts.forEach(o => { const k = ok.indexOf(o), t = fxTxt(o.fx).join('\n') || 'Sem efeito';
        r.append(btn(o.n, () => { chooseEvent(n, ev.ev, k); closeModal(); refresh(); if (UI.resume) { setSpeed(UI.resume); UI.resume = 0; } }, '', k < 0 ? condFail(n, o.when).join(', ') : '', t)); });
      m.append(r); }); return; }
  if (S.evq && S.evq.length) { const ev = S.evq.shift(); UI.speed = 0; drawTop();
    modal(m => { m.append(el('h2', '', ev.t), el('p', '', ev.m)); const r = el('div', 'row'); if (ev.quar) r.append(btn('🚧 Decretar quarentena (💰' + quarCost(me()) + ')', () => { const e = quarantine(me()); if (e) say(e, 'bad'); else log('Quarentena decretada por dois anos.', 'info', [S.player]); closeModal(); refresh(); }, 'red', '', 'Contágio nas suas províncias cai 70% por 2 anos; comércio −30%')); r.append(btn('Que assim seja', closeModal)); m.append(r); }); return; }
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
    m.append(el('h2', '', 'Proposta de paz'), el('p', '', natName(o.winner != null ? nat(o.winner) : e) + (o.winner == null ? ' propõe paz branca.' : ' exige: ' + termsTxt(n.id, o.t) + '.')));
    m.append(el('p', 'dim', 'Recusar mantém a guerra; se sua rendição chegar a 100%, eles tomam o que quiserem.'));
    const r = el('div', 'row'); r.append(btn('Aceitar', () => { separatePeace(w, o.L ?? S.player, o.winner, o.t); closeModal(); refresh(); }, 'grn'), btn('Recusar', closeModal, 'red')); m.append(r);
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
    let fail = 0, inv = 0, why = ''; mine.forEach(a => { if (a.inv) cancelInvasion(a); if (orderArmy(a, to)) { a.front = null; return; } if (to < P && WD.provs[to].coast) { const e = planInvasion(n, a, to); if (!e) { inv++; return; } why = e; } fail++; });
    if (inv) say('Invasão planejada: o exército marcha ao porto, embarca e navega até ' + WD.provs[to].n + '.', 'good');
    if (fail) say('Sem caminho até lá para ' + fail + ' exército' + (fail > 1 ? 's' : '') + (why ? ' (' + why + ')' : '') + '.', 'bad'); drawSide();
  } else if (R.selFleet && R.selFleet.o === n.id) {
    const z = WD.sea[i]; if (z < 0) return; R.selFleet.auto = false; if (!orderFleet(R.selFleet, z)) say(!n.exZ[z] && !seaExploreOk(n) ? 'Navegar até mares desconhecidos exige Bússola.' : n.fx.sea < 2 && WD.seas[z].deep ? 'Oceano aberto exige Caravela.' : 'Sem rota até esse mar.', 'bad'); drawSide();
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

/* depuração: #dbg&seed=N&days=D&win=tech&mode=pol&z=2&war=D&prov=1&setup=1&chron=1&ctx=1&council=1&vert=steam&ev=comet&front=adv&army=1&occ=1&vass=vassal abre direto numa partida (testes e screenshots) */
(() => {
  const q = new URLSearchParams(location.hash.slice(1)); if (!q.has('dbg')) return;
  newGame(+q.get('seed') || 7, +q.get('start') || START_YEAR); const main = S.nations.filter(n => n.kind === (q.get('kind') || 'main')).sort((a, b) => provsOf(b.id).length - provsOf(a.id).length)[0];
  S.player = main.id; if (q.get('vert')) { main.techs['v_' + q.get('vert')] = 1; main.vert = q.get('vert'); calcMods(main); }
  for (let d = 0; d < (+q.get('days') || 0); d++) advanceDay();
  if (q.has('war')) {
    const nb = new Set(); provsOf(main.id).forEach(p => WD.provs[p].adj.forEach(o => { if (S.own[o] >= 0 && S.own[o] !== main.id) nb.add(S.own[o]); }));
    const t = nat(nb.size ? [...nb][0] : S.nations.filter(x => x.alive && x.id !== main.id && x.kind === 'main')[0].id); declareWar(main, t, null); S.calls = [];
    if (q.get('occ')) provsOf(t.id).forEach(p => S.ctrl[p] = main.id);
    if (q.get('vass')) { separatePeace(S.wars[S.wars.length - 1], t.id, main.id, { provs: [], subj: q.get('vass'), rep: false }); }
    if (q.get('front')) { frontsTick(); S.t += 0; for (let d = 0; d < 6; d++) advanceDay(); const f = frontsOf(main.id)[0]; if (f) { S.armies.filter(a => a.o === main.id).forEach(a => { a.front = f.id; a.sup = { recon: 1, med: 1 }; }); setFord(main.id, f.id, q.get('front')); } }
    else S.armies.filter(a => a.o === main.id).forEach(a => orderArmy(a, provsOf(t.id).find(p => WD.provs[p].adj.some(o => S.own[o] === main.id))));
    for (let d = 0; d < +q.get('war'); d++) advanceDay();
  }
  if (q.get('plague')) { const y0 = S.t; S.t = 360 * (1361 - START_YEAR); for (let d = 0; d < +q.get('plague'); d++) advanceDay(); }
  S.offer = null; S.calls = []; S.dipOffers = [];
  startPlay(false); if (q.get('mode')) { R.mode = q.get('mode'); drawModes($('#modes'), true); if (R.mode === 'res') select('res'); }
  if (q.get('z')) { R.cam.z = +q.get('z'); centerOn(WD.provs[main.capital].cx * K, WD.provs[main.capital].cy * K); }
  if (q.get('tab')) UI[q.get('win') + 'Tab'] = q.get('tab');
  if (q.get('army')) { const a = S.armies.find(a => a.o === main.id); if (a) { select('army', a.id); centerOn(...armyXY(a)); } }
  if (q.get('win')) openWin(q.get('win'), q.get('win') === 'peace' && warsOf(main.id)[0] ? warsOf(main.id)[0].id : undefined);
  if (q.get('prov')) { if (q.get('prod')) UI.prodOpen = WD.provs[main.capital].state; select('prov', main.capital); }
  if (q.get('box')) select('armies', S.armies.filter(a => a.o === main.id).map(a => a.id));
  if (q.get('chron')) { UI.chron = true; drawChron(); drawTop(); }
  if (q.get('ctx')) { const p = provsOf(main.id).map(p => WD.provs[p].adj.find(o => S.own[o] >= 0 && S.own[o] !== main.id)).find(x => x != null); const [sx, sy] = toScreen(WD.provs[p].cx * K, WD.provs[p].cy * K); ctxMenu(sx, sy, p); }
  if (q.get('council')) councilPick('marshal', 'Marechal');
  if (q.get('ev')) { const n = me(), ev = EVENT[q.get('ev')]; if (ev) { n.evWait = ev.id; notify(n.id, ev.e + ' ' + ev.t, fillTxt(n, ev.m), { ev: ev.id }); pendingModals(); } }
  if (q.get('setup')) { S.player = -1; show('setup'); R.view = -1; S.mapDirty = true; fitCam(); setupCard(main.id); drawModes($('#s-modes')); }
  if (q.get('year')) { S.t = 360 * (+q.get('year') - START_YEAR); TECHS.forEach(t => { if (!t.v && t.y <= +q.get('year')) main.techs[t.id] = 1; }); main.money = 1e5; calcMods(main); econAll(); calcMods(main); if (q.get('moon')) { S.moon.known[main.id] = 1; S.moon.life = 'intel'; if (!S.moon.civs.length) S.moon.civs = [{ n: 'Xelari', era: 6, aggro: true, pow: 900, rel: {} }, { n: 'Oumu', era: 2, aggro: false, pow: 60, rel: {} }]; } drawTop(); if (UI.win) drawWin(); }
  if (q.get('scroll')) $('#win-b').scrollTop = 1e6;
  if (q.get('tip')) { const t = document.querySelector(q.get('tip')), r = t.getBoundingClientRect(); t.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); document.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 5, clientY: r.bottom - 5 })); }
  rebuildMap(); drawFrame(); drawMini(MINI);
})();

{ const ve = validateData(); if (ve.length) console.warn('Grand Chronicle: dados inválidos\n' + ve.join('\n')); }
