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
  if (slow) { aiDiplomacy(n); aiFaith(n); }
  if (slow && govAge(n) > 15 && !(n.govCd > S.t) && chance(.1)) { const nx = govNextOf(n); if (nx) setGov(n, nx); }   // a IA reforma por conta própria só depois de anos de crise
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
  // exército: generais, exploradores, rebeldes, dívida, recrutamento e organização (aiArmy)
  const myArmies = S.armies.filter(a => a.o === n.id), myR = myArmies.reduce((a, x) => a + regs(x), 0), atWarN = warsOf(n.id).length;
  if (slow && n.money > genCost() * 4) { const a = myArmies.filter(a => !a.gen && !a.exp && regs(a) >= 4).sort((x, y) => regs(y) - regs(x))[0]; if (a && chance(.3)) setGeneral(n, a, genCands(n).sort((x, y) => genMul(y) - genMul(x))[0]); }
  if (slow && !atWarN && chance(.06 * P.colon) && !(n.expCd > S.t) && !myArmies.some(a => a.exp)) {   // manda uma tropa barata explorar a terra incógnita
    const a = myArmies.find(a => a.p === n.capital && a.inf >= 2 && !a.path.length); n.expCd = S.t + 360 * 4;
    if (a) { a.inf -= 1; const e = addArmy(n.id, a.p, { inf: 1 }, a.xp); e.exp = true; }
  }
  const rebP = Object.keys(S.rebels || {}).map(Number).filter(p => S.own[p] === n.id);
  if (rebP.length && !atWarN) myArmies.filter(a => !a.exp && !a.path.length && !rebP.includes(a.p) && regs(a) >= 3).slice(0, 2).forEach(a => { const o = WD.provs[a.p < WD.provs.length ? a.p : n.capital]; orderArmy(a, rebP.slice().sort((x, y) => Math.hypot(WD.provs[x].cx - o.cx, WD.provs[x].cy - o.cy) - Math.hypot(WD.provs[y].cx - o.cx, WD.provs[y].cy - o.cy))[0]); });
  if (n.money < 0 && n.income < 0 && !atWarN && myArmies.length) { const a = myArmies.filter(a => !a.exp).sort((x, y) => regs(y) - regs(x))[0]; if (a) { n.manpower += regs(a) * .15; UT.forEach(t => a[t] *= .85); a.max = regs(a); a.drill = false; } }   // em dívida: desmobiliza (os homens voltam à reserva e o exército não se refaz sozinho)
  aiRecruit(n, myArmies, myR, atWarN, P);
  mergeIdle(n.id);
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
  if (slow && !atWarN && n.senior == null && !overCap(n) && n.stab > 35 && n.money > 0 && chance(.012 * IDEOS[n.ideo].war * P.war * (GOVS[n.gov].cat === 'Tribal' ? 1.4 : 1))) {
    const nb = new Set(); for (const p of provsOf(n.id)) for (const o of WD.provs[p].adj) { const t = S.own[o]; if (t >= 0 && t !== n.id) nb.add(t); }
    if (n.kind === 'cold' || n.fx.col) S.nations.forEach(t => { if (t.alive && t.id !== n.id && provsOf(t.id).some(p => n.exP[p] && WD.provs[p].coast) && chance(.15)) nb.add(t.id); });
    const myP = myR * (1 + n.m.army) * n.up.inf;
    const myAll = myP + (n.allies || []).map(nat).filter(x => x.alive).reduce((s, x) => s + strength(x) * .5, 0);
    const targets = [...nb].map(nat).filter(t => t.alive && !(n.truce[t.id] > S.t) && !atWar(n.id, t.id) && !has(n, 'allies', t.id) && !(has(n, 'marr', t.id) && chance(.7)) && t.senior !== n.id && t.id !== n.senior)
      .map(t => [t, strength(t) + (t.allies || []).map(nat).filter(x => x.alive).reduce((s, x) => s + strength(x) * .6, 0)]).filter(([, pw]) => myAll > pw * 1.35);
    if (targets.length) { const [t] = pickR(targets); const st = WD.states.find(s => s.provs.some(p => S.own[p] === t.id) && s.provs.some(p => WD.provs[p].adj.some(o => S.own[o] === n.id))); declareWar(n, t, st ? st.id : null); }
  } else if (slow && !atWarN && !n.fab && chance(.06 * P.claim) && n.money > 80) {
    const st = WD.states.find(s => !n.claims[s.id] && s.provs.some(p => S.own[p] >= 0 && S.own[p] !== n.id && WD.provs[p].adj.some(o => S.own[o] === n.id)));
    if (st) fabricate(n, st.id);
  }
  aiArmy(n, P, rebP);
}

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
  const want = (n.subj && SUBJ_LAWS.army.o[n.subj.laws.army].demil ? .3 : 1) * clamp((n.popT || 0) * .006 * (atWarN ? 1.5 : 1) * (.7 + IDEOS[n.ideo].war * .25) * (n.money > 3000 ? 1.6 : 1) * P.army, 2, 1200);
  const queued = n.rec.reduce((a, r) => a + (r.type !== 'ship' ? r.k : 0), 0);
  if (myR + queued >= want || !(n.income > 0 || n.money > 500)) return;
  const mp = Math.floor(n.manpower), batch = Math.min(mp, Math.max(3, Math.ceil((want - myR - queued) / 2)));
  if (batch < 3 && !(atWarN && batch >= 1)) return;                                 // espera juntar homens: nada de regimentos soltos
  const have = { inf: 0, cav: 0, art: 0, vrt: 0 }; myArmies.forEach(a => UT.forEach(t => have[t] += a[t])); n.rec.forEach(r => { if (have[r.type] != null) have[r.type] += r.k; });
  const vOk = n.vert && (n.tsat ? n.tsat.vrt : 1) > .5, cavOk = (n.tsat ? n.tsat.cav : 1) > .6;
  const mix = { inf: .6, cav: cavOk ? .2 : .05, art: canArt(n) ? .2 : 0, vrt: vOk ? .2 : 0 }, tot = Object.values(mix).reduce((a, b) => a + b, 0), all = myR + queued + batch;
  const def = UT.map(t => [t, mix[t] / tot * all - have[t]]).filter(x => x[1] > .5).sort((a, b) => b[1] - a[1]);
  const at = aiDepot(n); let left = batch;
  for (const [t, d] of def) { const k = Math.min(left, Math.max(1, Math.round(d))); if (k < 1) continue; if (!recruit(n, t, k, at)) left -= k; if (left <= 0) break; }
  if (left === batch) recruit(n, 'inf', batch, at);
}
function aiStance(n, a, adv) { const cav = a.cav / Math.max(1, regs(a)); a.st = !adv ? 'def' : cav > .25 ? 'pur' : vetLv(a) >= 2 || personality(n).war > 1.2 ? 'agg' : 'bal'; }
function aiSupport(n, a, T) {
  if (regs(a) < T * .5 || a.exp) return;
  for (const k of ['med', 'recon', 'eng']) if (!(a.sup && a.sup[k]) && supOk(n, k) && n.money > supCost(n, k) * 5 && !addSupport(n, a, k)) return;
}
function aiArmy(n, P, rebP) {
  const T = armyTarget(n), mine = S.armies.filter(a => a.o === n.id && !a.exp && !a.inv), fs = frontsOf(n.id), war = warsOf(n.id).length > 0;
  const depot = aiDepot(n), slow = ((S.t / 30 | 0) + n.id) % 3 === 0;
  for (const a of mine) if (slow && !armyBusy(a)) aiSupport(n, a, T);
  // exércitos pequenos não lutam sozinhos: vão ao depósito e se juntam
  const small = a => regs(a) < T * .35 && !armyBusy(a) && !(a.front != null && a.inBattle);
  for (const a of mine) if (small(a) && !rebP.includes(a.p) && a.p !== depot && !(a.path.length && a.path[a.path.length - 1] === depot)) { a.front = null; orderArmy(a, depot, true); }
  // exércitos grandes demais para o suprimento se dividem
  for (const a of mine) if (!armyBusy(a) && !a.path.length && a.p < WD.provs.length && regs(a) > T * 1.8 && regs(a) > provSupply(a.p, n.id) * 1.3) {
    splitArmy(a, .5); }
  const field = S.armies.filter(a => a.o === n.id && !a.exp && !a.inv && !small(a));
  if (war) {
    if (!fs.length) { aiOverseas(n, field); return; }
    const need = new Map(fs.map(f => [f.id, f.foe.reduce((s, q) => s + foeNear(n.id, q), 0) / Math.max(1, Math.sqrt(f.foe.length)) + 2]));
    const got = new Map(fs.map(f => [f.id, 0])); field.forEach(a => { if (got.has(a.front)) got.set(a.front, got.get(a.front) + armyPower(a)); else a.front = null; });
    for (const a of field) if (a.front == null && !armyBusy(a)) { const f = fs.slice().sort((x, y) => (got.get(x.id) / need.get(x.id)) - (got.get(y.id) / need.get(y.id)))[0]; a.front = f.id; got.set(f.id, got.get(f.id) + armyPower(a)); }
    const bold = 1.3 / Math.max(.7, P.war);
    for (const f of fs) { const adv = got.get(f.id) > need.get(f.id) * bold; setFord(n.id, f.id, adv ? 'adv' : 'hold'); field.filter(a => a.front === f.id).forEach(a => aiStance(n, a, adv)); }
    return;
  }
  // paz: tropas na fronteira mais perigosa (sem estourar o suprimento) e treinando se o caixa permitir
  const drill = n.money > 400 * eraScale() && n.income > 0;
  for (const a of field) { a.front = null; a.drill = drill; if (armyBusy(a) || a.path.length || rebP.includes(a.p)) continue;
    if (a.p !== depot && chance(.15)) orderArmy(a, depot, true); a.st = 'bal'; }
}
/* guerra sem front (inimigo do outro lado do mar ou longe): marcha até a província inimiga alcançável mais próxima, ou invade por mar */
function aiOverseas(n, field) {
  const foes = enemiesOf(n.id), P = WD.provs.length;
  for (const a of field) {
    if (armyBusy(a) || a.path.length || a.mor < .6) continue;
    const pa = WD.provs[a.p], far = foes.flatMap(f => provsOf(f)).filter(p => n.exP[p]).sort((x, y) => Math.hypot(WD.provs[x].cx - pa.cx, WD.provs[x].cy - pa.cy) - Math.hypot(WD.provs[y].cx - pa.cx, WD.provs[y].cy - pa.cy)).slice(0, 4);
    if (far.some(p => orderArmy(a, p))) continue;
    if (n.invCd > S.t || regs(a) < armyTarget(n) * .5) continue;
    const mine = armyPower(a) * Math.min(1, (S.fleets.filter(f => f.o === n.id && !f.inv).reduce((t, f) => t + fleetCap(f), 0) * .95) / Math.max(1, regs(a)));
    const tgt = foes.flatMap(f => provsOf(f)).filter(p => n.exP[p] && WD.provs[p].coast && WD.provs[p].seas.some(z => n.exZ[z] && seaOk(n, z)) && foeNear(n.id, p) < mine * .6)   // só costa pouco defendida
      .sort((x, y) => (fortOf(x) - fortOf(y)) * 20 + Math.hypot(WD.provs[x].cx - pa.cx, WD.provs[x].cy - pa.cy) - Math.hypot(WD.provs[y].cx - pa.cx, WD.provs[y].cy - pa.cy))[0];
    const cap = S.fleets.filter(f => f.o === n.id && !f.inv && !carriedBy(f).length).reduce((t, f) => t + fleetCap(f), 0) * .95;
    let inv = a; if (tgt != null && cap < regs(a) && cap >= armyTarget(n) * .5 && a.p < WD.provs.length) {   // destacamento do tamanho que a frota leva
      inv = splitArmy(a, cap / regs(a)); inv.front = null; }
    if (tgt == null || planInvasion(n, inv, tgt)) { n.invCd = S.t + 60; if (inv !== a) mergeInto(a, inv); }   // sem alvo ou sem navios: tenta de novo daqui a dois meses (a frota cresce no meio-tempo)
  }
}
