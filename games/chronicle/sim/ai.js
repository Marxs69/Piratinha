/* Grand Chronicle — simulação: IA. */
'use strict';

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
    if (!pickT) { const main = opts.filter(t => !t.entry || chance(.2)).sort((a, b) => a.y - b.y); pickT = main.length ? main[Math.min(main.length - 1, rnd() * Math.min(3, main.length) | 0)] : null; }
    if (pickT) n.res = pickT.id;
  }
  // governo e ideologia (raro)
  if (chance(.0012) && !(n.govCd > S.t)) {
    const opts = govReach(n);   // só caminhos da árvore de governos
    const same = opts.filter(g => GOVS[g].cat === GOVS[n.gov].cat), g = same.length && chance(.85) ? pickR(same) : opts.length && chance(.5) ? pickR(opts) : null;
    if (g && GOVS[g].m && Object.values(GOVS[g].m).reduce((a, b) => a + b, 0) >= Object.values(GOVS[n.gov].m).reduce((a, b) => a + b, 0) + .05) setGov(n, g);
  }
  if (chance(.003) && !(n.ideoCd > S.t) && !isElective(n)) { const inf = ideoInfluence(n), opts = [...n.fx.i].filter(i => i !== n.ideo).sort((a, b) => (inf[b] || 0) - (inf[a] || 0)); if (opts.length) setIdeo(n, chance(.7) ? opts[0] : pickR(opts)); }
  if (slow) { aiDiplomacy(n); aiFaith(n); aiCourt(n); }
  if (slow && GOVS[n.gov].cat === 'Tribal' && curYear() >= (GOVS[n.gov].until || 2000) - 250 && !isHorde(n) && !(n.govCd > S.t) && chance(.03)) { const up = govReach(n).filter(g => GOVS[g].cat !== 'Tribal'); if (up.length) setGov(n, up.includes(GOVS[n.gov].next) ? GOVS[n.gov].next : pickR(up)); }   // tribo com técnica e título vira reino
  if (slow && govAge(n) > 5 && !(n.govCd > S.t) && chance(.1)) { const nx = govNextOf(n); if (nx) setGov(n, nx); }   // a IA reforma por conta própria só depois de anos de crise
  if (slow && chance(.05)) { const L = n.laws; if (n.money < 0 && L.tax === 'normal') setLaw(n, 'tax', 'high'); else if (n.stab < 25 && (L.tax === 'high' || L.tax === 'extort')) setLaw(n, 'tax', 'normal'); else if (atWarNow(n) && L.draft === 'limited') setLaw(n, 'draft', 'wide'); else if (!atWarNow(n) && L.draft === 'wide') setLaw(n, 'draft', 'limited'); else if (n.money > hoardCap(n) * .6 && L.spend === 'normal' && hasT(n, 'soc_welfare')) setLaw(n, 'spend', 'welfare'); }
  if (slow && isElective(n) && n.sup && (n.sup[n.ideo] || 0) < .3 && n.money > campaignCost() * 4) campaign(n);
  if (slow && !n.enact && chance(.2)) { const k = Object.keys(LAWS).find(k => lawOld(n, k)); if (k) { const os = Object.keys(LAWS[k].o).filter(o => lawOk(n, k, o)); if (os.length) setLaw(n, k, os[0]); } }   // troca a lei que ficou ultrapassada
  // agenda do governo: o que governante (peso 3) e conselho (1 cada) mais querem pela ideologia vira proposta (um conselho inteiro socialista empurra o país para a república popular)
  if (slow && !n.enact && chance(.3)) { const want = new Map(), add = (key, w) => want.set(key, (want.get(key) || 0) + w);
    [[n.ruler, 3], ...COUNCIL.map(([k]) => [n.council[k], 1])].forEach(([c, w]) => { if (!c || c.disc > S.t) return; if (c.lg && govEdgeOk(n, c.lg) && !(n.govCd > S.t)) add('g:' + c.lg, w * 1.2); if (c.ll && lawOk(n, c.ll.k, c.ll.o) && !((n.lawCd || {})[c.ll.k] > S.t)) add('l:' + c.ll.k + ':' + c.ll.o, w); });
    const top = [...want].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) { const [ty, a, b] = top[0].split(':'); if (ty === 'g') setGov(n, a); else setLaw(n, a, b); } }
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
  if (slow && (n.rank || 0) < 4 && n.money > rankCost(n) * 1.5 && statesOf(n) > domCap(n) * .7 && statesOf(n) >= RANK_REQ[(n.rank || 0) + 1]) rankUp(n);
  // obras (ganancioso guarda mais ouro; diligente e construtor tentam mais)
  const rich = n.money > hoardCap(n) * .6, reserve = Math.max(100 * P.gold, govCost() * 1.2);   // guarda o bastante para propor reformas e leis
  if (n.money > hoardCap(n) * .9 && n.income > 0 && n.cons.length >= consSlots(n) && n.money - slotCost(n) > reserve) buySlot(n);   // perto do teto: compra canteiro
  const mine = (slow || rich ? S._mine[n.id] : null) || [];
  const slotsN = consSlots(n), tries = Math.round(clamp(slotsN / 3, 3, 40) * P.build), stGdp = (n.gdp || 0) / Math.max(1, mine.length);
  if (mine.length && n.cons.length < consSlots(n) && n.money > reserve) {
    const atW = warsOf(n.id).length > 0, avail = Object.keys(BUILDINGS).filter(b => BUILDINGS[b].vert ? n.vert === BUILDINGS[b].vert : n.fx.b.has(b)), vals = [];
    for (const b of avail) {                                    // valor de cada prédio para o país (não depende do estado)
      const d = BUILDINGS[b];
      let v = 0; if (d.out) for (const g in d.out) v += d.out[g] * S.wp[g] * (n.mk.sat[g] < 1 ? 1.6 : 1); if (d.in) for (const g in d.in) v -= d.in[g] * S.wp[g] * (n.mk.sat[g] < .8 ? 2 : 1);
      if (d.fx) v += (d.fx.svc ? (1 - ((n.cov || {})[d.fx.svc] || 0)) * 50 : 0) + (d.fx.svcP ? Object.entries(d.fx.svcP).reduce((a, [k, e]) => a + (1 - ((n.cov || {})[k] || 0)) * 50 * e, 0) : 0) + ((d.fx.speed || 0) + (d.fx.frt || 0)) * 8 + (d.fx.army ? (atW ? 30 : 8) : 0) + (d.fx.mp ? 10 : 0) + (d.fx.launch && hasT(n, 'spc_rockets') && !launchOk(n) ? 300 : 0) + (d.fx.pipe ? 15 : 0) + (d.fx.boost && Object.keys(d.fx.boost).some(x => BUILDINGS[x] && BUILDINGS[x].food) ? (n.foodSat < 1.05 ? 80 : 10) : 0) + (d.fx.yard ? 4 : 0) + (d.fx.research || 0) * 4 + (d.fx.tax || 0) * (n.gdp || 0) * .6 + (d.fx.prod || 0) * Math.max(60, stGdp) + (d.fx.fort ? (atW ? 25 : 4) : 0) + (d.fx.port ? 8 : 0) + (d.fx.stab ? (n.stab < 45 ? 20 : 3) : 0);
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
    for (const [, b] of vals.slice(0, 18)) { for (const st of sts) { if (done >= tries || n.cons.length >= slotsN || n.money <= reserve) break; if (!build(n, st.id, b)) done++; } if (done >= tries) break; }
  }
  // exército: generais, exploradores, rebeldes, dívida, recrutamento e organização (aiArmy)
  const myArmies = S.armies.filter(a => a.o === n.id), myR = myArmies.reduce((a, x) => a + regs(x), 0), atWarN = warsOf(n.id).length;
  if (slow && n.money > genCost() * 10 && chance(.1)) {   // generais: um a cada três exércitos, só nos grandes
    const gs = groupsOf(n.id).filter(G => !G.some(a => a.exp)), sz = G => G.reduce((s, a) => s + regs(a), 0), withG = gs.filter(G => G.some(a => a.gen)).length;
    const G = gs.filter(G => !G.some(a => a.gen) && sz(G) >= armyFull(n) * .6).sort((x, y) => sz(y) - sz(x))[0];
    if (G && withG < Math.floor((gs.length + 1) / 3)) setGeneral(n, G[0], genCands(n).sort((x, y) => genMul(y) - genMul(x))[0]); }
  if (slow && !atWarN && chance(.06 * P.colon) && !(n.expCd > S.t) && !myArmies.some(a => a.exp)) {   // manda uma tropa barata explorar a terra incógnita
    const a = myArmies.find(a => a.p === n.capital && a.inf >= 2 && !a.path.length); n.expCd = S.t + 360 * 4;
    if (a) { a.inf -= 1; const e = addArmy(n.id, a.p, { inf: 1 }, a.xp); e.exp = true; }
  }
  const rebP = Object.keys(S.rebels || {}).map(Number).filter(p => S.own[p] === n.id);
  if (rebP.length && !atWarN) myArmies.filter(a => !a.exp && !a.path.length && !rebP.includes(a.p) && regs(a) >= 3).slice(0, 2).forEach(a => { const o = WD.provs[a.p < WD.provs.length ? a.p : n.capital]; orderArmy(a, rebP.slice().sort((x, y) => Math.hypot(WD.provs[x].cx - o.cx, WD.provs[x].cy - o.cy) - Math.hypot(WD.provs[y].cx - o.cx, WD.provs[y].cy - o.cy))[0]); });
  if (n.money < 0 && n.income < 0 && !atWarN && myArmies.length && !isHorde(n)) { const a = myArmies.filter(a => !a.exp).sort((x, y) => regs(y) - regs(x))[0]; if (a) { n.manpower += regs(a) * .15; UT.forEach(t => a[t] *= .85); a.max = regs(a); a.drill = false; } }   // em dívida: desmobiliza (os homens voltam à reserva e o exército não se refaz sozinho)
  aiRecruit(n, myArmies, myR, atWarN, P);
  // frotas: exploração e transporte
  const coastal = provsOf(n.id).filter(p => WD.provs[p].coast);
  if (coastal.length && n.fx.sea) {
    const ships = S.fleets.filter(f => f.o === n.id).reduce((a, f) => a + f.ships, 0);
    const overseas = atWarN && !frontsOf(n.id).length, wantS = Math.ceil(Math.max(myR * (n.kind === 'cold' || n.fx.col ? .25 : .08), overseas ? armyTarget(n) : 0) / shipCap(n)) + 1;   // frota para levar ao menos um exército de campanha quando a guerra é além-mar
    if (ships < wantS && n.money > shipCost(n) * 3 && n.income > 0) buildShips(n, Math.min(3, wantS - ships), pickR(coastal));
    const fl = S.fleets.filter(f => f.o === n.id && !f.inv); if (fl.length && !fl.some(f => f.auto) && chance(.05) && !overseas && (n.fx.sea >= 2 || n.kind === 'cold')) { const f = pickR(fl); f.auto = true; }
  }
  // colonização
  if (slow && chance((n.fx.col ? .6 : .15) * P.colon)) {
    const cand = []; for (const p of provsOf(n.id)) for (const o of WD.provs[p].adj) if (S.own[o] === -1) cand.push(o);
    if (n.fx.col) for (let k = 0; k < 40; k++) { const p = WD.provs[rnd() * WD.provs.length | 0]; if (S.own[p.id] === -1 && n.exP[p.id] && p.coast) cand.push(p.id); }
    if (cand.length) { const p = pickR(cand); if (!canColonize(n, p)) colonize(n, p); }
  }
  // guerra: declarar
  const horde = isHorde(n);              // invasores: atacam sem parar, sem olhar estabilidade nem limite de domínio
  if ((slow || horde) && (!atWarN || (horde && atWarN < 2)) && n.senior == null && (horde || (!overCap(n) && n.stab > 35 && n.money > 0 && (n.ae || 0) < PEACE.aeBlock)) && chance(horde ? .3 : .012 * IDEOS[n.ideo].war * P.war * (GOVS[n.gov].cat === 'Tribal' ? 1.4 : 1))) {
    const nb = new Set(); for (const p of provsOf(n.id)) for (const o of WD.provs[p].adj) { const t = S.own[o]; if (t >= 0 && t !== n.id) nb.add(t); }
    if (n.kind === 'cold' || n.fx.col) S.nations.forEach(t => { if (t.alive && t.id !== n.id && provsOf(t.id).some(p => n.exP[p] && WD.provs[p].coast) && chance(.15)) nb.add(t.id); });
    const edge = horde ? .8 : 1.3;
    let RC0 = null; const RC = () => RC0 || (RC0 = reachComp(n));
    const targets = [...nb].map(nat).filter(t => t.alive && !(n.truce[t.id] > S.t) && !atWar(n.id, t.id) && !has(n, 'allies', t.id) && !noWarUntil(n, t) && !(has(n, 'marr', t.id) && chance(.7)) && t.senior !== n.id && t.id !== n.senior)
      .map(t => [t, blocPower(t, n) + coalCands(n, t).reduce((s, id) => s + milPower(nat(id)) * .8, 0)]).filter(([t, pw]) => blocPower(n, t) > pw * edge && !coldBlocked(n.id, t.id))   // conta a coalizão que viria
      .filter(([t]) => horde || aiReaches(n, t, RC));   // só contra quem alcança (R1b passo 4; o jogador declara livre)
    if (targets.length) { const [t] = pickR(targets); const st = WD.states.find(s => s.provs.some(p => S.own[p] === t.id) && s.provs.some(p => WD.provs[p].adj.some(o => S.own[o] === n.id))); declareWar(n, t, st ? st.id : null); }
  } else if (slow && !atWarN && !n.fab && chance(.06 * P.claim) && n.money > 80) {
    const st = WD.states.find(s => !n.claims[s.id] && s.provs.some(p => S.own[p] >= 0 && S.own[p] !== n.id && WD.provs[p].adj.some(o => S.own[o] === n.id)));
    if (st) fabricate(n, st.id);
  }
  aiArmy(n, P, rebP);
}

