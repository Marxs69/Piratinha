/* Grand Chronicle — simulação: exércitos do jogador como unidades.
   Um exército (grupo, a.g) pode estar espalhado em vários destacamentos pelo front, mas segue sendo um só: mesmo general, postura, apoio e front.
   O jogador não move exércitos: no front eles se dispersam pelos pontos ameaçados, avançam e atacam sozinhos (ordem do front);
   sem front, combatem rebeldes no próprio território e, em paz, voltam a se reunir. Dividir cria uma nova unidade (outro grupo). */
'use strict';

const DET_MIN = 4;                                            // regimentos mínimos por destacamento
const gid = a => a.g ?? a.id;
const groupOf = a => armiesOf(a.o).filter(x => gid(x) === gid(a));
const groupsOf = id => { const m = new Map(); for (const a of armiesOf(id)) { const k = gid(a); if (!m.has(k)) m.set(k, []); m.get(k).push(a); } return [...m.values()]; };
/* destacamento: divide um membro do grupo levando parte dos regimentos (mesmo general, postura, apoio e front) */
function detach(a, k = .5) { const b = splitArmy(a, k); b.g = gid(a); b.gen = a.gen; b.sup = Object.assign({}, a.sup); b.drill = a.drill; return b; }
/* nova unidade: metade dos destacamentos (os mais perto do front escolhido) ou metade dos regimentos, sem general */
function splitGroup(a, fid) {
  const G = groupOf(a).filter(x => !x.inv), ng = S.id++, f = fid != null ? frontById(fid) : null; if (!G.length) return null;
  if (G.length > 1) {
    const dist = x => f ? Math.min(...f.provs.map(p => Math.hypot(WD.provs[p].cx - WD.provs[x.p < WD.provs.length ? x.p : 0].cx, WD.provs[p].cy - WD.provs[x.p < WD.provs.length ? x.p : 0].cy))) : 0;
    G.sort((x, y) => dist(x) - dist(y)).slice(0, Math.floor(G.length / 2)).forEach(x => { x.g = ng; x.front = fid ?? null; x.gen = null; x.path = []; });
  } else { const b = splitArmy(G[0], .5); b.g = ng; b.front = fid ?? null; b.gen = null; b.sup = {}; }
  return ng;
}
function joinGroups(a, b) { const k = gid(a); groupOf(b).forEach(x => { x.g = k; x.front = a.front; x.st = a.st; x.gen = x.gen || a.gen; }); }
const setGroupFront = (a, fid) => groupOf(a).forEach(x => { x.front = fid; x.path = []; });
/* destacamentos do mesmo grupo parados na mesma província, ou já na linha do mesmo front, voltam a ser um só (no maior) */
function mergeGroupParts(id) {
  const by = new Map(); for (const a of armiesOf(id)) { if (a.g == null || a.path.length || a.inBattle || a.inv || a.exp || a.p >= WD.provs.length || a.fbd === S.t) continue; const k = a.g + ':' + (a.front != null && a.fp === a.front ? 'f' + a.front : a.p); if (!by.has(k)) by.set(k, []); by.get(k).push(a); }
  let any = false; by.forEach(l => { if (l.length < 2) return; l.sort((x, y) => regs(y) - regs(x)); l.slice(1).forEach(b => mergeInto(l[0], b)); any = true; });
  if (any) S.armies = S.armies.filter(a => regs(a) > .08);
}
/* exércitos do jogador fora dos fronts: entram sozinhos no front mais ameaçado; sem guerra, vão atrás de rebeldes e se reagrupam */
function playerArmies() { for (const id of humans()) humanArmies(nat(id)); }
function humanArmies(n) {
  if (!n || !n.alive) return;
  for (const a of armiesOf(n.id)) if (a.g == null) a.g = a.id;
  const fs = frontsOf(n.id), groups = groupsOf(n.id).filter(G => !G.some(a => a.exp || a.inv));
  if (fs.length) { const need = f => f.foe.reduce((s, q) => s + foeNear(n.id, q), 0);
    for (const G of groups) if (G[0].front == null || !fs.some(f => f.id === G[0].front)) {   // agressivos vão ao front mais próximo; os demais ao mais ameaçado
      const h = G[0], o = WD.provs[h.p < WD.provs.length ? h.p : n.capital], d = f => Math.min(...f.provs.map(p => Math.hypot(WD.provs[p].cx - o.cx, WD.provs[p].cy - o.cy))), ok = fs.filter(f => !frontBlocked(h, f));
      if (!ok.length) continue;
      const f = stanceOf(h) === 'agg' ? ok.sort((x, y) => d(x) - d(y))[0] : ok.sort((x, y) => need(y) - need(x))[0]; G.forEach(a => { a.front = f.id; a.path = []; }); } }
  else {
    const reb = Object.keys(S.rebels || {}).map(Number).filter(p => S.own[p] === n.id);
    for (const G of groups) { G.forEach(a => a.front = null); const lead = G.slice().sort((x, y) => regs(y) - regs(x))[0]; if (armyBusy(lead)) continue;
      if (reb.length) { const o = WD.provs[lead.p], t = reb.slice().sort((x, y) => Math.hypot(WD.provs[x].cx - o.cx, WD.provs[x].cy - o.cy) - Math.hypot(WD.provs[y].cx - o.cx, WD.provs[y].cy - o.cy))[0]; G.forEach(a => { if (!a.path.length && a.p !== t) orderArmy(a, t, true); }); }
      else G.forEach(a => { if (a !== lead && !a.path.length && a.p !== lead.p && !armyBusy(a)) orderArmy(a, lead.p, true); });   // em paz, os destacamentos voltam a se juntar
    }
  }
  mergeGroupParts(n.id);
}

/* volta para casa: marcha (por qualquer terra conhecida, sem combater) até o estado próprio mais perto ou até a capital */
function goHome(a, toCapital) {
  const n = nat(a.o), P = WD.provs.length; if (a.p >= P) return 'Embarcado';
  const ok = p => S.own[p] === a.o && S.ctrl[p] === a.o && (!toCapital || p === n.capital);
  const seen = new Map([[a.p, -1]]), q = [a.p]; let end = ok(a.p) ? a.p : null;
  for (let h = 0; h < q.length && end == null; h++) { const u = q[h]; for (const v of WD.provs[u].adj) { if (seen.has(v) || !n.exP[v]) continue; seen.set(v, u); if (ok(v)) { end = v; break; } q.push(v); } }
  if (end == null) { a.p = n.capital; a.path = []; return ''; }      // sem caminho por terra: volta pelo mar
  const path = []; for (let v = end; v !== a.p && v !== -1; v = seen.get(v)) path.unshift(v);
  a.path = path; a.need = 0; a.prog = 0; a.retreat = true; a.sh = S.t + path.length * 15; a.front = null; return '';
}
const goHomeGroup = (a, toCapital) => groupOf(a).forEach(x => goHome(x, toCapital));
/* nome do exército: o do general; sem general, "Tropa N" pela ordem de criação */
function armyName(a) { const G = groupOf(a), g = G.map(x => x.gen).find(Boolean); if (g) return charName(g); const ids = groupsOf(a.o).map(G => gid(G[0])).sort((x, y) => x - y); return 'Tropa ' + (ids.indexOf(gid(a)) + 1); }
