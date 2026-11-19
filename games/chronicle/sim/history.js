/* Grand Chronicle — simulação: grandes acontecimentos da história em janelas de época.
   Invasões (INVASIONS) surgem como países novos com exército grande e IA agressiva por alguns anos (n.horde = ano do fim).
   Ondas e guerras do mundo (WORLD_EVENTS): revoluções liberais, Grande Guerra, Segunda Guerra Mundial e Guerra Fria.
   Tudo acontece no máximo uma vez (S.hist) e só se as condições aparecerem dentro da janela. */
'use strict';

function histTick() {
  S.hist = S.hist || {}; const y = curYear();
  for (const I of INVASIONS) { if (S.hist[I.id] || y < I.y[0] || y > I.y[1]) continue; if (chance(y >= I.y[1] - 1 ? .5 : 2 / ((I.y[1] - I.y[0]) * 12))) invade(I); }
  const W = WORLD_EVENTS;
  if (inWin(W.greatwar, y) && !S.hist.greatwar && chance(.04)) bigWar('greatwar');
  if (inWin(W.worldwar, y) && !S.hist.worldwar && S.hist.greatwar && y - S.hist.greatwar.y >= 15 && chance(.05)) bigWar('worldwar');
  if (inWin(W.coldwar, y) && !S.hist.coldwar && (!S.hist.worldwar || S.hist.worldwar.end)) coldWar();
  if (S.cold && (y > W.coldwar.y[1] || !nat(S.cold.a).alive || !nat(S.cold.b).alive)) { log('A Guerra Fria terminou.', 'world'); S.cold = null; }
  if (S.hist.worldwar && !S.hist.worldwar.end && !S.wars.some(w => w.id === S.hist.worldwar.w)) S.hist.worldwar.end = y;
  if (inWin(W.revolutions, y)) revolutionWave();
  for (const n of S.nations) if (n.alive && n.horde && y <= n.horde) {   // pilhagem: cada província própria ou ocupada rende ouro à horda
    let k = provsOf(n.id).length * .3; for (const w of warsOf(n.id)) k += sideProvs(foesIn(w, n.id)).filter(p => S.ctrl[p] === n.id).length * 3;
    const v = Math.min(k, 120) * 2 * eraScale(); n.money += v; if (n.inc) n.inc.plunder = v; }
  for (const n of S.nations) if (n.horde && y > n.horde) { n.horde = null; log(natName(n) + ' deixou de ser uma ameaça para o mundo.', 'world', [n.id]); }
}
const inWin = (W, y) => y >= W.y[0] && y <= W.y[1];

/* ---------- invasões ---------- */
function invade(I) {
  const main = WD.conts.find(c => c.main); let provs = [], target = null;
  if (I.from === 'edge') {                                     // ponta leste do continente principal: dois estados na borda
    const land = st => new Set(st.provs.flatMap(p => WD.provs[p].adj.map(q => WD.provs[q].state)).filter(x => x !== st.id)).size;   // estados vizinhos por terra
    const sts = WD.states.filter(s => s.cont === main.id && S.own[s.cap] >= 0 && land(s) >= 3).sort((a, b) => WD.provs[b.cap].cx - WD.provs[a.cap].cx);
    const s0 = sts[rint(Math.min(4, sts.length))]; if (!s0) return; const pick = new Set([s0.id]);
    while (pick.size < 4) { const nb = WD.states.find(s => s.cont === main.id && !pick.has(s.id) && S.own[s.cap] >= 0 && s.provs.some(p => WD.provs[p].adj.some(q => pick.has(WD.provs[q].state)))); if (!nb) break; pick.add(nb.id); }   // quatro estados vizinhos na borda
    pick.forEach(id => WD.states[id].provs.forEach(p => { if (S.own[p] >= 0) provs.push(p); }));
  } else {                                                      // costa do continente frio: um estado costeiro
    const sts = WD.states.filter(s => WD.conts[s.cont].cold && s.provs.some(p => WD.provs[p].coast) && S.own[s.cap] >= 0); const s0 = pickR(sts); if (!s0) return;
    s0.provs.forEach(p => { if (S.own[p] >= 0 && nat(S.own[p]).capital !== p) provs.push(p); });
  }
  if (!provs.length) return;
  const victims = [...new Set(provs.map(p => S.own[p]))];
  const n = spawnNation(provs, { cul: I.cul, gov: I.gov, ideo: 'warrior', relig: REL_IDS.indexOf(I.relig), name: I.n, money: 400, kind: I.from === 'cold' ? 'cold' : 'main' });
  const best = victims.map(nat).filter(v => v.alive).sort((a, b) => strength(b) - strength(a))[0]; if (best) { n.techs = Object.assign({}, best.techs); calcMods(n); }
  n.horde = curYear() + I.years; n.ruler.tr = ['ambitious', I.cav > .5 ? 'strategist' : 'brave', 'cruel']; n.ruler.st.mar = 18;
  if (I.ships) { const c = provs.filter(p => WD.provs[p].coast).sort((a, b) => S.pop[b] - S.pop[a])[0]; if (c != null) n.capital = c; }   // invasores do mar: base no litoral
  const pool = [...new Set([...neighbors(n), ...victims])].map(nat).filter(x => x.alive && x !== n), ref = pool.length ? pool.reduce((t, x) => t + strength(x), 0) / pool.length : 8;   // média dos vizinhos
  const regs0 = Math.round(clamp(ref * I.army, I.min || 10, (I.min || 10) * 2.5) * eraScale());
  const a = addArmy(n.id, n.capital, { inf: regs0 * (1 - I.cav), cav: regs0 * I.cav }, .6); a.gen = mkChar(n, { boost: 'mar', age: 40 }); a.gen.st.mar = 18; a.st = 'agg'; a.max = regs(a);
  if (I.ships && WD.provs[n.capital].coast) { n.techs.nav_longship = 1; calcMods(n); addFleet(n.id, WD.provs[n.capital].seas[0], Math.ceil(regs0 / shipCap(n)) + 4); }
  n.manpower = regs0; S.hist[I.id] = { y: curYear(), n: n.id };
  victims.forEach(v => { if (nat(v).alive) declareWar(n, nat(v), null, null); });
  if (I.from === 'cold') { const t = S.nations.filter(x => x.alive && x.kind === 'main' && provsOf(x.id).some(p => WD.provs[p].coast)).sort((x, y) => strength(x) - strength(y))[rint(5)]; if (t && !atWar(n.id, t.id)) declareWar(n, t, null, null); }
  log(I.e + ' ' + I.n + ' surgiu! ' + I.m, 'world', [n.id, ...victims]);
  notify(S.player, I.e + ' ' + I.n, I.m + ' (' + natName(n) + ', ' + Math.round(regs0) + 'k homens)');
}