/* alcance para declarar (R1b passo 4, critico-c): algum exército (ou a capital, sem exército) chega a uma província de t por terra ou
   travessia de mar livre (reachComp/reachTo, as regras de findPath), ou há rota de invasão de uma costa própria a uma costa de t */
function aiReaches(n, t, RC) {
  const P = WD.provs.length, tp = provsOf(t.id), from = new Set();
  for (const a of S.armies) if (a.o === n.id && !a.exp && a.p < P) from.add(a.p);
  if (!from.size && n.capital != null) from.add(n.capital);
  for (const f of from) for (const p of tp) if (reachTo(n, RC(), f, p)) return true;
  if (!n.fx.sea) return false;
  const memo = new Map(), tz = new Set(); for (const p of tp) if (WD.provs[p].coast) for (const z of WD.provs[p].seas) if (n.exZ[z] && seaOk(n, z)) tz.add(z);
  if (!tz.size) return false;
  for (const p of provsOf(n.id)) { if (!WD.provs[p].coast || S.ctrl[p] !== n.id) continue;
    for (const z0 of WD.provs[p].seas) { if (!seaOk(n, z0)) continue; const r = seaReach(n, z0, memo); for (const z of tz) if (r[z]) return true; } }
  return false;
}
/* força de guerra de um bloco: o país (exércitos pela qualidade) e quem viria junto contra foe (aliados, súditos que lutam, suserano);
   aliados pesam menos (podem recusar o chamado); quem também é aliado do outro lado não conta */
