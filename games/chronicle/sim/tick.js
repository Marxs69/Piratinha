/* Grand Chronicle — simulação: agendador: fases do mês e do dia, estabilidade e reparo. */
'use strict';

/* ---------- mensal: fases em ordem fixa (a ordem faz parte das regras — mexer muda a partida) ---------- */
function researchTick(n) {
  const y = curYear();
  n.rp += researchRate(n);
  if (n.res && techState(n, TECH[n.res]) && techState(n, TECH[n.res]) !== '') n.res = null;
  if (n.res && n.rp >= techCost(n, TECH[n.res])) { const t = TECH[n.res]; n.rp -= techCost(n, t); n.res = null; finishTech(n, t); }
  n.rp = Math.min(n.rp, techBase(y) * 3);
}
function worksTick(n) {                                         // obras concluídas e recrutas prontos
  n.cons.forEach(c => c.m--); n.cons.filter(c => c.m <= 0).forEach(c => { if (stateOwnerOf(c.s) === n.id) { S.bld[c.s][c.b] = (S.bld[c.s][c.b] || 0) + 1; const f = BUILDINGS[c.b].fx; if (f && (f.infra || f.pipe)) S.mapDirty = true; if (n.id === S.player) log(BUILDINGS[c.b].n + ' concluída em ' + WD.states[c.s].n + '.', 'good', [n.id]); } }); n.cons = n.cons.filter(c => c.m > 0);
  n.rec.forEach(r => r.m--);
  n.rec.filter(r => r.m <= 0).forEach(r => {
    if (r.type === 'ship') { const pr = WD.provs[r.at]; if (S.own[r.at] === n.id) { const z = pr.seas[0], f = S.fleets.find(f => f.o === n.id && f.z === z && !f.path.length); if (f) f.ships += r.k; else addFleet(n.id, z, r.k); } return; }
    const at = S.own[r.at] === n.id && S.ctrl[r.at] === n.id ? r.at : n.capital; const ex = S.armies.find(a => a.o === n.id && a.p === at && !a.path.length);
    const x = r.x ?? .1;
    if (r.g != null && !S.armies.some(a => a.o === n.id && gid(a) === r.g)) { const b = addArmy(n.id, at, { [r.type]: r.k }, x); b.g = r.g; }   // primeira tropa de um exército novo
    else if (r.g != null) {   // comprada para um exército: entra nele (no destacamento que está lá ou num novo, que vai até ele)
      const G = S.armies.filter(a => a.o === n.id && gid(a) === r.g), here = G.find(a => a.p === at && !a.path.length);
      if (here) addMen(here, r.type, r.k, x); else { const b = addArmy(n.id, at, { [r.type]: r.k }, x); b.g = r.g; b.front = G[0].front; b.st = G[0].st; b.gen = G[0].gen; }
    } else if (ex) addMen(ex, r.type, r.k, x); else addArmy(n.id, at, { [r.type]: r.k }, x);
  });
  n.rec = n.rec.filter(r => r.m > 0);
}
function mpStabTick(n) {                                        // contingente, cansaço de guerra e estabilidade
  const mpMax = Math.max(0, (n.popT || 0) - (n.cls ? n.cls.slave : 0)) * .03 * (1 + n.m.manpower); n.mpMax = mpMax; n.manpower = Math.min(mpMax, n.manpower + (n.popT || 0) * .00025 * (1 + n.m.manpower));
  const war = warsOf(n.id).length; n.wex = war ? Math.min(30, n.wex + .4) : Math.max(0, n.wex - .6);
  const target = stabParts(n).reduce((a, x) => a + x[1], 0);
  n.stab = clamp(n.stab + clamp(target - n.stab, -2, 2), 0, 100);
}
function projTick(n) {                                          // reivindicações, prospecções e projetos espaciais
  if (n.fab && --n.fab.m <= 0) { n.claims[n.fab.s] = 1; if (n.id === S.player) log('Reivindicação sobre ' + WD.states[n.fab.s].n + ' fabricada.', 'good', [n.id]); n.fab = null; }
  (n.pros || []).forEach(x => x.m--); (n.pros || []).filter(x => x.m <= 0).forEach(x => prospectDone(n, x.s)); if (n.pros) n.pros = n.pros.filter(x => x.m > 0);
  if (n.sproj && --n.sproj.m <= 0) { const k = n.sproj.k; n.sproj = null; spaceDone(n, k); }
}
const aiTick = n => { if (n.id !== S.player) ai(n); };
const aliveEvents = n => { if (n.alive) eventsTick(n); };
/* por país vivo, todo mês */
const tidyNation = n => { n.stab = clamp(n.stab, 0, 100); n.pres = clamp(n.pres ?? 50, 0, 100); if (n.manpower < 0) n.manpower = 0; };   // limites depois de tudo o que mexeu no mês
const NATION_MONTH = [calcMods, researchTick, worksTick, mpStabTick, projTick, supportTick, slaveTick, unrestTick, pressTick, charMonthly, courtTick, tmodTick, aliveEvents, aiTick, tidyNation];

