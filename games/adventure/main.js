/* Adventure: cliente (entrada, interface, laço de desenho, personagens salvos).
   O cliente move o próprio herói e prevê o próprio golpe; o resto vem dos retratos do host (net.js). */

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };   // sempre texto: nomes e falas podem vir de outro jogador (host)
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
// Modo dev (editor de regiões) só existe rodando no próprio computador: localhost ou arquivo aberto direto. No GitHub Pages some.
const DEV_OK = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
// O mundo editado no modo dev (ainda não gravado no projeto) vale por cima do original, só neste computador.
function currentWorld() {
  if (DEV_OK) {
    const w = store.get('adventure-world', null); if (w && w.regions && w.regions.vila) return w;
    const old = store.get('adventure-regions', null);   // edições da versão anterior do editor: migra uma vez
    if (old && old.vila) { const m = { regions: old, extra: clone(EXTRA_BASE) }; store.set('adventure-world', m); try { localStorage.removeItem('adventure-regions'); } catch (e) {} return m; }
  }
  return baseWorld();
}
setWorld(currentWorld());

/* ---------- Personagens salvos ---------- */
const MAX_CHARS = 4;
let chars = store.get('adventure-chars', []), slot = -1;
const saveChars = () => store.set('adventure-chars', chars);

/* ---------- Estado do cliente ---------- */
let st = null;                                   // sessão em jogo
const keys = new Set(), mouse = { x: 0, y: 0, l: false, r: false };
function newState(c) {
  return { r: 'vila', tp: -1, me: { ...c, x: 0, y: 0, f: 0, mv: 0, hp: 1, max: 1, mp: 0, mmax: 1, cd: {}, roll: 0, swing: 0, dead: 0, ...heroStats(c) },
    mobs: new Map(), others: new Map(), projs: new Map(), drops: new Map(), cd: { a: 0, b: 0, d: 0 }, rollDir: [0, 0], sendT: 0, near: null, ready: false, banner: 0, saveT: 0 };
}

