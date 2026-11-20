/* Grand Chronicle — simulação: rendição e tratados de paz (base: EU4).
   A rendição é de cada país: o que perdeu de território (pela população), de tropas e a capital. Tudo ocupado = 100%.
   Os pontos contra um país são a rendição dele (0–100). Os termos custam pontos proporcionais ao tamanho DESSE país:
   tomar tudo de um país totalmente ocupado custa exatamente 100. Termos: províncias, vassalagem (por nível) e reparações. */
'use strict';

const natVal = id => provsOf(id).reduce((s, p) => s + S.pop[p] + 1, 0);
const sideIds = (w, side) => side === 'A' ? w.A : w.D;
const foesIn = (w, id) => sideOf(w, id) === 'A' ? w.D : w.A;
const leaderOf = (w, side) => side === 'A' ? w.a : w.d;
function surrenderOf(w, id) {
  const foes = foesIn(w, id), n = nat(id); let tot = 0, occ = 0;
  for (const p of provsOf(id)) { const v = S.pop[p] + 1; tot += v; if (foes.includes(S.ctrl[p])) occ += v; }
  if (!tot || occ >= tot - 1e-6) return 1;                     // nada mais sob seu controle: capitula
  const lost = (w.loss || {})[id] || 0, now = S.armies.reduce((s, a) => s + (a.o === id ? regs(a) : 0), 0);
  const cap = n.alive && foes.includes(S.ctrl[n.capital]) ? .25 : 0;
  return clamp(occ / tot * .75 + lost / (lost + now + 1) * .35 + cap, 0, 1);
}
/* rendição de um lado: o líder pesa sozinho (se ele cai, o lado cai); senão, a média dos países pelo tamanho */
function surrender(w, side) {
  const ids = sideIds(w, side); let a = 0, t = 0; for (const id of ids) { const v = natVal(id); a += surrenderOf(w, id) * v; t += v; }
  return Math.max(surrenderOf(w, leaderOf(w, side)), t ? a / t : 0);
}
function warScore(w) { return Math.round((surrender(w, 'D') - surrender(w, 'A')) * 100); }   // positivo = lado atacante vencendo
const warPointsVs = (w, L) => Math.round(surrenderOf(w, L) * 100);
/* contribuição de cada vencedor contra um país (ocupação dele), para dividir os pontos entre aliados */
function contribVs(w, id, L) { let s = 0; for (const p of provsOf(L)) if (S.ctrl[p] === id) s += S.pop[p] + 1; return s; }

/* ---------- preços ---------- */
const provShare = p => (S.pop[p] + 1) / Math.max(1, natVal(S.own[p])) * 100;   // parte do país (soma 100 por país)
function provPrice(w, picker, p) {
  const mine = sideIds(w, sideOf(w, picker));
  return provShare(p) * (mine.includes(S.ctrl[p]) ? 1 : 1.5) * (nat(picker).claims[WD.provs[p].state] ? .75 : 1);
}
const REP = { cost: 10, years: 10, share: .15 };                 // reparações: 15% dos impostos do perdedor por 10 anos
/* termos t = { provs: [], subj: nível ou null, rep: bool } contra o país L */
function termsCost(w, picker, L, t) {
  let c = 0, taken = 0; for (const p of t.provs) { c += provPrice(w, picker, p); taken += provShare(p); }
  if (t.subj) c += SUBJECTS[t.subj].cost * Math.max(0, 100 - taken);
  if (t.rep) c += REP.cost;
  return Math.round(c);
}
function termsWhy(w, picker, L, t) {
  const n = nat(picker), budget = warPointsVs(w, L), c = termsCost(w, picker, L, t);
  if (t.subj && t.provs.length >= provsOf(L).length) return 'Não sobra nada para virar súdito';
  if (t.subj && !SUBJECTS[t.subj].cost) return 'Esse vínculo não se impõe na paz';
  if (t.subj && nat(L).senior != null) return 'Já é súdito de outro país';
  if (c > budget) return 'Faltam pontos: custa ' + c + ', a rendição deles vale ' + budget;
  if (provsOf(L).length > PEACE.annexProvs && t.provs.reduce((s, p) => s + provShare(p), 0) > PEACE.maxShare + 1e-6) return 'Um tratado leva no máximo ' + PEACE.maxShare + '% do país (pela população)';
  if (t.provs.length && statesOf(n, t.provs) > domCap(n) * 1.1 + 1) return 'Seu título não sustenta tantos estados (limite ' + domCap(n) + ')';
  return '';
}

