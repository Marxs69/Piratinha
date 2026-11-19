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
const eraScale = () => 1 + (curYear() - 860) / 300;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dateStr = (t = S.t) => (t % 30 + 1) + ' ' + MONTHS[Math.floor(t % 360 / 30)] + ' ' + yearOf(t);
const nat = id => S.nations[id];
const ownName = (n, r, set) => !set || (r === 3 && !(set.f3for || []).includes(n.gov));   // no nível 3 cada governo usa o próprio nome
const rankFmt = (n, r = n.rank || 0) => { const g = GOVS[n.gov], set = RANKSET[g.cat]; return (ownName(n, r, set) ? g.fmt : set.f[r]) || '{}'; };
const rankTitle = (n, r = n.rank || 0) => { const g = GOVS[n.gov], set = RANKSET[g.cat]; return ownName(n, r, set) ? g.t : set.t[r]; };
const natName = n => rankFmt(n).replace('{}', n.name);
const FEM = { 'Rei': 'Rainha', 'Rei eleito': 'Rainha eleita', 'Imperador': 'Imperatriz', 'Chefe supremo': 'Chefe suprema', 'Sumo-sacerdote': 'Suma-sacerdotisa', 'Grão-mestre': 'Grã-mestra', 'Caudilho': 'Caudilha', 'Diretor técnico': 'Diretora técnica', 'Secretário-geral': 'Secretária-geral', 'Arquissábio': 'Arquissábia', 'Delegado': 'Delegada', 'Presidente do congresso': 'Presidenta do congresso', 'Mediador': 'Mediadora', 'Líder supremo': 'Líder suprema', 'Cônsul': 'Cônsul', 'Doge': 'Dogaresa', 'Cã': 'Cátum', 'Barão': 'Baronesa', 'Conde': 'Condessa', 'Duque': 'Duquesa', 'Grão-cã': 'Grã-cátum', 'Prefeito': 'Prefeita', 'Burgomestre': 'Burgomestra', 'Primeiro Cidadão': 'Primeira Cidadã', 'Comissário': 'Comissária', 'Secretário regional': 'Secretária regional', 'Prior': 'Prioresa', 'Bispo': 'Bispa', 'Arcebispo': 'Arcebispa', 'Governador militar': 'Governadora militar', 'Protetor': 'Protetora', 'Engenheiro-chefe': 'Engenheira-chefe', 'Supervisor': 'Supervisora', 'Diretor': 'Diretora', 'Arquiteto supremo': 'Arquiteta suprema', 'Monarca': 'Monarca', 'Alto rei': 'Alta rainha', 'Primeiro-ministro': 'Primeira-ministra' };
const titleOf = (n, c = n.ruler) => { const t = rankTitle(n); return c && c.f ? (FEM[t] || t) : t; };
const log = (m, k = 'info', who = []) => { S.log.unshift({ d: dateStr(), m, k }); if (S.log.length > 120) S.log.pop(); if (who.includes(S.player) || k === 'world') S.news.push({ m, k }); };

/* ---------- consultas ---------- */
let ownCache = null;                                         // listas de províncias por dono (refeitas quando muda dono)
function provsOf(id) { if (!ownCache) { ownCache = S.nations.map(() => []); for (let p = 0; p < S.own.length; p++) if (S.own[p] >= 0) ownCache[S.own[p]].push(p); } return ownCache[id] || []; }
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
const techCount = n => n.eff ? n.eff.size : Object.keys(n.techs).length;
const vertLen = v => VERT[v].len;

/* ---------- modificadores ---------- */
/* efeitos de tecnologia que não são modificadores (prédios, governos, mares...) e normalização das leis */
function calcFx(n) {
  const fx = { sea: 0, col: 0, fort: 0, med: 0, cap: 0, logi: 0, width: 0, slots: 1, ship: 1, bo: {}, up: { inf: 1, cav: 1, art: 1, siege: 1 }, b: new Set(Object.keys(BUILDINGS).filter(b => !BUILDINGS[b].tech && !BUILDINGS[b].vert)), g: new Set(), i: new Set(['trad', 'warrior']) };
  const eff = new Set(Object.keys(n.techs)); let vl = 0;
  for (const id in n.techs) { const t = TECH[id]; if (t && t.v) { vl++; (t.src || []).forEach(x => eff.add(x)); } }
  n.eff = eff; n.vlv = vl;
  for (const id of eff) {
    const t = TECH[id]; if (!t) continue; const f = t.fx;
    if (f.sea) fx.sea = Math.max(fx.sea, f.sea); if (f.col) fx.col += f.col; if (f.fort) fx.fort += f.fort; if (f.slots) fx.slots += f.slots; if (f.ship) fx.ship += f.ship; if (f.med) fx.med += f.med; if (f.cap) fx.cap += f.cap; if (f.logi) fx.logi += f.logi; if (f.width) fx.width += f.width;
    if (f.bo) for (const k in f.bo) fx.bo[k] = (fx.bo[k] || 0) + f.bo[k]; if (f.u) for (const k in f.u) fx.up[k] = (fx.up[k] || 0) + f.u[k];
    (f.b || []).forEach(b => fx.b.add(b)); (f.g || []).forEach(g => fx.g.add(g)); (f.i || []).forEach(i => fx.i.add(i));
  }
  n.laws = Object.assign({}, LAW_DEF, n.laws || {}); for (const k in LAWS) if (!LAWS[k].o[n.laws[k]]) n.laws[k] = LAW_DEF[k];
  return fx;
}
/* fontes de modificadores: TODO bônus do país passa por aqui, com rótulo — a soma (calcMods) e o detalhamento (modBreak) saem da mesma lista.
   Cada fonte devolve pares [rótulo, {mod: valor}]; a ordem é fixa (somas em ponto flutuante dependem dela). */