let mpC = null;
const milPower = n => { if (!mpC || mpC.t !== (S.t / 30 | 0)) { mpC = { t: S.t / 30 | 0, m: new Float64Array(S.nations.length) }; for (const a of S.armies) if (!a.exp) mpC.m[a.o] += armyPower(a); } return mpC.m[n.id] + 1; };
function blocPower(n, foe) {
  let s = milPower(n); const seen = new Set([n.id]);
  const add = (id, w) => { const x = nat(id); if (!x || !x.alive || seen.has(id) || (foe && (id === foe.id || has(foe, 'allies', id) || atWar(id, n.id)))) return; seen.add(id); s += milPower(x) * w; };
  (n.allies || []).forEach(id => add(id, nat(id) && (nat(id).senior === n.id || n.senior === id) ? 1 : .7));
  subjectsOf(n.id).forEach(j => add(j.id, !j.subj || SUBJECTS[j.subj.tier].war ? 1 : .5)); if (n.senior != null) add(n.senior, 1);
  return s;
}
/* exércitos que a IA mantém (ERA_LIM.armies) e o tamanho cheio de cada um */
const aiArmyMax = n => eraLim(n, 'armies');
const armyFull = n => clamp(Math.round((WIDTH_BASE + n.fx.width) * 1.25), 6, 60);
/* ---------- IA militar: exércitos de campanha do tamanho da largura de combate, reunidos num depósito e distribuídos pelos fronts ---------- */
/* tamanho de um exército de campanha: pouco mais que a largura de combate, mas país pequeno não espera juntar o que não tem */
const armyTarget = n => { const w = clamp(Math.round((WIDTH_BASE + n.fx.width) * 1.25), 6, 60), tot = S.armies.reduce((s, a) => s + (a.o === n.id && !a.exp ? regs(a) : 0), 0); return clamp(Math.min(w, tot * .5), 3, w); };
/* depósito: onde recrutas se juntam antes de marchar (o front mais ameaçado; em paz, a fronteira mais perigosa; senão a capital) */
function aiDepot(n) {
  const ok = p => S.own[p] === n.id && S.ctrl[p] === n.id;
  const fs = frontsOf(n.id); if (fs.length) { const f = fs.map(f => [f, f.foe.reduce((s, q) => s + foeNear(n.id, q), 0)]).sort((a, b) => b[1] - a[1])[0][0];
    const back = f.provs.filter(ok).sort((x, y) => fortOf(y) - fortOf(x)); if (back.length) return back[0]; }
  const b = aiBorder(n); return b != null ? b : n.capital;
}
/* vizinho mais perigoso e a província de fronteira de frente para ele (com forte ou capital de estado, se houver) */
function aiBorder(n) {
  if (n._bd && n._bd.t > S.t - 180) return n._bd.p;
  let best = null, bs = 0;
  for (const t of neighbors(n)) { const tn = nat(t); if (!tn.alive || has(n, 'allies', t)) continue; const th = strength(tn) * ((n.rel[t] || 0) < 0 ? 1.6 : 1) * (tn.claims && Object.keys(tn.claims).some(s => WD.states[s].provs.some(p => S.own[p] === n.id)) ? 2 : 1); if (th > bs) { bs = th; best = t; } }
  let p = null;
  if (best != null) { const cand = provsOf(n.id).filter(q => S.ctrl[q] === n.id && WD.provs[q].adj.some(o => S.own[o] === best)); cand.sort((x, y) => (fortOf(y) * 3 + S.pop[y] / 20) - (fortOf(x) * 3 + S.pop[x] / 20)); p = cand[0] ?? null; }
  n._bd = { t: S.t, p }; return p;
}
function aiRecruit(n, myArmies, myR, atWarN, P) {
  const full = armyFull(n), max = aiArmyMax(n);
  const want = Math.min(max * full, (n.subj && SUBJ_LAWS.army.o[n.subj.laws.army].demil ? .3 : 1) * clamp((n.popT || 0) * .006 * (atWarN ? 1.5 : 1) * (.7 + IDEOS[n.ideo].war * .25) * (n.money > hoardCap(n) * .6 ? 1.6 : 1) * P.army, 2, 1200));
  const queued = n.rec.reduce((a, r) => a + (r.type !== 'ship' ? r.k : 0), 0);
  if (myR + queued >= want || !(n.income > 0 || n.money > 500)) return;
  const mp = Math.floor(n.manpower), batch = Math.min(mp, Math.max(3, Math.ceil((want - myR - queued) / 2)));
  if (batch < 3) return;                                                            // espera juntar homens: nada de regimentos soltos (também em guerra)
  // como o jogador em Militar > Exército: o lote inteiro vai para um exército só (o menor que ainda não está cheio) ou forma um novo, até o limite da era
  const size = new Map(); groupsOf(n.id).forEach(G => { if (!G.some(a => a.exp)) size.set(gid(G[0]), G.reduce((s, a) => s + regs(a), 0)); });
  n.rec.forEach(r => { if (r.type !== 'ship' && r.g != null) size.set(r.g, (size.get(r.g) || 0) + r.k); });
  const open = [...size].filter(([, v]) => v < full).sort((x, y) => x[1] - y[1]);
  let g, at = aiDepot(n);
  const gp = k => { const h = myArmies.filter(a => gid(a) === k).sort((x, y) => regs(y) - regs(x))[0]; if (!h || h.p >= WD.provs.length) return 1e9; const A = WD.provs[h.p], B = WD.provs[at]; return Math.hypot(A.cx - B.cx, A.cy - B.cy); };
  if (open.length && (size.size >= max || open[0][1] < full * .6)) g = open.slice().sort((x, y) => gp(x[0]) - gp(y[0]))[0][0];   // o lote reforça o grupo aberto mais perto do depósito
  else if (size.size < max) g = S.id++;
  else g = [...size].sort((x, y) => x[1] - y[1])[0][0];
  const h = myArmies.filter(a => gid(a) === g).sort((x, y) => regs(y) - regs(x))[0];
  if (h && h.p < WD.provs.length && S.own[h.p] === n.id && S.ctrl[h.p] === n.id) at = h.p;   // treina onde o exército está (se for território próprio)
  const have = { inf: 0, cav: 0, art: 0, vrt: 0 }; myArmies.forEach(a => UT.forEach(t => have[t] += a[t])); n.rec.forEach(r => { if (have[r.type] != null) have[r.type] += r.k; });
  const vOk = n.vert && (n.tsat ? n.tsat.vrt : 1) > .5, cavOk = (n.tsat ? n.tsat.cav : 1) > .6;
  const mix = { inf: .6, cav: cavOk ? .2 : .05, art: canArt(n) ? .2 : 0, vrt: vOk ? .2 : 0 }, tot = Object.values(mix).reduce((a, b) => a + b, 0), all = myR + queued + batch;
  const def = UT.map(t => [t, mix[t] / tot * all - have[t]]).filter(x => x[1] > .5).sort((a, b) => b[1] - a[1]);
  let left = batch;
  for (const [t, d] of def) { const k = Math.min(left, Math.max(1, Math.round(d))); if (k < 1) continue; if (!CMDS.recruit(n, t, k, at, g)) left -= k; if (left <= 0) break; }
  if (left === batch) CMDS.recruit(n, 'inf', batch, at, g);
}
function aiStance(n, a, adv) { a.st = !adv ? 'def' : vetLv(a) >= 2 || personality(n).war > 1.2 ? 'agg' : 'bal'; }
function aiSupport(n, a, T) {
  if (regs(a) < T * .5 || a.exp) return;
  for (const k of ['med', 'recon', 'eng']) if (!(a.sup && a.sup[k]) && supOk(n, k) && n.money > supCost(n, k) * 5 && !addSupport(n, a, k)) return;
}
function aiArmy(n, P, rebP) { return aiArmyFront(n, P, rebP); }   // a IA joga como o jogador: exércitos em grupo pelos fronts
/* modo de fronts: cada exército é um grupo; no front ele se espalha e avança sozinho (sim/groups.js e sim/fronts.js); a IA só decide
   para qual front vai cada grupo, a ordem de cada front, a postura e o apoio. Grupos pequenos se juntam ao grupo mais próximo. */
