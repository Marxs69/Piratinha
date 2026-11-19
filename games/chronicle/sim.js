/* Grand Chronicle — simulação (sem DOM). Calendário de 360 dias (12 meses de 30).
   Diário: movimento, batalhas e cercos. Mensal: economia, pesquisa, obras, recrutamento, estabilidade, personagens, golpes, guerras, colonização e IA.
   O mundo (mapa) vem de generateWorld(seed); o estado dinâmico fica em S e é salvo. */
'use strict';

let WD = null, S = null;                                    // mundo e estado
const ECON = { costMul: 3, taxBase: .06, upkeep: .25 };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const rand = (a, b) => a + Math.random() * (b - a);
const chance = p => Math.random() < p;
const pickR = a => a[Math.random() * a.length | 0];
const yearOf = t => START_YEAR + Math.floor(t / 360);
const curYear = () => yearOf(S.t);
const eraScale = () => 1 + (curYear() - 860) / 300;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dateStr = (t = S.t) => (t % 30 + 1) + ' ' + MONTHS[Math.floor(t % 360 / 30)] + ' ' + yearOf(t);
const nat = id => S.nations[id];
const natName = n => (GOVS[n.gov].fmt || '{}').replace('{}', n.name);
const FEM = { 'Rei': 'Rainha', 'Rei eleito': 'Rainha eleita', 'Imperador': 'Imperatriz', 'Chefe supremo': 'Chefe suprema', 'Sumo-sacerdote': 'Suma-sacerdotisa', 'Grão-mestre': 'Grã-mestra', 'Caudilho': 'Caudilha', 'Diretor técnico': 'Diretora técnica', 'Secretário-geral': 'Secretária-geral', 'Arquissábio': 'Arquissábia', 'Delegado': 'Delegada', 'Presidente do congresso': 'Presidenta do congresso', 'Mediador': 'Mediadora', 'Líder supremo': 'Líder suprema', 'Cônsul': 'Cônsul', 'Doge': 'Dogaresa', 'Cã': 'Cátum' };
const titleOf = (n, c = n.ruler) => { const t = GOVS[n.gov].t; return c && c.f ? (FEM[t] || t) : t; };
const log = (m, k = 'info', who = []) => { S.log.unshift({ d: dateStr(), m, k }); if (S.log.length > 120) S.log.pop(); if (who.includes(S.player) || k === 'world') S.news.push({ m, k }); };

/* ---------- personagens ---------- */
function mkChar(n, o = {}) {
  const cul = CULTURES[n.cul], f = o.f != null ? o.f : (o.ruler && !chance(.08) ? false : chance(.5));
  const age = o.age != null ? o.age : (o.ruler ? 18 + (Math.random() * 35 | 0) : 20 + (Math.random() * 40 | 0));
  const st = {}; ['dip', 'mar', 'adm', 'int', 'lea'].forEach(k => st[k] = Math.round(clamp(rand(2, 14) + (o.boost === k ? 5 : 0), 0, 20)));
  const tids = Object.keys(TRAITS), tr = []; while (tr.length < 2 + (chance(.4) ? 1 : 0)) { const t = pickR(tids); if (!tr.includes(t)) tr.push(t); }
  return { n: pickR(f ? cul.f : cul.m), dyn: o.dyn || n.dyn, f, born: curYear() - age, st, tr };
}
const ageOf = c => curYear() - c.born;
const charName = c => c.n + ' ' + c.dyn;
function newDynasty(n) { const cul = CULTURES[n.cul]; let s = pickR(cul.a) + pickR(cul.b); return s.charAt(0).toUpperCase() + s.slice(1); }

/* ---------- criação do jogo ---------- */
function hsl(h, s, l) { const a = s * Math.min(l, 1 - l), f = k => { const x = (k + h * 12) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(x - 3, 9 - x, 1)))); }; return [f(0), f(8), f(4)]; }

function newGame(seed) {
  WD = generateWorld(seed); ownCache = null; warSet = null;
  const P = WD.provs.length, r = mkRng(seed ^ 0x5eed);
  S = { v: 1, seed, t: 0, player: -1, nations: [], own: new Int16Array(P).fill(-1), ctrl: new Int16Array(P).fill(-1), pop: new Float32Array(P), bld: WD.states.map(() => ({})),
        armies: [], fleets: [], wars: [], cols: [], sieges: {}, log: [], news: [], id: 1, wp: {}, over: false };
  GOOD_IDS.forEach(g => S.wp[g] = GOODS[g].p);
  const stAdj = WD.states.map(() => new Set());
  WD.provs.forEach(p => p.adj.forEach(o => { const a = p.state, b = WD.provs[o].state; if (a !== b) stAdj[a].add(b); }));
  const usedN = new Set(), hueBase = r();
  const mkNation = (cul, home, kind) => {
    const id = S.nations.length, name = nameGen(CULTURES[cul], r, usedN);
    const h = (hueBase + id * .618034) % 1, col = hsl(h, .4 + r() * .3, .42 + r() * .16);
    const n = { id, name, cul, home, kind, col, flag: flagRandom(r), gov: 'feudal', ideo: 'trad', money: 120, stab: 55, manpower: 5, techs: {}, res: null, rp: 0, vert: null, vlv: 0,
                alive: true, claims: {}, truce: {}, rel: {}, cons: [], rec: [], fab: null, wex: 0, mk: { sup: {}, dem: {}, sat: {}, imp: {}, exp: {} }, inc: {}, exP: new Uint8Array(P), exZ: new Uint8Array(WD.seas.length), capital: -1 };
    n.dyn = newDynasty(n); S.nations.push(n); return n;
  };
  const grantTechs = (n, maxY, extra = []) => TECHS.forEach(t => { if (t.c !== 'vert' && t.y <= maxY && t.req.every(q => n.techs[q])) n.techs[t.id] = 1; extra.forEach(e => n.techs[e] = 1); });
  // continentes: o principal é todo dividido; o frio tem nórdicos; os outros têm tribos e muita terra livre
  WD.conts.forEach(c => {
    if (c.empty) return;
    const sts = WD.states.filter(s => s.cont === c.id).map(s => s.id); if (!sts.length) return;
    const nN = c.main ? clamp(Math.round(sts.length / 3.2), 18, 48) : c.cold ? clamp(Math.round(sts.length / 3), 2, 6) : clamp(Math.round(sts.length / 5), 2, 14);
    const owner = new Map(), order = sts.slice().sort(() => r() - .5), caps = [];
    for (const s of order) { if (caps.length >= nN) break; if (caps.every(o => !stAdj[o].has(s))) caps.push(s); }
    const ns = caps.map(s => {
      const cul = WD.regions[WD.states[s].region].cul, n = mkNation(cul, c.id, c.main ? 'main' : c.cold ? 'cold' : 'far');
      owner.set(s, n.id); n.vig = .3 + r(); n._st = [s]; return n;
    });
    const fill = c.main ? 1 : c.cold ? .9 : .5, target = Math.round(sts.length * fill);
    for (let guard = 0; owner.size < target && guard < 20000; guard++) {
      const n = ns[r() * ns.length | 0]; if (r() > n.vig) continue;
      const from = n._st[r() * n._st.length | 0], opts = [...stAdj[from]].filter(s => !owner.has(s) && WD.states[s].cont === c.id);
      if (opts.length) { const s = opts[r() * opts.length | 0]; owner.set(s, n.id); n._st.push(s); }
      else if (ns.every(m => m._st.every(x => [...stAdj[x]].every(s => owner.has(s) || WD.states[s].cont !== c.id)))) break;
    }
    if (c.main) for (const s of sts) if (!owner.has(s)) { const nb = [...stAdj[s]].find(o => owner.has(o)); if (nb != null) { owner.set(s, owner.get(nb)); nat(owner.get(nb))._st.push(s); } }
    owner.forEach((nid, s) => WD.states[s].provs.forEach(p => { S.own[p] = nid; S.ctrl[p] = nid; }));
    ns.forEach(n => {
      n.capital = WD.states[n._st[0]].cap; delete n._st; delete n.vig;
      if (n.kind === 'main') { grantTechs(n, 880 + (r() * 40 | 0)); n.gov = pickR(['feudal', 'feudal', 'feudal', 'feudal', 'elective', 'elective', 'tribal', 'theocracy']); n.ideo = chance(.25) ? 'warrior' : 'trad'; n.money = 160; }
      else if (n.kind === 'cold') { grantTechs(n, 860, ['nav_longship']); n.gov = pickR(['tribal', 'tribal', 'tribal_conf']); n.ideo = 'warrior'; n.money = 90; }
      else { grantTechs(n, 860); if (chance(.4)) delete n.techs.nav_longship; n.gov = pickR(['tribal', 'tribal', 'tribal', 'tribal_conf', 'horde', 'feudal']); n.ideo = chance(.3) ? 'warrior' : 'trad'; n.money = 60; }
      if (n.gov === 'theocracy') n.flag.c = { k: pickR(['cross_patty', 'sun', 'eye', 'crescent', 'star8']), t: TINCT[n.flag.t[0]].metal ? 'gules' : 'or', n: 1, at: 'center' };
      n.ruler = mkChar(n, { ruler: true }); if (GOVS[n.gov].succ === 'hered') { n.spouse = mkChar(n, { f: !n.ruler.f, dyn: newDynasty(n), age: ageOf(n.ruler) - 3 }); n.kids = []; if (ageOf(n.ruler) > 24) for (let k = 0; k < 1 + (r() * 3 | 0); k++) n.kids.push(mkChar(n, { age: Math.max(0, ageOf(n.ruler) - 20 - (r() * 8 | 0)) })); }
      n.council = {}; COUNCIL.forEach(([k, , s]) => n.council[k] = mkChar(n, { boost: s, dyn: newDynasty(n) }));
    });
  });
  // população: mais densa no principal; terra livre tem nativos
  WD.provs.forEach(p => {
    const c = WD.conts[p.cont], o = S.own[p.id], base = p.size * TERRAIN[p.terr].pop;
    S.pop[p.id] = base * (c.main ? rand(1.3, 1.9) : c.cold ? rand(.35, .6) : o >= 0 ? rand(.5, .9) : rand(.12, .35));
  });
  // prédios iniciais, exércitos e frotas
  S.nations.forEach(n => {
    const mine = WD.states.filter(s => S.own[s.cap] === n.id);
    mine.forEach(s => {
      const b = S.bld[s.id], k = n.kind === 'main' ? .45 : .2;
      b.farm = Math.max(1, Math.round(s.caps.farm * k)); if (s.caps.lumber) b.lumber = 1; if (s.caps.fishery && n.kind !== 'far') b.fishery = 1;
      if (n.kind === 'main' && s.caps.iron_mine) b.iron_mine = 1; if (n.kind === 'main' && chance(.4)) b.workshop = 1; if (n.kind === 'main' && chance(.25)) b.smithy = 1; if (n.kind === 'main' && chance(.3)) b.weaver = 1;
      if (s.provs.includes(n.capital)) { b.castle = 1; if (n.kind === 'main') b.temple = 1; }
    });
    const pop = provsOf(n.id).reduce((a, p) => a + S.pop[p], 0);
    const regs = Math.max(2, Math.round(pop * (n.kind === 'cold' ? .012 : .005)));
    addArmy(n.id, n.capital, { inf: Math.ceil(regs * .75), cav: Math.floor(regs * .25) });
    n.manpower = pop * .01;
    const coastal = provsOf(n.id).find(p => WD.provs[p].coast);
    if (n.techs.nav_longship && coastal != null) addFleet(n.id, WD.provs[coastal].seas[0], n.kind === 'cold' ? 10 : n.kind === 'main' ? 3 : 2);
    initExplore(n);
    calcMods(n);
  });
  S.nations.forEach(n => S.nations.forEach(o => { if (o !== n) n.rel[o.id] = 0; }));
  econAll(); S.news = [];
  log('O ano é 860. As crônicas começam.', 'world');
  return S;
}
function initExplore(n) {
  WD.provs.forEach(p => { if (p.cont === n.home) { n.exP[p.id] = 1; p.seas.forEach(z => n.exZ[z] = 1); } });
  if (n.kind === 'cold') { const main = WD.conts.find(c => c.main); WD.provs.forEach(p => { if (p.cont === main.id && p.coast) n.exP[p.id] = 1; }); }
  if (n.kind === 'main') { const cold = WD.conts.find(c => c.cold); WD.provs.forEach(p => { if (p.cont === cold.id && p.coast && chance(.5)) n.exP[p.id] = 1; }); }
  // mares que ligam as terras conhecidas
  WD.seas.forEach(z => { if (z.provs.some(p => n.exP[p])) n.exZ[z.id] = 1; });
}

