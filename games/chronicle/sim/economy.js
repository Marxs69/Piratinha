/* Grand Chronicle — simulação: economia, construção, recrutamento, pesquisa e colonização. */
'use strict';

/* ---------- economia ---------- */
const jobGroup = b => BUILDINGS[b].job || bGroupOf(b);
/* bônus entre prédios do mesmo estado (fx.boost) e da subsistência (fx.sub), montados dos dados uma vez */
const BOOST_BY = {}, SUB_B = [];
for (const x in BUILDINGS) { const f = BUILDINGS[x].fx; if (!f) continue; if (f.boost) for (const b in f.boost) if (BUILDINGS[b]) (BOOST_BY[b] = BOOST_BY[b] || []).push([x, f.boost[b]]); if (f.sub) SUB_B.push([x, f.sub]); }
/* ficha de cada prédio para os laços quentes (listas em vez de objetos; mesma ordem dos dados) */
let BI = null, GI = null, LS = null, LD = null, SUB_ST = null, SUB_N = null;
function buildInfo() {
  BI = {}; GI = {}; GOOD_IDS.forEach((g, i) => GI[g] = i); LS = new Float64Array(GOOD_IDS.length); LD = new Float64Array(GOOD_IDS.length);
  SUB_ST = Object.keys(SUBSIST).filter(g => SUBSIST[g].st).map(g => [GI[g], SUBSIST[g].st]); SUB_N = Object.keys(SUBSIST).map(g => [g, SUBSIST[g].n]);
  for (const b in BUILDINGS) {
    const d = BUILDINGS[b], f = d.fx || null, gr = jobGroup(b), ent = o => o ? Object.keys(o).map(g => [g, o[g], GI[g]]) : null;
    BI[b] = { d, w: d.w, gr, J: JOBS[gr], slave: !!d.slave, tl: d.tl || 0, food: !!d.food, fert: !!d.fert, inA: ent(d.in), outA: ent(d.out), boost: BOOST_BY[b] || null,
              f, fxN: f ? Object.keys(f).filter(k => typeof f[k] === 'number').map(k => [k, f[k]]) : [], prod: f && f.prod || 0, speed: f && f.speed || 0 };
  }
}
const laborShare = n => LAWS.women.o[(n.laws || LAW_DEF).women].lab;
/* teto do tesouro: acima dele, parte do excesso some em corrupção todo mês (proporcional aos impostos do país, nunca abaixo do mínimo da era) */
const hoardCap = (n, tax) => Math.max(HOARD_MIN * eraScale(), HOARD_MONTHS * Math.max(0, tax ?? (n.inc && n.inc.tax) ?? 0));
const IMP_ORDER = {};                                        // ordem de importação por vertente (comida, bem da vertente, ip, resto)
/* economia: econNation faz o mês de um país (produção, comércio, classes, receitas); econFinish fecha os preços mundiais com o que foi somado.
   econAll = todos os países de uma vez (início, carga e reparo); no jogo, cada país faz o seu mês num dia diferente (sim/tick.js). */
