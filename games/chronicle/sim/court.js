/* Grand Chronicle — simulação: corte e intriga (leve) e sucessão.
   Personagens (governante, cônjuge, herdeiros e conselho) têm opinião do governante (c.op), às vezes um segredo (c.sec),
   e os herdeiros têm tutor (c.tut). O país tem prestígio (n.pres) e um esquema por vez (n.scheme).
   Os nomes de cargos, do prestígio e dos esquemas mudam com a era e o tipo de governo (ROLE_NAMES, SCHEMES.names). */
'use strict';

/* ---------- nomes pela era e pelo governo ---------- */
function roleName(n, k) {
  const cat = GOVS[n.gov].cat, y = curYear(); let nm = null;
  for (const [c, x] of ROLE_NAMES[k] || []) if ((!c.cat || c.cat.includes(cat)) && (!c.y || y >= c.y)) nm = x;
  return nm || (COUNCIL.find(c => c[0] === k) || [, k])[1];
}
const presName = n => roleName(n, 'pres');
const schemeName = k => { let nm = SCHEMES[k].names[0][1]; for (const [y, x] of SCHEMES[k].names) if (curYear() >= y) nm = x; return nm; };

/* ---------- novo país no meio do jogo (partilha, invasões, revoluções) ---------- */
function spawnNation(provs, o = {}) {
  const src = o.from != null ? nat(o.from) : null, id = S.nations.length, P = WD.provs.length;
  const cul = o.cul ?? (src ? src.cul : S.culg[provs[0]]);
  const name = o.name || nameGen(CULTURES[cul], rnd, new Set(S.nations.map(x => x.name)));
  const n = { id, name, cul, home: WD.provs[provs[0]].cont, kind: o.kind || (src ? src.kind : 'main'), col: hsl(rnd(), .4 + rnd() * .3, .42 + rnd() * .16), flag: flagRandom(rnd),
    gov: o.gov || (src ? src.gov : 'feudal'), ideo: o.ideo || (src ? src.ideo : 'trad'), money: o.money ?? 100, stab: 55, manpower: 0, techs: src ? Object.assign({}, src.techs) : {}, res: null, rp: 0,
    vert: src ? src.vert : null, vlv: 0, alive: true, claims: {}, truce: {}, rel: {}, allies: [], marr: [], trade: [], emb: [], cd: {}, cons: [], rec: [], fab: null, wex: 0,
    mk: { sup: {}, dem: {}, sat: {}, imp: {}, exp: {} }, inc: {}, exP: new Uint8Array(P), exZ: new Uint8Array(WD.seas.length), capital: -1,
    laws: src ? Object.assign({}, src.laws) : Object.assign({}, LAW_DEF), relig: o.relig ?? (src ? src.relig : S.relg[provs[0]]), ferv: 60, fav: 50, pres: 50 };
  S.nations.push(n); S.nations.forEach(x => { if (x !== n) { x.rel[id] = 0; n.rel[x.id] = 0; } });
  provs.forEach(p => { S.own[p] = id; S.ctrl[p] = id; delete S.sieges[p]; });
  n.capital = provs.reduce((a, b) => S.pop[a] >= S.pop[b] ? a : b);
  n.dyn = o.dyn || newDynasty(n); calcMods(n);
  n.ruler = o.ruler || mkChar(n, { ruler: true }); n.council = {}; COUNCIL.forEach(([k, , st]) => n.council[k] = mkChar(n, { boost: st, dyn: newDynasty(n) }));
  if (GOVS[n.gov].succ === 'hered') { n.spouse = mkChar(n, { f: !n.ruler.f, dyn: newDynasty(n), age: Math.max(16, ageOf(n.ruler) - 3) }); n.kids = []; }
  if (src) for (let p = 0; p < P; p++) n.exP[p] = src.exP[p]; initExplore(n);
  if (S._mine) S._mine[id] = []; ownChanged(); warsChanged(); strC = null; enterC = null; checkDead();   // quem perdeu a capital para o país novo muda de capital (ou some)
  calcMods(n); n.mpMax = provs.reduce((s, p) => s + S.pop[p], 0) * .03; n.manpower = n.mpMax * .3;
  return n;
}