/* ---------- consultas ---------- */
let ownCache = null;                                         // listas de províncias por dono (refeitas quando muda dono)
function provsOf(id) { if (!ownCache) { ownCache = S.nations.map(() => []); for (let p = 0; p < S.own.length; p++) if (S.own[p] >= 0) ownCache[S.own[p]].push(p); } return ownCache[id] || []; }
function ownChanged() { ownCache = null; S.mapDirty = true; }
const hasTech = (n, id) => !!n.techs[id];
let warSet = null;                                          // pares em guerra (refeito quando guerras começam ou acabam)
const warsChanged = () => { warSet = null; };
const atWar = (a, b) => { if (a === b || a < 0 || b < 0) return false; if (!warSet) { warSet = new Set(); S.wars.forEach(w => { warSet.add(w.a * 4096 + w.d); warSet.add(w.d * 4096 + w.a); }); } return warSet.has(a * 4096 + b); };
const warsOf = id => S.wars.filter(w => w.a === id || w.d === id);
const enemiesOf = id => warsOf(id).map(w => w.a === id ? w.d : w.a);
const regs = a => a.inf + a.cav + a.art + a.vrt;
function stateOwnerOf(s) { return S.own[WD.states[s].cap]; }
function fortOf(p) {
  const pr = WD.provs[p], st = WD.states[pr.state], o = S.own[p]; let f = 0;
  if (st.cap === p && stateOwnerOf(st.id) === o) f += S.bld[st.id].castle || 0;
  if (o >= 0 && nat(o).capital === p) f += 1;
  return f;
}
const techCount = n => Object.keys(n.techs).length;

/* ---------- modificadores ---------- */
function calcMods(n) {
  const m = {}; Object.keys(MODS).forEach(k => m[k] = 0); m.coup = 0;
  const add = o => { for (const k in o) m[k] = (m[k] || 0) + o[k]; };
  add(GOVS[n.gov].m); add(IDEOS[n.ideo].m);
  const fx = { sea: 0, col: 0, fort: 0, slots: 1, ship: 1, bo: {}, up: { inf: 1, cav: 1, art: 1, siege: 1 }, b: new Set(Object.keys(BUILDINGS).filter(b => !BUILDINGS[b].tech && !BUILDINGS[b].vert)), g: new Set(), i: new Set(['trad', 'warrior']) };
  for (const id in n.techs) {
    const t = TECH[id]; if (!t) continue; const f = t.fx;
    if (f.m) add(f.m); if (f.sea) fx.sea = Math.max(fx.sea, f.sea); if (f.col) fx.col += f.col; if (f.fort) fx.fort += f.fort; if (f.slots) fx.slots += f.slots; if (f.ship) fx.ship += f.ship;
    if (f.bo) for (const k in f.bo) fx.bo[k] = (fx.bo[k] || 0) + f.bo[k]; if (f.u) for (const k in f.u) fx.up[k] = (fx.up[k] || 0) + f.u[k];
    (f.b || []).forEach(b => fx.b.add(b)); (f.g || []).forEach(g => fx.g.add(g)); (f.i || []).forEach(i => fx.i.add(i));
  }
  if (n.vert) { const v = VERT[n.vert]; for (const k in v.m) m[k] += v.m[k] * n.vlv * (.5 + .5 * (n.vsat == null ? 1 : n.vsat)); }
  [n.ruler, ...Object.values(n.council || {})].forEach(c => c && c.tr.forEach(t => TRAITS[t] && add(TRAITS[t].m)));
  const R = n.ruler, C = n.council || {};
  if (R) { m.tax += (R.st.adm - 8) * .008; m.research += (R.st.lea - 8) * .008; m.army += (R.st.mar - 8) * .008; m.stab += (R.st.dip - 8) * .004; }
  if (C.steward) m.tax += (C.steward.st.adm - 8) * .006; if (C.scholar) m.research += (C.scholar.st.lea - 8) * .006; if (C.marshal) m.army += (C.marshal.st.mar - 8) * .006; if (C.chancellor) m.stab += (C.chancellor.st.dip - 8) * .003;
  if (C.spymaster) m.coup -= (C.spymaster.st.int - 8) * .04;
  const nP = provsOf(n.id).length; if (GOVS[n.gov].minProv && nP < GOVS[n.gov].minProv) m.stab -= .1;
  n.m = m; n.fx = fx;
  const up = fx.up; n.up = { inf: up.inf, cav: up.cav, art: up.art, siege: up.siege, vrt: n.vert ? (up.inf * (1.5 + .35 * n.vlv)) * (.5 + .5 * (n.vsat == null ? 1 : n.vsat)) : 0 };
}
function unitName(n, type) {
  if (type === 'vrt') return n.vert ? VERT[n.vert].unit[Math.max(0, n.vlv - 1)] : '—';
  let nm = UNITS[type][0][1]; for (const [t, x] of UNITS[type]) if (n.techs[t]) nm = x; return nm;
}
const canArt = n => n.techs.mil_trebuchet;

