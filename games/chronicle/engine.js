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
  player:  { ok: (n, v) => (isHuman(n.id)) === v, txt: v => v ? 'Só o jogador' : 'Só a IA' },
  faith:   { ok: (n, v) => arr(v).some(k => n.relig === REL_IDS.indexOf(k)), txt: v => 'Fé: ' + orTxt(arr(v).map(k => RELIGIONS[k].n)), ids: v => arr(v).map(k => ['RELIGIONS', k]) },
  ferv:    { ok: (n, v) => inR(n.ferv ?? 50, v), txt: v => rTxt('Fervor', v) },
  reform:  { ok: (n, v) => { const R = (S.reforms || {}).reformation; if (!R || n.relig !== R.from) return false; return ((n.rels || {})[R.to] || 0) / Math.max(1, n.popT || 0) >= v; }, txt: v => 'A Reforma tem ' + Math.round(v * 100) + '% dos seus fiéis' },
  faithShare: { ok: (n, v) => { const r = REL_IDS.indexOf(v[0]), pt = Math.max(1, n.popT || 0); return inR(((n.rels || {})[r] || 0) / pt, v.slice(1)); }, txt: v => rTxt('Seguidores de ' + RELIGIONS[v[0]].n, v.slice(1), x => Math.round(x * 100) + '%'), ids: v => [['RELIGIONS', v[0]]] },
  flag:    { ok: (n, v) => !!(n.flags || {})[v], txt: v => 'Marca: ' + v },
  noFlag:  { ok: (n, v) => !(n.flags || {})[v], txt: v => 'Sem a marca: ' + v },
  succ:    { ok: (n, v) => arr(v).includes(GOVS[n.gov].succ), txt: v => arr(v).includes('hered') ? 'Monarquia hereditária' : 'Sucessão: ' + arr(v).join(', ') },
  heirAge: { ok: (n, v) => { const k = (n.kids || []).slice().sort((a, b) => a.born - b.born)[0]; return !!k && inR(ageOf(k), v); }, txt: v => rTxt('Idade do herdeiro', v) },
  drilling:{ ok: (n, v) => S.armies.some(a => a.o === n.id && a.drill && a.cav > 1) === v, txt: v => v ? 'Exército com cavalaria em treino' : 'Sem treino' },
  govOld:  { ok: (n, v) => (govAge(n) > 0) === v, txt: v => v ? 'Governo ultrapassado' : 'Governo atual' },
  press:   { ok: (n, v) => inR(n.press || 0, v), txt: v => rTxt('Pressão do conselho', v) },
  enacting:{ ok: (n, v) => v === true ? !!n.enact : v === false ? !n.enact : !!n.enact && n.enact.ty === v, txt: v => v === false ? 'Sem votação em andamento' : v === 'gov' ? 'Reforma de governo em votação' : v === 'law' ? 'Lei em votação' : 'Proposta em votação' },
  rulerOpp:{ ok: (n, v) => !!n.enact && !!n.ruler && (enactStance(n, n.ruler, n.enact, true)[0] < 0) === v, txt: v => v ? 'O governante é contra a proposta' : 'O governante não se opõe' },
  enactSup:{ ok: (n, v) => !!n.enact && inR(enactSupport(n, n.enact).tot, v), txt: v => rTxt('Apoio à proposta', v) },
  spyTech: { ok: n => !!spyTechOf(n), txt: () => 'Eles estão à frente em alguma técnica que você pode pesquisar' },
  plotting:{ ok: (n, v) => !!n.plot === v, txt: v => v ? 'Plano em andamento' : 'Sem plano' },
  clsShare:{ ok: (n, v) => !!n.cls && inR((n.cls[v[0]] || 0) / Math.max(1, n.popT || 0), v.slice(1)), txt: v => rTxt('Classe ' + (CLASSES[v[0]] || { n: v[0] }).n.toLowerCase(), v.slice(1), x => Math.round(x * 100) + '% da população') },
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
  ruler:    { do: (n, v) => { if (v === 'die') { log(titleOf(n) + ' ' + charName(n.ruler) + ' de ' + natName(n) + ' morreu.', isHuman(n.id) ? 'bad' : 'info', [n.id]); succeed(n, true); } }, txt: v => v === 'die' ? 'O governante morre' : '' },
  log:      { do: (n, v) => log(fillTxt(n, v), 'world', [n.id]), txt: () => '' },
  faith:    { do: (n, v) => { n.relig = v === '@reform' ? S.reforms.reformation.to : REL_IDS.indexOf(v); n.fav = 50; n.excom = false; provsOf(n.id).forEach(p => { if (chance(.3)) S.relg[p] = n.relig; }); calcMods(n); }, txt: v => 'A fé oficial vira ' + (v === '@reform' ? (S.reforms && S.reforms.reformation ? RELIGIONS[REL_IDS[S.reforms.reformation.to]].n : 'a fé reformada') : RELIGIONS[v].n), ids: v => v === '@reform' ? [] : [['RELIGIONS', v]] },
  ferv:     { do: (n, v) => { n.ferv = clamp((n.ferv ?? 50) + v, 0, 100); }, txt: v => '🙏 Fervor ' + sgnN(v) },
  fav:      { do: (n, v) => { n.fav = clamp((n.fav ?? 50) + v, 0, 100); }, txt: v => 'Favor do chefe religioso ' + sgnN(v) },
  pres:     { do: (n, v) => { n.pres = clamp((n.pres ?? 50) + v, 0, 100); }, txt: v => '👑 Prestígio ' + sgnN(v) },
  flag:     { do: (n, v) => { (n.flags = n.flags || {})[v] = S.t; }, txt: () => '' },
  unflag:   { do: (n, v) => { if (n.flags) delete n.flags[v]; }, txt: () => '' },
  /* cadeia: agenda outro evento para este país daqui a 'mo' meses */
  chain:    { do: (n, v) => { (n.evNext = n.evNext || []).push({ id: v.id, t: S.t + (v.mo || 1) * 30 }); }, txt: () => '', ids: v => [['EVENT', v.id]] },
  revolt:   { do: (n, v) => revolt(n, v), txt: v => '✊ ' + REVOLT[v][0] },
  /* votação em andamento: v pontos de progresso (100 = uma fase); 'stop' arquiva a proposta */
  enact:    { do: (n, v) => { const E = n.enact; if (!E) return; if (v === 'stop') { n.enact = null; return; } E.prog = clamp(E.prog + v, E.ph * 100, 299); },
              txt: v => v === 'stop' ? 'A proposta é arquivada' : '🗳️ Votação ' + (v >= 0 ? '+' : '−') + Math.abs(v) + '% de uma fase' },
  /* quem governa depois de uma reforma: keep (o atual fica), council (o melhor conselheiro), marshal (o militar), new (gente nova), clergy (o clero escolhe) */
  /* operação de inteligência concluída: tech, mil, gold, map ou secret (contra o país em n.spyT) */
  spy:      { do: (n, v) => spyDo(n, v), txt: v => ({ tech: '🔬 Uma técnica deles ' + Math.round(SPY.tech * 100) + '% mais barata', mil: '⚔️ +' + Math.round(SPY.mil * 100) + '% de dano contra eles por 2–3 anos', gold: '💰 Parte do tesouro deles', map: '🗺️ Os mapas deles', secret: '🕵️ Os podres do governante deles' })[v] },
  plot:     { do: (n, v) => { const P = n.plot; if (!P) return; P.ok = clamp(P.ok + v[0], 0, 99); P.bad = clamp(P.bad + v[1], 0, 99); }, txt: v => '🗡️ Plano: ' + (v[0] ? 'sucesso ' + (v[0] > 0 ? '+' : '−') + Math.abs(v[0]) + '% ' : '') + (v[1] ? 'fracasso ' + (v[1] > 0 ? '+' : '−') + Math.abs(v[1]) + '%' : '') },
  leader:   { do: (n, v) => newLeader(n, v), txt: v => ({ keep: 'O governante atual continua', council: 'Um conselheiro assume o governo', marshal: 'O chefe militar assume', new: 'Um novo governante assume', clergy: 'O clero escolhe o governante' })[v] },
  govCoup:  { do: n => govCoupTo(n), txt: () => 'O país vira um regime militar' },
  /* perseguição: o maior exército em treino ganha o bônus de perseguição por v meses */
  pursuit:  { do: (n, v) => { const a = S.armies.filter(x => x.o === n.id && x.drill && x.cav > 1).sort((x, y) => y.cav - x.cav)[0]; if (a) (a.g != null ? groupOf(a) : [a]).forEach(x => x.pur = S.t + v * 30); }, txt: v => '🐎 Perseguição na cavalaria por ' + durTxt(v) + ' (perseguição ×' + PURSUIT.mul + ', choque +' + Math.round(PURSUIT.cav * 100) + '%)' },
  govNext:  { do: n => { const g = govNextOf(n); if (g && g !== n.gov) { applyGov(n, g); if (GOVS[g].succ !== 'hered') succeed(n, false); } }, txt: () => 'Reforma o governo para a forma seguinte' },
  /* conselho: concede = atende a exigência mais pesada; purge = troca o conselheiro mais exigente */
  council:  { do: (n, v) => { const d = demandsOf(n).filter(x => x.slot !== 'ruler').sort((a, b) => b.w - a.w);
                if (v === 'concede' && d[0]) { const x = d[0]; if (x.ty === 'gov') applyGov(n, x.v); else if (x.ty === 'law') n.laws[x.k] = x.v; else n.ideo = x.v; calcMods(n); }
                if (v === 'purge' && d[0]) n.council[d[0].slot] = councilChar(n, d[0].slot); if (v === 'form') formCouncil(n); },
              txt: v => v === 'concede' ? 'Atende a exigência mais forte do conselho' : v === 'form' ? 'Um conselho novo, escolhido pelo novo regime' : 'Troca o conselheiro mais exigente' },
  /* sorteio: [[chance, efeitos], ...]; o que sobrar da chance não faz nada */
  roll:     { do: (n, v) => { let x = rnd(); for (const [p, fx] of v) { if (x < p) { applyFx(n, fx); return; } x -= p; } },
              txt: v => v.map(([p, fx]) => Math.round(p * 100) + '%: ' + (fxTxt(fx).join(', ') || 'nada')).join(' · '), sub: v => v.map(x => x[1]) },
};
function applyFx(n, fx) { for (const k in fx || {}) EFF[k].do(n, fx[k]); }
const fxTxt = fx => Object.keys(fx || {}).map(k => EFF[k].txt(fx[k])).filter(Boolean);

