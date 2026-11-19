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
function accept(t, n, kind) {                                 // quanto t topa a proposta de n (≥ 0 aceita); devolve [valor, motivos]
  const why = []; let v = 0; const add = (x, txt) => { if (x) { v += x; why.push((x > 0 ? '+' : '') + Math.round(x) + ' ' + txt); } };
  add((t.rel[n.id] || 0) * .5, 'relação');
  add(t.ideo === n.ideo ? 12 : 0, 'mesma ideologia'); add(GOVS[t.gov].cat === GOVS[n.gov].cat ? 8 : 0, 'governos parecidos');
  add((n.ruler.st.dip - 8) * 2, 'diplomacia do seu governante');
  const tr = t.ruler.tr;
  add(tr.includes('charismatic') || tr.includes('generous') ? 10 : 0, 'temperamento'); add(tr.includes('paranoid') && kind === 'ally' ? -20 : 0, 'governante paranoico');
  if (kind === 'ally') {
    add(-15, 'base'); add(-(t.allies || []).length * 6, 'já tem aliados');
    const common = enemiesOf(t.id).some(e => atWar(n.id, e)) || [...neighbors(t)].some(x => (n.claims && Object.keys(n.claims).length && false) || atWar(x, n.id)); add(common ? 20 : 0, 'inimigo em comum');
    add(strength(n) > strength(t) * 1.5 ? 10 : 0, 'você é forte'); add(has(t, 'marr', n.id) ? 15 : 0, 'casamento real');
  } else if (kind === 'marr') { add(-10, 'base'); add(has(t, 'allies', n.id) ? 10 : 0, 'aliados'); }
  else if (kind === 'trade') { add(-5, 'base'); add(tr.includes('greedy') ? 10 : 0, 'governante ganancioso'); add((t.trade || []).length * -4, 'já tem acordos'); }
  if (atWar(t.id, n.id)) add(-1000, 'em guerra');
  return [Math.round(v), why];
}
const dipCost = k => Math.round({ improve: 15, gift: 40, ally: 0, marr: 20, trade: 10, integrate: 200 }[k] * eraScale());
function dipAct(n, t, kind) {                                 // '' = feito/aceito; texto = motivo da recusa
  if (!t.alive || t === n) return 'Inválido';
  const c = dipCost(kind) || 0; if (n.money < c) return 'Sem dinheiro';
  if (kind === 'improve') { if ((n.cd || {})[t.id] > S.t) return 'Já tentado este ano'; n.money -= c; n.cd = n.cd || {}; n.cd[t.id] = S.t + 360; t.rel[n.id] = clamp((t.rel[n.id] || 0) + 15, -100, 100); n.rel[t.id] = clamp((n.rel[t.id] || 0) + 8, -100, 100); return ''; }
  if (kind === 'gift') { n.money -= c; t.money += c; t.rel[n.id] = clamp((t.rel[n.id] || 0) + 20, -100, 100); return ''; }
  if (kind === 'insult') { t.rel[n.id] = clamp((t.rel[n.id] || 0) - 40, -100, 100); n.rel[t.id] = clamp((n.rel[t.id] || 0) - 20, -100, 100); return ''; }
  if (kind === 'break') { breakTies(n, t); ['allies'].forEach(() => 0); t.rel[n.id] = clamp((t.rel[n.id] || 0) - 40, -100, 100); n.stab = Math.max(0, n.stab - 5); return ''; }
  if (kind === 'unally') { n.allies = (n.allies || []).filter(x => x !== t.id); t.allies = (t.allies || []).filter(x => x !== n.id); t.rel[n.id] = clamp((t.rel[n.id] || 0) - 40, -100, 100); n.stab = Math.max(0, n.stab - 5); return ''; }
  if (kind === 'untrade') { n.trade = (n.trade || []).filter(x => x !== t.id); t.trade = (t.trade || []).filter(x => x !== n.id); t.rel[n.id] = clamp((t.rel[n.id] || 0) - 10, -100, 100); return ''; }
  if (kind === 'embargo') { n.emb = n.emb || []; if (n.emb.includes(t.id)) n.emb = n.emb.filter(x => x !== t.id); else { n.emb.push(t.id); n.trade = (n.trade || []).filter(x => x !== t.id); t.trade = (t.trade || []).filter(x => x !== n.id); t.rel[n.id] = clamp((t.rel[n.id] || 0) - 25, -100, 100); } return ''; }
  if (kind === 'integrate') return 'Use a aba Súditos na diplomacia';
  if (kind === 'ally' && has(n, 'allies', t.id)) return 'Já são aliados';
  if (kind === 'marr') { if (GOVS[n.gov].succ !== 'hered' || GOVS[t.gov].succ !== 'hered') return 'Exige duas monarquias hereditárias'; if (has(n, 'marr', t.id)) return 'Já há casamento'; }
  if (kind === 'trade') { if (has(n, 'trade', t.id)) return 'Já há acordo'; if (has(n, 'emb', t.id) || has(t, 'emb', n.id)) return 'Há embargo'; }
  if (atWar(n.id, t.id)) return 'Em guerra';
  if (t.id !== S.player) { const [v] = accept(t, n, kind); if (v < 0) return 'Recusado'; }
  n.money -= c; link(n, t, kind === 'ally' ? 'allies' : kind === 'marr' ? 'marr' : 'trade');
  const bonus = { ally: 25, marr: 25, trade: 10 }[kind]; t.rel[n.id] = clamp((t.rel[n.id] || 0) + bonus, -100, 100); n.rel[t.id] = clamp((n.rel[t.id] || 0) + bonus, -100, 100);
  log({ ally: 'Aliança', marr: 'Casamento real', trade: 'Acordo comercial' }[kind] + ' entre ' + natName(n) + ' e ' + natName(t) + '.', n.id === S.player || t.id === S.player ? 'good' : 'none', [n.id, t.id]);
  return '';
}
function aiPropose(n, t, kind) {                              // IA propõe; para o jogador vira uma janela
  if (t.id === S.player) { S.dipOffers = S.dipOffers || []; if (S.dipOffers.length < 2 && !(n.offerCd > S.t)) { S.dipOffers.push({ from: n.id, kind }); n.offerCd = S.t + 360 * 5; } return; }
  dipAct(n, t, kind);
}
function relDrift() {                                         // uma vez por ano: relações vão na direção do que as nações têm em comum
  S.nations.forEach(n => {
    if (!n.alive) return; const nb = neighbors(n);
    for (const k in n.rel) {
      const id = +k, t = nat(id); if (!t || !t.alive) continue;
      const target = (has(n, 'allies', id) ? 50 : 0) + (has(n, 'marr', id) ? 30 : 0) + (has(n, 'trade', id) ? 15 : 0) + (n.ideo === t.ideo ? 10 : 0) - (nb.has(id) ? 10 : 0) - (has(n, 'emb', id) || has(t, 'emb', n.id) ? 40 : 0) - (atWar(n.id, id) ? 100 : 0) + (t.senior === n.id || n.senior === id ? 40 : 0);
      n.rel[k] = clamp(n.rel[k] + (target - n.rel[k]) * .12, -100, 100);
    }
  });
}
function personality(n) {                                     // traços do governante mudam a IA
  const P = { war: 1, build: 1, army: 1, colon: 1, claim: 1, ally: 1, gold: 1 }, t = n.ruler.tr, mul = (k, v) => { P[k] *= v; };
  if (t.includes('brave')) mul('war', 1.3); if (t.includes('craven')) mul('war', .5); if (t.includes('ambitious')) { mul('war', 1.4); mul('claim', 1.5); } if (t.includes('content')) mul('war', .6);
  if (t.includes('just')) mul('claim', .1); if (t.includes('cruel')) mul('war', 1.3); if (t.includes('greedy')) mul('gold', 2); if (t.includes('generous')) mul('ally', 1.3);
  if (t.includes('diligent')) mul('build', 1.4); if (t.includes('lazy')) mul('build', .6); if (t.includes('schemer')) mul('claim', 1.8); if (t.includes('strategist')) mul('army', 1.25);
  if (t.includes('builder')) mul('build', 1.5); if (t.includes('navigator')) mul('colon', 1.6); if (t.includes('paranoid')) { mul('army', 1.3); mul('ally', .5); } if (t.includes('charismatic')) mul('ally', 1.4);
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