/* ---------- prestígio ---------- */
const presMods = n => { const v = (n.pres ?? 50) - 50; return Math.abs(v) < 1 ? [] : [[presName(n) + ' ' + Math.round(n.pres), { stab: v / 500, coup: -v / 100 }]]; };
const addPres = (n, v) => { n.pres = clamp((n.pres ?? 50) + v, 0, 100); };

/* ---------- opinião ---------- */
const courtOf = n => [...COUNCIL.map(([k]) => n.council[k]), n.spouse, ...(n.kids || [])].filter(Boolean);
function opParts(n, c) {                                       // o que forma a opinião de c sobre o governante
  const R = n.ruler, out = [['Dever', 10]]; if (!R || c === R) return [];
  for (const t of c.tr) { if (R.tr.includes(t)) out.push(['Traço em comum: ' + TRAITS[t].n.toLowerCase(), 12]);
    const o = TRAIT_OPP.find(p => p.includes(t)); if (o && R.tr.includes(o[0] === t ? o[1] : o[0])) out.push(['Traço oposto: ' + TRAITS[t].n.toLowerCase(), -15]); }
  const d = (n._dem || demandsOf(n)).filter(x => x.c === c); if (d.length) out.push(['Exigências não atendidas', -15 * d.length]);
  if (c.lg && c.lg === n.gov) out.push(['Gosta do governo', 10]);
  const pv = Math.round(((n.pres ?? 50) - 50) / 5); if (pv) out.push([presName(n), pv]);
  if (c.bribe > S.t) out.push(['Subornado', 40]); if (c.fear > S.t) out.push(['Chantageado', 30]); if (c.res) out.push(['Ressentido com a sucessão', -25]);
  return out;
}
const opTarget = (n, c) => clamp(opParts(n, c).reduce((a, x) => a + x[1], 0), -100, 100);
/* conselho hostil conspira (entra no risco de golpe) */
function courtMods(n) {
  let hostile = 0; for (const [k] of COUNCIL) { const c = (n.council || {})[k]; if (c && (c.op ?? 0) < -30 && !(c.fear > S.t)) hostile += (-(c.op) - 30) / 100; }
  const out = presMods(n); if (hostile > 0) out.push(['Conselheiros hostis', { coup: hostile }]);
  if (n.regent) out.push(['Regência', { stab: -.05, coup: .3 }]);
  return out;
}