/* textos com {pais}, {titulo} e {governante} */
const fillTxt = (n, s) => s.replace(/\{lei\}/g, n.enact ? enactName(n.enact) : 'a proposta').replace(/\{fase\}/g, n.enact ? enactPhases(n)[n.enact.ph].toLowerCase() : '').replace(/\{rival\}/g, n.spyT != null && nat(n.spyT) ? natName(nat(n.spyT)) : 'o rival').replace(/\{alvo\}/g, n.plot && courtFind(n, n.plot.cid) ? charName(courtFind(n, n.plot.cid)) : 'o alvo').replace(/\{pais\}/g, natName(n)).replace(/\{titulo\}/g, titleOf(n).toLowerCase()).replace(/\{governante\}/g, n.ruler ? charName(n.ruler) : '');

/* ---------- avisos e eventos ---------- */
/* aviso ao jogador (janela sem escolha); só chega se n for o jogador */
function notify(id, t, m, extra) { if (!isHuman(id)) return; (S.evq = S.evq || []).push(Object.assign({ t, m, to: id, nid: S.id++ }, extra)); }   // nid: o jogador confirma pelo id (ackNote)   // to = de qual jogador é o aviso
const notifyAll = (t, m, extra) => humans().forEach(id => notify(id, t, m, extra));