/* ---------- economia ---------- */
function econAll() {
  const year = curYear(), need = popNeeds(year), wsup = {}, wdem = {};
  GOOD_IDS.forEach(g => { wsup[g] = 0; wdem[g] = 0; });
  // população controlada por nação e por estado
  const statePop = new Map(), natStates = S.nations.map(() => new Set());
  for (let p = 0; p < S.own.length; p++) { const o = S.own[p]; if (o < 0 || S.ctrl[p] !== o) continue; const st = WD.provs[p].state, k = st * 1000 + o; statePop.set(k, (statePop.get(k) || 0) + S.pop[p]); natStates[o].add(st); }
  if (!WD.states[0].fert) WD.states.forEach(st => { st.fert = st.provs.reduce((a, p) => a + TERRAIN[WD.provs[p].terr].food, 0) / st.provs.length; });
  S.nations.forEach(n => {
    if (!n.alive) return;
    const sup = {}, dem = {}; GOOD_IDS.forEach(g => { sup[g] = 0; dem[g] = 0; });
    let popT = 0, employedT = 0, ports = 0, mkts = 0, univ = 0, temples = 0, gdp = 0;
    const bo = n.fx.bo, prodM = 1 + n.m.prod, sat = n.mk.sat;
    for (const p of provsOf(n.id)) if (S.ctrl[p] === n.id) popT += S.pop[p];
    natStates[n.id].forEach(sid => {
      const st = WD.states[sid], sp = statePop.get(st.id * 1000 + n.id) || 0; if (!sp) return;
      let labor = sp * .55, used = 0;
      if (stateOwnerOf(st.id) === n.id) {
        const B = S.bld[st.id]; let need0 = 0; for (const b in B) need0 += B[b] * BUILDINGS[b].w;
        const e = need0 ? Math.min(1, labor / need0) : 1; used = Math.min(labor, need0);
        const stBonus = (B.railway || 0) * .1 + (B.power_plant || 0) * .15 + (B.tesla_tower || 0) * .05 + (B.reactor || 0) * .08 + (B.solar_array || 0) * .06;
        const fert = st.fert;
        for (const b in B) {
          const L = B[b], d = BUILDINGS[b]; if (!L) continue;
          if (b === 'port') ports += L; if (b === 'market') mkts += L; if (b === 'university') univ += L; if (b === 'temple') temples += L;
          let inSat = 1; if (d.in) for (const g in d.in) { inSat = Math.min(inSat, sat[g] == null ? 1 : sat[g]); dem[g] += L * d.in[g] * e; }
          if (d.out) {
            let mult = prodM + (bo[b] || 0) + stBonus; if (b === 'farm' || b === 'fishery') mult += n.m.food; if (b === 'farm') mult *= .55 + fert * .45;
            for (const g in d.out) sup[g] += L * d.out[g] * e * Math.max(.1, inSat) * Math.max(.2, mult);
          }
        }
      }
      employedT += used;
      // subsistência dos não empregados (grãos e um pouco de bens)
      const fertS = st.fert;
      sup.grain += (sp - used * .6) * (.72 + .4 * fertS) * (1 + n.m.food * .5);   // quem trabalha nos prédios ainda planta um pouco
      if (st.coast) sup.fish += (sp - used) * .08;
      sup.wood += (sp - used) * .02; sup.goods += (sp - used) * .012; sup.cloth += (sp - used) * .034; sup.fiber += (sp - used) * .01;
    });
    // demanda da população e do exército
    const food = popT * need.food; dem.cloth += popT * need.cloth; dem.goods += popT * need.goods; dem.lux += popT * need.lux; dem.elec += popT * need.elec;
    const fs = sup.grain + sup.fish || 1; dem.grain += food * Math.max(.3, sup.grain / fs); dem.fish += food * Math.min(.7, sup.fish / fs);
    let R = { inf: 0, cav: 0, art: 0, vrt: 0 }; S.armies.forEach(a => { if (a.o === n.id) { R.inf += a.inf; R.cav += a.cav; R.art += a.art; R.vrt += a.vrt; } });
    const totR = R.inf + R.cav + R.art + R.vrt;
    if (n.techs.mil_crossbow) dem.arms += totR * .03; if (n.techs.mil_tank) dem.oil += R.cav * .15; if (n.vert) dem[VERT[n.vert].good] += R.vrt * .25 + provsOf(n.id).length * .01 * n.vlv;
    // comércio com o mercado mundial: exporta o excedente; importa o que falta dentro de um orçamento, comida primeiro
    const eff = clamp(.35 + Math.min(5, ports) * .08 + n.m.trade, .15, 1.3);
    let tradeInc = 0, tradeCost = 0;
    GOOD_IDS.forEach(g => { const net = sup[g] - dem[g]; n.mk.imp[g] = 0; n.mk.exp[g] = 0; if (net > 0) { const exp = net * Math.min(1, eff); n.mk.exp[g] = exp; tradeInc += exp * S.wp[g] * .55; } gdp += sup[g] * S.wp[g]; wsup[g] += sup[g]; wdem[g] += dem[g]; });
    let budget = Math.max(0, gdp * ECON.taxBase * .35 + tradeInc * .8 + Math.max(0, n.money) * .03);
    const order = GOOD_IDS.slice().sort((a, b) => (GOODS[a].c === 'food' ? 0 : n.vert && VERT[n.vert].good === a ? 1 : 2) - (GOODS[b].c === 'food' ? 0 : n.vert && VERT[n.vert].good === b ? 1 : 2));
    for (const g of order) {
      const need = dem[g] - sup[g]; if (need <= 0 || budget <= 0 || (GOODS[g].c === 'lux' && S.wp[g] > GOODS[g].p * 2)) continue;
      const price = S.wp[g] * 1.05, imp = Math.min(need * Math.min(1, eff * 1.2), budget / price);
      n.mk.imp[g] = imp; tradeCost += imp * price; budget -= imp * price;
    }
    const s2 = {}; GOOD_IDS.forEach(g => { s2[g] = dem[g] > 0 ? Math.min(1, (sup[g] + n.mk.imp[g]) / dem[g]) : 1; });
    n.mk.sup = sup; n.mk.dem = dem; n.mk.sat = s2;
    if (n.vert) n.vsat = s2[VERT[n.vert].good];
    // receitas e despesas
    const stabE = .55 + n.stab / 200, taxM = 1 + n.m.tax + Math.min(.3, mkts * .015);
    const tax = gdp * ECON.taxBase * Math.max(.1, taxM) * stabE;
    let upk = 0; S.armies.forEach(a => { if (a.o === n.id) upk += (a.inf * UNIT_BASE.inf.c + a.cav * UNIT_BASE.cav.c + a.art * UNIT_BASE.art.c + a.vrt * UNIT_BASE.vrt.c) * ECON.upkeep; });
    upk *= eraScale() * .5;
    let navy = 0; S.fleets.forEach(f => { if (f.o === n.id) navy += f.ships * .6 * eraScale(); });
    const admin = popT * .01 + provsOf(n.id).length * .05, interest = n.money < 0 ? -n.money * .01 : 0, corrupt = n.money > 2000 ? (n.money - 2000) * .01 : 0;
    n.inc = { tax, trade: tradeInc, imports: -tradeCost, army: -upk, navy: -navy, admin: -admin, interest: -interest, corrupt: -corrupt };
    n.income = tax + tradeInc - tradeCost - upk - navy - admin - interest - corrupt;
    n.money += n.income; n.gdp = gdp;
    if (n.money < -Math.max(400, gdp * 2)) {                   // falência: dívida perdoada, estabilidade despenca, metade do exército debanda
      n.money = 0; n.stab = Math.max(0, n.stab - 30); S.armies.forEach(a => { if (a.o === n.id) { a.inf /= 2; a.cav /= 2; a.art /= 2; a.vrt /= 2; } });
      log(natName(n) + ' declarou falência!', n.id === S.player ? 'bad' : 'world', [n.id]);
    } n.popT = popT; n.univ = univ; n.temples = temples; n.ports = ports; n.employed = employedT;
    n.foodSat = Math.min(1, (sup.grain + sup.fish + n.mk.imp.grain + n.mk.imp.fish) / Math.max(1, food));
  });
  GOOD_IDS.forEach(g => { const ratio = (wdem[g] + 1) / (wsup[g] + 1); S.wp[g] = GOODS[g].p * clamp(Math.pow(ratio, .6), .3, 3.5); });
}

/* ---------- custos e ações ---------- */
const bCost = (n, b) => Math.round(BUILDINGS[b].cost * ECON.costMul * (1 - Math.min(.5, n.m.admin || 0)) * (1 + (curYear() - 860) / 600));
const bMonths = b => Math.max(3, Math.round(BUILDINGS[b].cost / 25));
function canBuild(n, s, b) {
  const d = BUILDINGS[b], st = WD.states[s], B = S.bld[s], L = (B[b] || 0) + n.cons.filter(c => c.s === s && c.b === b).length;
  if (stateOwnerOf(s) !== n.id || S.ctrl[st.cap] !== n.id) return 'Só quem controla a capital do estado constrói nele';
  if (d.vert && n.vert !== d.vert) return 'Exige a vertente ' + (VERT[d.vert] ? VERT[d.vert].n : '');
  if (!d.vert && !n.fx.b.has(b)) return 'Exige tecnologia';
  if (d.req === 'coast' && !st.coast) return 'Exige litoral';
  const capOf = { arable: st.caps.farm, forest: st.caps.lumber, rocky: st.caps.quarry, warm: st.caps.plantation, coast: b === 'fishery' ? st.caps.fishery : 99 };
  if (d.req && d.req.startsWith('res:')) { const k = { iron: 'iron_mine', coal: 'coal_mine', gold: 'gold_mine', oil: 'oil_well' }[d.req.slice(4)]; if (L >= st.caps[k]) return st.caps[k] ? 'Recurso esgotado' : 'Sem o recurso'; }
  else if (d.req && L >= (capOf[d.req] ?? 99)) return 'Sem espaço';
  const max = b === 'castle' ? 1 + n.fx.fort : d.max; if (max && L >= max) return 'Nível máximo';
  if (n.cons.length >= consSlots(n)) return 'Sem canteiros livres';
  if (n.money < bCost(n, b)) return 'Sem dinheiro';
  return '';
}
const consSlots = n => n.fx.slots + Math.floor((n.popT || 0) / 1000) + Math.floor(Math.max(0, n.money) / 2500);
function build(n, s, b) { const e = canBuild(n, s, b); if (e) return e; n.money -= bCost(n, b); n.cons.push({ s, b, m: bMonths(b), tot: bMonths(b) }); return ''; }

