/* Grand Chronicle — simulação: personagens, sucessão, golpes, leis e eleições. */
'use strict';

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
const lawOk = (n, k, o) => { const d = LAWS[k] && LAWS[k].o[o]; return !!d && condOk(n, d.when); };   // condições da opção: COND (engine.js)
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
  const L = LAWS[k] && LAWS[k].o[o]; if (!L) return 'Inválido'; if (!condOk(n, L.when)) return 'Exige ' + condFail(n, L.when).join(', ');
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
