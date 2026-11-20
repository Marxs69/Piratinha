/* Grand Chronicle — simulação: fronts (Victoria 3 / HoI4).
   Em cada guerra, as províncias de um lado que encostam no outro lado formam linhas de frente (componentes ligados).
   Um exército atribuído a um front (a.front = id) segue a ordem do front para o seu país (S.ford[país][front]):
   'hold' espalha as tropas pelos pontos mais ameaçados da linha; 'adv' concentra tudo no ponto mais fraco do inimigo e avança. */
'use strict';

const FRONT_EVERY = 5;                                        // dias entre recálculos
function frontsTick() {
  if (S.t % FRONT_EVERY) return;
  const old = S.fronts || [], out = [], used = new Set(), P = WD.provs.length;
  for (const w of S.wars) for (const side of ['A', 'D']) {
    const mine = new Set(w[side]), foe = new Set(side === 'A' ? w.D : w.A), F = [];
    for (let p = 0; p < P; p++) if (mine.has(S.ctrl[p]) && WD.provs[p].adj.some(q => foe.has(S.ctrl[q]))) F.push(p);
    // um front por estado: as províncias da linha são agrupadas pelo estado a que pertencem
    const byState = new Map(); for (const p of F) { const st = WD.provs[p].state; if (!byState.has(st)) byState.set(st, []); byState.get(st).push(p); }
    for (const comp of byState.values()) {
      const fo = new Set(); for (const u of comp) for (const v of WD.provs[u].adj) if (foe.has(S.ctrl[v])) fo.add(v);
      const cs = new Set(comp); let best = null, bo = 0;              // mantém o id do front antigo que mais se parece com este
      for (const f of old) { if (f.w !== w.id || f.side !== side || used.has(f.id)) continue; let o = 0; for (const p of f.provs) if (cs.has(p)) o++; if (o > bo) { bo = o; best = f; } }
      const id = best ? best.id : S.id++; used.add(id);
      out.push({ id, w: w.id, side, st: WD.provs[comp[0]].state, provs: comp, foe: [...fo] });
    }
  }
  S.fronts = out;
  const live = new Set(out.map(f => f.id));
  for (const a of S.armies) if (a.front != null && !live.has(a.front)) a.front = null;
  for (const n of S.nations) if (S.ford && S.ford[n.id]) for (const k in S.ford[n.id]) if (!live.has(+k)) delete S.ford[n.id][k];
  aiCaution();
  if (S.t % (FRONT_EVERY * 2) === 0) { S._threat = null; playerArmies(); S.nations.forEach(n => { if (n.alive) frontOrders(n); }); }
}
const frontsOf = id => (S.fronts || []).filter(f => { const w = S.wars.find(x => x.id === f.w); return w && w[f.side].includes(id); });
const frontById = id => (S.fronts || []).find(f => f.id === id);
const fordOf = (o, fid) => ((S.ford || {})[o] || {})[fid] || 'hold';
function setFord(o, fid, v) { S.ford = S.ford || {}; (S.ford[o] = S.ford[o] || {})[fid] = v; }
function frontName(f) {                                       // o estado da linha
  if (f.st != null) return 'Front de ' + WD.states[f.st].n;
  const c = {}; f.provs.forEach(p => { const s = WD.provs[p].state; c[s] = (c[s] || 0) + 1; }); const s = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  return 'Front de ' + WD.states[s].n;
}
/* força inimiga perto de uma província (nela e nas vizinhas) */
function foeNear(o, p) { const m = enemyPower(o); let s = m.get(p) || 0; for (const q of WD.provs[p].adj) s += m.get(q) || 0; return s; }
/* força estimada de um exército (tipos, tecnologia, veterania, suprimento e cansaço) */
function armyPower(a) {
  const n = nat(a.o); let s = 0;
  for (const t of UT) if (a[t] > 0) s += a[t] * (unitStat(n, t, 'fire') + unitStat(n, t, 'shock') + unitStat(n, t, 'def')) / 3 * (n.up ? n.up[t] || 1 : 1);
  return s * vetOf(a).m * (.6 + .4 * (n.armySat ?? 1)) * (1 - .35 * (a.fat || 0)) * (.4 + .6 * a.mor) * genMul(a.gen) * (1 + (n.m ? n.m.army : 0));
}
/* força inimiga por província para um país (refeita a cada dia em que é pedida) */
let epC = null;
function enemyPower(o) {
  if (!epC || epC.t !== S.t) epC = { t: S.t, m: new Map() };
  let m = epC.m.get(o); if (m) return m; m = new Map();
  for (const b of S.armies) if (b.p < WD.provs.length && atWar(o, b.o)) m.set(b.p, (m.get(b.p) || 0) + armyPower(b));
  epC.m.set(o, m); return m;
}
const dangerFor = a => { const m = enemyPower(a.o), mine = armyPower(a) * .8, s = new Set(); m.forEach((v, p) => { if (v > mine) s.add(p); }); return s; };
const armyBusy = a => a.inBattle || a.retreat || a.exp || a.p >= WD.provs.length || a.inv || (S.battles && S.battles[a.p]);
const sieging = a => !a.path.length && S.sieges[a.p] && S.sieges[a.p].o === a.o;
/* executa as ordens dos fronts de um país */
function frontOrders(n) {
  for (const f of frontsOf(n.id)) {
    const list = S.armies.filter(a => a.o === n.id && a.front === f.id && !armyBusy(a));
    if (!list.length) continue;
    const ford = fordOf(n.id, f.id), act = a => STANCES[stanceOf(a)].act || ford;   // a postura manda: agressiva ataca, defensiva segura; equilibrada segue o front
    const advL = list.filter(a => act(a) === 'adv'), holdL = list.filter(a => act(a) !== 'adv');
    const rest0 = advL.length ? frontAdvance(n, f, advL) : []; const rest = advL.length ? [...(rest0 || advL), ...holdL] : null; if (rest && !rest.length) continue;
    // defender: maiores exércitos nos pontos mais ameaçados, um por ponto; ponto já ocupado pelo inimigo só com 1,3× de vantagem
    const ep = enemyPower(n.id), pts = f.provs.map(p => [p, WD.provs[p].adj.reduce((s, q) => s + (ep.get(q) || 0) * .3, 0) + (S.own[p] >= 0 && nat(S.own[p]).capital === p ? 5 : 0) + fortOf(p) + (ep.get(p) ? 20 : 0)]).sort((x, y) => y[1] - x[1]);
    for (const p of f.provs) for (const q of WD.provs[p].adj) if (ep.get(q) && friendsOf(n.id).has(S.ctrl[q]) && !pts.some(x => x[0] === q)) pts.push([q, 30 + ep.get(q)]);   // inimigo que avançou para dentro: a defesa vai abatê-lo
    pts.sort((x, y) => y[1] - x[1]);
    disperse(n, f, pts); const listD = S.armies.filter(a => a.o === n.id && a.front === f.id && !armyBusy(a));   // exércitos do jogador se espalham pela linha
    const free = (rest || listD).filter(a => !sieging(a) && (!rest || rest.includes(a) || !list.includes(a))).sort((x, y) => regs(y) - regs(x)), taken = new Set();
    for (const a of free) {
      const dst = a.path.length ? a.path[a.path.length - 1] : a.p, mine = armyPower(a);
      if ((ep.get(dst) || 0) > mine * .9 && dst !== a.p) a.path = [];                   // o destino virou armadilha: para
      else if (pts.some(([p]) => p === dst) && !taken.has(dst)) { taken.add(dst); continue; }
      const t = pts.find(([p]) => !taken.has(p) && (ep.get(p) || 0) * 1.3 < mine); if (!t) continue;
      taken.add(t[0]); if (a.p !== t[0]) orderArmy(a, t[0], true);
    }
  }
}
/* avançar: escolhe um alvo e mantém por um tempo; junta só as tropas necessárias (1,6× a defesa) numa província de apoio ao lado dele
   e ataca reunido. Devolve os exércitos que sobraram (ficam defendendo a linha) ou null se a força não basta. */
