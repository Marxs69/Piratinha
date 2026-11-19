/* Grand Chronicle — simulação (sem DOM). Calendário de 360 dias (12 meses de 30).
   Diário: movimento, batalhas e cercos. Mensal: economia, pesquisa, obras, recrutamento, estabilidade, personagens, golpes, guerras, colonização e IA.
   O mundo (mapa) vem de generateWorld(seed); o estado dinâmico fica em S e é salvo. */
'use strict';

let WD = null, S = null;                                    // mundo e estado
const ECON = { costMul: 3, taxBase: .06, upkeep: .25 };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
/* aleatório da partida: mulberry32 com o estado em S.rs (salvo) — mesma seed e mesmas ordens = mesma partida */
const rnd = () => { let t = S.rs = S.rs + 0x6D2B79F5 | 0; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rand = (a, b) => a + rnd() * (b - a);
const chance = p => rnd() < p;
const pickR = a => a[rnd() * a.length | 0];
const rint = k => rnd() * k | 0;
const yearOf = t => START_YEAR + Math.floor(t / 360);
const curYear = () => yearOf(S.t);
const eraScale = () => 1 + (curYear() - 860) / 300;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dateStr = (t = S.t) => (t % 30 + 1) + ' ' + MONTHS[Math.floor(t % 360 / 30)] + ' ' + yearOf(t);
const nat = id => S.nations[id];
const ownName = (n, r, set) => !set || (r === 3 && !(set.f3for || []).includes(n.gov));   // no nível 3 cada governo usa o próprio nome
const rankFmt = (n, r = n.rank || 0) => { const g = GOVS[n.gov], set = RANKSET[g.cat]; return (ownName(n, r, set) ? g.fmt : set.f[r]) || '{}'; };
const rankTitle = (n, r = n.rank || 0) => { const g = GOVS[n.gov], set = RANKSET[g.cat]; return ownName(n, r, set) ? g.t : set.t[r]; };
const natName = n => rankFmt(n).replace('{}', n.name);
const FEM = { 'Rei': 'Rainha', 'Rei eleito': 'Rainha eleita', 'Imperador': 'Imperatriz', 'Chefe supremo': 'Chefe suprema', 'Sumo-sacerdote': 'Suma-sacerdotisa', 'Grão-mestre': 'Grã-mestra', 'Caudilho': 'Caudilha', 'Diretor técnico': 'Diretora técnica', 'Secretário-geral': 'Secretária-geral', 'Arquissábio': 'Arquissábia', 'Delegado': 'Delegada', 'Presidente do congresso': 'Presidenta do congresso', 'Mediador': 'Mediadora', 'Líder supremo': 'Líder suprema', 'Cônsul': 'Cônsul', 'Doge': 'Dogaresa', 'Cã': 'Cátum', 'Barão': 'Baronesa', 'Conde': 'Condessa', 'Duque': 'Duquesa', 'Grão-cã': 'Grã-cátum', 'Prefeito': 'Prefeita', 'Burgomestre': 'Burgomestra', 'Primeiro Cidadão': 'Primeira Cidadã', 'Comissário': 'Comissária', 'Secretário regional': 'Secretária regional', 'Prior': 'Prioresa', 'Bispo': 'Bispa', 'Arcebispo': 'Arcebispa', 'Governador militar': 'Governadora militar', 'Protetor': 'Protetora', 'Engenheiro-chefe': 'Engenheira-chefe', 'Supervisor': 'Supervisora', 'Diretor': 'Diretora', 'Arquiteto supremo': 'Arquiteta suprema', 'Monarca': 'Monarca', 'Alto rei': 'Alta rainha', 'Primeiro-ministro': 'Primeira-ministra' };
const titleOf = (n, c = n.ruler) => { const t = rankTitle(n); return c && c.f ? (FEM[t] || t) : t; };
const log = (m, k = 'info', who = []) => { S.log.unshift({ d: dateStr(), m, k }); if (S.log.length > 120) S.log.pop(); if (who.includes(S.player) || k === 'world') S.news.push({ m, k }); };

/* ---------- personagens ---------- */
function mkChar(n, o = {}) {
  const cul = CULTURES[n.cul], fr = n.laws && LAWS.women.o[n.laws.women] ? LAWS.women.o[n.laws.women].fr : .08, f = o.f != null ? o.f : (o.ruler && !chance(fr) ? false : chance(.5));
  const age = o.age != null ? o.age : (o.ruler ? 18 + (rnd() * 35 | 0) : 20 + (rnd() * 40 | 0));
  const st = {}; ['dip', 'mar', 'adm', 'int', 'lea'].forEach(k => st[k] = Math.round(clamp(rand(2, 14) + (o.boost === k ? 5 : 0), 0, 20)));
  const tids = Object.keys(TRAITS), tr = []; while (tr.length < 2 + (chance(.4) ? 1 : 0)) { const t = pickR(tids); if (!tr.includes(t)) tr.push(t); }
  const ids = n.fx ? [...n.fx.i] : ['trad', 'warrior'], ld = chance(.35) ? n.ideo || 'trad' : pickR(ids);
  return leanOf(n, { n: pickR(f ? cul.f : cul.m), dyn: o.dyn || n.dyn, f, born: curYear() - age, st, tr, ld });
}
/* inclinação de cada personagem: uma forma de governo e uma lei — sempre entre as que o país já pode adotar */
function leanOf(n, c) {
  c.lg = null; c.ll = null; if (!n.fx || !n.laws) return c;
  if (chance(.5)) { const tribal = GOVS[n.gov].cat === 'Tribal', gs = [...new Set([...n.fx.g, ...BASE_GOVS])].filter(g => g !== n.gov && GOVS[g] && govOk(n, g) && (tribal || GOVS[g].cat !== 'Tribal')); if (gs.length) c.lg = pickR(gs); }
  if (chance(.6)) {
    const opts = []; for (const k in LAWS) for (const o in LAWS[k].o) if (o !== n.laws[k] && lawOk(n, k, o)) opts.push({ k, o });
    if (opts.length) c.ll = pickR(opts);
  }
  return c;
}
const lawOk = (n, k, o) => { const d = LAWS[k] && LAWS[k].o[o]; return !!d && (!d.req || hasT(n, d.req)); };
const ageOf = c => curYear() - c.born;
const charName = c => c.n + ' ' + c.dyn;
function newDynasty(n) { const cul = CULTURES[n.cul]; let s = pickR(cul.a) + pickR(cul.b); return s.charAt(0).toUpperCase() + s.slice(1); }

/* ---------- criação do jogo ---------- */
function hsl(h, s, l) { const a = s * Math.min(l, 1 - l), f = k => { const x = (k + h * 12) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(x - 3, 9 - x, 1)))); }; return [f(0), f(8), f(4)]; }

function newGame(seed, y0 = START_YEAR) {
  WD = generateWorld(seed); ownCache = null; warSet = null;
  const P = WD.provs.length, r = mkRng(seed ^ 0x5eed);
  S = { v: 2, rs: (seed ^ 0x2545F491) | 0, moon: null, seed, y0, t: 360 * (y0 - START_YEAR), player: -1, nations: [], own: new Int16Array(P).fill(-1), ctrl: new Int16Array(P).fill(-1), pop: new Float32Array(P), bld: WD.states.map(() => ({})),
        armies: [], fleets: [], wars: [], cols: [], sieges: {}, log: [], news: [], id: 1, wp: {}, over: false };
  GOOD_IDS.forEach(g => S.wp[g] = GOODS[g].p);
  const stAdj = WD.states.map(() => new Set());
  WD.provs.forEach(p => p.adj.forEach(o => { const a = p.state, b = WD.provs[o].state; if (a !== b) stAdj[a].add(b); }));
  const usedN = new Set(), hueBase = r();
  const mkNation = (cul, home, kind) => {
    const id = S.nations.length, name = nameGen(CULTURES[cul], r, usedN);
    const h = (hueBase + id * .618034) % 1, col = hsl(h, .4 + r() * .3, .42 + r() * .16);
    const n = { id, name, cul, home, kind, col, flag: flagRandom(r), gov: 'feudal', ideo: 'trad', money: 120, stab: 55, manpower: 5, techs: {}, res: null, rp: 0, vert: null, vlv: 0,
                alive: true, claims: {}, truce: {}, rel: {}, allies: [], marr: [], trade: [], emb: [], cd: {}, cons: [], rec: [], fab: null, wex: 0, mk: { sup: {}, dem: {}, sat: {}, imp: {}, exp: {} }, inc: {}, exP: new Uint8Array(P), exZ: new Uint8Array(WD.seas.length), capital: -1 };
    n.dyn = newDynasty(n); n.vpref = r() < .6 ? null : VERTS[r() * VERTS.length | 0].id; S.nations.push(n); return n;
  };
  const adv = y0 > START_YEAR, grantTechs = (n, maxY, extra = []) => { n.techY = maxY; grantUntil(n, maxY); extra.forEach(e => n.techs[e] = 1); };
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
      { const ns = statesOf(n); n.rank = [0, 1, 2, 3].find(r => rankCap(n, r) >= ns); if (n.rank == null) n.rank = 3; }
      if (n.kind === 'main') { grantTechs(n, adv ? y0 - (r() * 12 | 0) : 880 + (r() * 40 | 0)); n.gov = pickR(['feudal', 'feudal', 'feudal', 'feudal', 'elective', 'elective', 'tribal', 'theocracy']); n.ideo = chance(.25) ? 'warrior' : 'trad'; n.money = 160; }
      else if (n.kind === 'cold') { grantTechs(n, adv ? y0 - 10 - (r() * 25 | 0) : 860, ['nav_longship']); n.gov = pickR(['tribal', 'tribal', 'tribal_conf']); n.ideo = 'warrior'; n.money = 90; }
      else { grantTechs(n, adv ? y0 - 15 - (r() * 35 | 0) : 860); if (!adv && chance(.4)) delete n.techs.nav_longship; n.gov = pickR(['tribal', 'tribal', 'tribal', 'tribal_conf', 'horde', 'feudal']); n.ideo = chance(.3) ? 'warrior' : 'trad'; n.money = 60; }
      if (n.gov === 'theocracy') n.flag.c = { k: pickR(['cross_patty', 'sun', 'eye', 'crescent', 'star8']), t: TINCT[n.flag.t[0]].metal ? 'gules' : 'or', n: 1, at: 'center' };
      n.ruler = mkChar(n, { ruler: true }); if (GOVS[n.gov].succ === 'hered') { n.spouse = mkChar(n, { f: !n.ruler.f, dyn: newDynasty(n), age: ageOf(n.ruler) - 3 }); n.kids = []; if (ageOf(n.ruler) > 24) for (let k = 0; k < 1 + (r() * 3 | 0); k++) n.kids.push(mkChar(n, { age: Math.max(0, ageOf(n.ruler) - 20 - (r() * 8 | 0)) })); }
      n.council = {}; COUNCIL.forEach(([k, , s]) => n.council[k] = mkChar(n, { boost: s, dyn: newDynasty(n) }));
    });
  });
  // população: mais densa no principal; terra livre tem nativos
  WD.provs.forEach(p => {
    const c = WD.conts[p.cont], o = S.own[p.id], base = p.size * TERRAIN[p.terr].pop;
    S.pop[p.id] = base * (c.main ? rand(1.3, 1.9) : c.cold ? rand(.35, .6) : o >= 0 ? rand(.5, .9) : rand(.12, .35));
    if (adv) { const cap = base * 4 * (1 + (y0 > 1800 ? (y0 - 1800) / 120 : 0)) + 3; S.pop[p.id] = Math.min(cap * .85, S.pop[p.id] * (1 + (y0 - 860) / 450 * (c.main ? 1 : o >= 0 ? .7 : .3))); }   // começo avançado: séculos de crescimento
  });
  // prédios iniciais, exércitos e frotas
  S.nations.forEach(n => {
    const mine = WD.states.filter(s => S.own[s.cap] === n.id);
    mine.forEach(s => {
      const b = S.bld[s.id], k = n.kind === 'main' ? .45 : .2;
      b.farm = Math.max(1, Math.round(s.caps.farm * k)); if (s.caps.lumber) b.lumber = 1; if (s.caps.fishery && n.kind !== 'far') b.fishery = 1;
      if (n.kind === 'main' && s.caps.iron_mine) b.iron_mine = 1; if (n.kind === 'main' && chance(.4)) b.workshop = 1; if (n.kind === 'main' && chance(.45)) b.smithy = 1; if (n.kind === 'main' && chance(.3)) b.weaver = 1;
      if (n.kind === 'main' && chance(.25)) b.tailor = 1; if (n.kind === 'main' && chance(.2)) b.bakery = 1;
      if (s.provs.includes(n.capital)) { b.castle = 1; if (n.kind === 'main') b.temple = 1; }
      const rich = n.kind === 'main' ? 2.4 : n.kind === 'cold' ? .9 : .7;   // desenvolvimento inicial: serviços e estradas conforme a riqueza
      ['hospital', 'school', 'office', 'guard'].forEach(k => { const v = Math.floor(rnd() * rich + (s.provs.includes(n.capital) ? 1 : 0)); if (v > 0) b[k] = v; });
      if (n.kind === 'main' && chance(.5)) b.road = 1;
    });
    const pop = provsOf(n.id).reduce((a, p) => a + S.pop[p], 0);
    const regs = Math.max(2, Math.round(pop * (n.kind === 'cold' ? .012 : .005)));
    addArmy(n.id, n.capital, { inf: Math.ceil(regs * .75), cav: Math.floor(regs * .25) });
    n.manpower = pop * .01; n.mpMax = pop * .03;
    const coastal = provsOf(n.id).find(p => WD.provs[p].coast);
    if (n.techs.nav_longship && coastal != null) addFleet(n.id, WD.provs[coastal].seas[0], n.kind === 'cold' ? 10 : n.kind === 'main' ? 3 : 2);
    initExplore(n);
    calcMods(n); [n.ruler, n.spouse, ...Object.values(n.council)].forEach(c => c && leanOf(n, c));
  });
  initCul(); initRelig(); S.rebels = {};
  S.nations.forEach(n => S.nations.forEach(o => { if (o !== n) n.rel[o.id] = 0; }));
  S.moon = generateMoon(seed);
  if (adv) advanceStart(y0, r);
  econAll(); S.news = [];
  log('O ano é ' + y0 + '. As crônicas começam.', 'world');
  return S;
}
/* cultura de cada província (muda com assimilação); culturas menores nascem em bolsões fora das capitais */
function initCul() {
  S.culg = new Uint8Array(WD.provs.length); WD.provs.forEach(p => { S.culg[p.id] = p.cul; });
  const r = mkRng(S.seed ^ 0xc017), caps = new Set(S.nations.map(n => WD.provs[n.capital >= 0 ? n.capital : 0].state)), minors = CULTURES.map((c, i) => c.minor ? i : -1).filter(i => i >= 0);
  const k = Math.max(minors.length, Math.round(WD.states.length / 22));
  for (let i = 0, t = 0; i < k && t < 500; t++) {
    const st = WD.states[r() * WD.states.length | 0]; if (caps.has(st.id) || WD.conts[st.cont].cold) continue;
    const c = i < minors.length ? minors[i] : minors[r() * minors.length | 0]; i++;
    st.provs.forEach(p => { if (r() < .85) S.culg[p] = c; });
    if (r() < .5) { const nb = WD.provs[st.cap].adj.map(o => WD.provs[o].state).find(x => x !== st.id && !caps.has(x)); if (nb != null) WD.states[nb].provs.forEach(p => { if (r() < .5) S.culg[p] = c; }); }
  }
}
/* tecnologias da árvore normal até um ano (respeitando pré-requisitos; com vertente, as substituídas ficam de fora) */
function grantUntil(n, maxY) {
  const V = n.vert && VERT[n.vert];
  for (let ch = true; ch;) { ch = false; for (const t of TECHS) { if (t.v || n.techs[t.id] || t.y > maxY || (V && t.c !== 'soc' && t.y > V.entry.y) || !t.req.every(q => n.techs[q] || (n.eff && n.eff.has(q)))) continue; n.techs[t.id] = 1; ch = true; } }
}
/* escolhe, troca ou desfaz a vertente na criação do mundo: árvore até o nível do país e prédios da vertente */
function setVertStart(n, v) {
  for (const id in n.techs) if (TECH[id] && TECH[id].v) delete n.techs[id];
  n.vert = null; n.vlv = 0; n.eff = null;
  for (const st of WD.states) if (stateOwnerOf(st.id) === n.id) { const B = S.bld[st.id]; for (const b in B) if (BUILDINGS[b].vert && BUILDINGS[b].vert !== v) delete B[b]; }
  if (v) {
    const V = VERT[v]; n.vert = v; n.techs['v_' + v] = 1;
    for (const id in n.techs) { const t = TECH[id]; if (t && !t.v && t.c !== 'soc' && t.y > V.entry.y) delete n.techs[id]; }
    for (let ch = true; ch;) { ch = false; for (const t of TECHS) if (t.v === v && t.vt && !n.techs[t.id] && t.y <= (n.techY || curYear()) && t.req.every(q => n.techs[q])) { n.techs[t.id] = 1; ch = true; } }
    calcMods(n);
    const cs = WD.states[WD.provs[n.capital].state]; if (!S.bld[cs.id][V.bld]) S.bld[cs.id][V.bld] = 1;
  } else grantUntil(n, n.techY || curYear());
  calcMods(n); return '';
}
const vertStartOpts = n => VERTS.filter(v => v.entry.y <= (n.techY || curYear()) && vertNeedOk(n, v.id));
/* abandonar a vertente no meio do jogo: guarda o progresso equivalente da árvore normal, perde os prédios e os bônus */
const dropVertCost = () => Math.round(200 * eraScale());
function dropVert(n) {
  if (!n.vert) return 'Sem vertente'; if (n.money < dropVertCost()) return 'Sem dinheiro';
  const old = VERT[n.vert];
  for (const id in n.techs) { const t = TECH[id]; if (t && t.v) { (t.src || []).forEach(x => n.techs[x] = 1); delete n.techs[id]; } }
  for (const st of WD.states) if (stateOwnerOf(st.id) === n.id) { const B = S.bld[st.id]; for (const b in B) if (BUILDINGS[b].vert) delete B[b]; }
  n.cons = n.cons.filter(c => !BUILDINGS[c.b].vert); S.armies.forEach(a => { if (a.o === n.id && a.vrt) { a.inf += a.vrt; a.vrt = 0; } });
  if (n.res && TECH[n.res].v) n.res = null;
  n.money -= dropVertCost(); n.stab = Math.max(0, n.stab - 20); n.vert = null; n.vertCd = S.t + 360 * 20; calcMods(n);
  log(natName(n) + ' abandonou a vertente ' + old.n + '.', n.id === S.player ? 'info' : 'world', [n.id]); return '';
}
/* começo em era avançada: vertentes, governos da época, prédios, colônias e mapa conhecido */
const govYear = g => BASE_GOVS.includes(g) ? 860 : (TECHS.find(t => (t.fx.g || []).includes(g)) || { y: 860 }).y;
function advanceStart(Y, r) {
  const devPick = ['farm', 'fishery', 'lumber', 'iron_mine', 'quarry', 'plantation', 'smithy', 'weaver', 'tailor', 'bakery', 'workshop', 'temple', 'mill', 'market', 'road', 'hospital', 'school', 'office', 'guard', 'port', 'university', 'jeweler', 'coal_mine', 'gold_mine', 'copper_mine', 'foundry', 'manufactory', 'textile_manuf', 'blast_furnace', 'barracks', 'shipyard', 'academy',
    'railway', 'textile_mill', 'goods_factory', 'garment_factory', 'food_factory', 'tool_factory', 'arms_factory', 'steel_mill', 'power_plant', 'hydro', 'oil_well'];
  S.plagueDone = Y >= 1340 ? { done: {} } : null;
  S.nations.forEach(n => {
    if (n.kind === 'main' && chance(n.vpref ? .7 : .3)) { const o = vertStartOpts(n); if (o.length) { const v = o.find(x => x.id === n.vpref) || pickR(o); setVertStart(n, v.id); } }
    calcMods(n);
    // governo e ideologia da época (só o que a tecnologia já liberou)
    const cat = GOVS[n.gov].cat, opts = [...new Set([...n.fx.g, ...BASE_GOVS])].filter(g => govOk(n, g) && (n.kind === 'main' || GOVS[g].cat === cat || chance(.3)));
    const sc = g => (GOVS[g].cat === cat ? 120 : 0) + (n.kind === 'main' && Y >= 1100 && GOVS[g].cat === 'Monarquia' ? 140 : 0) - (n.kind === 'main' && GOVS[g].cat === 'Tribal' ? 200 : 0) + govYear(g) * .25 + r() * 160; const g = opts.sort((a, b) => sc(b) - sc(a))[0];
    if (g && g !== n.gov) { const her = GOVS[n.gov].succ === 'hered'; applyGov(n, g); if (her !== (GOVS[g].succ === 'hered')) succeed(n, false); }
    if (Y >= 1453 && chance(.6)) { const io = [...n.fx.i].sort((a, b) => (TECHS.find(t => (t.fx.i || []).includes(b)) || { y: 0 }).y - (TECHS.find(t => (t.fx.i || []).includes(a)) || { y: 0 }).y); if (io.length) n.ideo = io[Math.min(io.length - 1, r() * 3 | 0)]; }
    for (const k in LAWS) if (chance(.4)) { const os = Object.keys(LAWS[k].o).filter(o => lawOk(n, k, o) && !(k === 'slavery' && o === 'legal')); if (os.length) n.laws[k] = os[os.length - 1 - (r() * Math.min(2, os.length) | 0)]; }
    calcMods(n);
    // prédios: várias rodadas de construção grátis, limitadas por terra, recursos e mão de obra
    const passes = Math.round((Y - 860) / 70 * (n.kind === 'main' ? 1 : n.kind === 'cold' ? .75 : .65)), keepM = n.money, keepS = n.xslots; n.money = 1e12; n.xslots = 1e6;
    const sts = WD.states.filter(st => stateOwnerOf(st.id) === n.id), avail = devPick.filter(b => n.fx.b.has(b)).concat(n.vert ? [VERT[n.vert].bld] : []);
    for (let k = 0; k < passes; k++) for (const st of sts) for (const b of avail) if (!canBuild(n, st.id, b)) S.bld[st.id][b] = (S.bld[st.id][b] || 0) + 1;
    n.money = keepM * eraScale() * (n.kind === 'main' ? 4 : 2); n.xslots = keepS;
    const f = 1 + (Y - 860) / 300; S.armies.forEach(a => { if (a.o === n.id) { a.inf *= f; a.cav *= f * .8; if (canArt(n)) a.art = a.inf * .15; a.max = regs(a); } });
    S.fleets.forEach(fl => { if (fl.o === n.id) fl.ships = Math.ceil(fl.ships * (1 + (Y - 860) / 400)); });
    [n.ruler, n.spouse, ...Object.values(n.council)].forEach(c => c && leanOf(n, c));
  });
  // colônias e mapa conhecido a partir das Grandes Navegações
  if (Y >= 1500) S.nations.filter(n => n.kind === 'main' && n.fx.col >= 1 && provsOf(n.id).some(p => WD.provs[p].coast)).forEach(n => {
    const clusters = Math.floor((Y - 1490) / 70 * (.5 + r())), size = 3 + Math.round((Y - 1490) / 90);
    for (let c = 0; c < clusters; c++) {
      const seed = WD.provs.filter(p => p.cont !== n.home && p.coast && S.own[p.id] === -1 && !WD.conts[p.cont].cold); if (!seed.length) break;
      const p0 = pickR(seed).id, got = [p0]; for (let h = 0; h < got.length && got.length < size; h++) for (const o of WD.provs[got[h]].adj) if (S.own[o] === -1 && !got.includes(o) && got.length < size) got.push(o);
      if (statesOf(n, got) > domCap(n)) break;
      got.forEach(p => { S.own[p] = n.id; S.ctrl[p] = n.id; S.pop[p] = Math.max(2, S.pop[p] * .5 + 1.5); explore(n, p); });
      WD.provs.forEach(p => { if (p.cont === WD.provs[p0].cont && p.coast && chance(.6)) { n.exP[p.id] = 1; p.seas.forEach(z => n.exZ[z] = 1); } });
    }
    ownChanged();
  });
  if (Y >= 1453) S.nations.filter(n => n.kind === 'main').forEach(n => { const k = clamp((Y - 1453) / 350, .1, .9); WD.provs.forEach(p => { if (p.coast && chance(k)) { n.exP[p.id] = 1; p.seas.forEach(z => n.exZ[z] = 1); } }); WD.seas.forEach(z => { if (z.provs.some(p => n.exP[p])) n.exZ[z.id] = 1; }); });
  ownChanged(); S.nations.forEach(n => { if (n.alive) { n.relig = S.relg[n.capital]; calcMods(n); } });
  econAll(); S.nations.forEach(n => { if (n.alive) calcMods(n); });
}
function initRelig() {                                       // religião de cada província pela cultura (com variantes regionais)
  if (!S.culg) initCul();
  S.relg = new Uint8Array(WD.provs.length); const r = mkRng(S.seed ^ 0x2e1);
  WD.provs.forEach(p => { const c = S.culg[p.id], C = CULTURES[c]; S.relg[p.id] = REL_IDS.indexOf(C.minor ? (r() < .75 ? C.rel : (CUL_REL[p.cul] || 'roman')) : (p.region % 5 === 0 ? CUL_REL2 : CUL_REL)[c]); });
  ['gnostic', 'manich', 'serpent', 'tengri'].forEach(rl => { for (let i = 0; i < 2; i++) { const st = WD.states[r() * WD.states.length | 0]; st.provs.forEach(p => { if (r() < .6) S.relg[p] = REL_IDS.indexOf(rl); }); } });
  S.nations.forEach(n => { n.relig = S.relg[n.capital >= 0 ? n.capital : 0]; provsOf(n.id).forEach(p => { if (rnd() < .75 && !CULTURES[S.culg[p]].minor) S.relg[p] = n.relig; }); });   // a fé do Estado já domina quase tudo em 860 (menos nos bolsões menores)
}
function initExplore(n) {
  WD.provs.forEach(p => { if (p.cont === n.home) { n.exP[p.id] = 1; p.seas.forEach(z => n.exZ[z] = 1); } });
  // fronteira por terra perto de outro continente: o pedaço vizinho dele também é conhecido
  { const own = provsOf(n.id), d1 = new Map(own.map(p => [p, 0])), q = [...own], entry = [];
    for (let h = 0; h < q.length; h++) { const v = q[h], d = d1.get(v); if (WD.provs[v].cont !== n.home) { entry.push(v); continue; } if (d >= 4) continue; for (const o of WD.provs[v].adj) if (!d1.has(o)) { d1.set(o, d + 1); q.push(o); } }
    const d2 = new Map(entry.map(p => [p, 0])), q2 = [...entry];
    for (let h = 0; h < q2.length; h++) { const v = q2[h], d = d2.get(v); n.exP[v] = 1; WD.provs[v].adj.forEach(o => n.exP[o] = 1); if (d >= 6) continue; for (const o of WD.provs[v].adj) if (!d2.has(o) && WD.provs[o].cont === WD.provs[v].cont) { d2.set(o, d + 1); q2.push(o); } } }
  if (n.kind === 'cold') { const main = WD.conts.find(c => c.main); WD.provs.forEach(p => { if (p.cont === main.id && p.coast) n.exP[p.id] = 1; }); }
  if (n.kind === 'main') { const cold = WD.conts.find(c => c.cold); WD.provs.forEach(p => { if (p.cont === cold.id && p.coast && chance(.5)) n.exP[p.id] = 1; }); }
  // mares que ligam as terras conhecidas
  WD.seas.forEach(z => { if (z.provs.some(p => n.exP[p])) n.exZ[z.id] = 1; });
}