const STAT_MOD = [['adm', 'tax', .008, .006], ['lea', 'research', .008, .006], ['mar', 'army', .008, .006], ['dip', 'stab', .004, .003]];
const COUNCIL_STAT = { steward: 'adm', scholar: 'lea', marshal: 'mar', chancellor: 'dip' };
const MOD_SOURCES = [
  n => [['Governo: ' + GOVS[n.gov].n, GOVS[n.gov].m], ['Ideologia: ' + IDEOS[n.ideo].n, IDEOS[n.ideo].m]],
  n => [...n.eff].filter(id => TECH[id] && TECH[id].fx.m).map(id => ['Tecnologia: ' + TECH[id].n, TECH[id].fx.m]),
  n => { if (!n.vert) return []; const v = VERT[n.vert], o = {}; for (const k in v.m) o[k] = v.m[k] * n.vlv / v.len * (.5 + .5 * (n.vsat == null ? 1 : n.vsat)); return [['Vertente: ' + v.n, o]]; },
  n => [n.ruler, ...Object.values(n.council || {})].flatMap(c => c ? c.tr.filter(t => TRAITS[t]).map(t => ['Traço ' + TRAITS[t].n + ' (' + charName(c) + ')', TRAITS[t].m]) : []),
  n => { const R = n.regent || n.ruler, C = n.council || {}, out = [];   // na regência valem os atributos do regente
    if (R) { const o = {}; STAT_MOD.forEach(([s, k, w]) => o[k] = (R.st[s] - 8) * w); out.push(['Atributos do governante', o]); }
    STAT_MOD.forEach(([s, k, , w]) => { const role = Object.keys(COUNCIL_STAT).find(r => COUNCIL_STAT[r] === s), c = C[role]; if (c) out.push(['Conselho: ' + roleName(n, role), { [k]: (c.st[s] - 8) * w }]); });
    if (C.spymaster) out.push(['Conselho: ' + roleName(n, 'spymaster'), { coup: -(C.spymaster.st.int - 8) * .04 }]);
    if (R) out.push(['Atributos do governante', { coup: -(R.st.int - 8) * .02 }]);
    return out; },
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
  n => faithMods(n),
  n => courtMods(n),
  n => coldMods(n),                                                                        // Guerra Fria (sim/history.js)                                                                       // prestígio, conselho hostil e regência (sim/court.js)                                                                       // doutrina, fervor e excomunhão (sim/faith.js)          // modificadores temporários (EFF.mod)
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
  n.m = m; n.fx = fx;
  const up = fx.up, um = n.vert && VUNITS[n.vert] ? VUNITS[n.vert].um : { inf: 1, cav: 1, art: 1 };
  n.up = { inf: up.inf * um.inf, cav: up.cav * um.cav, art: up.art * um.art, siege: up.siege, vrt: n.vert ? (up.inf * (1.5 + 1.75 * n.vlv / VERT[n.vert].len)) * (.5 + .5 * (n.vsat == null ? 1 : n.vsat)) : 0 };
}
function vRoster(n, type) {                                  // nome da tropa própria da vertente pelo progresso na árvore
  const V = n.vert && VUNITS[n.vert]; if (!V || !V[type]) return null; const pr = n.vlv / VERT[n.vert].len;
  let nm = V[type][0][1]; for (const [x, t] of V[type]) if (pr >= x) nm = t; return nm;
}
function unitName(n, type) {
  if (type === 'vrt') { if (!n.vert) return '—'; const v = VERT[n.vert]; return v.unit[Math.min(v.unit.length - 1, Math.floor((n.vlv - 1) / v.len * v.unit.length))]; }
  const v = vRoster(n, type); if (v) return v;
  let nm = UNITS[type][0][1]; for (const [t, x] of UNITS[type]) if (hasT(n, t)) nm = x; return nm;
}
function shipName(n) { const v = n.vlv > 1 && vRoster(n, 'ship'); if (v) return v; let nm = SHIPS[0][1]; for (const [t, x] of SHIPS) if (hasT(n, t)) nm = x; return nm; }
const canArt = n => hasT(n, 'mil_trebuchet');
