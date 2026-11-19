/* Grand Chronicle — simulação: caminhos, movimento, batalhas, cercos, guerra e paz. */
'use strict';

/* ---------- caminhos (províncias 0..P-1, mares P..) ---------- */
let enterC = null;                                          // memória de canEnter por nação (refeita por mês, guerra ou mudança de dono)
function canEnter(o, p) { if (!enterC) enterC = new Map(); let a = enterC.get(o); if (!a) { a = new Int8Array(S.own.length).fill(-1); enterC.set(o, a); } if (a[p] < 0) a[p] = canEnter0(o, p) ? 1 : 0; return a[p] === 1; }
function canEnter0(o, p) { const ow = S.own[p], ct = S.ctrl[p]; return ow === o || ct === o || ow === -1 || atWar(o, ow) || atWar(o, ct); }
/* caminho de um exército: só por terra, mais travessias de um único mar livre de inimigos (barcos locais, FERRY_DAYS).
   Mais de um mar exige invasão com frota (planInvasion). Sem exército (consultas), usa as mesmas regras. */
function findPath(n, from, to, army) {
  const P = WD.provs.length; if (from >= P) return null;
  const dist = new Float32Array(P).fill(1e9), prev = new Int32Array(P).fill(-1), hp = new Heap(), fz = new Map();
  dist[from] = 0; hp.push(0, from);
  const speed = (1 + Math.max(-.5, n.m.speed || 0)) * (army ? armySpeed(army) : 1);
  const ferry = n.fx.sea >= 1;
  while (hp.size) {
    const u = hp.pop(); if (u === to) break; const du = dist[u];
    const relax = (v, c) => { if (du + c < dist[v]) { dist[v] = du + c; prev[v] = u; hp.push(du + c, v); } };
    const pr = WD.provs[u];
    for (const v of pr.adj) if (n.exP[v] && (v === to || canEnter(n.id, v))) relax(v, edgeDays(n, u, v) / speed);
    if (ferry && pr.coast) for (const z of pr.seas) { if (!fz.has(z)) fz.set(z, canFerry(n, z)); if (!fz.get(z)) continue;
      for (const v of WD.seas[z].provs) if (v !== u && n.exP[v] && !pr.adj.includes(v) && (v === to || canEnter(n.id, v))) relax(v, FERRY_DAYS); }
  }
  if (dist[to] >= 1e9) return null;
  const path = []; for (let v = to; v !== from; v = prev[v]) path.unshift(v); return path;
}
function edgeDays(n, a, b) {
  const pb = WD.provs[b], sp = S.own[b] === n.id && S.stSpd ? S.stSpd[pb.state] : 0;
  return 7 * TERRAIN[pb.terr].move / (1 + sp);
}
function nodeXY(v) { const P = WD.provs.length; if (v < P) { const p = WD.provs[v]; return [p.cx, p.cy]; } const z = WD.seas[v - P]; return [z.cx, z.cy]; }
/* mar navegável: raso sempre; oceano exige Caravela, mas com Barcos longos dá para costear o oceano que encosta em mar raso */
function seaOk(n, w) { const z = WD.seas[w]; if (!z.deep || n.fx.sea >= 2) return n.fx.sea >= 1; if (z.shore == null) z.shore = z.adj.some(x => !WD.seas[x].deep); return n.fx.sea >= 1 && z.shore; }
const seaExploreOk = n => hasT(n, 'nav_compass');            // navegar por clique até mares desconhecidos exige Bússola
function seaPath(n, from, to, blind) {                       // frotas: só por mar (blind: atravessa mares desconhecidos)
  const Z = WD.seas.length, dist = new Float32Array(Z).fill(1e9), prev = new Int32Array(Z).fill(-1), hp = new Heap(); dist[from] = 0; hp.push(0, from);
  while (hp.size) { const u = hp.pop(); if (u === to) break; for (const w of WD.seas[u].adj) { if (!(n.exZ[w] || w === to || blind) || !seaOk(n, w)) continue; const c = dist[u] + 5; if (c < dist[w]) { dist[w] = c; prev[w] = u; hp.push(c, w); } } }
  if (dist[to] >= 1e9) return null; const path = []; for (let v = to; v !== from; v = prev[v]) path.unshift(v); return path;
}
function orderArmy(a, to) { const n = nat(a.o); if (a.p === to) { a.path = []; return true; } const path = findPath(n, a.p, to, a); if (!path) return false; a.path = path; a.prog = 0; a.need = 0; a.retreat = false; return true; }
function orderFleet(f, z) { const n = nat(f.o); const path = seaPath(n, f.z, z) || (seaExploreOk(n) ? seaPath(n, f.z, z, true) : null); if (!path) return false; f.path = path; f.prog = 0; f.need = 0; return true; }
function explore(n, v) {
  const P = WD.provs.length;
  if (v < P) { n.exP[v] = 1; WD.provs[v].adj.forEach(o => n.exP[o] = 1); WD.provs[v].seas.forEach(z => n.exZ[z] = 1); }
  else { const z = WD.seas[v - P]; n.exZ[z.id] = 1; z.adj.forEach(w => n.exZ[w] = 1); z.provs.forEach(p => n.exP[p] = 1); }
  if (n.id === S.player) S.mapDirty = true;
}

