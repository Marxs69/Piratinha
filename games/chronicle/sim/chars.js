/* Grand Chronicle — simulação: personagens, sucessão, golpes, leis e eleições. */
'use strict';

/* ---------- personagens ---------- */
/* governos autoritários: a cultura e a fé do país são as do governante; nos liberais, o governante sai de qualquer parte da população */
const AUTH_CATS = ['Monarquia', 'Ditadura', 'Socialista', 'Teocracia', 'Tribal'];
const isAuth = n => AUTH_CATS.includes(GOVS[n.gov].cat);
function popPick(map, def) { let tot = 0; for (const k in map || {}) tot += map[k]; if (!tot) return def; let x = rnd() * tot; for (const k in map) { x -= map[k]; if (x < 0) return +k; } return def; }
function mkChar(n, o = {}) {
  const kin = o.age === 0 && n.ruler, cl = o.cul ?? (kin ? n.ruler.cul ?? n.cul : (o.ruler && isAuth(n)) || !n.culs ? n.cul : popPick(n.culs, n.cul));
  const rl = o.rel ?? (kin ? n.ruler.rel ?? n.relig : (o.ruler && isAuth(n)) || !n.rels ? n.relig : popPick(n.rels, n.relig));
  const cul = CULTURES[cl], fr = (n.laws && LAWS.women.o[n.laws.women] ? LAWS.women.o[n.laws.women].fr : .08) * (rl != null ? docOpt(rl, 'gender').fr || 1 : 1), f = o.f != null ? o.f : (o.ruler && !chance(Math.min(.9, fr)) ? false : chance(.5));
  const age = o.age != null ? o.age : (o.ruler ? 18 + (rnd() * 35 | 0) : 20 + (rnd() * 40 | 0));
  const st = {}; ['dip', 'mar', 'adm', 'int', 'lea'].forEach(k => st[k] = Math.round(clamp(rand(2, 14) + (o.boost === k ? 5 : 0), 0, 20)));
  const tids = Object.keys(TRAITS), tr = []; while (tr.length < 2 + (chance(.4) ? 1 : 0)) { const t = pickR(tids); if (!tr.includes(t)) tr.push(t); }
  const ld = pickIdeo(n);
  return leanOf(n, { id: S.id++, n: pickR(f ? cul.f : cul.m), dyn: o.dyn || n.dyn, f, born: curYear() - age, st, tr, ld, cul: cl, rel: rl });   // id: comandos e rede referem pessoas por id
}
/* inclinação de cada personagem: uma forma de governo e uma lei — sempre entre as que o país já pode adotar */
/* ideologia de um personagem novo: as que já surgiram na era (IDEOS.y0), com peso pela fase (em alta até y1, depois perde adeptos devagar, sem sumir);
   a ideologia do país e as que gostam do governo atual pesam mais */
function ideoWeight(i, y) { const d = IDEOS[i]; if (y < d.y0) return 0; const rise = Math.min(1, .3 + (y - d.y0) / 60); return y <= d.y1 ? rise : Math.max(.06, 1 - (y - d.y1) / 150); }
function pickIdeo(n, near) {
  const y = curYear(), w = []; let tot = 0;
  for (const i in IDEOS) { let x = ideoWeight(i, y); if (!x) continue; if (i === n.ideo) x *= 4; if (n.gov && (IDEOS[i].govs || []).includes(n.gov)) x *= 1.8; if (near != null) x *= Math.abs((IDEOS[i].ax || 0) - near) <= 1 ? 2 : .3; w.push([i, x]); tot += x; }
  let r = rnd() * tot; for (const [i, x] of w) { r -= x; if (r < 0) return i; } return n.ideo || 'trad';
}
/* caminho na árvore de governos até um dos governos da ideologia: devolve o próximo passo possível (ou null se já está lá ou não há caminho) */
function govStepTo(n, goals) {
  if (!goals || !goals.length || goals.includes(n.gov)) return null;
  const prev = new Map([[n.gov, null]]), q = [n.gov];
  for (let h = 0; h < q.length; h++) { const g = q[h]; for (const e of govEdges(g)) { if (prev.has(e.g) || !govOk(n, e.g)) continue; prev.set(e.g, g); if (goals.includes(e.g)) { let x = e.g; while (prev.get(x) !== n.gov) x = prev.get(x); return govEdgeOk(n, x) ? x : null; } q.push(e.g); } }
  return null;
}
const govDist = (n, from, goals) => { if (!goals || !goals.length) return 0; if (goals.includes(from)) return 0; const seen = new Set([from]); let fr = [from];
  for (let d = 1; d < 8; d++) { const nx = []; for (const g of fr) for (const e of govEdges(g)) if (!seen.has(e.g) && govOk(n, e.g)) { if (goals.includes(e.g)) return d; seen.add(e.g); nx.push(e.g); } fr = nx; } return 9; };
