/* Grand Chronicle — simulação: controle do mar, travessias e invasões navais.
   Tropas de terra só cruzam o mar se ele estiver livre de navios inimigos:
   · um único mar entre duas costas: travessia com barcos locais (demora FERRY_DAYS);
   · mais de um mar: invasão com a frota do próprio país — o exército embarca num porto, a frota navega, enfrenta quem estiver no caminho
     ou no destino e desembarca. Se a frota perder a batalha, volta ao porto com o que sobrou. Cada navio leva poucos regimentos (shipCap). */
'use strict';

const FERRY_DAYS = 12;
const shipCap = n => SHIP_CAP + (n.fx ? n.fx.cap : 0);
const fleetCap = f => f.ships * shipCap(nat(f.o));
const carriedBy = f => S.armies.filter(a => a.fleet === f.id);
const carriedRegs = f => carriedBy(f).reduce((s, a) => s + regs(a), 0);
const transportCap = o => S.fleets.filter(f => f.o === o).reduce((s, f) => s + fleetCap(f), 0);
const zoneHostile = (o, z) => S.fleets.some(f => f.z === z && f.ships > .2 && atWar(o, f.o));
/* mar compartilhado por duas províncias costeiras (travessia) */
const sharedSea = (u, v) => WD.provs[u].seas.find(z => WD.provs[v].seas.includes(z));
const seaRoute = (n, a, b) => a === b ? [] : seaPath(n, a, b) || (seaExploreOk(n) ? seaPath(n, a, b, true) : null);   // com Bússola, atravessa mares ainda não vistos
const canFerry = (n, z) => n.fx.sea >= 1 && n.exZ[z] && seaOk(n, z) && !zoneHostile(n.id, z);

