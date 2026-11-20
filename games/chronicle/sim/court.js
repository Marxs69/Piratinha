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
  n.ruler = o.ruler || mkChar(n, { ruler: true }); n.council = {}; COUNCIL.forEach(([k]) => n.council[k] = councilChar(n, k));
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
  const sp = n.council.spymaster; if (sp) for (const c of courtOf(n)) if (c.sec && !c.secK && chance(sp.st.int / 600)) { c.secK = 1; if (isHuman(n.id)) log(roleName(n, 'spymaster') + ': descobrimos um segredo de ' + charName(c) + ' (' + SECRETS[c.sec].n.toLowerCase() + ').', 'info', [n.id]); }
  // educação: dos 6 aos 16 anos com um tutor; aos 16 aprende
  for (const k of n.kids || []) { const a = ageOf(k);
    if (a >= 6 && !k.tut) k.tut = COUNCIL.map(([s, , st]) => [s, (n.council[s] ? n.council[s].st[st] : 0)]).sort((x, y) => y[1] - x[1])[0][0];
    if (a >= 16 && k.tut && !k.edu) { k.edu = 1; const st = COUNCIL.find(c => c[0] === k.tut)[2]; k.st[st] = Math.min(20, k.st[st] + 3);
      if (chance(.6)) { const t = pickR(TUTOR_TR[k.tut].filter(t => !k.tr.includes(t))); if (t) { const o = TRAIT_OPP.find(p => p.includes(t)); k.tr = k.tr.filter(x => !(o && o.includes(x))); k.tr.push(t); } }
      if (isHuman(n.id)) log(charName(k) + ' terminou a educação com ' + roleName(n, k.tut).toLowerCase() + ' ' + charName(n.council[k.tut] || k) + '.', 'good', [n.id]); } }
  // regência
  if (n.regent && ageOf(n.ruler) >= 16) { n.regent = null; addPres(n, 5); if (isHuman(n.id)) log(charName(n.ruler) + ' atingiu a maioridade e governa sozinho.', 'good', [n.id]); calcMods(n); }
  n._dem = null; councilPolitics(n); schemeTick(n); plotTick(n);
  if (S.t % 360 === (n.id * 12) % 360) for (const c of [n.ruler, ...courtOf(n)]) { ideoDrift(n, c); if (c) leanOf(n, c); }   // uma vez por ano: ideologias mudam aos poucos e as vontades se refazem
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
  if (k === 'expose') { const slot = COUNCIL.find(([s]) => n.council[s] === c); if (!slot) return 'Só conselheiros podem ser expostos'; n.council[slot[0]] = councilChar(n, slot[0]); addPres(n, 3); log(charName(c) + ' caiu em desgraça: ' + SECRETS[c.sec].n.toLowerCase() + '.', 'info', [n.id]); calcMods(n); return ''; }
  return 'Inválido';
}

/* ---------- interações com membros (INTERACT): amigáveis sobem a opinião; cooptar, investigar, difamar e eliminar são as intrigas internas ---------- */
const courtFind = (n, id) => [n.ruler, ...courtOf(n)].find(c => c && c.id === id) || null;
const seatOfC = (n, c) => (COUNCIL.find(([k]) => n.council[k] === c) || [])[0] || null;
/* intriga do plano: governante + 30% da de quem gosta muito dele (opinião ≥ 50) + o assento de intriga (se não for o alvo) */
function plotPower(n, tgt) { let p = n.ruler ? n.ruler.st.int + (n.ruler.tr.includes('schemer') ? 4 : 0) : 4; const sp = n.council.spymaster;
  for (const c of courtOf(n)) if (c !== tgt && c !== sp && (c.op ?? 0) >= 50) p += c.st.int * PLOT.friend; if (sp && sp !== tgt) p += sp.st.int; return p; }