function onSnap(s) {
  if (!st) return;
  const me = st.me;
  if (s.me.tp !== st.tp) {                        // teleporte do host (entrada, renascer)
    st.tp = s.me.tp; me.x = s.me.x; me.y = s.me.y; if (st.r !== s.r || !st.ready) enterRegion(s.r);
    st.ready = true;
  }
  const keep = ['hp', 'max', 'mp', 'mmax', 'st', 'chests', 'lvl', 'xp', 'xpn', 'gold', 'inv', 'eq', 'q', 'hurt'];
  for (const k of keep) me[k] = s.me[k];
  if (s.me.dead && !me.dead) $('#dead').hidden = false;
  if (!s.me.dead && me.dead) $('#dead').hidden = true;
  me.dead = s.me.dead; if (me.dead) $('#dead-t').textContent = me.dead;
  for (const m of s.msg) if (typeof m === 'string') toast(m); else chatLine(m.chat, m.s);
  const sig = JSON.stringify([me.gold, me.inv, me.eq, me.q, me.st, me.lvl]);
  if (sig !== st.sig) { st.sig = sig; setupHud(); if (!$('#panel').hidden) (panelKind === 'npc' ? renderNpc : panelKind === 'bag' ? openBag : panelKind === 'quests' ? openQuests : panelKind === 'char' ? openChar : () => {})(); }   // painel aberto acompanha ouro, mochila e missões
  $('#h-online').textContent = Net.role === 'solo' ? '' : '👥 ' + s.n;
  if (s.r !== st.r) return;                       // retrato da região de onde acabamos de sair

  const sync = (map, rows, mk) => {
    const seen = new Set();
    for (const r of rows) { const id = r[0]; seen.add(id); const o = map.get(id), n = mk(r); if (o) { Object.assign(o, n, { x: o.x, y: o.y }); } else { n.x = n.tx; n.y = n.ty; map.set(id, n); } }
    for (const id of map.keys()) if (!seen.has(id)) map.delete(id);
  };
  sync(st.mobs, s.m, r => ({ id: r[0], k: r[1], tx: r[2], ty: r[3], hp: r[4], wind: r[5], f: r[6], hurt: r[7], lvl: r[8] }));
  sync(st.others, s.o, r => ({ id: r[0], name: r[1], cls: r[2], tx: r[3], ty: r[4], f: r[5], hp: r[6], dead: r[7] === 2, roll: r[7] === 1, lvl: r[8], mv: r[9], wt: r[10] }));
  st.projs = new Map(s.p.map(r => [r[0], { id: r[0], k: r[1], x: r[2], y: r[3], vx: r[4], vy: r[5] }]));
  st.drops = new Map(s.d.map(r => [r[0], { id: r[0], it: r[1], x: r[2], y: r[3] }]));
  for (const e of s.fx) fxFromHost(e);
}
function fxFromHost(e) {
  const [k] = e, sid = Net.selfId, me = st.me;
  if (k === 'arc' || k === 'spin') { if (e[4] !== sid) { View.addFx({ k, x: e[1], y: e[2], a: e[3], life: k === 'spin' ? .35 : .2 }); const o = st.others.get(e[4]); if (o) o.swing = .2; } }
  else if (k === 'mswing') View.addFx({ k, x: e[1], y: e[2], a: e[3], r: MOBS[e[4]].range + MOBS[e[4]].r, life: .25 });
  else if (k === 'dmg') View.addFx({ k: 'text', x: e[1], y: e[2], s: String(e[3]), col: e[4] ? '#ffd84a' : '#fff', big: e[4], life: .7 });
  else if (k === 'hit') View.addFx({ k: 'text', x: e[1], y: e[2], s: '-' + e[3], col: e[4] === sid ? '#ff5050' : '#ff9090', life: .7 });
  else if (k === 'boom') View.addFx({ k, x: e[1], y: e[2], r: e[3], life: .35 });
  else if (k === 'die' || k === 'summon') View.addFx({ k, x: e[1], y: e[2], life: .5 });
  else if (k === 'heal') View.addFx({ k, x: e[1], y: e[2], life: .6 });
  else if (k === 'lvl') { View.addFx({ k, x: e[1], y: e[2], life: 1 }); View.addFx({ k: 'text', x: e[1], y: e[2] - 20, s: 'NÍVEL!', col: '#ffd84a', big: 1, life: 1.2 }); }
  else if (k === 'gold' && e[1] === sid) View.addFx({ k: 'text', x: me.x + 22, y: me.y - 12, s: '+' + e[2] + ' 🪙', col: '#ffd84a', life: .8 });
  else if (k === 'pick' && e[1] === sid) View.addFx({ k: 'text', x: me.x, y: me.y - 26, s: ITEMS[e[2]].e + ' ' + itemName(e[2]), col: '#c0f0ff', life: 1 });
}
function enterRegion(r) {
  st.r = r; st.mobs.clear(); st.others.clear(); st.projs.clear(); st.drops.clear(); closePanels();
  const R = REGIONS[r]; $('#h-region').textContent = R.n + (R.lvl ? ' · Nv ' + R.lvl : '');
  const b = $('#banner'); b.textContent = R.n; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

/* ---------- Laço ---------- */
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!st || !st.ready) return;
  const dt = clamp((now - last) / 1000, 0, .05); last = now;
  const me = st.me, reg = REGIONS[st.r];
  for (const k in st.cd) st.cd[k] = Math.max(0, st.cd[k] - dt);
  me.swing = Math.max(0, me.swing - dt); me.roll = Math.max(0, me.roll - dt); me.wt = attackOf(me, 'a').wt;

  // movimento
  const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
  let dx = 0, dy = 0;
  if (!typing && !me.dead && !paused) { if (keys.has('KeyW') || keys.has('ArrowUp')) dy--; if (keys.has('KeyS') || keys.has('ArrowDown')) dy++; if (keys.has('KeyA') || keys.has('ArrowLeft')) dx--; if (keys.has('KeyD') || keys.has('ArrowRight')) dx++; }
  if (Trans.on) dx = dy = 0;                      // parado durante a transição de portal
  const len = Math.hypot(dx, dy); if (len) { dx /= len; dy /= len; }
  const px = me.x, py = me.y;
  const spd = heroStats(me).spd;
  if (me.roll > 0) { moveBody(reg, me, st.rollDir[0] * spd * ROLL.mult * dt, st.rollDir[1] * spd * ROLL.mult * dt, 5); }
  else if (len) moveBody(reg, me, dx * spd * dt, dy * spd * dt, 5);
  me.mv = len || me.roll > 0 ? 1 : 0;
  const wx = View.cam ? View.cam[0] + mouse.x / View.scale : me.x, wy = View.cam ? View.cam[1] + mouse.y / View.scale : me.y;
  me.f = Math.atan2(wy - (me.y - 6), wx - me.x);

  // ataques
  if (!me.dead && !paused && !uiOpen()) {
    const A = attackOf(me, 'a'), B = attackOf(me, 'b');
    if (mouse.l && st.cd.a <= 0) attack('a', A);
    if (mouse.r && st.cd.b <= 0 && me.mp >= B.mp) attack('b', B);
  }

  // portal: depois de chegar, os portais ficam inativos até o herói sair de cima deles (sem vai e volta)
  const pt = portalAt(reg, me.x, me.y);
  if (!pt) st.portalLock = false;
  else if (!st.portalLock && !Trans.on && REGIONS[pt.to]) {
    if (!portalOpen(me, pt)) {                     // trancado: volta o passo e avisa
      me.x = px; me.y = py; if (!(now - st.lockT < 2500)) { st.lockT = now; toast('🔒 ' + lockText(pt)); }
    } else {
      st.portalLock = true;
      const to = REGIONS[pt.to], kind = pt.fx && pt.fx !== 'auto' ? pt.fx : BIOMES[bioOf(to)].trans;
      const r0 = st.r, tp0 = st.tp;
      Trans.run(kind, () => { if (!st || st.r !== r0 || st.tp !== tp0 || st.me.dead) { if (st) st.portalLock = false; return; } enterRegion(pt.to); [me.x, me.y] = arrivalSpot(to, pt.tx, pt.ty); st.portalLock = !!portalAt(to, me.x, me.y); sendPos(); });
    }
  }

  // NPC, placa ou baú perto (E)
  st.near = null; let best = 30;
  for (const [kind, list] of [['npc', reg.npcs], ['sign', reg.signs || []], ['chest', reg.chests || []]])
    for (const o of list) { const d = Math.hypot(o.x * TILE - me.x, o.y * TILE - me.y); if (d < best) { best = d; st.near = { kind, o }; } }
  if (talking && (Math.hypot(talking.x * TILE - me.x, talking.y * TILE - me.y) > 48 || ![...reg.npcs, ...(reg.signs || [])].includes(talking))) closePanels();   // fecha a conversa ao se afastar

  // suaviza quem vem do host
  const a = Math.min(1, dt * 14);
  for (const m of st.mobs.values()) { m.x += (m.tx - m.x) * a; m.y += (m.ty - m.y) * a; }
  for (const o of st.others.values()) { o.x += (o.tx - o.x) * a; o.y += (o.ty - o.y) * a; o.swing = Math.max(0, (o.swing || 0) - dt); }
  for (const p of st.projs.values()) { p.x += p.vx * dt; p.y += p.vy * dt; }

  st.sendT -= dt; if (st.sendT <= 0) { sendPos(); st.sendT = 1 / 15; }
  st.saveT -= dt; if (st.saveT <= 0) { saveMe(); st.saveT = 3; }
  View.draw(st, now);
  drawHud();
}
function sendPos() { const me = st.me; Net.send({ t: 'st', x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, f: +me.f.toFixed(2), r: st.r, mv: me.mv, tp: st.tp }); }
function attack(k, s) {
  const me = st.me; st.cd[k] = s.cd; me.swing = .2;
  if (s.k === 'arc' || s.k === 'spin') View.addFx({ k: s.k, x: me.x, y: me.y, a: me.f, life: s.k === 'spin' ? .35 : .2 });   // previsão local
  sendPos(); Net.send({ t: 'act', k, a: +me.f.toFixed(3) });
}
function roll() {
  const me = st.me; if (st.cd.d > 0 || me.dead) return;
  let dx = 0, dy = 0; if (keys.has('KeyW')) dy--; if (keys.has('KeyS')) dy++; if (keys.has('KeyA')) dx--; if (keys.has('KeyD')) dx++;
  if (!dx && !dy) { dx = Math.cos(me.f); dy = Math.sin(me.f); }
  const l = Math.hypot(dx, dy); st.rollDir = [dx / l, dy / l]; st.cd.d = ROLL.cd; me.roll = ROLL.t;
  Net.send({ t: 'act', k: 'd', a: 0 });
}
function saveMe() { if (slot < 0 || !st || !st.ready) return; chars[slot] = { ...chars[slot], ...charOf(st.me), r: 'vila' }; saveChars(); }

