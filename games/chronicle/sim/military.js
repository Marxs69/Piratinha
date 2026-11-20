/* Grand Chronicle — simulação: tropas, veterania, apoio, posturas, suprimento, atrito, cansaço e batalhas (base: EU4).
   Um regimento = 1k homens. Cada exército guarda: inf/cav/art/vrt (regimentos), mor (moral 0..1), xp (veterania 0..1), fat (cansaço 0..1),
   st (postura), sup (companhias de apoio), gen (general). */
'use strict';

const UT = ['inf', 'cav', 'art', 'vrt'];
/* ---------- atributos e necessidades ---------- */
function unitStat(n, t, k) { let v = UNIT_BASE[t][k]; for (const [tech, o] of UNIT_ERA[t] || []) if (o[k] != null && hasT(n, tech)) v = o[k]; return v; }
function unitNeeds(n, t) {
  let nd = {}; for (const [tech, o] of UNIT_NEEDS[t]) if (!tech || hasT(n, tech)) nd = o;
  if (t === 'vrt' && n.vert) { nd = Object.assign({}, nd, VERT_UNIT_NEED[n.vert] || {}); nd[VERT[n.vert].good] = (nd[VERT[n.vert].good] || 0) + .25; }
  return nd;
}
const supName = (n, k) => { let nm = SUPPORT[k].names[0][1]; for (const [t, x] of SUPPORT[k].names) if (!t || hasT(n, t)) nm = x; return nm; };
const supOk = (n, k) => !SUPPORT[k].tech || hasT(n, SUPPORT[k].tech);
/* bens que o exército inteiro do país consome por mês */
let abC = null;                                              // exércitos por dono (refeito a cada dia)
const armiesOf = id => { if (!abC || abC.t !== S.t || abC.k !== S.armies.length) { abC = { t: S.t, k: S.armies.length, m: new Map() }; for (const a of S.armies) { const l = abC.m.get(a.o); if (l) l.push(a); else abC.m.set(a.o, [a]); } } return abC.m.get(id) || []; };
function armyDemand(n) {
  const R = { inf: 0, cav: 0, art: 0, vrt: 0 }, sc = { recon: 0, eng: 0, med: 0 }, d = {};
  for (const a of armiesOf(n.id)) { UT.forEach(t => R[t] += a[t]); for (const k in a.sup || {}) sc[k]++; }
  UT.forEach(t => { if (R[t] > 0) { const nd = unitNeeds(n, t); for (const g in nd) d[g] = (d[g] || 0) + nd[g] * R[t]; } });
  for (const k in sc) if (sc[k]) for (const g in SUPPORT[k].need) d[g] = (d[g] || 0) + SUPPORT[k].need[g] * sc[k] * 3;
  return { R, sc, d };
}
/* satisfação de cada tipo de tropa e de cada apoio (pelo valor dos bens que faltam) */
function armySats(n, R) {
  const sat = (nd) => { let a = 0, b = 0; for (const g in nd) { const w = nd[g] * S.wp[g]; a += w * (n.mk.sat[g] == null ? 1 : n.mk.sat[g]); b += w; } return b ? a / b : 1; };
  n.tsat = {}; UT.forEach(t => n.tsat[t] = sat(unitNeeds(n, t))); n.ssat = {}; for (const k in SUPPORT) n.ssat[k] = sat(SUPPORT[k].need);
  const tot = UT.reduce((s, t) => s + R[t], 0); n.armySat = tot > .5 ? UT.reduce((s, t) => s + R[t] * n.tsat[t], 0) / tot : 1;
}
const vetLv = a => { let k = 0; VET.forEach((v, i) => { if ((a.xp || 0) >= v.x) k = i; }); return k; };
const vetOf = a => VET[vetLv(a)];
const supCost = (n, k) => Math.round(SUPPORT[k].c * eraScale());
function addSupport(n, a, k) {
  if (!a || a.o !== n.id || a.sup && a.sup[k]) return 'Já tem';
  if (!supOk(n, k)) return 'Exige ' + TECH[SUPPORT[k].tech].n;
  const c = supCost(n, k); if (n.money < c) return 'Sem dinheiro';
  n.money -= c; (a.sup = a.sup || {})[k] = 1; return '';
}
const setStance = (a, s) => { if (STANCES[s]) a.st = s; return ''; };
const stanceOf = a => STANCES[a.st] ? a.st : 'bal';
/* treinamento em tempo de paz: sobe até Veterano, custa 50% a mais de manutenção */
const DRILL_CAP = .45;
const drillOk = a => !!a.drill && a.p < WD.provs.length && S.own[a.p] === a.o && !warsOf(a.o).length && !a.path.length;
/* veterania dos recrutas: academias do estado e a lei de recrutamento */
function recruitXp(n, at) {
  const st = WD.provs[at] ? S.bld[WD.provs[at].state] : {}, dr = (n.laws || LAW_DEF).draft;
  return clamp(.08 + Math.min(2, st.academy || 0) * .06 + (dr === 'volunteer' ? .08 : dr === 'total' ? -.06 : 0), 0, .4);
}
/* junta b em a (veterania e cansaço pela média dos regimentos, apoio somado) */
function mergeInto(a, b) {
  const ra = regs(a), rb = regs(b), t = Math.max(.01, ra + rb);
  a.xp = ((a.xp || 0) * ra + (b.xp || 0) * rb) / t; a.fat = ((a.fat || 0) * ra + (b.fat || 0) * rb) / t; a.mor = Math.min(a.mor, b.mor == null ? 1 : b.mor);
  UT.forEach(k => { a[k] += b[k]; b[k] = 0; }); a.gen = a.gen || b.gen; a.sup = Object.assign({}, b.sup || {}, a.sup || {}); a.max = regs(a);
}
/* divide: a nova parte leva a fração k de cada tipo (veterania, moral, cansaço e postura iguais; o apoio fica com o original) */
function splitArmy(a, k = .5) {
  const b = addArmy(a.o, a.p, {}, a.xp); UT.forEach(t => { b[t] = a[t] * k; a[t] -= b[t]; });
  b.st = a.st; b.mor = a.mor; b.fat = a.fat; b.front = a.front; b.max = regs(b); a.max = regs(a); return b;
}
/* reforço: homens novos diluem a veterania */
function addMen(a, t, k, xp) { const r = regs(a); a.xp = ((a.xp || 0) * r + xp * k) / Math.max(.01, r + k); a[t] += k; }