const plotDefense = (n, tgt) => tgt.st.int + (tgt.tr.includes('paranoid') ? 5 : 0) + (tgt.tr.includes('schemer') ? 3 : 0) + 4;
const interactCost = (n, c, k) => Math.round((INTERACT[k].money || 0) * eraScale() * (k === 'coopt' && c && c.secK ? .5 : 1));
function interactWhy(n, c, k) {
  const d = INTERACT[k]; if (!d || !c || c === n.ruler) return 'Inválido';
  if ((c.icd || {})[k] > S.t) return 'Feito há pouco (de novo em ' + yearOf(c.icd[k]) + ')';
  const m = interactCost(n, c, k); if (m && n.money < m) return 'Sem dinheiro'; if (d.pres && (n.pres ?? 50) < d.pres) return 'Prestígio insuficiente';
  if (d.plot && n.plot) return 'Já há um plano em andamento'; if (k === 'intel' && c.secK) return 'Os podres já são conhecidos'; if (k === 'intel' && c.inv) return 'Investigação em andamento';
  if (k === 'coopt' && c.coopt > S.t) return 'Já está cooptado';
  return '';
}
const interactChance = (n, c, k) => { const d = INTERACT[k], x = (plotPower(n, c) - plotDefense(n, c)) * .02; return k === 'coopt' ? clamp(d.base + x + (c.secK ? d.dirt : 0) + (c.op ?? 0) / 300, .05, .97) : k === 'slander' ? clamp(d.base + x, .1, .92) : 1; };
function interact(n, c, k) {
  const e = interactWhy(n, c, k); if (e) return e; const d = INTERACT[k], me = isHuman(n.id);
  n.money -= interactCost(n, c, k); if (d.pres) addPres(n, -d.pres); c.id = c.id ?? S.id++; (c.icd = c.icd || {})[k] = S.t + (d.cd || 12) * 30;
  if (d.op) { c.op = clamp((c.op ?? 0) + d.op, -100, 100); return ''; }
  if (k === 'coopt') { if (chance(interactChance(n, c, k))) { c.coopt = S.t + d.mo * 30; c.op = clamp((c.op ?? 0) + 10, -100, 100); if (c.secK === 1) c.secK = 2; if (me) log(charName(c) + ' foi cooptado: vai apoiar o governo.', 'good', [n.id]); }
    else { c.op = clamp((c.op ?? 0) - 20, -100, 100); if (me) log(charName(c) + ' recusou ser cooptado.', 'bad', [n.id]); } return ''; }
  if (k === 'intel') { c.inv = S.t + d.mo * 30; return ''; }
  if (k === 'slander') { if (chance(interactChance(n, c, k))) { c.disc = S.t + d.mo * 30; c.op = clamp((c.op ?? 0) - 15, -100, 100); if (me) log(charName(c) + ' foi desacreditado.', 'good', [n.id]); }
    else { addPres(n, -5); c.op = clamp((c.op ?? 0) - 30, -100, 100); if (me) log('A difamação contra ' + charName(c) + ' foi descoberta.', 'bad', [n.id]); } return ''; }
  if (k === 'kill') { n.plot = { cid: c.id, ok: 0, bad: 0, t: S.t }; return ''; }
  return 'Inválido';
}
/* tira alguém da corte (morte): o assento é preenchido conforme o governo */
function removeCourt(n, c) { const k = seatOfC(n, c); if (k) { n.council[k] = councilChar(n, k); apptSet(n, k, true); } else if (n.spouse === c) n.spouse = null; else if (n.kids) n.kids = n.kids.filter(x => x !== c); calcMods(n); }
function plotTick(n) {
  for (const c of courtOf(n)) if (c.inv && c.inv <= S.t) { c.inv = null;   // investigação terminou
    if (chance(clamp(.35 + (plotPower(n, c) - plotDefense(n, c)) * .03, .1, .95))) { c.sec = c.sec || pickR(SEC_IDS); c.secK = 1; if (isHuman(n.id)) log('A investigação achou os podres de ' + charName(c) + ': ' + SECRETS[c.sec].n.toLowerCase() + '.', 'good', [n.id]); }
    else if (isHuman(n.id)) log('A investigação sobre ' + charName(c) + ' não achou nada.', 'info', [n.id]); }
  const P = n.plot; if (!P) return; const t = courtFind(n, P.cid); if (!t) { n.plot = null; return; }
  P.ok = Math.min(100, P.ok + PLOT.ok + plotPower(n, t) * PLOT.ok_k + rnd() * PLOT.rnd); P.bad = Math.min(100, P.bad + PLOT.bad + plotDefense(n, t) * PLOT.bad_k + rnd() * PLOT.rnd);
  if (P.ok >= 100 && P.ok - P.bad >= 0) { n.plot = null; if (isHuman(n.id)) log(charName(t) + ' morreu de repente. Ninguém sabe dizer do quê.', 'good', [n.id]); removeCourt(n, t); return; }
  if (P.bad >= 100) { n.plot = null; const disc = chance(clamp(PLOT.disc + (plotDefense(n, t) - plotPower(n, t)) * .02, .05, .95));
    if (disc) { addPres(n, PLOT.pres); for (const c of courtOf(n)) c.op = clamp((c.op ?? 0) + PLOT.opAll, -100, 100); t.op = clamp((t.op ?? 0) - 60, -100, 100);
      if (isHuman(n.id)) { log('O plano contra ' + charName(t) + ' foi descoberto!', 'bad', [n.id]); notify(n.id, '🗡️ Plano descoberto', 'Todos sabem que tentamos eliminar ' + charName(t) + '. A corte desconfia de nós.'); } }
    else if (isHuman(n.id)) log('O plano contra ' + charName(t) + ' fracassou, mas ninguém descobriu.', 'info', [n.id]); }
}

