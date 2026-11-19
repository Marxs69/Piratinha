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