/* inclinação de cada personagem: vem da ideologia — o próximo passo rumo ao governo dela e uma das leis dela que o país ainda não tem */
function leanOf(n, c) {
  c.lg = null; c.ll = null; if (!n.fx || !n.laws) return c; const I = IDEOS[c.ld] || {};
  c.lg = govStepTo(n, I.govs);
  const opts = Object.entries(I.laws || {}).filter(([k, o]) => LAWS[k] && n.laws[k] !== o && lawOk(n, k, o)).map(([k, o]) => ({ k, o }));
  if (opts.length) c.ll = pickR(opts);
  return c;
}
const lawOk = (n, k, o) => { const d = LAWS[k] && LAWS[k].o[o]; return !!d && condOk(n, d.when) && !(d.until && curYear() > d.until); };   // condições da opção (COND) e a era (until)
const lawOld = (n, k) => { const d = LAWS[k].o[n.laws[k]]; return !!(d && d.until && curYear() > d.until); };
const ageOf = c => curYear() - c.born;
const charName = c => c.n + ' ' + c.dyn;
function newDynasty(n) { const cul = CULTURES[n.cul]; let s = pickR(cul.a) + pickR(cul.b); return s.charAt(0).toUpperCase() + s.slice(1); }

/* ---------- personagens: morte, sucessão, eleições e golpes ---------- */
function deathChance(c) {                                    // por mês; dispara depois dos 60 e passa de 100 anos quase nunca
  const age = ageOf(c), y = curYear(), die = c.tr.reduce((a, t) => a * ((TRAITS[t] || {}).die || 1), 1);
  if (age >= 100) return .3;
  return (age < 40 ? .0006 : .0006 * Math.exp((age - 40) / 8.5)) * die * (y > 1900 ? .6 : 1) * (y > 2050 ? .5 : 1);
}
function charMonthly(n) {
  const g = GOVS[n.gov], R = n.ruler, y = curYear();
  for (const [k, t] of COUNCIL) { const c = n.council[k]; if (c && chance(deathChance(c))) { n.council[k] = councilChar(n, k); apptSet(n, k, true); if (isHuman(n.id)) log(roleName(n, k) + ' ' + charName(c) + ' morreu aos ' + ageOf(c) + ' anos; um substituto assumiu.', 'info', [n.id]); } }
  if (n.spouse && chance(deathChance(n.spouse))) { if (isHuman(n.id)) log('Morreu ' + charName(n.spouse) + ', cônjuge do governante.', 'info', [n.id]); n.spouse = null; }
  if (g.succ === 'hered' && !n.spouse && ageOf(R) >= 16 && ageOf(R) < 60 && chance(.02)) n.spouse = mkChar(n, { f: !R.f, dyn: newDynasty(n), age: Math.max(16, ageOf(R) - 3) });
  if (n.senior != null && (!n.subj || n.subj.tier === 'union')) { const s = nat(n.senior); if (s.alive && GOVS[s.gov].succ === 'hered') { n.ruler = s.ruler; n.dyn = s.dyn; return; } freeSubject(n, null); succeed(n, false); return; }
  if (g.succ === 'ai') return;
  const age = ageOf(R), pDie = deathChance(R);
  if (chance(pDie)) { if (g.succ === 'elect') { log(titleOf(n, R) + ' ' + charName(R) + ' de ' + natName(n) + ' morreu; há eleição.', 'none', [n.id]); election(n, true); return; } log(titleOf(n, R) + ' ' + charName(R) + ' de ' + natName(n) + ' morreu aos ' + age + ' anos.', isHuman(n.id) ? 'bad' : 'info', [n.id]); succeed(n, true); return; }
  if (g.succ === 'term' || g.succ === 'council') { if (!n.termEnd) n.termEnd = y + (g.term || 4); if (y >= n.termEnd && S.t % 360 === 0) { n.termEnd = y + (g.term || 4); if (g.succ === 'term') election(n); else succeed(n, false); } }
  if (g.succ === 'hered' && n.spouse && n.kids && S.t % 360 === 0 && age < 50 && ageOf(n.spouse) < 45 && chance(.22 * (docOpt(n.relig, 'marriage').kids || 1))) { const k = mkChar(n, { age: 0 }); n.kids.push(k); if (isHuman(n.id)) log('Nasceu ' + k.n + ', filho do governante.', 'good', [n.id]); }
  // golpe
  generalCoups(n); if (!n.alive) return;
  const risk = g.coup * .0012 * (n.stab < 40 ? 1 + (40 - n.stab) / 8 : .35) * Math.max(.1, 1 + (n.m.coup || 0));
  if (!(n.coupCd > S.t) && chance(risk)) coup(n);
}
/* crise de regime (CRISIS): estab. abaixo do piso por N meses seguidos. Vale para todos, inclusive súdito em união pessoal e governo sem sucessão;
   o golpe só acontece onde o governo admite troca (não união, não 'ai'). Conta todo mês, também no mês de morte do governante. */