/* ---------- HUD ---------- */
function drawHud() {
  const me = st.me, A = attackOf(me, 'a'), B = attackOf(me, 'b');
  const bar = (id, v, m, txt) => { $(id + ' i').style.width = (100 * clamp(v / m, 0, 1)) + '%'; $(id + ' b').textContent = txt; };
  bar('#h-hp', me.hp, me.max, me.hp + ' / ' + me.max); bar('#h-mp', me.mp, me.mmax, me.mp + ' / ' + me.mmax); bar('#h-xp', me.xp, me.xpn || 1, 'Nv ' + me.lvl);
  $('#h-gold').textContent = '🪙 ' + me.gold;
  const cdv = { a: st.cd.a / A.cd, b: st.cd.b / B.cd, d: st.cd.d / ROLL.cd };
  for (const k of ['a', 'b', 'd']) { const e = $('#s-' + k); e.style.setProperty('--cd', cdv[k]); e.classList.toggle('nomp', k === 'b' && me.mp < B.mp); }
  $('#b-char').classList.toggle('pts', freePoints(me) > 0);
  $('#s-1 em').textContent = (me.inv && me.inv.pocao) || 0; $('#s-2 em').textContent = (me.inv && me.inv.eter) || 0;
}
function setupHud() {
  const C = CLASSES[st.me.cls], A = attackOf(st.me, 'a'), B = attackOf(st.me, 'b');
  $('#h-name').textContent = st.me.name + ' · ' + C.n;
  $('#s-a').title = A.n + ' (botão esquerdo)'; $('#s-a span').textContent = A.n;
  $('#s-b').title = B.n + ' (botão direito, ' + B.mp + ' mana)'; $('#s-b span').textContent = B.n;
}
function toast(s) { const t = el('div', 'toast'); t.textContent = s; $('#toasts').append(t); setTimeout(() => t.remove(), 2600); }
function chatLine(who, s) { const l = el('div', 'cl'); l.append(el('b', '', ''), document.createTextNode(s)); l.firstChild.textContent = who + ': '; $('#chat-log').append(l); while ($('#chat-log').children.length > 8) $('#chat-log').firstChild.remove(); setTimeout(() => l.classList.add('old'), 12000); }

