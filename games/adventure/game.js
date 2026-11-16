/* Adventure: simulação (sem DOM). Quem hospeda roda Sim; todo mundo, inclusive o host, só desenha o que chega nos retratos (net.js).
   Divisão de autoridade: cada jogador move o próprio herói (manda posição); o host decide monstros, dano, saque, loja e missões.
   Também roda em node (testes) e poderia rodar num servidor. */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const CD_GRACE = .1;                              // o cliente conta a recarga por quadro e o host por tique: aceita golpe que chega até 0,1 s antes
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

/* ---------- Mapa e colisão (usados pelo host e pelos clientes) ---------- */
/* ---------- Mundo: regiões + monstros, NPCs e missões criados ou alterados no editor (WORLD_EXTRA em regions.js) ---------- */
const clone = o => JSON.parse(JSON.stringify(o));
const EXTRA_BASE = typeof WORLD_EXTRA !== 'undefined' ? WORLD_EXTRA : { mobs: {}, npcs: {}, quests: {} };
const PRISTINE = { mobs: clone(MOBS), npcs: clone(NPCS), quests: clone(QUESTS) };   // como vieram de data.js
const baseWorld = () => ({ regions: clone(REGIONS_BASE), extra: clone(EXTRA_BASE) });
let REGIONS = clone(REGIONS_BASE), WORLD = null;
function setWorld(w) {                            // troca o mundo inteiro (host, cliente ao entrar, editor)
  WORLD = w; REGIONS = w.regions; const ex = w.extra || {};
  for (const [T, P, X] of [[MOBS, PRISTINE.mobs, ex.mobs], [NPCS, PRISTINE.npcs, ex.npcs], [QUESTS, PRISTINE.quests, ex.quests]]) {
    for (const k of Object.keys(T)) delete T[k];
    Object.assign(T, clone(P), clone(X || {}));
  }
}
function setRegions(r) { setWorld({ regions: r, extra: (WORLD && WORLD.extra) || clone(EXTRA_BASE) }); }
const portalOpen = (c, o) => !o.req || ((!o.req.lvl || c.lvl >= o.req.lvl) && (!o.req.q || (c.q && c.q[o.req.q] === 'ok')));
function mobScale(M, lvl) {                       // multiplicadores pelo nível da área em relação ao nível de referência do monstro
  const d = lvl - (M.lvl || 1), f = k => Math.max(.25, 1 + MOB_LVL[k] * d);
  return { hp: f('hp'), dmg: f('dmg'), xp: f('xp'), gold: f('gold') };
}
function tileAt(reg, tx, ty) { const row = reg.map[ty]; return row ? row[tx] || 'x' : 'x'; }
function solidAt(reg, px, py) { const t = TILES[tileAt(reg, Math.floor(px / TILE), Math.floor(py / TILE))]; return !t || !!t.s; }
function wallDepth(reg, x, y, r) {               // quanto o círculo entra em ladrilhos sólidos (0 = livre)
  let d = 0;
  for (let ty = Math.floor((y - r) / TILE); ty <= Math.floor((y + r) / TILE); ty++)
    for (let tx = Math.floor((x - r) / TILE); tx <= Math.floor((x + r) / TILE); tx++) {
      const t = TILES[tileAt(reg, tx, ty)]; if (!t || !t.s) continue;
      const cx = clamp(x, tx * TILE, tx * TILE + TILE), cy = clamp(y, ty * TILE, ty * TILE + TILE), dist = Math.hypot(x - cx, y - cy);
      if (dist < r) d += r - dist;
    }
  return d;
}
const hitsWall = (reg, x, y, r) => wallDepth(reg, x, y, r) > 0;
// Move em cada eixo separado para deslizar nas paredes.
function moveBody(reg, e, dx, dy, r) {
  // aceita o passo se fica livre ou, se já estava dentro de algo sólido (teleporte, mapa editado), se entra menos
  const ok = (x, y) => { const d = wallDepth(reg, x, y, r); return d === 0 || d < wallDepth(reg, e.x, e.y, r) - 1e-6; };
  if (dx && ok(e.x + dx, e.y)) e.x += dx;
  if (dy && ok(e.x, e.y + dy)) e.y += dy;
}
function portalAt(reg, x, y) { const tx = x / TILE, ty = y / TILE; return (reg.portals || []).find(p => tx >= p.x && tx < p.x + p.w && ty >= p.y && ty < p.y + p.h); }
function arrivalSpot(reg, tx, ty) {               // ponto de chegada de um portal (em quadrados) → pixels livres, fora de parede e de portais
  const ok = (x, y) => !hitsWall(reg, x, y, 6) && !(reg.portals || []).some(p => x / TILE > p.x - .6 && x / TILE < p.x + p.w + .6 && y / TILE > p.y - .6 && y / TILE < p.y + p.h + .6);
  if (ok(tx * TILE, ty * TILE)) return [tx * TILE, ty * TILE];
  for (let r = .5; r < 12; r += .5) for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, x = (tx + Math.cos(a) * r) * TILE, y = (ty + Math.sin(a) * r) * TILE; if (ok(x, y)) return [x, y]; }
  return [tx * TILE, ty * TILE];
}
function freeSpot(reg, cx, cy, rad) {          // ponto livre perto de (cx, cy) em quadrados → pixels
  for (let i = 0; i < 30; i++) {
    const a = rand(0, TAU), d = rand(0, rad), x = (cx + Math.cos(a) * d) * TILE, y = (cy + Math.sin(a) * d) * TILE;
    if (!hitsWall(reg, x, y, 7)) return [x, y];
  }
  return [cx * TILE, cy * TILE];
}