/* eventos (EVENTS em events.js): uma vez por mês, cada país vivo sorteia no máximo um evento cujas condições valem.
   p = chance por mês; once = só uma vez por país; cd = anos até poder repetir; opts = escolhas (ai = peso para a IA, when = condição da escolha) */
const evOpts = (n, ev) => ev.opts.filter(o => condOk(n, o.when));
function evReady(n, ev) {
  const last = (n.evd || {})[ev.id];
  if (last != null && (ev.once || S.t - last < (ev.cd || 10) * 360)) return false;
  return condOk(n, ev.when) && evOpts(n, ev).length > 0;
}
function fireEvent(n, ev) {
  (n.evd = n.evd || {})[ev.id] = S.t;
  if (isHuman(n.id)) { n.evWait = ev.id; notify(n.id, ev.e + ' ' + ev.t, fillTxt(n, ev.m), { ev: ev.id }); return; }
  const os = evOpts(n, ev), w = os.map(o => o.ai == null ? 1 : o.ai), tot = w.reduce((a, b) => a + b, 0); let x = rnd() * tot, k = 0; while (k < os.length - 1 && (x -= w[k]) >= 0) k++; applyFx(n, os[k].fx);
}
function eventsTick(n) {
  if (n.evWait) { if (isHuman(n.id) && (S.evq || []).some(e => e.ev === n.evWait)) return; chooseEvent(n, n.evWait, 0); }   // perdido (save antigo, troca de país): primeira escolha
  if (n.evNext && n.evNext.length) {                          // cadeias: o que foi agendado vem antes do sorteio (some se a condição não valer mais)
    const due = n.evNext.filter(x => x.t <= S.t); n.evNext = n.evNext.filter(x => x.t > S.t);
    for (const x of due) { const ev = EVENT[x.id]; if (ev && condOk(n, ev.when) && evOpts(n, ev).length) { fireEvent(n, ev); return; } }
  }
  for (const ev of EVENTS) { if (!ev.p || !evReady(n, ev) || !chance(ev.p)) continue; fireEvent(n, ev); return; }
}
/* resposta do jogador (índice na lista de escolhas disponíveis) */
function chooseEvent(n, id, k) {
  const ev = EVENT[id]; if (!ev || n.evWait !== id) return 'Evento expirado';
  const o = evOpts(n, ev)[k] || evOpts(n, ev)[0]; n.evWait = null; if (S.evq) S.evq = S.evq.filter(e => !(e.ev === id && (e.to ?? n.id) === n.id)); if (o) applyFx(n, o.fx); return '';
}
const tmodTick = n => { if (n.tmods && n.tmods.some(x => x.u <= S.t)) { n.tmods = n.tmods.filter(x => x.u > S.t); calcMods(n); } };