/* ---------- Painéis: conversa, loja, mochila, missões ---------- */
let talking = null, shopMode = null, paused = false, panelKind = null;
const uiOpen = () => !$('#panel').hidden || paused;
function closePanels() { $('#panel').hidden = true; talking = null; shopMode = null; panelKind = null; draft = null; }
function questMark(npcKey, s) {
  const N = NPCS[npcKey]; if (!N || !N.quests || !s.me.q) return '';
  const q = s.me.q;
  if (N.quests.some(id => q[id] != null && q[id] !== 'ok' && questReady(id))) return '?';
  if (N.quests.some(id => q[id] == null && (!QUESTS[id].req || q[QUESTS[id].req] === 'ok'))) return '!';
  return '';
}
function questReady(id) { const Q = QUESTS[id], v = st.me.q[id]; return Q.kind === 'fetch' ? (st.me.inv[Q.target] || 0) >= Q.count : v >= Q.count; }
function questProg(id) { const Q = QUESTS[id]; return Q.kind === 'fetch' ? Math.min(Q.count, st.me.inv[Q.target] || 0) : st.me.q[id]; }

function openNpc(n) {
  talking = n; shopMode = null; panelKind = 'npc'; renderNpc();
}
function renderNpc() {
  const n = talking, N = NPCS[n.k] || NPCS.aldeao, me = st.me, p = $('#panel'); p.hidden = false; p.innerHTML = '';
  p.append(el('h3', '', ''), el('p', 'talk', '')); p.querySelector('h3').textContent = n.n || N.n; p.querySelector('.talk').textContent = '“' + (n.talk || N.talk) + '”';
  const row = el('div', 'row');
  if (N.shop) row.append(btn('Comprar', () => { shopMode = 'buy'; renderNpc(); }, shopMode === 'buy'));
  if (N.buys) row.append(btn('Vender', () => { shopMode = 'sell'; renderNpc(); }, shopMode === 'sell'));
  if (N.heal) row.append(btn('Curar', () => Net.send({ t: 'cmd', c: 'heal' })));
  row.append(btn('Tchau', closePanels)); p.append(row);
  for (const id of N.quests || []) {
    const Q = QUESTS[id], v = me.q[id];
    if (v === 'ok' || (v == null && Q.req && me.q[Q.req] !== 'ok')) continue;
    const box = el('div', 'quest'); box.append(el('b', '', Q.n), el('p', '', Q.d));
    const rw = [Q.reward.gold && Q.reward.gold + ' 🪙', Q.reward.xp && Q.reward.xp + ' XP', ...Object.entries(Q.reward.items || {}).map(([it, c]) => c + '× ' + itemName(it)), Q.reward.weapon && itemName(CLASSES[me.cls].arma.replace(/\d$/, Q.reward.weapon))].filter(Boolean).join(' · ');
    box.append(el('small', '', 'Recompensa: ' + rw));
    if (v == null) box.append(btn('Aceitar', () => Net.send({ t: 'cmd', c: 'qtake', q: id })));
    else if (questReady(id)) box.append(btn('Entregar', () => Net.send({ t: 'cmd', c: 'qdone', q: id }), true));
    else box.append(el('small', 'prog', questProg(id) + ' / ' + Q.count));
    p.append(box);
  }
  if (shopMode === 'buy') p.append(itemList(N.shop.map(id => [id, 1]), id => '🪙 ' + ITEMS[id].p, id => Net.send({ t: 'cmd', c: 'buy', it: id }), id => me.gold >= ITEMS[id].p));
  if (shopMode === 'sell') {
    const own = Object.entries(me.inv).filter(([id]) => !(ITEMS[id].slot && Object.values(me.eq).includes(id) && me.inv[id] === 1));
    p.append(own.length ? itemList(own, id => '🪙 ' + Math.floor(ITEMS[id].p / 2), id => Net.send({ t: 'cmd', c: 'sell', it: id })) : el('p', 'dim', 'Nada para vender.'));
  }
}
function lockText(pt) { const r = pt.req || {}; return [r.lvl && 'Requer nível ' + r.lvl, r.q && QUESTS[r.q] && 'Requer a missão “' + QUESTS[r.q].n + '”'].filter(Boolean).join(' e ') || 'Trancado'; }
function openSign(o) {
  const p = $('#panel'); talking = o; panelKind = 'sign'; p.hidden = false; p.innerHTML = '';
  p.append(el('h3', '', '🪧'), el('p', 'talk', '')); p.querySelector('.talk').textContent = o.text || '…'; p.append(btn('Fechar', closePanels));
}
function openBag() {
  const me = st.me, p = $('#panel'); talking = null; panelKind = 'bag'; p.hidden = false; p.innerHTML = '';
  p.append(el('h3', '', 'Mochila'));
  const eq = el('div', 'eq'); for (const [slot, ico] of Object.entries(SLOTS)) { const id = me.eq[slot]; eq.append(el('span', '', ico + ' ' + (id ? itemName(id) : '—'))); } p.append(eq);
  const own = Object.entries(me.inv);
  p.append(own.length ? itemList(own, id => ITEMS[id].use ? 'Usar' : ITEMS[id].slot ? (Object.values(me.eq).includes(id) ? 'Tirar' : 'Equipar') : '', id => { const I = ITEMS[id]; if (I.use) Net.send({ t: 'cmd', c: 'use', it: id }); else if (I.slot) Net.send({ t: 'cmd', c: 'equip', it: id }); }) : el('p', 'dim', 'Vazia.'));
  p.append(btn('Fechar', closePanels));
}
function openQuests() {
  const me = st.me, p = $('#panel'); talking = null; panelKind = 'quests'; p.hidden = false; p.innerHTML = '';
  p.append(el('h3', '', 'Missões'));
  const act = Object.entries(me.q).filter(([, v]) => v !== 'ok');
  if (!act.length) p.append(el('p', 'dim', 'Nenhuma. Procure quem tem “!” na vila.'));
  for (const [id] of act) { const Q = QUESTS[id], b = el('div', 'quest'); b.append(el('b', '', Q.n), el('p', '', Q.d), el('small', 'prog', questReady(id) ? 'Pronta: volte a ' + NPCS[Q.giver].n : questProg(id) + ' / ' + Q.count)); p.append(b); }
  const done = Object.entries(me.q).filter(([, v]) => v === 'ok').map(([id]) => QUESTS[id].n);
  if (done.length) p.append(el('p', 'dim', 'Feitas: ' + done.join(', ')));
  p.append(btn('Fechar', closePanels));
}
let draft = null;                                 // atributos sendo distribuídos (só vão ao host em "Confirmar")
function openChar() {
  const me = st.me, p = $('#panel'); talking = null; panelKind = 'char'; p.hidden = false; p.innerHTML = '';
  if (!draft) draft = { ...me.st };
  const left = statSum(CLASSES[me.cls].st) + POINTS_PER_LVL * (me.lvl - 1) - statSum(draft);
  p.append(el('h3', '', me.name + ' · nível ' + me.lvl), el('p', 'pts', ''));
  p.querySelector('.pts').textContent = left ? 'Pontos: ' + left : '';
  const bonus = effStats({ ...me, st: { ...STATS_ZERO } });
  for (const k of Object.keys(STATS)) {
    const row = el('div', 'stat'), v = draft[k], b = bonus[k];
    row.append(el('span', 'sn', STATS[k]), btn('−', () => { draft[k]--; openChar(); }), (() => { const e = el('b', '', String(v)); if (b) e.append(' ', el('i', '', '+' + b)); return e; })(), btn('+', () => { draft[k]++; openChar(); }));
    row.children[1].disabled = v <= STAT_MIN; row.children[3].disabled = v >= STAT_MAX || left <= 0;
    p.append(row);
  }
  const H = heroStats({ ...me, st: draft }), A = attackOf({ ...me, st: draft }, 'a'), B = attackOf({ ...me, st: draft }, 'b');
  const d = el('div', 'derived');
  for (const [n, v] of [['Vida', H.max], ['Mana', H.mmax], [A.n, Math.round(A.dmg)], [B.n, Math.round(B.dmg)], ['Crítico', Math.round(H.crit * 100) + '%'], ['Ataques/s', (1 / A.cd).toFixed(1)], ['Passo', Math.round(H.spd)], ['Saque', '×' + H.luck.toFixed(2)]]) d.append(el('span', '', n), el('b', '', String(v)));
  p.append(d);
  const changed = Object.keys(STATS).some(k => draft[k] !== me.st[k]), row = el('div', 'row');
  const ok = btn('Confirmar', () => { Net.send({ t: 'cmd', c: 'stats', st: draft }); draft = null; }, changed); ok.disabled = !changed;
  row.append(ok, btn('Desfazer', () => { draft = null; openChar(); }), btn('Fechar', () => { draft = null; closePanels(); })); p.append(row);
}
const STATS_ZERO = Object.fromEntries(Object.keys(STATS).map(k => [k, 0]));
function itemList(rows, right, onClick, can) {
  const list = el('div', 'items');
  for (const [id, n] of rows) {
    const I = ITEMS[id], b = el('button', 'it'); b.append(el('i', '', I.e), el('span', '', ''), el('em', '', right(id)));
    b.children[1].textContent = itemName(id) + (n > 1 ? ' ×' + n : '');
    const tip = [I.dmg && I.dmg + ' de dano (' + WTYPES[I.wt].n + ', ' + STAT_SHORT[WTYPES[I.wt].stat] + ')', I.hp && '+' + I.hp + ' vida', ...Object.entries(I.bonus || {}).map(([k, v]) => '+' + v + ' ' + STAT_SHORT[k]), I.use && I.use.hp && 'cura ' + I.use.hp, I.use && I.use.mp && '+' + I.use.mp + ' mana'].filter(Boolean).join(', ');
    if (tip) b.title = tip;
    if (can && !can(id)) b.disabled = true;
    b.onclick = () => onClick(id); list.append(b);
  }
  return list;
}
function btn(t, f, on) { const b = el('button', 'btn' + (on ? ' on' : ''), t); b.onclick = f; return b; }