/* ---------- mensal: opinião, segredos, educação, regência, esquemas ---------- */
const SEC_IDS = Object.keys(SECRETS);
function courtTick(n) {
  n.pres = n.pres ?? 50; n.pres += clamp(50 - n.pres, -.15, .15);   // prestígio volta devagar ao meio
  n._dem = demandsOf(n);
  for (const c of courtOf(n)) {
    c.id = c.id ?? S.id++; if (c.sec === undefined) c.sec = chance(.18) ? pickR(SEC_IDS) : null;
    c.op = clamp((c.op ?? 0) + clamp(opTarget(n, c) - (c.op ?? 0), -3, 3), -100, 100);
  }
  // o chefe da espionagem descobre segredos da própria corte
  const sp = n.council.spymaster; if (sp) for (const c of courtOf(n)) if (c.sec && !c.secK && chance(sp.st.int / 600)) { c.secK = 1; if (n.id === S.player) log(roleName(n, 'spymaster') + ': descobrimos um segredo de ' + charName(c) + ' (' + SECRETS[c.sec].n.toLowerCase() + ').', 'info', [n.id]); }
  // educação: dos 6 aos 16 anos com um tutor; aos 16 aprende
  for (const k of n.kids || []) { const a = ageOf(k);
    if (a >= 6 && !k.tut) k.tut = COUNCIL.map(([s, , st]) => [s, (n.council[s] ? n.council[s].st[st] : 0)]).sort((x, y) => y[1] - x[1])[0][0];
    if (a >= 16 && k.tut && !k.edu) { k.edu = 1; const st = COUNCIL.find(c => c[0] === k.tut)[2]; k.st[st] = Math.min(20, k.st[st] + 3);
      if (chance(.6)) { const t = pickR(TUTOR_TR[k.tut].filter(t => !k.tr.includes(t))); if (t) { const o = TRAIT_OPP.find(p => p.includes(t)); k.tr = k.tr.filter(x => !(o && o.includes(x))); k.tr.push(t); } }
      if (n.id === S.player) log(charName(k) + ' terminou a educação com ' + roleName(n, k.tut).toLowerCase() + ' ' + charName(n.council[k.tut] || k) + '.', 'good', [n.id]); } }
  // regência
  if (n.regent && ageOf(n.ruler) >= 16) { n.regent = null; addPres(n, 5); if (n.id === S.player) log(charName(n.ruler) + ' atingiu a maioridade e governa sozinho.', 'good', [n.id]); calcMods(n); }
  n._dem = null; councilPolitics(n); schemeTick(n);
}
/* renúncias e expurgos: conselheiro furioso pede demissão; regimes de partido/ideologia afastam quem pensa diferente */
const PURGE_CATS = ['Socialista', 'Ditadura', 'Teocracia'];
function councilPolitics(n) {
  for (const [k] of COUNCIL) { const c = n.council[k]; if (!c) continue;
    if ((c.op ?? 0) < -50 && !(c.fear > S.t) && chance(.02)) { replaceCouncil(n, k, 'renunciou em protesto', false); continue; }
    if (PURGE_CATS.includes(GOVS[n.gov].cat) && c.ld && c.ld !== n.ideo && chance(.008)) replaceCouncil(n, k, GOVS[n.gov].cat === 'Teocracia' ? 'foi afastado pelo clero' : 'foi expurgado do regime', true);
  }
}
/* segredo conhecido: chantagear (fica com medo e não conspira) ou expor (sai da corte; prestígio +3) */
function useSecret(n, c, k) {
  if (!c.secK) return 'Segredo desconhecido';
  if (k === 'blackmail') { c.fear = S.t + 360 * 10; c.secK = 2; return ''; }
  if (k === 'expose') { const slot = COUNCIL.find(([s]) => n.council[s] === c); if (!slot) return 'Só conselheiros podem ser expostos'; n.council[slot[0]] = mkChar(n, { boost: slot[2], dyn: newDynasty(n) }); addPres(n, 3); log(charName(c) + ' caiu em desgraça: ' + SECRETS[c.sec].n.toLowerCase() + '.', 'info', [n.id]); calcMods(n); return ''; }
  return 'Inválido';
}

