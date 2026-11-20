/* Grand Chronicle — simulação: fé com peso.
   Fé oficial (n.relig) dá a doutrina (S.faith, sorteada por partida em rollFaiths). Fervor (n.ferv, 0–100) anda até um alvo (templos, governante, lei, minorias, heresias, era).
   Fés organizadas têm chefe religioso com sede numa província (S.heads[fé].seat) e favor de cada país (n.fav): doações, investidura,
   excomunhão, guerra santa e cruzada. Reformas (REFORMS) dividem uma fé numa janela de anos onde o fervor está baixo. */
'use strict';

const relId = k => REL_IDS.indexOf(k);
const relName = r => RELIGIONS[REL_IDS[r]].e + ' ' + RELIGIONS[REL_IDS[r]].n;
const headOf = r => faithOf(r).head || null;
const holyName = r => faithOf(r).holy || 'Guerra santa';
function initHeads() {                                         // sede de cada fé organizada: capital do maior país que a segue
  S.heads = S.heads || {};
  for (const k in S.faith) { if (!S.faith[k].head || S.heads[k]) continue; const r = relId(k), ns = S.nations.filter(n => n.alive && n.relig === r);
    if (ns.length) { const big = ns.sort((a, b) => provsOf(b.id).length - provsOf(a.id).length)[0]; S.heads[k] = { seat: big.capital }; } }
}
const seatOf = r => (S.heads || {})[REL_IDS[r]] ? S.heads[REL_IDS[r]].seat : null;
const seatLost = r => { const s = seatOf(r); return s != null && S.own[s] >= 0 && nat(S.own[s]).relig !== r; };
/* o que puxa o fervor: [rótulo, valor] (soma = alvo) */
function fervParts(n) {
  const out = [['Base', 50]], rels = n.rels || {}, pt = Math.max(1, n.popT || 0); let minor = 0, here = 0;
  for (const r in rels) { if (+r === n.relig) continue; if (RELIGIONS[REL_IDS[r]].fict) here += rels[r]; else minor += rels[r]; }
  out.push(['Templos', (n.bsum || {}).ferv || 0]);
  if (n.ruler && n.ruler.tr.includes('zealous')) out.push(['Governante zeloso', 10]); if (n.ruler && n.ruler.tr.includes('cynical')) out.push(['Governante cínico', -10]);
  out.push(['Lei religiosa', { state: 10, tolerant: 0, free: -5, secular: -20 }[n.laws.relig] || 0]);
  out.push(['Outras fés', -Math.round(minor / pt * 40)]); out.push(['Heresias', -Math.round(here / pt * 60)]);
  if (n.excom) out.push(['Excomungado', -15]); if (seatLost(n.relig)) out.push(['Sede da fé em mãos infiéis', 10]);
  const sec = (hasT(n, 'soc_enlightenment') ? 5 : 0) + (hasT(n, 'soc_mass_media') ? 10 : 0) + (hasT(n, 'eco_internet') ? 10 : 0); if (sec) out.push(['Secularização da era', -sec]);
  return out.filter(x => x[1]);
}
const fervTarget = n => clamp(fervParts(n).reduce((a, x) => a + x[1], 0), 0, 100);
/* modificadores da fé (entram em MOD_SOURCES) */
function faithMods(n) {
  if (n.relig == null) return []; const f = faithOf(n.relig), out = [['Doutrina: ' + RELIGIONS[REL_IDS[n.relig]].n, f.doc]], v = (n.ferv ?? 50) - 50;
  if (Math.abs(v) >= 1) out.push(['Fervor ' + Math.round(n.ferv ?? 50) + '%', { stab: v / 500, manpower: v / 1000, research: -v / 1000 }]);
  if (n.excom) out.push(['Excomungado', { stab: -.1 }]);
  const rels = n.rels || {}, pt = Math.max(1, n.popT || 0), sh = (rels[n.relig] || 0) / pt;   // unidade da fé oficial e fés reconhecidas (FAITH_RULES)
  if (n.popT && Math.abs(sh - .5) > .02) out.push(['Fé oficial seguida por ' + Math.round(sh * 100) + '%', { stab: (sh - .5) * FAITH_RULES.unity }]);
  for (const r in n.rpol || {}) if (n.rpol[r] === 2 && +r !== n.relig) { const k = Math.min(FAITH_RULES.recogCap, (rels[r] || 0) / pt * FAITH_RULES.recog), F = faithOf(+r), m = {}; for (const x in F.doc || {}) m[x] = F.doc[x] * k; if (k > .005) out.push(['Fé reconhecida: ' + RELIGIONS[REL_IDS[r]].n, m]); }
  return out;
}
/* ---------- ações ---------- */
const donateCost = () => Math.round(FERV.donate * eraScale());
function faithAct(n, k, t) {
  const h = headOf(n.relig); n.fav = n.fav ?? 50;
  if (k !== 'holy' && !h) return 'Esta fé não tem chefe religioso';
  if (k === 'donate') { const c = donateCost(); if (n.money < c) return 'Sem dinheiro'; n.money -= c; n.fav = Math.min(100, n.fav + 10); return ''; }
  if (k === 'invest') { if (n.fav < FERV.invest) return 'Favor insuficiente (' + FERV.invest + ')'; if (n.investCd > S.t) return 'Investidura recente'; n.fav -= FERV.invest; n.investCd = S.t + 360 * 10; applyFx(n, { mod: { l: 'Investidura do ' + h[1].toLowerCase(), m: { stab: .05 }, mo: 120 } }); n.pres = Math.min(100, (n.pres ?? 50) + 5); return ''; }
  if (k === 'crusade') { if (n.fav < FERV.crusade) return 'Favor insuficiente (' + FERV.crusade + ')'; const e = holyWhy(n, t); if (e) return e; const de = declareWar(n, t, null, 'holy'); if (de) return de; n.fav -= FERV.crusade;
    const w = S.wars.find(x => sideOf(x, n.id) && sideOf(x, t.id)); if (w) S.nations.forEach(o => { if (o.alive && o.id !== n.id && o.relig === n.relig && (o.fav ?? 50) >= 50 && !sideOf(w, o.id) && !(o.truce[t.id] > S.t) && (o.rel[n.id] || 0) >= 0 && o.id !== S.player && chance(.5)) joinWar(w, o.id, 'A'); });
    log(holyName(n.relig) + ' convocada por ' + natName(n) + ' contra ' + natName(t) + '!', 'world', [n.id, t.id]); return ''; }
  return 'Inválido';
}
/* guerra santa: contra país de outra família de fé, vizinho ou dono da sede da sua fé */
function holyWhy(n, t) {
  if (!t || !t.alive || t.id === n.id) return 'Inválido'; if (docOpt(n.relig, 'plural').noHoly) return 'Fé pluralista não faz guerra santa'; if (faithOf(t.relig).grp === faithOf(n.relig).grp) return 'Mesma família de fé';
  if (n.truce[t.id] > S.t) return 'Trégua em vigor'; if (atWar(n.id, t.id)) return 'Já em guerra'; if (has(n, 'allies', t.id)) return 'São aliados';
  const s = seatOf(n.relig); if (!(neighbors(n).has(t.id) || (s != null && S.own[s] === t.id))) return 'Só contra vizinhos ou quem tem a sede da sua fé';
  return '';
}
/* ---------- mensal ---------- */
function faithTick() {
  initHeads(); const y = curYear();
  for (const n of S.nations) {
    if (!n.alive || n.relig == null) continue;
    n.ferv = n.ferv ?? 50; n.fav = n.fav ?? 50;
    const tg = fervTarget(n); n.fervT = tg; n.ferv = clamp(n.ferv + clamp(tg - n.ferv, -1, 1), 0, 100);
    if (!headOf(n.relig)) { n.excom = false; continue; }
    n.fav = clamp(n.fav + (n.fav < 50 ? .1 : -.05), 0, 100);   // o favor volta devagar ao meio
    if (!n.excom && n.fav < FERV.excom && chance(.05)) { n.excom = true; S.nations.forEach(o => { if (o.alive && o.relig === n.relig && o.id !== n.id) o.rel[n.id] = (o.rel[n.id] || 0) - 30; });
      log(headOf(n.relig)[1] + ' excomungou ' + natName(n) + '.', n.id === S.player ? 'bad' : 'world', [n.id]); notify(n.id, '⛔ Excomunhão', 'O ' + headOf(n.relig)[1].toLowerCase() + ' excomungou ' + natName(n) + '. Estabilidade −10% até recuperar o favor (' + FERV.lift + ').'); calcMods(n); }
    else if (n.excom && n.fav >= FERV.lift) { n.excom = false; log('A excomunhão de ' + natName(n) + ' foi suspensa.', n.id === S.player ? 'good' : 'none', [n.id]); calcMods(n); }
  }
  if (S.t % 360 === 0) reformTick(y);
}
/* reformas: começa onde o fervor está baixo; depois se espalha pelas províncias de fé antiga com fervor baixo */
function reformTick(y) {
  S.reforms = S.reforms || {};
  for (const R0 of REFORMS) {
    const st = S.reforms[R0.id]; if (y < R0.y[0]) continue;
    let from = st ? st.from : null, to = st ? st.to : null;
    if (!st) {                                                  // a maior fé organizada do continente principal se divide; nasce uma fé que ainda não tem povo
      const main = WD.conts.find(c => c.main).id, cnt = {}; S.nations.forEach(n => { if (n.alive && n.home === main && (n.ferv ?? 50) < R0.ferv && condOk(n, R0.when)) cnt[n.relig] = (cnt[n.relig] || 0) + provsOf(n.id).length * (headOf(n.relig) ? 2 : 1); });   // a fé com mais países prontos para romper (organizadas pesam mais)
      from = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; to = (S.reserveRel || []).find(i => !S.nations.some(n => n.alive && n.relig === i)); if (isNaN(from) || to == null) continue; }
    // focos: até 3 ao longo da janela, numa província populosa da fé antiga onde o país tem fervor baixo (o estado inteiro adere)
    if (y <= R0.y[1] && (!st || st.k < 3) && chance(st ? .06 : .15)) {
      const c = S.nations.filter(n => n.alive && n.relig === from && (n.ferv ?? 50) < R0.ferv && condOk(n, R0.when));
      if (c.length) { const n = c.sort((a, b) => (b.popT || 0) - (a.popT || 0))[rint(Math.min(3, c.length))], ps = provsOf(n.id).filter(p => S.relg[p] === from).sort((a, b) => S.pop[b] - S.pop[a]);
        if (ps.length) { const p0 = ps[rint(Math.min(5, ps.length))]; WD.states[WD.provs[p0].state].provs.forEach(p => { if (S.relg[p] === from) S.relg[p] = to; });
          S.reforms[R0.id] = { t: S.t, n: n.id, k: (st ? st.k : 0) + 1, from, to }; (n.evNext = n.evNext || []).push({ id: 'reform_arrives', t: S.t + 60 });
          log(R0.n + ': ' + relName(to) + ' surgiu em ' + WD.provs[p0].n + ' (' + natName(n) + '), rompendo com ' + RELIGIONS[REL_IDS[from]].n + '.', 'world', [n.id]); S.mapDirty = true; } } }
    if (!S.reforms[R0.id]) continue;
    if (y > R0.y[1] + 60) continue;
    const add = [];                                             // cada província reformada contagia vizinhas da fé antiga (mais onde o fervor é baixo)
    for (let p = 0; p < S.relg.length; p++) if (S.relg[p] === to) for (const q of WD.provs[p].adj) { const o = S.own[q]; if ((S.relg[q] === from || (o >= 0 && nat(o).relig === from && S.relg[q] !== to)) && chance(R0.sp * clamp((95 - (o >= 0 ? nat(o).ferv ?? 50 : 40)) / 40, 0, 1))) add.push(q); }
    add.forEach(q => S.relg[q] = to); if (add.length) S.mapDirty = true;
  }
}
/* IA: doa quando tem sobra, pede investidura, convoca guerra santa se zelosa e mais forte */
function aiFaith(n) {
  const h = headOf(n.relig), z = n.ruler.tr.includes('zealous');
  if (h && (n.fav ?? 50) < (z ? 60 : 35) && n.money > donateCost() * 6) faithAct(n, 'donate');
  if (h && (n.fav ?? 50) > 70 && !(n.investCd > S.t)) faithAct(n, 'invest');
  if (!warsOf(n.id).length && (z || (n.ferv ?? 50) > 70) && chance(.02)) {
    const t = [...neighbors(n)].map(nat).filter(t => !holyWhy(n, t) && strength(t) * 1.4 < strength(n))[0];
    if (t) { if (h && n.fav >= FERV.crusade && chance(.5)) faithAct(n, 'crusade', t); else declareWar(n, t, null, 'holy'); }
  }
}