const recCost = (n, type, k = 1) => Math.round(UNIT_BASE[type].c * 3 * eraScale() * k);
function canRecruit(n, type, k = 1) {
  if (type === 'art' && !canArt(n)) return 'Exige Trabuco';
  if (type === 'vrt' && !n.vert) return 'Exige uma vertente';
  if (n.manpower < k) return 'Sem contingente';
  if (n.money < recCost(n, type, k)) return 'Sem dinheiro';
  return '';
}
function recruit(n, type, k, at) { const e = canRecruit(n, type, k); if (e) return e; n.money -= recCost(n, type, k); n.manpower -= k; n.rec.push({ type, k, m: type === 'vrt' ? 5 : 3, at: at != null ? at : n.capital }); return ''; }
const shipCost = n => Math.round(30 * ECON.costMul * eraScale());
function buildShips(n, k, p) {
  const pr = WD.provs[p]; if (!pr || !pr.coast || S.own[p] !== n.id) return 'Exige litoral próprio';
  if (!n.fx.sea) return 'Exige Barcos longos'; const c = shipCost(n) * k; if (n.money < c) return 'Sem dinheiro';
  n.money -= c; n.rec.push({ type: 'ship', k, m: 4, at: p }); return '';
}
function addArmy(o, p, u) { const a = { id: S.id++, o, p, inf: u.inf || 0, cav: u.cav || 0, art: u.art || 0, vrt: u.vrt || 0, mor: 1, path: [], prog: 0, need: 0 }; S.armies.push(a); return a; }
function addFleet(o, z, ships) { const f = { id: S.id++, o, z, ships, path: [], prog: 0, need: 0, auto: false }; S.fleets.push(f); return f; }

/* ---------- pesquisa ---------- */
const techBase = y => 140 * Math.exp((y - 860) / 250);
function techCost(n, t) { const ahead = Math.max(0, t.y - curYear()); return Math.round(techBase(t.y) * (1 + ahead * .03) * (t.c === 'vert' ? 1.3 : 1)); }
function techState(n, t) {                                  // '' = pode pesquisar
  if (n.techs[t.id]) return 'done';
  if (!t.req.every(q => n.techs[q])) return 'Exige tecnologias anteriores';
  const ahead = t.y - curYear();
  if (t.c === 'vert') { if (n.vert && n.vert !== t.v) return 'Outra vertente escolhida'; if (ahead > 10) return 'Só a partir de ' + (t.y - 10); }
  else if (ahead > 100) return 'Só a partir de ' + (t.y - 100);
  return '';
}
function researchRate(n) { return (2 + (n.popT || 0) * .004 + (n.univ || 0) * 2.5) * Math.max(.2, 1 + n.m.research) * (.6 + n.stab / 250) * (1 + techCount(n) * .012); }
function finishTech(n, t) {
  n.techs[t.id] = 1;
  if (t.c === 'vert') { n.vert = t.v; n.vlv = Math.max(n.vlv, t.lv); if (t.lv === 1) log(natName(n) + ' abraçou a vertente ' + VERT[t.v].n + '.', n.id === S.player ? 'good' : 'world', [n.id]); }
  calcMods(n);
  if (n.id === S.player) log('Pesquisa concluída: ' + t.n + '.', 'good', [n.id]);
}

/* ---------- personagens: morte, sucessão, eleições e golpes ---------- */
function charMonthly(n) {
  const g = GOVS[n.gov], R = n.ruler, y = curYear();
  if (g.succ === 'ai') return;
  const age = ageOf(R), die = R.tr.reduce((a, t) => a * (TRAITS[t].die || 1), 1);
  const pDie = (age < 40 ? .0006 : .0006 * Math.exp((age - 40) / 9)) * die * (y > 1900 ? .5 : 1) * (y > 2050 ? .4 : 1);
  if (chance(pDie)) { log(titleOf(n, R) + ' ' + charName(R) + ' de ' + natName(n) + ' morreu aos ' + age + ' anos.', n.id === S.player ? 'bad' : 'info', [n.id]); succeed(n, true); return; }
  if (g.succ === 'term' || g.succ === 'council') { if (!n.termEnd) n.termEnd = y + (g.term || 4); if (y >= n.termEnd && S.t % 360 === 0) { n.termEnd = y + (g.term || 4); if (chance(.35)) log(charName(R) + ' foi reconduzido em ' + natName(n) + '.', 'info', [n.id]); else succeed(n, false); } }
  if (g.succ === 'hered' && n.spouse && n.kids && S.t % 360 === 0 && age < 50 && ageOf(n.spouse) < 45 && chance(.22)) { const k = mkChar(n, { age: 0 }); n.kids.push(k); if (n.id === S.player) log('Nasceu ' + k.n + ', filho do governante.', 'good', [n.id]); }
  // golpe
  const risk = g.coup * .0012 * (n.stab < 40 ? 1 + (40 - n.stab) / 8 : .35) * Math.max(.1, 1 + (n.m.coup || 0));
  if (chance(risk)) coup(n);
}
function succeed(n, death) {
  const g = GOVS[n.gov], old = n.ruler;
  if (g.succ === 'hered') {
    const heirs = (n.kids || []).filter(k => ageOf(k) >= 0).sort((a, b) => a.born - b.born);
    if (heirs.length) { n.ruler = heirs[0]; n.kids = heirs.slice(1); n.spouse = ageOf(n.ruler) >= 16 ? mkChar(n, { f: !n.ruler.f, dyn: newDynasty(n), age: ageOf(n.ruler) }) : null; if (ageOf(n.ruler) < 16) { n.stab -= 8; log('Regência em ' + natName(n) + ': ' + charName(n.ruler) + ' tem só ' + ageOf(n.ruler) + ' anos.', 'info', [n.id]); } }
    else { n.ruler = mkChar(n, { ruler: true }); n.spouse = mkChar(n, { f: !n.ruler.f, dyn: newDynasty(n), age: ageOf(n.ruler) - 2 }); n.kids = []; n.stab -= 15; log('Crise de sucessão em ' + natName(n) + ': um parente distante assume.', n.id === S.player ? 'bad' : 'info', [n.id]); }
  } else {
    n.dyn = newDynasty(n); n.ruler = mkChar(n, { ruler: true, age: g.succ === 'theo' ? 50 + (Math.random() * 20 | 0) : undefined, boost: g.succ === 'junta' ? 'mar' : null });
    n.stab -= g.succ === 'junta' ? 10 : g.succ === 'elect' ? 5 : 2;
  }
  n.termEnd = curYear() + (g.term || 4);
  log('Novo governo em ' + natName(n) + ': ' + titleOf(n).toLowerCase() + ' ' + charName(n.ruler) + '.', n.id === S.player ? 'info' : 'none', [n.id]);
  calcMods(n);
}
function coup(n) {
  const g = GOVS[n.gov], y = curYear(), juntaOk = y >= 1500;
  n.dyn = newDynasty(n); n.ruler = mkChar(n, { ruler: true, boost: 'mar' }); n.ruler.tr = ['ambitious', pickR(['cruel', 'strategist', 'charismatic', 'paranoid'])];
  if (['Monarquia', 'República', 'Tribal'].includes(g.cat) && chance(.45)) { n.gov = juntaOk ? pickR(['junta', 'caudillo']) : (g.cat === 'Tribal' ? 'tribal' : 'feudal'); if (y > 1800 && chance(.4)) n.ideo = pickR(['natpop', 'warrior'].filter(i => i === 'warrior' || n.fx.i.has(i))); }
  n.kids = []; n.spouse = null; n.stab = Math.max(0, n.stab - 20);
  log('Golpe em ' + natName(n) + '! ' + charName(n.ruler) + ' tomou o poder.', n.id === S.player ? 'bad' : 'world', [n.id]);
  calcMods(n);
}
function setGov(n, g) {
  const ok = n.fx.g.has(g) || ['tribal', 'tribal_conf', 'horde', 'feudal', 'elective'].includes(g);
  if (!ok) return 'Exige tecnologia'; if (GOVS[g].minProv && provsOf(n.id).length < GOVS[g].minProv) return 'Exige ' + GOVS[g].minProv + ' províncias';
  const c = Math.round(80 * eraScale()); if (n.money < c) return 'Sem dinheiro'; if (n.govCd > S.t) return 'Reforma recente';
  const sameCat = GOVS[g].cat === GOVS[n.gov].cat;
  n.money -= c; n.gov = g; n.stab = Math.max(0, n.stab - (sameCat ? 10 : 25)); n.govCd = S.t + 360 * 10;
  if (GOVS[g].succ !== 'hered') { n.kids = []; n.spouse = null; succeed(n, false); }
  else if (!n.kids) { n.kids = []; n.spouse = mkChar(n, { f: !n.ruler.f, dyn: newDynasty(n) }); }
  calcMods(n); return '';
}
function setIdeo(n, i) {
  if (!n.fx.i.has(i)) return 'Exige tecnologia'; if (n.ideoCd > S.t) return 'Mudança recente';
  n.ideo = i; n.stab = Math.max(0, n.stab - 12); n.ideoCd = S.t + 360 * 5; calcMods(n); return '';
}
function swapCouncil(n, k) {
  const c = Math.round(25 * eraScale()); if (n.money < c) return 'Sem dinheiro'; n.money -= c;
  const s = COUNCIL.find(x => x[0] === k)[2]; n.council[k] = mkChar(n, { boost: s, dyn: newDynasty(n) }); calcMods(n); return '';
}

