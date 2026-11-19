/* Grand Chronicle — engine de regras: condições, efeitos e eventos descritos como dados.
   Toda regra nova (eventos, decisões, exigências) deve usar COND e EFF: o mesmo dado serve para checar, aplicar e explicar.
   Carregado antes de sim/; só usa as funções da simulação quando chamado (já com S e WD prontos). */
'use strict';

const arr = v => Array.isArray(v) ? v : [v];
const inR = (x, r) => (r[0] == null || x >= r[0]) && (r[1] == null || x <= r[1]);
const rTxt = (l, r, f = x => x) => r[0] != null && r[1] != null ? l + ' entre ' + f(r[0]) + ' e ' + f(r[1]) : r[0] != null ? l + ' ≥ ' + f(r[0]) : l + ' ≤ ' + f(r[1]);
const orTxt = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' ou ' + a[a.length - 1] : a[0];

/* ---------- condições: um objeto; todas as chaves precisam valer. Faixas são [mín, máx] (null = sem limite) ---------- */
const COND = {
  year:    { ok: (n, v) => inR(curYear(), v), txt: v => rTxt('Ano', v) },
  tech:    { ok: (n, v) => arr(v).every(t => hasT(n, t)), txt: v => 'Tecnologia: ' + arr(v).map(t => TECH[t].n).join(', '), ids: v => arr(v).map(t => ['TECH', t]) },
  noTech:  { ok: (n, v) => !arr(v).some(t => hasT(n, t)), txt: v => 'Sem a tecnologia ' + orTxt(arr(v).map(t => TECH[t].n)), ids: v => arr(v).map(t => ['TECH', t]) },
  gov:     { ok: (n, v) => arr(v).includes(n.gov), txt: v => 'Governo: ' + orTxt(arr(v).map(g => GOVS[g].n)), ids: v => arr(v).map(g => ['GOVS', g]) },
  govCat:  { ok: (n, v) => arr(v).includes(GOVS[n.gov].cat), txt: v => 'Governo do tipo ' + orTxt(arr(v)), ids: v => arr(v).map(c => ['GOVCAT', c]) },
  ideo:    { ok: (n, v) => arr(v).includes(n.ideo), txt: v => 'Ideologia: ' + orTxt(arr(v).map(i => IDEOS[i].n)), ids: v => arr(v).map(i => ['IDEOS', i]) },
  law:     { ok: (n, v) => Object.keys(v).every(k => arr(v[k]).includes(n.laws[k])), txt: v => Object.keys(v).map(k => LAWS[k].n + ': ' + orTxt(arr(v[k]).map(o => LAWS[k].o[o].n))).join('; '),
             ids: v => Object.keys(v).flatMap(k => [['LAWS', k], ...arr(v[k]).map(o => ['LAWS.' + k + '.o', o])]) },
  vert:    { ok: (n, v) => v === true ? !!n.vert : v === false ? !n.vert : arr(v).includes(n.vert), txt: v => v === true ? 'Com vertente' : v === false ? 'Sem vertente' : 'Vertente: ' + orTxt(arr(v).map(x => VERT[x].n)),
             ids: v => typeof v === 'boolean' ? [] : arr(v).map(x => ['VERT', x]) },
  rank:    { ok: (n, v) => inR(n.rank || 0, v), txt: v => rTxt('Título', v, r => RANK_N[r]) },
  stab:    { ok: (n, v) => inR(n.stab, v), txt: v => rTxt('Estabilidade', v) },
  money:   { ok: (n, v) => inR(n.money, v.map(x => x == null ? x : x * eraScale())), txt: v => rTxt('Tesouro', v.map(x => x == null ? x : Math.round(x * eraScale()))) },
  wex:     { ok: (n, v) => inR(n.wex, v), txt: v => rTxt('Cansaço de guerra', v) },
  war:     { ok: (n, v) => (warsOf(n.id).length > 0) === v, txt: v => v ? 'Em guerra' : 'Em paz' },
  coast:   { ok: (n, v) => provsOf(n.id).some(p => WD.provs[p].coast) === v, txt: v => v ? 'Com litoral' : 'Sem litoral' },
  cul:     { ok: (n, v) => arr(v).includes(n.cul), txt: v => 'Cultura: ' + orTxt(arr(v).map(c => CULTURES[c].n)) },
  relig:   { ok: (n, v) => arr(v).includes(n.relig), txt: v => 'Religião: ' + orTxt(arr(v).map(r => RELIGIONS[r].n)), ids: v => arr(v).map(r => ['RELIGIONS', r]) },
  rulerAge:{ ok: (n, v) => !!n.ruler && inR(ageOf(n.ruler), v), txt: v => rTxt('Idade do governante', v) },
  trait:   { ok: (n, v) => !!n.ruler && arr(v).some(t => n.ruler.tr.includes(t)), txt: v => 'Governante ' + orTxt(arr(v).map(t => TRAITS[t].n.toLowerCase())), ids: v => arr(v).map(t => ['TRAITS', t]) },
  heir:    { ok: (n, v) => ((n.kids || []).length > 0) === v, txt: v => v ? 'Com herdeiro' : 'Sem herdeiro' },
  player:  { ok: (n, v) => (n.id === S.player) === v, txt: v => v ? 'Só o jogador' : 'Só a IA' },
  govOld:  { ok: (n, v) => (govAge(n) > 0) === v, txt: v => v ? 'Governo ultrapassado' : 'Governo atual' },
  press:   { ok: (n, v) => inR(n.press || 0, v), txt: v => rTxt('Pressão do conselho', v) },
  any:     { ok: (n, v) => v.some(c => condOk(n, c)), txt: v => 'Uma destas: ' + v.map(c => condTxt(c).join(', ')).join(' | '), sub: v => v },
  not:     { ok: (n, v) => !condOk(n, v), txt: v => 'Não: ' + condTxt(v).join(', '), sub: v => [v] },
};
const condOk = (n, c) => !c || Object.keys(c).every(k => COND[k].ok(n, c[k]));
const condTxt = c => c ? Object.keys(c).map(k => COND[k].txt(c[k])) : [];
const condFail = (n, c) => c ? Object.keys(c).filter(k => !COND[k].ok(n, c[k])).map(k => COND[k].txt(c[k])) : [];   // o que falta, em texto

