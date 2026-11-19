/* Grand Chronicle — simulação: peste, escravos, revoltas, religião e minorias. */
'use strict';

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