/* ---------- caminhos (províncias 0..P-1, mares P..) ---------- */
function canEnter(o, p) { const ow = S.own[p], ct = S.ctrl[p]; return ow === o || ct === o || ow === -1 || atWar(o, ow) || atWar(o, ct); }
function transport(o) { let s = 0; S.fleets.forEach(f => { if (f.o === o) s += f.ships; }); return s * 3; }
function findPath(n, from, to, army) {
  const P = WD.provs.length, Z = WD.seas.length, dist = new Float32Array(P + Z).fill(1e9), prev = new Int32Array(P + Z).fill(-1), hp = new Heap();
  const seaOk = n.fx.sea >= 1 && (!army || transport(n.id) >= regs(army));
  dist[from] = 0; hp.push(0, from);
  const speed = 1 + Math.max(-.5, n.m.speed || 0);
  while (hp.size) {
    const u = hp.pop(); if (u === to) break; const du = dist[u];
    const relax = (v, c) => { if (du + c < dist[v]) { dist[v] = du + c; prev[v] = u; hp.push(du + c, v); } };
    if (u < P) {
      const pr = WD.provs[u];
      for (const v of pr.adj) if (n.exP[v] && (v === to || canEnter(n.id, v))) relax(v, edgeDays(n, u, v) / speed);
      if (seaOk) for (const z of pr.seas) if (n.exZ[z]) relax(P + z, 4);
    } else {
      const z = WD.seas[u - P];
      for (const w of z.adj) if (n.exZ[w] && (!WD.seas[w].deep || n.fx.sea >= 2)) relax(P + w, 5 / speed);
      for (const p of z.provs) if (n.exP[p] && (p === to || canEnter(n.id, p))) relax(p, 4);
    }
  }
  if (dist[to] >= 1e9) return null;
  const path = []; for (let v = to; v !== from; v = prev[v]) path.unshift(v); return path;
}
function edgeDays(n, a, b) {
  const pb = WD.provs[b], st = S.bld[pb.state], rail = S.own[b] === n.id ? (st.railway || 0) : 0;
  return 7 * TERRAIN[pb.terr].move / (1 + rail * .5);
}
function nodeXY(v) { const P = WD.provs.length; if (v < P) { const p = WD.provs[v]; return [p.cx, p.cy]; } const z = WD.seas[v - P]; return [z.cx, z.cy]; }
function seaPath(n, from, to) {                              // frotas: só por mar
  const Z = WD.seas.length, dist = new Float32Array(Z).fill(1e9), prev = new Int32Array(Z).fill(-1), hp = new Heap(); dist[from] = 0; hp.push(0, from);
  while (hp.size) { const u = hp.pop(); if (u === to) break; for (const w of WD.seas[u].adj) { if (!(n.exZ[w] || w === to) || (WD.seas[w].deep && n.fx.sea < 2)) continue; const c = dist[u] + 5; if (c < dist[w]) { dist[w] = c; prev[w] = u; hp.push(c, w); } } }
  if (dist[to] >= 1e9) return null; const path = []; for (let v = to; v !== from; v = prev[v]) path.unshift(v); return path;
}
function orderArmy(a, to) { const n = nat(a.o); if (a.p === to) { a.path = []; return true; } const path = findPath(n, a.p, to, a); if (!path) return false; a.path = path; a.prog = 0; a.need = 0; a.retreat = false; return true; }
function orderFleet(f, z) { const n = nat(f.o); const path = seaPath(n, f.z, z); if (!path) return false; f.path = path; f.prog = 0; f.need = 0; return true; }
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
    if (!a.path.length) continue;
    const n = nat(a.o), next = a.path[0];
    if (!a.need) {
      if (next < P && a.p < P) a.need = edgeDays(n, a.p, next) / (1 + Math.max(-.5, n.m.speed || 0));
      else a.need = 4;
      if (next < P && !a.retreat && !canEnter(a.o, next)) { a.path = []; a.need = 0; continue; }
    }
    a.prog += 1;
    if (a.prog >= a.need) { a.p = next; a.path.shift(); a.prog = 0; a.need = 0; explore(n, a.p); if (!a.path.length) a.retreat = false; }
  }
  for (const f of S.fleets) {
    if (!f.path.length) { if (f.auto) autoExplore(f); continue; }
    f.prog += 1; if (f.prog >= 5 / (1 + (nat(f.o).m.speed || 0))) { f.z = f.path.shift(); f.prog = 0; explore(nat(f.o), P + f.z); }
  }
  // agrupa por província
  const at = new Map(); for (const a of S.armies) { if (a.p >= P) continue; if (!at.has(a.p)) at.set(a.p, []); at.get(a.p).push(a); }
  at.forEach((list, p) => {
    const owners = [...new Set(list.map(a => a.o))];
    let fought = false;
    for (let i = 0; i < owners.length && !fought; i++) for (let j = i + 1; j < owners.length && !fought; j++) if (atWar(owners[i], owners[j])) { battle(p, list.filter(a => a.o === owners[i] && !a.retreat), list.filter(a => a.o === owners[j] && !a.retreat)); fought = true; }
    if (!fought) siegeAt(p, list);
  });
  // batalhas navais
  const zs = new Map(); for (const f of S.fleets) { if (!zs.has(f.z)) zs.set(f.z, []); zs.get(f.z).push(f); }
  zs.forEach(list => { if (list.length < 2) return; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (atWar(list[i].o, list[j].o) && list[i].ships > 0 && list[j].ships > 0) navalBattle(list[i], list[j]); });
  S.fleets = S.fleets.filter(f => f.ships > .2);
  // moral se recupera fora de combate
  for (const a of S.armies) if (!a.inBattle) a.mor = Math.min(1, a.mor + (S.own[a.p] === a.o ? .03 : .015)); else a.inBattle = false;
  S.armies = S.armies.filter(a => regs(a) > .08);
}
function power(list, def, p) {
  let s = 0, r = 0;
  for (const a of list) { const n = nat(a.o), u = n.up; const pw = (a.inf * u.inf * UNIT_BASE.inf.a + a.cav * u.cav * UNIT_BASE.cav.a + a.art * u.art * UNIT_BASE.art.a + a.vrt * u.vrt * UNIT_BASE.vrt.a) * (1 + n.m.army); s += pw * (.25 + .75 * a.mor); r += regs(a); }
  if (def) s *= 1 + TERRAIN[WD.provs[p].terr].def + fortOf(p) * .1;
  return [s, r];
}
function battle(p, A, B) {
  if (!A.length || !B.length) return;
  const ownerP = S.ctrl[p], aDef = A[0].o === ownerP, [pa, ra] = power(A, aDef, p), [pb, rb] = power(B, !aDef, p);
  const lossB = pb > 0 ? pa * .016 * rand(.75, 1.25) : rb, lossA = pb * .016 * rand(.75, 1.25);
  const hit = (list, loss, tot) => { for (const a of list) { const f = Math.min(1, loss / Math.max(.01, tot)); a.inf -= a.inf * f; a.cav -= a.cav * f; a.art -= a.art * f; a.vrt -= a.vrt * f; a.mor = Math.max(0, a.mor - (loss / Math.max(1, tot)) * 2.6 - .025); a.inBattle = true; a.path = []; } };
  hit(A, lossA, ra); hit(B, lossB, rb);
  const w = S.wars.find(w => (w.a === A[0].o && w.d === B[0].o) || (w.a === B[0].o && w.d === A[0].o));
  if (w) { const sideA = w.a === A[0].o; w.cas = w.cas || [0, 0]; w.cas[sideA ? 1 : 0] += lossB; w.cas[sideA ? 0 : 1] += lossA; }
  const brokeA = A.every(a => a.mor < .08 || regs(a) < .3), brokeB = B.every(a => a.mor < .08 || regs(a) < .3);
  if (brokeA || brokeB) {
    const lose = brokeA ? A : B, win = brokeA ? B : A;
    if (w) { const winA = w.a === win[0].o; w.bs = (w.bs || 0) + (winA ? 1 : -1) * clamp(Math.round((brokeA ? ra : rb) * .6), 1, 12); }
    const ln = nat(lose[0].o), wn = nat(win[0].o);
    if (lose[0].o === S.player || win[0].o === S.player) log('Batalha em ' + WD.provs[p].n + ': ' + natName(wn) + ' venceu ' + natName(ln) + '.', win[0].o === S.player ? 'good' : 'bad', [S.player]);
    lose.forEach(a => retreat(a));
  }
}
function retreat(a) {
  const n = nat(a.o), P = WD.provs.length, seen = new Set([a.p]), q = [[a.p, []]];
  for (let h = 0; h < q.length && h < 400; h++) {
    const [v, path] = q[h];
    if (v !== a.p && v < P && S.ctrl[v] === a.o && !S.armies.some(b => b.p === v && atWar(b.o, a.o))) { a.path = path; a.retreat = true; a.need = 0; a.prog = 0; return; }
    if (v < P) for (const o of WD.provs[v].adj) if (!seen.has(o) && n.exP[o] && (S.ctrl[o] === a.o || S.own[o] === a.o || S.own[o] === -1)) { seen.add(o); q.push([o, path.concat(o)]); }
  }
  a.inf = a.cav = a.art = a.vrt = 0;                         // cercado: o exército se rende
  if (a.o === S.player) log('Um exército seu foi cercado e se rendeu.', 'bad', [S.player]);
}
function navalBattle(f, g) {
  const pf = f.ships * nat(f.o).fx.ship, pg = g.ships * nat(g.o).fx.ship;
  f.ships -= pg * .04 * rand(.7, 1.3); g.ships -= pf * .04 * rand(.7, 1.3);
}
function siegeAt(p, list) {
  const ct = S.ctrl[p], own = S.own[p];
  const besiegers = list.filter(a => !a.path.length && (atWar(a.o, ct) || (own === a.o && ct !== a.o && atWar(a.o, ct))));
  if (!besiegers.length) { delete S.sieges[p]; return; }
  const o = besiegers[0].o, n = nat(o), sg = S.sieges[p] && S.sieges[p].o === o ? S.sieges[p] : (S.sieges[p] = { o, v: 0 });
  let force = 0; besiegers.filter(a => a.o === o).forEach(a => { force += regs(a) + a.art * 3 * n.up.siege; });
  const f = fortOf(p) + (ct >= 0 ? Math.floor(nat(ct).fx.fort / 2) * (fortOf(p) > 0 ? 1 : 0) : 0);
  sg.v += force / (40 * Math.pow(1 + f, 2));
  if (sg.v >= 1) {
    delete S.sieges[p];
    const liberate = own === o || (own >= 0 && S.wars.some(w => (w.a === o || w.d === o) && false));
    S.ctrl[p] = liberate ? own : o; S.mapDirty = true;
    if (o === S.player || own === S.player) log((liberate ? 'Libertamos ' : 'Cerco concluído: ') + WD.provs[p].n + (liberate ? '' : ' foi ocupada por ' + natName(n)) + '.', o === S.player ? 'good' : 'bad', [S.player]);
  }
}
function autoExplore(f) {
  const n = nat(f.o), Z = WD.seas.length, seen = new Uint8Array(Z), q = [f.z]; seen[f.z] = 1;
  for (let h = 0; h < q.length; h++) { const u = q[h]; for (const w of WD.seas[u].adj) { if (seen[w] || (WD.seas[w].deep && n.fx.sea < 2)) continue; seen[w] = 1; if (!n.exZ[w] || WD.seas[w].provs.some(p => !n.exP[p])) { const path = seaPath(n, f.z, w); if (path) { f.path = path; return; } } q.push(w); } }
  f.auto = false; if (f.o === S.player) log('Uma frota terminou de explorar o que conseguia alcançar.', 'info', [S.player]);
}

