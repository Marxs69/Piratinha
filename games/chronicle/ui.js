/* Grand Chronicle — interface: menu, escolha do mundo e da nação, barra do topo, painéis, janelas, descrições ao passar o mouse,
   minimapa, crônica, menu do botão direito (diplomacia) e o laço do tempo.
   Mapa: arrastar com o botão esquerdo seleciona tropas em área · botão direito move as tropas selecionadas (sem tropas: ações com o país)
   · arrastar com o botão direito/do meio ou WASD move a câmera · roda dá zoom. */
'use strict';

const $ = s => document.querySelector(s);
const SPEEDS = [0, 1, 3, 8, 18, 36];                        // dias por segundo (5× ≈ 1 ano a cada 10 s: partida de 860 a 2200 em ~4 h)
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

/* ações do jogador: sempre por comando (sim/cmd.js). No multiplayer, como cliente, vão para o anfitrião (net.js) */
function act(c, ...a) { if (typeof NET !== 'undefined' && NET.client) { NET.cmd(c, a); return ''; } return runCmd(S.player, c, a); }
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
  if (d.fx) Object.entries(d.fx).forEach(([k, v]) => { const t = { tax: 'Impostos do país +' + +(v * 100).toFixed(1) + '% (até +' + BFX_CAP.tax * 100 + '%)', fort: 'Fortificação +' + v, port: 'Porto: frotas e comércio', trade: 'Comércio +' + Math.round(v * 100) + '% (até +' + BFX_CAP.trade * 100 + '%)', research: 'Pesquisa +' + v + '/mês', stab: 'Estabilidade +' + v + ' (até +' + BFX_CAP.stab + ')', ferv: 'Fervor desejado +' + v + ' (até +' + BFX_CAP.ferv + ')', prod: 'Produção do estado +' + Math.round(v * 100) + '%', speed: 'Tropas ' + Math.round(v * 100) + '% mais rápidas no estado', infra: 'Estrada no mapa ligando estados vizinhos', rail: 'Trilhos no mapa ligando estados vizinhos', frt: 'Frete entre estados mais barato (insumos chegam com menos perda)', svcP: v && typeof v === 'object' ? Object.entries(v).filter(([x]) => SVC[x]).map(([x, k]) => SVC[x].n + ' (' + Math.round(k * 100) + '% de um prédio de serviço)').join(', ') : '', boost: v && typeof v === 'object' ? Object.entries(v).filter(([x]) => BUILDINGS[x]).map(([x, k]) => BUILDINGS[x].n + ' do estado +' + Math.round(k * 100) + '% por nível').join('; ') : '', sub: 'Subsistência do estado +' + Math.round(v * 100) + '% por nível', pipe: 'Aparece no mapa', svc: SVC[v] ? SVC[v].n + ': cada nível atende ' + Math.round(SVC_CAP(curYear())) + ' mil pessoas (' + SVC[v].d.toLowerCase() + ')' : '', yard: 'Navios ' + Math.round(v * 100) + '% mais baratos neste estado', mp: 'Contingente +' + Math.round(v * 100) + '%', rec: 'Recrutas ' + v + ' mês mais rápidos aqui', army: 'Força militar +' + Math.round(v * 100) + '%', launch: 'Lança foguetes e satélites' }[k]; if (t) o.push(t); });
  if (d.tl) o.push('Usa ' + d.tl + ' de Ferramentas: sem elas rende até 20% menos');
  if (d.in) for (const g in d.in) if (GOODS[g].y0) o.push(GOODS[g].n + ' só é consumida a partir de ' + GOODS[g].y0);
  const J = JOBS[jobGroup(b)]; o.push(d.w + ' mil empregos por nível (' + JOB_N[jobGroup(b)].toLowerCase() + ': ' + CLASS_IDS.filter(k => J[k]).map(k => Math.round(J[k] * 100) + '% ' + CLASSES[k].n.toLowerCase()).join(', ') + ') · ' + bMonths(b) + ' meses de obra');
  if (d.slave) o.push('Aceita escravos (se a lei permitir): até +25% de produção');
  if (d.req) o.push('Exige: ' + (REQS[d.req] ? REQS[d.req].n : 'recurso ' + (GOODS[d.req.slice(4)] || {}).n));
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
  const o = [t.n + ' · ' + t.y + ' · ' + (t.c === 'vert' ? VERT[t.v].n + ' (' + CATS[t.area] + ')' : CATS[t.c] || '')];
  if (t.entry) { const v = VERT[t.v], dm = {}; for (const k in v.m) dm[k] = v.m[k] * VERT_DECLINE; o.push('Ponto inicial de ' + v.e + ' ' + v.n + '. Ao concluir, você decide:', '· Manter: as técnicas comuns depois de ' + v.entry.y + ' viram versões ' + v.n + ' (a área ' + CATS[v.entry.c] + ' fica trancada nelas) e abre a aba de melhorias próprias.', '· Bônus: segue a via comum e leva ' + modLines(dm).join(', '), 'Exige ' + needName(t.v) + ' no território ou numa província vizinha'); }
  if (t.vr) o.push('Versão ' + VERT[t.v].n + ' de ' + TECH[t.vr].n);
  o.push(...fxLines(techFx(t)));
  if (t.vt) o.push('Melhoria própria de ' + VERT[t.v].n + ' · ' + n.vlv + '/' + VERT[t.v].len + ' (todas liberam ' + VERT[t.v].unit[0] + ' e a frota especial)');
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
$('#m-join').onclick = () => joinRoomModal();
$('#m-new').onclick = () => { show('setup'); $('#s-seed').value = (Math.random() * 1e9 | 0) + ''; genWorld(); };
$('#m-cont').onclick = () => { let ok = false; try { ok = loadGame(); } catch (e) { console.error(e); } if (ok) startPlay(false); else { S = null; say('Não foi possível carregar: o save é de outra versão ou está corrompido.', 'bad'); } };
$('#s-back').onclick = () => { S = null; menu(); };
$('#s-gen').onclick = () => { $('#s-seed').value = (Math.random() * 1e9 | 0) + ''; genWorld(); };
$('#s-seed').onchange = () => genWorld();
$('#s-era').onchange = () => genWorld();
tip($('#s-era').parentElement, 'Ano de início: em eras avançadas os países já começam com as tecnologias, governos, prédios, colônias e vertentes da época');
function genWorld() {
  $('#s-load').hidden = false; $('#s-card').innerHTML = '';
  setTimeout(() => {
    const seed = parseInt($('#s-seed').value, 10) || 1;
    try { newGame(seed, +$('#s-era').value || START_YEAR); } catch (e) { console.error(e); $('#s-load').hidden = true; S = null; say('Erro ao gerar este mundo (' + e.message + '). Tente outra semente.', 'bad'); return; }
    terrRGB = null; R.view = -1; R.mode = 'pol'; R.sel = null; R.selArmies = []; R.selFleet = null;
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
  if (n.vert || VERTS.some(v => v.entry.y <= (n.techY || curYear()))) {
    const vb = el('div', 'card'); vb.append(el('h4', '', 'Vertente: ' + (n.vert ? VERT[n.vert].e + ' ' + VERT[n.vert].n : 'nenhuma')));
    if (n.vert) vb.append(tip(el('small', 'dim', 'Tropas: ' + ['inf', 'cav', 'art'].map(t => unitName(n, t)).join(', ')), techTip(n, TECH['v_' + n.vert])));
    const sel = el('select'); sel.append(new Option('Nenhuma (árvore normal)', ''));
    VERTS.filter(v => v.entry.y <= (n.techY || curYear())).forEach(v => { const ok = vo.includes(v), o = new Option(v.e + ' ' + v.n + ' (desde ' + v.entry.y + ')' + (ok ? '' : ' — falta ' + needName(v.id)), v.id); o.disabled = !ok; sel.append(o); }); sel.value = n.vert || '';   // as já alcançadas; sem o recurso, aparece mas não dá para escolher
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

/* ---------- multijogador (net.js): abrir e entrar em salas ---------- */
const roomCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();
/* painel da sala: jogadores (com o país de cada um) e chat; o anfitrião pode expulsar */
function drawRoom() {
  const r = $('#room'); r.hidden = !UI.room || !(NET.host || NET.client) || UI.scr !== 'game'; if (r.hidden) return; NET.unread = 0;
  r.innerHTML = ''; const h = el('header'); h.append(el('b', '', '🌐 Sala ' + NET.code.toUpperCase()), btn('✕', () => { UI.room = false; drawRoom(); drawTop(); }, 'x sm')); r.append(h);
  const pl = el('div', 'rplayers'); NET.players().forEach(p => { const n = nat(p.pid), row = el('div', 'rp');
    if (n) row.append(flagImgEl(n.flag)); row.append(el('b', '', p.name + (p.host ? ' 👑' : '') + (p.pid === S.player ? ' (você)' : '')), el('small', 'dim', n ? natName(n) : '—'));
    if (NET.host && p.peer) row.append(btn('Expulsar', () => { NET.kick(p.peer); drawRoom(); drawTop(); }, 'sm red', '', 'Tira o jogador da sala; o país volta para a IA'));
    pl.append(row); }); r.append(pl);
  const log0 = el('div', 'rchat'); NET.chat.forEach(l => log0.append(el('div', l.sys ? 'rl sys' : 'rl', (l.at ? l.at + ' · ' : '') + (l.sys ? l.m : l.from + ': ' + l.m)))); r.append(log0);
  const inp = el('input'); inp.placeholder = 'Mensagem…'; inp.maxLength = 300; const send = () => { NET.say(inp.value); inp.value = ''; inp.focus(); };
  inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') send(); }; const row = el('div', 'row'); row.append(inp, btn('Enviar', send, 'sm')); r.append(row);
  log0.scrollTop = log0.scrollHeight; if (UI.roomFocus) { inp.focus(); UI.roomFocus = false; }
}
function netHooks() {
  NET.onChat = () => { if (!S || UI.scr !== 'game') return; if (UI.room) { const f = document.activeElement && document.activeElement.closest && document.activeElement.closest('#room'); UI.roomFocus = !!f; drawRoom(); } else drawTop(); };
  NET.onInfo = m => say(m, 'info');
  NET.onPauseReq = who => { say(who + ' pediu pausa.', 'info'); };
  NET.onClosed = () => { NET.close(); UI.room = false; drawRoom(); S = null; menu(); say('A sala foi fechada.', 'bad'); };
}
function hostRoomModal() {
  netHooks(); const code = roomCode();
  modal(m => { m.append(el('h2', '', '🌐 Abrir sala'), el('p', '', 'Você será o anfitrião: só o seu jogo simula e você controla a velocidade e a pausa.'), el('p', 'dim', 'Mande o código para os amigos (Entrar numa sala, no menu inicial). Código começando com LOCAL testa entre abas do mesmo navegador.'));
    const inp = el('input'); inp.value = code; inp.maxLength = 16; const r = el('div', 'row');
    const nm = el('input'); nm.placeholder = 'Seu nome'; nm.maxLength = 24;
    r.append(btn('Abrir', async () => { try { await NET.openRoom(inp.value.trim() || code, null, nm.value.trim() || 'Anfitrião'); closeModal(); say('Sala ' + NET.code.toUpperCase() + ' aberta.', 'good'); drawTop(); } catch (e) { say('Não foi possível abrir a sala: ' + e.message, 'bad'); } }, 'grn'), btn('Cancelar', closeModal));
    m.append(inp, nm, r); });
}
function joinRoomModal() {
  netHooks();
  modal(m => { m.append(el('h2', '', '🌐 Entrar numa sala'), el('p', 'dim', 'Peça o código ao anfitrião. Você escolhe um país livre e joga na partida dele.'));
    const code = el('input'), nm = el('input'); code.placeholder = 'Código da sala'; nm.placeholder = 'Seu nome'; nm.maxLength = 24; const msgEl = el('div', 'msg'), list = el('div', 'col');
    NET.onLobby = L => { list.innerHTML = ''; msgEl.textContent = L.why || ('Partida em ' + L.year + (L.host ? ' · anfitrião: ' + L.host : '') + (L.players && L.players.length ? ' · na sala: ' + L.players.join(', ') : '') + ' — escolha um país:');
      (L.nations || []).slice(0, 60).forEach(x => list.append(btn((x.was ? '↩ ' : '') + x.name + ' · ' + x.provs + ' províncias · ' + x.gov + (x.was ? ' · era de ' + x.was : ''), () => { NET.pick(x.id); msgEl.textContent = 'Entrando…'; }, 'sm' + (x.was ? ' grn' : '')))); };
    NET.onState = () => { if (UI.scr !== 'game') { closeModal(); startPlay(false); } else { refresh(); drawRoom(); } S.mapDirty = true; };
    const r = el('div', 'row'); r.append(btn('Conectar', async () => { msgEl.textContent = 'Procurando a sala…'; try { await NET.join(code.value.trim(), nm.value.trim() || 'Jogador'); } catch (e) { msgEl.textContent = 'Falhou: ' + e.message; } }, 'grn'), btn('Cancelar', () => { if (NET.client) NET.close(); closeModal(); }));
    m.append(code, nm, r, msgEl, list); });
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
/* transição de era: faixa que aparece e some sozinha (não bloqueia cliques nem pausa) */
function eraFlash(name) { const d = el('div', 'erafx'); d.append(el('small', '', 'Nova era'), el('b', '', name)); document.body.append(d); setTimeout(() => d.remove(), 3800); }
function drawTop() {
  const t = $('#top'), n = me(); t.innerHTML = '';
  if (UI.eraNat !== n.id) { UI.eraNat = n.id; UI.era = n.era || 0; } else if ((n.era || 0) > UI.era) { UI.era = n.era; eraFlash(ERAS[n.era][1]); }
  const f = flagEl(n.flag, 'flag'); tip(f, 'Bandeira: clique para editar (💰' + flagCost() + ')'); f.onclick = () => openWin('flag'); t.append(f);
  const nm = el('div', 'nname'); nm.append(el('b', '', natName(n)), el('small', '', titleOf(n) + ' ' + charName(n.ruler))); tip(nm, GOVS[n.gov].n + ' · ' + IDEOS[n.ideo].n + (n.senior != null ? '\n' + (n.subj ? SUBJECTS[n.subj.tier].n : 'Súdito') + ' de ' + natName(nat(n.senior)) : '')); t.append(nm);
  /* cada número da barra leva à aba dele (pelo rótulo ou pelo ícone) */
  const CLK = { 'domínio': ['gov', 'gov'], 'população': ['pop', 'cls'], 'estabilidade': ['gov', 'mods'], 'pressão': ['gov', 'council'], 'rebeldes': ['mil', 'army'], 'em guerra': ['mil', 'fronts'], 'em paz': ['mil', 'army'] },
    ICLK = { '👑': ['gov', 'gov'], '💰': ['eco', 'over'], '🔬': ['tech', null] };
  const goW = ([w, tab]) => () => { if (tab) UI[w + 'Tab'] = tab; openWin(w); };
  const res = (v, s, tt, cls = '', sc = '', click) => { const d = el('div', 'res'); tip(d, tt); d.append(el('b', cls, v), el('small', sc, s)); const k = CLK[s] || ICLK[[...v][0]]; if (!click && k) click = goW(k); if (click) { d.style.cursor = 'pointer'; d.onclick = click; } t.append(d); };
  const lab = { tax: 'Impostos', trade: 'Exportações', imports: 'Importações', transport: 'Frete entre estados', tribute: 'Tributo', subjSales: 'Vendas aos súditos', rep: 'Reparações', plunder: 'Pilhagem', army: 'Exército', navy: 'Marinha', admin: 'Administração', svc: 'Serviços públicos', interest: 'Juros', corrupt: 'Corrupção' };
  if (isSubj(n)) { const L = n.subj.lib; res('🏴 ' + Math.round(L) + '%', 'liberdade', 'Desejo de liberdade (Liberty Desire) · ' + SUBJECTS[n.subj.tier].n + ' de ' + natName(nat(n.senior)) + '\n0% = integrado · 100% = rompe e declara independência\nAlvo ' + Math.round(n.subj.tg ?? L) + '%:\n' + libParts(n).map(([k, v]) => k + ' ' + (v > 0 ? '+' : '') + v).join('\n'), L > 75 ? 'bad' : '', '', () => { UI.dipTab = 'subj'; openWin('dip'); }); }
  res('👑 ' + Math.round(n.pres ?? 50), presName(n).toLowerCase(), presName(n) + ' (0–100): volta devagar a 50.\nSobe com vitórias, investidura e segredos expostos; cai com derrotas e planos descobertos. Gasto ao elogiar e dar honrarias.\nCada 10 acima de 50: estabilidade +2% e risco de golpe −10%; também melhora a opinião da corte.', (n.pres ?? 50) < 30 ? 'bad' : '');
  res('💰 ' + money(n.money), (n.income >= 0 ? '+' : '−') + money(Math.abs(n.income)) + '/mês', 'Tesouro\n' + Object.entries(n.inc).filter(([, v]) => Math.abs(v) >= .5).map(([k, v]) => lab[k] + ': ' + money(v)).join('\n') + '\nTeto do tesouro: ' + money(hoardCap(n)) + ' (' + HOARD_MONTHS + ' meses de impostos); acima dele, ' + Math.round(HOARD_LEAK * 100) + '% do excesso some por mês em corrupção', n.money < 0 ? 'bad' : '', n.income >= 0 ? 'incg' : 'incb');
  const np = statesOf(n), cap = domCap(n); res('🏰 ' + np + (cap < 1e8 ? '/' + cap : ''), 'domínio', 'Limite de domínio (Domain Limit)\nTítulo: ' + RANK_N[n.rank || 0] + ' (' + titleOf(n) + ')\nEstados controlados, inteiros ou não: ' + np + ' de ' + (cap < 1e8 ? cap : 'sem limite') + '\nAcima do limite: −3 de estabilidade por estado, sem colonizar e sem anexar além disso na paz.\nProclame um título maior na janela de Governo.', np > cap ? 'bad' : np > cap * .85 ? 'gold' : '');
  res('👥 ' + popStr(n.popT || 0), 'população', 'Contingente: ' + Math.floor(n.manpower) + 'k de ' + Math.floor(n.mpMax || 0) + 'k (homens livres para recrutar; 1k por regimento, teto de 3% da população livre)\nPopulação: ' + popStr(n.popT || 0) + ' · empregados: ' + popStr(n.employed || 0) + '\n' + CLASS_IDS.map(k => CLASSES[k].e + ' ' + CLASSES[k].n + ': ' + popStr((n.cls || {})[k] || 0) + ' · satisfação ' + pct(((n.csat || {})[k] ?? 1))).join('\n') + '\nComida: ' + pct(n.foodSat || 1) + (n.foodSat < .95 ? ' — fome: a população encolhe' : '') + '\nCrescimento ' + sgn(n.m.growth || 0) + ' (saúde, leis e tecnologia)\nClique para abrir a janela de População', '', '', () => openWin('pop'));
  res('⚖️ ' + Math.round(n.stab), 'estabilidade', 'Estabilidade (0–100): anda até 2 pontos por mês rumo ao alvo.\nMais alta: mais impostos, pesquisa e menos golpes e revoltas.\nAlvo agora: ' + Math.round(stabParts(n).reduce((a, x) => a + x[1], 0)) + '\n' + stabParts(n).map(([k, v]) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + ' ' + k).join('\n'), n.stab < 30 ? 'bad' : n.stab > 70 ? 'good' : '');
  if ((n.press || 0) >= 1) res('🗡️ ' + Math.round(n.press) + '%', 'pressão', 'Pressão do conselho: sobe enquanto exigências dos conselheiros não são atendidas.\nEm 100% o conselheiro mais exigente dá um golpe e impõe o que quer.\nVeja e atenda as exigências na janela de Governo.', n.press > 70 ? 'bad' : n.press > 40 ? 'gold' : '', '', () => openWin('gov'));
  const reb = Object.values(S.rebels || {}).filter(r => r.o === n.id).length; if (reb) res('🏴 ' + reb, 'rebeldes', 'Províncias suas nas mãos de rebeldes: não produzem e tiram estabilidade.\nMande tropas: elas cercam a província para retomá-la.\nSe os rebeldes tomarem 30% do país, impõem o que querem.', 'bad');
  const tr = n.res ? TECH[n.res] : null; res('🔬 ' + (tr ? Math.floor(n.rp / techCost(n, tr) * 100) + '%' : '—'), tr ? tr.n : 'sem pesquisa', tr ? techTip(n, tr) + '\n+' + researchRate(n).toFixed(1) + ' por mês' : 'Escolha uma pesquisa na Tecnologia', tr ? '' : 'bad');
  const w = warsOf(n.id); res('⚔️ ' + w.length, w.length ? 'em guerra' : 'em paz', w.length ? 'Contra ' + enemiesOf(n.id).map(e => nat(e).name).join(', ') : 'Nenhuma guerra', w.length ? 'bad' : '');
  drawNav();
  t.append(el('span', 'grow'));
  const spd = NET.client ? NET.speed || 0 : UI.speed, sp = el('div', 'speed'); [0, 1, 2, 3, 4, 5].forEach(k => sp.append(btn(k ? '▶'.repeat(Math.min(k, 3)) + (k > 3 ? k : '') : '⏸', () => setSpeed(k), spd === k ? 'on' : '', NET.client && k ? 'O anfitrião controla a velocidade' : '', NET.client ? (k ? '' : 'Pedir pausa ao anfitrião') : k ? 'Velocidade ' + k + ' (tecla ' + k + ')' : 'Pausar (espaço)'))); t.append(sp);
  if (NET.host || NET.client) { const nb = el('div', 'netb' + (NET.unread ? ' new' : ''), '🌐 ' + NET.players().length + '/' + NET_MAX + (NET.unread ? ' · 💬' + NET.unread : '')); nb.onclick = () => { UI.room = !UI.room; drawRoom(); drawTop(); }; t.append(tip(nb, (NET.host ? 'Você é o anfitrião · sala ' + NET.code : 'Sala ' + NET.code) + '\nClique: jogadores e chat')); }
  t.append(tip(el('div', 'date', dateStr()), eraOf(curYear()) + '\nCada mês: economia, pesquisa, obras e política. Cada dia: movimento e batalhas.'));
  t.append(btn('☰', () => gameMenu(), '', '', 'Menu: salvar, sair e controles'));
}
function drawNav() {                                          // coluna de botões quadrados à esquerda
  const nv = $('#lnav'), n = me(); nv.innerHTML = '';
  [['🏛️', 'gov', 'Governo', 'Governante, conselho e suas exigências, forma de governo, ideologia e leis sociais'], ['💰', 'eco', 'Economia', 'Balanço, bens (produção, consumo, preços) e leis econômicas'], ['👥', 'pop', 'População', 'Classes sociais e suas necessidades, empregos e culturas'], ['🙏', 'faith', 'Religião', 'Fé oficial, fervor, chefe religioso, guerra santa e as religiões do povo'], ['🔬', 'tech', 'Tecnologia', 'Árvore de pesquisa e vertentes'], ['⚔️', 'mil', 'Militar', 'Recrutamento, exércitos, generais, exploradores e marinha'], ['🤝', 'dip', 'Diplomacia', 'Países conhecidos e relações'], ['🏗️', 'build', 'Construção', 'Prédios de todos os estados e canteiros de obra'], ...(curYear() >= 2040 || hasT(n, 'spc_rockets') ? [['🚀', 'space', 'Espaço', 'Satélites, missões à lua e civilizações alienígenas']] : [])]
    .forEach(([e, id, tt, d]) => { const b = btn('', () => UI.win === id ? closeWin() : openWin(id), 'sq' + (UI.win === id ? ' on' : ''), '', tt + '\n' + d); b.append(el('span', 'ic', e), el('small', '', tt)); nv.append(b); });
}
function setSpeed(k) { if (NET.client) { if (!k) { NET.askPause(); say('Pedido de pausa enviado ao anfitrião.', 'info'); } return; } UI.speed = k; if (k) UI.last = k; drawTop(); if (NET.host) NET.dirty = true; }
function gameMenu() {
  modal(m => {
    m.append(el('h2', '', 'Grand Chronicle'));
    if (!NET.client) m.append(btn('💾 Salvar', () => { say(saveGame() ? 'Jogo salvo.' : 'Não foi possível salvar.', 'good'); closeModal(); }));
    if (!NET.host && !NET.client) m.append(btn('🌐 Abrir sala multijogador', () => { closeModal(); hostRoomModal(); }, '', '', 'Você vira o anfitrião: só o seu jogo simula; até ' + (NET_MAX - 1) + ' amigos entram pelo código e escolhem um país livre (quem sair volta para a IA).'));
    else m.append(btn(NET.host ? '🌐 Fechar a sala' : '🌐 Sair da sala', () => { const wasClient = NET.client; NET.close(); closeModal(); UI.room = false; drawRoom(); if (wasClient || !S) { S = null; menu(); } else refresh(); }));   // quem sai volta ao menu; o anfitrião segue sozinho
    m.append(btn('🚪 Salvar e sair para o menu', () => { saveGame(); closeModal(); S = null; menu(); }));
    m.append(btn('🔧 Recalcular (debug)', () => { const r = repairGame(true); closeModal(); refresh(); say('Recalculado: ' + r.fixed + ' valor' + (r.fixed === 1 ? '' : 'es') + ' inválido' + (r.fixed === 1 ? '' : 's') + ' corrigido' + (r.fixed === 1 ? '' : 's') + ', ' + r.merged + ' exércitos da IA juntados.', 'good'); }, '', '', 'Refaz os cálculos: corrige números inválidos (−NaN/mês), refaz a economia e os modificadores, junta exércitos pequenos da IA parados no mesmo lugar e replaneja as marchas dela.'));
    m.append(el('p', 'dim', 'Mapa: arraste com o botão esquerdo para selecionar tropas · botão direito move as tropas ou abre ações com o país · WASD ou arrastar com o botão direito move a câmera · roda dá zoom · espaço pausa.'));
    m.append(btn('Voltar', closeModal));
  });
}

/* ---------- crônica (pop-up no canto inferior direito) ---------- */
function drawChron() {
  drawEnact();
  const unread = S.log.length - UI.seenLog, cb = $('#chronbar'); cb.textContent = '📜 Crônicas' + (unread > 0 && !UI.chron ? ' · ' + Math.min(99, unread) + ' novas' : '') + (UI.chron ? '  ▼' : '  ▲'); cb.classList.toggle('new', unread > 0 && !UI.chron);
  const c = $('#chron'); c.hidden = !UI.chron || UI.scr !== 'game'; if (c.hidden) return;
  UI.seenLog = S.log.length; c.innerHTML = '';
  const h = el('header'); h.append(el('b', '', ''), btn(UI.chronAll ? 'Só importantes' : 'Mostrar tudo', () => { UI.chronAll = !UI.chronAll; drawChron(); }, 'sm', '', 'Inclui sucessões e acordos entre outros países')); c.append(h);
  const list = el('div', 'clist'); S.log.filter(l => UI.chronAll || l.k !== 'none').slice(0, 60).forEach(l => { const r = el('div', 'cl ' + l.k); r.append(el('small', '', l.d), el('span', '', l.m)); list.append(r); }); c.append(list);
}

/* ---------- painel lateral ---------- */
function select(kind, id) { UI.side = kind ? { kind, id } : null; R.sel = kind === 'prov' ? id : null; R.selArmies = kind === 'army' ? (S.armies.find(a => a.id === id) ? groupOf(S.armies.find(a => a.id === id)) : []) : kind === 'armies' ? S.armies.filter(a => id.includes(a.id)) : []; R.selFleet = kind === 'fleet' ? S.fleets.find(f => f.id === id) : null; drawSide(); if (S && S.player >= 0) drawArmyBar(); }
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
  const tt = el('div'), sub = el('small', 'dim hier'), nSt = st.provs.length, nRg = WD.states.filter(x => WD.provs[x.cap].region === pr.region).length;
  sub.append(tip(el('span', '', '🧩 ' + st.n), 'Estado: ' + st.n + ' (' + nSt + ' províncias)\nA unidade da economia: prédios, empregos, recursos e canteiros são do estado. Quem controla a capital do estado constrói nele.\nO limite de domínio conta estados.'), ' · ',
    tip(el('span', '', '🗺️ ' + rg.n), 'Região: ' + rg.n + ' (' + nRg + ' estados)\nGrupo de estados vizinhos, com cultura e nome em comum. Aparece no modo de mapa Regiões e estados.'), ' · ',
    tip(el('span', '', '🌍 ' + ct.n), 'Continente: ' + ct.n + (ct.main ? ' (o principal, mais desenvolvido)' : ct.cold ? ' (o do frio)' : '') + '\nOutros continentes ficam escondidos até navegar até eles.'));
  tt.append(el('h2', '', pr.n), sub); h.append(tt); sd.append(h);
  if (!n.exP[p]) { sd.append(el('p', 'dim', 'Terra inexplorada.')); return; }
  const T = TERRAIN[pr.terr];
  const RU = { farm: 'Fazendas', fiber: 'Plantações', wood: 'Madeireiras', stone: 'Pedreiras', fish: 'Pesqueiros' }, MU = { iron: 'Mina de ferro', coal: 'Mina de carvão', gold: 'Mina de ouro', copper: 'Mina de cobre', oil: 'Poço de petróleo', uranium: 'Mina de urânio', rare: 'Mina de terras raras' };
  const resTxt = [...(resVisible(p) ? [GOODS[provRes(p)].e + ' ' + GOODS[provRes(p)].n] : []), ...natRes(p).map(k => NATRES[k][0] + ' ' + NATRES[k][1])].join(' · ') || '—';
  const resTip = [...(resVisible(p) ? [GOODS[provRes(p)].n + ': permite ' + MU[provRes(p)] + ' no estado (' + GOODS[provRes(p)].rm + ' níveis por jazida)'] : []), ...natRes(p).map(k => NATRES[k][1] + ': permite ' + RU[k] + ' no estado')].join('\n') || 'Sem recursos';
  const tile = (ic, lb, v, t) => { const d = el('div', 'ptile'); d.append(el('small', '', ic + ' ' + lb), el('b', '', v)); return tip(d, t); };
  const pg = el('div', 'pinfo');
  pg.append(tile('👑', c !== o && c >= 0 ? 'Dono · ocupada' : 'Dono', o >= 0 ? nat(o).name + (c !== o && c >= 0 ? ' → ' + nat(c).name : '') : 'Nativos', o >= 0 ? natName(nat(o)) + (c !== o && c >= 0 ? '\nOcupada por ' + natName(nat(c)) : '') : 'Terra sem dono'),
    tile('⛰️', 'Terreno', T.n + (pr.coast ? ' · litoral' : ''), T.n + '\nMovimento ×' + T.move + '\nDefesa +' + Math.round(T.def * 100) + '%\nComida ×' + T.food + '\nLargura de combate ×' + T.width),
    tile('⛏️', 'Recursos', resTxt, resTip + '\nPetróleo, urânio e terras raras ficam ocultos até prospectar.'),
    tile('👥', 'População', popStr(S.pop[p]), 'Gente que vive nesta província'),
    tile('🏰', 'Fortificação', (fortOf(p) || '—') + '', 'Cada nível deixa o cerco bem mais lento.\nVem do castelo na capital do estado e da capital do país.'));
  sd.append(pg);
  const msg = el('div', 'msg'), run = fn => () => { const e = fn(); msg.textContent = e || ''; if (!e) refresh(); };
  if (o >= 0 && nat(o).capital === p) sd.append(tip(el('div', 'gold', '⭐ Capital de ' + nat(o).name), 'Fortificação +2. Se cair: −2 de estabilidade por mês e +25% de rendição.'));
  else if (o === n.id && c === n.id) sd.append(btn('⭐ Tornar capital (💰' + capCost() + ')', run(() => act('setCapital', p)), 'sm', n.capCd > S.t ? 'Só a cada 10 anos (até ' + yearOf(n.capCd) + ')' : S.ctrl[n.capital] !== n.id ? 'A capital atual está ocupada' : n.money < capCost() ? 'Sem dinheiro' : '', 'Muda a capital para cá: −5 de estabilidade; uma vez a cada 10 anos'));
  if (o === -1) {
    const col = S.cols.find(x => x.p === p);
    if (col) sd.append(sec('Colonização', el('div', '', natName(nat(col.o)) + ' · faltam ' + col.m + ' meses'), bar(1 - col.m / col.tot)));
    else sd.append(sec('Colonização', btn('Colonizar (💰' + colCost(n, p) + ')', run(() => act('colonize', p)), 'grn', canColonize(n, p), 'Envia colonos; vira sua província em alguns meses.'), msg));
    return;
  }
  if (o === n.id && c === n.id) {
    const r = trainGrid(n, p, null), r5 = el('div', 'row');   // cada treino aqui forma um exército novo
    if (pr.coast) r5.append(btn('⛵ ' + shipName(n) + ' ×2 (💰' + shipCost(n) * 2 + ')', run(() => act('buildShips', 2, p)), 'sm', !n.fx.sea ? 'Exige Barcos longos' : n.money < shipCost(n) * 2 ? 'Sem dinheiro' : '', 'Navios ficam prontos em 4 meses no mar ao lado.'));
    sd.append(sec('Treinar novo exército', r, r5, msg));
  } else if (o !== n.id) {
    const has0 = n.claims[st.id], fab = n.fab && n.fab.s === st.id;
    sd.append(sec('Reivindicação', has0 ? el('div', 'good', 'Você reivindica ' + st.n + '.') : fab ? el('div', 'dim', 'Fabricando… ' + n.fab.m + ' meses') : btn('Fabricar reivindicação em ' + st.n + ' (💰' + Math.round(40 * eraScale()) + ')', run(() => act('fabricate', st.id)), 'sm', n.fab ? 'Já fabricando' : '', 'Com reivindicação, declarar guerra custa só 3 de estabilidade (sem: 15).'), msg));
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
    if (so === n.id) { if (L) r.append(btn('−', () => { S.bld[st.id][b] = L - 1; if (!S.bld[st.id][b]) delete S.bld[st.id][b]; const f = d.fx; if (f && (f.infra || f.rail || f.pipe)) S.mapDirty = true; refresh(); }, 'sm', '', 'Desmontar um nível (sem reembolso): libera trabalhadores')); r.append(btn('+ 💰' + bCost(n, b), () => { const e = act('build', st.id, b); if (e) say(e, 'bad'); refresh(); }, 'sm', err, bTip(b))); }
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
  if (so === n.id) { const no = Object.keys(BUILDINGS).filter(b => { const d = BUILDINGS[b], R = d.req && REQS[d.req]; if (!R || (d.vert ? n.vert !== d.vert : !n.fx.b.has(b))) return false; const e = canBuild(n, st.id, b); return e.startsWith('Impossível') || e === 'Exige ' + R.n; });
    if (no.length) box.append(tip(el('small', 'dim', '🚫 Impossível aqui: ' + no.map(b => BUILDINGS[b].e + ' ' + BUILDINGS[b].n).join(', ')), no.map(b => BUILDINGS[b].n + ': exige ' + REQS[BUILDINGS[b].req].n).join('\n'))); }
  if (so >= 0 && S.scov && S.scov[st.id]) { const cvb = el('div', 'svcs'); for (const k in SVC) { const v = S.scov[st.id][k] || 0, r = el('div', 'brow'); r.append(el('span', 'e', SVC[k].e), el('span', 'nm', SVC[k].n), el('span', 'lv', pct(v))); tip(r, SVC[k].n + ' · ' + svcSrc(me(), k) + '\n' + SVC[k].d + '\nCada nível atende ' + Math.round(SVC_CAP(curYear())) + ' mil pessoas'); cvb.append(r, bar(v, '#7fc8e0')); } box.append(el('h3', '', 'Serviços'), cvb); }
  const deps = st.provs.filter(p => resVisible(p)).map(p => GOODS[provRes(p)].e + ' ' + GOODS[provRes(p)].n + ' (' + WD.provs[p].n + ')'); if (deps.length) box.append(tip(el('div', 'dim', 'Jazidas: ' + deps.join(', ')), 'Petróleo, urânio e terras raras só aparecem depois de prospectar'));
  if (so === n.id) box.append(btn('🔍 Prospectar (💰' + prospectCost() + ')', () => { const e = act('prospect', st.id); if (e) say(e, 'bad'); refresh(); }, 'sm', canProspect(n, st.id), 'Procura petróleo, urânio e terras raras (conforme suas tecnologias) por 6 meses; às vezes acha jazidas novas'));
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
  sd.append(kv([['Governante', ruler], ['Cultura', CULTURES[n.cul].n + (CULTURES[n.cul].par != null ? ' (' + culHeritage(n.cul) + ')' : '')], ['Religião', relName(n.relig), relTip(n.relig)], ['Províncias', provsOf(id).length], ['População', popStr(n.popT || 0)], ['PIB', money(n.gdp || 0) + '/mês'], ['Exército', fmtK(S.armies.filter(a => a.o === id).reduce((s, a) => s + regs(a), 0))], ['Tecnologias', techCount(n)], ['Vertente', n.vert ? VERT[n.vert].n : '—'], ['Relação', id === mine.id ? '—' : Math.round(n.rel[mine.id] || 0) + '', 'Como eles veem você (−100 a 100). Muda com acordos, ideologia, fronteiras e guerras.']]));
  if (id === mine.id) { sd.append(sec('', btn('🏛️ Governo', () => openWin('gov')))); return; }
  const st = dipStatus(mine, n); if (st.length) sd.append(sec('Relações', ...st.map(x => el('div', '', x))));
  sd.append(sec('Ações', dipButtons(n)));
}
function dipButtons(t) {
  const n = me(), box = el('div', 'row'), msg = el('div', 'msg'), out = el('div');
  const go = kind => () => { const e = act('dipAct', t.id, kind); msg.textContent = e; if (!e) { say('Feito.', 'good'); refresh(); } };
  const accTip = kind => { const [v, why] = accept(t, n, kind); return (v >= 0 ? '✅ Aceitariam' : '❌ Recusariam') + ' (' + v + ')\n' + why.join('\n'); };
  box.append(btn('🤝 Melhorar relações (💰' + dipCost('improve') + ')', go('improve'), 'sm', (n.cd || {})[t.id] > S.t ? 'Já tentado este ano' : '', '+15 de relação com eles, uma vez por ano'));
  box.append(btn('🎁 Presente (💰' + dipCost('gift') + ')', go('gift'), 'sm', '', '+20 de relação; o ouro vai para eles'));
  box.append(has(n, 'allies', t.id) ? btn('Romper aliança', go('unally'), 'sm red', subjFixed(n, t) ? 'Laço de súdito: só a independência desfaz' : '', '−40 de relação e −5 de estabilidade\nNenhum dos dois pode declarar guerra ao outro por ' + DIPLO.unally.noWar + ' anos') : btn('🛡️ Propor aliança', go('ally'), 'sm', '', 'Aliados são chamados para as guerras um do outro.\n' + accTip('ally')));
  if (GOVS[n.gov].succ === 'hered' && GOVS[t.gov].succ === 'hered' && !has(n, 'marr', t.id)) box.append(btn('💍 Casamento real (💰' + dipCost('marr') + ')', go('marr'), 'sm', '', '+25 de relação. Se uma das casas ficar sem herdeiro, a outra pode herdar a coroa (união pessoal).\n' + accTip('marr')));
  box.append(has(n, 'trade', t.id) ? btn('Cancelar acordo comercial', go('untrade'), 'sm', subjFixed(n, t) ? 'Laço de súdito: só a independência desfaz' : '') : btn('⚖️ Acordo comercial (💰' + dipCost('trade') + ')', go('trade'), 'sm', has(n, 'emb', t.id) ? 'Há embargo' : '', 'Eficiência de comércio +7% para os dois.\n' + accTip('trade')));
  box.append(btn(has(n, 'emb', t.id) ? 'Suspender embargo' : '🚫 Embargo', go('embargo'), 'sm', subjFixed(n, t) ? 'Laço de súdito' : '', 'Embargos cortam 8% da eficiência de comércio deles e −25 de relação'));
  box.append(btn('😠 Insultar', go('insult'), 'sm', '', '−40 de relação'));
  if (t.senior === n.id) box.append(btn('👑 Súdito: liberdade ' + Math.round(t.subj ? t.subj.lib : 0) + '%', () => { UI.dipTab = 'subj'; openWin('dip'); }, 'sm grn', '', 'Leis, progresso e relação na aba Súditos da diplomacia'));
  out.append(box);
  const w = S.wars.find(w => sideOf(w, t.id) && sideOf(w, n.id) && sideOf(w, t.id) !== sideOf(w, n.id));
  if (w) out.append(btn('🕊️ Negociar paz', () => { UI.peaceL = t.id; UI.peacePick = null; openWin('peace', w.id); }, 'sm grn'));
  else {
    const claims = WD.states.filter(s => n.claims[s.id] && s.provs.some(p => S.own[p] === t.id));
    const sel = el('select'); sel.append(new Option('Sem reivindicação (−15 estabilidade)', '')); claims.forEach(s => sel.append(new Option('Reivindicação: ' + s.n, s.id)));
    const allies = (t.allies || []).map(nat).filter(x => x.alive).map(x => x.name);
    if (!holyWhy(n, t)) sel.append(new Option('⚔️ ' + holyName(n.relig) + ' (−3 estabilidade)', 'holy'));
    out.append(sel, btn('⚔️ Declarar guerra', () => { const e = sel.value === 'holy' ? act('declareWar', t.id, null, 'holy') : act('declareWar', t.id, sel.value === '' ? null : +sel.value); msg.textContent = e; if (!e) { S.mapDirty = true; refresh(); } }, 'red', n.truce[t.id] > S.t ? 'Trégua até ' + yearOf(n.truce[t.id]) : has(n, 'allies', t.id) ? 'São aliados' : noWarUntil(n, t) ? 'Aliança rompida: guerra só a partir de ' + yearOf(noWarUntil(n, t)) : '', allies.length ? 'Aliados deles podem entrar: ' + allies.join(', ') : 'Eles não têm aliados'));
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
/* soma de um grupo para mostrar (tropas somadas; moral, veterania e cansaço pela média dos regimentos) */
function groupAgg(G) { const h = G.slice().sort((x, y) => regs(y) - regs(x))[0], a = Object.assign({}, h), R = Math.max(.01, G.reduce((s, x) => s + regs(x), 0));
  UT.forEach(t => a[t] = G.reduce((s, x) => s + x[t], 0)); ['mor', 'xp', 'fat'].forEach(k => a[k] = G.reduce((s, x) => s + (x[k] || 0) * regs(x), 0) / R); a.head = h; return a; }
function sideArmy(sd, id) {
  const a0 = S.armies.find(a => a.id === id); if (!a0) { select(null); return; } const G = groupOf(a0), a = groupAgg(G), H = a.head, n = nat(a.o), P = WD.provs.length, mine = a.o === S.player, forG = fn => G.forEach(fn);
  const where = G.length > 1 ? G.length + ' destacamentos' : H.p < P ? WD.provs[H.p].n : WD.seas[H.p - P].n + ' (embarcado)';
  const h = el('div', 'side-h'); h.append(flagEl(n.flag, 'fl')); const tt = el('div'); tt.append(el('h2', '', armyName(H) + ' · ' + fmtK(regs(a))), tip(el('small', 'dim', where + (H.pur > S.t ? ' · 🐎 perseguição até ' + yearOf(H.pur) : '')), G.map(x => (x.p < P ? WD.provs[x.p].n : 'mar') + ' · ' + fmtK(regs(x)) + (x.path.length ? ' →' : '')).join('\n'))); h.append(tt); sd.append(h);
  const tg = el('div', 'utiles'); UT.forEach(t => { if (a[t] <= .05) return; const c = el('div', 'utile'); c.append(el('span', 'ue', unitE(n, t)), el('b', '', fmtK(a[t])), el('small', '', unitName(n, t)), el('small', 'dim', pct(a[t] / Math.max(.01, regs(a))))); tg.append(tip(c, unitTip(n, t))); });
  sd.append(tg);
  const v = vetLv(a), sup = G.reduce((s, x) => s + armySupply(x) * regs(x), 0) / Math.max(.01, regs(a)), att = G.map(x => x.p < P ? attritionOf(x) : [0, []]), x0 = att.reduce((s, q, i) => s + q[0] * regs(G[i]), 0) / Math.max(.01, regs(a)), why = [...new Set(att.flatMap(q => q[1]))];
  sd.append(sec('Estado',
    barRow('Moral ' + pct(a.mor), a.mor, '#7fe08a', 'Cai em batalha; quem chega a zero recua.\nRecupera fora de combate: mais rápido em casa, devagar se cansado, quase nada sem suprimento (teto de 60%).'),
    barRow('📦 Abastecimento ' + pct(sup), sup, sup < .7 ? '#e5636b' : '#e8c25a', 'Bens que as tropas consomem (armas, comida, cavalos...) e a linha de suprimento (fora dela, só metade chega).\nAbaixo de 100%: menos dano em batalha.\nAtrito médio ' + (x0 * 100).toFixed(1) + '%/mês' + (why.length ? ' (' + why.join(', ') + ')' : '') + '\nLinha de suprimento: até ' + logiRange(n) + ' províncias de território amigo.'),
    barRow('🎖️ ' + VET[v].n + ' ' + pct(a.xp || 0), Math.min(1, (a.xp || 0) / .9), VET_COL[v], vetTip(a)),
    barRow('Cansaço ' + pct(a.fat || 0), a.fat || 0, '#e5a35b', 'Marchar e lutar cansam (terreno difícil cansa mais).\nCansaço tira até 35% do dano e deixa a moral voltar mais devagar. Passa descansando com suprimento.')));
  const B0 = H.front != null && S.fbat ? S.fbat[H.front] || Object.values(S.fbat).find(B => G.some(x => x.p === B.q)) : null;
  if (H.fready > S.t) sd.append(tip(el('div', 'card dim', '🚶 A caminho do front · chega em ' + (H.fready - S.t) + ' dias'), 'Exércitos viajam até a linha pelo passo da tropa mais lenta; só lutam ao chegar'));
  if (B0) { const c = el('div', 'card'), hd = el('div', 'row'); hd.append(fbIcon(B0, n.id), el('h4', '', 'Batalha de front · ' + WD.provs[B0.q].n)); c.append(hd, el('small', 'dim', B0.ev.slice(-4).join('\n'))); sd.append(c); }
  G.forEach(x => { if (x.p < P && S.battles[x.p]) battleBox(sd, x.p); });
  if (H.inv) sd.append(el('p', 'gold', '⚓ Invasão de ' + WD.provs[H.inv.to].n + ': ' + { go: 'indo ao porto de ' + WD.provs[H.inv.port].n, sail: 'navegando', land: 'desembarcando', back: 'voltando ao porto' }[H.inv.st]));
  const gc = el('div', 'gencard'), gen = G.map(x => x.gen).find(Boolean);
  if (gen) gc.append(tip(el('b', 'gold', '★ ' + charName(gen)), genTip(gen)), el('small', 'dim', ageOf(gen) + ' anos · marcial ' + gen.st.mar + ' · força ' + sgn(genMul(gen) - 1)), el('small', 'dim', gen.tr.map(t => TRAITS[t].n).join(', ') + (IDEOS[gen.ld] ? ' · ⚑ ' + IDEOS[gen.ld].n : '')));
  else gc.append(tip(el('b', 'dim', 'Sem general'), 'O general melhor ganha bônus no dado da batalha (+1 a cada 4 de marcial de diferença).'));
  if (mine) gc.append(btn(gen ? 'Trocar (💰' + genCost() + ')' : 'Nomear (💰' + genCost() + ')', () => genPick(H), 'sm', n.money < genCost() ? 'Sem dinheiro' : '', 'Escolha entre 3 candidatos; comanda todos os destacamentos.'));
  sd.append(sec('General', gc));
  if (!mine) return;
  const at0 = G.find(x => x.p < P && S.own[x.p] === n.id && S.ctrl[x.p] === n.id), at = at0 ? at0.p : n.capital, rg = trainGrid(n, at, gid(H));
  const pend = n.rec.filter(r => r.g === gid(H)); sd.append(sec('Treinar unidades', rg, pend.length ? el('small', 'dim', 'Em preparo: ' + pend.map(r => r.k + 'k ' + unitName(n, r.type) + ' (' + r.m + 'm)').join(', ')) : null));
  const rs = el('div', 'row'); Object.keys(STANCES).forEach(k => { const d = STANCES[k], on = nat(H.o); rs.append(btn(d.e + ' ' + stanceName(on, k), () => { act('setStance', G.map(x => x.id), k); drawSide(); }, 'sm' + ((H.st || 'bal') === k ? ' on' : ''), '', 'Postura: ' + stanceName(on, k) + (stanceName(on, k) !== d.n ? ' (' + d.n + ')' : '') + '\n' + d.d + (d.beats ? '\nVence ' + stanceName(on, d.beats).toLowerCase() + ' (+15% de dano)' : ''))); });
  sd.append(sec('Postura', rs));
  const ap = el('div'), sp = Object.keys(H.sup || {}); if (sp.length) { const ch = el('div', 'chips'); sp.forEach(k => ch.append(tip(el('span', 'chip p', SUPPORT[k].e + ' ' + supName(n, k)), SUPPORT[k].d))); ap.append(ch); }
  const home = G.find(x => x.p < P && S.own[x.p] === n.id && S.ctrl[x.p] === n.id) || H;
  const rsu = el('div', 'row'); Object.keys(SUPPORT).forEach(k => { if (G.every(x => x.sup && x.sup[k])) return; rsu.append(btn(SUPPORT[k].e + ' ' + supName(n, k) + ' (💰' + supCost(n, k) + ')', () => { const e = act('addSupport', H.id, k); if (e) say(e, 'bad'); refresh(); }, 'sm', !supOk(n, k) ? 'Exige ' + TECH[SUPPORT[k].tech].n : n.money < supCost(n, k) ? 'Sem dinheiro' : '', SUPPORT[k].d + '\nManutenção 💰' + (SUPPORT[k].up * eraScale()).toFixed(1) + '/mês · consome ' + Object.keys(SUPPORT[k].need).map(g => GOODS[g].n.toLowerCase()).join(', '))); });
  if (rsu.children.length) ap.append(rsu); sd.append(sec('Apoio', ap));
  const tr = el('div', 'row');
  tr.append(btn(H.drill ? '🎯 Treinando' : '🎯 Treinar', () => { act('setDrill', G.map(x => x.id), !H.drill); drawSide(); }, 'sm' + (H.drill ? ' on' : ''), '', 'Em paz, parado em território próprio: +1,5% de experiência por mês até ' + VET[2].n + '.\nManutenção +50% enquanto treina.'));
  tr.append(btn(H.exp ? '🧭 Explorando' : '🧭 Explorar', () => { const e = act('setExplore', H.id, !H.exp); if (e) say(e, 'bad'); drawSide(); }, 'sm' + (H.exp ? ' on' : ''), H.exp ? '' : G.length > 1 ? 'Disperso: junte antes' : expWhy(H), 'Modo explorador: só tropa barata (infantaria, até 5 regimentos).\nAnda sozinha até a terra incógnita mais próxima e revela o mapa.'));
  sd.append(sec('Treino e exploração', tr));
  const fs = frontsOf(n.id);
  if (fs.length) { const rf = el('div', 'col'); fs.forEach(f => { const has = S.armies.some(x => x.o === n.id && x.front === f.id), r0 = el('div', 'row');
      r0.append(btn('🚩 ' + frontName(f), () => { setGroupFront(H, H.front === f.id ? null : f.id); refresh(); }, 'sm' + (H.front === f.id ? ' on' : ''), '', 'Mandar este exército para este front (se espalha pela linha sozinho)'));
      if (H.front !== f.id && !has) r0.append(btn('✂ Nova unidade para cá', () => { const g = act('splitGroup', H.id, f.id); refresh(); const nb = S.armies.find(x => x.g === g); if (nb) select('army', nb.id); }, 'sm grn', regs(a) < 2 ? 'Pequeno demais' : '', 'Este front está sem exército: divide este exército e manda a nova unidade para cá'));
      rf.append(r0); });
    sd.append(sec('Front' + (H.front != null && frontById(H.front) ? ' · ' + (fordOf(n.id, H.front) === 'adv' ? 'avançar' : 'defender') : ''), rf)); }
  const r = el('div', 'row');
  if (H.inv) r.append(btn('Cancelar invasão', () => { act('cancelInvasion', H.id); drawSide(); }, 'sm'));
  if (H.front == null && !H.inv) { r.append(btn('🏠 Estado mais próximo', () => { goHomeGroup(H, false); refresh(); }, 'sm', '', 'Marcha até o estado próprio mais perto'), btn('⭐ Capital', () => { goHomeGroup(H, true); refresh(); }, 'sm', '', 'Marcha até a capital')); }
  r.append(btn('✂ Dividir em nova unidade', () => { const g = act('splitGroup', H.id, null); refresh(); const nb = S.armies.find(x => x.g === g); if (nb) select('army', nb.id); }, 'sm', regs(a) < 2 ? 'Pequeno demais' : H.inv ? 'Em invasão' : '', 'Metade dos destacamentos (ou dos regimentos) vira outro exército, sem general.\nUse para mandar tropas a um front novo.'));
  const near = groupsOf(n.id).filter(O => gid(O[0]) !== gid(H) && O.some(x => G.some(y => y.p === x.p)));
  r.append(btn('Juntar exércitos aqui', () => { near.forEach(O => act('joinGroups', H.id, O[0].id)); refresh(); }, 'sm', near.length ? '' : 'Nenhum outro exército junto a algum destacamento', 'Os exércitos que estão no mesmo lugar que algum destacamento passam a ser este exército'));
  r.append(btn('Desmobilizar', () => { forG(x => { n.manpower += regs(x); UT.forEach(t => x[t] = 0); }); S.armies = S.armies.filter(b => regs(b) > .08); select(null); drawOutl(); }, 'sm red', H.inv ? 'Em invasão' : '', 'Os homens voltam para a reserva (contingente)'));
  sd.append(sec('Ordens', r, tip(el('small', 'dim', 'Os exércitos se movem sozinhos pelo front.'), 'No front: espalham-se pelos pontos ameaçados (defender) ou atacam reunidos (avançar).\nSem guerra: combatem rebeldes no seu território e se reagrupam.\nBotão direito numa costa além-mar planeja uma invasão (com o exército reunido).')));
}
function sideArmies(sd, ids) {                                // vários exércitos selecionados (um por grupo)
  const sel = S.armies.filter(a => ids.includes(a.id)), P = WD.provs.length; if (!sel.length) { select(null); return; }
  const gs = [...new Set(sel.map(gid))].map(k => groupOf(sel.find(a => gid(a) === k))), tot = gs.reduce((s, G) => s + G.reduce((t, a) => t + regs(a), 0), 0);
  sd.append(el('h2', '', gs.length + (gs.length === 1 ? ' exército · ' : ' exércitos · ') + fmtK(tot)));
  gs.forEach(G => { const h = G[0], r = el('div', 'orow'); r.append(el('span', '', '⚔️'), el('span', 'grow', G.length > 1 ? G.length + ' destacamentos' : h.p < P ? WD.provs[h.p].n : WD.seas[h.p - P].n), el('b', '', fmtK(G.reduce((t, a) => t + regs(a), 0)))); r.onclick = () => select('army', h.id); sd.append(r); });
  const n = me(), fs = frontsOf(n.id), rf = el('div');
  fs.forEach(f => { const w = S.wars.find(x => x.id === f.w), foe = nat(f.side === 'A' ? w.d : w.a), ord = fordOf(n.id, f.id), on = gs.filter(G => G[0].front === f.id).length, all = groupsOf(n.id).filter(G => G[0].front === f.id).length;
    const sts = [...new Set(f.provs.map(p => WD.states[WD.provs[p].state].n))], ours = S.armies.filter(a => a.o === n.id && a.front === f.id).reduce((t, a) => t + armyPower(a), 0), theirs = f.foe.reduce((t, q) => t + foeNear(n.id, q), 0) / 2;
    const c = el('div', 'card'); c.style.marginTop = '6px';
    c.append(tip(el('b', '', '🚩 ' + frontName(f) + ' · ' + (ord === 'adv' ? '⚔️ avançando' : '🛡️ defendendo')), 'Contra ' + natName(foe) + '\nLinha: ' + sts.slice(0, 8).join(', ') + (sts.length > 8 ? '…' : '') + ' (' + f.provs.length + ' províncias)'),
      el('div', 'dim', 'Contra ' + foe.name + ' · ' + sts.slice(0, 3).join(', ') + (sts.length > 3 ? '…' : '') + ' · ' + all + ' exército' + (all === 1 ? '' : 's') + (on ? ' (' + on + ' destes)' : '')),
      tip(bar(ours / Math.max(1, ours + theirs), ours >= theirs ? '#8fd17f' : '#e5636b'), 'Força: ' + Math.round(ours) + ' × ' + Math.round(theirs)));
    const r = el('div', 'row');
    r.append(btn('➕ Mandar para cá', () => { gs.forEach(G => setGroupFront(G[0], f.id)); refresh(); }, 'sm', on === gs.length ? 'Já estão aqui' : '', 'Os exércitos selecionados vão para este front e se espalham pela linha'),
      btn('🛡️ Defender', () => { act('setFord', f.id, 'hold'); refresh(); }, 'sm' + (ord === 'hold' ? ' on' : ''), '', 'Espalha as tropas pelos pontos mais ameaçados da linha'),
      btn('⚔️ Avançar', () => { act('setFord', f.id, 'adv'); refresh(); }, 'sm' + (ord === 'adv' ? ' on' : ''), '', 'Reúne as tropas num ponto e ataca quando a força passa de 1,2× a defesa do alvo'));
    c.append(r); rf.append(c); });
  if (fs.length) sd.append(sec('Fronts', rf)); else sd.append(el('p', 'dim', warsOf(n.id).length ? 'Guerra sem fronts: o inimigo está além-mar (invasão pelo botão direito numa costa).' : 'Em paz: os exércitos combatem rebeldes e se reagrupam sozinhos.'));
  const r = el('div', 'row'); r.append(btn('Juntar num só exército', () => { gs.slice(1).forEach(G => act('joinGroups', gs[0][0].id, G[0].id)); select('army', gs[0][0].id); refresh(); }, 'sm', gs.length > 1 ? '' : 'Só um exército', 'Passam a ser um único exército (os destacamentos se reúnem sozinhos fora do front)'));
  sd.append(r);
}
function sideFleet(sd, id) {
  const f = S.fleets.find(f => f.id === id); if (!f) { select(null); return; } const n = nat(f.o);
  const h = el('div', 'side-h'); h.append(flagEl(n.flag, 'fl')); const tt = el('div'); tt.append(el('h2', '', 'Frota · ⛵' + Math.ceil(f.ships)), el('small', 'dim', WD.seas[f.z].n + (WD.seas[f.z].deep ? ' · oceano' : ''))); h.append(tt); sd.append(h);
  sd.append(el('div', '', Math.ceil(f.ships) + ' ' + shipName(n)));
  if (f.o !== S.player) return;
  sd.append(tip(el('p', 'dim', f.auto ? 'Explorando sozinha.' : f.path.length ? 'Navegando.' : 'Botão direito num mar para navegar' + (seaExploreOk(n) ? ', até mares desconhecidos.' : '.')), seaExploreOk(n) ? 'Com Bússola, a frota navega por clique até mares desconhecidos e revela o caminho.' : 'Sem Bússola, só navega por clique em mares já conhecidos; use 🧭 Explorar para descobrir novos.'));
  const r = el('div', 'row'); r.append(btn(f.auto ? 'Parar exploração' : '🧭 Explorar', () => { act('fleetAuto', f.id, !f.auto); drawSide(); }, 'sm' + (f.auto ? ' on' : ''), '', 'Vai sozinha para os mares de fronteira mais próximos (desconhecidos ou com costa desconhecida) e revela o litoral'), btn('Parar', () => { act('fleetAuto', f.id, false); drawSide(); }, 'sm'));
  sd.append(r, tip(el('p', 'dim', 'Capacidade: ' + Math.floor(fleetCap(f)) + ' regimentos (' + shipCap(n) + ' por navio)' + (carriedRegs(f) ? ' · a bordo: ' + fmtK(carriedRegs(f)) : '')), 'Tropas de terra só cruzam um mar sozinhas (barcos locais, ' + FERRY_DAYS + ' dias) e se ele estiver livre de navios inimigos.\nMais longe que isso, é preciso uma invasão: o exército embarca nesta frota num porto, navega e desembarca. Se a frota perder no caminho, volta com o que sobrar.'));
  sd.append(tip(el('p', 'dim', n.fx.sea >= 2 ? '🌊 Navegação oceânica' : '🌊 Navegação costeira: o oceano só perto da costa'), 'Sem Caravela, a frota só entra em oceano que encosta em mar raso, e perde 2% dos navios a cada trecho de oceano em tempestades.\nCom Caravela (navegação oceânica) cruza qualquer oceano.'));
}

/* ---------- painel da direita ---------- */
function drawOutl() {
  drawArmyBar();
  const o = $('#outl'), n = me(); o.innerHTML = ''; const P = WD.provs.length;
  const wars = warsOf(n.id); if (wars.length) { o.append(el('h4', '', 'GUERRAS')); wars.forEach(w => { const sd = sideOf(w, n.id), lead = w.a === n.id || w.d === n.id, e = nat(sd === 'A' ? w.d : w.a), sc = w.score * (sd === 'A' ? 1 : -1), r = el('div', 'orow'); r.append(flagImgEl(e.flag), el('span', 'grow', e.name + (lead ? '' : ' (aliado)')), el('b', sc >= 0 ? 'good' : 'bad', sc + '')); tip(r, 'Placar: ' + sc + '\nLado deles: ' + (sd === 'A' ? w.D : w.A).map(x => nat(x).name).join(', ')); r.onclick = () => openWin('peace', w.id); o.append(r); }); }
  const gr = groupsOf(n.id); if (gr.length) { o.append(el('h4', '', 'EXÉRCITOS')); gr.forEach(G => { const h = G.slice().sort((x, y) => regs(y) - regs(x))[0], r = el('div', 'orow' + (G.some(a => R.selArmies.includes(a)) ? ' sel' : ''));
    r.append(el('span', '', h.exp ? '🧭' : h.inv ? '⚓' : h.front != null ? '🚩' : '⚔️'), el('span', 'grow', armyName(h)), el('b', '', fmtK(G.reduce((s, a) => s + regs(a), 0))));
    r.onclick = () => { select('army', h.id); centerOn(...armyXY(h)); }; o.append(r); }); }
  const fl = S.fleets.filter(f => f.o === n.id); if (fl.length) { o.append(el('h4', '', 'FROTAS')); fl.forEach(f => { const r = el('div', 'orow'); r.append(el('span', '', f.auto ? '🧭' : '⛵'), el('span', 'grow', WD.seas[f.z].n), el('b', '', Math.ceil(f.ships) + '')); r.onclick = () => { select('fleet', f.id); centerOn(...fleetXY(f)); }; o.append(r); }); }
  const work = n.cons.length + n.rec.length + S.cols.filter(c => c.o === n.id).length;
  if (work) { o.append(el('h4', '', 'EM ANDAMENTO')); n.cons.forEach(c => o.append(el('div', 'orow', BUILDINGS[c.b].e + ' ' + BUILDINGS[c.b].n + ' · ' + c.m + 'm'))); n.rec.forEach(r => o.append(el('div', 'orow', (r.type === 'ship' ? '⛵ ' + shipName(n) : unitName(n, r.type)) + ' ×' + r.k + ' · ' + r.m + 'm'))); S.cols.filter(c => c.o === n.id).forEach(c => o.append(el('div', 'orow', '🏕️ ' + WD.provs[c.p].n + ' · ' + c.m + 'm'))); }
}
/* batalhas de front: ícone redondo (vermelho = atacando, azul = defendendo), no mapa e na janela Militar */
const fbSide = (B, id) => { const w = S.wars.find(x => x.id === B.w); if (!w) return null; const s = sideOf(w, id); return !s ? null : s === B.side ? 'a' : 'd'; };
const fbMine = (B, id) => !!fbSide(B, id);
function fbIcon(B, id) { const sd = fbSide(B, id), bt = S.battles[B.q], d = el('span', 'fbi ' + (sd === 'a' ? 'att' : sd === 'd' ? 'def' : 'oth'), bt ? '⚔' : '⚑');
  if (bt) { const r = bt.pa + bt.pb > 0 ? bt.pa / (bt.pa + bt.pb) : .5; d.style.setProperty('--r', Math.round((sd === 'd' ? 1 - r : r) * 100) + '%'); } return tip(d, fbTip(B)); }
function armyTip(G) { const h = G[0], n = nat(h.o), r = G.reduce((s, a) => s + regs(a), 0), m = G.reduce((s, a) => s + a.mor * regs(a), 0) / Math.max(.01, r);
  return armyName(h) + ' · ' + fmtK(r) + '\n' + UT.filter(t => G.some(a => a[t] > .05)).map(t => unitName(n, t) + ' ' + fmtK(G.reduce((s, a) => s + a[t], 0))).join(' · ') + '\nMoral ' + pct(m) + ' · postura ' + STANCES[stanceOf(h)].n + (h.fready > S.t ? '\nChega ao front em ' + (h.fready - S.t) + ' dias' : '') + '\nClique para abrir'; }
function drawFbIcons() {
  let L = $('#fbicons'); if (!L) return; if (!S || UI.scr !== 'game' || S.player < 0) { L.innerHTML = ''; return; }
  const me0 = nat(S.player), list = Object.values(S.fbat || {}).filter(B => me0.exP[B.q] || fbMine(B, S.player)), keep = new Set();
  for (const B of list) { const k = 'fb' + B.f; keep.add(k); let d = L.querySelector('#' + k); if (!d) { d = fbIcon(B, S.player); d.id = k; d.onclick = () => { const a = S.armies.find(a => a.o === S.player && a.front === B.f) || S.armies.find(a => a.o === S.player && fbMine(B, S.player) && a.p === B.q); if (a) select('army', a.id); }; L.append(d); }
    const q = WD.provs[B.q], [x, y] = toScreen(q.cx * K + K / 2, q.cy * K + K / 2), bt = S.battles[B.q]; d.style.transform = 'translate(' + Math.round(x - 14) + 'px,' + Math.round(y - 34) + 'px)'; d.textContent = bt ? '⚔' : '⚑'; d.dataset.tip = fbTip(B);
    if (bt) { const r = bt.pa + bt.pb > 0 ? bt.pa / (bt.pa + bt.pb) : .5; d.style.setProperty('--r', Math.round((fbSide(B, S.player) === 'd' ? 1 - r : r) * 100) + '%'); } }
  [...L.children].forEach(d => { if (!keep.has(d.id)) d.remove(); });
}
/* grade de treino: primeira linha 1k de cada tipo, segunda linha 5k; g = exército que recebe (null = cada clique cria um exército novo) */
/* novo exército: tudo o que for treinado nesta janela forma o mesmo exército */
function newArmyModal(n) {
  const g = S.id++, own = provsOf(n.id).filter(p => S.ctrl[p] === n.id).sort((a, b) => (b === n.capital) - (a === n.capital) || S.pop[b] - S.pop[a]); let at = own[0];
  modal(m => { const draw = () => { m.innerHTML = ''; m.append(el('h2', '', '➕ Novo exército'));
      const sel = el('select'); own.slice(0, 80).forEach(p => sel.append(new Option(WD.provs[p].n + ' (' + WD.states[WD.provs[p].state].n + ')' + (p === n.capital ? ' ⭐' : ''), p))); sel.value = at; sel.onchange = () => { at = +sel.value; draw(); };
      const pend = n.rec.filter(r => r.g === g);
      m.append(el('small', 'dim', 'Onde treinar'), sel, trainGrid(n, at, g, draw), el('small', 'dim', pend.length ? 'Em treino: ' + pend.map(r => r.k + 'k ' + unitName(n, r.type)).join(', ') : 'Nada em treino ainda'), btn('Fechar', closeModal)); };
    draw(); });
}
function trainGrid(n, at, g, done) {
  const ts = UT.filter(t => t !== 'vrt' || n.vert), wrap = el('div', 'rgrid2'); wrap.style.gridTemplateColumns = 'repeat(' + ts.length + ', 1fr)';
  [1, 5].forEach(k => ts.forEach(t => { const b0 = btn('', () => { const e = act('recruit', t, k, at, g ?? S.id++); if (e) say(e, 'bad'); else if (done) done(); refresh(); }, 'rbtn r-' + t, canRecruit(n, t, k), unitTip(n, t) + '\nPronta em ' + Math.max(1, Math.round((t === 'vrt' ? 5 : 3) * BUILD_SLOW) - (S.bld[WD.provs[at].state].barracks ? 2 : 0)) + ' meses em ' + WD.provs[at].n + (g == null ? '\nForma um exército novo' : '\nEntra neste exército'));
    b0.append(el('span', 'ue', unitE(n, t)), el('b', '', k + 'k ' + unitName(n, t)), el('small', '', '💰' + recCost(n, t, k))); wrap.append(b0); }));
  return wrap;
}
/* barra de exércitos (embaixo, no centro): um cartão por exército, com o nome do general */
function drawArmyBar() {
  const b = $('#armybar'); if (!b) return; b.innerHTML = ''; if (!S || S.player < 0 || UI.scr !== 'game') { b.hidden = true; return; }
  const gs = groupsOf(S.player); b.hidden = !gs.length;
  gs.forEach(G => { const h = G.slice().sort((x, y) => regs(y) - regs(x))[0], c = el('div', 'acard' + (G.some(a => R.selArmies.includes(a)) ? ' sel' : '')), st = STANCES[stanceOf(h)], mor = G.reduce((s, a) => s + a.mor * regs(a), 0) / Math.max(.01, G.reduce((s, a) => s + regs(a), 0));
    c.append(el('b', '', (h.gen ? '★ ' : '') + armyName(h)), el('small', '', fmtK(G.reduce((s, a) => s + regs(a), 0)) + ' · ' + st.e + (h.inv ? ' ⚓' : h.exp ? ' 🧭' : h.front != null ? ' 🚩' : '') + (G.some(a => a.inBattle || S.battles[a.p]) ? ' ⚔️' : '')), bar(mor, '#7fe08a'));
    tip(c, (h.front != null && frontById(h.front) ? '🚩 ' + frontName(frontById(h.front)) : 'Sem front') + '\n' + armyTip(G));
    c.onclick = () => { select('army', h.id); centerOn(...armyXY(h)); }; b.append(c); });
}
function flagImgEl(f) { const im = new Image(); im.className = 'mini'; im.src = flagImg(f).src; return im; }
function centerOn(wx, wy) { R.cam.x = wx - innerWidth / 2 / R.cam.z; R.cam.y = wy - innerHeight / 2 / R.cam.z; clampCam(); }

/* ---------- janelas ---------- */
const WTITLE = { pop: 'População', gov: 'Governo', faith: 'Religião', eco: 'Economia', tech: 'Tecnologia', mil: 'Militar', dip: 'Diplomacia', flag: 'Bandeira', peace: 'Paz', space: 'Espaço', build: 'Construção' };
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
/* árvore de governos: o atual, os caminhos de reforma (votação), os que só vêm por golpe e os que só vêm por evento */
const govOptChips = d => { const ch = el('div', 'chips'); for (const k in d.m) if (d.m[k]) ch.append(el('span', 'chip ' + (d.m[k] > 0 === (k !== 'coup') ? 'p' : 'n'), (MODS[k] || 'Risco de golpe') + ' ' + sgn(d.m[k]))); ch.append(el('span', 'chip' + (d.coup > 1 ? ' n' : ''), 'Golpe ×' + d.coup)); return ch; };
function govTree(b, n, msg) {
  const cur = GOVS[n.gov], cat = cur.cat;
  b.append(el('h3', 'gold', 'Forma de governo'));
  const now = el('div', 'opt on gnow'); now.append(el('b', '', cur.n), el('small', 'dim', cat + ' · ' + cur.t + (cur.term ? ' · mandato de ' + cur.term + ' anos' : '') + (cur.until ? ' · perde legitimidade depois de ' + cur.until : '')), govOptChips(cur));
  b.append(tip(now, govTip(n.gov)));
  const E = n.enact, busyG = E ? 'Já há uma votação em andamento: ' + enactName(E) : n.govCd > S.t ? 'Reforma recente: a próxima em ' + yearOf(n.govCd) : '';
  b.append(tip(el('h4', 'era', '🌿 Reformas a partir daqui · proposta 💰' + govCost()), 'Cada reforma passa por votação em 3 fases (aba Leis e barra acima das Crônicas).\nMudar o tipo de governo é mais lento e custa ' + -ENACT.gov.catStab + ' de estabilidade (dentro do mesmo tipo, ' + -ENACT.gov.stab + ').\nQuando muda quem manda (ex.: monarquia → república), um evento decide o novo governante.'));
  const go = el('div', 'grid-opts');
  govEdges(n.gov).forEach(e => { const d = GOVS[e.g], why = govEdgeWhy(n, e.g), voting = E && E.ty === 'gov' && E.v === e.g, ok = !why && !busyG;
    const o = el('div', 'opt' + (voting ? ' on vote' : '') + (why ? ' off' : '')), nxt = govEdges(e.g).map(x => GOVS[x.g].n).filter(x => x !== cur.n);
    o.append(el('b', '', (voting ? '🗳️ ' : '') + d.n), el('small', 'dim', d.cat + (d.cat !== cat ? ' · muda o tipo de governo' : '') + ' · ' + d.t), govOptChips(d));
    if (nxt.length) o.append(el('small', 'dim tree-next', '→ depois: ' + nxt.slice(0, 4).join(', ') + (nxt.length > 4 ? '…' : '')));
    tip(o, govTip(e.g) + (e.when ? '\nCondição: ' + condTxt(e.when).join(', ') : '') + (why ? '\n⛔ ' + why : busyG && !voting ? '\n⛔ ' + busyG : voting ? '\n🗳️ Em votação' : '\nClique para propor (💰' + govCost() + ')'));
    if (ok) o.onclick = () => { const r = act('setGov', e.g); msg.textContent = r; if (!r) refresh(); };
    go.append(o); });
  b.append(go);
  // catálogo: todos os outros governos por tipo, e como se chega a cada um
  b.append(tip(el('h4', 'era', '📚 Outros governos e como chegar a eles'), 'Passe o mouse num governo para ver de onde se chega a ele: por reforma (votação), por golpe militar ou só por evento ou revolução.\nVerde: dá para propor agora. Dourado: está a um passo de um caminho seu.'));
  const howTo = g => { const from = Object.keys(GOVS).filter(x => govEdges(x).some(e => e.g === g)), coup = Object.keys(COUP_GOVS).filter(c => c !== 'chance' && COUP_GOVS[c].includes(g)), ev = Object.keys(GOVS).filter(x => (GOVS[x].ev || []).includes(g));
    const t = TECHS.find(x => (x.fx.g || []).includes(g)), o = [];
    if (from.length) o.push('Por reforma a partir de: ' + from.map(x => GOVS[x].n).join(', ')); if (coup.length) o.push('Por golpe militar em governos do tipo: ' + coup.join(', ')); if (ev.length) o.push('Por evento ou revolução a partir de: ' + ev.map(x => GOVS[x].n).join(', '));
    if (t) o.push('Tecnologia: ' + t.n + ' (' + t.y + ')' + (hasT(n, t.id) ? ' ✓' : '')); const w = condTxt(govWhen(g)); if (w.length) o.push('Requisitos: ' + w.join(', ')); return o.join('\n'); };
  const near = new Set(govReach(n).flatMap(g => govEdges(g).map(e => e.g)));
  const byCat = {}; Object.keys(GOVS).filter(g => g !== n.gov).forEach(g => (byCat[GOVS[g].cat] = byCat[GOVS[g].cat] || []).push(g));
  const cg = el('div', 'govcat');
  Object.entries(byCat).forEach(([c0, list]) => { const box = el('div', 'card'); box.append(el('h4', '', c0)); const ch = el('div', 'chips');
    list.forEach(g => { const now = govEdgeOk(n, g), nx = !now && near.has(g); ch.append(tip(el('span', 'chip' + (now ? ' p' : nx ? ' lg-av' : ' lg-lock'), GOVS[g].n), govTip(g) + '\n\n' + howTo(g) + (now ? '\n✅ Dá para propor agora (acima)' : nx ? '\n➡️ A um passo de uma reforma possível' : ''))); });
    box.append(ch); cg.append(box); });
  b.append(cg);
  b.append(msg);
}
/* votação em andamento: nome, fase e barra de 3 níveis (o mesmo na janela e acima das Crônicas) */
function enactBar3(E) { const d = el('div', 'ebar'); for (let i = 0; i < 3; i++) { const s0 = el('i'), f = el('b'); f.style.width = clamp((E.prog - i * 100) / 100, 0, 1) * 100 + '%'; s0.append(f); d.append(s0); } return d; }
function enactTip(n, E) {
  const s = enactSupport(n, E), P = enactPhases(n), r = enactRate(n, E);
  return '🗳️ ' + enactName(E) + '\nFase ' + (E.ph + 1) + ' de 3: ' + P[E.ph] + ' (' + P.join(' → ') + ')\nRitmo: ' + r.toFixed(1) + ' pontos por mês (100 por fase) · cerca de ' + Math.max(1, Math.ceil((300 - E.prog) / r)) + ' meses' +
    (enactCatChange(n, E) ? '\nMuda o tipo de governo: ' + Math.round((1 - ENACT.gov.cat) * 100) + '% mais lento' : '') + '\n\nApoio ' + (s.tot >= 0 ? '+' : '') + s.tot.toFixed(1) + ' (cada ponto: ' + Math.round(ENACT.k * 100) + '% mais rápido; ' + STATS[ENACT.push].n.toLowerCase() + ' de quem apoia também empurra)\n' +
    (s.list.filter(x => x.v).map(x => (x.v > 0 ? '👍 ' : '👎 ') + x.role + ' ' + charName(x.c) + ' ' + (x.v > 0 ? '+' : '') + x.v.toFixed(1) + ' — ' + x.why.join(', ')).join('\n') || 'Ninguém se importa') +
    '\n\nAo fim de cada fase pode emperrar (volta um pouco); com apoio ' + ENACT.fail + ' ou menos, a última fase pode derrubar a proposta. Eventos de votação ajudam ou atrapalham.';
}
function enactCard(b, n, msg) {
  const E = n.enact; if (!E) return; const c = el('div', 'card enact-card');
  c.append(el('h4', '', '🗳️ Em votação · ' + enactName(E)), el('div', 'dim', enactPhases(n).map((p, i) => (i === E.ph ? '▶ ' : '') + p).join('  ·  ')), enactBar3(E));
  c.append(btn('Retirar a proposta', () => { msg.textContent = act('cancelEnact'); refresh(); }, 'sm', '', 'O custo da proposta não volta'));
  b.append(tip(c, enactTip(n, E)));
}
function drawEnact() {
  const d = $('#enact'), n = S && S.player >= 0 && UI.scr === 'game' ? me() : null, E = n && n.enact; d.hidden = !E; if (!E) return;
  d.innerHTML = ''; const h = el('div', 'eh'); h.append(el('b', '', '🗳️ ' + enactName(E)), el('small', '', enactPhases(n)[E.ph] + ' · ' + (E.ph + 1) + '/3')); d.append(h, enactBar3(E)); tip(d, enactTip(n, E));
  d.onclick = () => { UI.govTab = E.ty === 'law' ? 'laws' : 'gov'; openWin('gov'); };
}
function lawGrid(b, n, eco, msg) {
  b.append(tip(el('h3', 'gold', (eco ? 'Leis econômicas' : 'Leis') + ' · propor custa 💰' + lawCost()), 'Propor uma lei abre uma votação em 3 fases (uma por vez). Aprovada, custa ' + -ENACT.law.stab + ' de estabilidade.\nQuem no conselho e na família quer a lei acelera; quem quer outra opção atrapalha.')); enactCard(b, n, msg);
  const lw = el('div', 'laws'); Object.entries(LAWS).filter(([, L]) => !!L.eco === eco).forEach(([k, L]) => { const row = el('div', 'lawrow'); row.append(el('b', '', L.n));
    const vis = Object.entries(L.o).filter(([o, d]) => n.laws[k] === o || !(d.until && curYear() > d.until));   // opção passada da era some da lista (a não ser que seja a atual)
    row.style.gridTemplateColumns = '130px repeat(' + vis.length + ', minmax(0, 1fr))';   // todas as opções da lei na mesma linha
    vis.forEach(([o, d]) => { const on = n.laws[k] === o, ok = lawOk(n, k, o), cd = (n.lawCd || {})[k] > S.t, vote = n.enact && n.enact.ty === 'law' && n.enact.k === k && n.enact.v === o, op = el('div', 'opt law' + (on ? ' on' : '') + (vote ? ' vote' : '') + (ok ? '' : ' off'));
      op.append(el('b', '', (vote ? '🗳️ ' : '') + d.n), modChips(d.m)); tip(op, d.n + '\n' + (modLines(d.m).join('\n') || 'Sem modificadores') + (d.m.coup ? '\nRisco de golpe ' + sgn(d.m.coup) : '') + (d.svc ? '\nServiços: efeito e custo ×' + d.svc : '') + (d.d ? '\n' + d.d : '') + (ok ? '' : '\n⛔ Exige ' + condFail(n, d.when).join(', ')) + (cd && !on ? '\n⛔ Mudada há pouco' : '') + (vote ? '\n🗳️ Em votação' : !on && ok && !cd ? (n.enact ? '\n⛔ Já há uma votação: ' + enactName(n.enact) : '\nClique para propor (💰' + lawCost() + ')') : ''));
      if (!on && ok && !cd && !n.enact) op.onclick = () => { const e = act('setLaw', k, o); msg.textContent = e; if (!e) refresh(); }; row.append(op); });
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
/* cartão de personagem: governante, família ou assento do conselho. O atributo do assento tem a cor dele (STATS.col); a ideologia vem em destaque abaixo dos traços */
const fmtPt = (mod, v) => (mod === 'coup' ? (v <= 0 ? '−' : '+') + Math.abs(v * 100).toFixed(1).replace('.0', '') + '% de risco de golpe' : '+' + (v * 100).toFixed(2).replace(/\.?0+$/, '') + '% de ' + MODS[mod].toLowerCase());
function seatCard(n, c, title, seat, extra, fam) {
  const ss = seat ? COUNCIL.find(x => x[0] === seat)[2] : null, d = el('div', 'card ccard'), col = ss ? STATS[ss].col : null;
  const h = el('h4', '', title); if (col) { h.style.color = col; d.style.borderTopColor = col; d.classList.add('seat'); } d.append(h);
  d.append(el('div', 'cname', charName(c) + ' · ' + ageOf(c) + ' anos'));
  const st = el('div', 'chips'); Object.entries(STATS).forEach(([k, S0]) => { const x = el('span', 'chip' + (k === ss ? ' main' : ''), S0.n + ' ' + c.st[k]); if (k === ss) { x.style.color = S0.col; x.style.borderColor = S0.col; }
    const per = seat ? (k === ss ? 'Neste assento, por ponto acima de 8: ' + fmtPt(S0.mod, S0.c + S0.s) : 'Fora do atributo do assento, por ponto: ' + fmtPt(S0.mod, S0.c)) : fam ? 'Só conta se governar' : 'No governante, por ponto acima de 8: ' + fmtPt(S0.mod, S0.r);
    st.append(tip(x, S0.n + ': ' + c.st[k] + '\n' + S0.d + '\n' + per)); }); d.append(st);
  const tr = el('div', 'chips'); c.tr.forEach(t => { const fit = !seat || (TUTOR_TR[seat] || []).includes(t), x = el('span', 'chip gold' + (seat && !fit ? ' half' : ''), TRAITS[t].n); tr.append(tip(x, traitTip(t) + (seat ? fit ? '\nCombina com o cargo: vale inteiro' : '\nFora do cargo: vale ' + Math.round(COUNCIL_TRAIT_W * 100) + '%' : fam ? '' : '\nNo governante: vale inteiro'))); }); d.append(tr);
  const I = IDEOS[c.ld], ib = el('div', 'cideo'); if (I) { const b0 = el('b', '', '⚑ ' + I.n); b0.style.color = I.col; ib.style.borderLeftColor = I.col; ib.append(tip(b0, 'Ideologia: ' + I.n + '\nPuxa o país para ela (governante pesa 3, conselheiro 1) e define o apoio nas votações e eleições.')); }
  const pr = el('div', 'chips'); if (c.lg && GOVS[c.lg]) pr.append(tip(el('span', 'chip', '🏛️ ' + GOVS[c.lg].n), 'Quer esta forma de governo: apoia a reforma se for votada; enquanto não for, pressiona (conselheiro) ou tira estabilidade (governante).'));
  if (c.ll && LAWS[c.ll.k]) pr.append(tip(el('span', 'chip', '📜 ' + LAWS[c.ll.k].n + ': ' + LAWS[c.ll.k].o[c.ll.o].n), 'Lei preferida: apoia a votação dela e atrapalha a de outra opção da mesma lei.'));
  if (pr.children.length) ib.append(pr); if (ib.children.length) d.append(ib);
  if (!fam) { const sum = {}; for (const [, o] of charMods(n, c, seat)) for (const k in o) sum[k] = (sum[k] || 0) + o[k]; const ch = el('div', 'chips rende');
    for (const k in sum) if (Math.abs(sum[k]) >= .0005) ch.append(el('span', 'chip ' + ((k === 'coup' ? -sum[k] : sum[k]) > 0 ? 'p' : 'n'), (MODS[k] || 'Golpe') + ' ' + (sum[k] >= 0 ? '+' : '−') + Math.abs(sum[k] * 100).toFixed(1).replace('.0', '') + '%'));
    if (ch.children.length) d.append(tip(ch, 'O que ' + (seat ? 'este conselheiro' : 'o governante') + ' rende ao país agora (atributos e traços). Detalhes na aba Modificadores.')); }
  if (c !== n.ruler && c.op != null) d.append(tip(opBar(c.op), 'Opinião sobre o governante: ' + Math.round(c.op) + '\n' + (opParts(n, c).map(([k, v]) => k + ' ' + (v > 0 ? '+' : '') + v).join('\n') || 'Indiferente') + (seat ? '\nAbaixo de −30, conspira (risco de golpe) e atrapalha as votações.' : '')));
  const st2 = el('div', 'chips'); if (c.coopt > S.t) st2.append(tip(el('span', 'chip p', '🤝 cooptado'), 'Vota a favor das suas propostas e não pressiona até ' + yearOf(c.coopt)));
  if (c.disc > S.t) st2.append(tip(el('span', 'chip n', '🗞️ desacreditado'), 'Voto e pautas pesam 40% até ' + yearOf(c.disc))); if (c.inv) st2.append(tip(el('span', 'chip', '🔎 investigado'), 'Resultado em ' + dateStr(c.inv)));
  if (n.plot && n.plot.cid === c.id) st2.append(el('span', 'chip n', '🗡️ alvo do plano')); if (st2.children.length) d.append(st2);
  if (extra) d.append(extra);
  if (n.id === S.player && c !== n.ruler) { d.oncontextmenu = e => { e.preventDefault(); courtMenu(n, c, e.clientX, e.clientY); }; d.classList.add('ctxable'); tip(d.querySelector('.cname'), 'Botão direito: agradar ou intrigar'); }
  return d;
}
/* menu do botão direito num membro: interações amigáveis e intrigas (INTERACT) */
function courtMenu(n, c, sx, sy) {
  const m = $('#ctx'); m.innerHTML = ''; const close = () => { m.hidden = true; };
  m.append(el('h4', '', charName(c) + ' · opinião ' + Math.round(c.op ?? 0)));
  const sect = (kind, title) => { m.append(el('small', 'dim', title)); const r = el('div', 'row wrap');
    Object.entries(INTERACT).filter(([, d]) => d.kind === kind).forEach(([k, d]) => { const why = interactWhy(n, c, k), cost = interactCost(n, c, k), ch = interactChance(n, c, k);
      const lbl = d.e + ' ' + d.n + (cost ? ' (💰' + cost + ')' : d.pres ? ' (👑' + d.pres + ')' : '');
      const tt = (d.op ? 'Opinião +' + d.op : d.d || '') + (k === 'coopt' || k === 'slander' ? '\nChance: ' + Math.round(ch * 100) + '% (sua intriga ' + Math.round(plotPower(n, c)) + ' contra defesa ' + Math.round(plotDefense(n, c)) + ')' : '') + (k === 'kill' ? '\nSua intriga ' + Math.round(plotPower(n, c)) + ' contra defesa ' + Math.round(plotDefense(n, c)) + (c === n.council.spymaster ? '\nO alvo é o chefe da intriga: só a do governante e dos amigos conta' : '') : '') + '\nDe novo com esta pessoa só depois de ' + (d.cd || 12) + ' meses';
      r.append(btn(lbl, () => { const e = act('interact', c.id, k); say(e || 'Feito.', e ? 'bad' : 'good'); close(); refresh(); }, 'sm' + (kind === 'hostile' ? ' red' : ''), why, tt)); });
    m.append(r); };
  sect('friend', 'Agradar'); sect('hostile', 'Intriga');
  m.hidden = false; const w = m.offsetWidth, h = m.offsetHeight; m.style.left = Math.max(6, Math.min(innerWidth - w - 6, sx)) + 'px'; m.style.top = Math.max(56, Math.min(innerHeight - h - 6, sy)) + 'px';
}
/* plano de eliminação em andamento: barra dourada (sucesso) contra a vermelha (fracasso) */
function plotCard(b, n, msg) {
  const P = n.plot; if (!P) return; const t = courtFind(n, P.cid); if (!t) return; const c = el('div', 'card plot-card'); c.style.marginTop = '12px';
  c.append(el('h4', '', '🗡️ Plano contra ' + charName(t)), el('small', 'dim', 'Sucesso ' + Math.round(P.ok) + '%'), bar(P.ok / 100, '#e8c25a'), el('small', 'dim', 'Fracasso ' + Math.round(P.bad) + '%'), bar(P.bad / 100, '#e5636b'));
  c.append(btn('Abandonar o plano', () => { act('abandonPlot'); msg.textContent = 'Plano abandonado.'; refresh(); }, 'sm'));
  b.append(tip(c, 'Sua intriga: ' + Math.round(plotPower(n, t)) + ' (governante, quem gosta muito de você e o chefe da intriga' + (t === n.council.spymaster ? ' — que é o alvo, então não conta' : '') + ')\nDefesa do alvo: ' + Math.round(plotDefense(n, t)) + '\nA cada mês as duas barras andam; se a vermelha chegar ao fim primeiro, o plano fracassa e pode ser descoberto.\nEventos do plano ajudam ou atrapalham.'));
}
function secretRow(n, ch, seat, msg) {
  if (!(ch.secK && ch.sec)) return null; const r = el('div', 'row');
  r.append(tip(el('span', 'chip n', SECRETS[ch.sec].e + ' ' + SECRETS[ch.sec].n), 'Segredo descoberto pelo ' + roleName(n, 'spymaster').toLowerCase()));
  if (ch.secK === 1) { r.append(btn('Chantagear', () => { msg.textContent = act('useSecret', ch.id, 'blackmail'); drawWin(); }, 'sm', '', 'Fica com medo: opinião +30 e não conspira por 10 anos'));
    if (seat) r.append(btn('Expor', () => { msg.textContent = act('useSecret', ch.id, 'expose'); drawWin(); }, 'sm red', '', 'Cai em desgraça e deixa o cargo; ' + presName(n).toLowerCase() + ' +3')); }
  return r;
}
/* sucessão: lei, herdeiro e regência (aba Governo, logo depois do título) */
function succCard(n) {
  const sc = el('div', 'card'), law = LAWS.succ.o[n.laws.succ], hered = GOVS[n.gov].succ === 'hered';
  sc.append(el('h4', '', '⚜️ Sucessão'));
  if (!hered) { const g = GOVS[n.gov], F = ELECT_FORMS[g.succ] || { n: g.succ, d: '' }, w = VOTE_W[n.laws.vote] || VOTE_W.nobles;
    sc.querySelector('h4').textContent = '🗳️ ' + F.n;
    sc.append(el('div', '', F.d.replace('{term}', g.term || 4)));
    if (g.succ === 'term' || g.succ === 'council') sc.append(el('div', 'dim', 'Próxima: ' + (n.termEnd || curYear()) + ' · mandato de ' + (g.term || 4) + ' anos'));
    if (g.succ === 'term') sc.append(tip(el('div', 'dim', 'Eleitorado (' + LAWS.vote.o[n.laws.vote].n + '): alta ' + pct(w[0]) + ' · média ' + pct(w[1]) + ' · baixa ' + pct(w[2])), 'Peso de cada classe na votação, pela lei de sufrágio.'));
    if (F.pick) sc.append(el('small', 'dim', 'Você escolhe o novo líder entre 4 candidatos do partido ou do conselho.')); }
  else { const kids = (n.kids || []).slice().sort((a, b) => a.born - b.born); sc.append(tip(el('div', '', 'Lei: ' + law.n), law.d + '\nMude na aba Leis.'), el('div', 'dim', kids.length ? 'Herdeiro: ' + charName(kids[0]) + ' · ' + ageOf(kids[0]) + ' anos' : 'Sem herdeiros: crise de sucessão ou união pessoal'));
    if (n.regent) sc.append(el('div', 'gold', 'Regência de ' + charName(n.regent) + ' até ' + charName(n.ruler) + ' fazer 16 anos')); }
  sc.style.marginTop = '12px'; return sc;
}
/* conselho: governante, família e os cinco assentos (escolhidos conforme o governo), pautas, prestígio, sucessão e esquemas */
function winCouncil(b, n) {
  const msg = el('div', 'msg'), M = COUNCIL_MODE[GOVS[n.gov].cat] || { n: 'Nomeados', act: 'Trocar' };
  b.append(tip(el('p', 'dim', '👥 ' + M.n + (M.ideo ? ' · da ideologia do governo' : '') + (M.faith ? ' · da fé oficial' : '') + (M.merit ? ' · atributo do cargo +' + M.merit : '') + (M.mil ? ' · Marcial +' + M.mil : '')),
    'Cada conselheiro rende por todos os atributos, e bem mais pelo atributo do assento (a cor do cargo).\nTraços que combinam com o cargo valem inteiros; os outros, ' + Math.round(COUNCIL_TRAIT_W * 100) + '%.\nO governante rende mais por ponto, em todos os atributos, sem depender de assento.'));
  const top = el('div', 'cols'); top.append(seatCard(n, n.ruler, '👑 ' + titleOf(n), null, n.regent ? el('div', 'gold', 'Regência de ' + charName(n.regent)) : null));
  if (n.spouse) top.append(seatCard(n, n.spouse, roleName(n, 'spouse'), null, null, true));
  const kids = (n.kids || []).slice().sort((a, x) => a.born - x.born);
  if (kids.length) { const k0 = kids[0], ex = el('div');
    if (ageOf(k0) < 16) { const sel = el('select'); COUNCIL.forEach(([k]) => sel.append(new Option('Tutor: ' + roleName(n, k), k))); sel.value = k0.tut || ''; sel.onchange = () => { act('setTutor', k0.id, sel.value); drawWin(); }; ex.append(tip(sel, 'Aos 16 anos: +3 no atributo do tutor e, com sorte, um traço dele.')); }
    if (kids.length > 1) ex.append(el('small', 'dim', 'Outros: ' + kids.slice(1).map(k => k.n + ' (' + ageOf(k) + ')').join(', ')));
    top.append(seatCard(n, k0, k0.f ? 'Herdeira' : 'Herdeiro', null, ex, true)); }
  b.append(top);
  const cc = el('div', 'cols cseats'); cc.style.marginTop = '12px';
  COUNCIL.forEach(([k, , s0]) => { const t = roleName(n, k), ch = n.council[k], ex = el('div'), sr = secretRow(n, ch, k, msg); if (sr) ex.append(sr);
    ex.append(btn(M.act + ' (💰' + councilCost() + ')', () => councilPick(k, t), 'sm', apptWhy(n, k), 'Escolha entre 3 candidatos. O assento usa ' + STATS[s0].n + '.\nDepois de nomear, o cargo só muda de novo em ' + APPOINT_CD + ' meses (' + APPOINT_CD_DEATH + ' se o ocupante morrer).')); cc.append(seatCard(n, ch, t, k, ex)); });
  b.append(el('h3', 'gold', 'Conselho'), cc);
  // agenda: o que governante e conselho querem, agrupado por proposta, com quem apoia, apoio previsto e o botão de propor
  const dm = demandsOf(n), dc = el('div', 'card agenda'); dc.style.marginTop = '12px';
  dc.append(tip(el('h4', '', '🗂️ Agenda do conselho'), 'O que o governante e os conselheiros querem — pela ideologia de cada um — e o país já pode adotar.\nPautas de conselheiros não atendidas enchem a pressão; em 100%, o mais insatisfeito pode tomar o poder.\nPropor abre a votação; quem pediu ajuda a aprovar. Cooptar um conselheiro faz ele parar de pressionar.'));
  dc.append(tip(el('div', 'dim', 'Pressão do conselho: ' + Math.round(n.press || 0) + '%'), 'Sobe com pautas não atendidas (mais rápido com estabilidade baixa e classe alta insatisfeita); desce quando não há pautas.'), bar((n.press || 0) / 100, (n.press || 0) > 70 ? '#e5636b' : '#e8c25a'));
  const groups = new Map(); dm.forEach(d => { const key = d.ty + ':' + (d.k || '') + ':' + d.v; if (!groups.has(key)) groups.set(key, { d, who: [] }); groups.get(key).who.push(d); });
  if (!groups.size) dc.append(el('div', 'dim', 'Ninguém pede nada agora.'));
  const busyE = n.enact ? 'Já há uma votação: ' + enactName(n.enact) : '';
  [...groups.values()].sort((a, x) => x.who.reduce((s0, y) => s0 + y.w, 0) - a.who.reduce((s0, y) => s0 + y.w, 0)).forEach(({ d, who }) => {
    const row = el('div', 'arow'), ic = d.ty === 'gov' ? '🏛️' : d.ty === 'law' ? '📜' : '⚑', title = el('div', 'atitle');
    title.append(el('b', '', ic + ' ' + demandTxt(d)), el('small', 'dim', d.ty === 'gov' ? 'Reforma de governo' : d.ty === 'law' ? 'Lei' : 'Ideologia do país'));
    const ch = el('div', 'chips'); who.forEach(x => { const s0 = x.slot !== 'ruler' ? COUNCIL.find(c => c[0] === x.slot) : null, c0 = el('span', 'chip', (x.slot === 'ruler' ? '👑 ' : '') + x.t); if (s0) { c0.style.color = STATS[s0[2]].col; c0.style.borderColor = STATS[s0[2]].col; } ch.append(tip(c0, x.t + ' ' + charName(x.c) + (IDEOS[x.c.ld] ? ' · ' + IDEOS[x.c.ld].n : '') + (x.slot === 'ruler' ? '\nVontade do governante: −2 de estabilidade enquanto não for atendida' : '\nSoma ' + x.w + ' à pressão enquanto não for atendida'))); });
    row.append(title, ch);
    let go;
    if (d.ty === 'ideo') go = btn('Adotar', () => { const e = act('setIdeo', d.v); msg.textContent = e; if (!e) refresh(); }, 'sm', n.ideoCd > S.t ? 'Mudança recente (até ' + yearOf(n.ideoCd) + ')' : '', modLines(IDEOS[d.v].m).join('\n'));
    else { const E = { ty: d.ty, k: d.k, v: d.v, prog: 0, ph: 0 }, sp = enactSupport(n, E), mo = Math.ceil(300 / enactRate(n, E));
      row.append(tip(el('small', 'dim', 'Apoio previsto ' + (sp.tot >= 0 ? '+' : '') + sp.tot.toFixed(1) + ' · ~' + mo + ' meses'), sp.list.filter(x => x.v).map(x => (x.v > 0 ? '👍 ' : '👎 ') + x.role + ' — ' + x.why.join(', ')).join('\n') || 'Ninguém se importa'));
      go = d.ty === 'law' ? btn('Propor (💰' + lawCost() + ')', () => { const e = act('setLaw', d.k, d.v); msg.textContent = e; if (!e) refresh(); }, 'sm grn', busyE || ((n.lawCd || {})[d.k] > S.t ? 'Mudada há pouco' : ''), 'Abre a votação desta lei')
        : btn('Propor reforma (💰' + govCost() + ')', () => { const e = act('setGov', d.v); msg.textContent = e; if (!e) refresh(); }, 'sm grn', busyE || (n.govCd > S.t ? 'Reforma recente (até ' + yearOf(n.govCd) + ')' : ''), govTip(d.v)); }
    row.append(go); dc.append(row); });
  b.append(dc); plotCard(b, n, msg);
  // esquemas
  const ec = el('div', 'card'); ec.style.marginTop = '12px'; ec.append(tip(el('h4', '', '🕵️ Operações no exterior · força ' + Math.round(schemePower(n))), 'Força: astúcia do ' + roleName(n, 'spymaster').toLowerCase() + ' e metade da do governante (conspiradores +5).\nUm esquema por vez; contra outro país, a força deles atrapalha e o risco de ser descoberto sobe.\nDescoberto: ' + presName(n).toLowerCase() + ' −10 (e relação −50 com o alvo).'));
  if (n.scheme) { const s0 = n.scheme; ec.append(el('div', '', schemeTxt(n, s0)), bar(s0.prog, '#b48be0'), btn('Cancelar', () => { act('cancelScheme'); drawWin(); }, 'sm')); }
  else ec.append(el('div', 'dim', 'Nenhuma operação agora. Clique com o botão direito num país no mapa para começar uma.'));
  const intel = Object.entries(n.intel || {}).filter(([id]) => nat(+id).alive); if (intel.length) { ec.append(el('h4', '', 'Segredos de outros governantes'));
    intel.forEach(([id, I]) => { const o = nat(+id), r = el('div', 'brow'); r.append(el('span', 'nm', charName(o.ruler) + ' · ' + natName(o) + ' · ' + SECRETS[I.sec].e + ' ' + SECRETS[I.sec].n), btn('Expor', () => { msg.textContent = act('exposeForeign', +id); drawWin(); }, 'sm red', o.ruler.id !== I.cid ? 'Outro governante agora' : '', presName(o) + ' deles −15 e estabilidade −8; o seu +3')); ec.append(r); }); }
  b.append(ec, msg);
}
/* religião: crenças, doutrinas e o que muda em relação à fé oficial do jogador */
function relTip(r) {
  const R0 = RELIGIONS[REL_IDS[r]], F = faithOf(+r), n = S && S.player >= 0 ? me() : null, o = [R0.e + ' ' + R0.n + ' · ' + (FAITH_GRP[F.grp] || 'Fé local')];
  if (F.d) o.push(F.d); if (R0.fict) o.push('Heresia nascida no jogo: espalha-se sozinha onde não há Igreja de Estado.'); if (R0.atheist) o.push('Surge depois de ' + R0.y0 + ' com a educação; cresce muito no Estado laico. Pode ser a fé oficial.');
  if (F.dc) o.push('Doutrinas: ' + Object.keys(DOCTRINES).map(k => DOCTRINES[k].o[F.dc[k]].n.toLowerCase()).join(', '));
  if (F.tn) o.push('Princípios: ' + F.tn.map(t => TENETS[t].n).join(', '));
  if (F.doc && Object.keys(F.doc).length) o.push('Como fé oficial: ' + modLines(F.doc).join(', '));
  o.push(F.head ? 'Chefe: ' + F.head[1] + ' (' + F.head[0] + ')' : 'Sem chefe religioso'); o.push(F.holy ? 'Guerra santa: ' + F.holy : 'Não faz guerra santa');
  if (n && n.relig != null && +r !== n.relig) { const M = faithOf(n.relig), diff = F.dc && M.dc ? Object.keys(DOCTRINES).filter(k => F.dc[k] !== M.dc[k]).map(k => DOCTRINES[k].n.toLowerCase() + ' (' + DOCTRINES[k].o[F.dc[k]].n.toLowerCase() + ' × ' + DOCTRINES[k].o[M.dc[k]].n.toLowerCase() + ')') : [];
    o.push('\nComparada à sua fé (' + RELIGIONS[REL_IDS[n.relig]].n + '): ' + (F.grp === M.grp ? 'mesmo grupo — guerras santas entre vocês não valem' : 'outro grupo — alvo possível de guerra santa') + (diff.length ? '\nDiferem em: ' + diff.join('; ') : '\nMesmas doutrinas'));
    const pol = (n.rpol || {})[r] || 0; o.push('No seu país: ' + RPOL_N[pol][0] + (pol === 2 ? ' — reconhecida: rende parte da doutrina dela, pela fração de fiéis' : ' — reconhecê-la (autonomia +2) rende parte da doutrina dela')); }
  return o.join('\n');
}
/* janela da Fé: a fé oficial e as religiões do povo */
function winFaithW(b) { const n = me(), tab = tabs(b, 'faithTab', [['state', '🙏 Fé oficial'], ['rel', '⛪ Religiões do povo']]); if (tab === 'state') winFaith(b, n); else winPop(b, 'rel'); }
/* fé oficial: doutrina, fervor, chefe religioso e guerra santa */
function winFaith(b, n) {
  const R0 = RELIGIONS[REL_IDS[n.relig]], F = faithOf(n.relig), h = headOf(n.relig), msg = el('div', 'msg'), c = el('div', 'cols');
  const d = el('div', 'card'); d.append(tip(el('h4', '', R0.e + ' ' + R0.n), relTip(n.relig)), el('div', 'dim', (FAITH_GRP[F.grp] || '') + ' · ' + (F.d || '')), modChips(F.doc));
  if (F.dc) { const ch = el('div', 'chips'); for (const k in DOCTRINES) { const o = DOCTRINES[k].o[F.dc[k]]; ch.append(tip(el('span', 'chip', DOCTRINES[k].n + ': ' + o.n), [o.m ? modLines(o.m).join(', ') : '', o.mw ? 'Minorias religiosas pesam ×' + o.mw : '', o.noHoly ? 'Não faz guerra santa' : '', o.fr ? 'Governantes mulheres ×' + o.fr : '', o.kids ? 'Herdeiros ×' + o.kids : ''].filter(Boolean).join('\n') || 'Sem efeito direto')); }
    (F.tn || []).forEach(t => ch.append(tip(el('span', 'chip p', '✦ ' + TENETS[t].n), 'Princípio: ' + modLines(TENETS[t].m).join(', ')))); d.append(ch); }
  c.append(d);
  const fv = el('div', 'card'), v = n.ferv ?? 50; fv.append(tip(el('h4', '', '🙏 Fervor · ' + Math.round(v) + '% (alvo ' + Math.round(n.fervT ?? v) + '%)'), 'Anda 1 ponto por mês até o alvo:\n' + fervParts(n).map(([k, x]) => k + ' ' + (x > 0 ? '+' : '') + x).join('\n')), bar(v / 100, '#e8c25a'));
  c.append(tip(fv, 'Alto: estabilidade e contingente, um pouco menos de pesquisa; a fé oficial converte mais rápido.\nBaixo: o contrário, e heresias e reformas se espalham.\nCada 10 pontos acima de 50: estabilidade +2%, contingente +1%, pesquisa −1%.'));
  b.append(c);
  if (h) { const hc = el('div', 'card'), seat = seatOf(n.relig), fav = n.fav ?? 50; hc.style.marginTop = '12px';
    hc.append(el('h4', '', '⛪ ' + h[0] + (n.excom ? ' · ⛔ excomungado' : '')), el('div', 'dim', 'Sede: ' + (seat != null ? WD.provs[seat].n + ' (' + (S.own[seat] >= 0 ? natName(nat(S.own[seat])) : 'sem dono') + ')' + (seatLost(n.relig) ? ' — em mãos infiéis' : '') : '—')));
    hc.append(tip(el('div', '', 'Favor do ' + h[1].toLowerCase() + ': ' + Math.round(fav)), 'Abaixo de ' + FERV.excom + ' pode haver excomunhão (−10% de estabilidade e −30 de relação com os da mesma fé); volta ao normal com ' + FERV.lift + '.\nSobe com doações, vitórias em guerras santas e peregrinações.'), bar(fav / 100, fav < FERV.excom ? '#e5636b' : '#7fb3d5'));
    const r = el('div', 'row');
    r.append(btn('💰 Doar (💰' + donateCost() + ')', () => { msg.textContent = act('faithAct', 'donate'); drawWin(); drawTop(); }, 'sm', n.money < donateCost() ? 'Sem dinheiro' : '', 'Favor +10'));
    r.append(btn('👑 Pedir investidura (−' + FERV.invest + ' favor)', () => { msg.textContent = act('faithAct', 'invest'); drawWin(); }, 'sm', fav < FERV.invest ? 'Favor insuficiente' : n.investCd > S.t ? 'Investidura recente' : '', 'Estabilidade +5% por 10 anos e prestígio +5; uma vez a cada 10 anos'));
    hc.append(r); b.append(hc); }
  const tg = [...neighbors(n)].map(nat).concat(seatLost(n.relig) && S.own[seatOf(n.relig)] >= 0 ? [nat(S.own[seatOf(n.relig)])] : []).filter((t, i, a) => a.indexOf(t) === i && !holyWhy(n, t));
  const hw = el('div', 'card'); hw.style.marginTop = '12px'; hw.append(tip(el('h4', '', '⚔️ ' + holyName(n.relig)), 'Contra vizinhos de outra família de fé ou contra quem tem a sede da sua fé.\nCusta só −3 de estabilidade; vencer dá +15 de fervor e de favor a todos do seu lado com a mesma fé.' + (h ? '\nConvocar como ' + holyName(n.relig).toLowerCase() + ' (−' + FERV.crusade + ' favor) chama os países da mesma fé com favor 50+.' : '')));
  if (!tg.length) hw.append(el('div', 'dim', 'Nenhum alvo possível agora.'));
  tg.slice(0, 12).forEach(t => { const r = el('div', 'brow'); r.append(flagImgEl(t.flag), el('span', 'nm', natName(t) + ' · ' + RELIGIONS[REL_IDS[t.relig]].e), btn('Declarar', () => { const e = act('declareWar', t.id, null, 'holy'); msg.textContent = e; if (!e) { closeWin(); refresh(); } }, 'sm red'));
    if (h) r.append(btn('Convocar', () => { const e = act('faithAct', 'crusade', t.id); msg.textContent = e; if (!e) { closeWin(); refresh(); } }, 'sm red', (n.fav ?? 50) < FERV.crusade ? 'Favor insuficiente' : ''));
    hw.append(r); });
  b.append(hw, msg);
}
function winGov(b) {
  const n = me(), msg = el('div', 'msg'), tab = tabs(b, 'govTab', [['gov', '🏛️ Governo'], ['council', '👥 Conselho'], ['ideo', '⚑ Ideologia'], ['laws', '📜 Leis'], ['mods', '📊 Modificadores']]);
  if (tab === 'council' || tab === 'court') { winCouncil(b, n); return; }
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
      ec.append(btn('📣 Campanha (💰' + campaignCost() + ')', () => { const e = act('campaign'); msg.textContent = e; if (!e) refresh(); }, 'sm', n.campCd > S.t ? 'Campanha recente' : '', '+6% de apoio ao partido do governo; uma vez por ano'));
      b.append(ec);
    }
    b.append(el('h3', 'gold', 'Mudar ideologia'), msg);
    const AXN = { '-2': 'Reacionárias', '-1': 'Conservadoras', '0': 'De centro', '1': 'Reformistas', '2': 'Revolucionárias' }, held = {};
    [n.ruler, n.spouse, ...Object.values(n.council || {})].forEach(c => { if (c && c.ld) held[c.ld] = (held[c.ld] || 0) + 1; });
    [-2, -1, 0, 1, 2].forEach(ax => { const list = Object.keys(IDEOS).filter(i => (IDEOS[i].ax || 0) === ax).sort((a, x) => IDEOS[a].y0 - IDEOS[x].y0); if (!list.length) return;
      b.append(tip(el('h4', 'era', AXN[ax]), 'Radicalismo ' + ax + '. Pessoas mudam de ideologia aos poucos, quase sempre para outra perto no radicalismo.\nGenerais com ideologia 2+ pontos longe da do país podem dar golpe.')); const io = el('div', 'grid-opts');
      list.forEach(i => { const d = IDEOS[i], ok = n.fx.i.has(i), o = el('div', 'opt' + (n.ideo === i ? ' on' : '') + (ok ? '' : ' off')); o.style.borderLeft = '4px solid ' + d.col; tip(o, d.n + '\n' + modLines(d.m).join('\n') + '\nAgressividade na IA ×' + d.war + '\nTrocar custa ' + Math.max(2, 12 - (inf[i] || 0) * 2) + ' de estabilidade' + (ok ? '' : '\n⛔ Exige tecnologia') + (n.ideoCd > S.t && n.ideo !== i ? '\n⏳ Mudança recente: a próxima só em ' + yearOf(n.ideoCd) : ''));
        o.append(el('b', '', d.n + (inf[i] ? ' · ⚑' + inf[i] : '')), el('small', 'dim', 'surge ~' + d.y0 + (d.y1 < 2200 ? ' · em alta até ~' + d.y1 : '') + (held[i] ? ' · ' + held[i] + ' na sua corte' : '')), modChips(d.m)); if (ok && n.ideo !== i) o.onclick = () => { const e = act('setIdeo', i); msg.textContent = e; if (!e) refresh(); }; io.append(o); });
      b.append(io); });
    return;
  }
  enactCard(b, n, msg);
  if (n.senior != null) b.append(el('p', 'gold', (n.subj ? SUBJECTS[n.subj.tier].n : 'Súdito') + ' de ' + natName(nat(n.senior)) + ' · liberdade ' + Math.round(n.subj ? n.subj.lib : 0) + '%.'));
  const tc = el('div', 'card'), ns = statesOf(n), r = n.rank || 0, cap = domCap(n); tc.style.marginTop = '12px';
  tc.append(el('h4', '', 'Título · ' + RANK_N[r]), el('div', '', natName(n) + ' · ' + titleOf(n)), tip(el('small', ns > cap ? 'bad' : 'dim', 'Limite de domínio: ' + ns + ' de ' + cap + ' estados'), 'Limite de domínio (Domain Limit): quantos estados o título sustenta, inteiros ou não.\nBase do título ' + RANK_CAP[r] + ' × ' + domainMul(n).toFixed(2) + ' (era até +' + Math.round(DOMAIN.era * 100) + '%, administração até +' + Math.round(DOMAIN.adm * 100) + '%).\nAcima do limite: −3 de estabilidade por estado a mais, sem colonizar e sem anexar além disso na paz.'), bar(cap < 1e8 ? ns / cap : .2, ns > cap ? '#e5636b' : '#d9b45a'));
  const ladder = el('div', 'chips'); RANK_N.forEach((rn, k) => ladder.append(tip(el('span', 'chip' + (k === r ? ' p' : ''), rn + ': ' + rankFmt(n, k).replace('{}', n.name)), rn + '\nTítulo do governante: ' + rankTitle(n, k) + '\nLimite de domínio: ' + rankCap(n, k) + ' estados (base ' + RANK_CAP[k] + ')' + '\nProclamar exige ' + rankReqTxt(n, k)))); tc.append(ladder);
  if (r < 4) tc.append(btn('👑 Proclamar ' + RANK_N[r + 1] + ' (💰' + rankCost(n) + ')', () => { const e = act('rankUp'); msg.textContent = e; if (!e) refresh(); }, 'grn', ns < RANK_REQ[r + 1] ? 'Exige ' + RANK_REQ[r + 1] + ' estados (tem ' + ns + ')' : n.money < rankCost(n) ? 'Sem dinheiro' : '', 'Vira ' + rankFmt(n, r + 1).replace('{}', n.name) + ' · −5 de estabilidade'));
  tc.append(tip(el('div', 'dim', '⭐ Capital: ' + WD.provs[n.capital].n + (n.capCd > S.t ? ' · nova mudança em ' + yearOf(n.capCd) : '')), 'A capital tem +2 de fortificação. Se for ocupada: −2 de estabilidade por mês e +25% de rendição na guerra.\nPara mudar, clique numa província sua e use "Tornar capital" (uma vez a cada 10 anos).'));
  b.append(tc, succCard(n));
  govTree(b, n, msg);
}
/* importações: de onde vem cada bem (suserano primeiro, se for súdito) e quanto custa; o suserano vê o que vendeu aos súditos */
function winImports(b, n) {
  const mk = n.mk, sen = isSubj(n) ? nat(n.senior) : null;
  if (sen) { const r = el('div', 'row'); r.append(el('small', 'dim', 'Comprar primeiro de:'));
    [['senior', '👑 ' + natName(sen)], ['world', '🌍 Mercado mundial']].forEach(([k, l]) => r.append(btn(l, () => { act('setImpPref', k); drawWin(); }, 'sm' + ((n.impPref || 'senior') === k ? ' on' : ''), '', k === 'senior' ? 'O excedente do suserano sai a preço mundial, sem frete; ele ganha com a venda' : 'Ignora o suserano e compra do exportador mais barato')));
    b.append(r); }
  const t = el('table', 't'), hr = t.insertRow(); ['Bem', 'Importa', 'Do suserano', 'Origem', 'Preço', 'Custo/mês'].forEach(x => hr.append(el('th', '', x)));
  let tot = 0, any = false;
  GOOD_IDS.forEach(g => { const q = (mk.imp || {})[g] || 0; if (q < .05) return; any = true;
    const qs = (mk.impS || {})[g] || 0, src = (mk.src || {})[g], pw = S.wp[g], cost = qs * pw + (q - qs) * pw * 1.05 * (src && !src.sen ? src.m : 1); tot += cost;
    const r = t.insertRow(); r.insertCell().textContent = GOODS[g].e + ' ' + GOODS[g].n;
    [q, qs].forEach(v => { const c = r.insertCell(); c.className = 'n'; c.textContent = v < .05 ? '—' : v >= 10 ? Math.round(v) : v.toFixed(1); });
    const o = r.insertCell(); o.textContent = q - qs < .05 ? '👑 suserano' : src && src.o >= 0 && !src.sen ? natName(nat(src.o)) + (src.sea ? ' ⛵' : ' 🐎') : '🌍 mercado mundial';
    const p = r.insertCell(); p.className = 'n'; p.textContent = pw.toFixed(1); const c = r.insertCell(); c.className = 'n bad'; c.textContent = money(cost); });
  if (!any) { b.append(el('p', 'dim', 'Nada importado: a produção cobre o consumo.')); }
  else { const r = t.insertRow(); r.insertCell().textContent = 'Total'; for (let i = 0; i < 4; i++) r.insertCell(); const c = r.insertCell(); c.className = 'n gold'; c.textContent = money(tot); b.append(t); }
  const sold = Object.entries(mk.subT || {}).filter(([, v]) => v > .05);
  if (sold.length) { b.append(el('h4', 'bgrp', '👑 Vendido aos súditos')); const t2 = el('table', 't'); sold.forEach(([g, v]) => { const r = t2.insertRow(); r.insertCell().textContent = GOODS[g].e + ' ' + GOODS[g].n; const c = r.insertCell(); c.className = 'n'; c.textContent = v >= 10 ? Math.round(v) : v.toFixed(1); }); b.append(t2); }
}
function winEco(b) {
  const n = me(), msg = el('div', 'msg'), tab = tabs(b, 'ecoTab', [['over', '📊 Visão geral'], ['goods', '📦 Bens'], ['imp', '🚢 Importações'], ['laws', '⚖️ Leis econômicas']]);
  if (tab === 'laws') { lawGrid(b, n, true, msg); return; }
  if (tab === 'imp') { winImports(b, n); return; }
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
  const t = el('table', 't'); const lab = { tax: ['Impostos', '6% do PIB, ajustado por governo, leis, administração, mercados e estabilidade.\nMais impostos: mais ouro, porém leis de imposto alto custam estabilidade.'], trade: ['Exportações', 'Excedentes vendidos ao mercado mundial; portos, acordos e leis de comércio ajudam'], imports: ['Importações', 'O que falta é comprado até um orçamento; comida primeiro.\nO preço sobe com a distância até o país exportador: por mar (os dois com litoral) sai bem mais barato que por terra; acordos comerciais e portos ajudam.\nSem dinheiro, o que falta derruba estabilidade e produção.'], tribute: ['Tributo', 'Pago pelo súdito ao suserano: parte dos impostos, pelo nível e pela lei de tributo.'], subjSales: ['Vendas aos súditos', 'Súditos compram o seu excedente antes do mercado mundial: você ganha um extra sobre essas vendas.'], rep: ['Reparações', 'Parte dos impostos paga ao vencedor de uma guerra por 10 anos.'], transport: ['Frete entre estados', 'Prédios usam primeiro o que o próprio estado produz (barato e na hora).\nO resto vem de outros estados: chega com perdas e paga frete. O frete encarece a produção e sai do PIB tributável — aqui aparece o imposto que deixa de entrar.\nEstradas, ferrovias e rodovias no estado reduzem perdas e frete.'], army: ['Exército', 'Manutenção dos regimentos; sobe com a era'], navy: ['Marinha', 'Manutenção dos navios'], admin: ['Administração', 'Cresce com população e províncias; a cobertura de administração reduz em até 30%'], svc: ['Serviços públicos', 'Manutenção de hospitais, escolas, repartições e guardas (a lei de gastos muda isso)'], interest: ['Juros', '1% da dívida ao mês. Dívida grande demais leva à falência: estabilidade despenca e metade do exército debanda.'], corrupt: ['Corrupção', Math.round(HOARD_LEAK * 100) + '% ao mês do que passa do teto do tesouro (' + HOARD_MONTHS + ' meses de impostos) se perde.\nA cobertura de administração reduz em até 60%. Gaste em obras, exército ou pesquisa em vez de acumular.'] };
  Object.entries(n.inc).forEach(([k, v]) => { const r = t.insertRow(), c0 = r.insertCell(); c0.textContent = lab[k][0]; tip(c0, lab[k][1]); const c = r.insertCell(); c.className = 'n ' + (v < 0 ? 'bad' : 'good'); c.textContent = money(v); tip(c, lab[k][1]); });
  const tr = t.insertRow(); tr.insertCell().textContent = 'Total'; const tc = tr.insertCell(); tc.className = 'n gold'; tc.textContent = money(n.income); inc.append(t); sum.append(inc);
  const embs = S.nations.filter(o => o.alive && has(o, 'emb', n.id)).length;
  const g = el('div', 'card'); g.append(el('h4', '', 'Produção'), kv([['PIB', money(n.gdp) + '/mês', 'Valor de tudo o que o país produz por mês; base dos impostos'], ['População', popStr(n.popT)], ['Empregados', popStr(n.employed || 0), 'Quem trabalha nos prédios; o resto vive da subsistência.\nCada prédio exige trabalhadores livres no estado.'], ['Comida', pct(n.foodSat), 'Abaixo de 95% a população encolhe e a estabilidade cai'], ['Canteiros', n.cons.length + ' / ' + consSlots(n), 'Obras ao mesmo tempo: tecnologia, população, tesouro e canteiros comprados (janela de Construção)'], ['Acordos comerciais', (n.trade || []).length + '', '+7% de eficiência de comércio cada'], ['Embargos contra você', embs + '', '−8% de eficiência de comércio cada']]), modChips({ tax: n.m.tax, prod: n.m.prod, trade: n.m.trade, food: n.m.food })); sum.append(g);
  const sv = el('div', 'card'); sv.append(el('h4', '', 'Cobertura dos serviços'));
  for (const k in SVC) { const v = (n.cov || {})[k] || 0, r = el('div', 'brow'); r.append(el('span', 'e', SVC[k].e), el('span', 'nm', SVC[k].n + ' · ' + svcSrc(me(), k)), el('span', 'lv', pct(v))); tip(r, SVC[k].d + '\nConstrua no painel do estado. Estados com a capital ocupada perdem os serviços.'); sv.append(r, bar(v, '#7fc8e0')); }
  const ps = n.mk.sup.power || 0, pd = n.mk.dem.power || 0; sv.append(tip(el('div', pd > ps ? 'bad' : 'dim', '⚡ Energia: produz ' + Math.round(ps) + ' · consome ' + Math.round(pd)), 'Fábricas e população consomem energia a partir de 1885; sem energia, as fábricas produzem menos.\nFontes: carvão, óleo, hidrelétrica, nuclear, eólica, solar, fusão e a usina da sua vertente.'));
  sum.append(sv); b.append(sum);
}
function winTech(b) {
  const n = me(), areas = [['mil', '⚔️ Militar'], ['nav', '⚓ Naval'], ['eco', '💰 Economia'], ['soc', '🏛️ Sociedade']], tab = tabs(b, 'techTab', [...areas, ['vert', n.vert ? VERT[n.vert].e + ' ' + VERT[n.vert].n : '✨ Vertentes']]), stick = el('div', 'tstick'); stick.append(b.lastChild);
  const tbar = stick.lastChild; tbar.classList.add('ttabs'); tip(tbar.lastChild, n.vert ? 'Melhorias próprias de ' + VERT[n.vert].n + ' (' + n.vlv + '/' + VERT[n.vert].len + '); todas liberam ' + VERT[n.vert].unit[0] + ' e a frota especial' : 'Pontos iniciais de cada vertente');   // abas e cabeçalho fixos no topo
  const head = el('div', 'thead'), tr = n.res ? TECH[n.res] : null, cur = el('div', 'card tcur');
  const left = tr ? Math.max(0, techCost(n, tr) - n.rp) : 0, mon = tr ? Math.ceil(left / Math.max(.1, researchRate(n))) : 0;
  cur.append(el('h4', '', '🔬 Pesquisando agora'), el('b', tr ? '' : 'bad', tr ? tr.n + ' · ' + tr.y : 'Nada — clique numa tecnologia ▶ abaixo'), bar(tr ? n.rp / techCost(n, tr) : 0),
    tip(el('small', 'dim', tr ? Math.floor(n.rp) + ' / ' + techCost(n, tr) + ' · +' + researchRate(n).toFixed(1) + '/mês · ~' + (mon > 24 ? Math.round(mon / 12) + ' anos' : mon + ' meses') : '+' + researchRate(n).toFixed(1) + ' por mês'), 'Pontos de pesquisa vêm da população, universidades, educação, classe média, estabilidade e modificadores.\nPesquisar antes do tempo custa muito mais (⚠).'));
  if (tr) tip(cur, techTip(n, tr));
  const side = el('div', 'tside');
  { const e = n.era || 0, nx = ERAS[e + 1], miss = nx ? ERA_CORE[e + 1].filter(id => !hasT(n, id)) : [], lim = k => ERA_LIM[k][Math.min(ERA_LIM[k].length - 1, e)] + (nx ? ' → ' + ERA_LIM[k][Math.min(ERA_LIM[k].length - 1, e + 1)] : '');
    side.append(tip(el('div', 'gold', '🏺 ' + ERAS[e][1] + (nx ? ' · faltam ' + miss.length + ' para ' + nx[1] : '')), 'Era do país: avança ao completar todas as técnicas comuns da era atual.\nCanteiros ' + lim('slots') + ' · prédios por estado ' + lim('bld') + ' · serviços por estado ' + lim('svc') + (miss.length ? '\nFaltam: ' + miss.map(id => TECH[id].n).join(', ') : ''))); }
  const lg = el('div', 'chips'); [['done', '✓ Pesquisada', 'Já é sua'], ['av', '▶ Disponível', 'Clique para pesquisar'], ['lock', '🔒 Bloqueada', 'Falta pré-requisito, recurso ou outra vertente'], ['early', '⚠ Fora de época', 'Muito adiantada: custo multiplicado']].forEach(([c, t, d]) => lg.append(tip(el('span', 'chip lg-' + c, t), d)));
  const sb = el('input', 'tsearch'); sb.placeholder = '🔍 Buscar tecnologia (nome ou efeito)'; sb.value = UI.techQ || ''; sb.oninput = () => { UI.techQ = sb.value; const keep = sb.selectionStart; drawWin(); const nb = $('.tsearch'); if (nb) { nb.focus(); nb.setSelectionRange(keep, keep); } };
  const fl = btn(UI.techAv ? '▶ Só disponíveis' : '☰ Todas', () => { UI.techAv = !UI.techAv; drawWin(); }, 'sm' + (UI.techAv ? ' on' : ''), '', 'Alterna entre mostrar tudo ou só o que dá para pesquisar agora');
  const fr = el('div', 'row'); fr.append(fl, lg); side.append(sb, fr);
  head.append(cur, side); stick.append(head); b.append(stick);
  const q = (UI.techQ || '').trim().toLowerCase();
  const mineV = t => !t.v || (t.entry && !n.vert) || t.v === n.vert,   // escolhida a vertente, as outras somem da árvore
    hideRep = t => n.vert && !t.v && VERT[n.vert].rep.has(t.id) && !hasT(n, t.id);   // a versão da vertente aparece no lugar da comum
  const pv = tab === 'vert' && !n.vert && !q && UI.vprev && VERT[UI.vprev] ? VERT[UI.vprev] : null;   // prévia aberta: a aba mostra a árvore dessa vertente
  let list = pv ? TECHS.filter(t => t.v === pv.id && (t.vt || t.entry)) : q ? TECHS.filter(t => mineV(t) && !hideRep(t) && (t.n.toLowerCase().includes(q) || fxLines(techFx(t)).join(' ').toLowerCase().includes(q)))
    : tab === 'vert' ? TECHS.filter(t => n.vert ? t.vt && t.v === n.vert : t.entry)
    : TECHS.filter(t => t.c === tab && !t.vt && mineV(t) && !hideRep(t) && !(t.vr && hasT(n, t.vr)));
  if (UI.techAv) list = list.filter(t => !techState(n, t));
  if (q) b.append(el('small', 'dim', list.length + ' resultado' + (list.length === 1 ? '' : 's') + ' em todas as áreas'));
  if (pv) { const V = pv, c = el('div', 'card vprev'), why = vertAdoptWhy(n, V.id); c.style.borderLeft = '4px solid ' + V.col;
    const hd = el('div', 'vhead'); hd.append(el('h4', '', V.e + ' ' + V.n), btn('↩ Voltar à lista', () => { UI.vprev = null; drawWin(); }, 'sm', '', 'Volta para os pontos iniciais de todas as vertentes')); c.append(hd);
    c.append(el('div', 'dim', 'Recurso: ' + needName(V.id) + ' · prédio: ' + BUILDINGS[V.bld].n + ' · bem: ' + GOODS[V.good].n + ' · tropas: ' + V.unit.slice(0, 3).join(', ') + '…'),
      el('div', 'dim', 'Técnicas comuns depois de ' + V.entry.y + ' viram versões "' + VERT_SUF[V.id] + '" (ex.: ' + TECHS.filter(t => t.vr && t.v === V.id).slice(0, 3).map(t => t.n).join(', ') + '). Abaixo, as ' + V.len + ' melhorias próprias.'));
    const passed = hasT(n, 'v_' + V.id) || (n.vdec || {})[V.id];
    if (passed) c.append(btn('✨ Seguir ' + V.n + ' (💰' + vertAdoptCost() + ')', () => modal(m => { m.append(el('h2', '', V.e + ' Seguir ' + V.n + '?'), el('p', '', 'A escolha é para sempre: as técnicas comuns depois de ' + V.entry.y + ' viram versões ' + V.n + ', as outras vertentes somem da árvore e você perde os ' + pct(VERT_DECLINE) + ' de bônus que levava por ter recusado. Custa 💰' + vertAdoptCost() + ' e 5 de estabilidade.'));
        const r = el('div', 'row'); r.append(btn('Confirmar', () => { const e = act('adoptVert', V.id); closeModal(); say(e || 'Agora você segue ' + V.n + '.', e ? 'bad' : 'good'); if (!e) UI.vprev = null; refresh(); }, 'grn'), btn('Cancelar', closeModal)); m.append(r); }), 'grn', why, 'Adotar esta vertente agora'));
    else c.append(el('small', 'dim', 'Pesquise o ponto inicial (' + TECH['v_' + V.id].n + ') para poder escolher.'));
    b.append(c); }
  const nowEra = eraOf(curYear()), groups = new Map(); list.slice().sort((a, c) => a.y - c.y).forEach(t => { const e = eraOf(t.y); if (!groups.has(e)) groups.set(e, []); groups.get(e).push(t); });
  groups.forEach((ts, e) => {
    const done = ts.filter(t => hasT(n, t.id)).length, sec0 = el('div', 'tera' + (e === nowEra ? ' now' : ''));
    const h = el('div', 'terah'); h.append(el('b', '', e + (e === nowEra ? ' · agora' : '')), el('small', 'dim', done + ' / ' + ts.length), bar(done / ts.length, '#8fd17f')); tip(h, e + ': ' + done + ' de ' + ts.length + ' tecnologias desta área pesquisadas');
    const grid = el('div', 'tgrid'), ent = tab === 'vert' ? [] : ts.filter(t => t.entry && (!n.vert || t.v === n.vert)); ts.filter(t => tab === 'vert' || !t.entry).forEach(t => { const bx = techBox(n, t);
      if (tab === 'vert' && t.entry && !n.vert && !pv) { const w = el('div', 'tprevw'); w.append(bx, btn('👁', () => { UI.vprev = t.v; drawWin(); }, 'sm', '', 'Abrir ' + VERT[t.v].n + ': a árvore dela e a opção de segui-la' + (!vertAdoptWhy(n, t.v) ? '\n✨ Dá para escolher agora' : ''))); if (!vertAdoptWhy(n, t.v)) w.classList.add('vok'); grid.append(w); } else grid.append(bx); });
    if (ent.length) { const body = el('div', 'tbody2'), vc = el('div', 'tvert'); vc.append(tip(el('small', 'gold', '✨ Vertentes'), 'Pontos iniciais das vertentes, à parte da árvore comum.\nAo concluir um, você decide: ficar com a vertente (para sempre) ou seguir pela via comum levando ' + pct(VERT_DECLINE) + ' do bônus dela.'));
      ent.forEach(t => vc.append(techBox(n, t))); body.append(grid, vc); sec0.append(h, body); } else sec0.append(h, grid);
    b.append(sec0);
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
  r.append(btn('🕊️ Impor paz', () => { const res = act('proposePeace', w.id, L, t); if (res) msg.textContent = res; else { UI.peacePick = null; closeWin(); refresh(); } }, 'grn', why || (!picked.length && !t.subj && !t.rep ? 'Escolha algum termo' : ''), leaderOf(w, foeSide) === L ? 'Encerra a guerra toda' : 'Paz separada: só ' + ln.name + ' sai da guerra'));
  r.append(btn('Paz branca', () => { const res = act('proposePeace', w.id, L, null); if (res) msg.textContent = res; else { closeWin(); refresh(); } }, '', '', 'Ninguém perde nada'));
  if (iLead) r.append(btn('Render-se', () => modal(m => { m.append(el('h2', '', 'Render-se?'), el('p', '', 'O líder inimigo impõe os termos que a rendição dele permitir.')); const row = el('div', 'row'); row.append(btn('Render-se', () => { const wl = leaderOf(w, foeSide); act('peace', w.id, n.id, wl, aiTerms(w, wl, n.id, Math.max(warPointsVs(w, n.id), 30))); closeModal(); closeWin(); refresh(); }, 'red'), btn('Voltar', closeModal)); m.append(row); }), 'red'));
  b.append(r, msg);
}
/* aba de súditos (diplomacia): barra de liberdade, leis, nível e integração */
const termsTxt = (L, t) => !t ? 'paz branca' : [t.provs.length ? t.provs.length + ' província' + (t.provs.length > 1 ? 's' : '') + ' (' + [...new Set(t.provs.map(p => WD.states[WD.provs[p].state].n))].slice(0, 6).join(', ') + ')' : '', t.subj ? 'virar ' + SUBJECTS[t.subj].n.toLowerCase() : '', t.rep ? 'reparações por ' + REP.years + ' anos' : ''].filter(Boolean).join(' · ') || 'nada';
function libBar(t) {
  const s = t.subj, d = el('div', 'libbar'), f = el('div', 'libfill'), m = el('div', 'libtg'); f.style.width = s.lib + '%'; f.style.background = s.lib > 75 ? '#e5636b' : s.lib > 50 ? '#e5a35b' : '#8fd17f'; m.style.left = (s.tg ?? s.lib) + '%'; d.append(f, m);
  return tip(d, 'Liberdade: ' + Math.round(s.lib) + '% (alvo ' + Math.round(s.tg ?? s.lib) + '%)\n0% = integrado · 100% = livre (rompe e declara independência)\n' + libParts(t).map(([k, v]) => k + ' ' + (v > 0 ? '+' : '') + v).join('\n'));
}
/* trilha do súdito: o nível atual e os próximos até a integração; abaixo, a barra de progresso */
function subjPath(t) {
  const s = t.subj, row = el('div', 'chips'), path = [s.tier]; let k = s.tier; while (SUBJECTS[k] && SUBJECTS[k].next && SUBJECTS[k].next !== 'int' && path.length < 6) { k = SUBJECTS[k].next; path.push(k); } path.push('int');
  path.forEach((k, i) => { if (i) row.append(el('span', 'dim', '›')); row.append(tip(el('span', 'chip' + (i === 0 ? ' p' : ''), k === 'int' ? '🔗 Integrado' : SUBJECTS[k].e + ' ' + SUBJECTS[k].n), k === 'int' ? 'Anexado em paz ao suserano' : SUBJECTS[k].d)); });
  const nx = nextTier(t), r = progRate(t), why = nx === 'int' ? integWhy(t) : '', box = el('div');
  box.append(row, tip(el('small', why && s.prog >= 100 ? 'bad' : 'dim', 'Progresso para ' + (nx === 'int' ? 'a integração' : SUBJECTS[nx].n.toLowerCase()) + ': ' + Math.round(s.prog || 0) + '% (' + (r >= 0 ? '+' : '') + r.toFixed(1) + '/mês)' + (why ? ' · ' + why : '')),
    'Os níveis sobem sozinhos enquanto a liberdade fica abaixo de 50% (mais rápido perto de 0%); acima de 50% o progresso volta.\nA integração final exige relação do súdito com o suserano de ' + SUBJ_PROG.rel + ' ou mais.'), bar((s.prog || 0) / 100, '#8ec5ff'));
  return box;
}
function winSubjects(b, n) {
  if (isSubj(n)) { const o = nat(n.senior), T = SUBJECTS[n.subj.tier], c = el('div', 'card'), bk = backerOf(n);
    c.append(el('h4', '', T.e + ' ' + T.n + ' de ' + natName(o)), libBar(n), subjPath(n), el('div', 'dim', T.d + ' Aliança e acordo comercial com o suserano.' + (bk ? ' · 🤝 Apoio de ' + natName(bk) : '')));
    const acts = g => { const r = el('div', 'row'); for (const k in SUBJ_ACTS) { const A = SUBJ_ACTS[k]; if (A.g !== g) continue;
      r.append(btn(A.e + ' ' + A.n + (A.cost ? ' (💰' + Math.round(A.cost * eraScale()) + ')' : ''), () => { const e = act('subjAct', k); if (e) say(e, 'bad'); drawWin(); refresh(); }, 'sm' + (g === 'rebel' ? ' red' : ' grn'), subjActWhy(n, k),
        A.d + '\n' + fxTxt(A.fx).join('\n') + (A.cd ? '\nRepete a cada ' + A.cd + ' anos' : ''))); } return r; };
    c.append(el('small', 'dim', '🙇 Lealdade'), acts('loyal'), el('small', 'dim', '🔥 Rebelião'), acts('rebel'));
    c.append(btn('🏴 Declarar independência', () => modal(m => { m.append(el('h2', '', 'Declarar independência?'), el('p', '', 'Guerra contra ' + natName(o) + (bk ? ', com ' + natName(bk) + ' do seu lado.' : '.') + ' A aliança e o acordo comercial acabam.')); const r = el('div', 'row'); r.append(btn('Romper', () => { act('independence'); closeModal(); refresh(); }, 'red'), btn('Voltar', closeModal)); m.append(r); }), 'red sm', '', 'Rompe o laço e começa uma guerra de independência' + (n.subj.tier === 'union' ? ' (na união pessoal, a coroa só se separa)' : '')));
    b.append(c); }
  const list = subjectsOf(n.id);
  if (!list.length && isSubj(n)) return;
  if (!list.length) { b.append(el('p', 'dim', 'Nenhum súdito. Na paz, você pode exigir que o inimigo vire fantoche, vassalo, protetorado ou domínio; casamentos reais podem trazer uniões pessoais.')); return; }
  const triT = list.reduce((a, t) => a + Math.max(0, -((t.inc && t.inc.tribute) || 0)), 0);
  b.append(kv([['Súditos', list.length], ['Tributo', money(triT) + '/mês'], ['Vendas aos súditos', money((n.inc && n.inc.subjSales) || 0) + '/mês', 'Súditos compram o seu excedente antes do mercado mundial']]));
  list.forEach(t => { const s = t.subj, T = SUBJECTS[s.tier], c = el('div', 'card'), rel = Math.round(t.rel[n.id] || 0); c.style.marginTop = '10px';
    c.append(el('h4', '', T.e + ' ' + natName(t) + ' · ' + T.n), libBar(t), subjPath(t));
    const ln = el('div', 'dim', provsOf(t.id).length + ' províncias · tributo ' + money(Math.max(0, -(t.inc && t.inc.tribute) || 0)) + '/mês · '); c.append(ln); ln.append(tip(el('span', rel >= SUBJ_PROG.rel ? 'good' : 'bad', 'relação com você ' + rel + ' (integração exige ' + SUBJ_PROG.rel + ')'), 'Melhore com presentes e melhorar relações. Leis duras baixam a relação.'));
    for (const k in SUBJ_LAWS) { const L = SUBJ_LAWS[k], r = el('div', 'row'); r.append(el('small', 'dim', L.n + ':'));
      for (const v in L.o) { const d = L.o[v]; r.append(btn(d.n, () => { const e = act('setSubjLaw', t.id, k, v); if (e) say(e, 'bad'); drawWin(); }, 'sm' + (s.laws[k] === v ? ' on' : ''), s.lawCd > S.t && s.laws[k] !== v ? 'Mudança recente' : '', 'Liberdade ' + (d.lib > 0 ? '+' : '') + (d.lib || 0) + (d.tri != null ? ' · tributo ×' + d.tri : '') + (d.mp ? ' · cede ' + pct(d.mp) + ' do contingente' : '') + (d.demil ? ' · exército limitado' : '') + (d.int ? ' · progresso ×' + d.int : '') + '\nTrocar custa −5 de relação com eles; uma vez por ano')); }
      c.append(r); }
    const r2 = el('div', 'row'), go = k => () => { const e = act('dipAct', t.id, k); if (e) say(e, 'bad'); drawWin(); refresh(); };
    r2.append(btn('🤝 Melhorar relações (💰' + dipCost('improve') + ')', go('improve'), 'sm grn', (n.cd || {})[t.id] > S.t ? 'Já tentado este ano' : '', '+15 de relação deles com você'), btn('🎁 Presente (💰' + dipCost('gift') + ')', go('gift'), 'sm grn', '', '+20 de relação'));
    r2.append(btn('Libertar', () => { act('freeSubject', t.id); drawWin(); refresh(); }, 'sm red', '', 'Vira independente (relação +40)')); c.append(r2);
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
    Object.entries(R0.min).forEach(([r, k]) => ch.append(tip(el('span', 'chip p', GOODS[r].e + ' ' + GOODS[r].n + (k > 1 ? ' ×' + k : '')), GOODS[r].n + ': ' + k + ' jazida' + (k > 1 ? 's' : '') + ' → até ' + k * GOODS[r].rm + ' níveis de ' + RES_ALLOWS[r] + '\n' + (goodUsers(r) || ''))));
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
  b.append(kv([['Canteiros', n.cons.length + ' / ' + consSlots(n), 'Obras ao mesmo tempo: vêm de tecnologias, população, tesouro e canteiros comprados (' + slotsRaw(n) + ')\nTeto pelo título (' + RANK_N[n.rank || 0] + '): ' + slotCap(n) + ' — ' + RANK_N.map((r, i) => r + ' ' + RANK_SLOTS[i]).join(', ')], ['Estados com infraestrutura', sts.length + '', 'Você constrói onde controla a capital do estado']]));
  b.append(btn('🏗️ Abrir canteiro (💰' + slotCost(n) + ')', () => { const e = act('buySlot'); if (e) say(e, 'bad'); refresh(); }, 'sm grn', n.money < slotCost(n) ? 'Sem dinheiro' : '', 'Um canteiro de obras a mais, para sempre. Cada um custa mais que o anterior.'));
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
    const c = el('div', 'cols'); cands.forEach(ch => c.append(noCtx(seatCard(n, ch, charName(ch), k, btn((COUNCIL_MODE[GOVS[n.gov].cat] || { act: 'Nomear' }).act, () => { const e = act('swapCouncil', k, ch.id); if (e) say(e, 'bad'); closeModal(); refresh(); }, 'sm grn', apptWhy(n, k) || (n.money < councilCost() ? 'Sem dinheiro' : '')))))); m.append(c, btn('Cancelar', closeModal));
  }, true);
}
const genTip = c => 'General ' + charName(c) + ' · ' + ageOf(c) + ' anos\nMarcial ' + c.st.mar + ' · força em batalha e cercos ' + sgn(genMul(c) - 1) + '\n' + c.tr.map(t => TRAITS[t].n + (GEN_TR[t] ? ' ' + sgn(GEN_TR[t]) : '')).join(', ') + (IDEOS[c.ld] ? '\nIdeologia: ' + IDEOS[c.ld].n + (IDEOS[c.ld].gen ? ' (' + sgn(IDEOS[c.ld].gen) + ')' : '') + (S.player >= 0 && Math.abs((IDEOS[c.ld].ax || 0) - ((IDEOS[me().ideo] || {}).ax || 0)) >= 2 ? '\n⚠️ Longe da ideologia do país: com exército grande e estabilidade baixa, pode dar golpe' : '') : '') + '\nPode morrer de velhice ou numa derrota.';
function genPick(a) {
  const n = me(), cands = genCands(n);
  modal(m => {
    m.append(el('h2', '', 'Escolha um general'), el('p', 'dim', 'Custa 💰' + genCost() + '. Marcial e traços (Bravo, Estrategista…) mudam a força do exército.'));
    const c = el('div', 'cols'); cands.forEach(ch => c.append(charCard(ch, charName(ch) + ' · ' + sgn(genMul(ch) - 1), btn('Nomear', () => { const e = act('setGeneral', a.id, ch.id); if (e) say(e, 'bad'); closeModal(); refresh(); }, 'sm grn', n.money < genCost() ? 'Sem dinheiro' : '', genTip(ch))))); m.append(c, btn('Cancelar', closeModal));
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
      if (k === 'slave' && slavesOn(n)) { const rv = n.slvReb || 0, rr = slaveRebRate(n); c.append(tip(el('small', rv > 70 ? 'bad' : 'dim', '✊ Rebeldia ' + Math.round(rv) + '% (' + (rr >= 0 ? '+' : '') + rr.toFixed(2) + '/mês)'), 'Sobe todo mês, mesmo com os escravos alimentados. Em 100% estoura uma revolta de escravos.\n' + slaveRebParts(n).map(([l, v]) => l + ' ' + (v >= 0 ? '+' : '') + v.toFixed(2)).join('\n') + '\nGuardas (segurança) e eventos baixam; proibir a escravidão acaba com ela.'), bar(rv / 100, rv > 70 ? '#e5636b' : '#e5a35b')); }
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
    for (const k in SVC) { const v = (n.cov || {})[k] || 0, r = el('div', 'brow'); r.append(el('span', 'e', SVC[k].e), el('span', 'nm', SVC[k].n + ' · ' + svcSrc(me(), k)), el('span', 'lv', pct(v))); tip(r, SVC[k].d + '\nEmpregam sobretudo a classe média. A classe média e a alta exigem saúde e educação.'); sv.append(r, bar(v, '#7fc8e0')); }
    b.append(sv); return;
  }
  // culturas e religiões: régua de autonomia de cada povo que não é o principal
  const cul = tab === 'cul', src = (cul ? n.culs : n.rels) || {}, law = cul ? LAWS.culture.o[n.laws.culture] : LAWS.relig.o[n.laws.relig], min = cul ? n.minC || 0 : n.minR || 0, pol = (cul ? n.cpol : n.rpol) || {};
  const slots = cul ? culSlots(n) : relSlots(n), used = Object.values(pol).filter(v => v === 2).length, main = cul ? n.cul : n.relig, msg = el('div', 'msg');
  const nm = k => cul ? CULTURES[k].n + (CULTURES[k].par != null ? ' (' + culHeritage(k) + ')' : '') + (isMinorCul(k) ? ' · menor' : '') : RELIGIONS[REL_IDS[k]].e + ' ' + RELIGIONS[REL_IDS[k]].n + (RELIGIONS[REL_IDS[k]].fict ? ' · heresia' : isMinorRel(k) ? ' · menor' : '');
  const col = k => cul ? 'rgb(' + hsl((k * .17) % 1, .45, .55).join(',') + ')' : RELIGIONS[REL_IDS[k]].col;
  b.append(kv([[cul ? 'Cultura principal' : 'Fé oficial', nm(main), cul ? 'Nomes, governantes e a cultura para onde as outras se assimilam.' : 'Províncias se convertem a ela aos poucos (templos e Igreja de Estado aceleram).'],
    ['Lei', law.n, law.d + '\nMude em Governo → Leis.'], [cul ? 'Culturas aceitas' : 'Fés reconhecidas', used + ' / ' + slots + ' vagas', cul ? 'Vagas de culturas secundárias: Só a principal 1, Culturas aceitas 3, Multiculturalismo 8; +1 com título de Império.' : 'Vagas de fés reconhecidas: Igreja de Estado 0, Tolerância 1, Liberdade de culto 3, Estado laico 8.'],
    ['Peso das minorias', pct(min) + ' → estabilidade −' + (min * 8).toFixed(1), 'Soma da população de cada minoria × o peso do seu nível de autonomia × a lei.']]));
  b.append(tip(el('p', 'dim', 'Autonomia de cada ' + (cul ? 'cultura' : 'religião') + ': ← mais controle · ⚪ livre no centro · mais direitos → (mudar: 💰' + polCost() + ', −2 de estabilidade; para baixo −4)'), '−2: ' + (cul ? CPOL[-2].n : RPOL_N[-2][0]) + ' — vira escravo (exige escravidão permitida)\n−1: ' + (cul ? CPOL[-1].n : RPOL_N[-1][0]) + ' — assimila/converte 3× mais rápido, mais revoltas\n0: Livre\n+1: ' + (cul ? CPOL[1].n : RPOL_N[1][0]) + ' — metade do peso\n+2: ' + (cul ? CPOL[2].n : RPOL_N[2][0]) + ' — sem peso, ocupa vaga e pode virar ' + (cul ? 'a principal' : 'a oficial')), msg);
  const list = el('div', 'polist');
  Object.entries(src).sort((a, c) => c[1] - a[1]).forEach(([k, v]) => {
    const row = el('div', 'polrow'), isMain = +k === main, cur = pol[k] || 0; row.style.borderLeft = '4px solid ' + col(k);
    const head = el('div', 'polh'); head.append(tip(el('b', '', nm(k) + (isMain ? (cul ? ' (principal)' : ' (oficial)') : '')), cul ? '' : relTip(k)), el('span', 'dim', popStr(v) + ' · ' + pct(v / P))); row.append(head, bar(v / P, col(k)));
    if (!isMain) {
      const sl = el('div', 'polsl');
      [-2, -1, 0, 1, 2].forEach(lv => { const L = CPOL[lv], name = cul ? L.n : RPOL_N[lv][0], d = cul ? L.d : RPOL_N[lv][1], why = lv === cur ? '' : polWhy(n, tab, k, lv);
        sl.append(btn(L.e + ' ' + name, () => { const e = act('setPol', tab, k, lv); msg.textContent = e; if (!e) refresh(); }, 'sm' + (lv === cur ? ' on' : '') + (lv < 0 ? ' red' : lv === 2 ? ' grn' : ''), lv === cur ? '' : why, name + '\n' + d + '\nPeso como minoria ×' + L.w + (lv === cur ? '\n✔ Atual' : ''))); });
      row.append(sl);
      if (cur === 2) row.append(btn('👑 Tornar ' + (cul ? 'principal' : 'oficial') + ' (💰' + mainCost() + ')', () => { const e = makeMain(n, tab, k); msg.textContent = e; if (!e) refresh(); }, 'sm', n.money < mainCost() ? 'Sem dinheiro' : (n.mainCd || 0) > S.t ? 'Mudança recente (até ' + yearOf(n.mainCd) + ')' : '', 'A ' + (cul ? 'cultura principal atual vira aceita' : 'fé oficial atual vira reconhecida') + '. −15 de estabilidade; uma vez a cada 20 anos.'));
    }
    list.append(row); });
  b.append(list);
}
function techBox(n, t) {
  const s = techState(n, t), cls = s === 'done' || hasT(n, t.id) ? 'done' : s ? 'lock' : 'av', d = el('div', 'tech ' + cls + (n.res === t.id ? ' cur' : '') + (t.v ? ' vt' : ''));
  if (t.v) d.style.borderLeft = '4px solid ' + VERT[t.v].col;
  d.append(el('b', '', (cls === 'done' ? '✓ ' : cls === 'av' ? '▶ ' : '🔒 ') + (t.entry ? VERT[t.v].e + ' ' : '') + t.n)); d.append(el('small', '', t.y + (cls === 'done' ? '' : ' · 🔬' + techCost(n, t)) + (t.entry ? ' · ' + VERT[t.v].n : '') + (fxLines(techFx(t))[0] ? ' · ' + fxLines(techFx(t))[0].slice(0, 38) : '')));
  if (n.res === t.id) d.append(bar(n.rp / techCost(n, t)));
  const am = aheadMul(t); if (am > 2.8 && cls !== 'done') { d.classList.add('early'); d.append(el('small', 'warn', '⚠ Fora de época: custo ×' + am.toFixed(1))); }
  tip(d, techTip(n, t, s) + (am > 2.8 && cls !== 'done' ? '\n⚠ Fora de época: ' + (t.y - curYear()) + ' anos adiantada, custo ×' + am.toFixed(1) : ''));
  if (!s) d.onclick = () => { act('setResearch', t.id); drawWin(); drawTop(); };
  return d;
}
function winMil(b) {
  const n = me(), P = WD.provs.length, msg = el('div', 'msg'), tab = tabs(b, 'milTab', [['army', '⚔️ Exército'], ['fronts', '🚩 Fronts'], ['units', '📋 Tropas e doutrina'], ['navy', '⚓ Marinha']]);
  { const bar0 = b.lastChild, nb = bar0.lastChild; nb.classList.add('tab-right'); bar0.insertBefore(el('span', 'tab-div'), nb); }   // a Marinha fica do outro lado, depois de um divisor
  if (tab === 'fronts') { milFronts(b, n); return; }
  if (tab === 'units') { milUnits(b, n); return; }
  if (tab === 'navy') { milNavy(b, n); return; }
  const c = el('div', 'cols milcols');
  const pw = el('div', 'card'); pw.append(tip(el('h4', '', 'Tropas · ' + armySchool(n)), 'Os nomes das tropas mudam com a tecnologia e com a vertente. Detalhes e doutrina na aba Tropas e doutrina.'));
  const t = el('table', 't compact'); const h = t.insertRow(); [['Tropa', ''], ['Fogo / choque', 'Dano por regimento nas duas fases da batalha (fogo à distância, choque corpo a corpo), já com tecnologia e vertente'], ['Recrutar', 'Custo por regimento'], ['Total', 'Regimentos que você tem']].forEach(([x, tt]) => h.append(tip(el('th', '', x), tt)));
  ['inf', 'cav', 'art', 'vrt'].filter(ty => ty !== 'vrt' || n.vert).forEach(ty => { const r = t.insertRow(), u = r.insertCell(); u.append(el('small', 'dim', { inf: 'Infantaria', cav: 'Cavalaria', art: 'Artilharia', vrt: 'Vertente' }[ty]), el('div', '', unitName(n, ty))); tip(u, unitTip(n, ty));
    const f = r.insertCell(); f.className = 'n'; f.textContent = (n.up[ty] * unitStat(n, ty, 'fire')).toFixed(1) + ' / ' + (n.up[ty] * unitStat(n, ty, 'shock')).toFixed(1);
    const k = r.insertCell(); k.className = 'n'; k.textContent = '💰' + recCost(n, ty); const tt = r.insertCell(); tt.className = 'n'; tt.textContent = fmtK(S.armies.filter(a => a.o === n.id).reduce((s0, a) => s0 + a[ty], 0)); });
  pw.append(t, btn('➕ Criar novo exército', () => newArmyModal(n), 'grn', '', 'Escolha onde e quais unidades treinar; tudo forma um único exército novo')); c.append(pw);
  const st = el('div', 'card'); st.append(el('h4', '', 'Forças'), kv([['Regimentos', fmtK(S.armies.filter(a => a.o === n.id).reduce((s0, a) => s0 + regs(a), 0))], ['Contingente', Math.floor(n.manpower) + 'k / ' + Math.floor(n.mpMax || 0) + 'k', 'Homens livres para recrutar (1k por regimento); teto de 3% da população livre'], ['Cerco', '×' + n.up.siege.toFixed(1)], ['Largura', (WIDTH_BASE + n.fx.width) + ' regimentos', 'Quantos lutam ao mesmo tempo (× terreno)'], ['Suprimento', logiRange(n) + ' províncias', 'Alcance da linha de suprimento a partir do seu território']]), modChips({ army: n.m.army, manpower: n.m.manpower }));
  c.append(st); b.append(c);
  // exércitos: tudo numa tabela só, com o front e a postura de cada um (as mesmas opções da aba Fronts e do painel do exército)
  const fs = frontsOf(n.id), at = el('table', 't'); at.style.marginTop = '12px'; const hh = at.insertRow();
  [['Exército', ''], ['Local', ''], ['Tropas', ''], ['Veterania', 'Recruta, Regular, Veterano, Experiente e Elite'], ['General', 'Marcial, traços e ideologia mudam a força em batalha e nos cercos.'], ['Front', 'O front que o exército segue (ordens na aba Fronts)'], ['Postura', 'Como luta: veja a aba Tropas e doutrina'], ['Moral', 'Cai em batalha; recupera fora de combate'], ['', '']].forEach(([x, tt]) => hh.append(tip(el('th', '', x), tt)));
  groupsOf(n.id).forEach(G => { const a = groupAgg(G), H = G.slice().sort((x, y) => regs(y) - regs(x))[0], r = at.insertRow();
    r.insertCell().textContent = (H.gen ? '★ ' : a.exp ? '🧭 ' : '⚔️ ') + armyName(H); r.insertCell().textContent = a.p < P ? WD.provs[a.p].n : WD.seas[a.p - P].n;
    r.insertCell().textContent = ['inf', 'cav', 'art', 'vrt'].filter(t0 => a[t0] > .05).map(t0 => fmtK(a[t0]) + ' ' + unitName(n, t0)).join(', ');
    r.insertCell().append(tip(el('span', '', VET[vetLv(a)].n + (Object.keys(a.sup || {}).length ? ' ' + Object.keys(a.sup).map(k => SUPPORT[k].e).join('') : '')), vetTip(a)));
    const g = r.insertCell(); if (H.gen) g.append(tip(el('span', 'gold', '★ ' + charName(H.gen) + ' (' + sgn(genMul(H.gen) - 1) + ')'), genTip(H.gen))); g.append(btn(H.gen ? 'Trocar' : 'Nomear', () => genPick(H), 'sm', genWhy(H) || (n.money < genCost() ? 'Sem dinheiro' : ''), 'Escolha entre 3 candidatos (💰' + genCost() + ')'));
    const fc = r.insertCell(); if (H.inv || H.exp) fc.textContent = H.inv ? '⚓ invasão' : '🧭 exploração'; else { const sel = el('select'); sel.append(new Option('Sem front', '')); fs.forEach(f => sel.append(new Option(frontName(f), f.id))); sel.value = H.front != null ? H.front : ''; sel.onchange = () => { act('setFront', G.map(x => x.id), sel.value === '' ? null : +sel.value); drawWin(); }; fc.append(tip(sel, fs.length ? 'Atribuir a um front: o exército passa a seguir a ordem dele (defender ou avançar)' : 'Sem fronts: em paz ou sem linha de contato')); }
    const sc = r.insertCell(), ss = el('select'); Object.keys(STANCES).forEach(k => ss.append(new Option(STANCES[k].e + ' ' + stanceName(n, k), k))); ss.value = H.st || 'bal'; ss.onchange = () => { act('setStance', G.map(x => x.id), ss.value); drawWin(); }; sc.append(tip(ss, STANCES[H.st || 'bal'].d));
    const m = r.insertCell(); m.style.width = '80px'; m.append(bar(a.mor, '#7fe08a')); r.insertCell().append(btn('Ver', () => { closeWin(); select('army', H.id); centerOn(...armyXY(H)); }, 'sm')); });
  b.append(el('h3', 'gold', 'Exércitos'), at, msg);
  const sup = el('div', 'card'); sup.style.marginTop = '12px'; const asat = n.armySat == null ? 1 : n.armySat;
  sup.append(tip(el('h4', '', '📦 Suprimentos do exército · ' + pct(asat)), 'Cada tipo de tropa consome os próprios bens (armas, comida, roupas, cavalos, ferro, aço, petróleo...) e as companhias de apoio também.\nSem suprimentos a força em batalha cai até 40%; longe da linha de suprimento, só metade chega.'), bar(asat, asat < .8 ? '#e5636b' : '#8fd17f'));
  const tsr = el('div', 'chips'); UT.filter(t0 => t0 !== 'vrt' || n.vert).forEach(t0 => { const v = (n.tsat || {})[t0] ?? 1; tsr.append(tip(el('span', 'chip ' + (v < .8 ? 'n' : 'p'), unitName(n, t0) + ' ' + pct(v)), unitTip(n, t0))); }); sup.append(tsr);
  const AD = armyDemand(n).d, sr = el('div', 'chips'); Object.keys(AD).forEach(g => sr.append(tip(el('span', 'chip ' + ((n.mk.sat[g] ?? 1) < .8 ? 'n' : 'p'), GOODS[g].e + ' ' + GOODS[g].n + ' ' + pct(n.mk.sat[g] ?? 1)), GOODS[g].n + ': atendido ' + pct(n.mk.sat[g] ?? 1) + '\n' + goodUsers(g)))); sup.append(sr); b.append(sup);
}
/* batalhas de front: as que estão acontecendo numa linha (nossas e as do inimigo contra nós) */
const frontBattles = (n, f) => { const ids = new Set([f.id, ...facingFronts(f).map(g => g.id)]); return Object.values(S.fbat || {}).filter(B => ids.has(B.f) && fbMine(B, n.id)); };
function fbRow(n, B, hist) {
  const r0 = el('div', 'arow' + (hist ? ' dim' : '')), q = WD.provs[B.q];
  if (hist) { const ok = (B.a === n.id || fbSide(B, n.id) === 'a') === !!B.won; r0.append(el('span', 'fbi ' + (ok ? 'win' : 'lose'), ok ? '✔' : '✖'), el('span', 'grow', q.n), el('small', '', dateStr(B.t1))); tip(r0, (ok ? 'Vitória' : 'Derrota') + ' · ' + q.n + '\n' + B.ev.join('\n')); }
  else { const att = fbSide(B, n.id) === 'a'; r0.append(fbIcon(B, n.id), el('span', 'grow', (att ? '⚔️ Atacando ' : '🛡️ Defendendo ') + q.n), el('small', 'dim', S.battles[B.q] ? 'batalha · dia ' + S.battles[B.q].d : 'avanço ' + Math.round(B.prog * 100) + '%')); tip(r0, fbTip(B)); }
  r0.onclick = () => { closeWin(); centerOn(q.cx * K + K / 2, q.cy * K + K / 2); }; return r0;
}
function milFronts(b, n) {
  const fs = frontsOf(n.id);
  b.append(tip(el('p', 'dim', 'Cada front é a linha de contato com um inimigo. Atribua exércitos (aqui, na aba Exército ou no painel do exército) e dê a ordem: 🛡️ defender espalha as tropas pelos pontos mais ameaçados; ⚔️ avançar concentra tudo no ponto mais fraco do inimigo. As batalhas de cada linha aparecem no próprio front.'), 'Os fronts mudam sozinhos conforme o território muda de mão. Exércitos sem front ficam onde estão; a postura de cada exército (aba Tropas e doutrina) muda como ele luta.'));
  if (!fs.length) b.append(el('p', 'dim', warsOf(n.id).length ? 'Nenhuma linha de contato com o inimigo: a guerra é além-mar ou longe. Use invasões navais (botão direito num litoral inimigo com o exército selecionado).' : 'Em paz: sem fronts.'));
  for (const f of fs) {
    const w = S.wars.find(x => x.id === f.w), foe = nat(f.side === 'A' ? w.d : w.a), list = S.armies.filter(a => a.o === n.id && a.front === f.id);
    const ours = list.reduce((s0, a) => s0 + armyPower(a), 0), theirs = f.foe.reduce((s0, q) => s0 + threatAt(q).filter(x => atWar(n.id, x.o)).reduce((t0, x) => t0 + armyPower(x), 0), 0), ord = fordOf(n.id, f.id);
    const c = el('div', 'card'); c.style.marginTop = '10px';
    c.append(el('h4', '', '🚩 ' + frontName(f) + ' · contra ' + natName(foe)), el('div', 'dim', f.provs.length + ' províncias na linha · ' + list.length + ' exército' + (list.length === 1 ? '' : 's') + ' (' + fmtK(list.reduce((s0, a) => s0 + regs(a), 0)) + ' regimentos) · ordem: ' + (ord === 'adv' ? '⚔️ avançar' : '🛡️ defender')));
    c.append(tip(el('div', '', 'Força: nossa ' + Math.round(ours) + ' · deles junto à linha ' + Math.round(theirs) + (ours + theirs ? ' (' + Math.round(ours / Math.max(1, ours + theirs) * 100) + '% do total)' : '')), 'Força estimada dos exércitos atribuídos a este front contra os inimigos vistos junto à linha (tipos, tecnologia, veterania, suprimento, cansaço e moral).\nPara avançar, a força concentrada precisa passar de 1,2× a defesa do ponto atacado.'), bar(ours / Math.max(1, ours + theirs), ours >= theirs ? '#8fd17f' : '#e5636b'));
    const r = el('div', 'row');
    r.append(btn('🛡️ Defender', () => { act('setFord', f.id, 'hold'); drawWin(); }, 'sm' + (ord === 'hold' ? ' on' : ''), '', 'Espalha as tropas pelos pontos mais ameaçados e abate quem avançou'), btn('⚔️ Avançar', () => { act('setFord', f.id, 'adv'); drawWin(); }, 'sm' + (ord === 'adv' ? ' on' : ''), '', 'Ataca quando a força concentrada passa de 1,2× a defesa do alvo'));
    const sel = R.selArmies.filter(a => a.o === n.id && S.armies.includes(a));
    r.append(btn('➕ Atribuir selecionados (' + sel.length + ')', () => { act('setFront', sel.map(a => a.id), f.id); drawWin(); }, 'sm', sel.length ? '' : 'Selecione exércitos no mapa'));
    r.append(btn('➕ Todos os livres', () => { act('setFront', S.armies.filter(a => a.o === n.id && a.front == null && !a.inv && !a.exp && a.p < WD.provs.length).map(a => a.id), f.id); drawWin(); }, 'sm'));
    r.append(btn('Liberar', () => { act('setFront', list.map(a => a.id), null); drawWin(); }, 'sm', list.length ? '' : 'Nenhum exército'));
    c.append(r);
    const fb = frontBattles(n, f); c.append(el('small', 'gold', '⚔️ Batalhas nesta linha')); if (!fb.length) c.append(el('small', 'dim', ' Nenhuma agora.')); fb.forEach(B => c.append(fbRow(n, B)));
    b.append(c);
  }
  const hs = (S.fbHist || []).filter(B => B.a === n.id || B.d === n.id || fbSide(B, n.id)).slice(0, 10);
  if (hs.length) { const hc = el('div', 'card'); hc.style.marginTop = '10px'; hc.append(tip(el('h4', '', '📜 Batalhas de front recentes'), 'As últimas batalhas de front em que você esteve, ganhas e perdidas.')); hs.forEach(B => hc.append(fbRow(n, B, true))); b.append(hc); }
}
function milUnits(b, n) {
  b.append(tip(el('h3', 'gold', '📋 ' + armySchool(n)), n.vert ? 'Com ' + VERT[n.vert].n + ', a doutrina, as companhias de apoio e as posturas ganham nomes próprios.' : 'Escolhida uma vertente, a doutrina ganha nomes próprios dela.'));
  b.append(el('p', 'dim', 'Numa batalha, cada lado alterna fases de fogo (à distância) e choque (corpo a corpo); a cada 3 dias rola um dado. O dano depende do tipo de tropa, da tecnologia, da veterania, do general, do suprimento, do cansaço e da postura. Quem perde a moral recua.'));
  const t = el('table', 't'); const h = t.insertRow();
  [['Tropa', 'Nome atual (muda com a tecnologia e a vertente)'], ['Fogo', 'Dano na fase de fogo (à distância)'], ['Choque', 'Dano na fase de choque (corpo a corpo)'], ['Defesa', 'Reduz o dano recebido'], ['Moral', 'Quanto aguenta antes de recuar'], ['Letal.', 'Quanto do dano vira baixa definitiva'], ['Mov.', 'Velocidade no mapa'], ['Consome', 'Bens por regimento por mês (sem eles, perde até 40% da força)']].forEach(([x, tt]) => h.append(tip(el('th', '', x), tt)));
  UT.filter(ty => ty !== 'vrt' || n.vert).forEach(ty => { const r = t.insertRow(), u = r.insertCell(); u.append(tip(el('span', '', unitName(n, ty)), unitTip(n, ty)));
    ['fire', 'shock', 'def'].forEach(k => { const c = r.insertCell(); c.className = 'n'; c.textContent = (unitStat(n, ty, k) * n.up[ty]).toFixed(2); });
    ['mor', 'kill', 'spd'].forEach(k => { const c = r.insertCell(); c.className = 'n'; c.textContent = unitStat(n, ty, k).toFixed(2); });
    const nd = unitNeeds(n, ty), cc = r.insertCell(); cc.append(tip(el('span', '', Object.keys(nd).map(g => GOODS[g].e).join(' ')), Object.keys(nd).map(g => GOODS[g].n + ' ' + nd[g]).join('\n'))); });
  b.append(t);
  const c = el('div', 'cols'); c.style.marginTop = '12px';
  const v = el('div', 'card'); v.append(tip(el('h4', '', '🎖️ Veterania'), 'A experiência sobe lutando e treinando; regimentos novos diluem a do exército.')); VET.forEach(x => v.append(el('div', 'brow', x.n + ' (' + pct(x.x) + '+) · dano ×' + x.m + ' · moral ×' + x.mo)));
  v.append(el('small', 'dim', 'Recrutas saem melhores com academias no estado e com recrutamento voluntário.')); c.append(v);
  const s2 = el('div', 'card'); s2.append(tip(el('h4', '', '🧰 Companhias de apoio'), 'Uma de cada por exército (painel do exército). Custam ao contratar e por mês, e consomem bens.'));
  Object.keys(SUPPORT).forEach(k => { const d = SUPPORT[k], ok = supOk(n, k), r = el('div', 'docrow' + (ok ? '' : ' dim')); r.append(el('b', '', d.e + ' ' + supName(n, k) + (ok ? '' : ' 🔒')), el('small', '', d.d), el('small', 'dim', 'Contratar 💰' + supCost(n, k) + ' · ' + Object.keys(d.need).map(g => GOODS[g].e + ' ' + GOODS[g].n).join(', ') + (ok ? '' : ' · exige ' + TECH[d.tech].n))); s2.append(r); }); c.append(s2);
  const s3 = el('div', 'card'); s3.append(tip(el('h4', '', '📐 Posturas'), 'Escolha por exército (aba Exército ou painel do exército). Ciclo: cada postura vence uma e perde para outra (+15% de dano para quem vence).'));
  Object.keys(STANCES).forEach(k => { const d = STANCES[k], r = el('div', 'docrow'); r.append(el('b', '', d.e + ' ' + stanceName(n, k)), el('small', '', d.d), el('small', 'dim', 'Dano ×' + d.dmg + ' · baixas ×' + d.take + ' · cansaço ×' + d.fat + (d.beats ? ' · vence ' + stanceName(n, d.beats).toLowerCase() : ''))); s3.append(r); }); c.append(s3);
  b.append(c);
  b.append(tip(el('p', 'dim', 'Largura de combate ' + (WIDTH_BASE + n.fx.width) + ' (× terreno) · linha de suprimento ' + logiRange(n) + ' províncias'), 'Largura e logística sobem com tecnologias militares e de transporte.'));
}
/* marinha: frota, construção, doutrina naval (com nomes da vertente), classes de navio, frotas e batalhas */
function milNavy(b, n) {
  const msg = el('div', 'msg'), c = el('div', 'cols'), myF = S.fleets.filter(f => f.o === n.id);
  const st = el('div', 'card'); st.append(el('h4', '', '⚓ Frota · ' + shipName(n)), kv([['Navios', Math.ceil(myF.reduce((s0, f) => s0 + f.ships, 0)) + ''], ['Força por navio', n.fx.ship.toFixed(1), 'Sobe com tecnologias navais e com a vertente completa'], ['Transporte', Math.floor(transportCap(n.id)) + ' regimentos', shipCap(n) + ' regimento(s) por navio'], ['Navegação', n.fx.sea === 2 ? 'Oceânica' : n.fx.sea ? 'Costeira' : 'Nenhuma', 'Costeira: mares junto à terra. Oceânica (Caravela): mar aberto.'], ['Custo', '💰' + shipCost(n) + ' por navio']])); c.append(st);
  const bd = el('div', 'card'); bd.append(el('h4', '', '🛠️ Construir'));
  const ports = provsOf(n.id).filter(p => WD.provs[p].coast && S.ctrl[p] === n.id).sort((a, x) => (S.bld[WD.provs[x].state].shipyard || 0) - (S.bld[WD.provs[a].state].shipyard || 0));
  if (ports.length && n.fx.sea) { const sel = el('select'); ports.slice(0, 60).forEach(p => sel.append(new Option(WD.provs[p].n + ' (' + WD.states[WD.provs[p].state].n + ')' + (S.bld[WD.provs[p].state].shipyard ? ' · estaleiro' : ''), p)));
    const row = el('div', 'row'); [1, 3, 10].forEach(k => row.append(btn('+' + k + ' ' + shipName(n), () => { const e = act('buildShips', k, +sel.value); msg.textContent = e; if (!e) refresh(); }, 'sm', n.money < shipCost(n) * k ? 'Sem dinheiro' : '', 'Prontos em alguns meses no mar ao lado; estaleiro no estado deixa mais barato')));
    bd.append(el('small', 'dim', 'Porto'), sel, row); }
  else bd.append(el('p', 'dim', n.fx.sea ? 'Sem litoral.' : 'Exige Barcos longos.'));
  bd.append(msg); c.append(bd);
  const dc = el('div', 'card'); dc.append(tip(el('h4', '', '📐 ' + navySchool(n)), 'A doutrina vale para todas as frotas. Troca no máximo uma vez por ano.' + (n.vert ? '\nNomes de ' + VERT[n.vert].n + '.' : '')));
  Object.keys(NAV_DOCS).forEach(k => { const d0 = NAV_DOCS[k], on = (n.navDoc || 'line') === k, o = el('div', 'opt' + (on ? ' on' : ''));
    o.append(el('b', '', d0.e + ' ' + navDocName(n, k)), el('small', '', d0.d), el('small', 'dim', 'Dano ×' + d0.dmg + ' · perdas ×' + d0.take + ' · recua abaixo de ' + pct(d0.ret) + ' da força inimiga' + (d0.cargo < 1 ? ' · tropas embarcadas sofrem ' + pct(d0.cargo) + ' das perdas' : '')));
    if (!on) o.onclick = () => { const e = act('setNavDoc', k); msg.textContent = e; if (!e) drawWin(); }; dc.append(o); });
  c.append(dc); b.append(c);
  const cl = el('div', 'card'); cl.style.marginTop = '12px'; cl.append(tip(el('h4', '', '🚢 Classes de navio'), 'Cada tecnologia naval troca a classe da frota inteira; com a vertente completa, a frota especial dela.')); const ch = el('div', 'chips');
  SHIPS.forEach(([t0, nm]) => ch.append(tip(el('span', 'chip ' + (hasT(n, t0) ? 'lg-done' : 'lg-lock'), nm), (TECH[t0] ? TECH[t0].n + ' (' + TECH[t0].y + ')' : '') + (hasT(n, t0) ? ' ✓' : '')))); if (vertDone(n) && vRoster(n, 'ship')) ch.append(el('span', 'chip p', '✨ ' + vRoster(n, 'ship')));
  cl.append(ch); b.append(cl);
  const at = el('table', 't'); at.style.marginTop = '12px'; const hh = at.insertRow(); ['Frota', 'Mar', 'Navios', 'Transporta', 'Situação', ''].forEach(x => hh.append(el('th', '', x)));
  myF.forEach((f, i) => { const r = at.insertRow(); r.insertCell().textContent = '⛵ ' + (i + 1); r.insertCell().textContent = WD.seas[f.z].n; r.insertCell().textContent = Math.ceil(f.ships) + ' ' + shipName(n); r.insertCell().textContent = Math.floor(carriedRegs(f)) + ' / ' + Math.floor(fleetCap(f)) + 'k';
    r.insertCell().textContent = f.inv ? '⚓ invasão' : f.auto ? '🧭 explorando' : f.path && f.path.length ? '⛵ navegando' : 'no porto'; r.insertCell().append(btn('Ver', () => { closeWin(); select('fleet', f.id); }, 'sm')); });
  if (!myF.length) { const r = at.insertRow(), cc = r.insertCell(); cc.colSpan = 6; cc.className = 'dim'; cc.textContent = 'Nenhuma frota.'; }
  b.append(el('h3', 'gold', 'Frotas'), at);
  const nh = (S.navHist || []).filter(x => x.a === n.id || x.b === n.id).slice(0, 8), hc = el('div', 'card'); hc.style.marginTop = '12px';
  hc.append(tip(el('h4', '', '🌊 Batalhas navais recentes'), 'Frotas inimigas no mesmo mar lutam todo dia: cada lado perde navios pela força do outro (× doutrina). Quem cai abaixo do limite da doutrina recua; tropas embarcadas além da capacidade que sobrou se perdem.'));
  if (!nh.length) hc.append(el('small', 'dim', 'Nenhuma.'));
  nh.forEach(x => { const me0 = x.a === n.id, ours = me0 ? x.la : x.lb, th = me0 ? x.lb : x.la, foe = nat(me0 ? x.b : x.a); hc.append(el('div', 'arow', (ours <= th ? '✔ ' : '✖ ') + WD.seas[x.z].n + ' · contra ' + (foe ? foe.name : '?') + ' · perdemos ' + ours.toFixed(1) + ' navios, eles ' + th.toFixed(1) + ' · ' + dateStr(x.t))); });
  b.append(hc);
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
    btn('✔ Hastear (💰' + flagCost() + ')', () => { const e = act('setFlag', f); msg.textContent = e; if (!e) { S.mapDirty = true; refresh(); log('Nova bandeira hasteada em ' + natName(n) + '.', 'good', [n.id]); } }, 'grn', n.money < flagCost() ? 'Sem dinheiro' : '', 'Troca a bandeira do país'),
    btn('⬇ Baixar SVG', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([flagSVG(f, 'dl')], { type: 'image/svg+xml' })); a.download = n.name.toLowerCase() + '.svg'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }),
    btn('Desfazer', () => { UI.fdraft = null; drawWin(); }));
  ctl.append(r, msg); wrap.append(ctl); b.append(wrap);
}

/* ---------- modais: paz, chamado às armas, propostas da IA, fim ---------- */
function modal(fill, wide) { const m = $('#modal-b'); m.innerHTML = ''; m.classList.toggle('wide', !!wide); fill(m); $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; if (UI.resume) { setSpeed(UI.resume); UI.resume = 0; } }   // avisos e escolhas: o tempo volta à velocidade de antes
/* pausa para um aviso, lembrando a velocidade para voltar a ela ao fechar */
function autoPause() { if (UI.speed) UI.resume = UI.speed; UI.speed = 0; drawTop(); }
const noCtx = d => { d.oncontextmenu = null; d.classList.remove('ctxable'); return d; };
/* pendências com destinatário (to): cada jogador só vê as dele (multiplayer); as dele vão para a frente das filas */
const mineP = x => !!x && (x.to == null || x.to === S.player);
const mineFirst = L => L && L.length ? L.filter(mineP).concat(L.filter(x => !mineP(x))) : L;
function pendingModals() {
  if (!$('#modal').hidden) return;
  S.evq = mineFirst(S.evq); S.calls = mineFirst(S.calls); S.dipOffers = mineFirst(S.dipOffers);
  const off = pendGet('offer', S.player), cf = pendGet('conf', S.player), lp = pendGet('lead', S.player);   // pendências deste jogador (cada um tem as suas)
  if (off) { peaceOffer(off); return; }
  if (cf) { const w = S.wars.find(x => x.id === cf.w); UI.peaceL = cf.L; UI.peacePick = null; act('dismiss', 'conf'); pendDel('conf', S.player); if (w) { UI.resume = 0; UI.speed = 0; drawTop(); (S.evq = S.evq || []).push({ t: '🏳️ O inimigo capitulou', m: 'Escolha os termos: estados, vassalagem ou reparações, com os pontos da rendição deles.' }); openWin('peace', w.id); } }
  if (lp) { const L = lp, n = me(); autoPause();   // eleição: o jogador escolhe o novo líder entre 4
    modal(m => { m.append(el('h2', '', '🗳️ Quem vai governar?'), el('p', '', L.why + ' Escolha quem assume como ' + titleOf(n).toLowerCase() + ' (' + GOVS[n.gov].n + ').'));
      const c = el('div', 'cols'); L.cands.forEach(ch => c.append(noCtx(seatCard(n, ch, (ch === n.ruler ? '🔁 Atual · ' : COUNCIL.some(([k]) => n.council[k] === ch) ? '👥 Do conselho · ' : '✨ Novo nome · ') + charName(ch), null,
        btn('Escolher', () => { act('setLeader', ch.id); pendDel('lead', S.player); closeModal(); refresh(); }, 'sm grn'), true))));
      m.append(c); }, true); return; }
  { const n = me(); if (n && n.vpend) { const V = VERT[n.vpend]; autoPause();
    const area = CATS[V.entry.c], dm = {}; for (const k in V.m) dm[k] = V.m[k] * VERT_DECLINE;
    modal(m => { m.append(el('h2', '', V.e + ' ' + TECH['v_' + V.id].n), el('p', '', 'O caminho de ' + V.n + ' está aberto. A escolha é para sempre.'));
      const r = el('div', 'col evopts');
      r.append(btn('Manter: seguir ' + V.n, () => { act('vertDecide', V.id, true); closeModal(); refresh(); }, 'grn', '', 'As técnicas comuns depois de ' + V.entry.y + ' viram versões ' + V.n + ' em todas as áreas; a área ' + area + ' fica trancada nelas.\nAbre a aba de melhorias próprias (' + V.len + ').\nLibera ' + BUILDINGS[V.bld].n + ' e o bem ' + GOODS[V.good].n + '.\nCompletar os ' + V.len + ' pontos libera ' + V.unit[0] + ' no exército e a frota especial.\nAs outras vertentes ficam só como bônus.'));
      r.append(btn('Continuar por bônus', () => { act('vertDecide', V.id, false); closeModal(); refresh(); }, '', '', 'Segue pela árvore comum e leva ' + pct(VERT_DECLINE) + ' do bônus de ' + V.n + ':\n' + (modLines(dm).join('\n') || '—')));
      m.append(r); }); return; } }
  if (S.evq && S.evq.length && mineP(S.evq[0]) && S.evq[0].ev) { const ev = S.evq[0], n = me(), d = EVENT[ev.ev]; autoPause();   // pausa e, depois da escolha, volta à velocidade de antes   // evento com escolhas: fica na fila até escolher
    if (!d || n.evWait !== ev.ev) { S.evq.shift(); return; }
    modal(m => { m.append(el('h2', '', ev.t), el('p', '', ev.m)); const r = el('div', 'col evopts'), ok = evOpts(n, d);
      d.opts.forEach(o => { const k = ok.indexOf(o), t = fxTxt(o.fx).join('\n') || 'Sem efeito';
        r.append(btn(o.n, () => { act('chooseEvent', ev.ev, k); closeModal(); refresh(); }, '', k < 0 ? condFail(n, o.when).join(', ') : '', t)); });
      m.append(r); }); return; }
  if (S.evq && S.evq.length && mineP(S.evq[0])) { const ev = S.evq.shift(); autoPause(); if (ev.nid != null && NET.client) act('ackNote', ev.nid);   // o anfitrião tira o aviso da fila
    modal(m => { m.append(el('h2', '', ev.t), el('p', '', ev.m)); const r = el('div', 'row'); if (ev.quar) r.append(btn('🚧 Decretar quarentena (💰' + quarCost(me()) + ')', () => { const e = quarantine(me()); if (e) say(e, 'bad'); else log('Quarentena decretada por dois anos.', 'info', [S.player]); closeModal(); refresh(); }, 'red', '', 'Contágio nas suas províncias cai 70% por 2 anos; comércio −30%')); r.append(btn('Que assim seja', closeModal)); m.append(r); }); return; }
  if (S.calls && S.calls.length && mineP(S.calls[0])) { const c = S.calls[0], w = S.wars.find(x => x.id === c.w); if (!w) { S.calls.shift(); return; } const lead = nat(c.from), foe = nat(c.side === 'A' ? w.d : w.a); autoPause();
    modal(m => { m.append(el('h2', '', 'Chamado às armas'), el('p', '', natName(lead) + ' pede sua ajuda na guerra contra ' + natName(foe) + '.'), el('p', 'dim', 'Recusar acaba com a aliança.')); const r = el('div', 'row'); r.append(btn('Entrar na guerra', () => { act('answerCall', c.w, true); S.calls = S.calls.filter(x => x !== c); closeModal(); refresh(); S.mapDirty = true; }, 'red'), btn('Recusar', () => { act('answerCall', c.w, false); S.calls = S.calls.filter(x => x !== c); closeModal(); refresh(); })); m.append(r); }); return; }
  if (S.dipOffers && S.dipOffers.length && mineP(S.dipOffers[0])) { const o = S.dipOffers[0], from = nat(o.from); const done = yes => { const e = act('answerOffer', o.from, o.kind, yes); S.dipOffers = (S.dipOffers || []).filter(x => x !== o); if (e) say(e, 'bad'); closeModal(); refresh(); }; if (!from.alive) { done(false); return; } autoPause();
    const txt = { ally: 'propõe uma aliança.', marr: 'propõe um casamento real.', trade: 'propõe um acordo comercial.' }[o.kind];
    modal(m => { m.append(flagEl(from.flag, 'mflag'), el('h2', '', natName(from)), el('p', '', txt)); const r = el('div', 'row'); r.append(btn('Aceitar', () => done(true), 'grn'), btn('Recusar', () => done(false))); m.append(r); }); }
}
function peaceOffer(o) {
  const w = S.wars.find(x => x.id === o.w), answer = yes => { act('peaceOffer', yes); pendDel('offer', S.player); closeModal(); refresh(); };
  if (!w) { answer(false); return; }
  const n = me(), e = nat(sideOf(w, n.id) === 'A' ? w.d : w.a); autoPause();
  modal(m => {
    m.append(el('h2', '', 'Proposta de paz'), el('p', '', natName(o.winner != null ? nat(o.winner) : e) + (o.winner == null ? ' propõe paz branca.' : ' exige: ' + termsTxt(n.id, o.t) + '.')));
    m.append(el('p', 'dim', 'Recusar mantém a guerra; se sua rendição chegar a 100%, eles tomam o que quiserem.'));
    const r = el('div', 'row'); r.append(btn('Aceitar', () => answer(true), 'grn'), btn('Recusar', () => answer(false), 'red')); m.append(r);
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
/* operações no exterior a partir do menu do país (botão direito): inteligência, panfletos e eliminar */
function intelMenu(n, t, close) {
  const box = el('div', 'intel'); box.append(el('small', 'dim', '🕵️ Inteligência · sua força ' + Math.round(schemePower(n)) + ' contra ' + Math.round(schemePower(t))));
  const busy = n.scheme ? 'Já há uma operação: ' + schemeTxt(n, n.scheme) : '', r = el('div', 'row wrap'), go = (k, tgt) => { const e = act('startScheme', k, Object.assign({ nat: t.id }, tgt)); say(e || 'Operação iniciada.', e ? 'bad' : 'good'); close(); refresh(); };
  const tt = k => SCHEMES[k].d + '\nCusto 💰' + schemeCost(k) + ' · cerca de ' + SCHEMES[k].m + ' meses · risco de ser descoberto sobe com a força deles';
  r.append(btn('🔎 ' + schemeName('spy') + ' (💰' + schemeCost('spy') + ')', () => go('spy', {}), 'sm', busy || (n.money < schemeCost('spy') ? 'Sem dinheiro' : ''), tt('spy')));
  // panfletos: escolhe a ideia
  const topics = []; const addT = (ty, k, v, lbl) => topics.push({ ty, k, v, lbl });
  if (t.ideo !== n.ideo) addT('ideo', null, n.ideo, '⚑ Nossa ideologia: ' + IDEOS[n.ideo].n); if (t.gov !== n.gov && govEdgeOk(t, n.gov)) addT('gov', null, n.gov, '🏛️ Nosso governo: ' + GOVS[n.gov].n);
  for (const k in LAWS) if (n.laws[k] !== t.laws[k] && lawOk(t, k, n.laws[k])) addT('law', k, n.laws[k], '📜 Nossa lei: ' + LAWS[k].n + ' — ' + LAWS[k].o[n.laws[k]].n);
  for (const i in IDEOS) if (i !== t.ideo && i !== n.ideo && ideoWeight(i, curYear()) > .1) addT('ideo', null, i, '⚑ Para atrapalhar: ' + IDEOS[i].n);
  const sel = el('select'); topics.forEach((x, i) => sel.append(new Option(x.lbl, i)));
  const pr = el('div', 'row wrap'); pr.append(sel, btn('🗞️ ' + schemeName('slander') + ' (💰' + schemeCost('slander') + ')', () => { const x = topics[+sel.value]; if (x) go('slander', { topic: { ty: x.ty, k: x.k, v: x.v } }); }, 'sm', busy || (!topics.length ? 'Nada a espalhar' : n.money < schemeCost('slander') ? 'Sem dinheiro' : ''), tt('slander')));
  // eliminar: escolhe o alvo
  const who = el('select'); who.append(new Option(titleOf(t) + ': ' + charName(t.ruler), 'ruler')); COUNCIL.forEach(([k]) => { if (t.council[k]) who.append(new Option(roleName(t, k) + ': ' + charName(t.council[k]), k)); });
  S.armies.filter(a => a.o === t.id && a.gen).slice(0, 8).forEach(a => who.append(new Option('General ' + charName(a.gen) + ' (' + Math.round(regs(a)) + ' regimentos)', 'gen:' + a.id)));
  const mr = el('div', 'row wrap'); mr.append(who, btn('🗡️ ' + schemeName('murder') + ' (💰' + schemeCost('murder') + ')', () => go('murder', { who: who.value }), 'sm red', busy || (n.money < schemeCost('murder') ? 'Sem dinheiro' : ''), tt('murder')));
  box.append(r, pr, mr); return box;
}
function ctxMenu(sx, sy, p) {
  const c = $('#ctx'), n = me(), o = S.own[p]; c.innerHTML = '';
  if (o === n.id || !n.exP[p]) { c.hidden = true; return; }
  if (o < 0) c.append(el('h4', '', WD.provs[p].n + ' · nativos'), btn('🏕️ Colonizar (💰' + colCost(n, p) + ')', () => { const e = act('colonize', p); say(e || 'Colonos a caminho.', e ? 'bad' : 'good'); c.hidden = true; refresh(); }, '', canColonize(n, p)));
  else {
    const t = nat(o), h = el('div', 'side-h'); h.append(flagEl(t.flag, 'fl')); const tt = el('div', 'col'); tt.append(el('b', '', natName(t)), el('small', 'dim', 'Relação ' + Math.round(t.rel[n.id] || 0) + (dipStatus(n, t).length ? ' · ' + dipStatus(n, t).join(' · ') : ''))); h.append(tt); c.append(h);
    c.append(btn('Ver nação', () => { c.hidden = true; select('nat', o); }, 'sm'), dipButtons(t));
    if (o !== n.id) c.append(intelMenu(n, t, () => { c.hidden = true; }));
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
  if (mine.length) {                                            // exércitos não se movem à mão: só invasões além-mar
    const to = WD.prov[i], heads = [...new Set(mine.map(gid))].map(k => mine.find(a => gid(a) === k)); if (to < 0) return;
    if (WD.provs[to].coast && S.own[to] !== n.id && heads.every(h => !orderArmyTest(h, to))) { let inv = 0, why = ''; heads.forEach(h => { const G = groupOf(h); if (G.length > 1) { why = 'disperso: junte o exército antes'; return; } const e = act('planInvasion', h.id, to); if (!e) { inv++; h.front = null; } else why = e; });
      if (inv) say('Invasão planejada: o exército marcha ao porto, embarca e navega até ' + WD.provs[to].n + '.', 'good'); else say('Sem invasão possível (' + why + ').', 'bad'); }
    else say('Os exércitos se movem sozinhos pelos fronts: atribua um front no painel do exército.', 'info');
    drawSide();
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
/* simulação e rede do anfitrião: roda no laço de desenho e, com a aba escondida (sem requestAnimationFrame), pelo relógio do Worker (bgPump) */
let lastSimT = performance.now(), lastSimRun = 0;
function simStep(now) {
  const dt = Math.min(.25, Math.max(0, now - lastSimT) / 1000); lastSimT = now; lastSimRun = now;
  if (S && NET.host) NET.hostTick(now);
  if (S && UI.scr === 'game' && !S.over && UI.speed && $('#modal').hidden && !NET.client) {
    UI.acc += dt * SPEEDS[UI.speed]; let n = 0;
    while (UI.acc >= 1 && n < 30) { UI.acc -= 1; n++; advanceDay(); if (S.over || hasPending(S.player)) break; if (S.t % 360 === 0 && !NET.client) saveGame(); }
    if (UI.acc > 3) UI.acc = 0;
  }
}
function bgPump() { const now = performance.now(); if (now - lastSimRun > 250) simStep(now); }
function loop(now) {
  const dt = Math.min(.25, (now - lastT) / 1000); lastT = now;
  if (UI.keys.size && S) { const v = 700 * dt / R.cam.z, k = UI.keys; if (k.has('KeyW') || k.has('ArrowUp')) R.cam.y -= v; if (k.has('KeyS') || k.has('ArrowDown')) R.cam.y += v; if (k.has('KeyA') || k.has('ArrowLeft')) R.cam.x -= v; if (k.has('KeyD') || k.has('ArrowRight')) R.cam.x += v; clampCam(); }
  simStep(now);
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
  S.pend = {}; S.calls = []; S.dipOffers = [];
  if (q.get('reload')) { saveGame(); S = null; if (!loadGame()) throw new Error('load falhou'); }
  startPlay(false); if (q.get('mode')) { R.mode = q.get('mode'); drawModes($('#modes'), true); if (R.mode === 'res') select('res'); }
  if (q.get('z')) { R.cam.z = +q.get('z'); centerOn(WD.provs[main.capital].cx * K, WD.provs[main.capital].cy * K); }
  if (q.get('tab')) UI[q.get('win') + 'Tab'] = q.get('tab');
  if (q.get('newarmy')) newArmyModal(main);
  if (q.get('armies')) { const a = S.armies.find(a => a.o === main.id); if (a && groupsOf(main.id).length < 2) splitGroup(a, null); select('armies', S.armies.filter(a => a.o === main.id).map(a => a.id)); }
  if (q.get('army')) { const a = S.armies.find(a => a.o === main.id); if (a) { select('army', a.id); centerOn(...armyXY(a)); } }
  if (q.get('win')) openWin(q.get('win'), q.get('win') === 'peace' && warsOf(main.id)[0] ? warsOf(main.id)[0].id : undefined);
  if (q.get('prov')) { if (q.get('prod')) UI.prodOpen = WD.provs[main.capital].state; select('prov', main.capital); }
  if (q.get('box')) select('armies', S.armies.filter(a => a.o === main.id).map(a => a.id));
  if (q.get('chron')) { UI.chron = true; drawChron(); drawTop(); }
  if (q.get('ctx')) { const p = provsOf(main.id).map(p => WD.provs[p].adj.find(o => S.own[o] >= 0 && S.own[o] !== main.id)).find(x => x != null); const [sx, sy] = toScreen(WD.provs[p].cx * K, WD.provs[p].cy * K); ctxMenu(sx, sy, p); }
  if (q.get('council')) councilPick('marshal', 'Marechal');
  if (q.get('vprev')) UI.vprev = q.get('vprev');
  if (q.get('nat')) { const o = S.nations.find(x => x.alive && x.id !== main.id && main.exP[x.capital]); if (o) select('nat', o.id); }
  if (q.get('fleet')) { const f = S.fleets.find(x => x.o === main.id); if (f) select('fleet', f.id); }
  if (q.get('vpend')) { me().vpend = q.get('vpend'); pendingModals(); }
  if (q.get('ev')) { const n = me(), ev = EVENT[q.get('ev')]; if (ev) { n.evWait = ev.id; notify(n.id, ev.e + ' ' + ev.t, fillTxt(n, ev.m), { ev: ev.id }); pendingModals(); } }
  if (q.get('setup')) { S.player = -1; show('setup'); R.view = -1; S.mapDirty = true; fitCam(); setupCard(main.id); drawModes($('#s-modes')); }
  if (q.get('year')) { S.t = 360 * (+q.get('year') - START_YEAR); TECHS.forEach(t => { if (!t.v && t.y <= +q.get('year')) main.techs[t.id] = 1; }); main.money = 1e5; calcMods(main); econAll(); calcMods(main); if (q.get('moon')) { S.moon.known[main.id] = 1; S.moon.life = 'intel'; if (!S.moon.civs.length) S.moon.civs = [{ n: 'Xelari', era: 6, aggro: true, pow: 900, rel: {} }, { n: 'Oumu', era: 2, aggro: false, pow: 60, rel: {} }]; } drawTop(); if (UI.win) drawWin(); }
  if (q.get('scroll')) $('#win-b').scrollTop = 1e6;
  if (q.get('tip')) { const t = document.querySelector(q.get('tip')), r = t.getBoundingClientRect(); t.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); document.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 5, clientY: r.bottom - 5 })); }
  rebuildMap(); drawFrame(); drawMini(MINI);
})();

{ const ve = validateData(); if (ve.length) console.warn('Grand Chronicle: dados inválidos\n' + ve.join('\n')); }