/* cautela do avanço: linear pela agressividade (P.war) entre o traço mais pacífico e o mais belicoso (TRAIT_WAR, data.js; hoje 0,5 → 1,5 e 1,4 → 1,0,
   neutro 1,0 → 1,22); combinações de traços fora da faixa cortam no extremo */
function advCaution(P) { const { lo, hi } = TRAIT_WAR;
  const x = hi > lo ? Math.min(1, Math.max(0, (P.war - lo) / (hi - lo))) : .5; return AI_FRONT.cautelaMax + (AI_FRONT.cautelaMin - AI_FRONT.cautelaMax) * x; }
function aiArmyFront(n, P, rebP) {
  for (const a of armiesOf(n.id)) if (a.g == null) a.g = a.id;
  const T = armyTarget(n), fs = frontsOf(n.id), war = warsOf(n.id).length > 0, slow = ((S.t / 30 | 0) + n.id) % 3 === 0, depot = aiDepot(n);
  const size = G => G.reduce((s, a) => s + regs(a), 0), powG = G => G.reduce((s, a) => s + armyPower(a), 0);
  const lead = G => G.slice().sort((x, y) => regs(y) - regs(x))[0];
  // critico-c "M2 — paradas", achado 2: em guerra, a parte de um grupo sem caminho até o líder sai do grupo (vira grupo próprio); senão a IA decide
  // pelo líder preso num bolsão e a parte que alcança o inimigo nunca se move. Fora: quem marcha, luta, invade, explora ou está no mar.
  const PV0 = WD.provs.length; let RG0 = null; const RG = () => RG0 || (RG0 = reachComp(n)), free = a => !a.path.length && !a.inBattle && !a.inv && !a.exp && a.p < PV0;
  if (war) for (const G of groupsOf(n.id)) { if (G.length < 2 || G.some(a => a.exp || a.inv)) continue; const h = lead(G); if (h.p >= PV0) continue;
    for (const a of G) if (a !== h && free(a) && !reachTo(n, RG(), a.p, h.p)) a.g = a.id; }
  const groups = groupsOf(n.id).filter(G => !G.some(a => a.exp || a.inv));
  if (slow) for (const G of groups) { const h = lead(G); if (!armyBusy(h)) { const b = Object.keys(h.sup || {}).length; aiSupport(n, h, T); if (Object.keys(h.sup || {}).length > b) G.forEach(x => x.sup = Object.assign({}, h.sup)); } }
  // grupos pequenos: juntam-se ao grupo maior (o caminho é feito pelos destacamentos ao se reagrupar); em guerra, só se o líder do pequeno alcança o do maior
  const big = groups.filter(G => size(G) >= T * .35).sort((x, y) => size(y) - size(x)), extra = new Set(groups.slice().sort((x, y) => size(y) - size(x)).slice(aiArmyMax(n)));
  const recG = new Set(n.rec.map(r => r.g));                 // exército novo ainda em treino não é engolido
  const linked = (G, B) => !war || reachTo(n, RG(), lead(G).p, lead(B).p);
  for (const G of groups) { if (!((size(G) < T * .35 && !recG.has(gid(G[0])) || extra.has(G)) && !G.some(armyBusy))) continue; const to = big.find(B => B !== G && linked(G, B)); if (to) { joinGroups(lead(to), G[0]); G.forEach(a => { a.front = to[0].front; if (!war && a.p !== lead(to).p) orderArmy(a, lead(to).p, true); }); } }
  // exército grande demais (bem acima da largura de combate) se divide enquanto houver vaga no limite da era
  if (slow) { const gs = groupsOf(n.id).filter(G => !G.some(a => a.exp || a.inv)), full = armyFull(n), G = gs.filter(G => size(G) > full * 1.6 && !G.some(armyBusy)).sort((x, y) => size(y) - size(x))[0];
    if (G && gs.length < aiArmyMax(n)) { const ng = splitGroup(lead(G), G[0].front); groupsOf(n.id).filter(H => gid(H[0]) === ng).forEach(H => H.forEach(a => { a.st = G[0].st; a.drill = G[0].drill; })); } }
  const field = groupsOf(n.id).filter(G => !G.some(a => a.exp || a.inv));
  if (war) {
    if (!fs.length) { aiOverseas(n, field.map(lead)); return; }
    // concentração: primeiro os fronts com inimigo dentro do território (defesa), depois os estados inimigos mais fracos, até ter vantagem em cada um
    const need = new Map(fs.map(f => [f.id, frontDefense(f, n.id) + 2])), got = new Map(fs.map(f => [f.id, 0]));
    const ep = enemyPower(n.id), intr = f => f.provs.some(p => WD.provs[p].adj.some(q => ep.get(q) && friendsOf(n.id).has(S.ctrl[q])) || ep.get(p));
    const claim = f => f.foe.some(q => n.claims[WD.provs[q].state]) ? .6 : 1, order = fs.slice().sort((x, y) => (intr(y) - intr(x)) || need.get(x.id) * claim(x) - need.get(y.id) * claim(y));
    field.forEach(G => { if (!got.has(G[0].front)) G.forEach(a => a.front = null); });
    // R1b (critico-c passo 6): só conta no front quem tem caminho até ele (já na linha, marchando para ela, ou com rota pelas regras de findPath)
    const PV = WD.provs.length, fById = new Map(fs.map(f => [f.id, f])), fc = new Map(); let RC = null;
    const reach = (G, f) => { const h = lead(G); if (h.fp === f.id || (h.p < PV && f.provs.includes(h.p)) || (h.front === f.id && h.path.length && f.provs.includes(h.path[h.path.length - 1]))) return true;
      if (h.p >= PV) return false; if (!RC) RC = reachComp(n); if (!fc.has(f.id)) fc.set(f.id, frontCenter(f)); return reachTo(n, RC, h.p, fc.get(f.id)); };
    const pool = [], full = [];                                 // quem já está num front fica enquanto ele precisar (sem vai e vem que interrompe avanços)
    for (const G of field.slice().sort((x, y) => powG(y) - powG(x))) { const f = G[0].front, F = f != null ? fById.get(f) : null;
      if (F && reach(G, F)) { if (got.get(f) < need.get(f) * 1.6) got.set(f, got.get(f) + powG(G)); else full.push(G); } else pool.push(G); }
    const send = (G, f) => { G.forEach(a => { if (a.front !== f.id) a.path = []; a.front = f.id; }); got.set(f.id, got.get(f.id) + powG(G)); const i = pool.indexOf(G); if (i >= 0) pool.splice(i, 1); };
    for (const f of order) { while (got.get(f.id) < need.get(f.id) * 1.6) { const G = pool.find(G => !frontBlocked(lead(G), f) && reach(G, f)); if (!G) break; send(G, f); } }
    // histerese: a sobra de um front cheio só troca para um front que precise de mais de 1,6× do que tem; senão fica onde está
    for (const G of full) { const f0 = G[0].front, f = order.find(f => f.id !== f0 && need.get(f.id) > got.get(f.id) * AI_FRONT.hister && !frontBlocked(lead(G), f) && reach(G, f)); if (f) send(G, f); else got.set(f0, got.get(f0) + powG(G)); }
    for (const G of pool.slice()) { const f = order.find(f => !frontBlocked(lead(G), f) && reach(G, f)); if (f) send(G, f); }   // sobra reforça o front principal que alcança
    if (pool.length) { pool.forEach(G => G.forEach(a => { a.front = null; })); aiOverseas(n, pool.map(lead)); }   // nenhum front ao alcance: sai do front e vai por terra até o inimigo, ou por mar
    // R1b passo 5 (critico-d "R1 — verificação da M1", decisão 3): avança quando a força pronta ou a caminho (got: só grupos com caminho) passa de
    // defesa × aiEdge × cautela; com defesa 0, força > 2; sem força pronta no front, nunca avança
    const caut = advCaution(P);
    for (const f of fs) { const d = need.get(f.id) - 2, rdy = S.armies.some(a => a.o === n.id && a.front === f.id && frontReady(a));
      const adv = rdy && got.get(f.id) > (d > 0 ? d * AI_FRONT.aiEdge * caut : 2); setFord(n.id, f.id, adv ? 'adv' : 'hold'); field.filter(G => G[0].front === f.id).forEach(G => { const h = lead(G); aiStance(n, h, adv); G.forEach(x => x.st = h.st); }); }
    mergeGroupParts(n.id); return;
  }
  // paz: sem front; os destacamentos se reúnem; os grupos ficam no depósito (fronteira perigosa), treinando se o caixa permitir; rebeldes primeiro
  const drill = n.money > 400 * eraScale() && n.income > 0;
  for (const G of field) { const h = lead(G); G.forEach(a => { a.front = null; a.drill = drill; a.st = 'bal'; });
    if (G.some(armyBusy)) continue;
    if (rebP.length) { const o = WD.provs[h.p < WD.provs.length ? h.p : n.capital], t = rebP.slice().sort((x, y) => Math.hypot(WD.provs[x].cx - o.cx, WD.provs[x].cy - o.cy) - Math.hypot(WD.provs[y].cx - o.cx, WD.provs[y].cy - o.cy))[0]; G.forEach(a => { if (!a.path.length && a.p !== t) orderArmy(a, t, true); }); continue; }
    G.forEach(a => { if (a !== h && !a.path.length && a.p !== h.p) orderArmy(a, h.p, true); });
    if (G.length === 1 && h.p !== depot && !h.path.length && chance(.15)) orderArmy(h, depot, true);
  }
  mergeGroupParts(n.id);
}
/* guerra sem front (inimigo do outro lado do mar ou longe): marcha até a província controlada pelo inimigo mais perto (a própria terra ocupada
   primeiro), ou invade por mar. R1b (critico-c passos 1 e 2): alvo = o que o inimigo controla (não o que já é nosso), numa busca só; a invasão
   testa os alvos em ordem até achar porto e rota. O motivo da última falha fica em INV_WHY (fora do save; interface e medições). */