/* ---------- diário: movimento, batalhas, cercos ---------- */
function dayTick() {
  const P = WD.provs.length;
  for (const a of S.armies) {
    if (a.exp && !a.path.length) exploreStep(a);
    if (a.exp && a.p < P && S.own[a.p] === -1 && S.pop[a.p] > 3) a.inf *= .9985;   // nativos e doenças: exploradores perdem gente
    if (!a.path.length) continue;
    const n = nat(a.o), next = a.path[0];
    if (!a.need) {
      if (a.p >= P || next >= P) { a.path = []; continue; }
      if (WD.provs[a.p].adj.includes(next)) a.need = edgeDays(n, a.p, next) / (1 + Math.max(-.5, n.m.speed || 0)) / armySpeed(a);
      else { const z = sharedSea(a.p, next); if (z == null || !canFerry(n, z)) { a.path = []; continue; } a.need = FERRY_DAYS * (a.sup && a.sup.eng ? .75 : 1); a.ferry = 1; }   // travessia: o mar precisa estar livre
      if (next < P && !a.retreat && !a.exp && !canEnter(a.o, next)) { a.path = []; a.need = 0; continue; }
    }
    a.prog += 1; a.fat = Math.min(1, (a.fat || 0) + .006 * (next < P ? TERRAIN[WD.provs[next].terr].move : 1));   // marchar cansa (mais em terreno difícil)
    if (a.prog >= a.need) { a.p = next; a.path.shift(); a.prog = 0; a.need = 0; a.arr = S.t; if (a.ferry) { a.ferry = 0; if (S.armies.some(b => b.p === next && atWar(a.o, b.o)) || atWar(a.o, S.ctrl[next])) a.amph = S.t + 15; } explore(n, a.p); if (!a.path.length) a.retreat = false; }
  }
  for (const f of S.fleets) {
    if (!f.path.length) { if (f.auto) autoExplore(f); continue; }
    f.prog += 1; if (f.prog >= 5 / (1 + (nat(f.o).m.speed || 0))) { f.z = f.path.shift(); f.prog = 0; explore(nat(f.o), P + f.z); if (WD.seas[f.z].deep && nat(f.o).fx.sea < 2) f.ships *= .98; }   // costeando o oceano sem Caravela: tempestades levam 2% por trecho
  }
  // agrupa por província
  const at = new Map(); for (const a of S.armies) { if (a.p >= P) continue; if (!at.has(a.p)) at.set(a.p, []); at.get(a.p).push(a); }
  at.forEach((list, p) => {
    const owners = [...new Set(list.map(a => a.o))];
    let fought = false;
    for (let i = 0; i < owners.length && !fought; i++) for (let j = i + 1; j < owners.length && !fought; j++) if (atWar(owners[i], owners[j])) {
      const ok = a => !a.retreat && !(a.sh > S.t) && !a.exp, x = owners[i], y = owners[j];      // cada lado junta todos os que estão contra o outro e não entre si
      const A = list.filter(a => ok(a) && !atWar(a.o, x) && atWar(a.o, y)), B = list.filter(a => ok(a) && !atWar(a.o, y) && atWar(a.o, x));
      if (A.length && B.length) { battleDay(p, A, B); fought = true; } }
    if (!fought) siegeAt(p, list);
  });
  // batalhas navais
  const zs = new Map(); for (const f of S.fleets) { if (!zs.has(f.z)) zs.set(f.z, []); zs.get(f.z).push(f); }
  zs.forEach(list => { if (list.length < 2) return; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (atWar(list[i].o, list[j].o) && list[i].ships > 0 && list[j].ships > 0) navalBattle(list[i], list[j]); });
  S.fleets = S.fleets.filter(f => f.ships > .2);
  for (const k in S.battles) if (S.battles[k].seen !== S.t) delete S.battles[k];   // batalha acabou sem vencedor (alguém saiu)
  // moral se recupera fora de combate (devagar se cansado; sem suprimento, quase nada e com teto); descanso tira o cansaço
  for (const a of S.armies) {
    if (a.inBattle) { a.inBattle = false; continue; }
    const home = a.p < P && friendsOf(a.o).has(S.ctrl[a.p]), sup = a.supOk !== false;
    a.mor = Math.min(sup ? 1 : .6, a.mor + (home ? .03 : .015) * (1 - .6 * (a.fat || 0)) * (sup ? 1 : .3));
    if (!a.path.length) a.fat = Math.max(0, (a.fat || 0) - (sup ? (home ? .02 : .01) : 0));
  }
  S.armies = S.armies.filter(a => regs(a) > .08);
}
/* marcha: o exército anda no passo do tipo mais lento que tiver */
function armySpeed(a) { const n = nat(a.o); let v = 9; UT.forEach(t => { if (a[t] > .05) v = Math.min(v, unitStat(n, t, 'spd')); }); return v === 9 ? 1 : v; }
function retreat(a) {
  const n = nat(a.o), P = WD.provs.length, seen = new Set([a.p]), q = [[a.p, []]];
  for (let h = 0; h < q.length && h < 400; h++) {
    const [v, path] = q[h];
    if (v !== a.p && v < P && S.own[v] === a.o && S.ctrl[v] === a.o && !S.armies.some(b => b.p === v && atWar(b.o, a.o))) { a.path = path; a.retreat = true; a.need = 0; a.prog = 0; a.sh = S.t + 30; return; }
    if (v < P) for (const o of WD.provs[v].adj) if (!seen.has(o) && n.exP[o] && (S.ctrl[o] === a.o || S.own[o] === a.o || S.own[o] === -1)) { seen.add(o); q.push([o, path.concat(o)]); }
  }
  a.inf = a.cav = a.art = a.vrt = 0;                         // cercado: o exército se rende
  if (a.o === S.player) log('Um exército seu foi cercado e se rendeu.', 'bad', [S.player]);
}