/* ---------- Entrada ---------- */
const canvas = $('#cv');
addEventListener('keydown', e => {
  if (!st) return;
  const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
  if (e.code === 'Enter') { const c = $('#chat-in'); if (typing && document.activeElement === c) { if (c.value.trim()) Net.send({ t: 'cmd', c: 'chat', s: c.value }); c.value = ''; c.blur(); c.hidden = Net.role === 'solo'; } else if (Net.role !== 'solo') { c.hidden = false; c.focus(); } e.preventDefault(); return; }
  if (typing) { if (e.code === 'Escape') document.activeElement.blur(); return; }
  keys.add(e.code);
  if (e.code === 'Space') { e.preventDefault(); roll(); }
  else if (e.code === 'KeyE' && st.near) {
    const { kind, o } = st.near;
    if (talking === o) closePanels();
    else if (kind === 'npc') openNpc(o);
    else if (kind === 'sign') openSign(o);
    else if ((st.me.chests || []).includes(o.id)) toast('Vazio.'); else Net.send({ t: 'cmd', c: 'chest', id: o.id });
  }
  else if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); if (panelKind === 'bag') closePanels(); else openBag(); }
  else if (e.code === 'KeyC') { if (panelKind === 'char') closePanels(); else openChar(); }
  else if (e.code === 'KeyJ') { if (panelKind === 'quests') closePanels(); else openQuests(); }
  else if (e.code === 'Digit1') Net.send({ t: 'cmd', c: 'use', it: 'pocao' });
  else if (e.code === 'Digit2') Net.send({ t: 'cmd', c: 'use', it: 'eter' });
  else if (e.code === 'Escape') { if (!$('#panel').hidden) closePanels(); else setPause(!paused); }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouse.l = mouse.r = false; });