const econAcc = () => { const a = { sup: {}, dem: {}, exp: {}, k: 0 }; GOOD_IDS.forEach(g => { a.sup[g] = 0; a.dem[g] = 0; }); return a; };
let cnC = null;                                              // necessidades das classes no ano (cache)
function econSetup() {
  if (!BI) buildInfo();
  const NG = GOOD_IDS.length, NS = WD.states.length;   // oferta/demanda do mês anterior por estado: arrays planos [estado × bem] (cache, fora do save)
  if (!(S.stS instanceof Float64Array) || S.stS.length !== NS * NG) { S.stS = new Float64Array(NS * NG); S.stD = new Float64Array(NS * NG); S.stHas = new Uint8Array(NS); }
  S.scov = S.scov || {}; if (!S.stSpd) S.stSpd = new Float32Array(NS); S.stInfo = S.stInfo || [];
  if (!WD.states[0].fert) WD.states.forEach(st => { st.fert = st.provs.reduce((a, p) => a + TERRAIN[WD.provs[p].terr].food, 0) / st.provs.length; st.capK = st.provs.reduce((a, p) => a + WD.provs[p].size * TERRAIN[WD.provs[p].terr].pop * 4, 0) + 3; });
  const year = curYear(); if (!cnC || cnC.y !== year) { cnC = { y: year, v: {} }; CLASS_IDS.forEach(k => cnC.v[k] = classNeeds(year, k)); }
}
function econAll() {
  econSetup(); const acc = econAcc();
  for (const n of S.nations) if (n.alive) econNation(n, acc);
  econFinish(acc);
}
function econFinish(acc) {
  if (acc.k) GOOD_IDS.forEach(g => { const ratio = (acc.dem[g] + 1) / (acc.sup[g] + 1); S.wp[g] = GOODS[g].p * clamp(Math.pow(ratio, .6), .3, 3.5); });
  S.expBy = acc.exp;
}
function econNation(n, acc) {
  econSetup();
  const year = curYear(), CN = cnC.v, NG = GOOD_IDS.length, stS = S.stS, stD = S.stD, gGrain = GI.grain;
  const myStates = new Map(); for (const p of provsOf(n.id)) if (S.ctrl[p] === n.id) { const st = WD.provs[p].state; myStates.set(st, (myStates.get(st) || 0) + S.pop[p]); }
  {
    const sup = {}, dem = {}; GOOD_IDS.forEach(g => { sup[g] = 0; dem[g] = 0; });
    let popT = 0, employedT = 0, gdp = 0, svcLv = 0, slaveJobs = 0; const bs = {};   // bs = soma dos efeitos numéricos dos prédios do país (fx)
    const cov = { health: 0, edu: 0, adm: 0, sec: 0 }, bfx = { army: 0, mp: 0, launch: 0 }, svcMul = LAWS.spend.o[(n.laws || LAW_DEF).spend].svc, capSvc = SVC_CAP(year);
    const bo = n.fx.bo, prodM = 1 + n.m.prod, sat = n.mk.sat, lab = laborShare(n), jobs = {}, jc = { low: 0, mid: 0, high: 0 }, sf = n.sf || 0, toolSat = sat.tools == null ? 1 : sat.tools;
    const culs = {}, rels = {}; let transport = 0, coastal = false;
    for (const p of provsOf(n.id)) if (S.ctrl[p] === n.id) { const v = S.pop[p]; popT += v; const c = S.culg ? S.culg[p] : WD.provs[p].cul, r = S.relg ? S.relg[p] : 0; culs[c] = (culs[c] || 0) + v; rels[r] = (rels[r] || 0) + v; }
    for (const [sid, sp] of myStates) {
      const st = WD.states[sid]; if (!sp) continue;
      let labor = sp * lab, used = 0; if (st.coast) coastal = true;
      const base = st.id * NG, has = S.stHas[st.id]; LS.fill(0); LD.fill(0); let tIn = 0, tLoc = 0, tCost = 0;
      const own = stateOwnerOf(st.id) === n.id, ctl = own && S.ctrl[st.cap] === n.id;
      if (ctl) {
        const B = S.bld[st.id]; let need0 = 0, stBonus = 0, spd = 0;
        for (const b in B) { const I = BI[b], L = B[b]; need0 += L * I.w; if (I.prod) stBonus += L * I.prod; if (I.speed) spd += L * I.speed; } S.stSpd[st.id] = spd;
        const e = need0 ? Math.min(1, labor / need0) : 1; used = Math.min(labor, need0);
        const infK = clamp(spd / 1.2, 0, 1), tEff = .75 + .2 * infK, tK = .12 * (1 - .6 * infK);   // insumos de outros estados: chegam com perdas e frete (estradas e ferrovias ajudam)
        const fert = st.fert, sc = S.scov[st.id] = { health: 0, edu: 0, adm: 0, sec: 0 };
        for (const b in B) {
          const L = B[b]; if (!L) continue; const I = BI[b];
          for (const [k, v] of I.fxN) bs[k] = (bs[k] || 0) + L * v;
          const work = L * I.w * e, gr = I.gr, J = I.J; jobs[gr] = (jobs[gr] || 0) + work; jc.low += work * J.low; jc.mid += work * J.mid; jc.high += work * J.high;
          const slv = I.slave; if (slv) slaveJobs += work * J.low;
          if (I.f) { const f = I.f; if (f.svc) { sc[f.svc] = Math.min(1, L * capSvc * svcMul / sp); svcLv += L; } if (f.army) bfx.army += L * f.army; if (f.mp) bfx.mp += L * f.mp; if (f.launch) bfx.launch += L; }
          if (I.tl) dem.tools += L * I.tl * e;                  // ferramentas: insumo leve (sem elas, até 20% a menos)
          let inSat = 1; if (I.inA) for (const [g, qi, gi] of I.inA) {
            const G = GOODS[g]; if (G.y0 > year) continue; const q = L * qi * e; dem[g] += q; LD[gi] += q;
            const pd = stD[base + gi], loc = G.grid || !has || !(pd > 0) ? 1 : Math.min(1, (stS[base + gi] || 0) / pd);   // parte feita no próprio estado: barata e na hora
            const wp = S.wp[g]; inSat = Math.min(inSat, (sat[g] == null ? 1 : sat[g]) * (loc + (1 - loc) * tEff)); const fr = q * (1 - loc) * wp * tK; transport += fr; tCost += fr; tIn += q * wp; tLoc += q * loc * wp;
          }
          if (I.outA) {
            let mult = prodM + (bo[b] || 0) + stBonus; if (I.food) mult += n.m.food; if (I.boost) for (const [x, v] of I.boost) if (B[x]) mult += B[x] * v; if (I.fert) mult *= .55 + fert * .45;
            if (I.tl) mult *= .8 + .2 * toolSat; if (slv) mult *= 1 + .25 * sf;
            const m0 = Math.max(.2, mult);
            for (const [g, qo, gi] of I.outA) { const v = L * qo * e * Math.max(.1, inSat) * m0; sup[g] += v; LS[gi] += v; }
          }
        }
      }
      employedT += used;
      if (ctl && S.scov[st.id]) for (const k in cov) cov[k] += S.scov[st.id][k] * sp;
      // subsistência dos não empregados (grãos, roupas feitas em casa e um pouco de bens e ferramentas)
      const fertS = st.fert;
      const roomy = clamp(1.35 - sp / st.capK * .6, .92, 1.35);   // terra pouco povoada rende mais comida por pessoa
      let mill = 0; if (own) for (const [x, v] of SUB_B) mill += (S.bld[st.id][x] || 0) * v;
      sup.grain += (sp - used * .6) * (.72 + .4 * fertS) * roomy * (1 + n.m.food * .5 + mill);   // quem trabalha nos prédios ainda planta um pouco
      if (st.coast) sup.fish += (sp - used) * .08;
      const idle = sp - used; for (const [gi, v] of SUB_ST) LS[gi] += idle * v; LS[gGrain] += idle;
      if (own) { stS.set(LS, base); stD.set(LD, base); S.stHas[st.id] = 1; S.stInfo[st.id] = { loc: tIn ? tLoc / tIn : 1, cost: tCost }; }
      for (const [g, v] of SUB_N) sup[g] += idle * v;
    }
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
    // exército: cada tipo de tropa e cada companhia de apoio tem as próprias necessidades (UNIT_NEEDS, SUPPORT)
    const AD = armyDemand(n), R = AD.R; for (const g in AD.d) dem[g] += AD.d[g];
    if (n.vert) dem[VERT[n.vert].good] += provsOf(n.id).length * .01 * n.vlv;
    // comércio com o mercado mundial: exporta o excedente; importa o que falta dentro de um orçamento, comida primeiro
    for (const k in BFX_CAP) if (bs[k] > BFX_CAP[k]) bs[k] = BFX_CAP[k]; n.bsum = bs;
    const embs = S.nations.filter(o => o.alive && (o.emb || []).includes(n.id)).length;
    const eff = clamp(.35 - (n.quar > S.t ? .3 : 0) + (bs.trade || 0) + n.m.trade + Math.min(.3, (n.trade || []).length * .07) - Math.min(.4, embs * .08), .1, 1.4);
    let tradeInc = 0, tradeCost = 0;
    GOOD_IDS.forEach(g => { const net = sup[g] - dem[g]; n.mk.imp[g] = 0; n.mk.exp[g] = 0; if (net > 0) { const exp = net * Math.min(1, eff); n.mk.exp[g] = exp; tradeInc += exp * S.wp[g] * .55; } gdp += sup[g] * S.wp[g]; acc.sup[g] += sup[g]; acc.dem[g] += dem[g]; }); acc.k++;
    let budget = Math.max(0, gdp * ECON.taxBase * .35 + tradeInc * .8 + Math.max(0, n.money) * .03);
    const prio = g => GOODS[g].c === 'food' ? 0 : n.vert && VERT[n.vert].good === g ? 1 : GOODS[g].ip ?? 3;
    const ok = n.vert || '', order = IMP_ORDER[ok] || (IMP_ORDER[ok] = GOOD_IDS.slice().sort((a, b) => prio(a) - prio(b)));   // só depende da vertente
    n.coastal = coastal; n.mk.src = {};
    for (const g of order) {
      const need = dem[g] - sup[g]; if (need <= 0 || budget <= 0 || (GOODS[g].c === 'lux' && S.wp[g] > GOODS[g].p * 3)) continue;
      const src = importSrc(n, g), price = S.wp[g] * 1.05 * src.m, imp = Math.min(need * Math.min(1, eff * 1.2), budget / price);
      n.mk.imp[g] = imp; n.mk.src[g] = src; tradeCost += imp * price; budget -= imp * price;
    }
    GOOD_IDS.forEach(g => { if (n.mk.exp[g] > .05) (acc.exp[g] = acc.exp[g] || []).push(n.id); });
    const s2 = {}; GOOD_IDS.forEach(g => { s2[g] = dem[g] > 0 ? Math.min(1, (sup[g] + n.mk.imp[g]) / dem[g]) : 1; });
    n.mk.sup = sup; n.mk.dem = dem; n.mk.sat = s2;
    if (n.vert) n.vsat = s2[VERT[n.vert].good];
    armySats(n, R);
    // receitas e despesas
    for (const k in cov) cov[k] = popT ? cov[k] / popT : 0; n.cov = cov; n.bfx = bfx;
    n.foodSat = Math.min(1, (sup.grain + sup.fish + n.mk.imp.grain + n.mk.imp.fish) / Math.max(1, food));
    // minorias: culturas não aceitas e outras religiões (a lei decide o quanto pesam)
    const lw = n.laws || LAW_DEF, cl = LAWS.culture.o[lw.culture], rl = LAWS.relig.o[lw.relig], pt = Math.max(1, popT);
    n.cpol = n.cpol || {}; n.rpol = n.rpol || {};
    let cm = 0, rm = 0; for (const c in culs) if (+c !== n.cul && lw.culture !== 'multi') cm += culs[c] * CPOL[n.cpol[c] || 0].w * (culKin(+c, n.cul) ? .5 : 1); for (const r in rels) if (+r !== n.relig && lw.relig !== 'secular') rm += rels[r] * CPOL[n.rpol[r] || 0].w; rm *= docOpt(n.relig, 'plural').mw || 1;   // culturas aparentadas pesam metade; a fé pluralista tolera mais
    n.minC = cm / pt * cl.mp; n.minR = rm / pt * rl.mp;
    // satisfação de cada classe: o que ela consome (pesado pelo valor) e, na média e na alta, saúde e educação
    const cs = {}; CLASS_IDS.forEach(k => { const nd = CN[k]; let w = 0, v = 0;
      for (const g in nd) { if (g === 'svc' || !nd[g]) continue; const q = g === 'staple' ? nd[g] * 3 : nd[g] * GOODS[g].p, x = g === 'staple' ? n.foodSat : s2[g]; w += q; v += q * x; }
      let x = w ? v / w : 1; if (nd.svc) x = x * .75 + .25 * Math.min(1, (cov.health + cov.edu) / 1.2 + .2); if (k === 'low' || k === 'mid') x *= 1 - Math.min(.3, (n.minC + n.minR) * .3); cs[k] = clamp(x, 0, 1); });
    n.csat = cs;
    const stabE = .55 + n.stab / 200, taxM = 1 + n.m.tax + (bs.tax || 0);
    const taxR = ECON.taxBase * Math.max(.1, taxM) * stabE, tax = gdp * taxR, frT = Math.min(gdp, transport) * taxR;   // o frete é custo de quem produz: sai do PIB tributável, não do tesouro
    let upk = 0; for (const a of S.armies) if (a.o === n.id) upk += armyUpkeep(a);
    upk *= yearScale() * .5;   // manutenção mensal anda com a era; os gastos pontuais, com o nível de preços
    let navy = 0; for (const f of S.fleets) if (f.o === n.id) navy += f.ships * .6 * yearScale();
    const admin = (popT * .01 + provsOf(n.id).length * .05) * (1 - .3 * cov.adm), interest = n.money < 0 ? -n.money * .01 : 0, hoard = hoardCap(n, tax), corrupt = n.money > hoard ? (n.money - hoard) * HOARD_LEAK * (1 - .6 * cov.adm) : 0;
    const svcUp = svcLv * .5 * yearScale() * svcMul;
    n.inc = { tax, trade: tradeInc, imports: -tradeCost, transport: -frT, army: -upk, navy: -navy, admin: -admin, svc: -svcUp, interest: -interest, corrupt: -corrupt };
    n.income = tax + tradeInc - tradeCost - frT - upk - navy - admin - svcUp - interest - corrupt;
    n.money += n.income; n.gdp = gdp;
    if (n.money < -Math.max(400, gdp * 2)) {                   // falência: dívida perdoada, estabilidade despenca, metade do exército debanda
      n.money = 0; n.stab = Math.max(0, n.stab - 30); S.armies.forEach(a => { if (a.o === n.id) { a.inf /= 2; a.cav /= 2; a.art /= 2; a.vrt /= 2; } });
      log(natName(n) + ' declarou falência!', n.id === S.player ? 'bad' : 'world', [n.id]);
    } n.popT = popT; n.employed = employedT;
  }
}
/* de onde vem uma importação: o exportador mais barato pela distância; por mar (os dois com litoral) é bem mais barato que por terra */
function importSrc(n, g) {
  const L = (S.expBy || {})[g], c0 = WD.provs[n.capital >= 0 ? n.capital : 0]; let best = null;
  if (L) for (const id of L) {
    if (id === n.id) continue; const o = nat(id); if (!o.alive || o.capital < 0 || (o.emb || []).includes(n.id) || (n.emb || []).includes(id)) continue;
    const c1 = WD.provs[o.capital], d = Math.hypot(c0.cx - c1.cx, c0.cy - c1.cy) / MAP_W;
    const land = c0.cont === c1.cont ? 1 + d * 1.3 : 1.2 + d * 2.5, sea = n.coastal && o.coastal ? 1.03 + d * .45 * (n.bsum && n.bsum.port ? .75 : 1) : Infinity;
    const m = Math.min(land, sea) - ((n.trade || []).includes(id) ? .05 : 0);
    if (!best || m < best.m) best = { m, o: id, sea: sea < land };
  }
  return best || { m: 1.35, o: -1, sea: false };
}
/* quem usa cada bem (descrições) */
function goodUsers(g) {
  const o = Object.values(BUILDINGS).filter(d => (d.in && d.in[g]) || (g === 'tools' && d.tl)).map(d => d.n);
  const c = CLASS_IDS.filter(k => { const nd = classNeeds(curYear(), k); return g === 'grain' || g === 'fish' ? !!nd.staple : !!nd[g]; }).map(k => CLASSES[k].n.toLowerCase());
  if (Object.values(UNIT_NEEDS).some(L => L.some(x => x[1][g])) || Object.values(SUPPORT).some(x => x.need[g]) || Object.values(VERT_UNIT_NEED).some(x => x[g])) c.push('exército');
  return [o.length ? 'Prédios: ' + o.join(', ') : '', c.length ? 'População: ' + c.join(', ') : ''].filter(Boolean).join('\n');
}