/* ---------- esquemas ---------- */
const schemeCost = k => Math.round(SCHEMES[k].c * eraScale());
const schemePower = n => { const sp = n.council.spymaster; return (sp ? sp.st.int : 4) + (n.ruler ? n.ruler.st.int / 2 : 0) + (n.ruler && n.ruler.tr.includes('schemer') ? 5 : 0); };
function startScheme(n, k, tgt) {
  const d = SCHEMES[k]; if (!d) return 'Inválido'; if (n.scheme) return 'Já há um esquema em andamento';
  if (d.tgt === 'own' && !(tgt && tgt.own)) return 'Escolha um conselheiro seu'; if (d.tgt === 'foreign' && !(tgt && tgt.nat != null)) return 'Escolha outro país';
  const c = schemeCost(k); if (n.money < c) return 'Sem dinheiro'; n.money -= c;
  n.scheme = { k, tgt, prog: 0, t: S.t }; return '';
}
const schemeTarget = (n, s) => s.tgt.own ? n.council[s.tgt.own] : s.tgt.nat != null && nat(s.tgt.nat).alive ? nat(s.tgt.nat).ruler : null;
const schemeTxt = (n, s) => schemeName(s.k) + ': ' + (s.tgt.own ? roleName(n, s.tgt.own).toLowerCase() + ' ' + charName(n.council[s.tgt.own]) : natName(nat(s.tgt.nat)));
function schemeTick(n) {
  const s = n.scheme; if (!s) return; const d = SCHEMES[s.k], who = schemeTarget(n, s);
  if (!who) { n.scheme = null; return; }
  const foreign = s.tgt.nat != null, def = foreign ? schemePower(nat(s.tgt.nat)) : 0;
  s.prog = Math.min(1, s.prog + Math.max(.2, schemePower(n) / Math.max(4, 10 + def)) / d.m);
  if (chance(d.risk * (foreign ? 1 + def / 15 : 1))) {          // descoberto
    n.scheme = null; addPres(n, -10);
    if (foreign) { const t = nat(s.tgt.nat); t.rel[n.id] = (t.rel[n.id] || 0) - 50; log('Descoberto: ' + natName(n) + ' tentou ' + schemeName(s.k).toLowerCase() + ' ' + natName(t) + '.', [n.id, t.id].includes(S.player) ? 'bad' : 'world', [n.id, t.id]); notify(t.id, '🕵️ Esquema descoberto', natName(n) + ' tramava contra nós (' + schemeName(s.k).toLowerCase() + '). Relação −50.'); }
    else { who.op = (who.op ?? 0) - 40; if (n.id === S.player) log('O esquema contra ' + charName(who) + ' foi descoberto.', 'bad', [n.id]); }
    return;
  }
  if (s.prog < 1) return;
  n.scheme = null; const t = foreign ? nat(s.tgt.nat) : null;
  if (s.k === 'bribe') { who.bribe = S.t + 360 * 5; who.op = Math.min(100, (who.op ?? 0) + 40); }
  if (s.k === 'spy') { t.ruler.sec = t.ruler.sec || pickR(SEC_IDS); (n.intel = n.intel || {})[t.id] = { sec: t.ruler.sec, cid: t.ruler.id ?? (t.ruler.id = S.id++), t: S.t }; }
  if (s.k === 'slander') { addPres(t, -15); t.stab = Math.max(0, t.stab - 5); }
  if (s.k === 'murder') { if (foreign) { log(titleOf(t) + ' ' + charName(t.ruler) + ' de ' + natName(t) + ' morreu de repente.', 'world', [t.id]); succeed(t, true); }
    else { const slot = s.tgt.own; n.council[slot] = mkChar(n, { boost: COUNCIL.find(c => c[0] === slot)[2], dyn: newDynasty(n) }); } }
  if (n.id === S.player) log('Esquema concluído — ' + schemeTxt(n, s) + '.', 'good', [n.id]);
}
/* expor o segredo descoberto do governante de outro país */
function exposeForeign(n, tid) { const I = (n.intel || {})[tid], t = nat(tid); if (!I || !t.alive || !t.ruler || t.ruler.id !== I.cid) return 'Sem segredo válido'; delete n.intel[tid]; addPres(t, -15); t.stab = Math.max(0, t.stab - 8); addPres(n, 3); log(natName(n) + ' expôs o segredo de ' + charName(t.ruler) + ' (' + SECRETS[I.sec].n.toLowerCase() + ').', 'world', [n.id, t.id]); return ''; }