/* ---------- suprimento e atrito ---------- */
/* países amigos: o próprio, aliados e quem luta do mesmo lado em alguma guerra */
let frC = null;                                               // amigos por país, refeitos a cada dia (guerras e alianças mudam pouco)
function friendsOf(o) {
  if (!frC || frC.t !== S.t || frC.w !== S.wars.length) frC = { t: S.t, w: S.wars.length, m: new Map() };
  let c = frC.m.get(o); if (c) return c; c = friendsOf0(o); frC.m.set(o, c); return c;
}
function friendsOf0(o) {
  const s = new Set([o]); const n = nat(o); (n.allies || []).forEach(x => s.add(x));
  for (const w of S.wars) { const side = w.A.includes(o) ? w.A : w.D.includes(o) ? w.D : null; if (side) side.forEach(x => s.add(x)); }
  return s;
}
let supC = null;                                              // distância (províncias) até território amigo, por país; refeita todo mês
function supplyDist(o) {
  if (!supC || supC.t !== (S.t / 30 | 0)) supC = { t: S.t / 30 | 0, m: new Map() };
  let d = supC.m.get(o); if (d) return d;
  const P = WD.provs.length, fr = friendsOf(o), q = []; d = new Uint8Array(P).fill(255);
  for (let p = 0; p < P; p++) if (fr.has(S.ctrl[p]) && (S.own[p] === S.ctrl[p] || S.ctrl[p] === o)) { d[p] = 0; q.push(p); }   // território amigo ou ocupado por mim
  for (let h = 0; h < q.length; h++) { const u = q[h]; if (d[u] >= 12) continue; for (const v of WD.provs[u].adj) if (d[v] === 255) { d[v] = d[u] + 1; q.push(v); } }
  supC.m.set(o, d); return d;
}
const logiRange = n => LOGI_BASE + (n.fx ? n.fx.logi : 0);
const inSupply = a => { if (a.p >= WD.provs.length) return true; const c = S.ctrl[a.p]; if (c === a.o || (friendsOf(a.o).has(c) && S.own[a.p] === c)) return true; return supplyDist(a.o)[a.p] <= logiRange(nat(a.o)); };   // em território amigo nem precisa da busca
/* quantos regimentos a província sustenta para o país o (EU4: limite de suprimento) */
function provSupply(p, o) {
  const pr = WD.provs[p], n = nat(o), fr = friendsOf(o), ct = S.ctrl[p];
  const rel = S.own[p] === -1 ? .35 : fr.has(ct) ? (fr.has(S.own[p]) ? 1.5 : 1) : .6;   // em casa há depósitos; em terra ocupada, pilhagem; em terra sem dono, quase nada
  return (n.horde && curYear() <= n.horde ? 2 : 1) * (6 + S.pop[p] / 6) * TERRAIN[pr.terr].sup * (1 + (S.stSpd ? S.stSpd[pr.state] : 0) * .5) * (1 + .15 * (n.fx ? n.fx.logi : 0)) * rel;
}
/* atrito mensal de um exército (fração dos homens) e o porquê */
function attritionOf(a) {
  const P = WD.provs.length; if (a.p >= P) return [0, []];
  const n = nat(a.o), fr = friendsOf(a.o), pr = WD.provs[a.p], why = [];
  const f = a.front != null && !(a.fready > S.t) && typeof frontById === 'function' ? frontById(a.front) : null;
  let tot = 0, cap; if (f) { for (const b of S.armies) if (b.front === a.front && b.o === a.o) tot += regs(b); cap = WD.states[f.st].provs.filter(p => fr.has(S.ctrl[p])).reduce((s, p) => s + provSupply(p, a.o), 0); }   // no front o estado inteiro abastece
  else { for (const b of S.armies) if (b.p === a.p && fr.has(b.o)) tot += regs(b); cap = provSupply(a.p, a.o); } a.cap = cap;
  const home = fr.has(S.ctrl[a.p]) && fr.has(S.own[a.p]);
  let x = home ? 0 : TERRAIN[pr.terr].attr; if (x) why.push(TERRAIN[pr.terr].n);   // o terreno só castiga fora de casa
  if (tot > cap) { x += Math.min(.05, .01 + (tot / cap - 1) * .02); why.push('Acima do suprimento (' + Math.round(tot) + 'k de ' + Math.round(cap) + 'k)'); }
  if (!a.exp && !inSupply(a)) { x += .02; why.push('Sem linha de suprimento'); }
  if (!a.exp && S.own[a.p] === -1) { x += .005; why.push('Terra sem dono'); }
  const le = diseaseLe(a.p); if (le) { x += le * 1.5 * (a.sup && a.sup.med ? .5 : 1); why.push('Doença'); }
  const s = a.sup || {}; x *= (s.med ? .7 : 1) * (s.recon ? .9 : 1) * (s.eng ? .9 : 1);
  if (n.horde && curYear() <= n.horde) { x *= .25; if (x) why.push('Horda: vive da terra (atrito ×0,25)'); }
  return [x, why];
}
function attritionTick() {
  for (const a of S.armies) {
    const [x, why] = attritionOf(a); a.attr = x; a.supOk = inSupply(a);
    if (x > 0) { UT.forEach(t => a[t] *= 1 - x); if (a.o === S.player && x >= .03) log('Exército em ' + WD.provs[a.p].n + ' perde ' + Math.round(x * 100) + '% por atrito (' + why.join(', ').toLowerCase() + ').', 'bad', [S.player]); }
    if (drillOk(a)) a.xp = Math.min(DRILL_CAP, Math.max(a.xp || 0, (a.xp || 0) + .015));
  }
  S.armies = S.armies.filter(a => regs(a) > .08);
}