/* ---------- custos e ações ---------- */
/* soma de um efeito (fx) dos prédios de um estado */
const stateFx = (s, k) => { const B = S.bld[s]; let v = 0; for (const b in B) { const f = BUILDINGS[b].fx; if (f && typeof f[k] === 'number') v += B[b] * f[k]; } return Math.min(v, BFX_CAP[k] ?? Infinity); };
const bCost = (n, b) => Math.round(BUILDINGS[b].cost * ECON.costMul * (1 - Math.min(.5, n.m.admin || 0)) * eraScale());
const bMonths = b => Math.max(5, Math.round(BUILDINGS[b].cost / 25 * BUILD_SLOW));
const HIDDEN = GOOD_IDS.filter(g => GOODS[g].pros);
const natRes = p => { const pr = WD.provs[p], T = TERRAIN[pr.terr], o = [];   // recursos naturais da província (além dos minerais)
  if (T.food >= 1) o.push('farm'); if (pr.temp > .55 && T.food >= .7) o.push('fiber'); if (T.wood) o.push('wood'); if (T.stone) o.push('stone'); if (pr.coast) o.push('fish'); return o; };
const NATRES = { farm: ['🌾', 'Terra cultivável', [222, 200, 90]], fiber: ['🧶', 'Fibras', [245, 243, 232]], wood: ['🪵', 'Floresta', [40, 110, 50]], stone: ['🪨', 'Pedra', [150, 140, 120]], fish: ['🐟', 'Peixe', [80, 160, 210]] };
const provRes = p => (S.newRes && S.newRes[p]) || WD.provs[p].res;
const resVisible = p => { const r = provRes(p); return !!r && (!HIDDEN.includes(r) || !!(S.found && S.found[p])); };
const resCount = (st, r) => st.provs.filter(p => provRes(p) === r && resVisible(p)).length * GOODS[r].rm;
const prospectCost = () => Math.round(60 * eraScale());
function canProspect(n, s) {
  const st = WD.states[s]; if (stateOwnerOf(s) !== n.id) return 'Só no estado que você controla';
  if (!HIDDEN.some(r => hasT(n, GOODS[r].pros))) return 'Exige ' + TECH[GOODS[HIDDEN[0]].pros].n;
  if ((n.pdone || {})[s]) return 'Já prospectado'; if ((n.pros || []).some(x => x.s === s)) return 'Prospecção em andamento';
  if (n.money < prospectCost()) return 'Sem dinheiro'; return '';
}
function prospect(n, s) { const e = canProspect(n, s); if (e) return e; n.money -= prospectCost(); (n.pros = n.pros || []).push({ s, m: Math.round(6 * BUILD_SLOW) }); return ''; }
function prospectDone(n, s) {
  (n.pdone = n.pdone || {})[s] = 1; S.found = S.found || {}; S.newRes = S.newRes || {};
  const can = HIDDEN.filter(r => hasT(n, GOODS[r].pros)), st = WD.states[s], found = [];
  st.provs.forEach(p => { const r = provRes(p); if (can.includes(r) && !S.found[p]) { S.found[p] = 1; found.push(GOODS[r].n + ' em ' + WD.provs[p].n); } });
  if (chance(.35)) { const free = st.provs.filter(p => !provRes(p)); if (free.length) { const p = pickR(free), t = WD.provs[p].terr, r = pickR(can.filter(x => !GOODS[x].terr || GOODS[x].terr.includes(t))); if (r) { S.newRes[p] = r; S.found[p] = 1; found.push('nova jazida de ' + GOODS[r].n + ' em ' + WD.provs[p].n); } } }
  if (n.id === S.player) log('Prospecção em ' + st.n + ': ' + (found.length ? found.join(', ') : 'nada encontrado') + '.', found.length ? 'good' : 'info', [n.id]);
  if (found.length) S.mapDirty = true;
}
function canBuild(n, s, b) {
  const d = BUILDINGS[b], st = WD.states[s], B = S.bld[s]; let L = B[b] || 0; for (const c of n.cons) if (c.s === s && c.b === b) L++;
  if (stateOwnerOf(s) !== n.id || S.ctrl[st.cap] !== n.id) return 'Só quem controla a capital do estado constrói nele';
  if (d.vert && n.vert !== d.vert) return 'Exige a vertente ' + (VERT[d.vert] ? VERT[d.vert].n : '');
  if (!d.vert && !n.fx.b.has(b)) return 'Exige tecnologia';
  const R = d.req && REQS[d.req];
  if (R && R.coast === 1 && !st.coast) return 'Exige ' + R.n;
  if (d.req && d.req.startsWith('res:')) { const rr = d.req.slice(4), cap = resCount(st, rr); if (L >= cap) return cap ? 'Recurso esgotado' : (HIDDEN.includes(rr) ? 'Sem jazida conhecida (prospecte)' : 'Sem o recurso'); }
  else if (R && R.terr) { if (!(R.coast === 'or' && st.coast) && !st.provs.some(p => TERRAIN[WD.provs[p].terr][R.terr])) return 'Exige ' + R.n; }
  else if (d.req) { const k = d.cap || R.cap; if (L >= (k ? st.caps[k] ?? 99 : 99)) return 'Sem espaço'; }
  const max = d.maxFx ? 1 + n.fx[d.maxFx] : d.max; if (max && L >= max) return 'Nível máximo';
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
const slotsRaw = n => n.fx.slots + Math.floor((n.popT || 0) / 1000) + Math.floor(Math.max(0, n.money) / (2500 * eraScale())) + (n.xslots || 0);
const slotCap = n => RANK_SLOTS[n.rank || 0] + (n.xslots || 0);   // o título limita os canteiros (comprados somam ao teto)
const consSlots = n => Math.min(slotsRaw(n), slotCap(n));
const slotCost = n => Math.round(150 * eraScale() * (1 + (n.xslots || 0) * .5));
function buySlot(n) { const c = slotCost(n); if (n.money < c) return 'Sem dinheiro'; n.money -= c; n.xslots = (n.xslots || 0) + 1; return ''; }
function build(n, s, b) { const e = canBuild(n, s, b); if (e) return e; n.money -= bCost(n, b); n.cons.push({ s, b, m: bMonths(b), tot: bMonths(b) }); return ''; }

/* manutenção mensal de um exército: regimentos, companhias de apoio e treinamento */
const armyUpkeep = a => (nat(a.o).horde && curYear() <= nat(a.o).horde ? .15 : 1) * (   // hordas vivem de pilhagem
  UT.reduce((s, t) => s + a[t] * UNIT_BASE[t].c, 0) * ECON.upkeep + Object.keys(a.sup || {}).reduce((s, k) => s + SUPPORT[k].up * yearScale(), 0)) * (drillOk(a) ? 1.5 : 1);
const recCost = (n, type, k = 1) => Math.round(UNIT_BASE[type].c * 3 * eraScale() * k);
function canRecruit(n, type, k = 1) {
  if (type === 'art' && !canArt(n)) return 'Exige Trabuco';
  if (type === 'vrt' && !n.vert) return 'Exige uma vertente';
  if (type === 'vrt' && !vertDone(n)) return 'Complete todos os pontos de ' + VERT[n.vert].n + ' (' + n.vlv + '/' + VERT[n.vert].len + ')';
  if (n.manpower < k) return 'Sem contingente';
  if (n.subj && SUBJ_LAWS.army.o[n.subj.laws.army].demil && S.armies.reduce((s, a) => s + (a.o === n.id ? regs(a) : 0), 0) + k > Math.max(3, (n.mpMax || 0) * .1)) return 'Desmilitarizado pelo suserano';
  if (n.money < recCost(n, type, k)) return 'Sem dinheiro';
  return '';
}
function recruit(n, type, k, at, g) { const e = canRecruit(n, type, k); if (e) return e; n.money -= recCost(n, type, k); n.manpower -= k; const at2 = at != null ? at : n.capital; n.rec.push({ type, k, m: Math.round((type === 'vrt' ? 5 : 3) * BUILD_SLOW) - stateFx(WD.provs[at2].state, 'rec'), at: at2, x: recruitXp(n, at2), g }); return ''; }
const shipCost = n => Math.round(30 * ECON.costMul * eraScale());
function buildShips(n, k, p) {
  const pr = WD.provs[p]; if (!pr || !pr.coast || S.own[p] !== n.id) return 'Exige litoral próprio';
  if (!n.fx.sea) return 'Exige Barcos longos'; const c = Math.round(shipCost(n) * k * (1 - stateFx(pr.state, 'yard'))); if (n.money < c) return 'Sem dinheiro';
  n.money -= c; n.rec.push({ type: 'ship', k, m: Math.round(4 * BUILD_SLOW), at: p }); return '';
}
/* generais: um por exército; marcial e traços mudam a força em batalha */
const GEN_TR = { brave: .05, strategist: .1, craven: -.06, cruel: .03, genius: .03, ambitious: .02, paranoid: -.02, lazy: -.04, diligent: .03 };
const genMul = c => c ? Math.max(.7, 1 + (c.st.mar - 6) * .015 + c.tr.reduce((a, t) => a + (GEN_TR[t] || 0), 0) + ((IDEOS[c.ld] || {}).gen || 0)) : 1;   // ideologia do general: IDEOS.gen
const genCost = () => Math.round(20 * eraScale());
function genCands(n) { return [0, 1, 2].map(() => mkChar(n, { boost: 'mar', dyn: newDynasty(n), age: 24 + (rnd() * 30 | 0) })); }
const genWhy = a => a.genCd > S.t ? 'Nomeação recente: de novo em ' + dateStr(a.genCd) : '';
function setGeneral(n, a, c) { if (!a || a.o !== n.id) return 'Inválido'; const w = genWhy(a); if (w) return w; const k = genCost(); if (n.money < k) return 'Sem dinheiro'; n.money -= k; a.gen = c; a.genCd = S.t + APPOINT_CD * 30; if (a.g != null) groupOf(a).forEach(x => x.genCd = a.genCd); if (a.g != null) groupOf(a).forEach(x => x.gen = c); return ''; }
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
function addArmy(o, p, u, xp = .1) { const a = { id: S.id++, o, p, inf: u.inf || 0, cav: u.cav || 0, art: u.art || 0, vrt: u.vrt || 0, mor: 1, xp, fat: 0, st: 'bal', sup: {}, path: [], prog: 0, need: 0, arr: S.t }; if (o === S.player) a.g = a.id; S.armies.push(a); return a; }
function addFleet(o, z, ships) { const f = { id: S.id++, o, z, ships, path: [], prog: 0, need: 0, auto: false }; S.fleets.push(f); return f; }

/* ---------- pesquisa ---------- */
const techBase = y => 140 * Math.exp((y - 860) / 250);
const aheadMul = t => { const a = Math.max(0, t.y - curYear()); return a <= 60 ? 1 + a * .03 : Math.min(200, 2.8 * Math.pow(1 + (a - 60) / 25, 2)); };   // até 60 anos adiantada: +3%/ano; depois cresce rápido (até ×200)
function techCost(n, t) {
  if (t.cb == null) t.cb = t.vt && t.src.length ? t.src.reduce((a, x) => a + techBase(TECH[x].y), 0) * .8 + techBase(t.y) * .3 : techBase(t.y) * (t.entry ? 1.2 : 1);
  return Math.round(t.cb * aheadMul(t) * (1 - ((((n && n.tdisc) || {})[t.id]) || 0)));   // tdisc: planos roubados (operação de inteligência)
}
function vertNeedOk(n, v) {                                  // recurso ou terreno exigido no território ou numa província vizinha
  const need = VERT[v].need, test = NEEDS[need] ? p => needOk(NEEDS[need], p) : p => provRes(p.id) === need && resVisible(p.id);
  for (const p of provsOf(n.id)) { const pr = WD.provs[p]; if (test(pr) || pr.adj.some(o => test(WD.provs[o]))) return true; }
  return false;
}
/* condição de terreno/posição de NEEDS (content/techs.js) */
const needOk = (N, p) => (!N.terr || N.terr.includes(p.terr)) && (!N.coast || p.coast) && (N.equator == null || Math.abs(p.cy / MAP_H - .5) < N.equator);
const needName = v => { const k = VERT[v].need; return NEEDS[k] ? NEEDS[k].n : GOODS[k].n.toLowerCase(); };
function techState(n, t) {                                  // '' = pode pesquisar
  if (n.techs[t.id]) return 'done';
  if ((t.vt || t.vr) && n.vert !== t.v) return 'Exige escolher ' + VERT[t.v].n;
  if (t.entry && n.vpend) return 'Decida antes a vertente pendente';
  if (!t.v && n.vert && VERT[n.vert].rep.has(t.id)) return 'Substituída por ' + VERT[n.vert].n;
  if (!t.req.every(q => hasT(n, q))) return 'Exige tecnologias anteriores';
  const ahead = t.y - curYear();
  if (t.entry && !vertNeedOk(n, t.v)) return 'Exige ' + needName(t.v) + ' no território ou numa província vizinha';
  return '';
}
/* ponto inicial concluído: o país decide entre ficar com a vertente (bloqueia a área dela e troca algumas técnicas) ou levar 10% do bônus.
   Quem já tem uma vertente recusa as outras automaticamente. A escolha é para sempre. */
function vertOffer(n, v) {
  if (n.vert || !vertNeedOk(n, v)) { vertDecide(n, v, false); return; }
  if (n.id === S.player) { n.vpend = v; return; }
  vertDecide(n, v, v === n.vpref || (!n.vpref && chance(.15)));
}
function vertDecide(n, v, keep) {
  n.vpend = null; const V = VERT[v];
  if (keep && !n.vert) { n.vert = v; V.rep.forEach(id => { if (n.techs[id]) n.techs['vr_' + v + '_' + id] = 1; }); if (n.res && TECH[n.res] && V.rep.has(n.res)) n.res = null; log(natName(n) + ' abraçou a vertente ' + V.n + '.', n.id === S.player ? 'good' : 'world', [n.id]); }
  else { (n.vdec = n.vdec || {})[v] = 1; if (n.id === S.player) log('Você seguiu pela via comum e ficou com parte das vantagens de ' + V.n + '.', 'info', [n.id]); }
  calcMods(n);
}
/* escolher uma vertente depois: país sem vertente cujo ponto inicial já passou (recusado antes, ou começo numa era posterior).
   Fica preso a ela como quem a manteve na hora (técnicas comuns posteriores viram versões dela) e perde os 10% de bônus da recusa */
const vertAdoptCost = () => Math.round(300 * eraScale());
function vertAdoptWhy(n, v) {
  const V = VERT[v]; if (!V) return 'Inválido'; if (n.vert) return 'Já segue ' + VERT[n.vert].n; if (n.vpend) return 'Decida antes a vertente pendente';
  if (!(hasT(n, 'v_' + v) || (n.vdec || {})[v])) return 'Exige ' + TECH['v_' + v].n + ' (o ponto inicial)';
  if (!vertNeedOk(n, v)) return 'Exige ' + needName(v) + ' no território ou numa província vizinha';
  if (n.money < vertAdoptCost()) return 'Sem dinheiro'; return '';
}
function adoptVert(n, v) {
  const e = vertAdoptWhy(n, v); if (e) return e;
  n.money -= vertAdoptCost(); n.techs['v_' + v] = 1; if (n.vdec) delete n.vdec[v]; n.stab = Math.max(0, n.stab - 5);
  vertDecide(n, v, true); return '';
}
function researchRate(n) { return (2 + (n.popT || 0) * .004 + ((n.bsum || {}).research || 0)) * Math.max(.2, 1 + n.m.research) * (.6 + n.stab / 250) * (1 + techCount(n) * .012); }
function finishTech(n, t) {
  n.techs[t.id] = 1;
  if (t.entry) vertOffer(n, t.v);
  calcMods(n);
  if (n.id === S.player) log('Pesquisa concluída: ' + t.n + '.', 'good', [n.id]);
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