/* ---------- consultas ---------- */
let ownCache = null;                                         // listas de províncias por dono (refeitas quando muda dono)
function provsOf(id) { if (!ownCache) { ownCache = S.nations.map(() => []); for (let p = 0; p < S.own.length; p++) if (S.own[p] >= 0) ownCache[S.own[p]].push(p); } return ownCache[id] || []; }
function ownChanged() { ownCache = null; S.mapDirty = true; enterC = null; }
const hasTech = (n, id) => !!n.techs[id];
let warSet = null;                                          // pares em guerra (refeito quando guerras começam ou acabam)
const warsChanged = () => { warSet = null; enterC = null; };
const atWar = (a, b) => { if (a === b || a < 0 || b < 0) return false; if (!warSet) { warSet = new Set(); S.wars.forEach(w => w.A.forEach(x => w.D.forEach(y => { warSet.add(x * 4096 + y); warSet.add(y * 4096 + x); }))); } return warSet.has(a * 4096 + b); };
const warsOf = id => S.wars.filter(w => w.A.includes(id) || w.D.includes(id));
const enemiesOf = id => [...new Set(warsOf(id).flatMap(w => w.A.includes(id) ? w.D : w.A))];
const regs = a => a.inf + a.cav + a.art + a.vrt;
function stateOwnerOf(s) { return S.own[WD.states[s].cap]; }
function fortOf(p) {
  const pr = WD.provs[p], st = WD.states[pr.state], o = S.own[p]; let f = 0;
  if (st.cap === p && stateOwnerOf(st.id) === o) f += S.bld[st.id].castle || 0;
  if (o >= 0 && nat(o).capital === p) f += 2;
  return f;
}
const hasT = (n, id) => n.eff ? n.eff.has(id) : !!n.techs[id];     // pesquisada direto ou trazida pela árvore da vertente
const techCount = n => n.eff ? n.eff.size : Object.keys(n.techs).length;
const vertLen = v => VERT[v].len;

/* ---------- modificadores ---------- */
/* efeitos de tecnologia que não são modificadores (prédios, governos, mares...) e normalização das leis */
function calcFx(n) {
  const fx = { sea: 0, col: 0, fort: 0, slots: 1, ship: 1, bo: {}, up: { inf: 1, cav: 1, art: 1, siege: 1 }, b: new Set(Object.keys(BUILDINGS).filter(b => !BUILDINGS[b].tech && !BUILDINGS[b].vert)), g: new Set(), i: new Set(['trad', 'warrior']) };
  const eff = new Set(Object.keys(n.techs)); let vl = 0;
  for (const id in n.techs) { const t = TECH[id]; if (t && t.v) { vl++; (t.src || []).forEach(x => eff.add(x)); } }
  n.eff = eff; n.vlv = vl;
  for (const id of eff) {
    const t = TECH[id]; if (!t) continue; const f = t.fx;
    if (f.sea) fx.sea = Math.max(fx.sea, f.sea); if (f.col) fx.col += f.col; if (f.fort) fx.fort += f.fort; if (f.slots) fx.slots += f.slots; if (f.ship) fx.ship += f.ship;
    if (f.bo) for (const k in f.bo) fx.bo[k] = (fx.bo[k] || 0) + f.bo[k]; if (f.u) for (const k in f.u) fx.up[k] = (fx.up[k] || 0) + f.u[k];
    (f.b || []).forEach(b => fx.b.add(b)); (f.g || []).forEach(g => fx.g.add(g)); (f.i || []).forEach(i => fx.i.add(i));
  }
  n.laws = Object.assign({}, LAW_DEF, n.laws || {}); for (const k in LAWS) if (!LAWS[k].o[n.laws[k]]) n.laws[k] = LAW_DEF[k];
  return fx;
}
/* fontes de modificadores: TODO bônus do país passa por aqui, com rótulo — a soma (calcMods) e o detalhamento (modBreak) saem da mesma lista.
   Cada fonte devolve pares [rótulo, {mod: valor}]; a ordem é fixa (somas em ponto flutuante dependem dela). */
const STAT_MOD = [['adm', 'tax', .008, .006], ['lea', 'research', .008, .006], ['mar', 'army', .008, .006], ['dip', 'stab', .004, .003]];
const COUNCIL_STAT = { steward: 'adm', scholar: 'lea', marshal: 'mar', chancellor: 'dip' };
const MOD_SOURCES = [
  n => [['Governo: ' + GOVS[n.gov].n, GOVS[n.gov].m], ['Ideologia: ' + IDEOS[n.ideo].n, IDEOS[n.ideo].m]],
  n => [...n.eff].filter(id => TECH[id] && TECH[id].fx.m).map(id => ['Tecnologia: ' + TECH[id].n, TECH[id].fx.m]),
  n => { if (!n.vert) return []; const v = VERT[n.vert], o = {}; for (const k in v.m) o[k] = v.m[k] * n.vlv / v.len * (.5 + .5 * (n.vsat == null ? 1 : n.vsat)); return [['Vertente: ' + v.n, o]]; },
  n => [n.ruler, ...Object.values(n.council || {})].flatMap(c => c ? c.tr.filter(t => TRAITS[t]).map(t => ['Traço ' + TRAITS[t].n + ' (' + charName(c) + ')', TRAITS[t].m]) : []),
  n => { const R = n.ruler, C = n.council || {}, out = [];
    if (R) { const o = {}; STAT_MOD.forEach(([s, k, w]) => o[k] = (R.st[s] - 8) * w); out.push(['Atributos do governante', o]); }
    STAT_MOD.forEach(([s, k, , w]) => { const role = Object.keys(COUNCIL_STAT).find(r => COUNCIL_STAT[r] === s), c = C[role]; if (c) out.push(['Conselho: ' + COUNCIL.find(x => x[0] === role)[1], { [k]: (c.st[s] - 8) * w }]); });
    if (C.spymaster) out.push(['Conselho: ' + COUNCIL.find(x => x[0] === 'spymaster')[1], { coup: -(C.spymaster.st.int - 8) * .04 }]);
    if (R) out.push(['Atributos do governante', { coup: -(R.st.int - 8) * .02 }]);
    return out; },
  n => { const gd = GOVS[n.gov], out = []; if (gd.until && curYear() > gd.until) out.push(['Governo ultrapassado', { stab: -.1 }]); if (gd.minRank && (n.rank || 0) < gd.minRank) out.push(['Título baixo para o governo', { stab: -.1 }]); return out; },
  n => Object.keys(LAWS).map(k => ['Lei: ' + LAWS[k].n + ' — ' + LAWS[k].o[n.laws[k]].n, LAWS[k].o[n.laws[k]].m]),
  n => { const cv = n.cov || {}; return [['Serviços públicos', { growth: (cv.health || 0) * .5, research: (cv.edu || 0) * .3, tax: (cv.adm || 0) * .15, coup: -(cv.sec || 0) * .6 }]]; },
  n => { const bf = n.bfx || {}; return [['Prédios', { army: Math.min(.3, bf.army || 0), manpower: Math.min(.4, bf.mp || 0) }]]; },
  n => n.sats ? [['Satélites', { research: Math.min(20, n.sats) * .01, trade: Math.min(20, n.sats) * .005 }]] : [],
  n => S.moon && S.moon.base[n.id] ? [['Base lunar', { research: .05 }]] : [],
  n => n.alienTrade ? [['Comércio com a lua', { research: .05 * n.alienTrade }]] : [],
  n => { const cs = n.csat, cl = n.cls; if (!(cs && cl && n.popT)) return []; const mid = cl.mid / n.popT;   // a média pesquisa e paga impostos; a alta insatisfeita conspira
    return [['Classes sociais', { research: mid * .8 * cs.mid, tax: mid * .5 * cs.mid + (cs.high - .7) * .1, coup: Math.max(0, 1 - cs.high) * 1.2 }]]; },
  n => (n.tmods || []).filter(x => x.u > S.t).map(x => ['Evento: ' + x.l, x.m]),          // modificadores temporários (EFF.mod)
];
const modList = n => MOD_SOURCES.flatMap(f => f(n)).filter(x => x[1]);
/* de onde vem um modificador: [[rótulo, valor]] somando fontes com o mesmo rótulo */
function modBreak(n, k) {
  const acc = new Map(); for (const [l, o] of modList(n)) if (o[k]) acc.set(l, (acc.get(l) || 0) + o[k]);
  return [...acc].filter(x => Math.abs(x[1]) > 1e-9).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
}
function calcMods(n) {
  const fx = calcFx(n), m = {}; Object.keys(MODS).forEach(k => m[k] = 0); m.coup = 0;
  for (const [, o] of modList(n)) for (const k in o) m[k] = (m[k] || 0) + o[k];
  n.m = m; n.fx = fx;
  const up = fx.up, um = n.vert && VUNITS[n.vert] ? VUNITS[n.vert].um : { inf: 1, cav: 1, art: 1 };
  n.up = { inf: up.inf * um.inf, cav: up.cav * um.cav, art: up.art * um.art, siege: up.siege, vrt: n.vert ? (up.inf * (1.5 + 1.75 * n.vlv / VERT[n.vert].len)) * (.5 + .5 * (n.vsat == null ? 1 : n.vsat)) : 0 };
}
function vRoster(n, type) {                                  // nome da tropa própria da vertente pelo progresso na árvore
  const V = n.vert && VUNITS[n.vert]; if (!V || !V[type]) return null; const pr = n.vlv / VERT[n.vert].len;
  let nm = V[type][0][1]; for (const [x, t] of V[type]) if (pr >= x) nm = t; return nm;
}
function unitName(n, type) {
  if (type === 'vrt') { if (!n.vert) return '—'; const v = VERT[n.vert]; return v.unit[Math.min(v.unit.length - 1, Math.floor((n.vlv - 1) / v.len * v.unit.length))]; }
  const v = vRoster(n, type); if (v) return v;
  let nm = UNITS[type][0][1]; for (const [t, x] of UNITS[type]) if (hasT(n, t)) nm = x; return nm;
}
function shipName(n) { const v = n.vlv > 1 && vRoster(n, 'ship'); if (v) return v; let nm = SHIPS[0][1]; for (const [t, x] of SHIPS) if (hasT(n, t)) nm = x; return nm; }
const canArt = n => hasT(n, 'mil_trebuchet');