const INV_WHY = new Map();   // "país:guerra" → { t, why }
function aiOverseas(n, field) {
  const P = WD.provs.length, t1 = new Set(), t2 = new Set(), fr = friendsOf(n.id), en = new Map(), isEn = c => { if (!en.has(c)) en.set(c, atWar(n.id, c)); return en.get(c); };
  for (let p = 0; p < P; p++) { const c = S.ctrl[p]; if (c < 0 || !n.exP[p] || !isEn(c)) continue; if (S.own[p] === n.id) t1.add(p); else if (isEn(S.own[p]) || fr.has(S.own[p])) t2.add(p); }
  const warOf = c => { const w = S.wars.find(w => (w.A.includes(n.id) && w.D.includes(c)) || (w.D.includes(n.id) && w.A.includes(c))); return w ? w.id : -1; };
  const why = (to, r) => { const k = n.id + ':' + (to != null ? warOf(S.ctrl[to]) : -1); INV_WHY.set(k, { t: S.t, why: r }); };
  for (const a of field) {
    if (armyBusy(a) || a.path.length || a.mor < .6) continue;
    const path = findPathMulti(n, a.p, t1, t2, a);
    if (path) { a.path = path; a.prog = 0; a.need = 0; a.retreat = false; continue; }
    if (n.invCd > S.t || regs(a) < armyTarget(n) * .5) continue;
    const pa = WD.provs[a.p], mine = armyPower(a) * Math.min(1, (S.fleets.filter(f => f.o === n.id && !f.inv).reduce((t, f) => t + fleetCap(f), 0) * .95) / Math.max(1, regs(a)));
    const tgts = [...t1, ...t2].filter(p => WD.provs[p].coast && WD.provs[p].seas.some(z => n.exZ[z] && seaOk(n, z)) && foeNear(n.id, p) < mine * .6)   // só costa pouco defendida
      .sort((x, y) => (t2.has(x) - t2.has(y)) || (fortOf(x) - fortOf(y)) * 20 + Math.hypot(WD.provs[x].cx - pa.cx, WD.provs[x].cy - pa.cy) - Math.hypot(WD.provs[y].cx - pa.cx, WD.provs[y].cy - pa.cy));
    const cap = S.fleets.filter(f => f.o === n.id && !f.inv && !carriedBy(f).length).reduce((t, f) => t + fleetCap(f), 0) * .95;
    let inv = a; if (tgts.length && cap < regs(a) && cap >= armyTarget(n) * .5 && a.p < WD.provs.length) {   // destacamento do tamanho que a frota leva
      inv = splitArmy(a, cap / regs(a)); inv.front = null; }
    let r = 'Sem alvo costeiro', at = null; const pre = tgts.length ? invPorts(n, inv) : null;
    for (const to of tgts) { at = to; r = planInvasion(n, inv, to, pre); if (r === '' || !/^(Nenhum porto alcança|O destino)/.test(r)) break; }   // rota é do alvo; porto ou navios valem para todos
    if (r !== '') { why(at, r); n.invCd = S.t + 60; if (inv !== a) mergeInto(a, inv); }   // sem alvo ou sem navios: tenta de novo daqui a dois meses (a frota cresce no meio-tempo)
  }
}