/* ---------- Herói: atributos e números derivados ---------- */
function newChar(name, cls) {
  const C = CLASSES[cls];
  return { name, cls, lvl: 1, xp: 0, gold: 20, st: { ...C.st }, inv: { pocao: 3, [C.arma]: 1 }, eq: { arma: C.arma }, q: {}, chests: [], r: 'vila' };
}
const statSum = st => Object.keys(STATS).reduce((a, k) => a + st[k], 0);
const freePoints = c => statSum(CLASSES[c.cls].st) + POINTS_PER_LVL * (c.lvl - 1) - statSum(c.st);
function effStats(c) {                            // base + bônus dos itens equipados (sem teto)
  const s = { ...c.st };
  for (const id of Object.values(c.eq)) { const b = ITEMS[id] && ITEMS[id].bonus; if (b) for (const k in b) s[k] += b[k]; }
  return s;
}
function heroStats(c) {
  const s = effStats(c), a = c.eq.armadura && ITEMS[c.eq.armadura];
  return { s, max: Math.round(DERIVED.hp(s, c.lvl) + (a && a.hp || 0)), mmax: Math.round(DERIVED.mp(s, c.lvl)), spd: DERIVED.spd(s), regen: DERIVED.regen(s), crit: DERIVED.crit(s), luck: DERIVED.luck(s), cdMul: DERIVED.cdMul(s) };
}
function attackOf(c, k) {                         // a = ataque da arma; b = habilidade da classe. Devolve a definição com dano e recarga prontos.
  const s = effStats(c), cdMul = DERIVED.cdMul(s);
  if (k === 'b') { const b = CLASSES[c.cls].b; return { ...b, dmg: b.base + s[b.stat] * b.mult + c.lvl, cd: b.cd * cdMul }; }
  const it = c.eq.arma && ITEMS[c.eq.arma], W = WTYPES[it ? it.wt : 'punho'];
  return { ...W, wt: it ? it.wt : 'punho', dmg: (it ? it.dmg : W.dmg) + s[W.stat] * W.mult + (c.lvl - 1) / 2, cd: W.cd * cdMul };
}
function cleanChar(x) {                         // personagem vindo de outro navegador (ou de um save antigo): só aceita o que existe
  x = x && typeof x === 'object' ? x : {};
  const c = newChar(String(x.name || 'Herói').replace(/[<>]/g, '').slice(0, 14) || 'Herói', CLASSES[x.cls] ? x.cls : 'guerreiro');
  const num = (v, a, b) => Number.isFinite(+v) ? clamp(Math.floor(+v), a, b) : a;
  c.lvl = num(x.lvl, 1, 99); c.xp = num(x.xp, 0, 1e9); c.gold = num(x.gold, 0, 1e9);
  if (x.st && typeof x.st === 'object') { for (const k in STATS) c.st[k] = num(x.st[k] ?? c.st[k], STAT_MIN, STAT_MAX); if (freePoints(c) < 0) c.st = { ...CLASSES[c.cls].st }; }
  if (x.inv && typeof x.inv === 'object') { c.inv = {}; for (const [k, v] of Object.entries(x.inv)) if (ITEMS[k] && num(v, 0, 9999) > 0) c.inv[k] = num(v, 0, 9999); }
  if (x.eq && typeof x.eq === 'object') { c.eq = {}; for (const sl in SLOTS) { const id = x.eq[sl]; if (ITEMS[id] && ITEMS[id].slot === sl && c.inv[id]) c.eq[sl] = id; } }
  if (x.q && typeof x.q === 'object') for (const [k, v] of Object.entries(x.q)) if (QUESTS[k]) c.q[k] = v === 'ok' ? 'ok' : num(v, 0, 999);
  if (Array.isArray(x.chests)) c.chests = x.chests.filter(id => typeof id === 'string').slice(-500);
  return c;
}
const SAVE_KEYS = ['name', 'cls', 'lvl', 'xp', 'gold', 'st', 'inv', 'eq', 'q', 'chests', 'r'];
const charOf = p => Object.fromEntries(SAVE_KEYS.map(k => [k, p[k]]));

