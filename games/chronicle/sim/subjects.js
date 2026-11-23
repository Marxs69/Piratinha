/* Grand Chronicle — simulação: súditos (fantoche, vassalo, protetorado, domínio e união pessoal).
   n.senior = suserano; n.subj = { tier, lib, laws, prog, t }. Súdito e suserano têm aliança e acordo comercial fixos (só a independência desfaz).
   Os níveis são progresso (SUBJECTS.next, SUBJ_PROG): com liberdade abaixo de 50% a barra prog enche e o súdito sobe (ex.: protetorado → fantoche → vassalo → integrado). A liberdade (lib) é uma barra de 0 a 100:
   0% = integrado (o súdito é anexado em paz se o suserano estiver integrando), 100% = livre (o súdito rompe e declara independência).
   A barra anda até 1,5 ponto por mês em direção ao alvo (libTarget), que depende do nível, das leis, da força, da relação e de cultura e fé. */
'use strict';

const isSubj = n => n.senior != null && !!n.subj;
const subjectsOf = id => S.nations.filter(j => j.alive && j.senior === id && j.subj);
function makeSubject(t, o, tier, skipW) {
  if (t.senior != null) freeSubject(t, false);
  t.senior = o.id; t.subj = { tier, lib: SUBJECTS[tier].base, laws: Object.assign({}, SUBJ_LAW_DEF), prog: 0, t: S.t };
  subjTies(t, o); t.rel[o.id] = Math.max(t.rel[o.id] || 0, -20);
  S.wars.filter(w => w !== skipW && sideOf(w, t.id) && sideOf(w, o.id) && sideOf(w, t.id) !== sideOf(w, o.id)).forEach(w => separatePeace(w, t.id, null, null));
}
function freeSubject(t, why) {
  const o = t.senior != null ? nat(t.senior) : null; delete t.senior; delete t.subj; delete t.unionT;
  if (o) { breakTies(t, o); if (why) log(natName(t) + ' ' + why + ' ' + natName(o) + '.', 'world', [t.id, o.id]); }
}
/* o que move a barra (positivo = quer liberdade); devolve [alvo, [rótulo, valor]...] */
const SUBSTAT = { blocked: 0 };                              // medição (fora do save)
function libParts(t) {
  const s = t.subj, o = nat(t.senior), T = SUBJECTS[s.tier], out = [['Nível: ' + T.n, T.base]];
  for (const k in SUBJ_LAWS) { const d = SUBJ_LAWS[k].o[s.laws[k]]; if (d && d.lib) out.push([SUBJ_LAWS[k].n + ': ' + d.n, d.lib]); }
  const st = strength(t), so = strength(o); out.push(['Força comparada', Math.round(40 * st / Math.max(1, st + so) - 15)]);
  out.push(['Relação com o suserano', -Math.round((t.rel[o.id] || 0) / 8)]);
  if (t.cul !== o.cul) out.push(['Cultura diferente', 8]); if (t.relig !== o.relig) out.push(['Fé diferente', 8]);
  if (o.stab < 30) out.push(['Suserano instável', 10]); { const ov = overCap(o); if (ov) out.push(['Suserano acima do limite de domínio', Math.min(30, ov * SEPAR.lib)]); } if (warsOf(o.id).some(w => surrender(w, sideOf(w, o.id)) > .5)) out.push(['Suserano perdendo uma guerra', 10]);
  if (S.t - s.t < 360 * 10) out.push(['Laço recente', 8]);
  for (const x of s.push || []) if (x.u > S.t) out.push([x.l, x.v]);
  const b = backerOf(t); if (b) out.push(['Apoio de ' + b.name, SUBJ_BACK.lib]);
  return out.filter(x => x[1]);
}
const libTarget = t => clamp(libParts(t).reduce((a, x) => a + x[1], 0), 0, 100);
const subjTies = (t, o) => { if (!has(t, 'allies', o.id)) link(t, o, 'allies'); if (!has(t, 'trade', o.id)) link(t, o, 'trade'); };   // fixos enquanto durar o laço
const subjFixed = (a, b) => a.senior === b.id || b.senior === a.id;
/* progresso por mês: enche com a liberdade abaixo de 50% (mais rápido perto de 0%, pelo nível e pela lei de governo); volta acima de 50% */
const progRate = t => { const s = t.subj; return s.lib < 50 ? SUBJ_PROG.k * (50 - s.lib) / 50 * SUBJECTS[s.tier].int * (SUBJ_LAWS.rule.o[s.laws.rule].int || 1) : -SUBJ_PROG.back * (s.lib - 50) / 50; };
const nextTier = t => SUBJECTS[t.subj.tier].next;
/* integração (último passo): exige boa relação do súdito com o suserano e espaço no limite de domínio */
function integWhy(t) {
  const o = nat(t.senior); if ((t.rel[o.id] || 0) < SUBJ_PROG.rel) return 'Relação de ' + t.name + ' com o suserano abaixo de ' + SUBJ_PROG.rel + ' (está em ' + Math.round(t.rel[o.id] || 0) + ')';
  if (domUsed(o) + statesOf(t) * (1 - (SUBJECTS[t.subj.tier].dom || 0)) > domCap(o) * 1.1 + 1) return 'Sem espaço no limite de domínio do suserano';
  if (warsOf(o.id).length) return 'O suserano está em guerra';
  if (o.money < integPrice(t)) return 'O suserano precisa de 💰' + integPrice(t); return '';
}
const subjCap = n => SUBJ_PROG.cap + SUBJ_PROG.capRank * (n.rank || 0);
const integPrice = t => Math.round(SUBJ_PROG.cost * provsOf(t.id).length * eraScale());
function setSubjLaw(o, t, k, v) { if (t.senior !== o.id || !SUBJ_LAWS[k] || !SUBJ_LAWS[k].o[v]) return 'Inválido'; if (t.subj.lawCd > S.t) return 'Mudança recente'; t.subj.laws[k] = v; t.subj.lawCd = S.t + 360; t.rel[o.id] = (t.rel[o.id] || 0) - 5; return ''; }
function integrate(o, t) {                                     // fim da barra: anexação pacífica
  o.ae = (o.ae || 0) + provsOf(t.id).length * PEACE.integAe;   // integrar também assusta os vizinhos
  provsOf(t.id).forEach(p => { S.own[p] = o.id; S.ctrl[p] = o.id; }); S.armies.forEach(a => { if (a.o === t.id) a.o = o.id; }); abC = null; S.fleets.forEach(f => { if (f.o === t.id) f.o = o.id; });
  o.money += Math.max(0, t.money); log(natName(t) + ' foi integrado a ' + natName(o) + '.', 'world', [t.id, o.id]); freeSubject(t, null); ownChanged(); checkDead();
}
function independence(t) {
  const o = nat(t.senior), tier = t.subj.tier, b = backerOf(t);   // apoio estrangeiro: lido antes de freeSubject apagar o laço
  freeSubject(t, tier === 'union' ? 'rompeu a união pessoal com' : 'declarou independência de');
  if (tier === 'union') { succeed(t, false); return; }
  if (o.alive && !atWar(t.id, o.id)) { t.truce[o.id] = 0; delete (t.noWar || {})[o.id]; delete (o.noWar || {})[t.id]; if (!declareWar(t, o, null) && b && b.alive) joinWar(S.wars[S.wars.length - 1], b.id, 'A'); }
  if (isHuman(t.id) || isHuman(o.id)) notifyAll('🏴 Independência', natName(t) + ' rompeu com ' + natName(o) + '.');
}
/* ---------- o lado do súdito: lealdade, petições, apoio estrangeiro (SUBJ_ACTS, eventos subj_*) ---------- */
const seniorWeak = t => { const o = nat(t.senior); return o.stab < 30 || warsOf(o.id).some(w => surrender(w, sideOf(w, o.id)) > .5); };
const backerOf = t => { const b = t.subj && t.subj.backer != null ? nat(t.subj.backer) : null; return b && b.alive && !isSubj(b) && b.id !== t.senior && !has(b, 'allies', t.senior) ? b : null; };
function findBacker(t) {                                       // a potência mais forte que não gosta do suserano e topa ajudar
  const o = nat(t.senior), so = strength(o);
  const c = S.nations.filter(b => b.alive && b.id !== t.id && b.id !== o.id && !isSubj(b) && !has(b, 'allies', o.id) && (b.rel[o.id] || 0) <= SUBJ_BACK.rel && strength(b) >= so * SUBJ_BACK.minStr)
    .sort((x, y) => strength(y) - strength(x));
  const b = c.find(b => chance(.4 + (-(b.rel[o.id] || 0)) / 200 + ((b.rel[t.id] || 0)) / 300));
  if (b) { t.subj.backer = b.id; if (isHuman(t.id)) notify(t.id, '🤝 Apoio estrangeiro', natName(b) + ' apoiará sua independência.'); }
  else if (isHuman(t.id)) notify(t.id, '🤝 Sem apoio', 'Nenhuma potência quis se comprometer agora.');
}
const PET_STEP = { tribute: ['heavy', 'normal', 'none'], army: ['demil', 'levies', 'own'], rule: ['governor', 'advisors', 'self'] };
function petition(t, k) {                                       // o suserano decide pela relação, pela barra e pela personalidade
  if (!isSubj(t) || !PET_STEP[k]) return; const o = nat(t.senior), L = PET_STEP[k], i = L.indexOf(t.subj.laws[k]); if (i < 0 || i >= L.length - 1) return;
  if (isHuman(o.id)) { notify(o.id, '📜 Petição', natName(t) + ' pede ' + SUBJ_LAWS[k].n.toLowerCase() + ': ' + SUBJ_LAWS[k].o[L[i + 1]].n + '. Mude na aba Súditos se quiser atender.'); return; }
  const p = .35 + (o.rel[t.id] || 0) / 200 + (t.subj.lib > 60 ? .15 : 0) + (seniorWeak(t) ? .2 : 0);
  if (chance(p)) { t.subj.laws[k] = L[i + 1]; if (isHuman(t.id)) notify(t.id, '📜 Petição aceita', natName(o) + ' concedeu: ' + SUBJ_LAWS[k].n + ' ' + SUBJ_LAWS[k].o[L[i + 1]].n + '.'); }
  else { relAdd(o, t, -10); (t.subj.push = t.subj.push || []).push({ l: 'Petição recusada', v: 5, u: S.t + 720 }); if (isHuman(t.id)) notify(t.id, '📜 Petição recusada', natName(o) + ' recusou o pedido.'); }
}
function subjActWhy(t, k) {
  const A = SUBJ_ACTS[k]; if (!A) return 'Inválido'; if (!isSubj(t)) return 'Você não é súdito';
  if (((t.subj.acd || {})[k] || 0) > S.t) return 'Só a partir de ' + yearOf(t.subj.acd[k]);
  if (A.when && !condOk(t, A.when)) return condTxt(A.when).join(', ');
  if (A.cost && t.money < Math.round(A.cost * eraScale())) return 'Sem dinheiro';
  return '';
}
function subjAct(t, k) {
  const e = subjActWhy(t, k); if (e) return e; const A = SUBJ_ACTS[k];
  if (A.cost) t.money -= Math.round(A.cost * eraScale()); (t.subj.acd = t.subj.acd || {})[k] = S.t + 360 * (A.cd || 1);
  applyFx(t, A.fx); return '';
}
/* mensal: tributo, contingentes, barra de liberdade, integração e independência */
function subjectsTick() {
  for (const t of S.nations) {
    if (!t.alive || t.senior == null) continue;
    if (!t.subj) t.subj = { tier: 'union', lib: 30, laws: Object.assign({}, SUBJ_LAW_DEF), prog: 0, t: t.unionT || S.t };   // saves antigos: união pessoal
    const o = nat(t.senior); if (!o.alive) { freeSubject(t, null); continue; }
    const s = t.subj, T = SUBJECTS[s.tier], L = s.laws;
    const tri = Math.max(0, (t.inc && t.inc.tax) || 0) * T.tri * SUBJ_LAWS.tribute.o[L.tribute].tri;
    if (tri > 0) { t.money -= tri; o.money += tri; t.inc.tribute = -tri; t.income -= tri; o.inc.tribute = (o.inc.tribute || 0) + tri; o.income += tri; }
    const mp = SUBJ_LAWS.army.o[L.army].mp || 0; if (mp && t.manpower > 1) { const k = t.manpower * mp * .1; t.manpower -= k; o.manpower += k; }
    if (s.push && s.push.some(x => x.u <= S.t)) s.push = s.push.filter(x => x.u > S.t);
    const tg = libTarget(t); s.tg = tg; s.lib = clamp(s.lib + clamp(tg - s.lib, -1.5, 1.5), 0, 100);
    subjTies(t, o);
    s.prog = clamp((s.prog || 0) + progRate(t), 0, 100);
    if (s.prog >= 100) { const nx = nextTier(t);
      if (nx === 'int') { if (!integWhy(t)) { o.money -= integPrice(t); integrate(o, t); continue; } }
      else if (domUsed(o) + statesOf(t) * ((SUBJECTS[nx].dom || 0) - (SUBJECTS[s.tier].dom || 0)) > domCap(o) * 1.1 + 1) { s.prog = 100; SUBSTAT.blocked++; }   // sem espaço no domínio do suserano: o nível espera
      else { s.tier = nx; s.prog = 0; log(natName(t) + ' passou a ' + SUBJECTS[nx].n.toLowerCase() + ' de ' + natName(o) + '.', isHuman(t.id) || isHuman(o.id) ? 'info' : 'none', [t.id, o.id]);
        if (isHuman(t.id) || isHuman(o.id)) [t.id, o.id].filter(isHuman).forEach(id => notify(id, SUBJECTS[nx].e + ' ' + SUBJECTS[nx].n, natName(t) + ' passou a ' + SUBJECTS[nx].n.toLowerCase() + ' de ' + natName(o) + '.')); } }
    if (s.lib >= 100 && chance(.3)) independence(t);
  }
}
/* IA como suserana: leis pela personalidade; perto da integração, cuida da relação */
function aiSubjects(n) {
  const P = personality(n);
  for (const t of subjectsOf(n.id)) { const s = t.subj;
    if (s.lib > 75 && s.laws.tribute !== 'none') setSubjLaw(n, t, 'tribute', s.laws.tribute === 'heavy' ? 'normal' : 'none');
    else if (s.lib < 35 && s.laws.tribute === 'normal' && P.gold > 1) setSubjLaw(n, t, 'tribute', 'heavy');
    if (s.lib < 45 && s.laws.rule !== 'governor' && chance(.3)) setSubjLaw(n, t, 'rule', s.laws.rule === 'self' ? 'advisors' : 'governor');
    if (s.prog > 90 && nextTier(t) === 'int' && (t.rel[n.id] || 0) < SUBJ_PROG.rel && n.money > dipCost('improve') * 20 && chance(.08)) dipAct(n, t, 'improve'); }
}