/* ---------- validação dos dados (roda no carregamento; erros vão para o console e para validateData()) ---------- */
function validateData() {
  const err = [], tab = { TECH, GOVS, IDEOS, LAWS, VERT, TRAITS, RELIGIONS, EVENT, GOVCAT: Object.fromEntries(Object.values(GOVS).map(g => [g.cat, 1])) };
  const has = (t, id) => { if (t.startsWith('LAWS.')) { const [, k] = t.split('.'); return !!(LAWS[k] && LAWS[k].o[id]); } return !!(tab[t] && tab[t][id]); };
  const chkC = (c, w) => { if (!c) return; for (const k in c) { const d = COND[k]; if (!d) { err.push(w + ': condição desconhecida ' + k); continue; }
    (d.ids ? d.ids(c[k]) : []).forEach(([t, id]) => { if (!has(t, id)) err.push(w + ': ' + t + ' sem ' + id); }); (d.sub ? d.sub(c[k]) : []).forEach(x => chkC(x, w)); } };
  const chkF = (fx, w) => { for (const k in fx || {}) { const d = EFF[k]; if (!d) { err.push(w + ': efeito desconhecido ' + k); continue; }
    (d.ids ? d.ids(fx[k]) : []).forEach(([t, id]) => { if (!has(t, id)) err.push(w + ': ' + t + ' sem ' + id); }); (d.sub ? d.sub(fx[k]) : []).forEach(x => chkF(x, w));
    if (k === 'mod') Object.keys(fx[k].m).forEach(m => { if (!MODS[m] && m !== 'coup') err.push(w + ': modificador desconhecido ' + m); }); } };
  const ids = new Set();
  EVENTS.forEach(ev => { const w = 'evento ' + ev.id; if (ids.has(ev.id)) err.push(w + ': id repetido'); ids.add(ev.id);
    ['t', 'e', 'm'].forEach(k => { if (ev[k] == null) err.push(w + ': falta ' + k); }); if (ev.p == null) err.push(w + ': falta p (0 = só por cadeia)'); if (!(ev.opts || []).length) err.push(w + ': sem escolhas');
    chkC(ev.when, w); (ev.opts || []).forEach((o, i) => { chkC(o.when, w + ' escolha ' + i); chkF(o.fx, w + ' escolha ' + i); if (!o.n) err.push(w + ' escolha ' + i + ': sem nome'); }); });
  const modOk = (m, w) => Object.keys(m || {}).forEach(k => { if (!MODS[k] && k !== 'coup') err.push(w + ': modificador desconhecido ' + k); });
  for (const g in GOVS) modOk(GOVS[g].m, 'governo ' + g); for (const i in IDEOS) modOk(IDEOS[i].m, 'ideologia ' + i); for (const t in TRAITS) modOk(TRAITS[t].m, 'traço ' + t);
  for (const k in LAWS) for (const o in LAWS[k].o) { modOk(LAWS[k].o[o].m, 'lei ' + k + '.' + o); chkC(LAWS[k].o[o].when, 'lei ' + k + '.' + o); }
  TECHS.forEach(t => { const w = 'tecnologia ' + t.id; modOk(t.fx.m, w); t.req.forEach(r => { if (!TECH[r]) err.push(w + ': requisito ' + r + ' não existe'); });
    (t.fx.b || []).forEach(b => { if (!BUILDINGS[b]) err.push(w + ': prédio ' + b + ' não existe'); }); (t.fx.g || []).forEach(g => { if (!GOVS[g]) err.push(w + ': governo ' + g + ' não existe'); });
    (t.fx.i || []).forEach(i => { if (!IDEOS[i]) err.push(w + ': ideologia ' + i + ' não existe'); }); });
  // prédios, bens e diplomacia: campos que apontam para outras tabelas
  for (const b in BUILDINGS) { const d = BUILDINGS[b], w = 'prédio ' + b;
    for (const k of ['in', 'out']) for (const g in d[k] || {}) if (!GOODS[g]) err.push(w + ': bem ' + g + ' não existe');
    if (d.req && !(REQS[d.req] || (d.req.startsWith('res:') && GOODS[d.req.slice(4)] && GOODS[d.req.slice(4)].rm))) err.push(w + ': condição ' + d.req + ' não existe (REQS ou res:<bem com rm>)');
    if (d.job && !JOBS[d.job]) err.push(w + ': grupo de empregos ' + d.job + ' não existe'); if (d.vert && !VERT[d.vert]) err.push(w + ': vertente ' + d.vert + ' não existe');
    for (const x in (d.fx || {}).boost || {}) if (!BUILDINGS[x]) err.push(w + ': fx.boost aponta para ' + x + ', que não existe'); }
  for (const g in GOODS) { const G = GOODS[g]; if (G.pros && !TECH[G.pros]) err.push('bem ' + g + ': técnica de prospecção ' + G.pros + ' não existe'); (G.terr || []).forEach(t => { if (!TERRAIN[t]) err.push('bem ' + g + ': terreno ' + t + ' não existe'); }); }
  for (const g in SUBSIST) if (!GOODS[g]) err.push('subsistência: bem ' + g + ' não existe');
  for (const k in REQS) if (REQS[k].terr && !Object.values(TERRAIN).some(t => t[REQS[k].terr])) err.push('condição ' + k + ': nenhum terreno tem a marca ' + REQS[k].terr);
  for (const k in NEEDS) (NEEDS[k].terr || []).forEach(t => { if (!TERRAIN[t]) err.push('necessidade ' + k + ': terreno ' + t + ' não existe'); });
  const dipT = typeof DIP_TEST === 'object' ? DIP_TEST : null;
  if (dipT) { for (const k in DIPLO) { const D = DIPLO[k], w = 'ação diplomática ' + k; [...(D.acc || []), ...(D.deny || [])].forEach(T => { if (!dipT[T[0]]) err.push(w + ': teste ' + T[0] + ' não existe'); }); }
    [...DIP_ACC, ...DIP_DRIFT].forEach(T => { if (!dipT[T[0]]) err.push('diplomacia: teste ' + T[0] + ' não existe'); }); }
  for (const t in TRAITS) for (const k in TRAITS[t].pm || {}) if (!['war', 'build', 'army', 'colon', 'claim', 'ally', 'gold'].includes(k)) err.push('traço ' + t + ': personalidade ' + k + ' não existe');
  // ideologias: governos e leis que querem precisam existir
  for (const i in IDEOS) { const I = IDEOS[i]; (I.govs || []).forEach(g => { if (!GOVS[g]) err.push('ideologia ' + i + ': governo ' + g + ' não existe'); });
    for (const k in I.laws || {}) if (!LAWS[k] || !LAWS[k].o[I.laws[k]]) err.push('ideologia ' + i + ': lei ' + k + '.' + I.laws[k] + ' não existe'); if (I.y0 == null) err.push('ideologia ' + i + ': falta y0'); }
  for (const k in INTERACT) if (!['friend', 'hostile'].includes(INTERACT[k].kind)) err.push('interação ' + k + ': kind deve ser friend ou hostile');
  // governos: árvore, golpes, transições e modo do conselho
  for (const g in GOVS) (GOVS[g].to || []).concat(GOVS[g].ev || []).forEach(x => { const id = Array.isArray(x) ? x[0] : x; if (!GOVS[id]) err.push('governo ' + g + ': caminho para ' + id + ', que não existe'); if (Array.isArray(x)) chkC(x[1], 'governo ' + g + ' → ' + id); });
  for (const g in GOVS) if (GOVS[g].next && !(GOVS[g].to || []).some(x => (Array.isArray(x) ? x[0] : x) === GOVS[g].next)) err.push('governo ' + g + ': a reforma natural ' + GOVS[g].next + ' não está em to');
  for (const c in COUP_GOVS) if (c !== 'chance') COUP_GOVS[c].forEach(g => { if (!GOVS[g]) err.push('golpe (' + c + '): governo ' + g + ' não existe'); });
  GOV_TR.forEach(x => { if (!EVENT[x.ev]) err.push('transição ' + x.from + '→' + x.to + ': evento ' + x.ev + ' não existe'); });
  for (const k in STATS) if (!MODS[STATS[k].mod] && STATS[k].mod !== 'coup') err.push('atributo ' + k + ': modificador ' + STATS[k].mod + ' não existe');
  for (const b in BUILDINGS) { const t = BUILDINGS[b].tech; if (t && !(TECH[t] && (TECH[t].fx.b || []).includes(b))) err.push('prédio ' + b + ': a tecnologia ' + t + ' não o lista em fx.b (nunca é liberado)'); }
  return err;
}