/* ---------- Simulação ---------- */
const Sim = {
  t: 0, nid: 1, players: {}, R: {},

  reset() { this.t = 0; this.nid = 1; this.players = {}; this.R = {}; },
  region(id) {                                   // estado vivo de uma região (criado na primeira visita)
    let s = this.R[id]; if (s) return s;
    const def = REGIONS[id]; if (!def) return null;
    s = this.R[id] = { id, def, mobs: [], projs: [], drops: [], fx: [], spawns: def.spawns.map(sp => ({ ...sp, alive: 0, timer: 0 })) };
    s.spawns.forEach((sp, i) => { for (let k = 0; k < sp.n; k++) this.spawnMob(s, i); });
    return s;
  },
  spawnMob(s, i) {
    const sp = s.spawns[i], M = MOBS[sp.m]; if (!M) return;
    const [x, y] = sp.r ? freeSpot(s.def, sp.x, sp.y, sp.r) : [sp.x * TILE, sp.y * TILE];
    const lvl = sp.lvl || M.lvl || 1, sc = mobScale(M, lvl), n = Math.max(1, this.inRegion(s.id).length), hp = Math.round(M.hp * sc.hp * (1 + PARTY_HP * (n - 1)));
    s.mobs.push({ id: this.nid++, k: sp.m, sp: i, lvl, sc, x, y, hx: x, hy: y, hp, max: hp, st: 'idle', t: rand(0, 2), cd: 0, f: rand(0, TAU), vx: 0, vy: 0, tgt: null, phase: 0 });
    sp.alive++;
  },
  inRegion(id) { return Object.values(this.players).filter(p => p.r === id); },

  addPlayer(id, char) {
    const c = cleanChar(char);
    c.r = 'vila';                                 // toda sessão começa na vila
    const p = Object.assign(c, { id, x: 0, y: 0, f: 0, cd: { a: 0, b: 0, d: 0 }, roll: 0, dead: 0, tp: 0, msg: [], hurt: 0 });
    Object.assign(p, heroStats(p)); p.hp = p.max; p.mp = p.mmax;
    this.place(p, p.r);
    this.players[id] = p; this.region(p.r);
    return p;
  },
  removePlayer(id) { delete this.players[id]; },
  place(p, rid, x, y) {                           // teleporte pelo host: o cliente aceita quando tp muda
    const def = REGIONS[rid]; p.r = rid;
    if (x == null) [x, y] = freeSpot(def, def.start ? def.start[0] + .5 : def.map[0].length / 2, def.start ? def.start[1] + .5 : def.map.length / 2, 1.5);
    p.x = x; p.y = y; p.tp++;
  },
  say(p, s) { p.msg.push(s); },
  fx(rid, ...e) { const s = this.R[rid]; if (s) s.fx.push(e); },

  /* ----- Mensagens dos jogadores ----- */
  input(id, m) {
    const p = this.players[id]; if (!p) return;
    if (m.t === 'st') {                           // posição (o cliente é dono do próprio movimento)
      if (p.dead || m.tp !== p.tp) return;        // ignora posição velha, de antes de um teleporte do host
      if (m.r !== p.r) {
        if (!REGIONS[m.r]) return;
        const via = (REGIONS[p.r].portals || []).filter(o => o.to === m.r);
        if (via.length && !via.some(o => portalOpen(p, o))) return;   // portal trancado (nível ou missão)
        p.r = m.r; this.region(m.r);
      }
      p.x = m.x; p.y = m.y; p.f = m.f; p.mv = m.mv;
    } else if (m.t === 'act') this.act(p, m.k, m.a);
    else if (m.t === 'cmd') this.cmd(p, m);
  },
  act(p, k, a) {
    if (p.dead) return;
    if (k === 'd') { if (p.cd.d > CD_GRACE) return; p.cd.d = ROLL.cd; p.roll = ROLL.t + .05; return; }
    if (k !== 'a' && k !== 'b') return;
    const s = attackOf(p, k); if (p.cd[k] > CD_GRACE || (s.mp && p.mp < s.mp)) return;
    p.cd[k] = s.cd; if (s.mp) p.mp -= s.mp; p.f = a;
    const reg = this.R[p.r], dmg = s.dmg;
    if (s.k === 'arc' || s.k === 'spin') {
      this.fx(p.r, s.k, p.x, p.y, +a.toFixed(2), p.id, s.wt || '');
      for (const m of reg.mobs) {
        const d = Math.hypot(m.x - p.x, m.y - p.y), M = MOBS[m.k];
        if (d > s.range + M.r) continue;
        if (s.k === 'arc' && d > M.r && Math.abs(angDiff(Math.atan2(m.y - p.y, m.x - p.x), a)) > s.arc / 2 + .2) continue;
        this.hurtMob(reg, m, dmg, p, Math.atan2(m.y - p.y, m.x - p.x));
      }
    } else {
      const n = s.qty || 1;
      for (let i = 0; i < n; i++) {
        const aa = a + (n > 1 ? (i / (n - 1) - .5) * s.spread : 0);
        reg.projs.push({ id: this.nid++, k: s.pk, x: p.x + Math.cos(aa) * 6, y: p.y + Math.sin(aa) * 6, vx: Math.cos(aa) * s.spd, vy: Math.sin(aa) * s.spd, life: s.life, dmg, own: p.id, aoe: s.aoe || 0, pierce: s.pierce || 0, hit: [] });
      }
    }
  },
  cmd(p, m) {
    const I = ITEMS[m.it], have = n => (p.inv[m.it] || 0) >= n;
    const give = (it, n) => { p.inv[it] = (p.inv[it] || 0) + n; if (p.inv[it] <= 0) delete p.inv[it]; };
    switch (m.c) {
      case 'use':
        if (!I || !I.use || !have(1) || p.dead) return;
        give(m.it, -1);
        if (I.use.hp) { p.hp = Math.min(p.max, p.hp + I.use.hp); this.fx(p.r, 'heal', p.x, p.y, I.use.hp); }
        if (I.use.mp) p.mp = Math.min(p.mmax, p.mp + I.use.mp);
        break;
      case 'buy':
        if (!I || p.gold < I.p) return this.say(p, 'Ouro insuficiente.');
        p.gold -= I.p; give(m.it, 1); this.say(p, 'Comprou ' + itemName(m.it, p.cls) + '.'); break;
      case 'sell': {
        if (!I || !have(1)) return;
        for (const sl in p.eq) if (p.eq[sl] === m.it && p.inv[m.it] === 1) delete p.eq[sl];
        give(m.it, -1); p.gold += Math.floor(I.p / 2); this.restat(p); break;
      }
      case 'equip':
        if (!I || !I.slot || !have(1)) return;
        if (p.eq[I.slot] === m.it) delete p.eq[I.slot]; else p.eq[I.slot] = m.it;
        this.restat(p); break;
      case 'stats': {                             // distribuir pontos: cada atributo base entre STAT_MIN e STAT_MAX, sem gastar mais do que tem
        const st = {}; for (const k in STATS) { const v = Math.floor(+(m.st || {})[k]); if (!(v >= STAT_MIN && v <= STAT_MAX)) return; st[k] = v; }
        if (statSum(st) > statSum(CLASSES[p.cls].st) + POINTS_PER_LVL * (p.lvl - 1)) return;
        p.st = st; this.restat(p); break;
      }
      case 'heal': p.hp = p.max; p.mp = p.mmax; this.fx(p.r, 'heal', p.x, p.y, 0); break;
      case 'qtake': {
        const Q = QUESTS[m.q]; if (!Q || p.q[m.q] || (Q.req && p.q[Q.req] !== 'ok')) return;
        p.q[m.q] = 0; this.say(p, 'Missão: ' + Q.n); break;
      }
      case 'qdone': {
        const Q = QUESTS[m.q]; if (!Q || p.q[m.q] === 'ok' || p.q[m.q] == null) return;
        if (Q.kind === 'fetch') { if ((p.inv[Q.target] || 0) < Q.count) return; give(Q.target, -Q.count); }
        else if (p.q[m.q] < Q.count) return;
        p.q[m.q] = 'ok'; p.gold += Q.reward.gold || 0;
        for (const [it, n] of Object.entries(Q.reward.items || {})) give(it, n);
        if (Q.reward.weapon) { const w = CLASSES[p.cls].arma.replace(/\d$/, Q.reward.weapon); if (ITEMS[w]) give(w, 1); }
        this.say(p, 'Missão concluída: ' + Q.n); this.gainXp(p, Q.reward.xp || 0); break;
      }
      case 'chest': {                              // baú: cada herói abre uma vez
        const c = (REGIONS[p.r].chests || []).find(c => c.id === m.id);
        if (!c || p.chests.includes(c.id) || Math.hypot(c.x * TILE - p.x, c.y * TILE - p.y) > 32) return;
        p.chests.push(c.id); p.gold += c.gold || 0;
        for (const [it, n] of Object.entries(c.items || {})) if (ITEMS[it]) give(it, n);
        this.fx(p.r, 'chest', p.id, c.id); this.say(p, 'Baú: ' + [c.gold && c.gold + ' de ouro', ...Object.entries(c.items || {}).filter(([it]) => ITEMS[it]).map(([it, n]) => n + '× ' + itemName(it))].filter(Boolean).join(', '));
        break;
      }
      case 'chat': {
        const s = String(m.s || '').slice(0, 120).trim(); if (!s) return;
        for (const o of Object.values(this.players)) o.msg.push({ chat: p.name, s });
        break;
      }
    }
  },

  restat(p) {                                    // recalcula vida/mana máximas mantendo a proporção atual
    const hp = p.hp / p.max, mp = p.mp / p.mmax; Object.assign(p, heroStats(p)); p.hp = Math.max(p.dead ? 0 : 1, Math.round(p.max * hp)); p.mp = p.mmax * mp;
  },

  /* ----- Combate ----- */
  hurtMob(reg, m, dmg, p, ang) {
    if (m.hp <= 0) return;
    const crit = Math.random() < p.crit; dmg = Math.round(dmg * rand(.9, 1.1) * (crit ? 1.6 : 1));
    m.hp -= dmg; m.tgt = p.id; m.hurt = .15;
    const M = MOBS[m.k], kb = M.boss ? 20 : 90; m.vx += Math.cos(ang) * kb; m.vy += Math.sin(ang) * kb;
    this.fx(reg.id, 'dmg', Math.round(m.x), Math.round(m.y - M.r), dmg, crit ? 1 : 0);
    if (m.hp <= 0) this.killMob(reg, m, p);
  },
  killMob(reg, m, killer) {
    const M = MOBS[m.k];
    reg.mobs = reg.mobs.filter(o => o !== m);
    const sp = reg.spawns[m.sp], sc = m.sc || mobScale(M, M.lvl || 1); if (sp) { sp.alive--; sp.timer = Math.max(sp.timer, sp.respawn || M.respawn || MOB_RESPAWN); }
    this.fx(reg.id, 'die', Math.round(m.x), Math.round(m.y), m.k);
    // Coop: todos na região ganham XP, ouro e crédito de missão; os itens caem no chão para quem pegar.
    for (const p of this.inRegion(reg.id)) {
      if (p.dead) continue;
      const g = Math.round(randi(...M.gold) * sc.gold); p.gold += g; this.fx(reg.id, 'gold', p.id, g);
      for (const [qid, v] of Object.entries(p.q)) { const Q = QUESTS[qid]; if (v !== 'ok' && Q.kind === 'kill' && (Q.target === m.k || Q.target === M.fam) && v < Q.count) p.q[qid] = v + 1; }
      this.gainXp(p, Math.round(M.xp * sc.xp));
    }
    const luck = killer ? killer.luck : 1;   // a sorte de quem deu o golpe final aumenta a chance de cada item
    for (const [it, ch] of (sp && sp.drops) || M.drops || []) if (ITEMS[it] && Math.random() < ch * luck) reg.drops.push({ id: this.nid++, it, x: m.x + rand(-6, 6), y: m.y + rand(-6, 6), t: 60 });
  },
  gainXp(p, xp) {
    p.xp += xp;
    while (p.xp >= LEVEL.xp(p.lvl)) { p.xp -= LEVEL.xp(p.lvl); p.lvl++; Object.assign(p, heroStats(p)); p.hp = p.max; p.mp = p.mmax; this.fx(p.r, 'lvl', p.x, p.y, p.id); this.say(p, 'Nível ' + p.lvl + '! +' + POINTS_PER_LVL + ' pontos (C)'); }
  },
  hurtPlayer(p, dmg, ang) {
    if (p.dead || p.roll > 0 || p.hurt > 0) return;
    dmg = Math.round(dmg * rand(.9, 1.1)); p.hp -= dmg; p.hurt = .35;
    this.fx(p.r, 'hit', Math.round(p.x), Math.round(p.y - 8), dmg, p.id);
    if (p.hp <= 0) {
      p.hp = 0; p.dead = RESPAWN; const lost = Math.floor(p.gold * DEATH_GOLD); p.gold -= lost;
      this.fx(p.r, 'pdie', Math.round(p.x), Math.round(p.y), p.id); this.say(p, 'Você caiu. Perdeu ' + lost + ' de ouro.');
    }
  },

  /* ----- Passo da simulação ----- */
  step(dt) {
    this.t += dt;
    for (const p of Object.values(this.players)) {
      for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt);
      p.roll = Math.max(0, p.roll - dt); p.hurt = Math.max(0, p.hurt - dt);
      if (p.dead) { p.dead -= dt; if (p.dead <= 0) { p.dead = 0; p.hp = p.max; p.mp = p.mmax; this.place(p, 'vila'); this.region('vila'); } continue; }
      p.mp = Math.min(p.mmax, p.mp + dt * p.regen);
      if (REGIONS[p.r].safe) p.hp = Math.min(p.max, p.hp + dt * 4);
    }
    for (const s of Object.values(this.R)) {
      const here = this.inRegion(s.id);
      if (!here.length) { s.fx.length = 0; continue; }     // região vazia fica congelada
      this.stepRegion(s, here.filter(p => !p.dead), dt);
    }
  },
  stepRegion(s, alive, dt) {
    const def = s.def, party = 1 + PARTY_HP * (Math.max(1, this.inRegion(s.id).length) - 1);
    s.spawns.forEach((sp, i) => { if (sp.alive < sp.n) { sp.timer -= dt; if (sp.timer <= 0) { this.spawnMob(s, i); sp.timer = MOB_RESPAWN * rand(.6, 1); } } });

    for (const m of s.mobs) {
      const M = MOBS[m.k]; m.cd -= dt; m.hurt = Math.max(0, (m.hurt || 0) - dt);
      const max = Math.round(M.hp * (m.sc ? m.sc.hp : 1) * party); if (m.max !== max) { m.hp = Math.max(1, Math.round(m.hp * max / m.max)); m.max = max; }   // vida acompanha o tamanho do grupo
      // empurrão do golpe
      if (m.vx || m.vy) { moveBody(def, m, m.vx * dt, m.vy * dt, M.r); m.vx *= Math.pow(.002, dt); m.vy *= Math.pow(.002, dt); if (Math.abs(m.vx) + Math.abs(m.vy) < 2) m.vx = m.vy = 0; }
      let tgt = alive.find(p => p.id === m.tgt);
      if (!tgt) { m.tgt = null; let best = M.aggro; for (const p of alive) { const d = Math.hypot(p.x - m.x, p.y - m.y); if (d < best) { best = d; tgt = p; } } if (tgt) m.tgt = tgt.id; }
      const homeD = Math.hypot(m.x - m.hx, m.y - m.hy);
      if (tgt && homeD > (M.leash || LEASH)) { tgt = null; m.tgt = null; m.st = 'back'; }

      if (m.st === 'wind') {                      // preparando o golpe: fica parado e solta no fim
        m.t -= dt;
        if (m.t <= 0) {
          m.st = 'chase'; m.cd = M.cd;
          const dmg = M.dmg * (m.sc ? m.sc.dmg : 1);
          if (M.shot) s.projs.push({ id: this.nid++, k: M.shot.pk, x: m.x, y: m.y, vx: Math.cos(m.f) * M.shot.spd, vy: Math.sin(m.f) * M.shot.spd, life: 1.4, dmg, mob: 1, aoe: 0, hit: [] });
          else {
            this.fx(s.id, 'mswing', Math.round(m.x), Math.round(m.y), +m.f.toFixed(2), m.k);
            for (const p of alive) { const d = Math.hypot(p.x - m.x, p.y - m.y); if (d < M.range + M.r + 6 && (M.boss || Math.abs(angDiff(Math.atan2(p.y - m.y, p.x - m.x), m.f)) < 1.2)) this.hurtPlayer(p, dmg, m.f); }
          }
          if (M.boss) this.bossExtra(s, m, alive);
        }
        continue;
      }
      if (tgt) {
        const dx = tgt.x - m.x, dy = tgt.y - m.y, d = Math.hypot(dx, dy); m.f = Math.atan2(dy, dx); m.st = 'chase';
        if (d < M.range + M.r + 4 && m.cd <= 0 && (!M.shot || this.clearShot(def, m, tgt))) { m.st = 'wind'; m.t = M.wind; continue; }
        let want = d > M.range * .8 + M.r ? 1 : 0;
        if (M.keep && d < M.keep) want = -1;      // arqueiros recuam se o herói chega perto
        if (want) moveBody(def, m, Math.cos(m.f) * M.spd * dt * want, Math.sin(m.f) * M.spd * dt * want, M.r);
      } else if (m.st === 'back' || homeD > 40) {
        m.st = 'back'; m.f = Math.atan2(m.hy - m.y, m.hx - m.x); moveBody(def, m, Math.cos(m.f) * M.spd * dt, Math.sin(m.f) * M.spd * dt, M.r);
        m.hp = Math.min(m.max, m.hp + m.max * dt * .25);
        if (homeD < 8) m.st = 'idle';
      } else {                                    // passeia perto de casa
        m.t -= dt;
        if (m.t <= 0) { m.st = m.st === 'walk' ? 'idle' : 'walk'; m.t = rand(1, 3); m.f = rand(0, TAU); }
        if (m.st === 'walk') moveBody(def, m, Math.cos(m.f) * M.spd * .35 * dt, Math.sin(m.f) * M.spd * .35 * dt, M.r);
      }
    }
    this.mobSeparation(s);

    for (const pr of s.projs) {
      pr.life -= dt; const nx = pr.x + pr.vx * dt, ny = pr.y + pr.vy * dt;
      if (solidAt(def, nx, ny) && !'~'.includes(tileAt(def, Math.floor(nx / TILE), Math.floor(ny / TILE)))) { pr.life = 0; if (pr.aoe) this.boom(s, pr); continue; }
      pr.x = nx; pr.y = ny;
      if (pr.mob) {
        for (const p of alive) if (Math.hypot(p.x - pr.x, p.y - pr.y) < 8) { this.hurtPlayer(p, pr.dmg, Math.atan2(pr.vy, pr.vx)); pr.life = 0; break; }
      } else {
        const owner = this.players[pr.own];
        for (const m of s.mobs) {
          if (pr.hit.includes(m.id) || Math.hypot(m.x - pr.x, m.y - pr.y) > MOBS[m.k].r + 3) continue;
          if (pr.aoe) { this.boom(s, pr); pr.life = 0; break; }
          if (owner) this.hurtMob(s, m, pr.dmg, owner, Math.atan2(pr.vy, pr.vx));
          pr.hit.push(m.id); if (pr.pierce-- <= 0) { pr.life = 0; break; }
        }
      }
      if (pr.life <= 0 && pr.aoe && !pr.boomed) this.boom(s, pr);
    }
    s.projs = s.projs.filter(pr => pr.life > 0);

    for (const d of s.drops) {
      d.t -= dt;
      const p = alive.find(p => Math.hypot(p.x - d.x, p.y - d.y) < 12);
      if (p) { p.inv[d.it] = (p.inv[d.it] || 0) + 1; d.t = 0; this.fx(s.id, 'pick', p.id, d.it); }
    }
    s.drops = s.drops.filter(d => d.t > 0);
  },
  boom(s, pr) {
    pr.boomed = 1; this.fx(s.id, 'boom', Math.round(pr.x), Math.round(pr.y), pr.aoe);
    const owner = this.players[pr.own]; if (!owner) return;
    for (const m of [...s.mobs]) if (Math.hypot(m.x - pr.x, m.y - pr.y) < pr.aoe + MOBS[m.k].r) this.hurtMob(s, m, pr.dmg, owner, Math.atan2(m.y - pr.y, m.x - pr.x));
  },
  bossExtra(s, m, alive) {                       // chefe: anel de ossos a cada 3 golpes; chama ajuda abaixo da metade
    m.phase++;
    if (m.phase % 3 === 0) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; s.projs.push({ id: this.nid++, k: 'osso_m', x: m.x, y: m.y, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, life: 2, dmg: MOBS[m.k].dmg * (m.sc ? m.sc.dmg : 1) * .7, mob: 1, hit: [] }); }
    if (m.hp < m.max / 2 && !m.called) {
      m.called = 1; this.fx(s.id, 'summon', Math.round(m.x), Math.round(m.y));
      const minion = MOBS[m.k].minion || 'esqueleto'; if (!MOBS[minion]) return;
      for (let k = 0; k < 2; k++) { const sc = mobScale(MOBS[minion], m.lvl - 2), hp = Math.round(MOBS[minion].hp * sc.hp); s.mobs.push({ id: this.nid++, k: minion, sp: -1, lvl: m.lvl - 2, sc, x: m.x + (k ? 20 : -20), y: m.y + 14, hx: m.x, hy: m.y + 14, hp, max: hp, st: 'chase', t: 0, cd: 1, f: 0, vx: 0, vy: 0, tgt: alive[0] && alive[0].id }); }
    }
  },
  clearShot(def, m, p) {                          // linha de tiro sem parede no meio
    const n = Math.ceil(Math.hypot(p.x - m.x, p.y - m.y) / 6);
    for (let i = 1; i < n; i++) { const x = m.x + (p.x - m.x) * i / n, y = m.y + (p.y - m.y) * i / n; if (solidAt(def, x, y) && tileAt(def, Math.floor(x / TILE), Math.floor(y / TILE)) !== '~') return false; }
    return true;
  },
  mobSeparation(s) {                              // monstros não se empilham
    const a = s.mobs;
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
      const m = a[i], o = a[j], rr = MOBS[m.k].r + MOBS[o.k].r, dx = o.x - m.x, dy = o.y - m.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < rr) { const push = (rr - d) / 2, ux = dx / d * push, uy = dy / d * push; moveBody(s.def, m, -ux, -uy, MOBS[m.k].r); moveBody(s.def, o, ux, uy, MOBS[o.k].r); }
    }
  },

  /* ----- Retrato enviado a cada jogador (só a região dele) ----- */
  snapshot(id) {
    const p = this.players[id]; if (!p) return null;
    const s = this.R[p.r];
    return {
      t: 's', r: p.r,
      m: s.mobs.map(m => [m.id, m.k, Math.round(m.x), Math.round(m.y), Math.ceil(m.hp / m.max * 100), m.st === 'wind' ? 1 : 0, +m.f.toFixed(2), m.hurt > 0 ? 1 : 0, m.lvl]),
      p: s.projs.map(pr => [pr.id, pr.k, Math.round(pr.x), Math.round(pr.y), Math.round(pr.vx), Math.round(pr.vy)]),
      d: s.drops.map(d => [d.id, d.it, Math.round(d.x), Math.round(d.y)]),
      o: this.inRegion(p.r).filter(o => o !== p).map(o => [o.id, o.name, o.cls, Math.round(o.x), Math.round(o.y), +o.f.toFixed(2), Math.ceil(o.hp / o.max * 100), o.dead ? 2 : o.roll > 0 ? 1 : 0, o.lvl, o.mv ? 1 : 0, attackOf(o, 'a').wt]),
      fx: s.fx,
      me: { hp: Math.ceil(p.hp), max: p.max, mp: Math.floor(p.mp), mmax: p.mmax, st: p.st, chests: p.chests, lvl: p.lvl, xp: p.xp, xpn: LEVEL.xp(p.lvl), gold: p.gold, inv: p.inv, eq: p.eq, q: p.q, dead: p.dead > 0 ? Math.ceil(p.dead) : 0, tp: p.tp, x: Math.round(p.x), y: Math.round(p.y), r: p.r, cd: p.cd, hurt: p.hurt > 0 ? 1 : 0 },
      msg: p.msg.splice(0),
      n: Object.keys(this.players).length,
    };
  },
  endSnapshots() { for (const s of Object.values(this.R)) s.fx = []; },
};