function nanGuard() { if (S.nations.some(n => n.alive && !Number.isFinite(n.money + n.stab + n.manpower + (n.income || 0)))) repairGame(false); }   // nunca deixa um −NaN se espalhar
function mineStates() { S._mine = S.nations.map(() => []); WD.states.forEach(st => { const o = S.own[st.cap]; if (o >= 0 && S.ctrl[st.cap] === o) S._mine[o].push(st); }); }
function nationsMonth() { S.nations.forEach(n => { if (!n.alive) return; for (const f of NATION_MONTH) f(n); }); }
function generalsDie() {
  for (const a of S.armies) if (a.gen && chance(deathChance(a.gen))) { if (a.o === S.player) log('O general ' + charName(a.gen) + ' morreu aos ' + ageOf(a.gen) + ' anos.', 'info', [a.o]); a.gen = null; }
  S._threat = null; strC = null; enterC = null;
}
function reinforce() {                                           // exércitos parados em casa voltam ao tamanho máximo usando o contingente
  for (const a of S.armies) {
    const n = nat(a.o), r = regs(a); a.max = Math.max(a.max || 0, r);
    if (a.path.length || a.inBattle || a.p >= WD.provs.length || S.own[a.p] !== a.o || S.ctrl[a.p] !== a.o || r >= a.max - .05 || n.manpower < .5) continue;
    const add = Math.min(n.manpower, (a.max - r) * .2), k = add / Math.max(.01, r), x0 = a.xp || 0; ['inf', 'cav', 'art', 'vrt'].forEach(t => a[t] += a[t] * k); a.xp = (x0 * r + recruitXp(n, a.p) * add) / (r + add); n.manpower -= add;
  }
}
function capitalOccupied() {
  S.nations.forEach(n => { if (n.alive && S.ctrl[n.capital] !== n.id && S.own[n.capital] === n.id) n.stab = Math.max(0, n.stab - 2); });   // capital ocupada
}
function popTick() {
  const y = curYear();
  S.nations.forEach(n => { n._fs = n.foodSat == null ? 1 : n.foodSat; n._gm = 1 + (n.m ? n.m.growth : 0); n._cap = (1 + (n.fx ? (n.fx.bo.farm || 0) : 0) + (y > 1800 ? (y - 1800) / 120 : 0)) * (1 + ((n.cov || {}).health || 0) * .2); });
  for (let p = 0; p < S.pop.length; p++) {
    const o = S.own[p], pr = WD.provs[p], fs = o >= 0 ? nat(o)._fs : 1, gm = o >= 0 ? nat(o)._gm : 1, capM = o >= 0 ? nat(o)._cap : 1;
    const cap = pr.size * TERRAIN[pr.terr].pop * 4 * capM + 3, base = (y < 1750 ? .00035 : y < 1950 ? .0008 : .0005) * gm;
    const g = fs >= .95 ? base * (1 - S.pop[p] / cap) : -.003 * (.95 - fs) / .95;
    S.pop[p] = Math.max(.3, S.pop[p] * (1 + g));
  }
}
function colonyTick() {
  S.cols.forEach(c => c.m--);
  S.cols.filter(c => c.m <= 0).forEach(c => { if (S.own[c.p] === -1 && nat(c.o).alive) { S.own[c.p] = c.o; S.ctrl[c.p] = c.o; S.pop[c.p] = Math.max(2, S.pop[c.p] * .5 + 1.5); ownChanged(); if (c.o === S.player) log('Nova colônia: ' + WD.provs[c.p].n + '.', 'good', [S.player]); } });
  S.cols = S.cols.filter(c => c.m > 0);
}
function warsTick() { S.wars.slice().forEach(w => { w.score = warScore(w); aiPeace(w); }); }
function yearTick() { if (S.t % 360 === 0) { relDrift(); religTick(); } }
function endCheck() { if (curYear() >= END_YEAR && !S.over) { S.over = 'end'; log('O ano ' + END_YEAR + ' chegou. A crônica termina.', 'world'); } }
/* o mundo, todo mês */
const WORLD_MONTH = [plagueTick, alienTick, nanGuard, econAll, reparationsTick, subjectsTick, faithTick, histTick, mineStates, nationsMonth, rebelTick, generalsDie, attritionTick, reinforce, capitalOccupied, popTick, colonyTick, warsTick, yearTick, endCheck];
function monthTick() { for (const f of WORLD_MONTH) f(); }

