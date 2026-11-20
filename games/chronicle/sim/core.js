/* Grand Chronicle — simulação (sem DOM). Calendário de 360 dias (12 meses de 30).
   Diário: movimento, batalhas e cercos. Mensal: economia, pesquisa, obras, recrutamento, estabilidade, personagens, golpes, guerras, colonização e IA.
   O mundo (mapa) vem de generateWorld(seed); o estado dinâmico fica em S e é salvo. */
'use strict';

let WD = null, S = null;                                    // mundo e estado
const ECON = { costMul: 3, taxBase: .06, upkeep: .25 };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
/* aleatório da partida: mulberry32 com o estado em S.rs (salvo) — mesma seed e mesmas ordens = mesma partida */
const rnd = () => { let t = S.rs = S.rs + 0x6D2B79F5 | 0; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rand = (a, b) => a + rnd() * (b - a);
const chance = p => rnd() < p;
const pickR = a => a[rnd() * a.length | 0];
const rint = k => rnd() * k | 0;
const yearOf = t => START_YEAR + Math.floor(t / 360);
const curYear = () => yearOf(S.t);
/* nível de preços: todo custo e valor em ducados (obras, leis, tropas, eventos, teto do tesouro) é × isto. Vem da economia do mundo (priceTick); antes do primeiro mês, do ano */
const yearScale = () => 1 + (curYear() - 860) / 300;            // custos mensais (manutenção) andam com a era
const eraScale = () => (S && S.plv) || yearScale();
function priceTick(init) {
  let tax = 0, st = 0; for (const n of S.nations) if (n.alive && n.inc) { tax += Math.max(0, n.inc.tax || 0); st += statesOf(n); } if (!st || !tax) return;
  const target = Math.max(.5, Math.pow(tax / st / PRICE_BASE, PRICE_EXP)); S.plv = init || !S.plv ? target : S.plv + (target - S.plv) * PRICE_LAG;
}
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dateStr = (t = S.t) => (t % 30 + 1) + ' ' + MONTHS[Math.floor(t % 360 / 30)] + ' ' + yearOf(t);
const nat = id => S.nations[id];
const ownName = (n, r, set) => !set || (r === 3 && !(set.f3for || []).includes(n.gov)) || (r === 4 && (GOVS[n.gov].imp || GOVS[n.gov].minRank === 4));   // no nível 3 cada governo usa o próprio nome; no 4, os imperiais próprios também
const rankFmt = (n, r = n.rank || 0) => { const g = GOVS[n.gov], set = RANKSET[g.cat]; return (ownName(n, r, set) ? g.fmt : set.f[r]) || '{}'; };
const rankTitle = (n, r = n.rank || 0) => { const g = GOVS[n.gov], set = RANKSET[g.cat]; return ownName(n, r, set) ? g.t : set.t[r]; };
const natName = n => rankFmt(n).replace('{}', n.name);
const FEM = { 'Rei': 'Rainha', 'Rei eleito': 'Rainha eleita', 'Imperador': 'Imperatriz', 'Chefe supremo': 'Chefe suprema', 'Sumo-sacerdote': 'Suma-sacerdotisa', 'Grão-mestre': 'Grã-mestra', 'Caudilho': 'Caudilha', 'Diretor técnico': 'Diretora técnica', 'Secretário-geral': 'Secretária-geral', 'Arquissábio': 'Arquissábia', 'Delegado': 'Delegada', 'Presidente do congresso': 'Presidenta do congresso', 'Mediador': 'Mediadora', 'Líder supremo': 'Líder suprema', 'Cônsul': 'Cônsul', 'Doge': 'Dogaresa', 'Cã': 'Cátum', 'Barão': 'Baronesa', 'Conde': 'Condessa', 'Duque': 'Duquesa', 'Grão-cã': 'Grã-cátum', 'Prefeito': 'Prefeita', 'Burgomestre': 'Burgomestra', 'Primeiro Cidadão': 'Primeira Cidadã', 'Comissário': 'Comissária', 'Secretário regional': 'Secretária regional', 'Prior': 'Prioresa', 'Bispo': 'Bispa', 'Arcebispo': 'Arcebispa', 'Governador militar': 'Governadora militar', 'Protetor': 'Protetora', 'Engenheiro-chefe': 'Engenheira-chefe', 'Supervisor': 'Supervisora', 'Diretor': 'Diretora', 'Arquiteto supremo': 'Arquiteta suprema', 'Monarca': 'Monarca', 'Alto rei': 'Alta rainha', 'Primeiro-ministro': 'Primeira-ministra' };
const titleOf = (n, c = n.ruler) => { const t = rankTitle(n); return c && c.f ? (FEM[t] || t) : t; };
const log = (m, k = 'info', who = []) => { S.log.unshift({ d: dateStr(), m, k }); if (S.log.length > 120) S.log.pop(); if (who.some(isHuman) || k === 'world') S.news.push({ m, k }); };

/* ---------- consultas ---------- */
let ownCache = null;                                         // listas de províncias por dono (refeitas quando muda dono)
function provsOf(id) { if (!ownCache) { ownCache = S.nations.map(() => []); for (let p = 0; p < S.own.length; p++) if (S.own[p] >= 0) ownCache[S.own[p]].push(p); } return ownCache[id] || []; }
/* zera todos os caches da simulação (mundo novo ou save carregado): nada do mundo anterior pode vazar */
function resetCaches() { ownCache = null; warSet = null; strC = null; nbC.clear(); epC = null; abC = null; frC = null; supC = null; enterC = null; cnC = null; BI = null; }
/* jogadores humanos: S.humans (multiplayer) ou o jogador local (S.player). A simulação só pergunta isHuman; a interface usa me() */
const humans = () => S.humans ? S.humans.filter(id => nat(id) && nat(id).alive) : S.player >= 0 ? [S.player] : [];
/* pendências de cada jogador humano (multiplayer: cada um tem as suas): offer = proposta de paz da IA · conf = impor a paz · lead = escolher o líder */
const pendGet = (k, pid) => ((S.pend || {})[k] || {})[pid] || null;
const pendSet = (k, pid, v) => { S.pend = S.pend || {}; (S.pend[k] = S.pend[k] || {})[pid] = v; };
const pendDel = (k, pid) => { if (S.pend && S.pend[k]) delete S.pend[k][pid]; };
const hasPending = pid => !!(pendGet('offer', pid) || pendGet('conf', pid) || pendGet('lead', pid) || (S.calls || []).some(c => (c.to ?? S.player) === pid) || (S.dipOffers || []).some(c => (c.to ?? S.player) === pid));
const isHuman = id => id != null && id >= 0 && (S.humans ? S.humans.includes(id) : id === S.player);
function ownChanged() { ownCache = null; S.mapDirty = true; enterC = null; }
const hasTech = (n, id) => !!n.techs[id];
let warSet = null;                                          // pares em guerra (refeito quando guerras começam ou acabam)
const warsChanged = () => { warSet = null; enterC = null; };
const atWar = (a, b) => { if (a === b || a < 0 || b < 0) return false; if (!warSet) { warSet = new Set(); S.wars.forEach(w => w.A.forEach(x => w.D.forEach(y => { warSet.add(x * 4096 + y); warSet.add(y * 4096 + x); }))); } return warSet.has(a * 4096 + b); };
const warsOf = id => S.wars.filter(w => w.A.includes(id) || w.D.includes(id));
const enemiesOf = id => [...new Set(warsOf(id).flatMap(w => w.A.includes(id) ? w.D : w.A))];
const regs = a => a.inf + a.cav + a.art + a.vrt;
function stateOwnerOf(s) { return S.own[WD.states[s].cap]; }
function fortOf(p) {
  const pr = WD.provs[p], st = WD.states[pr.state], o = S.own[p]; let f = 0;
  if (st.cap === p && stateOwnerOf(st.id) === o) f += S.bld[st.id].castle || 0;
  if (o >= 0 && nat(o).capital === p) f += 2;
  return f;
}
const hasT = (n, id) => n.eff ? n.eff.has(id) : !!n.techs[id];     // pesquisada direto ou trazida pela árvore da vertente
const techCount = n => n.eff ? n.tcount ?? n.eff.size : Object.keys(n.techs).length;
const vertLen = v => VERT[v].len;

/* ---------- modificadores ---------- */
/* efeitos de tecnologia que não são modificadores (prédios, governos, mares...) e normalização das leis */
let BASE_BLD = null;                                          // prédios liberados sem técnica
function calcFx(n) {
  const fx = { sea: 0, col: 0, fort: 0, med: 0, cap: 0, logi: 0, width: 0, slots: 1, ship: 1, bo: {}, up: { inf: 1, cav: 1, art: 1, siege: 1 }, b: new Set(BASE_BLD || (BASE_BLD = Object.keys(BUILDINGS).filter(b => !BUILDINGS[b].tech && !BUILDINGS[b].vert))), g: new Set(), i: new Set(['trad', 'warrior']) };
  const eff = new Set(Object.keys(n.techs)); let vl = 0;
  let vr = 0; for (const id in n.techs) { const t = TECH[id]; if (!t) continue; if (t.vt) vl++; if (t.vr) vr++; (t.src || []).forEach(x => eff.add(x)); }
  n.tcount = eff.size - vr;                                      // versões da vertente não contam em dobro
  n.eff = eff; n.vlv = vl;
  if (n.vert && vl >= VERT[n.vert].len) fx.ship += 1.5;          // vertente completa: frota especial
  for (const id of eff) {
    const t = TECH[id]; if (!t) continue; const f = t.fx;
    if (f.sea) fx.sea = Math.max(fx.sea, f.sea); if (f.col) fx.col += f.col; if (f.fort) fx.fort += f.fort; if (f.slots) fx.slots += f.slots; if (f.ship) fx.ship += f.ship; if (f.med) fx.med += f.med; if (f.cap) fx.cap += f.cap; if (f.logi) fx.logi += f.logi; if (f.width) fx.width += f.width;
    if (f.bo) for (const k in f.bo) fx.bo[k] = (fx.bo[k] || 0) + f.bo[k]; if (f.u) for (const k in f.u) fx.up[k] = (fx.up[k] || 0) + f.u[k];
    (f.b || []).forEach(b => { if (BUILDINGS[b]) fx.b.add(b); }); (f.g || []).forEach(g => fx.g.add(g)); (f.i || []).forEach(i => fx.i.add(i));   // prédio que sumiu do conteúdo não entra
  }
  n.laws = Object.assign({}, LAW_DEF, n.laws || {}); for (const k in LAWS) if (!LAWS[k].o[n.laws[k]]) n.laws[k] = LAW_DEF[k];
  return fx;
}
/* fontes de modificadores: TODO bônus do país passa por aqui, com rótulo — a soma (calcMods) e o detalhamento (modBreak) saem da mesma lista.
   Cada fonte devolve pares [rótulo, {mod: valor}]; a ordem é fixa (somas em ponto flutuante dependem dela). */
/* o que um personagem rende ao país: atributos (STATS: r no governante, c em qualquer conselheiro, s a mais no atributo do assento) e traços
   (governante inteiro; conselheiro COUNCIL_TRAIT_W, ou inteiro se o traço combina com o assento em TUTOR_TR). seat = assento do conselho ou null (governante). */
function charMods(n, c, seat) {
  if (!c) return []; const o = {}, out = [], who = seat ? 'Conselho: ' + roleName(n, seat) : 'Governante';
  const ss = seat ? COUNCIL.find(x => x[0] === seat)[2] : null;
  for (const k in STATS) { const S0 = STATS[k], d = c.st[k] - 8, v = seat ? d * S0.c + (k === ss ? d * S0.s : 0) : d * S0.r; if (v) o[S0.mod] = (o[S0.mod] || 0) + v; }
  out.push([who + ' · atributos', o]);
  for (const t of c.tr) { const T = TRAITS[t]; if (!T) continue; const w = !seat || (TUTOR_TR[seat] || []).includes(t) ? 1 : COUNCIL_TRAIT_W, m = {}; for (const k in T.m) m[k] = T.m[k] * w;
    out.push(['Traço ' + T.n + ' (' + charName(c) + (w < 1 ? ', fora do cargo' : '') + ')', m]); }
  return out;
}
const MOD_SOURCES = [
  n => (n.ae || 0) >= 1 ? [['Expansão agressiva ' + Math.round(n.ae), { stab: -n.ae * PEACE.aeStab }]] : [],   // terra tomada em tratados (sim/peace.js); some devagar
  n => [['Governo: ' + GOVS[n.gov].n, GOVS[n.gov].m], ['Ideologia: ' + IDEOS[n.ideo].n, IDEOS[n.ideo].m]],
  n => [...n.eff].filter(id => TECH[id] && TECH[id].fx.m).map(id => ['Tecnologia: ' + TECH[id].n, TECH[id].fx.m]),
  n => Object.keys(n.vdec || {}).map(k => { const v = VERT[k], o = {}; for (const m in v.m) o[m] = v.m[m] * VERT_DECLINE; return ['Vertente recusada: ' + v.n, o]; }),   // quem não escolhe leva 10% do bônus
  n => [...charMods(n, n.regent || n.ruler, null), ...COUNCIL.flatMap(([k]) => charMods(n, (n.council || {})[k], k))],   // na regência valem os atributos e traços do regente
  n => { const gd = GOVS[n.gov], out = [], age = govAge(n);       // instituições velhas perdem legitimidade com o tempo; título pequeno demais soa como pretensão
    if (age > 0) out.push(['Governo ultrapassado há ' + age + ' anos', { stab: -Math.min(.25, .05 + age / 250), coup: Math.min(.5, age / 100) }]);
    if (gd.minRank && (n.rank || 0) < gd.minRank) out.push(['Título pequeno para o governo', { stab: -.1 }]); return out; },
  n => Object.keys(LAWS).filter(k => condOk(n, LAWS[k].o[n.laws[k]].when)).map(k => ['Lei: ' + LAWS[k].n + ' — ' + LAWS[k].o[n.laws[k]].n, LAWS[k].o[n.laws[k]].m]),   // lei sem efeito quando a condição dela não vale (ex.: sucessão numa república)
  n => { const cv = n.cov || {}; return [['Serviços públicos', { growth: (cv.health || 0) * .5, research: (cv.edu || 0) * .3, tax: (cv.adm || 0) * .15, coup: -(cv.sec || 0) * .6 }]]; },
  n => { const bf = n.bfx || {}; return [['Prédios', { army: Math.min(.3, bf.army || 0), manpower: Math.min(.4, bf.mp || 0) }]]; },
  n => n.sats ? [['Satélites', { research: Math.min(20, n.sats) * .01, trade: Math.min(20, n.sats) * .005 }]] : [],
  n => S.moon && S.moon.base[n.id] ? [['Base lunar', { research: .05 }]] : [],
  n => n.alienTrade ? [['Comércio com a lua', { research: .05 * n.alienTrade }]] : [],
  n => { const cs = n.csat, cl = n.cls; if (!(cs && cl && n.popT)) return []; const mid = cl.mid / n.popT;   // a média pesquisa e paga impostos; a alta insatisfeita conspira
    return [['Classes sociais', { research: mid * .8 * cs.mid, tax: mid * .5 * cs.mid + (cs.high - .7) * .1, coup: Math.max(0, 1 - cs.high) * 1.2 }]]; },
  n => (n.tmods || []).filter(x => x.u > S.t).map(x => ['Evento: ' + x.l, x.m]),
  n => n.laws ? Object.keys(LAWS).filter(k => lawOld(n, k)).map(k => ['Lei ultrapassada: ' + LAWS[k].o[n.laws[k]].n, { stab: -.03 }]) : [],   // opção de lei passada da era (until)
  n => faithMods(n),
  n => courtMods(n),
  n => coldMods(n),
  n => S.culx && S.culx[n.cul] ? [['Cultura: ' + CULTURES[n.cul].n, S.culx[n.cul].m]] : [],             // peculiaridades do povo nesta partida                                                                        // Guerra Fria (sim/history.js)                                                                       // prestígio, conselho hostil e regência (sim/court.js)                                                                       // doutrina, fervor e excomunhão (sim/faith.js)          // modificadores temporários (EFF.mod)
];
const modList = n => MOD_SOURCES.flatMap(f => f(n)).filter(x => x[1]);
/* de onde vem um modificador: [[rótulo, valor]] somando fontes com o mesmo rótulo */
function modBreak(n, k) {
  const acc = new Map(); for (const [l, o] of modList(n)) if (o[k]) acc.set(l, (acc.get(l) || 0) + o[k]);
  return [...acc].filter(x => Math.abs(x[1]) > 1e-9).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
}
function calcMods(n) {
  const fx = calcFx(n), m = {}; Object.keys(MODS).forEach(k => m[k] = 0); m.coup = 0;
  for (const [, o] of modList(n)) for (const k in o) m[k] = (m[k] || 0) + o[k];
  n.m = m; n.fx = fx; n.era = natEra(n);
  const up = fx.up, um = n.vert && VUNITS[n.vert] ? VUNITS[n.vert].um : { inf: 1, cav: 1, art: 1 };
  n.up = { inf: up.inf * um.inf, cav: up.cav * um.cav, art: up.art * um.art, siege: up.siege, vrt: n.vert ? (up.inf * (1.5 + 1.75 * n.vlv / VERT[n.vert].len)) * (.5 + .5 * (n.vsat == null ? 1 : n.vsat)) : 0 };
}
function vRoster(n, type) {                                  // nome da tropa própria da vertente pelo progresso na árvore
  const V = n.vert && VUNITS[n.vert]; if (!V || !V[type]) return null; const pr = n.vlv / VERT[n.vert].len;
  let nm = V[type][0][1]; for (const [x, t] of V[type]) if (pr >= x) nm = t; return nm;
}
function unitName(n, type) {
  if (type === 'vrt') { if (!n.vert) return '—'; const v = VERT[n.vert]; return v.unit[clamp(Math.floor((n.vlv - 1) / v.len * v.unit.length), 0, v.unit.length - 1)]; }   // sem melhorias ainda: o primeiro nome
  const v = vRoster(n, type); if (v) return v;
  let nm = UNITS[type][0][1]; for (const [t, x] of UNITS[type]) if (hasT(n, t)) nm = x; return nm;
}
const vertDone = n => !!n.vert && n.vlv >= VERT[n.vert].len;
function shipName(n) { const v = vertDone(n) && vRoster(n, 'ship'); if (v) return v; let nm = SHIPS[0][1]; for (const [t, x] of SHIPS) if (hasT(n, t)) nm = x; return nm; }
const canArt = n => hasT(n, 'mil_trebuchet');