/* ---------- economia ---------- */
const jobGroup = b => b === 'market' || b === 'port' || b === 'jeweler' ? 'trade' : bGroupOf(b);
const laborShare = n => LAWS.women.o[(n.laws || LAW_DEF).women].lab;
function econAll() {
  const year = curYear(), wsup = {}, wdem = {}, CN = {}, expBy = {}; CLASS_IDS.forEach(k => CN[k] = classNeeds(year, k));
  GOOD_IDS.forEach(g => { wsup[g] = 0; wdem[g] = 0; });
  // população controlada por nação e por estado
  const statePop = new Map(), natStates = S.nations.map(() => new Set()); S.scov = S.scov || {}; if (!S.stSpd) S.stSpd = new Float32Array(WD.states.length);
  for (let p = 0; p < S.own.length; p++) { const o = S.own[p]; if (o < 0 || S.ctrl[p] !== o) continue; const st = WD.provs[p].state, k = st * 1000 + o; statePop.set(k, (statePop.get(k) || 0) + S.pop[p]); natStates[o].add(st); }
  if (!WD.states[0].fert) WD.states.forEach(st => { st.fert = st.provs.reduce((a, p) => a + TERRAIN[WD.provs[p].terr].food, 0) / st.provs.length; st.capK = st.provs.reduce((a, p) => a + WD.provs[p].size * TERRAIN[WD.provs[p].terr].pop * 4, 0) + 3; });
  S.nations.forEach(n => {
    if (!n.alive) return;
    const sup = {}, dem = {}; GOOD_IDS.forEach(g => { sup[g] = 0; dem[g] = 0; });
    let popT = 0, employedT = 0, ports = 0, mkts = 0, univ = 0, temples = 0, gdp = 0, svcLv = 0, slaveJobs = 0;
    const cov = { health: 0, edu: 0, adm: 0, sec: 0 }, bfx = { army: 0, mp: 0, launch: 0 }, svcMul = LAWS.spend.o[(n.laws || LAW_DEF).spend].svc, capSvc = SVC_CAP(year);
    const bo = n.fx.bo, prodM = 1 + n.m.prod, sat = n.mk.sat, lab = laborShare(n), jobs = {}, jc = { low: 0, mid: 0, high: 0 }, sf = n.sf || 0, toolSat = sat.tools == null ? 1 : sat.tools;
    const culs = {}, rels = {}; let transport = 0, coastal = false; S.stS = S.stS || []; S.stD = S.stD || []; S.stInfo = S.stInfo || [];
    for (const p of provsOf(n.id)) if (S.ctrl[p] === n.id) { const v = S.pop[p]; popT += v; const c = S.culg ? S.culg[p] : WD.provs[p].cul, r = S.relg ? S.relg[p] : 0; culs[c] = (culs[c] || 0) + v; rels[r] = (rels[r] || 0) + v; }
    natStates[n.id].forEach(sid => {
      const st = WD.states[sid], sp = statePop.get(st.id * 1000 + n.id) || 0; if (!sp) return;
      let labor = sp * lab, used = 0; if (st.coast) coastal = true;
      const ls = {}, ld = {}, prevS = S.stS[st.id], prevD = S.stD[st.id]; let tIn = 0, tLoc = 0, tCost = 0;
      if (stateOwnerOf(st.id) === n.id && S.ctrl[st.cap] === n.id) {
        const B = S.bld[st.id]; let need0 = 0; for (const b in B) need0 += B[b] * BUILDINGS[b].w;
        const e = need0 ? Math.min(1, labor / need0) : 1; used = Math.min(labor, need0);
        let stBonus = 0, spd = 0; for (const b in B) { const f = BUILDINGS[b].fx; if (f) { if (f.prod) stBonus += B[b] * f.prod; if (f.speed) spd += B[b] * f.speed; } } S.stSpd[st.id] = spd;
        const infK = clamp(spd / 1.2, 0, 1), tEff = .75 + .2 * infK, tK = .12 * (1 - .6 * infK);   // insumos de outros estados: chegam com perdas e frete (estradas e ferrovias ajudam)
        const fert = st.fert, sc = S.scov[st.id] = { health: 0, edu: 0, adm: 0, sec: 0 };
        for (const b in B) {
          const L = B[b], d = BUILDINGS[b]; if (!L) continue;
          if (b === 'port') ports += L; if (b === 'market') mkts += L; if (b === 'university') univ += L; if (b === 'temple') temples += L;
          const work = L * d.w * e, gr = jobGroup(b), J = JOBS[gr]; jobs[gr] = (jobs[gr] || 0) + work; jc.low += work * J.low; jc.mid += work * J.mid; jc.high += work * J.high;
          const slv = SLAVE_JOBS.includes(b); if (slv) slaveJobs += work * J.low;
          if (d.fx) { const f = d.fx; if (f.svc) { sc[f.svc] = Math.min(1, L * capSvc * svcMul / sp); svcLv += L; } if (f.army) bfx.army += L * f.army; if (f.mp) bfx.mp += L * f.mp; if (f.launch) bfx.launch += L; }
          if (d.tl) dem.tools += L * d.tl * e;                  // ferramentas: insumo leve (sem elas, até 20% a menos)
          let inSat = 1; if (d.in) for (const g in d.in) {
            if (g === 'power' && year < 1885) continue; const q = L * d.in[g] * e; dem[g] += q; ld[g] = (ld[g] || 0) + q;
            const loc = g === 'power' || !prevD || !(prevD[g] > 0) ? 1 : Math.min(1, (prevS[g] || 0) / prevD[g]);   // parte feita no próprio estado: barata e na hora
            inSat = Math.min(inSat, (sat[g] == null ? 1 : sat[g]) * (loc + (1 - loc) * tEff)); const fr = q * (1 - loc) * S.wp[g] * tK; transport += fr; tCost += fr; tIn += q * S.wp[g]; tLoc += q * loc * S.wp[g];
          }
          if (d.out) {
            let mult = prodM + (bo[b] || 0) + stBonus; if (b === 'farm' || b === 'fishery') mult += n.m.food; if (b === 'farm') mult = (mult + (B.mill || 0) * .15) * (.55 + fert * .45); if (b === 'oil_well' && B.pipeline) mult += .3;
            if (d.tl) mult *= .8 + .2 * toolSat; if (slv) mult *= 1 + .25 * sf;
            for (const g in d.out) { const v = L * d.out[g] * e * Math.max(.1, inSat) * Math.max(.2, mult); sup[g] += v; ls[g] = (ls[g] || 0) + v; }
          }
        }
      }
      employedT += used;
      if (stateOwnerOf(st.id) === n.id && S.ctrl[st.cap] === n.id && S.scov[st.id]) for (const k in cov) cov[k] += S.scov[st.id][k] * sp;
      // subsistência dos não empregados (grãos, roupas feitas em casa e um pouco de bens e ferramentas)
      const fertS = st.fert;
      const roomy = clamp(1.35 - sp / st.capK * .6, .92, 1.35);   // terra pouco povoada rende mais comida por pessoa
      const mill = stateOwnerOf(st.id) === n.id ? (S.bld[st.id].mill || 0) * .05 : 0;
      sup.grain += (sp - used * .6) * (.72 + .4 * fertS) * roomy * (1 + n.m.food * .5 + mill);   // quem trabalha nos prédios ainda planta um pouco
      if (st.coast) sup.fish += (sp - used) * .08;
      const idle = sp - used; ls.wood = (ls.wood || 0) + idle * .02; ls.fiber = (ls.fiber || 0) + idle * .01; ls.cloth = (ls.cloth || 0) + idle * .012; ls.grain = (ls.grain || 0) + idle;
      if (stateOwnerOf(st.id) === n.id) { S.stS[st.id] = ls; S.stD[st.id] = ld; S.stInfo[st.id] = { loc: tIn ? tLoc / tIn : 1, cost: tCost }; }
      sup.lux += idle * .0006; sup.wood += idle * .02; sup.goods += idle * .012; sup.clothes += idle * .022; sup.cloth += idle * .012; sup.fiber += idle * .01; sup.tools += idle * .0015;
    });
    // classes: escravos ocupam primeiro os empregos braçais; o resto da população segue a proporção dos empregos
    const slv = Math.min(n.slv || 0, popT * .6), free = Math.max(1, popT - slv), fw = free * lab, sw = Math.min(slv * .8, slaveJobs);
    n.sf = slaveJobs > 0 ? sw / slaveJobs : 0; jc.low = Math.max(0, jc.low - sw);
    const era = Math.min(1, Math.max(0, (year - 1400) / 500)), high = free * Math.max(.012, Math.min(.2, jc.high / fw)), mid = free * Math.max(.03 + .06 * era, Math.min(.5, jc.mid / fw));   // artesãos, clero e comerciantes fora dos prédios
    const cls = { slave: slv, low: Math.max(0, free - high - mid), mid, high }; n.cls = cls; n.jobs = jobs; n.jcls = jc; n.unemp = Math.max(0, fw - (employedT - sw)); n.culs = culs; n.rels = rels;
    CLASS_IDS.forEach(k => { const nd = CN[k], c = cls[k]; for (const g in nd) if (g !== 'staple' && g !== 'svc') dem[g] += c * nd[g]; });
    const food = CLASS_IDS.reduce((a, k) => a + cls[k] * CN[k].staple, 0);
    if (S.moon && S.moon.base[n.id]) sup.he3 += 2;
    const fs = sup.grain + sup.fish || 1; dem.grain += food * Math.max(.3, sup.grain / fs); dem.fish += food * Math.min(.7, sup.fish / fs);
    // exército: armas sempre, um pouco de ferramentas, roupas e comida processada
    let R = { inf: 0, cav: 0, art: 0, vrt: 0 }; S.armies.forEach(a => { if (a.o === n.id) { R.inf += a.inf; R.cav += a.cav; R.art += a.art; R.vrt += a.vrt; } });
    const totR = R.inf + R.cav + R.art + R.vrt;
    dem.arms += totR * (hasT(n, 'mil_crossbow') ? .045 : .025); dem.tools += totR * .006; dem.clothes += totR * .02; dem.pfood += totR * .012;
    if (hasT(n, 'mil_tank')) dem.oil += R.cav * .15; if (n.vert) dem[VERT[n.vert].good] += R.vrt * .25 + provsOf(n.id).length * .01 * n.vlv;
    // comércio com o mercado mundial: exporta o excedente; importa o que falta dentro de um orçamento, comida primeiro
    const embs = S.nations.filter(o => o.alive && (o.emb || []).includes(n.id)).length;
    const eff = clamp(.35 - (n.quar > S.t ? .3 : 0) + Math.min(5, ports) * .08 + n.m.trade + Math.min(.3, (n.trade || []).length * .07) - Math.min(.4, embs * .08), .1, 1.4);
    let tradeInc = 0, tradeCost = 0;
    GOOD_IDS.forEach(g => { const net = sup[g] - dem[g]; n.mk.imp[g] = 0; n.mk.exp[g] = 0; if (net > 0) { const exp = net * Math.min(1, eff); n.mk.exp[g] = exp; tradeInc += exp * S.wp[g] * .55; } gdp += sup[g] * S.wp[g]; wsup[g] += sup[g]; wdem[g] += dem[g]; });
    let budget = Math.max(0, gdp * ECON.taxBase * .35 + tradeInc * .8 + Math.max(0, n.money) * .03);
    const prio = g => GOODS[g].c === 'food' ? 0 : n.vert && VERT[n.vert].good === g ? 1 : g === 'arms' || g === 'tools' ? 2 : 3;
    const order = GOOD_IDS.slice().sort((a, b) => prio(a) - prio(b));
    n.coastal = coastal; n.mk.src = {};
    for (const g of order) {
      const need = dem[g] - sup[g]; if (need <= 0 || budget <= 0 || (GOODS[g].c === 'lux' && S.wp[g] > GOODS[g].p * 3)) continue;
      const src = importSrc(n, g), price = S.wp[g] * 1.05 * src.m, imp = Math.min(need * Math.min(1, eff * 1.2), budget / price);
      n.mk.imp[g] = imp; n.mk.src[g] = src; tradeCost += imp * price; budget -= imp * price;
    }
    GOOD_IDS.forEach(g => { if (n.mk.exp[g] > .05) (expBy[g] = expBy[g] || []).push(n.id); });
    const s2 = {}; GOOD_IDS.forEach(g => { s2[g] = dem[g] > 0 ? Math.min(1, (sup[g] + n.mk.imp[g]) / dem[g]) : 1; });
    n.mk.sup = sup; n.mk.dem = dem; n.mk.sat = s2;
    if (n.vert) n.vsat = s2[VERT[n.vert].good];
    n.armySat = totR > .5 ? s2.arms * .6 + s2.clothes * .2 + s2.pfood * .2 : 1;
    // receitas e despesas
    for (const k in cov) cov[k] = popT ? cov[k] / popT : 0; n.cov = cov; n.bfx = bfx;
    n.foodSat = Math.min(1, (sup.grain + sup.fish + n.mk.imp.grain + n.mk.imp.fish) / Math.max(1, food));
    // minorias: culturas não aceitas e outras religiões (a lei decide o quanto pesam)
    const lw = n.laws || LAW_DEF, cl = LAWS.culture.o[lw.culture], rl = LAWS.relig.o[lw.relig], pt = Math.max(1, popT);
    n.cpol = n.cpol || {}; n.rpol = n.rpol || {};
    let cm = 0, rm = 0; for (const c in culs) if (+c !== n.cul && lw.culture !== 'multi') cm += culs[c] * CPOL[n.cpol[c] || 0].w; for (const r in rels) if (+r !== n.relig && lw.relig !== 'secular') rm += rels[r] * CPOL[n.rpol[r] || 0].w;
    n.minC = cm / pt * cl.mp; n.minR = rm / pt * rl.mp;
    // satisfação de cada classe: o que ela consome (pesado pelo valor) e, na média e na alta, saúde e educação
    const cs = {}; CLASS_IDS.forEach(k => { const nd = CN[k]; let w = 0, v = 0;
      for (const g in nd) { if (g === 'svc' || !nd[g]) continue; const q = g === 'staple' ? nd[g] * 3 : nd[g] * GOODS[g].p, x = g === 'staple' ? n.foodSat : s2[g]; w += q; v += q * x; }
      let x = w ? v / w : 1; if (nd.svc) x = x * .75 + .25 * Math.min(1, (cov.health + cov.edu) / 1.2 + .2); if (k === 'low' || k === 'mid') x *= 1 - Math.min(.3, (n.minC + n.minR) * .3); cs[k] = clamp(x, 0, 1); });
    n.csat = cs;
    const stabE = .55 + n.stab / 200, taxM = 1 + n.m.tax + Math.min(.3, mkts * .015);
    const tax = gdp * ECON.taxBase * Math.max(.1, taxM) * stabE;
    let upk = 0; S.armies.forEach(a => { if (a.o === n.id) upk += (a.inf * UNIT_BASE.inf.c + a.cav * UNIT_BASE.cav.c + a.art * UNIT_BASE.art.c + a.vrt * UNIT_BASE.vrt.c) * ECON.upkeep; });
    upk *= eraScale() * .5;
    let navy = 0; S.fleets.forEach(f => { if (f.o === n.id) navy += f.ships * .6 * eraScale(); });
    const admin = (popT * .01 + provsOf(n.id).length * .05) * (1 - .3 * cov.adm), interest = n.money < 0 ? -n.money * .01 : 0, corrupt = n.money > 2000 ? (n.money - 2000) * .01 * (1 - .6 * cov.adm) : 0;
    const svcUp = svcLv * .5 * eraScale() * svcMul;
    n.inc = { tax, trade: tradeInc, imports: -tradeCost, transport: -transport, army: -upk, navy: -navy, admin: -admin, svc: -svcUp, interest: -interest, corrupt: -corrupt };
    n.income = tax + tradeInc - tradeCost - transport - upk - navy - admin - svcUp - interest - corrupt;
    n.money += n.income; n.gdp = gdp;
    if (n.money < -Math.max(400, gdp * 2)) {                   // falência: dívida perdoada, estabilidade despenca, metade do exército debanda
      n.money = 0; n.stab = Math.max(0, n.stab - 30); S.armies.forEach(a => { if (a.o === n.id) { a.inf /= 2; a.cav /= 2; a.art /= 2; a.vrt /= 2; } });
      log(natName(n) + ' declarou falência!', n.id === S.player ? 'bad' : 'world', [n.id]);
    } n.popT = popT; n.univ = univ; n.temples = temples; n.ports = ports; n.employed = employedT;
  });
  GOOD_IDS.forEach(g => { const ratio = (wdem[g] + 1) / (wsup[g] + 1); S.wp[g] = GOODS[g].p * clamp(Math.pow(ratio, .6), .3, 3.5); });
  S.expBy = expBy;
}
/* de onde vem uma importação: o exportador mais barato pela distância; por mar (os dois com litoral) é bem mais barato que por terra */
function importSrc(n, g) {
  const L = (S.expBy || {})[g], c0 = WD.provs[n.capital >= 0 ? n.capital : 0]; let best = null;
  if (L) for (const id of L) {
    if (id === n.id) continue; const o = nat(id); if (!o.alive || o.capital < 0 || (o.emb || []).includes(n.id) || (n.emb || []).includes(id)) continue;
    const c1 = WD.provs[o.capital], d = Math.hypot(c0.cx - c1.cx, c0.cy - c1.cy) / MAP_W;
    const land = c0.cont === c1.cont ? 1 + d * 1.3 : 1.2 + d * 2.5, sea = n.coastal && o.coastal ? 1.03 + d * .45 * (n.ports ? .75 : 1) : Infinity;
    const m = Math.min(land, sea) - ((n.trade || []).includes(id) ? .05 : 0);
    if (!best || m < best.m) best = { m, o: id, sea: sea < land };
  }
  return best || { m: 1.35, o: -1, sea: false };
}
/* quem usa cada bem (descrições) */
function goodUsers(g) {
  const o = Object.values(BUILDINGS).filter(d => (d.in && d.in[g]) || (g === 'tools' && d.tl)).map(d => d.n);
  const c = CLASS_IDS.filter(k => { const nd = classNeeds(curYear(), k); return g === 'grain' || g === 'fish' ? !!nd.staple : !!nd[g]; }).map(k => CLASSES[k].n.toLowerCase());
  if (['arms', 'tools', 'clothes', 'pfood'].includes(g)) c.push('exército');
  return [o.length ? 'Prédios: ' + o.join(', ') : '', c.length ? 'População: ' + c.join(', ') : ''].filter(Boolean).join('\n');
}

/* ---------- custos e ações ---------- */
const bCost = (n, b) => Math.round(BUILDINGS[b].cost * ECON.costMul * (1 - Math.min(.5, n.m.admin || 0)) * (1 + (curYear() - 860) / 600));
const bMonths = b => Math.max(3, Math.round(BUILDINGS[b].cost / 25));
const HIDDEN = ['oil', 'uranium', 'rare'], RES_MULT = { iron: 3, coal: 3, gold: 2, oil: 3, copper: 3, uranium: 2, rare: 2 };
const natRes = p => { const pr = WD.provs[p], T = TERRAIN[pr.terr], o = [];   // recursos naturais da província (além dos minerais)
  if (T.food >= 1) o.push('farm'); if (pr.temp > .55 && T.food >= .7) o.push('fiber'); if (['forest', 'taiga', 'jungle'].includes(pr.terr)) o.push('wood'); if (['hills', 'mountain', 'desert'].includes(pr.terr)) o.push('stone'); if (pr.coast) o.push('fish'); return o; };
