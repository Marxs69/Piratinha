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
    const inF = new Set(F), seen = new Set();
    for (const p0 of F) {                                      // componentes: vizinhas na linha, ou de frente para a mesma província inimiga
      if (seen.has(p0)) continue; const comp = [], fo = new Set(), q = [p0]; seen.add(p0);
      for (let h = 0; h < q.length; h++) { const u = q[h]; comp.push(u);
        for (const v of WD.provs[u].adj) { if (foe.has(S.ctrl[v])) { fo.add(v); for (const x of WD.provs[v].adj) if (inF.has(x) && !seen.has(x)) { seen.add(x); q.push(x); } } else if (inF.has(v) && !seen.has(v)) { seen.add(v); q.push(v); } } }
      // mantém o id do front antigo que mais se parece com este
      let best = null, bo = 0; for (const f of old) { if (f.w !== w.id || f.side !== side || used.has(f.id)) continue; let o = 0; for (const p of f.provs) if (inF.has(p) && comp.includes(p)) o++; if (o > bo) { bo = o; best = f; } }
      const id = best ? best.id : S.id++; used.add(id);
      out.push({ id, w: w.id, side, provs: comp, foe: [...fo] });
    }
  }
  S.fronts = out;
  const live = new Set(out.map(f => f.id));
  for (const a of S.armies) if (a.front != null && !live.has(a.front)) a.front = null;
  for (const n of S.nations) if (S.ford && S.ford[n.id]) for (const k in S.ford[n.id]) if (!live.has(+k)) delete S.ford[n.id][k];
  if (S.t % (FRONT_EVERY * 2) === 0) { S._threat = null; S.nations.forEach(n => { if (n.alive) frontOrders(n); }); }
}
const frontsOf = id => (S.fronts || []).filter(f => { const w = S.wars.find(x => x.id === f.w); return w && w[f.side].includes(id); });
const frontById = id => (S.fronts || []).find(f => f.id === id);
const fordOf = (o, fid) => ((S.ford || {})[o] || {})[fid] || 'hold';
function setFord(o, fid, v) { S.ford = S.ford || {}; (S.ford[o] = S.ford[o] || {})[fid] = v; }
function frontName(f) {                                       // pelo estado que mais aparece na linha
  const c = {}; f.provs.forEach(p => { const s = WD.provs[p].state; c[s] = (c[s] || 0) + 1; }); const s = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  return 'Front de ' + WD.states[s].n;
}
/* força inimiga perto de uma província (nela e nas vizinhas) */
function foeNear(o, p) { let s = 0; const chk = q => { for (const b of threatAt(q)) if (atWar(o, b.o)) s += armyPower(b); }; chk(p); WD.provs[p].adj.forEach(chk); return s; }
/* força estimada de um exército (tipos, tecnologia, veterania, suprimento e cansaço) */
function armyPower(a) {
  const n = nat(a.o); let s = 0;
  for (const t of UT) if (a[t] > 0) s += a[t] * (unitStat(n, t, 'fire') + unitStat(n, t, 'shock') + unitStat(n, t, 'def')) / 3 * (n.up ? n.up[t] || 1 : 1);
  return s * vetOf(a).m * (.6 + .4 * (n.armySat ?? 1)) * (1 - .35 * (a.fat || 0)) * (.4 + .6 * a.mor) * genMul(a.gen) * (1 + (n.m ? n.m.army : 0));
}
const armyBusy = a => a.inBattle || a.retreat || a.exp || a.p >= WD.provs.length || a.inv || (S.battles && S.battles[a.p]);
const sieging = a => !a.path.length && S.sieges[a.p] && S.sieges[a.p].o === a.o;
/* executa as ordens dos fronts de um país */
function frontOrders(n) {
  for (const f of frontsOf(n.id)) {
    const list = S.armies.filter(a => a.o === n.id && a.front === f.id && !armyBusy(a));
    if (!list.length) continue;
    const ord = fordOf(n.id, f.id);
    if (ord === 'adv') {
      const free = list.filter(a => !sieging(a)), pow = free.reduce((s, a) => s + armyPower(a), 0);
      if (free.length) {
        const cen = free.map(a => WD.provs[a.p]), cx = cen.reduce((s, p) => s + p.cx, 0) / cen.length, cy = cen.reduce((s, p) => s + p.cy, 0) / cen.length;
        let best = null, bs = -1e9;
        for (const q of f.foe) { const pr = WD.provs[q], st = WD.states[pr.state], def = foeNear(n.id, q);
          const sc = (n.claims[pr.state] ? 6 : 0) + (S.own[q] >= 0 && nat(S.own[q]).capital === q ? 8 : 0) + (st.cap === q ? 3 : 0) - fortOf(q) * 2 - def * .6 - Math.hypot(pr.cx - cx, pr.cy - cy) * .15 + (pow > def * 1.3 ? 10 : -20);
          if (sc > bs) { bs = sc; best = q; } }
        if (best != null && pow > foeNear(n.id, best) * 1.2) { for (const a of free) if (a.p !== best && !(a.path.length && a.path[a.path.length - 1] === best)) orderArmy(a, best); continue; }
      }
    }
    // defender: maiores exércitos nos pontos mais ameaçados, um por ponto
    const pts = f.provs.map(p => [p, WD.provs[p].adj.reduce((s, q) => s + foeNear(n.id, q) * .3, 0) + (nat(S.own[p] >= 0 ? S.own[p] : n.id).capital === p ? 5 : 0) + fortOf(p)]).sort((x, y) => y[1] - x[1]);
    const free = list.filter(a => !sieging(a)).sort((x, y) => regs(y) - regs(x)), taken = new Set();
    for (const a of free) { if (pts.some(([p]) => p === a.p && !taken.has(p)) && (a.p === pts[0][0] || pts.findIndex(([p]) => p === a.p) < free.length)) { taken.add(a.p); continue; }
      const t = pts.find(([p]) => !taken.has(p)); if (!t) break; taken.add(t[0]); if (a.p !== t[0]) orderArmy(a, t[0]); }
  }
}