/* ---------- batalhas: diárias, com dado a cada 3 dias e fases alternadas de fogo e choque ---------- */
const BT_K = .016;                                           // baixas por ponto de dano por dia
function sideInfo(list, p, isDef) {
  const n = nat(list[0].o), pr = WD.provs[p], T = TERRAIN[pr.terr];
  const tot = { inf: 0, cav: 0, art: 0, vrt: 0 }; let regsT = 0, xp = 0, fat = 0, gen = null, big = list[0], has = {}, sat = 0, defW = 0, morW = 0;
  for (const a of list) { const r = regs(a), an = nat(a.o); UT.forEach(t => tot[t] += a[t]); regsT += r; xp += (a.xp || 0) * r; fat += (a.fat || 0) * r; sat += (an.tsat ? UT.reduce((s, t) => s + a[t] * (an.tsat[t] ?? 1), 0) : r) * (a.supOk === false ? .5 : 1);
    if (a.gen && (!gen || a.gen.st.mar > gen.st.mar)) gen = a.gen; if (r > regs(big)) big = a; for (const k in a.sup || {}) has[k] = 1;
    UT.forEach(t => { defW += a[t] * unitStat(an, t, 'def') * (an.up ? an.up[t] || 1 : 1); morW += a[t] * unitStat(an, t, 'mor'); }); }   // armadura e equipamento também protegem
  const R = Math.max(.01, regsT), W = Math.max(4, Math.round((WIDTH_BASE + (n.fx ? n.fx.width : 0)) * T.width));
  const fp = tot.inf + tot.cav + tot.vrt, k = fp > W ? W / fp : 1, eng = { inf: tot.inf * k, cav: tot.cav * k, vrt: tot.vrt * k, art: 0, artBack: 0 };
  const room = Math.max(0, W - fp * k); eng.art = Math.min(tot.art, room); eng.artBack = Math.min(tot.art - eng.art, W);
  const vx = xp / R, vet = VET.reduce((v, x) => vx >= x.x ? x : v, VET[0]);
  return { pur: list.some(a => a.pur > S.t), list, n, tot, regs: regsT, eng, W, vet, fat: fat / R, sat: sat / R, gen, has, st: STANCES[big.st || 'bal'] ? (big.st || 'bal') : 'bal', def: defW / R, mor: morW / R * vet.mo, isDef, amph: list.some(a => a.amph > S.t) };
}
function sideDmg(s, o, ph, pip, p) {
  const n = s.n, T = TERRAIN[WD.provs[p].terr]; let d = 0;
  for (const t of UT) { const e = s.eng[t] + (t === 'art' ? s.eng.artBack * .5 : 0); if (e <= 0) continue; d += e * unitStat(n, t, ph) * unitStat(n, t, 'kill') * (n.up ? n.up[t] || 1 : 1) * (t === 'cav' ? T.cav * (s.pur && ph === 'shock' ? 1 + PURSUIT.cav : 1) : 1); }
  const st = STANCES[s.st], beat = st.beats === o.st ? 1.15 : 1;
  return d * s.vet.m * (.6 + .4 * s.sat) * (1 + (n.m ? n.m.army : 0)) * genMul(s.gen) * st.dmg * beat * (1 - .35 * s.fat) * Math.max(.05, (5 + pip) / 10);
}
function sidePip(s, o, roll, p) {
  const T = TERRAIN[WD.provs[p].terr], half = s.has.eng ? .5 : 1;
  let pip = roll;
  if (s.gen && (!o.gen || s.gen.st.mar > o.gen.st.mar)) pip += Math.min(3, Math.floor(((s.gen.st.mar) - (o.gen ? o.gen.st.mar : 4)) / 4));
  if (s.has.recon && !o.has.recon) pip += 1;
  if (!s.isDef) pip += T.att * half;
  if (s.amph) pip -= 2 * half;
  return pip;
}
function applyLoss(s, loss, w) {
  const n = s.n, med = s.has.med; if (med) { n.manpower += loss * .15; loss *= .75; }
  const wt = a => a.inf + a.cav + a.vrt + a.art * (s.eng.inf + s.eng.cav + s.eng.vrt > 0 ? .2 : 1);
  const W = s.list.reduce((t, a) => t + wt(a), 0) || 1;
  for (const a of s.list) {
    const la = loss * wt(a) / W, front = a.inf + a.cav + a.vrt, artW = a.art * (front > 0 ? .2 : 1), den = Math.max(.01, front + artW);
    for (const t of UT) { const share = (t === 'art' ? artW : a[t]) / den; a[t] = Math.max(0, a[t] - la * share); }
    if (w) { w.loss = w.loss || {}; w.loss[a.o] = (w.loss[a.o] || 0) + la; }
  }
}
const warOfPair = (x, y) => S.wars.find(w => (w.A.includes(x) && w.D.includes(y)) || (w.A.includes(y) && w.D.includes(x)));
function battleDay(p, A, B) {
  const ctrl = S.ctrl[p], lastA = Math.max(...A.map(a => a.arr || 0)), lastB = Math.max(...B.map(a => a.arr || 0));
  const aDef = A.some(a => a.o === ctrl) || (!B.some(b => b.o === ctrl) && lastA < lastB);
  let bt = S.battles[p];
  if (!bt) { bt = S.battles[p] = { d: 0, ra: 0, rb: 0, t0: S.t, a: A[0].o, b: B[0].o };
    if (A.some(a => a.o === S.player) || B.some(b => b.o === S.player)) log('Batalha começou em ' + WD.provs[p].n + '.', 'info', [S.player]); }
  bt.seen = S.t;
  if (bt.d % 3 === 0) { bt.ra = rint(10); bt.rb = rint(10); }
  const ph = (bt.d / 3 | 0) % 2 === 0 ? 'fire' : 'shock'; bt.ph = ph; bt.d++;
  const sa = sideInfo(A, p, aDef), sb = sideInfo(B, p, !aDef);
  const pa = sidePip(sa, sb, bt.ra, p), pb = sidePip(sb, sa, bt.rb, p); bt.pa = pa; bt.pb = pb; bt.Wa = sa.W; bt.Wb = sb.W;
  const T = TERRAIN[WD.provs[p].terr], fort = fortOf(p);
  const guard = s => s.def * (s.isDef ? 1 + T.def + fort * .1 : 1) / (s.isDef && s.has.eng ? .9 : 1) / STANCES[s.st].take;
  const toB = sideDmg(sa, sb, ph, pa, p) * BT_K / guard(sb), toA = sideDmg(sb, sa, ph, pb, p) * BT_K / guard(sa);
  const w = warOfPair(A[0].o, B[0].o);
  applyLoss(sb, toB, w); applyLoss(sa, toA, w);
  const morHit = (s, loss, o) => (loss / Math.max(1, s.regs) * 3 * STANCES[o.st].mor + .02) / Math.max(.4, s.mor);
  const ma = morHit(sa, toA, sb), mb = morHit(sb, toB, sa);
  for (const a of A) { a.mor = Math.max(0, a.mor - ma); a.inBattle = true; a.path = []; a.fat = Math.min(1, (a.fat || 0) + .025 * STANCES[sa.st].fat); a.xp = Math.min(1, (a.xp || 0) + .003); }
  for (const b of B) { b.mor = Math.max(0, b.mor - mb); b.inBattle = true; b.path = []; b.fat = Math.min(1, (b.fat || 0) + .025 * STANCES[sb.st].fat); b.xp = Math.min(1, (b.xp || 0) + .003); }
  const brokeA = A.every(a => a.mor < .08 || regs(a) < .3), brokeB = B.every(a => a.mor < .08 || regs(a) < .3);
  if (!brokeA && !brokeB) return;
  const [L, Wn, sl, sw] = brokeA ? [A, B, sa, sb] : [B, A, sb, sa];
  // perseguição: cavalaria, postura e reconhecimento de quem venceu matam parte de quem foge
  const cavSh = sw.tot.cav / Math.max(1, sw.regs), pur = Math.min(.35, .03 + .12 * cavSh * (sw.pur ? PURSUIT.mul : 1) * (sw.has.recon ? 1.3 : 1) * T.cav);
  const lr = L.reduce((t, a) => t + regs(a), 0), wr = Wn.reduce((t, a) => t + regs(a), 0);
  applyLoss(sl, lr * pur, w);
  if (w) { w.bp = w.bp || {}; w.bp[Wn[0].o] = (w.bp[Wn[0].o] || 0) + clamp(Math.round(lr * .5), 1, 10); }
  Wn.forEach(a => a.xp = Math.min(1, (a.xp || 0) + .05)); addPres(nat(Wn[0].o), 1); addPres(nat(L[0].o), -1); L.forEach(a => { a.xp = Math.min(1, (a.xp || 0) + .015); a.fat = Math.min(1, (a.fat || 0) + .15); });
  const ln = nat(L[0].o), wn = nat(Wn[0].o), wiped = L.reduce((t, a) => t + regs(a), 0) < wr * .1;
  L.forEach(a => { if (a.gen && chance(wiped ? .3 : .06)) { if (a.o === S.player) log('O general ' + charName(a.gen) + ' morreu em ' + WD.provs[p].n + '.', 'bad', [S.player]); a.gen = null; } });
  if (L[0].o === S.player || Wn[0].o === S.player) log('Batalha em ' + WD.provs[p].n + ': ' + natName(wn) + ' venceu ' + natName(ln) + (wiped ? ' e aniquilou o exército inimigo' : '') + ' (' + bt.d + ' dias).', Wn[0].o === S.player ? 'good' : 'bad', [S.player]);
  if (wiped) L.forEach(a => UT.forEach(t => a[t] = 0)); else L.forEach(a => retreat(a));
  delete S.battles[p];
}