const NATRES = { farm: ['🌾', 'Terra cultivável', [222, 200, 90]], fiber: ['🧶', 'Fibras', [245, 243, 232]], wood: ['🪵', 'Floresta', [40, 110, 50]], stone: ['🪨', 'Pedra', [150, 140, 120]], fish: ['🐟', 'Peixe', [80, 160, 210]] };
const provRes = p => (S.newRes && S.newRes[p]) || WD.provs[p].res;
const resVisible = p => { const r = provRes(p); return !!r && (!HIDDEN.includes(r) || !!(S.found && S.found[p])); };
const resCount = (st, r) => st.provs.filter(p => provRes(p) === r && resVisible(p)).length * RES_MULT[r];
const PROSPECT = { oil: 'eco_oil', uranium: 'eco_electricity', rare: 'eco_assembly' };
const prospectCost = () => Math.round(60 * eraScale());
function canProspect(n, s) {
  const st = WD.states[s]; if (stateOwnerOf(s) !== n.id) return 'Só no estado que você controla';
  if (!HIDDEN.some(r => hasT(n, PROSPECT[r]))) return 'Exige Perfuração de petróleo';
  if ((n.pdone || {})[s]) return 'Já prospectado'; if ((n.pros || []).some(x => x.s === s)) return 'Prospecção em andamento';
  if (n.money < prospectCost()) return 'Sem dinheiro'; return '';
}
function prospect(n, s) { const e = canProspect(n, s); if (e) return e; n.money -= prospectCost(); (n.pros = n.pros || []).push({ s, m: 6 }); return ''; }
function prospectDone(n, s) {
  (n.pdone = n.pdone || {})[s] = 1; S.found = S.found || {}; S.newRes = S.newRes || {};
  const can = HIDDEN.filter(r => hasT(n, PROSPECT[r])), st = WD.states[s], found = [];
  st.provs.forEach(p => { const r = provRes(p); if (can.includes(r) && !S.found[p]) { S.found[p] = 1; found.push(GOODS[r].n + ' em ' + WD.provs[p].n); } });
  if (chance(.35)) { const free = st.provs.filter(p => !provRes(p)); if (free.length) { const p = pickR(free), t = WD.provs[p].terr, r = pickR(can.filter(x => x !== 'uranium' || ['hills', 'mountain', 'desert', 'tundra'].includes(t))); if (r) { S.newRes[p] = r; S.found[p] = 1; found.push('nova jazida de ' + GOODS[r].n + ' em ' + WD.provs[p].n); } } }
  if (n.id === S.player) log('Prospecção em ' + st.n + ': ' + (found.length ? found.join(', ') : 'nada encontrado') + '.', found.length ? 'good' : 'info', [n.id]);
  if (found.length) S.mapDirty = true;
}
function canBuild(n, s, b) {
  const d = BUILDINGS[b], st = WD.states[s], B = S.bld[s], L = (B[b] || 0) + n.cons.filter(c => c.s === s && c.b === b).length;
  if (stateOwnerOf(s) !== n.id || S.ctrl[st.cap] !== n.id) return 'Só quem controla a capital do estado constrói nele';
  if (d.vert && n.vert !== d.vert) return 'Exige a vertente ' + (VERT[d.vert] ? VERT[d.vert].n : '');
  if (!d.vert && !n.fx.b.has(b)) return 'Exige tecnologia';
  if (d.req === 'coast' && !st.coast) return 'Exige litoral';
  const capOf = { arable: st.caps.farm, forest: st.caps.lumber, rocky: st.caps.quarry, warm: st.caps.plantation, coast: b === 'fishery' ? st.caps.fishery : 99 };
  if (d.req && d.req.startsWith('res:')) { const k = { iron: 'iron_mine', coal: 'coal_mine', gold: 'gold_mine', oil: 'oil_well', copper: 'copper_mine', uranium: 'uranium_mine', rare: 'rare_mine' }[d.req.slice(4)]; const rr = d.req.slice(4), cap = resCount(st, rr); if (L >= cap) return cap ? 'Recurso esgotado' : (HIDDEN.includes(rr) ? 'Sem jazida conhecida (prospecte)' : 'Sem o recurso'); }
  else if (d.req === 'windy') { if (!st.coast && !st.provs.some(p => ['plains', 'grass', 'tundra', 'hills'].includes(WD.provs[p].terr))) return 'Exige litoral ou campo aberto'; }
  else if (d.req === 'sunny') { if (!st.provs.some(p => ['desert', 'savanna', 'grass'].includes(WD.provs[p].terr))) return 'Exige deserto, savana ou campos'; }
  else if (d.req && L >= (capOf[d.req] ?? 99)) return 'Sem espaço';
  const max = b === 'castle' ? 1 + n.fx.fort : d.max; if (max && L >= max) return 'Nível máximo';
  if (d.w >= .5 && freeLabor(n, s) < d.w) return 'Sem trabalhadores livres no estado';
  if (n.cons.length >= consSlots(n)) return 'Sem canteiros livres';
  if (n.money < bCost(n, b)) return 'Sem dinheiro';
  return '';
}
const statesOf = (n, extra) => { const set = new Set(); for (const p of provsOf(n.id)) set.add(WD.provs[p].state); (extra || []).forEach(p => set.add(WD.provs[p].state)); return set.size; };
const homeCont = n => WD.provs[n.capital >= 0 ? n.capital : 0].cont;
const contStates = c => { if (!WD.cS) { WD.cS = WD.conts.map(() => 0); WD.states.forEach(st => WD.cS[st.cont]++); } return WD.cS[c]; };
const contProvs = c => { if (!WD.cP) { WD.cP = WD.conts.map(() => 0); WD.provs.forEach(p => WD.cP[p.cont]++); } return WD.cP[c]; };
const contShare = n => { const c = homeCont(n); let k = 0; for (const p of provsOf(n.id)) if (WD.provs[p].cont === c) k++; return k / Math.max(1, contProvs(c)); };
const rankCap = (n, r) => r < 3 ? RANK_CAP[r] : r === 3 ? Math.max(25, Math.round(contStates(homeCont(n)) * RANK_KING)) : Math.round(contStates(homeCont(n)) * 1.6) + 25;
const rankReqTxt = (n, r) => r < 4 ? RANK_REQ[r] + ' estados' : 'controlar 2/3 das províncias de ' + WD.conts[homeCont(n)].n;
const domCap = n => rankCap(n, n.rank || 0);
const overCap = n => Math.max(0, statesOf(n) - domCap(n));
function rankUp(n) {                                          // proclama o próximo nível de título
  const r = (n.rank || 0) + 1; if (r > 4) return 'Já está no nível máximo';
  if (r < 4 && statesOf(n) < RANK_REQ[r]) return 'Exige ' + RANK_REQ[r] + ' estados';
  if (r === 4 && contShare(n) < RANK_EMP) return 'Exige controlar 2/3 de ' + WD.conts[homeCont(n)].n + ' (tem ' + Math.round(contShare(n) * 100) + '%)';
  const c = rankCost(n); if (n.money < c) return 'Sem dinheiro';
  n.money -= c; n.rank = r; n.stab = Math.max(0, n.stab - 5);
  log(n.name + ' agora é ' + natName(n) + ' (' + RANK_N[r] + ').', n.id === S.player ? 'good' : 'world', [n.id]); S.mapDirty = true; return '';
}
const rankCost = n => Math.round(150 * ((n.rank || 0) + 1) * eraScale());
function freeLabor(n, s) {                                    // mil trabalhadores ainda sem emprego no estado (contando obras em andamento)
  const st = WD.states[s], B = S.bld[s]; let sp = 0, used = 0;
  for (const p of st.provs) if (S.own[p] === n.id && S.ctrl[p] === n.id) sp += S.pop[p];
  for (const b in B) used += B[b] * BUILDINGS[b].w; n.cons.forEach(c => { if (c.s === s) used += BUILDINGS[c.b].w; });
  return sp * laborShare(n) - used;
}
const capCost = () => Math.round(100 * eraScale());
function setCapital(n, p) {
  if (S.own[p] !== n.id || S.ctrl[p] !== n.id) return 'Só numa província sua e controlada'; if (p === n.capital) return 'Já é a capital';
  if (S.ctrl[n.capital] !== n.id) return 'A capital atual está ocupada'; if (n.capCd > S.t) return 'Só a cada 10 anos (até ' + yearOf(n.capCd) + ')';
  if (n.money < capCost()) return 'Sem dinheiro'; n.money -= capCost(); n.capital = p; n.capCd = S.t + 360 * 10; n.stab = Math.max(0, n.stab - 5); S.mapDirty = true;
  log('A capital de ' + natName(n) + ' agora é ' + WD.provs[p].n + '.', n.id === S.player ? 'good' : 'none', [n.id]); return '';
}
const consSlots = n => n.fx.slots + Math.floor((n.popT || 0) / 1000) + Math.floor(Math.max(0, n.money) / 2500) + (n.xslots || 0);
const slotCost = n => Math.round(150 * eraScale() * (1 + (n.xslots || 0) * .5));
function buySlot(n) { const c = slotCost(n); if (n.money < c) return 'Sem dinheiro'; n.money -= c; n.xslots = (n.xslots || 0) + 1; return ''; }
function build(n, s, b) { const e = canBuild(n, s, b); if (e) return e; n.money -= bCost(n, b); n.cons.push({ s, b, m: bMonths(b), tot: bMonths(b) }); return ''; }

const recCost = (n, type, k = 1) => Math.round(UNIT_BASE[type].c * 3 * eraScale() * k);
function canRecruit(n, type, k = 1) {
  if (type === 'art' && !canArt(n)) return 'Exige Trabuco';
  if (type === 'vrt' && !n.vert) return 'Exige uma vertente';
  if (n.manpower < k) return 'Sem contingente';
  if (n.money < recCost(n, type, k)) return 'Sem dinheiro';
  return '';
}
function recruit(n, type, k, at) { const e = canRecruit(n, type, k); if (e) return e; n.money -= recCost(n, type, k); n.manpower -= k; const at2 = at != null ? at : n.capital; n.rec.push({ type, k, m: (type === 'vrt' ? 5 : 3) - (S.bld[WD.provs[at2].state].barracks ? 1 : 0), at: at2 }); return ''; }
const shipCost = n => Math.round(30 * ECON.costMul * eraScale());
function buildShips(n, k, p) {
  const pr = WD.provs[p]; if (!pr || !pr.coast || S.own[p] !== n.id) return 'Exige litoral próprio';
  if (!n.fx.sea) return 'Exige Barcos longos'; const c = Math.round(shipCost(n) * k * (S.bld[pr.state].shipyard ? .7 : 1)); if (n.money < c) return 'Sem dinheiro';
  n.money -= c; n.rec.push({ type: 'ship', k, m: 4, at: p }); return '';
}
/* generais: um por exército; marcial e traços mudam a força em batalha */
const GEN_TR = { brave: .05, strategist: .1, craven: -.06, cruel: .03, genius: .03, ambitious: .02, paranoid: -.02, lazy: -.04, diligent: .03 };
const genMul = c => c ? Math.max(.7, 1 + (c.st.mar - 6) * .015 + c.tr.reduce((a, t) => a + (GEN_TR[t] || 0), 0)) : 1;
const genCost = () => Math.round(20 * eraScale());
function genCands(n) { return [0, 1, 2].map(() => mkChar(n, { boost: 'mar', dyn: newDynasty(n), age: 24 + (rnd() * 30 | 0) })); }
function setGeneral(n, a, c) { if (!a || a.o !== n.id) return 'Inválido'; const k = genCost(); if (n.money < k) return 'Sem dinheiro'; n.money -= k; a.gen = c; return ''; }
/* exploradores: tropa barata (só infantaria, até 5 regimentos) anda sozinha até a terra incógnita mais próxima */
const expWhy = a => a.cav > .05 || a.art > .05 || a.vrt > .05 ? 'Só infantaria (tropa barata) explora' : regs(a) > 5.05 ? 'Grande demais: até 5 regimentos' : a.p >= WD.provs.length ? 'Precisa estar em terra' : '';
function exploreStep(a) {
  const n = nat(a.o), P = WD.provs.length; if (a.p >= P) { a.exp = false; return; }
  const prev = new Map([[a.p, -1]]), q = [a.p];
  for (let h = 0; h < q.length && h < 5000; h++) {
    const v = q[h];
    for (const o of WD.provs[v].adj) {
      if (prev.has(o)) continue; prev.set(o, v);
      if (!n.exP[o]) { const path = [o]; for (let x = v; x !== a.p; x = prev.get(x)) path.unshift(x); a.path = path; a.prog = 0; a.need = 0; return; }
      q.push(o);
    }
  }
  a.exp = false; if (a.o === S.player) log('Seus exploradores não acham mais terra incógnita ao alcance a pé.', 'info', [a.o]);
  else { n.manpower += regs(a); a.inf = a.cav = a.art = a.vrt = 0; }   // IA: a expedição volta para casa e debanda
}
function addArmy(o, p, u) { const a = { id: S.id++, o, p, inf: u.inf || 0, cav: u.cav || 0, art: u.art || 0, vrt: u.vrt || 0, mor: 1, path: [], prog: 0, need: 0 }; S.armies.push(a); return a; }
function addFleet(o, z, ships) { const f = { id: S.id++, o, z, ships, path: [], prog: 0, need: 0, auto: false }; S.fleets.push(f); return f; }

/* ---------- pesquisa ---------- */
const techBase = y => 140 * Math.exp((y - 860) / 250);
const aheadMul = t => { const a = Math.max(0, t.y - curYear()); return a <= 60 ? 1 + a * .03 : Math.min(200, 2.8 * Math.pow(1 + (a - 60) / 25, 2)); };   // até 60 anos adiantada: +3%/ano; depois cresce rápido (até ×200)
function techCost(n, t) {
  if (t.cb == null) t.cb = t.vt && t.src.length ? t.src.reduce((a, x) => a + techBase(TECH[x].y), 0) * .8 + techBase(t.y) * .3 : techBase(t.y) * (t.entry ? 1.2 : 1);
  return Math.round(t.cb * aheadMul(t));
}
function vertNeedOk(n, v) {                                  // recurso ou terreno exigido no território ou numa província vizinha
  const need = VERT[v].need, test = NEEDS[need] ? NEEDS[need].ok : p => provRes(p.id) === need && resVisible(p.id);
  for (const p of provsOf(n.id)) { const pr = WD.provs[p]; if (test(pr) || pr.adj.some(o => test(WD.provs[o]))) return true; }
  return false;
}
const needName = v => { const k = VERT[v].need; return NEEDS[k] ? NEEDS[k].n : GOODS[k].n.toLowerCase(); };
function techState(n, t) {                                  // '' = pode pesquisar
  if (n.techs[t.id]) return 'done';
  if (t.v) { if (n.vert && n.vert !== t.v) return 'Outra vertente escolhida'; if (t.vt && n.vert !== t.v) return 'Exige escolher ' + VERT[t.v].n; }
  else if (n.vert && t.c !== 'soc' && t.y > VERT[n.vert].entry.y) return 'Substituída pela árvore ' + VERT[n.vert].n;
  if (!t.req.every(q => hasT(n, q))) return 'Exige tecnologias anteriores';
  const ahead = t.y - curYear();
  if (t.entry && n.vertCd > S.t) return 'Abandonou uma vertente há pouco (até ' + yearOf(n.vertCd) + ')';
  if (t.entry && !vertNeedOk(n, t.v)) return 'Exige ' + needName(t.v) + ' no território ou numa província vizinha';
  return '';
}
function researchRate(n) { return (2 + (n.popT || 0) * .004 + (n.univ || 0) * 2.5) * Math.max(.2, 1 + n.m.research) * (.6 + n.stab / 250) * (1 + techCount(n) * .012); }
function finishTech(n, t) {
  n.techs[t.id] = 1;
  if (t.entry) { n.vert = t.v; log(natName(n) + ' abraçou a vertente ' + VERT[t.v].n + '.', n.id === S.player ? 'good' : 'world', [n.id]); }
  calcMods(n);
  if (n.id === S.player) log('Pesquisa concluída: ' + t.n + '.', 'good', [n.id]);
}

/* ---------- personagens: morte, sucessão, eleições e golpes ---------- */
function deathChance(c) {                                    // por mês; dispara depois dos 60 e passa de 100 anos quase nunca
  const age = ageOf(c), y = curYear(), die = c.tr.reduce((a, t) => a * ((TRAITS[t] || {}).die || 1), 1);
  if (age >= 100) return .3;
  return (age < 40 ? .0006 : .0006 * Math.exp((age - 40) / 8.5)) * die * (y > 1900 ? .6 : 1) * (y > 2050 ? .5 : 1);
}
function charMonthly(n) {
  const g = GOVS[n.gov], R = n.ruler, y = curYear();
  for (const [k, t] of COUNCIL) { const c = n.council[k]; if (c && chance(deathChance(c))) { n.council[k] = mkChar(n, { boost: t ? COUNCIL.find(x => x[0] === k)[2] : null, dyn: newDynasty(n) }); if (n.id === S.player) log(t + ' ' + charName(c) + ' morreu aos ' + ageOf(c) + ' anos; um substituto assumiu.', 'info', [n.id]); } }
  if (n.spouse && chance(deathChance(n.spouse))) { if (n.id === S.player) log('Morreu ' + charName(n.spouse) + ', cônjuge do governante.', 'info', [n.id]); n.spouse = null; }
  if (g.succ === 'hered' && !n.spouse && ageOf(R) >= 16 && ageOf(R) < 60 && chance(.02)) n.spouse = mkChar(n, { f: !R.f, dyn: newDynasty(n), age: Math.max(16, ageOf(R) - 3) });
  if (n.senior != null) { const s = nat(n.senior); if (s.alive && GOVS[s.gov].succ === 'hered') { n.ruler = s.ruler; n.dyn = s.dyn; return; } delete n.senior; succeed(n, false); return; }
  if (g.succ === 'ai') return;
  const age = ageOf(R), pDie = deathChance(R);
  if (chance(pDie)) { if (g.succ === 'elect') { log(titleOf(n, R) + ' ' + charName(R) + ' de ' + natName(n) + ' morreu; há eleição.', 'none', [n.id]); if (!election(n)) succeed(n, true); return; } log(titleOf(n, R) + ' ' + charName(R) + ' de ' + natName(n) + ' morreu aos ' + age + ' anos.', n.id === S.player ? 'bad' : 'info', [n.id]); succeed(n, true); return; }
  if (g.succ === 'term' || g.succ === 'council') { if (!n.termEnd) n.termEnd = y + (g.term || 4); if (y >= n.termEnd && S.t % 360 === 0) { n.termEnd = y + (g.term || 4); if (g.succ === 'term') election(n); else succeed(n, false); } }
  if (g.succ === 'hered' && n.spouse && n.kids && S.t % 360 === 0 && age < 50 && ageOf(n.spouse) < 45 && chance(.22)) { const k = mkChar(n, { age: 0 }); n.kids.push(k); if (n.id === S.player) log('Nasceu ' + k.n + ', filho do governante.', 'good', [n.id]); }
  // golpe
  const risk = g.coup * .0012 * (n.stab < 40 ? 1 + (40 - n.stab) / 8 : .35) * Math.max(.1, 1 + (n.m.coup || 0));
  if (!(n.coupCd > S.t) && chance(risk)) coup(n);
}
function succeed(n, death) {
  const g = GOVS[n.gov], old = n.ruler;
  if (g.succ === 'hered') {
    const heirs = (n.kids || []).filter(k => ageOf(k) >= 0).sort((a, b) => a.born - b.born);
    if (heirs.length) { n.ruler = heirs[0]; n.kids = heirs.slice(1); n.spouse = ageOf(n.ruler) >= 16 ? mkChar(n, { f: !n.ruler.f, dyn: newDynasty(n), age: ageOf(n.ruler) }) : null; if (ageOf(n.ruler) < 16) { n.stab -= 8; log('Regência em ' + natName(n) + ': ' + charName(n.ruler) + ' tem só ' + ageOf(n.ruler) + ' anos.', 'info', [n.id]); } }
    else if (tryUnion(n)) { calcMods(n); return; }
    else { n.ruler = mkChar(n, { ruler: true }); n.spouse = mkChar(n, { f: !n.ruler.f, dyn: newDynasty(n), age: ageOf(n.ruler) - 2 }); n.kids = []; n.stab -= 15; log('Crise de sucessão em ' + natName(n) + ': um parente distante assume.', n.id === S.player ? 'bad' : 'info', [n.id]); }
  } else {
    n.dyn = newDynasty(n); n.ruler = mkChar(n, { ruler: true, age: g.succ === 'theo' ? 50 + (rnd() * 20 | 0) : undefined, boost: g.succ === 'junta' ? 'mar' : null });
    n.stab -= g.succ === 'junta' ? 10 : g.succ === 'elect' ? 5 : 2;
  }
  n.termEnd = curYear() + (g.term || 4);
  log('Novo governo em ' + natName(n) + ': ' + titleOf(n).toLowerCase() + ' ' + charName(n.ruler) + '.', n.id === S.player ? 'info' : 'none', [n.id]);
  calcMods(n);
}
function coup(n) {                                           // golpe militar: o novo governo só adota o que o país já pode ter
  const g = GOVS[n.gov], y = curYear(), dyn = newDynasty(n), leader = mkChar(n, { ruler: true, boost: 'mar', dyn }); leader.tr = ['ambitious', pickR(['cruel', 'strategist', 'charismatic', 'paranoid'])];
  if (['Monarquia', 'República', 'Tribal'].includes(g.cat) && chance(.45)) {
    const mil = ['junta', 'caudillo', 'mil_regime', 'protectorate'].filter(x => x !== n.gov && govOk(n, x)), ng = leader.lg && govOk(n, leader.lg) ? leader.lg : mil.length ? pickR(mil) : null;
    if (ng) applyGov(n, ng);
    if (y > 1800 && chance(.4)) { const ii = ['natpop', 'warrior'].filter(i => n.fx.i.has(i)); if (ii.length) n.ideo = pickR(ii); }
  }
  n.dyn = dyn; n.ruler = leader; n.kids = []; n.spouse = null; n.stab = Math.max(20, n.stab - 15); n.coupCd = S.t + 360 * 10; n.press = 0;
  log('Golpe em ' + natName(n) + '! ' + charName(n.ruler) + ' tomou o poder.', n.id === S.player ? 'bad' : 'world', [n.id]);
  notify(n.id, '⚔️ Golpe militar', charName(n.ruler) + ' derrubou o governo com o apoio do exército. Agora governa como ' + titleOf(n).toLowerCase() + ' (' + GOVS[n.gov].n + ').');
  calcMods(n);
}
/* exigências: o que o governante e o conselho querem e o país ainda não adotou (só conta o que já é possível adotar) */
function demandsOf(n) {
  const out = [], who = [[n.ruler, titleOf(n), 3, 'ruler'], ...COUNCIL.map(([k, t]) => [n.council[k], t, 1, k])];
  who.forEach(([c, t, w, slot]) => { if (!c) return;
    if (c.lg && c.lg !== n.gov && govOk(n, c.lg)) out.push({ ty: 'gov', v: c.lg, w, c, t, slot });
    if (c.ll && n.laws[c.ll.k] !== c.ll.o && lawOk(n, c.ll.k, c.ll.o)) out.push({ ty: 'law', k: c.ll.k, v: c.ll.o, w, c, t, slot });
    if (w === 1 && c.ld && c.ld !== n.ideo && n.fx.i.has(c.ld)) out.push({ ty: 'ideo', v: c.ld, w: .5, c, t, slot });
  });
  return out;
}
const demandTxt = d => d.ty === 'gov' ? GOVS[d.v].n : d.ty === 'law' ? LAWS[d.k].n + ': ' + LAWS[d.k].o[d.v].n : 'Ideologia ' + IDEOS[d.v].n;
/* pressão do conselho: sobe com exigências não atendidas (mais rápido com estabilidade baixa e classe alta insatisfeita) */
function pressTick(n) {
  if (GOVS[n.gov].succ === 'ai') { n.press = 0; return; }
  const d = demandsOf(n).filter(x => x.slot !== 'ruler'), hs = (n.csat || {}).high == null ? 1 : n.csat.high;
  const add = d.reduce((a, x) => a + x.w, 0) * .25 * (n.stab < 50 ? 1.5 : 1) * (1.5 - hs * .5) * Math.max(.1, 1 + (n.m.coup || 0)) * Math.max(.2, GOVS[n.gov].coup);
  n.press = clamp((n.press || 0) + (d.length ? add - .3 : -1.5), 0, 100);
  if (n.press >= 100 && !(n.coupCd > S.t)) councilCoup(n, d);
}
function councilCoup(n, d) {                                   // o conselheiro com mais exigências toma o poder e impõe o que queria
  const by = {}; d.forEach(x => by[x.slot] = (by[x.slot] || 0) + x.w); const slot = Object.keys(by).sort((a, b) => by[b] - by[a])[0]; if (!slot) { n.press = 0; return; }
  const c = n.council[slot], done = [];
  d.filter(x => x.slot === slot).forEach(x => {
    if (x.ty === 'gov' && govOk(n, x.v)) { applyGov(n, x.v); done.push(GOVS[x.v].n); }
    else if (x.ty === 'law' && lawOk(n, x.k, x.v)) { n.laws[x.k] = x.v; done.push(LAWS[x.k].o[x.v].n); }
    else if (x.ty === 'ideo' && n.fx.i.has(x.v)) { n.ideo = x.v; done.push(IDEOS[x.v].n); }
  });
  n.council[slot] = mkChar(n, { boost: COUNCIL.find(x => x[0] === slot)[2], dyn: newDynasty(n) });
  n.dyn = c.dyn; n.ruler = c; n.kids = []; n.spouse = null; n.stab = Math.max(10, n.stab - 12); n.coupCd = S.t + 360 * 10; n.press = 0;
  const txt = 'Golpe do conselho em ' + natName(n) + ': ' + charName(c) + ' tomou o poder' + (done.length ? ' e impôs ' + done.join(', ') : '') + '.';
  log(txt, n.id === S.player ? 'bad' : 'world', [n.id]); notify(n.id, '🗡️ Golpe do conselho', txt);
  calcMods(n);
}
const BASE_GOVS = ['tribal', 'tribal_conf', 'horde', 'feudal', 'elective', 'empire'];
const govWhy = (n, g) => { const d = GOVS[g], r = n.rank || 0; if (!(n.fx.g.has(g) || BASE_GOVS.includes(g))) return 'Exige tecnologia'; if (d.minRank && r < d.minRank) return 'Exige o título de ' + RANK_N[d.minRank]; if (d.maxRank != null && r > d.maxRank) return 'Só até o título de ' + RANK_N[d.maxRank]; if (d.until && curYear() > d.until) return 'Obsoleto desde ' + d.until; return ''; };
const govOk = (n, g) => !govWhy(n, g);
function setGov(n, g) {
  const ok = govOk(n, g);
  if (!ok) return govWhy(n, g);
  const c = Math.round(80 * eraScale()); if (n.money < c) return 'Sem dinheiro'; if (n.govCd > S.t) return 'Reforma recente';
  const sameCat = GOVS[g].cat === GOVS[n.gov].cat;
  n.money -= c; n.stab = Math.max(0, n.stab - (sameCat ? 10 : 25)); n.govCd = S.t + 360 * 10;
  applyGov(n, g); if (GOVS[g].succ !== 'hered') succeed(n, false); return '';
}
function applyGov(n, g) {                                     // troca a forma de governo (sem custo; quem chama já checou)
  n.gov = g; n.govCd = S.t + 360 * 10;
  if (GOVS[g].succ !== 'hered') { n.marr = []; n.kids = []; n.spouse = null; S.nations.forEach(j => { if (j.senior === n.id) { delete j.senior; succeed(j, false); log(j.name + ' deixou a união pessoal.', 'world', [j.id, n.id]); } }); }
  else if (!n.kids) { n.kids = []; n.spouse = mkChar(n, { f: !n.ruler.f, dyn: newDynasty(n) }); }
  calcMods(n);
}
function ideoInfluence(n) {                                  // governante pesa 3, cada conselheiro 1
  const inf = {}; const add = (c, w) => { if (c && c.ld) inf[c.ld] = (inf[c.ld] || 0) + w; };
  add(n.ruler, 3); Object.values(n.council || {}).forEach(c => add(c, 1)); return inf;
}
function setIdeo(n, i) {
  if (!n.fx.i.has(i)) return 'Exige tecnologia'; if (n.ideoCd > S.t) return 'Mudança recente';
  const inf = ideoInfluence(n)[i] || 0; n.ideo = i; n.stab = Math.max(0, n.stab - Math.max(2, 12 - inf * 2)); n.ideoCd = S.t + 360 * 5; calcMods(n); return '';
}
const councilCost = () => Math.round(25 * eraScale());
function councilCands(n, k) { const s = COUNCIL.find(x => x[0] === k)[2]; return [0, 1, 2].map(() => mkChar(n, { boost: s, dyn: newDynasty(n) })); }
function swapCouncil(n, k, c) { const cost = councilCost(); if (n.money < cost) return 'Sem dinheiro'; n.money -= cost; n.council[k] = c; calcMods(n); return ''; }
const flagCost = () => Math.round(30 * eraScale());
function setFlag(n, f) { const c = flagCost(); if (n.money < c) return 'Sem dinheiro'; n.money -= c; n.flag = JSON.parse(JSON.stringify(f)); return ''; }
function rename(n, name) { name = (name || '').trim().replace(/\s+/g, ' '); if (name.length < 2 || name.length > 24) return 'Nome deve ter de 2 a 24 letras'; n.name = name; return ''; }