/* ---------- guerra e paz ---------- */
function declareWar(n, t, s) {
  if (atWar(n.id, t.id)) return 'Já em guerra'; if (n.truce[t.id] > S.t) return 'Trégua em vigor';
  const claim = s != null && n.claims[s];
  S.wars.push({ id: S.id++, a: n.id, d: t.id, goal: s, start: S.t, bs: 0, cas: [0, 0], score: 0 }); warsChanged();
  n.stab = Math.max(0, n.stab - (claim ? 3 : 15)); t.rel[n.id] = -100; n.rel[t.id] = -100;
  log(natName(n) + ' declarou guerra a ' + natName(t) + '!', 'world', [n.id, t.id]);
  return '';
}
function warScore(w) {                                     // positivo = atacante vencendo
  const side = (x, y) => { let tot = 0, occ = 0; for (const p of provsOf(y)) { tot += S.pop[p] + 1; if (S.ctrl[p] === x) occ += S.pop[p] + 1; } return tot ? occ / tot * 100 : 0; };
  let sc = side(w.a, w.d) - side(w.d, w.a) + clamp(w.bs || 0, -40, 40);
  if (w.goal != null && WD.states[w.goal].provs.every(p => S.own[p] !== w.d || S.ctrl[p] === w.a)) sc += Math.min(25, (S.t - w.start) / 360 * 4);
  return clamp(Math.round(sc), -100, 100);
}
function peaceCost(w, winner, provs) {
  const loser = winner === w.a ? w.d : w.a; let tot = 0; for (const p of provsOf(loser)) tot += S.pop[p] + 1;
  return provs.reduce((a, p) => a + Math.max(4, (S.pop[p] + 1) / tot * 110), 0);
}
function makePeace(w, winner, provs, money) {
  const loser = winner == null ? null : (winner === w.a ? w.d : w.a);
  (provs || []).forEach(p => { S.own[p] = winner; });
  // devolve ocupações e manda exércitos para casa
  for (let p = 0; p < S.own.length; p++) { const o = S.own[p]; if ((o === w.a || o === w.d) && (S.ctrl[p] === w.a || S.ctrl[p] === w.d)) S.ctrl[p] = o; }
  S.armies.forEach(a => { if ((a.o === w.a || a.o === w.d) && a.p < WD.provs.length && S.own[a.p] !== a.o) { a.p = nat(a.o).capital >= 0 ? nat(a.o).capital : a.p; a.path = []; } });
  if (money && loser != null) { const amt = Math.max(0, Math.min(nat(loser).money, money)); nat(loser).money -= amt; nat(winner).money += amt; }
  S.wars = S.wars.filter(x => x !== w); warsChanged();
  const A = nat(w.a), D = nat(w.d); A.truce[D.id] = S.t + 360 * 5; D.truce[A.id] = S.t + 360 * 5;
  if (w.goal != null && winner != null && nat(winner).claims[w.goal]) delete nat(winner).claims[w.goal];
  ownChanged(); checkDead();
  const txt = winner == null ? 'Paz branca entre ' + natName(A) + ' e ' + natName(D) + '.' : natName(nat(winner)) + ' venceu a guerra contra ' + natName(nat(loser)) + (provs && provs.length ? ' e tomou ' + provs.length + ' província' + (provs.length > 1 ? 's' : '') : '') + '.';
  log(txt, 'world', [w.a, w.d]);
}
function checkDead() {
  S.nations.forEach(n => {
    if (!n.alive) return;
    if (!provsOf(n.id).length) { n.alive = false; S.armies = S.armies.filter(a => a.o !== n.id); S.fleets = S.fleets.filter(f => f.o !== n.id); S.wars = S.wars.filter(w => w.a !== n.id && w.d !== n.id); warsChanged(); S.cols = S.cols.filter(c => c.o !== n.id); log(natName(n) + ' deixou de existir.', 'world', [n.id]); if (n.id === S.player) S.over = 'dead'; }
    else if (S.own[n.capital] !== n.id) { const ps = provsOf(n.id); n.capital = ps.reduce((a, b) => S.pop[a] >= S.pop[b] ? a : b); }
  });
}
function occupiedBy(w, winner) { const loser = winner === w.a ? w.d : w.a; return provsOf(loser).filter(p => S.ctrl[p] === winner); }
function aiPeace(w) {                                        // propostas da IA (para IA x IA aplica direto)
  const sc = warScore(w); w.score = sc; const months = (S.t - w.start) / 30;
  const winner = sc > 0 ? w.a : w.d, abs = Math.abs(sc);
  const human = w.a === S.player || w.d === S.player;
  if (abs >= 25 && months >= 10 && chance(.12)) {
    const occ = occupiedBy(w, winner).sort((x, y) => (S.pop[y] - S.pop[x])); const take = []; let c = 0;
    for (const p of occ) { const k = peaceCost(w, winner, [p]); if (c + k <= abs) { take.push(p); c += k; } }
    if (!human) { makePeace(w, winner, take); return; }
    if (winner !== S.player && !S.offer) S.offer = { w: w.id, winner, provs: take };
  } else if (months > 12 * 7 && abs < 15 && chance(.05)) { if (!human) makePeace(w, null, []); else if (!S.offer) S.offer = { w: w.id, winner: null, provs: [] }; }
}
function proposePeace(w, provs, money) {                     // proposta do jogador; '' = aceita
  const me = S.player, sc = warScore(w) * (w.a === me ? 1 : -1);
  if (!provs.length && !money) { if (sc > -10 || (S.t - w.start) > 360 * 4) { makePeace(w, null, []); return ''; } return 'Recusada: eles acham que estão vencendo'; }
  const c = peaceCost(w, me, provs) + (money ? 12 : 0); if (c <= sc + 2) { makePeace(w, me, provs, money); return ''; }
  return 'Recusada: exige ' + Math.ceil(c) + ' de placar (tem ' + sc + ')';
}
function fabricate(n, s) { if (n.fab) return 'Já fabricando'; const c = Math.round(40 * eraScale()); if (n.money < c) return 'Sem dinheiro'; n.money -= c; n.fab = { s, m: 6 }; return ''; }