/* ---------- aplicar ---------- */
function applyTerms(w, winner, L, t) {
  const ln = nat(L), wn = nat(winner), parts = [];
  if (t.provs.length) { const sh = t.provs.reduce((s, p) => s + provShare(p), 0), ae = sh * PEACE.ae;   // expansão agressiva: os vizinhos desconfiam
    wn.ae = (wn.ae || 0) + ae; neighbors0(wn).forEach(id => { const x = nat(id); if (x && x.alive && id !== L) x.rel[winner] = clamp((x.rel[winner] || 0) - ae * PEACE.aeRel, -100, 100); });
    t.provs.forEach(p => { S.own[p] = winner; S.ctrl[p] = winner; }); parts.push(t.provs.length + ' província' + (t.provs.length > 1 ? 's' : '')); }
  if (t.rep) { ln.rep = { to: winner, until: S.t + 360 * REP.years }; parts.push('reparações por ' + REP.years + ' anos'); }
  ownChanged(); checkDead();
  if (t.subj && ln.alive) { makeSubject(ln, wn, t.subj, w); parts.push('vira ' + SUBJECTS[t.subj].n.toLowerCase()); }
  return parts;
}
/* sai da guerra só o país L (ou a guerra inteira, se L for líder de um lado) */
function separatePeace(w, L, winner, t) {
  const sd = sideOf(w, L); if (!sd) return;
  const all = [...w.A, ...w.D], lead = leaderOf(w, sd) === L, ln = natName(nat(L));
  let parts = []; if (winner != null && t) parts = applyTerms(w, winner, L, t);
  if (winner != null) { addPres(nat(winner), 10); addPres(nat(L), -10); }
  if (winner != null && w.holy != null) sideIds(w, sideOf(w, winner)).forEach(id => { const x = nat(id); if (x.relig === w.holy) { x.ferv = Math.min(100, (x.ferv ?? 50) + 15); x.fav = Math.min(100, (x.fav ?? 50) + 15); } });   // vitória na guerra santa
  const leaving = lead ? all : [L], enemies = lead ? [] : foesIn(w, L);
  // tréguas e devolução das ocupações entre quem sai e o outro lado
  const pairs = lead ? w.A.flatMap(x => w.D.map(y => [x, y])) : enemies.map(y => [L, y]);
  pairs.forEach(([x, y]) => { if (nat(x).alive && nat(y).alive) { nat(x).truce[y] = S.t + 360 * PEACE.truce; nat(y).truce[x] = S.t + 360 * PEACE.truce; } });
  for (let p = 0; p < S.own.length; p++) { const o = S.own[p], c = S.ctrl[p]; if (o < 0 || c < 0 || o === c) continue; if (pairs.some(([x, y]) => (o === x && c === y) || (o === y && c === x))) S.ctrl[p] = o; }
  if (lead) {
    // os outros perdedores: se o lado capitulou, os vencedores (IA) tomam o que os pontos deles pagam; senão, paz branca
    const winSide = sd === 'A' ? 'D' : 'A', capit = winner != null && surrender(w, sd) >= 1;
    if (capit) for (const L2 of sideIds(w, sd)) { if (L2 === L || !nat(L2).alive) continue;
      const tot = sideIds(w, winSide).reduce((s, id) => s + contribVs(w, id, L2), 0), budget = warPointsVs(w, L2), taken = new Set();
      for (const id of sideIds(w, winSide)) { if (isHuman(id) || !tot) continue; const b = budget * contribVs(w, id, L2) / tot; if (b < 3) continue; const tt = aiTerms(w, id, L2, b, taken); if (tt.provs.length || tt.subj || tt.rep) applyTerms(w, id, L2, tt); } }
    S.wars = S.wars.filter(x => x !== w);
  } else { w.A = w.A.filter(x => x !== L); w.D = w.D.filter(x => x !== L); if (!w.A.length || !w.D.length) S.wars = S.wars.filter(x => x !== w); }
  warsChanged(); ownChanged(); checkDead(); S.fronts = (S.fronts || []).filter(f => S.wars.some(x => x.id === f.w)); S.armies.forEach(a => { if (a.front != null && !S.fronts.some(f => f.id === a.front)) a.front = null; });
  S.armies.forEach(a => { if (leaving.includes(a.o) && a.p < WD.provs.length && S.own[a.p] !== a.o && nat(a.o).alive && !a.inv) goHome(a); });   // tropas em terra estrangeira marcham de volta ao estado próprio mais perto
  const wn = winner != null ? natName(nat(winner)) : null;
  const txt = winner == null ? (lead ? 'Paz branca entre ' + natName(nat(w.a)) + ' e ' + natName(nat(w.d)) + '.' : ln + ' saiu da guerra (paz branca).')
    : wn + ' impôs a paz a ' + ln + (parts.length ? ': ' + parts.join(', ') : '') + '.';
  log(txt, all.includes(S.player) ? (isHuman(winner) || (winner != null && sideOf(w, winner) === sideOf(w, S.player) && !isHuman(L)) ? 'good' : winner == null ? 'info' : 'bad') : 'world', all);
}
/* compatibilidade: paz da guerra toda (vencedor = líder) */
function makePeace(w, winner, provs) { const L = winner == null ? w.d : (winner === w.a ? w.d : w.a); separatePeace(w, L, winner, winner == null ? null : { provs: provs || [], subj: null, rep: false }); }