/* ---------- leis ---------- */
const lawCost = () => Math.round(50 * eraScale());
function setLaw(n, k, o) {
  const L = LAWS[k] && LAWS[k].o[o]; if (!L) return 'Inválido'; if (L.req && !hasT(n, L.req)) return 'Exige ' + TECH[L.req].n;
  n.lawCd = n.lawCd || {}; if (n.lawCd[k] > S.t) return 'Mudada há pouco'; if (n.money < lawCost()) return 'Sem dinheiro';
  n.money -= lawCost(); n.laws[k] = o; n.lawCd[k] = S.t + 360 * 2; n.stab = Math.max(0, n.stab - 3); calcMods(n); return '';
}

/* ---------- eleições: apoio dos partidos (um por ideologia disponível) muda com a situação do país ---------- */
const isElective = n => ['term', 'council', 'elect'].includes(GOVS[n.gov].succ);
function supportTick(n) {
  if (!isElective(n)) return; const sup = n.sup = n.sup || {};
  const avail = [...n.fx.i]; if (!sup[n.ideo]) sup[n.ideo] = .35;
  avail.forEach(i => { if (sup[i] == null && Object.keys(sup).length < 5) sup[i] = .05 + rnd() * .1; });
  for (const k in sup) if (!avail.includes(k) && k !== n.ideo) delete sup[k];
  const lw = n.laws || LAW_DEF, d = (n.stab - 50) / 4000 + (n.income > 0 ? .002 : -.004) - n.wex / 3000 + ({ low: .002, high: -.002, extort: -.006 }[lw.tax] || 0) + (n.foodSat < .95 ? -.005 : 0);
  const inf = ideoInfluence(n);
  for (const k in sup) { sup[k] = Math.max(.02, sup[k] + (inf[k] || 0) * .0008 + (k === n.ideo ? d : (rnd() - .5) * .006 + (n.foodSat < .95 && ['socialism', 'agrarian', 'radical', 'natpop'].includes(k) ? .003 : 0))); }
  const tot = Object.values(sup).reduce((a, b) => a + b, 0); for (const k in sup) sup[k] /= tot;
}
function election(n) {
  supportTick(n); const sup = n.sup || {}; let win = n.ideo, best = -1;
  for (const k in sup) { const v = sup[k] + (rnd() - .5) * .06; if (v > best) { best = v; win = k; } }
  const pctv = Math.round((sup[win] || 0) * 100), changed = win !== n.ideo;
  if (changed) { n.ideo = win; succeed(n, false); calcMods(n); }
  const txt = changed ? 'Eleições em ' + natName(n) + ': o partido ' + IDEOS[win].n + ' venceu com ' + pctv + '% e ' + charName(n.ruler) + ' assume.' : 'Eleições em ' + natName(n) + ': o governo (' + IDEOS[win].n + ') foi reeleito com ' + pctv + '%.';
  log(txt, n.id === S.player ? (changed ? 'bad' : 'good') : 'none', [n.id]);
  notify(n.id, '🗳️ Eleições', txt);
  return changed;
}
const campaignCost = () => Math.round(40 * eraScale());
function campaign(n) { if (!isElective(n)) return 'Só em governos eletivos'; if (n.campCd > S.t) return 'Campanha recente'; if (n.money < campaignCost()) return 'Sem dinheiro'; n.money -= campaignCost(); n.campCd = S.t + 360; n.sup[n.ideo] = (n.sup[n.ideo] || 0) + .06; supportTick(n); return ''; }

/* ---------- espaço (fim de jogo): satélites, sonda, pouso, base lunar e, com sorte, vida inteligente na lua ---------- */
function generateMoon(seed) {
  const r = mkRng(seed ^ 0x3007), [type, col] = MOON_TYPES[r() * MOON_TYPES.length | 0], cul = CULTURES[r() * CUL_MAJOR | 0], used = new Set();
  const x = r(), life = x < .72 ? 'none' : x < .86 ? 'micro' : x < .95 ? 'complex' : 'intel';
  const civs = life === 'intel' ? Array.from({ length: 1 + (r() * 3 | 0) }, () => { const era = r() * ALIEN_ERAS.length | 0; return { n: nameGen(CULTURES[r() * CUL_MAJOR | 0], r, used), era, aggro: r() < .45, pow: Math.round((era + 1) ** 2 * (20 + r() * 40)), rel: {} }; }) : [];
  const craters = Array.from({ length: 14 }, () => [r() * 2 - 1, r() * 2 - 1, .05 + r() * .18]);
  return { n: nameGen(cul, r, used), type, col, grav: Math.round((.1 + r() * .3) * 100) / 100, life, civs, craters, known: {}, landed: {}, base: {} };
}
const launchOk = n => (n.bfx || {}).launch > 0;
const SPACE = {
  sat: { n: 'Satélite', tech: 'spc_sat', c: 300, m: 4 }, probe: { n: 'Sonda lunar', tech: 'spc_probe', c: 600, m: 8 },
  land: { n: 'Pouso tripulado', tech: 'spc_landing', c: 1200, m: 12 }, base: { n: 'Base lunar', tech: 'spc_base', c: 2000, m: 18 },
};
const spaceCost = k => Math.round(SPACE[k].c * eraScale());
function canSpace(n, k) {
  const d = SPACE[k], M = S.moon; if (!hasT(n, d.tech)) return 'Exige ' + TECH[d.tech].n; if (!launchOk(n)) return 'Exige centro de lançamento';
  if (n.sproj) return 'Já há uma missão em andamento'; if (n.money < spaceCost(k)) return 'Sem dinheiro';
  if (k === 'sat' && (n.sats || 0) >= 20) return 'Órbita cheia (20)'; if (k === 'probe' && M.known[n.id]) return 'A lua já foi sondada';
  if (k === 'land' && (!M.known[n.id] || M.landed[n.id])) return M.landed[n.id] ? 'Já pousou' : 'Sonde a lua antes';
  if (k === 'base' && (!M.landed[n.id] || M.base[n.id])) return M.base[n.id] ? 'Base já construída' : 'Pouse antes';
  return '';
}
function spaceGo(n, k) { const e = canSpace(n, k); if (e) return e; n.money -= spaceCost(k); n.sproj = { k, m: SPACE[k].m, tot: SPACE[k].m }; return ''; }
function spaceDone(n, k) {
  const M = S.moon, first = k !== 'sat' && !Object.keys(k === 'probe' ? M.known : k === 'land' ? M.landed : M.base).length, rk = ROCKETS[n.vert || 'none'];
  if (k === 'sat') n.sats = (n.sats || 0) + 1;
  if (k === 'probe') { M.known[n.id] = 1; const lifeT = { none: 'sem vida', micro: 'com vida microscópica', complex: 'com fauna e flora complexas', intel: 'com vida inteligente: ' + M.civs.length + ' civilização' + (M.civs.length > 1 ? 'ões' : '') }[M.life]; notify(n.id, '🌑 ' + M.n, 'A sonda (' + rk + ') chegou a ' + M.n + ': lua ' + M.type.toLowerCase() + ', gravidade ' + M.grav + 'g, ' + lifeT + '.'); }
  if (k === 'land') { M.landed[n.id] = 1; n.stab = Math.min(100, n.stab + 10); }
  if (k === 'base') M.base[n.id] = 1;
  log((k === 'sat' ? natName(n) + ' pôs um satélite em órbita' : (first ? 'Pela primeira vez na história, ' : '') + natName(n) + ' concluiu: ' + SPACE[k].n + ' em ' + M.n) + ' (' + rk + ').', n.id === S.player ? 'good' : first ? 'world' : 'none', [n.id]);
}
function alienAct(n, ci, kind) {                             // contato, comércio, presente ou guerra com uma civilização da lua
  const c = S.moon.civs[ci]; if (!c) return 'Inválido'; if (!hasT(n, 'spc_contact') || !S.moon.known[n.id]) return 'Exige Protocolos de contato e sondar a lua';
  c.rel[n.id] = c.rel[n.id] || 0;
  if (kind === 'gift') { const cost = Math.round(200 * eraScale()); if (n.money < cost) return 'Sem dinheiro'; n.money -= cost; c.rel[n.id] += 25; return ''; }
  if (kind === 'trade') { if (c.rel[n.id] < (c.aggro ? 40 : 0)) return 'Eles não confiam em você'; if (c.trade && c.trade.includes(n.id)) return 'Já há comércio'; (c.trade = c.trade || []).push(n.id); n.alienTrade = (n.alienTrade || 0) + 1; log(natName(n) + ' abriu comércio com ' + c.n + '.', 'world', [n.id]); return ''; }
  if (kind === 'war') {
    if (!S.moon.base[n.id]) return 'Exige base lunar'; const mine = strength(n) * (1 + (n.sats || 0) * .02);
    if (mine * (.6 + rnd() * .8) > c.pow * 5) { c.subj = n.id; c.aggro = false; n.alienTrade = (n.alienTrade || 0) + 2; n.stab = Math.min(100, n.stab + 15); log(natName(n) + ' subjugou ' + c.n + '!', 'world', [n.id]); return ''; }
    S.moon.base[n.id] = 0; n.stab = Math.max(0, n.stab - 15); log(c.n + ' destruiu a base lunar de ' + natName(n) + '.', 'world', [n.id]); return 'A ofensiva falhou: a base foi destruída';
  }
  return '';
}
function alienTick() {                                        // civilizações agressivas atacam bases e, se avançadas, a própria Terra
  const M = S.moon; if (!M || M.life !== 'intel') return;
  M.civs.forEach(c => {
    if (!c.aggro || c.era < 4 || c.subj != null) return;
    S.nations.forEach(n => {
      if (!n.alive) return;
      if (M.base[n.id] && chance(.01)) { const def = strength(n) * (1 + (n.sats || 0) * .02); if (def * rnd() < c.pow * 3) { M.base[n.id] = 0; log(c.n + ' atacou e destruiu a base lunar de ' + natName(n) + '.', n.id === S.player ? 'bad' : 'world', [n.id]); notify(n.id, '👽 Ataque à base lunar', c.n + ' destruiu sua base em ' + M.n + '.'); } }
      if (c.era >= 7 && M.known[n.id] && chance(.003)) { const ps = provsOf(n.id); if (ps.length) { const p = pickR(ps); S.pop[p] *= .9; n.stab = Math.max(0, n.stab - 5); log(c.n + ' atacou ' + WD.provs[p].n + ' vindo da lua!', n.id === S.player ? 'bad' : 'world', [n.id]); } }
    });
  });
}