/* ---------- esquemas ---------- */
const schemeCost = k => Math.round(SCHEMES[k].c * eraScale());
const schemePower = n => { const sp = n.council.spymaster; return (sp ? sp.st.int : 4) + (n.ruler ? n.ruler.st.int / 2 : 0) + (n.ruler && n.ruler.tr.includes('schemer') ? 5 : 0); };
/* tgt = { nat: id, who: 'ruler' | cargo | 'gen:<id do exército>', topic: { ty: 'ideo'|'law'|'gov', k, v } } */
function startScheme(n, k, tgt) {
  const d = SCHEMES[k]; if (!d) return 'Inválido'; if (n.scheme) return 'Já há uma operação em andamento';
  if (!(tgt && tgt.nat != null && nat(tgt.nat) && nat(tgt.nat).alive && tgt.nat !== n.id)) return 'Escolha outro país';
  if (k === 'slander' && !(tgt.topic && tgt.topic.v)) return 'Escolha o que espalhar'; if (k === 'murder' && !tgt.who) return 'Escolha o alvo';
  const c = schemeCost(k); if (n.money < c) return 'Sem dinheiro'; n.money -= c;
  n.scheme = { k, tgt, prog: 0, t: S.t }; return '';
}
const schemeTarget = (n, s) => { const t = nat(s.tgt.nat); if (!t || !t.alive) return null; const w = s.tgt.who;
  if (!w || w === 'ruler') return t.ruler; if (w.startsWith('gen:')) { const a = S.armies.find(x => x.id === +w.slice(4) && x.o === t.id); return a && a.gen ? a.gen : null; } return t.council[w] || null; };