/* ---------- IA ---------- */
/* o que a IA pede de L com o orçamento: reivindicações, vizinhas e ocupadas primeiro; se não cabe tudo, vassalo; o que sobrar vira reparações */
function aiTerms(w, picker, L, budget, taken = new Set()) {
  const n = nat(picker), t = { provs: [], subj: null, rep: false };
  const cands = provsOf(L).filter(p => !taken.has(p)).map(p => [p, (n.claims[WD.provs[p].state] ? 50 : 0) + (WD.provs[p].adj.some(o => S.own[o] === picker) ? 20 : 0) + (S.ctrl[p] === picker ? 30 : 0) + rnd() * 5]).sort((a, b) => b[1] - a[1]);
  let left = budget;
  const capS = provsOf(L).length > PEACE.annexProvs ? PEACE.maxShare : 100; let share = 0;   // teto por tratado (PEACE)
  for (const [p] of cands) { const c = provPrice(w, picker, p), sh = provShare(p); if (c > left || share + sh > capS + 1e-6) continue; share += sh; if (statesOf(n, t.provs.concat(p)) > domCap(n) * 1.1 + 1) continue; t.provs.push(p); taken.add(p); left -= c; }
  if (t.provs.length < provsOf(L).length && nat(L).senior == null) { const rest = 100 - t.provs.reduce((s, p) => s + provShare(p), 0);
    for (const k of ['puppet', 'vassal', 'protect']) if (SUBJECTS[k].cost * rest <= left && (personality(n).war > 1 || rest < 60)) { t.subj = k; left -= SUBJECTS[k].cost * rest; break; } }
  if (left >= REP.cost && !t.subj) t.rep = true;
  return t;
}
function aiPeace(w) {
  const sA = surrender(w, 'A'), sD = surrender(w, 'D'); w.score = Math.round((sD - sA) * 100);
  const months = (S.t - w.start) / 30, human = [...w.A, ...w.D].some(isHuman);
  // participantes totalmente ocupados (não líderes): o líder do outro lado impõe uma paz separada
  for (const id of [...w.A, ...w.D]) {
    const sd = sideOf(w, id); if (!sd || leaderOf(w, sd) === id || surrenderOf(w, id) < 1) continue;
    const wl = leaderOf(w, sd === 'A' ? 'D' : 'A');
    if (isHuman(wl)) { if (!S.conf) S.conf = { w: w.id, L: id, to: wl }; continue; }
    const t = aiTerms(w, wl, id, warPointsVs(w, id));
    if (isHuman(id)) notifyAll('🏳️ Capitulação', 'Seu país foi totalmente ocupado e teve de aceitar a paz de ' + natName(nat(wl)) + '.');
    separatePeace(w, id, wl, t); if (!S.wars.includes(w)) return;
  }
  const loseSide = sD >= sA ? 'D' : 'A', winSide = loseSide === 'A' ? 'D' : 'A', sl = Math.max(sA, sD), winLead = leaderOf(w, winSide), L = leaderOf(w, loseSide);
  if (sl >= 1 || (months >= 8 && sl >= .6 && chance(.12))) {           // capitulação ou derrota clara do líder
    if (isHuman(winLead)) { if (!S.conf && sl >= 1) S.conf = { w: w.id, L, to: winLead }; return; }
    const t = aiTerms(w, winLead, L, warPointsVs(w, L));
    if (isHuman(L) && sl < 1) { if (!S.offer) S.offer = { w: w.id, winner: winLead, L, t, to: L }; return; }
    if (isHuman(L)) notifyAll('🏳️ Capitulação', 'Seu lado capitulou e teve de aceitar os termos de ' + natName(nat(winLead)) + '.');
    separatePeace(w, L, winLead, t); return;
  }
  if (months > 12 * 7 && sl < .3 && chance(.05)) { if (!human) separatePeace(w, w.d, null, null); else if (!S.offer && (isHuman(w.a) || isHuman(w.d))) S.offer = { w: w.id, winner: null, L: isHuman(w.a) ? w.d : w.a, t: null, to: isHuman(w.a) ? w.a : w.d }; }
}
/* jogador: impõe a paz a L (separada, se L não for líder) ou pede paz branca */
function proposePeace(w, L, t, pid = S.player) {
  const me = pid, mySide = sideOf(w, me); if (!mySide || sideOf(w, L) === mySide) return 'Inválido';
  if (leaderOf(w, sideOf(w, L)) === L && leaderOf(w, mySide) !== me) return 'Só o líder da guerra negocia com o líder inimigo';
  const empty = !t || (!t.provs.length && !t.subj && !t.rep);
  if (empty) { const ok = surrender(w, mySide) < .5 && (surrenderOf(w, L) >= .2 || S.t - w.start > 360 * 4); if (!ok) return 'Recusada: eles acham que estão vencendo'; separatePeace(w, L, null, null); return ''; }
  const why = termsWhy(w, me, L, t); if (why) return why;
  separatePeace(w, L, me, t); return '';
}
/* reparações: todo mês uma parte dos impostos do perdedor vai para o vencedor */
function reparationsTick() {
  for (const n of S.nations) { const r = n.rep; if (!r) continue; if (!n.alive || S.t > r.until || !nat(r.to).alive) { delete n.rep; continue; }
    const v = Math.max(0, (n.inc && n.inc.tax) || 0) * REP.share; n.money -= v; nat(r.to).money += v; n.inc.rep = -v; n.income -= v; const o = nat(r.to); o.inc.rep = (o.inc.rep || 0) + v; o.income += v; }
}