/* fatores da estabilidade (alvo para onde ela anda até 2 pontos por mês) */
const VOTE_W = { nobles: [.7, .2, .1], census: [.45, .35, .2], universal: [.25, .35, .4] };
function stabParts(n) {
  const cs = n.csat || {}, w = VOTE_W[n.laws.vote] || VOTE_W.nobles, g = k => cs[k] == null ? 1 : cs[k], ws = g('high') * w[0] + g('mid') * w[1] + g('low') * w[2], sl = slaveShare(n);
  const rebels = Object.values(S.rebels || {}).filter(r => r.o === n.id).length, ruler = demandsOf(n).filter(d => d.slot === 'ruler').length;
  return [['Base', 36], ['Governo, ideologia, leis e tecnologia', n.m.stab * 100], ['Comida', (n.foodSat - 1) * 60], ['Satisfação das classes (pelo peso do sufrágio)', (ws - .7) * 25], ['Cansaço de guerra', -n.wex],
    ['Templos', Math.min(10, (n.temples || 0)) * (n.laws.relig === 'secular' ? .5 : 1)], ['Segurança', ((n.cov || {}).sec || 0) * 12], ['Dívida', n.money < 0 ? -15 : 0], ['Acima do limite de domínio', -overCap(n) * 3],
    ['Escravos', -(sl * 50 + Math.max(0, sl - .15) * 150)], ['Minorias culturais e religiosas', -((n.minC || 0) + (n.minR || 0)) * 8], ['Vontades do governante não atendidas', -ruler * 2], ['Províncias rebeladas', -rebels * 1.5]].filter(x => Math.abs(x[1]) >= .5);
}

/* ---------- reparo (botão de debug e checagem mensal): números inválidos, caches, exércitos picados e travados ---------- */
function mergeIdle(id) {                                      // junta exércitos parados na mesma província
  const by = new Map(); let k = 0;
  S.armies.forEach(a => { if (a.o !== id || a.exp || a.path.length || a.inBattle || a.p >= WD.provs.length) return; const l = by.get(a.p); if (l) l.push(a); else by.set(a.p, [a]); });
  by.forEach(l => { if (l.length < 2) return; const m = l[0]; l.slice(1).forEach(a => { mergeInto(m, a); k++; }); });
  if (k) S.armies = S.armies.filter(a => regs(a) > .08); return k;
}
function repairGame(full) {
  let fixed = 0, merged = 0; const fin = (o, k, d) => { if (!Number.isFinite(o[k])) { o[k] = d; fixed++; } };
  GOOD_IDS.forEach(g => { if (!(S.wp[g] > 0)) { S.wp[g] = GOODS[g].p; fixed++; } });
  for (let p = 0; p < S.pop.length; p++) if (!Number.isFinite(S.pop[p]) || S.pop[p] < 0) { S.pop[p] = 1; fixed++; }
  S.nations.forEach(n => {
    ['money', 'manpower', 'rp', 'wex', 'press', 'slv', 'sf', 'income'].forEach(k => fin(n, k, 0)); fin(n, 'stab', 50);
    n.mk = n.mk || {}; ['sup', 'dem', 'sat', 'imp', 'exp'].forEach(k => { n.mk[k] = n.mk[k] || {}; for (const g in n.mk[k]) fin(n.mk[k], g, k === 'sat' ? 1 : 0); });
    n.cons = (n.cons || []).filter(c => BUILDINGS[c.b] && Number.isFinite(c.m)); n.rec = (n.rec || []).filter(r => Number.isFinite(r.k) && r.k > 0 && Number.isFinite(r.m));
  });
  S.armies.forEach(a => { ['inf', 'cav', 'art', 'vrt'].forEach(t => fin(a, t, 0)); fin(a, 'mor', 1); fin(a, 'prog', 0); fin(a, 'need', 0); if (a.path.some(v => !(v >= 0))) { a.path = []; fixed++; } });
  S.fleets.forEach(f => { fin(f, 'ships', 0); fin(f, 'prog', 0); });
  S.armies = S.armies.filter(a => regs(a) > .08); S.fleets = S.fleets.filter(f => f.ships > .2);
  if (full) S.nations.forEach(n => { if (n.alive && n.id !== S.player) { merged += mergeIdle(n.id); S.armies.forEach(a => { if (a.o === n.id && a.path.length && !a.exp && !a.retreat) { a.path = []; a.need = 0; a.prog = 0; } }); } });   // IA: replaneja os caminhos
  ownChanged(); warsChanged(); enterC = null; strC = null; nbC.clear(); S._threat = null; if (full) { S.stS = []; S.stD = []; }
  S.nations.forEach(n => { if (n.alive) calcMods(n); }); econAll(); S.nations.forEach(n => { if (n.alive) calcMods(n); }); S.mapDirty = true;
  return { fixed, merged };
}

/* ---------- avanço do tempo ---------- */
function advanceDay() {
  if (S.over) return;
  S.t++; dayTick(); invasionTick(); frontsTick();
  if (S.t % 30 === 0) monthTick();
}
function score(n) { return Math.round((n.popT || 0) / 100 + (n.gdp || 0) / 50 + techCount(n) * 5 + provsOf(n.id).length * 2); }