/* ---------- colonização ---------- */
function canColonize(n, p) {
  if (S.own[p] !== -1) return 'Já tem dono'; if (!n.exP[p]) return 'Inexplorada';
  if (S.cols.some(c => c.p === p)) return 'Já em colonização';
  const adj = WD.provs[p].adj.some(o => S.own[o] === n.id);
  if (!adj) { if (n.fx.col < 1) return 'Exige Colonização'; if (!WD.provs[p].coast || n.fx.sea < 1) return 'Fora de alcance'; }
  if (n.fx.col < 1 && S.pop[p] > 4) return 'Nativos numerosos: exige Colonização';
  const slots = 1 + n.fx.col; if (S.cols.filter(c => c.o === n.id).length >= slots) return 'Sem colonos livres';
  if (n.money < colCost(n, p)) return 'Sem dinheiro';
  return '';
}
const colCost = (n, p) => Math.round(35 * ECON.costMul * eraScale() * (WD.provs[p].adj.some(o => S.own[o] === n.id) ? .6 : 1));
function colonize(n, p) { const e = canColonize(n, p); if (e) return e; n.money -= colCost(n, p); const m = Math.round((n.fx.col ? 18 : 48) / (1 + Math.max(-.5, n.m.colon || 0))); S.cols.push({ o: n.id, p, m, tot: m }); return ''; }

/* ---------- mensal ---------- */
function monthTick() {
  const y = curYear(), newYear = S.t % 360 === 0;
  econAll();
  S._mine = S.nations.map(() => []); WD.states.forEach(st => { const o = S.own[st.cap]; if (o >= 0 && S.ctrl[st.cap] === o) S._mine[o].push(st); });
  S.nations.forEach(n => {
    if (!n.alive) return;
    calcMods(n);
    // pesquisa
    n.rp += researchRate(n);
    if (n.res && techState(n, TECH[n.res]) && techState(n, TECH[n.res]) !== '') n.res = null;
    if (n.res && n.rp >= techCost(n, TECH[n.res])) { const t = TECH[n.res]; n.rp -= techCost(n, t); n.res = null; finishTech(n, t); }
    n.rp = Math.min(n.rp, techBase(y) * 3);
    // obras e recrutas
    n.cons.forEach(c => c.m--); n.cons.filter(c => c.m <= 0).forEach(c => { if (stateOwnerOf(c.s) === n.id) { S.bld[c.s][c.b] = (S.bld[c.s][c.b] || 0) + 1; if (n.id === S.player) log(BUILDINGS[c.b].n + ' concluída em ' + WD.states[c.s].n + '.', 'good', [n.id]); } }); n.cons = n.cons.filter(c => c.m > 0);
    n.rec.forEach(r => r.m--);
    n.rec.filter(r => r.m <= 0).forEach(r => {
      if (r.type === 'ship') { const pr = WD.provs[r.at]; if (S.own[r.at] === n.id) { const z = pr.seas[0], f = S.fleets.find(f => f.o === n.id && f.z === z && !f.path.length); if (f) f.ships += r.k; else addFleet(n.id, z, r.k); } return; }
      const at = S.own[r.at] === n.id && S.ctrl[r.at] === n.id ? r.at : n.capital; const ex = S.armies.find(a => a.o === n.id && a.p === at && !a.path.length);
      if (ex) ex[r.type] += r.k; else addArmy(n.id, at, { [r.type]: r.k });
    });
    n.rec = n.rec.filter(r => r.m > 0);
    // contingente, estabilidade, cansaço de guerra
    const mpMax = (n.popT || 0) * .03 * (1 + n.m.manpower); n.mpMax = mpMax; n.manpower = Math.min(mpMax, n.manpower + (n.popT || 0) * .00025 * (1 + n.m.manpower));
    const war = warsOf(n.id).length; n.wex = war ? Math.min(30, n.wex + .4) : Math.max(0, n.wex - .6);
    const g = n.mk.sat.goods, target = 36 + n.m.stab * 100 + (n.foodSat - 1) * 60 + (g - .7) * 20 - n.wex + Math.min(10, (n.temples || 0)) - (n.money < 0 ? 15 : 0) - Math.max(0, provsOf(n.id).length - 80) * .06;
    n.stab = clamp(n.stab + clamp(target - n.stab, -2, 2), 0, 100);
    // reivindicação
    if (n.fab && --n.fab.m <= 0) { n.claims[n.fab.s] = 1; if (n.id === S.player) log('Reivindicação sobre ' + WD.states[n.fab.s].n + ' fabricada.', 'good', [n.id]); n.fab = null; }
    charMonthly(n);
    if (n.id !== S.player) ai(n);
  });
  S._threat = null;
  // população
  S.nations.forEach(n => { n._fs = n.foodSat == null ? 1 : n.foodSat; n._gm = 1 + (n.m ? n.m.growth : 0); n._cap = 1 + (n.fx ? (n.fx.bo.farm || 0) : 0) + (y > 1800 ? (y - 1800) / 120 : 0); });
  for (let p = 0; p < S.pop.length; p++) {
    const o = S.own[p], pr = WD.provs[p], fs = o >= 0 ? nat(o)._fs : 1, gm = o >= 0 ? nat(o)._gm : 1, capM = o >= 0 ? nat(o)._cap : 1;
    const cap = pr.size * TERRAIN[pr.terr].pop * 4 * capM + 3, base = (y < 1750 ? .00035 : y < 1950 ? .0008 : .0005) * gm;
    const g = fs >= .95 ? base * (1 - S.pop[p] / cap) : -.003 * (.95 - fs) / .95;
    S.pop[p] = Math.max(.3, S.pop[p] * (1 + g));
  }
  // colonização
  S.cols.forEach(c => c.m--);
  S.cols.filter(c => c.m <= 0).forEach(c => { if (S.own[c.p] === -1 && nat(c.o).alive) { S.own[c.p] = c.o; S.ctrl[c.p] = c.o; S.pop[c.p] = Math.max(2, S.pop[c.p] * .5 + 1.5); ownChanged(); if (c.o === S.player) log('Nova colônia: ' + WD.provs[c.p].n + '.', 'good', [S.player]); } });
  S.cols = S.cols.filter(c => c.m > 0);
  // guerras
  S.wars.slice().forEach(w => { w.score = warScore(w); aiPeace(w); });
  if (newYear) { S.nations.forEach(n => { for (const k in n.rel) n.rel[k] = clamp(n.rel[k] + (n.rel[k] < 0 ? 4 : -1), -100, 100); }); }
  if (y >= END_YEAR && !S.over) { S.over = 'end'; log('O ano ' + END_YEAR + ' chegou. A crônica termina.', 'world'); }
}