function siegeAt(p, list) {
  const ct = S.ctrl[p], own = S.own[p], reb = ct === -1 && own >= 0 && S.rebels ? S.rebels[p] : null;
  const besiegers = list.filter(a => !a.path.length && !a.exp && !(a.sh > S.t) && (atWar(a.o, ct) || (own === a.o && ct !== a.o && (reb || atWar(a.o, ct)))));
  if (!besiegers.length) { delete S.sieges[p]; return; }
  const o = besiegers[0].o, n = nat(o), sg = S.sieges[p] && S.sieges[p].o === o ? S.sieges[p] : (S.sieges[p] = { o, v: 0 });
  let force = 0; besiegers.filter(a => a.o === o).forEach(a => { force += (regs(a) + a.art * 3 * n.up.siege) * genMul(a.gen) * (a.sup && a.sup.eng ? 1.4 : 1); });
  const f = reb ? 0 : fortOf(p) + (ct >= 0 ? Math.floor(nat(ct).fx.fort / 2) * (fortOf(p) > 0 ? 1 : 0) : 0);
  sg.v += force / (95 * Math.pow(1 + f, 2)) / (reb ? Math.max(.5, reb.s / 4) : 1);   // conquista lenta: cada cerco leva meses
  if (reb) besiegers.forEach(a => { const k = Math.min(.012, reb.s * .0006); a.inf *= 1 - k; a.cav *= 1 - k; a.art *= 1 - k; a.vrt *= 1 - k; a.inBattle = true; });   // os rebeldes resistem
  if (sg.v >= 1) {
    delete S.sieges[p];
    if (reb) { delete S.rebels[p]; S.ctrl[p] = own; S.mapDirty = true; if (own === S.player) log('Rebeldes vencidos em ' + WD.provs[p].n + '.', 'good', [own]); return; }
    const liberate = own === o;
    S.ctrl[p] = liberate ? own : o; S.mapDirty = true;
    if (!liberate && own >= 0 && nat(own).capital === p) log('A capital de ' + natName(nat(own)) + ', ' + WD.provs[p].n + ', caiu diante de ' + natName(n) + '!', own === S.player ? 'bad' : 'world', [own, o]);
    if (o === S.player || own === S.player) log((liberate ? 'Libertamos ' : 'Cerco concluído: ') + WD.provs[p].n + (liberate ? '' : ' foi ocupada por ' + natName(n)) + '.', o === S.player ? 'good' : 'bad', [S.player]);
  }
}
function autoExplore(f) {                                    // vai ao mar de fronteira mais próximo (desconhecido, com costa ou vizinhos desconhecidos)
  const n = nat(f.o), Z = WD.seas.length, seen = new Uint8Array(Z), q = [f.z]; seen[f.z] = 1;
  const frontier = w => !n.exZ[w] || WD.seas[w].provs.some(p => !n.exP[p]) || WD.seas[w].adj.some(x => !n.exZ[x] && seaOk(n, x));
  for (let h = 0; h < q.length; h++) { const u = q[h]; for (const w of WD.seas[u].adj) { if (seen[w] || !seaOk(n, w)) continue; seen[w] = 1; if (frontier(w)) { const path = seaPath(n, f.z, w); if (path) { f.path = path; return; } } q.push(w); } }
  f.auto = false; if (f.o === S.player) log('Uma frota terminou de explorar o que conseguia alcançar' + (n.fx.sea < 2 ? '; para cruzar o oceano aberto, pesquise Caravela.' : '.'), 'info', [S.player]);
  if (n.fx.sea < 2) notify(f.o, '🧭 Exploração', 'A frota explorou tudo o que alcança costeando. O oceano aberto exige navegação oceânica (Caravela).');
}