/* ---------- efeitos: aplicados na ordem das chaves. Dinheiro é em unidades da era (× eraScale) ---------- */
const sgnN = v => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v));
const pctS = v => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v * 100)) + '%';
const durTxt = mo => mo % 12 ? mo + ' meses' : mo / 12 === 1 ? '1 ano' : mo / 12 + ' anos';
const EFF = {
  money:    { do: (n, v) => { n.money += Math.round(v * eraScale()); }, txt: v => '💰 ' + sgnN(v * eraScale()) },
  stab:     { do: (n, v) => { n.stab = clamp(n.stab + v, 0, 100); }, txt: v => '⚖️ Estabilidade ' + sgnN(v) },
  manpower: { do: (n, v) => { n.manpower = Math.max(0, n.manpower + v); }, txt: v => 'Contingente ' + sgnN(v) + 'k' },
  wex:      { do: (n, v) => { n.wex = clamp(n.wex + v, 0, 30); }, txt: v => 'Cansaço de guerra ' + sgnN(v) },
  press:    { do: (n, v) => { n.press = clamp((n.press || 0) + v, 0, 100); }, txt: v => 'Pressão do conselho ' + sgnN(v) },
  rp:       { do: (n, v) => { n.rp += v * techBase(curYear()); }, txt: v => '🔬 Pesquisa ' + pctS(v) + ' de uma tecnologia' },
  pop:      { do: (n, v) => { provsOf(n.id).forEach(p => S.pop[p] = Math.max(.3, S.pop[p] * (1 + v))); }, txt: v => '👥 População ' + pctS(v) },
  /* modificador temporário { l: rótulo, m: {mod: valor}, mo: meses } — entra em MOD_SOURCES como qualquer outro */
  mod:      { do: (n, v) => { (n.tmods = n.tmods || []).push({ l: v.l, m: v.m, u: S.t + v.mo * 30 }); calcMods(n); },
              txt: v => v.l + ' por ' + durTxt(v.mo) + ': ' + Object.keys(v.m).map(k => (MODS[k] || 'Risco de golpe') + ' ' + pctS(v.m[k])).join(', ') },
  tech:     { do: (n, v) => { if (!n.techs[v]) finishTech(n, TECH[v]); }, txt: v => 'Ganha a tecnologia ' + TECH[v].n, ids: v => [['TECH', v]] },
  gov:      { do: (n, v) => { if (n.gov !== v) applyGov(n, v); }, txt: v => 'Governo vira ' + GOVS[v].n, ids: v => [['GOVS', v]] },
  ideo:     { do: (n, v) => { n.ideo = v; calcMods(n); }, txt: v => 'Ideologia vira ' + IDEOS[v].n, ids: v => [['IDEOS', v]] },
  law:      { do: (n, v) => { Object.assign(n.laws, v); calcMods(n); }, txt: v => Object.keys(v).map(k => LAWS[k].n + ': ' + LAWS[k].o[v[k]].n).join('; '),
              ids: v => Object.keys(v).flatMap(k => [['LAWS', k], ['LAWS.' + k + '.o', v[k]]]) },
  ruler:    { do: (n, v) => { if (v === 'die') { log(titleOf(n) + ' ' + charName(n.ruler) + ' de ' + natName(n) + ' morreu.', n.id === S.player ? 'bad' : 'info', [n.id]); succeed(n, true); } }, txt: v => v === 'die' ? 'O governante morre' : '' },
  log:      { do: (n, v) => log(fillTxt(n, v), 'world', [n.id]), txt: () => '' },
  govNext:  { do: n => { const g = govNextOf(n); if (g && g !== n.gov) { applyGov(n, g); if (GOVS[g].succ !== 'hered') succeed(n, false); } }, txt: () => 'Reforma o governo para a forma seguinte' },
  /* conselho: concede = atende a exigência mais pesada; purge = troca o conselheiro mais exigente */
  council:  { do: (n, v) => { const d = demandsOf(n).filter(x => x.slot !== 'ruler').sort((a, b) => b.w - a.w);
                if (v === 'concede' && d[0]) { const x = d[0]; if (x.ty === 'gov') applyGov(n, x.v); else if (x.ty === 'law') n.laws[x.k] = x.v; else n.ideo = x.v; calcMods(n); }
                if (v === 'purge' && d[0]) n.council[d[0].slot] = mkChar(n, { boost: COUNCIL.find(c => c[0] === d[0].slot)[2], dyn: newDynasty(n) }); },
              txt: v => v === 'concede' ? 'Atende a exigência mais forte do conselho' : 'Troca o conselheiro mais exigente' },
  /* sorteio: [[chance, efeitos], ...]; o que sobrar da chance não faz nada */
  roll:     { do: (n, v) => { let x = rnd(); for (const [p, fx] of v) { if (x < p) { applyFx(n, fx); return; } x -= p; } },
              txt: v => v.map(([p, fx]) => Math.round(p * 100) + '%: ' + (fxTxt(fx).join(', ') || 'nada')).join(' · '), sub: v => v.map(x => x[1]) },
};
function applyFx(n, fx) { for (const k in fx || {}) EFF[k].do(n, fx[k]); }
const fxTxt = fx => Object.keys(fx || {}).map(k => EFF[k].txt(fx[k])).filter(Boolean);