const btns = e => { mouse.l = !!(e.buttons & 1); mouse.r = !!(e.buttons & 2); };    // e.buttons: vale com os dois botões apertados juntos
canvas.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; btns(e); });
canvas.addEventListener('pointerdown', e => { btns(e); canvas.setPointerCapture(e.pointerId); if (!$('#panel').hidden && !talking) closePanels(); });
addEventListener('pointerup', btns);
canvas.addEventListener('contextmenu', e => e.preventDefault());
$('#s-1').onclick = () => Net.send({ t: 'cmd', c: 'use', it: 'pocao' }); $('#s-2').onclick = () => Net.send({ t: 'cmd', c: 'use', it: 'eter' });
$('#b-char').onclick = () => panelKind === 'char' ? closePanels() : openChar(); $('#b-bag').onclick = openBag; $('#b-quests').onclick = openQuests; $('#b-menu').onclick = () => setPause(true);
function setPause(on) {
  paused = on; $('#pause').hidden = !on;
  $('#p-info').textContent = Net.role === 'solo' ? '' : 'Sala ' + Net.code;
}
$('#p-go').onclick = () => setPause(false);
$('#p-exit').onclick = () => { const dev = st && st.fromDev; saveMe(); Net.leave(); st = null; setPause(false); $('#dead').hidden = true; closePanels(); if (dev) devOpen(); else { show('title'); renderChars(); } };

