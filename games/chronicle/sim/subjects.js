/* Grand Chronicle — simulação: súditos (fantoche, vassalo, protetorado, domínio e união pessoal).
   n.senior = suserano; n.subj = { tier, lib, laws, integ, t }. A liberdade (lib) é uma barra de 0 a 100:
   0% = integrado (o súdito é anexado em paz se o suserano estiver integrando), 100% = livre (o súdito rompe e declara independência).
   A barra anda até 1,5 ponto por mês em direção ao alvo (libTarget), que depende do nível, das leis, da força, da relação e de cultura e fé. */
'use strict';

const isSubj = n => n.senior != null && !!n.subj;
const subjectsOf = id => S.nations.filter(j => j.alive && j.senior === id && j.subj);
function makeSubject(t, o, tier, skipW) {
  if (t.senior != null) freeSubject(t, false);
  t.senior = o.id; t.subj = { tier, lib: SUBJECTS[tier].base, laws: Object.assign({}, SUBJ_LAW_DEF), integ: false, t: S.t };
  link(t, o, 'allies'); t.rel[o.id] = Math.max(t.rel[o.id] || 0, -20);
  S.wars.filter(w => w !== skipW && sideOf(w, t.id) && sideOf(w, o.id) && sideOf(w, t.id) !== sideOf(w, o.id)).forEach(w => separatePeace(w, t.id, null, null));
}
function freeSubject(t, why) {
  const o = t.senior != null ? nat(t.senior) : null; delete t.senior; delete t.subj; delete t.unionT;
  if (o) { breakTies(t, o); if (why) log(natName(t) + ' ' + why + ' ' + natName(o) + '.', 'world', [t.id, o.id]); }
}
/* o que move a barra (positivo = quer liberdade); devolve [alvo, [rótulo, valor]...] */
function libParts(t) {
  const s = t.subj, o = nat(t.senior), T = SUBJECTS[s.tier], out = [['Nível: ' + T.n, T.base]];
  for (const k in SUBJ_LAWS) { const d = SUBJ_LAWS[k].o[s.laws[k]]; if (d && d.lib) out.push([SUBJ_LAWS[k].n + ': ' + d.n, d.lib]); }
  const st = strength(t), so = strength(o); out.push(['Força comparada', Math.round(40 * st / Math.max(1, st + so) - 15)]);
  out.push(['Relação com o suserano', -Math.round((t.rel[o.id] || 0) / 8)]);
  if (t.cul !== o.cul) out.push(['Cultura diferente', 8]); if (t.relig !== o.relig) out.push(['Fé diferente', 8]);
  if (o.stab < 30) out.push(['Suserano instável', 10]); if (warsOf(o.id).some(w => surrender(w, sideOf(w, o.id)) > .5)) out.push(['Suserano perdendo uma guerra', 10]);
  if (S.t - s.t < 360 * 10) out.push(['Laço recente', 8]);
  return out.filter(x => x[1]);
}
const libTarget = t => clamp(libParts(t).reduce((a, x) => a + x[1], 0), 0, 100);
const integOk = t => t.subj && t.subj.lib <= 50;            // "feliz": só integra quem está na metade de baixo da barra
const integCost = () => Math.round(6 * eraScale());          // por mês
const integRate = t => 1.5 * PEACE.integK * SUBJECTS[t.subj.tier].int * (SUBJ_LAWS.rule.o[t.subj.laws.rule].int || 1);
function setSubjLaw(o, t, k, v) { if (t.senior !== o.id || !SUBJ_LAWS[k] || !SUBJ_LAWS[k].o[v]) return 'Inválido'; if (t.subj.lawCd > S.t) return 'Mudança recente'; t.subj.laws[k] = v; t.subj.lawCd = S.t + 360; t.rel[o.id] = (t.rel[o.id] || 0) - 5; return ''; }
function setSubjTier(o, t, tier) {
  if (t.senior !== o.id || !SUBJECTS[tier] || tier === 'union' || t.subj.tier === 'union') return 'Inválido'; if (t.subj.tierCd > S.t) return 'Mudança recente';
  const up = SUBJECTS[tier].base < SUBJECTS[t.subj.tier].base; t.subj.tier = tier; t.subj.tierCd = S.t + 360 * 5; if (up) t.subj.lib = Math.min(100, t.subj.lib + 15); else t.subj.lib = Math.max(0, t.subj.lib - 5); return '';
}
function integrate(o, t) {                                     // fim da barra: anexação pacífica
  provsOf(t.id).forEach(p => { S.own[p] = o.id; S.ctrl[p] = o.id; }); S.armies.forEach(a => { if (a.o === t.id) a.o = o.id; }); S.fleets.forEach(f => { if (f.o === t.id) f.o = o.id; });
  o.money += Math.max(0, t.money); log(natName(t) + ' foi integrado a ' + natName(o) + '.', 'world', [t.id, o.id]); freeSubject(t, null); ownChanged(); checkDead();
}
function independence(t) {
  const o = nat(t.senior), tier = t.subj.tier; freeSubject(t, tier === 'union' ? 'rompeu a união pessoal com' : 'declarou independência de');
  if (tier === 'union') { succeed(t, false); return; }
  if (o.alive && !atWar(t.id, o.id)) { t.truce[o.id] = 0; declareWar(t, o, null); }
  if (isHuman(t.id) || isHuman(o.id)) notifyAll('🏴 Independência', natName(t) + ' rompeu com ' + natName(o) + '.');
}
/* mensal: tributo, contingentes, barra de liberdade, integração e independência */
function subjectsTick() {
  for (const t of S.nations) {
    if (!t.alive || t.senior == null) continue;
    if (!t.subj) t.subj = { tier: 'union', lib: 30, laws: Object.assign({}, SUBJ_LAW_DEF), integ: false, t: t.unionT || S.t };   // saves antigos: união pessoal
    const o = nat(t.senior); if (!o.alive) { freeSubject(t, null); continue; }
    const s = t.subj, T = SUBJECTS[s.tier], L = s.laws;
    const tri = Math.max(0, (t.inc && t.inc.tax) || 0) * T.tri * SUBJ_LAWS.tribute.o[L.tribute].tri;
    if (tri > 0) { t.money -= tri; o.money += tri; t.inc.tribute = -tri; t.income -= tri; o.inc.tribute = (o.inc.tribute || 0) + tri; o.income += tri; }
    const mp = SUBJ_LAWS.army.o[L.army].mp || 0; if (mp && t.manpower > 1) { const k = t.manpower * mp * .1; t.manpower -= k; o.manpower += k; }
    const tg = libTarget(t); s.tg = tg; s.lib = clamp(s.lib + clamp(tg - s.lib, -1.5, 1.5), 0, 100);
    if (s.integ) { if (!integOk(t) || o.money < integCost()) s.integ = false; else { o.money -= integCost(); s.lib = Math.max(0, s.lib - integRate(t)); if (s.lib <= 0) { integrate(o, t); continue; } } }
    if (s.lib >= 100 && chance(.3)) independence(t);
  }
}
/* IA como suserana: leis pela personalidade e integra quem está feliz */
function aiSubjects(n) {
  const P = personality(n);
  for (const t of subjectsOf(n.id)) { const s = t.subj;
    if (s.lib > 75 && s.laws.tribute !== 'none') setSubjLaw(n, t, 'tribute', s.laws.tribute === 'heavy' ? 'normal' : 'none');
    else if (s.lib < 35 && s.laws.tribute === 'normal' && P.gold > 1) setSubjLaw(n, t, 'tribute', 'heavy');
    if (s.lib < 45 && s.laws.rule !== 'governor' && chance(.3)) setSubjLaw(n, t, 'rule', s.laws.rule === 'self' ? 'advisors' : 'governor');
    s.integ = integOk(t) && (n.ae || 0) < PEACE.aeBlock && n.money > integCost() * 24 && statesOf(n) + statesOf(t) <= domCap(n) * 1.1 + 1; }
}