const topicTxt = T => T.ty === 'ideo' ? 'ideologia ' + IDEOS[T.v].n : T.ty === 'law' ? LAWS[T.k].n + ': ' + LAWS[T.k].o[T.v].n : GOVS[T.v].n;
const schemeTxt = (n, s) => { const t = nat(s.tgt.nat), who = schemeTarget(n, s); return schemeName(s.k) + ' · ' + (t ? natName(t) : '?') + (s.k === 'murder' && who ? ' · ' + charName(who) : '') + (s.k === 'slander' && s.tgt.topic ? ' · ' + topicTxt(s.tgt.topic) : ''); };
function schemeTick(n) {
  const s = n.scheme; if (!s) return; const d = SCHEMES[s.k], t = s.tgt && s.tgt.nat != null ? nat(s.tgt.nat) : null;
  if (!d || !t || !t.alive || (s.k === 'murder' && !schemeTarget(n, s))) { n.scheme = null; return; }   // alvo sumiu (ou save antigo)
  const def = schemePower(t);
  s.prog = Math.min(1, s.prog + Math.max(.2, schemePower(n) / Math.max(4, 10 + def)) / d.m);
  if (chance(d.risk * (1 + def / 15))) {                          // descoberta
    n.scheme = null; addPres(n, -10); t.rel[n.id] = (t.rel[n.id] || 0) - 50;
    log('Descoberto: ' + natName(n) + ' tentou ' + schemeName(s.k).toLowerCase() + ' em ' + natName(t) + '.', [n.id, t.id].some(isHuman) ? 'bad' : 'world', [n.id, t.id]);
    notify(t.id, '🕵️ Operação descoberta', natName(n) + ' agia contra nós (' + schemeName(s.k).toLowerCase() + ').'); return;
  }
  if (s.prog < 1) return;
  n.scheme = null;
  if (s.k === 'spy') { n.spyT = t.id; const ev = EVENT.intel_haul; if (ev && evOpts(n, ev).length) { if (isHuman(n.id) && n.evWait) (n.evNext = n.evNext || []).push({ id: ev.id, t: S.t }); else fireEvent(n, ev); } }
  if (s.k === 'slander') spreadTopic(t, s.tgt.topic, n);
  if (s.k === 'murder') { const w = s.tgt.who, who = schemeTarget(n, s);
    if (!w || w === 'ruler') { log(titleOf(t) + ' ' + charName(t.ruler) + ' de ' + natName(t) + ' morreu de repente.', 'world', [t.id]); succeed(t, true); }
    else if (w.startsWith('gen:')) { const a = S.armies.find(x => x.id === +w.slice(4)); if (a) { a.gen = null; a.genCd = Math.max(a.genCd || 0, S.t + APPOINT_CD_DEATH * 30); } log('O general ' + charName(who) + ', de ' + natName(t) + ', morreu de repente.', [n.id, t.id].some(isHuman) ? 'info' : 'none', [t.id]); }
    else { t.council[w] = councilChar(t, w); apptSet(t, w, true); log(roleName(t, w) + ' ' + charName(who) + ', de ' + natName(t) + ', morreu de repente.', [n.id, t.id].some(isHuman) ? 'info' : 'none', [t.id]); } }
  if (isHuman(n.id) && s.k !== 'spy') log('Operação concluída — ' + schemeTxt(n, s) + '.', 'good', [n.id]);
}
/* panfletos: governante e conselheiros do alvo podem passar a querer a ideia; a pressão do conselho deles sobe */
function spreadTopic(t, T, by) {
  let k = 0; for (const c of [t.ruler, ...COUNCIL.map(([s]) => t.council[s])]) { if (!c || !chance(.5)) continue;
    if (T.ty === 'ideo' && IDEOS[T.v]) { c.ld = T.v; leanOf(t, c); k++; } else if (T.ty === 'law' && lawOk(t, T.k, T.v) && t.laws[T.k] !== T.v) { c.ll = { k: T.k, o: T.v }; k++; } else if (T.ty === 'gov' && govEdgeOk(t, T.v)) { c.lg = T.v; k++; } }
  t.press = clamp((t.press || 0) + 10, 0, 100); t.stab = Math.max(0, t.stab - 2);
  if ([t.id, by.id].some(isHuman)) log('As ideias de ' + topicTxt(T) + ' se espalham em ' + natName(t) + ' (' + k + ' do governo convencidos).', 'info', [t.id, by.id]);
}
/* operação de inteligência: o que levar (efeitos do evento intel_haul) */
const spyTechOf = n => { const t = n.spyT != null ? nat(n.spyT) : null; if (!t) return null; return Object.keys(t.techs).map(id => TECH[id]).filter(x => x && !x.v && !n.techs[x.id] && techState(n, x) === '' && !(n.tdisc || {})[x.id]).sort((a, b) => a.y - b.y)[0] || null; };
function spyDo(n, what) {
  const t = n.spyT != null ? nat(n.spyT) : null; if (!t || !t.alive) return; const me = isHuman(n.id);
  if (what === 'tech') { const x = spyTechOf(n); if (x) { (n.tdisc = n.tdisc || {})[x.id] = SPY.tech; if (me) log('Planos roubados de ' + natName(t) + ': ' + x.n + ' fica ' + Math.round(SPY.tech * 100) + '% mais barata.', 'good', [n.id]); } }
  if (what === 'mil') { (n.milAdv = n.milAdv || {})[t.id] = S.t + rand(SPY.milMo[0], SPY.milMo[1]) * 30; if (me) log('Conhecemos as táticas de ' + natName(t) + ': +' + Math.round(SPY.mil * 100) + '% de dano contra eles até ' + yearOf(n.milAdv[t.id]) + '.', 'good', [n.id]); }
  if (what === 'gold') { const x = Math.min(Math.max(0, t.money) * SPY.gold, Math.max(0, (n.inc || {}).tax || 0) * SPY.goldCap); t.money -= x; n.money += x; if (me) log('Desviamos ' + Math.round(x) + ' do tesouro de ' + natName(t) + '.', 'good', [n.id]); }
  if (what === 'map') { provsOf(t.id).forEach(p => explore(n, p)); for (let p = 0; p < t.exP.length; p++) if (t.exP[p] && chance(.3)) n.exP[p] = 1; WD.seas.forEach(z => { if (z.provs.some(p => n.exP[p])) n.exZ[z.id] = 1; }); if (me) { S.mapDirty = true; log('Copiamos os mapas de ' + natName(t) + '.', 'good', [n.id]); } }
  if (what === 'secret') { t.ruler.sec = t.ruler.sec || pickR(SEC_IDS); (n.intel = n.intel || {})[t.id] = { sec: t.ruler.sec, cid: t.ruler.id ?? (t.ruler.id = S.id++), t: S.t }; if (me) log('Descobrimos os podres de ' + charName(t.ruler) + ', de ' + natName(t) + '.', 'good', [n.id]); }
  n.spyT = null;
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
    COUNCIL.forEach(([k]) => { if (n.council[k] === h) n.council[k] = councilChar(n, k); });
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
  log('Partilha: ' + charName(heir) + ' herdou parte do reino e fundou ' + natName(m) + '.', isHuman(n.id) ? 'bad' : 'world', [n.id, m.id]);
  notify(n.id, '👑 Partilha', 'Pela lei de partilha, ' + charName(heir) + ' levou ' + take.length + ' províncias e fundou ' + natName(m) + ', aliado da dinastia.');
}
/* IA: suborna conselheiro hostil; difama ou espiona rivais; os cruéis e conspiradores matam */
function aiCourt(n) {                                         // IA: agrada ou coopta quem é hostil; os cruéis e conspiradores eliminam; difama ou espiona rivais lá fora
  const L = n.laws; if (GOVS[n.gov].succ === 'hered' && L.succ === 'partition' && lawOk(n, 'succ', 'primo') && chance(.1)) setLaw(n, 'succ', 'primo');   // reinos que podem abandonam a partilha
  if (!chance(.1)) return; const tr = n.ruler.tr;
  const hostile = courtOf(n).filter(c => (c.op ?? 0) < -40).sort((a, b) => (a.op ?? 0) - (b.op ?? 0))[0];
  if (hostile) { const k = (tr.includes('cruel') || tr.includes('schemer')) && seatOfC(n, hostile) && chance(.3) ? 'kill' : n.money > interactCost(n, hostile, 'coopt') * 3 ? 'coopt' : 'gift'; if (!interactWhy(n, hostile, k)) interact(n, hostile, k); return; }
  if (n.scheme || n.money < schemeCost('slander') * 4 || schemePower(n) < 9) return;
  const rival = [...neighbors(n)].map(nat).filter(t => t.alive && (n.rel[t.id] || 0) < -40)[0];
  if (rival) { const k = (tr.includes('cruel') || tr.includes('schemer')) && chance(.15) ? 'murder' : chance(.5) ? 'slander' : 'spy'; startScheme(n, k, { nat: rival.id, who: 'ruler', topic: { ty: 'ideo', v: n.ideo } }); }
}