/* textos com {pais}, {titulo} e {governante} */
const fillTxt = (n, s) => s.replace(/\{pais\}/g, natName(n)).replace(/\{titulo\}/g, titleOf(n).toLowerCase()).replace(/\{governante\}/g, n.ruler ? charName(n.ruler) : '');

/* ---------- avisos e eventos ---------- */
/* aviso ao jogador (janela sem escolha); só chega se n for o jogador */
function notify(id, t, m, extra) { if (id !== S.player) return; (S.evq = S.evq || []).push(Object.assign({ t, m }, extra)); }

/* eventos (EVENTS em events.js): uma vez por mês, cada país vivo sorteia no máximo um evento cujas condições valem.
   p = chance por mês; once = só uma vez por país; cd = anos até poder repetir; opts = escolhas (ai = peso para a IA, when = condição da escolha) */
const evOpts = (n, ev) => ev.opts.filter(o => condOk(n, o.when));
function evReady(n, ev) {
  const last = (n.evd || {})[ev.id];
  if (last != null && (ev.once || S.t - last < (ev.cd || 10) * 360)) return false;
  return condOk(n, ev.when) && evOpts(n, ev).length > 0;
}
function eventsTick(n) {
  if (n.evWait) { if (n.id === S.player && (S.evq || []).some(e => e.ev === n.evWait)) return; chooseEvent(n, n.evWait, 0); }   // perdido (save antigo, troca de país): primeira escolha
  for (const ev of EVENTS) {
    if (!evReady(n, ev) || !chance(ev.p)) continue;
    (n.evd = n.evd || {})[ev.id] = S.t;
    if (n.id === S.player) { n.evWait = ev.id; notify(n.id, ev.e + ' ' + ev.t, fillTxt(n, ev.m), { ev: ev.id }); }
    else { const os = evOpts(n, ev), w = os.map(o => o.ai == null ? 1 : o.ai), tot = w.reduce((a, b) => a + b, 0); let x = rnd() * tot, k = 0; while (k < os.length - 1 && (x -= w[k]) >= 0) k++; applyFx(n, os[k].fx); }
    return;
  }
}
/* resposta do jogador (índice na lista de escolhas disponíveis) */
function chooseEvent(n, id, k) {
  const ev = EVENT[id]; if (!ev || n.evWait !== id) return 'Evento expirado';
  const o = evOpts(n, ev)[k] || evOpts(n, ev)[0]; n.evWait = null; if (S.evq) S.evq = S.evq.filter(e => e.ev !== id); if (o) applyFx(n, o.fx); return '';
}
const tmodTick = n => { if (n.tmods && n.tmods.some(x => x.u <= S.t)) { n.tmods = n.tmods.filter(x => x.u > S.t); calcMods(n); } };

