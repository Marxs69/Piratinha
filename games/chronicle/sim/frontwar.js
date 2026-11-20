/* Grand Chronicle — simulação: guerra de front (Victoria 3).
   Exércitos atribuídos a um front viajam até a linha e ficam nela (não andam pelo mapa). Quem tem ordem de atacar
   (postura agressiva, ou equilibrada com o front em "avançar") abre uma batalha de front: todos os exércitos do lado naquele front
   contra todos os do inimigo nos fronts que encostam nele, numa província-alvo da linha inimiga. Vencer ocupa províncias do estado-alvo
   (mais quanto maior a vitória); sem defensores, a ocupação anda sozinha, mais devagar onde há fortificação. */
'use strict';

const FB = { winCd: 12, loseCd: 30, occDays: 25, aiEdge: 1.1, keep: 10 };
const frontReady = a => a.front != null && !(a.fready > S.t) && regs(a) > .1 && !a.inv && !a.exp;
const frontCenter = f => { const xs = f.provs.map(p => WD.provs[p]), cx = xs.reduce((s, p) => s + p.cx, 0) / xs.length, cy = xs.reduce((s, p) => s + p.cy, 0) / xs.length; return f.provs.slice().sort((a, b) => Math.hypot(WD.provs[a].cx - cx, WD.provs[a].cy - cy) - Math.hypot(WD.provs[b].cx - cx, WD.provs[b].cy - cy))[0]; };
/* chegada ao front: viaja (dias pela distância e pelo passo da tropa mais lenta) e fica na província central da linha */
function frontPlace() {
  for (const a of S.armies) {
    if (a.front == null || a.inv || a.exp) { a.fp = null; continue; }
    const f = frontById(a.front); if (!f) { a.front = null; a.fp = null; continue; }
    if (a.fp !== a.front) { const c = frontCenter(f), o = WD.provs[a.p < WD.provs.length ? a.p : nat(a.o).capital], t = WD.provs[c];
      a.fready = S.t + Math.round(Math.hypot(o.cx - t.cx, o.cy - t.cy) / 3 / armySpeed(a)); a.fp = a.front; a.p = c; a.path = []; a.retreat = false; a.arr = S.t; }
    else if (!f.provs.includes(a.p)) a.p = frontCenter(f);    // a linha andou: acompanha
  }
}
/* fronts inimigos que encostam neste (dividem a linha de contato) */
const facingFronts0 = f => (S.fronts || []).filter(g => g.w === f.w && g.side !== f.side && g.provs.some(p => f.foe.includes(p)));
/* quem defende: os fronts inimigos que encostam neste e todos os fronts ligados a eles pela linha (a linha contínua se defende junta) */
function facingFronts(f) {
  const out = facingFronts0(f), seen = new Set(out.map(g => g.id)), all = (S.fronts || []).filter(g => g.w === f.w && g.side !== f.side);
  for (let i = 0; i < out.length; i++) { const ps = new Set(out[i].provs.flatMap(p => WD.provs[p].adj)); for (const g of all) if (!seen.has(g.id) && g.provs.some(p => ps.has(p))) { seen.add(g.id); out.push(g); } }
  return out;
}
const onFront = (byF, f) => byF.get(f.id) || [];
const wantsAttack = (a, f) => (STANCES[stanceOf(a)].act || fordOf(a.o, f.id)) === 'adv';
const fbLog = (B, m) => { B.ev.push(dateStr() + ' · ' + m); if (B.ev.length > 8) B.ev.shift(); };
function frontBattleTick() {
  S.fbat = S.fbat || {}; S.fcd = S.fcd || {}; S.fbHist = S.fbHist || [];
  const byF = new Map(); for (const a of S.armies) if (frontReady(a)) { if (!byF.has(a.front)) byF.set(a.front, []); byF.get(a.front).push(a); }
  for (const id in S.fbat) if (!frontById(+id)) delete S.fbat[id];
  for (const f of S.fronts || []) {
    if (!S.wars.some(w => w.id === f.w)) continue;              // a guerra acabou neste mesmo dia
    const att = onFront(byF, f); let B = S.fbat[f.id];
    const defs = facingFronts(f).flatMap(g => onFront(byF, g)).concat(S.armies.filter(a => f.foe.includes(a.p) && a.front == null && !a.inv && atWarSide(f, a.o)));
    if (!B) {
      if (!att.length || (S.fcd[f.id] || 0) > S.t || !att.some(a => wantsAttack(a, f))) continue;
      const ep = enemyPower(att[0].o), pa = att.reduce((s, a) => s + armyPower(a), 0), pd = defs.reduce((s, a) => s + armyPower(a), 0);
      if (att.every(a => a.o !== S.player) && pd && pa < pd * FB.aiEdge) continue;   // a IA só ataca com vantagem
      const q = f.foe.slice().sort((x, y) => ((ep.get(x) || 0) + fortOf(x) * 3) - ((ep.get(y) || 0) + fortOf(y) * 3))[0]; if (q == null) continue;
      B = S.fbat[f.id] = { f: f.id, w: f.w, side: f.side, q, t0: S.t, prog: 0, ev: [], a: att[0].o, d: defs.length ? defs[0].o : S.ctrl[q] };
      fbLog(B, 'Ataque a ' + WD.provs[q].n + ' (' + Math.round(pa) + ' × ' + Math.round(pd) + ')');
      if (att.concat(defs).some(a => a.o === S.player)) log('Batalha de front em ' + WD.provs[q].n + '.', 'info', [S.player]);
    }
    if (!att.length || !f.foe.includes(B.q)) { endFront(B, f, null, 'A ofensiva parou'); continue; }
    if (!defs.length) {                                         // sem defensores: a ocupação avança
      const pa = att.reduce((s, a) => s + armyPower(a), 0); B.prog += Math.min(3, Math.max(.5, pa / 10)) / (FB.occDays * Math.pow(1 + fortOf(B.q), 1.5));
      if (B.prog >= 1) { const took = capture(f, B.q, 1, att); fbLog(B, 'Ocupou ' + took + ' província' + (took > 1 ? 's' : '') + ' sem resistência'); endFront(B, f, true, null); }
      continue;
    }
    battleDay(B.q, att, defs); const bt = S.battles[B.q];
    if (bt) { bt.fb = f.id; if (bt.d % 3 === 1) fbLog(B, 'Dia ' + bt.d + ' · ' + (bt.ph === 'fire' ? 'fogo' : 'choque') + ' · dados ' + bt.ra + '×' + bt.rb); continue; }
    // terminou: quem ficou de pé venceu
    const ok = l => l.some(a => regs(a) > .3 && a.mor >= .08), aw = ok(att) && !ok(defs);
    [...att, ...defs].forEach(a => { a.path = []; a.retreat = false; a.sh = 0; });   // no front ninguém foge do mapa: o perdedor fica na linha, abatido
    if (aw) { const pa = att.reduce((s, a) => s + regs(a), 0), pd = defs.reduce((s, a) => s + regs(a), 0) + .5, k = 1 + Math.min(4, Math.floor(pa / pd)); const took = capture(f, B.q, k, att); fbLog(B, 'Vitória: ' + took + ' província' + (took > 1 ? 's' : '') + ' ocupada' + (took > 1 ? 's' : '')); endFront(B, f, true, null); }
    else { fbLog(B, 'Derrota: o ataque foi repelido'); endFront(B, f, false, null); }
  }
}
const atWarSide = (f, o) => { const w = S.wars.find(x => x.id === f.w); return !!w && (f.side === 'A' ? w.D : w.A).includes(o); };
/* ocupa a província-alvo e outras do mesmo estado que o inimigo controla (até k), a partir das que encostam no que já é seu */
function capture(f, q, k, att) {
  const lead = att.slice().sort((x, y) => regs(y) - regs(x))[0].o, w = S.wars.find(x => x.id === f.w), foe = new Set(f.side === 'A' ? w.D : w.A), st = WD.provs[q].state, took = [q];
  const q2 = [q]; for (let h = 0; h < q2.length && took.length < k; h++) for (const v of WD.provs[q2[h]].adj) if (took.length < k && WD.provs[v].state === st && foe.has(S.ctrl[v]) && !took.includes(v)) { took.push(v); q2.push(v); }
  took.forEach(p => { S.ctrl[p] = lead; delete S.sieges[p]; }); S.mapDirty = true; ownChanged(); return took.length;
}
function endFront(B, f, won, why) {
  if (why) fbLog(B, why);
  S.fcd[f.id] = S.t + (won === false ? FB.loseCd : FB.winCd);
  S.fbHist.unshift({ q: B.q, f: f.id, w: B.w, side: B.side, a: B.a, d: B.d, won, t0: B.t0, t1: S.t, ev: B.ev.slice() }); if (S.fbHist.length > 20) S.fbHist.pop();
  delete S.fbat[f.id]; delete S.battles[B.q];
}
/* resumo de uma batalha para tooltips */
function fbTip(B) {
  const f = frontById(B.f), bt = S.battles[B.q], A = nat(B.a), D = B.d >= 0 ? nat(B.d) : null;
  return '⚔️ ' + WD.provs[B.q].n + (f ? ' · ' + frontName(f) : '') + '\n' + natName(A) + ' ataca' + (D ? ' ' + natName(D) : '') + '\n' + (bt ? 'Dia ' + bt.d + ' · fase de ' + (bt.ph === 'fire' ? 'fogo' : 'choque') + ' · dados ' + bt.ra + ' × ' + bt.rb + ' (com bônus ' + (+bt.pa || 0).toFixed(1) + ' × ' + (+bt.pb || 0).toFixed(1) + ')' : 'Ocupação sem resistência: ' + Math.round(B.prog * 100) + '%') + '\n' + B.ev.join('\n');
}