/* ---------- IA ---------- */
function threatAt(p) {                                     // regimentos por dono em cada província (refeito uma vez por mês)
  if (!S._threat) { S._threat = new Map(); for (const a of S.armies) { if (!S._threat.has(a.p)) S._threat.set(a.p, []); S._threat.get(a.p).push(a); } }
  return S._threat.get(p) || [];
}
function ai(n) {
  const y = curYear(), slow = ((S.t / 30 | 0) + n.id) % 3 === 0;   // decisões pesadas a cada 3 meses
  // pesquisa
  if (!n.res && (slow || n.rp > 50)) {
    const opts = TECHS.filter(t => techState(n, t) === '');
    let pickT = null;
    if (n.vert) pickT = opts.find(t => t.c === 'vert' && t.v === n.vert);
    if (!pickT && !n.vert) { const vs = opts.filter(t => t.c === 'vert'); if (vs.length && chance(.08)) pickT = pickR(vs); }
    if (!pickT) { const main = opts.filter(t => t.c !== 'vert').sort((a, b) => a.y - b.y); pickT = main.length ? main[Math.min(main.length - 1, Math.random() * Math.min(3, main.length) | 0)] : null; }
    if (pickT) n.res = pickT.id;
  }
  // governo e ideologia (raro)
  if (chance(.0012) && !(n.govCd > S.t)) {
    const opts = [...n.fx.g].filter(g => g !== n.gov && GOVS[g] && (!GOVS[g].minProv || provsOf(n.id).length >= GOVS[g].minProv));
    const same = opts.filter(g => GOVS[g].cat === GOVS[n.gov].cat), g = same.length && chance(.85) ? pickR(same) : opts.length && chance(.5) ? pickR(opts) : null;
    if (g && GOVS[g].m && Object.values(GOVS[g].m).reduce((a, b) => a + b, 0) >= Object.values(GOVS[n.gov].m).reduce((a, b) => a + b, 0) + .05) setGov(n, g);
  }
  if (chance(.003) && !(n.ideoCd > S.t)) { const opts = [...n.fx.i].filter(i => i !== n.ideo); if (opts.length) setIdeo(n, pickR(opts)); }
  // obras
  const mine = slow || n.money > 2000 ? S._mine[n.id] : [];
  for (let tries = 0; tries < 3 && n.cons.length < consSlots(n) && n.money > 100; tries++) {
    let best = null, bv = -1e9;
    for (let k = 0; k < 4 && mine.length; k++) {
      const s = pickR(mine);
      for (const b of Object.keys(BUILDINGS)) {
        const d0 = BUILDINGS[b]; if (d0.vert ? n.vert !== d0.vert : !n.fx.b.has(b)) continue;
        if (canBuild(n, s.id, b)) continue; const d = BUILDINGS[b];
        let v = 0; if (d.out) for (const g in d.out) v += d.out[g] * S.wp[g] * (n.mk.sat[g] < 1 ? 1.6 : 1); if (d.in) for (const g in d.in) v -= d.in[g] * S.wp[g] * (n.mk.sat[g] < .8 ? 2 : 1);
        if (d.fx) v += (d.fx.research || 0) * 4 + (d.fx.tax || 0) * (n.gdp || 0) * .15 + (d.fx.prod || 0) * 60 + (d.fx.fort ? (warsOf(n.id).length ? 25 : 4) : 0) + (d.fx.port ? 8 : 0) + (d.fx.stab ? (n.stab < 45 ? 20 : 3) : 0);
        if ((b === 'farm' || b === 'fishery') && n.foodSat < 1.05) v += 120; else if (n.foodSat < .95 && d.w > 1) v -= 40;
        v = v / bCost(n, b) * 100 + Math.random() * 3; if (v > bv) { bv = v; best = [s.id, b]; }
      }
    }
    if (best && bv > 1) build(n, best[0], best[1]); else break;
  }
  // exército (em dívida, desmobiliza um pouco)
  const myArmies = S.armies.filter(a => a.o === n.id), myR = myArmies.reduce((a, x) => a + regs(x), 0), atWarN = warsOf(n.id).length;
  if (n.money < 0 && n.income < 0 && !atWarN && myArmies.length) { const a = myArmies[0]; a.inf *= .85; a.cav *= .85; a.art *= .85; a.vrt *= .85; }
  const want = clamp((n.popT || 0) * .006 * (atWarN ? 1.5 : 1) * (.7 + IDEOS[n.ideo].war * .25) * (n.money > 3000 ? 1.6 : 1), 2, 1200);
  if (myR + n.rec.reduce((a, r) => a + (r.type !== 'ship' ? r.k : 0), 0) < want && (n.income > 0 || n.money > 500)) {
    const k = Math.max(1, Math.min(Math.floor(n.manpower), Math.ceil((want - myR) / 3)));
    const type = n.vert && chance(.2) && n.mk.sat[VERT[n.vert].good] > .5 ? 'vrt' : canArt(n) && chance(.2) ? 'art' : chance(.25) ? 'cav' : 'inf';
    recruit(n, type, k);
  }
  // frotas: exploração e transporte
  const coastal = provsOf(n.id).filter(p => WD.provs[p].coast);
  if (coastal.length && n.fx.sea) {
    const ships = S.fleets.filter(f => f.o === n.id).reduce((a, f) => a + f.ships, 0);
    const wantS = Math.ceil(myR / 3 * (n.kind === 'cold' || n.fx.col ? .8 : .3)) + 1;
    if (ships < wantS && n.money > shipCost(n) * 3 && n.income > 0) buildShips(n, Math.min(3, wantS - ships), pickR(coastal));
    const fl = S.fleets.filter(f => f.o === n.id); if (fl.length && !fl.some(f => f.auto) && chance(.05) && (n.fx.sea >= 2 || n.kind === 'cold')) { const f = pickR(fl); f.auto = true; }
  }
  // colonização
  if (slow && chance(n.fx.col ? .6 : .15)) {
    const cand = []; for (const p of provsOf(n.id)) for (const o of WD.provs[p].adj) if (S.own[o] === -1) cand.push(o);
    if (n.fx.col) for (let k = 0; k < 40; k++) { const p = WD.provs[Math.random() * WD.provs.length | 0]; if (S.own[p.id] === -1 && n.exP[p.id] && p.coast) cand.push(p.id); }
    if (cand.length) { const p = pickR(cand); if (!canColonize(n, p)) colonize(n, p); }
  }
  // guerra: declarar
  if (slow && !atWarN && n.stab > 35 && n.money > 0 && chance(.018 * IDEOS[n.ideo].war * (GOVS[n.gov].cat === 'Tribal' ? 1.4 : 1))) {
    const nb = new Set(); for (const p of provsOf(n.id)) for (const o of WD.provs[p].adj) { const t = S.own[o]; if (t >= 0 && t !== n.id) nb.add(t); }
    if (n.kind === 'cold' || n.fx.col) S.nations.forEach(t => { if (t.alive && t.id !== n.id && provsOf(t.id).some(p => n.exP[p] && WD.provs[p].coast) && chance(.15)) nb.add(t.id); });
    const myP = myR * (1 + n.m.army) * n.up.inf;
    const targets = [...nb].map(nat).filter(t => t.alive && !(n.truce[t.id] > S.t) && !atWar(n.id, t.id)).map(t => [t, S.armies.filter(a => a.o === t.id).reduce((s, a) => s + regs(a), 0) * (1 + t.m.army) * t.up.inf + 1]).filter(([, pw]) => myP > pw * 1.35);
    if (targets.length) { const [t] = pickR(targets); const st = WD.states.find(s => s.provs.some(p => S.own[p] === t.id) && s.provs.some(p => WD.provs[p].adj.some(o => S.own[o] === n.id))); declareWar(n, t, st ? st.id : null); }
  } else if (slow && !atWarN && !n.fab && chance(.06) && n.money > 80) {
    const st = WD.states.find(s => !n.claims[s.id] && s.provs.some(p => S.own[p] >= 0 && S.own[p] !== n.id && WD.provs[p].adj.some(o => S.own[o] === n.id)));
    if (st) fabricate(n, st.id);
  }
  // guerra: mover exércitos
  if (atWarN) {
    const foes = enemiesOf(n.id);
    for (const a of myArmies) {
      if (a.path.length || a.retreat || a.mor < .5 || a.p >= WD.provs.length) continue;
      const P = WD.provs.length; let best = null, bd = 1e9;
      const seen = new Map([[a.p, 0]]), q = [a.p];
      for (let h = 0; h < q.length && h < 600; h++) {
        const v = q[h], d = seen.get(v);
        if (v !== a.p && foes.includes(S.ctrl[v])) {
          const threat = threatAt(v).filter(b => foes.includes(b.o)).reduce((s, b) => s + regs(b), 0);
          const score = d - (S.own[v] === n.id ? 8 : 0) + (threat > regs(a) * 1.2 ? 99 : 0);
          if (score < bd) { bd = score; best = v; }
        }
        if (d > 14) continue;
        for (const o of WD.provs[v].adj) if (!seen.has(o) && n.exP[o] && canEnter(n.id, o)) { seen.set(o, d + 1); q.push(o); }
      }
      if (best == null && (n.kind === 'cold' || transport(n.id) >= regs(a))) { const fp = provsOf(foes[0]).filter(p => WD.provs[p].coast && n.exP[p]); if (fp.length) best = pickR(fp); }
      if (best != null) orderArmy(a, best);
    }
  } else {
    // em paz: junta os exércitos na capital
    for (const a of myArmies) if (!a.path.length && a.p !== n.capital && a.p < WD.provs.length && chance(.1)) orderArmy(a, n.capital);
    const atCap = myArmies.filter(a => a.p === n.capital && !a.path.length); if (atCap.length > 1) { const m = atCap[0]; atCap.slice(1).forEach(a => { m.inf += a.inf; m.cav += a.cav; m.art += a.art; m.vrt += a.vrt; a.inf = a.cav = a.art = a.vrt = 0; }); S.armies = S.armies.filter(a => regs(a) > .08); }
  }
}

/* ---------- avanço do tempo ---------- */
function advanceDay() {
  if (S.over) return;
  S.t++; dayTick();
  if (S.t % 30 === 0) monthTick();
}
function score(n) { return Math.round((n.popT || 0) / 100 + (n.gdp || 0) / 50 + techCount(n) * 5 + provsOf(n.id).length * 2); }

/* ---------- salvar / carregar ---------- */
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
const unb64 = (s, T = Uint8Array) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };
function saveGame() {
  const o = Object.assign({}, S, { own: b64(new Uint8Array(S.own.buffer)), ctrl: b64(new Uint8Array(S.ctrl.buffer)), pop: b64(new Uint8Array(S.pop.buffer)), news: [], offer: null, mapDirty: undefined,
    nations: S.nations.map(n => Object.assign({}, n, { exP: b64(n.exP), exZ: b64(n.exZ), m: undefined, fx: undefined, up: undefined })) });
  try { localStorage.setItem('chronicle-save', JSON.stringify(o)); return true; } catch (e) { return false; }
}
function loadGame() {
  let o; try { o = JSON.parse(localStorage.getItem('chronicle-save')); } catch (e) { return false; }
  if (!o || o.v !== 1) return false;
  WD = generateWorld(o.seed);
  o.own = unb64(o.own, Int16Array); o.ctrl = unb64(o.ctrl, Int16Array); o.pop = unb64(o.pop, Float32Array);
  o.nations.forEach(n => { n.exP = unb64(n.exP); n.exZ = unb64(n.exZ); });
  S = o; S.news = []; ownChanged(); warsChanged(); S.nations.forEach(n => { if (n.alive) calcMods(n); }); econAll(); return true;
}
const hasSave = () => { try { return !!localStorage.getItem('chronicle-save'); } catch (e) { return false; } };
