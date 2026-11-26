/* Grand Chronicle — simulação: guerra de front (Victoria 3).
   Exércitos atribuídos a um front viajam até a linha e ficam nela (não andam pelo mapa). Quem tem ordem de atacar
   (postura agressiva, ou equilibrada com o front em "avançar") abre uma batalha de front: todos os exércitos do lado naquele front
   contra todos os do inimigo nos fronts que encostam nele, numa província-alvo da linha inimiga. Vencer ocupa províncias do estado-alvo
   (mais quanto maior a vitória); sem defensores, a ocupação anda sozinha, mais devagar onde há fortificação. */
'use strict';

const FB = { winCd: 12, loseCd: 30, occDays: 25, aiEdge: AI_FRONT.aiEdge, keep: 10 };   // aiEdge em content/military.js (AI_FRONT)
const FBSTAT = { started: 0, blocked: 0, waitBusy: 0, stolen: 0, freeOcc: 0 };   // contadores para medição (fora do save); blocked conta 1× por front-mês
let FB_RSV = null; const FB_BLK = new Map();                 // atacantes reservados às batalhas abertas no dia; último mês em que cada front contou bloqueio
const frontReady = a => a.front != null && a.fp === a.front && !(a.fready > S.t) && regs(a) > .1 && !a.inv && !a.exp;
/* front sem caminho para este exército (fica marcado por 3 meses para ninguém insistir) */
const frontBlocked = (a, f) => !!a.fno && a.fno.f === f.id && a.fno.t > S.t;
const frontCenter = f => { const xs = f.provs.map(p => WD.provs[p]), cx = xs.reduce((s, p) => s + p.cx, 0) / xs.length, cy = xs.reduce((s, p) => s + p.cy, 0) / xs.length; return f.provs.slice().sort((a, b) => Math.hypot(WD.provs[a].cx - cx, WD.provs[a].cy - cy) - Math.hypot(WD.provs[b].cx - cx, WD.provs[b].cy - cy))[0]; };
/* chegada ao front: o exército marcha (por terra, ou travessia curta de mar livre) até a linha e só então fica nela; sem caminho, sai do front */
function frontPlace() {
  const P = WD.provs.length;
  for (const a of S.armies) {
    if (a.front == null || a.inv || a.exp) { a.fp = null; continue; }
    const f = frontById(a.front); if (!f) { a.front = null; a.fp = null; continue; }
    if (a.p >= P) continue;
    if (a.fp === a.front) {                                     // já na linha: a linha andou, acompanha pela vizinha (ou volta a marchar)
      if (!f.provs.includes(a.p)) { const q = WD.provs[a.p].adj.find(x => f.provs.includes(x)); if (q != null) { a.p = q; a.arr = S.t; } else a.fp = null; }
      continue;
    }
    if (f.provs.includes(a.p)) { a.fp = a.front; a.fready = 0; a.path = []; a.retreat = false; a.arr = S.t; continue; }
    if (a.inBattle || a.retreat) continue;
    const end = a.path[a.path.length - 1];
    if (!a.path.length || !f.provs.includes(end)) {
      const c = frontCenter(f);
      if (!orderArmy(a, c, true) && !orderArmy(a, c)) { a.fno = { f: f.id, t: S.t + 90 }; if (isHuman(a.o)) log('Sem caminho até o ' + frontName(f) + ': o exército ficou fora do front.', 'bad', [a.o]); a.front = null; a.fp = null; continue; }
    }
    a.fready = S.t + Math.max(1, Math.round(a.path.length * 7 / armySpeed(a)) - a.prog);
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
/* batalha simétrica e local: o alvo q (província inimiga mais fraca da linha) e quem defende q — os exércitos dos fronts inimigos
   que tocam o estado de q (ou, se nenhum, os que encostam neste front) e os inimigos soltos dentro desse estado.
   Cada exército luta no máximo uma batalha de front por dia (a.fbd). A IA usa a mesma conta para decidir avançar (frontDefense). */
function frontTarget(f, o) { const ep = enemyPower(o); return f.foe.slice().sort((x, y) => ((ep.get(x) || 0) + fortOf(x) * 3) - ((ep.get(y) || 0) + fortOf(y) * 3))[0]; }
function frontDefs(f, q, busy) {   // busy = conta também quem já lutou hoje ou ataca noutra batalha (há defensor presente?)
  const st = WD.provs[q].state, near = p => WD.provs[p].state === st || p === q || WD.provs[p].adj.includes(q), fac = facingFronts0(f);
  let gs = fac.filter(g => g.provs.some(near)); if (!gs.length) gs = fac; const ids = new Set(gs.map(g => g.id));
  return S.armies.filter(a => (busy || (a.fbd !== S.t && !(FB_RSV && FB_RSV.has(a) && FB_RSV.get(a) !== f.id))) && ((frontReady(a) && ids.has(a.front)) || (a.front == null && !a.inv && a.p < WD.provs.length && WD.provs[a.p].state === st && atWarSide(f, a.o))));
}
const frontDefense = (f, o) => { const q = frontTarget(f, o); return q == null ? 0 : frontDefs(f, q).reduce((s, a) => s + armyPower(a), 0); };
const wantsAttack = (a, f) => (STANCES[stanceOf(a)].act || fordOf(a.o, f.id)) === 'adv';
const fbLog = (B, m) => { B.ev.push(dateStr() + ' · ' + m); if (B.ev.length > 8) B.ev.shift(); };
function frontBattleTick() {
  S.fbat = S.fbat || {}; S.fcd = S.fcd || {}; S.fbHist = S.fbHist || [];
  const byF = new Map(); for (const a of S.armies) if (frontReady(a) && a.fbd !== S.t) { if (!byF.has(a.front)) byF.set(a.front, []); byF.get(a.front).push(a); }
  for (const id in S.fbat) if (!frontById(+id)) delete S.fbat[id];
  // batalhas abertas primeiro, e seus atacantes reservados: quem ataca numa não é puxado para defender noutra
  FB_RSV = new Map(); for (const f of S.fronts || []) if (S.fbat[f.id] && S.wars.some(w => w.id === f.w)) for (const a of onFront(byF, f)) FB_RSV.set(a, f.id);
  const fr = S.fronts || [], order = fr.filter(f => S.fbat[f.id]).concat(fr.filter(f => !S.fbat[f.id]));
  for (const f of order) {
    if (!S.wars.some(w => w.id === f.w)) continue;              // a guerra acabou neste mesmo dia
    const att = onFront(byF, f).filter(a => a.fbd !== S.t); let B = S.fbat[f.id], defs;
    if (!B) {
      if (!att.length || (S.fcd[f.id] || 0) > S.t || !att.some(a => wantsAttack(a, f))) continue;
      const q = frontTarget(f, att[0].o); if (q == null) continue;
      defs = frontDefs(f, q); if (!defs.length && frontDefs(f, q, true).length) continue;   // defensor presente, mas lutando noutra batalha: não abre hoje
      const pa = att.reduce((s, a) => s + armyPower(a), 0), pd = defs.reduce((s, a) => s + armyPower(a), 0);
      if (att.every(a => !isHuman(a.o)) && pd && pa < pd * FB.aiEdge) { const m = S.t / 30 | 0; if (FB_BLK.get(f.id) !== m) { FB_BLK.set(f.id, m); FBSTAT.blocked++; } continue; }   // a IA só ataca com vantagem (a mesma conta de frontDefense)
      B = S.fbat[f.id] = { f: f.id, w: f.w, side: f.side, q, t0: S.t, prog: 0, ev: [], a: att[0].o, d: defs.length ? defs[0].o : S.ctrl[q], pa0: pa, pd0: pd }; FBSTAT.started++;
      fbLog(B, 'Ataque a ' + WD.provs[q].n + ' (' + Math.round(pa) + ' × ' + Math.round(pd) + ')');
      if (att.concat(defs).some(a => isHuman(a.o))) log('Batalha de front em ' + WD.provs[q].n + '.', 'info', [S.player]);
    }
    if (!att.length && f.foe.includes(B.q) && S.armies.some(a => a.front === f.id && a.fbd === S.t)) FBSTAT.stolen++;   // atacante puxado para outra batalha no mesmo dia (não deve acontecer)
    if (!att.length || !f.foe.includes(B.q)) { endFront(B, f, null, 'A ofensiva parou'); continue; }
    if (!defs) defs = frontDefs(f, B.q);
    att.concat(defs).forEach(a => { a.fbd = S.t; });            // uma batalha de front por exército por dia
    if (!defs.length && frontDefs(f, B.q, true).length) { FBSTAT.waitBusy++; continue; }   // defensor presente, ocupado noutra batalha: a ocupação espera
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
    if (aw) { const k = 1 + Math.min(4, Math.floor((B.pa0 ?? 1) / Math.max(B.pd0 ?? 1, .5))); /* vitória ocupa mais quanto maior a razão de força na abertura */ const took = capture(f, B.q, k, att); fbLog(B, 'Vitória: ' + took + ' província' + (took > 1 ? 's' : '') + ' ocupada' + (took > 1 ? 's' : '')); endFront(B, f, true, null); }
    else { fbLog(B, 'Derrota: o ataque foi repelido'); endFront(B, f, false, null); }
  }
  FB_RSV = null;
}
const atWarSide = (f, o) => { const w = S.wars.find(x => x.id === f.w); return !!w && (f.side === 'A' ? w.D : w.A).includes(o); };
/* ocupa a província-alvo e outras do mesmo estado que o inimigo controla (até k), a partir das que encostam no que já é seu */
function capture(f, q, k, att) {
  const lead = att.slice().sort((x, y) => regs(y) - regs(x))[0].o, w = S.wars.find(x => x.id === f.w), foe = new Set(f.side === 'A' ? w.D : w.A), st = WD.provs[q].state, took = [q];
  const q2 = [q]; for (let h = 0; h < q2.length && took.length < k; h++) for (const v of WD.provs[q2[h]].adj) if (took.length < k && WD.provs[v].state === st && foe.has(S.ctrl[v]) && !took.includes(v)) { took.push(v); q2.push(v); }
  took.forEach(p => { const ow = S.own[p]; S.ctrl[p] = ow >= 0 && ow !== lead && !atWar(ow, lead) ? ow : lead; delete S.sieges[p]; }); new Set(att.map(a => a.o)).forEach(o => took.forEach(p => explore(nat(o), p))); S.mapDirty = true; ownChanged(); return took.length;   // tomar de um ocupante devolve ao dono, se não estamos em guerra com ele; cada atacante explora o que tomou
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