/* ---------- revoluções: monarquias instáveis que conhecem o Iluminismo podem explodir ---------- */
function revolutionWave() {
  for (const n of S.nations) { if (!n.alive || GOVS[n.gov].cat !== 'Monarquia' || !hasT(n, 'soc_enlightenment') || n.stab > 40) continue;
    if (chance(.004 * (1 + (40 - n.stab) / 10))) { revolt(n, 'rev'); if (!S.hist.revolutions) { S.hist.revolutions = { y: curYear(), n: n.id }; log(WORLD_EVENTS.revolutions.e + ' ' + WORLD_EVENTS.revolutions.n + ': a revolução estourou em ' + natName(n) + '.', 'world', [n.id]); } } }
}

/* ---------- guerras do mundo: as duas maiores potências rivais arrastam os aliados ---------- */
function bigWar(id) {
  const W = WORLD_EVENTS[id], top = S.nations.filter(n => n.alive && n.senior == null).sort((a, b) => strength(b) - strength(a)).slice(0, 8);
  let pair = null;
  for (const a of top) for (const b of top) { if (a === b || atWar(a.id, b.id) || has(a, 'allies', b.id) || (a.rel[b.id] || 0) > 10) continue;
    const ag = (IDEOS[a.ideo].war || 1) + (a.ruler.tr.includes('ambitious') ? .5 : 0); if (!pair || ag + strength(a) / 1e4 > pair[2]) pair = [a, b, ag + strength(a) / 1e4]; }
  if (!pair) return; const [a, b] = pair;
  a.truce[b.id] = 0; const e = declareWar(a, b, null, null); if (e) return;
  const w = S.wars[S.wars.length - 1]; w.big = id;
  // as outras potências escolhem lado pela relação
  top.filter(x => x !== a && x !== b && !sideOf(w, x.id) && !x.truce[a.id] && !x.truce[b.id]).forEach(x => { const ra = x.rel[a.id] || 0, rb = x.rel[b.id] || 0; if (Math.abs(ra - rb) > 20 && x.id !== S.player) joinWar(w, x.id, ra > rb ? 'A' : 'D'); });
  S.hist[id] = { y: curYear(), w: w.id };
  log(W.e + ' ' + W.n + ': ' + natName(a) + ' contra ' + natName(b) + '. O mundo inteiro escolhe um lado.', 'world', [...w.A, ...w.D]);
  notify(S.player, W.e + ' ' + W.n, natName(a) + ' declarou guerra a ' + natName(b) + '. ' + (w.A.length + w.D.length) + ' países já estão em guerra.');
}
/* Guerra Fria: as duas maiores potências de ideologias diferentes não se atacam, mas correm em armas e ciência */
function coldWar() {
  const top = S.nations.filter(n => n.alive && n.senior == null).sort((a, b) => strength(b) - strength(a)).slice(0, 6);
  const a = top[0], b = top.slice(1).find(x => x.ideo !== a.ideo); if (!a || !b) return;
  S.cold = { a: a.id, b: b.id }; S.hist.coldwar = { y: curYear() };
  log(WORLD_EVENTS.coldwar.e + ' ' + WORLD_EVENTS.coldwar.n + ': ' + natName(a) + ' e ' + natName(b) + ' disputam o mundo sem guerra aberta.', 'world', [a.id, b.id]);
  notify(S.player, WORLD_EVENTS.coldwar.e + ' ' + WORLD_EVENTS.coldwar.n, natName(a) + ' e ' + natName(b) + ' dividem o mundo em blocos.');
}
const coldMods = n => S.cold && (S.cold.a === n.id || S.cold.b === n.id) ? [['Guerra Fria', { research: .08, army: .05, stab: .03 }]] : [];
const coldBlocked = (a, b) => S.cold && ((S.cold.a === a && S.cold.b === b) || (S.cold.a === b && S.cold.b === a));
