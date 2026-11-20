/* Grand Chronicle — simulação: diplomacia. */
'use strict';

/* ---------- diplomacia: relações, alianças, casamentos, uniões pessoais, comércio e embargos ---------- */
const has = (n, k, id) => (n[k] || []).includes(id);
const link = (a, b, k) => { a[k] = a[k] || []; b[k] = b[k] || []; if (!a[k].includes(b.id)) a[k].push(b.id); if (!b[k].includes(a.id)) b[k].push(a.id); };
let strC = null;                                            // força militar por nação, refeita uma vez por mês
const strength = n => { if (!strC) { strC = new Float64Array(S.nations.length); S.armies.forEach(a => strC[a.o] += regs(a)); } return strC[n.id] * (1 + n.m.army) * n.up.inf + 1; };
const nbC = new Map();
function neighbors(n) { const k = n.id + ':' + (S.t / 30 | 0); if (nbC.has(k)) return nbC.get(k); if (nbC.size > 400) nbC.clear(); const r = neighbors0(n); nbC.set(k, r); return r; }
function neighbors0(n) { const s = new Set(); for (const p of provsOf(n.id)) for (const o of WD.provs[p].adj) { const t = S.own[o]; if (t >= 0 && t !== n.id) s.add(t); } return s; }
/* testes usados pelas tabelas DIPLO, DIP_ACC e DIP_DRIFT (data.js): t = quem avalia, n = o outro, a = argumento */
const DIP_TEST = {
  one: () => 1, rel: (t, n) => t.rel[n.id] || 0, sameIdeo: (t, n) => t.ideo === n.ideo, sameGovCat: (t, n) => GOVS[t.gov].cat === GOVS[n.gov].cat,
  dipSkill: (t, n) => n.ruler.st.dip - 8, trait: (t, n, a) => t.ruler.tr.includes(a), trait2: (t, n, a) => a.some(x => t.ruler.tr.includes(x)),
  count: (t, n, a) => (t[a] || []).length, linked: (t, n, a) => has(t, a, n.id), stronger: (t, n) => strength(n) > strength(t) * 1.5,
  common: (t, n) => enemiesOf(t.id).some(e => atWar(n.id, e)) || [...neighbors(t)].some(x => atWar(x, n.id)),
  embargo: (t, n) => has(t, 'emb', n.id) || has(n, 'emb', t.id), notHered: (t, n) => GOVS[t.gov].succ !== 'hered' || GOVS[n.gov].succ !== 'hered',
  neighbor: (t, n) => neighbors(t).has(n.id), war: (t, n) => atWar(t.id, n.id), overlord: (t, n) => n.senior === t.id || t.senior === n.id,
};
const dipTerm = (k, v, t, n, a) => +DIP_TEST[k](t, n, a) * v;
function accept(t, n, kind) {                                 // quanto t topa a proposta de n (≥ 0 aceita); devolve [valor, motivos]
  const why = []; let v = 0; const add = (x, txt) => { if (x) { v += x; why.push((x > 0 ? '+' : '') + Math.round(x) + ' ' + txt); } };
  for (const T of DIP_ACC.concat((DIPLO[kind] || {}).acc || [])) add(dipTerm(T[0], T[1], t, n, T[3]), T[2]);   // [teste, valor, texto, arg]
  if (atWar(t.id, n.id)) add(-1000, 'em guerra');
  return [Math.round(v), why];
}
const dipCost = k => Math.round((DIPLO[k].cost || 0) * eraScale());
const relAdd = (a, b, x) => { if (x) a.rel[b.id] = clamp((a.rel[b.id] || 0) + x, -100, 100); };
const unlink = (a, b, k) => { a[k] = (a[k] || []).filter(x => x !== b.id); b[k] = (b[k] || []).filter(x => x !== a.id); };
function dipAct(n, t, kind) {                                 // '' = feito/aceito; texto = motivo da recusa
  if (!t.alive || t === n) return 'Inválido';
  const D = DIPLO[kind], c = dipCost(kind) || 0; if (n.money < c) return 'Sem dinheiro';
  if (D.block) return D.block;
  if (!D.link) {                                              // ações de mão única: valem na hora
    if (D.cd && (n.cd || {})[t.id] > S.t) return 'Já tentado este ano';
    if (D.toggle && has(n, D.toggle, t.id)) { n[D.toggle] = n[D.toggle].filter(x => x !== t.id); return ''; }
    if (c) n.money -= c; if (D.cd) { n.cd = n.cd || {}; n.cd[t.id] = S.t + D.cd; } if (D.pay) t.money += c;
    if (D.toggle) (n[D.toggle] = n[D.toggle] || []).push(t.id);
    if (D.ties) breakTies(n, t); if (D.unlink) unlink(n, t, D.unlink);
    relAdd(t, n, D.rel[0]); relAdd(n, t, D.rel[1]); if (D.stab) n.stab = Math.max(0, n.stab + D.stab);
    return '';
  }
  for (const [k, why] of D.deny || []) if (DIP_TEST[k](n, t, D.link)) return why;
  if (atWar(n.id, t.id)) return 'Em guerra';
  if (t.id !== S.player) { const [v] = accept(t, n, kind); if (v < 0) return 'Recusado'; }
  n.money -= c; link(n, t, D.link);
  relAdd(t, n, D.bonus); relAdd(n, t, D.bonus);
  log(D.log + ' entre ' + natName(n) + ' e ' + natName(t) + '.', n.id === S.player || t.id === S.player ? 'good' : 'none', [n.id, t.id]);
  return '';
}
function aiPropose(n, t, kind) {                              // IA propõe; para o jogador vira uma janela
  if (t.id === S.player) { S.dipOffers = S.dipOffers || []; if (S.dipOffers.length < 2 && !(n.offerCd > S.t)) { S.dipOffers.push({ from: n.id, kind }); n.offerCd = S.t + 360 * 5; } return; }
  dipAct(n, t, kind);
}
function relDrift() {                                         // uma vez por ano: relações vão na direção do que as nações têm em comum
  S.nations.forEach(n => {
    if (!n.alive) return; neighbors(n);                 // aquece o cache do mês
    for (const k in n.rel) {
      const id = +k, t = nat(id); if (!t || !t.alive) continue;
      let target = 0; for (const T of DIP_DRIFT) target += dipTerm(T[0], T[1], n, t, T[2]);   // [teste, valor, arg]
      n.rel[k] = clamp(n.rel[k] + (target - n.rel[k]) * .12, -100, 100);
    }
  });
}
function personality(n) {                                     // traços do governante mudam a IA (TRAITS[].pm)
  const P = { war: 1, build: 1, army: 1, colon: 1, claim: 1, ally: 1, gold: 1 }, t = n.ruler.tr;
  for (const k in TRAITS) if (TRAITS[k].pm && t.includes(k)) for (const x in TRAITS[k].pm) P[x] *= TRAITS[k].pm[x];
  return P;
}
function aiDiplomacy(n) {
  const P = personality(n), nb = [...neighbors(n)].map(nat).filter(t => t.alive);
  const known = S.nations.filter(t => t.alive && t !== n && n.exP[t.capital]);
  if ((n.allies || []).length < 3 && chance(.04 * P.ally)) {
    const c = known.filter(t => !has(n, 'allies', t.id) && !atWar(n.id, t.id)).map(t => [t, accept(t, n, 'ally')[0]]).sort((a, b) => b[1] - a[1])[0];
    if (c && c[1] >= 0) aiPropose(n, c[0], 'ally');
  }
  if (GOVS[n.gov].succ === 'hered' && (n.marr || []).length < 3 && chance(.04 * P.ally)) {
    const c = known.filter(t => GOVS[t.gov].succ === 'hered' && !has(n, 'marr', t.id)).map(t => [t, accept(t, n, 'marr')[0]]).sort((a, b) => b[1] - a[1])[0];
    if (c && c[1] >= 0) aiPropose(n, c[0], 'marr');
  }
  if ((n.trade || []).length < 4 && chance(.05)) {
    const c = known.filter(t => !has(n, 'trade', t.id) && !has(n, 'emb', t.id) && !has(t, 'emb', n.id)).map(t => [t, accept(t, n, 'trade')[0]]).sort((a, b) => b[1] - a[1])[0];
    if (c && c[1] >= 0) aiPropose(n, c[0], 'trade');
  }
  if (chance(.05) && nb.length) { const t = pickR(nb); if (strength(t) > strength(n) && (n.rel[t.id] || 0) < 30) dipAct(n, t, n.ruler.tr.includes('generous') ? 'gift' : 'improve'); }
  enemiesOf(n.id).forEach(e => { if (!has(n, 'emb', e) && chance(.3)) dipAct(n, nat(e), 'embargo'); });
  if (n.emb && n.emb.length && chance(.05)) { const e = n.emb.find(x => !atWar(n.id, x)); if (e != null) dipAct(n, nat(e), 'embargo'); }
  aiSubjects(n);
}
function tryUnion(n) {                                        // sem herdeiros: um parceiro de casamento pode herdar (união pessoal)
  if (n.id === S.player || GOVS[n.gov].succ !== 'hered') return false;
  const cands = (n.marr || []).map(nat).filter(t => t.alive && t.senior == null && GOVS[t.gov].succ === 'hered' && t.id !== n.id);
  if (!cands.length || !chance(.6)) return false;
  const s = cands.sort((a, b) => strength(b) - strength(a))[0];
  makeSubject(n, s, 'union'); n.unionT = S.t; n.ruler = s.ruler; n.dyn = s.dyn; n.kids = []; n.spouse = null;
  log('União pessoal: ' + natName(s) + ' herdou a coroa de ' + natName(n) + '.', 'world', [n.id, s.id]);
  return true;
}
