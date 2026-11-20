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
  // front que sumiu (estado tomado ou perdido): seus exércitos passam ao front mais perto da mesma guerra e lado
  const near = new Map(); for (const f of old) if (!live.has(f.id)) { const c = WD.provs[f.provs[0]], alt = out.filter(g => g.w === f.w && g.side === f.side).sort((x, y) => Math.hypot(WD.provs[x.provs[0]].cx - c.cx, WD.provs[x.provs[0]].cy - c.cy) - Math.hypot(WD.provs[y.provs[0]].cx - c.cx, WD.provs[y.provs[0]].cy - c.cy))[0]; near.set(f.id, alt ? alt.id : null); }
  for (const a of S.armies) if (a.front != null && !live.has(a.front)) a.front = near.get(a.front) ?? null;
  for (const n of S.nations) if (S.ford && S.ford[n.id]) for (const k in S.ford[n.id]) if (!live.has(+k)) delete S.ford[n.id][k];
  aiCaution();
  if (S.t % (FRONT_EVERY * 2) === 0) { S._threat = null; playerArmies(); }
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