/* ---------- sucessão ---------- */
/* escolhe e aplica o herdeiro pela lei; devolve true se tratou da sucessão */
function lawSuccession(n) {
  const law = (n.laws || LAW_DEF).succ, kids = (n.kids || []).slice().sort((a, b) => a.born - b.born), adults = kids.filter(k => ageOf(k) >= 16);
  if (law === 'elective') {
    const pool = [...adults, ...COUNCIL.map(([k]) => n.council[k]).filter(Boolean)], sc = c => c.st.adm + c.st.dip + c.st.mar + c.st.lea + c.st.int;
    if (!pool.length) return false; const h = pool.sort((a, b) => sc(b) - sc(a))[0];
    n.ruler = h; n.kids = kids.filter(k => k !== h); if (h.dyn !== n.dyn) { n.dyn = h.dyn; n.kids = []; n.stab -= 3; }
    COUNCIL.forEach(([k, , st]) => { if (n.council[k] === h) n.council[k] = mkChar(n, { boost: st, dyn: newDynasty(n) }); });
    n.spouse = mkChar(n, { f: !h.f, dyn: newDynasty(n), age: ageOf(h) }); return true;
  }
  if (!kids.length) return false;
  const h = kids[0]; n.ruler = h; n.kids = kids.slice(1); n.spouse = ageOf(h) >= 16 ? mkChar(n, { f: !h.f, dyn: newDynasty(n), age: ageOf(h) }) : null;
  if (law === 'primo') n.kids.forEach(k => k.res = 1);
  if (law === 'partition' && adults.length >= 2 && statesOf(n) >= 4 && n.senior == null) partition(n, adults.find(k => k !== h));
  if (ageOf(h) < 16) { n.regent = n.council.chancellor || null; n.stab -= 8; log('Regência em ' + natName(n) + ': ' + charName(h) + ' tem só ' + ageOf(h) + ' anos.', 'info', [n.id]); }
  return true;
}
/* partilha: o segundo herdeiro leva os estados mais distantes da capital (um quarto) como país próprio, aliado e da mesma dinastia */
function partition(n, heir) {
  const cap = WD.provs[n.capital], sts = WD.states.filter(s => S.own[s.cap] === n.id && !s.provs.includes(n.capital))
    .sort((a, b) => Math.hypot(WD.provs[b.cap].cx - cap.cx, WD.provs[b.cap].cy - cap.cy) - Math.hypot(WD.provs[a.cap].cx - cap.cx, WD.provs[a.cap].cy - cap.cy));
  const k = Math.max(1, Math.floor((sts.length + 1) / 4)), take = []; let seed = sts[0]; if (!seed) return;
  const pick = new Set([seed.id]);                              // cresce a partir do estado mais distante, por vizinhança
  while (pick.size < k) { const nb = sts.find(s => !pick.has(s.id) && s.provs.some(p => WD.provs[p].adj.some(q => pick.has(WD.provs[q].state)))); if (!nb) break; pick.add(nb.id); }
  WD.states.forEach(s => { if (pick.has(s.id)) s.provs.forEach(p => { if (S.own[p] === n.id) take.push(p); }); });
  if (!take.length) return;
  S.armies.forEach(a => { if (a.o === n.id && take.includes(a.p)) a.p = n.capital; });
  const m = spawnNation(take, { from: n.id, dyn: n.dyn, ruler: heir, gov: n.gov, money: Math.round(n.money * .2) }); n.money *= .8;
  n.kids = n.kids.filter(x => x !== heir); link(n, m, 'allies'); link(n, m, 'marr'); n.rel[m.id] = 60; m.rel[n.id] = 60;
  log('Partilha: ' + charName(heir) + ' herdou parte do reino e fundou ' + natName(m) + '.', [n.id].includes(S.player) ? 'bad' : 'world', [n.id, m.id]);
  notify(n.id, '👑 Partilha', 'Pela lei de partilha, ' + charName(heir) + ' levou ' + take.length + ' províncias e fundou ' + natName(m) + ', aliado da dinastia.');
}
/* IA: suborna conselheiro hostil; difama ou espiona rivais; os cruéis e conspiradores matam */
function aiCourt(n) {
  const L = n.laws; if (GOVS[n.gov].succ === 'hered' && L.succ === 'partition' && lawOk(n, 'succ', 'primo') && chance(.1)) setLaw(n, 'succ', 'primo');   // reinos que podem abandonam a partilha
  if (n.scheme || n.money < schemeCost('slander') * 4 || schemePower(n) < 9 || !chance(.08)) return; const tr = n.ruler.tr;
  const hostile = COUNCIL.map(([k]) => [k, n.council[k]]).filter(([, c]) => c && (c.op ?? 0) < -40)[0];
  if (hostile) { startScheme(n, chance(tr.includes('cruel') || tr.includes('schemer') ? .3 : 0) ? 'murder' : 'bribe', { own: hostile[0] }); return; }
  const rival = [...neighbors(n)].map(nat).filter(t => t.alive && (n.rel[t.id] || 0) < -40)[0];
  if (rival) startScheme(n, (tr.includes('cruel') || tr.includes('schemer')) && chance(.15) ? 'murder' : chance(.5) ? 'slander' : 'spy', { nat: rival.id });
}