/* ---------- validação dos dados (roda no carregamento; erros vão para o console e para validateData()) ---------- */
function validateData() {
  const err = [], tab = { TECH, GOVS, IDEOS, LAWS, VERT, TRAITS, RELIGIONS, GOVCAT: Object.fromEntries(Object.values(GOVS).map(g => [g.cat, 1])) };
  const has = (t, id) => { if (t.startsWith('LAWS.')) { const [, k] = t.split('.'); return !!(LAWS[k] && LAWS[k].o[id]); } return !!(tab[t] && tab[t][id]); };
  const chkC = (c, w) => { if (!c) return; for (const k in c) { const d = COND[k]; if (!d) { err.push(w + ': condição desconhecida ' + k); continue; }
    (d.ids ? d.ids(c[k]) : []).forEach(([t, id]) => { if (!has(t, id)) err.push(w + ': ' + t + ' sem ' + id); }); (d.sub ? d.sub(c[k]) : []).forEach(x => chkC(x, w)); } };
  const chkF = (fx, w) => { for (const k in fx || {}) { const d = EFF[k]; if (!d) { err.push(w + ': efeito desconhecido ' + k); continue; }
    (d.ids ? d.ids(fx[k]) : []).forEach(([t, id]) => { if (!has(t, id)) err.push(w + ': ' + t + ' sem ' + id); }); (d.sub ? d.sub(fx[k]) : []).forEach(x => chkF(x, w));
    if (k === 'mod') Object.keys(fx[k].m).forEach(m => { if (!MODS[m] && m !== 'coup') err.push(w + ': modificador desconhecido ' + m); }); } };
  const ids = new Set();
  EVENTS.forEach(ev => { const w = 'evento ' + ev.id; if (ids.has(ev.id)) err.push(w + ': id repetido'); ids.add(ev.id);
    ['t', 'e', 'm', 'p'].forEach(k => { if (ev[k] == null) err.push(w + ': falta ' + k); }); if (!(ev.opts || []).length) err.push(w + ': sem escolhas');
    chkC(ev.when, w); (ev.opts || []).forEach((o, i) => { chkC(o.when, w + ' escolha ' + i); chkF(o.fx, w + ' escolha ' + i); if (!o.n) err.push(w + ' escolha ' + i + ': sem nome'); }); });
  const modOk = (m, w) => Object.keys(m || {}).forEach(k => { if (!MODS[k] && k !== 'coup') err.push(w + ': modificador desconhecido ' + k); });
  for (const g in GOVS) modOk(GOVS[g].m, 'governo ' + g); for (const i in IDEOS) modOk(IDEOS[i].m, 'ideologia ' + i); for (const t in TRAITS) modOk(TRAITS[t].m, 'traço ' + t);
  for (const k in LAWS) for (const o in LAWS[k].o) { modOk(LAWS[k].o[o].m, 'lei ' + k + '.' + o); chkC(LAWS[k].o[o].when, 'lei ' + k + '.' + o); }
  TECHS.forEach(t => { const w = 'tecnologia ' + t.id; modOk(t.fx.m, w); t.req.forEach(r => { if (!TECH[r]) err.push(w + ': requisito ' + r + ' não existe'); });
    (t.fx.b || []).forEach(b => { if (!BUILDINGS[b]) err.push(w + ': prédio ' + b + ' não existe'); }); (t.fx.g || []).forEach(g => { if (!GOVS[g]) err.push(w + ': governo ' + g + ' não existe'); });
    (t.fx.i || []).forEach(i => { if (!IDEOS[i]) err.push(w + ': ideologia ' + i + ' não existe'); }); });
  for (const b in BUILDINGS) { const t = BUILDINGS[b].tech; if (t && !(TECH[t] && (TECH[t].fx.b || []).includes(b))) err.push('prédio ' + b + ': a tecnologia ' + t + ' não o lista em fx.b (nunca é liberado)'); }
  return err;
}