/* ---------- caminhos (províncias 0..P-1, mares P..) ---------- */
let enterC = null;                                          // memória de canEnter por nação (refeita por mês, guerra ou mudança de dono)
function canEnter(o, p) { if (!enterC) enterC = new Map(); let a = enterC.get(o); if (!a) { a = new Int8Array(S.own.length).fill(-1); enterC.set(o, a); } if (a[p] < 0) a[p] = canEnter0(o, p) ? 1 : 0; return a[p] === 1; }
function canEnter0(o, p) { const ow = S.own[p], ct = S.ctrl[p]; return ow === o || ct === o || ow === -1 || atWar(o, ow) || atWar(o, ct); }
function transport(o) { let s = 0; S.fleets.forEach(f => { if (f.o === o) s += f.ships; }); return s * 3; }
function findPath(n, from, to, army) {
  const P = WD.provs.length, Z = WD.seas.length, dist = new Float32Array(P + Z).fill(1e9), prev = new Int32Array(P + Z).fill(-1), hp = new Heap();
  const canSail = n.fx.sea >= 1 && (!army || transport(n.id) >= regs(army));
  dist[from] = 0; hp.push(0, from);
  const speed = 1 + Math.max(-.5, n.m.speed || 0);
  while (hp.size) {
    const u = hp.pop(); if (u === to) break; const du = dist[u];
    const relax = (v, c) => { if (du + c < dist[v]) { dist[v] = du + c; prev[v] = u; hp.push(du + c, v); } };
    if (u < P) {
      const pr = WD.provs[u];
      for (const v of pr.adj) if (n.exP[v] && (v === to || canEnter(n.id, v))) relax(v, edgeDays(n, u, v) / speed);
      if (canSail) for (const z of pr.seas) if (n.exZ[z] && seaOk(n, z)) relax(P + z, 4);
    } else {
      const z = WD.seas[u - P];
      for (const w of z.adj) if (n.exZ[w] && seaOk(n, w)) relax(P + w, 5 / speed);
      for (const p of z.provs) if (n.exP[p] && (p === to || canEnter(n.id, p))) relax(p, 4);
    }
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
      if (next < P && a.p < P) a.need = edgeDays(n, a.p, next) / (1 + Math.max(-.5, n.m.speed || 0));
      else a.need = 4;
      if (next < P && !a.retreat && !a.exp && !canEnter(a.o, next)) { a.path = []; a.need = 0; continue; }
    }
    a.prog += 1;
    if (a.prog >= a.need) { a.p = next; a.path.shift(); a.prog = 0; a.need = 0; explore(n, a.p); if (!a.path.length) a.retreat = false; }
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
    for (let i = 0; i < owners.length && !fought; i++) for (let j = i + 1; j < owners.length && !fought; j++) if (atWar(owners[i], owners[j])) { const ok = a => !a.retreat && !(a.sh > S.t), A = list.filter(a => a.o === owners[i] && ok(a)), B = list.filter(a => a.o === owners[j] && ok(a)); if (A.length && B.length) { battle(p, A, B); fought = true; } }
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
  for (const a of list) { const n = nat(a.o), u = n.up; const pw = (a.inf * u.inf * UNIT_BASE.inf.a + a.cav * u.cav * UNIT_BASE.cav.a + a.art * u.art * UNIT_BASE.art.a + a.vrt * u.vrt * UNIT_BASE.vrt.a) * (1 + n.m.army); s += pw * (.25 + .75 * a.mor) * genMul(a.gen) * (.7 + .3 * (n.armySat == null ? 1 : n.armySat)); r += regs(a); }
  if (def) s *= 1 + TERRAIN[WD.provs[p].terr].def + fortOf(p) * .1;
  return [s, r];
}
function battle(p, A, B) {
  if (!A.length || !B.length) return;
  const ownerP = S.ctrl[p], aDef = A[0].o === ownerP, [pa, ra] = power(A, aDef, p), [pb, rb] = power(B, !aDef, p);
  const lossB = pb > 0 ? pa * .016 * rand(.75, 1.25) : rb, lossA = pb * .016 * rand(.75, 1.25);
  const hit = (list, loss, tot) => { for (const a of list) { const f = Math.min(1, loss / Math.max(.01, tot)); a.inf -= a.inf * f; a.cav -= a.cav * f; a.art -= a.art * f; a.vrt -= a.vrt * f; a.mor = Math.max(0, a.mor - (loss / Math.max(1, tot)) * 2.6 - .025); a.inBattle = true; a.path = []; } };
  hit(A, lossA, ra); hit(B, lossB, rb);
  const w = S.wars.find(w => (w.A.includes(A[0].o) && w.D.includes(B[0].o)) || (w.A.includes(B[0].o) && w.D.includes(A[0].o)));
  if (w) { w.loss = w.loss || {}; w.loss[A[0].o] = (w.loss[A[0].o] || 0) + lossA; w.loss[B[0].o] = (w.loss[B[0].o] || 0) + lossB; }
  const brokeA = A.every(a => a.mor < .08 || regs(a) < .3), brokeB = B.every(a => a.mor < .08 || regs(a) < .3);
  if (brokeA || brokeB) {
    const lose = brokeA ? A : B, win = brokeA ? B : A;
    if (w) { w.bp = w.bp || {}; w.bp[win[0].o] = (w.bp[win[0].o] || 0) + clamp(Math.round((brokeA ? ra : rb) * .5), 1, 10); }
    const ln = nat(lose[0].o), wn = nat(win[0].o);
    lose.forEach(a => { if (a.gen && chance(.06)) { if (a.o === S.player) log('O general ' + charName(a.gen) + ' morreu em ' + WD.provs[p].n + '.', 'bad', [S.player]); a.gen = null; } });
    if (lose[0].o === S.player || win[0].o === S.player) log('Batalha em ' + WD.provs[p].n + ': ' + natName(wn) + ' venceu ' + natName(ln) + '.', win[0].o === S.player ? 'good' : 'bad', [S.player]);
    lose.forEach(a => retreat(a));
  }
}
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
function navalBattle(f, g) {
  const pf = f.ships * nat(f.o).fx.ship, pg = g.ships * nat(g.o).fx.ship;
  f.ships -= pg * .04 * rand(.7, 1.3); g.ships -= pf * .04 * rand(.7, 1.3);
}
function siegeAt(p, list) {
  const ct = S.ctrl[p], own = S.own[p], reb = ct === -1 && own >= 0 && S.rebels ? S.rebels[p] : null;
  const besiegers = list.filter(a => !a.path.length && !a.exp && !(a.sh > S.t) && (atWar(a.o, ct) || (own === a.o && ct !== a.o && (reb || atWar(a.o, ct)))));
  if (!besiegers.length) { delete S.sieges[p]; return; }
  const o = besiegers[0].o, n = nat(o), sg = S.sieges[p] && S.sieges[p].o === o ? S.sieges[p] : (S.sieges[p] = { o, v: 0 });
  let force = 0; besiegers.filter(a => a.o === o).forEach(a => { force += (regs(a) + a.art * 3 * n.up.siege) * genMul(a.gen); });
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

/* ---------- diplomacia: relações, alianças, casamentos, uniões pessoais, comércio e embargos ---------- */
const has = (n, k, id) => (n[k] || []).includes(id);
const link = (a, b, k) => { a[k] = a[k] || []; b[k] = b[k] || []; if (!a[k].includes(b.id)) a[k].push(b.id); if (!b[k].includes(a.id)) b[k].push(a.id); };
let strC = null;                                            // força militar por nação, refeita uma vez por mês
const strength = n => { if (!strC) { strC = new Float64Array(S.nations.length); S.armies.forEach(a => strC[a.o] += regs(a)); } return strC[n.id] * (1 + n.m.army) * n.up.inf + 1; };
const nbC = new Map();
function neighbors(n) { const k = n.id + ':' + (S.t / 30 | 0); if (nbC.has(k)) return nbC.get(k); if (nbC.size > 400) nbC.clear(); const r = neighbors0(n); nbC.set(k, r); return r; }
function neighbors0(n) { const s = new Set(); for (const p of provsOf(n.id)) for (const o of WD.provs[p].adj) { const t = S.own[o]; if (t >= 0 && t !== n.id) s.add(t); } return s; }
function accept(t, n, kind) {                                 // quanto t topa a proposta de n (≥ 0 aceita); devolve [valor, motivos]
  const why = []; let v = 0; const add = (x, txt) => { if (x) { v += x; why.push((x > 0 ? '+' : '') + Math.round(x) + ' ' + txt); } };
  add((t.rel[n.id] || 0) * .5, 'relação');
  add(t.ideo === n.ideo ? 12 : 0, 'mesma ideologia'); add(GOVS[t.gov].cat === GOVS[n.gov].cat ? 8 : 0, 'governos parecidos');
  add((n.ruler.st.dip - 8) * 2, 'diplomacia do seu governante');
  const tr = t.ruler.tr;
  add(tr.includes('charismatic') || tr.includes('generous') ? 10 : 0, 'temperamento'); add(tr.includes('paranoid') && kind === 'ally' ? -20 : 0, 'governante paranoico');
  if (kind === 'ally') {
    add(-15, 'base'); add(-(t.allies || []).length * 6, 'já tem aliados');
    const common = enemiesOf(t.id).some(e => atWar(n.id, e)) || [...neighbors(t)].some(x => (n.claims && Object.keys(n.claims).length && false) || atWar(x, n.id)); add(common ? 20 : 0, 'inimigo em comum');
    add(strength(n) > strength(t) * 1.5 ? 10 : 0, 'você é forte'); add(has(t, 'marr', n.id) ? 15 : 0, 'casamento real');
  } else if (kind === 'marr') { add(-10, 'base'); add(has(t, 'allies', n.id) ? 10 : 0, 'aliados'); }
  else if (kind === 'trade') { add(-5, 'base'); add(tr.includes('greedy') ? 10 : 0, 'governante ganancioso'); add((t.trade || []).length * -4, 'já tem acordos'); }
  if (atWar(t.id, n.id)) add(-1000, 'em guerra');
  return [Math.round(v), why];
}
const dipCost = k => Math.round({ improve: 15, gift: 40, ally: 0, marr: 20, trade: 10, integrate: 200 }[k] * eraScale());
function dipAct(n, t, kind) {                                 // '' = feito/aceito; texto = motivo da recusa
  if (!t.alive || t === n) return 'Inválido';
  const c = dipCost(kind) || 0; if (n.money < c) return 'Sem dinheiro';
  if (kind === 'improve') { if ((n.cd || {})[t.id] > S.t) return 'Já tentado este ano'; n.money -= c; n.cd = n.cd || {}; n.cd[t.id] = S.t + 360; t.rel[n.id] = clamp((t.rel[n.id] || 0) + 15, -100, 100); n.rel[t.id] = clamp((n.rel[t.id] || 0) + 8, -100, 100); return ''; }
  if (kind === 'gift') { n.money -= c; t.money += c; t.rel[n.id] = clamp((t.rel[n.id] || 0) + 20, -100, 100); return ''; }
  if (kind === 'insult') { t.rel[n.id] = clamp((t.rel[n.id] || 0) - 40, -100, 100); n.rel[t.id] = clamp((n.rel[t.id] || 0) - 20, -100, 100); return ''; }
  if (kind === 'break') { breakTies(n, t); ['allies'].forEach(() => 0); t.rel[n.id] = clamp((t.rel[n.id] || 0) - 40, -100, 100); n.stab = Math.max(0, n.stab - 5); return ''; }
  if (kind === 'unally') { n.allies = (n.allies || []).filter(x => x !== t.id); t.allies = (t.allies || []).filter(x => x !== n.id); t.rel[n.id] = clamp((t.rel[n.id] || 0) - 40, -100, 100); n.stab = Math.max(0, n.stab - 5); return ''; }
  if (kind === 'untrade') { n.trade = (n.trade || []).filter(x => x !== t.id); t.trade = (t.trade || []).filter(x => x !== n.id); t.rel[n.id] = clamp((t.rel[n.id] || 0) - 10, -100, 100); return ''; }
  if (kind === 'embargo') { n.emb = n.emb || []; if (n.emb.includes(t.id)) n.emb = n.emb.filter(x => x !== t.id); else { n.emb.push(t.id); n.trade = (n.trade || []).filter(x => x !== t.id); t.trade = (t.trade || []).filter(x => x !== n.id); t.rel[n.id] = clamp((t.rel[n.id] || 0) - 25, -100, 100); } return ''; }
  if (kind === 'integrate') { if (t.senior !== n.id) return 'Não é seu parceiro júnior'; if (S.t - t.unionT < 360 * 50) return 'A união precisa de 50 anos'; if ((t.rel[n.id] || 0) < 50) return 'Exige relação 50+'; n.money -= c; provsOf(t.id).forEach(p => { S.own[p] = n.id; S.ctrl[p] = n.id; }); S.armies.forEach(a => { if (a.o === t.id) a.o = n.id; }); S.fleets.forEach(f => { if (f.o === t.id) f.o = n.id; }); ownChanged(); checkDead(); log(natName(n) + ' integrou ' + t.name + ' à coroa.', 'world', [n.id]); return ''; }
  if (kind === 'ally' && has(n, 'allies', t.id)) return 'Já são aliados';
  if (kind === 'marr') { if (GOVS[n.gov].succ !== 'hered' || GOVS[t.gov].succ !== 'hered') return 'Exige duas monarquias hereditárias'; if (has(n, 'marr', t.id)) return 'Já há casamento'; }
  if (kind === 'trade') { if (has(n, 'trade', t.id)) return 'Já há acordo'; if (has(n, 'emb', t.id) || has(t, 'emb', n.id)) return 'Há embargo'; }
  if (atWar(n.id, t.id)) return 'Em guerra';
  if (t.id !== S.player) { const [v] = accept(t, n, kind); if (v < 0) return 'Recusado'; }
  n.money -= c; link(n, t, kind === 'ally' ? 'allies' : kind === 'marr' ? 'marr' : 'trade');
  const bonus = { ally: 25, marr: 25, trade: 10 }[kind]; t.rel[n.id] = clamp((t.rel[n.id] || 0) + bonus, -100, 100); n.rel[t.id] = clamp((n.rel[t.id] || 0) + bonus, -100, 100);
  log({ ally: 'Aliança', marr: 'Casamento real', trade: 'Acordo comercial' }[kind] + ' entre ' + natName(n) + ' e ' + natName(t) + '.', n.id === S.player || t.id === S.player ? 'good' : 'none', [n.id, t.id]);
  return '';
}
function aiPropose(n, t, kind) {                              // IA propõe; para o jogador vira uma janela
  if (t.id === S.player) { S.dipOffers = S.dipOffers || []; if (S.dipOffers.length < 2 && !(n.offerCd > S.t)) { S.dipOffers.push({ from: n.id, kind }); n.offerCd = S.t + 360 * 5; } return; }
  dipAct(n, t, kind);
}
function relDrift() {                                         // uma vez por ano: relações vão na direção do que as nações têm em comum
  S.nations.forEach(n => {
    if (!n.alive) return; const nb = neighbors(n);
    for (const k in n.rel) {
      const id = +k, t = nat(id); if (!t || !t.alive) continue;
      const target = (has(n, 'allies', id) ? 50 : 0) + (has(n, 'marr', id) ? 30 : 0) + (has(n, 'trade', id) ? 15 : 0) + (n.ideo === t.ideo ? 10 : 0) - (nb.has(id) ? 10 : 0) - (has(n, 'emb', id) || has(t, 'emb', n.id) ? 40 : 0) - (atWar(n.id, id) ? 100 : 0) + (t.senior === n.id || n.senior === id ? 40 : 0);
      n.rel[k] = clamp(n.rel[k] + (target - n.rel[k]) * .12, -100, 100);
    }
  });
}
function personality(n) {                                     // traços do governante mudam a IA
  const P = { war: 1, build: 1, army: 1, colon: 1, claim: 1, ally: 1, gold: 1 }, t = n.ruler.tr, mul = (k, v) => { P[k] *= v; };
  if (t.includes('brave')) mul('war', 1.3); if (t.includes('craven')) mul('war', .5); if (t.includes('ambitious')) { mul('war', 1.4); mul('claim', 1.5); } if (t.includes('content')) mul('war', .6);
  if (t.includes('just')) mul('claim', .1); if (t.includes('cruel')) mul('war', 1.3); if (t.includes('greedy')) mul('gold', 2); if (t.includes('generous')) mul('ally', 1.3);
  if (t.includes('diligent')) mul('build', 1.4); if (t.includes('lazy')) mul('build', .6); if (t.includes('schemer')) mul('claim', 1.8); if (t.includes('strategist')) mul('army', 1.25);
  if (t.includes('builder')) mul('build', 1.5); if (t.includes('navigator')) mul('colon', 1.6); if (t.includes('paranoid')) { mul('army', 1.3); mul('ally', .5); } if (t.includes('charismatic')) mul('ally', 1.4);
  return P;
}
function aiDiplomacy(n) {
  const P = personality(n), nb = [...neighbors(n)].map(nat).filter(t => t.alive);
  const known = S.nations.filter(t => t.alive && t !== n && n.exP[t.capital]);
  if ((n.allies || []).length < 3 && chance(.04 * P.ally)) {
    const c = known.filter(t => !has(n, 'allies', t.id) && !atWar(n.id, t.id)).map(t => [t, accept(t, n, 'ally')[0]]).sort((a, b) => b[1] - a[1])[0];
    if (c && c[1] >= 0) aiPropose(n, c[0], 'ally');
  }
  if (GOVS[n.gov].succ === 'hered' && (n.marr || []).length < 3 && chance(.04 * P.ally)) {
    const c = known.filter(t => GOVS[t.gov].succ === 'hered' && !has(n, 'marr', t.id)).map(t => [t, accept(t, n, 'marr')[0]]).sort((a, b) => b[1] - a[1])[0];
    if (c && c[1] >= 0) aiPropose(n, c[0], 'marr');
  }
  if ((n.trade || []).length < 4 && chance(.05)) {
    const c = known.filter(t => !has(n, 'trade', t.id) && !has(n, 'emb', t.id) && !has(t, 'emb', n.id)).map(t => [t, accept(t, n, 'trade')[0]]).sort((a, b) => b[1] - a[1])[0];
    if (c && c[1] >= 0) aiPropose(n, c[0], 'trade');
  }
  if (chance(.05) && nb.length) { const t = pickR(nb); if (strength(t) > strength(n) && (n.rel[t.id] || 0) < 30) dipAct(n, t, n.ruler.tr.includes('generous') ? 'gift' : 'improve'); }
  enemiesOf(n.id).forEach(e => { if (!has(n, 'emb', e) && chance(.3)) dipAct(n, nat(e), 'embargo'); });
  if (n.emb && n.emb.length && chance(.05)) { const e = n.emb.find(x => !atWar(n.id, x)); if (e != null) dipAct(n, nat(e), 'embargo'); }
  S.nations.forEach(j => { if (j.alive && j.senior === n.id && chance(.02)) dipAct(n, j, 'integrate'); });
}
function tryUnion(n) {                                        // sem herdeiros: um parceiro de casamento pode herdar (união pessoal)
  if (n.id === S.player || GOVS[n.gov].succ !== 'hered') return false;
  const cands = (n.marr || []).map(nat).filter(t => t.alive && t.senior == null && GOVS[t.gov].succ === 'hered' && t.id !== n.id);
  if (!cands.length || !chance(.6)) return false;
  const s = cands.sort((a, b) => strength(b) - strength(a))[0];
  n.senior = s.id; n.unionT = S.t; n.ruler = s.ruler; n.dyn = s.dyn; n.kids = []; n.spouse = null; link(n, s, 'allies');
  log('União pessoal: ' + natName(s) + ' herdou a coroa de ' + natName(n) + '.', 'world', [n.id, s.id]);
  return true;
}

/* ---------- colonização ---------- */
function canColonize(n, p) {
  if (S.own[p] !== -1) return 'Já tem dono'; if (!n.exP[p]) return 'Inexplorada';
  if (S.cols.some(c => c.p === p)) return 'Já em colonização';
  const adj = WD.provs[p].adj.some(o => S.own[o] === n.id), near = !adj && nearSea(n, p);
  if (!adj && !near) { if (n.fx.col < 1) return 'Exige Colonização (ou uma costa sua no mesmo mar)'; if (!WD.provs[p].coast || n.fx.sea < 1) return 'Fora de alcance'; }
  if (near && n.fx.sea < 1) return 'Exige navios (Barcos longos)';
  if (n.fx.col < 1 && S.pop[p] > (adj || near ? 9 : 4)) return 'Nativos numerosos: exige Colonização';
  if (statesOf(n, [p]) > domCap(n)) return 'Limite de domínio (' + domCap(n) + ' estados)';
  const slots = 1 + n.fx.col; if (S.cols.filter(c => c.o === n.id).length >= slots) return 'Sem colonos livres';
  if (n.money < colCost(n, p)) return 'Sem dinheiro';
  return '';
}
const nearSea = (n, p) => WD.provs[p].coast && WD.provs[p].seas.some(z => WD.seas[z].provs.some(q => S.own[q] === n.id));   // ilha ou costa no mesmo mar de uma província sua
const colCost = (n, p) => Math.round(35 * ECON.costMul * eraScale() * (WD.provs[p].adj.some(o => S.own[o] === n.id) ? .6 : nearSea(n, p) ? .7 : 1));
function colonize(n, p) { const e = canColonize(n, p); if (e) return e; n.money -= colCost(n, p); const easy = WD.provs[p].adj.some(o => S.own[o] === n.id) || nearSea(n, p); const m = Math.round((n.fx.col ? 18 : easy ? 24 : 48) / (1 + Math.max(-.5, n.m.colon || 0))); S.cols.push({ o: n.id, p, m, tot: m }); return ''; }

/* ---------- a Grande Peste (fim da Idade Média) ----------
   Surge entre 1340 e 1360 numa província de litoral do continente principal, passa para vizinhas e pelas rotas de mar.
   Cada província doente perde ~2,5% da população por mês durante um ano; depois fica imune. Quarentena reduz o contágio. */
function epiTick() {                                         // surtos menores: espalham pouco, matam menos e acabam logo
  S.epis = S.epis || [];
  if (curYear() > 900 && chance(.012)) { const ps = WD.provs.filter(p => S.own[p.id] >= 0 && S.pop[p.id] > 20); if (ps.length) { const p0 = pickR(ps); S.epis.push({ n: pickR(DISEASES) + ' de ' + p0.n, inf: { [p0.id]: 5 }, done: {} }); log('Surto de ' + S.epis[S.epis.length - 1].n.toLowerCase() + '.', S.own[p0.id] === S.player ? 'bad' : 'none', [S.own[p0.id]]); } }
  S.epis = S.epis.filter(E => {
    const add = {};
    for (const k in E.inf) {
      const p = +k, o = S.own[p], hp = o >= 0 ? ((nat(o).cov || {}).health || 0) : 0; S.pop[p] *= 1 - .012 * (1 - hp * .6);
      WD.provs[p].adj.forEach(q => { if (E.inf[q] == null && add[q] == null && !E.done[q] && chance(.12 * (1 - hp * .6) * (o >= 0 && nat(o).quar > S.t ? .3 : 1))) add[q] = 5; });
      if (--E.inf[k] <= 0) { delete E.inf[k]; E.done[p] = 1; }
    }
    Object.assign(E.inf, add); return Object.keys(E.inf).length > 0 && Object.keys(E.done).length < 60;
  });
}
function plagueTick() {
  epiTick();
  const y = curYear(), P = S.plague;
  if (!P) {
    if (y >= 1340 && !S.plagueDone && chance(y >= 1360 ? 1 : .02)) {
      const main = WD.conts.find(c => c.main), cands = WD.provs.filter(p => p.cont === main.id && p.coast && S.own[p.id] >= 0);
      const p0 = pickR(cands); S.plague = { inf: { [p0.id]: 12 }, done: {}, start: S.t };
      log('A Grande Peste surgiu em ' + p0.n + '!', 'world'); notify(S.player, '☠️ A Grande Peste', 'Uma praga mortal surgiu em ' + p0.n + ' e se espalha pelas estradas e pelos portos. Quem adoecer perde parte da população por um ano.');
    }
    return;
  }
  const inf = P.inf, newInf = {}, hit = new Set();
  const spread = (q, base) => { if (inf[q] != null || newInf[q] != null || P.done[q]) return; const o = S.own[q], qq = (o >= 0 && nat(o).quar > S.t ? .3 : 1) * (o >= 0 ? 1 - ((nat(o).cov || {}).health || 0) * .6 : 1); if (chance(base * qq)) newInf[q] = 12; };
  for (const k in inf) {
    const p = +k, pr = WD.provs[p]; S.pop[p] *= .965; if (S.own[p] >= 0) hit.add(S.own[p]);
    pr.adj.forEach(q => spread(q, .3));
    if (pr.coast && chance(.08)) { const z = WD.seas[pickR(pr.seas)], far = z.provs.length ? pickR(z.provs) : null; if (far != null) spread(far, .6); }
    if (--inf[k] <= 0) { delete inf[k]; P.done[p] = 1; }
  }
  Object.assign(inf, newInf);
  hit.forEach(o => { const n = nat(o); n.stab = Math.max(0, n.stab - .8); if (o === S.player && !P.warned) { P.warned = true; notify(S.player, '☠️ A Peste chegou', 'A praga chegou às terras de ' + natName(n) + '. Uma quarentena fecha portos e estradas: o contágio cai muito, mas o comércio também.', { quar: true }); log('A Peste chegou a ' + natName(n) + '.', 'bad', [o]); } });
  S.mapDirty = R_PLAGUE();
  if (!Object.keys(inf).length) { S.plague = null; S.plagueDone = { done: P.done }; log('A Grande Peste terminou depois de ' + Math.round((S.t - P.start) / 360) + ' anos.', 'world'); }
}
const R_PLAGUE = () => S.mapDirty || (typeof R !== 'undefined' && R.mode === 'plague');
const quarCost = n => Math.round(60 * eraScale());
function quarantine(n) { const c = quarCost(n); if (n.money < c) return 'Sem dinheiro'; if (n.quar > S.t) return 'Já em quarentena'; n.money -= c; n.quar = S.t + 360 * 2; return ''; }

/* ---------- escravos, revoltas e religião ---------- */
function slaveTick(n) {                                        // o estoque de escravos segue a lei: tráfico sobe devagar, abolição liberta aos poucos
  const L = LAWS.slavery.o[n.laws.slavery]; let elig = 0;
  if (L.sl) { if (n.laws.slavery === 'colonial') { for (const p of provsOf(n.id)) if (S.ctrl[p] === n.id && WD.provs[p].cont !== n.home) elig += S.pop[p]; } else elig = n.popT || 0; }
  let ens = 0; if (L.sl) { for (const c in (n.cpol || {})) if (n.cpol[c] === -2) ens += (n.culs || {})[c] || 0; for (const r in (n.rpol || {})) if (n.rpol[r] === -2) ens += (n.rels || {})[r] || 0; }
  const target = elig * L.sl + ens * .5; n.slv = n.slv || 0;
  if (n.slv < target) n.slv += (target - n.slv) * .015; else n.slv -= (n.slv - target) * (L.sl ? .02 : .05);
  if (n.slv < .05) n.slv = 0;
}
const REVOLT = { slave: ['Revolta de escravos', '⛓️'], low: ['Revolta popular', '✊'], cul: ['Levante separatista', '🏴'] };
const slaveShare = n => (n.cls ? n.cls.slave : 0) / Math.max(1, n.popT || 0);
function unrestTick(n) {
  const sl = slaveShare(n), cs = n.csat || {}, sec = (n.cov || {}).sec || 0, low = cs.low == null ? 1 : cs.low;
  if (sl > .02 && chance(sl * .05 * (1 - sec * .7) * (n.stab < 40 ? 2 : 1))) revolt(n, 'slave');
  else if (low < .55 && n.stab < 45 && chance((.55 - low) * .08 * (1 - sec * .5))) revolt(n, 'low');
  else if ((n.minC || 0) > .2 && n.stab < 35 && chance(.004 * Math.max(1, ...Object.values(n.cpol || {}).map(v => CPOL[v].ag)))) revolt(n, 'cul');
}
function revolt(n, kind) {
  const mine = provsOf(n.id).filter(p => S.ctrl[p] === n.id && p !== n.capital); if (!mine.length) return;
  let pool = kind === 'cul' ? mine.filter(p => S.culg[p] !== n.cul && (n.cpol || {})[S.culg[p]] !== 2) : kind === 'slave' && n.laws.slavery === 'colonial' ? mine.filter(p => WD.provs[p].cont !== n.home) : mine;
  if (!pool.length) pool = mine;
  const p0 = pickR(pool), st = WD.states[WD.provs[p0].state], ps = [p0, ...st.provs.filter(p => p !== p0 && S.own[p] === n.id && S.ctrl[p] === n.id && p !== n.capital)].slice(0, 1 + (rnd() * 3 | 0));
  const str = Math.max(2, ps.reduce((a, p) => a + S.pop[p], 0) * (kind === 'slave' ? .12 : .06)), [nm, ic] = REVOLT[kind];
  const here = S.armies.filter(a => a.o === n.id && ps.includes(a.p)), force = here.reduce((a, x) => a + regs(x) * (1 + n.m.army) * genMul(x.gen), 0);
  if (force > str) {                                            // tropas no local reprimem na hora
    here.forEach(a => { const k = Math.min(.4, str / force * .3); ['inf', 'cav', 'art', 'vrt'].forEach(t => a[t] *= 1 - k); });
    n.stab = Math.max(0, n.stab - 2); if (kind === 'slave') n.slv *= .97;
    log(ic + ' ' + nm + ' em ' + st.n + ' foi esmagada pelas tropas.', n.id === S.player ? 'info' : 'none', [n.id]); return;
  }
  ps.forEach(p => { S.ctrl[p] = -1; S.rebels[p] = { k: kind, o: n.id, s: str / ps.length }; delete S.sieges[p]; });
  n.stab = Math.max(0, n.stab - 5); S.mapDirty = true; ownChanged();
  const txt = ic + ' ' + nm + ' em ' + st.n + ': ' + ps.length + ' província' + (ps.length > 1 ? 's' : '') + ' nas mãos dos rebeldes.';
  log(txt, n.id === S.player ? 'bad' : 'none', [n.id]);
  notify(n.id, ic + ' ' + nm, txt + ' Mande tropas para retomá-las (elas cercam como num cerco comum). Se os rebeldes tomarem 30% do país, impõem o que querem.');
}
function rebelTick() {
  const R0 = S.rebels || (S.rebels = {}), per = {};
  for (const k in R0) {
    const p = +k, r = R0[k], o = S.own[p];
    if (S.ctrl[p] !== -1 || o < 0) { delete R0[k]; continue; }
    r.o = o; r.s *= .995; if (nat(o).stab >= 45 && chance(.015)) { delete R0[k]; S.ctrl[p] = o; S.mapDirty = true; continue; }   // anistia: com o país estável, rebeldes se dispersam
    per[o] = per[o] || []; per[o].push(p); S.pop[p] *= .997;
    if (chance(.05)) { const q = WD.provs[p].adj.find(x => S.own[x] === o && S.ctrl[x] === o && x !== nat(o).capital && !S.armies.some(a => a.p === x && a.o === o)); if (q != null) { S.ctrl[q] = -1; R0[q] = { k: r.k, o, s: r.s * .8 }; S.mapDirty = true; } }
  }
  for (const o in per) { const n = nat(+o), ps = per[o]; n.stab = Math.max(0, n.stab - Math.min(6, ps.length * .5)); if (ps.length >= Math.max(3, provsOf(n.id).length * .3)) rebelsWin(n, R0[ps[0]].k, ps); }
}
function rebelsWin(n, kind, ps) {
  let txt;
  if (kind === 'slave') { n.laws.slavery = 'banned'; n.slv *= .3; txt = 'Os escravos rebelados venceram em ' + natName(n) + ': a escravidão foi abolida.'; }
  else if (kind === 'low') {
    n.laws.tax = 'low'; const rg = Object.keys(GOVS).filter(g => GOVS[g].cat === 'Socialista' && govOk(n, g) && g !== n.gov);
    if (rg.length) { applyGov(n, pickR(rg)); succeed(n, false); txt = 'A revolução venceu em ' + natName(n) + '.'; } else { succeed(n, false); txt = 'A revolta popular derrubou o governo de ' + natName(n) + ' e baixou os impostos.'; }
  } else {
    const up = ['accepted', 'multi'].find(o => lawOk(n, 'culture', o) && n.laws.culture !== o);
    if (up) { n.laws.culture = up; txt = 'Os separatistas venceram em ' + natName(n) + ': a cidadania foi ampliada.'; }
    else { ps.forEach(p => { S.own[p] = -1; }); txt = 'Os separatistas venceram: ' + ps.length + ' províncias deixaram ' + natName(n) + '.'; }
  }
  ps.forEach(p => { delete S.rebels[p]; if (S.own[p] >= 0) S.ctrl[p] = S.own[p]; else S.ctrl[p] = -1; });
  n.stab = Math.min(100, n.stab + 10); ownChanged(); checkDead(); calcMods(n);
  log(txt, n.id === S.player ? 'bad' : 'world', [n.id]); notify(n.id, '🏴 Os rebeldes venceram', txt);
}
function religTick() {                                         // uma vez por ano: conversão à fé do Estado e heresias fictícias
  if (!S.culg) initCul(); if (!S.relg) initRelig(); const y = curYear();
  S.nations.forEach(n => {
    if (!n.alive) return; const L = LAWS.relig.o[n.laws.relig], k = n.laws.relig === 'state' ? 1 : n.laws.relig === 'tolerant' ? .5 : n.laws.relig === 'free' ? .2 : 0; if (n.relig == null) n.relig = S.relg[n.capital];
    const edu = (n.cov || {}).edu || 0;
    for (const p of provsOf(n.id)) {
      if (S.relg[p] !== n.relig && k) { const t = S.bld[WD.provs[p].state].temple || 0, lv = CPOL[(n.rpol || {})[S.relg[p]] || 0]; if (chance(.025 * k * lv.as * (1 + t * .4))) S.relg[p] = n.relig; }
      if (S.culg[p] !== n.cul) { const lv = CPOL[(n.cpol || {})[S.culg[p]] || 0]; if (chance(.008 * lv.as * (1 + edu))) S.culg[p] = n.cul; }
    }
    const ps = provsOf(n.id); if (!ps.length) return;
    if (y > 1450 && chance(.003)) { const p = pickR(ps); S.relg[p] = REL_IDS.indexOf('aurora'); if (n.id === S.player) log('🌅 Uma heresia, o Culto da Aurora, surgiu em ' + WD.provs[p].n + '.', 'info', [n.id]); }
    if (y > 1880 && hasT(n, 'eco_factory') && chance(.002)) { const p = pickR(ps); S.relg[p] = REL_IDS.indexOf('machine'); if (n.id === S.player) log('⚙️ A Igreja da Máquina ganhou fiéis em ' + WD.provs[p].n + '.', 'info', [n.id]); }
  });
  const fict = new Set(REL_IDS.map((r, i) => RELIGIONS[r].fict ? i : -1).filter(i => i >= 0));     // heresias se espalham devagar
  for (let p = 0; p < S.relg.length; p++) if (fict.has(S.relg[p]) && chance(.08)) { const q = pickR(WD.provs[p].adj); const o = S.own[q]; if (o < 0 || nat(o).laws.relig !== 'state') S.relg[q] = S.relg[p]; }
  S.mapDirty = S.mapDirty || (typeof R !== 'undefined' && (R.mode === 'rel' || R.mode === 'cul'));
}
/* política para culturas e religiões que não são a principal: −2 escravizar · −1 reprimir · 0 livre · +1 integrar · +2 aceitar */
const polCost = () => Math.round(20 * eraScale());
const culSlots = n => CUL_SLOTS[n.laws.culture] + ((n.rank || 0) >= 4 ? 1 : 0);
const relSlots = n => REL_SLOTS[n.laws.relig];
function polWhy(n, kind, id, v) {
  const pol = (kind === 'cul' ? n.cpol : n.rpol) || {}, cur = pol[id] || 0, main = kind === 'cul' ? n.cul : n.relig;
  if (+id === main) return kind === 'cul' ? 'É a cultura principal' : 'É a fé oficial'; if (v === cur) return 'Já está assim';
  if (v === -2 && n.laws.slavery === 'banned') return 'Exige escravidão permitida (lei)';
  if (v === 2) { const used = Object.entries(pol).filter(([k, x]) => x === 2 && +k !== +id).length, cap = kind === 'cul' ? culSlots(n) : relSlots(n); if (used >= cap) return 'Sem vagas (' + used + '/' + cap + '): ' + (kind === 'cul' ? 'a lei de Cidadania e o título de Império dão mais' : 'a lei de Religião dá mais'); }
  if ((n.polCd || {})[kind + id] > S.t) return 'Mudada há pouco'; if (n.money < polCost()) return 'Sem dinheiro'; return '';
}
function setPol(n, kind, id, v) {
  const e = polWhy(n, kind, id, v); if (e) return e; const key = kind === 'cul' ? 'cpol' : 'rpol'; n[key] = n[key] || {};
  n.money -= polCost(); n.stab = Math.max(0, n.stab - (v < 0 ? 4 : 2)); if (v) n[key][id] = v; else delete n[key][id]; (n.polCd = n.polCd || {})[kind + id] = S.t + 360 * 2; return '';
}
const mainCost = () => Math.round(150 * eraScale());
function makeMain(n, kind, id) {                               // uma cultura aceita vira a principal (ou uma fé reconhecida vira a oficial)
  const pol = (kind === 'cul' ? n.cpol : n.rpol) || {}; if ((pol[id] || 0) !== 2) return kind === 'cul' ? 'Só uma cultura aceita' : 'Só uma fé reconhecida';
  if (n.money < mainCost()) return 'Sem dinheiro'; if ((n.mainCd || 0) > S.t) return 'Mudança recente (até ' + yearOf(n.mainCd) + ')';
  n.money -= mainCost(); n.stab = Math.max(0, n.stab - 15); n.mainCd = S.t + 360 * 20;
  const old = kind === 'cul' ? n.cul : n.relig; pol[old] = 2; delete pol[id];
  if (kind === 'cul') n.cul = +id; else n.relig = +id; calcMods(n);
  log(natName(n) + (kind === 'cul' ? ' adotou a cultura ' + CULTURES[id].n + ' como principal.' : ' adotou ' + RELIGIONS[REL_IDS[id]].n + ' como fé oficial.'), n.id === S.player ? 'good' : 'world', [n.id]); return '';
}

/* ---------- mensal ---------- */
function monthTick() {
  const y = curYear(), newYear = S.t % 360 === 0;
  plagueTick(); alienTick();
  if (S.nations.some(n => n.alive && !Number.isFinite(n.money + n.stab + n.manpower + (n.income || 0)))) repairGame(false);   // nunca deixa um −NaN se espalhar
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
    n.cons.forEach(c => c.m--); n.cons.filter(c => c.m <= 0).forEach(c => { if (stateOwnerOf(c.s) === n.id) { S.bld[c.s][c.b] = (S.bld[c.s][c.b] || 0) + 1; const f = BUILDINGS[c.b].fx; if (f && (f.infra || f.pipe)) S.mapDirty = true; if (n.id === S.player) log(BUILDINGS[c.b].n + ' concluída em ' + WD.states[c.s].n + '.', 'good', [n.id]); } }); n.cons = n.cons.filter(c => c.m > 0);
    n.rec.forEach(r => r.m--);
    n.rec.filter(r => r.m <= 0).forEach(r => {
      if (r.type === 'ship') { const pr = WD.provs[r.at]; if (S.own[r.at] === n.id) { const z = pr.seas[0], f = S.fleets.find(f => f.o === n.id && f.z === z && !f.path.length); if (f) f.ships += r.k; else addFleet(n.id, z, r.k); } return; }
      const at = S.own[r.at] === n.id && S.ctrl[r.at] === n.id ? r.at : n.capital; const ex = S.armies.find(a => a.o === n.id && a.p === at && !a.path.length);
      if (ex) ex[r.type] += r.k; else addArmy(n.id, at, { [r.type]: r.k });
    });
    n.rec = n.rec.filter(r => r.m > 0);
    // contingente, estabilidade, cansaço de guerra
    const mpMax = Math.max(0, (n.popT || 0) - (n.cls ? n.cls.slave : 0)) * .03 * (1 + n.m.manpower); n.mpMax = mpMax; n.manpower = Math.min(mpMax, n.manpower + (n.popT || 0) * .00025 * (1 + n.m.manpower));
    const war = warsOf(n.id).length; n.wex = war ? Math.min(30, n.wex + .4) : Math.max(0, n.wex - .6);
    const target = stabParts(n).reduce((a, x) => a + x[1], 0);
    n.stab = clamp(n.stab + clamp(target - n.stab, -2, 2), 0, 100);
    // reivindicação
    if (n.fab && --n.fab.m <= 0) { n.claims[n.fab.s] = 1; if (n.id === S.player) log('Reivindicação sobre ' + WD.states[n.fab.s].n + ' fabricada.', 'good', [n.id]); n.fab = null; }
    (n.pros || []).forEach(x => x.m--); (n.pros || []).filter(x => x.m <= 0).forEach(x => prospectDone(n, x.s)); if (n.pros) n.pros = n.pros.filter(x => x.m > 0);
    if (n.sproj && --n.sproj.m <= 0) { const k = n.sproj.k; n.sproj = null; spaceDone(n, k); }
    supportTick(n); slaveTick(n); unrestTick(n); pressTick(n);
    charMonthly(n); tmodTick(n); if (n.alive) eventsTick(n);
    if (n.id !== S.player) ai(n);
  });
  rebelTick();
  for (const a of S.armies) if (a.gen && chance(deathChance(a.gen))) { if (a.o === S.player) log('O general ' + charName(a.gen) + ' morreu aos ' + ageOf(a.gen) + ' anos.', 'info', [a.o]); a.gen = null; }
  S._threat = null; strC = null; enterC = null;
  // reforços: exércitos parados em casa voltam ao tamanho máximo usando o contingente
  for (const a of S.armies) {
    const n = nat(a.o), r = regs(a); a.max = Math.max(a.max || 0, r);
    if (a.path.length || a.inBattle || a.p >= WD.provs.length || S.own[a.p] !== a.o || S.ctrl[a.p] !== a.o || r >= a.max - .05 || n.manpower < .5) continue;
    const add = Math.min(n.manpower, (a.max - r) * .2), k = add / Math.max(.01, r); ['inf', 'cav', 'art', 'vrt'].forEach(t => a[t] += a[t] * k); n.manpower -= add;
  }
  S.nations.forEach(n => { if (n.alive && S.ctrl[n.capital] !== n.id && S.own[n.capital] === n.id) n.stab = Math.max(0, n.stab - 2); });   // capital ocupada
  // população
  S.nations.forEach(n => { n._fs = n.foodSat == null ? 1 : n.foodSat; n._gm = 1 + (n.m ? n.m.growth : 0); n._cap = (1 + (n.fx ? (n.fx.bo.farm || 0) : 0) + (y > 1800 ? (y - 1800) / 120 : 0)) * (1 + ((n.cov || {}).health || 0) * .2); });
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
  if (newYear) { relDrift(); religTick(); }
  if (y >= END_YEAR && !S.over) { S.over = 'end'; log('O ano ' + END_YEAR + ' chegou. A crônica termina.', 'world'); }
}