/* ---------- guerra e paz (cada guerra tem dois lados: A ataca, D defende; a e d são os líderes) ---------- */
const sideOf = (w, id) => w.A.includes(id) ? 'A' : w.D.includes(id) ? 'D' : null;
function joinWar(w, id, side) {
  if (sideOf(w, id)) return; const other = side === 'A' ? w.D : w.A;
  if (other.some(x => !atWar(id, x) && (nat(id).allies || []).includes(x))) return;   // não entra contra um aliado
  (side === 'A' ? w.A : w.D).push(id); warsChanged();
  other.forEach(x => { nat(x).rel[id] = -100; nat(id).rel[x] = -100; breakTies(nat(id), nat(x)); });
  log(natName(nat(id)) + ' entrou na guerra ao lado de ' + natName(nat(side === 'A' ? w.a : w.d)) + '.', 'world', [id, w.a, w.d]);
}
function breakTies(a, b) { ['allies', 'trade', 'marr'].forEach(k => { a[k] = (a[k] || []).filter(x => x !== b.id); b[k] = (b[k] || []).filter(x => x !== a.id); }); }
function callAllies(w, side) {                                // aliados e parceiros juniores são chamados; o jogador decide numa janela
  const lead = nat(side === 'A' ? w.a : w.d), foe = side === 'A' ? w.d : w.a;
  const calls = new Set([...(lead.allies || []), ...S.nations.filter(j => j.alive && j.senior === lead.id).map(j => j.id)]);
  calls.forEach(id => {
    const al = nat(id); if (!al.alive || sideOf(w, id) || id === foe) return;
    if (al.senior === lead.id) { joinWar(w, id, side); return; }
    if (id === S.player) { S.calls = S.calls || []; S.calls.push({ w: w.id, side, from: lead.id }); return; }
    const p = (al.ruler.tr.includes('honest') ? 1 : side === 'D' ? .75 : .45) + (al.rel[lead.id] || 0) / 400 - (al.ruler.tr.includes('craven') ? .3 : 0);
    if (chance(p)) joinWar(w, id, side);
    else { breakTies(al, lead); al.rel[lead.id] -= 40; lead.rel[id] = (lead.rel[id] || 0) - 60; log(natName(al) + ' recusou o chamado de ' + natName(lead) + ' e a aliança acabou.', 'world', [id, lead.id]); }
  });
}
function answerCall(c, yes) {
  const w = S.wars.find(x => x.id === c.w), me = nat(S.player), lead = nat(c.from); if (!w) return;
  if (yes) joinWar(w, S.player, c.side);
  else { breakTies(me, lead); lead.rel[me.id] = (lead.rel[me.id] || 0) - 60; me.stab = Math.max(0, me.stab - 5); log('Você recusou o chamado de ' + natName(lead) + '. A aliança acabou.', 'bad', [S.player]); }
}
function declareWar(n, t, s) {
  if (atWar(n.id, t.id)) return 'Já em guerra'; if (n.truce[t.id] > S.t) return 'Trégua em vigor';
  if (n.senior != null) return 'Parceiro júnior de união não declara guerras';
  if ((n.allies || []).includes(t.id)) return 'Rompa a aliança antes';
  const claim = s != null && n.claims[s];
  const w = { id: S.id++, A: [n.id], D: [t.id], a: n.id, d: t.id, goal: s, start: S.t, loss: {}, bp: {}, score: 0 };
  S.wars.push(w); warsChanged();
  n.stab = Math.max(0, n.stab - (claim ? 3 : 15)); t.rel[n.id] = -100; n.rel[t.id] = -100; breakTies(n, t);
  log(natName(n) + ' declarou guerra a ' + natName(t) + '!', 'world', [n.id, t.id]);
  callAllies(w, 'D'); callAllies(w, 'A');
  return '';
}
const sideProvs = ids => { const out = []; ids.forEach(id => out.push(...provsOf(id))); return out; };
/* rendição: território ocupado, tropas perdidas e capital tomada (100% = capitula) */
function surrender(w, side) {
  const ids = side === 'A' ? w.A : w.D, foes = side === 'A' ? w.D : w.A; let tot = 0, occ = 0;
  for (const p of sideProvs(ids)) { const v = S.pop[p] + 1; tot += v; if (foes.includes(S.ctrl[p])) occ += v; }
  const lost = ids.reduce((a, id) => a + ((w.loss || {})[id] || 0), 0), now = S.armies.filter(a => ids.includes(a.o)).reduce((a, x) => a + regs(x), 0);
  const lead = nat(side === 'A' ? w.a : w.d), cap = lead.alive && foes.includes(S.ctrl[lead.capital]) ? .25 : 0;
  return clamp((tot ? occ / tot : 0) * .9 + (lost / (lost + now + 1)) * .45 + cap, 0, 1);
}
function warScore(w) { return Math.round((surrender(w, 'D') - surrender(w, 'A')) * 100); }   // positivo = lado atacante vencendo
/* pontos de cada participante: o que ocupou do lado inimigo e as batalhas que venceu */
function warPoints(w, id) {
  const foes = w.A.includes(id) ? w.D : w.A; let tot = 0, occ = 0;
  for (const p of sideProvs(foes)) { const v = S.pop[p] + 1; tot += v; if (S.ctrl[p] === id) occ += v; }
  return Math.round((tot ? occ / tot * 100 : 0) + ((w.bp || {})[id] || 0));
}
function provPrice(w, picker, p) {                            // custo em pontos de uma província do lado perdedor
  const owner = S.own[p], side = w.A.includes(picker) ? w.A : w.D, loserSide = side === w.A ? w.D : w.A; let tot = 0;
  for (const q of sideProvs(loserSide)) tot += S.pop[q] + 1;
  let c = Math.max(4, (S.pop[p] + 1) / tot * 140) * (side.includes(S.ctrl[p]) ? .7 : 1.4);
  if (nat(picker).claims[WD.provs[p].state]) c *= .5;
  if (owner >= 0 && nat(owner).capital === p) c *= 1.5;
  return Math.ceil(c);
}
function aiPicks(w, picker, budget, taken) {                  // a IA escolhe: reivindicações, vizinhas e ocupadas primeiro
  const n = nat(picker), loserSide = w.A.includes(picker) ? w.D : w.A, picks = [];
  const cands = sideProvs(loserSide).filter(p => !taken.has(p)).map(p => [p, (n.claims[WD.provs[p].state] ? 50 : 0) + (WD.provs[p].adj.some(o => S.own[o] === picker) ? 20 : 0) + (S.ctrl[p] === picker ? 30 : 0) + rnd() * 5]).sort((a, b) => b[1] - a[1]);
  for (const [p] of cands) { const c = provPrice(w, picker, p); if (c > budget) continue; if (statesOf(n, picks.concat(p)) > domCap(n) * 1.1 + 1) continue; picks.push(p); taken.add(p); budget -= c; }
  return picks;
}
function conference(w, winSide, playerPicks) {               // cada vencedor gasta os próprios pontos; o jogador escolhe à mão
  const ids = (winSide === 'A' ? w.A : w.D).slice().sort((a, b) => warPoints(w, b) - warPoints(w, a)), taken = new Set(playerPicks || []), deals = [];
  if (playerPicks) deals.push([S.player, playerPicks]);
  const capit = surrender(w, winSide === 'A' ? 'D' : 'A') >= 1 ? 1.25 : 1;
  ids.forEach(id => { if (id === S.player && playerPicks) return; if (id === S.player) return; deals.push([id, aiPicks(w, id, warPoints(w, id) * capit, taken)]); });
  return deals;
}
const peaceCost = (w, winner, provs) => provs.reduce((a, p) => a + provPrice(w, winner, p), 0);
function makePeace(w, winner, provs, money, deals) {
  const loser = winner == null ? null : (winner === w.a ? w.d : w.a), all = [...w.A, ...w.D];
  deals = deals || (provs && provs.length ? [[winner, provs]] : []);
  deals.forEach(([id, ps]) => ps.forEach(p => { S.own[p] = id; }));
  for (let p = 0; p < S.own.length; p++) { const o = S.own[p]; if (all.includes(o) && all.includes(S.ctrl[p])) S.ctrl[p] = o; }
  S.armies.forEach(a => { if (all.includes(a.o) && a.p < WD.provs.length && S.own[a.p] !== a.o && nat(a.o).alive) { a.p = nat(a.o).capital; a.path = []; } });
  if (money && loser != null) { const amt = Math.max(0, Math.min(nat(loser).money, money)); nat(loser).money -= amt; nat(winner).money += amt; }
  S.wars = S.wars.filter(x => x !== w); warsChanged();
  w.A.forEach(x => w.D.forEach(y => { nat(x).truce[y] = S.t + 360 * 5; nat(y).truce[x] = S.t + 360 * 5; }));
  deals.forEach(([id]) => { if (w.goal != null && nat(id).claims[w.goal] && WD.states[w.goal].provs.every(p => S.own[p] === id)) delete nat(id).claims[w.goal]; });
  ownChanged(); checkDead();
  const A = nat(w.a), D = nat(w.d), got = deals.filter(([, ps]) => ps.length).map(([id, ps]) => nat(id).name + ' +' + ps.length);
  const txt = winner == null ? 'Paz branca entre ' + natName(A) + ' e ' + natName(D) + '.' : natName(nat(winner)) + ' venceu a guerra contra ' + natName(nat(loser)) + (got.length ? ' (' + got.join(', ') + ' províncias)' : '') + '.';
  log(txt, all.includes(S.player) ? (winner != null && sideOf(w, S.player) === sideOf(w, winner) ? 'good' : winner == null ? 'info' : 'bad') : 'world', all);
}
function checkDead() {
  S.nations.forEach(n => {
    if (!n.alive) return;
    if (!provsOf(n.id).length) {
      n.alive = false; S.armies = S.armies.filter(a => a.o !== n.id); S.fleets = S.fleets.filter(f => f.o !== n.id); S.cols = S.cols.filter(c => c.o !== n.id);
      S.wars = S.wars.filter(w => w.a !== n.id && w.d !== n.id); S.wars.forEach(w => { w.A = w.A.filter(x => x !== n.id); w.D = w.D.filter(x => x !== n.id); }); warsChanged();
      S.nations.forEach(o => { breakTies(o, n); if (o.senior === n.id) delete o.senior; });
      log(natName(n) + ' deixou de existir.', 'world', [n.id]); if (n.id === S.player) S.over = 'dead';
    } else if (S.own[n.capital] !== n.id) { const ps = provsOf(n.id); n.capital = ps.reduce((a, b) => S.pop[a] >= S.pop[b] ? a : b); }
  });
}
function occupiedBy(w, winner) { const side = w.A.includes(winner) ? w.A : w.D; return sideProvs(side === w.A ? w.D : w.A).filter(p => side.includes(S.ctrl[p])); }
function aiPeace(w) {
  const sA = surrender(w, 'A'), sD = surrender(w, 'D'); w.score = Math.round((sD - sA) * 100);
  const months = (S.t - w.start) / 30, human = w.A.includes(S.player) || w.D.includes(S.player), pSide = sideOf(w, S.player);
  const loseSide = sD >= sA ? 'D' : 'A', winSide = loseSide === 'A' ? 'D' : 'A', sl = Math.max(sA, sD), winLead = winSide === 'A' ? w.a : w.d;
  if (sl >= 1 || (months >= 8 && sl >= .6 && chance(.12))) {           // capitulação ou derrota clara
    if (human && pSide === winSide && winLead === S.player) { if (!S.conf && sl >= 1) S.conf = { w: w.id }; return; }
    const deals = conference(w, winSide);
    if (human && pSide === loseSide && sl < 1) { if (!S.offer) S.offer = { w: w.id, winner: winLead, deals }; return; }
    if (human && pSide === loseSide) notify(S.player, '🏳️ Capitulação', 'Seu lado capitulou. Os vencedores tomaram ' + deals.reduce((a, d) => a + d[1].length, 0) + ' províncias.');
    makePeace(w, winLead, null, 0, deals); return;
  }
  if (months > 12 * 7 && sl < .3 && chance(.05)) { if (!human) makePeace(w, null, []); else if (!S.offer) S.offer = { w: w.id, winner: null, deals: [] }; }
}
function proposePeace(w, provs, money) {                     // jogador líder: impõe a paz com as províncias escolhidas (pontos) ou paz branca
  const me = S.player; if (w.a !== me && w.d !== me) return 'Só o líder da guerra negocia a paz';
  const mySide = sideOf(w, me), foeSur = surrender(w, mySide === 'A' ? 'D' : 'A'), mySur = surrender(w, mySide);
  if (!provs.length && !money) { if (mySur < .5 || (S.t - w.start) > 360 * 4) { makePeace(w, null, []); return ''; } return 'Recusada: eles acham que estão vencendo'; }
  if (foeSur < .5) return 'Eles só aceitam ceder terras com a rendição em 50% ou mais (está em ' + Math.round(foeSur * 100) + '%)';
  const budget = warPoints(w, me) * (foeSur >= 1 ? 1.25 : 1), c = peaceCost(w, me, provs) + (money ? 12 : 0);
  if (c > budget) return 'Faltam pontos: custa ' + c + ', você tem ' + Math.floor(budget);
  if (statesOf(nat(me), provs) > domCap(nat(me)) * 1.1 + 1) return 'Seu título não sustenta tantos estados (limite ' + domCap(nat(me)) + ')';
  makePeace(w, me, null, money, conference(w, mySide, provs)); return '';
}
function fabricate(n, s) { if (n.fab) return 'Já fabricando'; const c = Math.round(40 * eraScale()); if (n.money < c) return 'Sem dinheiro'; n.money -= c; n.fab = { s, m: 6 }; return ''; }
