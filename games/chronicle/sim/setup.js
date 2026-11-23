/* Grand Chronicle — simulação: criação do mundo e início em eras avançadas. */
'use strict';

/* ---------- criação do jogo ---------- */
function hsl(h, s, l) { const a = s * Math.min(l, 1 - l), f = k => { const x = (k + h * 12) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(x - 3, 9 - x, 1)))); }; return [f(0), f(8), f(4)]; }

function newGame(seed, y0 = START_YEAR) {
  WD = generateWorld(seed); WD.seed = seed; resetCaches();
  const P = WD.provs.length, r = mkRng(seed ^ 0x5eed);
  S = { v: 3, faith: rollFaiths(seed), culx: rollCultures(seed), rs: (seed ^ 0x2545F491) | 0, moon: null, seed, y0, t: 360 * (y0 - START_YEAR), player: -1, nations: [], own: new Int16Array(P).fill(-1), ctrl: new Int16Array(P).fill(-1), pop: new Float32Array(P), bld: WD.states.map(() => ({})),
        armies: [], fleets: [], wars: [], cols: [], sieges: {}, battles: {}, log: [], news: [], id: 1, wp: {}, over: false };
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
    owner.forEach((nid, s) => WD.states[s].provs.forEach(p => { S.own[p] = nid; S.ctrl[p] = nid; })); ownChanged();
    ns.forEach(n => {
      n.capital = WD.states[n._st[0]].cap; delete n._st; delete n.vig;
      n.rank = startRank(n);
      if (n.kind === 'main') { const ty = adv ? y0 - (r() * 12 | 0) : 880 + (r() * 40 | 0); if (!adv) grantTechs(n, ty); /* início avançado: as técnicas do principal vêm só de advanceStart (grantUntil); o sorteio fica para não mudar a sequência */ n.gov = pickR(['feudal', 'feudal', 'feudal', 'feudal', 'elective', 'elective', 'tribal', 'theocracy']); n.ideo = chance(.25) ? 'warrior' : 'trad'; n.money = 160; }
      else if (n.kind === 'cold') { grantTechs(n, adv ? y0 - 10 - (r() * 25 | 0) : 860, ['nav_longship']); n.gov = pickR(['tribal', 'tribal', 'tribal_conf']); n.ideo = 'warrior'; n.money = 90; }
      else { grantTechs(n, adv ? y0 - 15 - (r() * 35 | 0) : 860); if (!adv && chance(.4)) delete n.techs.nav_longship; n.gov = pickR(['tribal', 'tribal', 'tribal', 'tribal_conf', 'horde', 'feudal']); n.ideo = chance(.3) ? 'warrior' : 'trad'; n.money = 60; }
      if (n.gov === 'theocracy') n.flag.c = { k: pickR(['cross_patty', 'sun', 'eye', 'crescent', 'star8']), t: TINCT[n.flag.t[0]].metal ? 'gules' : 'or', n: 1, at: 'center' };
      n.ruler = mkChar(n, { ruler: true }); if (GOVS[n.gov].succ === 'hered') { n.spouse = mkChar(n, { f: !n.ruler.f, dyn: newDynasty(n), age: ageOf(n.ruler) - 3 }); n.kids = []; if (ageOf(n.ruler) > 24) for (let k = 0; k < 1 + (r() * 3 | 0); k++) n.kids.push(mkChar(n, { age: Math.max(0, ageOf(n.ruler) - 20 - (r() * 8 | 0)) })); }
      n.council = {}; COUNCIL.forEach(([k]) => n.council[k] = councilChar(n, k));
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
    addArmy(n.id, n.capital, { inf: Math.ceil(regs * .75), cav: Math.floor(regs * .25) }, .25);
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
  econAll(); if (!adv) priceTick(true); S.news = [];
  log('O ano é ' + y0 + '. As crônicas começam.', 'world');
  return S;
}
/* cultura de cada província: cada país tem de 45% a 85% da população na cultura principal (perto da capital) e o resto em 1–3 culturas secundárias
   (muitas vezes subculturas irmãs); sempre ao menos 15% diferente, quando o país tem mais de uma província. Povos sem país viram bolsões. */
function initCul() {
  S.culg = new Uint8Array(WD.provs.length); WD.provs.forEach(p => { S.culg[p.id] = p.cul; });
  const r = mkRng(S.seed ^ 0xc017), N = CULTURES.length;
  for (const n of S.nations) {
    const cap = WD.provs[n.capital >= 0 ? n.capital : provsOf(n.id)[0]], ps = provsOf(n.id).slice().sort((a, b) => Math.hypot(WD.provs[a].cx - cap.cx, WD.provs[a].cy - cap.cy) - Math.hypot(WD.provs[b].cx - cap.cx, WD.provs[b].cy - cap.cy));
    if (ps.length < 2) continue; const tot = ps.reduce((t, p) => t + S.pop[p], 0), main = .45 + r() * .4;
    let acc = 0, cut = ps.length; for (let i = 0; i < ps.length; i++) { if (acc / tot >= main) { cut = i; break; } acc += S.pop[ps[i]]; }
    while (cut > 1 && ps.slice(cut).reduce((t, p) => t + S.pop[p], 0) / tot < .15) cut--;   // garante 15% de outras culturas
    const sib = CULTURES.map((c, i) => i).filter(i => i !== n.cul && culKin(i, n.cul)), k = 1 + (r() * 3 | 0), others = [];
    for (let i = 0; i < k; i++) { let c = r() < .5 && sib.length ? sib[r() * sib.length | 0] : r() * N | 0; if (c === n.cul) c = (c + 1) % N; others.push(c); }
    ps.forEach((p, i) => { S.culg[p] = i < cut ? n.cul : others[Math.min(k - 1, Math.floor((i - cut) / Math.max(1, ps.length - cut) * k))]; });
  }
  // bolsões de povos sem país
  const caps = new Set(S.nations.map(n => WD.provs[n.capital >= 0 ? n.capital : 0].state)), minors = CULTURES.map((c, i) => i).filter(i => isMinorCul(i)).sort(() => r() - .5).slice(0, 9);
  for (let i = 0, t = 0; i < minors.length && t < 300; t++) { const st = WD.states[r() * WD.states.length | 0]; if (caps.has(st.id) || WD.conts[st.cont].cold) continue; const c = minors[i++]; st.provs.forEach(p => { if (r() < .7) S.culg[p] = c; }); }
}
/* tecnologias da árvore normal até um ano (respeitando pré-requisitos; com vertente, as substituídas ficam de fora) */
function grantUntil(n, maxY) {
  const V = n.vert && VERT[n.vert];
  for (let ch = true; ch;) { ch = false; for (const t of TECHS) { if (t.v || n.techs[t.id] || t.y > maxY || (V && V.rep.has(t.id)) || !t.req.every(q => n.techs[q] || (n.eff && n.eff.has(q)))) continue; n.techs[t.id] = 1; ch = true; } }
}
/* escolhe, troca ou desfaz a vertente na criação do mundo: árvore até o nível do país e prédios da vertente */
function setVertStart(n, v) {
  for (const id in n.techs) if (TECH[id] && TECH[id].v) delete n.techs[id];
  n.vert = null; n.vlv = 0; n.eff = null; n.vdec = {};
  for (const st of WD.states) if (stateOwnerOf(st.id) === n.id) { const B = S.bld[st.id]; for (const b in B) if (BUILDINGS[b].vert && BUILDINGS[b].vert !== v) delete B[b]; }
  if (v) {
    const V = VERT[v]; n.vert = v; n.techs['v_' + v] = 1;
    if (n.vdec) delete n.vdec[v];
    for (const id in n.techs) if (V.rep.has(id)) delete n.techs[id];
    for (let ch = true; ch;) { ch = false; calcMods(n); for (const t of TECHS) if (t.v === v && (t.vt || t.vr) && !n.techs[t.id] && t.y <= (n.techY || curYear()) && t.req.every(q => n.techs[q] || n.eff.has(q))) { n.techs[t.id] = 1; ch = true; } }
    grantUntil(n, n.techY || curYear());
    calcMods(n);
    const cs = WD.states[WD.provs[n.capital].state]; if (!S.bld[cs.id][V.bld]) S.bld[cs.id][V.bld] = 1;
  } else grantUntil(n, n.techY || curYear());
  // pontos iniciais de outras vertentes que o país já alcançou: pesquisados e recusados (10% do bônus de cada)
  declineReached(n); return '';
}
function declineReached(n) { calcMods(n); n.vdec = n.vdec || {}; VERTS.forEach(o => { if (o.id !== n.vert && o.entry.y <= (n.techY || curYear()) && o.entry.req.every(q => hasT(n, q))) { n.techs['v_' + o.id] = 1; n.vdec[o.id] = 1; } }); calcMods(n); }
const vertStartOpts = n => VERTS.filter(v => v.entry.y <= (n.techY || curYear()) && vertNeedOk(n, v.id));
/* começo em era avançada: vertentes, governos da época, prédios, colônias e mapa conhecido */
const govYear = g => BASE_GOVS.includes(g) ? 860 : (TECHS.find(t => (t.fx.g || []).includes(g)) || { y: 860 }).y;
function advanceStart(Y, r) {
  const devPick = ['farm', 'stud', 'apothecary', 'fishery', 'lumber', 'iron_mine', 'quarry', 'plantation', 'smithy', 'weaver', 'tailor', 'bakery', 'workshop', 'temple', 'mill', 'market', 'road', 'hospital', 'school', 'office', 'guard', 'port', 'university', 'jeweler', 'coal_mine', 'gold_mine', 'copper_mine', 'foundry', 'manufactory', 'textile_manuf', 'blast_furnace', 'barracks', 'shipyard', 'academy',
    'railway', 'textile_mill', 'goods_factory', 'garment_factory', 'food_factory', 'tool_factory', 'arms_factory', 'steel_mill', 'power_plant', 'hydro', 'oil_well'];
  S.pandDone = {}; for (const id in PANDEMICS) if (Y >= PANDEMICS[id].y[1]) S.pandDone[id] = { done: {} };   // pandemias de antes do início já passaram
  // as potências chegam perto do máximo da época; as menores ficam alguns anos atrás
  const big = S.nations.filter(n => n.kind === 'main').sort((a, b) => provsOf(b.id).length - provsOf(a.id).length);
  big.forEach((n, i) => { const q = i / Math.max(1, big.length); n.techY = Y - (q < .2 ? 0 : q < .5 ? 2 + (r() * 4 | 0) : 5 + (r() * 10 | 0)); grantUntil(n, n.techY); });
  S.nations.forEach(n => {
    if (n.kind === 'main' && chance(n.vpref ? .7 : .3)) { const o = vertStartOpts(n); if (o.length) { const v = o.find(x => x.id === n.vpref) || pickR(o); setVertStart(n, v.id); } }
    if (!n.vert) declineReached(n);
    calcMods(n);
    // governo e ideologia da época (só o que a tecnologia já liberou)
    const cat = GOVS[n.gov].cat, opts = [...new Set([...n.fx.g, ...BASE_GOVS])].filter(g => govOk(n, g) && (n.kind === 'main' || GOVS[g].cat === cat || chance(.3)));
    const sc = g => (GOVS[g].cat === cat ? 120 : 0) + (n.kind === 'main' && Y >= 1100 && GOVS[g].cat === 'Monarquia' ? 140 : 0) - (n.kind === 'main' && GOVS[g].cat === 'Tribal' ? 200 : 0) + govYear(g) * .25 + r() * 160; const g = opts.sort((a, b) => sc(b) - sc(a))[0];
    if (g && g !== n.gov) { const her = GOVS[n.gov].succ === 'hered'; applyGov(n, g); n.govCd = 0; if (her !== (GOVS[g].succ === 'hered')) succeed(n, false); }   // governo de início não conta como reforma recente
    if (Y >= 1453 && chance(.6)) { const io = [...n.fx.i].sort((a, b) => (TECHS.find(t => (t.fx.i || []).includes(b)) || { y: 0 }).y - (TECHS.find(t => (t.fx.i || []).includes(a)) || { y: 0 }).y); if (io.length) n.ideo = io[Math.min(io.length - 1, r() * 3 | 0)]; }
    for (const k in LAWS) if (chance(.4)) { const os = Object.keys(LAWS[k].o).filter(o => lawOk(n, k, o) && !(k === 'slavery' && o === 'legal')); if (os.length) n.laws[k] = os[os.length - 1 - (r() * Math.min(2, os.length) | 0)]; }
    calcMods(n); for (const k in LAWS) if (lawOld(n, k)) { const os = Object.keys(LAWS[k].o).filter(o => lawOk(n, k, o)); if (os.length) n.laws[k] = os[0]; }   // nada de lei passada da era no início
    formCouncil(n); calcMods(n);   // conselho escolhido pelo governo e pela ideologia da época
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
  exploreEra(Y);
  { const ai = REL_IDS.indexOf('atheism'), AT = FAITH_RULES.atheism; if (ai >= 0 && Y > RELIGIONS.atheism.y0) S.nations.forEach(n => { const k = Math.min(.25, AT.base * (Y - RELIGIONS.atheism.y0) * (AT.law[n.laws.relig] ?? 1)); provsOf(n.id).forEach(p => { if (chance(k)) S.relg[p] = ai; }); }); }   // ateus de antes do início
  ownChanged(); S.nations.forEach(n => { if (!n.alive) return; const fc = S.relg[n.capital]; if (!RELIGIONS[REL_IDS[fc]].atheist) n.relig = fc;   // capital com ateus semeados não torna o Estado ateu
    [n.ruler, n.spouse, ...(n.kids || [])].forEach(c => { if (c) c.rel = n.relig; }); calcMods(n); });   // a família do governante segue a fé oficial
  const ys = eraScale(); econAll(); S.nations.forEach(n => { if (n.alive) calcMods(n); }); priceTick(true);
  S.nations.forEach(n => { n.money *= S.plv / ys; });   // o tesouro inicial acompanha o nível de preços da época
}
/* povos com continente (os outros são bolsões menores) */
const culMajor = () => WD._cm || (WD._cm = new Set(WD.conts.flatMap(c => c.cul)));
const isMinorCul = c => !culMajor().has(+c);
const isMinorRel = r => !(S.relMajor || []).includes(+r);
/* religião independente da cultura: cada país tem uma fé majoritária que cobre de 50% a 100% da população, mais 1–2 fés menores;
   em 10% dos casos a fé oficial é a de uma minoria. Terra sem dono segue a fé sorteada da região. */
function initRelig() {
  if (!S.culg) initCul();
  S.relg = new Uint8Array(WD.provs.length); const r = mkRng(S.seed ^ 0x2e1), heresy = i => RELIGIONS[REL_IDS[i]].fict;
  const pool = REL_IDS.map((k, i) => i).filter(i => !heresy(i) && !RELIGIONS[REL_IDS[i]].atheist).sort(() => r() - .5), core = pool.slice(0, 14), any = () => core[r() * core.length | 0];
  const regRel = WD.regions.map(() => any()); WD.provs.forEach(p => { S.relg[p.id] = regRel[p.region]; });
  for (const n of S.nations) {
    const nb = [...neighbors(n)].map(nat).filter(x => x.majRel != null), main = nb.length && r() < .4 ? nb[r() * nb.length | 0].majRel : any(); n.majRel = main;
    const cap = WD.provs[n.capital], ps = provsOf(n.id).slice().sort((a, b) => Math.hypot(WD.provs[a].cx - cap.cx, WD.provs[a].cy - cap.cy) - Math.hypot(WD.provs[b].cx - cap.cx, WD.provs[b].cy - cap.cy));
    const tot = ps.reduce((t, p) => t + S.pop[p], 0), cover = r() < .35 ? 1 : .5 + r() * .5, others = [any(), r() < .5 ? any() : null].filter(x => x != null && x !== main);
    let acc = 0; ps.forEach((p, i) => { if (acc / tot < cover || !others.length) { S.relg[p] = main; acc += S.pop[p]; } else S.relg[p] = others[i % others.length]; });
    n.relig = others.length && r() < .1 ? others[0] : main;      // fé oficial de uma minoria (incomum)
  }
  [...pool.slice(14, 17), REL_IDS.indexOf('serpent')].forEach(ri => { for (let i = 0; i < 2; i++) { const st = WD.states[r() * WD.states.length | 0]; st.provs.forEach(p => { if (r() < .6) S.relg[p] = ri; }); } });   // bolsões de fés menores
  S.relMajor = [...new Set(S.nations.flatMap(n => [n.relig, n.majRel]))]; S.reserveRel = pool.filter(i => !S.relg.includes(i) && !S.relMajor.includes(i));
  S.nations.forEach(n => { delete n.majRel; if (n.ruler) n.ruler.rel = n.relig; });
}
/* mapa conhecido pela era (EXPLORE_ERA): litoral primeiro, interior do litoral para dentro; o mais fundo de cada continente é o último a ser conhecido */
function exploreEra(Y) {
  const E = EXPLORE_ERA, st = E.steps; if (Y < st[0][0]) return;
  let i = 0; while (i < st.length - 1 && st[i + 1][0] <= Y) i++; const a = st[i], b = st[Math.min(st.length - 1, i + 1)], f = b[0] > a[0] ? clamp((Y - a[0]) / (b[0] - a[0]), 0, 1) : 0;
  const coastK = a[1] + (b[1] - a[1]) * f, inK = a[2] + (b[2] - a[2]) * f;
  // profundidade de cada província a partir do litoral, por continente (0 = costa)
  const P = WD.provs.length, depth = new Int16Array(P).fill(-1), q = []; WD.provs.forEach(p => { if (p.coast) { depth[p.id] = 0; q.push(p.id); } });
  for (let h = 0; h < q.length; h++) for (const o of WD.provs[q[h]].adj) if (depth[o] < 0 && WD.provs[o].cont === WD.provs[q[h]].cont) { depth[o] = depth[q[h]] + 1; q.push(o); }
  const maxD = WD.conts.map(() => 1); WD.provs.forEach(p => { if (depth[p.id] > maxD[p.cont]) maxD[p.cont] = depth[p.id]; });
  S.nations.forEach(n => { if (!n.alive) return; const k = Y >= E.catchUp ? 1 : (E.kind[n.kind] ?? .5), cK = coastK * k, iK = inK * k;
    WD.provs.forEach(p => { const d = depth[p.id]; if (n.exP[p.id]) return;
      if (d === 0 ? chance(cK) : d > 0 && cK > 0 && d / maxD[p.cont] <= iK + (rnd() - .5) * .1) { n.exP[p.id] = 1; p.seas.forEach(z => n.exZ[z] = 1); } });
    WD.seas.forEach(z => { if (z.provs.some(p => n.exP[p])) n.exZ[z.id] = 1; }); });
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
