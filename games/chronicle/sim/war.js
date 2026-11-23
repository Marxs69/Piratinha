/* Grand Chronicle — simulação: caminhos, movimento, batalhas, cercos, guerra e paz. */
'use strict';

/* ---------- caminhos (províncias 0..P-1, mares P..) ---------- */
let enterC = null;                                          // memória de canEnter por nação (refeita por mês, guerra ou mudança de dono)
function canEnter(o, p) { if (!enterC) enterC = new Map(); let a = enterC.get(o); if (!a) { a = new Int8Array(S.own.length).fill(-1); enterC.set(o, a); } if (a[p] < 0) a[p] = canEnter0(o, p) ? 1 : 0; return a[p] === 1; }
function canEnter0(o, p) { const ow = S.own[p], ct = S.ctrl[p]; return ow === o || ct === o || ow === -1 || atWar(o, ow) || atWar(o, ct); }
/* caminho de um exército: só por terra, mais travessias de um único mar livre de inimigos (barcos locais, FERRY_DAYS).
   Mais de um mar exige invasão com frota (planInvasion). Sem exército (consultas), usa as mesmas regras. */
function findPath(n, from, to, army, avoid) {
  const P = WD.provs.length; if (from >= P) return null;
  const dist = new Float32Array(P).fill(1e9), prev = new Int32Array(P).fill(-1), hp = new Heap(), fz = new Map();
  dist[from] = 0; hp.push(0, from);
  const speed = (1 + Math.max(-.5, n.m.speed || 0)) * (army ? armySpeed(army) : 1);
  const ferry = n.fx.sea >= 1;
  while (hp.size) {
    const u = hp.pop(); if (u === to) break; const du = dist[u];
    const relax = (v, c) => { if (du + c < dist[v]) { dist[v] = du + c; prev[v] = u; hp.push(du + c, v); } };
    const pr = WD.provs[u];
    for (const v of pr.adj) if (n.exP[v] && (v === to || canEnter(n.id, v)) && !(avoid && v !== to && avoid.has(v))) relax(v, edgeDays(n, u, v) / speed);
    if (ferry && pr.coast) for (const z of pr.seas) { if (!fz.has(z)) fz.set(z, canFerry(n, z)); if (!fz.get(z)) continue;
      for (const v of WD.seas[z].provs) if (v !== u && n.exP[v] && !pr.adj.includes(v) && (v === to || canEnter(n.id, v)) && !(avoid && v !== to && avoid.has(v))) relax(v, FERRY_DAYS); }
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
/* safe: desvia de províncias onde o inimigo é mais forte que este exército (a IA usa; o jogador decide sozinho) */
const orderArmyTest = (a, to) => a.p < WD.provs.length && !!findPath(nat(a.o), a.p, to, a);   // há caminho por terra (ou travessia curta)?
function orderArmy(a, to, safe) { const n = nat(a.o); if (a.p === to) { a.path = []; return true; } const path = findPath(n, a.p, to, a, safe ? dangerFor(a) : null); if (!path) return false; a.path = path; a.prog = 0; a.need = 0; a.retreat = false; return true; }
function orderFleet(f, z) { const n = nat(f.o); const path = seaPath(n, f.z, z) || (seaExploreOk(n) ? seaPath(n, f.z, z, true) : null); if (!path) return false; f.path = path; f.prog = 0; f.need = 0; return true; }
function explore(n, v) {
  const P = WD.provs.length;
  if (v < P) { n.exP[v] = 1; WD.provs[v].adj.forEach(o => n.exP[o] = 1); WD.provs[v].seas.forEach(z => n.exZ[z] = 1); }
  else { const z = WD.seas[v - P]; n.exZ[z.id] = 1; z.adj.forEach(w => n.exZ[w] = 1); z.provs.forEach(p => n.exP[p] = 1); }
  if (isHuman(n.id)) S.mapDirty = true;
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
  for (const k in S.battles) if (S.battles[k].seen !== S.t && !(S.battles[k].fb && S.battles[k].seen >= S.t - 1)) delete S.battles[k];   // batalhas de front continuam no dia seguinte   // batalha acabou sem vencedor (alguém saiu)
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
  if (isHuman(a.o)) log('Um exército seu foi cercado e se rendeu.', 'bad', [S.player]);
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
    if (reb) { delete S.rebels[p]; S.ctrl[p] = own; S.mapDirty = true; if (isHuman(own)) log('Rebeldes vencidos em ' + WD.provs[p].n + '.', 'good', [own]); return; }
    const liberate = own === o;
    S.ctrl[p] = liberate ? own : o; S.mapDirty = true;
    if (!liberate && own >= 0 && nat(own).capital === p) log('A capital de ' + natName(nat(own)) + ', ' + WD.provs[p].n + ', caiu diante de ' + natName(n) + '!', isHuman(own) ? 'bad' : 'world', [own, o]);
    if (isHuman(o) || isHuman(own)) log((liberate ? 'Libertamos ' : 'Cerco concluído: ') + WD.provs[p].n + (liberate ? '' : ' foi ocupada por ' + natName(n)) + '.', isHuman(o) ? 'good' : 'bad', [S.player]);
  }
}
function autoExplore(f) {                                    // vai ao mar de fronteira mais próximo (desconhecido, com costa ou vizinhos desconhecidos)
  const n = nat(f.o), Z = WD.seas.length, seen = new Uint8Array(Z), q = [f.z]; seen[f.z] = 1;
  const frontier = w => !n.exZ[w] || WD.seas[w].provs.some(p => !n.exP[p]) || WD.seas[w].adj.some(x => !n.exZ[x] && seaOk(n, x));
  for (let h = 0; h < q.length; h++) { const u = q[h]; for (const w of WD.seas[u].adj) { if (seen[w] || !seaOk(n, w)) continue; seen[w] = 1; if (frontier(w)) { const path = seaPath(n, f.z, w); if (path) { f.path = path; return; } } q.push(w); } }
  f.auto = false; if (isHuman(f.o)) log('Uma frota terminou de explorar o que conseguia alcançar' + (n.fx.sea < 2 ? '; para cruzar o oceano aberto, pesquise Caravela.' : '.'), 'info', [S.player]);
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
  const calls = new Set([...(lead.allies || []), ...subjectsOf(lead.id).map(j => j.id), ...(lead.senior != null ? [lead.senior] : [])]);   // súditos acompanham o suserano; o suserano defende o súdito
  calls.forEach(id => {
    const al = nat(id); if (!al.alive || sideOf(w, id) || id === foe) return;
    if (al.senior === lead.id && (!al.subj || SUBJECTS[al.subj.tier].war)) { joinWar(w, id, side); return; }
    if (lead.senior === id) { joinWar(w, id, side); return; }
    if (isHuman(id)) { S.calls = S.calls || []; S.calls.push({ w: w.id, side, from: lead.id, to: id }); return; }
    const p = (al.ruler.tr.includes('honest') ? 1 : side === 'D' ? .75 : .45) + (al.rel[lead.id] || 0) / 400 - (al.ruler.tr.includes('craven') ? .3 : 0);
    if (chance(p)) joinWar(w, id, side);
    else { breakTies(al, lead); noWarPact(al, lead, DIPLO.unally.noWar); al.stab = Math.max(0, al.stab - REFUSE_STAB); al.rel[lead.id] -= 40; lead.rel[id] = (lead.rel[id] || 0) - 60; log(natName(al) + ' recusou o chamado de ' + natName(lead) + ' e a aliança acabou.', 'world', [id, lead.id]); }
  });
}
function answerCall(c, yes) {
  const pid = c.to ?? S.player, w = S.wars.find(x => x.id === c.w), me = nat(pid), lead = nat(c.from); if (!w) return;
  if (yes) joinWar(w, pid, c.side);
  else { breakTies(me, lead); noWarPact(me, lead, DIPLO.unally.noWar); lead.rel[me.id] = (lead.rel[me.id] || 0) - 60; me.stab = Math.max(0, me.stab - REFUSE_STAB); log('Você recusou o chamado de ' + natName(lead) + '. A aliança acabou.', 'bad', [S.player]); }
}
function declareWar(n, t, s, cb) {                           // cb 'holy' = guerra santa (pouca perda de estabilidade)
  if (atWar(n.id, t.id)) return 'Já em guerra'; if (n.truce[t.id] > S.t) return 'Trégua em vigor';
  if (n.senior != null && !(n.subj && SUBJECTS[n.subj.tier].dip)) return 'Súdito sem diplomacia própria não declara guerras';
  if (t.id === n.senior || t.senior === n.id) return 'É seu suserano ou súdito';
  if ((n.allies || []).includes(t.id)) return 'Rompa a aliança antes';
  if (noWarUntil(n, t)) return 'Aliança rompida há pouco: guerra só a partir de ' + yearOf(noWarUntil(n, t));
  if (coldBlocked(n.id, t.id)) return 'Guerra Fria: as superpotências não se enfrentam diretamente';
  if (cb === 'holy') { const e = holyWhy(n, t); if (e) return e; }
  const claim = (s != null && n.claims[s]) || cb === 'holy' || cb === 'coal';   // coalizão contra quem tem EA alta também é casus belli
  const w = { id: S.id++, A: [n.id], D: [t.id], a: n.id, d: t.id, goal: s, start: S.t, loss: {}, bp: {}, score: 0, holy: cb === 'holy' ? n.relig : null };
  S.wars.push(w); warsChanged();
  n.stab = Math.max(0, n.stab - (claim ? 3 : 15)); t.rel[n.id] = -100; n.rel[t.id] = -100; breakTies(n, t);
  log(natName(n) + (cb === 'holy' ? ' declarou ' + holyName(n.relig).toLowerCase() + ' contra ' : ' declarou guerra a ') + natName(t) + '!', 'world', [n.id, t.id]);
  callAllies(w, 'D'); callAllies(w, 'A');
  coalCands(n, t).forEach(id => { if (sideOf(w, id)) return; if (isHuman(id)) { S.calls = S.calls || []; S.calls.push({ w: w.id, side: 'D', from: t.id, to: id }); } else joinWar(w, id, 'D'); });
  return '';
}
/* coalizão por conta própria (mundo/mês): contra um país com EA ≥ PEACE.coal, em paz, os vizinhos hostis (coalCands) que somam
   ≥ PEACE.coalPow × a força do bloco dele declaram juntos (PEACE.coalChance por mês). Líder = o mais forte; jogador não é arrastado. */
function coalitionTick() {
  for (const t of S.nations) {
    if (!t.alive || (t.ae || 0) < PEACE.coal || warsOf(t.id).length || t.horde) continue;
    const c = [...neighbors0(t)].filter(id => { const x = nat(id); return x && x.alive && !isHuman(id) && x.senior == null && (x.rel[t.id] || 0) <= PEACE.coalRel && !has(t, 'allies', id) && !warsOf(id).length && !(x.truce[t.id] > S.t) && !coldBlocked(id, t.id); });
    if (c.length < 2) continue;
    const pw = c.reduce((a, id) => a + milPower(nat(id)), 0); if (pw < blocPower(t, nat(c[0])) * PEACE.coalPow || !chance(PEACE.coalChance)) continue;
    const lead = nat(c.reduce((a, b) => milPower(nat(a)) >= milPower(nat(b)) ? a : b));
    if (declareWar(lead, t, null, 'coal')) continue;
    const w = S.wars[S.wars.length - 1]; c.forEach(id => { if (id !== lead.id && !sideOf(w, id)) joinWar(w, id, 'A'); });
    log('⚔️ Coalizão de ' + c.length + ' países contra ' + natName(t) + ', liderada por ' + natName(lead) + '.', 'world', [t.id, ...c]);
  }
}
/* coalizão: com expansão agressiva alta (PEACE.coal), os vizinhos que desconfiam do agressor (relação ≤ coalRel) defendem a vítima */
function coalCands(n, t) {
  if ((n.ae || 0) < PEACE.coal) return [];
  return [...neighbors0(n)].filter(id => { const x = nat(id); return x && x.alive && id !== t.id && x.senior == null && (x.rel[n.id] || 0) <= PEACE.coalRel && !has(n, 'allies', id) && !atWar(id, t.id) && !coldBlocked(id, n.id); });
}
const sideProvs = ids => { const out = []; ids.forEach(id => out.push(...provsOf(id))); return out; };
/* fim de participação: toda província ocupada por quem não está mais em guerra com o dono volta ao dono (rebeldes, −1, ficam) */
function fixCtrl() {
  let k = 0;
  for (let p = 0; p < S.own.length; p++) { const o = S.own[p], c = S.ctrl[p]; if (o < 0 || c < 0 || o === c || atWar(o, c)) continue; S.ctrl[p] = o; delete S.sieges[p]; k++; }
  if (k) ownChanged(); return k;
}
function checkDead() {
  S.nations.forEach(n => {
    if (!n.alive) return;
    if (!provsOf(n.id).length) {
      n.alive = false; S.armies = S.armies.filter(a => a.o !== n.id); S.fleets = S.fleets.filter(f => f.o !== n.id); S.cols = S.cols.filter(c => c.o !== n.id);
      S.wars = S.wars.filter(w => w.a !== n.id && w.d !== n.id); S.wars.forEach(w => { w.A = w.A.filter(x => x !== n.id); w.D = w.D.filter(x => x !== n.id); }); warsChanged(); fixCtrl(); S.fronts = (S.fronts || []).filter(f => S.wars.some(x => x.id === f.w));   // front sem guerra não fica
      S.nations.forEach(o => { breakTies(o, n); if (o.senior === n.id) { delete o.senior; delete o.subj; } }); if (n.senior != null) { delete n.senior; delete n.subj; }
      log(natName(n) + ' deixou de existir.', 'world', [n.id]); if (isHuman(n.id)) S.over = 'dead';
    } else if (S.own[n.capital] !== n.id) { const ps = provsOf(n.id); n.capital = ps.reduce((a, b) => S.pop[a] >= S.pop[b] ? a : b); }
  });
}
function fabricate(n, s) { if (n.fab) return 'Já fabricando'; const c = Math.round(80 * eraScale()); if (n.money < c) return 'Sem dinheiro'; n.money -= c; n.fab = { s, m: 12 }; return ''; }