/* ---------- invasão naval: a.inv = { to, port, z0, z1, f, st, t } ---------- */
function planInvasion(n, a, to) {
  const P = WD.provs.length; if (a.p >= P || a.inv) return 'Já em operação';
  if (!n.fx.sea) return 'Exige Barcos longos';
  const tz = WD.provs[to].seas.filter(z => n.exZ[z] && seaOk(n, z)); if (!WD.provs[to].coast || !tz.length) return 'O destino não tem costa navegável';
  // porto de embarque: a costa própria mais perto que alcança o destino por mar
  const pa = WD.provs[a.p], ports = provsOf(n.id).filter(p => WD.provs[p].coast && S.ctrl[p] === n.id).sort((x, y) => Math.hypot(WD.provs[x].cx - pa.cx, WD.provs[x].cy - pa.cy) - Math.hypot(WD.provs[y].cx - pa.cx, WD.provs[y].cy - pa.cy)).slice(0, 8);
  let plan = null;
  for (const port of ports) { if (port !== a.p && !findPath(n, a.p, port, a)) continue;
    for (const z0 of WD.provs[port].seas) { if (!seaOk(n, z0)) continue; const z1 = tz.find(z => seaRoute(n, z0, z)); if (z1 != null) { plan = { port, z0, z1 }; break; } }
    if (plan) break; }
  if (!plan) return 'Nenhum porto alcança o destino por mar';
  // frota: a mais perto com capacidade; as outras se juntam a ela
  const need = regs(a), mine = S.fleets.filter(f => f.o === n.id && !f.inv && !carriedBy(f).length && seaRoute(n, f.z, plan.z0));
  const cap = mine.reduce((s, f) => s + fleetCap(f), 0);
  if (cap < need) return 'Navios insuficientes: capacidade ' + Math.floor(cap) + ' de ' + Math.ceil(need) + ' regimentos';
  mine.sort((x, y) => seaRoute(n, x.z, plan.z0).length - seaRoute(n, y.z, plan.z0).length);
  const use = []; let c = 0; for (const f of mine) { if (c >= need) break; use.push(f); c += fleetCap(f); }
  use.forEach(f => { f.inv = a.id; f.auto = false; if (f.z !== plan.z0) orderFleet(f, plan.z0); else f.path = []; });
  a.inv = Object.assign(plan, { to, f: use[0].id, fl: use.map(f => f.id), st: 'go', t: S.t + 360 });
  if (a.p !== plan.port) orderArmy(a, plan.port); else a.path = [];
  a.front = null; return '';
}
function cancelInvasion(a, why) {
  const I = a.inv; if (!I) return; S.fleets.forEach(f => { if (f.inv === a.id) f.inv = null; }); a.inv = null;
  if (a.p >= WD.provs.length) { a.p = I.port; a.fleet = null; }
  if (a.o === S.player && why) log('Invasão cancelada: ' + why + '.', 'bad', [S.player]);
}
function invasionTick() {
  const P = WD.provs.length;
  for (const a of S.armies) {
    const I = a.inv; if (!I) continue; const n = nat(a.o), f = S.fleets.find(x => x.id === I.f);
    if (!f || f.ships < .2) { cancelInvasion(a, 'a frota se perdeu'); continue; }
    if (I.st === 'go') {
      if (S.t > I.t) { cancelInvasion(a, 'demorou demais para embarcar'); continue; }
      const here = I.fl.map(id => S.fleets.find(x => x.id === id)).filter(x => x && x.z === I.z0 && !x.path.length);
      if (a.p === I.port && !a.path.length && here.length) {
        here.filter(x => x !== f).forEach(x => { if (f.z === x.z) { f.ships += x.ships; x.ships = 0; } });   // as frotas se juntam
        if (f.z !== I.z0) continue;
        if (fleetCap(f) < regs(a) * .95) { cancelInvasion(a, 'navios insuficientes'); continue; }
        a.p = P + I.z0; a.fleet = f.id; a.path = []; I.st = 'sail'; if (I.z1 !== I.z0) orderFleet(f, I.z1);
        if (a.o === S.player) log('O exército embarcou em ' + WD.provs[I.port].n + '.', 'info', [S.player]);
      } else if (!a.path.length && a.p !== I.port && !orderArmy(a, I.port)) cancelInvasion(a, 'o porto ficou inalcançável');
      continue;
    }
    a.p = P + f.z;                                            // embarcado: anda com a frota
    if (I.st === 'sail' && f.z === I.z1 && !f.path.length && !zoneHostile(a.o, f.z)) {
      const def = S.armies.some(b => b.p === I.to && atWar(a.o, b.o));
      if (a.o !== S.player && enemyPower(a.o).get(I.to) > armyPower(a) * .8) { I.st = 'back'; orderFleet(f, I.z0); continue; }   // a IA não desembarca em cima de um exército mais forte
      I.st = 'land'; I.t = S.t + Math.round((7 + (def ? 7 : 0)) * (a.sup && a.sup.eng ? .5 : 1));
    }
    if (I.st === 'land' && S.t >= I.t) {
      if (!canEnter(a.o, I.to)) { I.st = 'back'; orderFleet(f, I.z0); continue; }
      a.p = I.to; a.fleet = null; a.inv = null; a.arr = S.t; a.amph = S.t + 15; explore(n, a.p);
      S.fleets.forEach(x => { if (x.inv === a.id) x.inv = null; });
      if (a.o === S.player) log('Desembarque em ' + WD.provs[I.to].n + '.', 'good', [S.player]);
      else if (S.own[I.to] === S.player) log(natName(n) + ' desembarcou tropas em ' + WD.provs[I.to].n + '!', 'bad', [S.player]);
    }
    if (I.st === 'back' && f.z === I.z0 && !f.path.length) {
      const port = S.ctrl[I.port] === a.o ? I.port : WD.seas[I.z0].provs.find(p => S.ctrl[p] === a.o);
      if (port == null) { UT.forEach(t => a[t] = 0); if (a.o === S.player) log('Sem porto amigo: o exército a bordo se perdeu.', 'bad', [S.player]); continue; }
      a.p = port; a.fleet = null; a.inv = null; S.fleets.forEach(x => { if (x.inv === a.id) x.inv = null; });
      if (a.o === S.player) log('A frota trouxe o exército de volta a ' + WD.provs[port].n + '.', 'bad', [S.player]);
    }
  }
}
/* batalha naval (por dia): navios afundados levam junto as tropas que não cabem mais; quem fica bem atrás recua */
function navalBattle(f, g) {
  const Df = navDoc(nat(f.o)), Dg = navDoc(nat(g.o));   // doutrinas navais (NAV_DOCS)
  const pf = f.ships * nat(f.o).fx.ship * Df.dmg, pg = g.ships * nat(g.o).fx.ship * Dg.dmg, f0 = f.ships, g0 = g.ships;
  f.ships = Math.max(0, f.ships - pg * .04 * Df.take * rand(.7, 1.3)); g.ships = Math.max(0, g.ships - pf * .04 * Dg.take * rand(.7, 1.3));
  for (const [x, D] of [[f, Df], [g, Dg]]) { const c = carriedRegs(x), cap = fleetCap(x); if (c > cap && c > 0) { const k = (1 - cap / c) * D.cargo; carriedBy(x).forEach(a => UT.forEach(t => a[t] *= 1 - k)); } }
  const fp = f.ships * nat(f.o).fx.ship, gp = g.ships * nat(g.o).fx.ship;
  for (const [x, xp, yp, D] of [[f, fp, gp, Df], [g, gp, fp, Dg]]) if (x.ships > .2 && xp < yp * D.ret) fleetRetreat(x);
  if ((f.o === S.player || g.o === S.player) && (f0 - f.ships > .5 || g0 - g.ships > .5) && !(f.nb > S.t)) { f.nb = S.t + 30; log('Batalha naval em ' + WD.seas[f.z].n + '.', 'info', [S.player]); }
  const H = S.navHist = S.navHist || [], L = H.find(x => x.z === f.z && S.t - x.t < 30 && ((x.a === f.o && x.b === g.o) || (x.a === g.o && x.b === f.o)));   // a mesma batalha (dias seguidos) acumula
  if (L) { const sw = L.a !== f.o; L.la += sw ? g0 - g.ships : f0 - f.ships; L.lb += sw ? f0 - f.ships : g0 - g.ships; L.t = S.t; } else { H.unshift({ z: f.z, a: f.o, b: g.o, la: f0 - f.ships, lb: g0 - g.ships, t: S.t, t0: S.t }); if (H.length > 30) H.pop(); }
}
function fleetRetreat(x) {
  const inv = S.armies.find(a => a.inv && a.fleet === x.id);
  if (inv) { inv.inv.st = 'back'; orderFleet(x, inv.inv.z0); if (inv.o === S.player) log('A frota de invasão perdeu e está voltando com as tropas.', 'bad', [S.player]); return; }
  const n = nat(x.o), safe = WD.seas[x.z].adj.find(w => seaOk(n, w) && !zoneHostile(x.o, w)); if (safe != null) { x.path = [safe]; x.prog = 0; }
}