function crisisTick(n) {
  n.lowM = n.stab < CRISIS.stab ? (n.lowM || 0) + 1 : 0;
  if (n.lowM < CRISIS.months || !n.alive) return;
  n.lowM = 0; CRISTAT.n++; (CRISTAT.by[n.id] = (CRISTAT.by[n.id] || 0) + 1);
  const union = n.senior != null && (!n.subj || n.subj.tier === 'union');
  if (!union && GOVS[n.gov].succ !== 'ai') coup(n);
  n.wex = Math.min(n.wex, 10); n.stab = Math.max(n.stab, CRISIS.to); log('Crise de regime em ' + natName(n) + ': o governo caiu.', isHuman(n.id) ? 'bad' : 'world', [n.id]);
}
const CRISTAT = { n: 0, by: {} };                             // medição (fora do save)
/* num regime autoritário, se o novo governante é de outra cultura ou fé, o país passa a ser a dele (a antiga vira minoria) */
function rulerIdentity(n) {
  const R = n.ruler; if (!R || !isAuth(n) || (n.subj && n.subj.tier === 'union')) return;
  if (R.cul != null && R.cul !== n.cul) { const old = n.cul; n.cul = R.cul; (n.cpol = n.cpol || {})[old] = 2; delete n.cpol[R.cul]; log(natName(n) + ' passa a ter ' + CULTURES[R.cul].n + ' como cultura principal, a do novo governante.', isHuman(n.id) ? 'info' : 'none', [n.id]); }
  if (R.rel != null && R.rel !== n.relig) { const old = n.relig; n.relig = R.rel; n.fav = 50; n.excom = false; (n.rpol = n.rpol || {})[old] = 2; delete n.rpol[R.rel]; log(natName(n) + ' adota ' + RELIGIONS[REL_IDS[R.rel]].n + ', a fé do novo governante.', isHuman(n.id) ? 'info' : 'none', [n.id]); }
}
/* ---------- escolha do novo líder em governos com eleição (popular, interna, vitalícia ou do partido): 4 candidatos ---------- */
const PICK_SUCC = ['term', 'council', 'elect', 'party'];
const leaderScore = c => Object.values(c.st).reduce((a, b) => a + b, 0) + (c.tr.includes('charismatic') ? 4 : 0) + (c.tr.includes('genius') ? 3 : 0);
function leaderCands(n, ideo, keepOld) {
  const I = ideo || n.ideo, out = [];
  if (keepOld && n.ruler && ageOf(n.ruler) < 76) out.push(n.ruler);
  COUNCIL.map(([k]) => n.council[k]).filter(c => c && c.ld === I && !out.includes(c)).sort((a, b) => leaderScore(b) - leaderScore(a)).slice(0, 2).forEach(c => out.push(c));
  while (out.length < 4) { const c = mkChar(n, { ruler: true, dyn: newDynasty(n) }); c.ld = I; leanOf(n, c); out.push(c); }
  return out.slice(0, 4);
}
function chooseLeader(n, why, ideo, keepOld) {
  const cands = leaderCands(n, ideo, keepOld);
  if (isHuman(n.id)) { pendSet('lead', n.id, { id: n.id, why, cands }); return; }
  setLeader(n, cands.slice().sort((a, b) => leaderScore(b) - leaderScore(a))[0]);
}
function setLeader(n, c) {
  const g = GOVS[n.gov], seat = COUNCIL.find(([k]) => n.council[k] === c), same = c === n.ruler;
  if (seat) { n.council[seat[0]] = councilChar(n, seat[0]); apptSet(n, seat[0], true); }
  n.ruler = c; n.dyn = c.dyn; n.regent = null; n.kids = []; n.spouse = null; n.termEnd = curYear() + (g.term || 4); rulerIdentity(n); calcMods(n);
  log((same ? 'Reconduzido em ' + natName(n) + ': ' : 'Novo governo em ' + natName(n) + ': ') + titleOf(n).toLowerCase() + ' ' + charName(c) + '.', isHuman(n.id) ? 'info' : 'none', [n.id]);
}
function succeed(n, death) {
  const g = GOVS[n.gov], old = n.ruler;
  if (g.succ === 'hered') {
    if (lawSuccession(n)) { /* lei de sucessão (sim/court.js) */ }
    else if (tryUnion(n)) { calcMods(n); return; }
    else { n.ruler = mkChar(n, { ruler: true }); n.spouse = mkChar(n, { f: !n.ruler.f, dyn: newDynasty(n), age: ageOf(n.ruler) - 2 }); n.kids = []; n.stab -= 15; log('Crise de sucessão em ' + natName(n) + ': um parente distante assume.', isHuman(n.id) ? 'bad' : 'info', [n.id]); }
  } else if (PICK_SUCC.includes(g.succ)) {                   // governos com eleição: 4 candidatos, o jogador escolhe
    n.stab = clamp(n.stab - (g.succ === 'elect' ? 5 : 2), 0, 100); chooseLeader(n, death ? 'morte do governante' : 'fim do mandato', n.ideo, !death); return;
  } else {
    n.dyn = newDynasty(n); n.ruler = mkChar(n, { ruler: true, age: g.succ === 'theo' ? 50 + (rnd() * 20 | 0) : undefined, boost: g.succ === 'junta' ? 'mar' : null });
    n.stab -= g.succ === 'junta' ? 10 : g.succ === 'elect' ? 5 : 2;
  }
  n.termEnd = curYear() + (g.term || 4); rulerIdentity(n); n.stab = clamp(n.stab, 0, 100);
  log('Novo governo em ' + natName(n) + ': ' + titleOf(n).toLowerCase() + ' ' + charName(n.ruler) + '.', isHuman(n.id) ? 'info' : 'none', [n.id]);
  calcMods(n);
}
function coup(n, gen) {                                       // golpe militar (gen = o general que o lidera; sem ele, um oficial ambicioso). O novo governo só adota o que o país já pode ter
  const g = GOVS[n.gov], y = curYear(), leader = gen || mkChar(n, { ruler: true, boost: 'mar', dyn: newDynasty(n) }); if (!gen) leader.tr = ['ambitious', pickR(['cruel', 'strategist', 'charismatic', 'paranoid'])];
  S.armies.forEach(a => { if (a.gen === leader) a.gen = null; });
  const I = IDEOS[leader.ld] || {};
  if (COUP_GOVS[g.cat] && chance(COUP_GOVS.chance)) {         // para onde um golpe leva: COUP_GOVS (content/politics.js); prefere o que a ideologia do golpista quer
    const mil = COUP_GOVS[g.cat].filter(x => x !== n.gov && GOVS[x] && govOk(n, x)), pref = mil.filter(x => (I.govs || []).includes(x)), ng = pref.length ? pref[0] : mil.length ? pickR(mil) : null;
    if (ng) applyGov(n, ng);
  }
  if (leader.ld && leader.ld !== n.ideo && n.fx.i.has(leader.ld)) n.ideo = leader.ld;
  else if (y > 1800 && chance(.4)) { const ii = ['natpop', 'warrior'].filter(i => n.fx.i.has(i)); if (ii.length) n.ideo = pickR(ii); }
  n.dyn = leader.dyn; n.ruler = leader; n.kids = []; n.spouse = null; n.regent = null; rulerIdentity(n); n.stab = Math.max(20, n.stab - 15); n.coupCd = S.t + 360 * 10; n.press = 0; n.enact = null;
  const txt = (gen ? 'O general ' : '') + charName(n.ruler) + ' tomou o poder em ' + natName(n) + (I.n ? ' (' + I.n + ')' : '') + '.';
  log('Golpe! ' + txt, isHuman(n.id) ? 'bad' : 'world', [n.id]);
  notify(n.id, '⚔️ Golpe militar', txt + ' Agora governa como ' + titleOf(n).toLowerCase() + ' (' + GOVS[n.gov].n + ').');
  formCouncil(n); calcMods(n);
}
/* generais com ideologia muito diferente da do país (2+ pontos de radicalismo) e exército grande podem tentar o golpe; ambiciosos e com estabilidade baixa, mais */
function generalCoups(n) {
  if (n.coupCd > S.t || isHuman(n.id) && S.t < 360) return; const ax0 = (IDEOS[n.ideo] || {}).ax || 0;
  for (const a of S.armies) { const c = a.gen; if (a.o !== n.id || !c || regs(a) < 8) continue; const I = IDEOS[c.ld]; if (!I || Math.abs((I.ax || 0) - ax0) < 2) continue;
    const p = .0004 * (n.stab < 40 ? 1 + (40 - n.stab) / 10 : .5) * (c.tr.includes('ambitious') ? 2 : 1) * (c.tr.includes('just') || c.tr.includes('honest') ? .4 : 1) * Math.max(.1, 1 + (n.m.coup || 0));
    if (chance(p)) { coup(n, c); return; } }
}
/* com o tempo, alguns mudam de ideologia: para outra da era, perto no radicalismo (as antigas continuam com quem já as tem) */
function ideoDrift(n, c) { if (!c || !chance(.02)) return; const old = c.ld, nw = pickIdeo(n, (IDEOS[old] || {}).ax || 0); if (nw !== old) { c.ld = nw; leanOf(n, c); } }
/* exigências: o que o governante e o conselho querem e o país ainda não adotou (só conta o que já é possível adotar) */
function demandsOf(n) {
  const out = [], who = [[n.ruler, titleOf(n), 3, 'ruler'], ...COUNCIL.map(([k]) => [n.council[k], roleName(n, k), 1, k])];
  who.forEach(([c, t, w0, slot]) => { if (!c || c.coopt > S.t) return; const w = c.disc > S.t ? w0 * .4 : w0;   // cooptado não pressiona; desacreditado pesa menos
    const E = n.enact; if (c.lg && c.lg !== n.gov && govEdgeOk(n, c.lg) && !(E && E.ty === 'gov' && E.v === c.lg)) out.push({ ty: 'gov', v: c.lg, w, c, t, slot });
    if (c.ll && n.laws[c.ll.k] !== c.ll.o && lawOk(n, c.ll.k, c.ll.o) && !(E && E.ty === 'law' && E.k === c.ll.k && E.v === c.ll.o)) out.push({ ty: 'law', k: c.ll.k, v: c.ll.o, w, c, t, slot });
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
  n.council[slot] = councilChar(n, slot);
  n.dyn = c.dyn; n.ruler = c; n.kids = []; n.spouse = null; n.stab = Math.max(10, n.stab - 12); n.coupCd = S.t + 360 * 10; n.press = 0;
  const txt = 'Golpe do conselho em ' + natName(n) + ': ' + charName(c) + ' tomou o poder' + (done.length ? ' e impôs ' + done.join(', ') : '') + '.';
  log(txt, isHuman(n.id) ? 'bad' : 'world', [n.id]); notify(n.id, '🗡️ Golpe do conselho', txt);
  calcMods(n);
}
const BASE_GOVS = ['tribal', 'tribal_conf', 'horde', 'feudal', 'elective', 'empire'];
/* requisitos de uma forma de governo: tecnologia (fx.g) e condições (título e época) pela engine */
const govWhen = g => { const d = GOVS[g], c = {}; if (d.minRank != null || d.maxRank != null) c.rank = [d.minRank ?? null, d.maxRank ?? null]; if (d.until) c.year = [null, d.until]; return c; };
const govWhy = (n, g) => { if (!(n.fx.g.has(g) || BASE_GOVS.includes(g))) return 'Exige tecnologia'; const f = condFail(n, govWhen(g)); return f.length ? 'Exige ' + f.join(', ') : ''; };
/* anos desde que a forma de governo ficou ultrapassada (0 = atual): a crise de legitimidade cresce com o tempo */
const govAge = n => { const u = GOVS[n.gov].until; return u ? Math.max(0, curYear() - u) : 0; };
function govNextOf(n) {                                         // a reforma natural; sem ela, outra do mesmo grupo; sem ela, qualquer caminho da árvore
  const d = GOVS[n.gov], all = govReach(n);
  return d.next && all.includes(d.next) ? d.next : all.find(g => GOVS[g].cat === d.cat) || all[0] || null;
}
/* árvore de governos: os caminhos de reforma a partir do atual (GOVS[].to, com condição opcional) que a tecnologia, o título e a época já permitem */
const govEdges = g => (GOVS[g].to || []).map(x => Array.isArray(x) ? { g: x[0], when: x[1] } : { g: x, when: null }).filter(e => GOVS[e.g]);
const govEdgeWhy = (n, g) => { const e = govEdges(n.gov).find(x => x.g === g); if (!e) return 'Não é um caminho a partir de ' + GOVS[n.gov].n; const f = condFail(n, e.when); if (f.length) return 'Exige ' + f.join(', '); return govWhy(n, g); };
const govEdgeOk = (n, g) => !govEdgeWhy(n, g);
const govReach = n => govEdges(n.gov).map(e => e.g).filter(g => govEdgeOk(n, g));
const govOk = (n, g) => !govWhy(n, g);
function setGov(n, g) {                                        // propõe a reforma: passa por votação (ENACT) antes de valer
  const why = govEdgeWhy(n, g); if (why) return why;
  if (n.govCd > S.t) return 'Reforma recente'; return startEnact(n, 'gov', null, g);
}
function applyGov(n, g) {                                     // troca a forma de governo (sem custo; quem chama já checou)
  n.gov = g; n.govCd = S.t + 360 * 10;
  if (GOVS[g].succ !== 'hered') { n.marr = []; n.kids = []; n.spouse = null; S.nations.forEach(j => { if (j.senior === n.id && (!j.subj || j.subj.tier === 'union')) { freeSubject(j, null); succeed(j, false); log(j.name + ' deixou a união pessoal.', 'world', [j.id, n.id]); } }); }
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
/* candidatos a cada cargo: a lista fica a mesma por 5 anos (n.cands[cargo] = { t: até quando, list }) */
const CANDS_YEARS = 5;
function councilCands(n, k) {
  const s = COUNCIL.find(x => x[0] === k)[2]; n.cands = n.cands || {}; const c = n.cands[k];
  if (c && c.t > S.t && c.list.length) return c.list;
  const list = [0, 1, 2].map(() => councilChar(n, k)); n.cands[k] = { t: S.t + 360 * CANDS_YEARS, list }; return list;
}
const candsUntil = (n, k) => ((n.cands || {})[k] || {}).t;
/* prazo para nomear de novo um cargo (n.apptCd[cargo]); morte ou assassinato abre o cargo mais cedo */
const apptWhy = (n, k) => (n.apptCd || {})[k] > S.t ? 'Nomeação recente: de novo em ' + dateStr((n.apptCd || {})[k]) : '';
const apptSet = (n, k, death) => { (n.apptCd = n.apptCd || {})[k] = S.t + (death ? APPOINT_CD_DEATH : APPOINT_CD) * 30; };
function swapCouncil(n, k, c) { const w = apptWhy(n, k); if (w) return w; const cost = councilCost(); if (n.money < cost) return 'Sem dinheiro'; n.money -= cost; const old = n.council[k]; n.council[k] = c; apptSet(n, k, false);
  const L = (n.cands || {})[k]; if (L) { L.list = L.list.filter(x => x !== c); if (old && (old.op ?? 0) > -30) L.list.push(old); }   // quem saiu volta à lista de nomes
  calcMods(n); return ''; }
/* troca de um conselheiro por motivo político (renúncia, novo gabinete, expurgo): o substituto é da ideologia do governo quando o regime exige */
function replaceCouncil(n, k, why, sameIdeo) {
  const c = n.council[k], nc = councilChar(n, k); if (sameIdeo) nc.ld = n.ideo;
  n.council[k] = nc; if (isHuman(n.id) && c) log(roleName(n, k) + ' ' + charName(c) + ' ' + why + '; assume ' + charName(nc) + '.', 'info', [n.id]); calcMods(n);
}
const flagCost = () => Math.round(30 * eraScale());
function setFlag(n, f) { const c = flagCost(); if (n.money < c) return 'Sem dinheiro'; n.money -= c; n.flag = JSON.parse(JSON.stringify(f)); return ''; }
function rename(n, name) { name = (name || '').trim().replace(/\s+/g, ' '); if (name.length < 2 || name.length > 24) return 'Nome deve ter de 2 a 24 letras'; n.name = name; return ''; }

/* ---------- leis ---------- */
const lawCost = () => Math.round(ENACT.law.cost * eraScale());
const govCost = () => Math.round(ENACT.gov.cost * eraScale());
function setLaw(n, k, o) {                                    // propõe a lei: passa por votação (ENACT) antes de valer
  const L = LAWS[k] && LAWS[k].o[o]; if (!L) return 'Inválido'; if (n.laws[k] === o) return 'Já é a lei'; if (!condOk(n, L.when)) return 'Exige ' + condFail(n, L.when).join(', ');
  n.lawCd = n.lawCd || {}; if (n.lawCd[k] > S.t) return 'Mudada há pouco'; return startEnact(n, 'law', k, o);
}

/* ---------- votações (como no Victoria 3): uma proposta por vez, 3 fases; apoio de quem governa e do conselho acelera, eventos ajudam ou atrapalham ---------- */
const enactName = E => E.ty === 'law' ? LAWS[E.k].n + ': ' + LAWS[E.k].o[E.v].n : GOVS[E.v].n;
const enactPhases = n => ENACT.phases[GOVS[n.gov].cat] || ENACT.phases.Monarquia;
const enactCatChange = (n, E) => E.ty === 'gov' && GOVS[E.v].cat !== GOVS[n.gov].cat;
function startEnact(n, ty, k, v) {
  if (n.enact) return 'Já há uma votação em andamento: ' + enactName(n.enact);
  const c = ty === 'law' ? lawCost() : govCost(); if (n.money < c) return 'Sem dinheiro';
  n.money -= c; n.enact = { ty, k, v, prog: 0, ph: 0, t0: S.t };
  if (isHuman(n.id)) log('Proposta em votação: ' + enactName(n.enact) + '.', 'info', [n.id]); return '';
}
function cancelEnact(n) { if (!n.enact) return 'Nada em votação'; if (isHuman(n.id)) log('Proposta retirada: ' + enactName(n.enact) + '.', 'info', [n.id]); n.enact = null; return ''; }
/* posição de um personagem sobre a proposta (−1 a +1,5) e por quê */
function enactStance(n, c, E, isRuler) {
  let v = 0; const why = [], I = IDEOS[c.ld] || {}, nm = I.n ? I.n.toLowerCase() : '';
  if (c.coopt > S.t) { why.push('cooptado'); return [1.2, why]; }
  if (isRuler) { v += .3; why.push('é proposta do seu governo'); }
  if (E.ty === 'law') { const want = (I.laws || {})[E.k]; if (want === E.v) { v += 1; why.push(nm + ' quer esta lei'); } else if (want) { v -= 1; why.push(nm + ' quer ' + LAWS[E.k].o[want].n.toLowerCase()); } }
  if (E.ty === 'gov') { const G = I.govs || []; if (G.includes(E.v)) { v += 1.5; why.push(nm + ': é o governo que quer'); }
    else if (G.length) { const d0 = govDist(n, n.gov, G), d1 = govDist(n, E.v, G); if (d1 < d0) { v += .7; why.push(nm + ': aproxima do que quer'); } else if (d1 > d0) { v -= 1; why.push(nm + ': afasta do que quer'); } } }
  if (c.disc > S.t) { v *= .4; why.push('desacreditado'); }
  if (!isRuler && (c.op ?? 0) > 30) { v += .5; why.push('leal ao governante'); } if (!isRuler && (c.op ?? 0) < -30) { v -= .5; why.push('hostil ao governante'); }
  if (c.tr.includes('content')) { v -= .3; why.push('avesso a mudanças'); } if (E.ty === 'gov' && c.tr.includes('ambitious')) { v += .3; why.push('ambicioso'); }
  return [v, why];
}
function enactSupport(n, E) {
  const W = ENACT.w, heir = (n.kids || []).filter(k => ageOf(k) >= 16).sort((a, b) => a.born - b.born)[0], out = [];
  const add = (c, role, w, isR) => { if (!c) return; const [v, why] = enactStance(n, c, E, isR); out.push({ c, role, w, v: v * w, why }); };
  add(n.ruler, titleOf(n), W.ruler, true); COUNCIL.forEach(([k]) => add(n.council[k], roleName(n, k), W.seat, false));
  add(n.spouse, roleName(n, 'spouse'), W.spouse, false); add(heir, heir && heir.f ? 'Herdeira' : 'Herdeiro', W.heir, false);
  const tot = out.reduce((a, x) => a + x.v, 0), push = out.reduce((a, x) => a + (x.v > 0 ? Math.max(0, x.c.st[ENACT.push] - 8) * ENACT.pushK : 0), 0);
  return { tot, push, list: out };
}
const enactRate = (n, E) => { const D = ENACT[E.ty], s = enactSupport(n, E); return D.base * Math.max(.15, 1 + ENACT.k * s.tot + s.push) * (enactCatChange(n, E) ? D.cat : 1); };
function enactTick(n) {
  const E = n.enact; if (!E) return;
  if (E.ty === 'law' ? !lawOk(n, E.k, E.v) || n.laws[E.k] === E.v : n.gov === E.v || !govEdgeOk(n, E.v)) { if (isHuman(n.id)) log('A proposta ' + enactName(E) + ' perdeu o sentido e foi arquivada.', 'info', [n.id]); n.enact = null; return; }
  const s = enactSupport(n, E), P = enactPhases(n);
  E.prog += enactRate(n, E);
  if (E.prog >= (E.ph + 1) * 100) {
    if (E.ph === 2) {
      if (s.tot <= ENACT.fail && chance(.35)) { n.enact = null; n.stab = Math.max(0, n.stab - 2); if (isHuman(n.id)) log('A proposta ' + enactName(E) + ' foi derrotada na ' + P[2].toLowerCase() + '.', 'bad', [n.id]); return; }
      enactDone(n, E); return;
    }
    if (chance(clamp(ENACT.stall - s.tot * .05, 0, .6))) { E.prog = (E.ph + 1) * 100 - ENACT.back; if (isHuman(n.id)) log('A proposta ' + enactName(E) + ' emperrou: ' + P[E.ph].toLowerCase() + ' pediu mais debate.', 'info', [n.id]); }
    else { E.ph++; if (isHuman(n.id)) log(enactName(E) + ': passou para ' + P[E.ph].toLowerCase() + '.', 'info', [n.id]); }
  }
}
function enactDone(n, E) {
  n.enact = null;
  if (E.ty === 'law') { n.laws[E.k] = E.v; (n.lawCd = n.lawCd || {})[E.k] = S.t + 360 * 2; n.stab = clamp(n.stab + ENACT.law.stab, 0, 100); calcMods(n);
    log((isHuman(n.id) ? 'Lei aprovada: ' : 'Lei aprovada em ' + natName(n) + ': ') + enactName(E) + '.', isHuman(n.id) ? 'good' : 'none', [n.id]); return; }
  const oc = GOVS[n.gov].cat, nc = GOVS[E.v].cat, wasHered = GOVS[n.gov].succ === 'hered';
  n.stab = clamp(n.stab + (oc !== nc ? ENACT.gov.catStab : ENACT.gov.stab), 0, 100); applyGov(n, E.v);
  log('Reforma aprovada em ' + natName(n) + ': agora é ' + GOVS[E.v].n.toLowerCase() + '.', isHuman(n.id) ? 'good' : 'world', [n.id]);
  const tr = oc !== nc && GOV_TR.find(x => x.from.includes(oc) && x.to.includes(nc)), ev = tr && EVENT[tr.ev];
  if (ev && evOpts(n, ev).length) { if (isHuman(n.id) && n.evWait) (n.evNext = n.evNext || []).push({ id: ev.id, t: S.t }); else fireEvent(n, ev); return; }   // o evento de transição decide quem governa
  if (wasHered && GOVS[E.v].succ !== 'hered') succeed(n, false); else if (!wasHered && GOVS[E.v].succ === 'hered') n.dyn = n.ruler.dyn;
}
/* novo governante depois de uma reforma (efeito 'leader' dos eventos de transição) */
function newLeader(n, how) {
  if (how === 'keep') { n.dyn = n.ruler.dyn; }
  else if (how === 'council' || how === 'marshal') {
    const seats = COUNCIL.map(([k]) => k).filter(k => n.council[k]), sc = k => { const c = n.council[k]; return Object.values(c.st).reduce((a, b) => a + b, 0) + (c.op ?? 0) / 10; };
    const k = how === 'marshal' && n.council.marshal ? 'marshal' : seats.sort((a, b) => sc(b) - sc(a))[0]; if (!k) return;
    const c = n.council[k]; n.ruler = c; n.dyn = c.dyn; n.council[k] = councilChar(n, k);
  } else { n.dyn = newDynasty(n); n.ruler = mkChar(n, { ruler: true, age: how === 'clergy' ? 50 + (rnd() * 20 | 0) : undefined, boost: how === 'clergy' ? 'lea' : null, rel: how === 'clergy' ? n.relig : undefined }); }
  n.regent = null; n.kids = []; n.spouse = GOVS[n.gov].succ === 'hered' ? mkChar(n, { f: !n.ruler.f, dyn: newDynasty(n), age: Math.max(16, ageOf(n.ruler) - 3) }) : null;
  n.termEnd = curYear() + (GOVS[n.gov].term || 4); rulerIdentity(n); calcMods(n);
  log('Novo governo em ' + natName(n) + ': ' + titleOf(n).toLowerCase() + ' ' + charName(n.ruler) + '.', isHuman(n.id) ? 'info' : 'none', [n.id]);
}
/* golpe que encerra uma transição: o país cai num dos governos de COUP_GOVS do novo tipo */
function govCoupTo(n) { const L = (COUP_GOVS[GOVS[n.gov].cat] || COUP_GOVS.Monarquia).filter(g => g !== n.gov && GOVS[g] && govOk(n, g)); if (L.length) applyGov(n, L[0]); }

/* ---------- conselho: escolhido conforme o governo (COUNCIL_MODE) ---------- */
function councilChar(n, k) {
  const s = COUNCIL.find(x => x[0] === k)[2], M = COUNCIL_MODE[GOVS[n.gov].cat] || {};
  const c = mkChar(n, { boost: s, dyn: newDynasty(n), rel: M.faith ? n.relig : undefined });
  if (M.merit) c.st[s] = Math.min(20, c.st[s] + M.merit); if (M.mil) c.st.mar = Math.min(20, c.st.mar + M.mil); if (M.ideo) c.ld = n.ideo;
  return c;
}
function formCouncil(n) {                                     // gabinete novo inteiro (início em era avançada, troca de regime)
  n.council = n.council || {}; COUNCIL.forEach(([k]) => n.council[k] = councilChar(n, k)); n.cands = {};
  const M = COUNCIL_MODE[GOVS[n.gov].cat] || {}; if (M.ideo && n.ruler) n.ruler.ld = n.ideo;
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
function election(n, death) {                                  // o partido mais votado indica o governo; o jogador escolhe o líder entre 4 candidatos dele
  supportTick(n); const sup = n.sup || {}; let win = n.ideo, best = -1;
  for (const k in sup) { const v = sup[k] + (rnd() - .5) * .06; if (v > best) { best = v; win = k; } }
  const pctv = Math.round((sup[win] || 0) * 100), changed = win !== n.ideo;
  if (changed) { n.ideo = win; COUNCIL.forEach(([k]) => { const c = n.council[k]; if (c && c.ld !== win && chance(.6)) replaceCouncil(n, k, 'deixou o gabinete após a eleição', true); }); calcMods(n); }   // novo governo, novo gabinete
  const txt = 'Eleições em ' + natName(n) + ': ' + (changed ? 'o partido ' + IDEOS[win].n + ' venceu' : 'o governo (' + IDEOS[win].n + ') foi reeleito') + ' com ' + pctv + '%.';
  log(txt, isHuman(n.id) ? (changed ? 'bad' : 'good') : 'none', [n.id]);
  chooseLeader(n, txt, win, !changed && !death);
  return changed;
}
const campaignCost = () => Math.round(40 * eraScale());
function campaign(n) { if (!isElective(n)) return 'Só em governos eletivos'; if (n.campCd > S.t) return 'Campanha recente'; if (n.money < campaignCost()) return 'Sem dinheiro'; n.money -= campaignCost(); n.campCd = S.t + 360; n.sup[n.ideo] = (n.sup[n.ideo] || 0) + .06; supportTick(n); return ''; }