/* fatores da estabilidade (alvo para onde ela anda até 2 pontos por mês) */
const VOTE_W = { nobles: [.7, .2, .1], census: [.45, .35, .2], universal: [.25, .35, .4] };
function stabParts(n) {
  const cs = n.csat || {}, w = VOTE_W[n.laws.vote] || VOTE_W.nobles, g = k => cs[k] == null ? 1 : cs[k], ws = g('high') * w[0] + g('mid') * w[1] + g('low') * w[2], sl = slaveShare(n);
  const rebels = Object.values(S.rebels || {}).filter(r => r.o === n.id).length, ruler = demandsOf(n).filter(d => d.slot === 'ruler').length;
  return [['Base', 36], ['Governo, ideologia, leis e tecnologia', n.m.stab * 100], ['Comida', (n.foodSat - 1) * 60], ['Satisfação das classes (pelo peso do sufrágio)', (ws - .7) * 25], ['Cansaço de guerra', -n.wex],
    ['Templos', Math.min(10, (n.temples || 0)) * (n.laws.relig === 'secular' ? .5 : 1)], ['Segurança', ((n.cov || {}).sec || 0) * 12], ['Dívida', n.money < 0 ? -15 : 0], ['Acima do limite de domínio', -overCap(n) * 3],
    ['Escravos', -(sl * 50 + Math.max(0, sl - .15) * 150)], ['Minorias culturais e religiosas', -((n.minC || 0) + (n.minR || 0)) * 8], ['Vontades do governante não atendidas', -ruler * 2], ['Províncias rebeladas', -rebels * 1.5]].filter(x => Math.abs(x[1]) >= .5);
}