/* ---------- Telas ---------- */
function show(id) { $$('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
function renderChars() {
  const box = $('#chars'); box.innerHTML = '';
  chars.forEach((c, i) => {
    const b = el('button', 'char'); const C = CLASSES[c.cls];
    b.append(el('i', '', C.e), el('b', '', ''), el('small', '', C.n + ' · nível ' + c.lvl)); b.children[1].textContent = c.name;
    b.onclick = () => { slot = i; $('#mode-who').textContent = c.name; show('mode'); };
    const x = el('span', 'del', '✕'); x.title = 'Apagar'; x.onclick = e => { e.stopPropagation(); if (confirm('Apagar ' + c.name + '?')) { chars.splice(i, 1); saveChars(); renderChars(); } };
    b.append(x); box.append(b);
  });
  $('#t-new').hidden = chars.length >= MAX_CHARS;
}
let newCls = 'guerreiro';
function renderClasses() {
  const box = $('#classes'); box.innerHTML = '';
  for (const [k, C] of Object.entries(CLASSES)) {
    const b = el('button', 'cls' + (k === newCls ? ' on' : '')), cv = el('canvas'), spr = personSprite(k, 0); cv.width = 16; cv.height = spr.height + 2;
    cv.getContext('2d').drawImage(spr, 3, 1);
    const sts = el('div', 'sts'); for (const s of Object.keys(STATS)) sts.append(el('span', '', STAT_SHORT[s]), el('b', '', String(C.st[s])));
    b.append(cv, el('b', '', C.n), sts);
    b.onclick = () => { newCls = k; renderClasses(); }; box.append(b);
  }
}
$('#t-new').onclick = () => { $('#n-name').value = ''; renderClasses(); show('create'); $('#n-name').focus(); };
$('#n-back').onclick = () => show('title');
$('#n-go').onclick = () => {
  const name = $('#n-name').value.trim().slice(0, 14) || 'Herói';
  chars.push(newChar(name, newCls)); saveChars(); slot = chars.length - 1; $('#mode-who').textContent = name; show('mode');
};
$('#m-back').onclick = () => { show('title'); renderChars(); };
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const mkCode = () => Array.from({ length: 5 }, () => CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)]).join('');
$('#m-solo').onclick = () => start(() => Net.startHost(chars[slot], ''));
$('#m-host').onclick = () => { const code = ($('#m-local').checked ? 'local-' : '') + mkCode(); start(() => Net.startHost(chars[slot], code), code); };
$('#m-join').onclick = () => { const code = $('#m-code').value.trim(); if (!code) return $('#m-code').focus(); const c = /^local-?/i.test(code) ? 'local-' + code.replace(/^local-?/i, '').toUpperCase() : code.toUpperCase(); start(() => Net.join(chars[slot], c), null, true); };
$('#m-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('#m-join').click(); });

async function start(open, code, joining) {
  st = newState(chars[slot]); setupHud(); show('game'); View.resize();
  $('#h-room').textContent = code ? 'Sala ' + code : ''; $('#h-room').hidden = !code;
  $('#chat-in').hidden = true; $('#chat-log').innerHTML = '';
  $('#wait').hidden = false; $('#wait-t').textContent = joining ? 'Procurando a sala…' : code ? 'Abrindo a sala…' : 'Carregando…';
  Net.onSnap = s => { onSnap(s); if (st && st.ready) $('#wait').hidden = true; };
  Net.onStatus = (s, fatal) => { if (fatal) { $('#wait').hidden = false; $('#wait-t').textContent = s; } else toast(s); };
  try { await open(); } catch (e) { $('#wait-t').textContent = 'Não deu para conectar (' + (e.message || e) + ').'; return; }
  if (code) { toast('Sala aberta: ' + code); if (devStart) devStart = null; }
  if (devStart && Net.role === 'solo') { const p = Sim.players[Net.selfId]; Sim.region(devStart.r); Sim.place(p, devStart.r, devStart.x, devStart.y); devStart = null; st.fromDev = true; }
}
$('#w-cancel').onclick = () => $('#p-exit').click();
let devStart = null;                              // modo dev: "Testar aqui" começa solo neste ponto

View.init(canvas); Trans.init($('#trans'));
renderChars(); show('title');
requestAnimationFrame(frame);
addEventListener('pagehide', saveMe);