function frontAdvance(n, f, list) {
  const free = list.filter(a => !sieging(a)), pow = free.reduce((s, a) => s + armyPower(a), 0); if (!free.length) return [];
  n._ft = n._ft || {}; let T = n._ft[f.id];
  if (!T || !f.foe.includes(T.q) || S.t - T.t > 90 || !f.provs.includes(T.st)) {
    const cx = free.reduce((s, a) => s + WD.provs[a.p].cx, 0) / free.length, cy = free.reduce((s, a) => s + WD.provs[a.p].cy, 0) / free.length;
    let best = null, bs = -1e9;
    for (const q of f.foe) { const pr = WD.provs[q], st = WD.states[pr.state], def = foeNear(n.id, q); if (pow < def * 1.3) continue;
      const sc = (n.claims[pr.state] ? 6 : 0) + (S.own[q] >= 0 && nat(S.own[q]).capital === q ? 8 : 0) + (st.cap === q ? 3 : 0) - fortOf(q) * 2 - def * .3 - Math.hypot(pr.cx - cx, pr.cy - cy) * .15;
      if (sc > bs) { bs = sc; best = q; } }
    if (best == null) { delete n._ft[f.id]; return null; }
    const ep = enemyPower(n.id), stg = WD.provs[best].adj.filter(p => f.provs.includes(p)).sort((x, y) => (ep.get(x) || 0) - (ep.get(y) || 0) || WD.provs[x].adj.length - WD.provs[y].adj.length)[0];
    T = n._ft[f.id] = { q: best, st: stg, t: S.t };
  }
  const def = foeNear(n.id, T.q); if (pow < def * 1.2) { delete n._ft[f.id]; return null; }
  const at = free.filter(a => a.p === T.st && !a.path.length).sort((x, y) => armyPower(y) - armyPower(x)), pAt = at.reduce((s, a) => s + armyPower(a), 0);
  if (pAt >= def * 1.2) { let sent = 0; for (const a of at) { if (sent >= def * 1.5 + 1) break; orderArmy(a, T.q); sent += armyPower(a); } }   // ataque reunido
  // o grupo de ataque: quem já está no apoio ou indo para lá, completado pelos mais próximos até 1,6× a defesa
  const sp = WD.provs[T.st], dist = a => Math.hypot(WD.provs[a.p].cx - sp.cx, WD.provs[a.p].cy - sp.cy), going = a => a.p === T.st || a.p === T.q || (a.path.length && [T.st, T.q].includes(a.path[a.path.length - 1]));
  let got = free.filter(going).reduce((s, a) => s + armyPower(a), 0); const rest = [];
  for (const a of free.filter(a => !going(a)).sort((x, y) => dist(x) - dist(y))) { if (got >= def * 1.6 + 1) { rest.push(a); continue; } if (orderArmy(a, T.st, true)) got += armyPower(a); else rest.push(a); }
  return rest;
}
/* cautela da IA: quem marcha para uma província (ou passa por uma) onde o inimigo ficou mais forte que o grupo que está chegando, para */
function aiCaution() {
  const head = new Map();                                     // força a caminho de cada destino, por país
  for (const a of S.armies) if (a.o !== S.player && a.path.length && !a.retreat && !a.exp && a.p < WD.provs.length) { const k = a.o + ':' + a.path[a.path.length - 1]; head.set(k, (head.get(k) || 0) + armyPower(a)); }
  for (const a of S.armies) {
    if (a.o === S.player || !a.path.length || a.retreat || a.exp || a.inv || a.p >= WD.provs.length) continue;
    const ep = enemyPower(a.o), dst = a.path[a.path.length - 1], nx = a.path[0], mine = armyPower(a), grp = head.get(a.o + ':' + dst) || mine;
    if ((ep.get(dst) || 0) > grp * .9 || (nx !== dst && (ep.get(nx) || 0) > mine * .9)) { a.path = []; a.need = 0; a.prog = 0; }
  }
}