/* ---------- IA ---------- */
const atWarNow = n => warsOf(n.id).length > 0;
function threatAt(p) {                                     // regimentos por dono em cada província (refeito uma vez por mês)
  if (!S._threat) { S._threat = new Map(); for (const a of S.armies) { if (!S._threat.has(a.p)) S._threat.set(a.p, []); S._threat.get(a.p).push(a); } }
  return S._threat.get(p) || [];
}
function ai(n) {
  const y = curYear(), slow = ((S.t / 30 | 0) + n.id) % 3 === 0, P = personality(n), tr = n.ruler.tr;   // decisões pesadas a cada 3 meses; P = temperamento do governante
  // pesquisa
  if (!n.res && (slow || n.rp > 50)) {
    const opts = TECHS.filter(t => techState(n, t) === '');
    let pickT = null;
    if (n.vert && chance(.6)) pickT = opts.filter(t => t.v === n.vert).sort((a, b) => a.y - b.y)[0];
    if (!pickT && !n.vert && n.vpref) pickT = opts.find(t => t.entry && t.v === n.vpref);   // cada IA tem uma vertente preferida (ou nenhuma)
    if (!pickT) { const main = opts.filter(t => !t.entry).sort((a, b) => a.y - b.y); pickT = main.length ? main[Math.min(main.length - 1, rnd() * Math.min(3, main.length) | 0)] : null; }
    if (pickT) n.res = pickT.id;
  }
  // governo e ideologia (raro)
  if (chance(.0012) && !(n.govCd > S.t)) {
    const opts = [...n.fx.g, ...BASE_GOVS].filter(g => g !== n.gov && GOVS[g] && govOk(n, g));
    const same = opts.filter(g => GOVS[g].cat === GOVS[n.gov].cat), g = same.length && chance(.85) ? pickR(same) : opts.length && chance(.5) ? pickR(opts) : null;
    if (g && GOVS[g].m && Object.values(GOVS[g].m).reduce((a, b) => a + b, 0) >= Object.values(GOVS[n.gov].m).reduce((a, b) => a + b, 0) + .05) setGov(n, g);
  }
  if (chance(.003) && !(n.ideoCd > S.t) && !isElective(n)) { const inf = ideoInfluence(n), opts = [...n.fx.i].filter(i => i !== n.ideo).sort((a, b) => (inf[b] || 0) - (inf[a] || 0)); if (opts.length) setIdeo(n, chance(.7) ? opts[0] : pickR(opts)); }
  if (slow) aiDiplomacy(n);
  if (slow && GOVS[n.gov].until && curYear() > GOVS[n.gov].until && !(n.govCd > S.t)) { const nx = GOVS[n.gov].next; setGov(n, nx && govOk(n, nx) ? nx : [...n.fx.g].find(g => GOVS[g].cat === GOVS[n.gov].cat && govOk(n, g)) || nx); }
  if (slow && chance(.05)) { const L = n.laws; if (n.money < 0 && L.tax === 'normal') setLaw(n, 'tax', 'high'); else if (n.stab < 25 && (L.tax === 'high' || L.tax === 'extort')) setLaw(n, 'tax', 'normal'); else if (atWarNow(n) && L.draft === 'limited') setLaw(n, 'draft', 'wide'); else if (!atWarNow(n) && L.draft === 'wide') setLaw(n, 'draft', 'limited'); else if (n.money > 3000 && L.spend === 'normal' && hasT(n, 'soc_welfare')) setLaw(n, 'spend', 'welfare'); }
  if (slow && isElective(n) && n.sup && (n.sup[n.ideo] || 0) < .3 && n.money > campaignCost() * 4) campaign(n);
  // exigências do conselho e do governante: atende uma ou troca o conselheiro mais exigente
  if (slow && ((n.press || 0) > 45 || chance(.04))) {
    const d = demandsOf(n).sort((a, b) => b.w - a.w)[0];
    if (d && chance(.5)) { if (d.ty === 'law') setLaw(n, d.k, d.v); else if (d.ty === 'gov') { if (!(n.govCd > S.t)) setGov(n, d.v); } else if (!(n.ideoCd > S.t) && !isElective(n)) setIdeo(n, d.v); }
    else if (d && d.slot !== 'ruler' && n.money > councilCost() * 3) swapCouncil(n, d.slot, councilCands(n, d.slot).sort((a, b) => (a.lg ? 1 : 0) + (a.ll ? 1 : 0) - (b.lg ? 1 : 0) - (b.ll ? 1 : 0))[0]);
  }
  if (slow && chance(.03)) { const L = n.laws, sl = slaveShare(n);
    if (L.slavery !== 'banned' && (sl > .12 && n.stab < 35 || hasT(n, 'soc_nationalism') && chance(.3))) setLaw(n, 'slavery', 'banned');
    else if (L.slavery === 'colonial' && !hasT(n, 'soc_enlightenment') && (tr.includes('greedy') || tr.includes('cruel')) && chance(.3)) setLaw(n, 'slavery', 'legal');
    else if ((n.minR || 0) > .12) { const o = ['free', 'tolerant'].find(o => lawOk(n, 'relig', o) && L.relig !== o && L.relig !== 'secular'); if (o) setLaw(n, 'relig', o); }
    else if ((n.minC || 0) > .12) { const o = ['multi', 'accepted'].find(o => lawOk(n, 'culture', o) && L.culture !== o); if (o) setLaw(n, 'culture', o); }
    else { const k = pickR(['women', 'hours', 'subsidy', 'company']), os = Object.keys(LAWS[k].o).filter(o => lawOk(n, k, o) && o !== L[k]); if (os.length && chance(.4)) setLaw(n, k, os[os.length - 1]); } }
  if (slow && chance(.08)) { const st = pickR(S._mine[n.id] || []); if (st && !canProspect(n, st.id)) prospect(n, st.id); }
  if (slow && launchOk(n) && !n.sproj) { for (const k of ['probe', 'land', 'base', 'sat']) if (!canSpace(n, k) && n.money > spaceCost(k) * 2 && (k !== 'sat' || (n.sats || 0) < 8)) { spaceGo(n, k); break; } }
  if (slow && (n.rank || 0) < 4 && n.money > rankCost(n) * 1.5 && (statesOf(n) > domCap(n) * .7 || (n.rank === 3 && contShare(n) >= RANK_EMP))) rankUp(n);
  // obras (ganancioso guarda mais ouro; diligente e construtor tentam mais)
  const mine = slow || n.money > 2000 ? S._mine[n.id] : [];
  const slotsN = consSlots(n), tries = Math.round(clamp(slotsN / 3, 3, 40) * P.build), stGdp = (n.gdp || 0) / Math.max(1, mine.length);
  if (mine.length && n.cons.length < consSlots(n) && n.money > 100 * P.gold) {
    const atW = warsOf(n.id).length > 0, avail = Object.keys(BUILDINGS).filter(b => BUILDINGS[b].vert ? n.vert === BUILDINGS[b].vert : n.fx.b.has(b)), vals = [];
    for (const b of avail) {                                    // valor de cada prédio para o país (não depende do estado)
      const d = BUILDINGS[b];
      let v = 0; if (d.out) for (const g in d.out) v += d.out[g] * S.wp[g] * (n.mk.sat[g] < 1 ? 1.6 : 1); if (d.in) for (const g in d.in) v -= d.in[g] * S.wp[g] * (n.mk.sat[g] < .8 ? 2 : 1);
      if (d.fx) v += (d.fx.svc ? (1 - ((n.cov || {})[d.fx.svc] || 0)) * 50 : 0) + (d.fx.speed || 0) * 8 + (d.fx.army ? (atW ? 30 : 8) : 0) + (d.fx.mp ? 10 : 0) + (d.fx.launch && hasT(n, 'spc_rockets') && !launchOk(n) ? 300 : 0) + (d.fx.pipe ? 15 : 0) + (d.fx.mill ? (n.foodSat < 1.05 ? 80 : 10) : 0) + (d.fx.yard ? 4 : 0) + (d.fx.research || 0) * 4 + (d.fx.tax || 0) * (n.gdp || 0) * .15 + (d.fx.prod || 0) * Math.max(60, stGdp) + (d.fx.fort ? (atW ? 25 : 4) : 0) + (d.fx.port ? 8 : 0) + (d.fx.stab ? (n.stab < 45 ? 20 : 3) : 0);
      if (d.out) for (const g of ['goods', 'cloth', 'clothes', 'pfood', 'lux', 'tools', 'arms']) if (d.out[g] && (n.mk.sat[g] == null ? 1 : n.mk.sat[g]) < .85) v += d.out[g] * S.wp[g] * 1.2 + 20;
      if ((b === 'farm' || b === 'fishery') && n.foodSat < 1.05) v += 120; else if (n.foodSat < .95 && d.w > 1) v -= 40;
      if (b === 'university' && tr.includes('scholar')) v += 40; if (b === 'temple' && tr.includes('zealous')) v += 40; if (b === 'temple' && tr.includes('cynical')) v -= 30; if (b === 'market' && tr.includes('greedy')) v += 40;
      v = v / bCost(n, b) * 100 + rnd() * 3; if (v > 1) vals.push([v, b]);
    }
    vals.sort((x, y) => y[0] - x[0]);
    const sts = Array.from({ length: clamp(3 + slotsN / 10, 3, 12) }, () => pickR(mine));
    // modernização: sem mão de obra, desmonta artesanato antigo onde já dá para ter fábricas
    if (hasT(n, 'eco_factory') && chance(.3)) { const s = sts[0], B = S.bld[s.id]; if (freeLabor(n, s.id) < 2) { const old = ['workshop', 'weaver', 'manufactory', 'bakery', 'tailor', ...(hasT(n, 'eco_mechanization') ? ['smithy'] : [])].filter(b => B[b] > 0).sort((a, b) => B[b] - B[a])[0]; if (old) B[old] = Math.max(0, B[old] - Math.max(1, Math.ceil(B[old] * .25))); } }
    let done = 0;
    for (const [, b] of vals.slice(0, 18)) { for (const st of sts) { if (done >= tries || n.cons.length >= slotsN || n.money <= 100 * P.gold) break; if (!build(n, st.id, b)) done++; } if (done >= tries) break; }
  }
  // exército (em dívida, desmobiliza um pouco)
  const myArmies = S.armies.filter(a => a.o === n.id), myR = myArmies.reduce((a, x) => a + regs(x), 0), atWarN = warsOf(n.id).length;
  if (slow && n.money > genCost() * 4) { const a = myArmies.filter(a => !a.gen && !a.exp && regs(a) >= 4).sort((x, y) => regs(y) - regs(x))[0]; if (a && chance(.3)) setGeneral(n, a, genCands(n).sort((x, y) => genMul(y) - genMul(x))[0]); }
  if (slow && !atWarN && chance(.06 * P.colon) && !(n.expCd > S.t) && !myArmies.some(a => a.exp)) {   // manda uma tropa barata explorar a terra incógnita
    const a = myArmies.find(a => a.p === n.capital && a.inf >= 2 && !a.path.length); n.expCd = S.t + 360 * 4;
    if (a) { a.inf -= 1; const e = addArmy(n.id, a.p, { inf: 1 }); e.exp = true; }
  }
  const rebP = Object.keys(S.rebels || {}).map(Number).filter(p => S.own[p] === n.id);
  if (rebP.length && !atWarN) myArmies.filter(a => !a.exp && !a.path.length && !rebP.includes(a.p)).slice(0, 2).forEach(a => { const p = rebP.sort((x, y) => Math.hypot(WD.provs[x].cx - WD.provs[a.p < WD.provs.length ? a.p : n.capital].cx, WD.provs[x].cy - WD.provs[a.p < WD.provs.length ? a.p : n.capital].cy) - Math.hypot(WD.provs[y].cx - WD.provs[a.p < WD.provs.length ? a.p : n.capital].cx, WD.provs[y].cy - WD.provs[a.p < WD.provs.length ? a.p : n.capital].cy))[0]; orderArmy(a, p); });
  if (n.money < 0 && n.income < 0 && !atWarN && myArmies.length) { const a = myArmies[0]; a.inf *= .85; a.cav *= .85; a.art *= .85; a.vrt *= .85; }
  const want = clamp((n.popT || 0) * .006 * (atWarN ? 1.5 : 1) * (.7 + IDEOS[n.ideo].war * .25) * (n.money > 3000 ? 1.6 : 1) * P.army, 2, 1200);
  if (myR + n.rec.reduce((a, r) => a + (r.type !== 'ship' ? r.k : 0), 0) < want && (n.income > 0 || n.money > 500)) {
    const k = Math.max(1, Math.min(Math.floor(n.manpower), Math.max(3, Math.ceil((want - myR) / 3))));
    const type = n.vert && chance(.2) && n.mk.sat[VERT[n.vert].good] > .5 ? 'vrt' : canArt(n) && chance(.2) ? 'art' : chance(.25) ? 'cav' : 'inf';
    recruit(n, type, k);
  }
  mergeIdle(n.id);
  // frotas: exploração e transporte
  const coastal = provsOf(n.id).filter(p => WD.provs[p].coast);
  if (coastal.length && n.fx.sea) {
    const ships = S.fleets.filter(f => f.o === n.id).reduce((a, f) => a + f.ships, 0);
    const wantS = Math.ceil(myR / 3 * (n.kind === 'cold' || n.fx.col ? .8 : .3)) + 1;
    if (ships < wantS && n.money > shipCost(n) * 3 && n.income > 0) buildShips(n, Math.min(3, wantS - ships), pickR(coastal));
    const fl = S.fleets.filter(f => f.o === n.id); if (fl.length && !fl.some(f => f.auto) && chance(.05) && (n.fx.sea >= 2 || n.kind === 'cold')) { const f = pickR(fl); f.auto = true; }
  }
  // colonização
  if (slow && chance((n.fx.col ? .6 : .15) * P.colon)) {
    const cand = []; for (const p of provsOf(n.id)) for (const o of WD.provs[p].adj) if (S.own[o] === -1) cand.push(o);
    if (n.fx.col) for (let k = 0; k < 40; k++) { const p = WD.provs[rnd() * WD.provs.length | 0]; if (S.own[p.id] === -1 && n.exP[p.id] && p.coast) cand.push(p.id); }
    if (cand.length) { const p = pickR(cand); if (!canColonize(n, p)) colonize(n, p); }
  }
  // guerra: declarar
  if (slow && !atWarN && n.senior == null && !overCap(n) && n.stab > 35 && n.money > 0 && chance(.012 * IDEOS[n.ideo].war * P.war * (GOVS[n.gov].cat === 'Tribal' ? 1.4 : 1))) {
    const nb = new Set(); for (const p of provsOf(n.id)) for (const o of WD.provs[p].adj) { const t = S.own[o]; if (t >= 0 && t !== n.id) nb.add(t); }
    if (n.kind === 'cold' || n.fx.col) S.nations.forEach(t => { if (t.alive && t.id !== n.id && provsOf(t.id).some(p => n.exP[p] && WD.provs[p].coast) && chance(.15)) nb.add(t.id); });
    const myP = myR * (1 + n.m.army) * n.up.inf;
    const myAll = myP + (n.allies || []).map(nat).filter(x => x.alive).reduce((s, x) => s + strength(x) * .5, 0);
    const targets = [...nb].map(nat).filter(t => t.alive && !(n.truce[t.id] > S.t) && !atWar(n.id, t.id) && !has(n, 'allies', t.id) && !(has(n, 'marr', t.id) && chance(.7)) && t.senior !== n.id)
      .map(t => [t, strength(t) + (t.allies || []).map(nat).filter(x => x.alive).reduce((s, x) => s + strength(x) * .6, 0)]).filter(([, pw]) => myAll > pw * 1.35);
    if (targets.length) { const [t] = pickR(targets); const st = WD.states.find(s => s.provs.some(p => S.own[p] === t.id) && s.provs.some(p => WD.provs[p].adj.some(o => S.own[o] === n.id))); declareWar(n, t, st ? st.id : null); }
  } else if (slow && !atWarN && !n.fab && chance(.06 * P.claim) && n.money > 80) {
    const st = WD.states.find(s => !n.claims[s.id] && s.provs.some(p => S.own[p] >= 0 && S.own[p] !== n.id && WD.provs[p].adj.some(o => S.own[o] === n.id)));
    if (st) fabricate(n, st.id);
  }
  // guerra: mover exércitos
  if (atWarN) {
    const foes = enemiesOf(n.id);
    for (const a of myArmies) {
      if (a.path.length || a.retreat || a.exp || a.mor < .5 || a.p >= WD.provs.length) continue;
      const P = WD.provs.length; let best = null, bd = 1e9;
      const seen = new Map([[a.p, 0]]), q = [a.p];
      for (let h = 0; h < q.length && h < 600; h++) {
        const v = q[h], d = seen.get(v);
        if (v !== a.p && (foes.includes(S.ctrl[v]) || (S.ctrl[v] === -1 && S.own[v] === n.id))) {
          const threat = threatAt(v).filter(b => foes.includes(b.o)).reduce((s, b) => s + regs(b), 0);
          const score = d - (S.own[v] === n.id ? 8 : 0) + (threat > regs(a) * 1.2 ? 99 : 0);
          if (score < bd) { bd = score; best = v; }
        }
        if (d > 14) continue;
        for (const o of WD.provs[v].adj) if (!seen.has(o) && n.exP[o] && canEnter(n.id, o)) { seen.set(o, d + 1); q.push(o); }
      }
      if (best == null && (n.kind === 'cold' || transport(n.id) >= regs(a))) { const fp = provsOf(foes[0]).filter(p => WD.provs[p].coast && n.exP[p]); if (fp.length) best = pickR(fp); }
      if (best != null && orderArmy(a, best)) continue;
      // sem alvo perto: marcha para a província inimiga conhecida mais próxima (ou volta para casa)
      const pa = WD.provs[a.p], far = foes.flatMap(f => provsOf(f)).filter(p => n.exP[p]).sort((x, y) => Math.hypot(WD.provs[x].cx - pa.cx, WD.provs[x].cy - pa.cy) - Math.hypot(WD.provs[y].cx - pa.cx, WD.provs[y].cy - pa.cy)).slice(0, 3);
      if (!far.some(p => orderArmy(a, p)) && a.p !== n.capital) orderArmy(a, n.capital);
    }
  } else {
    // em paz: junta os exércitos na capital
    for (const a of myArmies) if (!a.path.length && !a.exp && a.p !== n.capital && a.p < WD.provs.length && !rebP.includes(a.p) && chance(.1)) orderArmy(a, n.capital);
    const atCap = myArmies.filter(a => a.p === n.capital && !a.path.length && !a.exp); if (atCap.length > 1) { const m = atCap[0]; atCap.slice(1).forEach(a => { m.inf += a.inf; m.cav += a.cav; m.art += a.art; m.vrt += a.vrt; m.gen = m.gen || a.gen; a.inf = a.cav = a.art = a.vrt = 0; }); S.armies = S.armies.filter(a => regs(a) > .08); }
  }
}

/* ---------- reparo (botão de debug e checagem mensal): números inválidos, caches, exércitos picados e travados ---------- */
function mergeIdle(id) {                                      // junta exércitos parados na mesma província
  const by = new Map(); let k = 0;
  S.armies.forEach(a => { if (a.o !== id || a.exp || a.path.length || a.inBattle || a.p >= WD.provs.length) return; const l = by.get(a.p); if (l) l.push(a); else by.set(a.p, [a]); });
  by.forEach(l => { if (l.length < 2) return; const m = l[0]; l.slice(1).forEach(a => { m.inf += a.inf; m.cav += a.cav; m.art += a.art; m.vrt += a.vrt; m.mor = Math.min(m.mor, a.mor); m.gen = m.gen || a.gen; a.inf = a.cav = a.art = a.vrt = 0; k++; }); m.max = regs(m); });
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
  S.t++; dayTick();
  if (S.t % 30 === 0) monthTick();
}
function score(n) { return Math.round((n.popT || 0) / 100 + (n.gdp || 0) / 50 + techCount(n) * 5 + provsOf(n.id).length * 2); }

/* ---------- salvar / carregar ---------- */
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
const unb64 = (s, T = Uint8Array) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };
function saveGame() {
  const o = Object.assign({}, S, { stSpd: undefined, stS: undefined, stD: undefined, stInfo: undefined, relg: S.relg ? b64(S.relg) : undefined, culg: S.culg ? b64(S.culg) : undefined, own: b64(new Uint8Array(S.own.buffer)), ctrl: b64(new Uint8Array(S.ctrl.buffer)), pop: b64(new Uint8Array(S.pop.buffer)), news: [], offer: null, mapDirty: undefined,
    nations: S.nations.map(n => Object.assign({}, n, { exP: b64(n.exP), exZ: b64(n.exZ), m: undefined, fx: undefined, up: undefined, eff: undefined })), calls: [], dipOffers: [], evq: (S.evq || []).filter(e => e.ev), conf: null });
  try { localStorage.setItem('chronicle-save', JSON.stringify(o)); return true; } catch (e) { return false; }
}
function loadGame() {
  let o; try { o = JSON.parse(localStorage.getItem('chronicle-save')); } catch (e) { return false; }
  if (!o || o.v !== 2) return false;
  WD = generateWorld(o.seed);
  o.own = unb64(o.own, Int16Array); o.ctrl = unb64(o.ctrl, Int16Array); o.pop = unb64(o.pop, Float32Array);
  o.nations.forEach(n => { n.exP = unb64(n.exP); n.exZ = unb64(n.exZ); });
  S = o; if (!Number.isInteger(S.rs)) S.rs = (S.seed ^ S.t) | 0; S.news = []; S.rebels = S.rebels || {}; if (o.culg) S.culg = unb64(o.culg); else initCul(); if (o.relg) S.relg = unb64(o.relg); else initRelig();
  GOOD_IDS.forEach(g => { if (!(S.wp[g] > 0)) S.wp[g] = GOODS[g].p; });   // saves antigos: bens novos sem preço davam −NaN/mês
  ownChanged(); warsChanged(); S.nations.forEach(n => { if (n.alive) calcMods(n); }); econAll(); return true;
}
const hasSave = () => { try { const s = localStorage.getItem('chronicle-save'); return !!s && s.startsWith('{"v":2'); } catch (e) { return false; } };
